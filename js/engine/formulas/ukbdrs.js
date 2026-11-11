// UK Biobank Dementia Risk Score (UKBDRS), 14-year risk of dementia, ages 50-73.
// Anaturk M, et al. BMJ Ment Health 2023;26:e300719, Table 1 (betas to 3 decimals, S0 in the
// footnote). Fine-Gray competing-risk model (death competes):
//
//   risk(14y) = 1 - S0 ^ exp( sum beta x (x - xbar) )
//
// Only age (centre 59.97, main text) and years of education (centre 13.54, seen only in the
// authors' Excel calculator UKB-DRS_Calculator.xlsx) are centred; yes/no items are not.
// The 3-decimal betas of Table 1 are used because they reproduce the authors' calculator
// (see _group-brain-mortality.js); full-precision betas from the authors' GitHub differ in the 4th digit.
// Numbers are copied from COEFFICIENTS['ukbdrs'] (js/data/coefficients.js).
//
// Townsend deprivation has no Taiwan equivalent: everyone is treated as NOT in the most deprived group.
// The APOE version is used only when labs.apoe4Count is present (0, 1 or 2 copies; carrier = 1 or more).

import { computed, gate, read, formatPercent, round, yesNo } from '../util.js';

const AGE_CENTRE = 59.97;
const EDU_CENTRE = 13.54;

// Table 1, column "UKBDRS" and column "UKBDRS-APOE".
const COEF = {
  plain: {
    S0: 0.9916195, // Table 1 footnote
    age: 0.178, parent: 0.431, edu: -0.041, deprived: 0.228, diabetes: 0.536, depression: 0.556,
    stroke: 0.655, htn: 0.159, chol: 0.104, male: 0.169, alone: 0.141
  },
  apoe: {
    S0: 0.9945524, // Table 1 footnote
    age: 0.185, parent: 0.311, edu: -0.038, deprived: 0.247, diabetes: 0.526, depression: 0.567,
    stroke: 0.643, htn: 0.19, chol: 0.027, male: 0.164, alone: 0.137, apoe4: 1.129
  }
};

export const ukbdrs = {
  id: 'ukbdrs',
  name: 'UKBDRS',
  disease: 'dementia',
  outcome: 'Dementia within 14 years',
  horizonYears: 14,
  kind: 'risk',
  derivedIn: 'EU',
  ageRange: [50, 73],
  population: 'UK Biobank (UK), adults aged 50–73 without dementia; checked externally in Whitehall II (UK).',
  source: {
    citation: 'Anatürk M, et al. Development and validation of a dementia risk score in the UK Biobank and Whitehall II cohorts. BMJ Ment Health 2023;26(1):e300719.',
    doi: '10.1136/bmjment-2023-300719'
  },
  equation: '14-year risk = 1 − S0^exp(Σ β·(x − x̄)), S0 = 0.9916195 (0.9945524 with APOE). Age centred at 59.97, education at 13.54; yes/no items not centred.',
  inputs: ['age', 'sex', 'educationYears', 'familyDementia', 'diabetes', 'depression', 'strokeHistory',
    'hypertensionDiagnosed', 'highCholesterolDiagnosed', 'livesAlone'],

  compute(person) {
    const early = gate(this, person);
    if (early) return early;

    const p = person.profile;
    const yes = (v) => (v === true ? 1 : 0);
    const apoeRaw = read(person, 'labs.apoe4Count');
    const hasApoe = apoeRaw !== undefined && apoeRaw !== null && apoeRaw !== '' && Number.isFinite(Number(apoeRaw));
    const x = {
      age: Number(p.age), edu: Number(p.educationYears), parent: yes(p.familyDementia), deprived: 0,
      diabetes: yes(p.diabetes), depression: yes(p.depression), stroke: yes(p.strokeHistory),
      htn: yes(p.hypertensionDiagnosed), chol: yes(p.highCholesterolDiagnosed),
      male: p.sex === 'male' ? 1 : 0, alone: yes(p.livesAlone),
      apoe4: hasApoe && Number(apoeRaw) >= 1 ? 1 : 0
    };
    const c = hasApoe ? COEF.apoe : COEF.plain;

    const rows = [
      ['Age (per year, centred at 59.97)', `${x.age} years`, c.age, x.age - AGE_CENTRE],
      ['Parent had dementia', yesNo(x.parent), c.parent, x.parent],
      ['Years of education (centred at 13.54)', `${x.edu} years`, c.edu, x.edu - EDU_CENTRE],
      ['Most deprived area group (Townsend)', 'not asked; treated as no', c.deprived, 0],
      ['Diabetes', yesNo(x.diabetes), c.diabetes, x.diabetes],
      ['Depression (current or past)', yesNo(x.depression), c.depression, x.depression],
      ['Stroke or TIA', yesNo(x.stroke), c.stroke, x.stroke],
      ['Hypertension', yesNo(x.htn), c.htn, x.htn],
      ['High cholesterol', yesNo(x.chol), c.chol, x.chol],
      ['Male', yesNo(x.male), c.male, x.male],
      ['Lives alone', yesNo(x.alone), c.alone, x.alone]
    ];
    if (hasApoe) rows.push(['APOE ε4 carrier', `${Number(apoeRaw)} copies`, c.apoe4, x.apoe4]);
    const terms = rows.map(([label, input, beta, xv]) => ({
      label, input, beta, x: round(xv, 4), contribution: round(beta * xv, 7)
    }));
    const L = rows.reduce((s, r) => s + r[2] * r[3], 0);
    const risk = 1 - Math.pow(c.S0, Math.exp(L));

    const notes = [
      `Linear predictor = ${L.toFixed(5)}; S0 = ${c.S0}.`,
      'Deprivation (Townsend) has no Taiwan equivalent, so this person is treated as not in the most deprived group. If they were, the estimate would be higher.',
      hasApoe
        ? 'APOE version used because an APOE ε4 count was provided.'
        : 'The version without APOE is used (no APOE result entered). An APOE version exists.',
      'High cholesterol is read as a told-by-a-doctor yes/no; the paper’s exact definition was not checked.',
      'UK data, not calibrated to Taiwan. The paper’s main text has no worked example; the check reproduces the authors’ Excel calculator.'
    ];
    return computed(this, { value: risk, display: formatPercent(risk), terms, notes, linearPredictor: round(L, 7) });
  }
};
