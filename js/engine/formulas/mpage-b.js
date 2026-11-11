// mPAGE-B: modified PAGE-B for Asian people with chronic hepatitis B on entecavir or tenofovir.
// Kim JH, et al. Modified PAGE-B score predicts the risk of hepatocellular carcinoma in Asians with
// chronic hepatitis B on antiviral therapy. J Hepatol 2018;69:1066-1073. Table 3 / graphical abstract.
//
// Points: age <30: 0, 30-39: 3, 40-49: 5, 50-59: 7, 60-69: 9, 70+: 11; male 2 (female 0);
// platelets (10^9/L) >250: 0, 200-250: 2, 150-200: 3, 100-150: 4, <100: 5;
// albumin (g/dL) >4.0: 0, 3.5-4.0: 1, 3.0-3.5: 2, <3.0: 3. Total 0-21.
// Groups: 8 or less low, 9-12 intermediate, 13 or more high; observed 5-year HCC in the build group
// 0.7%, 5.1%, 18.4% and in the test group 1.9%, 6.5%, 18.2%.
// UNCONFIRMED: which side of a shared platelet/albumin end-point (200, 150, 100, 4.0, 3.5, 3.0) each
// interval takes was lost from the paper's text layer. Assumed here, as our literature notes suggests:
// platelets >250 ->0, (200,250] ->2, (150,200] ->3, (100,150] ->4, <=100 ->5;
// albumin >4.0 ->0, (3.5,4.0] ->1, [3.0,3.5] ->2, <3.0 ->3.

import { computed, gate } from '../util.js';
import { hbvTreatedGate } from './page-b.js';

const AGE_POINTS = [[0, 0], [30, 3], [40, 5], [50, 7], [60, 9], [70, 11]]; // [lowest age, points]
const MALE_POINTS = 2;

// Exposed for checks: age, male (bool), platelets 10^9/L, albumin g/dL.
export function mpageBPoints(age, male, plt, alb) {
  const ageP = AGE_POINTS.filter(([lo]) => age >= lo).pop()[1];
  const sexP = male ? MALE_POINTS : 0;
  const pltP = plt > 250 ? 0 : plt > 200 ? 2 : plt > 150 ? 3 : plt > 100 ? 4 : 5;
  const albP = alb > 4.0 ? 0 : alb > 3.5 ? 1 : alb >= 3.0 ? 2 : 3;
  return { ageP, sexP, pltP, albP, total: ageP + sexP + pltP + albP };
}

export function mpageBGroup(total) {
  return total <= 8 ? 'low' : total <= 12 ? 'intermediate' : 'high';
}

export const mpageB = {
  id: 'mpage-b',
  name: 'mPAGE-B',
  disease: 'liver',
  outcome: 'Liver cancer (HCC) within 5 years, hepatitis B on treatment',
  horizonYears: 5,
  kind: 'score',
  derivedIn: 'EU',
  ageRange: [null, null],
  population: 'Asian adults with chronic hepatitis B on entecavir or tenofovir (2,001 to build, 1,000 to test). Not for untreated hepatitis B.',
  source: {
    citation: 'Kim JH, et al. Modified PAGE-B score predicts the risk of hepatocellular carcinoma in Asians with chronic hepatitis B on antiviral therapy. J Hepatol 2018;69:1066–1073.',
    doi: '10.1016/j.jhep.2018.07.018'
  },
  equation: 'score = age points (0–11) + male 2 + platelet points (0–5) + albumin points (0–3); 8 or less low, 9–12 intermediate, 13 or more high',
  inputs: ['age', 'sex', 'labs.plateletsK', 'labs.albuminGdL', 'hbvCarrier', 'hbvTreated'],

  compute(person) {
    const early = gate(this, person, hbvTreatedGate);
    if (early) return early;
    const p = person.profile;
    const age = Number(p.age);
    const plt = Number(person.labs.plateletsK);
    const alb = Number(person.labs.albuminGdL);
    const r = mpageBPoints(age, p.sex === 'male', plt, alb);
    const group = mpageBGroup(r.total);
    return computed(this, {
      value: r.total,
      display: `${r.total} points (of 21), ${group}`,
      score: { points: r.total, max: 21 },
      band: { label: `${group} group (${{ low: '8 or less', intermediate: '9–12', high: '13 or more' }[group]})`, aboveCutoff: group === 'high' },
      terms: [
        { label: 'Age', input: `${age} years`, points: r.ageP },
        { label: 'Male', input: p.sex, points: r.sexP },
        { label: 'Platelets', input: `${plt} ×10⁹/L`, points: r.pltP },
        { label: 'Albumin', input: `${alb} g/dL`, points: r.albP }
      ],
      notes: [
        'Observed 5-year liver cancer: low 0.7% (build) / 1.9% (test); intermediate 5.1% / 6.5%; high 18.4% / 18.2%. The paper has no equation from score to risk.',
        'Unconfirmed: which interval an exactly-on-the-line platelet or albumin value belongs to (200, 150, 100, 4.0, 3.5, 3.0). The assumption is stated in the formula file header.'
      ]
    });
  }
};
