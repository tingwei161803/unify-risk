// AHA PREVENT base model, 10-year risk (total CVD, ASCVD, heart failure).
// Khan SS, et al. Development and Validation of the American Heart Association's PREVENT
// Equations. Circulation 2024;149:430-449.
//
//   risk = exp(x) / (1 + exp(x)),   x = constant + sum of coefficient x term
//
// The coefficients are the "Table S12A Base 10yr" rows of the paper's supplement (the
// 10-year base model; sex-specific; one column per outcome), copied from
// prevent-s12-coefficients.csv. A blank cell in
// that table means the outcome has no such term, so it is left out here.
//
// NOT IN THE CSV: how each term is centred and scaled. The CSV only names the unit
// ("per 10 years", "per 0.3 mmol/L", ...). The centring below (age 55, non-HDL 3.5 mmol/L,
// HDL 1.3 mmol/L, SBP 110 and 130, BMI 25 and 30, eGFR 60 and 90) is taken from the
// our literature notes, and it
// is confirmed by the worked examples reproduced in _group-cvd.js (Supplemental Table
// S25 and the main-text example). The cholesterol unit conversion 0.02586 is the standard
// mg/dL to mmol/L factor.
//
// Only the base model is built here: no UACR, HbA1c or social-deprivation add-ons.
// eGFR is read from labs.egfr; it is not computed from creatinine.

import { computed, gate, bmi, formatPercent, round, yesNo } from '../util.js';

const COEF = {
  cvd: {
    female: {
      age: 0.7939329, nonhdl: 0.0305239, hdl: -0.1606857, sbpLo: -0.2394003, sbpHi: 0.3600781, dm: 0.8667604, smoke: 0.5360739, egfrLo: 0.6045917, egfrHi: 0.0433769, htn: 0.3151672, statin: -0.1477655, htnSbp: -0.0663612, statinNonhdl: 0.1197879, ageNonhdl: -0.0819715, ageHdl: 0.0306769, ageSbp: -0.0946348, ageDm: -0.27057, ageSmoke: -0.078715, ageEgfr: -0.1637806, c: -3.307728
    },
    male: {
      age: 0.7688528, nonhdl: 0.0736174, hdl: -0.0954431, sbpLo: -0.4347345, sbpHi: 0.3362658, dm: 0.7692857, smoke: 0.4386871, egfrLo: 0.5378979, egfrHi: 0.0164827, htn: 0.288879, statin: -0.1337349, htnSbp: -0.0475924, statinNonhdl: 0.150273, ageNonhdl: -0.0517874, ageHdl: 0.0191169, ageSbp: -0.1049477, ageDm: -0.2251948, ageSmoke: -0.0895067, ageEgfr: -0.1543702, c: -3.031168
    }
  },
  ascvd: {
    female: {
      age: 0.719883, nonhdl: 0.1176967, hdl: -0.151185, sbpLo: -0.0835358, sbpHi: 0.3592852, dm: 0.8348585, smoke: 0.4831078, egfrLo: 0.4864619, egfrHi: 0.0397779, htn: 0.2265309, statin: -0.0592374, htnSbp: -0.0395762, statinNonhdl: 0.0844423, ageNonhdl: -0.0567839, ageHdl: 0.0325692, ageSbp: -0.1035985, ageDm: -0.2417542, ageSmoke: -0.0791142, ageEgfr: -0.1671492, c: -3.819975
    },
    male: {
      age: 0.7099847, nonhdl: 0.1658663, hdl: -0.1144285, sbpLo: -0.2837212, sbpHi: 0.3239977, dm: 0.7189597, smoke: 0.3956973, egfrLo: 0.3690075, egfrHi: 0.0203619, htn: 0.2036522, statin: -0.0865581, htnSbp: -0.0322916, statinNonhdl: 0.114563, ageNonhdl: -0.0300005, ageHdl: 0.0232747, ageSbp: -0.0927024, ageDm: -0.2018525, ageSmoke: -0.0970527, ageEgfr: -0.1217081, c: -3.500655
    }
  },
  hf: {
    female: {
      age: 0.8998235, sbpLo: -0.4559771, sbpHi: 0.3576505, dm: 1.038346, smoke: 0.583916, bmiLo: -0.0072294, bmiHi: 0.2997706, egfrLo: 0.7451638, egfrHi: 0.0557087, htn: 0.3534442, htnSbp: -0.0981511, ageSbp: -0.0946663, ageDm: -0.3581041, ageSmoke: -0.1159453, ageBmi: -0.003878, ageEgfr: -0.1884289, c: -4.310409
    },
    male: {
      age: 0.8972642, sbpLo: -0.6811466, sbpHi: 0.3634461, dm: 0.923776, smoke: 0.5023736, bmiLo: -0.0485841, bmiHi: 0.3726929, egfrLo: 0.6926917, egfrHi: 0.0251827, htn: 0.2980922, htnSbp: -0.0497731, ageSbp: -0.1289201, ageDm: -0.3040924, ageSmoke: -0.1401688, ageBmi: 0.0068126, ageEgfr: -0.1797778, c: -3.946391
    }
  }
};

const MMOL_PER_MGDL = 0.02586;

// Every term in the order of Table S12A: [key, label, how the person's value is shown].
const TERMS = [
  ['age', 'Age (per 10 years, centred at 55)'],
  ['nonhdl', 'Non-HDL cholesterol (per 1 mmol/L, centred at 3.5)'],
  ['hdl', 'HDL cholesterol (per 0.3 mmol/L, centred at 1.3)'],
  ['sbpLo', 'SBP below 110 (per 20 mmHg)'],
  ['sbpHi', 'SBP 110 or above (per 20 mmHg, centred at 130)'],
  ['dm', 'Diabetes'],
  ['smoke', 'Current smoker'],
  ['bmiLo', 'BMI below 30 (per 5 kg/m², centred at 25)'],
  ['bmiHi', 'BMI 30 or above (per 5 kg/m², centred at 30)'],
  ['egfrLo', 'eGFR below 60 (per −15 mL/min/1.73 m²)'],
  ['egfrHi', 'eGFR 60 or above (per −15, centred at 90)'],
  ['htn', 'Takes blood-pressure medicine'],
  ['statin', 'Takes a statin'],
  ['htnSbp', 'Treated: SBP 110 or above (per 20 mmHg)'],
  ['statinNonhdl', 'Treated with statin: non-HDL cholesterol'],
  ['ageNonhdl', 'Age × non-HDL cholesterol'],
  ['ageHdl', 'Age × HDL cholesterol'],
  ['ageSbp', 'Age × SBP 110 or above'],
  ['ageDm', 'Age × diabetes'],
  ['ageSmoke', 'Age × current smoker'],
  ['ageBmi', 'Age × BMI 30 or above'],
  ['ageEgfr', 'Age × eGFR below 60']
];

// The terms as numbers from plain clinical values (cholesterol in mmol/L, BMI null when unknown).
export function preventTerms(v) {
  const A = (v.age - 55) / 10;
  const nonhdl = v.nonHdlMmol - 3.5;
  const hdl = (v.hdlMmol - 1.3) / 0.3;
  const sbpLo = (Math.min(v.sbp, 110) - 110) / 20;
  const sbpHi = (Math.max(v.sbp, 110) - 130) / 20;
  const egfrLo = (Math.min(v.egfr, 60) - 60) / -15;
  const egfrHi = (Math.max(v.egfr, 60) - 90) / -15;
  const dm = v.diabetes ? 1 : 0;
  const smoke = v.smoker ? 1 : 0;
  const htn = v.treated ? 1 : 0;
  const statin = v.statin ? 1 : 0;
  const x = {
    age: A, nonhdl, hdl, sbpLo, sbpHi, dm, smoke, egfrLo, egfrHi, htn, statin,
    htnSbp: htn * sbpHi, statinNonhdl: statin * nonhdl,
    ageNonhdl: A * nonhdl, ageHdl: A * hdl, ageSbp: A * sbpHi, ageDm: A * dm,
    ageSmoke: A * smoke, ageEgfr: A * egfrLo
  };
  if (v.bmi !== null && v.bmi !== undefined) {
    x.bmiLo = (Math.min(v.bmi, 30) - 25) / 5;
    x.bmiHi = (Math.max(v.bmi, 30) - 30) / 5;
    x.ageBmi = A * x.bmiHi;
  }
  return x;
}

// Exposed for _group-cvd.js: log-odds and risk for one outcome ('cvd' | 'ascvd' | 'hf').
export function preventRisk(outcome, sex, v) {
  const c = COEF[outcome][sex];
  const x = preventTerms(v);
  let logOdds = c.c;
  for (const [key] of TERMS) if (c[key] !== undefined) logOdds += c[key] * x[key];
  return { logOdds, risk: Math.exp(logOdds) / (1 + Math.exp(logOdds)), x };
}

function make(opts) {
  const { id, name, key, outcome, extraInputs } = opts;
  return {
    id,
    name,
    disease: 'cardiovascular',
    outcome,
    horizonYears: 10,
    kind: 'risk',
    derivedIn: 'US',
    ageRange: [30, 79],
    population: 'US adults aged 30–79 without known cardiovascular disease; checked externally in Kaiser Permanente, MESA and other cohorts.',
    source: {
      citation: 'Khan SS, et al. Development and Validation of the American Heart Association\'s PREVENT Equations. Circulation 2024;149:430–449. Coefficients: Supplemental Table S12A (10-year base model).',
      doi: '10.1161/CIRCULATIONAHA.123.067626'
    },
    equation: '10-year risk = e^x / (1 + e^x), x = constant + Σ β·term (sex-specific β, Supplemental Table S12A, base model)',
    inputs: ['age', 'sex', 'sbp', 'bpTreated', 'statin', 'diabetes', 'smoking',
      'labs.totalCholMgDl', 'labs.hdlMgDl', 'labs.egfr', ...extraInputs],

    compute(person) {
      const early = gate(this, person, (p) =>
        p.profile && p.profile.cvdHistory === true ? 'Already has cardiovascular disease; PREVENT estimates a first event.' : '');
      if (early) return early;

      const p = person.profile;
      const l = person.labs;
      const tc = Number(l.totalCholMgDl);
      const hdlMg = Number(l.hdlMgDl);
      const v = {
        age: Number(p.age), sbp: Number(p.sbp), egfr: Number(l.egfr),
        nonHdlMmol: (tc - hdlMg) * MMOL_PER_MGDL, hdlMmol: hdlMg * MMOL_PER_MGDL,
        diabetes: p.diabetes === true, smoker: p.smoking === 'current',
        treated: p.bpTreated === true, statin: p.statin === true,
        bmi: key === 'hf' ? bmi(p) : null
      };
      const c = COEF[key][p.sex];
      const x = preventTerms(v);
      const shown = {
        age: `${v.age} years`, nonhdl: `${round(v.nonHdlMmol, 2)} mmol/L`, hdl: `${round(v.hdlMmol, 2)} mmol/L`,
        sbpLo: `${v.sbp} mmHg`, sbpHi: `${v.sbp} mmHg`, dm: yesNo(v.diabetes), smoke: p.smoking,
        bmiLo: v.bmi === null ? '' : `${round(v.bmi, 1)} kg/m²`, bmiHi: v.bmi === null ? '' : `${round(v.bmi, 1)} kg/m²`,
        egfrLo: `${v.egfr}`, egfrHi: `${v.egfr}`, htn: yesNo(v.treated), statin: yesNo(v.statin)
      };
      const terms = [{ label: 'Constant', input: '', beta: c.c, x: 1, contribution: c.c }];
      let logOdds = c.c;
      for (const [k, label] of TERMS) {
        if (c[k] === undefined) continue;
        logOdds += c[k] * x[k];
        terms.push({ label, input: shown[k] || '', beta: c[k], x: round(x[k], 4), contribution: round(c[k] * x[k], 6) });
      }
      const risk = Math.exp(logOdds) / (1 + Math.exp(logOdds));
      const notes = [
        `${p.sex === 'male' ? 'Men' : 'Women'}, base model (no UACR, HbA1c or deprivation index). This person's log-odds = ${logOdds.toFixed(4)}.`,
        'Term centring is not printed in the supplement table copy used here; it is taken from the team\'s literature notes and reproduced against the paper\'s worked examples.',
        'eGFR is read as entered; it is not computed from creatinine here.'
      ];
      if (key === 'hf') notes.push('Heart failure needs BMI (height and weight).');
      return computed(this, { value: risk, display: formatPercent(risk), terms, notes });
    }
  };
}

export const ahaPrevent = make({
  id: 'aha-prevent', name: 'AHA PREVENT (total CVD)', key: 'cvd',
  outcome: 'Total cardiovascular disease (ASCVD or heart failure) within 10 years', extraInputs: []
});

export const ahaPreventAscvd = make({
  id: 'aha-prevent-ascvd', name: 'AHA PREVENT (ASCVD)', key: 'ascvd',
  outcome: 'Atherosclerotic cardiovascular disease (heart attack or stroke) within 10 years', extraInputs: []
});

export const ahaPreventHf = make({
  id: 'aha-prevent-hf', name: 'AHA PREVENT (heart failure)', key: 'hf',
  outcome: 'Heart failure within 10 years', extraInputs: ['heightCm', 'weightKg']
});
