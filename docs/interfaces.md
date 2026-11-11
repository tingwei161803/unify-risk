# Interfaces

> What modules pass to each other. **Announce any format change in the group chat first**, and tell everyone who uses it.
> Placeholder files return fake data in these shapes, so every page can be built before the real pieces land.
> For the big picture with diagrams, see [architecture.md](architecture.md).

## Files and owners

```text
index.html             Peter    the only HTML file; loads js/app.js
server.py              Peter    serves the app and forwards /api/*
api/router.py          Peter    chat(): one entry point for every model provider (#18)
api/chat.py            Peter    POST /api/chat
js/app.js              Peter    router: maps the hash to a view
js/store.js            Peter    reads and writes localStorage
js/api.js              Peter    callApi(name, payload)
js/auth.js             Peter    demo sign-in (#3)
js/views/home.js       Peter
js/views/login.js      Peter
js/views/plan.js       Peter    next steps: follow-up tests and services (#39)
js/data/services.js    Peter    the written rules behind the next steps page
css/app.css            Robert   shared styles (Peter wrote the first version)
js/views/inputs.js     Robert   questionnaire
js/views/results.js    Robert   one card per formula, with the equation drawer
js/views/results-whatif.js  Robert   what-if cards on the results page
js/views/results-labs.js    Robert   lab readings on the results page
js/views/evidence.js   Robert   validation matrix and check table
api/recognize.py       Matt     report recognition (#6)
js/views/report.js     Matt     upload, confirm field by field
api/interpret.py       Andrew   POST /api/interpret: the written reading (#37)
js/views/explain.js    Andrew   the Explained page (#37)
js/data/evidence.js    Matt     generated; do not edit by hand
js/engine/**           Matt and Andrew   formulas and lab standards (#9); pages import run.js only
js/data/personas.js    Andrew   fictional sample people (#5)
js/data/reports.js     Andrew   fictional dated lab reports (#5)
assets/sample-reports/ Andrew   fictional report files
```

## Routes

| Hash | View file | Content |
| --- | --- | --- |
| `#/` | `home.js` | One-line pitch; start from scratch or pick a sample person |
| `#/login` | `login.js` | Demo sign-in with test accounts |
| `#/inputs` | `inputs.js` | Questionnaire |
| `#/report` | `report.js` | Upload a lab report, confirm each value |
| `#/results` | `results.js` | One card per formula |
| `#/explain` | `explain.js` | The written reading of the results, then the computed details |
| `#/plan` | `plan.js` | Next steps: follow-up tests and services the person's own values qualify for |
| `#/evidence` | `evidence.js` | Where each formula has been checked |

A query string may follow the path: `#/results?open=fsrp`.

## Views

Each view file exports one function. Views load on demand, so a broken view shows an error on its own page only.

```js
// js/views/<name>.js
export function render(root, ctx) {
  // root: the <main> element to draw into (already emptied)
  // ctx.store            see Store
  // ctx.runAll(person)   see Results
  // ctx.callApi(name, payload)   see Server API
  // ctx.go('#/results')  change page
  // ctx.query()          { open: 'fsrp' } for #/results?open=fsrp
}
```

Put text into the page with `textContent`, not string-built HTML, whenever it comes from a person or an API.

## Store

One record per signed-in user, kept in this browser's `localStorage` under `unify-risk:v1:<user>`. Nobody signed in means the user is `guest`.

```js
ctx.store.user();                 // 'testuser1' | 'guest'
ctx.store.get();                  // { personaId, profile, labs, reports, consentResearch, region? }
ctx.store.set({ consentResearch: true });
ctx.store.setProfile({ age: 62 });            // shallow merge into profile
ctx.store.setLabs({ hdlMgDl: 41 });           // shallow merge into labs
ctx.store.addReport(report);                  // newest first; its labs are merged into labs
ctx.store.loadPersona('lin');                 // copy a sample person's profile and labs
ctx.store.reset();
const stop = ctx.store.subscribe((record) => { /* runs after every change */ });
```

`consentResearch` defaults to `false`.

## Sign-in

Demo only: test accounts, no password, no server. Every page except `#/login` needs a signed-in account; the router sends everyone else to the sign-in page.

```js
import { TEST_ACCOUNTS, currentUser, signIn, signOut } from './auth.js';

TEST_ACCOUNTS;          // [{ user: 'testuser1', persona }, ...] — testuserN opens the Nth sample person (first three)
currentUser();          // 'testuser1' | null
signIn('testuser1');    // { ok: true } | { ok: false, error }
signOut();
```

The first sign-in copies the account's sample person into its record. Later sign-ins keep whatever that account saved, so two accounts show two different people.

## Person

A person is `{ profile, labs }`. Every field is optional; formulas report what they are missing.

```js
profile: {
  age: 62,                      // years
  sex: 'male',                  // 'male' | 'female'
  heightCm: 168, weightKg: 76, waistCm: 95,
  educationYears: 12,
  smoking: 'current',           // 'never' | 'former' | 'current'
  sbp: 148, dbp: 92,            // mmHg
  bpTreated: false,             // takes blood-pressure medicine
  diabetes: false,
  highGlucoseHistory: true,     // ever told glucose was high
  afib: false,                  // atrial fibrillation
  cvdHistory: false,            // heart attack, angina, heart failure, PAD
  familyStroke: true,           // parent or sibling had a stroke
  familyDiabetes: 'second',     // 'none' | 'second' | 'first' degree
  active30minDaily: false,
  exerciseTwiceWeekly: false,
  vegFruitDaily: true
},
labs: {                         // the unit is part of the key name
  totalCholMgDl: 212,
  hdlMgDl: 41,
  fastingGlucoseMgDl: 108,
  hba1cPct: 5.9
}
```

Add a field here when you need one: camelCase, unit in a comment (profile) or in the key name (labs).

## Sample people

```js
// js/data/personas.js
export const PERSONAS = [
  { id: 'lin',                  // stable key, used in URLs and localStorage
    region: 'TW',               // 'TW' | 'US'
    name: 'Mr. Lin', tagline: '62 · Taipei · ...', blurb: '...',
    populationIds: ['tw', 'men'],   // ids from POPULATIONS in js/data/evidence.js
    profile: { /* see Person */ },
    labs: { /* see Person */ } }
];
```

## Lab report

```js
{ date: '2026-07-18',           // ISO date on the report
  source: 'sample-report',      // file name or label
  labs: { totalCholMgDl: 212, hdlMgDl: 41 } }   // same keys as Person.labs
```

The report page also saves `measurements`, `items`, `lab`, `demo` and `personId`; see the data model in [architecture.md](architecture.md#data-model).

## Results

```js
import { runAll } from '../engine/run.js';   // or ctx.runAll

runAll({ profile, labs });
// →
[
  { modelId: 'fsrp',            // must match the ids in js/data/evidence.js
    name: 'Revised Framingham Stroke Risk Profile',
    outcome: 'stroke',          // 'stroke' | 'diabetes' | 'dementia' | ...
    horizonYears: 10,
    kind: 'risk',               // 'risk' (probability 0–1) | 'score' (points) | 'value' (e.g. eGFR)
    derivedIn: 'US',            // where the formula's data came from
    status: 'ok',
    value: 0.08,
    terms: [{ label: 'Age', input: 62, coef: 0.049, contribution: 0.3 }],   // one row per term in the drawer
    formula: '1 − S0^exp(Σβx − mean)',
    source: { citation: 'Dufouil C, et al. Circulation 2017', url: 'https://doi.org/...' } },

  { modelId: 'findrisc', ..., status: 'missing', missing: ['profile.waistCm', 'profile.familyDiabetes'] },
  { modelId: 'caide', ..., status: 'not_applicable', reason: 'Developed for ages 39–64' }
]
```

- `status` is one of `ok`, `missing`, `not_applicable`.
- The engine always returns 0–1 for a risk. Views multiply by 100 and round for display.
- Formula ids: `fsrp`, `chin-shan-stroke`, `findrisc`, `caide`, `framingham-offspring-diabetes-wilson-2007`, `hisayama-dementia-equation`. Two point scores, `ada-risk-test-bang-2009` and `bdsi`, are returned only by the engine's own `runAll` with `includeScores: true`.
- `getEvidence(modelId, populationId)` from `js/data/evidence.js` answers "has this formula been checked in people like me?".

## Server API

`server.py` forwards `POST /api/<name>` to `handle(payload, env)` in `api/<name>.py` and returns its dict as JSON. API keys are read from `env` (loaded from `.env`); they never appear in client code.

```python
# api/recognize.py
def handle(payload: dict, env) -> dict:
    # payload: {"filename": str, "dataUrl": str}
    return {"demo": True, "report": {"date": "...", "source": "...", "labs": {...}}}
```

```js
const { report, demo } = await ctx.callApi('recognize', { filename, dataUrl });
```

- `callApi` throws on any failure (network, non-200, an exception in `handle`). The caller catches it and falls back to demo data, with a small "demo data" note on screen. The flow never blocks.
- Set `"demo": True` in the response whenever the values did not come from the real service.
- `GET /api/health` returns `{"ok": true, "providers": [{"name": "claude", "model": "...", "accepts": ["image", "pdf"]}, ...]}`: the providers whose key is set, never the keys.
- Only `index.html` and files under `css/`, `js/` and `assets/` are served; anything else is a 404.
- `POST /api/*` must send `Content-Type: application/json` and come from this server's own pages (`callApi` already does both). Other origins get 403.

## Model providers

Server modules that need a language model call one function and never talk to a provider directly:

```python
from api.router import chat, NoProviderError

reply = chat("Extract the lab values as JSON.", env, system="...", attachment=data_url)
reply["text"], reply["provider"], reply["model"]
```

- `attachment` is an optional base64 data URL of an image or a PDF.
- A provider is used when its key is set in `.env`. They are tried in this order, and the next one is tried when a call fails: `CLAUDE_API_KEY`, `JOHNCLAUDE`, `OPENROUTER_API_KEY`, `OPENGSA_GEMINI_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`. `LLM_PROVIDER_ORDER` changes the order; `<NAME>_MODEL` (for example `GROQ_MODEL`) overrides a provider's model.
- A busy or unreachable provider (HTTP 429, 500, 502, 503, 504, or a network error) is tried once more after a short pause (1.5 s, or a numeric `Retry-After` capped at 5 s) before the next one is tried; other errors (400, 401, 403, 404), refusals, empty replies and full timeouts are not retried. Both attempts share one 90-second budget per provider.
- Only the two Claude keys read PDFs; the others read images. A provider that cannot read the attachment is skipped.
- With no key set, or when every provider fails, `chat` raises `NoProviderError`; the caller falls back to demo data.
- From a page: `await ctx.callApi('chat', { prompt, system, attachment })` returns the same `{ text, provider, model }`.
- **The user can pick the provider.** The header has a selector (Auto, or one configured provider). `callApi` adds the choice to every payload as `provider`; a server module honours it by passing it on: `chat(prompt, env, attachment=..., provider=payload.get("provider") or "")`. A named provider is used alone, with no fallback. Return `provider` and `model` from `chat()` in your response so the header can show who answered.

## Next steps (tests and services)

`js/data/services.js` holds written rules; no model is involved and no number is produced. Every figure shown is copied from the person's record or is part of a published eligibility rule.

```js
import { followUpTests, matchingServices } from '../data/services.js';
import { assess } from '../engine/run.js';

const { results, labs: labRows, metabolicSyndrome: mets } = assess({ profile, labs, region });
const context = { profile, labs, results, labRows, mets, region };   // region: 'TW' | 'US'

followUpTests(context);     // all of them, in order: [{ id, name, reasons: [string], adds, where }]
matchingServices(context);  // [{ id, name, what, rule, how, source: { name, url },
                            //    status: 'meets' | 'may-apply', meets: [string], confirm: [string] }]
```

- A test is suggested when a lab reading is outside its standard (repeat it) or when a formula lists an input as missing.
- `followUpTests` returns every test and never cuts the list (an optional second argument `limit` cuts it for a caller that asks). The order is the rule printed on the page (`FOLLOW_UP_ORDER`): readings outside their standard first, furthest band first by the lab row's `status` (`very-high`, then `high` or `low`, then `borderline`); then missing formula inputs; then the metabolic syndrome count; ties keep the order blood pressure, lipids, glucose, kidney, waist, questionnaire. The page opens the first three and puts the rest under an "N more follow-up tests" line.
- A service match has two parts. `meets` holds the person's own values that meet a part of the published rule (this field was called `matched`). `confirm` holds the parts of the rule that were not checked, because the app does not collect them or the answer is missing. `status` is `'meets'` only when `confirm` is empty, otherwise `'may-apply'`; `meets` services come first. A reader must not present a `may-apply` service as met: show `confirm` with it.
- A service is not listed when a collected value rules it out or nothing relevant is known. A missing answer is never read as "no".
- The record now carries an optional `region` (`'TW'` | `'US'`), set by the switch on the page. When absent, the region of the account's sample person is used.
- To add a service, append to `SERVICES.TW` or `SERVICES.US` with its `rule` in words, a `match(view)` function returning `{ meets, confirm }` or `null`, and an official `source`. Never add a medicine, dose or supplement.
