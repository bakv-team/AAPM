from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func
from database.database import Base
import enum

class StatusArmario(str, enum.Enum,):
    DISPONIVEL = "disponivel"
    ALUGADO    = "alugado"
    INATIVO    = "inativo"

class Armario(Base):
    __tablename__ = "armarios"

    id     = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), nullable=False, unique=True)
    localizacao = Column(String(100), nullable=True)

    status = Column(
        Enum(StatusArmario),
        nullable=False,
        default=StatusArmario.DISPONIVEL
    )

    locatario_nome = Column(String(150), nullable=True)
    semestre = Column(String(10), nullable=True)
    observacao = Column(String(255), nullable=True)
    ativo = Column(Boolean, default=True)
    alugado_em     = Column(DateTime, nullable=True)
    criado_em      = Column(DateTime, server_default=func.now())
    atualizado_em  = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Armario numero={self.numero} status={self.status}>"

    @property
    def disponivel(self) -> bool:
        return self.status == StatusArmario.DISPONIVEL


class ArmarioHistorico(Base):
    __tablename__ = "armarios_historico"

    id = Column(Integer, primary_key=True, index=True)
    armario_id = Column(Integer, ForeignKey("armarios.id", ondelete="CASCADE"), nullable=False, index=True)
    numero = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    ativo = Column(Boolean, nullable=False)
    locatario_nome = Column(String(150), nullable=True)
    semestre = Column(String(10), nullable=True)
    observacao = Column(String(255), nullable=True)
    usuario_nome = Column(String(100), nullable=True)
    criado_em = Column(DateTime, server_default=func.now(), nullable=False)
