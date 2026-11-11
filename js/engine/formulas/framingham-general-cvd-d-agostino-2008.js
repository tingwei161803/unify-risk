// Framingham general cardiovascular risk profile, lipid version, 10-year risk.
// D'Agostino RB Sr, et al. General cardiovascular risk profile for use in primary care:
// the Framingham Heart Study. Circulation 2008;117:743-753.
//
//   risk = 1 - S0 ^ exp(sum of beta x x - mean)
//
// Coefficients, S0 and mean are from the Framingham Heart Study's official page for this
// model ("Regression Coefficients and Hazard Ratios - Primary Model"), as recorded in the
// research file. UNCONFIRMED: they were not compared cell by cell with the journal table, and the
// paper's own worked example was not available, so no example from the paper is reproduced
// (the checks use self-computed values). x = ln(age), ln(total cholesterol mg/dL),
// ln(HDL mg/dL), ln(SBP) (treated and untreated have different beta), smoker, diabetes.

import { computed, gate, formatPercent, round, yesNo } from '../util.js';

const COEF = {
  female: { age: 2.32888, tc: 1.20904, hdl: -0.70833, sbpU: 2.76157, sbpT: 2.82263, smoker: 0.52873, diabetes: 0.69154, mean: 26.1931, s0: 0.95012 },
  male: { age: 3.06117, tc: 1.1237, hdl: -0.93263, sbpU: 1.93303, sbpT: 1.99881, smoker: 0.65451, diabetes: 0.57367, mean: 23.9802, s0: 0.88936 }
};

// Exposed for _group-cvd.js.
export function framinghamCvdRisk(sex, x) {
  const c = COEF[sex];
  const s = Math.log(x.sbp);
  const rows = [
    ['Ln age', `${x.age} years`, c.age, Math.log(x.age)],
    ['Ln total cholesterol', `${x.tc} mg/dL`, c.tc, Math.log(x.tc)],
    ['Ln HDL cholesterol', `${x.hdl} mg/dL`, c.hdl, Math.log(x.hdl)],
    ['Ln SBP, untreated', `${x.sbp} mmHg`, c.sbpU, x.treated ? 0 : s],
    ['Ln SBP, on blood-pressure medicine', `${x.sbp} mmHg`, c.sbpT, x.treated ? s : 0],
    ['Current smoker', yesNo(x.smoker), c.smoker, x.smoker ? 1 : 0],
    ['Diabetes', yesNo(x.diabetes), c.diabetes, x.diabetes ? 1 : 0]
  ];
  const sum = rows.reduce((t, r) => t + r[2] * r[3], 0);
  return { sum, risk: 1 - Math.pow(c.s0, Math.exp(sum - c.mean)), rows };
}

export const framinghamGeneralCvdDAgostino2008 = {
  id: 'framingham-general-cvd-d-agostino-2008',
  name: 'Framingham general CVD (2008)',
  disease: 'cardiovascular',
  outcome: 'Any cardiovascular event (coronary disease, stroke, TIA, peripheral artery disease, heart failure) within 10 years',
  horizonYears: 10,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [30, 74],
  population: 'Framingham Heart Study participants (US) aged 30–74 without cardiovascular disease at baseline.',
  source: {
    citation: 'D\'Agostino RB Sr, et al. General cardiovascular risk profile for use in primary care: the Framingham Heart Study. Circulation 2008;117:743–753. PMID 18212285. Coefficients: Framingham Heart Study official page, lipid model.',
    doi: ''
  },
  equation: '10-year risk = 1 − S0^exp(Σ β·x − mean), x = ln(age), ln(total cholesterol), ln(HDL), ln(SBP), smoker, diabetes (sex-specific β, S0 and mean)',
  inputs: ['age', 'sex', 'sbp', 'bpTreated', 'smoking', 'diabetes', 'labs.totalCholMgDl', 'labs.hdlMgDl'],

  compute(person) {
    const early = gate(this, person, (p) =>
      p.profile && p.profile.cvdHistory === true ? 'Already has cardiovascular disease; this formula estimates a first event.' : '');
    if (early) return early;

    const p = person.profile;
    const c = COEF[p.sex];
    const r = framinghamCvdRisk(p.sex, {
      age: Number(p.age), tc: Number(person.labs.totalCholMgDl), hdl: Number(person.labs.hdlMgDl),
      sbp: Number(p.sbp), treated: p.bpTreated === true, smoker: p.smoking === 'current', diabetes: p.diabetes === true
    });
    const terms = r.rows.map(([label, input, beta, x]) => ({
      label, input, beta, x: round(x, 4), contribution: round(beta * x, 6)
    }));
    const notes = [
      `${p.sex === 'male' ? 'Men' : 'Women'}: mean = ${c.mean}, S0(10) = ${c.s0}. This person's sum = ${r.sum.toFixed(4)}.`,
      'Former smokers count as non-smokers.',
      'Coefficients are from the Framingham Heart Study page for this model; not compared cell by cell with the journal table.'
    ];
    return computed(this, { value: r.risk, display: formatPercent(r.risk), terms, notes });
  }
};
