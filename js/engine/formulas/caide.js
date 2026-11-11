// CAIDE Dementia Risk Score, Model 1 (no APOE): risk of dementia 20 years later.
// Kivipelto M, et al. Risk score for the prediction of dementia risk in 20 years among middle
// aged people: a longitudinal, population-based study. Lancet Neurol 2006;5:735-741.
//
// Points (Table 2, 0-15): age 47-53: 3, over 53: 4; education 7-9 years: 2, 0-6 years: 3;
// male: 1; systolic BP over 140: 2; BMI over 30: 2; total cholesterol over 6.5 mmol/L: 2;
// physically inactive (leisure activity less than twice a week): 1.
// Probability from the score (Methods): P = 1 / (1 + exp(-(b0 + b1 + b2 x score)))
// with b0 = -7.406, b1 = 0.796 (20-year follow-up term), b2 = 0.401. Reproduces Table 4.
// Table 3 also prints the share who developed dementia in each score band (shown in notes).
// Built on people aged 39-64 at baseline, so other ages are "not applicable".

import { computed, gate, bmi, formatPercent, round } from '../util.js';

const B0 = -7.406;
const B1 = 0.796;
const B2 = 0.401;
const MG_DL_PER_MMOL_L = 38.67; // cholesterol: 1 mmol/L = 38.67 mg/dL

// Table 3, Model 1: share who developed dementia within 20 years, by score band.
const OBSERVED = [
  { lo: 0, hi: 5, risk: 0.01 },
  { lo: 6, hi: 7, risk: 0.019 },
  { lo: 8, hi: 9, risk: 0.042 },
  { lo: 10, hi: 11, risk: 0.074 },
  { lo: 12, hi: 15, risk: 0.164 }
];

export function caideProbability(score) {
  return 1 / (1 + Math.exp(-(B0 + B1 + B2 * score)));
}

export const caide = {
  id: 'caide',
  name: 'CAIDE',
  disease: 'dementia',
  outcome: 'Dementia within 20 years',
  horizonYears: 20,
  ageRange: [39, 64],
  population: 'Finnish CAIDE cohort: 1,409 people aged 39–64 at baseline, followed for about 20 years.',
  source: {
    citation: 'Kivipelto M, et al. Risk score for the prediction of dementia risk in 20 years among middle aged people: a longitudinal, population-based study. Lancet Neurol 2006;5:735–741.',
    doi: '10.1016/S1474-4422(06)70537-3'
  },
  equation: 'score = sum of 7 items (0–15); 20-year risk = 1 / (1 + e^−(−7.406 + 0.796 + 0.401 × score))',
  inputs: ['age', 'sex', 'educationYears', 'sbp', 'heightCm', 'weightKg', 'labs.totalCholMgDl', 'exerciseTwiceWeekly'],

  compute(person) {
    const early = gate(this, person);
    if (early) return early;

    const p = person.profile;
    const age = Number(p.age);
    const edu = Number(p.educationYears);
    const sbp = Number(p.sbp);
    const b = bmi(p);
    const tcMg = Number(person.labs.totalCholMgDl);
    const tcMmol = tcMg / MG_DL_PER_MMOL_L;

    const ageP = age > 53 ? 4 : age >= 47 ? 3 : 0;
    const eduP = edu <= 6 ? 3 : edu <= 9 ? 2 : 0;
    const terms = [
      { label: `Age ${age > 53 ? 'over 53' : age >= 47 ? '47–53' : 'under 47'}`, input: `${age} years`, points: ageP },
      { label: `Education ${edu <= 6 ? '0–6' : edu <= 9 ? '7–9' : '10 or more'} years`, input: `${edu} years`, points: eduP },
      { label: 'Male', input: p.sex, points: p.sex === 'male' ? 1 : 0 },
      { label: 'Systolic BP over 140 mmHg', input: `${sbp} mmHg`, points: sbp > 140 ? 2 : 0 },
      { label: 'BMI over 30', input: `${round(b, 1)} kg/m²`, points: b > 30 ? 2 : 0 },
      { label: 'Total cholesterol over 6.5 mmol/L (251 mg/dL)', input: `${tcMg} mg/dL = ${tcMmol.toFixed(2)} mmol/L`, points: tcMmol > 6.5 ? 2 : 0 },
      { label: 'Leisure exercise less than twice a week', input: p.exerciseTwiceWeekly ? 'no' : 'yes', points: p.exerciseTwiceWeekly ? 0 : 1 }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const value = caideProbability(points);
    const obs = OBSERVED.find((o) => points >= o.lo && points <= o.hi);

    const notes = [
      `Table 3: of people scoring ${obs.lo}–${obs.hi}, ${formatPercent(obs.risk)} developed dementia within 20 years.`,
      'CAIDE (Model 1) does not ask about family history of dementia or APOE genes.'
    ];
    return computed(this, { value, display: formatPercent(value), score: { points, max: 15 }, terms, notes });
  }
};
