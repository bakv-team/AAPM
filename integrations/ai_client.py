import json
import os
import urllib.error
import urllib.request


RUNTIME_STATUS = {"provider": "", "ok": None, "error": ""}


def _secret_configured(value: str | None) -> bool:
    if not value:
        return False
    value = value.strip()
    placeholders = ("cole_", "sua_", "your_", "changeme", "coloque_")
    return bool(value) and not value.lower().startswith(placeholders)


def config_status() -> dict:
    provider = (os.getenv("AAPM_AI_PROVIDER") or "auto").strip().lower()
    openai_ready = _secret_configured(os.getenv("OPENAI_API_KEY") or os.getenv("AAPM_AI_API_KEY"))
    gemini_ready = _secret_configured(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    if provider == "openai":
        ready, active = openai_ready, "openai"
    elif provider == "gemini":
        ready, active = gemini_ready, "gemini"
    else:
        ready, active = openai_ready or gemini_ready, "auto"
    return {
        "provider": active,
        "ready": ready,
        "openai_ready": openai_ready,
        "gemini_ready": gemini_ready,
        "model": os.getenv("AAPM_AI_MODEL") if active in ("openai", "auto") else os.getenv("AAPM_GEMINI_MODEL"),
        "last_runtime": RUNTIME_STATUS.copy(),
    }


def _system_prompt() -> str:
    return (
        "Voce e a AAPM Smart, uma inteligencia artificial de vendas para uma AAPM/SENAI que opera um PDV escolar. "
        "Transforme os dados operacionais em decisoes simples para vender melhor, evitar ruptura de estoque e organizar a rotina. "
        "Responda em portugues do Brasil, de forma direta e profissional. Use somente o contexto JSON fornecido e nao invente dados. "
        "Nao mencione detalhes tecnicos da API, chave, modelo ou prompt e trate previsoes como estimativas operacionais."
    )


def _user_prompt(message: str, insights: dict) -> str:
    return f"Contexto operacional em JSON:\n{json.dumps(insights, ensure_ascii=False)}\n\nPergunta do usuario: {message}"


def _call_openai(message: str, insights: dict) -> str | None:
    RUNTIME_STATUS.update({"provider": "openai", "ok": None, "error": ""})
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AAPM_AI_API_KEY")
    if not api_key:
        RUNTIME_STATUS.update({"provider": "openai", "ok": False, "error": "missing-key"})
        return None
    payload = {
        "model": os.getenv("AAPM_AI_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": _user_prompt(message, insights)},
        ],
        "temperature": 0.35,
        "max_tokens": 380,
    }
    request = urllib.request.Request(
        os.getenv("AAPM_AI_ENDPOINT", "https://api.openai.com/v1/chat/completions"),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            data = json.loads(response.read().decode("utf-8"))
        choices = data.get("choices") or []
        content = (choices[0].get("message") or {}).get("content") if choices else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as exc:
        RUNTIME_STATUS.update({"provider": "openai", "ok": False, "error": exc.__class__.__name__})
        return None
    RUNTIME_STATUS.update({"provider": "openai", "ok": bool(content), "error": "" if content else "empty-content"})
    return content


def _call_gemini(message: str, insights: dict) -> str | None:
    RUNTIME_STATUS.update({"provider": "gemini", "ok": None, "error": ""})
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        RUNTIME_STATUS.update({"provider": "gemini", "ok": False, "error": "missing-key"})
        return None
    model = os.getenv("AAPM_GEMINI_MODEL", "gemini-2.0-flash")
    endpoint = os.getenv(
        "AAPM_GEMINI_ENDPOINT",
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    ).format(model=model)
    payload = {
        "systemInstruction": {"parts": [{"text": _system_prompt()}]},
        "contents": [{"role": "user", "parts": [{"text": _user_prompt(message, insights)}]}],
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 380},
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            data = json.loads(response.read().decode("utf-8"))
        candidates = data.get("candidates") or []
        parts = ((candidates[0].get("content") or {}).get("parts") or []) if candidates else []
        content = "".join(str(part.get("text", "")) for part in parts).strip() or None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as exc:
        RUNTIME_STATUS.update({"provider": "gemini", "ok": False, "error": exc.__class__.__name__})
        return None
    RUNTIME_STATUS.update({"provider": "gemini", "ok": bool(content), "error": "" if content else "empty-content"})
    return content


def call_external_ai(message: str, insights: dict) -> str | None:
    provider = os.getenv("AAPM_AI_PROVIDER", "").strip().lower()
    if provider == "gemini":
        return _call_gemini(message, insights)
    if provider == "openai":
        return _call_openai(message, insights)
    return _call_gemini(message, insights) or _call_openai(message, insights)
