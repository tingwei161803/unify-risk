"""POST /api/interpret: write a plain-English report from one person's own results (issue #37).

payload: {"packet": {...}, "provider": str (optional, the header's pick)}
  packet: region, person {id, name, region, populationIds, profile, labs}, report (latest),
          previousReports (oldest first), results (docs/interfaces.md Results, with display, score
          and notes), labs (interpretLabs), metabolicSyndrome, evidence {modelId: {populationId: cell}},
          whatIfs [{formulaId, change, before, after}]
returns: {"demo": False, "markdown", "provider", "model", "seconds", "numbersChecked", "untraced"}

The system prompt is docs/report-interpreter.md plus the short app-mode addendum below. The model is
reached through api/router.py: a provider picked in the header is used alone; otherwise the router
tries the configured providers in order. Every number in the reply is checked against the packet and
the guide; numbers found in neither come back in `untraced` so the page can flag them.
Raises on any failure, so the page shows that the written report is unavailable and keeps working.
No key and no raw provider error body ever reaches the response.
"""

import json
import re
import time
from pathlib import Path

from api.router import NoProviderError, chat

GUIDE_PATH = Path(__file__).resolve().parent.parent / "docs" / "report-interpreter.md"
MAX_PACKET_CHARS = 200_000
SMALL_COUNTS = {str(n) for n in range(11)}  # "4 of the 5 criteria", "3 tests" and the like

APP_MODE = """

---

## App mode (the "Explained" page of unify-risk)

Everything above still applies. In addition:

- Keep it short: at most about 600 words outside the tables. Follow the Section 8 template, but leave out any sentence that only repeats a table.
- The `results` array is already ordered most serious first. Keep that order in the risk table.
- Quote each result's `display` exactly as given. If a result with status `ok` has no `display`, say its estimate is not available in this report.
- Write "What you can change" only from `whatIfs`: for each entry give its `change` and the `before` → `after` it lists for that formula, copied exactly. If `whatIfs` is empty or missing, say that none of the changes these formulas respond to applies right now, and give no numbers.
- In "How these numbers were made", give one line per computed formula: its source and the terms or points copied from `terms`.
- Never say the person has or does not have a disease (rule 13).
- The report opens and closes with the disclaimer: *Not a diagnosis. Not medical advice.*
- Reply with the Markdown report only: no preamble and no code fences.
"""

_NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?")


def handle(payload: dict, env) -> dict:
    packet = payload.get("packet")
    if not isinstance(packet, dict):
        raise ValueError("The request needs a packet object.")
    if not isinstance(packet.get("person"), dict):
        raise ValueError("The packet needs a person.")
    if not isinstance(packet.get("results"), list) or not packet["results"]:
        raise ValueError("The packet needs at least one result.")
    prompt = json.dumps(packet, ensure_ascii=False)
    if len(prompt) > MAX_PACKET_CHARS:
        raise ValueError("The packet is too large.")

    guide = GUIDE_PATH.read_text(encoding="utf-8")
    picked = str(payload.get("provider") or "").strip().lower()
    started = time.monotonic()
    try:
        # A named provider is used alone; with none named the router tries them in order.
        reply = chat(prompt, env, system=guide + APP_MODE, provider=picked)
    except NoProviderError as error:
        raise RuntimeError("The written report is unavailable right now: " + _short(error) + ".") from None

    markdown = _strip_fences(reply["text"])
    if not markdown:
        raise RuntimeError("The written report is unavailable right now: the model returned no text.")
    checked, untraced = _trace(markdown, prompt, guide)
    return {
        "demo": False,
        "markdown": markdown,
        "provider": reply.get("provider", ""),
        "model": reply.get("model", ""),
        "seconds": round(time.monotonic() - started, 1),
        "numbersChecked": checked,
        "untraced": untraced,
    }


def _norm(number: str) -> str:
    """'06' -> '6', '3.20' -> '3.2', '1.0' -> '1', so the same value matches however it is printed."""
    whole, _, frac = number.partition(".")
    whole = whole.lstrip("0") or "0"
    frac = frac.rstrip("0")
    return f"{whole}.{frac}" if frac else whole


def _numbers(text: str) -> list:
    return [_norm(n) for n in _NUMBER.findall(text)]


def _trace(markdown: str, packet_json: str, guide: str) -> tuple:
    """How many numbers the report contains, and which of them appear in neither the packet nor the guide."""
    known = set(_numbers(packet_json)) | set(_numbers(guide)) | SMALL_COUNTS
    found = _numbers(markdown)
    untraced = sorted({n for n in found if n not in known}, key=float)
    return len(found), untraced


def _strip_fences(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _short(error: Exception) -> str:
    """Status codes and short reasons only; provider error bodies never reach the page."""
    text = str(error)
    if "No API key is set" in text:
        return "no model key is set on the server"
    if "Unknown provider" in text:
        return "unknown provider"
    codes = re.findall(r"HTTP (\d{3})", text)
    if codes:
        return "the model service answered HTTP " + ", ".join(dict.fromkeys(codes))
    if "Network error" in text:
        return "network error"
    if "timed out" in text.lower():
        return "the model took too long"
    return "the model call failed"
