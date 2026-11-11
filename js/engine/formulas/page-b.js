// PAGE-B: liver cancer (HCC) score for people with chronic hepatitis B on entecavir or tenofovir.
// Papatheodoridis G, et al. PAGE-B predicts the risk of developing hepatocellular carcinoma in
// Caucasians with chronic hepatitis B on 5-year antiviral therapy. J Hepatol 2016;64:800-806. Table 3 (PDF p.4).
//
// Points: age 16-29: 0, 30-39: 2, 40-49: 4, 50-59: 6, 60-69: 8, 70+: 10; male 6 (female 0);
// platelets (per mm3) >= 200,000: 0, 100,000-199,999: 6, < 100,000: 9. Total 0-25.
// Groups (p.1, p.4): 9 or less low (5-year HCC 0% in the build group), 10-17 medium (3%), 18+ high (17%).
// The 5-year risk by score (Fig. 2) was read off the figure's drawing coordinates by the team
// team, not printed in the paper (error about +-0.05 percentage points; the paper's table is in
// Supplementary Table 3, which was not obtained). It is shown in the notes only.

import { computed, gate } from '../util.js';

// Shared with mPAGE-B: only people with hepatitis B on treatment (entecavir or tenofovir).
export function hbvTreatedGate(p) {
  if (p.profile && p.profile.hbvCarrier === false) return 'Not a hepatitis B carrier; this score is for treated chronic hepatitis B.';
  if (p.profile && p.profile.hbvCarrier === true && p.profile.hbvTreated === false) {
    return 'Hepatitis B is not on treatment; this score was built on people taking entecavir or tenofovir.';
  }
  return '';
}

const AGE_POINTS = [[16, 0], [30, 2], [40, 4], [50, 6], [60, 8], [70, 10]]; // [lowest age, points]
const MALE_POINTS = 6;
const PLT_HIGH_K = 200;  // 200,000 per mm3 = 200 x10^3/uL
const PLT_LOW_K = 100;
// Fig. 2, PDF p.4, digitised (see header). Scores 1, 3, 5, 7, 11 and 24 have no point on the figure.
const FIG2_5Y_PCT = {
  0: 0.09, 2: 0.15, 4: 0.25, 6: 0.43, 8: 0.73, 9: 0.94, 10: 1.22, 12: 2.07, 13: 2.68, 14: 3.47, 15: 4.5,
  16: 5.81, 17: 7.5, 18: 9.65, 19: 12.37, 20: 15.79, 21: 20.04, 22: 25.26, 23: 31.54, 25: 47.36
};

// Exposed for checks: age, male (bool), platelets in 10^3/uL.
export function pageBPoints(age, male, pltK) {
  const ageP = AGE_POINTS.filter(([lo]) => age >= lo).pop()[1];
  const sexP = male ? MALE_POINTS : 0;
  const pltP = pltK >= PLT_HIGH_K ? 0 : pltK >= PLT_LOW_K ? 6 : 9;
  return { ageP, sexP, pltP, total: ageP + sexP + pltP };
}

export function pageBGroup(total) {
  return total <= 9 ? 'low' : total <= 17 ? 'medium' : 'high';
}

export const pageB = {
  id: 'page-b',
  name: 'PAGE-B',
  disease: 'liver',
  outcome: 'Liver cancer (HCC) within 5 years, hepatitis B on treatment',
  horizonYears: 5,
  kind: 'score',
  derivedIn: 'EU',
  ageRange: [16, null],
  population: 'White adults with chronic hepatitis B on entecavir or tenofovir (1,325 to build, 490 to test). Not for untreated hepatitis B.',
  source: {
    citation: 'Papatheodoridis G, et al. PAGE-B predicts the risk of developing hepatocellular carcinoma in Caucasians with chronic hepatitis B on 5-year antiviral therapy. J Hepatol 2016;64:800–806.',
    doi: '10.1016/j.jhep.2015.11.035'
  },
  equation: 'score = age points (0–10) + male 6 + platelet points (0, 6 or 9); 9 or less low, 10–17 medium, 18 or more high',
  inputs: ['age', 'sex', 'labs.plateletsK', 'hbvCarrier', 'hbvTreated'],

  compute(person) {
    const early = gate(this, person, hbvTreatedGate);
    if (early) return early;
    const p = person.profile;
    const age = Number(p.age);
    const plt = Number(person.labs.plateletsK);
    const r = pageBPoints(age, p.sex === 'male', plt);
    const group = pageBGroup(r.total);
    const terms = [
      { label: 'Age', input: `${age} years`, points: r.ageP },
      { label: 'Male', input: p.sex, points: r.sexP },
      { label: 'Platelets', input: `${plt} ×10³/µL`, points: r.pltP }
    ];
    const notes = [
      'Groups: 9 or less = low (5-year HCC 0% in the build group, 0% in the test group); 10–17 = medium (3%, 4%); 18 or more = high (17%, 16%). These are observed rates in the studies.',
      FIG2_5Y_PCT[r.total] !== undefined
        ? `Fig. 2 curve at score ${r.total}: about ${FIG2_5Y_PCT[r.total]}% within 5 years (read from the figure, not a printed number, about ±0.05 points).`
        : `The figure has no point for score ${r.total}; no 5-year percentage is shown.`,
      'Built on White patients; the Asian version is mPAGE-B.'
    ];
    return computed(this, {
      value: r.total,
      display: `${r.total} points (of 25), ${group}`,
      score: { points: r.total, max: 25 },
      band: { label: `${group} group (${{ low: '9 or less', medium: '10–17', high: '18 or more' }[group]})`, aboveCutoff: group === 'high' },
      terms,
      notes
    });
  }
};
