from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models.categoria import Categoria
from database.models.cliente import Cliente
from database.models.produto import Produto
from database.models.venda import ItemVenda, Venda
from services.errors import NotFoundError


@dataclass(frozen=True)
class ReportData:
    filename: str
    header: list[str]
    rows: list[list[object]]


def _day_start(day: date) -> datetime:
    return datetime.combine(day, time.min)


def _day_end(day: date) -> datetime:
    return datetime.combine(day, time.max)


def _period(period: str, today: date) -> tuple[date, date, int, str]:
    periods = {
        "today": (today, today, 1, "hoje"),
        "week": (today - timedelta(days=6), today, 7, "ultimos-7-dias"),
        "month": (today - timedelta(days=29), today, 30, "ultimos-30-dias"),
        "year": (today - timedelta(days=364), today, 365, "ultimos-12-meses"),
    }
    return periods.get((period or "month").strip().lower(), periods["month"])


def _sales_in_period(query, start: date, end: date):
    return query.filter(Venda.criado_em >= _day_start(start), Venda.criado_em <= _day_end(end))


def _payment(sale: Venda) -> str:
    if sale.metodo_pagamento and sale.metodo_pagamento != "nao informado":
        return sale.metodo_pagamento
    observation = sale.observacao or ""
    if "Pagamento:" not in observation:
        return "nao informado"
    return observation.split("Pagamento:", 1)[1].strip().split(".", 1)[0].strip().lower()


def _customer_name(sale: Venda) -> str:
    if sale.cliente:
        return sale.cliente.nome
    observation = sale.observacao or ""
    if "Cliente:" not in observation:
        return "Cliente balcao"
    return observation.split("Cliente:", 1)[1].strip().split(".", 1)[0].strip() or "Cliente balcao"


def generate_report(db: Session, report_type: str, period: str, today: date) -> ReportData:
    start, end, days, period_slug = _period(period, today)
    today_slug = today.isoformat()

    if report_type == "sales":
        sales = _sales_in_period(db.query(Venda), start, end).order_by(Venda.criado_em.desc()).all()
        return ReportData(
            f"relatorio-vendas-{period_slug}-{today_slug}.csv",
            ["Pedido", "Cliente", "Pagamento", "Data", "Total bruto", "Desconto", "Total liquido"],
            [[f"#{sale.id:04d}", _customer_name(sale), _payment(sale), sale.criado_em, sale.total_bruto, sale.desconto_valor, sale.total_liquido] for sale in sales],
        )

    if report_type == "daily":
        rows = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            sales = db.query(Venda).filter(Venda.criado_em >= _day_start(day), Venda.criado_em <= _day_end(day)).all()
            sale_ids = [sale.id for sale in sales]
            items = db.query(func.coalesce(func.sum(ItemVenda.quantidade), 0)).filter(ItemVenda.venda_id.in_(sale_ids)).scalar() if sale_ids else 0
            rows.append([day.isoformat(), sum((sale.total_liquido or 0 for sale in sales), 0), len(sales), int(items or 0)])
        return ReportData(f"resumo-diario-{period_slug}-{today_slug}.csv", ["Data", "Receita", "Pedidos", "Itens"], rows)

    stock_filters = {
        "stock": Produto.ativo == True,
        "stock-low": (Produto.ativo == True) & (Produto.estoque_atual > 0) & (Produto.estoque_atual <= 5),
        "stock-out": (Produto.ativo == True) & (Produto.estoque_atual <= 0),
        "stock-value": Produto.ativo == True,
    }
    if report_type in stock_filters:
        query = db.query(Produto).filter(stock_filters[report_type])
        if report_type == "stock-low":
            query = query.order_by(Produto.estoque_atual, Produto.nome)
        else:
            query = query.order_by(Produto.nome)
        products = query.all()
        value_report = report_type == "stock-value"
        names = {"stock": "estoque-atual", "stock-low": "estoque-baixo", "stock-out": "sem-estoque", "stock-value": "valor-em-estoque"}
        header = ["Produto", "Categoria", "Preco", "Estoque"] + (["Subtotal"] if value_report else [])
        rows = []
        for product in products:
            row = [product.nome, product.categoria.nome if product.categoria else "", product.preco, product.estoque_atual]
            if value_report:
                row.append((product.preco or 0) * (product.estoque_atual or 0))
            rows.append(row)
        return ReportData(f"{names[report_type]}-{today_slug}.csv", header, rows)

    if report_type == "abc":
        rows = (
            db.query(ItemVenda.produto_id, ItemVenda.produto_nome, func.sum(ItemVenda.quantidade), func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario))
            .join(Venda, Venda.id == ItemVenda.venda_id)
            .filter(Venda.criado_em >= _day_start(start), Venda.criado_em <= _day_end(end))
            .group_by(ItemVenda.produto_id, ItemVenda.produto_nome)
            .order_by(func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario).desc())
            .all()
        )
        result = []
        for product_id, name, quantity, revenue in rows:
            product = db.query(Produto).filter(Produto.id == product_id).first() if product_id else None
            result.append([name, product.categoria.nome if product and product.categoria else "Sem categoria", int(quantity or 0), revenue or 0])
        return ReportData(f"curva-abc-{period_slug}-{today_slug}.csv", ["Produto", "Categoria", "Quantidade vendida", "Receita"], result)

    if report_type == "customers":
        rows = []
        for customer in db.query(Cliente).filter(Cliente.ativo == True).order_by(Cliente.nome).all():
            sales = _sales_in_period(db.query(Venda).filter(Venda.cliente_id == customer.id), start, end).all()
            rows.append([customer.nome, customer.matricula or "", customer.telefone or "", "Sim" if customer.is_associado else "Nao", len(sales), sum((sale.total_liquido or 0 for sale in sales), 0)])
        return ReportData(f"clientes-ativos-{period_slug}-{today_slug}.csv", ["Cliente", "Matricula", "Telefone", "Associado", "Pedidos no periodo", "Total gasto no periodo"], rows)

    if report_type == "categories":
        rows = []
        for category in db.query(Categoria).filter(Categoria.ativo == True).order_by(Categoria.nome).all():
            sold = (
                db.query(func.coalesce(func.sum(ItemVenda.quantidade), 0), func.coalesce(func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario), 0))
                .join(Venda, Venda.id == ItemVenda.venda_id).join(Produto, Produto.id == ItemVenda.produto_id)
                .filter(Produto.categoria_id == category.id, Venda.criado_em >= _day_start(start), Venda.criado_em <= _day_end(end)).first()
            )
            rows.append([category.nome, len([product for product in category.produtos if product.ativo]), int(sold[0] or 0), sold[1] or 0])
        return ReportData(f"relatorio-categorias-{period_slug}-{today_slug}.csv", ["Categoria", "Produtos ativos", "Itens vendidos", "Receita"], rows)

    raise NotFoundError("Relatorio nao encontrado.")
