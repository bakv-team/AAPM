import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

# Importação das suas models e Base
from database.database import Base
from database.models import (
    usuario,
    produto,
    categoria,
    venda,
    movimentacao,
    cliente,
    variacao,
)

# Configuração do objeto Alembic
config = context.config

# Carrega variáveis locais (.env) se existirem
load_dotenv()

# 1. Captura a URL das variáveis de ambiente do SO/Render
db_url = os.getenv("DATABASE_URL")

# 2. Tratamento para SQLite usando caminho absoluto
if db_url and db_url.startswith("sqlite"):
    # Garante o caminho absoluto para o banco.db localizado na raiz do projeto (AAPM-1)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(BASE_DIR, "banco.db")
    db_url = f"sqlite:///{db_path}"

# 3. Injeta a URL tratada nas configurações do Alembic
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

# Configuração de logs do Alembic
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Define a metadata dos seus modelos para autogerar as migrações
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Executa as migrações no modo 'offline'."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Executa as migrações no modo 'online'."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()