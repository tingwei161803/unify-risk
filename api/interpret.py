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

Everything above still applies, except that this section replaces the Section 8 template.

The page already draws two tables from the engine: every lab value with its standard, coloured status and meaning, and the "What you can change" table built from `whatIfs`. Do not repeat them, and write no tables at all. Write a short plain-English report of about 450 words or fewer. First the person's health right now, then what it means, then exactly what to do, in this order:

1. The disclaimer line: *Not a diagnosis. Not medical advice.*
2. `## Your health right now`: 4–6 short bullets in everyday words saying what is fine, what is a little high and what is too high, from the `labs` statuses and `metabolicSyndrome`. Put the meaning of anything too high in `!!…!!` and anything a little high in `^^…^^`, with the status words "High ▲" or "Borderline ▲" where they fit naturally. Call metabolic syndrome "a cluster of linked warning signs". If `previousReports` exist, one bullet says how the numbers have moved over the years.
3. `## What this means for you`: start by answering the person's `worry`, for example "You asked about dementia: …". Then one bullet per computed result, in the order given (most serious first, already sorted): what could happen and within how many years, the result's `display` quoted exactly, one plain sentence on what it means, and one plain phrase on where the formula was tested. Then one short line for results that are not applicable (with the reason) or missing (with what is missing).
4. `## What you should do`: a numbered list of 3–6 concrete actions, most important first. Each one says what to do, why (tie it to the person's own numbers) and where or how (the Taiwan services in Section 6, home blood-pressure readings, and so on). Mark urgent advice with `!!…!!`. If Section 7 gives an urgency level, the first action states it. Where a `whatIfs` entry matches an action, quote its `before` → `after` for that formula, copied exactly.
5. The disclaimer line again.

Do not write a title; the page has one.

Length is a hard limit: 450 words in all. Each bullet and each action is one or two short sentences. Answer the worry in at most three sentences. Leave out anything the tables on the page already show, and leave out the original study's own percentages unless the worry needs them.

Plain words:
- Write for someone with no medical background: short sentences and everyday words. Explain any medical word you cannot avoid once, in brackets.
- Say "higher than healthy", "a little high", "normal", "tested on people in Taiwan" or "not yet tested on people in Taiwan". Avoid "stage", "category", "band", "ranking" and "range" as jargon, and give a score such as points out of a maximum only when it is needed.
- Never use these words: C-statistic, O/E, observed/expected, calibration, calibrated, discrimination, cohort, validated (say "tested"), hypertension (say "high blood pressure"), dyslipidemia.
- Quote each `display` exactly, without quotation marks around it. Do not turn a percentage into "N in 100".
- If you use a status word, write it exactly as one of: "High ▲", "Very high ▲▲", "Borderline ▲", "Low ▼", "Normal".

Colour (the page renders these markers; never use HTML or any other markup for colour):
- `!!text!!` shows the text in bold red: anything too high, and urgent advice.
- `^^text^^` shows the text in bold amber: anything a little high.
- At most one marked phrase per sentence.

Never say the person has or does not have a disease (rule 13). Reply with the Markdown only: no preamble, no code fences.
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
