"""Verificações de autenticação, autorização e validação de entrada."""


def test_rota_protegida_rejeita_usuario_nao_autenticado(cliente_sem_autenticacao):
    resposta = cliente_sem_autenticacao.get("/api/v1/pdv/products")
    assert resposta.status_code == 401


def test_funcionario_sem_permissao_nao_cria_categoria(cliente_funcionario):
    resposta = cliente_funcionario.post("/api/v1/pdv/categories", json={"nome": "Restrita"})
    assert resposta.status_code == 403


def test_rejeitar_alteracao_sem_token_csrf(cliente):
    cliente.cookies.set("access_token", "token-de-teste")
    resposta = cliente.post("/api/v1/pdv/categories", json={"nome": "Sem CSRF"})
    assert resposta.status_code == 403


def test_rota_inexistente_retorna_404(cliente):
    resposta = cliente.get("/api/v1/pdv/rota-que-nao-existe")
    assert resposta.status_code == 404
