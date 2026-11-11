// Hisayama dementia equation: risk of dementia within 10 years, for people aged 65 and over.
// Honda T, et al. Development of a dementia prediction model for primary care: The Hisayama Study.
// Alzheimers Dement (Amst) 2021;13:e12221.
//
// 10-year risk = 1 - 0.8254^exp(sum(b*x) - 1.543). Every predictor is 1 when present:
// age band (65-69 = 0) 70-74: 0.552, 75-79: 0.783, 80-84: 1.372, 85 or over: 2.165; female: 0.325;
// education 9 years or less: 0.302; hypertension (140/90 mmHg or more, or treated): 0.316;
// diabetes: 0.461; BMI under 18.5: 0.341; history of stroke: 0.518; current smoking: 0.378;
// sedentary (mostly sitting or lying down in the day): 0.612.
// Reproduces the three worked examples in the paper's Results (Table S4): 29%, 22%, 16%.
//
// "Sedentary" is not a Person field. It is read from profile.sedentary when given. Otherwise,
// someone active at least 30 minutes most days (active30minDaily) is taken as not sedentary;
// anyone else is asked, never guessed.

import { computed, gate, missingResult, bmi, formatPercent, round, yesNo } from '../util.js';

const BETA = {
  age7074: 0.552, age7579: 0.783, age8084: 1.372, age85: 2.165,
  female: 0.325, lowEducation: 0.302, hypertension: 0.316, diabetes: 0.461,
  lean: 0.341, stroke: 0.518, smoker: 0.378, sedentary: 0.612
};
const S0 = 0.8254;
const MEAN = 1.543;

const LABELS = {
  strokeHistory: 'Ever had a stroke',
  sedentary: 'Mostly sitting or lying down during the day'
};

function ageBand(age) {
  if (age >= 85) return { label: '85 or over', beta: BETA.age85 };
  if (age >= 80) return { label: '80–84', beta: BETA.age8084 };
  if (age >= 75) return { label: '75–79', beta: BETA.age7579 };
  if (age >= 70) return { label: '70–74', beta: BETA.age7074 };
  return { label: '65–69', beta: 0 };
}

// { value: true | false, inferred: bool } or { missing: { field, label } }
function sedentaryOf(profile) {
  if (typeof profile.sedentary === 'boolean') return { value: profile.sedentary, inferred: false };
  if (profile.active30minDaily === true) return { value: false, inferred: true };
  return { missing: { field: 'sedentary', label: LABELS.sedentary } };
}

export function hisayamaRisk(sum) {
  return 1 - Math.pow(S0, Math.exp(sum - MEAN));
}

export const hisayama = {
  id: 'hisayama-dementia-equation',
  name: 'Hisayama dementia equation',
  disease: 'dementia',
  outcome: 'Dementia within 10 years',
  horizonYears: 10,
  ageRange: [65, null],
  population: 'Hisayama Study, Japan: community-dwelling adults aged 65 and over without dementia, followed for 10 years.',
  source: {
    citation: 'Honda T, et al. Development of a dementia prediction model for primary care: The Hisayama Study. Alzheimers Dement (Amst) 2021;13:e12221.',
    doi: '10.1002/dad2.12221'
  },
  equation: '10-year risk = 1 − 0.8254^exp(Σβx − 1.543); age 65–69 is the reference band',
  // 'sedentary' is handled separately (see sedentaryOf), so it is not listed here.
  inputs: ['age', 'sex', 'educationYears', 'sbp', 'dbp', 'bpTreated', 'diabetes', 'heightCm', 'weightKg', 'strokeHistory', 'smoking'],

  compute(person) {
    const profile = (person && person.profile) || {};
    const sed = sedentaryOf(profile);
    const early = gate(this, person);
    if (early) {
      if (early.status === 'missing') {
        early.missing = early.missing.map((m) => ({ field: m.field, label: LABELS[m.field] || m.label }));
        if (sed.missing) early.missing.push(sed.missing);
      }
      return early;
    }
    if (sed.missing) return missingResult(this, [sed.missing]);

    const p = profile;
    const age = Number(p.age);
    const band = ageBand(age);
    const sbp = Number(p.sbp);
    const dbp = Number(p.dbp);
    const hypertensive = sbp >= 140 || dbp >= 90 || p.bpTreated === true;
    const b = bmi(p);
    const rows = [
      [`Age ${band.label} (65–69 = 0)`, `${age} years`, band.beta, band.beta ? 1 : 0],
      ['Female', p.sex, BETA.female, p.sex === 'female' ? 1 : 0],
      ['Education 9 years or less', `${Number(p.educationYears)} years`, BETA.lowEducation, Number(p.educationYears) <= 9 ? 1 : 0],
      ['Hypertension (140/90 mmHg or more, or on medicine)', `${sbp}/${dbp} mmHg${p.bpTreated ? ', on medicine' : ''}`, BETA.hypertension, hypertensive ? 1 : 0],
      ['Diabetes', yesNo(p.diabetes), BETA.diabetes, p.diabetes === true ? 1 : 0],
      ['BMI under 18.5', `${round(b, 1)} kg/m²`, BETA.lean, b < 18.5 ? 1 : 0],
      ['History of stroke', yesNo(p.strokeHistory), BETA.stroke, p.strokeHistory === true ? 1 : 0],
      ['Current smoker', p.smoking, BETA.smoker, p.smoking === 'current' ? 1 : 0],
      ['Mostly sitting or lying down in the day', yesNo(sed.value), BETA.sedentary, sed.value ? 1 : 0]
    ];
    const terms = rows.map(([label, input, beta, x]) => ({ label, input, beta, x, contribution: round(beta * x, 6) }));
    const sum = rows.reduce((s, r) => s + r[2] * r[3], 0);
    const value = hisayamaRisk(sum);

    const notes = [`Σβx = ${sum.toFixed(3)}; exp(Σβx − 1.543) = ${Math.exp(sum - MEAN).toFixed(3)}.`];
    if (sed.inferred) notes.push('Taken as not sedentary because you are active at least 30 minutes on most days.');
    notes.push('Built in a Japanese town; it does not ask about family history of dementia.');
    return computed(this, { value, display: formatPercent(value), terms, notes });
  }
};

// Honda 2021, Results (Table S4): one man, then two changes. The text does not state his age band;
// 75–79 is the only band that reproduces all three printed figures.
const exampleMan = {
  age: 77, sex: 'male', educationYears: 9, heightCm: 165, weightKg: 49, sbp: 150, dbp: 80, bpTreated: false,
  diabetes: false, strokeHistory: false, smoking: 'current', sedentary: false
};
const EXAMPLES = [
  [exampleMan, 0.29, 'Man 75–79, 9 years of school, hypertension (150 mmHg), BMI 18.0, current smoker → 29%'],
  [{ ...exampleMan, sbp: 120, dbp: 70 }, 0.22, 'The same man without hypertension (120/70) → 22%'],
  [{ ...exampleMan, sbp: 120, dbp: 70, smoking: 'never' }, 0.16, 'The same man without hypertension, a non-smoker → 16%']
];

export const checks = EXAMPLES.map(([profile, expected, example]) => {
  const r = hisayama.compute({ profile, labs: {} });
  const actual = r.status === 'computed' ? round(r.value, 2) : null;
  return {
    formulaId: 'hisayama-dementia-equation',
    example,
    expected,
    actual,
    pass: actual === expected,
    source: 'Honda 2021, Results (Table S4 worked examples, printed to whole percents)'
  };
});
