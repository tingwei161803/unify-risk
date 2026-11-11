// APCS, Asia-Pacific Colorectal Screening score: advanced colorectal neoplasia on a first colonoscopy.
// Yeoh KG, et al. Gut 2011;60:1236-1241 (Asia-Pacific Colorectal Screening score).
// Points: Table 5 (p.1239). Share with advanced neoplasia by tier: Table 7 (p.1240), validation group
// of 1,892 people. Values copied from js/data/coefficients.js (COEFFICIENTS.apcs).
// This is a share of people found to have advanced neoplasia on screening colonoscopy (prevalence), not
// a risk over future years. The paper states no age limit (mean age 54 in the derivation group).

import { computed, formatPercent } from '../util.js';
import { gateCancer, isBool } from './_cancer-util.js';

// Table 7, validation group.
const TIERS = [
  { lo: 0, hi: 1, label: 'Average risk', n: 559, cases: 7, prevalence: 0.013, ci: '0.58–2.74%' },
  { lo: 2, hi: 3, label: 'Moderate risk', n: 966, cases: 31, prevalence: 0.032, ci: '2.22–4.57%' },
  { lo: 4, hi: 7, label: 'High risk', n: 367, cases: 19, prevalence: 0.052, ci: '3.25–8.13%' }
];

export const apcs = {
  id: 'apcs',
  name: 'APCS',
  disease: 'colorectal cancer',
  outcome: 'Advanced colorectal neoplasia on a first colonoscopy (share of people)',
  horizonYears: null,
  kind: 'risk',
  derivedIn: 'ASIA',
  ageRange: [null, null],
  population: 'Asymptomatic Asian adults having screening colonoscopy: 860 people in 11 Asian cities including Taipei (derivation, mean age 54) and 1,892 (validation, mean age 51).',
  source: {
    citation: 'Yeoh KG, et al. Gut 2011;60:1236–1241. Tables 5 and 7.',
    doi: '10.1136/gut.2010.221168'
  },
  equation: 'score = age (under 50: 0, 50–69: 2, 70 and over: 3) + sex (woman 0, man 1) + parent, sibling or child with colorectal cancer (2) + ever smoked (1), 0–7; shown value = share of the validation group in the same tier (0–1, 2–3, 4–7) who had advanced neoplasia',
  inputs: ['age', 'sex', 'familyColorectalCancer', 'smoking'],

  compute(person) {
    const early = gateCancer(this, person, {
      numeric: ['age', 'sex', 'smoking'],
      custom: { familyColorectalCancer: isBool }
    });
    if (early) return early;
    const p = person.profile;
    const age = Number(p.age);
    const ageP = age >= 70 ? 3 : age >= 50 ? 2 : 0;
    const terms = [
      { label: `Age ${age >= 70 ? '70 and over' : age >= 50 ? '50–69' : 'under 50'}`, input: `${age} years`, points: ageP },
      { label: 'Man', input: p.sex === 'male' ? 'yes' : 'no', points: p.sex === 'male' ? 1 : 0 },
      { label: 'Parent, sibling or child with colorectal cancer', input: p.familyColorectalCancer ? 'yes' : 'no', points: p.familyColorectalCancer ? 2 : 0 },
      { label: 'Current or past smoker', input: p.smoking === 'never' ? 'no' : 'yes', points: p.smoking === 'never' ? 0 : 1 }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const tier = TIERS.find((t) => points >= t.lo && points <= t.hi);
    return computed(this, {
      value: tier.prevalence,
      display: `${formatPercent(tier.prevalence)} (${tier.label}, ${points} of 7 points)`,
      score: { points, max: 7 },
      band: { label: tier.label, aboveCutoff: tier.lo >= 4 },
      terms,
      notes: [
        `${tier.label} tier (${tier.lo}–${tier.hi} points): ${tier.cases} of ${tier.n} people in the validation group had advanced neoplasia (95% CI ${tier.ci}).`,
        'The share describes people who had a colonoscopy, not the chance of cancer in the coming years.',
        'The score separates groups only roughly (c-statistic 0.64 in the validation group).',
        'The paper states no age limit; the study age range is not recorded in our literature notes.'
      ]
    });
  }
};
