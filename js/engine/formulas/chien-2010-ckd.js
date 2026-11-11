// Chien 2010 NTUH CKD model, clinical version (no blood test). Table 3, PDF p.6. See chien-2010-ckd-core.js.
import { gate, read, bmi, round } from '../util.js';
import { ckdMeta, ckdExclusion, ckdResult, clinicalPoints, CLINICAL_RISK } from './chien-2010-ckd-core.js';

export const chien2010Ckd = Object.assign(ckdMeta({
  id: 'chien-2010-ckd',
  name: 'Chien 2010 CKD model (clinical)',
  equation: 'score = Σ points of age (0–8), BMI (0–2), diastolic BP (0–2), type 2 diabetes (0 or 1), previous stroke (0 or 4); 4-year risk = the value printed in Table 3 for that score (0–17)',
  inputs: ['age', 'heightCm', 'weightKg', 'dbp', 'diabetes', 'strokeHistory']
}), {
  compute(person) {
    const early = gate(this, person, ckdExclusion);
    if (early) return early;
    const p = person.profile;
    const x = { age: Number(p.age), bmi: bmi(p), dbp: Number(p.dbp), diabetes: p.diabetes === true, stroke: p.strokeHistory === true };
    const { parts, total } = clinicalPoints(x);
    const terms = [
      ['Age', `${x.age} years`], ['BMI', `${round(x.bmi, 1)} kg/m²`], ['Diastolic blood pressure', `${x.dbp} mmHg`],
      ['Type 2 diabetes', x.diabetes ? 'yes' : 'no'], ['Previous stroke', x.stroke ? 'yes' : 'no']
    ].map(([label, input], i) => ({ label, input, points: parts[i] }));
    const notes = [
      `Table 3: ${total} points → ${Math.round(CLINICAL_RISK[total] * 100)}% new chronic kidney disease within 4 years.`,
      'Needs no blood test. Cut-off 7 points in the paper: sensitivity 0.76, specificity 0.66; AUC 0.768 in the derivation cohort and 0.667 in the Chin-Shan community cohort.',
      'Built on a hospital health-check cohort with a median follow-up of only 2.2 years, extended to 4 years. The paper does not print S0(4).'
    ];
    return ckdResult(this, total, 17, CLINICAL_RISK, terms, notes);
  }
});
