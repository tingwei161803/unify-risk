// PLACEHOLDER sample person (issue #5 replaces this file). Nobody here is real.
// Shape: docs/interfaces.md.

export const PERSONAS = [
  {
    id: 'lin',
    region: 'TW',
    name: 'Mr. Lin',
    tagline: '62 · Taipei · smokes, blood pressure untreated',
    blurb: 'His father had a stroke at 70. His check-up says his blood pressure is "a bit high", and he has never taken medicine for it.',
    populationIds: ['tw', 'men'],
    profile: {
      age: 62, sex: 'male', heightCm: 168, weightKg: 76, waistCm: 95, educationYears: 12,
      smoking: 'current', sbp: 148, dbp: 92, bpTreated: false, diabetes: false,
      highGlucoseHistory: true, afib: false, cvdHistory: false, familyStroke: true,
      familyDiabetes: 'second', active30minDaily: false, exerciseTwiceWeekly: false, vegFruitDaily: true
    },
    labs: { totalCholMgDl: 212, hdlMgDl: 41, fastingGlucoseMgDl: 108, hba1cPct: 5.9 }
  }
];
