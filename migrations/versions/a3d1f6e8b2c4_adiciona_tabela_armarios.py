"""Adiciona a tabela de armários.

Revision ID: a3d1f6e8b2c4
Revises: 9cff729850d5
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a3d1f6e8b2c4"
down_revision: Union[str, Sequence[str], None] = "9cff729850d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria a tabela de armários sem modificar as tabelas existentes."""
    op.create_table(
        "armarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("numero", sa.String(length=20), nullable=False),
        sa.Column("localizacao", sa.String(length=100), nullable=True),
        sa.Column(
            "status",
            sa.Enum("DISPONIVEL", "ALUGADO", "INATIVO", name="statusarmario"),
            nullable=False,
        ),
        sa.Column("locatario_nome", sa.String(length=150), nullable=True),
        sa.Column("semestre", sa.String(length=10), nullable=True),
        sa.Column("observacao", sa.String(length=255), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=True),
        sa.Column("alugado_em", sa.DateTime(), nullable=True),
        sa.Column(
            "criado_em",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
    )
    op.create_index(op.f("ix_armarios_id"), "armarios", ["id"], unique=False)


def downgrade() -> None:
    """Remove apenas a tabela criada por esta migração."""
    op.drop_index(op.f("ix_armarios_id"), table_name="armarios")
    op.drop_table("armarios")
