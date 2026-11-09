"""Testes de consulta e manutenção de pedidos."""

from decimal import Decimal

from database.models.venda import Venda


def test_listar_pedidos_retorna_lista_vazia(cliente):
    resposta = cliente.get("/api/v1/pdv/orders")
    assert resposta.status_code == 200
    assert resposta.json() == []


def test_rejeitar_consulta_paginada_incompleta_de_pedidos(cliente):
    resposta = cliente.get("/api/v1/pdv/orders", params={"limit": 10})
    assert resposta.status_code == 400


def test_marcar_excecao_de_pagamento_como_paga(cliente, db_session):
    venda = Venda(total_bruto=Decimal("12.00"), total_liquido=Decimal("12.00"), valor_total=Decimal("12.00"), valor_final=Decimal("12.00"), excecao_pagamento=True, excecao_status="pendente")
    db_session.add(venda)
    db_session.commit()
    resposta = cliente.put(f"/api/v1/pdv/orders/{venda.id}/payment-exception", json={"pago": True})
    assert resposta.status_code == 200
    assert resposta.json()["status"] == "concluido"


def test_registrar_pagamentos_parciais_atualiza_saldo_ate_quitacao(cliente, db_session):
    venda = Venda(
        total_bruto=Decimal("12.00"),
        total_liquido=Decimal("12.00"),
        valor_total=Decimal("12.00"),
        valor_final=Decimal("12.00"),
        excecao_pagamento=True,
        excecao_status="pendente",
        excecao_valor_pago=Decimal("2.00"),
    )
    db_session.add(venda)
    db_session.commit()

    primeiro = cliente.put(
        f"/api/v1/pdv/orders/{venda.id}/payment-exception",
        json={"pago": True, "pagamento": "pix", "valor_pago": "4.00"},
    )
    assert primeiro.status_code == 200
    assert primeiro.json()["paymentException"]["paid"] == 6.0
    assert primeiro.json()["paymentException"]["pending"] == 6.0
    assert primeiro.json()["status"] == "pendente"

    final = cliente.put(
        f"/api/v1/pdv/orders/{venda.id}/payment-exception",
        json={"pago": True, "pagamento": "pix", "valor_pago": "6.00"},
    )
    assert final.status_code == 200
    assert final.json()["paymentException"]["paid"] == 12.0
    assert final.json()["paymentException"]["pending"] == 0.0
    assert final.json()["status"] == "concluido"


def test_pedido_inexistente_retorna_nao_encontrado(cliente):
    resposta = cliente.put("/api/v1/pdv/orders/999/payment-exception", json={"pago": True})
    assert resposta.status_code == 404
