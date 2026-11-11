// Evidence: where each published formula has been checked, by group of people, and the check
// table that re-computes the examples printed in each paper.
//
// Rows are formulas, columns are groups. A dashed cell is a gap: no published validation found.
// The data comes from js/data/evidence.js (generated; this view only reads it).

import { h, mount, disclaimer, focusHeading, regionOf } from './inputs.js';
import { EVIDENCE, POPULATIONS, STATUS } from '../data/evidence.js';
import { PERSONAS } from '../data/personas.js';

// Optional: the formula engine's own checks. The page works without them.
const engine = await import('../engine/index.js').catch(() => null);

const DISEASE_LABEL = { stroke: 'Stroke', dementia: 'Dementia', diabetes: 'Type 2 diabetes' };
const DISEASE_ORDER = ['stroke', 'dementia', 'diabetes'];
const TONE_CLASS = { good: 'good', accent: 'accent', warn: 'warn', gap: 'gap', neutral: 'mute', mute: 'mute' };
// First formula ids in the app (docs/interfaces.md); used until the engine lists its own.
const FIRST_FORMULAS = ['fsrp', 'chin-shan-stroke', 'findrisc', 'caide'];

// What each status means in plain words, shown in a cell's details.
const PLAIN = {
  D: 'The formula was built on people from this group.',
  V: 'Studies tested it in this group, and its percentages matched what happened.',
  R: 'A version re-tuned for this group exists.',
  C: 'Studies tested only how well it separates higher from lower risk. Whether its percentages fit this group is unknown.',
  P: 'Studies tested it in this group, and its percentages did not match what happened.',
  N: 'The formula does not apply to this group.'
};
const DIRECTION = {
  over: 'It predicted more cases than happened.',
  under: 'It predicted fewer cases than happened.',
  'mixed-over': 'Studies disagree; on balance it predicted more cases than happened.',
  'mixed-under': 'Studies disagree; on balance it predicted fewer cases than happened.'
};
// Statuses that count as "built or checked in this group".
const CHECKED = new Set(['D', 'V', 'R', 'C', 'P']);

let showAll = false;      // false: only the formulas this app computes
let picked = null;        // { formulaId, populationId } of the cell whose details are open
// Three switches, as on our evidence heat map: which disease, which groups of people, and
// whether the formula needs a lab report (the `lab` field of js/data/evidence.js).
let onlyDisease = 'all';  // 'all' | 'stroke' | 'dementia' | 'diabetes'
let onlyGroups = 'all';   // 'all' | 'place' (populations) | 'sexage' (sex and age rows)
let onlyLab = 'all';      // 'all' | 'none' (no lab report needed) | 'lab' (lab report needed)
const SEX_AGE = new Set(['women', 'men', '65plus', '80plus']);

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
// Our value at the precision the paper prints (0.0099, not 0.01); full precision when a check fails.
function likePrinted(c) {
  if (!isNum(c.actual) || !isNum(c.expected) || !c.pass) return String(c.actual);
  const s = String(c.expected), digits = s.includes('.') ? s.length - 1 - s.indexOf('.') : 0;
  return c.actual.toFixed(digits);
}
function num(x, digits) { return isNum(x) ? String(Number(x.toFixed(digits))) : '—'; }

// Every formula the app can compute: the engine's first ones and the ones it gives on request.
// This page counts them all, whichever way the switch on the results page is set.
function everyFormula() {
  const list = engine ? (Array.isArray(engine.ALL_FORMULAS) ? engine.ALL_FORMULAS : engine.FORMULAS) : null;
  return Array.isArray(list) ? list : [];
}

function appFormulaIds() {
  // score-only formulas give no estimate and get no result card (the engine keeps them out of runAll)
  const every = everyFormula();
  const ids = every.length ? every.filter((f) => f.kind !== 'score').map((f) => f.id) : FIRST_FORMULAS;
  return ids.filter((id) => EVIDENCE[id]);
}

// The columns that describe the person on screen: where they live, their sex, their age band.
function personColumns(state) {
  const profile = state.profile || {};
  const persona = PERSONAS.find((p) => p.id === state.personaId) || null;
  // The answer to "Where do you live?" wins; without one, a sample person's own place is used.
  // Sex and age band always come from the answers, so a changed answer moves the highlight.
  const answered = state.region !== undefined && state.region !== null && state.region !== '';
  const ids = persona && (!answered || state.region === persona.region) && Array.isArray(persona.populationIds)
    ? persona.populationIds.filter((id) => !['women', 'men', '65plus', '80plus'].includes(id)) : [];
  if (!ids.length && regionOf(state) === 'TW') ids.push('tw');
  if (profile.sex === 'female') ids.push('women');
  if (profile.sex === 'male') ids.push('men');
  if (Number(profile.age) >= 80) ids.push('80plus'); else if (Number(profile.age) >= 65) ids.push('65plus');
  return { persona, ids: new Set(ids) };
}

function counts(entries) {
  const total = { cells: 0, gaps: 0 };
  entries.forEach((e) => POPULATIONS.forEach((pop) => {
    const cell = e.cells[pop.id];
    if (!cell || cell.status === 'N') return;
    total.cells += 1;
    if (cell.status === 'G') total.gaps += 1;
  }));
  return total;
}

function cellDetails(entry, pop) {
  const cell = entry.cells[pop.id] || {};
  const st = STATUS[cell.status];
  const url = cell.doi && /^10\.\S+$/.test(cell.doi) ? 'https://doi.org/' + cell.doi : null;
  const facts = [
    isNum(cell.oe) ? ['Observed / expected', num(cell.oe, 2) + (Array.isArray(cell.oeCi) ? ' (95% CI ' + num(cell.oeCi[0], 2) + ' to ' + num(cell.oeCi[1], 2) + ')' : '')
      + (cell.oeFrom ? ', ' + cell.oeFrom : '')] : null,
    isNum(cell.c) ? ['C-statistic: how well it separates higher from lower risk (0.5 is a coin flip, 1 is perfect)', num(cell.c, 2)] : null,
    isNum(cell.studies) ? ['Studies', String(cell.studies)] : null,
    isNum(cell.events) ? ['Outcome events', cell.events.toLocaleString('en-US')] : null
  ].filter(Boolean);
  return h('div.panel.tight', { id: 'ev-detail', role: 'region', 'aria-label': 'Selected cell' },
    h('div.row.between',
      h('h3', entry.name + ' · ' + pop.label),
      st ? h('span.pill.plain.' + (TONE_CLASS[st.tone] || 'mute'), h('span.code', cell.status), st.label) : null),
    PLAIN[cell.status] ? h('p.small', { style: { 'margin-top': '8px' } }, PLAIN[cell.status]) : null,
    // Not for V: "its percentages matched" followed by "it predicted fewer cases" reads as a contradiction.
    cell.status !== 'V' && DIRECTION[cell.direction] ? h('p.small', { style: { 'margin-top': '4px' } }, DIRECTION[cell.direction]) : null,
    facts.length ? h('div.tbl-wrap', { style: { 'margin-top': '10px' } }, h('table.tbl', h('tbody',
      facts.map(([k, v]) => h('tr', h('td', k), h('td.n', v)))))) : null,
    cell.status === 'G' ? h('p.small', { style: { 'margin-top': '8px' } },
      'No published study was found that checks this formula in this group, so its estimate here is unchecked.') : null,
    isNum(cell.oe) ? h('p.small.dim', { style: { 'margin-top': '8px' } },
      'Observed / expected: 1 means the formula was right on; below 1 it over-estimated in this group, above 1 it under-estimated.') : null,
    url ? h('p.small', { style: { 'margin-top': '8px' } }, h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Open the paper (doi:' + cell.doi + ')')) : null);
}

// One sentence per group that describes the person, counted over the formulas this app computes.
function groupSummaries(appEntries, mine) {
  if (!appEntries.length) return null;
  const lines = POPULATIONS.filter((pop) => mine.has(pop.id)).map((pop) => {
    let checked = 0, gaps = 0, na = 0;
    appEntries.forEach((e) => {
      const code = (e.cells[pop.id] || {}).status;
      if (CHECKED.has(code)) checked += 1; else if (code === 'N') na += 1; else gaps += 1;
    });
    const total = appEntries.length;
    return h('li', h('strong', pop.label + ': '),
      checked + ' of the ' + total + (total === 1 ? ' formula' : ' formulas') + ' in this app ' + (checked === 1 ? 'has' : 'have')
      + ' been built or checked in this group; ' + gaps + (gaps === 1 ? ' has' : ' have') + ' no validation found.'
      + (na ? ' ' + na + (na === 1 ? ' does' : ' do') + ' not apply.' : ''));
  });
  return lines.length ? h('ul.plain-list', { 'aria-label': 'Summary for the groups that describe you' }, lines) : null;
}

// The formulas and the groups the three switches leave on screen. A formula with both a clinical
// and a lab version ('B') counts on both sides of the lab switch; an unconfirmed one ('?') only under All.
function shownEntries(entries) {
  return entries.filter((e) => (onlyDisease === 'all' || e.disease === onlyDisease)
    && (onlyLab === 'all' || (onlyLab === 'none' ? e.lab === 'N' || e.lab === 'B' : e.lab === 'Y' || e.lab === 'B')));
}
function shownPopulations() {
  return POPULATIONS.filter((pop) => onlyGroups === 'all' || (onlyGroups === 'sexage') === SEX_AGE.has(pop.id));
}

function switches(shown, redraw) {
  const seg = (label, key, value, options, set) => h('div.row', { style: { gap: '8px' } },
    h('span.small', label),
    h('div.seg', { role: 'group', 'aria-label': label }, options.map(([v, text]) =>
      h('button' + (value === v ? '.on' : ''), { type: 'button', 'data-key': 'sw-' + key + '-' + v, 'aria-pressed': String(value === v),
        onclick: () => { set(v); picked = null; redraw(); } }, text))));
  return h('div.row', { style: { gap: '10px 24px', 'margin-bottom': '12px' } },
    seg('Disease', 'disease', onlyDisease, [['all', 'All'], ['stroke', 'Stroke'], ['dementia', 'Dementia'], ['diabetes', 'Type 2 diabetes']], (v) => { onlyDisease = v; }),
    seg('Groups', 'groups', onlyGroups, [['all', 'All'], ['place', 'Populations'], ['sexage', 'Sex and age']], (v) => { onlyGroups = v; }),
    seg('Lab report', 'lab', onlyLab, [['all', 'All'], ['none', 'Not needed'], ['lab', 'Needed']], (v) => { onlyLab = v; }),
    h('span.small.dim', shown + (shown === 1 ? ' formula shown' : ' formulas shown')));
}

function matrix(entries, pops, mine, redraw) {
  const head = h('tr', h('th', { scope: 'col' }, h('span.sr', 'Formula')), pops.map((pop) =>
    h('th.col' + (mine.has(pop.id) ? '.you' : ''), { scope: 'col' }, h('span', pop.label + (mine.has(pop.id) ? ' (you)' : '')))));
  const bodies = [];
  DISEASE_ORDER.forEach((disease) => {
    const group = entries.filter((e) => e.disease === disease);
    if (!group.length) return;
    const body = [h('tr.grp', h('th', { colspan: String(pops.length + 1), scope: 'rowgroup' }, DISEASE_LABEL[disease] || disease))];
    group.forEach((entry) => body.push(h('tr',
      h('th.rowh', { scope: 'row' }, entry.name),
      pops.map((pop) => {
        const cell = entry.cells[pop.id] || {}, st = STATUS[cell.status] || { tone: 'mute', label: 'Not reviewed' };
        const on = picked && picked.formulaId === entry.id && picked.populationId === pop.id;
        return h('td' + (mine.has(pop.id) ? '.you' : ''), h('button.cell.' + (TONE_CLASS[st.tone] || 'mute') + (on ? '.on' : ''),
          { type: 'button', 'aria-pressed': String(Boolean(on)), 'aria-label': entry.name + ', ' + pop.label + ': ' + st.label,
            title: entry.name + ', ' + pop.label + ': ' + st.label,
            'data-key': entry.id + '|' + pop.id, 'aria-describedby': on ? 'ev-detail' : null,
            onclick: () => { picked = on ? null : { formulaId: entry.id, populationId: pop.id }; redraw(); } },
          cell.status === 'G' ? '' : cell.status || ''));
      }))));
    bodies.push(h('tbody', body));
  });
  return h('div.tbl-wrap.matrix-wrap', h('table.matrix',
    { 'aria-label': 'Where each formula has been checked, by group of people' }, h('thead', head), bodies));
}

function legend() {
  return h('div.legend', Object.keys(STATUS).map((code) =>
    h('span', h('span.cell.' + (TONE_CLASS[STATUS[code].tone] || 'mute'), { 'aria-hidden': 'true' }, code === 'G' ? '' : code), STATUS[code].label)));
}

function checksTable(redraw) {
  if (!engine || typeof engine.runChecks !== 'function') {
    return h('p.small.dim', 'The check table appears here once the formula engine is connected.');
  }
  let checks = [];
  try { checks = engine.runChecks(); } catch (e) { return h('div.callout.warn', 'The checks could not be run: ' + String(e && e.message ? e.message : e)); }
  if (!Array.isArray(checks)) checks = [];
  // Only the formulas the pages show. The engine also holds formulas that are not shown yet, and
  // many of their checks are our own recomputation, not an example printed in a paper.
  const shown = Array.isArray(engine.FORMULAS) ? new Set(engine.FORMULAS.map((f) => f.id)) : null;
  if (shown) checks = checks.filter((c) => shown.has(c.formulaId));
  const passed = checks.filter((c) => c.pass).length;
  const name = (id) => (EVIDENCE[id] ? EVIDENCE[id].name : id);
  return h('div.stack',
    h('div.row.between',
      h('p', h('strong', passed + ' of ' + checks.length), ' printed examples reproduced, computed just now in this browser.'),
      h('button.btn.sm.secondary', { type: 'button', 'data-key': 'rerun', onclick: redraw }, 'Run the checks again')),
    h('div.tbl-wrap', h('table.tbl',
      h('thead', h('tr', h('th', { scope: 'col' }, 'Formula'), h('th', { scope: 'col' }, 'Example printed in the source'),
        h('th.n', { scope: 'col' }, 'Printed'), h('th.n', { scope: 'col' }, 'Our code'), h('th', { scope: 'col' }, h('span.sr', 'Result')))),
      h('tbody', checks.map((c) => h('tr',
        h('td', name(c.formulaId)),
        h('td.small', String(c.example || ''), c.source ? h('div.dim', String(c.source)) : null),
        h('td.n', String(c.expected)), h('td.n', likePrinted(c)),
        h('td', h('span.pill.' + (c.pass ? 'good' : 'bad'), c.pass ? 'Match' : 'Differs'))))))));
}

function draw(root, ctx) {
  const state = ctx.store.get() || {};
  const person = personColumns(state);
  // Redrawing replaces every node, so the focus is put back on the control that was just used.
  const redraw = () => {
    const key = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-key');
    draw(root, ctx);
    const again = key ? [...root.querySelectorAll('[data-key]')].find((el) => el.getAttribute('data-key') === key) : null;
    if (again) again.focus({ preventScroll: true });
  };

  const all = Object.values(EVIDENCE);
  const appIds = appFormulaIds();
  // formulas with a result card; some are for diseases the validation map does not cover
  const withCard = everyFormula().filter((f) => f.kind !== 'score').length || appIds.length;
  const entries = showAll ? all : appIds.map((id) => EVIDENCE[id]);
  const visible = shownEntries(entries), pops = shownPopulations();
  const everything = counts(all);
  const pickedEntry = picked ? EVIDENCE[picked.formulaId] : null;
  const pickedPop = picked ? POPULATIONS.find((p) => p.id === picked.populationId) : null;

  mount(root,
    h('section',
      h('div.sec-head',
        h('div.row.between',
          h('h1', 'Where each formula has been checked'),
          person.persona ? h('span.sample-badge', 'Sample data · ' + person.persona.name) : null),
        h('p.sub', 'A formula is fitted to one group of people. Each cell says whether a published study has checked it in another group. '
          + 'An empty dashed cell is a gap: no published check was found.')),
      h('div.stats',
        h('div.stat', h('div.v', String(all.length)), h('div.l', 'published formulas reviewed')),
        h('div.stat', h('div.v', String(POPULATIONS.length)), h('div.l', 'groups of people')),
        h('div.stat', h('div.v', everything.gaps.toLocaleString('en-US')), h('div.l', 'of ' + everything.cells.toLocaleString('en-US') + ' cells: no published validation found')),
        h('div.stat', h('div.v', Math.round(everything.gaps / Math.max(everything.cells, 1) * 100) + '%'), h('div.l', 'of the map is still blank')))),
    h('section',
      h('div.row.between', { style: { 'margin-bottom': '12px' } },
        h('h2', showAll ? 'All ' + all.length + ' formulas' : 'In this app: ' + entries.length + ' of the ' + all.length + ' formulas'),
        h('div.seg', { role: 'group', 'aria-label': 'Which formulas to show' },
          h('button' + (showAll ? '' : '.on'), { type: 'button', 'data-key': 'seg-app', 'aria-pressed': String(!showAll), onclick: () => { showAll = false; picked = null; redraw(); } }, 'In this app'),
          h('button' + (showAll ? '.on' : ''), { type: 'button', 'data-key': 'seg-all', 'aria-pressed': String(showAll), onclick: () => { showAll = true; picked = null; redraw(); } }, 'All ' + all.length))),
      withCard > appIds.length ? h('p.small', { style: { 'margin-bottom': '10px' } },
        'The app computes ' + withCard + ' formulas in all. ' + (withCard - appIds.length)
        + ' of them are not in this map yet: it covers stroke, dementia and type 2 diabetes formulas.') : null,
      groupSummaries(appIds.map((id) => EVIDENCE[id]), person.ids),
      switches(visible.length, redraw),
      visible.length ? matrix(visible, pops, person.ids, redraw)
        : h('div.callout', 'No formula matches these three switches. Set one of them back to All.'),
      h('div', { style: { 'margin-top': '12px' } }, legend()),
      pickedEntry && pickedPop ? h('div.ev-float', cellDetails(pickedEntry, pickedPop))
        : h('p.small.dim', { style: { 'margin-top': '12px' } }, 'Select a cell to see the figures and the paper behind it.'
          + (person.ids.size ? ' Highlighted columns are the groups that describe you.' : ''))),
    h('section',
      h('div.sec-head', h('span.micro', 'Check table'), h('h2', 'Does our code reproduce the papers?'),
        h('p.sub', 'Each formula re-computes the worked examples printed in its own source. If our code and the paper disagree, it shows here.')),
      checksTable(redraw)),
    h('section', h('div.row',
      h('button.btn', { type: 'button', onclick: () => ctx.go('#/results') }, 'Back to results'))),
    disclaimer(root));

}

export function render(root, ctx) {
  window.scrollTo(0, 0);   // the router keeps the previous page's scroll position
  draw(root, ctx);
  focusHeading(root);
}
