"""Adiciona cor, codigo interno e venda por variacao

Revision ID: 847c8e2e98ac
Revises: 6f74dbaec612
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "847c8e2e98ac"
down_revision: Union[str, Sequence[str], None] = "6f74dbaec612"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("itens_venda") as batch_op:
        batch_op.add_column(sa.Column("variacao_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_itens_venda_variacao",
            "produtos_variacoes",
            ["variacao_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("itens_venda") as batch_op:
        batch_op.drop_constraint("fk_itens_venda_variacao", type_="foreignkey")
        batch_op.drop_column("variacao_id")
