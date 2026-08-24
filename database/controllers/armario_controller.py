"""API para consulta e administracao dos armarios."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.middleware import require_api_csrf
from database.auth import get_admin, get_usuario_logado
from database.database import get_db
from database.models.armario import Armario, ArmarioHistorico, StatusArmario


router = APIRouter(
    prefix="/api/v1/armarios",
    tags=["Armarios"],
    dependencies=[Depends(require_api_csrf)],
)


class ArmarioCriarPayload(BaseModel):
    numero: str
    localizacao: str | None = None
    observacao: str | None = None


class ArmarioAtualizarPayload(BaseModel):
    numero: str
    localizacao: str | None = None
    observacao: str | None = None


class ArmarioAluguelPayload(BaseModel):
    locatario_nome: str
    semestre: str
    observacao: str | None = None


def _texto_obrigatorio(valor: str, campo: str, limite: int) -> str:
    texto = (valor or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail=f"Informe {campo}.")
    if len(texto) > limite:
        raise HTTPException(status_code=400, detail=f"{campo.capitalize()} deve ter no maximo {limite} caracteres.")
    return texto


def _texto_opcional(valor: str | None, limite: int, campo: str) -> str | None:
    texto = (valor or "").strip()
    if len(texto) > limite:
        raise HTTPException(status_code=400, detail=f"{campo.capitalize()} deve ter no maximo {limite} caracteres.")
    return texto or None


def _status_valor(armario: Armario) -> str:
    return armario.status.value if isinstance(armario.status, StatusArmario) else str(armario.status).lower()


def _armario_json(armario: Armario) -> dict:
    return {
        "id": armario.id,
        "numero": armario.numero,
        "localizacao": armario.localizacao,
        "status": _status_valor(armario),
        "locatario_nome": armario.locatario_nome,
        "semestre": armario.semestre,
        "observacao": armario.observacao,
        "ativo": bool(armario.ativo),
        "alugado_em": armario.alugado_em.isoformat() if armario.alugado_em else None,
        "criado_em": armario.criado_em.isoformat() if armario.criado_em else None,
        "atualizado_em": armario.atualizado_em.isoformat() if armario.atualizado_em else None,
    }


def _registrar_historico(db: Session, armario: Armario, acao: str, usuario: dict) -> None:
    """Registra um retrato do armario no momento de cada alteracao."""
    db.add(ArmarioHistorico(
        armario_id=armario.id,
        numero=armario.numero,
        status=_status_valor(armario),
        ativo=bool(armario.ativo),
        locatario_nome=armario.locatario_nome,
        semestre=armario.semestre,
        observacao=armario.observacao,
        usuario_nome=usuario.get("nome"),
    ))


def _historico_json(item: ArmarioHistorico) -> dict:
    return {
        "id": item.id,
        "armario_id": item.armario_id,
        "numero": item.numero,
        "status": item.status,
        "ativo": bool(item.ativo),
        "locatario_nome": item.locatario_nome,
        "semestre": item.semestre,
        "observacao": item.observacao,
        "usuario_nome": item.usuario_nome,
        "criado_em": item.criado_em.isoformat() if item.criado_em else None,
    }


def _obter_armario(db: Session, armario_id: int, *, bloquear: bool = False) -> Armario:
    consulta = db.query(Armario).filter(Armario.id == armario_id)
    if bloquear:
        consulta = consulta.with_for_update()
    armario = consulta.first()
    if not armario:
        raise HTTPException(status_code=404, detail="Armario nao encontrado.")
    return armario


@router.get("")
def listar_armarios(
    status_armario: StatusArmario | None = Query(None, alias="status"),
    localizacao: str | None = Query(None, max_length=100),
    incluir_inativos: bool = False,
    offset: int | None = Query(default=None, ge=0),
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado),
):
    """Lista o mapa de disponibilidade e seu resumo."""
    consulta = db.query(Armario)
    if not incluir_inativos:
        consulta = consulta.filter(Armario.ativo.is_(True))
    if status_armario is not None:
        consulta = consulta.filter(Armario.status == status_armario)
    localizacao_normalizada = (localizacao or "").strip()
    if localizacao_normalizada:
        consulta = consulta.filter(Armario.localizacao.ilike(f"%{localizacao_normalizada}%"))

    if (offset is None) != (limit is None):
        raise HTTPException(status_code=400, detail="Offset e limit devem ser informados juntos.")
    consulta = consulta.order_by(Armario.numero)
    total_filtrado = consulta.count()
    armarios = consulta.offset(offset).limit(limit).all() if offset is not None else consulta.all()
    todos_ativos = db.query(Armario).filter(Armario.ativo.is_(True)).all()
    localizacoes = sorted({a.localizacao for a in todos_ativos if a.localizacao})
    return {
        "armarios": [_armario_json(armario) for armario in armarios],
        "total": total_filtrado,
        "offset": offset,
        "limit": limit,
        "resumo": {
            "total": len(todos_ativos),
            "disponiveis": sum(a.status == StatusArmario.DISPONIVEL for a in todos_ativos),
            "alugados": sum(a.status == StatusArmario.ALUGADO for a in todos_ativos),
        },
        "localizacoes": localizacoes,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def criar_armario(
    payload: ArmarioCriarPayload,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin),
):
    numero = _texto_obrigatorio(payload.numero, "o numero do armario", 20).upper()
    if db.query(Armario).filter(func.lower(Armario.numero) == numero.lower()).first():
        raise HTTPException(status_code=409, detail=f"Armario {numero} ja esta cadastrado.")

    armario = Armario(
        numero=numero,
        localizacao=_texto_opcional(payload.localizacao, 100, "localizacao"),
        observacao=_texto_opcional(payload.observacao, 255, "observacao"),
        status=StatusArmario.DISPONIVEL,
        ativo=True,
    )
    db.add(armario)
    db.flush()
    _registrar_historico(db, armario, "criado", admin)
    db.commit()
    db.refresh(armario)
    return _armario_json(armario)


@router.get("/{armario_id}")
def detalhe_armario(
    armario_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado),
):
    return _armario_json(_obter_armario(db, armario_id))


@router.get("/{armario_id}/historico")
def listar_historico_armario(
    armario_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin),
):
    """Retorna os eventos do armario, do mais recente para o mais antigo."""
    _obter_armario(db, armario_id)
    itens = (
        db.query(ArmarioHistorico)
        .filter(ArmarioHistorico.armario_id == armario_id)
        .order_by(ArmarioHistorico.criado_em.desc(), ArmarioHistorico.id.desc())
        .all()
    )
    return {"historico": [_historico_json(item) for item in itens]}


@router.put("/{armario_id}")
def editar_armario(
    armario_id: int,
    payload: ArmarioAtualizarPayload,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin),
):
    armario = _obter_armario(db, armario_id)
    numero = _texto_obrigatorio(payload.numero, "o numero do armario", 20).upper()
    conflito = db.query(Armario).filter(
        func.lower(Armario.numero) == numero.lower(), Armario.id != armario_id
    ).first()
    if conflito:
        raise HTTPException(status_code=409, detail=f"Armario {numero} ja existe.")

    armario.numero = numero
    armario.localizacao = _texto_opcional(payload.localizacao, 100, "localizacao")
    armario.observacao = _texto_opcional(payload.observacao, 255, "observacao")
    _registrar_historico(db, armario, "editado", admin)
    db.commit()
    db.refresh(armario)
    return _armario_json(armario)


@router.post("/{armario_id}/alugar")
def alugar_armario(
    armario_id: int,
    payload: ArmarioAluguelPayload,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin),
):
    """Vincula um locatario a um armario disponivel."""
    armario = _obter_armario(db, armario_id, bloquear=True)
    if not armario.ativo or armario.status != StatusArmario.DISPONIVEL:
        raise HTTPException(status_code=409, detail="Este armario nao esta disponivel para locacao.")

    armario.status = StatusArmario.ALUGADO
    armario.locatario_nome = _texto_obrigatorio(payload.locatario_nome, "o nome do locatario", 150)
    armario.semestre = _texto_obrigatorio(payload.semestre, "o semestre", 10)
    observacao = _texto_opcional(payload.observacao, 255, "observacao")
    if observacao is not None:
        armario.observacao = observacao
    armario.alugado_em = datetime.now(timezone.utc).replace(tzinfo=None)
    _registrar_historico(db, armario, "alugado", admin)
    db.commit()
    db.refresh(armario)
    return _armario_json(armario)


@router.post("/{armario_id}/liberar")
def liberar_armario(
    armario_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin),
):
    armario = _obter_armario(db, armario_id, bloquear=True)
    if not armario.ativo:
        raise HTTPException(status_code=409, detail="Reative o armario antes de libera-lo.")

    armario.status = StatusArmario.DISPONIVEL
    armario.locatario_nome = None
    armario.semestre = None
    armario.alugado_em = None
    _registrar_historico(db, armario, "liberado", admin)
    db.commit()
    db.refresh(armario)
    return _armario_json(armario)


@router.post("/{armario_id}/toggle-ativo")
def toggle_ativo_armario(
    armario_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin),
):
    """Ativa ou desativa um armario que nao esteja alugado."""
    armario = _obter_armario(db, armario_id, bloquear=True)
    if armario.status == StatusArmario.ALUGADO:
        raise HTTPException(status_code=409, detail="Libere o armario antes de desativa-lo.")

    armario.ativo = not armario.ativo
    armario.status = StatusArmario.DISPONIVEL if armario.ativo else StatusArmario.INATIVO
    _registrar_historico(db, armario, "reativado" if armario.ativo else "desativado", admin)
    db.commit()
    db.refresh(armario)
    return _armario_json(armario)
