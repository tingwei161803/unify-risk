"""One entry point for several model providers.

Other server modules call chat() and never talk to a provider directly. A provider is
used when its key is set in the environment; if a call fails, the next one is tried.
Keys are read on the server only and are never logged or returned.

    from api.router import chat
    reply = chat("Summarise this report", env=env, attachment=data_url)
    reply["text"], reply["provider"], reply["model"]
"""

import json
import urllib.error
import urllib.request

TIMEOUT_SECONDS = 90
MAX_TOKENS = 16000

# Tried in this order unless LLM_PROVIDER_ORDER says otherwise (comma-separated names).
# `accepts` lists the attachment kinds a provider's default model can read.
# Every model can be overridden with <NAME>_MODEL in .env, e.g. GROQ_MODEL=...
PROVIDERS = [
    {"name": "claude", "key": "CLAUDE_API_KEY", "style": "anthropic",
     "url": "https://api.anthropic.com/v1/messages",
     "model": "claude-opus-5-5", "accepts": {"image", "pdf"}},
    {"name": "johnclaude", "key": "JOHNCLAUDE", "style": "anthropic",
     "url": "https://api.anthropic.com/v1/messages",
     "model": "claude-opus-5-5", "accepts": {"image", "pdf"}},
    {"name": "openrouter", "key": "OPENROUTER_API_KEY", "style": "openai",
     "url": "https://openrouter.ai/api/v1/chat/completions",
     "model": "anthropic/claude-opus-5.5", "accepts": {"image"}},
    {"name": "gemini", "key": "OPENGSA_GEMINI_API_KEY", "style": "openai",
     "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
     "model": "gemini-2.5-flash", "accepts": {"image"}},
    {"name": "groq", "key": "GROQ_API_KEY", "style": "openai",
     "url": "https://api.groq.com/openai/v1/chat/completions",
     "model": "meta-llama/llama-4-scout-17b-16e-instruct", "accepts": {"image"}},
    {"name": "nvidia", "key": "NVIDIA_API_KEY", "style": "openai",
     "url": "https://integrate.api.nvidia.com/v1/chat/completions",
     "model": "meta/llama-3.2-90b-vision-instruct", "accepts": {"image"}},
]


class NoProviderError(RuntimeError):
    """No provider could answer: none configured, or every call failed."""


def _ordered(env) -> list:
    order = [n.strip().lower() for n in (env.get("LLM_PROVIDER_ORDER") or "").split(",") if n.strip()]
    if not order:
        return PROVIDERS
    by_name = {p["name"]: p for p in PROVIDERS}
    chosen = [by_name[n] for n in order if n in by_name]
    return chosen + [p for p in PROVIDERS if p not in chosen]


def configured(env) -> list:
    """Names of the providers whose key is set. Never returns key values."""
    return [p["name"] for p in _ordered(env) if (env.get(p["key"]) or "").strip()]


def _model(provider: dict, env) -> str:
    return (env.get(f"{provider['name'].upper()}_MODEL") or "").strip() or provider["model"]


def _parse_data_url(data_url: str) -> tuple:
    """'data:image/png;base64,AAAA' -> ('image/png', 'AAAA')."""
    if not data_url.startswith("data:") or ";base64," not in data_url:
        raise ValueError("Attachment must be a base64 data URL")
    header, data = data_url.split(",", 1)
    return header[len("data:"):].split(";", 1)[0], "".join(data.split())


def _kind(media_type: str) -> str:
    if media_type == "application/pdf":
        return "pdf"
    if media_type.startswith("image/"):
        return "image"
    raise ValueError(f"Unsupported attachment type: {media_type}")


def _post(url: str, headers: dict, body: dict) -> dict:
    request = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"HTTP {error.code}: {detail}") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"Network error: {error.reason}") from None


def _call_anthropic(provider, key, model, prompt, system, attachment) -> str:
    content = []
    if attachment:
        media_type, data = attachment
        block_type = "document" if _kind(media_type) == "pdf" else "image"
        content.append({"type": block_type,
                        "source": {"type": "base64", "media_type": media_type, "data": data}})
    content.append({"type": "text", "text": prompt})
    body = {"model": model, "max_tokens": MAX_TOKENS, "messages": [{"role": "user", "content": content}]}
    if system:
        body["system"] = system
    reply = _post(provider["url"], {"x-api-key": key, "anthropic-version": "2026-10-21"}, body)
    if reply.get("stop_reason") == "refusal":
        raise RuntimeError("The model declined this request")
    text = "".join(block.get("text", "") for block in reply.get("content", []) if block.get("type") == "text")
    if not text:
        raise RuntimeError(f"Empty reply (stop_reason: {reply.get('stop_reason')})")
    return text


def _call_openai(provider, key, model, prompt, system, attachment) -> str:
    content = prompt
    if attachment:
        media_type, data = attachment
        content = [{"type": "text", "text": prompt},
                   {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{data}"}}]
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": content}]
    reply = _post(provider["url"], {"Authorization": f"Bearer {key}"}, {"model": model, "messages": messages})
    text = ((reply.get("choices") or [{}])[0].get("message") or {}).get("content")
    if not text:
        raise RuntimeError("Empty reply")
    return text


_CALLERS = {"anthropic": _call_anthropic, "openai": _call_openai}


def chat(prompt: str, env, system: str = "", attachment: str = "") -> dict:
    """Ask the first working provider.

    attachment: optional base64 data URL of an image or a PDF.
    Returns {"text", "provider", "model"}. Raises NoProviderError if nobody answers.
    """
    parsed = _parse_data_url(attachment) if attachment else None
    kind = _kind(parsed[0]) if parsed else None
    failures = []
    for provider in _ordered(env):
        key = (env.get(provider["key"]) or "").strip()
        if not key:
            continue
        if kind and kind not in provider["accepts"]:
            failures.append(f"{provider['name']}: cannot read {kind} attachments")
            continue
        model = _model(provider, env)
        try:
            text = _CALLERS[provider["style"]](provider, key, model, prompt, system, parsed)
        except Exception as error:  # try the next provider; report what went wrong
            failures.append(f"{provider['name']}: {error}")
            continue
        return {"text": text, "provider": provider["name"], "model": model}
    if not failures:
        raise NoProviderError("No API key is set. Fill in at least one key in .env (see .env.example).")
    raise NoProviderError("Every provider failed. " + " | ".join(failures))
