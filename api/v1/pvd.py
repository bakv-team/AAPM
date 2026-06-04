from datetime import date, datetime, time, timedelta
import csv
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
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


def _venda_json(venda: Venda) -> dict:
    observacao = venda.observacao or ""
    pagamento = _extrair_pagamento(observacao)
    cliente_nome = venda.cliente.nome if venda.cliente else _extrair_cliente(observacao)
    return {
        "id": venda.id,
        "number": f"#{venda.id:04d}",
        "total_bruto": venda.total_bruto,
        "total_liquido": venda.total_liquido,
        "subtotal": venda.total_bruto,
        "total": venda.total_liquido,
        "desconto_percentual": venda.desconto_percentual,
        "desconto_valor": venda.desconto_valor,
        "customerName": cliente_nome,
        "payment": pagamento,
        "status": "concluido",
        "observacao": venda.observacao or "",
        "createdAt": venda.criado_em.isoformat() if venda.criado_em else None,
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
    if not payload.itens:
        raise HTTPException(status_code=400, detail="Adicione produtos ao carrinho.")

    pagamento = payload.pagamento.strip()
    if pagamento not in ("pix", "debito", "credito", "dinheiro"):
        raise HTTPException(status_code=400, detail="Forma de pagamento invalida.")

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

    desconto_percentual = 10.0 if payload.associado else 0.0
    total_bruto = sum(produtos_por_id[id].preco * qtd for id, qtd in quantidades.items())
    total_liquido = total_bruto * (1 - desconto_percentual / 100)

    cliente_nome = (payload.cliente_nome or payload.customerName or "").strip()
    cliente = None
    if cliente_nome and cliente_nome.lower() not in ("cliente balcao", "cliente balcão"):
        cliente = db.query(Cliente).filter(Cliente.nome.ilike(cliente_nome)).first()
        if not cliente:
            cliente = Cliente(
                nome=cliente_nome,
                is_associado=payload.associado,
                ativo=True,
            )
            db.add(cliente)
            db.flush()

    observacoes = [f"Pagamento: {pagamento}."]
    if cliente_nome:
        observacoes.append(f"Cliente: {cliente_nome}.")
    if payload.observacao:
        obs_limpa = payload.observacao.strip()
        if obs_limpa and not obs_limpa.lower().startswith("cliente:"):
            observacoes.append(obs_limpa)

    venda = Venda(
        cliente_id=cliente.id if cliente else None,
        usuario_id=usuario.get("id"),
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
            usuario_id=usuario.get("id"),
        ))

    db.commit()
    db.refresh(venda)

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
    return {
        "ok": True,
        "message": "Solicitacao registrada. A equipe administradora pode acompanhar pelo e-mail cadastrado.",
    }


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def criar_produto_api(
    nome: str = Form(...),
    descricao: str = Form(""),
    preco: float = Form(...),
    estoque_atual: int = Form(...),
    categoria_id: int = Form(0),
    imagem: UploadFile = File(None),
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

    imagem_path = await _salvar_imagem(imagem)

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

    produto.estoque_atual = novo_estoque
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
