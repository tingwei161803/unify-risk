// Framingham Offspring diabetes score: risk of new type 2 diabetes within 8 years.
// Wilson PWF, et al. Prediction of incident diabetes mellitus in middle-aged adults:
// the Framingham Offspring Study. Arch Intern Med 2007;167:1068-1074.
//
// Points (Table 6, men and women together): fasting glucose 100-126 mg/dL: 10; BMI 25.0-29.9: 2,
// 30.0 or more: 5; low HDL (men under 40, women under 50 mg/dL): 5; parent with diabetes: 3;
// triglycerides 150 mg/dL or more: 3; blood pressure 130/85 or more, or treated: 2.
// Table 6 then prints the 8-year risk for each total (10 or fewer: 3% or less; 25 or more: over 35%).
// Age and sex earn no points. The paper states no age range (mean age 54, SD 9.8), so no age
// limit is applied. Built on people without diabetes, so a fasting glucose of 126 or more, or
// known diabetes, is "not applicable".

import { computed, gate, bmi, round } from '../util.js';

// Table 6: total points -> printed 8-year risk. The two ends are inequalities in the table.
const RISK = { 11: 0.04, 12: 0.04, 13: 0.05, 14: 0.06, 15: 0.07, 16: 0.09, 17: 0.11, 18: 0.13,
  19: 0.15, 20: 0.18, 21: 0.21, 22: 0.25, 23: 0.29, 24: 0.33 };

export function wilsonRisk(points) {
  if (points <= 10) return { value: 0.03, display: '3% or less', row: '10 or fewer' };
  if (points >= 25) return { value: 0.35, display: 'more than 35%', row: '25 or more' };
  return { value: RISK[points], display: `${Math.round(RISK[points] * 100)}%`, row: String(points) };
}

export const wilsonDiabetes = {
  id: 'framingham-offspring-diabetes-wilson-2007',
  name: 'Framingham Offspring diabetes score',
  disease: 'diabetes',
  outcome: 'Type 2 diabetes within 8 years',
  horizonYears: 8,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [null, null],
  population: 'Framingham Offspring Study, 5th exam: 3,140 US adults without diabetes (99% white), mean age 54 (SD 9.8). The paper states no age range.',
  source: {
    citation: 'Wilson PWF, et al. Prediction of incident diabetes mellitus in middle-aged adults: the Framingham Offspring Study. Arch Intern Med 2007;167:1068–1074.',
    doi: '10.1001/archinte.167.10.1068'
  },
  equation: 'score = sum of 6 items (0–28); 8-year risk = the value printed in Table 6 for that score',
  inputs: ['sex', 'heightCm', 'weightKg', 'sbp', 'dbp', 'bpTreated', 'familyDiabetes',
    'labs.fastingGlucoseMgDl', 'labs.hdlMgDl', 'labs.tgMgDl'],

  compute(person) {
    const early = gate(this, person, (p) => {
      if (p.profile && p.profile.diabetes === true) return 'Already has diabetes; this score estimates the chance of developing it.';
      const fpg = Number(p.labs && p.labs.fastingGlucoseMgDl);
      if (Number.isFinite(fpg) && fpg >= 126) return 'Fasting glucose is 126 mg/dL or more, the range used for diabetes; this score is for people below that line.';
      return '';
    });
    if (early) return early;

    const p = person.profile;
    const l = person.labs;
    const male = p.sex === 'male';
    const fpg = Number(l.fastingGlucoseMgDl);
    const hdl = Number(l.hdlMgDl);
    const tg = Number(l.tgMgDl);
    const sbp = Number(p.sbp);
    const dbp = Number(p.dbp);
    const b = bmi(p);
    const hdlCut = male ? 40 : 50;
    const bpHigh = p.bpTreated === true || sbp >= 130 || dbp >= 85;

    const terms = [
      { label: 'Fasting glucose 100–126 mg/dL', input: `${fpg} mg/dL`, points: fpg >= 100 ? 10 : 0 },
      { label: `BMI ${b >= 30 ? '30.0 or more' : b >= 25 ? '25.0–29.9' : 'under 25'}`, input: `${round(b, 1)} kg/m²`, points: b >= 30 ? 5 : b >= 25 ? 2 : 0 },
      { label: `Low HDL (under ${hdlCut} mg/dL for ${male ? 'men' : 'women'})`, input: `${hdl} mg/dL`, points: hdl < hdlCut ? 5 : 0 },
      { label: 'Parent with diabetes (first-degree relative used)', input: p.familyDiabetes, points: p.familyDiabetes === 'first' ? 3 : 0 },
      { label: 'Triglycerides 150 mg/dL or more', input: `${tg} mg/dL`, points: tg >= 150 ? 3 : 0 },
      { label: 'Blood pressure 130/85 or more, or on medicine', input: `${sbp}/${dbp} mmHg${p.bpTreated ? ', on medicine' : ''}`, points: bpHigh ? 2 : 0 }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const risk = wilsonRisk(points);

    const notes = [
      `Table 6: ${risk.row} points → ${risk.display} developed type 2 diabetes within 8 years.`,
      'Parent with diabetes: the app asks about a parent, sibling or child (first-degree relative), used here as a stand-in for a parent.',
      'Table 6 prints 3 points for a parent with diabetes and for triglycerides; the text on the same page says 2. The table is used.',
      'The paper states no age range (mean age 54, SD 9.8), so no age limit is applied. Built on a US cohort that was 99% white.'
    ];
    return computed(this, { value: risk.value, display: risk.display, score: { points, max: 28 }, terms, notes });
  }
};
