from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.sql import func 
from database.database import Base

class Venda(Base):
    __tablename__ = "vendas"

    id = Column(Integer, primary_key=True)
    metodo_pagamento = Column(String(150), nullable=False)
    desconto = Column(Float, default=0)
    valor_total = Column(Float, nullable=False)
    valor_final = Column(Float, nullable=False)