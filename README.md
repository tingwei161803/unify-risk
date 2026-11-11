# unify-risk

**Your health numbers, explained by formulas you can check.**

Answer a short questionnaire, add your lab values, and see risk estimates computed with published, peer-reviewed formulas. Every number opens up to show the equation, the source paper, and which populations the formula has been validated in.

Built at the c0mpiled-18 YC Startup School Hackathon, Taipei, 2026-11-11.

> Not a diagnosis. Not medical advice. All sample people and reports are fictional.

## Run

```bash
uv run python server.py
```

Then open <http://127.0.0.1:8000/>. Plain HTML, CSS and JavaScript with one small standard-library Python server: no build step and no packages to install. Your answers stay in your browser.

Reading a lab report calls an external API. Copy `.env.example` to `.env` and fill in the keys; without them the app falls back to demo data.

## Contributing

Development rules are in [AGENTS.md](AGENTS.md). File owners and data formats are in [docs/interfaces.md](docs/interfaces.md).
