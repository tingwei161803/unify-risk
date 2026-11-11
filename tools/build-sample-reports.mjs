// Offline generator for the fictional sample lab reports in assets/sample-reports/.
// Not part of the app: run it by hand when the sample data changes.
//
//   node tools/build-sample-reports.mjs [--data-dir js/data] [--keep-html <dir>] [--only id,id]
//
// Source of the numbers
//   1. js/data/reports.js (REPORTS) when it exists: every report with a `file`
//      path is rendered from its own items (value, unit, printed range, flag).
//   2. Otherwise each persona's `report` in js/data/personas.js is rendered as
//      that person's latest report: profile measurements + labs + the printed
//      ranges. Flags are worked out from the printed range.
//   Nothing else is added: a section with no values says "Not included in this
//   check-up", and no test, value or range is invented here.
//
// Output (paths are relative to the repo root)
//   <file> from REPORTS, or assets/sample-reports/<id>.pdf for persona reports
//   plus the PNG extras listed in PNG_EXTRAS below
//
// Rendering uses headless Chrome (--print-to-pdf and --screenshot). Set CHROME
// to the binary if it is not in the default macOS location.
//
// Every person, clinic and value in these files is fictional.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Options

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
}
const DATA_DIR = resolve(ROOT, args['data-dir'] || 'js/data');
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find((p) => existsSync(p));

// One report gets the two-column layout; two get a PNG copy as well as the PDF.
const LAYOUT = { 'wang-2026-11': 'two-column' };
const PNG_EXTRAS = {
  'chen-2026-11': 'clean',   // a straight PNG of the printed page
  'tsai-2026-11': 'photo'    // looks like a phone photo: tilted, shadow, off-white paper
};
// Fictional clinic names; used when the report itself does not name one.
const CLINIC_BY_PERSON = {
  chen: 'Demo Health Check Center, Taichung',
  wang: 'Demo Family Clinic, Tainan',
  wu: 'Demo Health Check Center, Kaohsiung',
  tsai: 'Demo Health Check Center, Taipei',
  kao: 'Demo Health Check Center, Hsinchu'
};

// ---------------------------------------------------------------------------
// Test catalogue: label, unit, decimals printed, section

const TESTS = {
  heightCm: { label: 'Height', unit: 'cm', dp: 1 },
  weightKg: { label: 'Weight', unit: 'kg', dp: 1 },
  bmi: { label: 'Body mass index (BMI)', unit: 'kg/m²', dp: 1 },
  waistCm: { label: 'Waist circumference', unit: 'cm', dp: 0 },
  sbp: { label: 'Systolic blood pressure', unit: 'mmHg', dp: 0 },
  dbp: { label: 'Diastolic blood pressure', unit: 'mmHg', dp: 0 },
  fastingGlucoseMgDl: { label: 'Fasting glucose', unit: 'mg/dL', dp: 0 },
  hba1cPct: { label: 'HbA1c', unit: '%', dp: 1 },
  totalCholMgDl: { label: 'Total cholesterol', unit: 'mg/dL', dp: 0 },
  tgMgDl: { label: 'Triglycerides', unit: 'mg/dL', dp: 0 },
  hdlMgDl: { label: 'HDL cholesterol', unit: 'mg/dL', dp: 0 },
  ldlMgDl: { label: 'LDL cholesterol', unit: 'mg/dL', dp: 0 },
  creatinineMgDl: { label: 'Creatinine', unit: 'mg/dL', dp: 2 },
  egfrMlMin: { label: 'eGFR', unit: 'mL/min/1.73m²', dp: 0 },
  uacrMgG: { label: 'Urine albumin/creatinine ratio (UACR)', unit: 'mg/g', dp: 0 },
  astUL: { label: 'AST (GOT)', unit: 'U/L', dp: 0 },
  altUL: { label: 'ALT (GPT)', unit: 'U/L', dp: 0 },
  plateletsK: { label: 'Platelets', unit: '10³/µL', dp: 0 }
};
const SECTIONS = [
  ['Body measurements', ['heightCm', 'weightKg', 'bmi', 'waistCm']],
  ['Blood pressure', ['sbp', 'dbp']],
  ['Blood sugar', ['fastingGlucoseMgDl', 'hba1cPct']],
  ['Lipids', ['totalCholMgDl', 'tgMgDl', 'hdlMgDl', 'ldlMgDl']],
  ['Kidney', ['creatinineMgDl', 'egfrMlMin', 'uacrMgG']],
  ['Liver', ['astUL', 'altUL']],
  ['Blood count', ['plateletsK']]
];
const MEASUREMENTS = ['heightCm', 'weightKg', 'bmi', 'waistCm', 'sbp', 'dbp'];

// ---------------------------------------------------------------------------
// Data

const { PERSONAS } = await import(pathToFileURL(join(DATA_DIR, 'personas.js')).href);
const personById = new Map(PERSONAS.map((p) => [p.id, p]));
const reportsFile = join(DATA_DIR, 'reports.js');
let reports;
let source;
if (existsSync(reportsFile)) {
  reports = (await import(pathToFileURL(reportsFile).href)).REPORTS.filter((r) => r.file);
  source = 'js/data/reports.js';
} else {
  reports = PERSONAS.filter((p) => p.report && p.report.date).map(reportFromPersona);
  source = 'js/data/personas.js (each persona\'s latest report)';
}
if (ONLY) reports = reports.filter((r) => ONLY.has(r.id));

function reportFromPersona(p) {
  const pr = p.report.printedRanges || {};
  const values = {
    heightCm: p.profile.heightCm,
    weightKg: p.profile.weightKg,
    bmi: p.profile.heightCm && p.profile.weightKg ? Math.round((p.profile.weightKg / (p.profile.heightCm / 100) ** 2) * 10) / 10 : undefined,
    waistCm: p.profile.waistCm,
    sbp: p.profile.sbp,
    dbp: p.profile.dbp,
    ...p.labs
  };
  const items = Object.keys(TESTS)
    .filter((key) => typeof values[key] === 'number')
    .map((key) => ({
      key,
      label: TESTS[key].label,
      value: values[key],
      unit: TESTS[key].unit,
      range: pr[key] || '',
      flag: flagFromRange(key, values[key], pr[key] || '')
    }));
  const id = `${p.id}-${p.report.date.slice(0, 7)}`;
  return { id, personId: p.id, date: p.report.date, type: p.report.type || 'Health check', lab: null, file: `assets/sample-reports/${id}.pdf`, items };
}

// 'H' above / 'L' below the printed range; '' inside it or when there is no range.
function flagFromRange(key, value, range) {
  const r = range.replace(/^(men|women)\s+/i, '').trim();
  let m;
  if ((m = r.match(/^<\s*([\d.]+)\s*\/\s*([\d.]+)$/))) {
    const limit = key === 'dbp' ? Number(m[2]) : Number(m[1]);
    return value >= limit ? 'H' : '';
  }
  if ((m = r.match(/^([\d.]+)\s*[–-]\s*([\d.]+)$/))) return value < Number(m[1]) ? 'L' : value > Number(m[2]) ? 'H' : '';
  if ((m = r.match(/^<\s*([\d.]+)$/))) return value >= Number(m[1]) ? 'H' : '';
  if ((m = r.match(/^≤\s*([\d.]+)$/))) return value > Number(m[1]) ? 'H' : '';
  if ((m = r.match(/^>\s*([\d.]+)$/))) return value <= Number(m[1]) ? 'L' : '';
  if ((m = r.match(/^≥\s*([\d.]+)$/))) return value < Number(m[1]) ? 'L' : '';
  return '';
}

// ---------------------------------------------------------------------------
// HTML

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function fmt(item) {
  const t = TESTS[item.key];
  return t ? Number(item.value).toFixed(t.dp) : String(item.value);
}

function ageAt(person, date) {
  // Persona age is the age at the latest report; older reports count back by year.
  const latest = person.report && person.report.date ? Number(person.report.date.slice(0, 4)) : Number(date.slice(0, 4));
  return person.profile.age - (latest - Number(date.slice(0, 4)));
}

function chartNo(id) {
  let h = 0;
  for (const c of id.split('-')[0]) h = (h * 31 + c.charCodeAt(0)) % 100000;
  return `DEMO-${String(h).padStart(5, '0')}`;
}

function sectionHtml(title, keys, byKey, wide) {
  const rows = keys.filter((k) => byKey.has(k)).map((k) => {
    const it = byKey.get(k);
    const flag = it.flag === 'H' ? '<span class="flag">H ▲</span>' : it.flag === 'L' ? '<span class="flag">L ▼</span>' : '';
    return `<tr><td>${esc(it.label || (TESTS[k] && TESTS[k].label) || k)}</td><td class="num${it.flag ? ' out' : ''}">${esc(fmt(it))}</td>` +
      `<td>${esc(it.unit || (TESTS[k] && TESTS[k].unit) || '')}</td><td>${esc(it.range || '—')}</td><td class="fl">${flag}</td></tr>`;
  });
  const body = rows.length ? rows.join('') : '<tr><td colspan="5" class="none">Not included in this check-up</td></tr>';
  return `<section class="block"><h2>${esc(title)}</h2><table><colgroup><col class="c-test"><col class="c-res"><col class="c-unit"><col class="c-range"><col class="c-flag"></colgroup><thead><tr><th>Test</th><th class="num">Result</th><th>Unit</th><th>${wide ? 'Ref. range' : 'Reference range'}</th><th class="fl">Flag</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

function pageHtml(report, layout) {
  const person = personById.get(report.personId);
  if (!person) throw new Error(`No persona for ${report.personId}`);
  const byKey = new Map(report.items.map((it) => [it.key, it]));
  const known = new Set(SECTIONS.flatMap(([, keys]) => keys));
  const other = report.items.filter((it) => !known.has(it.key)).map((it) => it.key);
  const wide = layout === 'two-column';
  const sections = SECTIONS.map(([t, keys]) => sectionHtml(t, keys, byKey, wide));
  if (other.length) sections.push(sectionHtml('Other', other, byKey, wide));
  const clinic = report.lab || CLINIC_BY_PERSON[report.personId] || 'Demo Health Check Center';
  const sex = person.profile.sex === 'female' ? 'Female' : 'Male';
  const body = layout === 'two-column'
    ? `<div class="cols"><div>${sections.slice(0, 3).join('')}</div><div>${sections.slice(3).join('')}</div></div>`
    : sections.join('');
  const page = `<article class="page${layout === 'two-column' ? ' wide' : ''}">
  <p class="band">FICTIONAL SAMPLE — not a real person</p>
  <header class="head">
    <div><p class="clinic">${esc(clinic)}</p><p class="sub">Fictional clinic · sample document for the unify-risk demo</p></div>
    <div class="doc"><h1>Health Check Report</h1><p class="sub">${esc(report.type || 'Health check')}</p></div>
  </header>
  <dl class="who">
    <div><dt>Name</dt><dd>${esc(person.name)}</dd></div>
    <div><dt>Sex / Age</dt><dd>${sex} / ${ageAt(person, report.date)}</dd></div>
    <div><dt>Chart no.</dt><dd>${chartNo(report.id)}</dd></div>
    <div><dt>Report date</dt><dd>${esc(report.date)}</dd></div>
  </dl>
  ${body}
  <footer class="foot">
    <p>Flag: H ▲ above the printed reference range · L ▼ below it. Reference ranges are those printed by this fictional clinic.</p>
    <p class="fic">FICTIONAL SAMPLE — not a real person, not a real clinic, not a real result. Report ${esc(report.id)}.</p>
  </footer>
</article>`;
  const scene = layout === 'photo' ? `<div class="desk"><div class="paper">${page}</div></div>` : page;
  return `<!doctype html>
<html lang="en" data-reading-scale-opt-out="Print document: a fixed-size A4 mock lab report rendered to PDF and PNG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Health check report · ${esc(person.name)} · ${esc(report.date)} (fictional sample)</title>
<style>
:root { --bg: #ffffff; --paper: #fbfaf6; --text: #1b2128; --muted: #4f5964; --line: #c6ccd3; --rule: #1f5f8b; --accent: #1f5f8b; --flag: #a4231b; --mark: rgba(164, 35, 27, 0.11); }
* { box-sizing: border-box; }
html { color-scheme: light; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: "Helvetica Neue", Arial, sans-serif; font-size: 12.5px; line-height: 1.35; }
.page { position: relative; width: 210mm; max-width: 100%; min-height: 296mm; margin: 0 auto; padding: 12mm 14mm 10mm; background: var(--paper); overflow: hidden; }
.page::before, .page::after { content: "FICTIONAL SAMPLE — not a real person"; position: absolute; left: -12%; width: 124%; text-align: center; transform: rotate(-24deg); font-size: 40px; font-weight: 700; letter-spacing: 0.06em; color: var(--mark); pointer-events: none; z-index: 2; }
.page::before { top: 30%; }
.page::after { top: 68%; }
.band { margin: 0 0 6px; padding: 3px 8px; border: 1px solid var(--flag); color: var(--flag); font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-align: center; }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--rule); }
.clinic { margin: 0; font-size: 16px; font-weight: 700; color: var(--accent); }
.sub { margin: 2px 0 0; color: var(--muted); font-size: 11px; }
.doc { text-align: right; }
h1 { margin: 0; font-size: 20px; letter-spacing: 0.02em; }
.who { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px; margin: 10px 0 8px; padding: 8px 10px; border: 1px solid var(--line); }
.who dt { color: var(--muted); font-size: 10.5px; }
.who dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.block { margin-top: 9px; break-inside: avoid; }
h2 { margin: 0 0 3px; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.c-test { width: 41%; } .c-res { width: 12%; } .c-unit { width: 17%; } .c-range { width: 20%; } .c-flag { width: 10%; }
.wide .c-test { width: 33%; } .wide .c-res { width: 13%; } .wide .c-unit { width: 25%; } .wide .c-range { width: 18%; } .wide .c-flag { width: 11%; }
.wide table { font-size: 11px; } .wide td, .wide th { padding: 3px 4px; }
td { overflow-wrap: anywhere; } .fl, .flag { white-space: nowrap; }
th { text-align: left; font-size: 10.5px; color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--line); padding: 3px 6px; }
td { padding: 3.5px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
td.num { font-weight: 600; }
td.out { color: var(--flag); }
.fl { text-align: center; }
.flag { color: var(--flag); font-weight: 700; }
.none { color: var(--muted); font-style: italic; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.foot { margin-top: 14px; padding-top: 6px; border-top: 1px solid var(--line); color: var(--muted); font-size: 10.5px; }
.foot p { margin: 2px 0; }
.fic { color: var(--flag); font-weight: 600; }
.desk { min-height: 100vh; padding: 46px 0 60px; background: radial-gradient(ellipse at 40% 30%, #6d6255 0%, #4a4038 70%, #3a322b 100%); }
.paper { width: 210mm; max-width: 92%; margin: 0 auto; transform: rotate(-2.2deg); box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45); filter: blur(0.25px) brightness(0.97); }
.desk .page { background: #f4efe2; }
@page { size: A4; margin: 0; }
@media print { body { background: none; } .page { width: 210mm; min-height: 296mm; } }
@media (max-width: 700px) { .page { padding: 18px 14px; min-height: 0; } table { font-size: 11.5px; } td, th { padding: 3px 4px; } .c-test { width: 35%; } .c-res { width: 15%; } .c-unit { width: 18%; } .c-range { width: 20%; } .c-flag { width: 12%; } .who { grid-template-columns: 1fr 1fr; } .cols { grid-template-columns: 1fr; } .head { flex-direction: column; align-items: flex-start; } .doc { text-align: left; } }
</style>
</head>
<body>
${scene}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Render

function chrome(argsList) {
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', ...argsList], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`Chrome failed (${r.status}): ${r.stderr}`);
}

if (!CHROME) {
  console.error('Chrome not found: set CHROME=/path/to/chrome');
  process.exit(2);
}
const work = args['keep-html'] ? resolve(String(args['keep-html'])) : mkdtempSync(join(tmpdir(), 'sample-reports-'));
mkdirSync(work, { recursive: true });
const profileDir = mkdtempSync(join(tmpdir(), 'sample-reports-chrome-'));
const written = [];

for (const report of reports) {
  const layout = LAYOUT[report.id] || 'standard';
  const file = report.file.replace(/\.(png|pdf)$/i, '');
  mkdirSync(dirname(join(ROOT, file)), { recursive: true });
  const htmlPath = join(work, `${report.id}.html`);
  writeFileSync(htmlPath, pageHtml(report, layout));
  const url = pathToFileURL(htmlPath).href;
  const wantPng = /\.png$/i.test(report.file) ? (PNG_EXTRAS[report.id] || 'clean') : PNG_EXTRAS[report.id];
  // Always print the PDF so every report has one; add the PNG when listed.
  chrome([`--user-data-dir=${profileDir}`, '--no-pdf-header-footer', '--print-to-pdf-no-header', `--print-to-pdf=${join(ROOT, file + '.pdf')}`, url]);
  written.push(`${file}.pdf  (${layout})`);
  if (wantPng) {
    const pngHtml = join(work, `${report.id}.${wantPng}.html`);
    writeFileSync(pngHtml, pageHtml(report, wantPng === 'photo' ? 'photo' : layout));
    const size = wantPng === 'photo' ? '940,1240' : '794,1123';
    const scale = wantPng === 'photo' ? '1.25' : '1.5';
    chrome([`--user-data-dir=${profileDir}`, `--force-device-scale-factor=${scale}`, `--window-size=${size}`, `--screenshot=${join(ROOT, file + '.png')}`, pathToFileURL(pngHtml).href]);
    written.push(`${file}.png  (${wantPng})`);
  }
}

rmSync(profileDir, { recursive: true, force: true });
if (!args['keep-html']) rmSync(work, { recursive: true, force: true });
console.log(`Source: ${source}`);
console.log(`Wrote ${written.length} files:\n  ${written.join('\n  ')}`);
