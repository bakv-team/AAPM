"""Previsões, recomendações e resposta local do AAPM Smart."""

from datetime import date

from sqlalchemy.orm import Session

from database.models.produto import Produto
from services.dashboard_service import daily_sales, top_products


def smart_insights(
    db: Session,
    today: date,
    daily_goal: int = 30,
    profit_per_item: float = 3.5,
) -> dict:
    """Gera o contrato atual de ``/smart/insights`` sem efeitos colaterais."""
    try:
        daily_goal = int(daily_goal)
    except (TypeError, ValueError):
        daily_goal = 30
    try:
        profit_per_item = float(profit_per_item)
    except (TypeError, ValueError):
        profit_per_item = 3.5

    history = daily_sales(db, 30, today)
    valid_days = [row for row in history if row["orders"] or row["items"] or row["revenue"]]
    window = valid_days[-7:] if valid_days else history[-7:]
    divisor = max(1, len(window))
    average_revenue = sum(row["revenue"] for row in window) / divisor
    average_items = sum(row["items"] for row in window) / divisor
    average_orders = sum(row["orders"] for row in window) / divisor
    today_row = history[-1] if history else {"revenue": 0, "items": 0, "orders": 0}

    day_factor = 1.08 if today.weekday() in (0, 1, 2, 3) else 0.92
    forecast_revenue = max(float(today_row["revenue"]), average_revenue * day_factor)
    forecast_items = max(int(round(average_items * day_factor)), int(today_row["items"] or 0))
    forecast_orders = max(int(round(average_orders * day_factor)), int(today_row["orders"] or 0))
    confidence = min(92, max(48, 54 + len(valid_days) * 2 + (10 if average_items else 0)))

    products = db.query(Produto).filter(Produto.ativo == True).order_by(Produto.nome).all()
    top = top_products(db)
    top_by_id = {int(item["productId"]): item for item in top if item.get("productId")}
    low_stock = [product for product in products if (product.estoque_atual or 0) <= 5]

    risks, restock = [], []
    for product in products:
        sold = top_by_id.get(product.id, {}).get("qty", 0)
        estimated_turnover = max(1, int(round(sold / 7))) if sold else 1
        stock = int(product.estoque_atual or 0)
        if stock <= max(2, estimated_turnover):
            risks.append(product)
        if stock <= 5 or product in risks:
            restock.append({
                "name": product.nome,
                "quantity": max(5, estimated_turnover * 3 - stock),
                "reason": "Estoque critico" if product in risks else "Estoque baixo",
            })
    restock = restock[:3]
    while len(restock) < 3:
        index = len(restock) + 1
        restock.append({"name": f"Produto de giro {index}", "quantity": max(3, 12 - index * 3), "reason": "Sugestao preventiva"})

    missing = max(0, daily_goal - forecast_items)
    if missing == 0:
        strategy = "Meta atingida pela previsao. Mantenha estoque dos itens de maior giro e priorize atendimento rapido nos horarios de pico."
    elif missing <= 5:
        strategy = f"A meta esta perto: faltam {missing} vendas. Crie um combo simples com o produto mais vendido e destaque no intervalo."
    elif missing <= 12:
        strategy = f"A meta exige acao: faltam {missing} vendas. Antecipe produtos de giro rapido, revise fila do PDV e use uma oferta curta no pico."
    else:
        strategy = f"A meta esta distante: faltam {missing} vendas. Reavalie a meta de hoje, use combo promocional e reduza reposicao de itens parados."

    demand = "Alta" if forecast_items >= daily_goal else "Moderada" if forecast_items >= daily_goal * 0.72 else "Baixa"
    opportunities = [
        {"icon": "fa-tags", "text": "Criar combo de baixa saida"},
        {"icon": "fa-cash-register", "text": "Preparar produtos do pico"},
        {"icon": "fa-clipboard-check", "text": "Revisar estoque minimo"},
    ]
    if top:
        opportunities[0]["text"] = f"Destacar {top[0]['name']} no proximo intervalo"
    if low_stock:
        opportunities[2]["text"] = f"Repor {low_stock[0].nome} antes do pico"

    profit_today = forecast_items * profit_per_item
    return {
        "forecast": {"revenueToday": round(forecast_revenue, 2), "itemsToday": forecast_items, "ordersToday": forecast_orders, "stockRiskCount": len(risks), "confidence": int(confidence), "demand": demand, "peakHint": "Maior saida entre 09h e 10h"},
        "goals": {"dailyGoal": daily_goal, "profitPerItem": profit_per_item, "profitToday": round(profit_today, 2), "profitMonth": round(profit_today * 30, 2), "profitYear": round(profit_today * 364, 2), "missing": missing, "strategy": strategy},
        "restock": restock,
        "opportunities": opportunities,
        "summary": {"title": f"Demanda {demand.lower()}", "text": "A previsao combina historico recente, estoque atual e produtos com maior giro para sugerir a melhor acao do dia."},
    }


def fallback_answer(message: str, insights: dict) -> str:
    """Resposta determinística quando não há provedor externo configurado."""
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
