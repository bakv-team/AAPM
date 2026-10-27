"""Fixtures compartilhadas para a suíte de regressão."""

import sys
from pathlib import Path

# Permite importar os pacotes do projeto quando o arquivo é executado
# diretamente pelo interpretador, além do uso normal pelo pytest.
RAIZ_PROJETO = Path(__file__).resolve().parents[1]
if str(RAIZ_PROJETO) not in sys.path:
    sys.path.insert(0, str(RAIZ_PROJETO))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.auth import get_admin, get_usuario_logado, get_usuario_opcional
from database.database import Base, get_db
from database.main import app


@pytest.fixture
def db_session():
    """Abre um banco SQLite em memória, isolado por teste."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    sessao_local = sessionmaker(autoflush=False, autocommit=False, bind=engine)
    sessao = sessao_local()
    try:
        yield sessao
    finally:
        sessao.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _usuario_admin():
    return {"sub": "teste@admin.com", "nome": "Admin teste", "role": "admin", "id": 1}


@pytest.fixture
def cliente(db_session):
    """Cliente autenticado como administrador para cenários autorizados."""
    def obter_banco_teste():
        yield db_session

    app.dependency_overrides[get_db] = obter_banco_teste
    app.dependency_overrides[get_usuario_logado] = _usuario_admin
    app.dependency_overrides[get_admin] = _usuario_admin
    app.dependency_overrides[get_usuario_opcional] = _usuario_admin
    try:
        with TestClient(app) as cliente_http:
            yield cliente_http
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def cliente_sem_autenticacao(db_session):
    """Cliente sem identidade simulada para validar rotas protegidas."""
    def obter_banco_teste():
        yield db_session

    app.dependency_overrides[get_db] = obter_banco_teste
    try:
        with TestClient(app) as cliente_http:
            yield cliente_http
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def cliente_funcionario(db_session):
    """Cliente autenticado como funcionário sem permissões administrativas."""
    def obter_banco_teste():
        yield db_session

    usuario = lambda: {"sub": "teste@funcionario.com", "nome": "Funcionário", "role": "funcionario", "id": 2, "permissoes": []}
    app.dependency_overrides[get_db] = obter_banco_teste
    app.dependency_overrides[get_usuario_logado] = usuario
    app.dependency_overrides[get_admin] = usuario
    app.dependency_overrides[get_usuario_opcional] = usuario
    try:
        with TestClient(app) as cliente_http:
            yield cliente_http
    finally:
        app.dependency_overrides.clear()
