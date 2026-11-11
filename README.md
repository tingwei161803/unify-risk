# unify-risk

**Your health numbers, explained by formulas you can check.**

Answer a short questionnaire, add your lab values, and see risk estimates computed with published, peer-reviewed formulas. Every number opens up to show the equation, the source paper, and which populations the formula has been validated in.

Built at the c0mpiled-18 YC Startup School Hackathon, Taipei, 2026-11-11.

> Not a diagnosis. Not medical advice. All sample people and reports are fictional.

## Run

1. Create your `.env` and fill in at least one API token:

   ```bash
   cp .env.example .env
   ```

   Open `.env` and paste a token after the `=` for any provider you have: `CLAUDE_API_KEY`, `JOHNCLAUDE`, `OPENROUTER_API_KEY`, `OPENGSA_GEMINI_API_KEY`, `GROQ_API_KEY` or `NVIDIA_API_KEY`. One is enough. `.env` is git-ignored; never commit it.

2. Start the server:

   ```bash
   uv run python server.py
   ```

3. Open <http://127.0.0.1:8000/> and sign in with `testuser1`.

To check that a token was picked up, open <http://127.0.0.1:8000/api/health>: it lists the configured providers by name. Without any token the app still runs and reading a lab report falls back to demo data.

Plain HTML, CSS and JavaScript with one small standard-library Python server: no build step and no packages to install. Your answers stay in your browser.

## Contributing

Development rules are in [AGENTS.md](AGENTS.md). File owners and data formats are in [docs/interfaces.md](docs/interfaces.md).
