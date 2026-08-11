"""Adiciona historico de alteracoes dos armarios.

Revision ID: d4e7f9a2c6b8
Revises: a3d1f6e8b2c4
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e7f9a2c6b8"
down_revision: Union[str, Sequence[str], None] = "a3d1f6e8b2c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "armarios_historico",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("armario_id", sa.Integer(), nullable=False),
        sa.Column("acao", sa.String(length=30), nullable=False),
        sa.Column("numero", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("locatario_nome", sa.String(length=150), nullable=True),
        sa.Column("semestre", sa.String(length=10), nullable=True),
        sa.Column("observacao", sa.String(length=255), nullable=True),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("usuario_nome", sa.String(length=100), nullable=True),
        sa.Column("criado_em", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["armario_id"], ["armarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_armarios_historico_armario_id"), "armarios_historico", ["armario_id"], unique=False)
    op.create_index(op.f("ix_armarios_historico_id"), "armarios_historico", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_armarios_historico_id"), table_name="armarios_historico")
    op.drop_index(op.f("ix_armarios_historico_armario_id"), table_name="armarios_historico")
    op.drop_table("armarios_historico")
