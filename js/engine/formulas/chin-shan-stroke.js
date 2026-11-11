// Chin-Shan community stroke model (Taiwan), clinical point version, 10-year stroke risk.
// Chien KL, et al. Constructing the Prediction Model for the Risk of Stroke in a Chinese
// Population: Report From a Cohort Study in Taiwan. Stroke 2010;41:1858-1864.
// Table 2: points per item and the printed total-points -> 10-year risk table.
//
// Table 2 prints the age bands "60-65" and "65-69", so 65 appears twice; here 65 is scored
// in 65-69 (6 points). The paper reports only internal cross-validation.

import { computed, gate, read, formatPercent, yesNo } from '../util.js';

// Index = total points; the last entry is "16 or more".
const RISK_10Y = [0.003, 0.004, 0.005, 0.007, 0.011, 0.015, 0.021, 0.03, 0.043, 0.06, 0.085, 0.119, 0.165, 0.227, 0.308, 0.408, 0.527];
const MAX_POINTS = 19;

function agePoints(age) {
  if (age >= 75) return [8, '75 and over'];
  const pts = Math.floor((age - 35) / 5);
  const lo = 35 + pts * 5;
  return [pts, `${lo}–${lo + 4}`];
}

export const chinShanStroke = {
  id: 'chin-shan-stroke',
  name: 'Chin-Shan stroke (Chien 2010)',
  disease: 'stroke',
  outcome: 'Stroke within 10 years',
  horizonYears: 10,
  ageRange: [35, null],
  population: 'Chin-Shan Community Cohort, Taiwan: 3,513 stroke-free adults aged 35 and over.',
  source: {
    citation: 'Chien KL, et al. Constructing the Prediction Model for the Risk of Stroke in a Chinese Population: Report From a Cohort Study in Taiwan. Stroke 2010;41:1858–1864.',
    doi: '10.1161/STROKEAHA.110.586222'
  },
  equation: 'points = age + sex + systolic BP + diastolic BP + family history + atrial fibrillation + diabetes; 10-year risk = the Table 2 value for that total',
  inputs: ['age', 'sex', 'sbp', 'dbp', 'familyStroke', 'afib', 'diabetes'],

  compute(person) {
    const early = gate(this, person, (p) =>
      read(p, 'strokeHistory') === true ? 'Has had a stroke; this formula estimates a first stroke.' : '');
    if (early) return early;

    const p = person.profile;
    const age = Number(p.age);
    const sbp = Number(p.sbp);
    const dbp = Number(p.dbp);
    const [ageP, ageBand] = agePoints(age);
    const sbpP = sbp >= 150 ? 3 : sbp >= 130 ? 2 : sbp >= 110 ? 1 : 0;
    const sbpBand = ['under 110', '110–129', '130–149', '150 and over'][sbpP];
    const dbpP = dbp >= 95 ? 2 : dbp >= 75 ? 1 : 0;
    const dbpBand = ['under 75', '75–94', '95 and over'][dbpP];

    const terms = [
      { label: `Age ${ageBand}`, input: `${age} years`, points: ageP },
      { label: 'Male', input: p.sex, points: p.sex === 'male' ? 1 : 0 },
      { label: `Systolic BP ${sbpBand}`, input: `${sbp} mmHg`, points: sbpP },
      { label: `Diastolic BP ${dbpBand}`, input: `${dbp} mmHg`, points: dbpP },
      { label: 'Parent or sibling had a stroke', input: yesNo(p.familyStroke), points: p.familyStroke ? 1 : 0 },
      { label: 'Atrial fibrillation', input: yesNo(p.afib), points: p.afib ? 3 : 0 },
      { label: 'Diabetes', input: yesNo(p.diabetes), points: p.diabetes ? 1 : 0 }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const value = RISK_10Y[Math.min(points, 16)];

    const notes = [`Table 2: ${points >= 16 ? '16 or more' : points} points → ${formatPercent(value)} 10-year stroke risk.`];
    if (age >= 60 && age <= 65) notes.push('Table 2 prints the age bands "60–65" and "65–69"; age 65 is scored in 65–69 here.');
    notes.push('Built and checked in one Taiwanese community (internal cross-validation only).');
    if (read(person, 'strokeHistory') === undefined) notes.push('Assumes no previous stroke (not asked).');
    return computed(this, { value, display: formatPercent(value), score: { points, max: MAX_POINTS }, terms, notes });
  }
};

export const CHIN_SHAN_RISK_10Y = RISK_10Y;
