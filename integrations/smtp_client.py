import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage


@dataclass(frozen=True)
class ConfiguracaoSmtp:
    servidor: str
    porta: int
    usuario: str
    senha: str
    remetente: str
    destinatario_suporte: str
    usar_tls: bool
    usar_ssl: bool
    tempo_limite: int

    @property
    def pronta(self) -> bool:
        return bool(self.servidor and self.remetente)


def configuracao_smtp() -> ConfiguracaoSmtp:
    try:
        porta = int(os.getenv("SMTP_PORT", "587"))
    except (TypeError, ValueError):
        porta = 587
    try:
        tempo_limite = int(os.getenv("SMTP_TIMEOUT", "60"))
    except (TypeError, ValueError):
        tempo_limite = 60
    usuario = os.getenv("SMTP_USER") or ""
    remetente = os.getenv("SMTP_FROM") or usuario
    return ConfiguracaoSmtp(
        servidor=os.getenv("SMTP_HOST") or "",
        porta=porta,
        usuario=usuario,
        senha="".join((os.getenv("SMTP_PASSWORD") or "").split()),
        remetente=remetente,
        destinatario_suporte=os.getenv("SUPPORT_EMAIL") or remetente,
        usar_tls=os.getenv("SMTP_TLS", "true").strip().lower() != "false",
        usar_ssl=os.getenv("SMTP_SSL", "false").strip().lower() == "true" or porta == 465,
        tempo_limite=max(1, tempo_limite),
    )


def enviar_mensagem(
    mensagem: EmailMessage,
    configuracao: ConfiguracaoSmtp | None = None,
    exigir_credenciais: bool = False,
) -> None:
    configuracao = configuracao or configuracao_smtp()
    if not configuracao.pronta:
        raise RuntimeError("SMTP incompleto: confira SMTP_HOST e SMTP_FROM/SMTP_USER no .env.")
    if exigir_credenciais and (not configuracao.usuario or not configuracao.senha):
        raise RuntimeError("SMTP incompleto: confira SMTP_USER e SMTP_PASSWORD no .env.")

    classe_smtp = smtplib.SMTP_SSL if configuracao.usar_ssl else smtplib.SMTP
    with classe_smtp(
        configuracao.servidor,
        configuracao.porta,
        timeout=configuracao.tempo_limite,
        local_hostname="localhost",
    ) as smtp:
        if configuracao.usar_tls and not configuracao.usar_ssl:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
        if configuracao.usuario and configuracao.senha:
            smtp.login(configuracao.usuario, configuracao.senha)
        smtp.send_message(mensagem)
