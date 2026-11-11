// Lee index, 4-year all-cause mortality, adults over 50 (US).
// Lee SJ, Lindquist K, Segal MR, Covinsky KE. JAMA 2006;295(7):801-808.
// Points: Table 3 (PDF p.5) and the Box (PDF p.7); points-to-risk: Table 4 (PDF p.6), validation cohort.
// Numbers are copied from COEFFICIENTS['lee-index'].
//
// No continuous formula: the risk is the observed 4-year death rate of the score group
// (0-5, 6-9, 10-13, 14 or more).

import { computed, gate, bmi, round, yesNo } from '../util.js';

// Table 3 age points; 50-59 = 0.
const AGE_POINTS = [[85, 7], [80, 5], [75, 4], [70, 3], [65, 2], [60, 1], [0, 0]];
const POINTS = {
  male: 2, diabetes: 1, cancer: 2, lung: 2, heartFailure: 2, bmiUnder25: 1, smoker: 2,
  bathing: 2, money: 2, walking: 2, pushing: 1
};
const MAX = 7 + 2 + 1 + 2 + 2 + 2 + 1 + 2 + 2 + 2 + 2 + 1; // 26, sum of the maxima (the paper gives no maximum)

// Table 4, validation cohort: [lowest score, label, 4-year death rate]
const GROUPS = [[14, '14 or more', 0.64], [10, '10–13', 0.42], [6, '6–9', 0.15], [0, '0–5', 0.04]];
// Table 4, development cohort, same groups (shown in notes).
const DEV = { '14 or more': 0.67, '10–13': 0.4, '6–9': 0.15, '0–5': 0.03 };

export const leeIndex = {
  id: 'lee-index',
  name: 'Lee index',
  disease: 'mortality',
  outcome: 'Death from any cause within 4 years (score-group rate)',
  horizonYears: 4,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [51, null],
  population: 'Health and Retirement Study (US), community-dwelling adults over 50; not for people in care homes.',
  source: {
    citation: 'Lee SJ, Lindquist K, Segal MR, Covinsky KE. Development and validation of a prognostic index for 4-year mortality in older adults. JAMA 2006;295(7):801–808.',
    doi: ''
  },
  equation: 'score = sum of 12 items (age 0–7, male 2, diabetes 1, cancer 2, chronic lung disease 2, heart failure 2, BMI under 25 1, current smoker 2, difficulty bathing 2, managing money 2, walking several blocks 2, pushing heavy objects 1); 4-year death rate = observed rate of the score group (Table 4)',
  inputs: ['age', 'sex', 'heightCm', 'weightKg', 'diabetes', 'cancerHistory', 'lungDisease', 'heartFailure', 'smoking',
    'difficultyBathing', 'difficultyManagingMoney', 'difficultyWalkingBlock', 'difficultyPushingObjects'],

  compute(person) {
    const early = gate(this, person);
    if (early) return early;

    const p = person.profile;
    const age = Number(p.age);
    const b = bmi(p);
    const agePts = AGE_POINTS.find(([lo]) => age >= lo)[1];
    const yes = (v, pts) => (v === true ? pts : 0);
    const terms = [
      { label: 'Age (50–59 = 0, 60–64 = 1, … 85 and over = 7)', input: `${age} years`, points: agePts },
      { label: 'Male', input: p.sex, points: p.sex === 'male' ? POINTS.male : 0 },
      { label: 'Diabetes', input: yesNo(p.diabetes), points: yes(p.diabetes, POINTS.diabetes) },
      { label: 'Cancer', input: yesNo(p.cancerHistory), points: yes(p.cancerHistory, POINTS.cancer) },
      { label: 'Chronic lung disease', input: yesNo(p.lungDisease), points: yes(p.lungDisease, POINTS.lung) },
      { label: 'Heart failure', input: yesNo(p.heartFailure), points: yes(p.heartFailure, POINTS.heartFailure) },
      { label: 'BMI under 25', input: `${round(b, 1)} kg/m²`, points: b < 25 ? POINTS.bmiUnder25 : 0 },
      { label: 'Current smoker', input: p.smoking, points: p.smoking === 'current' ? POINTS.smoker : 0 },
      { label: 'Difficulty bathing', input: yesNo(p.difficultyBathing), points: yes(p.difficultyBathing, POINTS.bathing) },
      { label: 'Difficulty managing money', input: yesNo(p.difficultyManagingMoney), points: yes(p.difficultyManagingMoney, POINTS.money) },
      { label: 'Difficulty walking several blocks', input: yesNo(p.difficultyWalkingBlock), points: yes(p.difficultyWalkingBlock, POINTS.walking) },
      { label: 'Difficulty pushing or pulling heavy objects', input: yesNo(p.difficultyPushingObjects), points: yes(p.difficultyPushingObjects, POINTS.pushing) }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const g = GROUPS.find(([lo]) => points >= lo);
    const notes = [
      `Score ${points}; score group ${g[1]}. The number shown is the death rate of that group in the paper’s validation cohort (${Math.round(g[2] * 100)}%); the development cohort had ${Math.round(DEV[g[1]] * 100)}%.`,
      'Groups are wide (for example 6–9 points is 15% for every score in it); the paper gives no formula between groups.',
      'Current smoking means smoking in the past week; former smokers score 0. The Box misprinted the diabetes point; the corrected 1 point is used.',
      'US data, not calibrated to Taiwan. The paper gives no DOI in the extracted sources, so none is shown.'
    ];
    return computed(this, {
      value: g[2], display: `${Math.round(g[2] * 100)}%`, score: { points, max: MAX }, terms, notes
    });
  }
};
