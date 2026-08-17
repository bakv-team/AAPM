import unittest
from datetime import datetime
from unittest.mock import patch

from services.notification_service import notifications


class NotificationServiceContractTests(unittest.TestCase):
    def test_empty_system_keeps_ready_notification_contract(self):
        session = unittest.mock.MagicMock()
        with patch("services.notification_service.system_warnings", return_value=[]):
            session.query.return_value.filter.return_value.count.return_value = 0
            session.query.return_value.order_by.return_value.first.return_value = None
            session.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
            result = notifications(session, datetime(2026, 8, 2, 9, 0))
        self.assertEqual(result, [{"id": "ready", "type": "success", "icon": "fa-circle-check", "text": "Sistema conectado e sem pendencias no momento.", "time": "Agora"}])
