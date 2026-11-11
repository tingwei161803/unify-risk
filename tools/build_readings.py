"""Model step of tools/build-readings.mjs: one /api/interpret call per prepared packet.

    uv run --no-project python tools/build_readings.py <packets.json> <readings.json>

Keys are loaded from .env exactly as server.py loads them and are never printed. At most three
calls run at the same time.
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api.interpret import handle  # noqa: E402 - needs ROOT on sys.path
from server import load_env  # noqa: E402


def one(item: dict) -> tuple:
    started = time.time()
    try:
        reply = handle({"packet": item["packet"]}, os.environ)
        keep = {k: reply.get(k) for k in ("markdown", "model", "provider", "numbersChecked", "untraced")}
        keep["seconds"] = round(time.time() - started, 1)
        return item["id"], keep
    except Exception as error:  # the handler's message is a short reason without keys
        return item["id"], {"error": str(error)[:200], "seconds": round(time.time() - started, 1)}


def main() -> None:
    source, target = Path(sys.argv[1]), Path(sys.argv[2])
    load_env(ROOT / ".env")
    items = json.loads(source.read_text(encoding="utf-8"))
    with ThreadPoolExecutor(max_workers=3) as pool:
        replies = dict(pool.map(one, items))
    target.write_text(json.dumps(replies), encoding="utf-8")


if __name__ == "__main__":
    main()
