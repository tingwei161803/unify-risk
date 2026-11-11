// FINDRISC, Finnish Diabetes Risk Score: 10-year risk of type 2 diabetes.
//
// Two published layers, kept apart:
// 1. The questionnaire form of the Finnish Diabetes Association (8 items, 0-26 points,
//    family history included). Its printed bands give the value shown here:
//    under 7: 1 in 100; 7-11: 1 in 25; 12-14: 1 in 6; 15-20: 1 in 3; over 20: 1 in 2.
// 2. Lindstrom J, Tuomilehto J. The Diabetes Risk Score: a practical tool to predict type 2
//    diabetes risk. Diabetes Care 2003;26:725-731. The 7-item score (0-20, no family history),
//    Table 2: share of the 1987 cohort who started diabetes medicine within 10 years, by score
//    band and sex. Shown in the notes for the same answers minus the family-history item.
// Built on Finnish adults aged 35-64, so other ages are "not applicable".

import { computed, gate, bmi, round } from '../util.js';

const FORM_BANDS = [
  { lo: 0, hi: 6, oneIn: 100, label: 'Low' },
  { lo: 7, hi: 11, oneIn: 25, label: 'Slightly elevated' },
  { lo: 12, hi: 14, oneIn: 6, label: 'Moderate' },
  { lo: 15, hi: 20, oneIn: 3, label: 'High' },
  { lo: 21, hi: 26, oneIn: 2, label: 'Very high' }
];

// 2003 paper, Table 2, 1987 cohort, % who started diabetes medicine within 10 years.
const PAPER_BANDS = [
  { lo: 0, hi: 3, men: 0.3, women: 0.6 },
  { lo: 4, hi: 8, men: 2.4, women: 1.3 },
  { lo: 9, hi: 12, men: 10.5, women: 6.6 },
  { lo: 13, hi: 20, men: 32.7, women: 28.2 }
];

const inBand = (bands, score) => bands.find((b) => score >= b.lo && score <= b.hi);

export const findrisc = {
  id: 'findrisc',
  name: 'FINDRISC',
  disease: 'diabetes',
  outcome: 'Type 2 diabetes within 10 years',
  horizonYears: 10,
  kind: 'risk',
  derivedIn: 'EU',
  ageRange: [35, 64],
  population: 'Finnish adults aged 35–64 (1987 survey cohort; checked again in the 1992 cohort).',
  source: {
    citation: 'Lindström J, Tuomilehto J. The Diabetes Risk Score: a practical tool to predict type 2 diabetes risk. Diabetes Care 2003;26:725–731. Bands: Finnish Diabetes Association FINDRISC form.',
    doi: '10.2337/diacare.26.3.725'
  },
  equation: 'score = sum of the 8 form items (0–26); 10-year risk = the band printed on the form',
  inputs: ['age', 'sex', 'heightCm', 'weightKg', 'waistCm', 'active30minDaily', 'vegFruitDaily',
    'bpTreated', 'highGlucoseHistory', 'familyDiabetes'],

  compute(person) {
    const early = gate(this, person, (p) =>
      p.profile && p.profile.diabetes === true ? 'Already has diabetes; FINDRISC estimates the chance of developing it.' : '');
    if (early) return early;

    const p = person.profile;
    const age = Number(p.age);
    const male = p.sex === 'male';
    const b = bmi(p);
    const waist = Number(p.waistCm);

    const ageP = age >= 55 ? 3 : age >= 45 ? 2 : 0;
    const bmiP = b > 30 ? 3 : b >= 25 ? 1 : 0;
    const waistP = male ? (waist > 102 ? 4 : waist >= 94 ? 3 : 0) : (waist > 88 ? 4 : waist >= 80 ? 3 : 0);
    const famP = p.familyDiabetes === 'first' ? 5 : p.familyDiabetes === 'second' ? 3 : 0;
    const terms = [
      { label: `Age ${{ 0: 'under 45', 2: '45–54', 3: '55–64' }[ageP]}`, input: `${age} years`, points: ageP },
      { label: `BMI ${{ 0: 'under 25', 1: '25–30', 3: 'over 30' }[bmiP]}`, input: `${round(b, 1)} kg/m²`, points: bmiP },
      { label: waistLabel(male, waistP), input: `${waist} cm`, points: waistP },
      { label: 'Less than 30 minutes of activity a day', input: p.active30minDaily ? 'no' : 'yes', points: p.active30minDaily ? 0 : 2 },
      { label: 'Vegetables, fruit or berries not every day', input: p.vegFruitDaily ? 'no' : 'yes', points: p.vegFruitDaily ? 0 : 1 },
      { label: 'Has taken blood-pressure medicine', input: p.bpTreated ? 'yes' : 'no', points: p.bpTreated ? 2 : 0 },
      { label: 'Ever told blood sugar was high', input: p.highGlucoseHistory ? 'yes' : 'no', points: p.highGlucoseHistory ? 5 : 0 },
      { label: `Relatives with diabetes (${{ none: 'none', second: 'grandparent, aunt, uncle or cousin', first: 'parent, sibling or child' }[p.familyDiabetes]})`, input: p.familyDiabetes, points: famP }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const band = inBand(FORM_BANDS, points);
    const value = 1 / band.oneIn;

    const paperScore = points - famP;
    const pb = inBand(PAPER_BANDS, paperScore);
    const pct = male ? pb.men : pb.women;
    const notes = [
      `Form band ${band.lo}–${band.hi} (${band.label}): about 1 in ${band.oneIn} people with this score develop type 2 diabetes within 10 years.`,
      `2003 paper (7 items, no family history): this person scores ${paperScore}; Table 2 band ${pb.lo}–${pb.hi}: ${pct}% of ${male ? 'men' : 'women'} in the 1987 cohort started diabetes medicine within 10 years.`,
      'The paper asked about at least 4 hours of activity a week; the form asks about 30 minutes a day.'
    ];
    return computed(this, {
      value,
      display: `about 1 in ${band.oneIn}`,
      score: { points, max: 26 },
      terms,
      notes
    });
  }
};

function waistLabel(male, pts) {
  const bands = male ? { 0: 'under 94 cm', 3: '94–102 cm', 4: 'over 102 cm' } : { 0: 'under 80 cm', 3: '80–88 cm', 4: 'over 88 cm' };
  return `Waist ${bands[pts]} (${male ? 'men' : 'women'})`;
}

// Exposed for checks.js.
export function findriscPaperBand(score, sex) {
  const b = inBand(PAPER_BANDS, score);
  return b ? (sex === 'male' ? b.men : b.women) : null;
}
