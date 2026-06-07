from datetime import date, datetime, time, timedelta
import csv
import io
import json
import os
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database.auth import get_admin, get_usuario_logado, hash_senha, verificar_senha
from database.controllers.produto_controller import _remover_imagem, _salvar_imagem
from database.database import get_db
from database.models.categoria import Categoria
from database.models.cliente import Cliente
from database.models.movimentacao import Movimentacao, Tipo_movimentacao
from database.models.produto import Produto
from database.models.usuario import Usuario
from database.models.venda import ItemVenda, Venda


router = APIRouter(prefix="/api/v1/pdv", tags=["API PDV"])

_AI_RUNTIME_STATUS = {
    "provider": "",
    "ok": None,
    "error": "",
}

PRODUCT_IMAGE_DIR = Path("database/static/uploads")
PRODUCT_IMAGE_PREFIX = "uploads"
PRODUCT_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class CategoriaPayload(BaseModel):
    nome: str


class EstoquePayload(BaseModel):
    quantidade: int


class ItemVendaPayload(BaseModel):
    produto_id: int
    quantidade: int


class VendaPayload(BaseModel):
    itens: list[ItemVendaPayload]
    pagamento: str
    associado: bool = False
    cliente_nome: str | None = None
    customerName: str | None = None
    observacao: str | None = ""


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
    return {
        "id": str(produto.id),
        "name": produto.nome,
        "nome": produto.nome,
        "sku": f"PROD-{produto.id:04d}",
        "categoryId": str(produto.categoria_id) if produto.categoria_id else "",
        "categoria_id": produto.categoria_id,
        "categoryName": categoria.nome if categoria else "",
        "price": produto.preco,
        "preco": produto.preco,
        "stock": produto.estoque_atual,
        "estoque_atual": produto.estoque_atual,
        "description": produto.descricao or "",
        "descricao": produto.descricao or "",
        "imageUrl": produto.imagem_url if produto.imagem_path else "",
        "ativo": produto.ativo,
    }


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
    preco = movimento.preco_unitario or 0
    quantidade = movimento.quantidade or 0
    criado_em = movimento.criado_em or getattr(movimento, "data", None)

    return {
        "id": str(movimento.id),
        "type": "entrada" if is_entrada else "saida",
        "typeLabel": "Entrada" if is_entrada else "Saída",
        "quantity": quantidade,
        "unitPrice": preco,
        "total": quantidade * preco,
        "note": movimento.observacao or "",
        "createdAt": criado_em.isoformat() if criado_em else None,
        "productId": str(movimento.produto_id),
        "productName": movimento.produto.nome if movimento.produto else "Produto removido",
        "userId": str(movimento.usuario_id),
        "userName": movimento.usuario.nome if movimento.usuario else "Usuario",
    }


def _venda_json(venda: Venda) -> dict:
    observacao = venda.observacao or ""
    pagamento = _extrair_pagamento(observacao)
    if pagamento == "nao informado" and getattr(venda, "metodo_pagamento", None):
        pagamento = venda.metodo_pagamento
    cliente_nome = venda.cliente.nome if venda.cliente else _extrair_cliente(observacao)
    total_bruto = venda.total_bruto or getattr(venda, "valor_total", 0) or 0
    total_liquido = venda.total_liquido or getattr(venda, "valor_final", 0) or 0
    criado_em = venda.criado_em or getattr(venda, "data", None)
    return {
        "id": venda.id,
        "number": f"#{venda.id:04d}",
        "total_bruto": total_bruto,
        "total_liquido": total_liquido,
        "subtotal": total_bruto,
        "total": total_liquido,
        "desconto_percentual": venda.desconto_percentual,
        "desconto_valor": venda.desconto_valor,
        "customerName": cliente_nome,
        "payment": pagamento,
        "status": "concluido",
        "observacao": venda.observacao or "",
        "createdAt": criado_em.isoformat() if criado_em else None,
        "items": [
            {
                "produto_id": item.produto_id,
                "productId": str(item.produto_id) if item.produto_id else "",
                "name": item.produto_nome,
                "qty": item.quantidade,
                "price": item.preco_unitario,
                "subtotal": item.subtotal,
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
    total_gasto = sum(v.total_liquido or 0 for v in vendas)
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
        "totalSpent": total_gasto,
        "lastOrder": ultima.strftime("%d/%m/%Y") if ultima else "-",
    }


def _smtp_config() -> dict:
    senha = os.getenv("SMTP_PASSWORD") or ""
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except (TypeError, ValueError):
        port = 587
    return {
        "host": os.getenv("SMTP_HOST"),
        "port": port,
        "user": os.getenv("SMTP_USER"),
        "password": "".join(senha.split()),
        "from": os.getenv("SMTP_FROM") or os.getenv("SMTP_USER"),
        "to": os.getenv("SUPPORT_EMAIL") or os.getenv("SMTP_FROM") or os.getenv("SMTP_USER"),
        "tls": os.getenv("SMTP_TLS", "true").strip().lower() != "false",
        "ssl": os.getenv("SMTP_SSL", "false").strip().lower() == "true",
    }


def _secret_configured(value: str | None) -> bool:
    if not value:
        return False
    value = value.strip()
    placeholders = ("cole_", "sua_", "your_", "changeme", "coloque_")
    return bool(value) and not value.lower().startswith(placeholders)


def _ai_config_status() -> dict:
    provider = (os.getenv("AAPM_AI_PROVIDER") or "auto").strip().lower()
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("AAPM_AI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_ready = _secret_configured(openai_key)
    gemini_ready = _secret_configured(gemini_key)

    if provider == "openai":
        ready = openai_ready
        active = "openai"
    elif provider == "gemini":
        ready = gemini_ready
        active = "gemini"
    else:
        ready = openai_ready or gemini_ready
        active = "auto"

    return {
        "provider": active,
        "ready": ready,
        "openai_ready": openai_ready,
        "gemini_ready": gemini_ready,
        "model": os.getenv("AAPM_AI_MODEL") if active in ("openai", "auto") else os.getenv("AAPM_GEMINI_MODEL"),
        "last_runtime": _AI_RUNTIME_STATUS.copy(),
    }


def _system_warnings(db: Session) -> list[dict]:
    warnings = []
    ai_status = _ai_config_status()
    smtp = _smtp_config()

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

    if not smtp["host"] or not smtp["from"] or not smtp["to"]:
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
    config = _smtp_config()
    if not config["host"] or not config["from"] or not config["to"]:
        print(f"[SUPORTE] {usuario.get('sub')} - {assunto}: {mensagem}")
        return

    email = EmailMessage()
    email["Subject"] = f"Suporte AAPM - {assunto.strip() or 'Solicitacao'}"
    email["From"] = config["from"]
    email["To"] = config["to"]
    email.set_content(
        "Nova solicitacao de suporte registrada no sistema AAPM.\n\n"
        f"Usuario: {usuario.get('nome') or '-'}\n"
        f"E-mail: {usuario.get('sub') or '-'}\n"
        f"Perfil: {usuario.get('role') or '-'}\n"
        f"Assunto: {assunto.strip() or 'Suporte'}\n\n"
        f"Mensagem:\n{mensagem.strip()}\n"
    )

    smtp_client = smtplib.SMTP_SSL if config["ssl"] or config["port"] == 465 else smtplib.SMTP
    with smtp_client(config["host"], config["port"], timeout=15, local_hostname="localhost") as smtp:
        if config["tls"] and config["port"] != 465:
            smtp.starttls()
        if config["user"] and config["password"]:
            smtp.login(config["user"], config["password"])
        smtp.send_message(email)


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
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    categorias = (
        db.query(Categoria)
        .filter(Categoria.ativo == True)
        .order_by(Categoria.nome)
        .all()
    )
    return [_categoria_json(categoria) for categoria in categorias]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
def criar_categoria_api(
    payload: CategoriaPayload,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
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
    admin=Depends(get_admin),
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
    admin=Depends(get_admin),
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
    limit: int = Query(default=80, ge=1, le=200),
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
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

    movimentos = query.limit(limit).all()
    return [_movimentacao_json(movimento) for movimento in movimentos]


@router.get("/products")
def listar_produtos_api(
    q: str = "",
    category_id: int | None = Query(default=None),
    stock: str = "",
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    query = db.query(Produto).filter(Produto.ativo == True)

    if q:
        query = query.filter(Produto.nome.ilike(f"%{q.strip()}%"))

    if category_id:
        query = query.filter(Produto.categoria_id == category_id)

    produtos = query.order_by(Produto.nome).all()

    if stock == "in":
        produtos = [p for p in produtos if p.estoque_atual > 5]
    elif stock == "low":
        produtos = [p for p in produtos if 0 < p.estoque_atual <= 5]
    elif stock == "out":
        produtos = [p for p in produtos if p.estoque_atual <= 0]

    return [_produto_json(produto) for produto in produtos]


@router.get("/product-images")
def listar_imagens_produto_api(admin=Depends(get_admin)):
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
    return [_produto_json(produto) for produto in produtos]


@router.post("/sales", status_code=status.HTTP_201_CREATED)
def criar_venda_api(
    payload: VendaPayload,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    usuario_id = usuario.get("id")
    if not usuario_id and usuario.get("sub"):
        usuario_db = db.query(Usuario).filter(Usuario.email == usuario.get("sub"), Usuario.ativo == True).first()
        usuario_id = usuario_db.id if usuario_db else None

    if not usuario_id:
        raise HTTPException(status_code=401, detail="Sessao invalida. Faca login novamente para registrar a venda.")

    if not payload.itens:
        raise HTTPException(status_code=400, detail="Adicione produtos ao carrinho.")

    pagamento = payload.pagamento.strip()
    if pagamento not in ("pix", "debito", "credito", "dinheiro"):
        raise HTTPException(status_code=400, detail="Forma de pagamento invalida.")

    cliente_nome = (payload.cliente_nome or payload.customerName or "").strip()
    if not cliente_nome or cliente_nome.lower() in ("cliente balcao", "cliente balcão"):
        raise HTTPException(status_code=400, detail="Informe o nome do cliente para fechar o pedido.")

    quantidades: dict[int, int] = {}
    for item in payload.itens:
        if item.quantidade <= 0:
            raise HTTPException(status_code=400, detail="Quantidade invalida.")
        quantidades[item.produto_id] = quantidades.get(item.produto_id, 0) + item.quantidade

    produtos = (
        db.query(Produto)
        .filter(Produto.id.in_(quantidades.keys()), Produto.ativo == True)
        .with_for_update()
        .all()
    )
    produtos_por_id = {produto.id: produto for produto in produtos}

    if len(produtos_por_id) != len(quantidades):
        raise HTTPException(status_code=404, detail="Um ou mais produtos nao foram encontrados.")

    for produto_id, quantidade in quantidades.items():
        produto = produtos_por_id[produto_id]
        if produto.estoque_atual - quantidade < 5:
            raise HTTPException(
                status_code=409,
                detail=f"Estoque insuficiente para {produto.nome}. Mantenha ao menos 5 unidades.",
            )

    try:
        cliente = None
        like_cliente = f"%{cliente_nome}%"
        cliente = (
            db.query(Cliente)
            .filter(
                Cliente.ativo == True,
                or_(
                    Cliente.nome.ilike(cliente_nome),
                    Cliente.matricula.ilike(cliente_nome),
                    Cliente.telefone.ilike(cliente_nome),
                    Cliente.nome.ilike(like_cliente),
                    Cliente.matricula.ilike(like_cliente),
                    Cliente.telefone.ilike(like_cliente),
                ),
            )
            .order_by(Cliente.is_associado.desc(), Cliente.nome)
            .first()
        )
        if not cliente:
            cliente = Cliente(
                nome=cliente_nome,
                is_associado=False,
                ativo=True,
            )
            db.add(cliente)
            db.flush()

        associado_confirmado = bool(cliente and cliente.is_associado)
        desconto_percentual = 10.0 if associado_confirmado else 0.0
        total_bruto = sum(produtos_por_id[id].preco * qtd for id, qtd in quantidades.items())
        total_liquido = total_bruto * (1 - desconto_percentual / 100)

        observacoes = [f"Pagamento: {pagamento}."]
        if cliente_nome:
            observacoes.append(f"Cliente: {cliente_nome}.")
        if payload.observacao:
            obs_limpa = payload.observacao.strip()
            if obs_limpa and not obs_limpa.lower().startswith("cliente:"):
                observacoes.append(obs_limpa)

        venda = Venda(
            cliente_id=cliente.id if cliente else None,
            usuario_id=usuario_id,
            metodo_pagamento=pagamento,
            desconto=total_bruto - total_liquido,
            valor_total=total_bruto,
            valor_final=total_liquido,
            desconto_percentual=desconto_percentual,
            total_bruto=total_bruto,
            total_liquido=total_liquido,
            observacao=" ".join(observacoes).strip(),
        )
        db.add(venda)
        db.flush()

        for produto_id, quantidade in quantidades.items():
            produto = produtos_por_id[produto_id]
            produto.estoque_atual -= quantidade

            db.add(ItemVenda(
                venda_id=venda.id,
                produto_id=produto.id,
                produto_nome=produto.nome,
                quantidade=quantidade,
                preco_unitario=produto.preco,
            ))
            db.add(Movimentacao(
                tipo=Tipo_movimentacao.SAIDA,
                quantidade=quantidade,
                preco_unitario=produto.preco,
                observacao=f"Venda #{venda.id:04d}",
                produto_id=produto.id,
                usuario_id=usuario_id,
            ))

        db.commit()
        db.refresh(venda)
    except SQLAlchemyError as exc:
        db.rollback()
        print(f"[PDV] Falha ao registrar venda: {exc}")
        raise HTTPException(status_code=500, detail="Nao foi possivel salvar a venda no banco.")

    return _venda_json(venda)


@router.get("/customers")
def listar_clientes_api(
    q: str = Query("", max_length=100),
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    query = db.query(Cliente).filter(Cliente.ativo == True)
    termo = q.strip()
    if termo:
        like = f"%{termo}%"
        query = query.filter(or_(Cliente.nome.ilike(like), Cliente.matricula.ilike(like), Cliente.telefone.ilike(like)))

    clientes = query.order_by(Cliente.nome).all()
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


@router.post("/customers", status_code=status.HTTP_201_CREATED)
def criar_cliente_api(
    payload: ClientePayload,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
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
    admin=Depends(get_admin),
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
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    if status_filtro and status_filtro != "concluido":
        return []

    vendas = db.query(Venda).order_by(Venda.criado_em.desc()).limit(300).all()
    termo = q.strip().lower()
    rows = [_venda_json(venda) for venda in vendas]
    if termo:
        rows = [
            row for row in rows
            if termo in f"{row['number']} {row['customerName']} {row['payment']}".lower()
        ]
    return rows


@router.get("/dashboard/daily")
def vendas_por_dia_api(
    dias: int = Query(7, alias="range", ge=1, le=90),
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    hoje = date.today()
    inicio = hoje - timedelta(days=dias - 1)
    rows = []

    for offset in range(dias):
        dia = inicio + timedelta(days=offset)
        vendas = (
            db.query(Venda)
            .filter(Venda.criado_em >= _inicio_do_dia(dia), Venda.criado_em <= _fim_do_dia(dia))
            .all()
        )
        venda_ids = [v.id for v in vendas]
        itens = 0
        if venda_ids:
            itens = db.query(func.coalesce(func.sum(ItemVenda.quantidade), 0)).filter(ItemVenda.venda_id.in_(venda_ids)).scalar() or 0
        rows.append({
            "date": dia.isoformat(),
            "revenue": sum(v.total_liquido or 0 for v in vendas),
            "orders": len(vendas),
            "items": int(itens),
        })
    return rows


@router.get("/dashboard/hourly")
def vendas_por_hora_api(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    hoje = date.today()
    vendas = (
        db.query(Venda)
        .filter(Venda.criado_em >= _inicio_do_dia(hoje), Venda.criado_em <= _fim_do_dia(hoje))
        .all()
    )
    rows = [{"hour": hora, "revenue": 0, "orders": 0} for hora in range(8, 19)]
    por_hora = {row["hour"]: row for row in rows}
    for venda in vendas:
        hora = venda.criado_em.hour if venda.criado_em else 0
        if hora not in por_hora:
            por_hora[hora] = {"hour": hora, "revenue": 0, "orders": 0}
        por_hora[hora]["revenue"] += venda.total_liquido or 0
        por_hora[hora]["orders"] += 1
    return sorted(por_hora.values(), key=lambda row: row["hour"])


@router.get("/dashboard/metrics")
def metricas_dashboard_api(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    hoje = date.today()
    ontem = hoje - timedelta(days=1)
    inicio_mes = hoje.replace(day=1)

    vendas_hoje = db.query(Venda).filter(Venda.criado_em >= _inicio_do_dia(hoje), Venda.criado_em <= _fim_do_dia(hoje)).all()
    vendas_ontem = db.query(Venda).filter(Venda.criado_em >= _inicio_do_dia(ontem), Venda.criado_em <= _fim_do_dia(ontem)).all()
    vendas_mes = db.query(Venda).filter(Venda.criado_em >= _inicio_do_dia(inicio_mes), Venda.criado_em <= _fim_do_dia(hoje)).all()

    def resumo(vendas: list[Venda]) -> dict:
        venda_ids = [v.id for v in vendas]
        itens = 0
        if venda_ids:
            itens = db.query(func.coalesce(func.sum(ItemVenda.quantidade), 0)).filter(ItemVenda.venda_id.in_(venda_ids)).scalar() or 0
        receita = sum(v.total_liquido or 0 for v in vendas)
        pedidos = len(vendas)
        ticket = receita / pedidos if pedidos else 0
        return {"revenue": receita, "items": int(itens), "orders": pedidos, "ticket": ticket}

    atual = resumo(vendas_hoje)
    anterior = resumo(vendas_ontem)
    month_revenue = sum(v.total_liquido or 0 for v in vendas_mes)
    return {
        **atual,
        "monthRevenue": month_revenue,
        "revPct": _pct(atual["revenue"], anterior["revenue"]),
        "itemsPct": _pct(atual["items"], anterior["items"]),
        "ordersPct": _pct(atual["orders"], anterior["orders"]),
        "ticketPct": _pct(atual["ticket"], anterior["ticket"]),
        "monthPct": 0,
    }


@router.get("/dashboard/top-products")
def produtos_mais_vendidos_api(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    rows = (
        db.query(
            ItemVenda.produto_id,
            ItemVenda.produto_nome,
            func.coalesce(func.sum(ItemVenda.quantidade), 0).label("qty"),
            func.coalesce(func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario), 0).label("revenue"),
        )
        .group_by(ItemVenda.produto_id, ItemVenda.produto_nome)
        .order_by(func.coalesce(func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario), 0).desc())
        .limit(8)
        .all()
    )

    resposta = []
    for produto_id, nome, qty, revenue in rows:
        produto = db.query(Produto).filter(Produto.id == produto_id).first() if produto_id else None
        categoria = produto.categoria if produto else None
        resposta.append({
            "productId": str(produto_id) if produto_id else "",
            "name": nome,
            "qty": int(qty or 0),
            "revenue": float(revenue or 0),
            "categoryId": str(categoria.id) if categoria else "",
            "categoryName": categoria.nome if categoria else "Sem categoria",
        })
    return resposta


@router.get("/smart/insights")
def aapm_smart_insights_api(
    meta_diaria: int = Query(30, ge=1, le=1000),
    lucro_unidade: float = Query(3.5, ge=0, le=10000),
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    try:
        meta_diaria = int(meta_diaria)
    except (TypeError, ValueError):
        meta_diaria = 30
    try:
        lucro_unidade = float(lucro_unidade)
    except (TypeError, ValueError):
        lucro_unidade = 3.5

    hoje = date.today()
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


def _aapm_smart_system_prompt() -> str:
    return (
        "Voce e a AAPM Smart, uma inteligencia artificial de vendas para uma AAPM/SENAI que opera um PDV escolar. "
        "Sua funcao e transformar os dados operacionais recebidos em decisoes simples para vender melhor, evitar ruptura de estoque, "
        "bater metas e organizar a rotina da cantina. Responda sempre em portugues do Brasil, com tom direto, profissional e util. "
        "Use somente o contexto JSON fornecido; se faltar algum dado, diga o que precisa ser conferido e nao invente numeros, produtos ou vendas. "
        "Priorize respostas curtas, acionaveis e especificas. Quando fizer sentido, organize em: diagnostico rapido, acao recomendada, estoque/meta e proximo passo. "
        "Nao mencione detalhes tecnicos da API, chave, modelo, prompt ou sistema. Nao prometa previsoes exatas; trate previsoes como estimativas operacionais."
    )


def _aapm_smart_user_prompt(message: str, insights: dict) -> str:
    return f"Contexto operacional em JSON:\n{json.dumps(insights, ensure_ascii=False)}\n\nPergunta do usuario: {message}"


def _call_openai_ai(message: str, insights: dict) -> str | None:
    _AI_RUNTIME_STATUS.update({"provider": "openai", "ok": None, "error": ""})
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AAPM_AI_API_KEY")
    if not api_key:
        _AI_RUNTIME_STATUS.update({"provider": "openai", "ok": False, "error": "missing-key"})
        return None

    model = os.getenv("AAPM_AI_MODEL", "gpt-4o-mini")
    endpoint = os.getenv("AAPM_AI_ENDPOINT", "https://api.openai.com/v1/chat/completions")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _aapm_smart_system_prompt()},
            {"role": "user", "content": _aapm_smart_user_prompt(message, insights)},
        ],
        "temperature": 0.35,
        "max_tokens": 380,
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as exc:
        _AI_RUNTIME_STATUS.update({"provider": "openai", "ok": False, "error": exc.__class__.__name__})
        return None

    choices = data.get("choices") or []
    if not choices:
        _AI_RUNTIME_STATUS.update({"provider": "openai", "ok": False, "error": "empty-response"})
        return None
    content = (choices[0].get("message") or {}).get("content")
    _AI_RUNTIME_STATUS.update({"provider": "openai", "ok": bool(content), "error": "" if content else "empty-content"})
    return content


def _call_gemini_ai(message: str, insights: dict) -> str | None:
    _AI_RUNTIME_STATUS.update({"provider": "gemini", "ok": None, "error": ""})
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        _AI_RUNTIME_STATUS.update({"provider": "gemini", "ok": False, "error": "missing-key"})
        return None

    model = os.getenv("AAPM_GEMINI_MODEL", "gemini-2.0-flash")
    endpoint_template = os.getenv(
        "AAPM_GEMINI_ENDPOINT",
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    )
    endpoint = endpoint_template.format(model=model)
    payload = {
        "systemInstruction": {
            "parts": [{"text": _aapm_smart_system_prompt()}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": _aapm_smart_user_prompt(message, insights)}],
            }
        ],
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 380,
        },
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as exc:
        _AI_RUNTIME_STATUS.update({"provider": "gemini", "ok": False, "error": exc.__class__.__name__})
        return None

    candidates = data.get("candidates") or []
    if not candidates:
        _AI_RUNTIME_STATUS.update({"provider": "gemini", "ok": False, "error": "empty-response"})
        return None
    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    content = "".join(str(part.get("text", "")) for part in parts).strip() or None
    _AI_RUNTIME_STATUS.update({"provider": "gemini", "ok": bool(content), "error": "" if content else "empty-content"})
    return content


def _call_external_ai(message: str, insights: dict) -> str | None:
    provider = os.getenv("AAPM_AI_PROVIDER", "").strip().lower()
    if provider == "gemini":
        return _call_gemini_ai(message, insights)
    if provider == "openai":
        return _call_openai_ai(message, insights)
    return _call_gemini_ai(message, insights) or _call_openai_ai(message, insights)


@router.post("/smart/assistant")
def aapm_smart_assistant_api(
    payload: SmartAssistantPayload,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Mensagem vazia.")

    insights = aapm_smart_insights_api(
        meta_diaria=payload.meta_diaria or 30,
        lucro_unidade=payload.lucro_unidade or 3.5,
        db=db,
        admin=admin,
    )
    external_answer = _call_external_ai(message, insights)
    if external_answer:
        return {"mode": "external", "answer": external_answer, "insights": insights}

    return {"mode": "local", "answer": _aapm_smart_fallback_answer(message, insights), "insights": insights}


@router.get("/system/health")
def sistema_health_api(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    counts = {
        "products": db.query(Produto).filter(Produto.ativo == True).count(),
        "categories": db.query(Categoria).filter(Categoria.ativo == True).count(),
        "customers": db.query(Cliente).count(),
        "sales": db.query(Venda).count(),
    }
    warnings = _system_warnings(db)
    return {
        "ok": not warnings,
        "checkedAt": datetime.now().isoformat(timespec="seconds"),
        "warnings": warnings,
        "ai": _ai_config_status(),
        "counts": counts,
    }


@router.get("/notifications")
def notificacoes_api(
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_logado),
):
    hoje = date.today()
    baixo_estoque = db.query(Produto).filter(Produto.ativo == True, Produto.estoque_atual <= 5).count()
    vendas_hoje = db.query(Venda).filter(Venda.criado_em >= _inicio_do_dia(hoje), Venda.criado_em <= _fim_do_dia(hoje)).count()
    ultima_venda = db.query(Venda).order_by(Venda.criado_em.desc()).first()

    itens = []
    itens.extend(_system_warnings(db))
    if vendas_hoje:
        itens.append({"id": "sales-today", "type": "success", "icon": "fa-circle-check", "text": f"{vendas_hoje} venda(s) registradas hoje.", "time": "Hoje"})
    if baixo_estoque:
        itens.append({"id": "low-stock", "type": "warn", "icon": "fa-triangle-exclamation", "text": f"{baixo_estoque} produto(s) precisam de reposicao.", "time": "Estoque"})
    if ultima_venda:
        itens.append({"id": "last-sale", "type": "info", "icon": "fa-receipt", "text": f"Ultima venda: #{ultima_venda.id:04d} no valor de R$ {ultima_venda.total_liquido:.2f}.", "time": ultima_venda.criado_em.strftime("%H:%M") if ultima_venda.criado_em else "Agora"})
    if not itens:
        itens.append({"id": "ready", "type": "success", "icon": "fa-circle-check", "text": "Sistema conectado e sem pendencias no momento.", "time": "Agora"})
    return itens


@router.get("/reports/{tipo}")
def baixar_relatorio_api(
    tipo: str,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    hoje = date.today().isoformat()

    if tipo == "sales":
        vendas = db.query(Venda).order_by(Venda.criado_em.desc()).all()
        return _csv_response(
            f"relatorio-vendas-{hoje}.csv",
            ["Pedido", "Cliente", "Pagamento", "Data", "Total bruto", "Desconto", "Total liquido"],
            [[f"#{v.id:04d}", _venda_json(v)["customerName"], _extrair_pagamento(v.observacao or ""), v.criado_em, v.total_bruto, v.desconto_valor, v.total_liquido] for v in vendas],
        )

    if tipo == "daily":
        rows = vendas_por_dia_api(dias=30, db=db, admin=admin)
        return _csv_response(
            f"resumo-diario-{hoje}.csv",
            ["Data", "Receita", "Pedidos", "Itens"],
            [[r["date"], r["revenue"], r["orders"], r["items"]] for r in rows],
        )

    if tipo == "stock":
        produtos = db.query(Produto).filter(Produto.ativo == True).order_by(Produto.nome).all()
        return _csv_response(
            f"estoque-atual-{hoje}.csv",
            ["Produto", "Categoria", "Preco", "Estoque"],
            [[p.nome, p.categoria.nome if p.categoria else "", p.preco, p.estoque_atual] for p in produtos],
        )

    if tipo == "abc":
        produtos = produtos_mais_vendidos_api(db=db, admin=admin)
        return _csv_response(
            f"curva-abc-{hoje}.csv",
            ["Produto", "Categoria", "Quantidade vendida", "Receita"],
            [[p["name"], p["categoryName"], p["qty"], p["revenue"]] for p in produtos],
        )

    if tipo == "customers":
        clientes = db.query(Cliente).filter(Cliente.ativo == True).order_by(Cliente.nome).all()
        return _csv_response(
            f"clientes-ativos-{hoje}.csv",
            ["Cliente", "Matricula", "Telefone", "Associado", "Pedidos", "Total gasto"],
            [[c.nome, c.matricula or "", c.telefone or "", "Sim" if c.is_associado else "Nao", _cliente_json(c)["orders"], _cliente_json(c)["totalSpent"]] for c in clientes],
        )

    if tipo == "categories":
        categorias = db.query(Categoria).filter(Categoria.ativo == True).order_by(Categoria.nome).all()
        return _csv_response(
            f"relatorio-categorias-{hoje}.csv",
            ["Categoria", "Produtos ativos"],
            [[c.nome, len([p for p in c.produtos if p.ativo])] for c in categorias],
        )

    raise HTTPException(status_code=404, detail="Relatorio nao encontrado.")


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
    preco: float = Form(...),
    estoque_atual: int = Form(...),
    categoria_id: int = Form(0),
    imagem: UploadFile = File(None),
    imagem_existente: str = Form(""),
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    nome = nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do produto.")

    existente = db.query(Produto).filter(Produto.nome.ilike(nome)).first()
    if existente:
        raise HTTPException(status_code=409, detail="Ja existe um produto com este nome.")

    if estoque_atual < 5:
        raise HTTPException(status_code=400, detail="O estoque nao pode ser menor que 5.")

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

    produto = Produto(
        nome=nome,
        descricao=(descricao or "").strip(),
        preco=preco,
        estoque_atual=estoque_atual,
        categoria_id=categoria_id,
        imagem_path=imagem_path,
    )

    db.add(produto)
    db.commit()
    db.refresh(produto)

    return _produto_json(produto)


@router.put("/products/{produto_id}")
async def editar_produto_api(
    produto_id: int,
    nome: str = Form(...),
    descricao: str = Form(""),
    preco: float = Form(...),
    estoque_atual: int = Form(...),
    categoria_id: int = Form(0),
    imagem: UploadFile = File(None),
    imagem_existente: str = Form(""),
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
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

    if estoque_atual < 5:
        raise HTTPException(status_code=400, detail="O estoque nao pode ser menor que 5.")

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

    db.commit()
    db.refresh(produto)

    return _produto_json(produto)


@router.post("/products/{produto_id}/stock")
def adicionar_estoque_api(
    produto_id: int,
    payload: EstoquePayload,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto or not produto.ativo:
        raise HTTPException(status_code=404, detail="Produto nao encontrado.")

    if payload.quantidade <= 0:
        raise HTTPException(status_code=400, detail="A quantidade deve ser maior que zero.")

    novo_estoque = produto.estoque_atual + payload.quantidade
    if novo_estoque < 5:
        raise HTTPException(status_code=400, detail="O estoque nao pode ser menor que 5.")

    usuario_id = _usuario_id_atual(admin, db)
    if not usuario_id:
        raise HTTPException(status_code=401, detail="Usuario nao identificado.")

    produto.estoque_atual = novo_estoque
    db.add(Movimentacao(
        tipo=Tipo_movimentacao.ENTRADA,
        quantidade=payload.quantidade,
        preco_unitario=produto.preco,
        observacao="Reposicao manual de estoque",
        produto_id=produto.id,
        usuario_id=usuario_id,
    ))
    db.commit()
    db.refresh(produto)

    return _produto_json(produto)


@router.delete("/products/{produto_id}")
def remover_produto_api(
    produto_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto or not produto.ativo:
        raise HTTPException(status_code=404, detail="Produto nao encontrado.")

    produto.ativo = False
    db.commit()

    return {"ok": True}
