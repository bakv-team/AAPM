
from database.auth import hash_senha, verificar_senha


def test_hash_senha_gera_string_diferente_original():

    senha = "minhasenhateste123"

    #chamar a função real para testar
    senha_hash = hash_senha(senha)

    assert senha_hash != senha


def test_verificar_senha_aceita_senha_correta():

    senha = "minhasenhateste123"
    senha_hash = hash_senha(senha)

    resultado = verificar_senha(senha, senha_hash)

    assert resultado is True


def test_verificar_senha_rejeita_senha_errada():

    senha_certa = "minhasenhateste123"
    senha_hash = hash_senha(senha_certa)
    senha_errada = "senhaerradateste"

    resultado = verificar_senha(senha_errada, senha_hash)

    # Assert: o caminhio negativo. 
    # Garantir que o sistema rejeita as senhas erradas.
    assert resultado is False