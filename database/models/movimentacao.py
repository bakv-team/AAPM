# Tabela de movimentação

from decimal import Decimal

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import relationship
from database.database import Base
import enum

class Tipo_movimentacao(str, enum.Enum):
    ENTRADA = "adicionar"
    SAIDA = "retirar"

class Movimentacao(Base):
    __tablename__ = "movimentacoes"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(Enum(Tipo_movimentacao), nullable=False)
    quantidade = Column(Integer, nullable=False)
    preco_unitario = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    observacao = Column(String(255), nullable=True)
    criado_em = Column(DateTime, server_default=func.now())

    produto_id = Column (Integer, ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False)

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=False)

    # Relacionamento
    produto = relationship("Produto", backref="movimentacoes")
    usuario = relationship("Usuario", backref="movimentacoes")

    @property
    def valor_total(self):
        return self.quantidade * self.preco_unitario
