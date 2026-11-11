"""Check report recognition (issue #6) against the fictional sample reports.

    uv run python tools/check_recognition.py --env-file path/to/.env
    uv run python tools/check_recognition.py --env-file path/to/.env --only chen-2026-11.png

Sends every file in assets/sample-reports/ through the same code as the live endpoint
(api/recognize.py handle()), then compares each value with the data the file was printed
from: js/data/reports.js when it exists, otherwise each sample person's latest report in
js/data/personas.js. Files missing from this checkout are taken from origin/main, then from
origin/feat/5-sample-reports and origin/feat/5-personas, into a temporary folder (nothing is
checked out or committed).

The env file holds the model keys (JOHNCLAUDE, CLAUDE_API_KEY, OPENGSA_GEMINI_API_KEY). It is
read only to pass the keys to handle(); no key or file content is ever printed.
Writes a table to stdout and the full result as JSON (--out, default: a temporary folder).
Exit code 1 when an input is missing or a file could not be read at all.
"""

import argparse
import base64
import json
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api.recognize import LAB_KEYS, MEASUREMENT_KEYS, handle  # noqa: E402 - needs ROOT on sys.path

MEDIA = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
SAMPLE_REFS = ["origin/main", "origin/feat/5-sample-reports"]
DATA_REFS = ["origin/main", "origin/feat/5-personas"]


def read_env_file(path: str) -> dict:
    """KEY=VALUE lines. The values are only handed to handle(); never printed."""
    env = {}
    for line in Path(path).expanduser().read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        env[name.strip().removeprefix("export ").strip()] = value.strip().strip("\"'")
    return env


def git(*args, **kwargs):
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, check=False, **kwargs)


def materialize(path: str, refs: list, tmp: Path, probe: str = "", needle: str = "") -> tuple:
    """A folder that contains `path`: this checkout if it qualifies, else the first ref that does.
    A source qualifies when `probe` (default: `path`) exists there and, if given, contains `needle`."""
    probe = probe or path
    local = ROOT / probe
    if local.exists() and (not needle or (local.is_file() and needle in local.read_text(encoding="utf-8"))):
        return ROOT, "this checkout"
    for ref in refs:
        git("fetch", "--quiet", "origin", ref.removeprefix("origin/"))
        shown = git("show", f"{ref}:{probe}") if needle else git("cat-file", "-e", f"{ref}:{probe}")
        if shown.returncode != 0 or (needle and needle.encode() not in shown.stdout):
            continue
        dest = tmp / ref.replace("/", "_")
        dest.mkdir(parents=True, exist_ok=True)
        archive = git("archive", ref, path)
        subprocess.run(["tar", "-x", "-C", str(dest)], input=archive.stdout, check=True)
        return dest, ref
    return None, ""


def load_data(base: Path) -> dict:
    script = (
        "const { pathToFileURL } = await import('node:url');"
        "const dir = process.argv[1]; const out = { reports: null, personas: [] };"
        "try { out.reports = (await import(pathToFileURL(dir + '/reports.js'))).REPORTS; } catch {}"
        "try { out.personas = (await import(pathToFileURL(dir + '/personas.js'))).PERSONAS; } catch {}"
        "process.stdout.write(JSON.stringify(out));"
    )
    done = subprocess.run(["node", "--input-type=module", "-e", script, str(base / "js" / "data")],
                          capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise SystemExit(f"Could not read js/data with Node: {done.stderr.strip()[:300]}")
    return json.loads(done.stdout)


def flag_for(value, printed_range, key) -> str:
    """'H' above the printed range, 'L' below it, '' inside; None when the range cannot be read."""
    if not isinstance(value, (int, float)) or not printed_range:
        return None
    text = re.sub(r"^[a-zA-Z ]+", "", str(printed_range)).strip()
    pair = re.match(r"^([<≤>≥]?)\s*([\d.]+)\s*/\s*([\d.]+)$", text)
    if pair:
        text = pair.group(1) + (pair.group(3) if key == "dbp" else pair.group(2))
    between = re.match(r"^([\d.]+)\s*[–-]\s*([\d.]+)$", text)
    if between:
        low, high = float(between.group(1)), float(between.group(2))
        return "L" if value < low else "H" if value > high else ""
    match = re.match(r"^([<≤>≥])\s*([\d.]+)$", text)
    if not match:
        return None
    sign, limit = match.group(1), float(match.group(2))
    return {"<": "H" if value >= limit else "", "≤": "H" if value > limit else "",
            ">": "L" if value <= limit else "", "≥": "L" if value < limit else ""}[sign]


def truth_for(file: Path, data: dict):
    for report in data.get("reports") or []:
        if Path(str(report.get("file") or "")).name == file.name or report.get("id") == file.stem:
            return {"date": report.get("date", ""), "items": report.get("items", []), "from": "js/data/reports.js"}
    person = next((p for p in data.get("personas") or [] if p.get("id") == file.stem.split("-")[0] and p.get("report")), None)
    if not person:
        return None
    ranges = person["report"].get("printedRanges", {})
    items = []
    for table, values in ((MEASUREMENT_KEYS, person.get("profile", {})), (LAB_KEYS, person.get("labs", {}))):
        for key in table:
            if isinstance(values.get(key), (int, float)):
                items.append({"key": key, "value": values[key], "range": ranges.get(key, ""),
                              "flag": flag_for(values[key], ranges.get(key), key)})
    return {"date": person["report"].get("date", ""), "items": items, "from": "js/data/personas.js"}


def norm(text) -> str:
    out = str(text if text is not None else "").lower()
    for a, b in (("µ", "u"), ("μ", "u"), ("³", "3"), ("²", "2"), ("–", "-"), ("—", "-"), (" ", "")):
        out = out.replace(a, b)
    return out


def same(expected, got) -> bool:
    try:
        return abs(float(expected) - float(got)) < 1e-9
    except (TypeError, ValueError):
        return norm(expected) == norm(got)


def compare(truth: dict, result: dict) -> dict:
    got_items = {}
    for item in result.get("items", []):
        got_items.setdefault(item["key"], item)
    saved = {**result.get("measurements", {}), **result["report"].get("labs", {})}
    rows = []
    for item in truth["items"]:
        got = got_items.get(item["key"])
        rows.append({
            "key": item["key"], "expected": item.get("value"), "got": got.get("value") if got else None,
            "value": bool(got) and same(item.get("value"), got.get("value")),
            "saved": item["key"] in saved and same(item.get("value"), saved[item["key"]]),
            "range": bool(got) and norm(item.get("range")) == norm(got.get("range")),
            "flag": None if item.get("flag") is None else bool(got) and (got.get("flag") or "") == item["flag"],
            "confidence": got.get("confidence") if got else None,
        })
    flags = [r["flag"] for r in rows if r["flag"] is not None]
    return {
        "dateOk": truth["date"] == result["report"].get("date"), "dateGot": result["report"].get("date"),
        "fields": len(rows), "values": sum(r["value"] for r in rows), "saved": sum(r["saved"] for r in rows),
        "ranges": sum(r["range"] for r in rows), "flags": sum(flags), "flagFields": len(flags),
        "missing": [r["key"] for r in rows if r["got"] is None],
        "wrong": [f"{r['key']} {r['expected']}→{r['got']}" for r in rows if r["got"] is not None and not r["value"]],
        "extra": [i["key"] if i["key"] != "other" else i["label"] for i in result.get("items", [])
                  if i["key"] not in {r["key"] for r in rows}],
        "rows": rows,
    }


def run_one(file: Path, env: dict, data: dict) -> dict:
    payload = {"filename": file.name,
               "dataUrl": f"data:{MEDIA[file.suffix.lower()]};base64,{base64.b64encode(file.read_bytes()).decode('ascii')}"}
    started = time.monotonic()
    try:
        result = handle(payload, env)
    except Exception as error:  # report and move on; the message never contains a key
        return {"file": file.name, "error": str(error)[:300], "seconds": round(time.monotonic() - started, 1)}
    truth = truth_for(file, data)
    return {"file": file.name, "seconds": round(time.monotonic() - started, 1), "provider": result.get("provider"),
            "model": result.get("model"), "truthFrom": truth["from"] if truth else None,
            "comparison": compare(truth, result) if truth else None, "result": result}


def table(results: list) -> str:
    lines = ["| File | Model | Date | Values right | Saved right | Ranges right | Flags right | Missing | Wrong | Extra | s |",
             "|---|---|---|---:|---:|---:|---:|---|---|---|---:|"]
    for r in results:
        if "error" in r:
            lines.append(f"| {r['file']} | | | read failed: {r['error']} | | | | | | | {r['seconds']} |")
            continue
        c = r["comparison"]
        if not c:
            lines.append(f"| {r['file']} | {r['model']} | {r['result']['report']['date'] or '—'} | no answer key | | | | | | "
                         f"{len(r['result']['items'])} items | {r['seconds']} |")
            continue
        lines.append(
            f"| {r['file']} | {r['provider']} {r['model']} | {'✓' if c['dateOk'] else '✗ ' + str(c['dateGot'])} "
            f"| {c['values']}/{c['fields']} | {c['saved']}/{c['fields']} | {c['ranges']}/{c['fields']} "
            f"| {c['flags']}/{c['flagFields']} | {', '.join(c['missing']) or '—'} | {'; '.join(c['wrong']) or '—'} "
            f"| {', '.join(c['extra']) or '—'} | {r['seconds']} |")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--env-file", required=True, help="file with JOHNCLAUDE / CLAUDE_API_KEY / OPENGSA_GEMINI_API_KEY")
    parser.add_argument("--only", action="append", default=[], help="check only this file name (repeatable)")
    parser.add_argument("--out", default="", help="folder for recognition-check.json (default: a temporary folder)")
    parser.add_argument("--workers", type=int, default=3)
    args = parser.parse_args()

    env = read_env_file(args.env_file)
    if not any(env.get(k) for k in ("JOHNCLAUDE", "CLAUDE_API_KEY", "OPENGSA_GEMINI_API_KEY")):
        print("The env file sets none of JOHNCLAUDE, CLAUDE_API_KEY, OPENGSA_GEMINI_API_KEY.", file=sys.stderr)
        return 1
    tmp = Path(tempfile.mkdtemp(prefix="recognition-check-"))
    samples_base, samples_from = materialize("assets/sample-reports", SAMPLE_REFS, tmp)
    # Answer key: js/data/reports.js when it exists, else personas.js with each person's printed report.
    data_base, data_from = materialize("js/data", DATA_REFS, tmp, probe="js/data/reports.js")
    if not data_base:
        data_base, data_from = materialize("js/data", DATA_REFS, tmp, probe="js/data/personas.js", needle="printedRanges")
    if not samples_base or not data_base:
        print("Could not find assets/sample-reports or js/data on this checkout or origin.", file=sys.stderr)
        return 1
    files = sorted(p for p in (samples_base / "assets" / "sample-reports").iterdir() if p.suffix.lower() in MEDIA)
    if args.only:
        files = [p for p in files if p.name in args.only]
    data = load_data(data_base)
    print(f"{len(files)} sample files from {samples_from}; answer key from {data_from} "
          f"({'reports.js' if data.get('reports') else 'personas.js'}).", flush=True)

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        results = list(pool.map(lambda f: run_one(f, env, data), files))

    out = Path(args.out) if args.out else tmp
    out.mkdir(parents=True, exist_ok=True)
    (out / "recognition-check.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(table(results))
    rows = [row for r in results if r.get("comparison") for row in r["comparison"]["rows"]]
    if rows:
        print(f"\nAll files: {sum(r['value'] for r in rows)}/{len(rows)} values right, "
              f"{sum(r['saved'] for r in rows)}/{len(rows)} saved right.")
    print(f"Full result: {out / 'recognition-check.json'}")
    return 1 if any("error" in r for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
