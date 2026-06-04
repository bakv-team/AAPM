# 1. Hash e verificação de senhas com brcypt
# 2. Geração de token JWT
# 3. Leitura e validação de token vindo do cookie

from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Request, HTTPException, status
from dotenv import load_dotenv
import os 

load_dotenv()

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

# funções do token - JWT
def criar_token(data:dict):
    payload = data.copy()

    #Define quando o token expira
    #Lembre que o ACESS_TOKEN_EXPERIRE_MINUTES é uma string, então precisamos converter para int
    expira = datetime.now(timezone.utc) + timedelta(minutes= int(ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expira})

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
def get_usuario_logado(request: Request):

    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado"
        )
    
    try:
        payload = decodificar_token(token)
        email = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido"
            )
        return payload
    except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido"
            )
    
def get_usuario_opcional(request: Request):

    try:
        return get_usuario_logado(request)
    except HTTPException:
        return None
    
# Quando o usuario é admin
# Ao inves de retornar erro, retornar um template dizendo "Acesso apenas para administradores" ou para erros num geral
def get_admin(request: Request):
    usuario = get_usuario_logado(request)

    if usuario.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso apenas para administradores"
        )
    else:
        return usuario
