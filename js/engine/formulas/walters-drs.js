// Dementia Risk Score (Walters), 5-year risk of a first dementia diagnosis, ages 60-79.
// Walters K, et al. BMC Med 2016;14:6, Additional file 1, Appendix B (Formula and Worked example).
// Cox model, men and women together:
//
//   P = sum of the terms below;  risk(5y) = 1 - 0.9969 ^ exp(P)
//
// Age, BMI and calendar year are centred (65.608, 27.501, 2003.719); age and BMI also enter as a
// centred square. Yes/no and category terms are not centred. Betas are the high-precision values
// of Additional file 1 (Table 2 in the paper is rounded to 3 decimals and gives 12.27% instead of
// the worked example's 11.8%). Numbers are copied from COEFFICIENTS['dementia-risk-score-walters'],
// equation 'age60_79_supplement'.
//
// Two inputs have no Taiwan equivalent and are fixed: deprivation quintile = 3 (the middle one) and
// calendar year = the current year. Both are stated in the notes of every result.
// Heavy drinking: the extracted sources give no threshold. HEAVY_DRINKS_PER_WEEK is an ASSUMPTION.

import { computed, gate, bmi, formatPercent, round, yesNo } from '../util.js';

const AGE_C = 65.608;
const BMI_C = 27.501;
const YEAR_C = 2003.719;
const S0_5Y = 0.9969;
// ASSUMPTION (not in the extracted sources; the paper's definition is unconfirmed): more than 14 drinks a week.
const HEAVY_DRINKS_PER_WEEK = 14;

// Additional file 1, Appendix B (Formula).
const B = {
  age: 0.20921, age2: -0.00339, bmi: -0.0616, bmi2: 0.002508, fem: 0.12854, hyp: -0.13199, cal: 0.04477,
  depQuintile: { 1: 0, 2: 0.013371, 3: 0.117904, 4: 0.201776, 5: 0.225529 },
  ex: -0.06792, curr: -0.08657, alc: 0.443535, dep: 0.833612, asp: 0.252833, str: 0.577207, af: 0.220728, dm: 0.286701
};

const MIDDLE_QUINTILE = 3;

// opts: { year, quintile }. Exported so checks can use the worked example (quintile 4, year 2013).
export function computeWalters(meta, person, opts) {
  const early = gate(meta, person);
  if (early) return early;

  const p = person.profile;
  const age = Number(p.age);
  const b = bmi(p);
  const heavy = Number(p.drinksPerWeek) > HEAVY_DRINKS_PER_WEEK;
  const rows = [
    ['Age − 65.608', `${age} years`, B.age, age - AGE_C],
    ['(Age − 65.608)²', `${age} years`, B.age2, (age - AGE_C) ** 2],
    ['BMI − 27.501', `${round(b, 1)} kg/m²`, B.bmi, b - BMI_C],
    ['(BMI − 27.501)²', `${round(b, 1)} kg/m²`, B.bmi2, (b - BMI_C) ** 2],
    ['Female', p.sex, B.fem, p.sex === 'female' ? 1 : 0],
    ['Takes blood-pressure medicine', yesNo(p.bpTreated), B.hyp, p.bpTreated === true ? 1 : 0],
    ['Calendar year − 2003.719', `${opts.year}`, B.cal, opts.year - YEAR_C],
    [`Deprivation quintile ${opts.quintile}`, 'not asked; fixed', B.depQuintile[opts.quintile], 1],
    ['Former smoker', p.smoking, B.ex, p.smoking === 'former' ? 1 : 0],
    ['Current smoker', p.smoking, B.curr, p.smoking === 'current' ? 1 : 0],
    [`Heavy drinking (over ${HEAVY_DRINKS_PER_WEEK} drinks a week, assumed)`, `${p.drinksPerWeek} a week`, B.alc, heavy ? 1 : 0],
    ['Depression or takes an antidepressant', yesNo(p.depression), B.dep, p.depression === true ? 1 : 0],
    ['Takes aspirin', yesNo(p.aspirin), B.asp, p.aspirin === true ? 1 : 0],
    ['Stroke or TIA', yesNo(p.strokeHistory), B.str, p.strokeHistory === true ? 1 : 0],
    ['Atrial fibrillation', yesNo(p.afib), B.af, p.afib === true ? 1 : 0],
    ['Diabetes', yesNo(p.diabetes), B.dm, p.diabetes === true ? 1 : 0]
  ];
  const terms = rows.map(([label, input, beta, x]) => ({
    label, input, beta, x: round(x, 4), contribution: round(beta * x, 7)
  }));
  const P = rows.reduce((s, r) => s + r[2] * r[3], 0);
  const risk = 1 - Math.pow(S0_5Y, Math.exp(P));
  const notes = [
    `P = ${P.toFixed(5)}; 5-year risk = 1 − ${S0_5Y}^exp(P).`,
    `Deprivation has no Taiwan equivalent: the middle quintile (${opts.quintile} of 5) is used. The least deprived quintile would lower the estimate, the most deprived would raise it.`,
    `Calendar year is a time trend in the model (about 5% more risk per year, Table 2); the current year (${opts.year}) is used, so the estimate is higher than for an earlier year.`,
    `Heavy drinking: the paper’s threshold was not in the extracted sources. More than ${HEAVY_DRINKS_PER_WEEK} drinks a week is an assumption.`,
    'UK primary-care data (THIN), not calibrated to Taiwan.',
    'DOI was not in the extracted sources, so none is shown.'
  ];
  return computed(meta, { value: risk, display: formatPercent(risk), terms, notes, linearPredictor: round(P, 7) });
}

export const waltersDrs = {
  id: 'walters-drs',
  name: 'Dementia Risk Score (Walters)',
  disease: 'dementia',
  outcome: 'First dementia diagnosis within 5 years',
  horizonYears: 5,
  kind: 'risk',
  derivedIn: 'EU',
  ageRange: [60, 79],
  population: 'UK primary-care patients (THIN database) aged 60–79 with no recorded dementia.',
  source: {
    citation: 'Walters K, et al. Predicting dementia risk in primary care: development and validation of the Dementia Risk Score using routinely collected data. BMC Med 2016;14:6 (Additional file 1).',
    doi: ''
  },
  equation: '5-year risk = 1 − 0.9969^exp(P); P = 0.20921(age−65.608) − 0.00339(age−65.608)² − 0.0616(BMI−27.501) + 0.002508(BMI−27.501)² + 0.12854·female − 0.13199·BP medicine + 0.04477(year−2003.719) + deprivation, smoking, drinking, depression, aspirin, stroke, AF and diabetes terms',
  inputs: ['age', 'sex', 'heightCm', 'weightKg', 'bpTreated', 'smoking', 'drinksPerWeek', 'depression', 'aspirin',
    'strokeHistory', 'afib', 'diabetes'],

  compute(person) {
    return computeWalters(this, person, { year: new Date().getFullYear(), quintile: MIDDLE_QUINTILE });
  }
};
