"""Cadastro de descontos condicionais."""
from alembic import op
import sqlalchemy as sa
revision = "a7d9e2f4b610"
down_revision = "f2b7c1d4e8a9"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("descontos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(80), nullable=False),
        sa.Column("tipo", sa.String(12), nullable=False),
        sa.Column("valor", sa.Numeric(12, 2), nullable=False),
        sa.Column("minimo", sa.Numeric(12, 2), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=False),
        sa.Column("pagamento", sa.String(12), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False))

def downgrade():
    op.drop_table("descontos")
