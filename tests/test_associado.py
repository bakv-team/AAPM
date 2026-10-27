"""Testes de busca e cadastro de associados."""

from database.models.cliente import Cliente


def test_consultar_associado_por_matricula(cliente, db_session):
    db_session.add(Cliente(nome="Maria Silva", matricula="A123", is_associado=True, ativo=True))
    db_session.commit()
    resposta = cliente.get("/api/v1/pdv/associates/lookup", params={"q": "A123"})
    assert resposta.status_code == 200
    assert resposta.json()["found"] is True
    assert resposta.json()["isAssociado"] is True


def test_buscar_associado_sem_termo_retorna_validacao(cliente):
    resposta = cliente.get("/api/v1/pdv/associates/search", params={"q": "a"})
    assert resposta.status_code == 422


def test_criar_associado_normaliza_campos(cliente):
    resposta = cliente.post("/api/v1/pdv/customers", json={"nome": "  João  ", "matricula": "M-1", "is_associado": True})
    assert resposta.status_code == 201
    assert resposta.json()["name"] == "João"
    assert resposta.json()["isAssociado"] is True


def test_rejeitar_associado_com_nome_em_branco(cliente):
    resposta = cliente.post("/api/v1/pdv/customers", json={"nome": "   "})
    assert resposta.status_code == 400
