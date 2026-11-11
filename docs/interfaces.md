# Interfaces

> What modules pass to each other. **Announce any format change in the group chat first**, and tell everyone who uses it.
> Placeholder files return fake data in these shapes, so every page can be built before the real pieces land.

## Files and owners

```text
index.html             Peter    the only HTML file; loads js/app.js
server.py              Peter    serves the app and forwards /api/*
js/app.js              Peter    router: maps the hash to a view
js/store.js            Peter    reads and writes localStorage
js/api.js              Peter    callApi(name, payload)
js/auth.js             Peter    demo sign-in (#3)
js/views/home.js       Peter
js/views/login.js      Peter
css/app.css            Robert   shared styles (Peter wrote the first version)
js/views/inputs.js     Robert   questionnaire
js/views/results.js    Robert   one card per formula
js/views/evidence.js   Robert   validation matrix and check table
api/recognize.py       Matt     report recognition (#6)
js/views/report.js     Matt     upload, confirm field by field
js/data/evidence.js    Matt     generated; do not edit by hand
js/engine/**           Matt and Andrew   formulas (#9)
js/data/personas.js    Andrew   fictional sample people (#5)
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
ctx.store.get();                  // { personaId, profile, labs, reports, consentResearch }
ctx.store.set({ consentResearch: true });
ctx.store.setProfile({ age: 62 });            // shallow merge into profile
ctx.store.setLabs({ hdlMgDl: 41 });           // shallow merge into labs
ctx.store.addReport(report);                  // newest first; its labs are merged into labs
ctx.store.loadPersona('lin');                 // copy a sample person's profile and labs
ctx.store.reset();
const stop = ctx.store.subscribe((record) => { /* runs after every change */ });
```

`consentResearch` defaults to `false`.

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
- First formula ids: `fsrp`, `chin-shan-stroke`, `findrisc`, `caide`.
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
- `GET /api/health` returns `{"ok": true}`.
- Only `index.html` and files under `css/`, `js/` and `assets/` are served; anything else is a 404.
- `POST /api/*` must send `Content-Type: application/json` and come from this server's own pages (`callApi` already does both). Other origins get 403.
