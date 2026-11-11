# LLM report trial (experiment)

First live test of the report interpreter on the five fictional sample people. This branch is never merged.

- `cases/*.json`: input packets. Each holds the lab report, the questionnaire answers, the formula results (precomputed as data) and the validation cells from `js/data/evidence.js`.
- `system.md`: the interpreter guide plus a trial addendum covering output structure, wording rules and the "worry first" rule.
- `run.mjs` writes one report per case. It tries the providers in this order: `JOHNCLAUDE`, Gemini, OpenRouter Claude Opus 5.5, Groq, NVIDIA, `CLAUDE_API_KEY`. It also writes a Gemini version of each report for comparison.
- `review.mjs` sends each report to GPT 6 Astra (OpenRouter `openai/gpt-6-astra`) for a review.
- `run-config.json` switches each step on or off, so a re-run does not have to spend credits again.

The workflow runs on every push to `exp/llm-report-trial` and uploads `out/` as the `llm-report-trial` artifact. Keys come from repository secrets only.

All people are fictional. Not a diagnosis. Not medical advice.
