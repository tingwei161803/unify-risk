// Chien 2010 NTUH CKD model, biochemical version (adds uric acid, post-meal glucose, HbA1c, urine protein). Table 4, PDF p.6.
import { gate } from '../util.js';
import { ckdMeta, ckdExclusion, ckdResult, labPoints, LAB_RISK } from './chien-2010-ckd-core.js';

export const chien2010CkdLab = Object.assign(ckdMeta({
  id: 'chien-2010-ckd-lab',
  name: 'Chien 2010 CKD model (with blood and urine tests)',
  equation: 'score = Σ points of age (0–8), diastolic BP (0–1), previous stroke (0 or 4), uric acid (0–2), post-meal glucose (0–1), HbA1c (0–1), urine protein 100 mg/dL or more (0 or 6); 4-year risk = the value printed in Table 4 for that score (0–23)',
  inputs: ['age', 'dbp', 'strokeHistory', 'labs.uricAcidMgDl', 'labs.postprandialGlucoseMgDl', 'labs.hba1cPct', 'labs.proteinuria']
}), {
  compute(person) {
    const early = gate(this, person, ckdExclusion);
    if (early) return early;
    const p = person.profile;
    const l = person.labs;
    const x = {
      age: Number(p.age), dbp: Number(p.dbp), stroke: p.strokeHistory === true, uric: Number(l.uricAcidMgDl),
      ppg: Number(l.postprandialGlucoseMgDl), hba1c: Number(l.hba1cPct), proteinuria: l.proteinuria === true
    };
    const { parts, total } = labPoints(x);
    const terms = [
      ['Age', `${x.age} years`], ['Diastolic blood pressure', `${x.dbp} mmHg`], ['Previous stroke', x.stroke ? 'yes' : 'no'],
      ['Uric acid', `${x.uric} mg/dL`], ['Post-meal glucose', `${x.ppg} mg/dL`], ['HbA1c', `${x.hba1c}%`],
      ['Urine protein 100 mg/dL or more', x.proteinuria ? 'yes' : 'no']
    ].map(([label, input], i) => ({ label, input, points: parts[i] }));
    const notes = [
      `Table 4: ${total} points → ${Math.round(LAB_RISK[total] * 100)}% new chronic kidney disease within 4 years.`,
      'Table 4 gives 1 point for diastolic blood pressure of 80 or more; the clinical version (Table 3) gives 2. The two tables are used separately.',
      'Urine protein means a dipstick reading of 100 mg/dL or more. Risks for totals of 20 and above are printed as 100%.',
      'Built on a hospital health-check cohort with a median follow-up of only 2.2 years, extended to 4 years. The paper does not print S0(4).'
    ];
    return ckdResult(this, total, 23, LAB_RISK, terms, notes);
  }
});
