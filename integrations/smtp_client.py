import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    port: int
    user: str
    password: str
    sender: str
    support_recipient: str
    use_tls: bool
    use_ssl: bool
    timeout: int

    @property
    def ready(self) -> bool:
        return bool(self.host and self.sender)


def smtp_settings() -> SmtpSettings:
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except (TypeError, ValueError):
        port = 587
    try:
        timeout = int(os.getenv("SMTP_TIMEOUT", "60"))
    except (TypeError, ValueError):
        timeout = 60
    user = os.getenv("SMTP_USER") or ""
    sender = os.getenv("SMTP_FROM") or user
    return SmtpSettings(
        host=os.getenv("SMTP_HOST") or "",
        port=port,
        user=user,
        password="".join((os.getenv("SMTP_PASSWORD") or "").split()),
        sender=sender,
        support_recipient=os.getenv("SUPPORT_EMAIL") or sender,
        use_tls=os.getenv("SMTP_TLS", "true").strip().lower() != "false",
        use_ssl=os.getenv("SMTP_SSL", "false").strip().lower() == "true" or port == 465,
        timeout=max(1, timeout),
    )


def send_message(
    message: EmailMessage,
    settings: SmtpSettings | None = None,
    require_credentials: bool = False,
) -> None:
    settings = settings or smtp_settings()
    if not settings.ready:
        raise RuntimeError("SMTP incompleto: confira SMTP_HOST e SMTP_FROM/SMTP_USER no .env.")
    if require_credentials and (not settings.user or not settings.password):
        raise RuntimeError("SMTP incompleto: confira SMTP_USER e SMTP_PASSWORD no .env.")

    smtp_class = smtplib.SMTP_SSL if settings.use_ssl else smtplib.SMTP
    with smtp_class(
        settings.host,
        settings.port,
        timeout=settings.timeout,
        local_hostname="localhost",
    ) as smtp:
        if settings.use_tls and not settings.use_ssl:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
        if settings.user and settings.password:
            smtp.login(settings.user, settings.password)
        smtp.send_message(message)
