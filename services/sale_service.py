from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.models.cliente import Cliente
from database.models.movimentacao import Movimentacao, Tipo_movimentacao
from database.models.produto import Produto
from database.models.variacao import ProdutoVariacao
from database.models.venda import ItemVenda, Venda
from services.errors import ConflictError, NotFoundError, PersistenceError, ValidationError
from services.stock_service import reserve_stock
from utils.money import money


VALID_PAYMENT_METHODS = {"pix", "debito", "credito", "dinheiro"}


@dataclass(frozen=True)
class SaleItemInput:
    product_id: int
    variation_id: int | None
    quantity: int


@dataclass(frozen=True)
class RegisterSaleInput:
    items: list[SaleItemInput]
    payment: str
    customer_name: str
    note: str
    payment_exception: bool
    payment_due_at: datetime | None
    payment_exception_note: str


def _aggregate_quantities(items: list[SaleItemInput]) -> dict[tuple[int, int | None], int]:
    if not items:
        raise ValidationError("Adicione produtos ao carrinho.")
    quantities: dict[tuple[int, int | None], int] = {}
    for item in items:
        if item.quantity <= 0:
            raise ValidationError("Quantidade invalida.")
        key = (item.product_id, item.variation_id)
        quantities[key] = quantities.get(key, 0) + item.quantity
    return quantities


def _find_customer(db: Session, customer_name: str) -> Cliente | None:
    like_customer = f"%{customer_name}%"
    return (
        db.query(Cliente)
        .filter(
            Cliente.ativo == True,
            or_(
                Cliente.nome.ilike(customer_name),
                Cliente.matricula.ilike(customer_name),
                Cliente.telefone.ilike(customer_name),
                Cliente.nome.ilike(like_customer),
                Cliente.matricula.ilike(like_customer),
                Cliente.telefone.ilike(like_customer),
            ),
        )
        .order_by(Cliente.is_associado.desc(), Cliente.nome)
        .first()
    )


def register_sale(
    db: Session,
    command: RegisterSaleInput,
    user_id: int,
    created_at: datetime,
) -> Venda:
    if not user_id:
        raise ValidationError("Sessao invalida. Faca login novamente para registrar a venda.")

    payment = command.payment.strip().lower()
    if payment not in VALID_PAYMENT_METHODS:
        raise ValidationError("Forma de pagamento invalida.")
    customer_name = command.customer_name.strip()
    if not customer_name or customer_name.casefold() in {"cliente balcao", "cliente balcão"}:
        raise ValidationError("Informe o nome do cliente para fechar o pedido.")
    if command.payment_exception and not command.payment_due_at:
        raise ValidationError("Informe o prazo para a excecao de pagamento.")

    quantities = _aggregate_quantities(command.items)
    product_ids = {product_id for product_id, _ in quantities}

    try:
        products = (
            db.query(Produto)
            .filter(Produto.id.in_(product_ids), Produto.ativo == True)
            .order_by(Produto.id)
            .with_for_update()
            .all()
        )
        products_by_id = {product.id: product for product in products}
        if len(products_by_id) != len(product_ids):
            raise NotFoundError("Um ou mais produtos nao foram encontrados.")

        variation_ids = {variation_id for _, variation_id in quantities if variation_id is not None}
        variations_by_id = {
            variation.id: variation
            for variation in (
                db.query(ProdutoVariacao)
                .filter(ProdutoVariacao.id.in_(variation_ids))
                .order_by(ProdutoVariacao.id)
                .with_for_update()
                .all()
                if variation_ids else []
            )
        }

        for (product_id, variation_id), quantity in quantities.items():
            product = products_by_id[product_id]
            if product.variacoes and variation_id is None:
                raise ValidationError(f"Selecione tamanho/cor para {product.nome}.")
            variation = variations_by_id.get(variation_id) if variation_id is not None else None
            if variation_id is not None and (not variation or variation.produto_id != product_id):
                raise ValidationError(f"Variacao invalida para {product.nome}.")
            available_stock = variation.estoque_atual if variation else product.estoque_atual
            if available_stock < quantity:
                raise ConflictError(f"Estoque insuficiente para {product.nome}.")

        customer = _find_customer(db, customer_name)
        discount_percent = Decimal("10.00") if customer and customer.is_associado else Decimal("0.00")
        gross_total = sum(
            (
                money(
                    variations_by_id[variation_id].preco
                    if variation_id
                    else products_by_id[product_id].preco
                ) * quantity
                for (product_id, variation_id), quantity in quantities.items()
            ),
            start=Decimal("0.00"),
        )
        gross_total = money(gross_total)
        net_total = money(gross_total * (Decimal("1.00") - discount_percent / Decimal("100.00")))

        observations = [f"Pagamento: {payment}.", f"Cliente: {customer_name}."]
        if command.payment_exception:
            observations.append("Excecao de pagamento ativa.")
        clean_note = command.note.strip()
        if clean_note and not clean_note.casefold().startswith("cliente:"):
            observations.append(clean_note)

        sale = Venda(
            cliente_id=customer.id if customer else None,
            usuario_id=user_id,
            metodo_pagamento=payment,
            desconto=gross_total - net_total,
            valor_total=gross_total,
            valor_final=net_total,
            data=created_at,
            desconto_percentual=discount_percent,
            total_bruto=gross_total,
            total_liquido=net_total,
            observacao=" ".join(observations).strip(),
            excecao_pagamento=command.payment_exception,
            excecao_status="pendente" if command.payment_exception else "sem_excecao",
            excecao_prazo=command.payment_due_at,
            excecao_observacao=command.payment_exception_note.strip()[:255] or None,
            criado_em=created_at,
        )
        db.add(sale)
        db.flush()

        for (product_id, variation_id), quantity in sorted(
            quantities.items(), key=lambda item: (item[0][0], item[0][1] or 0)
        ):
            product = products_by_id[product_id]
            variation = variations_by_id.get(variation_id) if variation_id else None
            unit_price = money(variation.preco if variation else product.preco)
            reserve_stock(db, product, variation, quantity)
            complement = f" ({variation.nome_combinacao})" if variation else ""
            db.add(ItemVenda(
                venda_id=sale.id,
                produto_id=product.id,
                variacao_id=variation.id if variation else None,
                produto_nome=f"{product.nome}{complement}",
                quantidade=quantity,
                preco_unitario=unit_price,
            ))
            db.add(Movimentacao(
                tipo=Tipo_movimentacao.SAIDA,
                quantidade=quantity,
                preco_unitario=unit_price,
                observacao=f"Venda #{sale.id:04d}",
                criado_em=created_at,
                produto_id=product.id,
                usuario_id=user_id,
            ))

        db.commit()
        db.refresh(sale)
        return sale
    except (ValidationError, NotFoundError, ConflictError):
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise PersistenceError("Nao foi possivel salvar a venda no banco.") from exc
