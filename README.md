# unify-risk

**Your health numbers, explained by formulas you can check.**

Answer a short questionnaire, add your lab values, and see risk estimates computed with published, peer-reviewed formulas. Every number opens up to show the equation, the source paper, and which populations the formula has been validated in.

Built at the c0mpiled-18 YC Startup School Hackathon, Taipei, 2026-11-11.

> Not a diagnosis. Not medical advice. All sample people and reports are fictional.

## Run

```bash
uv run python -m http.server 8000
```

Then open <http://127.0.0.1:8000/>. Static HTML, CSS and JavaScript: no build step, no dependencies, no API key. Your answers stay in your browser.

## Contributing

Development rules are in [AGENTS.md](AGENTS.md).
