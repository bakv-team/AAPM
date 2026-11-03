import unittest
from datetime import datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from database.database import Base
from database.models import categoria, cliente, movimentacao, produto, usuario, variacao, venda
from database.models.produto import Produto
from database.models.cliente import Cliente
from database.models.venda import Venda
from services.sale_service import RegisterSaleInput, SaleItemInput, register_sale
from services.errors import ValidationError


class SaleExceptionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.product = Produto(nome="Produto", preco=Decimal("100.00"), estoque_atual=10, ativo=True)
        self.db.add(self.product)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def sell(self, amount=None, enabled=True):
        return register_sale(self.db, RegisterSaleInput(
            items=[SaleItemInput(self.product.id, None, 1)], payment="pix",
            customer_name="Maria", note="", payment_exception=enabled,
            payment_due_at=datetime(2026, 10, 1) if enabled else None,
            payment_exception_note="", payment_exception_amount=amount,
        ), user_id=1, created_at=datetime(2026, 9, 29))

    def test_reduced_amount_is_persisted_and_stock_reserved(self):
        sale = self.sell(Decimal("45.50"))
        self.assertEqual(sale.total_bruto, Decimal("100.00"))
        self.assertEqual(sale.total_liquido, Decimal("45.50"))
        self.assertEqual(sale.valor_final, Decimal("45.50"))
        self.assertEqual(sale.desconto, Decimal("54.50"))
        self.assertEqual(self.product.estoque_atual, 9)
        self.assertEqual(sale.excecao_status, "pendente")

    def test_empty_amount_preserves_total(self):
        self.assertEqual(self.sell().total_liquido, Decimal("100.00"))

    def test_zero_is_supported(self):
        self.assertEqual(self.sell(Decimal("0")).total_liquido, Decimal("0.00"))

    def test_invalid_amounts_do_not_create_sales_or_move_stock(self):
        for amount in ("-1", "101", "1.001", "NaN", "Infinity"):
            with self.subTest(amount=amount), self.assertRaises(ValidationError):
                self.sell(Decimal(amount))
            self.assertEqual(self.product.estoque_atual, 10)
            self.assertEqual(self.db.query(Venda).count(), 0)

    def test_override_requires_exception(self):
        with self.assertRaises(ValidationError):
            self.sell(Decimal("50"), enabled=False)

    def test_associate_discount_sets_maximum_without_double_discount(self):
        self.db.add(Cliente(nome="Maria", ativo=True, is_associado=True))
        self.db.commit()
        with self.assertRaises(ValidationError):
            self.sell(Decimal("95"))
        self.assertEqual(self.sell(Decimal("80")).total_liquido, Decimal("80.00"))


class ConditionalDiscountTests(SaleExceptionTests):
    def discount(self, **changes):
        from database.models.desconto import Desconto
        values = dict(nome="Oferta", tipo="percentual", valor=Decimal("20"), minimo=Decimal("100"), quantidade=1, pagamento="pix", ativo=True)
        values.update(changes)
        rule = Desconto(**values)
        self.db.add(rule)
        self.db.commit()
        return rule.id

    def discounted_sale(self, ids):
        return register_sale(self.db, RegisterSaleInput(
            items=[SaleItemInput(self.product.id, None, 1)], payment="pix",
            customer_name="Maria", note="", payment_exception=False,
            payment_due_at=None, payment_exception_note="", discount_ids=tuple(ids),
        ), user_id=1, created_at=datetime(2026, 10, 27))

    def test_percentage_and_fixed_stack_after_membership(self):
        self.db.add(Cliente(nome="Maria", ativo=True, is_associado=True))
        self.db.commit()
        ids = [self.discount(), self.discount(tipo="fixo", valor=Decimal("5"))]
        sale = self.discounted_sale(ids)
        self.assertEqual(sale.total_liquido, Decimal("67.00"))
        self.assertEqual(sale.desconto, Decimal("33.00"))
        self.assertIn("Oferta", sale.observacao)
        self.assertEqual(self.product.estoque_atual, 9)

    def test_conditions_rejected_without_stock_changes(self):
        for changes in [dict(minimo=Decimal("101")), dict(quantidade=2), dict(pagamento="credito"), dict(ativo=False)]:
            with self.subTest(changes=changes):
                rule_id = self.discount(**changes)
                with self.assertRaises(ValidationError):
                    self.discounted_sale([rule_id])
                self.assertEqual(self.product.estoque_atual, 10)
                self.assertEqual(self.db.query(Venda).count(), 0)

    def test_unknown_discount_rejected(self):
        with self.assertRaises(ValidationError):
            self.discounted_sale([99999])

    def test_fixed_discount_capped_and_duplicate_applied_once(self):
        rule_id = self.discount(tipo="fixo", valor=Decimal("60"))
        self.assertEqual(self.discounted_sale([rule_id, rule_id]).total_liquido, Decimal("40.00"))
        big_id = self.discount(tipo="fixo", valor=Decimal("200"))
        self.assertEqual(self.discounted_sale([big_id]).total_liquido, Decimal("0.00"))
