"""Testes de consulta e validação de movimentações de estoque."""


def test_listar_movimentacoes_sem_registros(cliente):
    resposta = cliente.get("/api/v1/pdv/stock/movements")
    assert resposta.status_code == 200
    assert resposta.json() == []


def test_rejeitar_tipo_de_movimentacao_invalido(cliente):
    resposta = cliente.get("/api/v1/pdv/stock/movements", params={"tipo": "transferencia"})
    assert resposta.status_code == 400


def test_rejeitar_paginacao_incompleta_de_movimentacoes(cliente):
    resposta = cliente.get("/api/v1/pdv/stock/movements", params={"offset": 0})
    assert resposta.status_code == 400


def test_funcionario_sem_permissao_nao_consulta_movimentacoes(cliente_funcionario):
    resposta = cliente_funcionario.get("/api/v1/pdv/stock/movements")
    assert resposta.status_code == 403
