// Group B (diabetes, hypertension, kidney): the formulas, their worked-example checks and the labels of
// the new person fields. The coordinator wires `formulas`, `checks()` and `fieldLabels` into index.js,
// checks.js and util.js.
//
// Not included: CKD-PC incident CKD (Nelson 2019). Its equation is in eTable 8 of the supplement, which is
// neither in js/data/coefficients.js nor in our literature notes, so there is nothing to copy.

import { chinShanDiabetes, chienDiabetesPoints, chienDiabetesRisk } from './chin-shan-diabetes-chien-2008.js';
import { qdiabetes2018, qdRisk, qdStatinHR, QDIABETES_A_COEF } from './qdiabetes-2018.js';
import { qdiabetes2018B, qdiabetes2018BCoef } from './qdiabetes-2018-b.js';
import { qdiabetes2018C, qdiabetes2018CCoef } from './qdiabetes-2018-c.js';
import { framinghamHypertension, parikhRisk, parikhPoints } from './framingham-hypertension-parikh-2008.js';
import { otsuka2015, otsukaSum, otsukaRisk, otsukaPoints } from './otsuka-2015.js';
import { chien2010Ckd } from './chien-2010-ckd.js';
import { chien2010CkdLab } from './chien-2010-ckd-lab.js';
import { kfre, kfreRisk } from './kfre.js';

export const formulas = [
  chinShanDiabetes, qdiabetes2018, qdiabetes2018B, qdiabetes2018C,
  framinghamHypertension, otsuka2015, chien2010Ckd, chien2010CkdLab, kfre
];

// New person fields (profile.* by bare key, labs.* with prefix). Add to util.js FIELD_LABELS.
export const fieldLabels = {
  ethnicity: 'Ethnicity',
  statin: 'Takes a statin',
  strokeHistory: 'Has had a stroke',
  hypertensionDiagnosed: 'Told they have high blood pressure',
  ckdStage: 'Chronic kidney disease stage (1–5)',
  heavyDrinking: 'Drinks alcohol 6 or more days a week',
  parentsHypertension: 'Parents with high blood pressure (0, 1 or 2)',
  'labs.hba1cPct': 'HbA1c',
  'labs.creatinineMgDl': 'Serum creatinine',
  'labs.egfr': 'eGFR',
  'labs.uacrMgG': 'Urine albumin-to-creatinine ratio',
  'labs.uricAcidMgDl': 'Uric acid',
  'labs.wbcK': 'White blood cell count',
  'labs.postprandialGlucoseMgDl': 'Glucose after a meal',
  'labs.proteinuria': 'Urine protein 100 mg/dL or more'
};

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const row = (formulaId, example, expected, actual, pass, source) => ({ formulaId, example, expected, actual, pass, source });
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const r4 = (x) => Math.round(x * 1e4) / 1e4;

function chinShanChecks() {
  const src = 'Chien 2008 Tables 2 and 3. The paper prints no worked example; these are computed from the printed tables (self-computed, exact).';
  const x = { age: 50, bmi: 25, wbc: 6.0, tg: 1.5, hdl: 1.2, glu: 5.6 };
  const a = chienDiabetesPoints(x);
  const person = {
    profile: { age: 50, heightCm: 170, weightKg: 72.25, diabetes: false },
    labs: { wbcK: 6.0, tgMgDl: 1.5 / 0.0113, hdlMgDl: 1.2 / 0.0259, fastingGlucoseMgDl: 5.6 / 0.0555 }
  };
  const r = chinShanDiabetes.compute(person);
  return [
    row('chin-shan-diabetes-chien-2008', 'Age 50 (0) + BMI 25.0 (4) + WBC 6.0 (1) + TG 1.5 (1) + HDL 1.2 (−1) + glucose 5.6 (3) = 8 points → 26%',
      0.26, chienDiabetesRisk(a.total), a.total === 8 && chienDiabetesRisk(a.total) === 0.26, src),
    row('chin-shan-diabetes-chien-2008', 'Same person entered in mg/dL through the formula (unit conversion) → 8 points → 26%',
      0.26, r.value, r.status === 'computed' && r.score.points === 8 && r.value === 0.26, src),
    row('chin-shan-diabetes-chien-2008', 'Lowest category on every item: −15 points → 5%; highest: 32 points → 86%',
      '0.05 / 0.86',
      `${chienDiabetesRisk(chienDiabetesPoints({ age: 35, bmi: 20, wbc: 4, tg: 0.5, hdl: 2, glu: 5 }).total)} / ${chienDiabetesRisk(chienDiabetesPoints({ age: 80, bmi: 30, wbc: 8, tg: 2, hdl: 0.8, glu: 7 }).total)}`,
      chienDiabetesPoints({ age: 35, bmi: 20, wbc: 4, tg: 0.5, hdl: 2, glu: 5 }).total === -15
        && chienDiabetesPoints({ age: 80, bmi: 30, wbc: 8, tg: 2, hdl: 0.8, glu: 7 }).total === 32, src)
  ];
}

function qdiabetesChecks() {
  const src = 'QDiabetes-2018 literature notes: self-computed from the CRAN QDiabetes_1.0-2 coefficients (no official output was available); tolerance 1e-6';
  const out = [];
  const add = (id, coef, female, x, expected, text) => {
    const v = qdRisk(coef, female, x).risk;
    out.push(row(id, text, expected, r6(v), near(v, expected, 1e-6), src));
  };
  add('qdiabetes-2018', QDIABETES_A_COEF, true, { age: 50, bmi: 28 }, 0.02837041, 'Model A: woman 50, BMI 28, white, never smoked, no other items → 2.84%');
  add('qdiabetes-2018', QDIABETES_A_COEF, false, { age: 50, bmi: 28 }, 0.04285628, 'Model A: man 50, BMI 28 → 4.29%');
  add('qdiabetes-2018', QDIABETES_A_COEF, false, { age: 70, bmi: 24.5, ethn: 'Indian', smoke: 'Light', tds: -2, flags: { fhdm: 1, cvd: 1, ster: 1 } }, 0.34542457,
    'Model A: man 70, BMI 24.5, Indian, light smoker, Townsend −2, family history, heart disease, steroids → 34.54%');
  add('qdiabetes-2018-b', qdiabetes2018BCoef, true, { age: 50, bmi: 28, fpg: 5.5 }, 0.05279282, 'Model B: woman 50, BMI 28, fasting glucose 5.5 mmol/L → 5.28%');
  add('qdiabetes-2018-b', qdiabetes2018BCoef, false, { age: 50, bmi: 28, fpg: 6.5 }, 0.22519265, 'Model B: man 50, BMI 28, fasting glucose 6.5 mmol/L → 22.52%');
  add('qdiabetes-2018-c', qdiabetes2018CCoef, true, { age: 50, bmi: 28, hba1c: 36 }, 0.02101045, 'Model C: woman 50, BMI 28, HbA1c 36 mmol/mol → 2.10%');
  add('qdiabetes-2018-c', qdiabetes2018CCoef, false, { age: 65, bmi: 30, ethn: 'Chinese', smoke: 'Ex', tds: 1, hba1c: 42, flags: { htn: 1, stat: 1 } }, 0.33443818,
    'Model C: man 65, BMI 30, Chinese, ex-smoker, Townsend 1, HbA1c 42, treated hypertension, statin → 33.44%');

  // Paper text (BMJ 2017;359:j5019): model B men, statin hazard ratio at 35/45/55/65 = 2.41/1.66/1.30/1.15.
  const hr = [35, 45, 55, 65].map((a) => qdStatinHR(qdiabetes2018BCoef, false, a));
  const want = [2.41, 1.66, 1.3, 1.15];
  out.push(row('qdiabetes-2018-b', 'Statin hazard ratio for men at ages 35 / 45 / 55 / 65 (paper text: increases of 141%, 66%, 30%, 15%)',
    want.join(' / '), hr.map((v) => v.toFixed(2)).join(' / '), hr.every((v, i) => near(v, want[i], 0.006)),
    'BMJ 2017;359:j5019, results text on model B (paper-origin; tolerance 0.006)'));

  // Through the formula object, with the app's own inputs.
  const person = {
    profile: { age: 50, sex: 'female', heightCm: 160, weightKg: 71.68, smoking: 'never', familyDiabetes: 'none', bpTreated: false, cvdHistory: false, statin: false, ethnicity: 'white', diabetes: false },
    labs: { fastingGlucoseMgDl: 5.5 / 0.0555 }
  };
  const a = qdiabetes2018.compute(person);
  const b = qdiabetes2018B.compute(person);
  out.push(row('qdiabetes-2018', 'Same woman entered through the formula (160 cm, 71.68 kg = BMI 28, white, never smoked) → model A 2.84%, model B (glucose 5.5 mmol/L) 5.28%',
    '0.02837 / 0.05279', `${r6(a.value)} / ${r6(b.value)}`, near(a.value, 0.02837041, 1e-6) && near(b.value, 0.05279282, 1e-5), src));
  return out;
}

function framinghamChecks() {
  const out = [];
  const woman = { age: 60, female: 1, sbp: 128, dbp: 85, smoker: 1, parents: 2, bmi: 32 };
  const man = { age: 50, female: 0, sbp: 120, dbp: 79, smoker: 1, parents: 1, bmi: 27.5 };
  const nonSmoker = { ...woman, smoker: 0, bmi: 24 };
  const src = 'Parikh 2008 Appendix worked example (PDF p.10) and Figure 2 (PDF p.5)';
  const p1 = parikhPoints(woman);
  const p2 = parikhPoints(nonSmoker);
  const p3 = parikhPoints(man);
  out.push(row('framingham-hypertension-parikh-2008', 'Woman 60, BP 128/85, smoker, both parents hypertensive, BMI 32: 10+1+6+1+2+3 = 23 points → 56.66% at 4 years',
    0.5666, p1.risk, p1.total === 23 && p1.risk === 0.5666, src));
  out.push(row('framingham-hypertension-parikh-2008', 'Same woman, non-smoker, BMI under 25 (24 used): 19 points → 34.63%',
    0.3463, p2.risk, p2.total === 19 && p2.risk === 0.3463, src));
  out.push(row('framingham-hypertension-parikh-2008', 'Man 50, BP 120/79, smoker, one parent, BMI 27.5: 7+4+1+1+1 = 14 points → 16.68%',
    0.1668, p3.risk, p3.total === 14 && p3.risk === 0.1668, src));
  const w = parikhRisk(woman).risk;
  const m = parikhRisk(man).risk;
  const src2 = 'Parikh 2008 Appendix (PDF p.10). Uses the back-calculated interaction 0.001624, NOT the printed 0.00162; tolerance 0.0001. With 0.00162 the woman is 0.5834 and the man 0.1514 (tolerance 0.01 would be needed).';
  out.push(row('framingham-hypertension-parikh-2008', 'Weibull equation, woman above → 4-year risk 57.50%', 0.575, r4(w), near(w, 0.575, 1e-4), src2));
  out.push(row('framingham-hypertension-parikh-2008', 'Weibull equation, man above (DBP 79) → 4-year risk 14.89%', 0.1489, r4(m), near(m, 0.1489, 1e-4), src2));
  return out;
}

function otsukaChecks() {
  const src = 'Otsuka 2015 Appendix (PDF p.7) and Figure 2 (PDF p.4); tolerance 0.0005 on risk, 0.001 on Σβx';
  const c1 = { age: 36, bmi: 24.5, sbp: 124, dbp: 72, smoker: 0, heavyDrinking: 0, parent: 1 };
  const c2 = { age: 49, bmi: 26.8, sbp: 136, dbp: 84, smoker: 0, heavyDrinking: 1, parent: 0 };
  const out = [];
  [[c1, 17.938, 0.082, 9, '5% to under 10%', 'Man 36, BP 124/72, BMI 24.5, non-smoker, no heavy drinking, parent with hypertension'],
    [c2, 20.425, 0.642, 24, '50% to under 60%', 'Man 49, BP 136/84, BMI 26.8, non-smoker, heavy drinker, no parental history']].forEach(([x, sum, risk, points, band, text], i) => {
    const s = otsukaSum(x);
    const r = otsukaRisk(s);
    const p = otsukaPoints(x);
    out.push(row('otsuka-2015', `${text}: Σβx ${sum} → ${risk}`, risk, r4(r), near(s, sum, 0.001) && near(r, risk, 0.0005), src));
    out.push(row('otsuka-2015', `Same man, Figure 2 chart: ${points} points → ${band}`, `${points} / ${band}`, `${p.total} / ${p.band}`, p.total === points && p.band === band, src));
  });
  const person = { profile: { age: 36, sex: 'male', heightCm: 175, weightKg: 24.5 * 1.75 * 1.75, sbp: 124, dbp: 72, smoking: 'never', heavyDrinking: false, parentsHypertension: 1, bpTreated: false }, labs: {} };
  const f = otsuka2015.compute(person);
  out.push(row('otsuka-2015', 'Case 1 entered through the formula → 8.2%', 0.082, r4(f.value), f.status === 'computed' && near(f.value, 0.082, 0.0005), src));
  return out;
}

function chienCkdChecks() {
  const src = 'Chien 2010 Tables 3 and 4 (PDF p.6). The paper prints no worked example; computed from the printed tables (self-computed, exact).';
  const clin = chien2010Ckd.compute({
    profile: { age: 58, heightCm: 170, weightKg: 72.25, dbp: 82, diabetes: true, strokeHistory: false }, labs: {} });
  const lab = chien2010CkdLab.compute({
    profile: { age: 60, dbp: 70, strokeHistory: false },
    labs: { uricAcidMgDl: 7.2, postprandialGlucoseMgDl: 140, hba1cPct: 5.8, proteinuria: false } });
  return [
    row('chien-2010-ckd', 'Age 58 (5) + BMI 25.0 (1) + DBP 82 (2) + diabetes (1) + no stroke (0) = 9 points → 23%',
      0.23, clin.value, clin.status === 'computed' && clin.score.points === 9 && clin.value === 0.23, src),
    row('chien-2010-ckd-lab', 'Age 60 (5) + DBP 70 (1) + no stroke + uric acid 7.2 (2) + post-meal glucose 140 (1) + HbA1c 5.8 (1) + no urine protein = 10 points → 25%',
      0.25, lab.value, lab.status === 'computed' && lab.score.points === 10 && lab.value === 0.25, src)
  ];
}

function kfreChecks() {
  const src = 'Official kidneyfailurerisk.com calculator code run in node (literature notes coefficients/kfre-2.json); tolerance 0.0002';
  const out = [];
  const cases = [
    [{ age: 50, male: 1, egfr: 30, acrMgG: 50 }, 'Man 50, eGFR 30, ACR 50 mg/g', 0.1449, 0.0489, 0.1218, 0.033],
    [{ age: 65, male: 0, egfr: 45, acrMgG: 300 }, 'Woman 65, eGFR 45, ACR 300 mg/g', 0.0365, null, 0.0304, null],
    [{ age: 70, male: 1, egfr: 15, acrMgG: 1000 }, 'Man 70, eGFR 15, ACR 1000 mg/g', 0.8736, null, 0.8203, null],
    [{ age: 40, male: 0, egfr: 55, acrMgG: 5 }, 'Woman 40, eGFR 55, ACR 5 mg/g', 0.0033, null, 0.0028, null]
  ];
  for (const [x, text, o5, o2, n5, n2] of cases) {
    const r = kfreRisk(x);
    const ok = near(r.orig[5], o5, 0.0002) && near(r.nonNA[5], n5, 0.0002)
      && (o2 === null || near(r.orig[2], o2, 0.0002)) && (n2 === null || near(r.nonNA[2], n2, 0.0002));
    out.push(row('kfre', `${text}: 5-year ${o5} (original baseline), ${n5} (non-North-America baseline)${o2 === null ? '' : `; 2-year ${o2} / ${n2}`}`,
      `${o5} / ${n5}`, `${r4(r.orig[5])} / ${r4(r.nonNA[5])}`, ok, src));
  }
  const f = kfre.compute({ profile: { age: 50, sex: 'male', ckdStage: 3 }, labs: { egfr: 30, uacrMgG: 50 } });
  const g = kfre.compute({ profile: { age: 50, sex: 'male', ckdStage: 1 }, labs: { egfr: 90, uacrMgG: 50 } });
  out.push(row('kfre', 'Man 50 with CKD stage 3 entered through the formula → 14.49%; the same man at stage 1 → not applicable',
    '0.1449 / not-applicable', `${r4(f.value)} / ${g.status}`, near(f.value, 0.1449, 0.0002) && g.status === 'not-applicable', src));
  return out;
}

export function checks() {
  return [...chinShanChecks(), ...qdiabetesChecks(), ...framinghamChecks(), ...otsukaChecks(), ...chienCkdChecks(), ...kfreChecks()];
}
