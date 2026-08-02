import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

import database.auth as auth
from database.database import Base
from database.models import categoria, cliente, movimentacao, produto, usuario, variacao, venda  # noqa: F401
from database.models.usuario import Usuario


class AuthRevalidationTests(unittest.TestCase):
    def setUp(self):
        self.original_config = (auth.SECRET_KEY, auth.ALGORITHM, auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        auth.SECRET_KEY = "test-secret-key-with-enough-entropy"
        auth.ALGORITHM = "HS256"
        auth.ACCESS_TOKEN_EXPIRE_MINUTES = "60"

        self.temp_dir = tempfile.TemporaryDirectory()
        database_path = Path(self.temp_dir.name) / "auth.db"
        self.engine = create_engine(f"sqlite:///{database_path.as_posix()}")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)

    def tearDown(self):
        self.engine.dispose()
        self.temp_dir.cleanup()
        auth.SECRET_KEY, auth.ALGORITHM, auth.ACCESS_TOKEN_EXPIRE_MINUTES = self.original_config

    @staticmethod
    def request_with_token(token: str) -> Request:
        return Request({
            "type": "http",
            "method": "GET",
            "path": "/api/v1/pdv/profile",
            "headers": [(b"cookie", f"access_token={token}".encode())],
        })

    def create_user(self, **overrides) -> Usuario:
        data = {
            "nome": "Usuario Atual",
            "email": "usuario@teste.local",
            "senha_hash": "hash",
            "role": "funcionario",
            "permissoes": "reports",
            "ativo": True,
        }
        data.update(overrides)
        with self.Session.begin() as session:
            user = Usuario(**data)
            session.add(user)
        return user

    def access_token(self, user: Usuario, **overrides) -> str:
        payload = {
            "sub": user.email,
            "id": user.id,
            "nome": "Nome antigo",
            "role": "admin",
            "permissoes": ["products"],
        }
        payload.update(overrides)
        return auth.criar_token(payload)

    def test_database_role_and_permissions_replace_stale_token_values(self):
        user = self.create_user()
        token = self.access_token(user)
        with self.Session() as session:
            current = auth.get_usuario_logado(self.request_with_token(token), session)

        self.assertEqual(current["nome"], "Usuario Atual")
        self.assertEqual(current["role"], "funcionario")
        self.assertEqual(current["permissoes"], ["reports"])

    def test_inactive_user_loses_access_immediately(self):
        user = self.create_user()
        token = self.access_token(user)
        with self.Session.begin() as session:
            session.get(Usuario, user.id).ativo = False

        with self.Session() as session, self.assertRaises(HTTPException) as error:
            auth.get_usuario_logado(self.request_with_token(token), session)
        self.assertEqual(error.exception.status_code, 401)

    def test_deleted_identity_does_not_fall_back_to_reused_email(self):
        user = self.create_user()
        token = self.access_token(user)
        self.create_user(email="sentinela@teste.local")
        with self.Session.begin() as session:
            session.delete(session.get(Usuario, user.id))
        replacement = self.create_user(nome="Outra pessoa")
        self.assertNotEqual(user.id, replacement.id)

        with self.Session() as session, self.assertRaises(HTTPException) as error:
            auth.get_usuario_logado(self.request_with_token(token), session)
        self.assertEqual(error.exception.status_code, 401)

    def test_password_reset_token_cannot_authenticate_as_access_token(self):
        user = self.create_user()
        token = auth.criar_token_recuperacao_senha(user.email)
        with self.Session() as session, self.assertRaises(HTTPException) as error:
            auth.get_usuario_logado(self.request_with_token(token), session)
        self.assertEqual(error.exception.status_code, 401)

    def test_permission_check_uses_refreshed_permissions(self):
        dependency = auth.require_permission("reports")
        refreshed_user = {"role": "funcionario", "permissoes": ["reports"]}
        self.assertIs(dependency(usuario=refreshed_user), refreshed_user)


if __name__ == "__main__":
    unittest.main()
