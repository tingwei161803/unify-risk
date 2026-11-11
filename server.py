"""Local server for unify-risk.

Serves the static app and forwards POST /api/<name> to api/<name>.py, so API
keys stay on the server and never ship in client code. Standard library only.

Run:  uv run python server.py
"""

import importlib
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Only these paths are served. Everything else (.env, server.py, api/, .git) is a 404.
PUBLIC_PREFIXES = ("/index.html", "/css/", "/js/", "/assets/")
MAX_BODY_BYTES = 15 * 1024 * 1024


def load_env(path: Path) -> None:
    """Read KEY=VALUE lines from .env. Real environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path == "/":
            self.path = path = "/index.html"
        if path == "/api/health":
            return self.send_json(200, {"ok": True})
        if ".." in path or "/." in path or not path.startswith(PUBLIC_PREFIXES):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        name = path[len("/api/"):] if path.startswith("/api/") else ""
        if not name.isidentifier() or name.startswith("_"):
            return self.send_error(404)
        try:
            module = importlib.import_module(f"api.{name}")
        except ModuleNotFoundError:
            return self.send_error(404)
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY_BYTES:
            return self.send_json(413, {"error": "Request too large"})
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self.send_json(400, {"error": "Body must be JSON"})
        try:
            return self.send_json(200, module.handle(payload, os.environ))
        except Exception as error:  # the client falls back to demo data on any failure
            return self.send_json(502, {"error": str(error)})


if __name__ == "__main__":
    load_env(ROOT / ".env")
    port = int(os.environ.get("PORT", "8000"))
    print(f"unify-risk running at http://127.0.0.1:{port}/")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
