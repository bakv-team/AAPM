from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.models.movimentacao import Movimentacao, Tipo_movimentacao
from database.models.produto import Produto
from database.models.variacao import ProdutoVariacao
from services.errors import ConflictError, NotFoundError, PersistenceError, ValidationError


def reserve_stock(
    db: Session,
    product: Produto,
    variation: ProdutoVariacao | None,
    quantity: int,
) -> None:
    """Reserva saldo com UPDATE condicional, mesmo sem suporte a FOR UPDATE."""
    product_updated = (
        db.query(Produto)
        .filter(
            Produto.id == product.id,
            Produto.ativo == True,
            Produto.estoque_atual >= quantity,
        )
        .update(
            {Produto.estoque_atual: Produto.estoque_atual - quantity},
            synchronize_session=False,
        )
    )
    if product_updated != 1:
        raise ConflictError(f"Estoque insuficiente para {product.nome}.")

    if variation is None:
        return

    variation_updated = (
        db.query(ProdutoVariacao)
        .filter(
            ProdutoVariacao.id == variation.id,
            ProdutoVariacao.produto_id == product.id,
            ProdutoVariacao.estoque_atual >= quantity,
        )
        .update(
            {ProdutoVariacao.estoque_atual: ProdutoVariacao.estoque_atual - quantity},
            synchronize_session=False,
        )
    )
    if variation_updated != 1:
        raise ConflictError(f"Estoque insuficiente para {product.nome}.")


def replenish_stock(
    db: Session,
    product_id: int,
    quantity: int,
    variation_id: int | None,
    user_id: int,
    created_at: datetime,
) -> Produto:
    if quantity <= 0:
        raise ValidationError("A quantidade deve ser maior que zero.")
    if not user_id:
        raise ValidationError("Usuario nao identificado.")

    try:
        product = (
            db.query(Produto)
            .filter(Produto.id == product_id, Produto.ativo == True)
            .with_for_update()
            .first()
        )
        if not product:
            raise NotFoundError("Produto nao encontrado.")

        variation = None
        if product.variacoes:
            variation = (
                db.query(ProdutoVariacao)
                .filter(
                    ProdutoVariacao.id == variation_id,
                    ProdutoVariacao.produto_id == product.id,
                )
                .with_for_update()
                .first()
            )
            if not variation:
                raise ValidationError("Selecione a variacao que recebera o estoque.")

        db.query(Produto).filter(Produto.id == product.id).update(
            {Produto.estoque_atual: Produto.estoque_atual + quantity},
            synchronize_session=False,
        )
        if variation:
            db.query(ProdutoVariacao).filter(ProdutoVariacao.id == variation.id).update(
                {ProdutoVariacao.estoque_atual: ProdutoVariacao.estoque_atual + quantity},
                synchronize_session=False,
            )

        db.add(Movimentacao(
            tipo=Tipo_movimentacao.ENTRADA,
            quantidade=quantity,
            preco_unitario=variation.preco if variation else product.preco,
            observacao=f"Reposicao manual de estoque{f' - {variation.nome_combinacao}' if variation else ''}",
            criado_em=created_at,
            produto_id=product.id,
            usuario_id=user_id,
        ))
        db.commit()
        db.refresh(product)
        return product
    except (ValidationError, NotFoundError, ConflictError):
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise PersistenceError("Nao foi possivel atualizar o estoque.") from exc
