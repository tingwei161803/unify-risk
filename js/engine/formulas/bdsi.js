// BDSI (Barnes 2014): points for who may benefit from a memory check first, ages 65-79.
// Barnes DE, et al. Alzheimers Dement 2014;10:656-665 (Table 3 and Results).
// Pooled from four US cohorts (CHS, FHS, HRS, SALSA); outcome: dementia within 6 years.
//
// Points (0-56): age 66-79: 1 per year over 65 (65 = 0, max 14); education under 12 years: 9;
// BMI under 18.5: 8; diabetes: 3; stroke: 6; needs help with money or medicines: 10;
// depressive symptoms (takes an antidepressant, or "everything was an effort" on 3 or more days
// in the past week): 6. 22 points or more = as likely to develop dementia within 6 years as
// people aged 80-84. The paper publishes no risk per score, so no percentage is shown.
// From age 80 the paper suggests a memory check on age alone, so the score is not used.

import { computed, gate, notApplicable, bmi, round, yesNo, read } from '../util.js';

const CUTOFF = 22;
const MAX = 56;

const LABELS = {
  strokeHistory: 'Ever had a stroke',
  iadlHelp: 'Needs help managing money or medicines',
  depressiveSymptoms: 'Depressive symptoms (takes an antidepressant, or felt everything was an effort on 3 or more days last week)'
};

export const bdsi = {
  id: 'bdsi',
  name: 'BDSI',
  disease: 'dementia',
  outcome: 'Dementia within 6 years (points; no percentage published)',
  kind: 'score',
  derivedIn: 'US',
  horizonYears: 6,
  ageRange: [65, 79],
  population: 'Four US cohorts (CHS, FHS, HRS, SALSA): adults aged 65–79 without dementia, followed for 6 years.',
  source: {
    // Cited without its title: the title uses a word the product wording rules avoid (AGENTS.md §3).
    citation: 'Barnes DE, et al. Alzheimers Dement 2014;10:656–665 (Brief Dementia Indicator, BDSI).',
    doi: '10.1016/j.jalz.2013.11.006'
  },
  equation: `score = sum of 7 items (0–${MAX}); ${CUTOFF} or more = as likely to develop dementia within 6 years as people aged 80–84`,
  inputs: ['age', 'educationYears', 'heightCm', 'weightKg', 'diabetes', 'strokeHistory', 'iadlHelp', 'depressiveSymptoms'],

  compute(person) {
    const age = Number(read(person, 'age'));
    if (Number.isFinite(age) && age >= 80) {
      return notApplicable(this, `Age ${age}: from 80 the paper suggests a memory check on age alone, without the score.`);
    }
    const early = gate(this, person);
    if (early) {
      if (early.status === 'missing') {
        early.missing = early.missing.map((m) => ({ field: m.field, label: LABELS[m.field] || m.label }));
      }
      return early;
    }

    const p = person.profile;
    const edu = Number(p.educationYears);
    const b = bmi(p);
    const terms = [
      { label: 'Age (1 point per year over 65)', input: `${age} years`, points: Math.min(14, Math.max(0, Math.floor(age) - 65)) },
      { label: 'Education under 12 years', input: `${edu} years`, points: edu < 12 ? 9 : 0 },
      { label: 'BMI under 18.5', input: `${round(b, 1)} kg/m²`, points: b < 18.5 ? 8 : 0 },
      { label: 'Diabetes', input: yesNo(p.diabetes), points: p.diabetes === true ? 3 : 0 },
      { label: 'Stroke', input: yesNo(p.strokeHistory), points: p.strokeHistory === true ? 6 : 0 },
      { label: 'Needs help with money or medicines', input: yesNo(p.iadlHelp), points: p.iadlHelp === true ? 10 : 0 },
      { label: 'Depressive symptoms', input: yesNo(p.depressiveSymptoms), points: p.depressiveSymptoms === true ? 6 : 0 }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const high = points >= CUTOFF;
    const notes = [
      `${CUTOFF} points or more: as likely to develop dementia within 6 years as people aged 80–84 (Barnes 2014).`,
      'The paper publishes no percentage for each score, so none is shown.'
    ];
    return computed(this, {
      value: points,
      display: `${points} of ${MAX} points · ${high ? 'at or above' : 'below'} the ${CUTOFF}-point line`,
      score: { points, max: MAX },
      band: { label: `${high ? 'At or above' : 'Below'} the ${CUTOFF}-point line`, aboveCutoff: high },
      terms,
      notes
    });
  }
};

// Barnes 2014, Table 3 and Results: every item at its highest category adds up to the
// top of the published 0–56 range.
const top = bdsi.compute({
  profile: {
    age: 79, educationYears: 6, heightCm: 160, weightKg: 45, diabetes: true,
    strokeHistory: true, iadlHelp: true, depressiveSymptoms: true
  },
  labs: {}
});

export const checks = [
  {
    formulaId: 'bdsi',
    example: 'Age 79 (14) + under 12 years of school (9) + BMI under 18.5 (8) + diabetes (3) + stroke (6) + needs help with money or medicines (10) + depressive symptoms (6) = 56, the top of the published range',
    expected: MAX,
    actual: top.score ? top.score.points : null,
    pass: Boolean(top.score) && top.score.points === MAX,
    source: 'Barnes 2014, Table 3 and Results (range 0–56)'
  }
];
