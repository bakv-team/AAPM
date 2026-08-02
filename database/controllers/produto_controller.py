import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status


UPLOAD_DIR = Path("database/static/uploads")
DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_SIGNATURES = {
    ".jpg": lambda data: data.startswith(b"\xff\xd8\xff"),
    ".jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    ".png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    ".webp": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
}


def _max_image_bytes() -> int:
    try:
        configured = int(os.getenv("MAX_PRODUCT_IMAGE_BYTES", str(DEFAULT_MAX_IMAGE_BYTES)))
    except (TypeError, ValueError):
        configured = DEFAULT_MAX_IMAGE_BYTES
    return max(1, configured)


async def _salvar_imagem(imagem: UploadFile | None):
    if not imagem or not imagem.filename:
        return None

    extension = Path(imagem.filename).suffix.lower()
    signature_is_valid = IMAGE_SIGNATURES.get(extension)
    if signature_is_valid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagem inválido. Use JPG, PNG ou WebP.",
        )

    max_bytes = _max_image_bytes()
    content = await imagem.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"A imagem excede o limite de {max_bytes // (1024 * 1024) or 1} MB.",
        )
    if not content or not signature_is_valid(content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O conteúdo do arquivo não corresponde a uma imagem válida.",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}{extension}"
    target = UPLOAD_DIR / filename
    target.write_bytes(content)
    return f"uploads/{filename}"


def _remover_imagem(imagem_path: str | None) -> None:
    if not imagem_path:
        return

    uploads_root = UPLOAD_DIR.resolve()
    candidate = (Path("database/static") / imagem_path).resolve()
    if candidate.parent != uploads_root:
        return
    if candidate.is_file():
        candidate.unlink()
