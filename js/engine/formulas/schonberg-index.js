// Schonberg index, 5-year and 9-year all-cause mortality, adults 65 and over (US).
// Schonberg MA, et al. J Gen Intern Med 2009;24(10):1115-1122 (points: Table 2; 5-year rates: Table 3,
// validation cohort). 9-year rates: Schonberg MA, et al. J Am Geriatr Soc 2011;59(8):1444-1451, Table 3
// (original validation cohort). Numbers are copied from COEFFICIENTS['schonberg-index'].
//
// No continuous formula: the risk is the observed death rate of the 2-point score group.

import { computed, gate, missingResult, bmi, round, yesNo } from '../util.js';

const AGE_POINTS = [[85, 7], [80, 5], [75, 3], [70, 1], [0, 0]];
const MAX = 31; // sum of the largest category of each item (self-computed; the paper gives no maximum)

// [lowest score, label, 5-year (2009 validation), 5-year (2009 development), 9-year (2011 original validation)]
const GROUPS = [
  [18, '18 or more', 0.62, 0.71, 0.92],
  [16, '16–17', 0.55, 0.58, 0.83],
  [14, '14–15', 0.49, 0.47, 0.75],
  [12, '12–13', 0.37, 0.35, 0.58],
  [10, '10–11', 0.29, 0.25, 0.52],
  [8, '8–9', 0.19, 0.15, 0.33],
  [6, '6–7', 0.12, 0.11, 0.26],
  [4, '4–5', 0.08, 0.08, 0.16],
  [2, '2–3', 0.05, 0.07, 0.08],
  [0, '0–1', 0.03, 0.02, 0.07]
];
const HEALTH = ['excellent', 'verygood', 'good', 'fair', 'poor'];
const pct = (x) => `${Math.round(x * 100)}%`;

export const schonbergIndex = {
  id: 'schonberg-index',
  name: 'Schonberg index',
  disease: 'mortality',
  outcome: 'Death from any cause within 5 years (score-group rate; 9-year rate in the notes)',
  horizonYears: 5,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [65, null],
  population: 'National Health Interview Survey 1997–2000 (US), community-dwelling adults aged 65 and over; not for people in care homes or with dementia.',
  source: {
    citation: 'Schonberg MA, Davis RB, McCarthy EP, Marcantonio ER. Index to predict 5-year mortality of community-dwelling adults aged 65 and older using data from the National Health Interview Survey. J Gen Intern Med 2009;24(10):1115–1122. 9-year rates: J Am Geriatr Soc 2011;59(8):1444–1451.',
    doi: ''
  },
  equation: `score = sum of 11 items (age 0–7, male 3, smoking 0/1/3, BMI under 25 2, emphysema or chronic bronchitis 2, diabetes 2, cancer 2, overnight hospital stays 0/1/3, self-rated health 0/1/2, needs help with everyday tasks 2, difficulty walking a quarter mile 3; maximum ${MAX}); death rate = observed rate of the score group`,
  inputs: ['age', 'sex', 'smoking', 'heightCm', 'weightKg', 'lungDisease', 'diabetes', 'cancerHistory',
    'hospitalizationsLastYear', 'selfRatedHealth', 'needsHelpDailyTasks', 'difficultyWalkingQuarterMile'],

  compute(person) {
    // util.js only knows the choice lists of its own fields, so selfRatedHealth is checked here.
    const early = gate({ ...this, inputs: this.inputs.filter((f) => f !== 'selfRatedHealth') }, person);
    const health = person.profile && person.profile.selfRatedHealth;
    const healthOk = HEALTH.includes(health);
    if (early && early.status !== 'missing') return early;
    if (early || !healthOk) {
      const list = early ? early.missing.slice() : [];
      if (!healthOk) list.push({ field: 'selfRatedHealth', label: 'Self-rated health' });
      return missingResult(this, list);
    }

    const p = person.profile;
    const age = Number(p.age);
    const b = bmi(p);
    const hosp = Number(p.hospitalizationsLastYear);
    const agePts = AGE_POINTS.find(([lo]) => age >= lo)[1];
    const smokePts = { never: 0, former: 1, current: 3 }[p.smoking];
    const healthPts = health === 'excellent' || health === 'verygood' ? 0 : health === 'good' ? 1 : 2;
    const yes = (v, pts) => (v === true ? pts : 0);
    const terms = [
      { label: 'Age (65–69 = 0, 70–74 = 1, 75–79 = 3, 80–84 = 5, 85 and over = 7)', input: `${age} years`, points: agePts },
      { label: 'Male', input: p.sex, points: p.sex === 'male' ? 3 : 0 },
      { label: 'Smoking (never 0, former 1, current 3)', input: p.smoking, points: smokePts },
      { label: 'BMI under 25', input: `${round(b, 1)} kg/m²`, points: b < 25 ? 2 : 0 },
      { label: 'Emphysema or chronic bronchitis', input: yesNo(p.lungDisease), points: yes(p.lungDisease, 2) },
      { label: 'Diabetes', input: yesNo(p.diabetes), points: yes(p.diabetes, 2) },
      { label: 'Cancer', input: yesNo(p.cancerHistory), points: yes(p.cancerHistory, 2) },
      { label: 'Overnight hospital stays in the past year (0, 1, 2 or more)', input: `${hosp}`, points: hosp >= 2 ? 3 : hosp >= 1 ? 1 : 0 },
      { label: 'Self-rated health (excellent/very good 0, good 1, fair/poor 2)', input: health, points: healthPts },
      { label: 'Needs help with everyday tasks', input: yesNo(p.needsHelpDailyTasks), points: yes(p.needsHelpDailyTasks, 2) },
      { label: 'Difficulty walking a quarter mile (about 3 blocks)', input: yesNo(p.difficultyWalkingQuarterMile), points: yes(p.difficultyWalkingQuarterMile, 3) }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const g = GROUPS.find(([lo]) => points >= lo);
    const notes = [
      `Score ${points}; score group ${g[1]}. 5-year death rate in the validation cohort ${pct(g[2])} (development cohort ${pct(g[3])}).`,
      `9-year death rate for the same group: ${pct(g[4])} (2011 validation, original cohort).`,
      'Each group spans 2 points and the rate is not interpolated; development and validation cohorts differ by up to 4 points in some groups.',
      'US data, not calibrated to Taiwan. No DOI was in the extracted sources, so none is shown.'
    ];
    return computed(this, {
      value: g[2], display: pct(g[2]), score: { points, max: MAX }, terms, notes,
      alsoRisks: [{ years: 9, value: g[4], display: pct(g[4]) }]
    });
  }
};

// Exposed for checks.js: the development-cohort 5-year rate of a score.
export function schonbergDevRate(points) {
  return GROUPS.find(([lo]) => points >= lo)[3];
}
