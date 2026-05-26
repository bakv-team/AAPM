from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.sql import func 
from sqlalchemy.orm import relationship
from database.database import Base

class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True)
    nome = Column(String(150), nullable=False)
    descricao = Column(String(300), nullable=True)    
    preco = Column(Float, nullable=False)
    estoque_atual = Column(Integer, nullable=False)
    ativo = Column(Boolean, default=True)
    categoria = Column(String(100))
    imagem_path = Column(String(255), nullable=True)

    categoria_id = Column(Integer, ForeignKey("categorias.id", ondelete="SET NULL"), nullable=True)

    categoria = relationship("Categoria", back_populates="produtos")

    @property
    def imagem_url(self):
        if self.imagem_path:
            return f"/static/{self.imagem_path}"
        else:
            return "/static/img/produtos-placeholder.png"