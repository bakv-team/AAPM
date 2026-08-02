import os
import tempfile
import unittest
from datetime import date, datetime
from decimal import Decimal
from email.message import EmailMessage
from pathlib import Path
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.database import Base
from database.models import categoria, cliente, movimentacao, produto, usuario, variacao, venda  # noqa: F401
from database.models.categoria import Categoria
from database.models.cliente import Cliente
from database.models.produto import Produto
from database.models.venda import ItemVenda, Venda
from integrations.ai_client import RUNTIME_STATUS, call_external_ai, config_status
from integrations.smtp_client import SmtpSettings, send_message
from services.errors import NotFoundError
from services.report_service import generate_report


class ReportServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        path = Path(self.temp_dir.name) / "reports.db"
        self.engine = create_engine(f"sqlite:///{path.as_posix()}")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)

        with self.Session.begin() as session:
            category = Categoria(nome="Bebidas", ativo=True)
            customer = Cliente(nome="Aluno Teste", matricula="123", is_associado=True, ativo=True)
            product = Produto(nome="Suco", preco=Decimal("5.00"), estoque_atual=3, ativo=True, categoria=category)
            sale = Venda(
                cliente=customer,
                metodo_pagamento="pix",
                total_bruto=Decimal("10.00"),
                total_liquido=Decimal("9.00"),
                valor_total=Decimal("10.00"),
                valor_final=Decimal("9.00"),
                criado_em=datetime(2026, 8, 2, 10, 0),
            )
            sale.itens.append(ItemVenda(produto=product, produto_nome="Suco", quantidade=2, preco_unitario=Decimal("5.00")))
            session.add(sale)

    def tearDown(self):
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_sales_and_daily_reports_keep_expected_contract(self):
        with self.Session() as session:
            sales = generate_report(session, "sales", "today", date(2026, 8, 2))
            daily = generate_report(session, "daily", "today", date(2026, 8, 2))

        self.assertEqual(sales.filename, "relatorio-vendas-hoje-2026-08-02.csv")
        self.assertEqual(sales.rows[0][1:3], ["Aluno Teste", "pix"])
        self.assertEqual(daily.rows, [["2026-08-02", Decimal("9.00"), 1, 2]])

    def test_low_stock_report_and_unknown_report(self):
        with self.Session() as session:
            report = generate_report(session, "stock-low", "month", date(2026, 8, 2))
            self.assertEqual(report.rows[0][0], "Suco")
            with self.assertRaises(NotFoundError):
                generate_report(session, "unknown", "month", date(2026, 8, 2))


class ExternalIntegrationTests(unittest.TestCase):
    def test_smtp_adapter_applies_tls_login_and_send(self):
        settings = SmtpSettings("smtp.test", 587, "user", "secret", "from@test", "support@test", True, False, 10)
        message = EmailMessage()
        message["From"] = settings.sender
        message["To"] = settings.support_recipient
        message.set_content("Teste")
        smtp = MagicMock()
        smtp.__enter__.return_value = smtp

        with patch("integrations.smtp_client.smtplib.SMTP", return_value=smtp) as smtp_class:
            send_message(message, settings)

        smtp_class.assert_called_once_with("smtp.test", 587, timeout=10, local_hostname="localhost")
        smtp.starttls.assert_called_once()
        smtp.login.assert_called_once_with("user", "secret")
        smtp.send_message.assert_called_once_with(message)

    def test_ai_without_keys_falls_back_without_network(self):
        clean_env = {
            key: value
            for key, value in os.environ.items()
            if key not in {"OPENAI_API_KEY", "AAPM_AI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"}
        }
        with patch.dict(os.environ, clean_env, clear=True), patch("integrations.ai_client.urllib.request.urlopen") as request:
            self.assertIsNone(call_external_ai("Como vender mais?", {"sales": 0}))
            self.assertFalse(config_status()["ready"])

        request.assert_not_called()
        self.assertFalse(RUNTIME_STATUS["ok"])


if __name__ == "__main__":
    unittest.main()
