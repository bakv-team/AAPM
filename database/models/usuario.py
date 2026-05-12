from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func 
from database.database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True)
    email = Column(String(150), unique=True, nullable=False)
    senha_hash = Column(String(255), nullable=False)

    # Tipo do usuário - perfil do usuário (operador ou admin)
    role = Column(String(20), default="funcionario")

    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, server_default=func.now())