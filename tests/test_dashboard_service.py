import unittest
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.database import Base
from database.models import categoria, cliente, movimentacao, produto, usuario, variacao, venda  # noqa: F401
from database.models.categoria import Categoria
from database.models.produto import Produto
from database.models.venda import ItemVenda, Venda
from services.dashboard_service import daily_sales, dashboard_metrics, hourly_sales, top_products


class DashboardServiceContractTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        with self.Session.begin() as session:
            category = Categoria(nome="Bebidas", ativo=True)
            product = Produto(nome="Suco", preco=Decimal("5.00"), estoque_atual=10, ativo=True, categoria=category)
            sale = Venda(total_liquido=Decimal("9.00"), valor_final=Decimal("9.00"), criado_em=datetime(2026, 8, 2, 10, 30))
            sale.itens.append(ItemVenda(produto=product, produto_nome="Suco", quantidade=2, preco_unitario=Decimal("4.50")))
            session.add(sale)

    def tearDown(self):
        self.engine.dispose()

    def test_dashboard_contracts_keep_keys_and_aggregates(self):
        with self.Session() as session:
            daily = daily_sales(session, 2, date(2026, 8, 2))
            hourly = hourly_sales(session, date(2026, 8, 2))
            metrics = dashboard_metrics(session, date(2026, 8, 2))
            products = top_products(session)

        self.assertEqual(daily[-1], {"date": "2026-08-02", "revenue": 9.0, "orders": 1, "items": 2})
        self.assertEqual(next(row for row in hourly if row["hour"] == 10), {"hour": 10, "revenue": 9.0, "orders": 1})
        self.assertEqual(metrics["revenue"], 9.0)
        self.assertEqual(metrics["ticket"], 9.0)
        self.assertEqual(products[0]["name"], "Suco")
        self.assertEqual(set(products[0]), {"productId", "name", "qty", "revenue", "categoryId", "categoryName"})
