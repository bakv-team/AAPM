# produto.py
from decimal import Decimal

from sqlalchemy import Column, Integer, String, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from database.database import Base

class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True)
    nome = Column(String(150), nullable=False)
    descricao = Column(String(300), nullable=True)
    # Mantidos como valor-base/totais para preservar vendas, relatórios e
    # produtos antigos que não utilizam variações.
    preco = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    estoque_atual = Column(Integer, nullable=False, default=0)
    ativo = Column(Boolean, default=True)
    imagem_path = Column(String(255), nullable=True)

    categoria_id = Column(Integer, ForeignKey("categorias.id", ondelete="SET NULL"), nullable=True)

    categoria = relationship("Categoria", back_populates="produtos")

    variacoes = relationship(
        "ProdutoVariacao",
        cascade="all, delete-orphan",
        order_by="ProdutoVariacao.id",
    )

    @property
    def imagem_url(self):
        if self.imagem_path:
            return f"/static/{self.imagem_path}"
        return "/static/img/produtos-placeholder.png"
