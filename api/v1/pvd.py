from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.auth import get_admin, get_usuario_logado
from database.controllers.produto_controller import _remover_imagem, _salvar_imagem
from database.database import get_db
from database.models.categoria import Categoria
from database.models.cliente import Cliente
from database.models.movimentacao import Movimentacao, Tipo_movimentacao
from database.models.produto import Produto
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
    observacao: str | None = ""


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
    return {
        "id": venda.id,
        "number": f"#{venda.id:04d}",
        "total_bruto": venda.total_bruto,
        "total_liquido": venda.total_liquido,
        "desconto_percentual": venda.desconto_percentual,
        "desconto_valor": venda.desconto_valor,
        "observacao": venda.observacao or "",
        "createdAt": venda.criado_em.isoformat() if venda.criado_em else None,
        "items": [
            {
                "produto_id": item.produto_id,
                "name": item.produto_nome,
                "qty": item.quantidade,
                "price": item.preco_unitario,
                "subtotal": item.subtotal,
            }
            for item in venda.itens
        ],
    }


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

    venda = Venda(
        cliente_id=None,
        usuario_id=usuario.get("id"),
        desconto_percentual=desconto_percentual,
        total_bruto=total_bruto,
        total_liquido=total_liquido,
        observacao=f"Pagamento: {pagamento}. {(payload.observacao or '').strip()}".strip(),
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
