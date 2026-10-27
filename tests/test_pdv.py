"""Testes do fluxo de ponto de venda."""

from database.models.produto import Produto


def test_listar_produtos_disponiveis_no_pdv(cliente, db_session):
    db_session.add(Produto(nome="Lápis", preco=2, estoque_atual=10, ativo=True))
    db_session.commit()
    resposta = cliente.get("/api/v1/pdv/sale/products")
    assert resposta.status_code == 200
    assert any(item["name"] == "Lápis" for item in resposta.json())


def test_registrar_venda_atualiza_estoque(cliente, db_session):
    produto = Produto(nome="Caderno", preco=10, estoque_atual=4, ativo=True)
    db_session.add(produto)
    db_session.commit()
    resposta = cliente.post("/api/v1/pdv/sales", json={"itens": [{"produto_id": produto.id, "quantidade": 2}], "pagamento": "pix", "cliente_nome": "Cliente de teste"})
    assert resposta.status_code == 201
    assert db_session.get(Produto, produto.id).estoque_atual == 2


def test_rejeitar_venda_com_quantidade_invalida(cliente, db_session):
    produto = Produto(nome="Caneta", preco=3, estoque_atual=4, ativo=True)
    db_session.add(produto)
    db_session.commit()
    resposta = cliente.post("/api/v1/pdv/sales", json={"itens": [{"produto_id": produto.id, "quantidade": 0}], "pagamento": "pix"})
    assert resposta.status_code in (400, 422)
