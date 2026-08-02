from decimal import Decimal

from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database.database import Base

class Atributo(Base):
    __tablename__ = "atributos"

    id = Column(Integer, primary_key=True)
    nome = Column(String(50), nullable=False, unique=True)  # "Cor", "Tamanho"
    
    valores = relationship("ValorAtributo", back_populates="atributo")

class ValorAtributo(Base):
    __tablename__ = "valores_atributos"

    id = Column(Integer, primary_key=True)
    atributo_id = Column(Integer, ForeignKey("atributos.id", ondelete="CASCADE"), nullable=False)
    valor = Column(String(50), nullable=False)  # "Branca", "P"
    __table_args__ = (UniqueConstraint("atributo_id", "valor", name="uq_valor_atributo"),)

    atributo = relationship("Atributo", back_populates="valores")

class VariacaoCombinacao(Base):
    __tablename__ = "variacoes_combinacoes"

    variacao_id = Column(Integer, ForeignKey("produtos_variacoes.id", ondelete="CASCADE"), primary_key=True)
    valor_atributo_id = Column(Integer, ForeignKey("valores_atributos.id", ondelete="CASCADE"), primary_key=True)

class ProdutoVariacao(Base):
    __tablename__ = "produtos_variacoes"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False)
    
    codigo_produto = Column(String(50), unique=True, nullable=False)
    preco = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    estoque_atual = Column(Integer, nullable=False, default=0)
    produto = relationship("Produto", back_populates="variacoes")

    valores_atributos = relationship(
        "ValorAtributo", 
        secondary="variacoes_combinacoes",
        backref="variacoes"
    )

    @property
    def nome_combinacao(self) -> str:
        """Retorna 'Branca / P' unindo todos os atributos vinculados."""
        return " / ".join([v.valor for v in self.valores_atributos])

    def valor_do_atributo(self, nome: str) -> str:
        return next(
            (valor.valor for valor in self.valores_atributos if valor.atributo.nome.casefold() == nome.casefold()),
            "",
        )
