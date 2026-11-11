// Chin-Shan (Taiwan) type 2 diabetes score: 10-year risk of diabetes from a points table.
// Chien K, et al. A prediction model for type 2 diabetes risk among Chinese people. Diabetologia 2009;52:443-450
// (online 2008).
// Cox model turned into points (Table 2); total points -> 10-year risk (Table 3). Men and women together; sex
// is not in the model. The paper does not print S0(10), so only the printed Table 3 risks can be used.
// Units in the paper are mmol/L (TG, HDL, glucose) and 10^9/L (white blood cells); mg/dL inputs are converted
// with the factors printed in Wilson 2007 (HDL x 0.0259, glucose x 0.0555, TG x 0.0113).
// Category edges in Table 2 touch or overlap (BMI 21-22 / 22-24 / 24-26; TG 0.93-1.19 / 1.19-1.71); the paper
// does not say which side an edge value belongs to. Lower edge included, upper excluded (unconfirmed).

import { computed, gate, bmi, round } from '../util.js';

// Table 3 (PDF p.4): total points -> 10-year risk.
const RISK = { "-15": 0.05, "-14": 0.05, "-13": 0.06, "-12": 0.06, "-11": 0.07, "-10": 0.07, "-9": 0.08, "-8": 0.09, 
   "-7": 0.09, "-6": 0.1, "-5": 0.11, "-4": 0.11, "-3": 0.12, "-2": 0.13, "-1": 0.14, "0": 0.15, "1": 0.16, 
   "2": 0.18, "3": 0.19, "4": 0.2, "5": 0.22, "6": 0.23, "7": 0.25, "8": 0.26, "9": 0.28, "10": 0.3, "11": 0.32, 
   "12": 0.34, "13": 0.36, "14": 0.39, "15": 0.41, "16": 0.43, "17": 0.46, "18": 0.48, "19": 0.51, "20": 0.54, 
   "21": 0.57, "22": 0.59, "23": 0.62, "24": 0.65, "25": 0.68, "26": 0.71, "27": 0.73, "28": 0.76, "29": 0.79, 
   "30": 0.81, "31": 0.84, "32": 0.86 };

// Table 2 (PDF p.3): lower edges of categories 2..n, and points for every category.
const AGE = { lows: [45, 55, 65, 75], pts: [-1, 0, 1, 2, 3] };
const BMI = { lows: [21, 22, 24, 26], pts: [-3, 0, 2, 4, 8] };
const WBC = { lows: [4.9, 5.7, 6.4, 7.5], pts: [-1, 0, 1, 2, 4] };
const TG = { lows: [0.7, 0.93, 1.19, 1.72], pts: [-1, 0, 0, 1, 5] };
const HDL = { lows: [0.98, 1.14, 1.3, 1.5], pts: [1, 0, -1, -2, -4] };
const GLU = { lows: [5.16, 5.44, 5.72, 6.11], pts: [-5, 0, 3, 6, 11] };
const pts = (t, v) => t.pts[t.lows.filter((l) => v >= l).length];

// x in paper units: age years, bmi kg/m2, wbc 10^9/L, tg/hdl/glu mmol/L.
export function chienDiabetesPoints(x) {
  const parts = [pts(AGE, x.age), pts(BMI, x.bmi), pts(WBC, x.wbc), pts(TG, x.tg), pts(HDL, x.hdl), pts(GLU, x.glu)];
  return { parts, total: parts.reduce((s, v) => s + v, 0) };
}
export const chienDiabetesRisk = (points) => RISK[Math.min(Math.max(points, -15), 32)];

export const chinShanDiabetes = {
  id: 'chin-shan-diabetes-chien-2008',
  name: 'Chin-Shan diabetes score (Taiwan)',
  disease: 'diabetes',
  outcome: 'Type 2 diabetes within 10 years',
  horizonYears: 10,
  kind: 'risk',
  derivedIn: 'TW',
  ageRange: [35, null],
  population: 'Chin-Shan Community Cardiovascular Cohort, Taiwan: 2,960 ethnic Chinese adults aged 35 and over without diabetes at baseline (548 new cases).',
  source: {
    citation: 'Chien K, et al. A prediction model for type 2 diabetes risk among Chinese people. Diabetologia 2009;52:443–450.',
    doi: '10.1007/s00125-008-1232-4'
  },
  equation: 'score = Σ points of 6 items (age, BMI, white blood cells, triglycerides, HDL, fasting glucose; −15 to 32); 10-year risk = the value printed in Table 3 for that score',
  inputs: ['age', 'heightCm', 'weightKg', 'labs.wbcK', 'labs.tgMgDl', 'labs.hdlMgDl', 'labs.fastingGlucoseMgDl'],

  compute(person) {
    const early = gate(this, person, (p) =>
      p.profile && p.profile.diabetes === true ? 'Already has diabetes; this score estimates the chance of developing it.' : '');
    if (early) return early;
    const p = person.profile;
    const l = person.labs;
    const x = {
      age: Number(p.age), bmi: bmi(p), wbc: Number(l.wbcK), tg: Number(l.tgMgDl) * 0.0113,
      hdl: Number(l.hdlMgDl) * 0.0259, glu: Number(l.fastingGlucoseMgDl) * 0.0555
    };
    const { parts, total } = chienDiabetesPoints(x);
    const risk = chienDiabetesRisk(total);
    const labels = [
      ['Age', `${x.age} years`], ['BMI', `${round(x.bmi, 1)} kg/m²`],
      ['White blood cell count', `${l.wbcK} ×10³/µL`], ['Triglycerides', `${l.tgMgDl} mg/dL = ${round(x.tg, 2)} mmol/L`],
      ['HDL cholesterol', `${l.hdlMgDl} mg/dL = ${round(x.hdl, 2)} mmol/L`], ['Fasting glucose', `${l.fastingGlucoseMgDl} mg/dL = ${round(x.glu, 2)} mmol/L`]
    ];
    const terms = labels.map(([label, input], i) => ({ label, input, points: parts[i] }));
    const notes = [
      `Table 3: ${total} points → ${Math.round(risk * 100)}% developed type 2 diabetes within 10 years.`,
      'Needs a blood test: white blood cells, triglycerides, HDL and fasting glucose.',
      'Unit conversions from mg/dL use the factors printed in Wilson 2007 (not in this paper).',
      'The paper does not say which category an edge value belongs to; the lower edge is included here (unconfirmed).',
      'The paper does not print S0(10), so no continuous risk can be computed; only the printed Table 3 values are used.'
    ];
    return computed(this, { value: risk, display: `${Math.round(risk * 100)}%`, score: { points: total, max: 32 }, terms, notes });
  }
};
