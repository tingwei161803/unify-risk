// Revised Framingham Stroke Risk Profile (FSRP), 10-year risk of a first stroke.
// Dufouil C, et al. Revised Framingham Stroke Risk Profile to Reflect Temporal Trends.
// Circulation 2017;135:1145-1159. Figure 4: betas, M (sum of beta x mean) and baseline
// survival Sb(t) per sex, and the four worked examples in Figure 4A (see checks.js).
//
//   risk(t) = 1 - Sb(t) ^ exp(L - M),   L = sum of beta x x
//
// Only one of the two SBP terms is non-zero for a person (treated or untreated).
// Diabetes has separate terms below and from age 65; age 65 itself counts as 65 or over.

import { computed, gate, read, formatPercent, round, yesNo } from '../util.js';

const COEF = {
  male: {
    age10: 0.49716, smoker: 0.47254, cvd: 0.45341, afib: 0.08064, age65: 0.45426,
    diabetesUnder65: 1.35304, diabetes65: 0.34385, bpTreated: 0.82598,
    sbpUntreated: 0.27323, sbpTreated: 0.09793,
    M: 4.4227101, S10: 0.94451, S5: 0.98059
  },
  female: {
    age10: 0.87938, smoker: 0.51127, cvd: -0.03035, afib: 1.2072, age65: 0.39796,
    diabetesUnder65: 1.07111, diabetes65: 0.06565, bpTreated: 0.13085,
    sbpUntreated: 0.11303, sbpTreated: 0.17234,
    M: 6.6170719, S10: 0.95911, S5: 0.9871
  }
};

export const fsrp = {
  id: 'fsrp',
  name: 'Revised FSRP',
  disease: 'stroke',
  outcome: 'First stroke within 10 years',
  horizonYears: 10,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [55, 84],
  population: 'Framingham Heart Study (US), stroke-free adults aged 55–84; checked externally in 3C (France) and REGARDS (US).',
  source: {
    citation: 'Dufouil C, et al. Revised Framingham Stroke Risk Profile to Reflect Temporal Trends. Circulation 2017;135:1145–1159.',
    doi: '10.1161/CIRCULATIONAHA.115.021275'
  },
  equation: '10-year risk = 1 − Sb(10)^exp(L − M), L = Σ β·x (sex-specific β, M and Sb from Figure 4B)',
  inputs: ['age', 'sex', 'smoking', 'sbp', 'bpTreated', 'diabetes', 'afib', 'cvdHistory'],

  compute(person) {
    const early = gate(this, person, (p) =>
      read(p, 'strokeHistory') === true ? 'Has had a stroke; this formula estimates a first stroke.' : '');
    if (early) return early;

    const p = person.profile;
    const c = COEF[p.sex];
    const age = Number(p.age);
    const sbp = Number(p.sbp);
    const old = age >= 65;
    const treated = p.bpTreated === true;
    const rows = [
      ['Age / 10', `${age} years`, c.age10, age / 10],
      ['Current smoker', p.smoking, c.smoker, p.smoking === 'current' ? 1 : 0],
      ['Heart disease or heart failure', yesNo(p.cvdHistory), c.cvd, p.cvdHistory ? 1 : 0],
      ['Atrial fibrillation', yesNo(p.afib), c.afib, p.afib ? 1 : 0],
      ['Age 65 or over', `${age} years`, c.age65, old ? 1 : 0],
      ['Diabetes, under 65', yesNo(p.diabetes), c.diabetesUnder65, !old && p.diabetes ? 1 : 0],
      ['Diabetes, 65 or over', yesNo(p.diabetes), c.diabetes65, old && p.diabetes ? 1 : 0],
      ['Takes blood-pressure medicine', yesNo(treated), c.bpTreated, treated ? 1 : 0],
      ['(SBP − 120) / 10, untreated', `${sbp} mmHg`, c.sbpUntreated, treated ? 0 : (sbp - 120) / 10],
      ['(SBP − 120) / 10, on medicine', `${sbp} mmHg`, c.sbpTreated, treated ? (sbp - 120) / 10 : 0]
    ];
    const terms = rows.map(([label, input, beta, x]) => ({
      label, input, beta, x: round(x, 4), contribution: round(beta * x, 6)
    }));
    const L = rows.reduce((s, r) => s + r[2] * r[3], 0);
    const risk10 = 1 - Math.pow(c.S10, Math.exp(L - c.M));
    const risk5 = 1 - Math.pow(c.S5, Math.exp(L - c.M));

    const notes = [
      `${p.sex === 'male' ? 'Men' : 'Women'}: M = ${c.M}, Sb(10) = ${c.S10}. This person's L = ${L.toFixed(4)}.`,
      `5-year risk from the same equation: ${formatPercent(risk5)}.`
    ];
    if (read(person, 'strokeHistory') === undefined) notes.push('Assumes no previous stroke (not asked).');
    return computed(this, { value: risk10, display: formatPercent(risk10), terms, notes });
  }
};

// Exposed for checks.js: the linear predictor and risk for the Figure 4A examples.
export function fsrpLinear(sex, x) {
  const c = COEF[sex];
  const L = c.age10 * x.age / 10 + c.smoker * x.smoker + c.cvd * x.cvd + c.afib * x.afib
    + c.age65 * (x.age >= 65 ? 1 : 0)
    + c.diabetesUnder65 * (x.age < 65 && x.diabetes ? 1 : 0) + c.diabetes65 * (x.age >= 65 && x.diabetes ? 1 : 0)
    + c.bpTreated * (x.treated ? 1 : 0)
    + c.sbpUntreated * (x.treated ? 0 : (x.sbp - 120) / 10) + c.sbpTreated * (x.treated ? (x.sbp - 120) / 10 : 0);
  return { L, risk10: 1 - Math.pow(c.S10, Math.exp(L - c.M)) };
}
