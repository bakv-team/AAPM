import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.v1.pvd import listar_produtos_api
from database.database import Base
from database.models import categoria, cliente, movimentacao, produto, usuario, variacao, venda  # noqa: F401
from database.models.produto import Produto


class ProductPaginationContractTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        with self.Session.begin() as session:
            session.add_all([Produto(nome=f"Produto {index:02d}", preco=1, estoque_atual=index, ativo=True) for index in range(1, 13)])

    def tearDown(self):
        self.engine.dispose()

    def test_pagination_returns_metadata_without_changing_the_item_shape(self):
        with self.Session() as session:
            result = listar_produtos_api(q="", category_id=None, stock="", status_filtro="active", offset=8, limit=4, db=session, usuario={})
        self.assertEqual(result["total"], 12)
        self.assertEqual(result["offset"], 8)
        self.assertEqual(result["limit"], 4)
        self.assertEqual([item["name"] for item in result["items"]], ["Produto 09", "Produto 10", "Produto 11", "Produto 12"])

    def test_legacy_call_still_returns_a_list(self):
        with self.Session() as session:
            result = listar_produtos_api(q="", category_id=None, stock="", status_filtro="active", offset=None, limit=None, db=session, usuario={})
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 12)
