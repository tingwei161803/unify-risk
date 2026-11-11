// SCORE2-OP, 10-year risk of fatal or non-fatal cardiovascular disease in people aged 70 and over.
// SCORE2-OP working group and ESC Cardiovascular Risk Collaboration (de Vries TI, et al.).
// Eur Heart J 2021;42:2455-2467. Coefficients: Supplementary Methods Table 3 (per-unit form;
// the main-text Table 2 gives the same values with SBP per 10 mmHg). Baselines and the
// region scaling: Supplementary Methods Tables 1-2.
//
//   LP   = sum of beta x (x - centre)       centres: age 73, SBP 150, TC 6, HDL 1.4 (mmol/L)
//   raw  = 1 - S0 ^ exp(LP - meanLP)
//   risk = 1 - exp(-exp(scale1 + scale2 x ln(-ln(1 - raw))))     region scaling, Table 1
//
// Region: profile.region 'low' | 'moderate' | 'high' | 'very-high'. Anything else (including
// nothing) uses the LOW-risk region, and the notes say so. Taiwan is not in the paper's country
// list, so the region has to be a choice.
// Not used: the heart-failure multiplier (Supplementary Table 4), because the app has no field for it.
// UNCONFIRMED: the upper age limit is not stated in our literature notes (it says age 70 and over),
// so there is none. The paper's own calibrated example uses an older scaling than Table 1;
// this file uses Table 1 (see _group-cvd.js).

import { computed, gate, read, formatPercent, round, yesNo } from '../util.js';

const MMOL_PER_MGDL_TC = 0.02586; // mg/dL to mmol/L for total and HDL cholesterol

const COEF = {
  male: { age: 0.0634, dm: 0.4245, smoker: 0.3524, sbp: 0.0094, tc: 0.085, hdl: -0.3564,
    dmAge: -0.0174, smokerAge: -0.0247, sbpAge: -0.0005, tcAge: 0.0073, hdlAge: 0.0091,
    s0: 0.7576, meanLp: 0.0929 },
  female: { age: 0.0789, dm: 0.601, smoker: 0.4921, sbp: 0.0102, tc: 0.0605, hdl: -0.304,
    dmAge: -0.0107, smokerAge: -0.0255, sbpAge: -0.0004, tcAge: -0.0009, hdlAge: 0.0154,
    s0: 0.8082, meanLp: 0.229 }
};

// Supplementary Methods Table 1: [scale1, scale2] per region.
const SCALES = {
  low: { male: [-0.34, 1.19], female: [-0.52, 1.01] },
  moderate: { male: [0.01, 1.25], female: [-0.1, 1.1] },
  high: { male: [0.08, 1.15], female: [0.38, 1.09] },
  'very-high': { male: [0.05, 0.7], female: [0.38, 0.69] }
};

// Exposed for _group-cvd.js. x: { age, sbp, tc, hdl (mmol/L), smoker, diabetes }. region null = uncalibrated.
export function score2OpRisk(sex, x, region) {
  const c = COEF[sex];
  const da = x.age - 73, ds = x.sbp - 150, dt = x.tc - 6, dh = x.hdl - 1.4;
  const dm = x.diabetes ? 1 : 0, sm = x.smoker ? 1 : 0;
  const rows = [
    ['Age (years above 73)', `${x.age} years`, c.age, da],
    ['Diabetes', yesNo(dm), c.dm, dm],
    ['Current smoker', yesNo(sm), c.smoker, sm],
    ['SBP (mmHg above 150)', `${x.sbp} mmHg`, c.sbp, ds],
    ['Total cholesterol (mmol/L above 6)', `${round(x.tc, 2)} mmol/L`, c.tc, dt],
    ['HDL cholesterol (mmol/L above 1.4)', `${round(x.hdl, 2)} mmol/L`, c.hdl, dh],
    ['Diabetes × age', '', c.dmAge, dm * da],
    ['Smoker × age', '', c.smokerAge, sm * da],
    ['SBP × age', '', c.sbpAge, ds * da],
    ['Total cholesterol × age', '', c.tcAge, dt * da],
    ['HDL cholesterol × age', '', c.hdlAge, dh * da]
  ];
  const lp = rows.reduce((t, r) => t + r[2] * r[3], 0);
  const raw = 1 - Math.pow(c.s0, Math.exp(lp - c.meanLp));
  if (!region) return { lp, raw, risk: raw, rows };
  const [s1, s2] = SCALES[region][sex];
  return { lp, raw, risk: 1 - Math.exp(-Math.exp(s1 + s2 * Math.log(-Math.log(1 - raw)))), rows };
}

export const score2Op = {
  id: 'score2-op',
  name: 'SCORE2-OP (older people)',
  disease: 'cardiovascular',
  outcome: 'Fatal or non-fatal cardiovascular disease within 10 years',
  horizonYears: 10,
  kind: 'risk',
  derivedIn: 'EU',
  ageRange: [70, null],
  population: 'European cohorts of adults aged 70 and over without cardiovascular disease; recalibrated to four risk regions of Europe.',
  source: {
    citation: 'SCORE2-OP working group and ESC Cardiovascular Risk Collaboration. SCORE2-OP risk prediction algorithms: estimating incident cardiovascular event risk in older persons in four geographical risk regions. Eur Heart J 2021;42:2455–2467.',
    doi: '10.1093/eurheartj/ehab312'
  },
  equation: 'LP = Σ β·(x − centre); raw risk = 1 − S0^exp(LP − meanLP); risk = 1 − exp(−exp(scale1 + scale2·ln(−ln(1 − raw)))) for the risk region',
  inputs: ['age', 'sex', 'sbp', 'smoking', 'diabetes', 'labs.totalCholMgDl', 'labs.hdlMgDl'],

  compute(person) {
    const early = gate(this, person, (p) =>
      p.profile && p.profile.cvdHistory === true ? 'Already has cardiovascular disease; SCORE2-OP estimates a first event.' : '');
    if (early) return early;

    const p = person.profile;
    const asked = read(person, 'region');
    const region = SCALES[asked] ? asked : 'low';
    const r = score2OpRisk(p.sex, {
      age: Number(p.age), sbp: Number(p.sbp),
      tc: Number(person.labs.totalCholMgDl) * MMOL_PER_MGDL_TC, hdl: Number(person.labs.hdlMgDl) * MMOL_PER_MGDL_TC,
      smoker: p.smoking === 'current', diabetes: p.diabetes === true
    }, region);
    const terms = r.rows.map(([label, input, beta, x]) => ({
      label, input, beta, x: round(x, 4), contribution: round(beta * x, 6)
    }));
    const c = COEF[p.sex];
    const [s1, s2] = SCALES[region][p.sex];
    const notes = [
      SCALES[asked]
        ? `Risk region: ${region}.`
        : 'No risk region entered, so the LOW-risk region was used. Taiwan is not in the paper\'s country list.',
      `Linear predictor = ${r.lp.toFixed(4)}; uncalibrated risk = ${formatPercent(r.raw)}. S0 = ${c.s0}, meanLP = ${c.meanLp}, scale = (${s1}, ${s2}).`,
      'The heart-failure adjustment in the paper is not applied.',
      'Cholesterol is converted from mg/dL to mmol/L.'
    ];
    return computed(this, { value: r.risk, display: formatPercent(r.risk), terms, notes });
  }
};
