from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import csv
import io
import json
import os
import uuid
from email.message import EmailMessage
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from api.middleware import require_api_csrf
from integrations.ai_client import RUNTIME_STATUS as _AI_RUNTIME_STATUS
from integrations.ai_client import call_external_ai as external_ai_answer
from integrations.ai_client import config_status as _ai_config_status
from integrations.smtp_client import send_message, smtp_settings
from database.auth import get_usuario_logado, hash_senha, require_permission, verificar_senha
from database.controllers.produto_controller import _remover_imagem, _salvar_imagem
from database.database import get_db
from database.models.categoria import Categoria
from database.models.cliente import Cliente
from database.models.movimentacao import Movimentacao, Tipo_movimentacao
from database.models.produto import Produto
from database.models.variacao import Atributo, ProdutoVariacao, ValorAtributo
from database.models.usuario import Usuario
from database.models.venda import ItemVenda, Venda
from database.models.armario import Armario, StatusArmario
from services.errors import ConflictError, NotFoundError, PersistenceError, ServiceError, ValidationError
from services.sale_service import RegisterSaleInput, SaleItemInput, register_sale
from services.report_service import generate_report
from services.stock_service import replenish_stock
from services.dashboard_service import daily_sales, dashboard_metrics, hourly_sales, top_products
from services.notification_service import notifications, system_health
from services.smart_service import fallback_answer, smart_insights
from utils.money import money as _money


router = APIRouter(
    prefix="/api/v1/pdv",
    tags=["API PDV"],
    dependencies=[Depends(require_api_csrf)],
)

PRODUCT_IMAGE_DIR = Path("database/static/uploads")
PRODUCT_IMAGE_PREFIX = "uploads"
PRODUCT_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _json_money(value: object) -> float:
    """Mantem o contrato numerico consumido pelo frontend JavaScript."""
    return float(_money(value))


def _service_http_exception(exc: ServiceError) -> HTTPException:
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, ConflictError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, PersistenceError):
        return HTTPException(status_code=500, detail=str(exc))
    return HTTPException(status_code=500, detail="Erro interno ao processar a operacao.")


def _carregar_timezone():
    try:
        return ZoneInfo(os.getenv("AAPM_TIMEZONE", "America/Sao_Paulo"))
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=-3))


LOCAL_TIMEZONE = _carregar_timezone()


class CategoriaPayload(BaseModel):
    nome: str


class EstoquePayload(BaseModel):
    quantidade: int
    variacao_id: int | None = None


class ProdutoStatusPayload(BaseModel):
    ativo: bool


class ItemVendaPayload(BaseModel):
    produto_id: int
    variacao_id: int | None = None
    quantidade: int


class VendaPayload(BaseModel):
    itens: list[ItemVendaPayload]
    pagamento: str
    associado: bool = False
    cliente_nome: str | None = None
    customerName: str | None = None
    observacao: str | None = ""
    excecao_pagamento: bool = False
    excecao_prazo: str | None = None
    excecao_observacao: str | None = None


class ExcecaoPagamentoPayload(BaseModel):
    pago: bool = True


class ClientePayload(BaseModel):
    nome: str
    matricula: str | None = None
    email: str | None = None
    telefone: str | None = None
    is_associado: bool = False


class SenhaPayload(BaseModel):
    senha_atual: str
    nova_senha: str


class SuportePayload(BaseModel):
    assunto: str | None = "Suporte"
    mensagem: str


class SmartAssistantPayload(BaseModel):
    message: str
    meta_diaria: int | None = 30
    lucro_unidade: float | None = 3.5


def _categoria_json(categoria: Categoria) -> dict:
    produtos_ativos = [p for p in categoria.produtos if p.ativo]
    return {
        "id": str(categoria.id),
        "name": categoria.nome,
        "nome": categoria.nome,
        "icon": "fa-box",
        "color": "#2D7BFF",
        "ativo": categoria.ativo,
        "productCount": len(produtos_ativos),
    }


def _produto_json(produto: Produto) -> dict:
    categoria = produto.categoria
    variacoes = [
        {
            "id": str(variacao.id),
            "size": variacao.valor_do_atributo("Tamanho"),
            "tamanho": variacao.valor_do_atributo("Tamanho"),
            "color": variacao.valor_do_atributo("Cor"),
            "cor": variacao.valor_do_atributo("Cor"),
            "label": variacao.nome_combinacao,
            "price": _json_money(variacao.preco),
            "preco": _json_money(variacao.preco),
            "stock": variacao.estoque_atual,
            "estoque_atual": variacao.estoque_atual,
        }
        for variacao in produto.variacoes
    ]
    return {
        "id": str(produto.id),
        "name": produto.nome,
        "nome": produto.nome,
        "categoryId": str(produto.categoria_id) if produto.categoria_id else "",
        "categoria_id": produto.categoria_id,
        "categoryName": categoria.nome if categoria else "",
        "price": _json_money(produto.preco),
        "preco": _json_money(produto.preco),
        "stock": produto.estoque_atual,
        "estoque_atual": produto.estoque_atual,
        "description": produto.descricao or "",
        "descricao": produto.descricao or "",
        "imageUrl": produto.imagem_url if produto.imagem_path else "",
        "ativo": produto.ativo,
        "hasVariations": bool(variacoes),
        "variations": variacoes,
        "variacoes": variacoes,
    }


def _parse_variacoes(valor: str) -> list[dict]:
    if not (valor or "").strip():
        return []
    try:
        itens = json.loads(valor)
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="As variacoes informadas sao invalidas.")
    if not isinstance(itens, list):
        raise HTTPException(status_code=400, detail="As variacoes devem ser uma lista.")

    resultado = []
    combinacoes = set()
    for item in itens:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="Variacao invalida.")
        tamanho = str(item.get("size") or item.get("tamanho") or "").strip()
        cor = str(item.get("color") or item.get("cor") or "").strip()
        try:
            preco = _money(item.get("price", item.get("preco")))
            estoque = int(item.get("stock", item.get("estoque_atual", 0)))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"Preco ou estoque invalido para o tamanho {tamanho or '?'}.")
        chave_combinacao = (tamanho.casefold(), cor.casefold())
        if not tamanho and not cor:
            raise HTTPException(status_code=400, detail="Informe o tamanho ou a cor de todas as variacoes.")
        if preco < 0 or estoque < 0:
            raise HTTPException(status_code=400, detail="Preco e estoque da variacao nao podem ser negativos.")
        if chave_combinacao in combinacoes:
            raise HTTPException(status_code=400, detail="A mesma combinacao de tamanho e cor foi informada mais de uma vez.")
        combinacoes.add(chave_combinacao)
        resultado.append({"tamanho": tamanho, "cor": cor, "preco": preco, "estoque": estoque})
    return resultado


def _salvar_variacoes(
    db: Session,
    produto: Produto,
    itens: list[dict],
    substituir: bool = True,
) -> None:
    if substituir:
        produto.variacoes.clear()
        db.flush()
    if not itens:
        return

    combinacoes_existentes = {
        (
            variacao.valor_do_atributo("Tamanho").casefold(),
            variacao.valor_do_atributo("Cor").casefold(),
        )
        for variacao in produto.variacoes
    }

    for item in itens:
        chave = (item["tamanho"].casefold(), item["cor"].casefold())
        if chave in combinacoes_existentes:
            nome = " / ".join(filter(None, (item["tamanho"], item["cor"])))
            raise HTTPException(status_code=409, detail=f"A variacao {nome} ja existe neste produto.")
        combinacoes_existentes.add(chave)
        valores = []
        for nome_atributo, conteudo in (("Tamanho", item["tamanho"]), ("Cor", item["cor"])):
            if not conteudo:
                continue
            atributo = db.query(Atributo).filter(func.lower(Atributo.nome) == nome_atributo.lower()).first()
            if not atributo:
                atributo = Atributo(nome=nome_atributo)
                db.add(atributo)
                db.flush()
            valor = (
                db.query(ValorAtributo)
                .filter(
                    ValorAtributo.atributo_id == atributo.id,
                    func.lower(ValorAtributo.valor) == conteudo.lower(),
                )
                .first()
            )
            if not valor:
                valor = ValorAtributo(atributo=atributo, valor=conteudo)
                db.add(valor)
                db.flush()
            valores.append(valor)
        produto.variacoes.append(ProdutoVariacao(
            codigo_produto=f"VAR-{uuid.uuid4().hex[:12].upper()}",
            preco=item["preco"],
            estoque_atual=item["estoque"],
            valores_atributos=valores,
        ))

    # Mantém os consumidores legados (relatórios, filtros e estoque) coerentes.
    produto.preco = min(variacao.preco for variacao in produto.variacoes)
    produto.estoque_atual = sum(variacao.estoque_atual for variacao in produto.variacoes)


def _imagem_existente_path(valor: str | None) -> str | None:
    valor = (valor or "").strip().replace("\\", "/")
    if not valor:
        return None
    if valor.startswith("/static/"):
        valor = valor[len("/static/"):]
    if valor.startswith("static/"):
        valor = valor[len("static/"):]

    nome_arquivo = Path(valor).name
    if not nome_arquivo or Path(nome_arquivo).suffix.lower() not in PRODUCT_IMAGE_EXTENSIONS:
        return None

    caminho = PRODUCT_IMAGE_DIR / nome_arquivo
    if not caminho.is_file():
        return None
    return f"{PRODUCT_IMAGE_PREFIX}/{nome_arquivo}"


def _usuario_id_atual(usuario: dict, db: Session) -> int | None:
    usuario_id = usuario.get("id")
    if usuario_id:
        return usuario_id

    email = usuario.get("sub")
    if not email:
        return None

    usuario_db = db.query(Usuario).filter(Usuario.email == email).first()
    return usuario_db.id if usuario_db else None


def _movimentacao_json(movimento: Movimentacao) -> dict:
    tipo = movimento.tipo.value if hasattr(movimento.tipo, "value") else str(movimento.tipo)
    is_entrada = tipo == Tipo_movimentacao.ENTRADA.value
    preco = _money(movimento.preco_unitario)
    quantidade = movimento.quantidade or 0
    criado_em = movimento.criado_em or getattr(movimento, "data", None)

    return {
        "id": str(movimento.id),
        "type": "entrada" if is_entrada else "saida",
        "typeLabel": "Entrada" if is_entrada else "Saída",
        "quantity": quantidade,
        "unitPrice": _json_money(preco),
        "total": _json_money(quantidade * preco),
        "note": movimento.observacao or "",
        "createdAt": criado_em.isoformat() if criado_em else None,
        "productId": str(movimento.produto_id),
        "productName": movimento.produto.nome if movimento.produto else "Produto removido",
        "userId": str(movimento.usuario_id),
        "userName": movimento.usuario.nome if movimento.usuario else "Usuario",
    }


def _agora_local() -> datetime:
    return datetime.now(LOCAL_TIMEZONE).replace(tzinfo=None)


def _hoje_local() -> date:
    return _agora_local().date()


def _parse_data_local(valor: str | None) -> datetime | None:
    texto = (valor or "").strip()
    if not texto:
        return None
    try:
        return datetime.fromisoformat(texto).replace(tzinfo=None)
    except ValueError:
        try:
            return datetime.combine(date.fromisoformat(texto), time(23, 59, 59))
        except ValueError:
            raise HTTPException(status_code=400, detail="Prazo de pagamento invalido.")


def _venda_json(venda: Venda) -> dict:
    observacao = venda.observacao or ""
    pagamento = _extrair_pagamento(observacao)
    if pagamento == "nao informado" and getattr(venda, "metodo_pagamento", None):
        pagamento = venda.metodo_pagamento
    cliente_nome = venda.cliente.nome if venda.cliente else _extrair_cliente(observacao)
    total_bruto = _money(venda.total_bruto or getattr(venda, "valor_total", 0))
    total_liquido = _money(venda.total_liquido or getattr(venda, "valor_final", 0))
    criado_em = venda.criado_em or getattr(venda, "data", None)
    excecao_ativa = bool(getattr(venda, "excecao_pagamento", False))
    excecao_status = getattr(venda, "excecao_status", "") or ("pendente" if excecao_ativa else "sem_excecao")
    prazo = getattr(venda, "excecao_prazo", None)
    pago_em = getattr(venda, "excecao_pago_em", None)
    return {
        "id": venda.id,
        "number": f"#{venda.id:04d}",
        "total_bruto": _json_money(total_bruto),
        "total_liquido": _json_money(total_liquido),
        "subtotal": _json_money(total_bruto),
        "total": _json_money(total_liquido),
        "desconto_percentual": _json_money(venda.desconto_percentual),
        "desconto_valor": _json_money(venda.desconto_valor),
        "customerName": cliente_nome,
        "payment": pagamento,
        "status": "pendente" if excecao_ativa and excecao_status == "pendente" else "concluido",
        "paymentException": {
            "enabled": excecao_ativa,
            "status": excecao_status,
            "dueAt": prazo.isoformat() if prazo else None,
            "paidAt": pago_em.isoformat() if pago_em else None,
            "note": getattr(venda, "excecao_observacao", None) or "",
        },
        "observacao": venda.observacao or "",
        "createdAt": criado_em.isoformat() if criado_em else None,
        "items": [
            {
                "produto_id": item.produto_id,
                "productId": str(item.produto_id) if item.produto_id else "",
                "name": item.produto_nome,
                "qty": item.quantidade,
                "price": _json_money(item.preco_unitario),
                "subtotal": _json_money(item.subtotal),
            }
            for item in venda.itens
        ],
    }


def _extrair_pagamento(observacao: str) -> str:
    texto = observacao or ""
    marcador = "Pagamento:"
    if marcador not in texto:
        return "nao informado"
    restante = texto.split(marcador, 1)[1].strip()
    return (restante.split(".", 1)[0] or "nao informado").strip().lower()


def _extrair_cliente(observacao: str) -> str:
    texto = observacao or ""
    marcador = "Cliente:"
    if marcador not in texto:
        return "Cliente balcao"
    restante = texto.split(marcador, 1)[1].strip()
    return (restante.split(".", 1)[0] or "Cliente balcao").strip()


def _cliente_json(cliente: Cliente) -> dict:
    vendas = [v for v in cliente.vendas]
    total_gasto = sum((_money(v.total_liquido) for v in vendas), Decimal("0.00"))
    ultima = max((v.criado_em for v in vendas if v.criado_em), default=None)
    return {
        "id": str(cliente.id),
        "name": cliente.nome,
        "nome": cliente.nome,
        "email": cliente.matricula or "",
        "phone": cliente.telefone or "",
        "matricula": cliente.matricula or "",
        "isAssociado": cliente.is_associado,
        "orders": len(vendas),
        "totalSpent": _json_money(total_gasto),
        "lastOrder": ultima.strftime("%d/%m/%Y") if ultima else "-",
    }


def _system_warnings(db: Session) -> list[dict]:
    warnings = []
    ai_status = _ai_config_status()
    smtp = smtp_settings()

    if not ai_status["ready"]:
        warnings.append({
            "id": "ai-config",
            "type": "warn",
            "icon": "fa-robot",
            "text": "AAPM Smart esta sem chave externa valida e pode cair no modo local.",
            "time": "Config",
        })
    elif _AI_RUNTIME_STATUS.get("ok") is False:
        provider = _AI_RUNTIME_STATUS.get("provider") or ai_status["provider"]
        warnings.append({
            "id": "ai-runtime",
            "type": "warn",
            "icon": "fa-plug-circle-xmark",
            "text": f"Ultima chamada da IA externa ({provider}) falhou. Verifique rede, modelo ou billing.",
            "time": "IA",
        })

    if not smtp.host or not smtp.sender or not smtp.support_recipient:
        warnings.append({
            "id": "smtp-config",
            "type": "warn",
            "icon": "fa-envelope-circle-check",
            "text": "SMTP incompleto: recuperacao de senha e suporte por email podem falhar.",
            "time": "Email",
        })

    produtos_ativos = db.query(Produto).filter(Produto.ativo == True).count()
    categorias_ativas = db.query(Categoria).filter(Categoria.ativo == True).count()
    produtos_sem_categoria = db.query(Produto).filter(
        Produto.ativo == True,
        or_(Produto.categoria_id == None, Produto.categoria_id == 0),
    ).count()

    if not categorias_ativas:
        warnings.append({
            "id": "no-categories",
            "type": "warn",
            "icon": "fa-tags",
            "text": "Nenhuma categoria ativa cadastrada. Cadastre categorias antes de vender.",
            "time": "Cadastro",
        })
    if not produtos_ativos:
        warnings.append({
            "id": "no-products",
            "type": "warn",
            "icon": "fa-box-open",
            "text": "Nenhum produto ativo cadastrado. O PDV ficara sem itens para venda.",
            "time": "Cadastro",
        })
    if produtos_sem_categoria:
        warnings.append({
            "id": "products-without-category",
            "type": "warn",
            "icon": "fa-layer-group",
            "text": f"{produtos_sem_categoria} produto(s) ativo(s) estao sem categoria.",
            "time": "Cadastro",
        })

    return warnings


def _enviar_email_suporte(usuario: dict, assunto: str, mensagem: str):
    settings = smtp_settings()
    if not settings.ready or not settings.support_recipient:
        print(f"[SUPORTE] {usuario.get('sub')} - {assunto}: {mensagem}")
        return

    email = EmailMessage()
    email["Subject"] = f"Suporte AAPM - {assunto.strip() or 'Solicitacao'}"
    email["From"] = settings.sender
    email["To"] = settings.support_recipient
    email.set_content(
        "Nova solicitacao de suporte registrada no sistema AAPM.\n\n"
        f"Usuario: {usuario.get('nome') or '-'}\n"
        f"E-mail: {usuario.get('sub') or '-'}\n"
        f"Perfil: {usuario.get('role') or '-'}\n"
        f"Assunto: {assunto.strip() or 'Suporte'}\n\n"
        f"Mensagem:\n{mensagem.strip()}\n"
    )

    send_message(email, settings=settings)


def _inicio_do_dia(dia: date) -> datetime:
    return datetime.combine(dia, time.min)


def _fim_do_dia(dia: date) -> datetime:
    return datetime.combine(dia, time.max)


def _pct(atual: float, anterior: float) -> float:
    return ((atual - anterior) / anterior * 100) if anterior else 0.0


def _csv_response(nome_arquivo: str, cabecalho: list[str], linhas: list[list[object]]) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(cabecalho)
    writer.writerows(linhas)
    content = "\ufeff" + buffer.getvalue()
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome_arquivo}"'},
    )


@router.get("/categories")
def listar_categorias_api(
    offset: int | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    query = db.query(Categoria).filter(Categoria.ativo == True).order_by(Categoria.nome)
    if (offset is None) != (limit is None):
        raise HTTPException(status_code=400, detail="Offset e limit devem ser informados juntos.")
    if offset is not None:
        total = query.count()
        categorias = query.offset(offset).limit(limit).all()
        return {"items": [_categoria_json(categoria) for categoria in categorias], "total": total, "offset": offset, "limit": limit}
    categorias = query.all()
    return [_categoria_json(categoria) for categoria in categorias]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
def criar_categoria_api(
    payload: CategoriaPayload,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("categories")),
):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome da categoria.")

    existente = db.query(Categoria).filter(Categoria.nome.ilike(nome)).first()
    if existente:
        raise HTTPException(status_code=409, detail="Ja existe uma categoria com este nome.")

    categoria = Categoria(nome=nome, ativo=True)
    db.add(categoria)
    db.commit()
    db.refresh(categoria)

    return _categoria_json(categoria)


@router.put("/categories/{categoria_id}")
def editar_categoria_api(
    categoria_id: int,
    payload: CategoriaPayload,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("categories")),
):
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria or not categoria.ativo:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada.")

    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome da categoria.")

    conflito = (
        db.query(Categoria)
        .filter(Categoria.nome.ilike(nome), Categoria.id != categoria_id)
        .first()
    )
    if conflito:
        raise HTTPException(status_code=409, detail="Ja existe outra categoria com este nome.")

    categoria.nome = nome
    db.commit()
    db.refresh(categoria)

    return _categoria_json(categoria)


@router.delete("/categories/{categoria_id}")
def remover_categoria_api(
    categoria_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("categories")),
):
    categoria = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not categoria or not categoria.ativo:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada.")

    produtos_ativos = [p for p in categoria.produtos if p.ativo]
    if produtos_ativos:
        raise HTTPException(
            status_code=409,
            detail="Nao e possivel remover categoria com produtos ativos vinculados.",
        )

    categoria.ativo = False
    db.commit()

    return {"ok": True}


@router.get("/stock/movements")
def listar_movimentacoes_estoque_api(
    produto_id: int | None = Query(default=None),
    tipo: str = "",
    offset: int | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=200),
    db: Session = Depends(get_db),
    admin=Depends(require_permission("stock", "movements", "stock_movements")),
):
    query = db.query(Movimentacao).order_by(Movimentacao.criado_em.desc(), Movimentacao.id.desc())

    if produto_id:
        query = query.filter(Movimentacao.produto_id == produto_id)

    tipo_normalizado = (tipo or "").strip().lower()
    if tipo_normalizado:
        mapa_tipo = {
            "entrada": Tipo_movimentacao.ENTRADA,
            "adicionar": Tipo_movimentacao.ENTRADA,
            "saida": Tipo_movimentacao.SAIDA,
            "retirar": Tipo_movimentacao.SAIDA,
        }
        tipo_enum = mapa_tipo.get(tipo_normalizado)
        if not tipo_enum:
            raise HTTPException(status_code=400, detail="Tipo de movimentacao invalido.")
        query = query.filter(Movimentacao.tipo == tipo_enum)

    if (offset is None) != (limit is None):
        raise HTTPException(status_code=400, detail="Offset e limit devem ser informados juntos.")
    if offset is not None:
        total = query.count()
        movimentos = query.offset(offset).limit(limit).all()
        return {"items": [_movimentacao_json(movimento) for movimento in movimentos], "total": total, "offset": offset, "limit": limit}
    movimentos = query.limit(80).all()
    return [_movimentacao_json(movimento) for movimento in movimentos]


@router.get("/products")
def listar_produtos_api(
    q: str = "",
    category_id: int | None = Query(default=None),
    stock: str = "",
    status_filtro: str = Query("active", alias="status"),
    offset: int | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    usuario=Depends(require_permission("products", "stock", "movements", "stock_movements", "dashboard", "charts", "reports", "smart")),
):
    query = db.query(Produto)

    status_normalizado = (status_filtro or "active").strip().lower()
    if status_normalizado in ("active", "ativo", "ativos"):
        query = query.filter(Produto.ativo == True)
    elif status_normalizado in ("inactive", "inativo", "inativos"):
        query = query.filter(Produto.ativo == False)
    elif status_normalizado in ("all", "todos"):
        pass
    else:
        raise HTTPException(status_code=400, detail="Status de produto invalido.")

    if q:
        query = query.filter(Produto.nome.ilike(f"%{q.strip()}%"))

    if category_id:
        query = query.filter(Produto.categoria_id == category_id)

    if stock == "in":
        query = query.filter(Produto.estoque_atual > 0)
    elif stock == "low":
        query = query.filter(Produto.estoque_atual > 0, Produto.estoque_atual <= 5)
    elif stock == "out":
        query = query.filter(Produto.estoque_atual <= 0)

    if (offset is None) != (limit is None):
        raise HTTPException(status_code=400, detail="Offset e limit devem ser informados juntos.")

    if offset is None:
        return [_produto_json(produto) for produto in query.order_by(Produto.nome).all()]

    total = query.count()
    produtos = query.order_by(Produto.nome).offset(offset).limit(limit).all()
    return {
        "items": [_produto_json(produto) for produto in produtos],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/product-images")
def listar_imagens_produto_api(admin=Depends(require_permission("products"))):
    PRODUCT_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    imagens = []
    for caminho in sorted(PRODUCT_IMAGE_DIR.iterdir(), key=lambda item: item.stat().st_mtime, reverse=True):
        if not caminho.is_file() or caminho.suffix.lower() not in PRODUCT_IMAGE_EXTENSIONS:
            continue
        rel = f"{PRODUCT_IMAGE_PREFIX}/{caminho.name}"
        stat = caminho.stat()
        imagens.append({
            "name": caminho.name,
            "path": rel,
            "url": f"/static/{rel}",
            "size": stat.st_size,
            "updatedAt": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        })
    return imagens


@router.get("/sale/products")
def listar_produtos_pdv_api(
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    produtos = (
        db.query(Produto)
        .filter(Produto.ativo == True)
        .order_by(Produto.nome)
        .all()
    )
    hoje = _hoje_local()
    top_rows = (
        db.query(
            ItemVenda.produto_id,
            func.coalesce(func.sum(ItemVenda.quantidade), 0).label("qty"),
            func.coalesce(func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario), 0).label("revenue"),
        )
        .join(Venda, Venda.id == ItemVenda.venda_id)
        .filter(ItemVenda.produto_id != None)
        .filter(Venda.criado_em >= _inicio_do_dia(hoje), Venda.criado_em <= _fim_do_dia(hoje))
        .group_by(ItemVenda.produto_id)
        .order_by(
            func.coalesce(func.sum(ItemVenda.quantidade), 0).desc(),
            func.coalesce(func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario), 0).desc(),
        )
        .limit(2)
        .all()
    )
    top_ids = set()
    if top_rows:
        top_product_id, top_qty, _ = top_rows[0]
        next_qty = top_rows[1][1] if len(top_rows) > 1 else 0
        if top_product_id and int(top_qty or 0) > 5 and int(top_qty or 0) > int(next_qty or 0):
            top_ids.add(top_product_id)
    resposta = []
    for produto in produtos:
        data = _produto_json(produto)
        data["isTopSeller"] = produto.id in top_ids
        resposta.append(data)
    return resposta


@router.post("/sales", status_code=status.HTTP_201_CREATED)
def criar_venda_api(
    payload: VendaPayload,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    excecao_ativa = bool(payload.excecao_pagamento)
    excecao_prazo = _parse_data_local(payload.excecao_prazo) if excecao_ativa else None
    try:
        venda = register_sale(
            db,
            RegisterSaleInput(
                items=[
                    SaleItemInput(
                        product_id=item.produto_id,
                        variation_id=item.variacao_id,
                        quantity=item.quantidade,
                    )
                    for item in payload.itens
                ],
                payment=payload.pagamento,
                customer_name=payload.cliente_nome or payload.customerName or "",
                note=payload.observacao or "",
                payment_exception=excecao_ativa,
                payment_due_at=excecao_prazo,
                payment_exception_note=payload.excecao_observacao or "",
            ),
            user_id=usuario.get("id"),
            created_at=_agora_local(),
        )
    except ServiceError as exc:
        raise _service_http_exception(exc)

    return _venda_json(venda)


@router.get("/customers")
def listar_clientes_api(
    q: str = Query("", max_length=100),
    offset: int | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    admin=Depends(require_permission("customers", "reports")),
):
    query = db.query(Cliente).filter(Cliente.ativo == True)
    termo = q.strip()
    if termo:
        like = f"%{termo}%"
        query = query.filter(or_(Cliente.nome.ilike(like), Cliente.matricula.ilike(like), Cliente.telefone.ilike(like)))

    query = query.order_by(Cliente.nome)
    if (offset is None) != (limit is None):
        raise HTTPException(status_code=400, detail="Offset e limit devem ser informados juntos.")
    if offset is not None:
        total = query.count()
        clientes = query.offset(offset).limit(limit).all()
        return {"items": [_cliente_json(cliente) for cliente in clientes], "total": total, "offset": offset, "limit": limit}
    clientes = query.all()
    return [_cliente_json(cliente) for cliente in clientes]


@router.get("/associates/lookup")
def consultar_associado_api(
    q: str = Query("", max_length=100),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    termo = q.strip()
    if not termo:
        return {"found": False, "isAssociado": False, "message": "Informe o nome ou matricula."}

    like = f"%{termo}%"
    associado = (
        db.query(Cliente)
        .filter(
            Cliente.ativo == True,
            or_(Cliente.nome.ilike(like), Cliente.matricula.ilike(like), Cliente.telefone.ilike(like)),
        )
        .order_by(Cliente.is_associado.desc(), Cliente.nome)
        .first()
    )

    if not associado:
        return {"found": False, "isAssociado": False, "message": "Associado nao encontrado."}

    data = _cliente_json(associado)
    data.update({
        "found": True,
        "isAssociado": associado.is_associado,
        "message": "Associado confirmado." if associado.is_associado else "Cadastro encontrado, mas sem beneficio de associado.",
    })
    return data


@router.get("/associates/search")
def buscar_associados_api(
    q: str = Query("", min_length=2, max_length=100),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    termo = q.strip()
    like = f"%{termo}%"
    associados = (
        db.query(Cliente)
        .filter(
            Cliente.ativo == True,
            Cliente.is_associado == True,
            or_(Cliente.nome.ilike(like), Cliente.matricula.ilike(like), Cliente.telefone.ilike(like)),
        )
        .order_by(Cliente.nome)
        .limit(6)
        .all()
    )
    return [_cliente_json(associado) for associado in associados]


@router.post("/customers", status_code=status.HTTP_201_CREATED)
def criar_cliente_api(
    payload: ClientePayload,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("customers")),
):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do cliente.")

    matricula = (payload.matricula or payload.email or "").strip() or None
    existente = db.query(Cliente).filter(Cliente.nome.ilike(nome), Cliente.ativo == True).first()
    if existente:
        existente.matricula = matricula or existente.matricula
        existente.telefone = (payload.telefone or "").strip() or existente.telefone
        existente.is_associado = payload.is_associado
        db.commit()
        db.refresh(existente)
        return _cliente_json(existente)

    cliente = Cliente(
        nome=nome,
        matricula=matricula,
        telefone=(payload.telefone or "").strip() or None,
        is_associado=payload.is_associado,
        ativo=True,
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return _cliente_json(cliente)


@router.delete("/customers/{cliente_id}")
def remover_cliente_api(
    cliente_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("customers")),
):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.ativo == True).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Associado nao encontrado.")

    cliente.ativo = False
    db.commit()

    return {"ok": True}


@router.get("/orders")
def listar_pedidos_api(
    q: str = Query("", max_length=100),
    status_filtro: str = Query("", alias="status"),
    offset: int | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    admin=Depends(require_permission("orders", "dashboard", "charts", "reports", "smart")),
):
    if status_filtro and status_filtro not in ("concluido", "pendente"):
        return []

    vendas = db.query(Venda).order_by(Venda.criado_em.desc()).limit(300).all()
    termo = q.strip().lower()
    rows = [_venda_json(venda) for venda in vendas]
    if status_filtro:
        rows = [row for row in rows if row["status"] == status_filtro]
    if termo:
        rows = [
            row for row in rows
            if termo in f"{row['number']} {row['customerName']} {row['payment']}".lower()
        ]
    if (offset is None) != (limit is None):
        raise HTTPException(status_code=400, detail="Offset e limit devem ser informados juntos.")
    if offset is not None:
        total = len(rows)
        return {"items": rows[offset:offset + limit], "total": total, "offset": offset, "limit": limit}
    return rows


@router.put("/orders/{venda_id}/payment-exception")
def atualizar_excecao_pagamento_api(
    venda_id: int,
    payload: ExcecaoPagamentoPayload,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("orders")),
):
    venda = db.query(Venda).filter(Venda.id == venda_id).first()
    if not venda:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado.")
    if not getattr(venda, "excecao_pagamento", False):
        raise HTTPException(status_code=400, detail="Este pedido nao possui excecao de pagamento.")

    if payload.pago:
        venda.excecao_status = "pago"
        venda.excecao_pago_em = _agora_local()
    else:
        venda.excecao_status = "pendente"
        venda.excecao_pago_em = None

    db.commit()
    db.refresh(venda)
    return _venda_json(venda)


@router.get("/dashboard/daily")
def vendas_por_dia_api(
    dias: int = Query(7, alias="range", ge=1, le=90),
    db: Session = Depends(get_db),
    admin=Depends(require_permission("dashboard", "charts", "reports", "smart")),
):
    return daily_sales(db, dias, _hoje_local())


@router.get("/dashboard/hourly")
def vendas_por_hora_api(
    db: Session = Depends(get_db),
    admin=Depends(require_permission("dashboard", "charts")),
):
    return hourly_sales(db, _hoje_local())


@router.get("/dashboard/metrics")
def metricas_dashboard_api(
    db: Session = Depends(get_db),
    admin=Depends(require_permission("dashboard", "charts")),
):
    return dashboard_metrics(db, _hoje_local())


@router.get("/dashboard/top-products")
def produtos_mais_vendidos_api(
    db: Session = Depends(get_db),
    admin=Depends(require_permission("dashboard", "charts", "smart")),
):
    return top_products(db)


@router.get("/smart/insights")
def aapm_smart_insights_api(
    meta_diaria: int = Query(30, ge=1, le=1000),
    lucro_unidade: float = Query(3.5, ge=0, le=10000),
    db: Session = Depends(get_db),
    admin=Depends(require_permission("smart")),
):
    return smart_insights(db, _hoje_local(), meta_diaria, lucro_unidade)

    try:
        meta_diaria = int(meta_diaria)
    except (TypeError, ValueError):
        meta_diaria = 30
    try:
        lucro_unidade = float(lucro_unidade)
    except (TypeError, ValueError):
        lucro_unidade = 3.5

    hoje = _hoje_local()
    historico = vendas_por_dia_api(dias=30, db=db, admin=admin)
    ultimos_validos = [row for row in historico if row["orders"] or row["items"] or row["revenue"]]
    janela = ultimos_validos[-7:] if ultimos_validos else historico[-7:]
    divisor = max(1, len(janela))

    media_receita = sum(row["revenue"] for row in janela) / divisor
    media_itens = sum(row["items"] for row in janela) / divisor
    media_pedidos = sum(row["orders"] for row in janela) / divisor
    hoje_row = historico[-1] if historico else {"revenue": 0, "items": 0, "orders": 0}

    fator_dia = 1.08 if hoje.weekday() in (0, 1, 2, 3) else 0.92
    receita_prevista = max(float(hoje_row["revenue"]), media_receita * fator_dia)
    itens_previstos = max(int(round(media_itens * fator_dia)), int(hoje_row["items"] or 0))
    pedidos_previstos = max(int(round(media_pedidos * fator_dia)), int(hoje_row["orders"] or 0))
    confianca = min(92, max(48, 54 + len(ultimos_validos) * 2 + (10 if media_itens else 0)))

    produtos = db.query(Produto).filter(Produto.ativo == True).order_by(Produto.nome).all()
    top_produtos = produtos_mais_vendidos_api(db=db, admin=admin)
    top_por_id = {int(item["productId"]): item for item in top_produtos if item.get("productId")}
    baixo_estoque = [p for p in produtos if (p.estoque_atual or 0) <= 5]

    riscos = []
    reposicao = []
    for produto in produtos:
        vendido = top_por_id.get(produto.id, {}).get("qty", 0)
        giro_estimado = max(1, int(round(vendido / 7))) if vendido else 1
        estoque = int(produto.estoque_atual or 0)
        if estoque <= max(2, giro_estimado):
            riscos.append(produto)
        if estoque <= 5 or produto in riscos:
            reposicao.append({
                "name": produto.nome,
                "quantity": max(5, giro_estimado * 3 - estoque),
                "reason": "Estoque critico" if produto in riscos else "Estoque baixo",
            })

    reposicao = reposicao[:3]
    while len(reposicao) < 3:
      indice = len(reposicao) + 1
      reposicao.append({
          "name": f"Produto de giro {indice}",
          "quantity": max(3, 12 - indice * 3),
          "reason": "Sugestao preventiva",
      })

    faltam = max(0, meta_diaria - itens_previstos)
    lucro_hoje = itens_previstos * lucro_unidade
    demanda = "Alta" if itens_previstos >= meta_diaria else "Moderada" if itens_previstos >= meta_diaria * 0.72 else "Baixa"

    if faltam == 0:
        estrategia = "Meta atingida pela previsao. Mantenha estoque dos itens de maior giro e priorize atendimento rapido nos horarios de pico."
    elif faltam <= 5:
        estrategia = f"A meta esta perto: faltam {faltam} vendas. Crie um combo simples com o produto mais vendido e destaque no intervalo."
    elif faltam <= 12:
        estrategia = f"A meta exige acao: faltam {faltam} vendas. Antecipe produtos de giro rapido, revise fila do PDV e use uma oferta curta no pico."
    else:
        estrategia = f"A meta esta distante: faltam {faltam} vendas. Reavalie a meta de hoje, use combo promocional e reduza reposicao de itens parados."

    oportunidades = [
        {"icon": "fa-tags", "text": "Criar combo de baixa saida"},
        {"icon": "fa-cash-register", "text": "Preparar produtos do pico"},
        {"icon": "fa-clipboard-check", "text": "Revisar estoque minimo"},
    ]
    if top_produtos:
        oportunidades[0]["text"] = f"Destacar {top_produtos[0]['name']} no proximo intervalo"
    if baixo_estoque:
        oportunidades[2]["text"] = f"Repor {baixo_estoque[0].nome} antes do pico"

    return {
        "forecast": {
            "revenueToday": round(receita_prevista, 2),
            "itemsToday": itens_previstos,
            "ordersToday": pedidos_previstos,
            "stockRiskCount": len(riscos),
            "confidence": int(confianca),
            "demand": demanda,
            "peakHint": "Maior saida entre 09h e 10h",
        },
        "goals": {
            "dailyGoal": meta_diaria,
            "profitPerItem": lucro_unidade,
            "profitToday": round(lucro_hoje, 2),
            "profitMonth": round(lucro_hoje * 30, 2),
            "profitYear": round(lucro_hoje * 364, 2),
            "missing": faltam,
            "strategy": estrategia,
        },
        "restock": reposicao,
        "opportunities": oportunidades,
        "summary": {
            "title": f"Demanda {demanda.lower()}",
            "text": "A previsao combina historico recente, estoque atual e produtos com maior giro para sugerir a melhor acao do dia.",
        },
    }


def _aapm_smart_fallback_answer(message: str, insights: dict) -> str:
    forecast = insights.get("forecast", {})
    goals = insights.get("goals", {})
    restock = insights.get("restock", [])
    restock_text = ", ".join(f"{item['name']} (+{item['quantity']} un.)" for item in restock[:3]) or "sem reposicao critica"
    return (
        "Estou no modo IA local porque a chave externa ainda nao foi configurada. "
        f"Pela previsao atual, a demanda esta {str(forecast.get('demand', 'em analise')).lower()}, "
        f"com {forecast.get('itemsToday', 0)} itens previstos e {forecast.get('stockRiskCount', 0)} produto(s) em risco. "
        f"Meta: faltam {goals.get('missing', 0)} venda(s). "
        f"Reposicao sugerida: {restock_text}. "
        f"Estrategia: {goals.get('strategy', 'revise estoque, atendimento e produtos de maior giro.')}"
    )


@router.post("/smart/assistant")
def aapm_smart_assistant_api(
    payload: SmartAssistantPayload,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("smart")),
):
    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Mensagem vazia.")

    insights = smart_insights(db, _hoje_local(), payload.meta_diaria or 30, payload.lucro_unidade or 3.5)
    external_answer = external_ai_answer(message, insights)
    if external_answer:
        return {"mode": "external", "answer": external_answer, "insights": insights}

    return {"mode": "local", "answer": fallback_answer(message, insights), "insights": insights}


@router.get("/system/health")
def sistema_health_api(
    db: Session = Depends(get_db),
    admin=Depends(require_permission("settings")),
):
    return system_health(db, _agora_local())


@router.get("/notifications")
def notificacoes_api(
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    return notifications(db, _agora_local())


@router.get("/reports/{tipo}")
def baixar_relatorio_api(
    tipo: str,
    period: str = Query("month"),
    db: Session = Depends(get_db),
    admin=Depends(require_permission("reports")),
):
    try:
        report = generate_report(db, tipo, period, _hoje_local())
    except ServiceError as exc:
        raise _service_http_exception(exc)
    return _csv_response(report.filename, report.header, report.rows)


@router.get("/profile")
def perfil_api(
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    user = db.query(Usuario).filter(Usuario.id == usuario.get("id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    return {
        "id": user.id,
        "nome": user.nome,
        "email": user.email,
        "role": user.role,
        "ativo": user.ativo,
    }


@router.post("/profile/password")
def atualizar_senha_api(
    payload: SenhaPayload,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    user = db.query(Usuario).filter(Usuario.id == usuario.get("id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    if not verificar_senha(payload.senha_atual, user.senha_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    if len(payload.nova_senha or "") < 6:
        raise HTTPException(status_code=400, detail="A nova senha deve ter pelo menos 6 caracteres.")

    user.senha_hash = hash_senha(payload.nova_senha)
    db.commit()
    return {"ok": True}


@router.post("/support")
def suporte_api(
    payload: SuportePayload,
    usuario=Depends(get_usuario_logado),
):
    if not (payload.mensagem or "").strip():
        raise HTTPException(status_code=400, detail="Descreva a solicitacao de suporte.")
    try:
        _enviar_email_suporte(usuario, payload.assunto or "Suporte", payload.mensagem)
    except Exception as exc:
        print(f"[SUPORTE] Falha ao enviar solicitacao de suporte: {exc}")
        raise HTTPException(status_code=502, detail="Nao foi possivel enviar a solicitacao de suporte.")
    return {
        "ok": True,
        "message": "Solicitacao enviada para a equipe de suporte.",
    }


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def criar_produto_api(
    nome: str = Form(...),
    descricao: str = Form(""),
    preco: Decimal = Form(...),
    estoque_atual: int = Form(...),
    categoria_id: int = Form(0),
    imagem: UploadFile = File(None),
    imagem_existente: str = Form(""),
    variacoes: str = Form(""),
    db: Session = Depends(get_db),
    admin=Depends(require_permission("products")),
):
    nome = nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do produto.")

    variacoes_data = _parse_variacoes(variacoes)
    existente = db.query(Produto).filter(Produto.nome.ilike(nome)).first()
    if existente and not variacoes_data:
        raise HTTPException(
            status_code=409,
            detail="Este produto ja existe. Adicione uma variacao de tamanho ou cor para complementar o cadastro.",
        )
    if estoque_atual < 0:
        raise HTTPException(status_code=400, detail="O estoque nao pode ser negativo.")

    categoria_id = categoria_id or None
    if categoria_id:
        categoria = (
            db.query(Categoria)
            .filter(Categoria.id == categoria_id, Categoria.ativo == True)
            .first()
        )
        if not categoria:
            raise HTTPException(status_code=400, detail="Categoria invalida.")

    imagem_path = await _salvar_imagem(imagem) or _imagem_existente_path(imagem_existente)

    if existente:
        _salvar_variacoes(db, existente, variacoes_data, substituir=False)
        existente.ativo = True
        if (descricao or "").strip():
            existente.descricao = descricao.strip()
        if categoria_id:
            existente.categoria_id = categoria_id
        if imagem_path:
            _remover_imagem(existente.imagem_path)
            existente.imagem_path = imagem_path
        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Nao foi possivel adicionar a variacao ao produto.")
        db.refresh(existente)
        return _produto_json(existente)

    produto = Produto(
        nome=nome,
        descricao=(descricao or "").strip(),
        preco=preco,
        estoque_atual=estoque_atual,
        categoria_id=categoria_id,
        imagem_path=imagem_path,
    )

    db.add(produto)
    db.flush()
    _salvar_variacoes(db, produto, variacoes_data)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Nao foi possivel gerar o codigo interno da variacao.")
    db.refresh(produto)

    return _produto_json(produto)


@router.put("/products/{produto_id}")
async def editar_produto_api(
    produto_id: int,
    nome: str = Form(...),
    descricao: str = Form(""),
    preco: Decimal = Form(...),
    estoque_atual: int = Form(...),
    categoria_id: int = Form(0),
    imagem: UploadFile = File(None),
    imagem_existente: str = Form(""),
    variacoes: str = Form(""),
    db: Session = Depends(get_db),
    admin=Depends(require_permission("products")),
):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto or not produto.ativo:
        raise HTTPException(status_code=404, detail="Produto nao encontrado.")

    nome = nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do produto.")

    conflito = (
        db.query(Produto)
        .filter(Produto.nome.ilike(nome), Produto.id != produto_id)
        .first()
    )
    if conflito:
        raise HTTPException(status_code=409, detail="Ja existe outro produto com este nome.")

    variacoes_data = _parse_variacoes(variacoes)
    if estoque_atual < 0:
        raise HTTPException(status_code=400, detail="O estoque nao pode ser negativo.")

    categoria_id = categoria_id or None
    if categoria_id:
        categoria = (
            db.query(Categoria)
            .filter(Categoria.id == categoria_id, Categoria.ativo == True)
            .first()
        )
        if not categoria:
            raise HTTPException(status_code=400, detail="Categoria invalida.")

    nova_imagem_path = await _salvar_imagem(imagem)
    if nova_imagem_path:
        _remover_imagem(produto.imagem_path)
        produto.imagem_path = nova_imagem_path
    else:
        imagem_path_existente = _imagem_existente_path(imagem_existente)
        if imagem_path_existente:
            produto.imagem_path = imagem_path_existente

    produto.nome = nome
    produto.descricao = (descricao or "").strip()
    produto.preco = preco
    produto.estoque_atual = estoque_atual
    produto.categoria_id = categoria_id
    _salvar_variacoes(db, produto, variacoes_data)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Nao foi possivel gerar o codigo interno da variacao.")
    db.refresh(produto)

    return _produto_json(produto)


@router.post("/products/{produto_id}/stock")
def adicionar_estoque_api(
    produto_id: int,
    payload: EstoquePayload,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("stock", "movements", "stock_movements")),
):
    usuario_id = _usuario_id_atual(admin, db)
    try:
        produto = replenish_stock(
            db,
            product_id=produto_id,
            quantity=payload.quantidade,
            variation_id=payload.variacao_id,
            user_id=usuario_id,
            created_at=_agora_local(),
        )
    except ServiceError as exc:
        raise _service_http_exception(exc)

    return _produto_json(produto)


@router.put("/products/{produto_id}/status")
def alterar_status_produto_api(
    produto_id: int,
    payload: ProdutoStatusPayload,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("products")),
):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto nao encontrado.")

    produto.ativo = payload.ativo
    db.commit()
    db.refresh(produto)

    return _produto_json(produto)


@router.delete("/products/{produto_id}")
def remover_produto_api(
    produto_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_permission("products")),
):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto nao encontrado.")

    db.query(Movimentacao).filter(Movimentacao.produto_id == produto_id).delete(synchronize_session=False)
    db.query(ItemVenda).filter(ItemVenda.produto_id == produto_id).update(
        {ItemVenda.produto_id: None},
        synchronize_session=False,
    )
    db.delete(produto)
    db.commit()

    return {"ok": True}
