# 1. Hash e verificação de senhas com brcypt
# 2. Geração de token JWT
# 3. Leitura e validação de token vindo do cookie

from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, Request, HTTPException, status
from dotenv import load_dotenv
from sqlalchemy.orm import Session
import os 

from database.database import get_db
from database.models.usuario import Usuario

load_dotenv()

PERMISSOES_DASHBOARD = {
    "smart": "AAPM Smart",
    "dashboard": "Dashboard",
    "products": "Produtos",
    "charts": "Painel grafico",
    "orders": "Pedidos",
    "customers": "Associados",
    "categories": "Categorias",
    "stock_movements": "Estoque e movimentacoes",
    "stock": "Estoque",
    "movements": "Movimentacoes",
    "reports": "Relatorios",
    "settings": "Configuracoes",
}

SECRET_KEY = os.getenv("SECRET_KEY")

ALGORITHM = os.getenv("ALGORITHM")

ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")

#CryptContext - configura o brcypt cp,p algoritimo de hash
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# funções de senha
def hash_senha(senha: str):
    return pwd_context.hash(senha)

def verificar_senha(senha: str, senha_hash: str):
    return pwd_context.verify(senha, senha_hash)

def normalizar_permissoes(permissoes):
    if permissoes is None:
        return []
    if isinstance(permissoes, str):
        valores = permissoes.replace(";", ",").split(",")
    else:
        valores = list(permissoes)
    permitidas = []
    for permissao in valores:
        chave = str(permissao or "").strip()
        if chave in PERMISSOES_DASHBOARD and chave not in permitidas:
            permitidas.append(chave)
    return permitidas

def permissoes_to_string(permissoes):
    return ",".join(normalizar_permissoes(permissoes))

def usuario_tem_permissao(usuario: dict, permissao: str):
    if usuario.get("role") == "admin":
        return True
    return permissao in normalizar_permissoes(usuario.get("permissoes"))

# funções do token - JWT
def criar_token(data:dict):
    payload = data.copy()

    #Define quando o token expira
    #Lembre que o ACESS_TOKEN_EXPERIRE_MINUTES é uma string, então precisamos converter para int
    expira = datetime.now(timezone.utc) + timedelta(minutes= int(ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expira, "purpose": "access"})

    # Criar o tokwn jwt
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


def criar_token_recuperacao_senha(email: str, minutos: int = 30):
    payload = {
        "sub": email,
        "purpose": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutos),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decodificar_token_recuperacao_senha(token: str):
    payload = decodificar_token(token)
    if payload.get("purpose") != "password_reset" or not payload.get("sub"):
        raise JWTError("Token de recuperação inválido")
    return payload

def decodificar_token(token: str):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload

# Dependências do FastAPI
def _erro_nao_autenticado(detail: str = "Token inválido") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
    )


def get_usuario_logado(
    request: Request,
    db: Session = Depends(get_db),
):

    token = request.cookies.get("access_token")

    if not token:
        raise _erro_nao_autenticado("Não autenticado")

    try:
        payload = decodificar_token(token)
    except JWTError:
        raise _erro_nao_autenticado()

    email = payload.get("sub")
    usuario_id = payload.get("id")
    if payload.get("purpose") not in (None, "access"):
        raise _erro_nao_autenticado()
    if not email and not usuario_id:
        raise _erro_nao_autenticado()

    if usuario_id:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    elif email:
        usuario = db.query(Usuario).filter(Usuario.email == email).first()
    else:
        usuario = None
    if not usuario or not usuario.ativo:
        raise _erro_nao_autenticado("Sessão encerrada. Faça login novamente.")

    # O token prova a identidade; o banco define o acesso vigente.
    return {
        **payload,
        "sub": usuario.email,
        "nome": usuario.nome,
        "role": usuario.role,
        "id": usuario.id,
        "permissoes": normalizar_permissoes(usuario.permissoes),
    }


def get_usuario_opcional(
    request: Request,
    db: Session = Depends(get_db),
):

    try:
        return get_usuario_logado(request, db)
    except HTTPException:
        return None
    
# Quando o usuario é admin
# Ao inves de retornar erro, retornar um template dizendo "Acesso apenas para administradores" ou para erros num geral
def get_admin(usuario=Depends(get_usuario_logado)):
    if usuario.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso apenas para administradores"
        )
    else:
        return usuario

def require_permission(*permissoes_aceitas: str):
    def dependency(usuario=Depends(get_usuario_logado)):
        if usuario.get("role") == "admin":
            return usuario
        permissoes_usuario = set(normalizar_permissoes(usuario.get("permissoes")))
        if any(permissao in permissoes_usuario for permissao in permissoes_aceitas):
            return usuario
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Voce nao tem permissao para acessar este recurso"
        )
    return dependency
