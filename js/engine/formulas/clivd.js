// CLivD score: 15-year risk of a severe liver event (liver disease or liver death) in the general population.
// Åberg F, et al. Development and validation of a model to predict incident chronic liver disease in
// the general population: the CLivD score. J Hepatol 2022;77:302-311. Equations: supplement 1 p.19-20.
//
// Two linear predictors (LP): a non-lab version, and a lab version that adds GGT (used when GGT is
// given). ALC = alcohol in drinks of 10 g a week, capped at 50; GGT capped at 200 U/L; WHR x 10.
// Coding in the equations: SEX==2 female, SMOK==1 current smoker, DIAB==1 diabetes.
// Risk groups by LP (supplement p.20): lab: minimal < -0.258, low to 2.066, intermediate to 2.784, high above;
// non-lab: minimal < -0.412, low to 1.912, intermediate to 2.632, high above. 15-year risk of the groups:
// minimal < 0.5%, low 0.5-4.9%, intermediate 5-9.9%, high 10% or more.
// DERIVED, NOT AUTHOR-PUBLISHED: the authors give no baseline survival or intercept for a continuous
// risk. The research team fitted risk15 = 1 - exp(-exp(LP - c)) to the three group cut-offs
// (c = 5.036 lab, 4.883 non-lab). It fits to 0.003 on the cut-offs and is rougher elsewhere: for the
// supplement's worked example (Fig. S16) it gives 7.5% where the paper's nomogram gives about 6%.
// The risk groups are the published result; the percentage is only an approximation.
// Built on Finnish adults 40-70; not calibrated for Taiwan.

import { computed, gate, formatPercent, round } from '../util.js';

const LAB = {
  c0: -6.7922721, age: 0.044744302, whr10: 0.32961593, alc: 0.19860813,
  alcCubic: [[0.1, -0.0082096868], [1, 0.010575035], [3, -0.002004756], [9, -0.00033998925], [33, -2.0602882e-05]],
  ggt: 0.011813962, female: 0.18721469, diabetes: 0.55249734, smoker: 0.74679941,
  ggtFemale: 0.0054325769, femaleSmoker: -0.64903176,
  cuts: [-0.258, 2.066, 2.784], offset: 5.036
};
const NONLAB = {
  c0: -8.0940103, age: 0.044177151, whr10: 0.48927753, alc: 0.19222894,
  alcCubic: [[0.1, -0.00015029544], [1, -0.0021265611], [3, 0.0029832769], [9, -0.00068765143], [33, -1.8769011e-05]],
  diabetes: 0.69669285, smoker: 0.75968055, female: 0.63248362, femaleSmoker: -0.59146649,
  cuts: [-0.412, 1.912, 2.632], offset: 4.883
};
const ALC_CAP = 50;
const GGT_CAP = 200;
const GROUPS = ['minimal', 'low', 'intermediate', 'high'];

// Exposed for checks. x: { age, female (bool), whr, drinks, diabetes (bool), smoker (bool), ggt? }
export function clivdLp(x) {
  const lab = x.ggt !== undefined && x.ggt !== null;
  const c = lab ? LAB : NONLAB;
  const alc = Math.min(x.drinks, ALC_CAP);
  const f = x.female ? 1 : 0;
  const s = x.smoker ? 1 : 0;
  let lp = c.c0 + c.age * x.age + c.whr10 * (x.whr * 10) + c.alc * alc
    + c.alcCubic.reduce((sum, [k, b]) => sum + b * Math.pow(Math.max(alc - k, 0), 3), 0)
    + c.diabetes * (x.diabetes ? 1 : 0) + c.smoker * s + c.female * f + c.femaleSmoker * f * s;
  if (lab) {
    const ggt = Math.min(x.ggt, GGT_CAP);
    lp += c.ggt * ggt + c.ggtFemale * ggt * f;
  }
  const group = GROUPS[c.cuts.filter((t) => lp >= t).length];
  return { lp, lab, group, risk15: 1 - Math.exp(-Math.exp(lp - c.offset)) };
}

export const clivd = {
  id: 'clivd',
  name: 'CLivD',
  disease: 'liver',
  outcome: 'Severe liver event (liver disease or liver death) within 15 years',
  horizonYears: 15,
  kind: 'risk',
  derivedIn: 'EU',
  ageRange: [40, 70],
  population: 'Finnish general-population adults aged 40–70 (several cohorts; checked in 369,832 UK Biobank people). Not calibrated for Taiwan.',
  source: {
    citation: 'Åberg F, et al. Development and validation of a model to predict incident chronic liver disease in the general population: the CLivD score. J Hepatol 2022;77:302–311.',
    doi: '10.1016/j.jhep.2022.02.021'
  },
  equation: 'LP = published linear equation of age, waist-hip ratio, alcohol, diabetes, smoking, sex (and GGT in the lab version); 15-year risk ≈ 1 − exp(−exp(LP − c)) is a derived approximation',
  inputs: ['age', 'sex', 'waistCm', 'hipCm', 'drinksPerWeek', 'diabetes', 'smoking'],

  compute(person) {
    const early = gate(this, person);
    if (early) return early;
    const p = person.profile;
    const ggtRaw = person.labs && person.labs.ggtUL;
    const ggt = ggtRaw !== undefined && ggtRaw !== null && ggtRaw !== '' && Number.isFinite(Number(ggtRaw)) ? Number(ggtRaw) : undefined;
    const whr = Number(p.waistCm) / Number(p.hipCm);
    const x = {
      age: Number(p.age), female: p.sex === 'female', whr, drinks: Number(p.drinksPerWeek),
      diabetes: p.diabetes === true, smoker: p.smoking === 'current', ggt
    };
    const r = clivdLp(x);
    return computed(this, {
      value: r.risk15,
      display: `${formatPercent(r.risk15)} (derived), ${r.group} group`,
      band: { label: `${r.group} group (15-year risk ${{ minimal: 'under 0.5%', low: '0.5–4.9%', intermediate: '5–9.9%', high: '10% or more' }[r.group]}, published)`, aboveCutoff: r.group === 'high' },
      terms: [
        { label: 'Linear predictor (LP)', input: `${r.lab ? 'lab' : 'non-lab'} version`, beta: null, x: round(r.lp, 4), contribution: round(r.lp, 4) },
        { label: 'Waist-hip ratio', input: `${p.waistCm} / ${p.hipCm} cm`, beta: null, x: round(whr, 3), contribution: null },
        { label: 'Alcohol (10 g drinks a week, capped at 50)', input: `${x.drinks}`, beta: null, x: Math.min(x.drinks, ALC_CAP), contribution: null }
      ],
      notes: [
        `Version used: ${r.lab ? 'lab (GGT given)' : 'non-lab (no GGT)'}. LP = ${round(r.lp, 3)}. The risk group is the published result.`,
        'DERIVED, not published by the authors: the percentage comes from a curve the research team fitted to the three published group cut-offs; the authors give no baseline risk. In the paper\'s worked example it gives 7.5% where the paper\'s nomogram gives about 6%. Prefer the group.',
        'Waist-hip ratio is waist divided by hip circumference. Alcohol is in drinks of 10 g of alcohol a week. Smoking counts only for current smokers.'
      ]
    });
  }
};
