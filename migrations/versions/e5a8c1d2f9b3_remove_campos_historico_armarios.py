"""Remove acao e usuario_id do historico de armarios.

Revision ID: e5a8c1d2f9b3
Revises: d4e7f9a2c6b8
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5a8c1d2f9b3"
down_revision: Union[str, Sequence[str], None] = "d4e7f9a2c6b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("armarios_historico") as batch_op:
        batch_op.drop_column("acao")
        batch_op.drop_column("usuario_id")


def downgrade() -> None:
    with op.batch_alter_table("armarios_historico") as batch_op:
        batch_op.add_column(sa.Column("usuario_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("acao", sa.String(length=30), nullable=True))
