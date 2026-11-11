// Offline generator for js/data/evidence.js. Not loaded by the app.
//
// Reads the team's calibration matrix (gap-matrix-v2.csv, compiled from published
// validation studies) and writes one ES module with the
// validation status of every stroke, dementia and type 2 diabetes formula in 18
// population rows. Every number comes from the CSV; nothing is typed in by hand.
//
//   node tools/build-evidence.mjs <gap-matrix-v2.csv> [model-lab-requirement.csv] > js/data/evidence.js
// Both files are tables the team compiled from published papers
// (the second one in tools/). Without the second file every model gets lab: '?'.

import { readFileSync } from 'node:fs';

const csvPath = process.argv[2];
const labPath = process.argv[3];
if (!csvPath) {
  console.error('usage: node tools/build-evidence.mjs <gap-matrix-v2.csv>');
  process.exit(1);
}

// RFC 4180 parser: quoted fields may hold commas, quotes and newlines.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, j) => [h, r[j] ?? ''])));
}

const DISEASES = { '中風': 'stroke', '失智': 'dementia', '第二型糖尿病': 'diabetes' };

const POPULATIONS = [
  ['us-white', '美國白人', 'US White'],
  ['us-black', '美國非裔', 'US Black'],
  ['us-hispanic', '美國西語裔', 'US Hispanic'],
  ['asian-american', '亞裔美國人', 'Asian American'],
  ['tw', '華人（臺灣）', 'Taiwan'],
  ['cn', '華人（中國）', 'China'],
  ['hk-sg', '華人（香港／新加坡）', 'Hong Kong / Singapore'],
  ['jp', '日本', 'Japan'],
  ['kr', '韓國', 'Korea'],
  ['south-asia', '南亞', 'South Asia'],
  ['europe', '歐洲（北／南）', 'Europe'],
  ['latam', '拉美', 'Latin America'],
  ['africa', '非洲', 'Africa'],
  ['middle-east', '中東', 'Middle East'],
  ['women', '女', 'Women'],
  ['men', '男', 'Men'],
  ['65plus', '65+', 'Age 65+'],
  ['80plus', '80+', 'Age 80+']
];
const POP_ID = Object.fromEntries(POPULATIONS.map(([id, zh]) => [zh, id]));

// English display names for matrix columns whose name is not already English.
const NAMES = {
  '修訂 FSRP': 'Revised FSRP',
  'Chien 2010 金山中風模型': 'Chin-Shan stroke (Chien 2010)',
  'China-PAR 中風': 'China-PAR (stroke)',
  'PCE（中風結局）': 'PCE (stroke outcome)',
  'QRISK3（中風結局）': 'QRISK3 (stroke outcome)',
  'REGARDS 自評模型': 'REGARDS self-report model',
  'Suita 中風分數': 'Suita stroke score',
  '中國「8+2」腦中風風險評分': 'China "8+2" stroke risk score',
  'ADA 自評分數（Bang 2009）': 'ADA risk test (Bang 2009)',
  'Chien 2008 金山糖尿病模型': 'Chin-Shan diabetes (Chien 2008)',
  'Framingham 糖尿病（Wilson 2007）': 'Framingham Offspring diabetes (Wilson 2007)',
  'IDRS（印度）': 'IDRS (India)',
  'San Antonio 糖尿病模型': 'San Antonio diabetes model',
  'QDScore／QDiabetes-2017': 'QDScore / QDiabetes-2017',
  '久山町（Hisayama）失智方程式': 'Hisayama dementia equation',
  'Li 2018 臺灣糖尿病者失智分數': 'Li 2018 dementia score (Taiwanese adults with diabetes)',
  'Rotterdam BDRM（Licher）': 'Rotterdam BDRM (Licher)'
};

// Stable ids for the formulas the engine implements in round 1.
const IDS = {
  '修訂 FSRP': 'fsrp',
  'Chien 2010 金山中風模型': 'chin-shan-stroke',
  'FINDRISC': 'findrisc',
  'CAIDE': 'caide'
};

const DIRECTION = {
  '高估': 'over',
  '低估': 'under',
  '各篇不一致（合併／代表值：高估）': 'mixed-over',
  '各篇不一致（合併／代表值：低估）': 'mixed-under'
};

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function num(s) {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

// '單篇' | 'DL 合併 3 篇（95% CI 0.29–3.42）' | '取事件數最多一篇（共 2 篇）'
function oeMethod(s) {
  if (!s) return null;
  if (s === '單篇') return { pooled: false, studies: 1 };
  let m = s.match(/DL 合併 (\d+) 篇（95% CI ([\d.]+)–([\d.]+)）/);
  if (m) return { pooled: true, studies: +m[1], ciLow: +m[2], ciHigh: +m[3] };
  m = s.match(/取事件數最多一篇（共 (\d+) 篇）/);
  if (m) return { pooled: false, studies: +m[1], largestOnly: true };
  throw new Error('unknown theta_method: ' + s);
}

const hasCjk = (s) => /[　-鿿＀-￯]/.test(s);

const rows = parseCsv(readFileSync(csvPath, 'utf8').replace(/^﻿/, ''))
  .filter((r) => DISEASES[r.disease]);

const LAB = {};
if (labPath) {
  for (const r of parseCsv(readFileSync(labPath, 'utf8').replace(/^﻿/, ''))) {
    if (!'NYB?'.includes(r.lab) || r.lab.length !== 1) throw new Error('unknown lab code: ' + r.lab);
    LAB[r.column_id] = r.lab;
  }
}

const models = {};
for (const r of rows) {
  const name = NAMES[r.model] || r.model;
  if (hasCjk(name)) throw new Error('add an English name for: ' + r.model);
  const id = IDS[r.model] || slug(name);
  const popId = POP_ID[r.population];
  if (!popId) throw new Error('unknown population: ' + r.population);

  const model = (models[id] ||= { id, name, disease: DISEASES[r.disease], lab: LAB[r.column_id] || '?', cells: {} });
  if (model.name !== name) throw new Error('id clash: ' + id);

  if (!'DVRCPGNUS'.includes(r.status) || r.status.length !== 1) throw new Error('unknown status: ' + r.status);
  const cell = { status: r.status };
  if (!'GNUS'.includes(r.status)) {
    const oe = num(r.theta_oe);
    if (oe !== null) {
      const m = oeMethod(r.theta_method);
      cell.oe = oe;
      if (m.ciLow !== undefined) cell.oeCi = [m.ciLow, m.ciHigh];
      cell.oeFrom = m.pooled ? `pooled, ${m.studies} studies` : m.studies > 1 ? `largest of ${m.studies} studies` : 'single study';
      if (DIRECTION[r.direction]) cell.direction = DIRECTION[r.direction];
    }
    const c = num(r.c_used);
    if (c !== null) cell.c = c;
    const k = num(r.k_studies);
    if (k) cell.studies = k;
    const ev = num(r.total_events);
    if (ev) cell.events = Math.round(ev);
    if (r.rep_doi) cell.doi = r.rep_doi.trim();
  }
  model.cells[popId] = cell;
}

const list = Object.values(models);
for (const m of list) {
  if (Object.keys(m.cells).length !== POPULATIONS.length) throw new Error('missing rows for ' + m.id);
}

const counts = {};
for (const m of list) for (const c of Object.values(m.cells)) counts[c.status] = (counts[c.status] || 0) + 1;

const out = `// GENERATED by tools/build-evidence.mjs from the team's calibration matrix
// (gap-matrix-v2.csv). Do not edit by hand; re-run the generator instead.
//
// Where has each published formula been checked, and how well did it do?
// ${list.length} stroke, dementia and type 2 diabetes formulas x ${POPULATIONS.length} population rows.
// Status counts: ${Object.entries(counts).map(([k, v]) => k + ' ' + v).join(', ')}.
//
// Cell fields (all optional except status):
//   status     one of STATUS below
//   oe         observed / expected events (theta). 1 = right on; <1 the formula
//              over-estimates in this group; >1 it under-estimates.
//   oeCi       95% CI of oe when several studies were pooled (DerSimonian-Laird)
//   oeFrom     where oe comes from: single study, pooled, or largest study
//   direction  'over' | 'under' | 'mixed-over' | 'mixed-under' (studies disagree;
//              the pooled or representative value leans this way)
//   c          C-statistic (discrimination; 0.5 = coin flip, 1 = perfect)
//   studies    number of studies behind this cell
//   events     outcome events behind the calibration figure
//   doi        representative paper
//
// Model fields: id, name, disease, lab ('N' questionnaire only | 'Y' needs a lab
// report | 'B' clinical and lab versions | '?' unconfirmed), cells.

export const STATUS = {
  D: { label: 'Developed in this group', tone: 'good' },
  V: { label: 'Validated, calibration acceptable', tone: 'good' },
  R: { label: 'Recalibrated version exists', tone: 'accent' },
  C: { label: 'Only discrimination reported', tone: 'neutral' },
  P: { label: 'Checked, poorly calibrated', tone: 'warn' },
  G: { label: 'No validation found', tone: 'gap' },
  N: { label: 'Not applicable', tone: 'mute' },
  U: { label: 'Not stratified in the papers', tone: 'mute' },
  S: { label: 'Single-sex model', tone: 'mute' }
};

export const POPULATIONS = ${JSON.stringify(POPULATIONS.map(([id, , label]) => ({ id, label })), null, 2)};

export const EVIDENCE = ${JSON.stringify(Object.fromEntries(list.map((m) => [m.id, m])), null, 2)};

export function getEvidence(modelId, populationId) {
  const m = EVIDENCE[modelId];
  return m ? m.cells[populationId] || null : null;
}
`;

process.stdout.write(out);
