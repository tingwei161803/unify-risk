// Next steps after the results: follow-up tests and public services.
//
// Everything here is a written rule over the person's own answers, lab readings and
// engine results. No model is involved, and no number is produced: every figure shown
// is either copied from the person's record or is part of a published eligibility rule.
// Nothing here recommends a medicine, a dose or a supplement, or says that a person has
// or does not have a disease.
//
// A service match never claims more than was checked. Each match has two parts:
//   meets    the person's own values that meet a part of the published rule
//   confirm  parts of the rule this app does not collect, or whose answer is missing
// A service is "meets" only when nothing is left to confirm; otherwise it "may apply".
//
// Service rules are summaries. Each carries its official source so the person can
// confirm the current rule. Read on 2026-11-11: the CDC eligibility page (National DPP),
// Medicare.gov (yearly wellness visit), the USPSTF recommendation page, and the Nantou
// County Public Health Bureau page for the ROC year 115 metabolic syndrome programme.
// The free adult health check-up and the quit-smoking services follow the team's 2026
// note (docs/report-interpreter.md, section 6) and were not re-checked against a source page.

const SOURCES = {
  hpa: { name: 'Health Promotion Administration, Taiwan', url: 'https://www.hpa.gov.tw/EngPages/Index.aspx' },
  tsh: { name: 'Taiwan Smokers\' Helpline', url: 'https://www.tsh.org.tw/' },
  uspstfDiabetes: { name: 'US Preventive Services Task Force, 2021', url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes' },
  twMets: { name: 'Nantou County Public Health Bureau, metabolic syndrome programme (ROC year 115)', url: 'https://www.ntshb.gov.tw/form/Details?Parser=28%2C7%2C1264%2C60%2C111%2C%2C1129' },
  cdcDpp: { name: 'CDC National Diabetes Prevention Program, eligibility', url: 'https://www.cdc.gov/diabetes-prevention/eligible-lifestyle-change-program/index.html' },
  medicare: { name: 'Medicare.gov', url: 'https://www.medicare.gov/coverage/yearly-wellness-visits' },
  smokefree: { name: 'Smokefree.gov, US National Cancer Institute', url: 'https://smokefree.gov/' }
};

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const row = (ctx, key) => (ctx.labRows || []).find((r) => r && r.key === key) || null;
const shown = (r) => `${r.label} ${r.value} ${r.unit}`.trim();          // copied from the lab reading, never recomputed
const offStandard = (r) => r && r.status && r.status !== 'normal';

/* ---------- follow-up tests ---------- */

// Which test supplies a missing formula input, or follows up a reading outside its standard.
const TESTS = {
  bp: {
    name: 'Blood pressure, repeated',
    adds: 'One reading can be off. Several readings over a week show where your blood pressure usually sits. The stroke and dementia formulas all use it.',
    where: { TW: 'A home monitor, a pharmacy, or any clinic.', US: 'A home monitor, a pharmacy, or your primary care office.' },
    fields: ['profile.sbp', 'profile.dbp'], rows: ['bp']
  },
  lipids: {
    name: 'Lipid panel (total cholesterol, HDL, LDL, triglycerides)',
    adds: 'Total cholesterol is an input of the CAIDE formula. Triglycerides and HDL complete the metabolic syndrome count.',
    where: { TW: 'Part of the free adult health check-up, or a clinic blood test.', US: 'A routine blood test through primary care.' },
    fields: ['labs.totalCholMgDl', 'labs.hdlMgDl', 'labs.ldlMgDl', 'labs.tgMgDl'], rows: ['totalCholMgDl', 'hdlMgDl', 'ldlMgDl', 'tgMgDl']
  },
  glucose: {
    name: 'Fasting glucose or HbA1c, repeated',
    adds: 'A second result on another day shows whether the first one holds. Published standards ask for a repeat before a single result is relied on.',
    where: { TW: 'Fasting glucose is part of the free adult health check-up; HbA1c is a clinic blood test.', US: 'A routine blood test through primary care.' },
    fields: ['labs.fastingGlucoseMgDl', 'labs.hba1cPct'], rows: ['fastingGlucoseMgDl', 'hba1cPct']
  },
  kidney: {
    name: 'Creatinine and urine albumin (UACR)',
    adds: 'Together they give the kidney function stage used by published kidney standards.',
    where: { TW: 'Creatinine is part of the free adult health check-up; UACR is a clinic urine test.', US: 'Routine blood and urine tests through primary care.' },
    fields: ['labs.creatinineMgDl', 'labs.egfrMlMin', 'labs.uacrMgG'], rows: ['egfrMlMin', 'uacrMgG']
  },
  waist: {
    name: 'Waist measurement',
    adds: 'An input of FINDRISC and one of the five metabolic syndrome items.',
    where: { TW: 'A tape measure at home, level with the navel.', US: 'A tape measure at home, level with the navel.' },
    fields: ['profile.waistCm'], rows: []
  },
  questionnaire: {
    name: 'Finish the questionnaire',
    adds: 'These answers are inputs of a formula that could not be computed.',
    where: { TW: 'In this app.', US: 'In this app.' },
    fields: [], rows: []
  }
};

const testForField = (field) =>
  Object.keys(TESTS).find((id) => TESTS[id].fields.includes(field)) || (field.startsWith('profile.') ? 'questionnaire' : null);

// How far a reading's band is from normal, taken from the status the lab standards give
// it (js/engine/labs.js): 'very-high' is the furthest band, 'high' and 'low' come next and
// rank the same, 'borderline' is the nearest. No distance is computed here.
const SEVERITY = { 'very-high': 0, high: 1, low: 1, borderline: 2 };
const NO_READING = 3;
const severity = (r) => (r.status in SEVERITY ? SEVERITY[r.status] : 1);   // an unknown off-standard status ranks with high / low
const TEST_ORDER = Object.keys(TESTS);

/** The ordering rule of followUpTests in one sentence, for the page to print. */
export const FOLLOW_UP_ORDER =
  'Order: tests that repeat a reading outside its standard come first, furthest band first (very high, then high or low, then borderline); ' +
  'then tests that supply a missing formula input; then tests that complete the metabolic syndrome count. ' +
  'Ties keep this fixed order: blood pressure, lipids, glucose, kidney, waist, questionnaire.';

/**
 * Every follow-up test, in the order FOLLOW_UP_ORDER states. Nothing is cut unless the
 * caller passes a `limit`.
 * Returns [{ id, name, reasons: [string], adds, where }].
 */
export function followUpTests(ctx, limit = Infinity) {
  ctx = ctx || {};
  const found = new Map();   // id -> { priority, severity, reasons }
  const add = (id, priority, reason, sev = NO_READING) => {
    if (!id) return;
    const entry = found.get(id) || { priority, severity: sev, reasons: [] };
    entry.priority = Math.min(entry.priority, priority);
    entry.severity = Math.min(entry.severity, sev);
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    found.set(id, entry);
  };

  // 1. A reading outside its published standard: repeat it. (Weight and waist are not lab tests.)
  for (const [id, test] of Object.entries(TESTS)) {
    for (const key of test.rows) {
      const r = row(ctx, key);
      if (offStandard(r)) add(id, 1, `Your ${shown(r)} reads "${String(r.statusLabel || r.status).replace(/[▲▼]/g, '').trim()}" against the standard used here.`, severity(r));
    }
  }
  // 2. A formula that could not be computed: supply what it lists as missing.
  for (const result of ctx.results || []) {
    if (!result || result.status !== 'missing') continue;
    (result.missing || []).forEach((field, i) => {
      const label = (result.missingLabels || [])[i] || field;
      add(testForField(String(field)), 2, `${result.name} could not be computed without: ${label}.`);
    });
  }
  // 3. Metabolic syndrome count that cannot be settled yet (Taiwan criteria).
  if (ctx.region === 'TW' && ctx.mets && ctx.mets.met === null) {
    add('lipids', 3, `The metabolic syndrome count cannot be settled: ${(ctx.mets.missing || []).join(', ').toLowerCase()} not measured.`);
  }

  return [...found.entries()]
    .sort((a, b) => a[1].priority - b[1].priority || a[1].severity - b[1].severity || TEST_ORDER.indexOf(a[0]) - TEST_ORDER.indexOf(b[0]))
    .slice(0, limit)
    .map(([id, entry]) => ({ id, name: TESTS[id].name, reasons: entry.reasons, adds: TESTS[id].adds, where: TESTS[id].where[ctx.region] || TESTS[id].where.US }));
}

/* ---------- services ---------- */

// Each service: `rule` is the published eligibility in words. `match(view)` returns
// { meets: [string], confirm: [string] }, or null when a collected value rules the
// service out or nothing relevant is known. `meets` strings are copied from the person's
// record; `confirm` strings are parts of the rule that were not checked.

const NOT_DIABETES = 'Not previously told you have diabetes';

// Blood test values in the prediabetes range the CDC and the Taiwan programme both print.
const a1cInRange = (labs) => { const v = num(labs.hba1cPct); return v !== null && v >= 5.7 && v <= 6.4 ? `HbA1c ${v}%` : null; };
const glucoseInRange = (labs) => { const v = num(labs.fastingGlucoseMgDl); return v !== null && v >= 100 && v <= 125 ? `Fasting glucose ${v} mg/dL` : null; };

const lower = (labels) => labels.map((l) => (l.startsWith('HDL') || l === 'BMI' ? l : l.toLowerCase())).join(', ');
const ITEM_UNITS = { Waist: 'cm', 'Blood pressure': 'mmHg', 'Fasting glucose': 'mg/dL', Triglycerides: 'mg/dL', 'HDL cholesterol': 'mg/dL' };

// The five items of the Taiwan programme, read from the engine's metabolic syndrome object
// (items with met true / false / null). The programme's first item is "waist, or BMI 27 or
// more", so the BMI reading can meet it when the waist does not.
function programmeItems({ mets, bmi, profile }) {
  const met = [], notMet = [], unknown = [];
  for (const item of (mets && mets.items) || []) {
    const text = item.value === null || item.value === undefined ? item.label : `${item.label} ${item.value} ${ITEM_UNITS[item.label] || ''}`.trim();
    if (item.label === 'Waist') {
      if (item.met === true) met.push(text);
      else if (bmi && bmi.n >= 27) met.push(`${bmi.text} (27 or more counts in place of waist)`);
      else if (item.met === false && bmi) notMet.push(`${text}, ${bmi.text}`);
      else unknown.push(item.met === false ? 'BMI' : 'Waist');
    } else if (item.met === true) {
      // The engine also counts these two items from a questionnaire answer; say so rather than show a value that is under the line.
      const s = num(profile.sbp), d = num(profile.dbp);
      if (item.label === 'Blood pressure' && profile.bpTreated === true && !(s !== null && d !== null && (s >= 130 || d >= 85))) met.push('Blood pressure (you answered yes to blood-pressure medicine)');
      else if (item.label === 'Fasting glucose' && profile.diabetes === true && !(num(item.value) !== null && num(item.value) >= 100)) met.push('Fasting glucose (you answered yes to diabetes)');
      else met.push(text);
    } else if (item.met === false) notMet.push(text);
    else unknown.push(item.label);
  }
  return { met, notMet, unknown, of: ((mets && mets.items) || []).length };
}

const SERVICES = {
  TW: [
    {
      id: 'tw-adult-checkup',
      name: 'Free adult health check-up',
      what: 'A government-funded check-up: questionnaire, blood pressure, waist, fasting glucose, lipids, kidney and liver blood tests.',
      rule: 'Ages 30–39 once every 5 years, 40–64 once every 3 years, 65 and over once a year.',
      how: 'Book at a contracted clinic or hospital with your National Health Insurance card.',
      source: SOURCES.hpa,
      match: ({ age }) => {
        if (age === null || age < 30) return null;
        const interval = age < 40 ? 'in the past 5 years' : age < 65 ? 'in the past 3 years' : 'in the past year';
        // The app does not ask when the last check-up was.
        return { meets: [`Age ${age}`], confirm: [`No free adult health check-up ${interval}`] };
      }
    },
    {
      id: 'tw-mets-program',
      name: 'Metabolic syndrome prevention program',
      what: 'Follow-up visits with a clinic team that sets goals with you for waist, blood pressure, blood sugar and lipids, and tracks them over time.',
      rule: 'People aged 20–69 covered by National Health Insurance who either (1) meet 3 or more of these 5 items: waist 90 cm or more for men, 80 cm or more for women, or BMI 27 or more; fasting glucose 100 mg/dL or more; blood pressure 130/85 mmHg or more; triglycerides 150 mg/dL or more; HDL cholesterol under 40 mg/dL for men, under 50 mg/dL for women (being on medicine for an item also counts), or (2) have HbA1c 5.7–6.4%.',
      how: 'Ask a participating primary care clinic to enrol you; bring your latest check-up report.',
      source: SOURCES.twMets,
      match: (view) => {
        const { age, profile, labs } = view;
        if (age !== null && (age < 20 || age > 69)) return null;
        const items = programmeItems(view);
        // Path 2 is the programme's "prediabetes" path, so it is not used after a "yes" to diabetes.
        const a1c = profile.diabetes === true ? null : a1cInRange(labs);
        const enough = items.of > 0 && items.met.length >= 3;
        const possible = items.of > 0 && items.met.length >= 1 && items.met.length + items.unknown.length >= 3;
        if (!enough && !a1c && !possible) return null;

        const meets = [], confirm = [];
        if (age === null) confirm.push('Age 20 to 69'); else meets.push(`Age ${age}`);
        if (a1c) meets.push(`${a1c} (path 2 of the rule)`);
        if (items.of > 0) {
          // Say exactly which of the five items were checked and which were not.
          const parts = [`${items.met.length} of the ${items.of} items met${items.met.length ? `: ${items.met.join('; ')}` : ''}`];
          if (items.notMet.length) parts.push(`Not met: ${items.notMet.join('; ')}`);
          if (items.unknown.length) parts.push(`Not measured here: ${lower(items.unknown)}`);
          const line = parts.join('. ') + '.';
          if (enough) meets.push(line);
          else if (!a1c) { meets.push(line); confirm.push(`3 or more of the ${items.of} items are needed; not measured here: ${lower(items.unknown)}`); }
          else meets.push(`Path 1 of the rule, for reference: ${line}`);
        }
        confirm.push('Covered by National Health Insurance');
        return { meets, confirm };
      }
    },
    {
      id: 'tw-quit',
      name: 'Quit-smoking helpline',
      what: 'Free phone counselling. Contracted clinics and pharmacies also offer quit-smoking services under their own conditions, which are not checked here.',
      rule: 'The helpline is open to anyone who currently smokes.',
      how: 'Call the Taiwan Smokers\' Helpline on 0800-636363.',
      source: SOURCES.tsh,
      match: ({ profile }) => (profile.smoking === 'current' ? { meets: ['Smoking: current'], confirm: [] } : null)
    }
  ],
  US: [
    {
      id: 'us-diabetes-check',
      name: 'Blood sugar check covered as preventive care',
      what: 'A fasting glucose or HbA1c test, recommended by the US Preventive Services Task Force (grade B).',
      rule: 'Adults aged 35 to 70 who have overweight or obesity (BMI 25 or more), are not pregnant and have no symptoms of diabetes.',
      how: 'Ask your primary care office. Most health plans cover recommended preventive services without a copay; whether yours does depends on the plan, so confirm with it.',
      source: SOURCES.uspstfDiabetes,
      match: ({ age, bmi, profile }) => {
        // The recommendation is about finding diabetes that is not yet known.
        if (profile.diabetes === true) return null;
        if (age !== null && (age < 35 || age > 70)) return null;
        if (bmi && bmi.n < 25) return null;
        if (age === null && !bmi) return null;
        const meets = [], confirm = [];
        if (age === null) confirm.push('Age 35 to 70'); else meets.push(`Age ${age}`);
        if (!bmi) confirm.push('BMI 25 or more'); else meets.push(bmi.text);
        confirm.push('Not pregnant', 'No symptoms of diabetes');
        return { meets, confirm };
      }
    },
    {
      id: 'us-dpp',
      name: 'National Diabetes Prevention Program',
      what: 'A year-long, CDC-recognised lifestyle change program with a trained coach, in person or online.',
      rule: 'All four of: 18 or older; BMI 25 or more (23 or more if Asian American); never told you have type 1 or type 2 diabetes; not pregnant. And one of: a blood test in the prediabetes range within the past year (HbA1c 5.7–6.4%, fasting glucose 100–125 mg/dL, or 2-hour glucose 140–199 mg/dL after a 75 g glucose load); having been told you had gestational diabetes (diabetes during pregnancy); or a high-risk result (5 or higher) on the Prediabetes Risk Test.',
      how: 'Find a recognised program near you through the CDC registry; many employers and health plans cover it.',
      source: SOURCES.cdcDpp,
      match: ({ age, profile, bmi, labs }) => {
        if (age !== null && age < 18) return null;
        if (profile.diabetes === true) return null;
        if (bmi && bmi.n < 23) return null;
        // Gestational diabetes history, the risk test and 2-hour glucose are not collected, so only these two values can match.
        const inRange = [a1cInRange(labs), glucoseInRange(labs)].filter(Boolean);
        if (!inRange.length) return null;

        const meets = [], confirm = [];
        if (age === null) confirm.push('Age 18 or older'); else meets.push(`Age ${age}`);
        if (!bmi) confirm.push('BMI 25 or more (23 or more if Asian American)');
        else if (bmi.n >= 25) meets.push(bmi.text);
        else confirm.push(`BMI 23 or more counts only if you are Asian American (your reading: ${bmi.text})`);
        if (profile.diabetes === false) meets.push('Diabetes: no (your answer)'); else confirm.push(NOT_DIABETES);
        meets.push(...inRange);
        confirm.push('Blood test taken within the past year', 'Not pregnant');
        return { meets, confirm };
      }
    },
    {
      id: 'us-medicare-wellness',
      name: 'Medicare yearly wellness visit',
      what: 'A yearly visit to update a personal prevention plan. It includes a check of memory and thinking.',
      rule: 'People who have had Medicare Part B for longer than 12 months, with no "Welcome to Medicare" visit and no yearly wellness visit in the past 12 months. Most people join Medicare at 65; age itself is not part of the rule.',
      how: 'Book with a provider who accepts Medicare assignment; the visit itself then costs nothing. Extra tests or services during the visit may be billed.',
      source: SOURCES.medicare,
      match: ({ age }) => (age !== null && age >= 65
        ? { meets: [`Age ${age} (most people join Medicare at 65)`], confirm: ['Medicare Part B for longer than 12 months', 'No "Welcome to Medicare" visit in the past 12 months', 'No yearly wellness visit in the past 12 months'] }
        : null)
    },
    {
      id: 'us-quit',
      name: 'Quitline and Smokefree.gov',
      what: 'Free phone coaching and quit plans.',
      rule: 'Anyone who currently smokes.',
      how: 'Call 1-800-QUIT-NOW (1-800-784-8669).',
      source: SOURCES.smokefree,
      match: ({ profile }) => (profile.smoking === 'current' ? { meets: ['Smoking: current'], confirm: [] } : null)
    }
  ]
};

export const SERVICE_STATUS = {
  meets: 'Your values meet this rule',
  'may-apply': 'May apply: some parts of the rule are not checked here'
};

/**
 * Services whose published rule the person's own values meet, or may meet.
 * Returns [{ id, name, what, rule, how, source, status, meets: [string], confirm: [string] }],
 * `status` 'meets' (nothing left to confirm) before 'may-apply' (see `confirm`).
 */
export function matchingServices(ctx) {
  ctx = ctx || {};
  const bmiRow = row(ctx, 'bmi');
  const view = {
    ...ctx,
    profile: ctx.profile || {},
    labs: ctx.labs || {},
    age: num((ctx.profile || {}).age),
    // BMI comes from the lab reading the engine produced; it is not recomputed here.
    bmi: bmiRow && num(bmiRow.value) !== null ? { n: num(bmiRow.value), text: shown(bmiRow) } : null
  };
  const listed = (SERVICES[ctx.region] || [])
    .map((service) => {
      const found = service.match(view);
      if (!found) return null;
      const { match, ...rest } = service;
      return { ...rest, status: found.confirm.length ? 'may-apply' : 'meets', meets: found.meets, confirm: found.confirm };
    })
    .filter(Boolean);
  return [...listed.filter((s) => s.status === 'meets'), ...listed.filter((s) => s.status === 'may-apply')];
}

export const REGION_NAMES = { TW: 'Taiwan', US: 'United States' };
