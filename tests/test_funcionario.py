"""Testes de administração de funcionários."""

from database.models.usuario import Usuario


def test_listar_funcionarios_exige_administrador(cliente_sem_autenticacao):
    resposta = cliente_sem_autenticacao.get("/usuarios/")
    assert resposta.status_code == 401


def test_criar_funcionario_com_csrf(cliente, db_session):
    token = "token-csrf-teste"
    cliente.cookies.set("csrf_token", token)
    resposta = cliente.post("/usuarios/novo", data={
        "nome": "Funcionária",
        "email": "funcionaria@teste.com",
        "senha": "SenhaSegura123",
        "role": "funcionario",
        "permissoes": "customers",
        "csrf_token": token,
    }, follow_redirects=False)
    assert resposta.status_code == 302
    usuario = db_session.query(Usuario).filter_by(email="funcionaria@teste.com").one()
    assert usuario.role == "funcionario"
    assert usuario.permissoes == "customers"


def test_rejeitar_criacao_de_funcionario_sem_csrf(cliente):
    resposta = cliente.post("/usuarios/novo", data={
        "nome": "Inválido", "email": "invalido@teste.com", "senha": "senha", "role": "funcionario", "csrf_token": "incorreto",
    })
    assert resposta.status_code == 403
