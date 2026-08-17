import unittest
from datetime import date
from unittest.mock import MagicMock, patch

from services.smart_service import fallback_answer, smart_insights


class SmartServiceContractTests(unittest.TestCase):
    def test_insights_keep_the_existing_contract(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
        history = [{"date": "2026-08-02", "revenue": 0, "orders": 0, "items": 0}] * 30
        with patch("services.smart_service.daily_sales", return_value=history), patch("services.smart_service.top_products", return_value=[]):
            result = smart_insights(db, date(2026, 8, 2))
        self.assertEqual(set(result), {"forecast", "goals", "restock", "opportunities", "summary"})
        self.assertEqual(result["goals"]["dailyGoal"], 30)
        self.assertEqual(len(result["restock"]), 3)

    def test_fallback_answer_includes_forecast_and_strategy(self):
        answer = fallback_answer("O que comprar?", {"forecast": {"demand": "Alta", "itemsToday": 12, "stockRiskCount": 1}, "goals": {"missing": 3, "strategy": "Priorize o pico."}, "restock": [{"name": "Suco", "quantity": 5}]})
        self.assertIn("Suco (+5 un.)", answer)
        self.assertIn("Priorize o pico.", answer)
