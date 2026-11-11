"""One entry point for several model providers.

Other server modules call chat() and never talk to a provider directly. A provider is
used when its key is set in the environment; if a call fails, the next one is tried.
A busy provider (HTTP 429/500/502/503/504) or a failed connection gets one more try first.
Keys are read on the server only and are never logged or returned.

    from api.router import chat
    reply = chat("Summarise this report", env=env, attachment=data_url)
    reply["text"], reply["provider"], reply["model"]
"""

import http.client
import json
import time
import urllib.error
import urllib.request

TIMEOUT_SECONDS = 90
MAX_TOKENS = 16000

# One retry on the same provider when it is busy or unreachable. Both attempts and the
# pause share one TIMEOUT_SECONDS budget, so a retry never makes a provider slower to fail.
RETRY_STATUSES = {429, 500, 502, 503, 504}
RETRY_PAUSE_SECONDS = 1.5
RETRY_PAUSE_MAX_SECONDS = 5.0   # cap on a Retry-After header; a page is waiting
RETRY_MIN_BUDGET_SECONDS = 20   # do not retry with less time than this left

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
     "model": "gemini-3.5-flash-lite", "accepts": {"image"}},
    {"name": "groq", "key": "GROQ_API_KEY", "style": "openai",
     "url": "https://api.groq.com/openai/v1/chat/completions",
     "model": "meta-llama/llama-4-scout-17b-16e-instruct", "accepts": {"image"}},
    {"name": "nvidia", "key": "NVIDIA_API_KEY", "style": "openai",
     "url": "https://integrate.api.nvidia.com/v1/chat/completions",
     "model": "nvidia/nemotron-3.5-super-vl-120b-a12b", "accepts": {"image"}},
]


class NoProviderError(RuntimeError):
    """No provider could answer: none configured, or every call failed."""


class ProviderError(RuntimeError):
    """One HTTP call to a provider failed.

    status: the HTTP status code, or None when no response arrived (network error).
    retry_after: seconds from a numeric Retry-After header, or None.
    timed_out: the call used up its whole timeout.
    """

    def __init__(self, message: str, status=None, retry_after=None, timed_out: bool = False):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after
        self.timed_out = timed_out

    @property
    def retryable(self) -> bool:
        if self.timed_out:
            return False
        return self.status is None or self.status in RETRY_STATUSES


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


def describe(env) -> list:
    """Configured providers for the page's selector: name, model and what each can read. No keys."""
    return [{"name": p["name"], "model": _model(p, env), "accepts": sorted(p["accepts"])}
            for p in _ordered(env) if (env.get(p["key"]) or "").strip()]


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


def _retry_after(headers) -> float | None:
    """Seconds from a numeric Retry-After header; None when absent or an HTTP date."""
    try:
        seconds = float((headers.get("Retry-After") or "").strip())
    except (AttributeError, ValueError):
        return None
    return seconds if seconds >= 0 else None


def _post(url: str, headers: dict, body: dict, timeout: float = TIMEOUT_SECONDS) -> dict:
    request = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        # Some providers reject Python's default User-Agent, so send a plain one.
        headers={"Content-Type": "application/json", "User-Agent": "unify-risk/0.1", **headers},
        method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:300]
        raise ProviderError(f"HTTP {error.code}: {detail}", status=error.code,
                            retry_after=_retry_after(error.headers)) from None
    except (urllib.error.URLError, http.client.HTTPException, OSError) as error:
        # URLError wraps connection failures; a timeout or a reset while reading arrives bare.
        reason = getattr(error, "reason", None) or error
        if isinstance(reason, TimeoutError):
            raise ProviderError(f"Network error: timed out after {timeout:.0f} s", timed_out=True) from None
        raise ProviderError(f"Network error: {reason or type(error).__name__}") from None
    return json.loads(raw)


def _call_anthropic(provider, key, model, prompt, system, attachment, timeout=TIMEOUT_SECONDS) -> str:
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
    reply = _post(provider["url"], {"x-api-key": key, "anthropic-version": "2026-10-21"}, body, timeout)
    if reply.get("stop_reason") == "refusal":
        raise RuntimeError("The model declined this request")
    text = "".join(block.get("text", "") for block in reply.get("content", []) if block.get("type") == "text")
    if not text:
        raise RuntimeError(f"Empty reply (stop_reason: {reply.get('stop_reason')})")
    return text


def _call_openai(provider, key, model, prompt, system, attachment, timeout=TIMEOUT_SECONDS) -> str:
    content = prompt
    if attachment:
        media_type, data = attachment
        content = [{"type": "text", "text": prompt},
                   {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{data}"}}]
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": content}]
    reply = _post(provider["url"], {"Authorization": f"Bearer {key}"}, {"model": model, "messages": messages}, timeout)
    text = ((reply.get("choices") or [{}])[0].get("message") or {}).get("content")
    if not text:
        raise RuntimeError("Empty reply")
    return text


_CALLERS = {"anthropic": _call_anthropic, "openai": _call_openai}


def _call_with_retry(provider, key, model, prompt, system, attachment) -> str:
    """Call one provider; if it is busy or unreachable, pause and try it once more.

    Only a ProviderError with a retryable status (or no status: network error) is retried.
    A 4xx such as 400/401/403/404, a refusal, an empty reply or a full timeout is not.
    """
    call = _CALLERS[provider["style"]]
    started = time.monotonic()
    try:
        return call(provider, key, model, prompt, system, attachment)
    except ProviderError as error:
        first = error
    if not first.retryable:
        raise first
    pause = RETRY_PAUSE_SECONDS if first.retry_after is None else first.retry_after
    pause = min(pause, RETRY_PAUSE_MAX_SECONDS)
    budget = TIMEOUT_SECONDS - (time.monotonic() - started) - pause
    if budget < RETRY_MIN_BUDGET_SECONDS:
        raise first
    time.sleep(pause)
    try:
        return call(provider, key, model, prompt, system, attachment, timeout=budget)
    except Exception as second:
        note = "tried twice" if str(second) == str(first) else f"tried twice; first attempt: {str(first)[:80]}"
        raise RuntimeError(f"{second} ({note})") from None


def chat(prompt: str, env, system: str = "", attachment: str = "", provider: str = "") -> dict:
    """Ask the first working provider, or only `provider` when one is named.

    attachment: optional base64 data URL of an image or a PDF.
    provider: optional provider name picked by the user; no fallback to the others.
    Returns {"text", "provider", "model"}. Raises NoProviderError if nobody answers.
    """
    parsed = _parse_data_url(attachment) if attachment else None
    kind = _kind(parsed[0]) if parsed else None
    wanted = (provider or "").strip().lower()
    candidates = [p for p in _ordered(env) if not wanted or p["name"] == wanted]
    if wanted and not candidates:
        raise NoProviderError(f"Unknown provider: {wanted}")
    failures = []
    for provider in candidates:
        key = (env.get(provider["key"]) or "").strip()
        if not key:
            continue
        if kind and kind not in provider["accepts"]:
            failures.append(f"{provider['name']}: cannot read {kind} attachments")
            continue
        model = _model(provider, env)
        try:
            text = _call_with_retry(provider, key, model, prompt, system, parsed)
        except Exception as error:  # try the next provider; report what went wrong
            # A provider's error body should never echo the key; make sure it cannot reach a message.
            failures.append(f"{provider['name']}: {str(error).replace(key, '[key]')}")
            continue
        return {"text": text, "provider": provider["name"], "model": model}
    if not failures and wanted:
        raise NoProviderError(f"No API key is set for {wanted}.")
    if not failures:
        raise NoProviderError("No API key is set. Fill in at least one key in .env (see .env.example).")
    raise NoProviderError("Every provider failed. " + " | ".join(failures))
