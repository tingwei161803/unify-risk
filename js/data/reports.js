// Fictional lab reports for the sample people in js/data/personas.js.
// Every report, clinic and number here is fictional; nothing comes from a real
// record.
//
// Shape of one report: a superset of the "Lab report" in docs/interfaces.md
// ({ date, source, labs }), so an entry can go straight to store.addReport().
//   date      'YYYY-MM-DD', the day of the check-up
//   source    the sample file's name (e.g. 'chen-2026-11.pdf'), or the label
//             'sample-report' when there is no file
//   labs      { <lab key>: value }, the same keys as persona.labs; built from
//             the lab items below
//   id        '<personId>-<YYYY>-<MM>'
//   personId  id in PERSONAS
//   lab       fictional clinic or hospital name
//   type      kind of check-up
//   file      'assets/sample-reports/<id>.pdf', the printed report that report
//             recognition (#6) reads, or null when there is no sample file
//   items     [{ key, label, value, unit, range, flag }]
//             key    a lab key from persona.labs (units in the name) or a
//                    measurement key: heightCm, weightKg, bmi, waistCm, sbp, dbp
//             range  the reference range exactly as the report printed it
//                    ('' when none was printed)
//             flag   as printed: 'H' above the range, 'L' below it, '' inside
//
// Rules
//   - A person's latest report holds the same values as persona.labs (lab
//     keys) and persona.profile (heightCm, weightKg, waistCm, sbp, dbp), and
//     the same printed ranges as persona.report.
//   - reportsFor(personId) returns that person's reports, oldest first.
//
// What the set shows
//   chen   four yearly reports, 2023 to 2026. Weight, waist, blood pressure,
//          glucose and cholesterol rise every year: numbers worsening over time.
//   hsu    one basic blood test with no total cholesterol and no HbA1c: missing
//          lab values, so CAIDE cannot be computed.
//   yang   67 years old: outside the age range of CAIDE (39-64) and FINDRISC
//          (35-64), while FSRP and Chin-Shan still apply.
//   lin, linda, wang, wu, tsai, kao   one recent report each.

const ITEM = {
  heightCm: ['Height', 'cm'],
  weightKg: ['Weight', 'kg'],
  bmi: ['BMI', 'kg/m²'],
  waistCm: ['Waist circumference', 'cm'],
  sbp: ['Systolic blood pressure', 'mmHg'],
  dbp: ['Diastolic blood pressure', 'mmHg'],
  fastingGlucoseMgDl: ['Fasting glucose', 'mg/dL'],
  hba1cPct: ['HbA1c', '%'],
  totalCholMgDl: ['Total cholesterol', 'mg/dL'],
  tgMgDl: ['Triglycerides', 'mg/dL'],
  hdlMgDl: ['HDL cholesterol', 'mg/dL'],
  ldlMgDl: ['LDL cholesterol', 'mg/dL'],
  creatinineMgDl: ['Creatinine', 'mg/dL'],
  egfrMlMin: ['eGFR', 'mL/min/1.73m²'],
  uacrMgG: ['Urine albumin-to-creatinine ratio', 'mg/g'],
  astUL: ['AST (GOT)', 'U/L'],
  altUL: ['ALT (GPT)', 'U/L'],
  plateletsK: ['Platelets', '10³/µL']
};

// Keys that are lab values (persona.labs); the rest of ITEM are measurements.
const LAB_KEYS = new Set([
  'totalCholMgDl', 'hdlMgDl', 'fastingGlucoseMgDl', 'hba1cPct', 'ldlMgDl', 'tgMgDl',
  'creatinineMgDl', 'egfrMlMin', 'uacrMgG', 'astUL', 'altUL', 'plateletsK'
]);

// [key, value, printed range, printed flag] -> { key, label, value, unit, range, flag }
function items(rows) {
  return rows.map(([key, value, range = '', flag = '']) => {
    const [label, unit] = ITEM[key];
    return { key, label, value, unit, range, flag };
  });
}

// Adds the docs/interfaces.md fields: source and labs.
function withLabReportFields(report) {
  return {
    date: report.date,
    source: report.file ? report.file.split('/').pop() : 'sample-report',
    labs: Object.fromEntries(report.items.filter((it) => LAB_KEYS.has(it.key)).map((it) => [it.key, it.value])),
    ...report
  };
}

export const REPORTS = [
  {
    id: 'lin-2026-10',
    personId: 'lin',
    date: '2026-10-15',
    lab: 'Taipei Riverside Clinic (fictional)',
    type: 'Health check (clinic)',
    file: null,
    items: items([
      ['heightCm', 168],
      ['weightKg', 76],
      ['bmi', 26.9, '18.5–24', 'H'],
      ['waistCm', 95, 'men <90', 'H'],
      ['sbp', 148, '<130/85', 'H'],
      ['dbp', 92, '<130/85', 'H'],
      ['fastingGlucoseMgDl', 108, '70–99', 'H'],
      ['hba1cPct', 5.9, '4.0–5.6', 'H'],
      ['totalCholMgDl', 212, '<200', 'H'],
      ['hdlMgDl', 41, 'men ≥40']
    ])
  },
  {
    id: 'linda-2026-09',
    personId: 'linda',
    date: '2026-09-22',
    lab: 'Lakeview Family Medicine, Ohio (fictional)',
    type: 'Annual physical (clinic)',
    file: null,
    items: items([
      ['heightCm', 163],
      ['weightKg', 82],
      ['bmi', 30.9, '18.5–24.9', 'H'],
      ['waistCm', 98, 'women ≤88', 'H'],
      ['sbp', 134, '<120/80', 'H'],
      ['dbp', 84, '<120/80', 'H'],
      ['fastingGlucoseMgDl', 101, '65–99', 'H'],
      ['hba1cPct', 5.7, '<5.7', 'H'],
      ['totalCholMgDl', 228, '<200', 'H'],
      ['hdlMgDl', 52, 'women ≥50']
    ])
  },

  // Mr. Chen: the same hospital every November, numbers worsening year by year.
  {
    id: 'chen-2023-11',
    personId: 'chen',
    date: '2023-11-08',
    lab: 'Taichung Greenfield Hospital (fictional)',
    type: 'Employee health check (hospital)',
    file: 'assets/sample-reports/chen-2023-11.pdf',
    items: items([
      ['heightCm', 168],
      ['weightKg', 69.0],
      ['bmi', 24.4, '18.5–24', 'H'],
      ['waistCm', 88, 'men <90'],
      ['sbp', 128, '<130/85'],
      ['dbp', 82, '<130/85'],
      ['fastingGlucoseMgDl', 94, '70–99'],
      ['hba1cPct', 5.5, '4.0–5.6'],
      ['totalCholMgDl', 196, '<200'],
      ['tgMgDl', 126, '<150'],
      ['hdlMgDl', 50, 'men ≥40'],
      ['ldlMgDl', 121, '<130'],
      ['creatinineMgDl', 0.95, '0.7–1.3'],
      ['egfrMlMin', 91, '≥60'],
      ['uacrMgG', 10, '<30'],
      ['astUL', 22, '≤40'],
      ['altUL', 22, '≤40'],
      ['plateletsK', 238, '150–400']
    ])
  },
  {
    id: 'chen-2024-11',
    personId: 'chen',
    date: '2024-11-06',
    lab: 'Taichung Greenfield Hospital (fictional)',
    type: 'Employee health check (hospital)',
    file: 'assets/sample-reports/chen-2024-11.pdf',
    items: items([
      ['heightCm', 168],
      ['weightKg', 71.2],
      ['bmi', 25.2, '18.5–24', 'H'],
      ['waistCm', 90, 'men <90', 'H'],
      ['sbp', 134, '<130/85', 'H'],
      ['dbp', 85, '<130/85', 'H'],
      ['fastingGlucoseMgDl', 98, '70–99'],
      ['hba1cPct', 5.6, '4.0–5.6'],
      ['totalCholMgDl', 210, '<200', 'H'],
      ['tgMgDl', 144, '<150'],
      ['hdlMgDl', 48, 'men ≥40'],
      ['ldlMgDl', 133, '<130', 'H'],
      ['creatinineMgDl', 0.96, '0.7–1.3'],
      ['egfrMlMin', 89, '≥60'],
      ['uacrMgG', 13, '<30'],
      ['astUL', 23, '≤40'],
      ['altUL', 24, '≤40'],
      ['plateletsK', 235, '150–400']
    ])
  },
  {
    id: 'chen-2025-11',
    personId: 'chen',
    date: '2025-11-05',
    lab: 'Taichung Greenfield Hospital (fictional)',
    type: 'Employee health check (hospital)',
    file: 'assets/sample-reports/chen-2025-11.pdf',
    items: items([
      ['heightCm', 168],
      ['weightKg', 73.4],
      ['bmi', 26.0, '18.5–24', 'H'],
      ['waistCm', 92, 'men <90', 'H'],
      ['sbp', 140, '<130/85', 'H'],
      ['dbp', 89, '<130/85', 'H'],
      ['fastingGlucoseMgDl', 102, '70–99', 'H'],
      ['hba1cPct', 5.8, '4.0–5.6', 'H'],
      ['totalCholMgDl', 224, '<200', 'H'],
      ['tgMgDl', 162, '<150', 'H'],
      ['hdlMgDl', 46, 'men ≥40'],
      ['ldlMgDl', 146, '<130', 'H'],
      ['creatinineMgDl', 0.98, '0.7–1.3'],
      ['egfrMlMin', 87, '≥60'],
      ['uacrMgG', 17, '<30'],
      ['astUL', 23, '≤40'],
      ['altUL', 26, '≤40'],
      ['plateletsK', 233, '150–400']
    ])
  },
  {
    id: 'chen-2026-11',
    personId: 'chen',
    date: '2026-11-06',
    lab: 'Taichung Greenfield Hospital (fictional)',
    type: 'Self-paid health check (hospital)',
    file: 'assets/sample-reports/chen-2026-11.pdf',
    items: items([
      ['heightCm', 168],
      ['weightKg', 75.6],
      ['bmi', 26.8, '18.5–24', 'H'],
      ['waistCm', 94, 'men <90', 'H'],
      ['sbp', 146, '<130/85', 'H'],
      ['dbp', 92, '<130/85', 'H'],
      ['fastingGlucoseMgDl', 106, '70–99', 'H'],
      ['hba1cPct', 5.9, '4.0–5.6', 'H'],
      ['totalCholMgDl', 238, '<200', 'H'],
      ['tgMgDl', 180, '<150', 'H'],
      ['hdlMgDl', 44, 'men ≥40'],
      ['ldlMgDl', 158, '<130', 'H'],
      ['creatinineMgDl', 1.0, '0.7–1.3'],
      ['egfrMlMin', 83, '≥60'],
      ['uacrMgG', 22, '<30'],
      ['astUL', 24, '≤40'],
      ['altUL', 28, '≤40'],
      ['plateletsK', 230, '150–400']
    ])
  },

  {
    id: 'wang-2026-11',
    personId: 'wang',
    date: '2026-11-04',
    lab: 'Tainan Lotus Family Clinic (fictional)',
    type: 'Health check (clinic)',
    file: 'assets/sample-reports/wang-2026-11.pdf',
    items: items([
      ['heightCm', 158],
      ['weightKg', 56],
      ['bmi', 22.4, '18.5–24'],
      ['waistCm', 76, 'women <80'],
      ['sbp', 128, '<130/85'],
      ['dbp', 82, '<130/85'],
      ['fastingGlucoseMgDl', 98, '70–99'],
      ['hba1cPct', 5.8, '4.0–5.6', 'H'],
      ['totalCholMgDl', 252, '<200', 'H'],
      ['tgMgDl', 110, '<150'],
      ['hdlMgDl', 62, 'women ≥50'],
      ['ldlMgDl', 168, '<130', 'H'],
      ['creatinineMgDl', 0.68, '0.5–1.1'],
      ['egfrMlMin', 100, '≥60'],
      ['astUL', 22, '≤40'],
      ['altUL', 18, '≤40']
    ])
  },
  {
    id: 'wu-2026-11',
    personId: 'wu',
    date: '2026-11-07',
    lab: 'Kaohsiung Harborside Hospital (fictional)',
    type: 'Self-paid health check (hospital)',
    file: 'assets/sample-reports/wu-2026-11.pdf',
    items: items([
      ['heightCm', 170],
      ['weightKg', 81.2],
      ['bmi', 28.1, '18.5–24', 'H'],
      ['waistCm', 98, 'men <90', 'H'],
      ['sbp', 138, '<130/85', 'H'],
      ['dbp', 88, '<130/85', 'H'],
      ['fastingGlucoseMgDl', 118, '70–99', 'H'],
      ['hba1cPct', 6.1, '4.0–5.6', 'H'],
      ['totalCholMgDl', 225, '<200', 'H'],
      ['tgMgDl', 236, '<150', 'H'],
      ['hdlMgDl', 35, 'men ≥40', 'L'],
      ['ldlMgDl', 143, '<130', 'H'],
      ['creatinineMgDl', 1.1, '0.7–1.3'],
      ['egfrMlMin', 76, '≥60'],
      ['uacrMgG', 26, '<30'],
      ['astUL', 52, '≤40', 'H'],
      ['altUL', 71, '≤40', 'H'],
      ['plateletsK', 160, '150–400']
    ])
  },
  {
    id: 'tsai-2026-11',
    personId: 'tsai',
    date: '2026-11-05',
    lab: 'Taipei Maple Hospital (fictional)',
    type: 'Self-paid health check (hospital)',
    file: 'assets/sample-reports/tsai-2026-11.pdf',
    items: items([
      ['heightCm', 155],
      ['weightKg', 66.3],
      ['bmi', 27.6, '18.5–24', 'H'],
      ['waistCm', 86, 'women <80', 'H'],
      ['sbp', 134, '<130/85', 'H'],
      ['dbp', 84, '<130/85'],
      ['fastingGlucoseMgDl', 104, '70–99', 'H'],
      ['hba1cPct', 6.0, '4.0–5.6', 'H'],
      ['totalCholMgDl', 228, '<200', 'H'],
      ['tgMgDl', 160, '<150', 'H'],
      ['hdlMgDl', 50, 'women ≥50'],
      ['ldlMgDl', 146, '<130', 'H'],
      ['creatinineMgDl', 1.08, '0.5–1.1'],
      ['egfrMlMin', 58, '≥60', 'L'],
      ['uacrMgG', 48, '<30', 'H'],
      ['astUL', 21, '≤40'],
      ['altUL', 19, '≤40'],
      ['plateletsK', 255, '150–400']
    ])
  },
  {
    id: 'kao-2026-11',
    personId: 'kao',
    date: '2026-11-08',
    lab: 'Hsinchu Bamboo Hill Hospital (fictional)',
    type: 'Self-paid health check (hospital)',
    file: 'assets/sample-reports/kao-2026-11.pdf',
    items: items([
      ['heightCm', 172],
      ['weightKg', 70.7],
      ['bmi', 23.9, '18.5–24'],
      ['waistCm', 88, 'men <90'],
      ['sbp', 132, '<130/85', 'H'],
      ['dbp', 78, '<130/85'],
      ['fastingGlucoseMgDl', 102, '70–99', 'H'],
      ['hba1cPct', 5.7, '4.0–5.6', 'H'],
      ['totalCholMgDl', 214, '<200', 'H'],
      ['tgMgDl', 130, '<150'],
      ['hdlMgDl', 47, 'men ≥40'],
      ['ldlMgDl', 141, '<130', 'H'],
      ['creatinineMgDl', 0.95, '0.7–1.3'],
      ['egfrMlMin', 91, '≥60'],
      ['uacrMgG', 12, '<30'],
      ['astUL', 25, '≤40'],
      ['altUL', 27, '≤40'],
      ['plateletsK', 245, '150–400']
    ])
  },

  // Ms. Hsu: a basic blood test only. No lipid panel (so no total cholesterol)
  // and no HbA1c.
  {
    id: 'hsu-2026-10',
    personId: 'hsu',
    date: '2026-10-28',
    lab: 'Taoyuan Community Health Station (fictional)',
    type: 'Basic blood test (community health station)',
    file: null,
    items: items([
      ['heightCm', 160],
      ['weightKg', 63.0],
      ['bmi', 24.6, '18.5–24', 'H'],
      ['waistCm', 82, 'women <80', 'H'],
      ['sbp', 136, '<130/85', 'H'],
      ['dbp', 84, '<130/85'],
      ['fastingGlucoseMgDl', 101, '70–99', 'H'],
      ['creatinineMgDl', 0.74, '0.5–1.1'],
      ['egfrMlMin', 92, '≥60'],
      ['astUL', 20, '≤40'],
      ['altUL', 17, '≤40']
    ])
  },

  // Mr. Yang: 67, a full adult preventive check.
  {
    id: 'yang-2026-10',
    personId: 'yang',
    date: '2026-10-21',
    lab: 'Changhua Orchard Hospital (fictional)',
    type: 'Adult preventive health check (hospital)',
    file: null,
    items: items([
      ['heightCm', 165],
      ['weightKg', 68.0],
      ['bmi', 25.0, '18.5–24', 'H'],
      ['waistCm', 91, 'men <90', 'H'],
      ['sbp', 142, '<130/85', 'H'],
      ['dbp', 86, '<130/85', 'H'],
      ['fastingGlucoseMgDl', 104, '70–99', 'H'],
      ['hba1cPct', 5.8, '4.0–5.6', 'H'],
      ['totalCholMgDl', 221, '<200', 'H'],
      ['tgMgDl', 150, '<150', 'H'],
      ['hdlMgDl', 46, 'men ≥40'],
      ['ldlMgDl', 145, '<130', 'H'],
      ['creatinineMgDl', 1.05, '0.7–1.3'],
      ['egfrMlMin', 78, '≥60'],
      ['uacrMgG', 18, '<30'],
      ['astUL', 26, '≤40'],
      ['altUL', 24, '≤40'],
      ['plateletsK', 210, '150–400']
    ])
  }
].map(withLabReportFields);

export function reportsFor(personId) {
  return REPORTS.filter((r) => r.personId === personId).sort((a, b) => a.date.localeCompare(b.date));
}
