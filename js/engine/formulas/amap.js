// aMAP score: liver cancer (HCC) score for people with chronic hepatitis or chronic liver disease.
// Fan R, et al. aMAP risk score predicts hepatocellular carcinoma development in patients with
// chronic hepatitis. J Hepatol 2020;73:1368-1378. ALBI formula PDF p.5, aMAP formula PDF p.6.
//
//   ALBI = log10(bilirubin, umol/L) x 0.66 + albumin (g/L) x (-0.085)
//   aMAP = (0.06 x age + 0.89 x male + 0.48 x ALBI - 0.01 x platelets (10^3/mm3) + 7.4) / 14.77 x 100
//
// Groups (p.2, p.6): low 0-50, medium 50-60, high 60-100. Which group exactly 50 or 60 belongs to is
// not stated in the paper (UNCONFIRMED); here <50 low, 50 to <60 medium, 60 or more high.
// Observed 5-year HCC in the training set: 0.8%, 4.2%, 19.9%.
// DERIVED CANDIDATE, not published by the authors: the paper gives only the baseline survival
// S0(5) = 0.984 (p.6), not the linear predictor it belongs to. The team assumed
// LP = 0.06 age + 0.89 male + 0.48 ALBI - 0.01 platelets (no 7.4, not centred) and
// risk5 = 1 - 0.984^exp(LP); it fits the three groups but the group-3 upper bound (100%) barely
// constrains it, and using the Table 2 Cox coefficients instead changes the results by 14-40%.
// It is shown in the notes only, and the value is the score.
// Units converted here: bilirubin mg/dL x 17.1 -> umol/L; albumin g/dL x 10 -> g/L (conversion
// factors from our literature notes); platelets x10^3/uL equal 10^3/mm3.

import { computed, gate, notApplicable, missingResult, round, formatPercent } from '../util.js';

const B = { age: 0.06, male: 0.89, albi: 0.48, plt: -0.01, constant: 7.4, divisor: 14.77 };
const ALBI = { bili: 0.66, alb: -0.085 };
const S0_5Y = 0.984;
const BILI_UMOL_PER_MGDL = 17.1;
const CUT_MEDIUM = 50;
const CUT_HIGH = 60;

// Exposed for checks: age, male (bool), bilirubin umol/L, albumin g/L, platelets 10^3/mm3.
export function amapScore(age, male, biliUmol, albGL, plt) {
  const albi = Math.log10(biliUmol) * ALBI.bili + albGL * ALBI.alb;
  const lp = B.age * age + B.male * (male ? 1 : 0) + B.albi * albi + B.plt * plt;
  return { albi, lp, score: (lp + B.constant) / B.divisor * 100 };
}

export const amap = {
  id: 'amap',
  name: 'aMAP',
  disease: 'liver',
  outcome: 'Liver cancer (HCC) within 5 years, chronic liver disease',
  horizonYears: 5,
  kind: 'score',
  derivedIn: 'EU',
  ageRange: [null, null],
  population: 'Adults with chronic hepatitis (3,688 Asian people with hepatitis B to build; checked in White and Asian people with hepatitis B, C or non-viral liver disease). Japanese and Taiwanese checks were weaker (C-index 0.549).',
  source: {
    citation: 'Fan R, et al. aMAP risk score predicts hepatocellular carcinoma development in patients with chronic hepatitis. J Hepatol 2020;73:1368–1378.',
    doi: '10.1016/j.jhep.2020.07.025'
  },
  equation: 'aMAP = (0.06·age + 0.89·male + 0.48·ALBI − 0.01·platelets + 7.4) ÷ 14.77 × 100; ALBI = 0.66·log10(bilirubin µmol/L) − 0.085·albumin g/L; below 50 low, 50–59 medium, 60 or more high',
  inputs: ['age', 'sex', 'labs.bilirubinMgDl', 'labs.albuminGdL', 'labs.plateletsK'],

  compute(person) {
    const pr = person.profile || {};
    const chronic = pr.chronicLiverDisease === true || pr.hbvCarrier === true || pr.hcv === true || pr.cirrhosis === true;
    const early = gate(this, person, () => (!chronic && pr.chronicLiverDisease === false
      ? 'No chronic liver disease; aMAP is for people with chronic hepatitis or chronic liver disease.' : ''));
    if (early) return early;
    if (!chronic && pr.chronicLiverDisease === undefined) {
      return missingResult(this, [{ field: 'chronicLiverDisease', label: 'Has chronic liver disease (hepatitis B or C, cirrhosis)' }]);
    }
    const l = person.labs;
    const bili = Number(l.bilirubinMgDl) * BILI_UMOL_PER_MGDL;
    if (!(bili > 0)) return notApplicable(this, 'Bilirubin must be above zero.');
    const age = Number(pr.age);
    const alb = Number(l.albuminGdL) * 10;
    const plt = Number(l.plateletsK);
    const r = amapScore(age, pr.sex === 'male', bili, alb, plt);
    const group = r.score < CUT_MEDIUM ? 'low' : r.score < CUT_HIGH ? 'medium' : 'high';
    const risk5 = 1 - Math.pow(S0_5Y, Math.exp(r.lp));
    return computed(this, {
      value: round(r.score, 1),
      display: `${round(r.score, 1)} (score), ${group}`,
      band: { label: `${group} group (${{ low: 'below 50', medium: '50 to below 60', high: '60 or more' }[group]})`, aboveCutoff: group === 'high' },
      terms: [
        { label: 'Age', input: `${age} years`, beta: B.age, x: age, contribution: round(B.age * age, 4) },
        { label: 'Male', input: pr.sex, beta: B.male, x: pr.sex === 'male' ? 1 : 0, contribution: pr.sex === 'male' ? B.male : 0 },
        { label: 'ALBI (from bilirubin and albumin)', input: `${round(bili, 1)} µmol/L, ${round(alb, 1)} g/L`, beta: B.albi, x: round(r.albi, 4), contribution: round(B.albi * r.albi, 4) },
        { label: 'Platelets (10³/mm³)', input: `${plt}`, beta: B.plt, x: plt, contribution: round(B.plt * plt, 4) },
        { label: 'Constant', input: '', beta: null, x: null, contribution: B.constant }
      ],
      notes: [
        'Observed 5-year liver cancer in the training set: low 0.8%, medium 4.2%, high 19.9% (the 50 and 60 cut-offs: which group the exact values belong to is not stated in the paper).',
        `DERIVED candidate, not published by the authors: 1 − 0.984^exp(LP) gives about ${formatPercent(risk5)} within 5 years (LP = ${round(r.lp, 3)}, without the constant 7.4). The paper gives only the baseline survival 0.984, so this is an assumption and may be off by 14–40%. Prefer the group.`,
        'Bilirubin was converted from mg/dL (×17.1) and albumin from g/dL (×10) to the units the paper uses.'
      ]
    });
  }
};
