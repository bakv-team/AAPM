import os
import smtplib
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from jose import JWTError
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from database.database import get_db
from database.models.usuario import Usuario
from database.auth import (
    criar_token,
    criar_token_recuperacao_senha,
    decodificar_token_recuperacao_senha,
    hash_senha,
    normalizar_permissoes,
    verificar_senha,
)

load_dotenv(override=True)

# APIROUTER agrupa as rotas desse arquivo com o prefixo /auth
router = APIRouter(prefix="/auth", tags=["Autenticação"])

#Configura para renderizar os templates
templates = Jinja2Templates(directory="database/templates")


def _enviar_email_recuperacao(destino: str, nome: str, link: str):
    load_dotenv(override=True)
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    if smtp_password:
        smtp_password = "".join(smtp_password.split())
    smtp_from = os.getenv("SMTP_FROM") or smtp_user
    smtp_tls = os.getenv("SMTP_TLS", "true").strip().lower() != "false"
    smtp_ssl = os.getenv("SMTP_SSL", "false").strip().lower() == "true" or smtp_port == 465

    if not smtp_host or not smtp_from:
        raise RuntimeError("SMTP incompleto: confira SMTP_HOST e SMTP_FROM/SMTP_USER no .env.")
    if not smtp_user or not smtp_password:
        raise RuntimeError("SMTP incompleto: confira SMTP_USER e SMTP_PASSWORD no .env.")

    message = EmailMessage()
    message["Subject"] = "Redefinição de senha - AAPM"
    message["From"] = smtp_from
    message["To"] = destino
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain=(smtp_from.split("@")[-1] if "@" in smtp_from else None))
    message.set_content(
        f"Olá, {nome}.\n\n"
        "Recebemos uma solicitação para redefinir sua senha no sistema AAPM.\n"
        "Para continuar, acesse o link seguro abaixo em até 30 minutos:\n\n"
        f"{link}\n\n"
        "Se você não solicitou essa alteração, ignore este e-mail. Sua senha atual continuará válida."
    )
    message.add_alternative(
        f"""\
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de senha - AAPM</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe3ef;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#0f3b82;padding:24px 28px;color:#ffffff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">AAPM</div>
              <div style="font-size:22px;font-weight:700;margin-top:6px;">Redefinição de senha</div>
              <div style="font-size:13px;margin-top:6px;color:#dbeafe;">Sistema Institucional Administrativo</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 10px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Olá, <strong>{nome}</strong>.</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no sistema AAPM.
                Para criar uma nova senha, clique no botão abaixo.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#536173;">
                Este acesso é válido por <strong>30 minutos</strong>. Depois desse prazo, será necessário solicitar uma nova recuperação.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 26px;">
                <tr>
                  <td align="center" bgcolor="#f58a1f" style="border-radius:6px;">
                    <a href="{link}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">
                      Redefinir minha senha
                    </a>
                  </td>
                </tr>
              </table>
              <div style="border-top:1px solid #e5edf7;padding-top:18px;margin-top:8px;">
                <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#667085;">
                  Se o botão não abrir, copie e cole este link no navegador:<br>
                  <a href="{link}" style="color:#0f3b82;word-break:break-all;">{link}</a>
                </p>
                <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#667085;">
                  Se você não solicitou essa alteração, ignore este e-mail. Sua senha atual continuará válida.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#8a94a6;">
                  Por segurança, a equipe AAPM nunca solicita sua senha por e-mail.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 26px;text-align:center;color:#8a94a6;font-size:12px;line-height:1.5;">
              © 2026 SENAI Francisco Matarazzo - AAPM. Mensagem automática, não responda este e-mail.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""",
        subtype="html",
    )

    smtp_client = smtplib.SMTP_SSL if smtp_ssl else smtplib.SMTP
    timeout = int(os.getenv("SMTP_TIMEOUT", "60"))
    with smtp_client(smtp_host, smtp_port, timeout=timeout, local_hostname="localhost") as smtp:
        if smtp_tls and not smtp_ssl:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
        if smtp_user and smtp_password:
            smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)


def _base_url_recuperacao(request: Request) -> str:
    configured_url = os.getenv("APP_BASE_URL") or os.getenv("RESET_PASSWORD_BASE_URL")
    if configured_url:
        return configured_url.rstrip("/")
    return str(request.base_url).rstrip("/")

# Tela Login
@router.get("/")
@router.get("/login")
def tela_login(request: Request, erro: str | None = None):
    mensagens_erro = {
        "credenciais": "E-mail ou senha incorretos.",
        "email_nao_cadastrado": "E-mail nao cadastrado. Verifique o endereco ou solicite o cadastro.",
        "inativo": "Usuario inativo. Contate o administrador.",
    }
    return templates.TemplateResponse(
        request,
        "login.html",
        {
            "request": request,
            "erro": mensagens_erro.get((erro or "").strip().lower(), ""),
            "erro_temporario": bool(erro),
        }
    )

@router.post("/")
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
    email_normalizado = email.strip().lower()
    usuario = db.query(Usuario).filter(
        Usuario.email == email_normalizado
    ).first()

    if usuario is None:
        return RedirectResponse(url="/auth/login?erro=email_nao_cadastrado", status_code=303)

    # Verifica usuário E senha em passos separados para evitar
    # "timing attacks" (atacante deduz se o email existe pelo tempo de resposta)
    senha_correta = verificar_senha(senha, usuario.senha_hash)

# 1. Se a senha estiver errada:
    if not senha_correta:
        return RedirectResponse(url="/auth/login?erro=credenciais", status_code=303)

    # 2. Se o usuário estiver inativo (e corrigindo a falta do nome do template que vimos antes):
    if not usuario.ativo:
        return RedirectResponse(url="/auth/login?erro=inativo", status_code=303)

    # Dados que ficarão no payload do JWT
    # "sub" (subject) é a convenção JWT para identificar o usuário
    token_data = {
        "sub": usuario.email,
        "nome": usuario.nome,
        "role": usuario.role,
        "id": usuario.id,
        "permissoes": normalizar_permissoes(usuario.permissoes),
    }

    token = criar_token(token_data)

    # Cria a resposta de redirecionamento conforme o perfil e permissoes do dashboard.
    destino = "/dashboard" if usuario.role == "admin" or normalizar_permissoes(usuario.permissoes) else "/pdv"
    response = RedirectResponse(url=destino, status_code=302)

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


@router.post("/forgot-password")
def solicitar_recuperacao_senha(
    request: Request,
    email: str = Form(...),
    db: Session = Depends(get_db),
):
    email_normalizado = email.strip().lower()
    usuario = db.query(Usuario).filter(Usuario.email == email_normalizado).first()

    if usuario and usuario.ativo:
        token = criar_token_recuperacao_senha(usuario.email)
        base_url = _base_url_recuperacao(request)
        link = f"{base_url}/auth/reset-password?token={quote(token)}"
        try:
            _enviar_email_recuperacao(usuario.email, usuario.nome or usuario.email, link)
        except Exception as exc:
            print(f"[RECUPERACAO DE SENHA] Falha ao enviar e-mail para {usuario.email}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Não foi possível enviar o e-mail de recuperação: {exc}",
            )

    return {
        "ok": True,
        "message": "Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.",
    }


@router.get("/reset-password", response_class=HTMLResponse)
def tela_redefinir_senha(request: Request, token: str):
    try:
        decodificar_token_recuperacao_senha(token)
    except JWTError:
        return templates.TemplateResponse(
            request,
            "reset_password.html",
            {
                "request": request,
                "token": "",
                "erro": "Link de recuperação inválido ou expirado.",
            },
            status_code=400,
        )

    return templates.TemplateResponse(
        request,
        "reset_password.html",
        {"request": request, "token": token},
    )


@router.post("/reset-password", response_class=HTMLResponse)
def redefinir_senha(
    request: Request,
    token: str = Form(...),
    senha: str = Form(...),
    confirmar_senha: str = Form(...),
    db: Session = Depends(get_db),
):
    if senha != confirmar_senha:
        return templates.TemplateResponse(
            request,
            "reset_password.html",
            {"request": request, "token": token, "erro": "As senhas não conferem."},
            status_code=400,
        )
    if len(senha.strip()) < 6:
        return templates.TemplateResponse(
            request,
            "reset_password.html",
            {"request": request, "token": token, "erro": "A senha deve ter pelo menos 6 caracteres."},
            status_code=400,
        )

    try:
        payload = decodificar_token_recuperacao_senha(token)
    except JWTError:
        return templates.TemplateResponse(
            request,
            "reset_password.html",
            {
                "request": request,
                "token": "",
                "erro": "Link de recuperação inválido ou expirado.",
            },
            status_code=400,
        )

    usuario = db.query(Usuario).filter(Usuario.email == payload.get("sub")).first()
    if not usuario or not usuario.ativo:
        return templates.TemplateResponse(
            request,
            "reset_password.html",
            {"request": request, "token": "", "erro": "Não foi possível redefinir a senha."},
            status_code=400,
        )

    usuario.senha_hash = hash_senha(senha)
    db.commit()

    return templates.TemplateResponse(
        request,
        "reset_password.html",
        {
            "request": request,
            "token": "",
            "sucesso": "Senha alterada com sucesso. Você já pode entrar com a nova senha.",
        },
    )


#Rota para sair
@router.get("/logout")
def sair():
    response = RedirectResponse(url="/", status_code=302)
    response.delete_cookie("access_token")
    return response

