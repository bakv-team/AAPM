"""Testes das rotas de gestão de armários."""


def test_criar_armario_registra_disponibilidade_e_historico(cliente):
    resposta = cliente.post("/api/v1/armarios", json={"numero": " a-01 ", "localizacao": "Bloco A"})
    assert resposta.status_code == 201
    assert resposta.json()["numero"] == "A-01"
    assert resposta.json()["status"] == "disponivel"
    historico = cliente.get(f"/api/v1/armarios/{resposta.json()['id']}/historico")
    assert historico.status_code == 200
    assert len(historico.json()["historico"]) == 1


def test_rejeitar_armario_sem_numero(cliente):
    resposta = cliente.post("/api/v1/armarios", json={"numero": "   "})
    assert resposta.status_code == 400


def test_alugar_e_liberar_armario(cliente):
    criado = cliente.post("/api/v1/armarios", json={"numero": "B-02"}).json()
    aluguel = cliente.post(f"/api/v1/armarios/{criado['id']}/alugar", json={"locatario_nome": "Ana", "semestre": "2026-2"})
    assert aluguel.status_code == 200
    assert aluguel.json()["status"] == "alugado"
    liberar = cliente.post(f"/api/v1/armarios/{criado['id']}/liberar")
    assert liberar.status_code == 200
    assert liberar.json()["status"] == "disponivel"


def test_armario_inexistente_retorna_nao_encontrado(cliente):
    assert cliente.get("/api/v1/armarios/999").status_code == 404
