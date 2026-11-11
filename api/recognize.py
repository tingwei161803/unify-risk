"""POST /api/recognize: read a lab report (image or PDF) and return the values printed on it.

Issue #6. Contract (docs/interfaces.md):

    payload: {"filename": str, "dataUrl": "data:<type>;base64,<data>"}
    returns: {"demo": False,
              "report": {"date": "YYYY-MM-DD" or "", "source": <filename>, "labs": {<Person.labs keys>}},
              "measurements": {heightCm, weightKg, waistCm, sbp, dbp}   # only those printed
              "items": [{key, label, value, unit, range, flag, confidence}],  # every printed result
              "lab": <clinic name>, "provider": ..., "model": ...}

The model is reached through api/router.py, one key at a time in this order: JOHNCLAUDE,
then CLAUDE_API_KEY (both read images and PDFs), then OPENGSA_GEMINI_API_KEY (images only).
If no key is set or every call fails, handle() raises; the page then shows a fictional
sample report with a "demo data" note. Values here always come from the model, so
"demo" is always False when handle() returns.
"""

import json
import re

from api.router import NoProviderError, chat

ATTEMPTS = (("johnclaude", "JOHNCLAUDE"), ("claude", "CLAUDE_API_KEY"), ("gemini", "OPENGSA_GEMINI_API_KEY"))
MEDIA_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # the server caps the whole request at 15 MB

# Keys the app stores. Labs go to Person.labs; measurements belong to Person.profile.
LAB_KEYS = {
    "totalCholMgDl": ("Total cholesterol", "mg/dL"),
    "hdlMgDl": ("HDL cholesterol", "mg/dL"),
    "ldlMgDl": ("LDL cholesterol", "mg/dL"),
    "tgMgDl": ("Triglycerides", "mg/dL"),
    "fastingGlucoseMgDl": ("Fasting glucose (fasting blood sugar)", "mg/dL"),
    "hba1cPct": ("HbA1c (glycated haemoglobin)", "%"),
    "creatinineMgDl": ("Creatinine", "mg/dL"),
    "egfrMlMin": ("eGFR (estimated glomerular filtration rate)", "mL/min/1.73m²"),
    "uacrMgG": ("Urine albumin-to-creatinine ratio (UACR)", "mg/g"),
    "astUL": ("AST (GOT)", "U/L"),
    "altUL": ("ALT (GPT)", "U/L"),
    "plateletsK": ("Platelets (PLT)", "10³/µL"),
}
MEASUREMENT_KEYS = {
    "heightCm": ("Height", "cm"),
    "weightKg": ("Weight", "kg"),
    "waistCm": ("Waist circumference", "cm"),
    "sbp": ("Systolic blood pressure (the first number)", "mmHg"),
    "dbp": ("Diastolic blood pressure (the second number)", "mmHg"),
}
OTHER_KEYS = {"bmi": ("Body-mass index (BMI)", "kg/m²")}  # read and shown, not stored (the app computes BMI)
ALL_KEYS = {**MEASUREMENT_KEYS, **OTHER_KEYS, **LAB_KEYS}

SYSTEM = (
    "You copy the values printed on one lab report or health check-up report into JSON. "
    "Copy only: do not interpret, judge or add advice.\n\n"
    "Item keys (use the key that names the same test; the unit after it is what the app expects):\n"
    + "\n".join(f"- {key}: {label}, {unit}" for key, (label, unit) in ALL_KEYS.items())
    + "\n- other: any other test printed on the report (put its printed name in label)\n\n"
    "Rules:\n"
    "1. One item per printed result. Blood pressure printed as 146/92 is two items, sbp 146 and dbp 92, "
    "both mmHg. A range printed once for both (for example <130/85) is copied to both items as printed.\n"
    "2. value, unit and range are copied exactly as printed (keep '<' and '>' signs; keep the printed unit "
    "even when it differs from the expected unit). Use '' when no range is printed.\n"
    "3. flag is 'H' or 'L' only when the report itself marks the result high or low "
    "(H, L, an arrow, an asterisk or a colour); otherwise ''.\n"
    "4. label is the test name as printed.\n"
    "5. date is the report or collection date as YYYY-MM-DD, or '' if none is printed. "
    "lab is the clinic or laboratory name as printed, or ''.\n"
    "6. confidence is 'high' when the digits and the test are clearly legible, 'medium' when you read "
    "through blur, glare, a tilt or an unusual layout, and 'low' when you are unsure of a digit or of "
    "which test a number belongs to.\n"
    "7. Never invent or calculate a value that is not printed.\n"
    "8. Never copy names, ID numbers, dates of birth, addresses or phone numbers into any field.\n"
    "9. If the file is not a lab or check-up report, return an empty items list.\n\n"
    "Answer with one JSON object and nothing else, in exactly this shape:\n"
    '{"date": "YYYY-MM-DD", "lab": "...", "items": [{"key": "...", "label": "...", "value": "...", '
    '"unit": "...", "range": "...", "flag": "H|L|", "confidence": "high|medium|low"}]}'
)
PROMPT = "Copy every result printed on this report into the JSON object described in the instructions."


def handle(payload: dict, env) -> dict:
    filename = str(payload.get("filename") or "").strip()[:160] or "uploaded report"
    data_url = str(payload.get("dataUrl") or "")
    media_type = _check_file(data_url)

    failures = []
    for name, key_name in ATTEMPTS:
        key = (env.get(key_name) or "").strip()
        if not key:
            continue
        if name == "gemini" and media_type == "application/pdf":
            failures.append("gemini cannot read PDFs")
            continue
        # The router tries every provider whose key it can see, so give it exactly one.
        one = {key_name: key, "LLM_PROVIDER_ORDER": name}
        model = (env.get(f"{name.upper()}_MODEL") or "").strip()
        if model:
            one[f"{name.upper()}_MODEL"] = model
        try:
            reply = chat(PROMPT, one, system=SYSTEM, attachment=data_url)
        except NoProviderError as error:
            failures.append(f"{name}: {_short(error)}")
            continue
        try:
            parsed = _parse_json(reply["text"])
        except ValueError:
            failures.append(f"{name}: the answer was not valid JSON")
            continue
        return _result(parsed, filename, reply)

    if not failures:
        raise RuntimeError("Live reading is off: no model key is set on the server (JOHNCLAUDE, CLAUDE_API_KEY "
                           "or OPENGSA_GEMINI_API_KEY in .env).")
    raise RuntimeError("Live reading failed: " + "; ".join(failures) + ".")


def _check_file(data_url: str) -> str:
    match = re.match(r"^data:([\w.+/-]+);base64,", data_url)
    if not match:
        raise ValueError("The upload must be a base64 data URL.")
    media_type = match.group(1).lower().replace("image/jpg", "image/jpeg")
    if media_type not in MEDIA_TYPES:
        raise ValueError("Please upload a PDF, PNG, JPEG or WebP file.")
    if (len(data_url) - match.end()) * 3 // 4 > MAX_FILE_BYTES:
        raise ValueError("The file is larger than 10 MB.")
    return media_type


def _short(error: Exception) -> str:
    """Status codes only; provider error bodies are never passed to the page."""
    codes = re.findall(r"HTTP (\d{3})", str(error))
    if codes:
        return "HTTP " + ", ".join(dict.fromkeys(codes))
    if "Network error" in str(error):
        return "network error"
    if "declined" in str(error):
        return "the model declined"
    return "call failed"


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object")
    parsed = json.loads(text[start:end + 1])
    if not isinstance(parsed, dict) or not isinstance(parsed.get("items"), list):
        raise ValueError("unexpected shape")
    return parsed


def _number(printed: str):
    """'238' -> 238, '1.00' -> 1.0; anything else ('<5', 'negative') stays text."""
    text = printed.strip().replace(",", "")
    if re.fullmatch(r"[+-]?\d+(?:\.\d+)?", text):
        value = float(text)
        return int(value) if "." not in text else value
    return printed.strip()


def _result(parsed: dict, filename: str, reply: dict) -> dict:
    items = []
    for raw in parsed["items"]:
        if not isinstance(raw, dict):
            continue
        key = str(raw.get("key") or "other")
        if key not in ALL_KEYS:
            key = "other"
        printed = str(raw.get("value") or "").strip()
        if not printed:
            continue
        flag = str(raw.get("flag") or "").upper()
        confidence = str(raw.get("confidence") or "").lower()
        items.append({
            "key": key,
            "label": str(raw.get("label") or "").strip()[:80] or (ALL_KEYS[key][0] if key in ALL_KEYS else "Other"),
            "value": _number(printed),
            "unit": str(raw.get("unit") or "").strip()[:30],
            "range": str(raw.get("range") or "").strip()[:40],
            "flag": flag if flag in ("H", "L") else "",
            "confidence": confidence if confidence in ("high", "medium", "low") else "low",
        })
    date = str(parsed.get("date") or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        date = ""
    numeric = {it["key"]: it["value"] for it in items if isinstance(it["value"], (int, float))}
    return {
        "demo": False,
        "report": {"date": date, "source": filename, "labs": {k: v for k, v in numeric.items() if k in LAB_KEYS}},
        "measurements": {k: v for k, v in numeric.items() if k in MEASUREMENT_KEYS},
        "items": items,
        "lab": str(parsed.get("lab") or "").strip()[:120],
        "provider": reply.get("provider", ""),
        "model": reply.get("model", ""),
    }
