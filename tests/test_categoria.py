"""Testes das rotas de categorias."""


def test_listar_categorias_sem_registros_retorna_lista(cliente):
    resposta = cliente.get("/api/v1/pdv/categories")
    assert resposta.status_code == 200
    assert resposta.json() == []


def test_criar_categoria_com_tipo_invalido_retorna_erro_de_validacao(cliente):
    resposta = cliente.post("/api/v1/pdv/categories", json={"nome": 123})
    assert resposta.status_code == 422
