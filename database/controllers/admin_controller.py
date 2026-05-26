# admin_controller.py
# Rotas acessíveis apenas por admin

from fastapi import APIRouter, Depends, Request, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from database.database import get_db
from database.models.usuario import Usuario
from database.auth import get_admin, hash_senha


router = APIRouter(prefix="/usuarios", tags=["Usuários"])

templates = Jinja2Templates(directory="database/templates")


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
    email: str = Form(...),
    senha: str = Form(...),
    role: str = Form(...),
    ativo: bool = Form(...),
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
                "valores": {"email": email, "role": role}
            },
            status_code=400
        )

    # Valida se o role enviado é um dos valores permitidos
    # Evita que alguém manipule o formulário e envie um role inválido
    if role not in ("admin", "operador"):
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
        email=email,
        senha_hash=hash_senha(senha),
        role=role,
        ativo=ativo
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
    email: str = Form(...),
    role: str = Form(...),
    senha: str = Form(""),   # opcional na edição — vazio = não altera
    ativo: bool = Form(""),
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

    if role not in ("admin", "operador"):
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
    editando.ativo = ativo
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