"""Testes de geração e acesso aos relatórios."""


def test_relatorio_de_estoque_retorna_csv(cliente):
    resposta = cliente.get("/api/v1/pdv/reports/stock")
    assert resposta.status_code == 200
    assert "text/csv" in resposta.headers["content-type"]
    assert "Produto" in resposta.text


def test_relatorio_desconhecido_retorna_nao_encontrado(cliente):
    resposta = cliente.get("/api/v1/pdv/reports/inexistente")
    assert resposta.status_code == 404


def test_funcionario_sem_permissao_nao_acessa_relatorios(cliente_funcionario):
    resposta = cliente_funcionario.get("/api/v1/pdv/reports/stock")
    assert resposta.status_code == 403
