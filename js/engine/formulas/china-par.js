// China-PAR, 10-year risk of a first atherosclerotic cardiovascular disease (ASCVD) event.
// Yang X, et al. Predicting the 10-Year Risks of Atherosclerotic Cardiovascular Disease in
// Chinese Population: The China-PAR Project. Circulation 2016;134:1430-1440.
// Coefficients and mean sums: Online Supplement Tables 1-2 (two decimals only).
//
//   risk = 1 - S10 ^ exp(individual sum - mean sum)
//
// Age, SBP, total cholesterol, HDL (both in mg/dL, not converted) and waist are natural logs;
// "age x something" is ln(age) times that term's value. Treated and untreated SBP are separate.
//
// UNCONFIRMED BASELINES: the paper prints S10 as 0.99 for women (two decimals) and 0.9707 for
// men, which does not reproduce the paper's own Table 2. The values used here (men 0.9724,
// women 0.985) were back-calculated from the four ages in main-text Table 2 and are not
// published by the authors. With them the example risks match within 0.1 percentage points.
//
// New person fields: profile.region ('north' | 'south', region of China), profile.urban
// (bool, men only) and profile.familyAscvd (bool, parent or sibling with ASCVD, men only).

import { computed, gate, read, formatPercent, round, yesNo, missingResult } from '../util.js';

const COEF = {
  male: {
    lnAge: 31.97, treatedSbp: 27.39, untreatedSbp: 26.15, lnTc: 0.62, lnHdl: -0.69, lnWaist: -0.71,
    smoker: 3.96, diabetes: 0.36, north: 0.48, urban: -0.16, family: 6.22,
    ageTreatedSbp: -6.02, ageUntreatedSbp: -5.73, ageSmoker: -0.94, ageFamily: -1.53,
    mean: 140.68, s10: 0.9724
  },
  female: {
    lnAge: 24.87, treatedSbp: 20.71, untreatedSbp: 19.98, lnTc: 0.06, lnHdl: -0.22, lnWaist: 1.48,
    smoker: 0.49, diabetes: 0.57, north: 0.54, urban: 0, family: 0,
    ageTreatedSbp: -4.53, ageUntreatedSbp: -4.36, ageSmoker: 0, ageFamily: 0,
    mean: 117.26, s10: 0.985
  }
};

// Exposed for _group-cvd.js. x: { age, sbp, tc, hdl, waist, treated, smoker, diabetes, north, urban, family }.
export function chinaParRisk(sex, x) {
  const c = COEF[sex];
  const a = Math.log(x.age), s = Math.log(x.sbp);
  const sm = x.smoker ? 1 : 0, fh = x.family ? 1 : 0;
  const rows = [
    ['Ln age', `${x.age} years`, c.lnAge, a],
    ['Ln SBP, on medicine', `${x.sbp} mmHg`, c.treatedSbp, x.treated ? s : 0],
    ['Ln SBP, untreated', `${x.sbp} mmHg`, c.untreatedSbp, x.treated ? 0 : s],
    ['Ln total cholesterol', `${x.tc} mg/dL`, c.lnTc, Math.log(x.tc)],
    ['Ln HDL cholesterol', `${x.hdl} mg/dL`, c.lnHdl, Math.log(x.hdl)],
    ['Ln waist circumference', `${x.waist} cm`, c.lnWaist, Math.log(x.waist)],
    ['Current smoker', yesNo(sm), c.smoker, sm],
    ['Diabetes', yesNo(x.diabetes), c.diabetes, x.diabetes ? 1 : 0],
    ['Northern China', yesNo(x.north), c.north, x.north ? 1 : 0],
    ['Urban residence', yesNo(x.urban), c.urban, x.urban ? 1 : 0],
    ['Family history of ASCVD', yesNo(fh), c.family, fh],
    ['Ln age × ln SBP, on medicine', '', c.ageTreatedSbp, x.treated ? a * s : 0],
    ['Ln age × ln SBP, untreated', '', c.ageUntreatedSbp, x.treated ? 0 : a * s],
    ['Ln age × current smoker', '', c.ageSmoker, a * sm],
    ['Ln age × family history', '', c.ageFamily, a * fh]
  ];
  const sum = rows.reduce((t, r) => t + r[2] * r[3], 0);
  return { sum, risk: 1 - Math.pow(c.s10, Math.exp(sum - c.mean)), rows };
}

export const chinaPar = {
  id: 'china-par',
  name: 'China-PAR (ASCVD)',
  disease: 'cardiovascular',
  outcome: 'First heart attack or stroke within 10 years',
  horizonYears: 10,
  kind: 'risk',
  derivedIn: 'CN',
  ageRange: [35, 74],
  population: 'Four Chinese cohorts (north and south, urban and rural) of adults aged 35–74 without cardiovascular disease.',
  source: {
    citation: 'Yang X, et al. Predicting the 10-Year Risks of Atherosclerotic Cardiovascular Disease in Chinese Population: The China-PAR Project. Circulation 2016;134:1430–1440. Online Supplement Tables 1–2.',
    doi: '10.1161/CIRCULATIONAHA.116.022367'
  },
  equation: '10-year risk = 1 − S10^exp(individual sum − mean sum), individual sum = Σ coefficient × value (ln of age, SBP, cholesterol, HDL, waist; sex-specific)',
  inputs: ['age', 'sex', 'sbp', 'bpTreated', 'smoking', 'diabetes', 'waistCm', 'labs.totalCholMgDl', 'labs.hdlMgDl'],

  compute(person) {
    const early = gate(this, person, (p) =>
      p.profile && p.profile.cvdHistory === true ? 'Already has cardiovascular disease; China-PAR estimates a first event.' : '');
    if (early) return early;

    const p = person.profile;
    const male = p.sex === 'male';
    const extra = [];
    const region = read(person, 'region');
    if (region !== 'north' && region !== 'south') extra.push({ field: 'region', label: 'Region of China (north or south)' });
    if (male && typeof read(person, 'urban') !== 'boolean') extra.push({ field: 'urban', label: 'Lives in a city (not rural)' });
    if (male && typeof read(person, 'familyAscvd') !== 'boolean') extra.push({ field: 'familyAscvd', label: 'Parent or sibling had a heart attack or stroke' });
    if (extra.length) return missingResult(this, extra);

    const x = {
      age: Number(p.age), sbp: Number(p.sbp), tc: Number(person.labs.totalCholMgDl), hdl: Number(person.labs.hdlMgDl),
      waist: Number(p.waistCm), treated: p.bpTreated === true, smoker: p.smoking === 'current', diabetes: p.diabetes === true,
      north: region === 'north', urban: male && p.urban === true, family: male && p.familyAscvd === true
    };
    const r = chinaParRisk(p.sex, x);
    const c = COEF[p.sex];
    const terms = r.rows.map(([label, input, beta, v]) => ({
      label, input, beta, x: round(v, 4), contribution: round(beta * v, 6)
    })).filter((t) => t.beta !== 0);
    const notes = [
      `${male ? 'Men' : 'Women'}: mean sum = ${c.mean}, S10 = ${c.s10}. This person's sum = ${r.sum.toFixed(3)}.`,
      'S10 is back-calculated from the paper\'s Table 2 (the paper prints 0.99 for women and 0.9707 for men); the authors did not publish this value.',
      'Built on people in mainland China; it has not been validated in Taiwan.'
    ];
    return computed(this, { value: r.risk, display: formatPercent(r.risk), terms, notes });
  }
};
