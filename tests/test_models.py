from database.models.produto import Produto

def test_produto_preserva_estoque_zero():

    produto1 = Produto(nome="Camisa", estoque_atual=0)

    assert produto1.estoque_atual == 0

def test_produto_preserva_quantidade_de_estoque():

    produto1 = Produto(nome="Camisa", estoque_atual=5)

    assert produto1.estoque_atual == 5

def test_produto_preserva_estoque_acima_do_limite():

    produto1 = Produto(nome="Camisa", estoque_atual=6)

    assert produto1.estoque_atual == 6

