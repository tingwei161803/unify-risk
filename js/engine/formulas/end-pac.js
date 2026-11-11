// END-PAC, Enriching New-Onset Diabetes for Pancreatic Cancer: points for people aged 50+ whose
// diabetes was just diagnosed (glucose-defined).
// Sharma A, et al.
// Gastroenterology 2018;155:730-739. Table 1 (PDF p.3), groups on p.1 and p.4.
// Values copied from js/data/coefficients.js (COEFFICIENTS['end-pac']).
// Inferred (not an equation in the paper): glucose-change points = points of the glucose category at
// diagnosis minus points of the category about 1 year earlier (the only reading that gives the printed
// range 1-4). Group figures are validation-group shares, not individual probabilities.

import { computed, formatPercent } from '../util.js';
import { gateCancer } from './_cancer-util.js';

// Table 1A: points by glucose (mg/dL).
const PRIOR_POINTS = [{ lt: 100, pts: 1, text: 'under 100' }, { lt: 110, pts: 2, text: '100–109' }, { lt: 126, pts: 3, text: '110–125' }];
const NOD_POINTS = [{ lt: 161, pts: 4, text: '126–160' }, { lt: Infinity, pts: 5, text: 'over 160' }];
// Table 1B: weight change (kg) -> points.
const WEIGHT_POINTS = [
  { lte: -6.0, pts: 6 }, { lte: -4.0, pts: 4 }, { lte: -2.0, pts: 2 }, { lt: 2.0, pts: 0 },
  { lt: 4.0, pts: -2 }, { lt: 6.0, pts: -4 }, { lt: Infinity, pts: -6 }
];
// Table 1C: age at diagnosis.
const agePoints = (a) => (a <= 59 ? -1 : a <= 69 ? 0 : 1);

export function endPacWeightPoints(kg) {
  // The paper prints one decimal; a value between two printed bands falls to the lower band.
  const w = Math.round(kg * 10) / 10;
  return WEIGHT_POINTS.find((b) => (b.lte !== undefined ? w <= b.lte : w < b.lt)).pts;
}

export const endPac = {
  id: 'end-pac',
  name: 'END-PAC',
  disease: 'pancreatic cancer',
  outcome: 'Pancreatic cancer within 3 years of new-onset diabetes',
  horizonYears: 3,
  kind: 'score',
  derivedIn: 'US',
  ageRange: [50, null],
  population: 'People aged 50 and over whose diabetes was diagnosed on blood glucose in the last year (Mayo Clinic derivation, validation in a separate group).',
  source: {
    citation: 'Sharma A, et al. Gastroenterology 2018;155:730–739. Table 1.',
    doi: '10.1053/j.gastro.2018.05.023'
  },
  equation: 'score = glucose-change points (category at diagnosis − category a year earlier, 1–4) + weight-change points (−6 to +6) + age-at-diagnosis points (−1 to +1); 3 or more = high group',
  inputs: ['age', 'diabetes', 'diabetesOnsetAge', 'weightChangeKg12m', 'labs.fastingGlucoseMgDl', 'labs.glucoseChangeMgDl12m'],

  compute(person) {
    const early = gateCancer(this, person, {
      numeric: ['age', 'diabetesOnsetAge', 'weightChangeKg12m', 'labs.fastingGlucoseMgDl', 'labs.glucoseChangeMgDl12m'],
      exclusion: (q) => {
        const p = q.profile || {};
        const l = q.labs || {};
        if (p.diabetes !== true) return 'END-PAC applies only to people whose diabetes was diagnosed in the last year.';
        if (Number.isFinite(Number(p.age)) && Number.isFinite(Number(p.diabetesOnsetAge)) && Number(p.age) - Number(p.diabetesOnsetAge) > 1) {
          return `Diabetes was diagnosed at ${p.diabetesOnsetAge}, more than a year ago; END-PAC was built on new-onset diabetes.`;
        }
        const now = Number(l.fastingGlucoseMgDl);
        const change = Number(l.glucoseChangeMgDl12m);
        if (Number.isFinite(now) && now < 126) return `Glucose ${now} mg/dL is below 126, the lowest value in the paper's table for the time of diagnosis.`;
        if (Number.isFinite(now) && Number.isFinite(change) && now - change >= 126) return 'Glucose a year earlier was already 126 or higher, so the diabetes was not new.';
        return '';
      }
    });
    if (early) return early;

    const p = person.profile;
    const l = person.labs;
    const now = Number(l.fastingGlucoseMgDl);
    const before = now - Number(l.glucoseChangeMgDl12m);
    const nod = NOD_POINTS.find((b) => now < b.lt);
    const prior = PRIOR_POINTS.find((b) => before < b.lt);
    const dBg = nod.pts - prior.pts;
    const wt = Number(p.weightChangeKg12m);
    const wPts = endPacWeightPoints(wt);
    const aPts = agePoints(Number(p.diabetesOnsetAge));
    const terms = [
      { label: `Glucose change: ${nod.text} at diagnosis (${nod.pts}) minus ${prior.text} a year earlier (${prior.pts})`, input: `${Math.round(before)} → ${now} mg/dL`, points: dBg },
      { label: 'Weight change over 12 months', input: `${wt > 0 ? '+' : ''}${wt} kg`, points: wPts },
      { label: 'Age at diagnosis', input: `${p.diabetesOnsetAge} years`, points: aPts }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const label = points >= 3 ? 'High group' : points >= 1 ? 'Intermediate group' : 'Low group';
    const groupText = points >= 3
      ? 'In the validation group, 3.6% of people scoring 3 or more had pancreatic cancer within 3 years (sensitivity 78%, specificity 82%).'
      : points >= 1
        ? 'In the validation group, 0.54% of people scoring 1–2 had pancreatic cancer within 3 years.'
        : 'In the validation group, 48% of people scored 0 or less and none of them had pancreatic cancer.';
    return computed(this, {
      value: points,
      display: `${points} points · ${label}`,
      score: { points, max: 11 },
      band: { label, aboveCutoff: points >= 3 },
      terms,
      notes: [
        groupText,
        `Glucose a year earlier is taken as today's glucose (${now}) minus the 12-month change (${l.glucoseChangeMgDl12m}); the glucose today is the fasting value entered.`,
        'The paper gives the glucose categories but not the formula for glucose-change points; subtracting the two category scores is an inference that matches the printed range of 1–4.',
        'For people aged 50 and over with diabetes diagnosed in the last year only.'
      ]
    });
  }
};
