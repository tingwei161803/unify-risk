// Group C (issue #69): dementia, stroke and mortality formulas.
// The coordinator adds `formulas` to the engine list, `checks()` to runChecks() and
// `fieldLabels` to FIELD_LABELS in util.js. Nothing here edits shared files.

import { ukbdrs } from './ukbdrs.js';
import { waltersDrs, computeWalters } from './walters-drs.js';
import { fukushimaIs, FUKUSHIMA_ITEMS } from './fukushima-is-2024.js';
import { leeIndex } from './lee-index.js';
import { schonbergIndex, schonbergDevRate } from './schonberg-index.js';

export const formulas = [ukbdrs, waltersDrs, fukushimaIs, leeIndex, schonbergIndex];

// Labels for fields that util.js FIELD_LABELS does not have.
export const fieldLabels = {
  strokeHistory: 'Ever had a stroke or TIA',
  familyDementia: 'Parent had dementia',
  depression: 'Depression (current or past) or takes an antidepressant',
  hypertensionDiagnosed: 'Told by a doctor you have high blood pressure',
  highCholesterolDiagnosed: 'Told by a doctor you have high cholesterol',
  cancerHistory: 'Has had cancer (not minor skin cancer)',
  lungDisease: 'Chronic lung disease (emphysema or chronic bronchitis)',
  heartFailure: 'Heart failure',
  drinksPerWeek: 'Alcoholic drinks per week',
  aspirin: 'Takes aspirin regularly',
  livesAlone: 'Lives alone',
  selfRatedHealth: 'Self-rated health',
  hospitalizationsLastYear: 'Overnight hospital stays in the past year',
  difficultyBathing: 'Difficulty bathing',
  difficultyManagingMoney: 'Difficulty managing money',
  difficultyWalkingBlock: 'Difficulty walking several blocks',
  difficultyPushingObjects: 'Difficulty pushing or pulling heavy objects',
  needsHelpDailyTasks: 'Needs another person’s help with everyday chores or shopping',
  difficultyWalkingQuarterMile: 'Difficulty walking a quarter mile (about 3 blocks)',
  walkingSpeedFast: 'Walks faster than most people your age',
  weightChange3kgLastYear: 'Weight changed by 3 kg or more in the past year',
  'labs.ldlMgDl': 'LDL cholesterol',
  'labs.apoe4Count': 'Copies of the APOE ε4 gene (0, 1 or 2)'
};

const person = (profile, labs = {}) => ({ profile, labs });
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const sumPoints = (r) => (r.terms || []).reduce((s, t) => s + t.points, 0);
const sumContribution = (r) => (r.terms || []).reduce((s, t) => s + t.contribution, 0);

function ukbdrsChecks() {
  // Authors' Excel calculator, default inputs: woman 60, 14 years of education, diabetes, depression,
  // hypertension, everything else no; APOE non-carrier. The paper's main text has no worked example.
  const profile = {
    age: 60, sex: 'female', educationYears: 14, familyDementia: false, diabetes: true, depression: true,
    strokeHistory: false, hypertensionDiagnosed: true, highCholesterolDiagnosed: false, livesAlone: false
  };
  const src = 'Anatürk 2023 authors’ Excel calculator UKB-DRS_Calculator.xlsx, default inputs (not printed in the paper)';
  const a = ukbdrs.compute(person(profile));
  const b = ukbdrs.compute(person(profile, { apoe4Count: 0 }));
  const row = (example, expected, actual, tol) => ({
    formulaId: 'ukbdrs', example, expected, actual, pass: near(actual, expected, tol), source: src
  });
  return [
    row('Linear predictor, without APOE (tolerance 0.0001)', 1.23748, sumContribution(a), 1e-4),
    row('14-year risk %, without APOE (tolerance 0.0001)', 2.8591895, a.value * 100, 1e-4),
    row('Linear predictor, with APOE, non-carrier (tolerance 0.0001)', 1.27107, sumContribution(b), 1e-4),
    row('14-year risk %, with APOE, non-carrier (tolerance 0.0001)', 1.92836, b.value * 100, 1e-4)
  ];
}

function waltersChecks() {
  // Additional file 1, Appendix B worked example: woman 75, deprivation quintile 4, BMI 25 (height 170 cm,
  // weight 72.25 kg), no BP medicine, never smoked, no alcohol problem, depression, no aspirin, no stroke,
  // no AF, diabetes, calendar year 2013.
  const p = {
    age: 75, sex: 'female', heightCm: 170, weightKg: 72.25, bpTreated: false, smoking: 'never', drinksPerWeek: 0,
    depression: true, aspirin: false, strokeHistory: false, afib: false, diabetes: true
  };
  const r = computeWalters(waltersDrs, person(p), { year: 2013, quintile: 4 });
  const src = 'Walters 2016, Additional file 1, Appendix B (Worked example)';
  return [
    { formulaId: 'walters-drs', example: 'Worked example: P (tolerance 0.00001)', expected: 3.7017581,
      actual: sumContribution(r), pass: near(sumContribution(r), 3.7017581, 1e-5), source: src },
    { formulaId: 'walters-drs', example: 'Worked example: 5-year risk 11.8% (tolerance 0.0005)', expected: 0.118,
      actual: r.value, pass: near(r.value, 0.118, 5e-4), source: src }
  ];
}

function fukushimaChecks() {
  // The paper prints no worked example. What it does print twice is the points table (Fig. 3a) and the
  // betas (Table 2): points = round(beta / 0.1469). Re-derive all of them.
  const ok = FUKUSHIMA_ITEMS.filter(([, beta, pts]) => Math.round(beta / 0.1469) === pts).length;
  return [{
    formulaId: 'fukushima-is-2024',
    example: `Fig. 3a points equal round(Table 2 beta / 0.1469) for all ${FUKUSHIMA_ITEMS.length} items`,
    expected: FUKUSHIMA_ITEMS.length,
    actual: ok,
    pass: ok === FUKUSHIMA_ITEMS.length,
    source: 'Ma 2024, Fig. 3a and Table 2 (no worked example is printed in the paper)'
  }];
}

function leeChecks() {
  const base = {
    diabetes: false, cancerHistory: false, lungDisease: false, heartFailure: false, smoking: 'never',
    difficultyBathing: false, difficultyManagingMoney: false, difficultyWalkingBlock: false, difficultyPushingObjects: false,
    heightCm: 170, weightKg: 80 // BMI 27.7, no BMI point
  };
  // Box: man 75-79, current smoker, heart failure, difficulty bathing, walking and with money = 16 points, over 64% die in 4 years.
  const box = leeIndex.compute(person({
    ...base, age: 77, sex: 'male', smoking: 'current', heartFailure: true,
    difficultyBathing: true, difficultyWalkingBlock: true, difficultyManagingMoney: true
  }));
  // Text example: woman 78, BMI 28, non-smoker, diabetes, trouble with money. The paper says 6 points but Table 3
  // adds to 7 (age 4 + diabetes 1 + money 2); both are in the 6-9 group, 15%.
  const w78 = leeIndex.compute(person({ ...base, age: 78, sex: 'female', heightCm: 170, weightKg: 81, diabetes: true, difficultyManagingMoney: true }));
  const src = 'Lee 2006, Box and Table 3 / Table 4 (validation cohort)';
  return [
    { formulaId: 'lee-index', example: 'Box example: man 75–79, smoker, heart failure, 3 difficulties → 16 points', expected: 16,
      actual: box.score.points, pass: box.score.points === 16, source: src },
    { formulaId: 'lee-index', example: 'Box example: 14 or more points → 64% die within 4 years', expected: 0.64,
      actual: box.value, pass: box.value === 0.64, source: src },
    { formulaId: 'lee-index', example: 'Text example: woman 78 → group 6–9, 15% (paper says 6 points, Table 3 adds to 7)', expected: 0.15,
      actual: w78.value, pass: w78.value === 0.15 && w78.score.points === 7, source: src }
  ];
}

function schonbergChecks() {
  const base = {
    sex: 'female', smoking: 'never', heightCm: 160, weightKg: 70, // BMI 27.3, no BMI point
    lungDisease: false, diabetes: false, cancerHistory: false, hospitalizationsLastYear: 0, selfRatedHealth: 'excellent',
    needsHelpDailyTasks: false, difficultyWalkingQuarterMile: false
  };
  // Discussion examples: woman 80-84 with no other risk = 5 points, 8% in 5 years; with former smoking, COPD,
  // diabetes, needs help, walking difficulty, fair health = 17 points, 58% (development) / 55% (validation).
  const a = schonbergIndex.compute(person({ ...base, age: 82 }));
  const b = schonbergIndex.compute(person({
    ...base, age: 82, smoking: 'former', lungDisease: true, diabetes: true, needsHelpDailyTasks: true,
    difficultyWalkingQuarterMile: true, selfRatedHealth: 'fair'
  }));
  const src = 'Schonberg 2009, Discussion examples; Table 3';
  return [
    { formulaId: 'schonberg-index', example: 'Woman 80–84, no other risk → 5 points', expected: 5, actual: a.score.points, pass: a.score.points === 5, source: src },
    { formulaId: 'schonberg-index', example: '5 points → 8% in 5 years (validation and development both 8%)', expected: 0.08, actual: a.value,
      pass: a.value === 0.08 && schonbergDevRate(5) === 0.08, source: src },
    { formulaId: 'schonberg-index', example: 'Woman 80–84 with 6 more items → 17 points', expected: 17, actual: b.score.points, pass: b.score.points === 17, source: src },
    { formulaId: 'schonberg-index', example: '17 points → 55% (validation); development 58%', expected: 0.55, actual: b.value,
      pass: b.value === 0.55 && schonbergDevRate(17) === 0.58, source: src }
  ];
}

export function checks() {
  return [...ukbdrsChecks(), ...waltersChecks(), ...fukushimaChecks(), ...leeChecks(), ...schonbergChecks()];
}
