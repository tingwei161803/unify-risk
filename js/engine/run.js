// PLACEHOLDER engine (issue #9 replaces this file).
// Returns fixed numbers in the agreed result format (docs/interfaces.md) so the pages
// can be built before the real formulas land. Do not show these numbers in the demo.

const FAKE_RESULTS = [
  {
    modelId: 'fsrp', name: 'Revised Framingham Stroke Risk Profile', outcome: 'stroke',
    horizonYears: 10, kind: 'risk', derivedIn: 'US', status: 'ok', value: 0.08,
    terms: [
      { label: 'Age', input: 62, coef: 0.049, contribution: 0.3 },
      { label: 'Systolic blood pressure', input: 148, coef: 0.017, contribution: 0.22 }
    ],
    formula: '1 − S0^exp(Σβx − mean)',
    source: { citation: 'Dufouil C, et al. Circulation 2017', url: 'https://doi.org/10.1161/CIRCULATIONAHA.115.021275' }
  },
  {
    modelId: 'chin-shan-stroke', name: 'Chin-Shan stroke score', outcome: 'stroke',
    horizonYears: 10, kind: 'risk', derivedIn: 'TW', status: 'ok', value: 0.15,
    terms: [{ label: 'Age', input: 62, coef: null, contribution: 6 }],
    formula: 'points → 10-year risk table',
    source: { citation: 'Chien KL, et al. Stroke 2010', url: 'https://doi.org/10.1161/STROKEAHA.110.586222' }
  },
  {
    modelId: 'findrisc', name: 'FINDRISC', outcome: 'diabetes',
    horizonYears: 10, kind: 'risk', derivedIn: 'EU', status: 'missing',
    missing: ['profile.waistCm', 'profile.familyDiabetes'],
    source: { citation: 'Lindström J, Tuomilehto J. Diabetes Care 2003', url: 'https://doi.org/10.2337/diacare.26.3.725' }
  },
  {
    modelId: 'caide', name: 'CAIDE dementia risk score', outcome: 'dementia',
    horizonYears: 20, kind: 'risk', derivedIn: 'EU', status: 'not_applicable',
    reason: 'Developed for ages 39–64',
    source: { citation: 'Kivipelto M, et al. Lancet Neurol 2006', url: 'https://doi.org/10.1016/S1474-4422(06)70537-3' }
  }
];

/** person: { profile, labs }. Returns one result per formula. */
export function runAll(person) {
  return FAKE_RESULTS.map((result) => ({ ...result, placeholder: true }));
}
