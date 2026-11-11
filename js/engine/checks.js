// Each formula re-computes examples printed in its own source, so the "show the math" drawer
// can say "reproduces the paper's example". This is not a test suite: the app calls
// runChecks() and shows the results.

import { fsrp, fsrpLinear } from './formulas/fsrp.js';
import { chinShanStroke } from './formulas/chin-shan-stroke.js';
import { findrisc, findriscPaperBand } from './formulas/findrisc.js';
import { caide } from './formulas/caide.js';
import { wilsonDiabetes } from './formulas/wilson-diabetes.js';
import { adaDiabetes } from './formulas/ada-diabetes.js';
import { checks as hisayamaChecks } from './formulas/hisayama.js';
import { checks as bdsiChecks } from './formulas/bdsi.js';
import { round } from './util.js';

const person = (profile, labs = {}) => ({ profile, labs });
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function fsrpChecks() {
  // Dufouil 2017, Figure 4A: four people aged 57, non-smokers, SBP 135, no diabetes or CVD.
  const cases = [
    ['female', false, 5.182011, 0.0099, 'Woman 57, no atrial fibrillation, SBP 135 untreated'],
    ['female', true, 6.609026, 0.0406, 'Woman 57, atrial fibrillation, SBP 135 on medicine'],
    ['male', false, 3.243657, 0.0174, 'Man 57, no atrial fibrillation, SBP 135 untreated'],
    ['male', true, 3.887327, 0.0329, 'Man 57, atrial fibrillation, SBP 135 on medicine']
  ];
  return cases.map(([sex, afibTreated, L, risk, text]) => {
    const r = fsrp.compute(person({
      age: 57, sex, smoking: 'never', sbp: 135, bpTreated: afibTreated, diabetes: false,
      afib: afibTreated, cvdHistory: false
    }));
    const lin = fsrpLinear(sex, { age: 57, smoker: 0, cvd: 0, afib: afibTreated ? 1 : 0, diabetes: false, treated: afibTreated, sbp: 135 });
    const actual = round(r.value, 4);
    return {
      formulaId: 'fsrp',
      example: `${text} → L ${L} → ${risk}`,
      expected: risk,
      actual,
      pass: actual === risk && near(lin.L, L, 1e-6),
      source: 'Dufouil 2017, Figure 4A worked example'
    };
  });
}

function chinShanChecks() {
  const nine = chinShanStroke.compute(person({
    age: 55, sex: 'male', sbp: 138, dbp: 88, familyStroke: true, afib: false, diabetes: false
  }));
  const top = chinShanStroke.compute(person({
    age: 80, sex: 'male', sbp: 170, dbp: 100, familyStroke: true, afib: true, diabetes: true
  }));
  return [
    {
      formulaId: 'chin-shan-stroke',
      example: 'Man 55 (4) + male (1) + SBP 138 (2) + DBP 88 (1) + parent had a stroke (1) = 9 points → 6.0%',
      expected: 0.06,
      actual: nine.value,
      pass: nine.score.points === 9 && nine.value === 0.06,
      source: 'Chien 2010, Table 2 (points and printed 10-year risk)'
    },
    {
      formulaId: 'chin-shan-stroke',
      example: 'Every item at its highest category = 19 points → "16 or more" row → 52.7%',
      expected: 0.527,
      actual: top.value,
      pass: top.score.points === 19 && top.value === 0.527,
      source: 'Chien 2010, Table 2 (points and printed 10-year risk)'
    }
  ];
}

function findriscChecks() {
  const man = findrisc.compute(person({
    age: 55, sex: 'male', heightCm: 170, weightKg: 84, waistCm: 96, active30minDaily: false,
    vegFruitDaily: false, bpTreated: false, highGlucoseHistory: true, familyDiabetes: 'second', diabetes: false
  }));
  const familyPoints = man.terms[man.terms.length - 1].points;
  const paperPct = findriscPaperBand(man.score.points - familyPoints, 'male');
  const top = findrisc.compute(person({
    age: 60, sex: 'female', heightCm: 160, weightKg: 82, waistCm: 95, active30minDaily: false,
    vegFruitDaily: false, bpTreated: true, highGlucoseHistory: true, familyDiabetes: 'first', diabetes: false
  }));
  return [
    {
      formulaId: 'findrisc',
      example: 'Man 55, BMI 29.1, waist 96 cm, inactive, no daily vegetables, high sugar before → 7-item score 15 → band 13–20 → 32.7% of men',
      expected: 32.7,
      actual: paperPct,
      pass: man.score.points - familyPoints === 15 && paperPct === 32.7,
      source: 'Lindström 2003, Table 2 (1987 cohort, men)'
    },
    {
      formulaId: 'findrisc',
      example: 'The same man on the form, with a grandparent with diabetes: 18 points → band 15–20 → about 1 in 3',
      expected: 'about 1 in 3',
      actual: man.display,
      pass: man.score.points === 18 && man.display === 'about 1 in 3',
      source: 'FINDRISC form, printed bands'
    },
    {
      formulaId: 'findrisc',
      example: 'Woman 60 with every item at its highest category: 25 points → band over 20 → about 1 in 2',
      expected: 'about 1 in 2',
      actual: top.display,
      pass: top.score.points === 25 && top.display === 'about 1 in 2',
      source: 'FINDRISC form, printed bands'
    }
  ];
}

function caideChecks() {
  // Kivipelto 2006, Table 4 (Model 1): three people, 20-year dementia risk.
  const cases = [
    [{ age: 45, sex: 'female', educationYears: 12, sbp: 130, heightCm: 160, weightKg: 61.4, exerciseTwiceWeekly: true }, 200, 0, 0.0013,
      'Woman under 47, 10+ years of school, SBP ≤ 140, BMI ≤ 30, cholesterol ≤ 6.5 mmol/L, active = 0 points → 0.13%'],
    [{ age: 50, sex: 'female', educationYears: 8, sbp: 150, heightCm: 160, weightKg: 61.4, exerciseTwiceWeekly: false }, 270, 10, 0.0691,
      'Woman 47–53, 7–9 years of school, SBP > 140, cholesterol > 6.5 mmol/L, inactive = 10 points → 6.91%'],
    [{ age: 60, sex: 'male', educationYears: 6, sbp: 160, heightCm: 170, weightKg: 95, exerciseTwiceWeekly: false }, 270, 15, 0.3555,
      'Man over 53, 0–6 years of school, SBP > 140, BMI > 30, cholesterol > 6.5 mmol/L, inactive = 15 points → 35.55%']
  ];
  return cases.map(([profile, tc, points, risk, text]) => {
    const r = caide.compute(person(profile, { totalCholMgDl: tc }));
    const actual = round(r.value, 4);
    return {
      formulaId: 'caide',
      example: text,
      expected: risk,
      actual,
      pass: r.score.points === points && actual === risk,
      source: 'Kivipelto 2006, Table 4 (Model 1)'
    };
  });
}

function wilsonChecks() {
  // Wilson 2007, Table 6: points for each item and the printed 8-year risk for each total.
  const cases = [
    [{ sex: 'female', heightCm: 160, weightKg: 69.1, sbp: 132, dbp: 80, bpTreated: false, familyDiabetes: 'none' },
      { fastingGlucoseMgDl: 105, hdlMgDl: 55, tgMgDl: 120 }, 14, 0.06, '6%',
      'Woman, fasting glucose 105 (10) + BMI 27.0 (2) + SBP 132 (2), HDL 55, triglycerides 120 = 14 points → 6%'],
    [{ sex: 'male', heightCm: 170, weightKg: 92.5, sbp: 140, dbp: 90, bpTreated: false, familyDiabetes: 'first' },
      { fastingGlucoseMgDl: 110, hdlMgDl: 35, tgMgDl: 200 }, 28, 0.35, 'more than 35%',
      'Every item at its highest category: 10 + 5 + 5 + 3 + 3 + 2 = 28 points → "25 or more" row → more than 35%'],
    [{ sex: 'male', heightCm: 175, weightKg: 70, sbp: 118, dbp: 76, bpTreated: false, familyDiabetes: 'none' },
      { fastingGlucoseMgDl: 92, hdlMgDl: 52, tgMgDl: 110 }, 0, 0.03, '3% or less',
      'No item present: 0 points → "10 or fewer" row → 3% or less']
  ];
  return cases.map(([profile, labs, points, risk, display, text]) => {
    const r = wilsonDiabetes.compute(person(profile, labs));
    return {
      formulaId: 'framingham-offspring-diabetes-wilson-2007',
      example: text,
      expected: risk,
      actual: r.value,
      pass: r.score.points === points && r.value === risk && r.display === display,
      source: 'Wilson 2007, Table 6 (points and printed 8-year risk)'
    };
  });
}

function adaChecks() {
  // Bang 2009, Figure: item points and the range -1 to 9; the cut-off of 5 or more is printed
  // in the Figure and in Appendix Table 2.
  const top = adaDiabetes.compute(person({
    age: 65, sex: 'male', familyDiabetes: 'first', bpTreated: true, heightCm: 165, weightKg: 110, active30minDaily: false, diabetes: false
  }));
  const low = adaDiabetes.compute(person({
    age: 35, sex: 'female', familyDiabetes: 'none', bpTreated: false, heightCm: 160, weightKg: 56, active30minDaily: true, diabetes: false
  }));
  const five = adaDiabetes.compute(person({
    age: 52, sex: 'male', familyDiabetes: 'first', bpTreated: false, heightCm: 170, weightKg: 81, active30minDaily: false, diabetes: false
  }));
  return [
    {
      formulaId: 'ada-risk-test-bang-2009',
      example: 'Every item at its highest category: 60 or over (3) + male (1) + family (1) + blood-pressure medicine (1) + BMI 40 or more (3) + not active (0) = 9, the printed maximum',
      expected: 9,
      actual: top.score.points,
      pass: top.score.points === 9 && top.band.aboveCutoff === true,
      source: 'Bang 2009, Figure (points)'
    },
    {
      formulaId: 'ada-risk-test-bang-2009',
      example: 'Woman under 40, no family history, no blood-pressure medicine, BMI under 25, physically active = −1, the printed minimum',
      expected: -1,
      actual: low.score.points,
      pass: low.score.points === -1 && low.band.aboveCutoff === false,
      source: 'Bang 2009, Figure (points)'
    },
    {
      formulaId: 'ada-risk-test-bang-2009',
      example: 'Man 52 (2) + male (1) + parent with diabetes (1) + BMI 28.0 (1) + not active (0) = 5 → at the printed cut-off of 5 or more',
      expected: 5,
      actual: five.score.points,
      pass: five.score.points === 5 && five.band.aboveCutoff === true && five.band.label.startsWith('5 or more'),
      source: 'Bang 2009, Figure and Appendix Table 2 (cut-off 5 or more)'
    }
  ];
}

export function runChecks() {
  return [...fsrpChecks(), ...chinShanChecks(), ...findriscChecks(), ...caideChecks(), ...wilsonChecks(), ...adaChecks(), ...hisayamaChecks, ...bdsiChecks];
}
