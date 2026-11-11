// Engine entry for the app (issue #19, part of #9).
// Adapts the formula engine (js/engine/index.js) and the lab readings (js/engine/labs.js)
// to the result format in docs/interfaces.md. Nothing is computed here.
//
// The engine is the normal path. If one of the imports below fails to load, this file falls
// back to the fixed placeholder results at the bottom, so the app shows a warning instead of
// a blank page.

const engine = await import('./index.js').catch(() => null);
const labs = await import('./labs.js').catch(() => null);
const util = await import('./util.js').catch(() => null);

/** True when the engine loaded; false means the fallback placeholder numbers are in use. */
export const ENGINE_READY = Boolean(engine);

// Fallback for `derivedIn` (docs/interfaces.md). Every formula in js/engine/formulas now sets its own,
// so this covers only a result that arrives without one.
const DERIVED_IN = { fsrp: 'US', 'chin-shan-stroke': 'TW', findrisc: 'EU', caide: 'EU' };
const STATUS = { computed: 'ok', missing: 'missing', 'not-applicable': 'not_applicable' };

// Engine result -> interfaces result. Engine-only fields (display, score, notes, ageRange,
// population) are kept for the "show the math" drawer.
function toInterface(r) {
  const { id, disease, status, equation, missing, source, terms, ...rest } = r;
  return {
    ...rest,
    modelId: id,
    outcome: disease,
    // The engine's own kind and derivedIn win; the fallbacks cover engines that do not set them.
    kind: r.kind || 'risk',
    derivedIn: r.derivedIn || DERIVED_IN[id] || null,
    status: STATUS[status] || status,
    // Point scores have no coefficient; their points are the contribution.
    terms: terms.map((t) => ('points' in t
      ? { label: t.label, input: t.input, coef: null, contribution: t.points }
      : { label: t.label, input: t.input, coef: t.beta, contribution: t.contribution, x: t.x })),
    formula: equation,
    missing: missing.map((m) => (m.field.startsWith('labs.') ? m.field : `profile.${m.field}`)),
    missingLabels: missing.map((m) => m.label),
    source: { citation: source.citation, url: source.doi ? `https://doi.org/${source.doi}` : source.url || '' }
  };
}

/** person: { profile, labs }. Returns one result per formula. */
export function runAll(person) {
  if (!engine) return PLACEHOLDER.map((result) => ({ ...result, placeholder: true }));
  return engine.runAll(person || {}).map(toInterface);
}

/** One row per lab value the person has: { key, label, value, unit, standard, status, statusLabel, explanation, source }. */
export function interpretLabs(person, report) {
  return labs ? labs.interpretLabs(person, report) : [];
}

/** Taiwan metabolic-syndrome criteria, or null until js/engine/labs.js is on main. */
export function metabolicSyndrome(person) {
  return labs ? labs.metabolicSyndrome(person) : null;
}

// Questionnaire fields, in the order of docs/interfaces.md (Person).
const FIELDS = [
  ['age', 'number', 'years'], ['sex', 'choice', null, ['male', 'female']],
  ['heightCm', 'number', 'cm'], ['weightKg', 'number', 'kg'], ['waistCm', 'number', 'cm'],
  ['educationYears', 'number', 'years'], ['smoking', 'choice', null, ['never', 'former', 'current']],
  ['sbp', 'number', 'mmHg'], ['dbp', 'number', 'mmHg'], ['bpTreated', 'yesno'], ['diabetes', 'yesno'],
  ['highGlucoseHistory', 'yesno'], ['afib', 'yesno'], ['cvdHistory', 'yesno'], ['strokeHistory', 'yesno'],
  ['familyStroke', 'yesno'], ['familyDiabetes', 'choice', null, ['none', 'second', 'first']],
  ['active30minDaily', 'yesno'], ['exerciseTwiceWeekly', 'yesno'], ['vegFruitDaily', 'yesno'],
  ['labs.totalCholMgDl', 'number', 'mg/dL']
];

/**
 * Every questionnaire field: { key, label, type: 'number' | 'choice' | 'yesno', unit, options, usedBy }.
 * key is the store key ('age' -> profile.age, 'labs.x' -> labs.x); usedBy lists formula ids.
 */
export const QUESTIONS = FIELDS.map(([key, type, unit = null, options = null]) => ({
  key,
  label: util?.FIELD_LABELS[key] || (key === 'strokeHistory' ? 'Has had a stroke' : key),
  type,
  unit,
  options,
  usedBy: engine ? engine.FORMULAS.filter((f) => f.inputs.includes(key)).map((f) => f.id) : []
}));

/** Everything the results page and the report writer (#11) need, in one object. */
export function assess(person) {
  return {
    results: runAll(person),
    labs: interpretLabs(person),
    metabolicSyndrome: metabolicSyndrome(person),
    placeholder: !engine
  };
}

// Fixed numbers in the agreed format, used only if the engine fails to load.
// Do not show these numbers in the demo.
const PLACEHOLDER = [
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
    missingLabels: ['Waist circumference', 'Relatives with diabetes'],
    source: { citation: 'Lindström J, Tuomilehto J. Diabetes Care 2003', url: 'https://doi.org/10.2337/diacare.26.3.725' }
  },
  {
    modelId: 'caide', name: 'CAIDE dementia risk score', outcome: 'dementia',
    horizonYears: 20, kind: 'risk', derivedIn: 'EU', status: 'not_applicable',
    reason: 'Developed for ages 39–64',
    source: { citation: 'Kivipelto M, et al. Lancet Neurol 2006', url: 'https://doi.org/10.1016/S1474-4422(06)70537-3' }
  }
];
