// AABCS, Asian American Breast Cancer Study model: 5-year risk of invasive breast cancer.
// Matsuno RK, et al. J Natl Cancer Inst 2011;103:951-961 (Asian American Breast Cancer Study model).
// Log-odds: Supplementary Table 2. 1-AR (F(t)): journal p.955. Chinese incidence and non-breast-cancer
// mortality rates: Supplementary Table 1 (SEER 1998-2002, per 100,000 women-years).
// Values copied from js/data/coefficients.js (COEFFICIENTS.aabcs). Absolute-risk algorithm: Gail 1989
// equation 6 in one-year steps (shared helper).
// Assumption: the model has six rate tables (Chinese, Japanese, Filipino, Hawaiian, Pacific Islander,
// Other Asian). There is no field for the subgroup, so the Chinese rates are used for every woman with
// ethnicity 'asian'. Unvalidated in Taiwan.
// Unconfirmed: the age range. The paper's absolute-risk table starts at age 20; 85 is the last start age
// whose 5-year window stays within the rate table (to age 90).

import { computed, formatPercent, round } from '../util.js';
import { gateCancer, isNum, gailAbsoluteRisk } from './_cancer-util.js';

// Supp Table 2.
const BETA = { nbiops: 0.5526, agemen: 0.075, ageflb: 0.2764, numrel: 0.7919 };
const HYP = { atypical: 1.82, noHyperplasia: 0.93 }; // Table 1 note
// F(t) as used by the authors' code (aabcs.json constants.F_one_minus_AR.locator).
const F = { lt50: 0.47519806426735, ge50: 0.50316401683903 };
// Supp Table 1, Chinese, per 100,000 women-years, 20-24 to 85-89.
const CHINESE = {
  incidence: [0.4, 4.6, 18.8, 49.3, 91.4, 147.2, 142.1, 197.1, 167.5, 182.2, 183.4, 192, 223.3, 224.7],
  mortality: [21.1, 19.3, 24.4, 31.8, 47.3, 80, 121.7, 210, 343.7, 609.7, 1066.5, 2014.9, 3799.1, 9833.4]
};
const per100k = (a) => a.map((v) => v / 1e5);

// Coding (main text Table 1 and pp.953-954). afl = age at first live birth or 'none'.
export function aabcsRelativeRisk({ menarche, afl, relatives, biopsies, atypical }) {
  const nb = Math.min(2, biopsies);
  const am = menarche >= 14 ? 0 : menarche >= 12 ? 1 : 2;
  const af = afl === 'none' ? 2 : afl < 20 ? 0 : afl < 25 ? 1 : afl < 30 ? 2 : 3;
  const nr = relatives > 0 ? 1 : 0;
  const hyp = biopsies === 0 ? 1 : atypical === true ? HYP.atypical : atypical === false ? HYP.noHyperplasia : 1;
  return { nb, am, af, nr, hyp, rr: Math.exp(BETA.nbiops * nb + BETA.agemen * am + BETA.ageflb * af + BETA.numrel * nr) * hyp };
}

// Probability from age t1 to t2 for a relative risk that does not change with age.
export function aabcsRisk(rr, t1, t2) {
  return gailAbsoluteRisk({
    t1, t2, lambda1: per100k(CHINESE.incidence), lambda2: per100k(CHINESE.mortality),
    rr: () => rr,
    oneMinusAr: (age) => (age < 50 ? F.lt50 : F.ge50)
  });
}

export const aabcs = {
  id: 'aabcs',
  name: 'AABCS (Asian American women)',
  disease: 'breast cancer',
  outcome: 'Invasive breast cancer within 5 years',
  horizonYears: 5,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [20, 85],
  population: 'Asian and Pacific Islander women in the US (Asian American Breast Cancer Study: 589 cases, 952 controls); rates here are the Chinese American rates (SEER 1998–2002).',
  source: {
    citation: 'Matsuno RK, et al. J Natl Cancer Inst 2011;103:951–961.',
    doi: '10.1093/jnci/djr154'
  },
  equation: 'relative risk = exp(0.5526·biopsies + 0.0750·AGEMEN + 0.2764·AGEFLB + 0.7919·relative) × hyperplasia factor; in one-year steps risk = Σ F·RR·λ1/λ · e^(−Σ earlier λ) · (1 − e^(−λ)), with λ = F·RR·λ1 + λ2 and F = 0.4752 under 50, 0.5032 from 50',
  inputs: ['age', 'sex', 'ethnicity', 'ageAtMenarche', 'ageAtFirstLiveBirth', 'familyBreastCancerCount', 'breastBiopsyCount', 'atypicalHyperplasia'],

  compute(person) {
    const early = gateCancer(this, person, {
      numeric: ['age', 'sex', 'ageAtMenarche', 'familyBreastCancerCount', 'breastBiopsyCount'],
      custom: { ethnicity: (v) => ['white', 'black', 'hispanic', 'asian', 'other'].includes(v), ageAtFirstLiveBirth: (v) => v === 'none' || isNum(v) },
      exclusion: (q) => {
        const p = q.profile || {};
        if (p.sex === 'male') return 'The breast cancer model was built for women.';
        if (p.ethnicity && p.ethnicity !== 'asian') return 'AABCS was built for Asian and Pacific Islander women in the US.';
        return '';
      }
    });
    if (early) return early;

    const p = person.profile;
    const c = aabcsRelativeRisk({
      menarche: Number(p.ageAtMenarche),
      afl: p.ageAtFirstLiveBirth === 'none' ? 'none' : Number(p.ageAtFirstLiveBirth),
      relatives: Number(p.familyBreastCancerCount),
      biopsies: Number(p.breastBiopsyCount),
      atypical: p.atypicalHyperplasia
    });
    const age = Number(p.age);
    const value = aabcsRisk(c.rr, age, age + 5);
    const terms = [
      { label: 'Breast biopsies (0, 1, 2 or more)', input: `${p.breastBiopsyCount}`, beta: BETA.nbiops, x: c.nb, contribution: BETA.nbiops * c.nb },
      { label: 'Age at first period (14+: 0, 12–13: 1, under 12: 2)', input: `${p.ageAtMenarche}`, beta: BETA.agemen, x: c.am, contribution: BETA.agemen * c.am },
      { label: 'Age at first live birth (under 20: 0, 20–24: 1, 25–29 or none: 2, 30+: 3)', input: `${p.ageAtFirstLiveBirth}`, beta: BETA.ageflb, x: c.af, contribution: BETA.ageflb * c.af },
      { label: 'Any mother, sister or daughter with breast cancer', input: `${p.familyBreastCancerCount}`, beta: BETA.numrel, x: c.nr, contribution: BETA.numrel * c.nr }
    ];
    const notes = [
      `Relative risk ${round(c.rr, 2)} (includes hyperplasia factor ${c.hyp}).`,
      `Risk over the next 10 years: ${formatPercent(aabcsRisk(c.rr, age, Math.min(90, age + 10)))}${age + 10 > 90 ? ' (to age 90)' : ''}.`,
      'Uses the Chinese American rate table for every Asian woman; the paper also has Japanese, Filipino, Hawaiian, Pacific Islander and Other Asian tables, but the subgroup is not asked.',
      'Built on Asian American women in the US and not calibrated for Taiwan.',
      'Not asked: whether she has had breast cancer, DCIS or LCIS, or carries a BRCA mutation.'
    ];
    if (Number(p.breastBiopsyCount) > 0 && typeof p.atypicalHyperplasia !== 'boolean') {
      notes.push('Biopsy result for atypical hyperplasia not given: treated as unknown (factor 1.00).');
    }
    return computed(this, { value, display: formatPercent(value), terms, notes });
  }
};
