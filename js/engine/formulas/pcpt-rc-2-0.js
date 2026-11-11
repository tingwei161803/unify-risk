// PCPT Prostate Cancer Risk Calculator 2.0: chance that a prostate biopsy done now would find no cancer,
// low-grade cancer or high-grade cancer.
// Ankerst DP, et al.
// Urology 2014 (PCPT risk calculator 2.0). Coefficients: the authors' supplementary R file, which the
// research repo records line by line (js/data/coefficients.js, COEFFICIENTS['pcpt-rc-2-0']). The R file
// was read, never run. Only the main model is implemented (PSA, age, ethnicity, optional prior biopsy,
// DRE and family history); the %free PSA, PCA3, detailed family history and SNP updates are not.
// The paper prints no worked example; checks are self-computed.
// Unconfirmed: the R file states no age range, so none is applied.

import { computed, formatPercent, round } from '../util.js';
import { gateCancer, isNum, isBool, isEthnicity } from './_cancer-util.js';

// Coefficient order: intercept, log2(PSA), age, African American, then the optional terms present.
// Source: pcpt-rc-2-0-ankerst2014.r, lines noted per set (S1 = low grade vs none, S2 = high grade vs none).
const SETS = {
  // bx = prior negative biopsy, dre = abnormal exam, fh = family history
  'bx,dre,fh': { // L57-60
    S1: [-3.00215469, 0.2561339, 0.01643637, 0.12172599, -0.45533257, -0.03864628, 0.27197219],
    S2: [-7.05304534, 0.70489441, 0.04753804, 1.04174529, -0.21409933, 0.40068434, 0.22467348]
  },
  'bx,dre': { // L64-65
    S1: [-2.89648245, 0.25904098, 0.01559192, 0.11996693, -0.45444, -0.03729244],
    S2: [-6.96119633, 0.70674359, 0.04676393, 1.0393772, -0.21100921, 0.40319606]
  },
  'bx,fh': { // L69-70
    S1: [-3.01529063, 0.25578861, 0.01654912, 0.12327661, -0.45825158, 0.27183869],
    S2: [-6.94522156, 0.7063726, 0.04697087, 1.02065099, -0.18320006, 0.23044734]
  },
  bx: { // L74-75
    S1: [-2.90917471, 0.25872451, 0.01570165, 0.12141077, -0.45729181],
    S2: [-6.85264083, 0.70797314, 0.04621214, 1.01887797, -0.17972927]
  },
  'dre,fh': { // L79-80
    S1: [-2.90933651, 0.23803667, 0.01447269, 0.11443251, -0.06592322, 0.27128248],
    S2: [-6.99449483, 0.69530025, 0.04637911, 1.03847001, 0.38651649, 0.22287791]
  },
  dre: { // L84-85
    S1: [-2.80429793, 0.24127801, 0.01363705, 0.11165777, -0.06487585],
    S2: [-6.90681925, 0.69720305, 0.04566552, 1.03622425, 0.38925765]
  },
  fh: { // L89-90
    S1: [-2.92983751, 0.23714373, 0.01463232, 0.1176543, 0.27095959],
    S2: [-6.90439295, 0.69799874, 0.0460813, 1.01787561, 0.22913998]
  },
  '': { // L94-95
    S1: [-2.81814489, 0.2404437, 0.01370219, 0.12000825],
    S2: [-6.8424997, 0.70043815, 0.0457446, 1.01699029]
  }
};

const dot = (c, x) => c.reduce((s, b, i) => s + b * x[i], 0);

// Exported for checks. x = { psa (ng/mL), age, aa (0/1), bx, dre, fh (0/1 or undefined = unknown) }.
export function pcptProbabilities(x) {
  const key = [x.bx !== undefined ? 'bx' : '', x.dre !== undefined ? 'dre' : '', x.fh !== undefined ? 'fh' : '']
    .filter(Boolean).join(',');
  const set = SETS[key];
  const data = [1, Math.log2(x.psa), x.age, x.aa]
    .concat([x.bx, x.dre, x.fh].filter((v) => v !== undefined));
  const S1 = dot(set.S1, data);
  const S2 = dot(set.S2, data);
  const d = 1 + Math.exp(S1) + Math.exp(S2);
  const none = 1 / d;
  const low = Math.exp(S1) / d;
  return { S1, S2, none, low, high: 1 - none - low, key, data, set };
}

export const pcptRc20 = {
  id: 'pcpt-rc-2-0',
  name: 'PCPT Risk Calculator 2.0',
  disease: 'prostate cancer',
  outcome: 'High-grade prostate cancer found if a biopsy were done now',
  horizonYears: null,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [null, null],
  population: 'Men in the US Prostate Cancer Prevention Trial who had a biopsy; applies to men not yet diagnosed with prostate cancer.',
  source: {
    citation: 'Ankerst DP, et al. Urology 2014 (PCPT Prostate Cancer Risk Calculator 2.0, authors\' supplementary R file).',
    doi: '10.1016/j.urology.2014.02.035'
  },
  equation: 'S1 = b0 + b1·log2(PSA) + b2·age + b3·African American + (prior negative biopsy, abnormal exam, family history when known); S2 likewise with its own coefficients; none = 1/(1+e^S1+e^S2), low grade = e^S1/(1+e^S1+e^S2), high grade = 1 − none − low',
  inputs: ['age', 'sex', 'labs.psaNgMl', 'ethnicity', 'priorNegativeBiopsy', 'dreAbnormal', 'familyProstateCancer'],

  compute(person) {
    const early = gateCancer(this, person, {
      numeric: ['age', 'sex', 'labs.psaNgMl'],
      custom: { ethnicity: isEthnicity },
      exclusion: (q) => {
        const p = q.profile || {};
        const psa = Number((q.labs || {}).psaNgMl);
        if (p.sex === 'female') return 'The prostate cancer calculator applies to men only.';
        if (Number.isFinite(psa) && psa <= 0) return 'PSA must be above 0 ng/mL (the model uses its logarithm).';
        return '';
      }
    });
    if (early) return early;

    const p = person.profile;
    const optional = (v) => (isBool(v) ? (v ? 1 : 0) : undefined);
    const x = {
      psa: Number(person.labs.psaNgMl), age: Number(p.age), aa: p.ethnicity === 'black' ? 1 : 0,
      bx: optional(p.priorNegativeBiopsy), dre: optional(p.dreAbnormal), fh: optional(p.familyProstateCancer)
    };
    const r = pcptProbabilities(x);
    const names = ['Intercept', 'log2(PSA)', 'Age', 'African American'];
    if (x.bx !== undefined) names.push('Prior biopsy without cancer');
    if (x.dre !== undefined) names.push('Suspicious digital rectal exam');
    if (x.fh !== undefined) names.push('Father, brother or son with prostate cancer');
    const terms = names.map((label, i) => ({
      label: `${label} (high-grade equation)`,
      input: i === 1 ? `${round(x.psa, 2)} ng/mL` : '',
      beta: r.set.S2[i],
      x: r.data[i],
      contribution: r.set.S2[i] * r.data[i]
    }));
    const unknown = ['priorNegativeBiopsy', 'dreAbnormal', 'familyProstateCancer'].filter((f) => !isBool(p[f]));
    return computed(this, {
      value: r.high,
      display: `High-grade ${formatPercent(r.high)} · low-grade ${formatPercent(r.low)} · no cancer ${formatPercent(r.none)}`,
      terms,
      notes: [
        'This is the chance a biopsy done now would find each result, not the chance of developing cancer in future years.',
        'Terms shown are those of the high-grade equation; the low-grade equation uses its own coefficients on the same inputs.',
        unknown.length
          ? `Not answered (${unknown.join(', ')}): the calculator's smaller published model without those answers was used.`
          : 'All optional answers were given, so the full published model was used.',
        'Not included: %free PSA, PCA3, T2:ERG, detailed family history and SNP updates.',
        'The R file gives no age range; none is applied.'
      ]
    });
  }
};
