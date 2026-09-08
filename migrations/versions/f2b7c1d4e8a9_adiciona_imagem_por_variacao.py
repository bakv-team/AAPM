"""Adiciona imagem por variacao de produto.

Revision ID: f2b7c1d4e8a9
Revises: e5a8c1d2f9b3
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2b7c1d4e8a9"
down_revision: Union[str, Sequence[str], None] = "e5a8c1d2f9b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("produtos_variacoes") as batch_op:
        batch_op.add_column(sa.Column("imagem_path", sa.String(length=255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("produtos_variacoes") as batch_op:
        batch_op.drop_column("imagem_path")
