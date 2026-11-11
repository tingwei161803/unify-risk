// Revised REACH-B: 5-year liver cancer (HCC) risk in untreated chronic hepatitis B without cirrhosis.
// Kim GA, et al. Viral load-based prediction of hepatocellular carcinoma risk in noncirrhotic patients
// with chronic hepatitis B (Revised REACH-B). Ann Intern Med 2024;177:1308-1318.
//
// A generalised-F accelerated failure time model (R flexsurv genf) with a spline on log10 HBV DNA.
// Published by the authors (supplement Table D-1 and R code): mu, sigma, Q, P and the covariate
// coefficients below (full precision from the authors' web calculator output, agreeing with the
// table after rounding). NOT published: the mean and SD that R's scale() used to standardise the
// covariates. The constants SD_*, MEAN_LOG_DNA, SD_LOG_DNA and SHIFT_K are back-calculated by the
// team from 11 outputs of the authors' calculator (max residual 0.005 percentage points),
// so they are derived, not published. They were only checked for age 30-60, ALT 15-60,
// platelets 150-250 and HBV DNA 10^3 to 10^6 IU/mL, so the formula is limited to ages 30-60 here
// and warns outside the other ranges. The genF survival function is a reconstruction of flexsurv's
// parametrisation (two independent predictions agree). Outside the spline's boundary HBV DNA is
// cut off at the boundary (what R does there is unconfirmed).

import { computed, gate, notApplicable, formatPercent, read, round } from '../util.js';

const C = {
  mu: 1.391675, sigma: 1.256612, Q: 0.017657, P: 0.256296,   // supplement Table D-1, full precision
  age: -0.520211, male: -0.672825, platelet: 0.588864, hbeag: -0.25327, alt: -0.07675,
  spline: [5.017842, 4.236868, 3.71625, 2.474022, 4.461299, 5.585885, 6.340981] // basis columns 2-8
};
const KNOTS = [-2.962176, -2.314809, -1.667442, -1.020074, -0.372707, 0.27466, 0.922028, 1.569395,
  2.216762, 2.86413, 3.511497, 4.158864];
const BOUNDARY = [-1.020074, 2.216762];
// Derived (back-calculated, not published):
const SD_AGE = 11.51, SD_ALT = 15.37, SD_PLT = 55.79, MEAN_LOG_DNA = 4.288, SD_LOG_DNA = 1.54, SHIFT_K = -0.142;
const T = 5; // years

// Cubic B-spline basis (Cox-de Boor) for the 12 knots: 8 functions.
function basis(x) {
  const n = KNOTS.length;
  let b = [];
  for (let i = 0; i < n - 1; i++) b.push(x >= KNOTS[i] && x < KNOTS[i + 1] ? 1 : 0);
  for (let k = 1; k <= 3; k++) {
    const next = [];
    for (let i = 0; i < n - 1 - k; i++) {
      const d1 = KNOTS[i + k] - KNOTS[i];
      const d2 = KNOTS[i + k + 1] - KNOTS[i + 1];
      next.push((d1 ? (x - KNOTS[i]) / d1 * b[i] : 0) + (d2 ? (KNOTS[i + k + 1] - x) / d2 * b[i + 1] : 0));
    }
    b = next;
  }
  return b; // 8 values
}

function lgamma(z) { // Lanczos approximation
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  z -= 1;
  let x = 0.99999999999980993;
  g.forEach((c, i) => { x += c / (z + i + 1); });
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// Regularised incomplete beta I_x(a, b) by continued fraction (modified Lentz).
function betaInc(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx, aa, bb) => {
    const tiny = 1e-300;
    let c = 1, d = 1 - (aa + bb) * xx / (aa + 1);
    d = 1 / (Math.abs(d) < tiny ? tiny : d);
    let h = d;
    for (let m = 1; m <= 500; m++) {
      let num = m * (bb - m) * xx / ((aa + 2 * m - 1) * (aa + 2 * m));
      d = 1 + num * d; d = 1 / (Math.abs(d) < tiny ? tiny : d);
      c = 1 + num / c; c = Math.abs(c) < tiny ? tiny : c;
      h *= d * c;
      num = -(aa + m) * (aa + bb + m) * xx / ((aa + 2 * m) * (aa + 2 * m + 1));
      d = 1 + num * d; d = 1 / (Math.abs(d) < tiny ? tiny : d);
      c = 1 + num / c; c = Math.abs(c) < tiny ? tiny : c;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? front * cf(x, a, b) / a : 1 - Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)) * cf(1 - x, b, a) / b;
}

// Exposed for checks: age (years), male (bool), hbeag (bool), dna (IU/mL), alt (U/L), plt (10^9/L).
export function reachBRisk5(age, male, hbeag, dna, alt, plt) {
  let x = (Math.log10(dna) - MEAN_LOG_DNA) / SD_LOG_DNA;
  x = Math.min(Math.max(x, BOUNDARY[0]), BOUNDARY[1] - 1e-12);
  const bs = basis(x).slice(1);
  const spline = bs.reduce((s, v, i) => s + C.spline[i] * v, 0);
  const mu = C.mu + SHIFT_K + C.hbeag * (hbeag ? 1 : 0) + C.male * (male ? 1 : 0) + C.age * age / SD_AGE
    + C.alt * alt / SD_ALT + C.platelet * plt / SD_PLT + spline;
  const q2p = C.Q * C.Q + 2 * C.P;
  const delta = Math.sqrt(q2p);
  const s1 = 2 / (q2p + C.Q * delta);
  const s2 = 2 / (q2p - C.Q * delta);
  const e = Math.pow(T / Math.exp(mu), delta / C.sigma);
  return betaInc(s1 * e / (s2 + s1 * e), s1, s2);
}

export const reachB = {
  id: 'reach-b',
  name: 'Revised REACH-B',
  disease: 'liver',
  outcome: 'Liver cancer (HCC) within 5 years, untreated hepatitis B',
  horizonYears: 5,
  kind: 'risk',
  derivedIn: 'EU',
  ageRange: [30, 60],
  population: 'Adults with chronic hepatitis B, no cirrhosis, not on antiviral treatment (mean age 45). The back-calculated standardisation was checked only for ages 30–60, so other ages are not applicable.',
  source: {
    citation: 'Kim GA, et al. Viral load-based prediction of hepatocellular carcinoma risk in noncirrhotic patients with chronic hepatitis B (Revised REACH-B). Ann Intern Med 2024;177:1308–1318.',
    doi: '10.7326/M24-0384'
  },
  equation: '5-year risk = 1 − S(5) of a generalised-F survival model; mu = f(age, sex, HBeAg, ALT, platelets, spline of log10 HBV DNA) with published coefficients and back-calculated standardisation',
  inputs: ['age', 'sex', 'hbvCarrier', 'hbvTreated', 'labs.hbeagPositive', 'labs.hbvDnaIuMl', 'labs.altUL', 'labs.plateletsK'],

  compute(person) {
    const early = gate(this, person, (p) => {
      const pr = p.profile || {};
      if (pr.hbvCarrier === false) return 'Not a hepatitis B carrier; this model is for chronic hepatitis B.';
      if (pr.hbvTreated === true) return 'Hepatitis B is on treatment; this model is for untreated carriers (PAGE-B and mPAGE-B are for treated).';
      if (pr.cirrhosis === true) return 'Has cirrhosis; this model was built on people without cirrhosis.';
      return '';
    });
    if (early) return early;
    const p = person.profile;
    const l = person.labs;
    const dna = Number(l.hbvDnaIuMl);
    if (!(dna > 0)) return notApplicable(this, 'HBV DNA must be above zero (undetectable levels cannot be put on the log scale).');
    const age = Number(p.age), alt = Number(l.altUL), plt = Number(l.plateletsK);
    const hbeag = l.hbeagPositive === true;
    const risk = reachBRisk5(age, p.sex === 'male', hbeag, dna, alt, plt);
    const notes = [
      'Coefficients (mu, sigma, Q, P, age, sex, HBeAg, ALT, platelets, DNA spline) are the authors\' published values. The standardisation constants are back-calculated from the authors\' web calculator and are not published.',
      read(person, 'cirrhosis') === undefined ? 'Assumes no cirrhosis (not asked).' : ''
    ].filter(Boolean);
    if (alt < 15 || alt > 60) notes.push(`ALT ${alt} U/L is outside 15–60, the range the back-calculation was checked in.`);
    if (plt < 150 || plt > 250) notes.push(`Platelets ${plt} are outside 150–250 (10^9/L), the range the back-calculation was checked in.`);
    if (dna < 1e3 || dna > 1e6) notes.push(`HBV DNA ${dna} IU/mL is outside 10^3 to 10^6, the range the back-calculation was checked in.`);
    return computed(this, {
      value: risk,
      display: formatPercent(risk),
      terms: [
        { label: 'Age', input: `${age} years`, beta: C.age, x: round(age / SD_AGE, 4), contribution: round(C.age * age / SD_AGE, 6) },
        { label: 'Male', input: p.sex, beta: C.male, x: p.sex === 'male' ? 1 : 0, contribution: p.sex === 'male' ? C.male : 0 },
        { label: 'HBeAg positive', input: hbeag ? 'yes' : 'no', beta: C.hbeag, x: hbeag ? 1 : 0, contribution: hbeag ? C.hbeag : 0 },
        { label: 'ALT', input: `${alt} U/L`, beta: C.alt, x: round(alt / SD_ALT, 4), contribution: round(C.alt * alt / SD_ALT, 6) },
        { label: 'Platelets', input: `${plt} ×10⁹/L`, beta: C.platelet, x: round(plt / SD_PLT, 4), contribution: round(C.platelet * plt / SD_PLT, 6) },
        { label: 'log10 HBV DNA (spline)', input: `${dna} IU/mL`, beta: null, x: round(Math.log10(dna), 3), contribution: null }
      ],
      notes
    });
  }
};
