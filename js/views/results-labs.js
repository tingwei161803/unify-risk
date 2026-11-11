// Where you stand now: a person's measurements and lab values, each read against a published
// reference standard, followed by the count for Taiwan's metabolic syndrome criteria.
//
// Every value, reading, sentence, cut-off and source comes from the formula engine:
// interpretLabs(person) and metabolicSyndrome(person) in js/engine/run.js. This view only lays
// them out. The one thing it counts is how many rows fall under each reading.
//
// labsSection(person) returns one <section> for the results page, or null when there is nothing
// to show: no values yet, or an engine that does not have the lab readings yet.

import { h } from './inputs.js';
// Optional: the lab readings arrive with the formula engine. Until then this section is simply absent.
const run = await import('../engine/run.js').catch(() => null);

const CLOSING = 'A reading against a reference standard describes one measurement. Not a diagnosis. Not medical advice.';
// details.more inside a table cell: no divider above it, and the body lines up under the summary text.
const MORE = { style: { 'border-top': 'none', 'padding-top': '0', 'margin-top': '4px' } };
const MORE_BODY = { style: { gap: '4px', padding: '6px 0 2px 20px' } };

/* ---------------- helpers ---------------- */

function isObject(v) { return v !== null && typeof v === 'object'; }
/** Engine text or number as text, exactly as given; anything else (null, an object) becomes ''. */
function text(v) {
  if (typeof v === 'string') return v.trim();
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}
/** 'very-high' -> 'Very high', for a row that arrives without its statusLabel. */
function capitalised(word) { return (word.charAt(0).toUpperCase() + word.slice(1)).replace(/-/g, ' '); }
function toneOf(status) {
  if (status === 'normal') return 'good';
  if (status === 'borderline' || status === 'low') return 'warn';
  return status === 'high' || status === 'very-high' ? 'bad' : 'mute';
}
/** Run `build`; a failure leaves that part out instead of taking the results page down. */
function attempt(build) {
  try { return build(); } catch (e) { console.warn('results-labs:', e); return null; }
}

/* ---------------- summary: how many rows fall under each reading ---------------- */

function countPills(rows) {
  const count = (...statuses) => rows.filter((r) => statuses.includes(r.status)).length;
  const pills = [
    [count('normal'), 'within range', 'good'],
    [count('borderline'), 'borderline', 'warn'],
    [count('high', 'very-high'), 'high', 'bad'],
    [count('low'), 'low', 'warn']
  ].filter(([n]) => n > 0);
  if (!pills.length) return null;
  return h('div.row', { role: 'group', 'aria-label': 'Summary of readings' },
    pills.map(([n, word, tone]) => h('span.pill.plain.' + tone, n + ' ' + word)));
}

/* ---------------- tables: one row per value ---------------- */

function readingRow(r) {
  const label = text(r.label) || text(r.key) || 'Value';
  const explanation = text(r.explanation), standard = text(r.standard), source = text(r.source);
  const value = (r.key === 'hba1cPct' || r.key === 'creatinineMgDl') && Number.isInteger(r.value) ? r.value.toFixed(1) : text(r.value);
  const unit = text(r.unit), category = text(r.category), status = text(r.status);
  const reading = text(r.statusLabel) || capitalised(status);
  // the category is left out when it only repeats the word on the pill ('Normal' after 'Normal')
  const repeats = category.toLowerCase() === reading.replace(/[^a-z ]/gi, '').trim().toLowerCase();
  return h('tr',
    h('td',
      h('div', label),
      explanation ? h('div.small', explanation) : null,
      standard || source ? h('details.more', MORE,
        // the hidden words give each of the many identical summaries its own name for assistive technology
        h('summary', { style: { 'font-size': '12.5px' } }, 'Standard and source', h('span.sr', ' for ' + label)),
        h('div.stack', MORE_BODY,
          standard ? h('p.small', standard) : null,
          source ? h('p.small', 'Source: ' + source) : null)) : null),
    h('td.n', value || '—', value && unit ? h('span.small', ' ' + unit) : null),
    h('td', h('div.row', { style: { gap: '4px 8px' } },
      reading ? h('span.pill.plain.' + toneOf(status), reading) : null,
      category && !repeats ? h('span.small', category) : null)));
}

function readingsTable(title, rows) {
  if (!rows.length) return null;
  return h('div.stack', { style: { 'margin-top': '20px', gap: '8px' } },
    h('h3', title),
    h('div.tbl-wrap', h('table.tbl', { 'aria-label': title },
      h('thead', h('tr',
        h('th', { scope: 'col' }, 'Item'),
        h('th.n', { scope: 'col' }, 'Your value'),
        // a fixed share keeps this column in the same place in both tables, with a row open or closed
        h('th', { scope: 'col', style: { width: '30%' } }, 'Reading'))),
      h('tbody', rows.map(readingRow)))));
}

/* ---------------- metabolic syndrome: Taiwan criteria, counted by the engine ---------------- */

// The word carries the meaning; the mark in front of it is decoration.
function metPill(met) {
  const [tone, mark, word] = met === true ? ['warn', '✓', 'met'] : met === false ? ['mute', '–', 'not met'] : ['gap', '?', 'not measured'];
  return h('span.pill.plain.' + tone, h('span', { 'aria-hidden': 'true' }, mark + ' '), word);
}

function metRow(it) {
  const cutoff = text(it.cutoff);
  return h('tr',
    h('td', metPill(it.met)),
    h('td', text(it.label)),
    h('td.n', text(it.value) || '—'),
    h('td', cutoff ? h('span.small.dim', cutoff) : null));
}

function metsPanel(m) {
  if (!isObject(m)) return null;
  const items = (Array.isArray(m.items) ? m.items : []).filter(isObject);
  if (!items.some((it) => it.met === true || it.met === false)) return null;
  const count = text(m.count), total = text(m.of), explanation = text(m.explanation), source = text(m.source);
  return h('div.panel.stack', { style: { 'margin-top': '20px' } },
    h('div',
      h('h3', 'Metabolic syndrome (Taiwan criteria)' + (count && total ? ': ' + count + ' of ' + total + ' items met' : '')),
      explanation ? h('p.small', explanation) : null),
    h('div.tbl-wrap', h('table.tbl', { 'aria-label': 'Metabolic syndrome items' },
      h('thead', h('tr',
        h('th', { scope: 'col' }, 'Met?'),
        h('th', { scope: 'col' }, 'Item'),
        h('th.n', { scope: 'col' }, 'Your value'),
        h('th', { scope: 'col' }, 'Met when'))),
      h('tbody', items.map(metRow)))),
    source ? h('p.small.dim', 'Source: ' + source) : null);
}

/* ---------------- section ---------------- */

/** The "Where you stand now" section for a person ({ profile, labs }), or null when there is nothing to show. */
export function labsSection(person) {
  if (!person || !run || typeof run.interpretLabs !== 'function') return null;
  return attempt(() => {
    const raw = run.interpretLabs(person);
    const rows = (Array.isArray(raw) ? raw : []).filter(isObject);
    if (!rows.length) return null;
    // A failure in the metabolic syndrome count drops that panel only.
    const mets = typeof run.metabolicSyndrome === 'function' ? attempt(() => metsPanel(run.metabolicSyndrome(person))) : null;
    return h('section',
      h('div.sec-head',
        h('span.micro', 'Where you stand now'),
        h('h2', 'Your measurements and lab values, read against published standards'),
        h('p.sub', 'One reading is a snapshot, not a condition. Every line names the standard it was read against.')),
      countPills(rows),
      readingsTable('Measurements', rows.filter((r) => r.group === 'measurement')),
      readingsTable('Blood and urine tests', rows.filter((r) => r.group !== 'measurement')),
      mets,
      h('p.small.dim', { style: { 'margin-top': '16px' } }, CLOSING));
  });
}
