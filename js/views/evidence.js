// Evidence page (#33): has each formula been checked in people like you?
// Draws js/data/evidence.js only. Every status, ratio, count and paper on this page comes
// from that file; the words below only explain what the codes mean.
//
// Rows: the formulas in the signed-in person's results (same order as the results page),
// plus every other formula in the evidence table behind a toggle.
// Columns: the population rows, the person's own groups first and highlighted.

import { STATUS, POPULATIONS, EVIDENCE } from '../data/evidence.js';
import { getPersona } from '../data/personas.js';

const CHECKED = new Set(['D', 'V', 'R', 'C', 'P']);

// Short word shown in each square; the full STATUS label is in the details and the legend.
const SHORT = {
  D: 'Built here',
  V: 'Checked: fits',
  R: 'Re-tuned version',
  C: 'Ranking only',
  P: 'Checked: off',
  G: 'No check found',
  N: 'Does not apply'
};

// Plain-language meaning of each status, for the legend and the details.
const PLAIN = {
  D: 'The formula was built on people from this group.',
  V: 'Studies tested it in this group, and its percentages matched what happened.',
  R: 'A version re-tuned for this group exists.',
  C: 'Studies tested only how well it separates higher from lower risk. Whether its percentages fit this group is unknown.',
  P: 'Studies tested it in this group, and its percentages did not match what happened.',
  G: 'No published check in this group was found, so its numbers may not fit people from this group.',
  N: 'The formula does not apply to this group.'
};

const DIRECTION = {
  over: 'It predicted more cases than happened.',
  under: 'It predicted fewer cases than happened.',
  'mixed-over': 'Studies disagree; on balance it predicted more cases than happened.',
  'mixed-under': 'Studies disagree; on balance it predicted fewer cases than happened.'
};

const PLACE = { TW: 'Taiwan', US: 'the US', EU: 'Europe', JP: 'Japan', UK: 'the UK', CN: 'China', KR: 'Korea' };

const MODEL_COUNT = Object.keys(EVIDENCE).length;
const POP_LABEL = Object.fromEntries(POPULATIONS.map((p) => [p.id, p.label]));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/** The person's population rows: the sample person's own, else Taiwan plus the sex row; age rows added from the answers. */
function personGroups(record) {
  const persona = getPersona(record.personaId);
  const profile = record.profile || {};
  const ids = persona && Array.isArray(persona.populationIds) ? [...persona.populationIds] : ['tw'];
  if (!persona) {
    if (profile.sex === 'female') ids.push('women');
    if (profile.sex === 'male') ids.push('men');
  }
  const age = Number(profile.age);
  if (age >= 65 && !ids.includes('65plus')) ids.push('65plus');
  if (age >= 80 && !ids.includes('80plus')) ids.push('80plus');
  return ids.filter((id, i) => POP_LABEL[id] && ids.indexOf(id) === i);
}

function cellOf(modelId, popId) {
  const model = EVIDENCE[modelId];
  return (model && model.cells && model.cells[popId]) || null;
}

function codeOf(cell) {
  return cell && STATUS[cell.status] ? cell.status : 'G';
}

function builtIn(row) {
  if (row.derivedIn) return `Built in ${PLACE[row.derivedIn] || row.derivedIn}`;
  return row.disease ? `${row.disease[0].toUpperCase()}${row.disease.slice(1)}` : '';
}

function badge(code) {
  const tone = STATUS[code].tone;
  const span = el('span', `ev-badge ev-${tone}`);
  span.append(el('b', 'ev-letter', code), el('span', 'ev-word', SHORT[code]));
  return span;
}

function summarySentence(rows, popId) {
  let checked = 0;
  let gaps = 0;
  let na = 0;
  for (const row of rows) {
    const code = codeOf(cellOf(row.id, popId));
    if (CHECKED.has(code)) checked += 1;
    else if (code === 'N') na += 1;
    else gaps += 1;
  }
  const total = rows.length;
  const of = total === 1 ? 'formula' : 'formulas';
  const lead = `${POP_LABEL[popId]}: ${checked} of your ${total} ${of} ${checked === 1 ? 'has' : 'have'} been built or checked in this group; `;
  const gapText = `${gaps} ${gaps === 1 ? 'has' : 'have'} no validation found.`;
  const tail = na ? ` ${na} ${na === 1 ? 'does' : 'do'} not apply.` : '';
  return { lead, gapText, tail, gaps };
}

function details(panel, row, popId) {
  const cell = cellOf(row.id, popId);
  const code = codeOf(cell);
  panel.replaceChildren();
  panel.append(el('h2', null, `${row.name} · ${POP_LABEL[popId]}`));
  const status = el('p', 'ev-detail-status');
  status.append(badge(code), ' ', el('strong', null, STATUS[code].label));
  panel.append(status, el('p', null, PLAIN[code]));

  const facts = el('ul', 'plain-list');
  if (cell && Number.isFinite(cell.oe)) {
    let line = `Observed ÷ expected cases: ${cell.oe}`;
    if (Array.isArray(cell.oeCi) && cell.oeCi.length === 2) line += ` (95% range ${cell.oeCi[0]}–${cell.oeCi[1]})`;
    line += '. 1 means the formula got it right; below 1 it over-estimated, above 1 it under-estimated.';
    facts.append(el('li', null, line));
    if (cell.oeFrom) facts.append(el('li', 'muted', `That figure comes from the ${cell.oeFrom}.`));
  }
  if (cell && DIRECTION[cell.direction]) facts.append(el('li', null, DIRECTION[cell.direction]));
  if (cell && Number.isFinite(cell.c)) {
    facts.append(el('li', null, `How well it separates higher from lower risk (C-statistic): ${cell.c}. 0.5 is a coin flip; 1 is perfect.`));
  }
  const counts = [];
  if (cell && Number.isFinite(cell.studies)) counts.push(`${cell.studies} ${cell.studies === 1 ? 'study' : 'studies'}`);
  if (cell && Number.isFinite(cell.events)) counts.push(`${cell.events} outcome events`);
  if (counts.length) facts.append(el('li', null, `Based on ${counts.join(' and ')}.`));
  if (facts.children.length) panel.append(facts);

  if (cell && cell.doi) {
    const p = el('p');
    const link = el('a', null, 'Read the paper');
    link.href = `https://doi.org/${cell.doi}`;
    link.target = '_blank';
    link.rel = 'noopener';
    p.append(link, el('span', 'muted', ` (doi ${cell.doi})`));
    panel.append(p);
  } else if (code === 'G') {
    panel.append(el('p', 'muted', 'No paper is listed for this group in the team’s evidence table.'));
  }
}

function legend() {
  const box = el('div', 'card');
  box.append(el('h2', null, 'What the squares mean'));
  const dl = el('dl', 'ev-legend');
  for (const code of Object.keys(STATUS)) {
    const dt = el('dt');
    dt.append(badge(code));
    dl.append(dt, el('dd', null, `${STATUS[code].label}. ${PLAIN[code]}`));
  }
  box.append(dl);
  return box;
}

function injectStyles() {
  if (document.getElementById('ev-styles')) return;
  const style = document.createElement('style');
  style.id = 'ev-styles';
  style.textContent = `
.ev-summary { margin: 0 0 6px; }
.ev-gap-text { color: #a3221b; }
.ev-scroll { overflow-x: auto; max-width: 100%; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); margin: 8px 0 16px; }
.ev-table { border-collapse: separate; border-spacing: 0; font-size: 0.85rem; min-width: 100%; }
.ev-table th, .ev-table td { padding: 6px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
.ev-table thead th { font-weight: 600; white-space: nowrap; background: var(--surface); }
.ev-table thead th.ev-yours { background: #ddf0ee; color: #0b5f5a; }
.ev-table thead th small { display: block; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
.ev-table td.ev-yours { background: #f1f8f7; }
.ev-rowhead { position: sticky; left: 0; z-index: 1; background: var(--surface); min-width: 190px; max-width: 240px; border-right: 1px solid var(--line); }
.ev-rowhead .ev-name { font-weight: 600; display: block; }
.ev-rowhead .ev-built { color: var(--muted); font-size: 0.78rem; }
.ev-sep th { background: var(--bg); color: var(--muted); font-weight: 600; position: sticky; left: 0; }
.ev-cell { font: inherit; display: block; width: 100%; min-width: 112px; padding: 0; margin: 0; border: 0; background: none; cursor: pointer; text-align: left; border-radius: 8px; }
.ev-cell:focus-visible { outline: 3px solid var(--accent); outline-offset: 1px; }
.ev-cell[aria-pressed="true"] .ev-badge { box-shadow: 0 0 0 2px var(--ink); }
.ev-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 999px; border: 1px solid transparent; white-space: nowrap; color: var(--ev-c); background: var(--ev-bg); }
.ev-letter { display: inline-grid; place-items: center; width: 1.35em; height: 1.35em; border-radius: 50%; background: var(--ev-c); color: #fff; font-size: 0.75rem; }
.ev-good { --ev-c: #1b5e33; --ev-bg: #e3f2e8; }
.ev-accent { --ev-c: #0b5f5a; --ev-bg: #ddf0ee; }
.ev-neutral { --ev-c: #4a545b; --ev-bg: #eceeef; }
.ev-warn { --ev-c: #7a4206; --ev-bg: #fcebd2; }
.ev-gap { --ev-c: #a3221b; --ev-bg: #fff; border: 2px solid #c0392b; font-weight: 700; }
.ev-mute { --ev-c: #5d6870; --ev-bg: #f3f3f1; }
.ev-detail { min-height: 120px; }
.ev-detail h2 { margin-top: 0; }
.ev-detail-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ev-legend { display: grid; grid-template-columns: max-content 1fr; gap: 8px 14px; margin: 8px 0 0; align-items: center; }
.ev-legend dd { margin: 0; }
@media print {
  .ev-scroll { overflow: visible; border: 0; }
  .ev-controls { display: none; }
}
@media (max-width: 640px) {
  .ev-legend { grid-template-columns: 1fr; }
  .ev-legend dd { margin-bottom: 8px; }
  .ev-rowhead { min-width: 150px; max-width: 170px; }
}`;
  document.head.append(style);
}

export function render(root, ctx) {
  injectStyles();
  const record = ctx.store.get();
  const persona = getPersona(record.personaId);
  const groups = personGroups(record);
  const results = ctx.runAll({ profile: record.profile || {}, labs: record.labs || {} });

  // The person's formulas, in the results-page order, then every other formula in the table.
  const seen = new Set();
  const mine = [];
  for (const r of results) {
    const id = r.modelId;
    if (!EVIDENCE[id] || seen.has(id)) continue;
    seen.add(id);
    mine.push({ id, name: r.name || EVIDENCE[id].name, derivedIn: r.derivedIn, disease: EVIDENCE[id].disease });
  }
  const others = Object.values(EVIDENCE)
    .filter((m) => !seen.has(m.id))
    .map((m) => ({ id: m.id, name: m.name, derivedIn: null, disease: m.disease }));
  const columns = [...groups, ...POPULATIONS.map((p) => p.id).filter((id) => !groups.includes(id))];

  let showAll = false;
  let selected = null; // { row, popId }

  root.replaceChildren();
  root.append(
    el('h1', null, 'Has this formula been checked in people like you?'),
    el('p', 'lead', 'Each formula was built on one group of people. This page shows, for the formulas in your results, whether published studies have checked them in other groups, and how well they did.'),
    el('p', 'muted', 'Not a diagnosis. Not medical advice.')
  );

  const who = el('p');
  const groupNames = groups.map((id) => POP_LABEL[id]).join(', ');
  who.append(el('strong', null, persona ? `For ${persona.name}. ` : 'For you. '), `Your groups: ${groupNames || 'none set'}.`);
  root.append(who);

  for (const popId of groups) {
    const { lead, gapText, tail, gaps } = summarySentence(mine, popId);
    const p = el('p', 'ev-summary');
    p.append(lead, el('strong', gaps ? 'ev-gap-text' : null, gapText), tail);
    root.append(p);
  }

  const controls = el('div', 'row ev-controls');
  const toggle = el('button', 'btn secondary');
  toggle.type = 'button';
  controls.append(toggle, el('span', 'muted', 'Select any square to see the studies behind it.'));
  root.append(controls);

  const scroll = el('div', 'ev-scroll');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Validation matrix');
  scroll.tabIndex = 0;
  root.append(scroll);

  const panel = el('div', 'card ev-detail');
  panel.setAttribute('aria-live', 'polite');
  panel.append(el('p', 'muted', 'Select a square in the table to see the ratio of observed to expected cases, how well the formula ranks people, the number of studies and a link to the paper.'));
  root.append(panel);

  root.append(legend());

  root.append(el('p', 'muted', `Source: the team’s calibration matrix of published studies (${MODEL_COUNT} formulas × ${POPULATIONS.length} population rows). Squares backed by a study link to a representative paper.`));
  const back = el('div', 'row');
  const resultsLink = el('a', 'btn secondary', 'Back to results');
  resultsLink.href = '#/results';
  back.append(resultsLink);
  root.append(back);

  function select(row, popId, button) {
    selected = { row, popId };
    for (const b of scroll.querySelectorAll('.ev-cell[aria-pressed="true"]')) b.setAttribute('aria-pressed', 'false');
    if (button) button.setAttribute('aria-pressed', 'true');
    details(panel, row, popId);
  }

  function drawRow(tbody, row) {
    const tr = el('tr');
    const th = el('th', 'ev-rowhead');
    th.scope = 'row';
    th.append(el('span', 'ev-name', row.name), el('span', 'ev-built', builtIn(row)));
    tr.append(th);
    for (const popId of columns) {
      const code = codeOf(cellOf(row.id, popId));
      const td = el('td', groups.includes(popId) ? 'ev-yours' : null);
      const button = el('button', 'ev-cell');
      button.type = 'button';
      button.setAttribute('aria-pressed', selected && selected.row.id === row.id && selected.popId === popId ? 'true' : 'false');
      button.setAttribute('aria-label', `${row.name}, ${POP_LABEL[popId]}: ${STATUS[code].label}`);
      button.append(badge(code));
      button.addEventListener('click', () => select(row, popId, button));
      button.addEventListener('focus', () => select(row, popId, button));
      td.append(button);
      tr.append(td);
    }
    tbody.append(tr);
  }

  function drawTable() {
    toggle.textContent = showAll ? 'Show only your formulas' : `Show all ${MODEL_COUNT} formulas`;
    toggle.setAttribute('aria-expanded', String(showAll));
    const table = el('table', 'ev-table');
    const caption = el('caption', 'muted', 'Rows: formulas. Columns: groups of people. Your groups come first and are highlighted.');
    caption.style.textAlign = 'left';
    caption.style.padding = '8px';
    table.append(caption);
    const thead = el('thead');
    const head = el('tr');
    const corner = el('th', 'ev-rowhead', 'Formula');
    corner.scope = 'col';
    head.append(corner);
    for (const popId of columns) {
      const th = el('th', groups.includes(popId) ? 'ev-yours' : null);
      th.scope = 'col';
      if (groups.includes(popId)) th.append(el('small', null, 'Your group'));
      th.append(POP_LABEL[popId]);
      head.append(th);
    }
    thead.append(head);
    table.append(thead);

    const tbody = el('tbody');
    if (!mine.length) {
      const tr = el('tr');
      const td = el('td', 'muted', 'None of your results has a row in the evidence table yet.');
      td.colSpan = columns.length + 1;
      tr.append(td);
      tbody.append(tr);
    }
    for (const row of mine) drawRow(tbody, row);
    if (showAll) {
      const sep = el('tr', 'ev-sep');
      const th = el('th', null, `Other formulas in the evidence table (${others.length})`);
      th.colSpan = columns.length + 1;
      th.scope = 'colgroup';
      sep.append(th);
      tbody.append(sep);
      for (const row of others) drawRow(tbody, row);
    }
    table.append(tbody);
    scroll.replaceChildren(table);
  }

  toggle.addEventListener('click', () => { showAll = !showAll; drawTable(); });
  drawTable();
}
