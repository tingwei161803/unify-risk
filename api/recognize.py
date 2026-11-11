"""POST /api/recognize: read a lab report and return its values.

Placeholder until the real recognition lands (issue #6). The shape of the
response is the contract in docs/interfaces.md.
"""


def handle(payload: dict, env) -> dict:
    """payload: {"filename": str, "dataUrl": str}. env: os.environ (API keys live here)."""
    return {
        "demo": True,
        "report": {
            "date": "2026-07-18",
            "source": payload.get("filename") or "sample-report",
            "labs": {
                "totalCholMgDl": 212,
                "hdlMgDl": 41,
                "fastingGlucoseMgDl": 108,
                "hba1cPct": 5.9,
            },
        },
    }
