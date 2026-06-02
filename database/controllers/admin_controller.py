# admin_controller.py
# Rotas acessíveis apenas por admin

from fastapi import APIRouter, Depends, Request, Form, status, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import get_db
from database.models.usuario import Usuario
from database.auth import get_admin, hash_senha


router = APIRouter(prefix="/usuarios", tags=["Usuários"])

templates = Jinja2Templates(directory="database/templates")


class UsuarioAPICreate(BaseModel):
    nome: str
    email: str
    senha: str
    role: str = "operador"


@router.get("/api")
def listar_usuarios_api(
    db: Session = Depends(get_db),
    admin = Depends(get_admin)
):
    usuarios = db.query(Usuario).order_by(Usuario.nome).all()

    return [
        {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "role": usuario.role,
            "ativo": usuario.ativo,
        }
        for usuario in usuarios
    ]


@router.post("/api", status_code=status.HTTP_201_CREATED)
def criar_usuario_api(
    payload: UsuarioAPICreate,
    db: Session = Depends(get_db),
    admin = Depends(get_admin)
):
    nome = payload.nome.strip()
    email = payload.email.strip().lower()
    senha = payload.senha.strip()
    role = payload.role.strip()

    if not nome or not email or not senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Preencha todos os campos."
        )

    if len(senha) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve ter pelo menos 6 caracteres."
        )

    if role not in ("admin", "operador", "funcionario"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Perfil de acesso inválido."
        )

    existente = db.query(Usuario).filter(Usuario.email == email).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este e-mail já está cadastrado."
        )

    novo = Usuario(
        nome=nome,
        email=email,
        senha_hash=hash_senha(senha),
        role=role,
    )

    db.add(novo)
    db.commit()
    db.refresh(novo)

    return {
        "id": novo.id,
        "nome": novo.nome,
        "email": novo.email,
        "role": novo.role,
        "ativo": novo.ativo,
    }


# Exibir os usuarios do sistema
@router.get("/")
def listar_usuarios(
    request: Request,
    db: Session = Depends(get_db),
    admin = Depends(get_admin) # Bloqueia quem não é admin
):
   
    # Buscar usuarios do banco
    usuarios = db.query(Usuario).order_by(Usuario.nome).all()

    return templates.TemplateResponse(
        request,
        "usuarios/index.html",
        {
            "request": request,
            "admin": admin,
            "usuarios": usuarios

        }
    )


# CADASTRO

@router.get("/novo")
def form_novo_usuario(
    request: Request,
    admin = Depends(get_admin)
):
    """Exibe o formulário de cadastro de novo usuário."""
    return templates.TemplateResponse(
        request,
        "usuarios/form.html",
        {
            "request": request,
            "usuario": admin,
            "editando": None  # sinaliza para o template que é criação
        }
    )


@router.post("/novo")
def criar_usuario(
    request: Request,
    nome: str = Form(...),
    email: str = Form(...),
    senha: str = Form(...),
    role: str = Form(...),
    db: Session = Depends(get_db),
    admin = Depends(get_admin)
):
    """Processa o formulário e cria o usuário no banco."""

    # Verifica duplicidade de email
    existente = db.query(Usuario).filter(
        Usuario.email == email
    ).first()

    if existente:
        return templates.TemplateResponse(
            request,
            "usuarios/form.html",
            {
                "request": request,
                "usuario": admin,
                "editando": None,
                "erro": "Este e-mail já está cadastrado.",
                # devolve os valores para não limpar o formulário
                "valores": {"nome": nome, "email": email, "role": role}
            },
            status_code=400
        )

    # Valida se o role enviado é um dos valores permitidos
    # Evita que alguém manipule o formulário e envie um role inválido
    if role not in ("admin", "operador", "funcionario"):
        return templates.TemplateResponse(
            request,
            "usuarios/form.html",
            {
                "request": request,
                "usuario": admin,
                "editando": None,
                "erro": "Perfil de acesso inválido.",
                "valores": {"email": email, "role": role}
            },
            status_code=400
        )

    novo = Usuario(
        nome=nome,
        email=email,
        senha_hash=hash_senha(senha),
        role=role,
    )

    db.add(novo)
    db.commit()

    return RedirectResponse(url="/usuarios?criado=ok", status_code=302)



# EDIÇÃO
@router.get("/{usuario_id}/editar")
def form_editar_usuario(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin = Depends(get_admin)
):
    """Exibe o formulário preenchido com os dados atuais do usuário."""
    editando = db.query(Usuario).filter(Usuario.id == usuario_id).first()

    if not editando:
        return RedirectResponse(url="/usuarios", status_code=302)

    return templates.TemplateResponse(
        request,
        "usuarios/form.html",
        {
            "request": request,
            "usuario": admin,
            "editando": editando  # template detecta que é edição
        }
    )


@router.post("/{usuario_id}/editar")
def editar_usuario(
    usuario_id: int,
    request: Request,
    nome: str = Form(...),
    email: str = Form(...),
    role: str = Form(...),
    senha: str = Form(""),   # opcional na edição — vazio = não altera
    db: Session = Depends(get_db),
    admin = Depends(get_admin)
):
    """Atualiza os dados do usuário. Senha só é alterada se preenchida."""
    editando = db.query(Usuario).filter(Usuario.id == usuario_id).first()

    if not editando:
        return RedirectResponse(url="/usuarios", status_code=302)

    # Verifica se o novo email já pertence a outro usuário
    conflito = db.query(Usuario).filter(
        Usuario.email == email,
        Usuario.id != usuario_id  # ignora o próprio usuário
    ).first()

    if conflito:
        return templates.TemplateResponse(
            request,
            "usuarios/form.html",
            {
                "request": request,
                "usuario": admin,
                "editando": editando,
                "erro": "Este e-mail já está em uso por outro usuário.",
            },
            status_code=400
        )

    if role not in ("admin", "operador", "funcionario"):
        return templates.TemplateResponse(
            request,
            "usuarios/form.html",
            {
                "request": request,
                "usuario": admin,
                "editando": editando,
                "erro": "Perfil de acesso inválido.",
            },
            status_code=400
        )

    # Atualiza os campos
    editando.nome = nome
    editando.email = email
    editando.role = role

    # Só altera a senha se um novo valor foi enviado
    if senha.strip():
        editando.senha_hash = hash_senha(senha)

    db.commit()

    return RedirectResponse(url="/usuarios?editado=ok", status_code=302)



# ATIVAR / DESATIVAR


@router.post("/{usuario_id}/toggle-ativo")
def toggle_ativo(
    usuario_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_admin)
):
    """
    Alterna o status ativo/inativo do usuário.
   
    Preferimos desativar a deletar — mantemos o histórico
    de quem criou registros no sistema.
    Um admin não pode se desativar para não perder o acesso.
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()

    if not usuario:
        return RedirectResponse(url="/usuarios", status_code=302)

    # Proteção: admin não pode desativar a si mesmo
    if usuario.email == admin.get("sub"):
        return RedirectResponse(
            url="/usuarios?erro=autoproprio",
            status_code=302
        )

    usuario.ativo = not usuario.ativo
    db.commit()

    return RedirectResponse(url="/usuarios", status_code=302)
