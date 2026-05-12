from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.sql import func 
from database.database import Base

class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True)
    nome = Column(String(150), nullable=False)
    descricao = Column(String(300), nullable=False)    
    preco = Column(Float, nullable=False)
    estoque = Column(Integer, nullable=False)
    categoria = Column(String(100))