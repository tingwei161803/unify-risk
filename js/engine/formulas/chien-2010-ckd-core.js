// Chien 2010 NTUH new-onset CKD points models (clinical and biochemical versions).
// Chien KL, et al. A prediction model for the risk of incident chronic kidney disease. Am J Med 2010;123:836-846.
// (The research file records no DOI.) Built on 5,168 adults of the National Taiwan University Hospital
// health-check cohort (mean age 51.2, median follow-up 2.2 years, 190 new cases); the Chin-Shan community cohort
// was the external check (clinical model AUC 0.667). The paper states no age range and does not print S0(4), so
// only the printed Table 3 / Table 4 risks are used. Outcome: eGFR (MDRD) under 60 mL/min/1.73 m2 within 4 years.
// Category edges: lower edge included, upper excluded. Gaps such as HbA1c 5.3-5.4 are closed at the next lower
// edge (unconfirmed; the paper prints one decimal).

import { computed, gate, read, bmi, round } from '../util.js';

export const pts = (t, v) => t.pts[t.lows.filter((l) => v >= l).length];

// Table 3 (PDF p.6), clinical: total points -> 4-year risk.
export const CLINICAL_RISK = { "0": 0.02, "1": 0.02, "2": 0.03, "3": 0.04, "4": 0.06, "5": 0.07, "6": 0.1, "7": 0.13, "8": 0.18, "9": 0.23, 
   "10": 0.31, "11": 0.39, "12": 0.49, "13": 0.6, "14": 0.72, "15": 0.82, "16": 0.9, "17": 0.96 };
// Table 4 (PDF p.6), biochemical: total points -> 4-year risk.
export const LAB_RISK = { "0": 0.01, "1": 0.02, "2": 0.02, "3": 0.03, "4": 0.04, "5": 0.06, "6": 0.08, "7": 0.11, "8": 0.14, "9": 0.19, 
   "10": 0.25, "11": 0.32, "12": 0.4, "13": 0.5, "14": 0.61, "15": 0.72, "16": 0.82, "17": 0.9, "18": 0.96, 
   "19": 0.99, "20": 1, "21": 1, "22": 1, "23": 1 };

// Points (Table 3 / Table 4, PDF p.6): lower edges of categories 2..n and points for every category.
export const AGE = { lows: [45, 55, 65], pts: [0, 3, 5, 8] };
export const BMI_CLIN = { lows: [21, 24, 26], pts: [0, 1, 1, 2] };
export const DBP_CLIN = { lows: [66, 74, 80], pts: [0, 1, 1, 2] };
export const DBP_LAB = { lows: [66, 74, 80], pts: [0, 1, 1, 1] };
export const URIC = { lows: [5, 6, 7], pts: [0, 1, 1, 2] };
export const PPG = { lows: [88, 105, 130], pts: [0, 0, 0, 1] };
export const HBA1C = { lows: [5.2, 5.4, 5.7], pts: [0, 0, 0, 1] };
export const DIABETES_PTS = 1;
export const STROKE_PTS = 4;
export const PROTEINURIA_PTS = 6;

export function clinicalPoints(x) {
  const parts = [pts(AGE, x.age), pts(BMI_CLIN, x.bmi), pts(DBP_CLIN, x.dbp), x.diabetes ? DIABETES_PTS : 0, x.stroke ? STROKE_PTS : 0];
  return { parts, total: parts.reduce((s, v) => s + v, 0) };
}
export function labPoints(x) {
  const parts = [pts(AGE, x.age), pts(DBP_LAB, x.dbp), x.stroke ? STROKE_PTS : 0, pts(URIC, x.uric), pts(PPG, x.ppg), pts(HBA1C, x.hba1c), x.proteinuria ? PROTEINURIA_PTS : 0];
  return { parts, total: parts.reduce((s, v) => s + v, 0) };
}

// Already has CKD -> the outcome has happened.
export function ckdExclusion(person) {
  const stage = Number(read(person, 'ckdStage'));
  if (Number.isFinite(stage) && stage >= 1) return 'Already has chronic kidney disease; this model estimates the chance of developing it.';
  const egfr = read(person, 'labs.egfr');
  if (egfr !== undefined && egfr !== null && Number(egfr) < 60) return 'eGFR is below 60, the line used to define chronic kidney disease; this model is for people above it.';
  return '';
}

export function ckdMeta(o) {
  return Object.assign({
    disease: 'kidney',
    outcome: 'New chronic kidney disease (eGFR under 60) within 4 years',
    horizonYears: 4,
    kind: 'risk',
    derivedIn: 'TW',
    ageRange: [null, null],
    population: 'National Taiwan University Hospital health-check cohort: 5,168 adults, mean age 51.2 (the paper states no age range). External check in the Chin-Shan community cohort.',
    source: {
      citation: 'Chien KL, et al. A prediction model for the risk of incident chronic kidney disease. Am J Med 2010;123:836–846.',
      doi: ''
    }
  }, o);
}

export function ckdResult(self, total, max, riskTable, terms, notes) {
  const r = riskTable[Math.min(total, max)];
  return computed(self, { value: r, display: `${Math.round(r * 100)}%`, score: { points: total, max }, terms, notes });
}
