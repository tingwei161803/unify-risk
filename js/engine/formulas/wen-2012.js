// Wen 2012: Taiwan liver cancer (HCC) points score, from the MJ health-check cohort (428,584 people).
// Wen CP, et al. Hepatocellular carcinoma risk prediction model for the general population: the
// predictive power of transaminases. J Natl Cancer Inst 2012;104:1599-1611.
// Points: Supplementary Table 1. Score to 5- and 10-year risk: Supplementary Figure 2 (chart data
// read from the embedded chart in the supplement file by the research team). The authors' baseline
// survival and coefficients are not published, so the score is looked up in those charts.
//
// Shown as the main result: Model 1 (health history only), the version for the group without an
// HCV test ("A" in the paper), score -1 to 12. Points: male 2; age 40-59: 2, 60+: 6; smoking
// 1-9.9 pack-years 1, 10+: 1; regular drinking 1; physical activity 3.75-7.49 MET-h -1, 7.5+: -1;
// diabetes 2. (The "B" group, who had an HCV test, has slightly different points for Model 1;
// not used.) Regular drinking = at least 2 drinks a time on at least 3 days a week.
// Also shown in the notes when the labs are given: Model 2 of group A (AST and ALT only) and, when
// hepatitis B, hepatitis C, AFP, AST and ALT are all given, Model 5 of group B (health history +
// transaminases + AFP + HBV + HCV). Models 3 and 4 of group A have no complete score-to-risk table
// (image only), and Model 4 of group B is not used, so they are skipped.
// UNCONFIRMED: the chart-to-model link for B Models 2 and 3 (not used here). Built on people in
// Taiwan aged 20 and over; the lowest age band starts at 20.

import { computed, gate, formatPercent, round } from '../util.js';

// Supp Table 1 columns used. Keys: male, age4059, age60, smoke1to9 (1-9.9 pack-years), smoke10, drink,
// pa375 (3.75-7.49 MET-h), pa75 (7.5+ MET-h), dm, ast25, ast40, ast60, alt25, afp25, afp5, afp10, hbv, hcv.
const POINTS = {
  A_M1: { male: 2, age4059: 2, age60: 6, smoke1to9: 1, smoke10: 1, drink: 1, pa375: -1, pa75: -1, dm: 2 },
  A_M2: { male: 2, age4059: 2, age60: 6, ast25: 5, ast40: 9, ast60: 13, alt25: 2 },
  B_M5: { male: 1, age4059: 2, age60: 6, smoke1to9: 0, smoke10: 1, drink: 1, pa375: 0, pa75: 0, dm: 1,
    ast25: 4, ast40: 6, ast60: 7, alt25: 2, afp25: 2, afp5: 5, afp10: 9, hbv: 6, hcv: 5 }
};

// Supp Figure 2 chart data (percent), by score. A_M1 starts at -1, the others at 0.
const RISK = {
  A_M1: {
    first: -1,
    y5: [0.0455, 0.0635, 0.0886, 0.1237, 0.1726, 0.2409, 0.3362, 0.4690, 0.6542, 0.9121, 1.2711, 1.7700, 2.4623, 3.4207],
    y10: [0.0977, 0.1364, 0.1903, 0.2656, 0.3706, 0.5170, 0.7210, 1.0052, 1.4005, 1.9497, 2.7113, 3.7647, 5.2163, 7.2062]
  },
  A_M2: {
    first: 0,
    y5: [0.0099, 0.0132, 0.0176, 0.0235, 0.0314, 0.0419, 0.0559, 0.0746, 0.0997, 0.1331, 0.1777, 0.2372, 0.3166, 0.4225, 0.5638, 0.7522, 1.0031, 1.3373, 1.7817, 2.3721, 3.1550, 4.1906, 5.5562, 7.3496],
    y10: [0.0217, 0.0290, 0.0387, 0.0517, 0.0690, 0.0921, 0.1230, 0.1642, 0.2192, 0.2926, 0.3905, 0.5211, 0.6952, 0.9273, 1.2363, 1.6475, 2.1939, 2.9189, 3.8785, 5.1453, 6.8108, 8.9894, 11.8194, 15.4617]
  },
  B_M5: {
    first: 0,
    y5: [0.0011, 0.0015, 0.0020, 0.0027, 0.0036, 0.0049, 0.0066, 0.0090, 0.0122, 0.0165, 0.0223, 0.0302, 0.0409, 0.0553, 0.0749, 0.1015, 0.1374, 0.1860, 0.2518, 0.3408, 0.4613, 0.6242, 0.8443, 1.1416, 1.5428, 2.0835, 2.8110, 3.7876, 5.0944, 6.8359, 9.1433, 12.1771, 16.1246, 21.1889, 27.5631, 35.3811, 44.6405, 55.1013, 66.1888, 76.9717],
    y10: [0.0026, 0.0035, 0.0047, 0.0064, 0.0087, 0.0117, 0.0159, 0.0215, 0.0292, 0.0395, 0.0535, 0.0724, 0.0981, 0.1328, 0.1798, 0.2434, 0.3294, 0.4459, 0.6033, 0.8161, 1.1036, 1.4915, 2.0144, 2.7181, 3.6630, 4.9279, 6.6145, 8.8507, 11.7940, 15.6287, 20.5574, 26.7759, 34.4283, 43.5323, 53.8797, 64.9371, 75.8098, 85.3670, 92.5919, 97.0531]
  }
};

const ageTier = (age) => (age >= 60 ? 'age60' : age >= 40 ? 'age4059' : null);
const smokeTier = (py) => (py >= 10 ? 'smoke10' : py >= 1 ? 'smoke1to9' : null);
const paTier = (met) => (met >= 7.5 ? 'pa75' : met >= 3.75 ? 'pa375' : null);
const astTier = (ast) => (ast >= 60 ? 'ast60' : ast >= 40 ? 'ast40' : ast >= 25 ? 'ast25' : null);
const afpTier = (afp) => (afp >= 10 ? 'afp10' : afp >= 5 ? 'afp5' : afp >= 2.5 ? 'afp25' : null);

// Exposed for checks. x: { male, age, packYears, drink, met, dm, ast, alt, afp, hbv, hcv } (booleans for male, drink, dm, hbv, hcv).
export function wenScore(model, x) {
  const t = POINTS[model];
  const keys = [x.male && 'male', ageTier(x.age), smokeTier(x.packYears), x.drink && 'drink', paTier(x.met), x.dm && 'dm',
    astTier(x.ast), x.alt >= 25 && 'alt25', afpTier(x.afp), x.hbv && 'hbv', x.hcv && 'hcv'];
  return keys.filter((k) => k && t[k] !== undefined).reduce((s, k) => s + t[k], 0);
}

// Percent at a score, or null if outside the chart's score range.
export function wenRisk(model, score, years) {
  const r = RISK[model];
  const v = (years === 5 ? r.y5 : r.y10)[score - r.first];
  return v === undefined ? null : v;
}

export const wen2012 = {
  id: 'wen-2012',
  name: 'Wen 2012 liver cancer score',
  disease: 'liver',
  outcome: 'Liver cancer (HCC) within 10 years',
  horizonYears: 10,
  kind: 'risk',
  derivedIn: 'TW',
  ageRange: [20, null],
  population: 'Taiwan MJ health-check cohort, 428,584 adults aged 20 and over (group without an HCV test: 298,051 people).',
  source: {
    citation: 'Wen CP, et al. Hepatocellular carcinoma risk prediction model for the general population: the predictive power of transaminases. J Natl Cancer Inst 2012;104:1599–1611.',
    doi: '10.1093/jnci/djs372'
  },
  equation: 'Model 1 score = male 2 + age points (40–59: 2, 60+: 6) + smoking 1 + regular drinking 1 + activity −1 + diabetes 2; 10-year risk read from the paper\'s score-to-risk chart',
  inputs: ['age', 'sex', 'packYears', 'regularDrinking', 'exerciseMetHoursWeek', 'diabetes'],

  compute(person) {
    const early = gate(this, person);
    if (early) return early;
    const p = person.profile;
    const l = person.labs || {};
    const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
    const x = {
      male: p.sex === 'male', age: Number(p.age), packYears: Number(p.packYears), drink: p.regularDrinking === true,
      met: Number(p.exerciseMetHoursWeek), dm: p.diabetes === true,
      ast: num(l.astUL), alt: num(l.altUL), afp: num(l.afpNgMl),
      hbv: p.hbvCarrier === true, hcv: p.hcv === true
    };
    const s1 = wenScore('A_M1', x);
    const r10 = wenRisk('A_M1', s1, 10) / 100;
    const r5 = wenRisk('A_M1', s1, 5) / 100;
    const notes = [
      `Model 1 (health history), group without an HCV test: score ${s1}; 5-year ${formatPercent(r5)}, 10-year ${formatPercent(r10)}, read from the paper's chart (Supplementary Figure 2).`,
      'Built on a Taiwanese health-check population; applying it to the general population needs care.'
    ];
    if (x.ast !== undefined && x.alt !== undefined) {
      const s2 = wenScore('A_M2', x);
      const a5 = wenRisk('A_M2', s2, 5), a10 = wenRisk('A_M2', s2, 10);
      if (a5 !== null) notes.push(`Model 2 (AST and ALT only, no history): score ${s2}; 5-year ${formatPercent(a5 / 100)}, 10-year ${formatPercent(a10 / 100)}.`);
      if (x.afp !== undefined && p.hbvCarrier !== undefined && p.hcv !== undefined) {
        const s5 = wenScore('B_M5', x);
        const b5 = wenRisk('B_M5', s5, 5), b10 = wenRisk('B_M5', s5, 10);
        if (b5 !== null) notes.push(`Model 5 of the group with an HCV test (history + AST + ALT + AFP + hepatitis B + hepatitis C): score ${s5}; 5-year ${formatPercent(b5 / 100)}, 10-year ${formatPercent(b10 / 100)}.`);
      }
    } else {
      notes.push('Add AST and ALT (and AFP, hepatitis B and C status) to see the laboratory models.');
    }
    const parts = [
      ['Male', p.sex, 'male'], ['Age', `${x.age} years`, ageTier(x.age)], ['Smoking', `${x.packYears} pack-years`, smokeTier(x.packYears)],
      ['Regular drinking', x.drink ? 'yes' : 'no', x.drink ? 'drink' : null], ['Physical activity', `${x.met} MET-h`, paTier(x.met)],
      ['Diabetes', x.dm ? 'yes' : 'no', x.dm ? 'dm' : null]
    ];
    const terms = parts.map(([label, input, key]) => ({
      label, input, points: key && (key !== 'male' || x.male) ? POINTS.A_M1[key] || 0 : 0
    }));
    return computed(this, {
      value: r10,
      display: formatPercent(r10),
      score: { points: s1, max: 12 },
      terms,
      notes
    });
  }
};
