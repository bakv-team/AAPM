# pip install httpx

from database.models.produto import Produto
from database.models.categoria import Categoria

def test_criar_produto_associado_categoria(db_session):

    categoria = Categoria(nome="Uniformes")
    db_session.add(categoria)
    db_session.commit()

    assert categoria.id is not None

    #Criar um produto
    produto = Produto(nome="Camisa Senai", preco=40.00, estoque_atual=20, categoria_id = categoria.id)
    db_session.add(produto)
    db_session.commit()

    procurar_produto = db_session.query(Produto).filter(Produto.nome == "Camisa Senai").first()

    assert procurar_produto is not None

    assert procurar_produto.preco == 40.00

    #Testa o relacionamento
    assert procurar_produto.categoria.nome == "Uniformes"


# Exercício
def test_produto_ativo_padrao(db_session):
    produto = Produto(nome="Boné", preco=99.90, estoque_atual=10)
    db_session.add(produto)
    db_session.commit()

    assert produto.ativo == True
    assert produto.ativo is True