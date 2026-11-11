// NAFLD Fibrosis Score (NFS): a score for advanced fibrosis (F3-F4) in people with fatty liver disease.
// Angulo P, et al. The NAFLD fibrosis score. Hepatology 2007;45:846-854. Formula in the text, PDF p.4.
//
//   NFS = -1.675 + 0.037 x age + 0.094 x BMI + 1.13 x (IFG or diabetes: 1/0)
//         + 0.99 x AST/ALT - 0.013 x platelets (10^9/L) - 0.66 x albumin (g/dL)
//
// IFG/diabetes = fasting glucose >= 110 mg/dL or known type 2 diabetes (Table 1 note, p.4).
// Cut-offs (p.1, p.4): below -1.455 rules out advanced fibrosis; above 0.676 rules it in; between
// is indeterminate. The paper gives no score-to-probability equation, so there is no percentage.
// A score exactly on a cut-off is not assigned in the paper; here it counts as indeterminate.

import { computed, gate, bmi, missingResult, read, round } from '../util.js';

const INTERCEPT = -1.675;
const B = { age: 0.037, bmi: 0.094, ifgDm: 1.13, astAlt: 0.99, platelets: -0.013, albumin: -0.66 };
const CUT_LOW = -1.455;
const CUT_HIGH = 0.676;
const IFG_MGDL = 110;

// Exposed for checks.
export function nfsScore(x) {
  return INTERCEPT + B.age * x.age + B.bmi * x.bmi + B.ifgDm * x.ifgDm
    + B.astAlt * (x.ast / x.alt) + B.platelets * x.plt + B.albumin * x.albumin;
}

export const nafldFibrosisScore = {
  id: 'nafld-fibrosis-score',
  name: 'NAFLD fibrosis score',
  disease: 'liver',
  outcome: 'Advanced liver fibrosis (stage F3–F4) now, in people with fatty liver disease',
  horizonYears: null,
  kind: 'value',
  derivedIn: 'US',
  ageRange: [null, null],
  population: '733 people with fatty liver disease confirmed by liver biopsy (480 to build, 253 to test). It is meant for people already known to have fatty liver disease.',
  source: {
    citation: 'Angulo P, et al. The NAFLD fibrosis score: a noninvasive system that identifies liver fibrosis in patients with NAFLD. Hepatology 2007;45:846–854.',
    doi: '10.1002/hep.21496'
  },
  equation: 'NFS = −1.675 + 0.037·age + 0.094·BMI + 1.13·(glucose ≥110 or diabetes) + 0.99·AST/ALT − 0.013·platelets − 0.66·albumin; below −1.455 low, above 0.676 high',
  inputs: ['age', 'heightCm', 'weightKg', 'labs.astUL', 'labs.altUL', 'labs.plateletsK', 'labs.albuminGdL', 'diabetes'],

  compute(person) {
    const early = gate(this, person);
    if (early) return early;
    const p = person.profile;
    const l = person.labs;
    // Glucose is only needed when diabetes is not already known.
    if (p.diabetes !== true && !Number.isFinite(Number(read(person, 'labs.fastingGlucoseMgDl')))) {
      return missingResult(this, [{ field: 'labs.fastingGlucoseMgDl', label: 'Fasting glucose' }]);
    }
    const ifg = p.diabetes === true || Number(l.fastingGlucoseMgDl) >= IFG_MGDL;
    const x = {
      age: Number(p.age), bmi: bmi(p), ifgDm: ifg ? 1 : 0, ast: Number(l.astUL), alt: Number(l.altUL),
      plt: Number(l.plateletsK), albumin: Number(l.albuminGdL)
    };
    const rows = [
      ['Intercept', '', 1, INTERCEPT],
      ['Age', `${x.age} years`, B.age, x.age],
      ['BMI', `${round(x.bmi, 1)} kg/m²`, B.bmi, x.bmi],
      ['Fasting glucose ≥110 mg/dL or diabetes', ifg ? 'yes' : 'no', B.ifgDm, x.ifgDm],
      ['AST / ALT', `${x.ast} / ${x.alt}`, B.astAlt, x.ast / x.alt],
      ['Platelets (10^9/L)', `${x.plt}`, B.platelets, x.plt],
      ['Albumin (g/dL)', `${x.albumin}`, B.albumin, x.albumin]
    ];
    const terms = rows.map(([label, input, beta, v]) => ({
      label, input, beta, x: round(v, 4), contribution: round(label === 'Intercept' ? INTERCEPT : beta * v, 6)
    }));
    const s = nfsScore(x);
    const label = s < CUT_LOW ? `Below ${CUT_LOW}: advanced fibrosis ruled out in the paper`
      : s > CUT_HIGH ? `Above ${CUT_HIGH}: advanced fibrosis likely in the paper`
        : `${CUT_LOW} to ${CUT_HIGH}: indeterminate`;
    return computed(this, {
      value: round(s, 3),
      display: `${round(s, 2)} (score)`,
      band: { label, aboveCutoff: s > CUT_HIGH },
      terms,
      notes: [
        'Low cut-off: negative predictive value 93% (build group) and 88% (test group). High cut-off: positive predictive value 90% and 82% (PDF p.1).',
        'Built only on people with biopsy-proven fatty liver disease; it is not a measure of liver disease risk in the general population.',
        'The paper gives no equation from score to probability, so none is shown.'
      ]
    });
  }
};
