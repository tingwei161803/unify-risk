// Otsuka 2015: 4-year risk of new hypertension in Japanese men, direct equation plus the Figure 2 points chart.
// Otsuka T, et al. Development of a risk prediction model for incident hypertension in a working-age Japanese male
// population. Hypertens Res 2015;38:419-425. Cox model without interaction terms (the DBP x age interaction tested in the paper is not in the published equation).
//   risk(4y) = 1 - S0(4) ^ exp(sum(beta x) - sum(beta x mean)),  S0(4) = 0.963,  sum(beta x mean) = 17.119
// Coefficients: Table 2, multivariable column (PDF p.3). Means and the 17.119 constant: Appendix, PDF p.7
// (journal p.425). Points chart: Figure 2, PDF p.4. Men only. Heavy drinking = drinking 6 or more days a week;
// current smoking = regular daily smoking.

import { computed, gate, read, bmi, formatPercent, round } from '../util.js';

const COEF = {
  age: { beta: 0.04, mean: 38.87 },
  bmi: { beta: 0.071, mean: 22.756 },
  sbp: { beta: 0.061, mean: 115.55 },
  dbp: { beta: 0.096, mean: 70.12 },
  smoker: { beta: 0.242, mean: 0.31 },
  heavyDrinking: { beta: 0.202, mean: 0.164 },
  parent: { beta: 0.282, mean: 0.213 }
};
const S0_4 = 0.963;
const SUM_BETA_XBAR = 17.119;

// Figure 2: lower edges of categories 2..n and points for every category.
const AGE = { lows: [23, 27, 31, 35, 39, 43, 47, 51, 55, 59], pts: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] };
const SBP = { lows: [110, 115, 120, 125, 130, 135], pts: [-4, 0, 2, 4, 6, 8, 10] };
const DBP = { lows: [65, 70, 75, 80, 85], pts: [-6, 0, 3, 6, 9, 12] };
const BMI = { lows: [21, 23, 25, 27, 30], pts: [-1, 0, 1, 2, 3, 4] };
const SMOKER_PTS = 2;
const DRINK_PTS = 1;
const PARENT_PTS = 2;
const pts = (t, v) => t.pts[t.lows.filter((l) => v >= l).length];
// Figure 2 total -> printed 4-year risk band.
const BANDS = [
  { max: -5, label: 'under 1%' }, { max: 6, label: '1% to under 5%' }, { max: 10, label: '5% to under 10%' },
  { max: 15, label: '10% to under 20%' }, { max: 18, label: '20% to under 30%' }, { max: 20, label: '30% to under 40%' },
  { max: 22, label: '40% to under 50%' }, { max: 24, label: '50% to under 60%' }, { max: Infinity, label: '60% or more' }
];

// x = { age, bmi, sbp, dbp, smoker, heavyDrinking, parent } (0/1 for the last three).
export function otsukaSum(x) {
  return Object.keys(COEF).reduce((s, k) => s + COEF[k].beta * x[k], 0);
}
export const otsukaRisk = (sum) => 1 - Math.pow(S0_4, Math.exp(sum - SUM_BETA_XBAR));
export function otsukaPoints(x) {
  const parts = [pts(AGE, x.age), pts(SBP, x.sbp), pts(DBP, x.dbp), pts(BMI, x.bmi),
    x.smoker ? SMOKER_PTS : 0, x.heavyDrinking ? DRINK_PTS : 0, x.parent ? PARENT_PTS : 0];
  const total = parts.reduce((s, v) => s + v, 0);
  return { parts, total, band: BANDS.find((b) => total <= b.max).label };
}

export const otsuka2015 = {
  id: 'otsuka-2015',
  name: 'Otsuka 2015 hypertension model (men)',
  disease: 'hypertension',
  outcome: 'New high blood pressure within 4 years (140/90 or more, or starting medicine)',
  horizonYears: 4,
  kind: 'risk',
  derivedIn: 'JP',
  ageRange: [19, 63],
  population: 'Japanese male company employees aged 19–63 at a 2008 health check (15,025 men, 1,633 new cases); no hypertension, cardiovascular disease or cancer at baseline. Men only.',
  source: {
    citation: 'Otsuka T, et al. Development of a risk prediction model for incident hypertension in a working-age Japanese male population. Hypertens Res 2015;38:419–425. (Corrected after online publication; the corrigendum concerns Table 1 and Supplementary Table 2 only.)',
    doi: '10.1038/hr.2014.159'
  },
  equation: '4-year risk = 1 − 0.963^exp(Σβx − 17.119); Σβx = 0.04·age + 0.071·BMI + 0.061·SBP + 0.096·DBP + 0.242·smoker + 0.202·heavy drinking + 0.282·parent with hypertension',
  inputs: ['age', 'sex', 'heightCm', 'weightKg', 'sbp', 'dbp', 'smoking', 'heavyDrinking', 'parentsHypertension'],

  compute(person) {
    const early = gate(this, person, (p) => {
      const q = p.profile || {};
      if (q.sex === 'female') return 'This model was built on men only.';
      if (q.bpTreated === true || Number(q.sbp) >= 140 || Number(q.dbp) >= 90) return 'Blood pressure is already 140/90 or more, or treated; this model estimates the chance of developing it.';
      if (q.cvdHistory === true) return 'Has heart disease; the model excluded people with cardiovascular disease.';
      return '';
    });
    if (early) return early;
    const p = person.profile;
    const x = {
      age: Number(p.age), bmi: bmi(p), sbp: Number(p.sbp), dbp: Number(p.dbp), smoker: p.smoking === 'current' ? 1 : 0,
      heavyDrinking: p.heavyDrinking === true ? 1 : 0, parent: Number(p.parentsHypertension) > 0 ? 1 : 0
    };
    const sum = otsukaSum(x);
    const risk = otsukaRisk(sum);
    const { total, band } = otsukaPoints(x);
    const inputs = { age: `${x.age} years`, bmi: `${round(x.bmi, 1)} kg/m²`, sbp: `${x.sbp} mmHg`, dbp: `${x.dbp} mmHg`,
      smoker: p.smoking, heavyDrinking: x.heavyDrinking ? 'yes' : 'no', parent: x.parent ? 'yes' : 'no' };
    const labels = { age: 'Age (per year)', bmi: 'BMI (per kg/m²)', sbp: 'Systolic BP (per mmHg)', dbp: 'Diastolic BP (per mmHg)',
      smoker: 'Current smoker', heavyDrinking: 'Drinks 6 or more days a week', parent: 'Parent with hypertension' };
    const terms = Object.keys(COEF).map((k) => ({ label: labels[k], input: inputs[k], beta: COEF[k].beta, x: round(x[k], 3), contribution: round(COEF[k].beta * x[k], 4) }));
    const notes = [
      `Σβx = ${round(sum, 4)}; minus 17.119 = ${round(sum - SUM_BETA_XBAR, 4)}; S0(4) = 0.963.`,
      `Figure 2 points chart: ${total} points → ${band}. The paper notes the chart and the direct equation can differ slightly.`,
      'Built on Japanese male employees only; internal validation only (C 0.861), no calibration ratio published.',
      'Heavy drinking means drinking 6 or more days a week, and smoking means regular daily smoking; the app maps "current smoker" to the second. A parent with hypertension counts when at least one parent has it.',
      'Assumes no history of cancer (not asked).'
    ];
    return computed(this, { value: risk, display: formatPercent(risk), terms, notes });
  }
};
