import tempfile
import threading
import unittest
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.v1.pvd import (
    ItemVendaPayload,
    VendaPayload,
    criar_venda_api,
)
from database.database import Base
from database.models import categoria, cliente, movimentacao, produto, usuario, variacao, venda  # noqa: F401
from database.models.produto import Produto
from database.models.cliente import Cliente
from database.models.movimentacao import Movimentacao
from database.models.usuario import Usuario
from database.models.venda import ItemVenda, Venda
from services.errors import ConflictError
from services.stock_service import replenish_stock, reserve_stock
from utils.money import money


class FinanceAndStockTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database_path = Path(self.temp_dir.name) / "concorrencia.db"
        self.engine = create_engine(
            f"sqlite:///{database_path.as_posix()}",
            connect_args={"check_same_thread": False, "timeout": 10},
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)

    def tearDown(self):
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_money_rounds_half_up_to_cents(self):
        self.assertEqual(money("0.30000000000000004"), Decimal("0.30"))
        self.assertEqual(money("10.005"), Decimal("10.01"))

    def test_only_one_concurrent_sale_can_consume_last_unit(self):
        with self.Session.begin() as session:
            product = Produto(
                nome="Ultima unidade",
                preco=Decimal("12.90"),
                estoque_atual=1,
                ativo=True,
            )
            session.add(product)

        barrier = threading.Barrier(2)
        outcomes = []
        outcomes_lock = threading.Lock()

        def consume_last_unit():
            session = self.Session()
            try:
                current_product = session.query(Produto).first()
                barrier.wait(timeout=5)
                reserve_stock(session, current_product, None, 1)
                session.commit()
                outcome = "success"
            except ConflictError:
                session.rollback()
                outcome = "conflict"
            finally:
                session.close()
            with outcomes_lock:
                outcomes.append(outcome)

        threads = [threading.Thread(target=consume_last_unit) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertCountEqual(outcomes, ["success", "conflict"])
        with self.Session() as session:
            self.assertEqual(session.query(Produto).one().estoque_atual, 0)

    def test_sale_uses_decimal_discount_and_updates_stock_atomically(self):
        with self.Session.begin() as session:
            operator = Usuario(
                nome="Operador",
                email="operador@teste.local",
                senha_hash="hash",
                role="operador",
                permissoes="",
                ativo=True,
            )
            associate = Cliente(nome="Associado Teste", is_associado=True, ativo=True)
            product = Produto(
                nome="Produto decimal",
                preco=Decimal("0.10"),
                estoque_atual=2,
                ativo=True,
            )
            session.add_all([operator, associate, product])

        session = self.Session()
        try:
            result = criar_venda_api(
                VendaPayload(
                    itens=[ItemVendaPayload(produto_id=product.id, quantidade=2)],
                    pagamento="pix",
                    associado=True,
                    cliente_nome=associate.nome,
                ),
                db=session,
                usuario={"id": operator.id, "sub": operator.email},
            )
        finally:
            session.close()

        self.assertEqual(result["total_bruto"], 0.20)
        self.assertEqual(result["desconto_valor"], 0.02)
        self.assertEqual(result["total_liquido"], 0.18)
        with self.Session() as verification:
            saved_sale = verification.query(Venda).one()
            saved_item = verification.query(ItemVenda).one()
            saved_product = verification.query(Produto).one()
            self.assertEqual(saved_sale.total_bruto, Decimal("0.20"))
            self.assertEqual(saved_sale.total_liquido, Decimal("0.18"))
            self.assertEqual(saved_item.preco_unitario, Decimal("0.10"))
            self.assertEqual(saved_product.estoque_atual, 0)
            self.assertEqual(verification.query(Movimentacao).count(), 1)

    def test_replenishment_updates_stock_and_creates_audit_movement(self):
        with self.Session.begin() as session:
            operator = Usuario(
                nome="Estoquista",
                email="estoque@teste.local",
                senha_hash="hash",
                role="funcionario",
                permissoes="stock",
                ativo=True,
            )
            product = Produto(
                nome="Produto para reposicao",
                preco=Decimal("7.50"),
                estoque_atual=1,
                ativo=True,
            )
            session.add_all([operator, product])

        with self.Session() as session:
            updated = replenish_stock(
                session,
                product_id=product.id,
                quantity=2,
                variation_id=None,
                user_id=operator.id,
                created_at=datetime(2026, 8, 2, 10, 0),
            )
            self.assertEqual(updated.estoque_atual, 3)

        with self.Session() as session:
            movement = session.query(Movimentacao).one()
            self.assertEqual(movement.quantidade, 2)
            self.assertEqual(movement.preco_unitario, Decimal("7.50"))


if __name__ == "__main__":
    unittest.main()
