// FIB-4 index: a blood-test index of liver fibrosis (scarring) today. Not a probability.
// Sterling RK, et al. Development of a simple noninvasive index to predict significant fibrosis
// in patients with HIV/HCV coinfection. Hepatology 2006;43:1317-1325 (formula in the abstract).
//
//   FIB-4 = age (years) x AST (U/L) / ( platelets (10^9/L) x sqrt(ALT (U/L)) )
//
// Cut-offs: the original paper used < 1.45 (rule out advanced fibrosis) and > 3.25 (rule in).
// The MASLD guideline (Rinella 2023, AASLD) uses 1.3 and 2.67, and 2.0 as the lower cut-off for
// people over 65. Both are given in the notes; the band shown follows the original paper.
// Source of these numbers: research file risk-models-cancer-copd-liver.md section 8.1
// (FIB-4 is not in js/data/coefficients.js because it has no coefficient table).

import { computed, gate, notApplicable, round } from '../util.js';

const ORIGINAL_LOW = 1.45;   // Sterling 2006: below this, advanced fibrosis ruled out (NPV 90%)
const ORIGINAL_HIGH = 3.25;  // Sterling 2006: above this, advanced fibrosis likely (PPV 65%)
const MASLD_LOW = 1.3;       // Rinella 2023, PDF p.12-13
const MASLD_HIGH = 2.67;
const MASLD_LOW_OVER_65 = 2.0;

// Exposed for checks: age (years), AST (U/L), ALT (U/L), platelets (10^9/L).
export function fib4Value(age, ast, alt, plt) {
  return (age * ast) / (plt * Math.sqrt(alt));
}

export const fib4 = {
  id: 'fib-4',
  name: 'FIB-4',
  disease: 'liver',
  outcome: 'Liver fibrosis index (now)',
  horizonYears: null,
  kind: 'value',
  derivedIn: 'US',
  ageRange: [null, null],
  population: 'Adults with HIV and hepatitis C (832 people, 555 to build and 277 to test), with liver biopsy as the reference; also used widely in fatty liver disease.',
  source: {
    citation: 'Sterling RK, et al. Development of a simple noninvasive index to predict significant fibrosis in patients with HIV/HCV coinfection. Hepatology 2006;43:1317–1325.',
    doi: '10.1002/hep.21178'
  },
  equation: 'FIB-4 = age × AST ÷ (platelets × √ALT); below 1.45 low, above 3.25 high (original paper)',
  inputs: ['age', 'labs.astUL', 'labs.altUL', 'labs.plateletsK'],

  compute(person) {
    const early = gate(this, person);
    if (early) return early;
    const age = Number(person.profile.age);
    const ast = Number(person.labs.astUL);
    const alt = Number(person.labs.altUL);
    const plt = Number(person.labs.plateletsK);
    if (!(alt > 0) || !(plt > 0)) return notApplicable(this, 'ALT and platelets must be above zero.');
    const v = fib4Value(age, ast, alt, plt);
    const label = v < ORIGINAL_LOW ? `Below ${ORIGINAL_LOW}: advanced fibrosis ruled out in the original paper`
      : v > ORIGINAL_HIGH ? `Above ${ORIGINAL_HIGH}: advanced fibrosis likely in the original paper`
        : `${ORIGINAL_LOW}–${ORIGINAL_HIGH}: in between, the original paper does not decide`;
    const lowCut = age > 65 ? MASLD_LOW_OVER_65 : MASLD_LOW;
    const notes = [
      `Original paper (Sterling 2006): < ${ORIGINAL_LOW} rules out advanced fibrosis (NPV 90%, sensitivity 70%); > ${ORIGINAL_HIGH} rules it in (PPV 65%, specificity 97%).`,
      `Fatty liver guideline cut-offs (Rinella 2023): ${MASLD_LOW} and ${MASLD_HIGH}; the lower cut-off is ${MASLD_LOW_OVER_65} for people over 65. For this person (${age}): below ${lowCut} = low, above ${MASLD_HIGH} = high.`,
      'An index of fibrosis now, not a prediction. Platelets in 10^9/L equal ×10³ per µL.'
    ];
    return computed(this, {
      value: round(v, 2),
      display: `${round(v, 2)} (index)`,
      band: { label, aboveCutoff: v > ORIGINAL_HIGH },
      terms: [
        { label: 'Age × AST', input: `${age} × ${ast}`, beta: null, x: round(age * ast, 1), contribution: null },
        { label: 'Platelets × √ALT', input: `${plt} × √${alt}`, beta: null, x: round(plt * Math.sqrt(alt), 2), contribution: null }
      ],
      notes
    });
  }
};
