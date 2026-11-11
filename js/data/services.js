// Next steps after the results: follow-up tests and public services.
//
// Everything here is a written rule over the person's own answers, lab readings and
// engine results. No model is involved, and no number is produced: every figure shown
// is either copied from the person's record or is part of a published eligibility rule.
// Nothing here recommends a medicine, a dose or a supplement, or says that a person has
// or does not have a disease.
//
// Service rules are summaries. Each carries its official source so the person can
// confirm the current rule. Taiwan rules follow the Health Promotion Administration's
// published programmes as the team noted them in 2026 (docs/report-interpreter.md,
// section 6); they have not been re-checked against the source page tonight.

const SOURCES = {
  hpa: { name: 'Health Promotion Administration, Taiwan', url: 'https://www.hpa.gov.tw/EngPages/Index.aspx' },
  tsh: { name: 'Taiwan Smokers\' Helpline', url: 'https://www.tsh.org.tw/' },
  uspstfDiabetes: { name: 'US Preventive Services Task Force, 2021', url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes' },
  cdcDpp: { name: 'CDC National Diabetes Prevention Program', url: 'https://www.cdc.gov/diabetes-prevention/index.html' },
  medicare: { name: 'Medicare.gov', url: 'https://www.medicare.gov/coverage/yearly-wellness-visits' },
  smokefree: { name: 'Smokefree.gov, US National Cancer Institute', url: 'https://smokefree.gov/' }
};

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const row = (ctx, key) => ctx.labRows.find((r) => r.key === key) || null;
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

/**
 * Up to `limit` follow-up tests. Readings outside their standard come first, then tests
 * that would let a formula be computed.
 * Returns [{ id, name, reasons: [string], adds, where }].
 */
export function followUpTests(ctx, limit = 3) {
  const found = new Map();   // id -> { priority, reasons }
  const add = (id, priority, reason) => {
    if (!id) return;
    const entry = found.get(id) || { priority, reasons: [] };
    entry.priority = Math.min(entry.priority, priority);
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    found.set(id, entry);
  };

  // 1. A reading outside its published standard: repeat it. (Weight and waist are not lab tests.)
  for (const [id, test] of Object.entries(TESTS)) {
    for (const key of test.rows) {
      const r = row(ctx, key);
      if (offStandard(r)) add(id, 1, `Your ${shown(r)} reads "${r.statusLabel.replace(/[▲▼]/g, '').trim()}" against the standard used here.`);
    }
  }
  // 2. A formula that could not be computed: supply what it lists as missing.
  for (const result of ctx.results) {
    if (result.status !== 'missing') continue;
    (result.missing || []).forEach((field, i) => {
      const label = (result.missingLabels || [])[i] || field;
      add(testForField(field), 2, `${result.name} could not be computed without: ${label}.`);
    });
  }
  // 3. Metabolic syndrome count that cannot be settled yet (Taiwan criteria).
  if (ctx.region === 'TW' && ctx.mets && ctx.mets.met === null) {
    add('lipids', 3, `The metabolic syndrome count cannot be settled: ${ctx.mets.missing.join(', ').toLowerCase()} not measured.`);
  }

  return [...found.entries()]
    .sort((a, b) => a[1].priority - b[1].priority)
    .slice(0, limit)
    .map(([id, entry]) => ({ id, name: TESTS[id].name, reasons: entry.reasons, adds: TESTS[id].adds, where: TESTS[id].where[ctx.region] || TESTS[id].where.US }));
}

/* ---------- services ---------- */

// Each service: `rule` is the published eligibility in words; `match(ctx)` returns the
// person's own values that meet it (strings copied from their record), or null.
const SERVICES = {
  TW: [
    {
      id: 'tw-adult-checkup',
      name: 'Free adult health check-up',
      what: 'A government-funded check-up: questionnaire, blood pressure, waist, fasting glucose, lipids, kidney and liver blood tests.',
      rule: 'Ages 30–39 once every 5 years, 40–64 once every 3 years, 65 and over once a year.',
      how: 'Book at a contracted clinic or hospital with your National Health Insurance card.',
      source: SOURCES.hpa,
      match: ({ age }) => (age !== null && age >= 30 ? [`Age ${age}`] : null)
    },
    {
      id: 'tw-mets-program',
      name: 'Metabolic syndrome prevention program',
      what: 'Follow-up visits with a clinic team that sets goals with you for waist, blood pressure, blood sugar and lipids, and tracks them over time.',
      rule: 'Ages 20–69 who meet 3 or more of the 5 metabolic syndrome items.',
      how: 'Ask a participating primary care clinic to enrol you; bring your latest check-up report.',
      source: SOURCES.hpa,
      match: ({ age, mets }) => {
        if (age === null || age < 20 || age > 69 || !mets || mets.met !== true) return null;
        const items = mets.items.filter((i) => i.met === true).map((i) => (i.value === null ? i.label : `${i.label} ${i.value}`));
        return [`Age ${age}`, `${mets.count} of ${mets.of} items met: ${items.join(', ')}`];
      }
    },
    {
      id: 'tw-quit',
      name: 'Quit-smoking services and helpline',
      what: 'Subsidised quit-smoking clinics and free phone counselling.',
      rule: 'Anyone who currently smokes.',
      how: 'Call the Taiwan Smokers\' Helpline on 0800-636363, or ask any contracted clinic or pharmacy.',
      source: SOURCES.tsh,
      match: ({ profile }) => (profile.smoking === 'current' ? ['Smoking: current'] : null)
    }
  ],
  US: [
    {
      id: 'us-diabetes-check',
      name: 'Blood sugar check covered as preventive care',
      what: 'A fasting glucose or HbA1c test. Most health plans cover recommended preventive services without a copay.',
      rule: 'Adults aged 35–70 with a BMI of 25 or more.',
      how: 'Ask your primary care office; confirm coverage with your plan.',
      source: SOURCES.uspstfDiabetes,
      match: ({ age, bmi }) => (age !== null && age >= 35 && age <= 70 && bmi && bmi.n >= 25 ? [`Age ${age}`, bmi.text] : null)
    },
    {
      id: 'us-dpp',
      name: 'National Diabetes Prevention Program',
      what: 'A year-long, CDC-recognised lifestyle change program with a trained coach, in person or online.',
      rule: 'Adults with a BMI of 25 or more (23 or more if Asian American), never told they have diabetes, with a recent blood test in the prediabetes range: HbA1c 5.7–6.4% or fasting glucose 100–125 mg/dL.',
      how: 'Find a recognised program near you through the CDC registry; many employers and health plans cover it.',
      source: SOURCES.cdcDpp,
      match: ({ profile, bmi, labs }) => {
        const a1c = num(labs.hba1cPct), glucose = num(labs.fastingGlucoseMgDl);
        const inRange = [];
        if (a1c !== null && a1c >= 5.7 && a1c <= 6.4) inRange.push(`HbA1c ${a1c}%`);
        if (glucose !== null && glucose >= 100 && glucose <= 125) inRange.push(`Fasting glucose ${glucose} mg/dL`);
        if (!bmi || bmi.n < 25 || profile.diabetes === true || !inRange.length) return null;
        return [bmi.text, ...inRange, 'Diabetes: no'];
      }
    },
    {
      id: 'us-medicare-wellness',
      name: 'Medicare yearly wellness visit',
      what: 'A yearly visit to update a personal prevention plan. It includes a check of memory and thinking.',
      rule: 'People with Medicare Part B for longer than 12 months; most people join Medicare at 65.',
      how: 'Book with a provider who accepts Medicare; there is no cost for the visit itself.',
      source: SOURCES.medicare,
      match: ({ age }) => (age !== null && age >= 65 ? [`Age ${age}`] : null)
    },
    {
      id: 'us-quit',
      name: 'Quitline and Smokefree.gov',
      what: 'Free phone coaching and quit plans.',
      rule: 'Anyone who currently smokes.',
      how: 'Call 1-800-QUIT-NOW (1-800-784-8669).',
      source: SOURCES.smokefree,
      match: ({ profile }) => (profile.smoking === 'current' ? ['Smoking: current'] : null)
    }
  ]
};

/**
 * Services whose published rule the person's own values meet.
 * Returns [{ id, name, what, rule, how, source, matched: [string] }].
 */
export function matchingServices(ctx) {
  const bmiRow = row(ctx, 'bmi');
  const view = {
    ...ctx,
    age: num(ctx.profile.age),
    // BMI comes from the lab reading the engine produced; it is not recomputed here.
    bmi: bmiRow && num(bmiRow.value) !== null ? { n: num(bmiRow.value), text: shown(bmiRow) } : null
  };
  return (SERVICES[ctx.region] || [])
    .map((service) => {
      const matched = service.match(view);
      if (!matched) return null;
      const { match, ...rest } = service;
      return { ...rest, matched };
    })
    .filter(Boolean);
}

export const REGION_NAMES = { TW: 'Taiwan', US: 'United States' };
