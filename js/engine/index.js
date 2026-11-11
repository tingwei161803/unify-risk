// unify-risk formula engine (issue #5). Plain ES module: works in the browser and in Node.
//
//   import { FORMULAS, runAll, runFormula, runChecks } from './js/engine/index.js';
//   const results = runAll(person);   // one result per formula, largest estimate first (see below)
//
// Input: a person from js/data/personas.js or the questionnaire.
//   person.profile  age, sex ('male' | 'female'), heightCm, weightKg, waistCm, educationYears,
//                   smoking ('never' | 'former' | 'current'), sbp, dbp, bpTreated, diabetes,
//                   highGlucoseHistory, afib, cvdHistory, strokeHistory (optional), familyStroke,
//                   familyDiabetes ('none' | 'second' | 'first'), active30minDaily,
//                   exerciseTwiceWeekly, vegFruitDaily
//   person.labs     totalCholMgDl (CAIDE); fastingGlucoseMgDl, hdlMgDl, tgMgDl (Framingham Offspring
//                   diabetes); other lab values are read by js/engine/labs.js
//
// Result shape, one per formula (the UI draws one card per result):
//   id            same id as js/data/evidence.js: 'fsrp' | 'chin-shan-stroke' | 'findrisc' | 'caide' |
//                 'framingham-offspring-diabetes-wilson-2007' | 'ada-risk-test-bang-2009' |
//                 'hisayama-dementia-equation' | 'bdsi'
//   name          short name, e.g. 'Revised FSRP'
//   disease       'stroke' | 'diabetes' | 'dementia'
//   outcome       e.g. 'First stroke within 10 years'
//   kind          'risk' (value is a probability 0-1) | 'score' (value is points, no probability)
//   derivedIn     where the formula's data came from: 'US' | 'TW' | 'EU' | 'JP'
//   status        'computed' | 'missing' | 'not-applicable'
//   value         kind 'risk': probability 0-1; kind 'score': points; null when not computed
//   display       '6.9%', 'about 1 in 3', '6 points (of 9)', or '' when not computed
//   horizonYears  8, 10 or 20; null when the score is about now (ADA)
//   severity      probability 0-1 used for the order below; null for scores and when not computed
//   band          { label, aboveCutoff } for scores with a printed cut-off (ADA), otherwise absent
//   score         { points, max } for point scores, otherwise null
//   terms         what the number is made of:
//                 point scores  [{ label, input, points }]
//                 equations     [{ label, input, beta, x, contribution }]
//   equation      the formula in plain text
//   missing       [{ field, label }] when status is 'missing'
//                 (field is a profile key, or 'labs.<key>' for a lab value)
//   reason        why, when status is 'not-applicable' (outside the age range, previous stroke,
//                 already has diabetes); '' otherwise
//   population    who the formula was built on
//   ageRange      [lo, hi]; hi = null means no upper limit; lo = null means the paper states none
//   source        { citation, doi } of the paper the formula comes from
//   notes         extra lines for the "show the math" drawer
//
// Order (largest estimate first). This is NOT an order of urgency or of clinical severity:
// outcomes and horizons differ (8, 10 or 20 years), so the order is by the size
// of the estimate, not by a common time frame:
//   1. computed with a probability, highest severity first
//   2. computed scores with no probability, those above their printed cut-off first
//   3. 'missing'
//   4. 'not-applicable'
// Ties keep the FORMULAS order.
//
// Score-only results (kind 'score', e.g. the ADA test) are left out unless the caller asks:
//   runAll(person, { includeScores: true })
// js/engine/run.js passes each result's kind through ('risk' only when a result has none), and
// the results page shows `display` instead of a percent for a result that is not kind 'risk'.
// No caller in the app asks for scores, so the two score-only formulas (ADA, BDSI) are not shown.
//
// Missing inputs are listed, never guessed. Outside the age range the result is
// 'not-applicable'; nothing is extrapolated.
//
// runChecks() re-computes the examples printed in each source:
//   [{ formulaId, example, expected, actual, pass, source }]

import { fsrp } from './formulas/fsrp.js';
import { chinShanStroke } from './formulas/chin-shan-stroke.js';
import { findrisc } from './formulas/findrisc.js';
import { caide } from './formulas/caide.js';
import { wilsonDiabetes } from './formulas/wilson-diabetes.js';
import { adaDiabetes } from './formulas/ada-diabetes.js';
import { hisayama } from './formulas/hisayama.js';
import { bdsi } from './formulas/bdsi.js';
import { GROUPS } from './groups.js';

export { runChecks } from './checks.js';

// The first eight formulas, then every formula group (issue #69), in GROUPS order.
const ALL = [fsrp, chinShanStroke, findrisc, caide, wilsonDiabetes, adaDiabetes, hisayama, bdsi,
  ...GROUPS.flatMap((g) => g.formulas)];

// Static description of each formula (no person needed), e.g. for the evidence page.
export const FORMULAS = ALL.map((f) => ({
  id: f.id,
  name: f.name,
  disease: f.disease,
  outcome: f.outcome,
  kind: f.kind,
  derivedIn: f.derivedIn,
  horizonYears: f.horizonYears,
  ageRange: f.ageRange.slice(),
  population: f.population,
  source: { ...f.source },
  equation: f.equation,
  inputs: f.inputs.slice()
}));

// Probability used for ordering: the risk value (or the printed band risk) of a computed result.
function severityOf(r) {
  return r.status === 'computed' && r.kind === 'risk' && Number.isFinite(r.value) ? r.value : null;
}

function group(r) {
  if (r.status === 'computed') {
    if (r.severity !== null) return 0;
    return r.band && r.band.aboveCutoff ? 1 : 2;
  }
  return r.status === 'missing' ? 3 : 4;
}

export function runAll(person, { includeScores = false } = {}) {
  const results = ALL.filter((f) => includeScores || f.kind !== 'score').map((f, i) => {
    const r = f.compute(person || {});
    return { r: { ...r, severity: severityOf(r) }, i };
  });
  results.sort((a, b) => group(a.r) - group(b.r)
    || (group(a.r) === 0 ? b.r.severity - a.r.severity : 0)
    || a.i - b.i);
  return results.map((x) => x.r);
}

export function runFormula(id, person) {
  const f = ALL.find((x) => x.id === id);
  return f ? f.compute(person || {}) : null;
}
