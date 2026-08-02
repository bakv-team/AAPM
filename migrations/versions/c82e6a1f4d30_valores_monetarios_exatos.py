"""Converte valores monetarios de Float para Numeric.

Revision ID: c82e6a1f4d30
Revises: b41f9d2c7a10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c82e6a1f4d30"
down_revision: Union[str, Sequence[str], None] = "b41f9d2c7a10"
branch_labels = None
depends_on = None


MONEY = sa.Numeric(12, 2)
PERCENT = sa.Numeric(5, 2)


def _alter_to_numeric(
    table_name: str,
    columns: list[tuple[str, sa.Numeric, bool]],
) -> None:
    with op.batch_alter_table(table_name) as batch_op:
        for column_name, target_type, nullable in columns:
            batch_op.alter_column(
                column_name,
                existing_type=sa.Float(),
                type_=target_type,
                existing_nullable=nullable,
            )


def _alter_to_float(
    table_name: str,
    columns: list[tuple[str, sa.Numeric, bool]],
) -> None:
    with op.batch_alter_table(table_name) as batch_op:
        for column_name, current_type, nullable in columns:
            batch_op.alter_column(
                column_name,
                existing_type=current_type,
                type_=sa.Float(),
                existing_nullable=nullable,
            )


MONETARY_COLUMNS = {
    "produtos": [("preco", MONEY, False)],
    "produtos_variacoes": [("preco", MONEY, False)],
    "movimentacoes": [("preco_unitario", MONEY, False)],
    "vendas": [
        ("desconto_percentual", PERCENT, False),
        ("desconto", MONEY, True),
        ("valor_total", MONEY, False),
        ("valor_final", MONEY, False),
        ("total_bruto", MONEY, False),
        ("total_liquido", MONEY, False),
    ],
    "itens_venda": [("preco_unitario", MONEY, False)],
}


def upgrade() -> None:
    for table_name, columns in MONETARY_COLUMNS.items():
        _alter_to_numeric(table_name, columns)


def downgrade() -> None:
    for table_name, columns in reversed(MONETARY_COLUMNS.items()):
        _alter_to_float(table_name, columns)
