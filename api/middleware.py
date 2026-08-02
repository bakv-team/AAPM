import os
import secrets

from fastapi import HTTPException, Request, status


CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


def cookie_secure() -> bool:
    configured = os.getenv("COOKIE_SECURE")
    if configured is not None:
        return configured.strip().lower() in {"1", "true", "yes", "on"}
    return os.getenv("APP_ENV", "development").strip().lower() in {"production", "prod"}


def access_token_max_age() -> int:
    try:
        minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    except (TypeError, ValueError):
        minutes = 60
    return max(1, minutes) * 60


def csrf_token_for_request(request: Request) -> str:
    token = request.cookies.get(CSRF_COOKIE_NAME)
    if token:
        return token
    token = getattr(request.state, "csrf_token", None) or secrets.token_urlsafe(32)
    request.state.csrf_token = token
    return token


def set_csrf_cookie(response, token: str) -> None:
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        secure=cookie_secure(),
        samesite="lax",
        max_age=access_token_max_age(),
        path="/",
    )


def validate_csrf_token(request: Request, submitted_token: str | None) -> None:
    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
    if not cookie_token or not submitted_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token CSRF ausente ou inválido. Atualize a página e tente novamente.",
        )
    if not secrets.compare_digest(cookie_token, submitted_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token CSRF ausente ou inválido. Atualize a página e tente novamente.",
        )


def require_api_csrf(request: Request) -> None:
    if request.method.upper() in SAFE_METHODS or not request.cookies.get("access_token"):
        return
    validate_csrf_token(request, request.headers.get(CSRF_HEADER_NAME))
