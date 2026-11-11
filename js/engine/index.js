// unify-risk formula engine (issue #5). Plain ES module: works in the browser and in Node.
//
//   import { FORMULAS, runAll, runFormula, runChecks } from './js/engine/index.js';
//   const results = runAll(person);   // one result per formula, in FORMULAS order
//
// Input: a person from js/data/personas.js or the questionnaire.
//   person.profile  age, sex ('male' | 'female'), heightCm, weightKg, waistCm, educationYears,
//                   smoking ('never' | 'former' | 'current'), sbp, dbp, bpTreated, diabetes,
//                   highGlucoseHistory, afib, cvdHistory, strokeHistory (optional), familyStroke,
//                   familyDiabetes ('none' | 'second' | 'first'), active30minDaily,
//                   exerciseTwiceWeekly, vegFruitDaily
//   person.labs     totalCholMgDl (CAIDE); other lab values are read by js/engine/labs.js
//
// Result shape, one per formula (the UI draws one card per result):
//   id            same id as js/data/evidence.js: 'fsrp' | 'chin-shan-stroke' | 'findrisc' | 'caide'
//   name          short name, e.g. 'Revised FSRP'
//   disease       'stroke' | 'diabetes' | 'dementia'
//   outcome       e.g. 'First stroke within 10 years'
//   status        'computed' | 'missing' | 'not-applicable'
//   value         probability 0-1 when computed, otherwise null
//   display       '6.9%', 'about 1 in 3', or '' when not computed
//   horizonYears  10 or 20
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
//   ageRange      [lo, hi]; hi = null means no upper limit
//   source        { citation, doi } of the paper the formula comes from
//   notes         extra lines for the "show the math" drawer
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

export { runChecks } from './checks.js';

const ALL = [fsrp, chinShanStroke, findrisc, caide];

// Static description of each formula (no person needed), e.g. for the evidence page.
export const FORMULAS = ALL.map((f) => ({
  id: f.id,
  name: f.name,
  disease: f.disease,
  outcome: f.outcome,
  horizonYears: f.horizonYears,
  ageRange: f.ageRange.slice(),
  population: f.population,
  source: { ...f.source },
  equation: f.equation,
  inputs: f.inputs.slice()
}));

export function runAll(person) {
  return ALL.map((f) => f.compute(person || {}));
}

export function runFormula(id, person) {
  const f = ALL.find((x) => x.id === id);
  return f ? f.compute(person || {}) : null;
}
