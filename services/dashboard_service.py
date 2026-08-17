"""Consultas e agregações usadas pelos indicadores do dashboard.

As funções recebem a data de referência explicitamente para serem determinísticas
em testes. As rotas continuam responsáveis apenas por autorização e HTTP.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models.produto import Produto
from database.models.venda import ItemVenda, Venda
from utils.money import money


def _start_of_day(day: date) -> datetime:
    return datetime.combine(day, time.min)


def _end_of_day(day: date) -> datetime:
    return datetime.combine(day, time.max)


def _json_money(value: object) -> float:
    return float(money(value))


def _percent(current: float, previous: float) -> float:
    return ((current - previous) / previous * 100) if previous else 0.0


def _sales_for_day(db: Session, day: date) -> list[Venda]:
    return (
        db.query(Venda)
        .filter(Venda.criado_em >= _start_of_day(day), Venda.criado_em <= _end_of_day(day))
        .all()
    )


def _summary(db: Session, sales: list[Venda]) -> dict:
    sale_ids = [sale.id for sale in sales]
    items = 0
    if sale_ids:
        items = db.query(func.coalesce(func.sum(ItemVenda.quantidade), 0)).filter(ItemVenda.venda_id.in_(sale_ids)).scalar() or 0
    revenue = sum((money(sale.total_liquido) for sale in sales), Decimal("0.00"))
    orders = len(sales)
    ticket = money(revenue / orders) if orders else Decimal("0.00")
    return {
        "revenue": _json_money(revenue),
        "items": int(items),
        "orders": orders,
        "ticket": _json_money(ticket),
    }


def daily_sales(db: Session, days: int, today: date) -> list[dict]:
    """Retorna o mesmo contrato do endpoint ``/dashboard/daily``."""
    start = today - timedelta(days=days - 1)
    rows = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        summary = _summary(db, _sales_for_day(db, day))
        rows.append({"date": day.isoformat(), **{key: summary[key] for key in ("revenue", "orders", "items")}})
    return rows


def hourly_sales(db: Session, today: date) -> list[dict]:
    """Retorna a série horária padrão do PDV, incluindo 8h a 18h vazias."""
    sales = _sales_for_day(db, today)
    rows = [{"hour": hour, "revenue": 0, "orders": 0} for hour in range(8, 19)]
    by_hour = {row["hour"]: row for row in rows}
    for sale in sales:
        hour = sale.criado_em.hour if sale.criado_em else 0
        if hour not in by_hour:
            by_hour[hour] = {"hour": hour, "revenue": 0, "orders": 0}
        by_hour[hour]["revenue"] += _json_money(sale.total_liquido)
        by_hour[hour]["orders"] += 1
    return sorted(by_hour.values(), key=lambda row: row["hour"])


def dashboard_metrics(db: Session, today: date) -> dict:
    """Calcula KPIs sem alterar os nomes de campos consumidos pelo frontend."""
    yesterday = today - timedelta(days=1)
    month_start = today.replace(day=1)
    current = _summary(db, _sales_for_day(db, today))
    previous = _summary(db, _sales_for_day(db, yesterday))
    month_sales = (
        db.query(Venda)
        .filter(Venda.criado_em >= _start_of_day(month_start), Venda.criado_em <= _end_of_day(today))
        .all()
    )
    month_revenue = sum((money(sale.total_liquido) for sale in month_sales), Decimal("0.00"))
    return {
        **current,
        "monthRevenue": _json_money(month_revenue),
        "revPct": _percent(current["revenue"], previous["revenue"]),
        "itemsPct": _percent(current["items"], previous["items"]),
        "ordersPct": _percent(current["orders"], previous["orders"]),
        "ticketPct": _percent(current["ticket"], previous["ticket"]),
        "monthPct": 0,
    }


def top_products(db: Session, limit: int = 8) -> list[dict]:
    """Retorna produtos por receita no formato previamente exposto pela API."""
    rows = (
        db.query(
            ItemVenda.produto_id,
            ItemVenda.produto_nome,
            func.coalesce(func.sum(ItemVenda.quantidade), 0).label("qty"),
            func.coalesce(func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario), 0).label("revenue"),
        )
        .group_by(ItemVenda.produto_id, ItemVenda.produto_nome)
        .order_by(func.coalesce(func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario), 0).desc())
        .limit(limit)
        .all()
    )
    response = []
    for product_id, name, quantity, revenue in rows:
        product = db.query(Produto).filter(Produto.id == product_id).first() if product_id else None
        category = product.categoria if product else None
        response.append({
            "productId": str(product_id) if product_id else "",
            "name": name,
            "qty": int(quantity or 0),
            "revenue": float(revenue or 0),
            "categoryId": str(category.id) if category else "",
            "categoryName": category.nome if category else "Sem categoria",
        })
    return response
