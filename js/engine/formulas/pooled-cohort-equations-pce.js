// Pooled Cohort Equations (PCE), 10-year risk of a first hard ASCVD event.
// Goff DC Jr, et al. 2013 ACC/AHA Guideline on the Assessment of Cardiovascular Risk.
// Circulation 2014;129(25 Suppl 2):S49-S73. Coefficients: Table A (four equations),
// read from the JACC 2014;63:2935 author manuscript (PMC4700825) copy of the same table.
//
//   risk = 1 - S10 ^ exp(IndividualSum - MeanSum),  IndividualSum = sum of coefficient x value
//
// Cholesterol in mg/dL; continuous variables are natural logs. Treated and untreated SBP
// are separate terms (only one is used). A missing term in Table A (N/A) is left out.
// Only white and African American equations exist. profile.ethnicity 'black' uses the
// African American equation; 'white' uses the white equation. For any other or missing
// ethnicity the white equation is used (the guideline allows this for other groups, with a
// weak recommendation) and the notes say so. It was not built or tested for Taiwanese adults.
// MeanSum is printed to two decimals only in Table A (an unconfirmed 4-decimal version
// changes the example risks by 0.015 percentage points or less).

import { computed, gate, formatPercent, round, yesNo } from '../util.js';

// Table A, columns White women, African American women, White men, African American men.
const COEF = {
  white_female: {
    lnAge: -29.799, lnAge2: 4.884, lnTc: 13.54, lnAgeTc: -3.114, lnHdl: -13.578, lnAgeHdl: 3.149,
    lnTreatedSbp: 2.019, lnAgeTreatedSbp: 0, lnUntreatedSbp: 1.957, lnAgeUntreatedSbp: 0,
    smoker: 7.574, lnAgeSmoker: -1.665, diabetes: 0.661, mean: -29.18, s10: 0.9665
  },
  aa_female: {
    lnAge: 17.114, lnAge2: 0, lnTc: 0.94, lnAgeTc: 0, lnHdl: -18.92, lnAgeHdl: 4.475,
    lnTreatedSbp: 29.291, lnAgeTreatedSbp: -6.432, lnUntreatedSbp: 27.82, lnAgeUntreatedSbp: -6.087,
    smoker: 0.691, lnAgeSmoker: 0, diabetes: 0.874, mean: 86.61, s10: 0.9533
  },
  white_male: {
    lnAge: 12.344, lnAge2: 0, lnTc: 11.853, lnAgeTc: -2.664, lnHdl: -7.99, lnAgeHdl: 1.769,
    lnTreatedSbp: 1.797, lnAgeTreatedSbp: 0, lnUntreatedSbp: 1.764, lnAgeUntreatedSbp: 0,
    smoker: 7.837, lnAgeSmoker: -1.795, diabetes: 0.658, mean: 61.18, s10: 0.9144
  },
  aa_male: {
    lnAge: 2.469, lnAge2: 0, lnTc: 0.302, lnAgeTc: 0, lnHdl: -0.307, lnAgeHdl: 0,
    lnTreatedSbp: 1.916, lnAgeTreatedSbp: 0, lnUntreatedSbp: 1.809, lnAgeUntreatedSbp: 0,
    smoker: 0.549, lnAgeSmoker: 0, diabetes: 0.645, mean: 19.54, s10: 0.8954
  }
};

const SET_NAMES = {
  white_female: 'white women', aa_female: 'African American women',
  white_male: 'white men', aa_male: 'African American men'
};

// Exposed for _group-cvd.js. x: { age, tc, hdl, sbp (mg/dL, mmHg), treated, smoker, diabetes }.
export function pceRisk(set, x) {
  const c = COEF[set];
  const a = Math.log(x.age), tc = Math.log(x.tc), hdl = Math.log(x.hdl), s = Math.log(x.sbp);
  const sm = x.smoker ? 1 : 0, dm = x.diabetes ? 1 : 0;
  const rows = [
    ['Ln age', `${x.age} years`, c.lnAge, a],
    ['Ln age squared', `${x.age} years`, c.lnAge2, a * a],
    ['Ln total cholesterol', `${x.tc} mg/dL`, c.lnTc, tc],
    ['Ln age × ln total cholesterol', '', c.lnAgeTc, a * tc],
    ['Ln HDL cholesterol', `${x.hdl} mg/dL`, c.lnHdl, hdl],
    ['Ln age × ln HDL cholesterol', '', c.lnAgeHdl, a * hdl],
    ['Ln treated SBP', `${x.sbp} mmHg`, c.lnTreatedSbp, x.treated ? s : 0],
    ['Ln age × ln treated SBP', '', c.lnAgeTreatedSbp, x.treated ? a * s : 0],
    ['Ln untreated SBP', `${x.sbp} mmHg`, c.lnUntreatedSbp, x.treated ? 0 : s],
    ['Ln age × ln untreated SBP', '', c.lnAgeUntreatedSbp, x.treated ? 0 : a * s],
    ['Current smoker', yesNo(sm), c.smoker, sm],
    ['Ln age × current smoker', '', c.lnAgeSmoker, a * sm],
    ['Diabetes', yesNo(dm), c.diabetes, dm]
  ];
  const sum = rows.reduce((t, r) => t + r[2] * r[3], 0);
  return { sum, risk: 1 - Math.pow(c.s10, Math.exp(sum - c.mean)), rows };
}

export const pooledCohortEquationsPce = {
  id: 'pooled-cohort-equations-pce',
  name: 'Pooled Cohort Equations (ASCVD)',
  disease: 'cardiovascular',
  outcome: 'First heart attack, coronary death or stroke within 10 years',
  horizonYears: 10,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [40, 79],
  population: 'Non-Hispanic white and African American adults aged 40–79 without cardiovascular disease, pooled from the ARIC, CHS, CARDIA and Framingham cohorts.',
  source: {
    citation: 'Goff DC Jr, et al. 2013 ACC/AHA Guideline on the Assessment of Cardiovascular Risk. Circulation 2014;129(25 Suppl 2):S49–S73. Table A.',
    doi: '10.1161/01.cir.0000437741.48606.98'
  },
  equation: '10-year risk = 1 − S10^exp(IndividualSum − MeanSum), IndividualSum = Σ coefficient × value (ln of age, cholesterol, HDL and SBP; separate coefficients for each sex and for white / African American; Table A)',
  inputs: ['age', 'sex', 'sbp', 'bpTreated', 'smoking', 'diabetes', 'labs.totalCholMgDl', 'labs.hdlMgDl'],

  compute(person) {
    const early = gate(this, person, (p) =>
      p.profile && p.profile.cvdHistory === true ? 'Already has cardiovascular disease; the PCE estimates a first event.' : '');
    if (early) return early;

    const p = person.profile;
    const eth = p.ethnicity;
    const black = eth === 'black';
    const set = `${black ? 'aa' : 'white'}_${p.sex}`;
    const r = pceRisk(set, {
      age: Number(p.age), tc: Number(person.labs.totalCholMgDl), hdl: Number(person.labs.hdlMgDl),
      sbp: Number(p.sbp), treated: p.bpTreated === true, smoker: p.smoking === 'current', diabetes: p.diabetes === true
    });
    const terms = r.rows.filter((row) => row[2] !== 0 || row[3] !== 0).map(([label, input, beta, x]) => ({
      label, input, beta, x: round(x, 4), contribution: round(beta * x, 6)
    }));
    const c = COEF[set];
    const notes = [
      `Equation used: ${SET_NAMES[set]}. IndividualSum = ${r.sum.toFixed(3)}, MeanSum = ${c.mean}, S10 = ${c.s10}.`
    ];
    if (eth === 'white' || black) {
      notes.push(`Ethnicity entered as ${eth}.`);
    } else if (eth === undefined || eth === null || eth === '') {
      notes.push('No ethnicity entered, so the white equation was used. It was built for white and African American adults and may not fit this person (for example, adults in Taiwan).');
    } else {
      notes.push(`Ethnicity entered as ${eth}: no equation was built for this group, so the white equation was used (the guideline allows this, with a weak recommendation). It may not fit this person.`);
    }
    return computed(this, { value: r.risk, display: formatPercent(r.risk), terms, notes });
  }
};
