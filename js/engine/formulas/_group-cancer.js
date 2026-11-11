// Group D (cancer) formulas and their checks (issue #69).
//   formulas    the formula objects, in display order
//   checks()    [{ formulaId, example, expected, actual, pass, source }]
//   fieldLabels labels for the new person fields (merge into util.js FIELD_LABELS)
// Only the AABCS and BCRAT-race-6 branch examples come from a published paper; the other examples were
// computed by the team from the same coefficients and are labelled "self-computed".

import { plcom2012, plcoProbability } from './plcom2012.js';
import { apcs } from './apcs.js';
import { endPac } from './end-pac.js';
import { pcptRc20 } from './pcpt-rc-2-0.js';
import { nciBcrat, bcratCodes, bcratRisk, bcratRelativeRisk } from './nci-bcrat-cran-bcra.js';
import { aabcs, aabcsRisk, aabcsRelativeRisk } from './aabcs.js';
import { fieldLabels } from './_cancer-util.js';

export { fieldLabels };
export const formulas = [plcom2012, apcs, endPac, pcptRc20, nciBcrat, aabcs];

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const pct = (p) => p * 100;

export function checks() {
  const out = [];
  const add = (formulaId, example, expected, actual, tol, source) =>
    out.push({ formulaId, example: `${example} (tolerance ${tol})`, expected, actual, pass: near(expected, actual, tol), source });

  // PLCOm2012: self-computed in our literature notes (the paper prints no numeric example).
  const plcoSrc = 'Literature notes plcom2012.json examples (self-computed from Table 2, not printed in the paper)';
  const ref = { age: 62, race: 'white', education: 4, bmi: 27, copd: 0, cancerHistory: 0, familyLung: 0, current: 0, cpd: 20, duration: 27, quit: 10 };
  add('plcom2012', 'Figure 1 reference person (62, White, BMI 27, former smoker 20/day, 27 years, quit 10) → 6-year risk', 0.008917, plcoProbability(ref), 1e-6, plcoSrc);
  const r2 = plcom2012.compute({
    profile: {
      age: 65, sex: 'male', ethnicity: 'asian', educationLevel: 2, heightCm: 200, weightKg: 88, copd: true,
      cancerHistory: false, familyLungCancer: true, smoking: 'current', cigsPerDay: 30, yearsSmoked: 40
    },
    labs: {}
  });
  add('plcom2012', '65, Asian, education 2, BMI 22, COPD, family history, current smoker 30/day, 40 years → 6-year risk', 0.081883, r2.value, 1e-6, plcoSrc);

  // APCS: the paper has no example person; tier shares recomputed from Table 7 counts, boundaries from our literature notes.
  const apcsSrc = 'Yeoh 2011 Table 7 counts (validation group)';
  [['AR', 7, 559, 1.3], ['MR', 31, 966, 3.2], ['HR', 19, 367, 5.2]].forEach(([tier, k, n, printed]) =>
    add('apcs', `${tier}: ${k} of ${n} with advanced neoplasia → printed ${printed}%`, printed, Math.round((k / n) * 1000) / 10, 0.05, apcsSrc));
  const a = (p) => apcs.compute({ profile: p, labs: {} });
  const man49 = a({ age: 49, sex: 'male', familyColorectalCancer: true, smoking: 'current' });
  add('apcs', 'Man 49 + parent with colorectal cancer + smoker = 1+2+1 = 4 points (high-risk tier, 5.2%)', 4, man49.score.points, 0, 'Literature notes apcs.json boundary examples (self-computed from Table 5)');
  const topScore = a({ age: 70, sex: 'male', familyColorectalCancer: true, smoking: 'former' });
  add('apcs', 'Man 70 + family history + ever smoked = 3+1+2+1 = 7 points, the top of the range', 7, topScore.score.points, 0, 'Yeoh 2011 Table 5 (range 0-7)');

  // END-PAC: self-computed in our literature notes.
  const epSrc = 'Literature notes end-pac.json examples (self-computed from Table 1; the paper has no example person)';
  [
    ['Age 72, weight −5 kg, glucose 105 → 170', { age: 72, d: 72, w: -5, now: 170, before: 105 }, 8],
    ['Age 55, weight +3 kg, glucose 95 → 130', { age: 55, d: 55, w: 3, now: 130, before: 95 }, 0],
    ['Age 64, weight −2.5 kg, glucose 118 → 140', { age: 64, d: 64, w: -2.5, now: 140, before: 118 }, 3]
  ].forEach(([text, c, total]) => {
    const r = endPac.compute({
      profile: { age: c.age, diabetes: true, diabetesOnsetAge: c.d, weightChangeKg12m: c.w },
      labs: { fastingGlucoseMgDl: c.now, glucoseChangeMgDl12m: c.now - c.before }
    });
    add('end-pac', `${text} → total points`, total, r.score ? r.score.points : null, 0, epSrc);
  });

  // PCPT RC 2.0: self-computed from the R-file coefficients.
  const pcptSrc = 'Literature notes pcpt-rc-2-0.json examples (self-computed from the R file; not an official calculator output)';
  const p1 = pcptRc20.compute({
    profile: { age: 65, sex: 'male', ethnicity: 'white', priorNegativeBiopsy: false, dreAbnormal: false, familyProstateCancer: false },
    labs: { psaNgMl: 4 }
  });
  const p2 = pcptRc20.compute({
    profile: { age: 70, sex: 'male', ethnicity: 'black', priorNegativeBiopsy: false, dreAbnormal: true, familyProstateCancer: true },
    labs: { psaNgMl: 6.5 }
  });
  add('pcpt-rc-2-0', 'PSA 4.0, 65, not Black, no biopsy, normal exam, no family history → high-grade probability', 0.058996, p1.value, 1e-6, pcptSrc);
  add('pcpt-rc-2-0', 'PSA 6.5, 70, Black, no biopsy, suspicious exam, family history → high-grade probability', 0.371837, p2.value, 1e-6, pcptSrc);

  // BCRAT, White: self-computed in our literature notes (no official White output found).
  const bcSrc = 'Literature notes nci-bcrat-cran-bcra.md W-1 to W-3 (self-computed; no official NCI output found for White women)';
  const w1 = bcratCodes('white', { menarche: 12, afl: 'none', relatives: 0, biopsies: 1, atypical: undefined });
  const rr1 = bcratRelativeRisk('white', w1);
  add('nci-bcrat-cran-bcra', 'W-1 relative risk below 50 (menarche 12, 1 biopsy, no births)', 2.888, rr1.lt50, 0.0005, bcSrc);
  add('nci-bcrat-cran-bcra', 'W-1 relative risk from 50', 2.165, rr1.ge50, 0.0005, bcSrc);
  [[5, 1.048], [10, 2.561], [20, 5.411], [30, 9.141]].forEach(([y, v]) =>
    add('nci-bcrat-cran-bcra', `W-1 age 40, ${y}-year risk (%)`, v, pct(bcratRisk('white', w1, 40, 40 + y)), 0.0006, bcSrc));
  const w2 = bcratCodes('white', { menarche: 14, afl: 18, relatives: 0, biopsies: 0, atypical: undefined });
  [[35, 0.191], [50, 0.632], [60, 0.942]].forEach(([t1, v]) =>
    add('nci-bcrat-cran-bcra', `W-2 reference woman, 5-year risk from age ${t1} (%)`, v, pct(bcratRisk('white', w2, t1, t1 + 5)), 0.0006, bcSrc));
  const w3 = bcratCodes('white', { menarche: 15, afl: 'none', relatives: 1, biopsies: 1, atypical: true });
  const rr3 = bcratRelativeRisk('white', w3);
  add('nci-bcrat-cran-bcra', 'W-3 relative risk below 50', 8.517, rr3.lt50, 0.0005, bcSrc);
  add('nci-bcrat-cran-bcra', 'W-3 relative risk from 50', 6.385, rr3.ge50, 0.0005, bcSrc);
  add('nci-bcrat-cran-bcra', 'W-3 age 54, 5-year risk (%)', 4.664, pct(bcratRisk('white', w3, 54, 59)), 0.0006, bcSrc);

  // AABCS: published examples (Matsuno 2011).
  const abSrc = 'Matsuno 2011 p.955 worked example and Table 2 (Chinese women)';
  const ex = aabcsRelativeRisk({ menarche: 14, afl: 'none', relatives: 1, biopsies: 1, atypical: undefined });
  add('aabcs', 'Age 30, no births, menarche 14, mother with breast cancer, 1 biopsy: relative risk (paper 6.67)', 6.67, ex.rr, 0.005, abSrc);
  add('aabcs', 'Same woman, 30-year risk (%) (paper 9.90)', 9.9, pct(aabcsRisk(ex.rr, 30, 60)), 0.02, abSrc);
  [[30, 30, 5, 7.52], [30, 30, 10, 14.47], [40, 20, 5, 6.79], [60, 10, 10, 8.25]].forEach(([t1, y, rr, v]) =>
    add('aabcs', `Table 2, Chinese, start age ${t1}, ${y} years, RR ${rr} (%)`, v, pct(aabcsRisk(rr, t1, t1 + y)), 0.02,
      'Matsuno 2011 Table 2, values as recorded in our literature notes aabcs.md'));
  return out;
}
