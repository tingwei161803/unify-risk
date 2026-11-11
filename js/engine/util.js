// Shared helpers for the formula engine. Plain ES module, no dependencies.

// Labels for the "what is missing" list. Profile fields use their bare key;
// lab fields are prefixed with "labs." (person.labs.totalCholMgDl -> 'labs.totalCholMgDl').
export const FIELD_LABELS = {
  age: 'Age',
  sex: 'Sex',
  heightCm: 'Height',
  weightKg: 'Weight',
  waistCm: 'Waist circumference',
  educationYears: 'Years of education',
  smoking: 'Smoking',
  sbp: 'Systolic blood pressure',
  dbp: 'Diastolic blood pressure',
  bpTreated: 'Takes blood-pressure medicine',
  diabetes: 'Has diabetes',
  highGlucoseHistory: 'Ever told blood sugar was high',
  afib: 'Atrial fibrillation',
  cvdHistory: 'Heart disease or heart failure',
  familyStroke: 'Parent or sibling had a stroke',
  familyDiabetes: 'Relatives with diabetes',
  active30minDaily: 'At least 30 minutes of activity a day',
  exerciseTwiceWeekly: 'Leisure exercise at least twice a week',
  vegFruitDaily: 'Vegetables, fruit or berries every day',
  'labs.totalCholMgDl': 'Total cholesterol',
  'labs.fastingGlucoseMgDl': 'Fasting glucose',
  'labs.hdlMgDl': 'HDL cholesterol',
  'labs.tgMgDl': 'Triglycerides'
};

const CHOICES = {
  sex: ['male', 'female'],
  smoking: ['never', 'former', 'current'],
  familyDiabetes: ['none', 'second', 'first']
};

const BOOLEAN_FIELDS = new Set([
  'bpTreated', 'diabetes', 'highGlucoseHistory', 'afib', 'cvdHistory', 'familyStroke',
  'active30minDaily', 'exerciseTwiceWeekly', 'vegFruitDaily'
]);

// Read one field from a person: 'age' from person.profile, 'labs.x' from person.labs.
export function read(person, field) {
  if (field.startsWith('labs.')) return ((person && person.labs) || {})[field.slice(5)];
  return ((person && person.profile) || {})[field];
}

function isPresent(field, value) {
  if (value === undefined || value === null || value === '') return false;
  if (CHOICES[field]) return CHOICES[field].includes(value);
  if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean';
  return Number.isFinite(Number(value));
}

// Inputs that are absent or invalid, as [{ field, label }]. Never guessed.
export function missingFields(person, fields) {
  return fields
    .filter((f) => !isPresent(f, read(person, f)))
    .map((f) => ({ field: f, label: FIELD_LABELS[f] || f }));
}

export function bmi(profile) {
  const m = Number(profile.heightCm) / 100;
  return Number(profile.weightKg) / (m * m);
}

export function round(x, digits) {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

// 0.0691 -> '6.9%'; below 1% keep two decimals so small risks do not read as 0.
export function formatPercent(p) {
  const pct = p * 100;
  return (pct < 1 ? pct.toFixed(2) : pct.toFixed(1)) + '%';
}

export function yesNo(v) {
  return v ? 'yes' : 'no';
}

// Age gate shared by every formula. ageRange = [lo, hi]; hi = null means no upper limit,
// lo = null means the source states no lower limit.
// Returns '' when the age is inside the range, otherwise the reason shown to the person.
export function outsideAge(meta, age) {
  const [lo, hi] = meta.ageRange;
  if ((lo === null || age >= lo) && (hi === null || age <= hi)) return '';
  const range = hi === null ? `${lo} and over` : `${lo}–${hi}`;
  return `Age ${age} is outside ${range}, the ages this formula was built on.`;
}

// Result builders. Every formula returns the same shape (documented in index.js).
function base(meta) {
  return {
    id: meta.id,
    name: meta.name,
    disease: meta.disease,
    outcome: meta.outcome,
    kind: meta.kind || 'risk',
    derivedIn: meta.derivedIn || null,
    status: 'computed',
    value: null,
    display: '',
    horizonYears: meta.horizonYears,
    score: null,
    terms: [],
    equation: meta.equation,
    missing: [],
    reason: '',
    population: meta.population,
    ageRange: meta.ageRange.slice(),
    source: { ...meta.source },
    notes: []
  };
}

export function computed(meta, fields) {
  return Object.assign(base(meta), fields, { status: 'computed' });
}

export function missingResult(meta, list) {
  return Object.assign(base(meta), { status: 'missing', missing: list });
}

export function notApplicable(meta, reason) {
  return Object.assign(base(meta), { status: 'not-applicable', reason });
}

// The checks every formula runs before computing, in this order:
// 1. age known and outside the range -> not applicable (no need to ask for the rest)
// 2. extra exclusion (e.g. previous stroke) -> not applicable
// 3. any input missing -> list it
// Returns a finished result, or null when the formula can compute.
export function gate(meta, person, exclusion) {
  const age = read(person, 'age');
  if (isPresent('age', age)) {
    const reason = outsideAge(meta, Number(age));
    if (reason) return notApplicable(meta, reason);
  }
  if (exclusion) {
    const reason = exclusion(person);
    if (reason) return notApplicable(meta, reason);
  }
  const list = missingFields(person, meta.inputs);
  return list.length ? missingResult(meta, list) : null;
}
