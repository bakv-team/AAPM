"""Testes de regressão das rotas principais da API."""

from database.models.categoria import Categoria
from database.models.produto import Produto


def test_listar_produtos_retorna_lista_com_sucesso(cliente):
    resposta = cliente.get("/api/v1/pdv/products")
    assert resposta.status_code == 200
    assert isinstance(resposta.json(), list)


def test_listar_categorias_retorna_categorias_cadastradas(cliente, db_session):
    db_session.add(Categoria(nome="Arroz"))
    db_session.commit()
    resposta = cliente.get("/api/v1/pdv/categories")
    assert resposta.status_code == 200
    assert any(item["name"] == "Arroz" for item in resposta.json())


def test_filtrar_produtos_por_busca(cliente, db_session):
    db_session.add_all([
        Produto(nome="Caneca Harry Potter", preco=149, estoque_atual=2),
        Produto(nome="Caderno", preco=20, estoque_atual=5),
    ])
    db_session.commit()
    resposta = cliente.get("/api/v1/pdv/products", params={"q": "Harry"})
    assert resposta.status_code == 200
    assert [item["name"] for item in resposta.json()] == ["Caneca Harry Potter"]


def test_criar_categoria_com_sucesso(cliente):
    resposta = cliente.post("/api/v1/pdv/categories", json={"nome": "Papelaria"})
    assert resposta.status_code == 201
    assert resposta.json()["name"] == "Papelaria"


def test_rejeitar_categoria_com_nome_vazio(cliente):
    resposta = cliente.post("/api/v1/pdv/categories", json={"nome": "   "})
    assert resposta.status_code == 400


def test_rejeitar_consulta_com_paginacao_incompleta(cliente):
    resposta = cliente.get("/api/v1/pdv/categories", params={"offset": 0})
    assert resposta.status_code == 400


def test_rejeitar_payload_de_categoria_sem_nome(cliente):
    resposta = cliente.post("/api/v1/pdv/categories", json={"campo_extra": "valor"})
    assert resposta.status_code == 422
