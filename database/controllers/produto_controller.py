import os
import shutil
import uuid

from fastapi import UploadFile


UPLOAD_DIR = "database/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def _salvar_imagem(imagem: UploadFile | None):
    if not imagem or not imagem.filename:
        return None

    extensoes_permitidas = {".jpg", ".jpeg", ".png", ".webp"}
    _, ext = os.path.splitext(imagem.filename.lower())

    if ext not in extensoes_permitidas:
        return None

    nome_arquivo = f"{uuid.uuid4()}{ext}"
    caminho_completo = os.path.join(UPLOAD_DIR, nome_arquivo)

    with open(caminho_completo, "wb") as buffer:
        shutil.copyfileobj(imagem.file, buffer)

    return f"uploads/{nome_arquivo}"


def _remover_imagem(imagem_path: str | None) -> None:
    if not imagem_path:
        return

    caminho = os.path.join("database/static", imagem_path)

    if os.path.exists(caminho):
        os.remove(caminho)
