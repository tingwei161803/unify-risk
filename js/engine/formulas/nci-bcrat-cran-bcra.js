// NCI Breast Cancer Risk Assessment Tool (BCRAT, the Gail model): 5-year risk of invasive breast cancer.
// Gail MH, et al. J Natl Cancer Inst 1989;81:1879-1886 (relative-risk model and absolute-risk equation);
// race-specific coefficients, rates and attributable-risk factors as published
// with the CRAN BCRA 2.1.2 package (GPL). Written here from the formulas and tables recorded in the
// research repo (js/data/coefficients.js COEFFICIENTS['nci-bcrat-cran-bcra']); no package code is copied.
//
// Rates (per person-year, 14 five-year age groups from 20-24 to 85-89): lambda1 = breast cancer incidence,
// lambda2 = death from other causes. Copied from docs/research/disease-risk/coefficients/bcra-rates.csv
// (extracted from CRAN BCRA 2.1.2 absolute.risk.R; White = R lines 6/52, Black = 15/61, Other = 21/67).
// Note: the package uses the older SEER 1983-87 White rates; whether the NCI web tool uses the same
// table today is unconfirmed.
//
// Covered: White, Black and Other. Hispanic needs US-born vs foreign-born (no field for it) and Asian women
// are covered by AABCS, so both are "not applicable" here.
// Unconfirmed: White/Black/Other absolute risks were not compared with any official NCI output (only the
// Asian branch of the same code was reproduced, see aabcs). The age range 35-85 is the Gail model's design
// range; the research files give 20-90 for the code.

import { computed, formatPercent, round } from '../util.js';
import { gateCancer, isNum, gailAbsoluteRisk } from './_cancer-util.js';

// bcra-rates.csv, race_code 1 (White) and 4 (Other): identical rows.
const RATES_WHITE = {
  lambda1: [0.00001, 0.000076, 0.000266, 0.000661, 0.001265, 0.001866, 0.002211, 0.002721, 0.003348, 0.003923, 0.004178, 0.004439, 0.004421, 0.004109],
  lambda2: [0.000493, 0.000531, 0.000625, 0.000825, 0.001307, 0.002181, 0.003655, 0.005852, 0.009439, 0.015028, 0.023839, 0.038832, 0.066828, 0.144908]
};
// bcra-rates.csv, race_code 2 (Black).
const RATES_BLACK = {
  lambda1: [0.00002696, 0.00011295, 0.00031094, 0.00067639, 0.00119444, 0.00187394, 0.00241504, 0.00291112, 0.00310127, 0.0036656, 0.00393132, 0.00408951, 0.00396793, 0.00363712],
  lambda2: [0.00074354, 0.00101698, 0.00145937, 0.00215933, 0.00315077, 0.00448779, 0.00632281, 0.00963037, 0.01471818, 0.02116304, 0.03266035, 0.04564087, 0.06835185, 0.13271262]
};

// Coefficients (relative.risk.R lines 2-10) for NB, AM, AF, NR, NB x (age 50+), AF x NR, and 1 - AR
// below / from age 50 (absolute.risk.R lines 97-102), as recorded in the research file.
const MODELS = {
  white: { rates: RATES_WHITE, beta: [0.5292641686, 0.0940103059, 0.2186262218, 0.9583027845, -0.288042483, -0.1908113865], oneMinusAr: [0.5788413, 0.5788413] },
  other: { rates: RATES_WHITE, beta: [0.5292641686, 0.0940103059, 0.2186262218, 0.9583027845, -0.288042483, -0.1908113865], oneMinusAr: [0.5788413, 0.5788413] },
  black: { rates: RATES_BLACK, beta: [0.1822121131, 0.2672530336, 0, 0.4757242578, -0.1119411682, 0], oneMinusAr: [0.7294988, 0.74397137] }
};

// Category coding (recode.check.R lines 31-120 as recorded in the research file).
// afl = age at first live birth (number) or 'none'.
export function bcratCodes(race, { menarche, afl, relatives, biopsies, atypical }) {
  const black = race === 'black';
  const nb = biopsies >= 2 ? 2 : biopsies;
  let am = menarche >= 14 ? 0 : menarche >= 12 ? 1 : 2;
  if (black && am === 2) am = 1;
  let af = afl === 'none' ? 2 : afl < 20 ? 0 : afl < 25 ? 1 : afl < 30 ? 2 : 3;
  if (black) af = 0;
  const nr = relatives >= 2 ? 2 : relatives;
  const hyp = biopsies === 0 ? 1.0 : atypical === true ? 1.82 : atypical === false ? 0.93 : 1.0;
  return { nb, am, af, nr, hyp };
}

// Relative risks below and from age 50 for a coded person.
export function bcratRelativeRisk(race, c) {
  const b = MODELS[race].beta;
  const lp1 = c.nb * b[0] + c.am * b[1] + c.af * b[2] + c.nr * b[3] + c.af * c.nr * b[5] + Math.log(c.hyp);
  const lp2 = lp1 + c.nb * b[4];
  return { lt50: Math.exp(lp1), ge50: Math.exp(lp2), lp1, lp2 };
}

// Probability of invasive breast cancer from age t1 to t2.
export function bcratRisk(race, c, t1, t2) {
  const m = MODELS[race];
  const rr = bcratRelativeRisk(race, c);
  return gailAbsoluteRisk({
    t1, t2, lambda1: m.rates.lambda1, lambda2: m.rates.lambda2,
    rr: (age) => (age < 50 ? rr.lt50 : rr.ge50),
    oneMinusAr: (age) => (age < 50 ? m.oneMinusAr[0] : m.oneMinusAr[1])
  });
}

export const nciBcrat = {
  id: 'nci-bcrat-cran-bcra',
  name: 'NCI BCRAT (Gail model)',
  disease: 'breast cancer',
  outcome: 'Invasive breast cancer within 5 years',
  horizonYears: 5,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [35, 85],
  population: 'US women examined regularly (Gail model, Breast Cancer Detection Demonstration Project); rates for White, Black and Other women from SEER and national death statistics.',
  source: {
    citation: 'Gail MH, et al. J Natl Cancer Inst 1989;81:1879–1886; coefficients and rates as in CRAN BCRA 2.1.2 (NCI Breast Cancer Risk Assessment Tool).',
    doi: '10.1093/jnci/81.24.1879'
  },
  equation: 'relative risk = exp(NB·β1 + AM·β2 + AF·β3 + NR·β4 + AF·NR·β6 + ln(hyperplasia factor) [+ NB·β5 from age 50]); in one-year steps risk = Σ (1−AR)·RR·λ1/λ · e^(−Σ earlier λ) · (1 − e^(−λ)), with λ = (1−AR)·RR·λ1 + λ2',
  inputs: ['age', 'sex', 'ethnicity', 'ageAtMenarche', 'ageAtFirstLiveBirth', 'familyBreastCancerCount', 'breastBiopsyCount', 'atypicalHyperplasia'],

  compute(person) {
    const early = gateCancer(this, person, {
      numeric: ['age', 'sex', 'ageAtMenarche', 'familyBreastCancerCount', 'breastBiopsyCount'],
      custom: {
        ethnicity: (v) => ['white', 'black', 'other'].includes(v),
        ageAtFirstLiveBirth: (v) => v === 'none' || isNum(v)
      },
      exclusion: (q) => {
        const p = q.profile || {};
        if (p.sex === 'male') return 'The breast cancer tool was built for women.';
        if (p.ethnicity === 'hispanic') return 'The tool uses different rates for Hispanic women born in the US and abroad, and the birthplace is not asked here.';
        if (p.ethnicity === 'asian') return 'For Asian women this app uses the Asian American model (AABCS) instead.';
        return '';
      }
    });
    if (early) return early;

    const p = person.profile;
    const race = p.ethnicity;
    const c = bcratCodes(race, {
      menarche: Number(p.ageAtMenarche),
      afl: p.ageAtFirstLiveBirth === 'none' ? 'none' : Number(p.ageAtFirstLiveBirth),
      relatives: Number(p.familyBreastCancerCount),
      biopsies: Number(p.breastBiopsyCount),
      atypical: p.atypicalHyperplasia
    });
    const age = Number(p.age);
    const rr = bcratRelativeRisk(race, c);
    const value = bcratRisk(race, c, age, age + 5);
    const b = MODELS[race].beta;
    const terms = [
      { label: 'Breast biopsies (0, 1, 2 or more)', input: `${p.breastBiopsyCount}`, beta: b[0], x: c.nb, contribution: b[0] * c.nb },
      { label: 'Age at first period (14+: 0, 12–13: 1, under 12: 2)', input: `${p.ageAtMenarche}`, beta: b[1], x: c.am, contribution: b[1] * c.am },
      { label: 'Age at first live birth (under 20: 0, 20–24: 1, 25–29 or none: 2, 30+: 3)', input: `${p.ageAtFirstLiveBirth}`, beta: b[2], x: c.af, contribution: b[2] * c.af },
      { label: 'Relatives with breast cancer (0, 1, 2 or more)', input: `${p.familyBreastCancerCount}`, beta: b[3], x: c.nr, contribution: b[3] * c.nr },
      { label: 'First live birth age × relatives', input: '', beta: b[5], x: c.af * c.nr, contribution: b[5] * c.af * c.nr },
      { label: 'Hyperplasia factor (ln)', input: p.atypicalHyperplasia === undefined ? 'unknown' : String(p.atypicalHyperplasia), beta: 1, x: Math.log(c.hyp), contribution: Math.log(c.hyp) }
    ];
    const notes = [
      `Relative risk ${round(age < 50 ? rr.lt50 : rr.ge50, 2)} compared with a woman of the same age with the lowest category on every factor.`,
      `Risk over the next 10 years: ${formatPercent(bcratRisk(race, c, age, Math.min(90, age + 10)))}${age + 10 > 90 ? ' (to age 90)' : ''}.`,
      'Not asked: whether she has had breast cancer, DCIS or LCIS, or carries a BRCA mutation; the tool is not for those women.',
      'The research record has not compared the White, Black and Other results with an official NCI output. The same code reproduced the published Asian American tables (see AABCS).'
    ];
    if (Number(p.breastBiopsyCount) > 0 && typeof p.atypicalHyperplasia !== 'boolean') {
      notes.push('Biopsy result for atypical hyperplasia not given: treated as unknown (factor 1.00).');
    }
    return computed(this, { value, display: formatPercent(value), terms, notes });
  }
};
