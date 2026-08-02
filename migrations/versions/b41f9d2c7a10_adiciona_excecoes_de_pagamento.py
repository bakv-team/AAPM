"""Adiciona permissoes legadas e excecoes de pagamento.

Revision ID: b41f9d2c7a10
Revises: 847c8e2e98ac

A verificacao de colunas torna a migration compativel com bancos antigos que
receberam esses campos pela antiga rotina de startup da aplicacao.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b41f9d2c7a10"
down_revision: Union[str, Sequence[str], None] = "847c8e2e98ac"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table_name):
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    usuario_columns = _column_names("usuarios")
    if usuario_columns and "permissoes" not in usuario_columns:
        with op.batch_alter_table("usuarios") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "permissoes",
                    sa.String(length=255),
                    nullable=False,
                    server_default="",
                )
            )

    venda_columns = _column_names("vendas")
    if not venda_columns:
        return

    missing_columns = [
        column
        for column in (
            sa.Column(
                "excecao_pagamento",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column(
                "excecao_status",
                sa.String(length=30),
                nullable=False,
                server_default="sem_excecao",
            ),
            sa.Column("excecao_prazo", sa.DateTime(), nullable=True),
            sa.Column("excecao_observacao", sa.String(length=255), nullable=True),
            sa.Column("excecao_pago_em", sa.DateTime(), nullable=True),
        )
        if column.name not in venda_columns
    ]
    if missing_columns:
        with op.batch_alter_table("vendas") as batch_op:
            for column in missing_columns:
                batch_op.add_column(column)


def downgrade() -> None:
    venda_columns = _column_names("vendas")
    removable_columns = [
        column_name
        for column_name in (
            "excecao_pago_em",
            "excecao_observacao",
            "excecao_prazo",
            "excecao_status",
            "excecao_pagamento",
        )
        if column_name in venda_columns
    ]
    if removable_columns:
        with op.batch_alter_table("vendas") as batch_op:
            for column_name in removable_columns:
                batch_op.drop_column(column_name)
