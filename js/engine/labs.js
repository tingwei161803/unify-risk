// Reference standards for the values on a health-check report, and a plain-English
// reading of where one person stands against each of them.
//
//   interpretLabs(person, report?) -> one row per value the person has (absent = not tested, no row).
//       person: docs/interfaces.md Person { profile, labs } (a sample person with `region` works too).
//       report: optional; either the interfaces.md Lab report { date, source, labs } (its values win)
//               or the richer js/data/reports.js entry { items: [{ key, value, range }] } (values and
//               printed ranges win).
//   metabolicSyndrome(person) -> Taiwan criteria: how many of the 5 items are met (3 or more = yes)
//   LAB_STANDARDS             -> every cut-off with its source, for the "show the math" drawer
//
// Person shape: docs/interfaces.md (profile + labs, units in the key names), plus the optional
// person.report.printedRanges = { <lab key>: '<range as printed, e.g. "≤40" or "0.7–1.3">' }.
// Region decides the BMI and waist cut-offs: person.region, else profile.region, else DEFAULT_REGION.
//
// Row shape
//   { key, label, group: 'blood' | 'measurement', value, unit, standard, status, statusLabel,
//     category, explanation, source }
//   status: 'normal' | 'borderline' | 'high' | 'very-high' | 'low'
//
// Cut-offs come from published guidelines (SOURCES). For AST, ALT, creatinine and platelets the
// lab's own printed range wins; without one, a common adult range is used and labelled as such.
// One reading is a snapshot, not a condition. Not a diagnosis. Not medical advice.

export const SOURCES = {
  hpaBmi: 'Taiwan Health Promotion Administration (HPA), adult BMI categories',
  who: 'WHO adult BMI classification',
  hpaMets: 'Taiwan HPA metabolic syndrome criteria (2007)',
  atp3: 'NCEP Adult Treatment Panel III (ATP III), 2001',
  accAha: '2017 ACC/AHA high blood pressure guideline (Whelton et al.)',
  ada: 'ADA Standards of Care in Diabetes 2026, Section 2 (Tables 2.1 and 2.2)',
  kdigo: 'KDIGO 2024 guideline for chronic kidney disease',
  printed: "The lab's printed reference range",
  common: 'Common adult reference range (labs differ; a printed range on the report takes priority)'
};

export const DEFAULT_REGION = 'TW';
const regionOf = (person) => person?.region || person?.profile?.region || DEFAULT_REGION;

const STATUS_LABEL = {
  normal: 'Normal',
  borderline: 'Borderline ▲',
  high: 'High ▲',
  'very-high': 'Very high ▲▲',
  low: 'Low ▼'
};

// A band applies while the value is below `below` (exclusive) or at most `upTo` (inclusive).
const band = (limit, status, category, inclusive = false) =>
  inclusive ? { upTo: limit, status, category } : { below: limit, status, category };

export const LAB_STANDARDS = {
  bmi: {
    label: 'Body mass index (BMI)', group: 'measurement', unit: 'kg/m²',
    TW: {
      source: SOURCES.hpaBmi,
      bands: [band(18.5, 'low', 'Underweight'), band(24, 'normal', 'Healthy weight'), band(27, 'borderline', 'Overweight'),
        band(35, 'high', 'Obese'), band(Infinity, 'very-high', 'Severe obesity')]
    },
    other: {
      source: SOURCES.who,
      bands: [band(18.5, 'low', 'Underweight'), band(25, 'normal', 'Normal weight'), band(30, 'borderline', 'Overweight'),
        band(Infinity, 'high', 'Obesity')]
    }
  },
  waist: {
    label: 'Waist', group: 'measurement', unit: 'cm',
    TW: { source: SOURCES.hpaMets, male: { atLeast: 90 }, female: { atLeast: 80 }, text: 'central obesity at 90 cm or more (men), 80 cm or more (women)' },
    other: { source: SOURCES.atp3, male: { above: 102 }, female: { above: 88 }, text: 'abdominal obesity above 102 cm (men), above 88 cm (women)' }
  },
  bp: {
    label: 'Blood pressure', group: 'measurement', unit: 'mmHg', source: SOURCES.accAha,
    text: 'normal under 120/80 · elevated 120–129 and under 80 · stage 1 range 130–139 or 80–89 · stage 2 range 140 or more or 90 or more · severe above 180 or above 120; the higher of the two numbers decides'
  },
  fastingGlucose: {
    label: 'Fasting glucose', group: 'blood', unit: 'mg/dL', source: SOURCES.ada,
    bands: [band(100, 'normal', 'Normal'), band(126, 'borderline', 'Prediabetes range (impaired fasting glucose)'),
      band(Infinity, 'high', 'Diabetes range (one result needs a repeat test)')]
  },
  hba1c: {
    label: 'HbA1c', group: 'blood', unit: '%', source: SOURCES.ada,
    bands: [band(5.7, 'normal', 'Normal'), band(6.5, 'borderline', 'Prediabetes range'),
      band(Infinity, 'high', 'Diabetes range (one result needs a repeat test)')]
  },
  totalChol: {
    label: 'Total cholesterol', group: 'blood', unit: 'mg/dL', source: SOURCES.atp3,
    bands: [band(200, 'normal', 'Desirable'), band(240, 'borderline', 'Borderline high'), band(Infinity, 'high', 'High')]
  },
  ldl: {
    label: 'LDL cholesterol', group: 'blood', unit: 'mg/dL', source: SOURCES.atp3,
    bands: [band(100, 'normal', 'Optimal'), band(130, 'normal', 'Near or above optimal'), band(160, 'borderline', 'Borderline high'),
      band(190, 'high', 'High'), band(Infinity, 'very-high', 'Very high')]
  },
  hdl: {
    label: 'HDL cholesterol', group: 'blood', unit: 'mg/dL', source: SOURCES.atp3 + '; ' + SOURCES.hpaMets,
    text: 'low under 40 · 60 or more is high (protective) · Taiwan metabolic-syndrome line under 40 (men), under 50 (women)'
  },
  tg: {
    label: 'Triglycerides', group: 'blood', unit: 'mg/dL', source: SOURCES.atp3,
    bands: [band(150, 'normal', 'Normal'), band(200, 'borderline', 'Borderline high'), band(500, 'high', 'High'), band(Infinity, 'very-high', 'Very high')]
  },
  creatinine: {
    label: 'Creatinine', group: 'blood', unit: 'mg/dL',
    common: { male: { lo: 0.7, hi: 1.3 }, female: { lo: 0.5, hi: 1.1 } }
  },
  egfr: {
    label: 'eGFR (kidney filtering rate)', group: 'blood', unit: 'mL/min/1.73m²', source: SOURCES.kdigo,
    // descending: the first stage whose floor the value reaches
    stages: [{ atLeast: 90, status: 'normal', category: 'G1, normal or high' }, { atLeast: 60, status: 'normal', category: 'G2, mildly decreased' },
      { atLeast: 45, status: 'low', category: 'G3a, mildly to moderately decreased' }, { atLeast: 30, status: 'low', category: 'G3b, moderately to severely decreased' },
      { atLeast: 15, status: 'low', category: 'G4, severely decreased' }, { atLeast: -Infinity, status: 'low', category: 'G5, kidney failure range' }]
  },
  uacr: {
    label: 'Urine albumin-to-creatinine ratio (UACR)', group: 'blood', unit: 'mg/g', source: SOURCES.kdigo,
    bands: [band(30, 'normal', 'A1, normal to mildly increased'), band(300, 'high', 'A2, moderately increased', true),
      band(Infinity, 'very-high', 'A3, severely increased')]
  },
  ast: { label: 'AST (liver enzyme)', group: 'blood', unit: 'U/L', common: { lo: null, hi: 40 } },
  alt: { label: 'ALT (liver enzyme)', group: 'blood', unit: 'U/L', common: { lo: null, hi: 40 } },
  platelets: { label: 'Platelets', group: 'blood', unit: '×10³/µL', common: { lo: 150, hi: 400 } }
};

/* ---------- helpers ---------- */

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fmt = (v, d = 1) => {
  const s = Number(v).toFixed(d);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};
// at least one decimal, as labs print HbA1c and creatinine ("6.0", "1.0")
const fmt1 = (v) => (Number.isInteger(Number(v)) ? Number(v).toFixed(1) : String(Number(v)));

function pickBand(bands, v) {
  return bands.find((b) => (b.upTo !== undefined ? v <= b.upTo : v < b.below));
}

// "under 100 normal · 100 to under 126 prediabetes range · 126 or more diabetes range"
function describeBands(bands) {
  const parts = [];
  let lo = null;
  let startsAt = true; // false when the previous band ended inclusively, so this one starts "above"
  for (const b of bands) {
    const inclusiveEnd = b.upTo !== undefined;
    const hi = inclusiveEnd ? b.upTo : b.below;
    const from = lo === null ? '' : startsAt ? fmt(lo, 2) : `above ${fmt(lo, 2)}`;
    let range;
    if (lo === null) range = inclusiveEnd ? `${fmt(hi, 2)} or less` : `under ${fmt(hi, 2)}`;
    else if (hi === Infinity) range = startsAt ? `${from} or more` : from;
    else range = inclusiveEnd ? `${from}–${fmt(hi, 2)}` : `${from} to under ${fmt(hi, 2)}`;
    const cat = /^[A-Z][a-z]/.test(b.category) ? b.category[0].toLowerCase() + b.category.slice(1) : b.category;
    parts.push(`${range} ${cat}`);
    lo = hi;
    startsAt = !inclusiveEnd;
  }
  return parts.join(' · ');
}

// Parse a printed range such as "≤40", "<40", "0.7–1.3" or "150-400".
export function parseRange(text) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/,/g, '');
  const span = t.match(/(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)/);
  if (span) return { lo: Number(span[1]), hi: Number(span[2]), text: text.trim() };
  const upper = t.match(/(?:≤|<=|<)\s*(\d+(?:\.\d+)?)/);
  if (upper) return { lo: null, hi: Number(upper[1]), text: text.trim() };
  return null;
}

function row(key, std, value, unit, extra) {
  return {
    key,
    label: std.label,
    group: std.group,
    value,
    unit,
    standard: extra.standard,
    status: extra.status,
    statusLabel: STATUS_LABEL[extra.status],
    category: extra.category,
    explanation: extra.explanation,
    source: extra.source
  };
}

const printedNote = (person, key) => {
  const t = person?.report?.printedRanges?.[key];
  return t ? ` · report prints ${t}` : '';
};

/* ---------- one function per item ---------- */

function bmiRow(person) {
  const p = person.profile || {};
  const h = num(p.heightCm), w = num(p.weightKg);
  if (h === null || w === null) return null;
  const v = Math.round((w / (h / 100) ** 2) * 10) / 10;
  const tw = regionOf(person) === 'TW';
  const std = LAB_STANDARDS.bmi[tw ? 'TW' : 'other'];
  const b = pickBand(std.bands, v);
  const healthy = tw ? '18.5 to under 24' : '18.5 to under 25';
  const where = tw ? "Taiwan's" : "the WHO's";
  const explanation = b.status === 'normal'
    ? `BMI ${fmt(v)} is in ${where} healthy range (${healthy}).`
    : b.status === 'low'
      ? `BMI ${fmt(v)} is below 18.5, ${where} underweight line.`
      : `BMI ${fmt(v)} is in ${where} "${b.category.toLowerCase()}" band; the healthy range is ${healthy}.`;
  return row('bmi', LAB_STANDARDS.bmi, v, 'kg/m²', {
    standard: describeBands(std.bands) + ' (from height and weight)', status: b.status, category: b.category, explanation, source: std.source
  });
}

function waistRow(person) {
  const p = person.profile || {};
  const v = num(p.waistCm);
  if (v === null || (p.sex !== 'male' && p.sex !== 'female')) return null;
  const tw = regionOf(person) === 'TW';
  const std = LAB_STANDARDS.waist[tw ? 'TW' : 'other'];
  const rule = std[p.sex];
  const over = rule.atLeast !== undefined ? v >= rule.atLeast : v > rule.above;
  const line = rule.atLeast !== undefined ? `${rule.atLeast} cm or more` : `above ${rule.above} cm`;
  const who = p.sex === 'male' ? 'men' : 'women';
  const explanation = over
    ? `A waist of ${fmt(v)} cm is at or past the line for ${who} (${line}), which marks extra fat around the middle.`
    : `A waist of ${fmt(v)} cm is under the line for ${who} (${line}).`;
  return row('waistCm', LAB_STANDARDS.waist, v, 'cm', {
    standard: std.text, status: over ? 'high' : 'normal', category: over ? (tw ? 'Central obesity' : 'Abdominal obesity') : 'Within range',
    explanation, source: std.source
  });
}

export function bpCategory(sbp, dbp) {
  if (sbp > 180 || dbp > 120) return { status: 'very-high', category: 'Severe range (above 180/120)' };
  if (sbp >= 140 || dbp >= 90) return { status: 'high', category: 'Stage 2 hypertension range' };
  if (sbp >= 130 || dbp >= 80) return { status: 'high', category: 'Stage 1 hypertension range' };
  if (sbp >= 120) return { status: 'borderline', category: 'Elevated' };
  return { status: 'normal', category: 'Normal' };
}

function bpRow(person) {
  const p = person.profile || {};
  const s = num(p.sbp), d = num(p.dbp);
  if (s === null || d === null) return null;
  const c = bpCategory(s, d);
  const onMeds = p.bpTreated === true ? ' This reading is on blood-pressure medicine.' : '';
  const explanation = c.status === 'normal'
    ? `${s}/${d} mmHg is under 120/80, the normal line.${onMeds}`
    : `${s}/${d} mmHg is in the ${c.category.toLowerCase()}; one office reading is not enough, so repeat or home readings confirm it.${onMeds}`;
  return row('bp', LAB_STANDARDS.bp, `${s}/${d}`, 'mmHg', {
    standard: LAB_STANDARDS.bp.text, status: c.status, category: c.category, explanation, source: SOURCES.accAha
  });
}

function bandedRow(person, key, stdKey, sentence) {
  const v = num(person.labs?.[key]);
  if (v === null) return null;
  const std = LAB_STANDARDS[stdKey];
  const b = pickBand(std.bands, v);
  return row(key, std, v, std.unit, {
    standard: describeBands(std.bands) + printedNote(person, key), status: b.status, category: b.category,
    explanation: sentence(v, b), source: std.source
  });
}

const glucoseRow = (person) => {
  const r = bandedRow(person, 'fastingGlucoseMgDl', 'fastingGlucose', (v, b) =>
    b.status === 'normal' ? `Fasting glucose ${fmt(v)} mg/dL is under 100, the normal line.`
      : b.status === 'borderline' ? `Fasting glucose ${fmt(v)} mg/dL is above the prediabetes line (100) but below the diabetes range (126).`
        : `Fasting glucose ${fmt(v)} mg/dL is in the diabetes range (126 or more); a single result needs a repeat test before it means diabetes.`);
  if (!r) return r;
  // a printed lower limit can still flag a low value
  const pr = parseRange(person.report?.printedRanges?.fastingGlucoseMgDl);
  if (pr && pr.lo !== null && r.value < pr.lo) {
    Object.assign(r, { status: 'low', statusLabel: STATUS_LABEL.low, category: 'Below the printed range',
      explanation: `Fasting glucose ${fmt(r.value)} mg/dL is below the lab's printed range (${pr.text}).`, source: SOURCES.printed });
  }
  return r;
};

const hba1cRow = (person) => bandedRow(person, 'hba1cPct', 'hba1c', (v, b) =>
  b.status === 'normal' ? `HbA1c ${fmt1(v)}% is under 5.7%, the normal line; it reflects average blood sugar over about three months.`
    : b.status === 'borderline' ? `HbA1c ${fmt1(v)}% is in the prediabetes range (5.7–6.4%), above normal but below the diabetes range (6.5%).`
      : `HbA1c ${fmt1(v)}% is in the diabetes range (6.5% or more); a single result needs a repeat test before it means diabetes.`);

const totalCholRow = (person) => bandedRow(person, 'totalCholMgDl', 'totalChol', (v, b) =>
  b.status === 'normal' ? `Total cholesterol ${fmt(v)} mg/dL is under 200, the desirable line.`
    : b.status === 'borderline' ? `Total cholesterol ${fmt(v)} mg/dL is borderline high (200–239).`
      : `Total cholesterol ${fmt(v)} mg/dL is high (240 or more).`);

const ldlRow = (person) => bandedRow(person, 'ldlMgDl', 'ldl', (v, b) =>
  b.status === 'normal' ? `LDL ("bad") cholesterol ${fmt(v)} mg/dL is ${b.category === 'Optimal' ? 'optimal (under 100)' : 'near optimal (100–129)'}.`
    : `LDL ("bad") cholesterol ${fmt(v)} mg/dL is ${b.category.toLowerCase()} (${b.category === 'Borderline high' ? '130–159' : b.category === 'High' ? '160–189' : '190 or more'}); it is the main cholesterol number linked to heart disease and stroke.`);

const tgRow = (person) => bandedRow(person, 'tgMgDl', 'tg', (v, b) =>
  b.status === 'normal' ? `Triglycerides ${fmt(v)} mg/dL are under 150, the normal line.`
    : `Triglycerides ${fmt(v)} mg/dL are ${b.category.toLowerCase()} (${b.category === 'Borderline high' ? '150–199' : b.category === 'High' ? '200–499' : '500 or more'}); they often rise with extra weight, sugar and alcohol.`);

function hdlRow(person) {
  const v = num(person.labs?.hdlMgDl);
  if (v === null) return null;
  const female = person.profile?.sex === 'female';
  let status, category, explanation;
  if (v < 40) {
    status = 'low'; category = 'Low';
    explanation = `HDL ("good") cholesterol ${fmt(v)} mg/dL is under 40, which counts as a heart-risk factor.`;
  } else if (female && v < 50) {
    status = 'borderline'; category = "Under the women's line of 50";
    explanation = `HDL ("good") cholesterol ${fmt(v)} mg/dL is above 40 but under 50, the line Taiwan's metabolic-syndrome criteria use for women.`;
  } else if (v >= 60) {
    status = 'normal'; category = 'High (protective)';
    explanation = `HDL ("good") cholesterol ${fmt(v)} mg/dL is 60 or more, which counts in your favour.`;
  } else {
    status = 'normal'; category = 'Normal';
    explanation = `HDL ("good") cholesterol ${fmt(v)} mg/dL is not under the low line (${female ? '50 for women' : '40 for men'}).`;
  }
  return row('hdlMgDl', LAB_STANDARDS.hdl, v, 'mg/dL', {
    standard: LAB_STANDARDS.hdl.text + printedNote(person, 'hdlMgDl'), status, category, explanation, source: LAB_STANDARDS.hdl.source
  });
}

// Creatinine, AST, ALT, platelets: the printed range wins; else a common adult range.
function rangeRow(person, key, stdKey, sentence) {
  const v = num(person.labs?.[key]);
  if (v === null) return null;
  const std = LAB_STANDARDS[stdKey];
  const printed = parseRange(person.report?.printedRanges?.[key]);
  let range = printed;
  let source = SOURCES.printed;
  if (!range) {
    const c = std.common.male ? std.common[person.profile?.sex] : std.common;
    if (!c) return null;
    range = { lo: c.lo, hi: c.hi, text: c.lo === null ? `up to ${fmt(c.hi)}` : `${fmt(c.lo)}–${fmt(c.hi)}` };
    source = SOURCES.common;
  }
  const status = range.hi !== null && v > range.hi ? 'high' : range.lo !== null && v < range.lo ? 'low' : 'normal';
  const category = status === 'normal' ? 'Within range' : status === 'high' ? 'Above range' : 'Below range';
  const standard = (printed ? `lab's printed range ${printed.text}` : `common adult range ${range.text} (labs differ)`) + ` ${std.unit}`;
  return row(key, std, v, std.unit, { standard, status, category, explanation: sentence(v, status, range), source });
}

const creatinineRow = (person) => rangeRow(person, 'creatinineMgDl', 'creatinine', (v, s, r) =>
  s === 'normal' ? `Creatinine ${fmt1(v)} mg/dL is within range (${r.text}); the eGFR line turns it into a filtering rate.`
    : `Creatinine ${fmt1(v)} mg/dL is ${s === 'high' ? 'above' : 'below'} range (${r.text}); the eGFR line says what it means for the kidneys.`);

const liverRow = (key, stdKey, name) => (person) => rangeRow(person, key, stdKey, (v, s, r) =>
  s === 'high'
    ? `${name} ${fmt(v)} U/L is ${fmt(v / r.hi)} times the upper limit (${fmt(r.hi)}); mild rises are common with fatty liver, alcohol or some medicines.`
    : `${name} ${fmt(v)} U/L is within range (${r.text}).`);

const plateletsRow = (person) => rangeRow(person, 'plateletsK', 'platelets', (v, s, r) =>
  s === 'normal' ? `Platelets ${fmt(v)} ×10³/µL are within range (${r.text}).`
    : `Platelets ${fmt(v)} ×10³/µL are ${s === 'high' ? 'above' : 'below'} range (${r.text}).`);

function egfrRow(person) {
  const v = num(person.labs?.egfrMlMin);
  if (v === null) return null;
  const std = LAB_STANDARDS.egfr;
  const st = std.stages.find((x) => v >= x.atLeast);
  const explanation = v >= 60
    ? `eGFR ${fmt(v)} is stage ${st.category.split(',')[0]} (${st.category.split(', ')[1]}); on its own this is not kidney disease unless urine albumin is also raised.`
    : `eGFR ${fmt(v)} is stage ${st.category.split(',')[0]} (${st.category.split(', ')[1]}); one result cannot establish chronic kidney disease, it needs a repeat after more than 3 months.`;
  return row('egfrMlMin', std, v, std.unit, {
    standard: 'G1 90 or more · G2 60–89 · G3a 45–59 · G3b 30–44 · G4 15–29 · G5 under 15' + printedNote(person, 'egfrMlMin'),
    status: st.status, category: st.category, explanation, source: std.source
  });
}

const uacrRow = (person) => bandedRow(person, 'uacrMgG', 'uacr', (v, b) =>
  b.status === 'normal' ? `Urine albumin ${fmt(v)} mg/g is under 30 (A1), so the kidney filter is not leaking protein.`
    : `Urine albumin ${fmt(v)} mg/g is ${b.category.split(', ')[1]} (${b.category.split(',')[0]}), an early sign the kidney filter leaks protein; it needs a repeat test to confirm.`);

const ITEMS = [bmiRow, waistRow, bpRow, glucoseRow, hba1cRow, totalCholRow, ldlRow, hdlRow, tgRow, creatinineRow, egfrRow, uacrRow,
  liverRow('astUL', 'ast', 'AST'), liverRow('altUL', 'alt', 'ALT'), plateletsRow];

const PROFILE_MEASURES = ['heightCm', 'weightKg', 'waistCm', 'sbp', 'dbp'];

// Read one report into the person: interfaces.md { date, source, labs } or reports.js { items: [{ key, value, range }] }.
function withReport(person, report) {
  if (!report || typeof report !== 'object') return person;
  const profile = { ...(person.profile || {}) };
  const labs = { ...(person.labs || {}), ...(report.labs || {}) };
  const printedRanges = { ...(person.report?.printedRanges || {}) };
  for (const it of Array.isArray(report.items) ? report.items : []) {
    if (!it || !it.key) continue;
    if (it.range) printedRanges[it.key] = it.range;
    if (num(it.value) === null) continue;
    if (PROFILE_MEASURES.includes(it.key)) profile[it.key] = num(it.value);
    else if (it.key !== 'bmi') labs[it.key] = num(it.value);
  }
  return { ...person, profile, labs, report: { ...(person.report || {}), date: report.date, printedRanges } };
}

/** One row per value the person has, in report order: body measurements, sugar, fats, kidneys, liver, blood count. */
export function interpretLabs(person, report) {
  if (!person) return [];
  const p = withReport(person, report);
  return ITEMS.map((f) => f(p)).filter(Boolean);
}

/** Taiwan metabolic-syndrome criteria: 3 or more of 5. Unknown items (value missing) stay null. */
export function metabolicSyndrome(person) {
  const p = person?.profile || {};
  const l = person?.labs || {};
  const sex = p.sex === 'male' || p.sex === 'female' ? p.sex : null;
  const waist = num(p.waistCm), s = num(p.sbp), d = num(p.dbp), g = num(l.fastingGlucoseMgDl), tg = num(l.tgMgDl), hdl = num(l.hdlMgDl);
  const items = [
    { label: 'Waist', cutoff: '90 cm or more (men), 80 cm or more (women)', value: waist,
      met: waist === null || !sex ? null : waist >= (sex === 'male' ? 90 : 80) },
    { label: 'Blood pressure', cutoff: '130/85 mmHg or more, or on blood-pressure medicine', value: s !== null && d !== null ? `${s}/${d}` : null,
      met: p.bpTreated === true ? true : s === null || d === null ? null : s >= 130 || d >= 85 },
    { label: 'Fasting glucose', cutoff: '100 mg/dL or more, or on diabetes medicine', value: g,
      met: p.diabetes === true ? true : g === null ? null : g >= 100 },
    { label: 'Triglycerides', cutoff: '150 mg/dL or more', value: tg, met: tg === null ? null : tg >= 150 },
    { label: 'HDL cholesterol', cutoff: 'under 40 mg/dL (men), under 50 mg/dL (women)', value: hdl,
      met: hdl === null || !sex ? null : hdl < (sex === 'male' ? 40 : 50) }
  ];
  const count = items.filter((i) => i.met === true).length;
  const unknown = items.filter((i) => i.met === null).map((i) => i.label);
  const met = count >= 3 ? true : count + unknown.length >= 3 ? null : false;
  const which = items.filter((i) => i.met === true).map((i) => i.label.toLowerCase()).join(', ') || 'none';
  const explanation = met === true
    ? `${count} of 5 items are met (${which}); 3 or more is Taiwan's definition of metabolic syndrome, and each item that improves takes the count down.`
    : met === null
      ? `${count} of 5 items are met (${which}); ${unknown.join(', ').toLowerCase()} not measured, so it cannot be settled yet.`
      : `${count} of 5 items are met (${which}); 3 or more is needed for Taiwan's definition of metabolic syndrome.`;
  const note = regionOf(person) !== 'TW' ? ' Taiwan criteria; US programs use a waist line above 102 cm (men) and 88 cm (women).' : '';
  return { count, of: 5, items, met, missing: unknown, explanation: explanation + note, source: SOURCES.hpaMets };
}
