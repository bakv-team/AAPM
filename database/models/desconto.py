from sqlalchemy import Column, Integer, String, Numeric, Boolean
from database.database import Base

class Desconto(Base):
    __tablename__ = "descontos"
    id = Column(Integer, primary_key=True)
    nome = Column(String(80), nullable=False)
    tipo = Column(String(12), nullable=False)
    valor = Column(Numeric(12, 2), nullable=False)
    minimo = Column(Numeric(12, 2), nullable=False, default=0)
    quantidade = Column(Integer, nullable=False, default=1)
    pagamento = Column(String(12), nullable=False, default="")
    ativo = Column(Boolean, nullable=False, default=True)
