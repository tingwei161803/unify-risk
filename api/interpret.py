"""POST /api/interpret: write a plain-English report from one person's own results (issue #37).

payload: {"packet": {...}, "provider": str (optional, the header's pick)}
  packet: region, person {id, name, region, populationIds, profile, labs}, report (latest),
          previousReports (oldest first), results (docs/interfaces.md Results, with display, score
          and notes), labs (interpretLabs), metabolicSyndrome, evidence {modelId: {populationId: cell}},
          whatIfs [{formulaId, change, before, after}]
returns: {"demo": False, "markdown", "provider", "model", "seconds", "numbersChecked", "untraced"}

The system prompt is the part of docs/report-interpreter.md this page needs (the hard rules, how to
phrase each result, urgency) plus the short app-mode addendum below. Claude providers default to a
faster model for this call (APP_MODEL), unless .env names one. The model is
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

# The reading is a short narrative, so a faster model answers in a fraction of the time Opus takes
# (about 40 s down to the 10-15 s range) with the same rules and the same number check. Only used
# when .env does not already name a model for that provider (CLAUDE_MODEL, JOHNCLAUDE_MODEL).
APP_MODEL = "claude-sonnet-5-5"
# Readings prepared in advance for the sample people (tools/build_readings.py) are not waited on,
# so they use the strongest model and a fuller length.
PREPARED_MODEL = "claude-opus-5-5"
FAST_MODEL_KEYS = ("CLAUDE_MODEL", "JOHNCLAUDE_MODEL")

# The parts of the guide the Explained page needs, as (first heading, heading that ends the part).
# Skipped: inputs table, full report template, worked example, checklist and appendices. Those make
# the prompt several times longer and only matter for the full printed report.
GUIDE_PARTS = [
    ("## 1. Role and hard rules", "## 2. Inputs"),
    ("### 5.2 How to phrase a computed result", "## 6. Step 4"),
    ("## 7. Step 5", "## 8. Step 6"),
]

APP_MODE = """

---

## App mode (the "Explained" page of unify-risk)

Everything above still applies. This section sets the format of the reply.

The page already draws two tables from the engine: every lab value with its standard, coloured status and meaning, and the "What you can change" table built from `whatIfs`. Do not repeat them, and write no tables at all. Write a short plain-English report of about 250 words or fewer. First the person's health right now, then what it means, then exactly what to do, in this order:

1. The disclaimer line: *Not a diagnosis. Not medical advice.*
2. `## Your health right now`: 4 short bullets in everyday words saying what is fine, what is a little high and what is too high, from the `labs` statuses and `metabolicSyndrome`. Put the meaning of anything too high in `!!…!!` and anything a little high in `^^…^^`, with the status words "High ▲" or "Borderline ▲" where they fit naturally. Call metabolic syndrome "a cluster of linked warning signs". If `previousReports` exist, one bullet says how the numbers have moved over the years.
3. `## What this means for you`: start by answering the person's `worry`, for example "You asked about dementia: …". Then one bullet per computed result, in the order given, one line each: what could happen and within how many years, the result's `display` quoted exactly, and one plain phrase on where the formula was tested. Say once, in one plain sentence, that the risks are listed from the biggest estimate to the smallest and that their time frames differ, so the order is not about urgency; what needs attention soon comes from "Your health right now" and the lab values. Then one short line for results that are not applicable (with the reason) or missing (with what is missing).
4. `## What you should do`: a numbered list of 3–4 concrete actions, most important first. Each one says what to do, why (tie it to the person's own numbers) and where or how (home blood-pressure readings, a clinic, a service). Mark urgent advice with `!!…!!`. If Section 7 gives an urgency level, the first action states it. Where a `whatIfs` entry matches an action, quote its `before` → `after` for that formula, copied exactly.
   - Services: if `services` is present, name only those services, each with its `rule` and the person's own values from `meets`, copied exactly. A service whose `status` is `may-apply` is described as one that may apply, never as one the person qualifies for, and is followed by what is still to confirm, copied from `confirm`; do not use the Taiwan list in Section 6 then. If `services` is absent, name no programme and point to the Next steps page instead.
   - Tests: if `followUpTests` is present, name the first three of those tests, in the order given, with their `reasons`, copied exactly.
   - End the section with one line: the app's Next steps page has the details and the official sources.
5. The disclaimer line again.

Do not write a title; the page has one.

Length is a hard limit: 250 words in all. Each bullet and each action is one short sentence, two at most. Answer the worry in at most two sentences. Leave out anything the tables on the page already show, and leave out the original study's own percentages unless the worry needs them.

Plain words:
- Write for someone with no medical background: short sentences and everyday words. Explain any medical word you cannot avoid once, in brackets.
- Say "higher than healthy", "a little high", "normal", "tested on people in Taiwan" or "not yet tested on people in Taiwan". Avoid "stage", "category", "band", "ranking" and "range" as jargon, and give a score such as points out of a maximum only when it is needed.
- Never use these words: C-statistic, O/E, observed/expected, calibration, calibrated, discrimination, cohort, validated (say "tested"), hypertension (say "high blood pressure"), dyslipidemia.
- Quote each `display` exactly, without quotation marks around it. Do not turn a percentage into "N in 100".
- If you use a status word, write it exactly as one of: "High ▲", "Very high ▲▲", "Borderline ▲", "Low ▼", "Normal".

Where a formula was tested: read the `evidence` cells for the person's groups and say it in plain words, naming the group (Taiwan, men, women, 65 and over). D: built on people in this group. V: tested on people in this group, and its numbers held up. R: a version adjusted for this group exists. C: tested here only for sorting people from lower to higher risk. P: tested here, and its numbers were off. G: not yet tested on people in this group. N: does not apply to this group. Never print the letter codes, `oe`, `c` or study counts.

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
        # The model gets a slimmer copy of the packet (see _slim); the number check below still
        # runs against the full packet the page sent.
        prepared = payload.get("mode") == "prepared"
        reply = chat(json.dumps(_slim(packet), ensure_ascii=False),
                     _fast_env(env, PREPARED_MODEL if prepared else APP_MODEL),
                     system=_app_guide(guide) + (_prepared_mode(APP_MODE) if prepared else APP_MODE),
                     provider=picked)
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


def _pick(item, keys) -> dict:
    return {k: item[k] for k in keys if isinstance(item, dict) and item.get(k) not in (None, "", [], {})}


def _slim(packet: dict) -> dict:
    """The fields the narrative uses, without citations, equations, printed report items or study details.
    About half the size of the page's packet, so the model starts writing sooner."""
    def report(r):
        return _pick(r, ("date", "type", "labs"))
    slim = {
        "region": packet.get("region"),
        "person": _pick(packet.get("person") or {}, ("region", "populationIds", "profile", "labs")),
        "report": report(packet.get("report")) if packet.get("report") else None,
        "previousReports": [report(r) for r in packet.get("previousReports") or []],
        "results": [dict(_pick(r, ("modelId", "name", "outcome", "horizonYears", "kind", "derivedIn", "status",
                                   "display", "score", "missingLabels", "reason", "notes")),
                         terms=[_pick(t, ("label", "input", "contribution")) for t in r.get("terms") or []])
                    for r in packet.get("results") or []],
        "labs": [_pick(row, ("label", "value", "unit", "status", "explanation")) for row in packet.get("labs") or []],
        "metabolicSyndrome": _pick(packet.get("metabolicSyndrome") or {}, ("count", "of", "met", "items")),
        "evidence": {m: {pop: _pick(cell, ("status", "direction")) for pop, cell in (cells or {}).items()}
                     for m, cells in (packet.get("evidence") or {}).items()},
        "whatIfs": packet.get("whatIfs") or [],
        "services": [_pick(x, ("name", "rule", "status", "meets", "confirm", "how")) for x in packet.get("services") or []],
        "followUpTests": [_pick(x, ("name", "reasons", "where")) for x in packet.get("followUpTests") or []],
    }
    return {k: v for k, v in slim.items() if v not in (None, [], {})}


def _app_guide(guide: str) -> str:
    """The parts of the guide listed in GUIDE_PARTS, in order. If a heading has moved, the whole guide."""
    parts = []
    for start, end in GUIDE_PARTS:
        i = guide.find(start)
        j = guide.find(end, i + 1) if i >= 0 else -1
        if i < 0 or j < 0:
            return guide
        parts.append(guide[i:j].strip().rstrip("-").strip())
    return guide.splitlines()[0] + "\n\n" + "\n\n".join(parts)


def _fast_env(env, model: str = APP_MODEL) -> dict:
    """A copy of env where the Claude providers use `model`, unless .env already names a model."""
    fast = dict(env)
    for name in FAST_MODEL_KEYS:
        if not str(fast.get(name) or "").strip():
            fast[name] = model
    return fast


def _prepared_mode(app_mode: str) -> str:
    """App mode for readings prepared in advance: fuller, and every value off its standard named."""
    text = app_mode.replace("about 250 words or fewer", "about 450 words")
    text = text.replace("Length is a hard limit: 250 words in all.", "Length: about 450 words in all.")
    text = text.replace("Leave out anything the tables on the page already show, and leave out", "Leave out")
    return text + (
        "\n\nPrepared reading: in `## Your health right now`, name every value whose status is not "
        "normal, each with its number and its healthy line, grouped by body system (weight and waist, "
        "blood pressure, blood sugar, blood fats, kidneys, liver). In `## What you should do`, tie each "
        "action to the person's own numbers.\n"
    )


def _norm(number: str) -> str:
    """'06' -> '6', '3.20' -> '3.2', '1.0' -> '1', so the same value matches however it is printed."""
    whole, _, frac = number.partition(".")
    whole = whole.lstrip("0") or "0"
    frac = frac.rstrip("0")
    return f"{whole}.{frac}" if frac else whole


def _numbers(text: str) -> list:
    return [_norm(n) for n in _NUMBER.findall(text)]


def _trace(markdown: str, packet_json: str, guide: str) -> tuple:
    """How many numbers the report contains, and which of them appear in neither the packet nor the guide.

    This is a coarse filter, not proof: a number passes if it appears anywhere in the packet or the
    guide, so it cannot tell whether the number is attached to the right result.
    """
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
