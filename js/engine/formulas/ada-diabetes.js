// ADA diabetes risk test, 2009 self-assessment version: the chance that type 2 diabetes is
// already present but not yet known. A points score, not a percentage.
// Bang H, et al. Development and validation of a patient self-assessment score for diabetes risk.
// Ann Intern Med 2009;151:775-783.
//
// Points (Figure): age under 40: 0, 40-49: 1, 50-59: 2, 60 or over: 3; male: 1; parent or
// sibling with diabetes: 1; high blood pressure or blood-pressure medicine: 1; weight by BMI:
// overweight (25 to under 30): 1, obese (30 to under 40): 2, extremely obese (40 or more): 3;
// physically active: -1. Total -1 to 9.
// Cut-offs printed in the paper: 5 or more = high chance of diabetes that is not yet known
// (Appendix Table 2: in the validation set 35% scored 5 or more; 79% of people with such
// diabetes and 67% of people without it were classified correctly); 4 or more = high chance of
// diabetes or prediabetes (Figure).
// The paper gives no intercept and no score-to-risk table, so there is no probability here.
// Built on US adults aged 20 and over.

import { computed, gate, bmi, round } from '../util.js';

export function adaBand(points) {
  if (points >= 5) return { label: '5 or more: high chance that type 2 diabetes is already present but not yet known; the paper suggests a blood sugar test', aboveCutoff: true };
  if (points >= 4) return { label: '4: high chance of diabetes or prediabetes (the lower cut-off on the form)', aboveCutoff: true };
  return { label: '3 or less: below the cut-offs printed in the paper', aboveCutoff: false };
}

export const adaDiabetes = {
  id: 'ada-risk-test-bang-2009',
  name: 'ADA diabetes risk test',
  disease: 'diabetes',
  outcome: 'Type 2 diabetes that may already be present but not yet known',
  horizonYears: null,
  kind: 'score',
  derivedIn: 'US',
  ageRange: [20, null],
  population: 'US adults aged 20 and over without known diabetes (NHANES 1999–2004, 5,258 people); checked in NHANES 2005–2006 and the ARIC and CHS cohorts.',
  source: {
    citation: 'Bang H, et al. Development and validation of a patient self-assessment score for diabetes risk. Ann Intern Med 2009;151:775–783.',
    doi: '10.7326/0003-4819-151-11-200912010-00005'
  },
  equation: 'score = sum of 6 items (−1 to 9); 5 or more = the paper\'s high-chance cut-off; no percentage',
  inputs: ['age', 'sex', 'familyDiabetes', 'bpTreated', 'heightCm', 'weightKg', 'active30minDaily'],

  compute(person) {
    const early = gate(this, person, (p) =>
      p.profile && p.profile.diabetes === true ? 'Already has diabetes; this test is about diabetes that is not yet known.' : '');
    if (early) return early;

    const p = person.profile;
    const age = Number(p.age);
    const b = bmi(p);

    const ageP = age >= 60 ? 3 : age >= 50 ? 2 : age >= 40 ? 1 : 0;
    const weightP = b >= 40 ? 3 : b >= 30 ? 2 : b >= 25 ? 1 : 0;
    const terms = [
      { label: `Age ${{ 0: 'under 40', 1: '40–49', 2: '50–59', 3: '60 or over' }[ageP]}`, input: `${age} years`, points: ageP },
      { label: 'Male', input: p.sex, points: p.sex === 'male' ? 1 : 0 },
      { label: 'Parent or sibling with diabetes', input: p.familyDiabetes, points: p.familyDiabetes === 'first' ? 1 : 0 },
      { label: 'High blood pressure (blood-pressure medicine)', input: p.bpTreated ? 'yes' : 'no', points: p.bpTreated ? 1 : 0 },
      { label: `Weight: ${{ 0: 'not overweight', 1: 'overweight (BMI 25 to under 30)', 2: 'obese (BMI 30 to under 40)', 3: 'extremely obese (BMI 40 or more)' }[weightP]}`, input: `${round(b, 1)} kg/m²`, points: weightP },
      { label: 'Physically active (30 minutes most days)', input: p.active30minDaily ? 'yes' : 'no', points: p.active30minDaily ? -1 : 0 }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const band = adaBand(points);

    const notes = [
      `Score ${points}: ${band.label}.`,
      'Appendix Table 2 (validation set): 35% of people scored 5 or more; that cut-off classified 79% of people with diabetes not yet known, and 67% of people without it, correctly.',
      'The paper gives no intercept or score-to-risk table, so this result is a score, not a percentage.',
      'Family history counts a parent or sibling; the app\'s answer for a parent, sibling or child is used.',
      'The paper asks about a past high blood pressure or medicine for it; only blood-pressure medicine is asked here, so high blood pressure without medicine is not counted.',
      'The paper asks "Are you physically active?" without a definition; the answer about 30 minutes of activity most days is used.',
      'The 2009 paper has no gestational-diabetes item (the later online test added one), so none is asked here.'
    ];
    return computed(this, { value: points, display: `${points} points (of 9)`, score: { points, max: 9 }, band, terms, notes });
  }
};
