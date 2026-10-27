"""Persiste o valor inicial pago nas excecoes de pagamento."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "ab12cd34ef56"
down_revision: Union[str, Sequence[str], None] = "f2b7c1d4e8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("vendas")}
    if "excecao_valor_pago" not in columns:
        with op.batch_alter_table("vendas") as batch_op:
            batch_op.add_column(sa.Column("excecao_valor_pago", sa.Numeric(12, 2), nullable=False, server_default="0.00"))


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("vendas")}
    if "excecao_valor_pago" in columns:
        with op.batch_alter_table("vendas") as batch_op:
            batch_op.drop_column("excecao_valor_pago")
