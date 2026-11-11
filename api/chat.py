"""POST /api/chat: send a prompt to whichever model provider is configured.

Body: {"prompt": str, "system": str (optional), "attachment": base64 data URL (optional),
       "provider": provider name picked by the user (optional)}
Reply: {"text": str, "provider": str, "model": str}
"""

from api.router import chat


def handle(payload: dict, env) -> dict:
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt:
        raise ValueError("prompt is required")
    return chat(prompt, env, system=str(payload.get("system") or ""),
                attachment=str(payload.get("attachment") or ""),
                provider=str(payload.get("provider") or ""))
