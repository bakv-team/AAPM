"""Regras de saúde do sistema e notificações operacionais."""

from datetime import datetime, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session

from database.models.categoria import Categoria
from database.models.cliente import Cliente
from database.models.produto import Produto
from database.models.venda import Venda
from integrations.ai_client import RUNTIME_STATUS, config_status
from integrations.smtp_client import smtp_settings


def system_warnings(db: Session) -> list[dict]:
    """Alertas de configuração e cadastro no contrato do frontend atual."""
    warnings = []
    ai_status = config_status()
    smtp = smtp_settings()

    if not ai_status["ready"]:
        warnings.append({"id": "ai-config", "type": "warn", "icon": "fa-robot", "text": "AAPM Smart esta sem chave externa valida e pode cair no modo local.", "time": "Config"})
    elif RUNTIME_STATUS.get("ok") is False:
        provider = RUNTIME_STATUS.get("provider") or ai_status["provider"]
        warnings.append({"id": "ai-runtime", "type": "warn", "icon": "fa-plug-circle-xmark", "text": f"Ultima chamada da IA externa ({provider}) falhou. Verifique rede, modelo ou billing.", "time": "IA"})

    if not smtp.host or not smtp.sender or not smtp.support_recipient:
        warnings.append({"id": "smtp-config", "type": "warn", "icon": "fa-envelope-circle-check", "text": "SMTP incompleto: recuperacao de senha e suporte por email podem falhar.", "time": "Email"})

    products = db.query(Produto).filter(Produto.ativo == True).count()
    categories = db.query(Categoria).filter(Categoria.ativo == True).count()
    uncategorized = db.query(Produto).filter(Produto.ativo == True, or_(Produto.categoria_id == None, Produto.categoria_id == 0)).count()
    if not categories:
        warnings.append({"id": "no-categories", "type": "warn", "icon": "fa-tags", "text": "Nenhuma categoria ativa cadastrada. Cadastre categorias antes de vender.", "time": "Cadastro"})
    if not products:
        warnings.append({"id": "no-products", "type": "warn", "icon": "fa-box-open", "text": "Nenhum produto ativo cadastrado. O PDV ficara sem itens para venda.", "time": "Cadastro"})
    if uncategorized:
        warnings.append({"id": "products-without-category", "type": "warn", "icon": "fa-layer-group", "text": f"{uncategorized} produto(s) ativo(s) estao sem categoria.", "time": "Cadastro"})
    return warnings


def system_health(db: Session, now: datetime) -> dict:
    warnings = system_warnings(db)
    return {
        "ok": not warnings,
        "checkedAt": now.isoformat(timespec="seconds"),
        "warnings": warnings,
        "ai": config_status(),
        "counts": {
            "products": db.query(Produto).filter(Produto.ativo == True).count(),
            "categories": db.query(Categoria).filter(Categoria.ativo == True).count(),
            "customers": db.query(Cliente).count(),
            "sales": db.query(Venda).count(),
        },
    }


def _customer_name(sale: Venda) -> str:
    if sale.cliente:
        return sale.cliente.nome
    text = sale.observacao or ""
    if "Cliente:" not in text:
        return "Cliente balcao"
    return (text.split("Cliente:", 1)[1].strip().split(".", 1)[0] or "Cliente balcao").strip()


def notifications(db: Session, now: datetime) -> list[dict]:
    """Notificações derivadas do estado atual, preservando chaves e mensagens."""
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    low_stock = db.query(Produto).filter(Produto.ativo == True, Produto.estoque_atual <= 5).count()
    sales_today = db.query(Venda).filter(Venda.criado_em >= today_start, Venda.criado_em <= today_end).count()
    last_sale = db.query(Venda).order_by(Venda.criado_em.desc()).first()
    pending = (
        db.query(Venda)
        .filter(Venda.excecao_pagamento == True, Venda.excecao_status == "pendente", Venda.excecao_prazo != None, Venda.excecao_prazo <= now + timedelta(days=2))
        .order_by(Venda.excecao_prazo.asc())
        .limit(5)
        .all()
    )

    items = list(system_warnings(db))
    for sale in pending:
        due = sale.excecao_prazo
        overdue = bool(due and due < now)
        customer = _customer_name(sale)
        items.append({"id": f"payment-exception-{sale.id}-{sale.excecao_status}", "type": "warn" if overdue else "info", "icon": "fa-calendar-check", "text": f"Excecao de pagamento do pedido #{sale.id:04d} {'venceu' if overdue else 'vence em breve'} para {customer}. Fale com o cliente sobre o restante do pagamento.", "time": due.strftime("%d/%m") if due else "Prazo"})
    if sales_today:
        items.append({"id": "sales-today", "type": "success", "icon": "fa-circle-check", "text": f"{sales_today} venda(s) registradas hoje.", "time": "Hoje"})
    if low_stock:
        items.append({"id": "low-stock", "type": "warn", "icon": "fa-triangle-exclamation", "text": f"{low_stock} produto(s) precisam de reposicao.", "time": "Estoque"})
    if last_sale:
        items.append({"id": "last-sale", "type": "info", "icon": "fa-receipt", "text": f"Ultima venda: #{last_sale.id:04d} no valor de R$ {last_sale.total_liquido:.2f}.", "time": last_sale.criado_em.strftime("%H:%M") if last_sale.criado_em else "Agora"})
    if not items:
        items.append({"id": "ready", "type": "success", "icon": "fa-circle-check", "text": "Sistema conectado e sem pendencias no momento.", "time": "Agora"})
    return items
