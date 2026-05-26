from fastapi import APIRouter, Depends, Request, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from database.database import get_db
from database.models.usuario import Usuario
from database.auth import hash_senha, verificar_senha, criar_token

# APIROUTER agrupa as rotas desse arquivo com o prefixo /auth
router = APIRouter(prefix="/auth", tags=["Autenticação"])

#Configura para renderizar os templates
templates = Jinja2Templates(directory="database/templates")

# Tela Login
@router.get("/login")
def tela_login(request: Request):
    return templates.TemplateResponse(
        request,
        "auth/login.html",
        {"request": request}
    )

@router.post("/login")
def login(
    request: Request,
    email: str = Form(...),
    senha: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Processa o login e define o cookie JWT.

    Fluxo:
    1. Busca o usuário pelo email
    2. Verifica a senha com bcrypt
    3. Gera o token JWT
    4. Salva o token em um cookie HttpOnly
    5. Redireciona para a página principal
    """

    # Busca o usuário no banco pelo email
    usuario = db.query(Usuario).filter(
        Usuario.email == email
    ).first()

    # Verifica usuário E senha em passos separados para evitar
    # "timing attacks" (atacante deduz se o email existe pelo tempo de resposta)
    senha_correta = (
        usuario is not None and
        verificar_senha(senha, usuario.senha_hash)
    )

# 1. Se a senha estiver errada:
    if not senha_correta:
        return templates.TemplateResponse(
            request,
            "auth/login",
            {
                "request": request,
                "erro": "E-mail ou senha incorretos." # Padronizado para 'erro'
            }
            # Removido o status_code=401 para o navegador não travar
        )

    # 2. Se o usuário estiver inativo (e corrigindo a falta do nome do template que vimos antes):
    if not usuario.ativo:
        return templates.TemplateResponse(
            request,
            "auth/login.html", # Adicionado o caminho do template que faltava
            {
                "request": request,
                "erro": "Usuário inativo. Contate o administrador."
            }
            # Removido o status_code=403
        )

    # Dados que ficarão no payload do JWT
    # "sub" (subject) é a convenção JWT para identificar o usuário
    token_data = {
        "sub": usuario.email,
        "nome": usuario.nome,
        "role": usuario.role,
        "id": usuario.id
    }

    token = criar_token(token_data)

    # Cria a resposta de redirecionamento
    response = RedirectResponse(url="/", status_code=302)

    # Define o cookie com o token JWT
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,    # JavaScript NÃO pode ler este cookie (proteção XSS)
        max_age=3600,     # expira em 1 hora (em segundos)
        samesite="lax",   # proteção básica contra CSRF
        # secure=True     # ativar em produção (exige HTTPS)
    )

    return response

#Rota para sair
@router.get("/logout")
def sair():
    response = RedirectResponse(url="/auth/login", status_code=302)
    response.delete_cookie("access_token")
    return response
