// Framingham hypertension score (Parikh 2008): 4-year risk of new hypertension.
// Parikh NI, et al. A risk score for predicting near-term incidence of hypertension: the Framingham Heart Study.
// Ann Intern Med 2008;148:102-110. Interval-censored Weibull model (accelerated failure
// time form: a NEGATIVE coefficient raises risk), Table 2 (PDF p.4, journal p.105) and Appendix (PDF p.10):
//   risk(t) = 1 - exp(-exp((ln t - mu) / scale)),  mu = intercept + sum(beta x),  t in years
// Also the points chart, Figure 2 (PDF p.5), used for the score shown in the notes.
//
// UNCONFIRMED COEFFICIENT: Table 2 prints the age x DBP interaction as 0.00162 (3 significant figures). The
// paper's own worked examples (Appendix) are only reproduced with 0.001624, which was solved back from those two
// examples (research file coefficients/framingham.json, beta_backsolved). 0.001624 is NOT a value published in the
// paper; it is used here so the printed examples match. With 0.00162 the 4-year risk is about 0.01 higher for the
// examples. All other numbers are as printed.

import { computed, gate, bmi, formatPercent, round } from '../util.js';

const B = {
  age: -0.15641, female: -0.20293, sbp: -0.05933, dbp: -0.12847, smoker: -0.19073,
  parents: -0.16612, bmi: -0.03388,
  ageDbp: 0.001624 // back-calculated; Table 2 prints 0.00162
};
const INTERCEPT = 22.94954;
const SCALE = 0.87692;

// Figure 2, PDF p.5: points -> 4-year risk.
const RISK4 = { "-12": 0.0022, "-11": 0.0027, "-10": 0.0031, "-9": 0.0037, "-8": 0.0044, "-7": 0.0052, "-6": 0.0062, 
   "-5": 0.0073, "-4": 0.0086, "-3": 0.0102, "-2": 0.0121, "-1": 0.0143, "0": 0.0169, "1": 0.02, "2": 0.0237, 
   "3": 0.028, "4": 0.0331, "5": 0.039, "6": 0.0461, "7": 0.0543, "8": 0.064, "9": 0.0753, "10": 0.0886, 
   "11": 0.104, "12": 0.122, "13": 0.1428, "14": 0.1668, "15": 0.1943, "16": 0.2258, "17": 0.2614, "18": 0.3016, 
   "19": 0.3463, "20": 0.3955, "21": 0.4491, "22": 0.5064, "23": 0.5666, "24": 0.6285, "25": 0.6905, "26": 0.7506, 
   "27": 0.8069, "28": 0.8574 };
// Figure 2 points: lower edges of categories 2..n.
const SBP = { lows: [110, 115, 120, 125, 130, 135], pts: [-4, 0, 2, 4, 6, 8, 10] };
const BMI_PTS = (b) => (b > 30 ? 3 : b >= 25 ? 1 : 0); // chart prints "25–30" and ">30"; 30 itself is put in 25–30
const FEMALE_PTS = 1;
const SMOKER_PTS = 1;
// Step 4: age band (rows 20-29, 30-39, 40-49, 50-59, 60-69, 70-79) by DBP (<70, 70-74, 75-79, 80-84, 85-89).
const AGE_DBP = [[-8, -3, 0, 3, 6], [-5, 0, 2, 5, 7], [-1, 3, 5, 6, 8], [3, 5, 7, 8, 9], [6, 8, 9, 10, 10], [10, 11, 11, 11, 11]];
const lowsCount = (lows, v) => lows.filter((l) => v >= l).length;

// x = { age, female (0/1), sbp, dbp, smoker (0/1), parents (0-2), bmi }
export function parikhRisk(x, t = 4) {
  const mu = INTERCEPT + B.age * x.age + B.female * x.female + B.sbp * x.sbp + B.dbp * x.dbp + B.smoker * x.smoker
    + B.parents * x.parents + B.bmi * x.bmi + B.ageDbp * x.age * x.dbp;
  return { mu, risk: 1 - Math.exp(-Math.exp((Math.log(t) - mu) / SCALE)) };
}
export function parikhPoints(x) {
  const ageDbp = AGE_DBP[Math.min(Math.max(Math.floor(x.age / 10) - 2, 0), 5)][lowsCount([70, 75, 80, 85], x.dbp)];
  const parts = [ageDbp, x.female ? FEMALE_PTS : 0, SBP.pts[lowsCount(SBP.lows, x.sbp)], x.smoker ? SMOKER_PTS : 0, x.parents, BMI_PTS(x.bmi)];
  const total = parts.reduce((s, v) => s + v, 0);
  return { parts, total, risk: RISK4[Math.min(Math.max(total, -12), 28)] };
}

export const framinghamHypertension = {
  id: 'framingham-hypertension-parikh-2008',
  name: 'Framingham hypertension score (Parikh 2008)',
  disease: 'hypertension',
  outcome: 'New hypertension within 4 years',
  horizonYears: 4,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [20, 69],
  population: 'Framingham Offspring Study: 1,717 white adults aged 20–69 without hypertension or diabetes. The paper says non-white and diabetic groups may not fit.',
  source: {
    citation: 'Parikh NI, et al. A risk score for predicting near-term incidence of hypertension: the Framingham Heart Study. Ann Intern Med 2008;148:102–110.',
    doi: '10.7326/0003-4819-148-2-200801150-00005'
  },
  equation: '4-year risk = 1 − exp(−exp((ln 4 − μ)/0.87692)); μ = 22.94954 − 0.15641·age − 0.20293·female − 0.05933·SBP − 0.12847·DBP − 0.19073·smoker − 0.16612·parents with hypertension − 0.03388·BMI + 0.001624·age·DBP',
  inputs: ['age', 'sex', 'sbp', 'dbp', 'smoking', 'parentsHypertension', 'heightCm', 'weightKg'],

  compute(person) {
    const early = gate(this, person, (p) => {
      const q = p.profile || {};
      if (q.diabetes === true) return 'Has diabetes; the model was built on people without diabetes.';
      if (q.bpTreated === true || Number(q.sbp) >= 140 || Number(q.dbp) >= 90) return 'Blood pressure is already 140/90 or more, or treated; this model estimates the chance of developing hypertension.';
      return '';
    });
    if (early) return early;
    const p = person.profile;
    const x = {
      age: Number(p.age), female: p.sex === 'female' ? 1 : 0, sbp: Number(p.sbp), dbp: Number(p.dbp),
      smoker: p.smoking === 'current' ? 1 : 0, parents: Math.min(Math.max(Math.round(Number(p.parentsHypertension)), 0), 2), bmi: bmi(p)
    };
    const { mu, risk } = parikhRisk(x);
    const pt = parikhPoints(x);
    const rows = [
      ['Age (per year)', `${x.age} years`, B.age, x.age], ['Female', p.sex, B.female, x.female], ['Systolic BP (per mmHg)', `${x.sbp} mmHg`, B.sbp, x.sbp],
      ['Diastolic BP (per mmHg)', `${x.dbp} mmHg`, B.dbp, x.dbp], ['Current smoker', p.smoking, B.smoker, x.smoker],
      ['Parents with hypertension (0, 1 or 2)', String(x.parents), B.parents, x.parents], ['BMI (per kg/m²)', `${round(x.bmi, 1)} kg/m²`, B.bmi, x.bmi],
      ['Age × diastolic BP', `${x.age} × ${x.dbp}`, B.ageDbp, x.age * x.dbp]
    ];
    const terms = rows.map(([label, input, beta, v]) => ({ label, input, beta, x: round(v, 3), contribution: round(beta * v, 5) }));
    const notes = [
      `μ = ${round(mu, 4)} (intercept ${INTERCEPT}, scale ${SCALE}). Negative coefficients mean higher risk.`,
      `Figure 2 points chart: ${pt.total} points → ${(pt.risk * 100).toFixed(2)}% at 4 years.`,
      'The age × diastolic BP coefficient is 0.001624, solved back from the paper\'s worked examples; Table 2 prints 0.00162. It is not a published value.',
      'Built on white adults in the US; the paper says non-white groups may not fit. Parents with hypertension is a count of 0, 1 or 2.',
      'Assumes the person does not have diabetes unless told.'
    ];
    return computed(this, { value: risk, display: formatPercent(risk), score: { points: pt.total, max: 28 }, terms, notes });
  }
};
