from fastapi import APIRouter, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database.auth import get_admin, hash_senha
from database.database import get_db
from database.models.usuario import Usuario


router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

DASHBOARD_FUNCIONARIOS = "/dashboard#funcionarios"
ROLES_PERMITIDOS = ("admin", "operador", "funcionario")


@router.get("/")
def listar_usuarios(admin=Depends(get_admin)):
    return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)


@router.get("/novo")
def form_novo_usuario(admin=Depends(get_admin)):
    return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)


@router.post("/novo")
def criar_usuario(
    nome: str = Form(...),
    email: str = Form(...),
    senha: str = Form(...),
    role: str = Form(...),
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    if role not in ROLES_PERMITIDOS:
        return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)

    existente = db.query(Usuario).filter(Usuario.email == email).first()
    if existente:
        return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)

    novo = Usuario(
        nome=nome.strip(),
        email=email.strip().lower(),
        senha_hash=hash_senha(senha),
        role=role,
        ativo=True,
    )

    db.add(novo)
    db.commit()

    return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)


@router.get("/{usuario_id}/editar")
def form_editar_usuario(usuario_id: int, admin=Depends(get_admin)):
    return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)


@router.post("/{usuario_id}/editar")
def editar_usuario(
    usuario_id: int,
    nome: str = Form(...),
    email: str = Form(...),
    role: str = Form(...),
    senha: str = Form(""),
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    editando = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not editando or role not in ROLES_PERMITIDOS:
        return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)

    conflito = (
        db.query(Usuario)
        .filter(Usuario.email == email.strip().lower(), Usuario.id != usuario_id)
        .first()
    )
    if conflito:
        return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)

    editando.nome = nome.strip()
    editando.email = email.strip().lower()
    editando.role = role

    if senha.strip():
        editando.senha_hash = hash_senha(senha)

    db.commit()

    return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)


@router.post("/{usuario_id}/toggle-ativo")
def toggle_ativo(
    usuario_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)

    if usuario.email == admin.get("sub"):
        return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)

    usuario.ativo = not usuario.ativo
    db.commit()

    return RedirectResponse(url=DASHBOARD_FUNCIONARIOS, status_code=302)
