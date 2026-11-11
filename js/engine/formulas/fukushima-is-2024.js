// Fukushima ischaemic stroke score, 4-year risk, ages 40-74 (Japan).
// Ma E, et al. J Atheroscler Thromb 2024;31(3):259-272. doi:10.5551/jat.64018.
// Points from Fig. 3a (= round(beta / 0.1469), beta from Table 2); score-to-risk from Fig. 3b
// (average 4-year risk of each fifth of the development cohort). Numbers are copied from
// COEFFICIENTS['fukushima-is-2024'].
//
// The paper's continuous Cox equation cannot be rebuilt (the category means M are not printed), so the
// result is the AVERAGE risk of the person's score group, not an individual probability.
// Maximum by Fig. 3a is 38; the paper text says 35, so the table is used.

import { computed, gate, read, formatPercent } from '../util.js';

// Fig. 3a points and Table 2 betas, exported so checks can re-derive the points.
export const FUKUSHIMA_ITEMS = [
  // [label, beta (Table 2), points (Fig. 3a)]
  ['Age 45–49', 0.6179, 4], ['Age 50–54', 0.6784, 5], ['Age 55–59', 1.2034, 8],
  ['Age 60–64', 1.6252, 11], ['Age 65–69', 2.038, 14], ['Age 70–74', 2.5434, 17],
  ['Male', 0.5988, 4],
  ['Blood pressure high-normal', 0.4883, 3], ['Blood pressure elevated', 0.868, 6], ['Blood pressure hypertension', 1.0425, 7],
  ['Diabetes', 0.5754, 4],
  ['HDL-C 40–59 mg/dL', -0.2841, -2], ['HDL-C 60 or more mg/dL', -0.3797, -3],
  ['LDL-C 130–159 mg/dL', 0.1469, 1], ['LDL-C 160 or more mg/dL', 0.2721, 2],
  ['Smoking', 0.4843, 3], ['Fast walking speed', -0.1853, -1], ['Weight changed by 3 kg or more in a year', 0.2164, 1]
];
const PTS = Object.fromEntries(FUKUSHIMA_ITEMS.map(([l, , p]) => [l, p]));
const MAX = 17 + 4 + 7 + 4 + 0 + 2 + 3 + 0 + 1; // age + male + BP + diabetes + HDL(0 at most) + LDL + smoking + walking(0 at most) + weight

// Fig. 3b: [lowest score of the group, label, average 4-year risk]
const GROUPS = [
  [-Infinity, 'below 8', 0.00071],
  [8, '8 to 13', 0.00197],
  [14, '14 to 17', 0.00394],
  [18, '18 to 21', 0.00706],
  [22, '22 or more', 0.01623]
];

export const fukushimaIs = {
  id: 'fukushima-is-2024',
  name: 'Fukushima stroke score',
  disease: 'stroke',
  outcome: 'Ischaemic stroke within 4 years (average of the score group)',
  horizonYears: 4,
  kind: 'risk',
  derivedIn: 'JP',
  ageRange: [40, 74],
  population: 'Fukushima Prefecture health check-ups linked to insurance claims (Japan), adults aged 40–74 with no ischaemic heart disease or stroke.',
  source: {
    citation: 'Ma E, et al. Prediction of the 4-Year Incidence Risk of Ischemic Stroke in Healthy Japanese Adults: The Fukushima Health Database. J Atheroscler Thromb 2024;31(3):259–272.',
    doi: '10.5551/jat.64018'
  },
  equation: 'score = sum of points (age 0–17, male 4, blood pressure 0–7, diabetes 4, HDL −3 to 0, LDL 0–2, smoking 3, fast walking −1, weight change 1); 4-year risk = average of the score group (Fig. 3b)',
  inputs: ['age', 'sex', 'sbp', 'dbp', 'bpTreated', 'diabetes', 'labs.hdlMgDl', 'labs.ldlMgDl', 'smoking',
    'walkingSpeedFast', 'weightChange3kgLastYear'],

  compute(person) {
    const early = gate(this, person, (p) =>
      read(p, 'strokeHistory') === true ? 'Has had a stroke; this formula covers people with no stroke or ischaemic heart disease.' : '');
    if (early) return early;

    const p = person.profile;
    const hdl = Number(person.labs.hdlMgDl);
    const ldl = Number(person.labs.ldlMgDl);
    const sbp = Number(p.sbp);
    const dbp = Number(p.dbp);
    const age = Math.floor(Number(p.age));
    const ageLabel = age < 45 ? null : age < 50 ? 'Age 45–49' : age < 55 ? 'Age 50–54' : age < 60 ? 'Age 55–59'
      : age < 65 ? 'Age 60–64' : age < 70 ? 'Age 65–69' : 'Age 70–74';

    // Blood pressure class (Methods): treated, SBP >= 140 or DBP >= 90 -> hypertension.
    let bpLabel, bpName;
    if (p.bpTreated === true || sbp >= 140 || dbp >= 90) { bpLabel = 'Blood pressure hypertension'; bpName = 'hypertension'; }
    else if (sbp < 120 && dbp < 80) { bpLabel = null; bpName = 'normal'; }
    else if (sbp < 130 && dbp < 80) { bpLabel = 'Blood pressure high-normal'; bpName = 'high-normal'; }
    else { bpLabel = 'Blood pressure elevated'; bpName = 'elevated'; }

    const hdlLabel = hdl >= 60 ? 'HDL-C 60 or more mg/dL' : hdl >= 40 ? 'HDL-C 40–59 mg/dL' : null;
    const ldlLabel = ldl >= 160 ? 'LDL-C 160 or more mg/dL' : ldl >= 130 ? 'LDL-C 130–159 mg/dL' : null;
    const pt = (label) => (label ? PTS[label] : 0);
    const terms = [
      { label: 'Age group (40–44 = 0)', input: `${p.age} years`, points: pt(ageLabel) },
      { label: 'Male', input: p.sex, points: p.sex === 'male' ? PTS.Male : 0 },
      { label: 'Blood pressure class', input: `${bpName} (${sbp}/${dbp}${p.bpTreated ? ', on medicine' : ''})`, points: pt(bpLabel) },
      { label: 'Diabetes', input: p.diabetes ? 'yes' : 'no', points: p.diabetes === true ? PTS.Diabetes : 0 },
      { label: 'HDL cholesterol', input: `${hdl} mg/dL`, points: pt(hdlLabel) },
      { label: 'LDL cholesterol', input: `${ldl} mg/dL`, points: pt(ldlLabel) },
      { label: 'Smoking', input: p.smoking, points: p.smoking === 'current' ? PTS.Smoking : 0 },
      { label: 'Fast walking speed', input: p.walkingSpeedFast ? 'yes' : 'no', points: p.walkingSpeedFast === true ? PTS['Fast walking speed'] : 0 },
      { label: 'Weight changed by 3 kg or more in a year', input: p.weightChange3kgLastYear ? 'yes' : 'no',
        points: p.weightChange3kgLastYear === true ? PTS['Weight changed by 3 kg or more in a year'] : 0 }
    ];
    const points = terms.reduce((s, t) => s + t.points, 0);
    const g = [...GROUPS].reverse().find(([lo]) => points >= lo);
    const risk = g[2];
    const notes = [
      `Score ${points} falls in the group "${g[1]}"; the number shown is the average 4-year risk of that group (Fig. 3b), not an individual probability.`,
      'The paper’s continuous equation cannot be rebuilt (category means are not printed), so only the points and group averages are used.',
      `Maximum by the Fig. 3a table is ${MAX}; the paper’s text says 35, so the table is used.`,
      'Smoking is read as current smoking. Previous ischaemic heart disease is not asked separately; only a previous stroke makes the result not applicable.',
      'Japanese data; the outcome is a claims code, not a clinical judgement. No worked example is printed in the paper.'
    ];
    return computed(this, {
      value: risk, display: formatPercent(risk), score: { points, max: MAX }, terms, notes
    });
  }
};
