// Kidney Failure Risk Equation, 4 variables (KFRE 2016): risk of kidney failure (dialysis or transplant).
// Tangri N, Grams ME, Levey AS, et al. Multinational assessment of accuracy of equations for predicting risk of
// kidney failure: a meta-analysis. JAMA 2016;315:164-174. Coefficients, centring values and baseline survival:
// eAppendix 2 (Supplement pp.9-10), as recorded in the research file coefficients/kfre-2.json; the 4-variable
// original version was also run against the official kidneyfailurerisk.com calculator code.
//   risk(t) = 1 - S(t) ^ exp(sum(beta x (value - centre)))
//   values: age/10, male = 1, eGFR/5, ln(urine albumin-to-creatinine ratio in mg/g)
// For adults with existing CKD stage 3-5 only. "Original" baseline = the "North America" option on the website.
// The non-North-America calibrated baseline is shown in the notes (Taiwan is not in North America).

import { computed, gate, read, formatPercent, round, notApplicable } from '../util.js';

// eAppendix 2, 4-variable original: [beta, centring value].
const TERMS = {
  age: [-0.2201, 7.036],
  male: [0.2467, 0.5642],
  egfr: [-0.5567, 7.222],
  lacr: [0.451, 5.137]
};
// Baseline survival S(t): original, and calibrated for regions outside North America.
const S0 = {
  original: { 2: 0.975, 5: 0.924 },
  nonNorthAmerica: { 2: 0.9832, 5: 0.9365 }
};

// x = { age (years), male (0/1), egfr, acrMgG }. Returns risk at 2 and 5 years for both baselines.
export function kfreRisk(x) {
  const v = { age: x.age / 10, male: x.male, egfr: x.egfr / 5, lacr: Math.log(x.acrMgG) };
  const lp = Object.keys(TERMS).reduce((s, k) => s + TERMS[k][0] * (v[k] - TERMS[k][1]), 0);
  const r = (S) => 1 - Math.pow(S, Math.exp(lp));
  return { lp, v, orig: { 2: r(S0.original[2]), 5: r(S0.original[5]) }, nonNA: { 2: r(S0.nonNorthAmerica[2]), 5: r(S0.nonNorthAmerica[5]) } };
}

export const kfre = {
  id: 'kfre',
  name: 'Kidney failure risk (KFRE, 4 variables)',
  disease: 'kidney',
  outcome: 'Kidney failure (dialysis or transplant) within 5 years',
  horizonYears: 5,
  kind: 'risk',
  derivedIn: 'EU',
  ageRange: [null, null],
  population: 'Adults with chronic kidney disease stage 3–5 (eGFR 15–59) referred to kidney clinics: 31 cohorts in 30 countries (721,357 people, 23,829 kidney failures). Not for people without CKD.',
  source: {
    citation: 'Tangri N, Grams ME, Levey AS, et al. Multinational assessment of accuracy of equations for predicting risk of kidney failure: a meta-analysis. JAMA 2016;315:164–174.',
    doi: '10.1001/jama.2015.18202'
  },
  equation: 'risk(t) = 1 − S(t)^exp(Σβ·(x − centre)); −0.2201·(age/10 − 7.036) + 0.2467·(male − 0.5642) − 0.5567·(eGFR/5 − 7.222) + 0.451·(ln ACR − 5.137); S(5) = 0.924, S(2) = 0.975',
  inputs: ['age', 'sex', 'labs.egfr', 'labs.uacrMgG'],

  compute(person) {
    const early = gate(this, person, (pp) => {
      const stage = read(pp, 'ckdStage');
      const egfr = read(pp, 'labs.egfr');
      if (stage !== undefined && stage !== null && stage !== '') {
        if (!(Number(stage) >= 3 && Number(stage) <= 5)) return 'This equation is for people with chronic kidney disease stage 3 to 5; the stage given is outside that.';
      } else if (egfr !== undefined && egfr !== null && egfr !== '' && Number(egfr) >= 60) {
        return 'No known chronic kidney disease stage 3 to 5 (eGFR is 60 or more); this equation is only for people who already have it.';
      }
      return '';
    });
    if (early) return early;
    const p = person.profile;
    const l = person.labs;
    if (Number(l.uacrMgG) <= 0) return notApplicable(this, 'The urine albumin-to-creatinine ratio must be above 0 mg/g (the equation uses its logarithm).');
    const hasStage = read(person, 'ckdStage') !== undefined && read(person, 'ckdStage') !== null && read(person, 'ckdStage') !== '';
    const x = { age: Number(p.age), male: p.sex === 'male' ? 1 : 0, egfr: Number(l.egfr), acrMgG: Number(l.uacrMgG) };
    const { lp, v, orig, nonNA } = kfreRisk(x);
    const rows = [
      ['Age / 10', `${x.age} years`, 'age'], ['Male', p.sex, 'male'], ['eGFR / 5', `${x.egfr} mL/min/1.73 m²`, 'egfr'], ['ln(urine ACR, mg/g)', `${x.acrMgG} mg/g`, 'lacr']
    ];
    const terms = rows.map(([label, input, k]) => ({
      label, input, beta: TERMS[k][0], x: round(v[k] - TERMS[k][1], 4), contribution: round(TERMS[k][0] * (v[k] - TERMS[k][1]), 5)
    }));
    const notes = [
      `5-year risk: ${formatPercent(orig[5])} with the original baseline (the website's "North America" option); ${formatPercent(nonNA[5])} with the baseline calibrated for regions outside North America.`,
      `2-year risk: ${formatPercent(orig[2])} (original) and ${formatPercent(nonNA[2])} (outside North America).`,
      `Linear predictor ${round(lp, 4)}. Built on clinic patients with CKD stage 3–5; the shown value uses the original baseline. Taiwan was not calibrated separately.`,
      hasStage ? 'CKD stage taken from the answer given.' : 'CKD stage not given; eGFR below 60 is taken as stage 3–5.'
    ];
    return computed(this, { value: orig[5], display: formatPercent(orig[5]), terms, notes });
  }
};
