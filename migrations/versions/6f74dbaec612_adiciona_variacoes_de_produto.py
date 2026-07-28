"""Adiciona variacoes de produto

Revision ID: 6f74dbaec612
Revises: e077bd5c1e0e
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "6f74dbaec612"
down_revision: Union[str, Sequence[str], None] = "e077bd5c1e0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "atributos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(50), nullable=False, unique=True),
    )
    op.create_table(
        "valores_atributos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("atributo_id", sa.Integer(), sa.ForeignKey("atributos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("valor", sa.String(50), nullable=False),
        sa.UniqueConstraint("atributo_id", "valor", name="uq_valor_atributo"),
    )
    op.create_table(
        "produtos_variacoes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("produto_id", sa.Integer(), sa.ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("codigo_produto", sa.String(50), nullable=False, unique=True),
        sa.Column("preco", sa.Float(), nullable=False),
        sa.Column("estoque_atual", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_produtos_variacoes_id", "produtos_variacoes", ["id"])
    op.create_table(
        "variacoes_combinacoes",
        sa.Column("variacao_id", sa.Integer(), sa.ForeignKey("produtos_variacoes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("valor_atributo_id", sa.Integer(), sa.ForeignKey("valores_atributos.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("variacoes_combinacoes")
    op.drop_index("ix_produtos_variacoes_id", table_name="produtos_variacoes")
    op.drop_table("produtos_variacoes")
    op.drop_table("valores_atributos")
    op.drop_table("atributos")
