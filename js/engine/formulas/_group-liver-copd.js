// Group E (issue #69): liver and COPD formulas, with their checks and the labels of new input fields.
//
//   import { formulas, checks, fieldLabels } from './_group-liver-copd.js';
//
// checks() returns [{ formulaId, example, expected, actual, pass, source }]. `source` says where the
// example comes from: "calculator output" (the authors' web calculator), "paper" (printed in the paper
// or supplement), or "self-computed" (worked by the research team from the published formula, not
// printed in the paper, so it checks the code against the formula but not the formula against the paper).

import { fib4 } from './fib-4.js';
import { nafldFibrosisScore } from './nafld-fibrosis-score.js';
import { pageB } from './page-b.js';
import { mpageB } from './mpage-b.js';
import { reachB } from './reach-b.js';
import { amap } from './amap.js';
import { wen2012 } from './wen-2012.js';
import { clivd } from './clivd.js';
import { copdPs } from './copd-ps.js';
import { fib4Value } from './fib-4.js';
import { nfsScore } from './nafld-fibrosis-score.js';
import { pageBPoints, pageBGroup } from './page-b.js';
import { mpageBPoints, mpageBGroup } from './mpage-b.js';
import { reachBRisk5 } from './reach-b.js';
import { amapScore } from './amap.js';
import { wenScore, wenRisk } from './wen-2012.js';
import { clivdLp } from './clivd.js';
import { copdPsScore } from './copd-ps.js';

export const formulas = [fib4, nafldFibrosisScore, pageB, mpageB, reachB, amap, wen2012, clivd, copdPs];

// Labels for fields that are not in util.js FIELD_LABELS (same key style: bare profile key, or 'labs.<key>').
export const fieldLabels = {
  hbvCarrier: 'Has chronic hepatitis B',
  hbvTreated: 'Takes hepatitis B medicine (entecavir or tenofovir)',
  hcv: 'Has hepatitis C',
  cirrhosis: 'Has cirrhosis',
  chronicLiverDisease: 'Has chronic liver disease (hepatitis B or C, cirrhosis)',
  drinksPerWeek: 'Alcohol drinks per week (10 g of alcohol each)',
  hipCm: 'Hip circumference',
  packYears: 'Smoking pack-years',
  regularDrinking: 'Drinks regularly (2 or more drinks a time, 3 or more days a week)',
  exerciseMetHoursWeek: 'Physical activity (MET-hours per week)',
  copdSymptomBreathless: 'Short of breath in the past 4 weeks (0 none, 1 a little, 2 some, 3 most, 4 all of the time)',
  copdSymptomPhlegm: 'Coughs up phlegm (0 never, 1 only with colds, 2 few days a month, 3 most days a week, 4 every day)',
  copdActivityLimited: 'Does less than before because of breathing (0 strongly disagree, 1 disagree, 2 unsure, 3 agree, 4 strongly agree)',
  smoked100Cigarettes: 'Has smoked at least 100 cigarettes in life',
  copdDiagnosed: 'Already told they have COPD',
  'labs.astUL': 'AST',
  'labs.altUL': 'ALT',
  'labs.plateletsK': 'Platelet count',
  'labs.albuminGdL': 'Albumin',
  'labs.bilirubinMgDl': 'Total bilirubin',
  'labs.ggtUL': 'GGT',
  'labs.hbvDnaIuMl': 'Hepatitis B virus DNA',
  'labs.hbeagPositive': 'HBeAg positive',
  'labs.afpNgMl': 'AFP (alpha-fetoprotein)',
  'labs.fastingGlucoseMgDl': 'Fasting glucose'
};

function chk(formulaId, example, expected, actual, tol, source) {
  const pass = typeof expected === 'number' ? Math.abs(expected - actual) <= tol : expected === actual;
  return { formulaId, example, expected, actual: typeof actual === 'number' ? Number(actual.toFixed(6)) : actual, pass, tolerance: tol, source };
}

export function checks() {
  const out = [];
  const SELF = 'self-computed (research file), not printed in the paper';

  // FIB-4: no worked example in the paper; hand calculation 50 x 40 / (200 x sqrt(25)) = 2.
  out.push(chk('fib-4', 'age 50, AST 40, ALT 25, platelets 200', 2.0, fib4Value(50, 40, 25, 200), 1e-9, 'hand calculation from the Sterling 2006 formula'));

  // NFS: three self-computed examples, tolerance 1e-6.
  const nfs = [
    ['age 50, BMI 30, IFG/DM, AST 40, ALT 50, platelets 200, albumin 4.3', { age: 50, bmi: 30, ifgDm: 1, ast: 40, alt: 50, plt: 200, albumin: 4.3 }, -0.521],
    ['Table 1 means: age 47.7, BMI 32.2, AST 60, ALT 87, platelets 235, albumin 4.3, IFG 0', { age: 47.7, bmi: 32.2, ifgDm: 0, ast: 60, alt: 87, plt: 235, albumin: 4.3 }, -2.093541],
    ['age 65, BMI 35, IFG/DM, AST 80, ALT 60, platelets 120, albumin 3.5', { age: 65, bmi: 35, ifgDm: 1, ast: 80, alt: 60, plt: 120, albumin: 3.5 }, 2.6]
  ];
  nfs.forEach(([name, x, exp]) => out.push(chk('nafld-fibrosis-score', name, exp, nfsScore(x), 1e-6, SELF)));

  // PAGE-B
  [['55 y male, platelets 150', 55, true, 150, 18, 'high'], ['35 y female, platelets 220', 35, false, 220, 2, 'low']].forEach(([n, a, m, p, tot, g]) => {
    const r = pageBPoints(a, m, p);
    out.push(chk('page-b', `${n}: score`, tot, r.total, 0, SELF));
    out.push(chk('page-b', `${n}: group`, g, pageBGroup(r.total), 0, SELF));
  });

  // mPAGE-B
  [[45, true, 180, 3.8, 11, 'intermediate'], [65, true, 90, 2.8, 19, 'high'], [35, false, 300, 4.5, 3, 'low'],
    [72, true, 95, 2.5, 21, 'high'], [55, false, 210, 3.6, 10, 'intermediate']].forEach(([a, m, p, alb, tot, g]) => {
    const r = mpageBPoints(a, m, p, alb);
    const n = `age ${a} ${m ? 'male' : 'female'}, platelets ${p}, albumin ${alb}`;
    out.push(chk('mpage-b', `${n}: score`, tot, r.total, 0, SELF));
    out.push(chk('mpage-b', `${n}: group`, g, mpageBGroup(r.total), 0, SELF));
  });

  // Revised REACH-B: the authors' calculator outputs (rounded to 0.01 percentage points, so tolerance 0.01).
  [[40, 1, 0, 1e4, 30, 200, 1.02], [30, 1, 0, 1e4, 30, 200, 0.46], [60, 1, 0, 1e4, 30, 200, 4.32], [40, 1, 0, 1e3, 30, 200, 0.56],
    [40, 1, 0, 1e6, 30, 200, 4.04], [40, 1, 0, 1e4, 15, 200, 0.89], [40, 1, 0, 1e4, 60, 200, 1.31], [40, 1, 0, 1e4, 30, 150, 2.43],
    [40, 1, 0, 1e4, 30, 250, 0.40], [40, 0, 0, 1e4, 30, 200, 0.31], [40, 1, 1, 1e4, 30, 200, 1.56]].forEach(([a, m, h, d, al, p, exp]) => {
    const n = `age ${a}, ${m ? 'male' : 'female'}, HBeAg ${h ? '+' : '-'}, DNA ${d}, ALT ${al}, platelets ${p}`;
    out.push(chk('reach-b', `${n} (% in 5 years)`, exp, 100 * reachBRisk5(a, !!m, !!h, d, al, p), 0.01,
      'calculator output (mreach-b.shinyapps.io/rereachb); the standardisation constants were fitted to these same outputs, so this is a fit check, not an independent test (only the female and HBeAg-positive rows are independent)'));
  });

  // aMAP: self-computed scores and the derived 5-year risk (tolerance 1e-4 on score, 0.01 point on %).
  [[55, true, 15, 40, 150, 59.7873, 6.52], [45, false, 10, 45, 250, 41.1699, 0.43], [68, true, 30, 32, 90, 71.9861, 33.55]].forEach(([a, m, b, al, p, sc, rk]) => {
    const r = amapScore(a, m, b, al, p);
    const n = `age ${a}, ${m ? 'male' : 'female'}, bilirubin ${b} µmol/L, albumin ${al} g/L, platelets ${p}`;
    out.push(chk('amap', `${n}: score`, sc, r.score, 1e-4, SELF));
    out.push(chk('amap', `${n}: derived 5-year % (candidate)`, rk, 100 * (1 - Math.pow(0.984, Math.exp(r.lp))), 0.01, SELF + '; derived, not author-published'));
  });

  // Wen 2012: scores and chart values (self-computed scores; chart values are the supplement's).
  const exB = { male: true, age: 55, packYears: 12, drink: true, met: 2, dm: true, ast: 45, alt: 40, afp: 6, hbv: true, hcv: false };
  const exB2 = { male: false, age: 35, packYears: 0, drink: false, met: 8, dm: false, ast: 20, alt: 15, afp: 1.5, hbv: false, hcv: false };
  const wsrc = 'research file expected value (score self-computed from Supp Table 1; percentages from Supp Figure 2 chart data)';
  const s1 = wenScore('B_M5', exB);
  out.push(chk('wen-2012', 'B model 5, 55 y male, 12 pack-years, drinks, HBV+: score', 25, s1, 0, wsrc));
  out.push(chk('wen-2012', 'B model 5, same: 5-year %', 2.0835, wenRisk('B_M5', s1, 5), 1e-4, wsrc));
  out.push(chk('wen-2012', 'B model 5, same: 10-year %', 4.9279, wenRisk('B_M5', s1, 10), 1e-4, wsrc));
  const s2 = wenScore('B_M5', exB2);
  out.push(chk('wen-2012', 'B model 5, 35 y female, low everything: score', 0, s2, 0, wsrc));
  out.push(chk('wen-2012', 'B model 5, same: 10-year %', 0.0026, wenRisk('B_M5', s2, 10), 1e-4, wsrc));
  const sA = wenScore('A_M1', exB);
  out.push(chk('wen-2012', 'A model 1, 55 y male, 12 pack-years, drinks, 2 MET-h, diabetes: score (2+2+1+1+0+2)', 8, sA, 0, 'hand calculation from Supp Table 1'));
  out.push(chk('wen-2012', 'A model 1, same: 10-year %', 1.9497, wenRisk('A_M1', sA, 10), 1e-4, 'Supp Figure 2 chart data'));

  // CLivD: the supplement's Fig. S16 example.
  const fig = { age: 52, female: false, whr: 1.1, drinks: 14, diabetes: true, smoker: true };
  const lab = clivdLp({ ...fig, ggt: 65 });
  out.push(chk('clivd', 'Fig. S16 (52 y male, diabetes, smoker, 14 drinks/week, WHR 1.1, GGT 65): lab LP', 2.48236, lab.lp, 1e-4, 'research file (LP self-computed from the supplement equation; the paper gives nomogram points 144, about 6%)'));
  out.push(chk('clivd', 'Fig. S16: lab risk group', 'intermediate', lab.group, 0, 'paper (5-9.9% group)'));
  out.push(chk('clivd', 'Fig. S16: derived 15-year % (paper nomogram says about 6)', 7.47, 100 * lab.risk15, 0.02, 'derived approximation, not author-published (research file 7.47%, code gives 7.485%: the research value was rounded); differs from the paper\'s about 6% by about 1.5 points'));
  const non = clivdLp(fig);
  out.push(chk('clivd', 'Fig. S16 inputs without GGT: non-lab LP', 2.5419, non.lp, 1e-3, SELF));
  out.push(chk('clivd', 'Fig. S16 inputs without GGT: risk group', 'intermediate', non.group, 0, SELF));

  // COPD-PS
  out.push(chk('copd-ps', 'breathless most of the time, phlegm few days a month, agrees less active, smoked 100, age 60-69', 8, copdPsScore(3, 2, 3, true, 65), 0, SELF));
  out.push(chk('copd-ps', 'breathless a little, phlegm only with colds, disagrees, not smoked, age 50-59', 1, copdPsScore(1, 1, 1, false, 55), 0, SELF));

  return out;
}
