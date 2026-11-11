// Group A: cardiovascular formulas (issue #69). The coordinator wires `formulas`, `checks`
// and `fieldLabels` into index.js, checks.js and util.js.
//
// Skipped: SCORE2 (the 40-69 model). Its coefficients are not in js/data/coefficients.js
// or the research files (only SCORE2-OP is), so it cannot be computed without typing numbers
// from memory.

import { pooledCohortEquationsPce, pceRisk } from './pooled-cohort-equations-pce.js';
import { ahaPrevent, ahaPreventAscvd, ahaPreventHf, preventRisk } from './aha-prevent.js';
import { score2Op, score2OpRisk } from './score2-op.js';
import { chinaPar, chinaParRisk } from './china-par.js';
import { framinghamGeneralCvdDAgostino2008, framinghamCvdRisk } from './framingham-general-cvd-d-agostino-2008.js';

export const formulas = [
  pooledCohortEquationsPce, ahaPrevent, ahaPreventAscvd, ahaPreventHf, score2Op, chinaPar,
  framinghamGeneralCvdDAgostino2008
];

// Labels for fields not already in util.js FIELD_LABELS.
export const fieldLabels = {
  statin: 'Takes a statin',
  ethnicity: 'Ethnicity',
  region: 'Region',
  urban: 'Lives in a city (not rural)',
  familyAscvd: 'Parent or sibling had a heart attack or stroke',
  'labs.egfr': 'eGFR (kidney filtering rate)'
};

function row(formulaId, example, expected, actual, tol, source) {
  return { formulaId, example, expected, actual, pass: Math.abs(actual - expected) <= tol, source };
}

export function checks() {
  const out = [];

  // PCE: Table A example, age 55, TC 213, HDL 50, untreated SBP 120, non-smoker, no diabetes.
  // The paper prints risk to 0.1%, so the tolerance is 0.1 percentage points.
  const pceX = { age: 55, tc: 213, hdl: 50, sbp: 120, treated: false, smoker: false, diabetes: false };
  [['white_female', 'white women', 0.021], ['aa_female', 'African American women', 0.03],
    ['white_male', 'white men', 0.053], ['aa_male', 'African American men', 0.061]].forEach(([set, who, exp]) => {
    out.push(row('pooled-cohort-equations-pce', `Table A example, ${who}: age 55, TC 213, HDL 50, SBP 120 untreated, no smoking or diabetes (risk, tolerance 0.1 point)`,
      exp, pceRisk(set, pceX).risk, 0.001, 'Goff 2014, Table A (as printed in the research file)'));
  });
  // Self-computed from the same coefficients: tests the treated, smoker and diabetes branch. Not from the paper.
  const pceY = { age: 65, tc: 200, hdl: 40, sbp: 150, treated: true, smoker: true, diabetes: true };
  out.push(row('pooled-cohort-equations-pce', 'Self-computed, white women, age 65, TC 200, HDL 40, SBP 150 treated, smoker, diabetes (regression only)',
    0.35764, pceRisk('white_female', pceY).risk, 0.0005, 'Research file, self_computed (not in the paper)'));
  out.push(row('pooled-cohort-equations-pce', 'Self-computed, African American women, same inputs (regression only)',
    0.51779, pceRisk('aa_female', pceY).risk, 0.0005, 'Research file, self_computed (not in the paper)'));

  // PREVENT. Tolerance 0.05 percentage points (values printed to 0.1%) unless stated.
  const s25 = { age: 50, sbp: 160, treated: true, statin: false, diabetes: true, smoker: false, nonHdlMmol: (200 - 45) * 0.02586, hdlMmol: 45 * 0.02586, egfr: 90, bmi: null };
  const s25r = preventRisk('cvd', 'female', s25);
  out.push(row('aha-prevent', 'Supplemental Table S25: woman 50, TC 200, HDL 45, SBP 160 treated, diabetes, eGFR 90 (log-odds, tolerance 0.00001)',
    -1.75961, s25r.logOdds, 0.00001, 'Khan 2024, Supplemental Table S25 (as recorded in the team\'s proof of concept)'));
  out.push(row('aha-prevent', 'Same woman: total CVD risk (tolerance 0.005 point)', 0.1468, s25r.risk, 0.00005, 'Khan 2024, Supplemental Table S25'));
  const main = { age: 50, sbp: 160, treated: true, statin: false, diabetes: false, smoker: false, nonHdlMmol: (240 - 55) * 0.02586, hdlMmol: 55 * 0.02586, egfr: 90, bmi: 35 };
  const mainS = { ...main, smoker: true };
  [['cvd', 'aha-prevent', 'total CVD', 0.054, 0.093], ['ascvd', 'aha-prevent-ascvd', 'ASCVD', 0.036, 0.06], ['hf', 'aha-prevent-hf', 'heart failure', 0.025, 0.047]].forEach(([k, id, what, a, b]) => {
    out.push(row(id, `Main-text example: woman 50, TC 240, HDL 55, SBP 160 treated, BMI 35, eGFR 90, ${what}, non-smoker (tolerance 0.05 point)`,
      a, preventRisk(k, 'female', main).risk, 0.0005, 'Khan 2024, main-text worked example (as recorded in the team\'s proof of concept)'));
    out.push(row(id, `Same woman if she smokes, ${what} (tolerance 0.05 point)`,
      b, preventRisk(k, 'female', mainS).risk, 0.0005, 'Khan 2024, main-text worked example'));
  });
  const man = { age: 50, sbp: 160, treated: true, statin: false, diabetes: true, smoker: false, nonHdlMmol: (200 - 45) * 0.02586, hdlMmol: 45 * 0.02586, egfr: 90, bmi: 35 };
  [['cvd', 'aha-prevent', 0.163], ['ascvd', 'aha-prevent-ascvd', 0.102], ['hf', 'aha-prevent-hf', 0.106]].forEach(([k, id, exp]) => {
    out.push(row(id, `Cross-check, man 50, TC 200, HDL 45, SBP 160 treated, diabetes, BMI 35, eGFR 90, ${k} (tolerance 0.05 point)`,
      exp, preventRisk(k, 'male', man).risk, 0.0005, 'preventr package tests citing Khan 2024 Table S12 (not the supplement itself)'));
  });

  // SCORE2-OP: Supplementary Methods Table 3 example, age 75, smoker, no diabetes, SBP 140, TC 5.5, HDL 1.3.
  const op = { age: 75, sbp: 140, tc: 5.5, hdl: 1.3, smoker: true, diabetes: false };
  const f = score2OpRisk('female', op, null), m = score2OpRisk('male', op, null);
  out.push(row('score2-op', 'Table 3 example, woman: linear predictor (tolerance 0.0005; the paper prints a minus sign by mistake)', 0.5029, f.lp, 0.0005, 'de Vries 2021, Supplementary Methods Table 3'));
  out.push(row('score2-op', 'Table 3 example, woman: uncalibrated 10-year risk', 0.2442, f.raw, 0.0005, 'de Vries 2021, Supplementary Methods Table 3'));
  out.push(row('score2-op', 'Table 3 example, man: linear predictor (tolerance 0.0005)', 0.3298, m.lp, 0.0005, 'de Vries 2021, Supplementary Methods Table 3'));
  out.push(row('score2-op', 'Table 3 example, man: uncalibrated 10-year risk', 0.2966, m.raw, 0.0005, 'de Vries 2021, Supplementary Methods Table 3'));
  out.push(row('score2-op', 'Same woman, low-risk region (Table 1 scaling; self-computed, the paper\'s example uses an older scaling)', 0.1516, score2OpRisk('female', op, 'low').risk, 0.0005, 'Research file, self_computed'));
  out.push(row('score2-op', 'Same man, low-risk region (Table 1 scaling; self-computed)', 0.1856, score2OpRisk('male', op, 'low').risk, 0.0005, 'Research file, self_computed'));

  // China-PAR: main-text Table 2 (Circulation 2016;134:1433). SBP 130 untreated, TC 210, HDL 55,
  // waist 80, non-smoker, diabetes, north. Men urban, no family history. Tolerances: men 0.1, women 0.2 points.
  const cp = (age, urban) => ({ age, sbp: 130, tc: 210, hdl: 55, waist: 80, treated: false, smoker: false, diabetes: true, north: true, urban, family: false });
  [[40, 0.022, 0.024], [50, 0.054, 0.054], [60, 0.11, 0.101], [70, 0.196, 0.171]].forEach(([age, men, women]) => {
    out.push(row('china-par', `Table 2, man ${age} (tolerance 0.1 point; uses back-calculated S10)`, men, chinaParRisk('male', cp(age, true)).risk, 0.001, 'Yang 2016, main-text Table 2'));
    out.push(row('china-par', `Table 2, woman ${age} (tolerance 0.2 point; uses back-calculated S10)`, women, chinaParRisk('female', cp(age, false)).risk, 0.002, 'Yang 2016, main-text Table 2'));
  });

  // Framingham: no worked example from the paper was available; these are regression values
  // computed from the same coefficients (research file, self_computed).
  const fr = (age, tc, hdl, sbp, treated, smoker, diabetes) => ({ age, tc, hdl, sbp, treated, smoker, diabetes });
  [['female', 'woman 55, TC 200, HDL 50, SBP 120, no risk factors', fr(55, 200, 50, 120, false, false, false), 0.04966],
    ['female', 'woman 65, TC 240, HDL 40, SBP 150 treated, smoker, diabetes', fr(65, 240, 40, 150, true, true, true), 0.60738],
    ['male', 'man 55, TC 200, HDL 50, SBP 120, no risk factors', fr(55, 200, 50, 120, false, false, false), 0.09568],
    ['male', 'man 65, TC 240, HDL 40, SBP 150 treated, smoker, diabetes', fr(65, 240, 40, 150, true, true, true), 0.84318]].forEach(([sex, who, x, exp]) => {
    out.push(row('framingham-general-cvd-d-agostino-2008', `Self-computed regression value, ${who}`, exp, framinghamCvdRisk(sex, x).risk, 0.0005, 'Research file, self_computed (not from the paper)'));
  });

  return out;
}
