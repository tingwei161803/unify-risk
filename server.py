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
# Only index.html and files under these folders are served.
# Everything else (.env, server.py, api/, .git) is a 404.
PUBLIC_DIRS = ("css", "js", "assets")
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

    def is_public_file(self) -> bool:
        """Decide from the resolved file path, so encoded tricks like /js/%2e%2e/.env fail."""
        full = Path(self.translate_path(self.path)).resolve()
        if not full.is_file() or not full.is_relative_to(ROOT):
            return False
        parts = full.relative_to(ROOT).parts
        if any(part.startswith(".") for part in parts):
            return False
        return parts == ("index.html",) or parts[0] in PUBLIC_DIRS

    def is_local_request(self) -> bool:
        """Reject cross-site calls: the Host, and the Origin when sent, must be this server."""
        port = self.server.server_port
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        origin = self.headers.get("Origin")
        if self.headers.get("Host") not in hosts:
            return False
        return origin is None or origin in {f"http://{host}" for host in hosts}

    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path == "/":
            self.path = "/index.html"
        if path == "/api/health":
            return self.send_json(200, {"ok": True})
        if not self.is_public_file():
            return self.send_error(404)
        return super().do_GET()

    def do_HEAD(self):
        if self.path.split("?", 1)[0] == "/":
            self.path = "/index.html"
        if not self.is_public_file():
            return self.send_error(404)
        return super().do_HEAD()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        name = path[len("/api/"):] if path.startswith("/api/") else ""
        if not name.isidentifier() or name.startswith("_"):
            return self.send_error(404)
        if not self.is_local_request():
            return self.send_json(403, {"error": "Cross-site requests are not allowed"})
        if not (self.headers.get("Content-Type") or "").lower().startswith("application/json"):
            return self.send_json(415, {"error": "Content-Type must be application/json"})
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
