import asyncio
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from starlette.datastructures import UploadFile
from starlette.requests import Request
from starlette.responses import Response

from api.middleware import (
    access_token_max_age,
    cookie_secure,
    require_api_csrf,
    set_csrf_cookie,
    validate_csrf_token,
)
import database.controllers.produto_controller as product_controller


class WebSecurityTests(unittest.TestCase):
    @staticmethod
    def request(method="POST", cookie="", csrf_header="") -> Request:
        headers = []
        if cookie:
            headers.append((b"cookie", cookie.encode()))
        if csrf_header:
            headers.append((b"x-csrf-token", csrf_header.encode()))
        return Request({
            "type": "http",
            "method": method,
            "path": "/api/v1/pdv/sales",
            "headers": headers,
        })

    def test_api_mutation_requires_matching_double_submit_token(self):
        request = self.request(
            cookie="access_token=signed; csrf_token=expected",
            csrf_header="expected",
        )
        self.assertIsNone(require_api_csrf(request))

        invalid_request = self.request(
            cookie="access_token=signed; csrf_token=expected",
            csrf_header="different",
        )
        with self.assertRaises(HTTPException) as error:
            require_api_csrf(invalid_request)
        self.assertEqual(error.exception.status_code, 403)

    def test_safe_method_does_not_require_csrf(self):
        self.assertIsNone(require_api_csrf(self.request(method="GET", cookie="access_token=signed")))

    def test_cookie_security_is_environment_aware(self):
        with patch.dict(os.environ, {"APP_ENV": "production"}, clear=False):
            os.environ.pop("COOKIE_SECURE", None)
            self.assertTrue(cookie_secure())
        with patch.dict(os.environ, {"COOKIE_SECURE": "false"}, clear=False):
            self.assertFalse(cookie_secure())

    def test_csrf_cookie_has_expected_attributes(self):
        response = Response()
        with patch.dict(os.environ, {"COOKIE_SECURE": "true", "ACCESS_TOKEN_EXPIRE_MINUTES": "30"}):
            set_csrf_cookie(response, "token-value")
            self.assertEqual(access_token_max_age(), 1800)
        cookie = response.headers["set-cookie"].lower()
        self.assertIn("secure", cookie)
        self.assertIn("samesite=lax", cookie)
        self.assertNotIn("httponly", cookie)

    def test_form_csrf_validation_rejects_missing_token(self):
        request = self.request(cookie="access_token=signed; csrf_token=expected")
        with self.assertRaises(HTTPException) as error:
            validate_csrf_token(request, None)
        self.assertEqual(error.exception.status_code, 403)


class ProductUploadSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_upload_dir = product_controller.UPLOAD_DIR
        product_controller.UPLOAD_DIR = Path(self.temp_dir.name) / "uploads"

    def tearDown(self):
        product_controller.UPLOAD_DIR = self.original_upload_dir
        self.temp_dir.cleanup()

    @staticmethod
    def upload(filename: str, content: bytes) -> UploadFile:
        return UploadFile(filename=filename, file=io.BytesIO(content))

    def test_valid_png_is_saved_with_generated_name(self):
        content = b"\x89PNG\r\n\x1a\n" + b"valid-image-payload"
        result = asyncio.run(product_controller._salvar_imagem(self.upload("foto.png", content)))
        self.assertTrue(result.startswith("uploads/"))
        saved_files = list(product_controller.UPLOAD_DIR.iterdir())
        self.assertEqual(len(saved_files), 1)
        self.assertEqual(saved_files[0].read_bytes(), content)

    def test_disguised_file_is_rejected_without_writing(self):
        with self.assertRaises(HTTPException) as error:
            asyncio.run(product_controller._salvar_imagem(self.upload("malicioso.png", b"not-a-png")))
        self.assertEqual(error.exception.status_code, 400)
        self.assertFalse(product_controller.UPLOAD_DIR.exists())

    def test_file_above_configured_limit_is_rejected(self):
        content = b"\x89PNG\r\n\x1a\n" + b"x" * 20
        with patch.dict(os.environ, {"MAX_PRODUCT_IMAGE_BYTES": "12"}):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(product_controller._salvar_imagem(self.upload("grande.png", content)))
        self.assertEqual(error.exception.status_code, 413)
        self.assertFalse(product_controller.UPLOAD_DIR.exists())


if __name__ == "__main__":
    unittest.main()
