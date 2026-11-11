// Helpers shared by the cancer formulas (issue #69, group D). Plain ES module.
// Kept in its own file so util.js stays untouched.

import { FIELD_LABELS, read, gate, missingResult } from '../util.js';

// Labels for the fields that only the cancer formulas read (merged into the "what is missing" list).
export const fieldLabels = {
  ethnicity: 'Ethnicity',
  packYears: 'Pack-years of smoking',
  cigsPerDay: 'Cigarettes per day (average)',
  yearsSmoked: 'Years of smoking',
  yearsSinceQuit: 'Years since quitting smoking',
  educationLevel: 'Education level (1-6)',
  cancerHistory: 'Ever had cancer',
  copd: 'COPD (chronic obstructive pulmonary disease)',
  familyLungCancer: 'Parent, sibling or child had lung cancer',
  familyColorectalCancer: 'Parent, sibling or child had colorectal cancer',
  familyBreastCancerCount: 'Mother, sisters or daughters with breast cancer (0, 1, 2 or more)',
  ageAtMenarche: 'Age at first period',
  ageAtFirstLiveBirth: 'Age at first live birth (or "none")',
  breastBiopsyCount: 'Number of breast biopsies',
  atypicalHyperplasia: 'Atypical hyperplasia found on a breast biopsy',
  diabetesOnsetAge: 'Age when diabetes was diagnosed',
  weightChangeKg12m: 'Weight change over the last 12 months',
  'labs.glucoseChangeMgDl12m': 'Change in glucose over the last 12 months',
  'labs.psaNgMl': 'PSA (prostate-specific antigen)',
  dreAbnormal: 'Digital rectal exam felt suspicious',
  priorNegativeBiopsy: 'Ever had a prostate biopsy without cancer',
  familyProstateCancer: 'Father, brother or son had prostate cancer'
};

export const labelOf = (f) => fieldLabels[f] || FIELD_LABELS[f] || f;

const present = (v) => v !== undefined && v !== null && v !== '';
export const isNum = (v) => present(v) && typeof v !== 'boolean' && Number.isFinite(Number(v));
export const isBool = (v) => typeof v === 'boolean';
export const ETHNICITIES = ['white', 'black', 'hispanic', 'asian', 'other'];
export const isEthnicity = (v) => ETHNICITIES.includes(v);

// Same order as util.gate (age range, exclusion, missing inputs), with two additions:
//   numeric: fields util.js can check (numbers, booleans, sex, smoking)
//   custom:  { field: predicate(value) } for fields util.js cannot check (ethnicity, 'none' | number, ...)
// Returns a finished result or null when the formula can compute.
export function gateCancer(meta, person, { numeric, custom = {}, exclusion } = {}) {
  const early = gate({ ...meta, inputs: numeric }, person, exclusion);
  if (early && early.status !== 'missing') return early;
  const bad = Object.entries(custom)
    .filter(([f, ok]) => !ok(read(person, f)))
    .map(([field]) => ({ field, label: labelOf(field) }));
  if (early) {
    early.missing = early.missing.concat(bad).map((m) => ({ field: m.field, label: labelOf(m.field) }));
    return early;
  }
  return bad.length ? missingResult(meta, bad) : null;
}

// Gail-type absolute risk (Gail 1989 equation 6 in one-year steps). Arrays hold one rate per
// 5-year age group starting at 20-24 (14 groups, per person-year).
//   rr(age)           relative risk applied in the one-year cell that starts at integer age `age`
//   oneMinusAr(age)   attributable-risk factor for that cell
// Returns the probability of breast cancer between t1 and t2 (ages in years, 20 <= t1 < t2 <= 90).
export function gailAbsoluteRisk({ t1, t2, lambda1, lambda2, rr, oneMinusAr }) {
  let cum = 0;
  let total = 0;
  for (let k = Math.floor(t1); k < Math.ceil(t2); k++) {
    const len = Math.min(k + 1, t2) - Math.max(k, t1);
    const g = Math.floor((k - 20) / 5);
    const h1 = lambda1[g] * oneMinusAr(k) * rr(k);
    const lam = h1 + lambda2[g];
    total += (h1 / lam) * Math.exp(-cum) * (1 - Math.exp(-lam * len));
    cum += lam * len;
  }
  return total;
}
