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
//
// Explanations are for ordinary readers: what the value means in everyday words, then one short next
// step, with the guideline named in brackets at the end, e.g. "(ADA)". At most two sentences. They
// never say a person has or does not have a disease, never reassure about large rises, and every
// number in them is the value itself or a line from the standard.

export const SOURCES = {
  hpaBmi: 'Taiwan Health Promotion Administration (HPA), adult BMI categories',
  who: 'WHO adult BMI classification',
  hpaMets: 'Taiwan HPA metabolic syndrome criteria (2007)',
  atp3: 'NCEP Adult Treatment Panel III (ATP III), 2001',
  accAha: '2017 ACC/AHA high blood pressure guideline (Whelton et al.)',
  ada: 'ADA Standards of Care in Diabetes 2026, Section 2 (Tables 2.1 and 2.2)',
  adaLow: 'ADA Standards of Care in Diabetes 2026, Section 6 (glucose levels for hypoglycemia)',
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
    stages: [{ atLeast: 90, status: 'normal', category: 'G1, normal or high', range: '90 or more' },
      { atLeast: 60, status: 'normal', category: 'G2, mildly decreased', range: '60–89' },
      { atLeast: 45, status: 'low', category: 'G3a, mildly to moderately decreased', range: '45–59' },
      { atLeast: 30, status: 'low', category: 'G3b, moderately to severely decreased', range: '30–44' },
      { atLeast: 15, status: 'low', category: 'G4, severely decreased', range: '15–29' },
      { atLeast: -Infinity, status: 'low', category: 'G5, kidney failure range', range: 'under 15' }]
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

// Only real numbers and non-blank numeric strings count; ' ', [], true and the like are "not given",
// so they never turn into a reading of 0 or 1.
const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
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
  if (h === null || w === null || h <= 0 || w <= 0) return null; // blank or zero is "not answered", not a measurement
  const v = Math.round((w / (h / 100) ** 2) * 10) / 10;
  const tw = regionOf(person) === 'TW';
  const std = LAB_STANDARDS.bmi[tw ? 'TW' : 'other'];
  const b = pickBand(std.bands, v);
  const healthy = tw ? '18.5 to under 24' : '18.5 to under 25';
  const org = tw ? 'Taiwan HPA' : 'WHO';
  const bmiText = `BMI ${fmt(v)}; healthy is ${healthy}`;
  const explanation = b.status === 'normal'
    ? `Your weight is in the healthy range for your height (${bmiText}). Regular activity helps keep it there (${org}).`
    : b.status === 'low'
      ? `Your weight is below the healthy range for your height (${bmiText}). Ask your doctor whether you should gain a little (${org}).`
      : b.status === 'borderline'
        ? `Your weight is a little above the healthy range for your height (${bmiText}). Daily walks and smaller portions help (${org}).`
        : `Your weight is well above the healthy range for your height (${bmiText}). Ask your doctor or a dietitian for a plan you can keep (${org}).`;
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
  const org = tw ? 'Taiwan HPA' : 'ATP III';
  const explanation = over
    ? `You carry extra fat around your middle (waist ${fmt(v)} cm; the line for ${who} is ${line}). Daily activity and fewer sugary drinks help bring it down (${org}).`
    : `Your waist is under the line for ${who} (${fmt(v)} cm; the line is ${rule.atLeast ?? rule.above} cm). Regular activity helps keep it there (${org}).`;
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
  const yours = p.bpTreated === true ? 'Your blood pressure, taken while on medicine,' : 'Your blood pressure';
  const reading = `${s}/${d}; normal is under 120/80`;
  const explanation = c.status === 'normal'
    ? `${yours} is in the normal range (${reading}). Check it again at your next check-up (ACC/AHA).`
    : c.status === 'borderline'
      ? `${yours} is a little above normal (${reading}). Home readings over a week show whether it stays there (ACC/AHA).`
      : c.status === 'very-high'
        ? `${yours} is very high in this reading (${s}/${d}; very high is above 180/120). Contact a doctor today (ACC/AHA).`
        : c.category.startsWith('Stage 2')
          ? `${yours} is high in this reading (${reading}). Recheck it at home this week and show the readings to your doctor (ACC/AHA).`
          : `${yours} is above normal in this reading (${reading}). Repeat or home readings show whether it stays there; less salt and more activity help (ACC/AHA).`;
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
    b.status === 'normal'
      ? `Your fasting blood sugar is normal (${fmt(v)}; normal is under 100). Recheck it at your next check-up (ADA).`
      : b.status === 'borderline'
        ? `Your fasting blood sugar is above normal, below the diabetes range (${fmt(v)}; normal is under 100, the diabetes range starts at 126). Less sugar and more activity can bring it down; ask your doctor when to recheck (ADA).`
        : `Your fasting blood sugar is in the diabetes range in this test (${fmt(v)}; the range starts at 126). A second test is needed to confirm it, so ask your doctor about a recheck soon (ADA).`);
  if (!r) return r;
  // Zero, negative or far beyond any lab's scale: not a plausible fasting reading, so no category.
  if (r.value <= 0 || r.value > 1000) {
    return Object.assign(r, { status: 'low', statusLabel: 'Check this value', category: 'Not a plausible reading',
      explanation: `This fasting blood sugar value (${fmt(r.value)}) cannot be right. Please check it against the report.` });
  }
  // Under 70 mg/dL is the ADA's line for low blood glucose.
  if (r.value < 70) {
    return Object.assign(r, { status: 'low', statusLabel: STATUS_LABEL.low, category: 'Under 70 (low-glucose range)',
      explanation: `Your fasting blood sugar is low in this test (${fmt(r.value)}; under 70 is low). Tell your doctor about this result (ADA).`, source: SOURCES.adaLow });
  }
  // a printed lower limit can still flag a low value
  const pr = parseRange(person.report?.printedRanges?.fastingGlucoseMgDl);
  if (pr && pr.lo !== null && r.value < pr.lo) {
    Object.assign(r, { status: 'low', statusLabel: STATUS_LABEL.low, category: 'Below the printed range',
      explanation: `Your fasting blood sugar is below the lab's range (${fmt(r.value)}; the lab prints ${pr.text}). Ask your doctor whether to recheck it (the lab's range).`, source: SOURCES.printed });
  }
  return r;
};

const hba1cRow = (person) => bandedRow(person, 'hba1cPct', 'hba1c', (v, b) =>
  b.status === 'normal'
    ? `Your average blood sugar over the past few months is normal (HbA1c ${fmt1(v)}%; normal is under 5.7%). Recheck it at your next check-up (ADA).`
    : b.status === 'borderline'
      ? `Your average blood sugar over the past few months is above normal, below the diabetes range (HbA1c ${fmt1(v)}%; normal is under 5.7%, the diabetes range starts at 6.5%). Less sugar and more activity can bring it down; ask your doctor when to recheck (ADA).`
      : `Your average blood sugar over the past few months is in the diabetes range in this test (HbA1c ${fmt1(v)}%; the range starts at 6.5%). A second test is needed to confirm it, so ask your doctor about a recheck soon (ADA).`);

const FOOD = 'moving more and eating less fried and fatty meat help';

const totalCholRow = (person) => bandedRow(person, 'totalCholMgDl', 'totalChol', (v, b) =>
  b.status === 'normal'
    ? `Your total cholesterol is in the healthy range (${fmt(v)}; healthy is under 200). Recheck it at your next check-up (ATP III).`
    : b.status === 'borderline'
      ? `Your total cholesterol is a little above the healthy line (${fmt(v)}; healthy is under 200). Moving more and eating less fried and fatty meat help (ATP III).`
      : `Your total cholesterol is high (${fmt(v)}; healthy is under 200, high starts at 240). Moving more and eating less fried and fatty meat help; ask your doctor about a recheck (ATP III).`);

const ldlRow = (person) => bandedRow(person, 'ldlMgDl', 'ldl', (v, b) => {
  const ldl = "Your 'bad' cholesterol (LDL)";
  if (b.category === 'Optimal') return `${ldl} is at the best level (${fmt(v)}; best is under 100). Keep up what you are doing (ATP III).`;
  if (b.category === 'Near or above optimal') return `${ldl} is under the healthy line (${fmt(v)}; healthy is under 130, best is under 100). Recheck it at your next check-up (ATP III).`;
  if (b.status === 'borderline') return `${ldl} is above the healthy line (${fmt(v)}; healthy is under 130). ${FOOD[0].toUpperCase() + FOOD.slice(1)}; ask your doctor about a recheck (ATP III).`;
  if (b.status === 'high') return `${ldl} is high (${fmt(v)}; healthy is under 130, high starts at 160). Ask your doctor about a recheck; ${FOOD} (ATP III).`;
  return `${ldl} is very high (${fmt(v)}; very high starts at 190). Show this result to your doctor soon (ATP III).`;
});

const tgRow = (person) => bandedRow(person, 'tgMgDl', 'tg', (v, b) => {
  const tg = 'Your triglycerides (a blood fat)';
  if (b.status === 'normal') return `${tg} are normal (${fmt(v)}; normal is under 150). Recheck them at your next check-up (ATP III).`;
  if (b.status === 'borderline') return `${tg} are a little high (${fmt(v)}; normal is under 150). Cutting sugar, sweet drinks and alcohol brings them down (ATP III).`;
  if (b.status === 'high') return `${tg} are high (${fmt(v)}; normal is under 150). Cutting sugar, sweet drinks and alcohol helps; ask your doctor about a recheck (ATP III).`;
  return `${tg} are very high (${fmt(v)}; very high starts at 500). Show this result to your doctor soon (ATP III).`;
});

function hdlRow(person) {
  const v = num(person.labs?.hdlMgDl);
  if (v === null) return null;
  const female = person.profile?.sex === 'female';
  let status, category, explanation;
  const hdl = "Your 'good' cholesterol (HDL)";
  if (v < 40) {
    status = 'low'; category = 'Low';
    explanation = `${hdl} is low (${fmt(v)}; low is under 40). Regular exercise and not smoking raise it (ATP III).`;
  } else if (female && v < 50) {
    // Too low for the women's line, so the arrow points down (Low ▼), not up.
    status = 'low'; category = "Under the women's line of 50";
    explanation = `${hdl} is a little low for a woman (${fmt(v)}; the line for women is 50). Regular exercise raises it (Taiwan HPA).`;
  } else if (v >= 60) {
    status = 'normal'; category = 'High (protective)';
    explanation = `${hdl} is high, which helps protect your heart (${fmt(v)}; 60 or more counts as high). Keep up your activity (ATP III).`;
  } else {
    status = 'normal'; category = 'Normal';
    const line = female ? 'low is under 50 for women' : person.profile?.sex === 'male' ? 'low is under 40 for men' : 'low is under 40';
    explanation = `${hdl} is in the normal range (${fmt(v)}; ${line}). Regular exercise can raise it further (ATP III).`;
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
  const cite = printed ? "the lab's range" : 'a common adult range';
  return row(key, std, v, std.unit, { standard, status, category, explanation: sentence(v, status, range, cite), source });
}

const creatinineRow = (person) => rangeRow(person, 'creatinineMgDl', 'creatinine', (v, s, r, cite) =>
  s === 'normal'
    ? `Your creatinine, a waste product your kidneys clear, is within range (${fmt1(v)}; range ${r.text}). The kidney filtering rate (eGFR) is worked out from it (${cite}).`
    : `Your creatinine, a waste product your kidneys clear, is ${s === 'high' ? 'above' : 'below'} the range (${fmt1(v)}; range ${r.text}). The kidney filtering rate (eGFR) shows what this means; ask your doctor about a recheck (${cite}).`);

// Says how far above or below the range the value is and what to do; no guess at the cause and no
// reassurance, however large the rise.
const liverRow = (key, stdKey, name) => (person) => rangeRow(person, key, stdKey, (v, s, r, cite) => {
  const what = `Your ${name}, a liver enzyme,`;
  if (s === 'high') {
    const ratio = v / r.hi;
    // Under 1.5 times, a multiple such as "1 times" reads oddly; say "above" instead.
    if (ratio < 1.5) return `${what} is above the upper limit (${fmt(v)}; the limit is ${fmt(r.hi)}). Ask your doctor about a recheck (${cite}).`;
    const times = `${fmt(ratio)} times the upper limit (${fmt(v)}; the limit is ${fmt(r.hi)})`;
    return ratio >= 5
      ? `${what} is ${times}. Show this result to a doctor within the next few days (${cite}).`
      : `${what} is ${times}. Ask your doctor about a recheck soon (${cite}).`;
  }
  if (s === 'low') return `${what} is below the range (${fmt(v)}; range ${r.text}). Mention it at your next check-up (${cite}).`;
  return `${what} is within range (${fmt(v)}; range ${r.text}). Nothing to do for now (${cite}).`;
});

const plateletsRow = (person) => rangeRow(person, 'plateletsK', 'platelets', (v, s, r, cite) =>
  s === 'normal'
    ? `Your platelets, which help blood clot, are within range (${fmt(v)}; range ${r.text}). Nothing to do for now (${cite}).`
    : `Your platelets, which help blood clot, are ${s === 'high' ? 'above' : 'below'} the range (${fmt(v)}; range ${r.text}). Ask your doctor about a recheck (${cite}).`);

function egfrRow(person) {
  const v = num(person.labs?.egfrMlMin);
  if (v === null) return null;
  const std = LAB_STANDARDS.egfr;
  const st = std.stages.find((x) => v >= x.atLeast);
  // How fast the kidneys filter, in everyday words; never whether the person has or lacks a kidney disease.
  // KDIGO reads this together with urine albumin, and counts a result only once it lasts more than 3 months.
  const pair = num(person.labs?.uacrMgG) !== null ? 'Read it together with your urine albumin result' : 'A urine albumin test adds the other half of the picture';
  const explanation = v >= 90
    ? `Your kidneys filter blood in the top band (${fmt(v)}; the top band is 90 or more). ${pair} (KDIGO).`
    : v >= 60
      ? `Your kidneys filter blood a little below the top band (${fmt(v)}; the top band is 90 or more). ${pair} (KDIGO).`
      : v >= 45
        ? `Your kidneys filter blood more slowly than the usual range (${fmt(v)}; usual is 60 or more). Repeat the test in about 3 months to see whether it stays there (KDIGO).`
        : v >= 30
          ? `Your kidneys filter blood clearly more slowly than usual (${fmt(v)}; usual is 60 or more). Show this result to your doctor and repeat the test in about 3 months (KDIGO).`
          : v >= 15
            ? `Your kidneys filter blood much more slowly than usual (${fmt(v)}; usual is 60 or more). Show this result to your doctor soon (KDIGO).`
            : `Your kidneys filter blood very slowly (${fmt(v)}; the lowest band is under 15). Contact a doctor within the next few days (KDIGO).`;
  return row('egfrMlMin', std, v, std.unit, {
    standard: 'G1 90 or more · G2 60–89 · G3a 45–59 · G3b 30–44 · G4 15–29 · G5 under 15' + printedNote(person, 'egfrMlMin'),
    status: st.status, category: st.category, explanation, source: std.source
  });
}

// What the urine sample shows; no statement about the kidneys themselves.
const uacrRow = (person) => bandedRow(person, 'uacrMgG', 'uacr', (v, b) =>
  b.status === 'normal'
    ? `Your urine sample shows only a small amount of protein (${fmt(v)}; under 30 is the normal band). Recheck it with your next kidney tests (KDIGO).`
    : b.status === 'high'
      ? `Your urine sample shows more protein than normal (${fmt(v)}; normal is under 30). A repeat test in about 3 months shows whether it stays there (KDIGO).`
      : `Your urine sample shows a lot of protein (${fmt(v)}; normal is under 30). Show this result to your doctor soon and repeat the test (KDIGO).`);

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
  const word = (label) => (label.startsWith('HDL') ? label : label.toLowerCase());
  const which = items.filter((i) => i.met === true).map((i) => word(i.label)).join(', ') || 'none';
  const signs = `${count} of the 5 warning signs Taiwan uses for metabolic syndrome ${count === 1 ? 'is' : 'are'} present`;
  const org = regionOf(person) !== 'TW' ? 'Taiwan HPA; US programs use a waist line above 102 cm for men and 88 cm for women' : 'Taiwan HPA';
  const explanation = met === true
    ? `${signs} (${which}; 3 or more is the line). Improving any one of them brings the count down (${org}).`
    : met === null
      ? `${signs} (${which}); ${unknown.map(word).join(', ')} ${unknown.length === 1 ? 'was' : 'were'} not measured, so the count is not final (${org}).`
      : `${signs} (${which}; 3 or more is the line). Keeping your numbers in range keeps the count low (${org}).`;
  return { count, of: 5, items, met, missing: unknown, explanation, source: SOURCES.hpaMets };
}
