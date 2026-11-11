// The published numbers behind a formula: a section of the equation drawer.
//
// js/data/coefficients.js holds each formula's equation, coefficients, constants, baseline
// survival, points table and points-to-risk table as the paper prints them (generated from the
// literature notes). This file only lays those out; it computes nothing and changes no number.
// The data file is large (about 400 KB), so it is loaded when a drawer first opens.
//
//   publishedSection(r, sex)   // a <div> that fills itself in, and stays empty when there is nothing to show

import { h } from './inputs.js';

// The same formulas under the ids the coefficient file uses (the ids our literature notes use).
// A formula whose id is the same in both places needs no entry.
const COEFFICIENT_ID = {
  fsrp: 'framingham-stroke-risk-profile-new-fsrp',
  'chin-shan-stroke': 'chien-2010',
  'framingham-offspring-diabetes-wilson-2007': 'framingham-offspring-wilson-2007',
  'hisayama-dementia-equation': 'hisayama-dementia-2021',
  'ada-risk-test-bang-2009': 'ada'
};

// Formulas whose published tables are not shown. The app computes FINDRISC from the 8-question form
// (0–26 points); the coefficient file holds the 2003 paper's 7-question table (0–20 points). Side by
// side with "The arithmetic" the two would look like a mismatch, so the section stays out until the
// file carries the form version.
const NOT_SHOWN = new Set(['findrisc']);

let loading = null;
function load() {
  if (!loading) loading = import('../data/coefficients.js').catch(() => null);
  return loading;
}

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function has(v) { return v !== null && v !== undefined && v !== ''; }
function list(v) { return Array.isArray(v) ? v : []; }
/** 'cox_multivariable' -> 'Cox multivariable' */
function words(id) {
  const s = String(has(id) ? id : '').replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** a published value exactly as the data file gives it */
function printed(v) { return has(v) ? String(v) : ''; }
/** a published risk as a percentage: 0.085 -> '8.5%', '>=0.80' -> '≥80%', '≤3%' unchanged */
function asPercent(v) {
  if (isNum(v)) return String(Number((v * 100).toFixed(2))) + '%';
  const m = /^(>=|<=|>|<|≥|≤)\s*(0?\.\d+|1(?:\.0+)?)$/.exec(String(has(v) ? v : '').trim());
  if (m) return ({ '>=': '≥', '<=': '≤' }[m[1]] || m[1]) + Number((Number(m[2]) * 100).toFixed(2)) + '%';
  return printed(v);
}
function valueOf(v) { return v && typeof v === 'object' ? v.value : v; }

function table(head, rows) {
  return h('div.tbl-wrap', h('table.tbl',
    h('thead', h('tr', head.map((c, i) => h(i ? 'th.n' : 'th', { scope: 'col' }, c)))),
    h('tbody', rows.map((cells) => h('tr', cells.map((c, i) => h(i ? 'td.n' : 'td', c)))))));
}
function caption(text) { return h('p.small', { style: { margin: '14px 0 6px' } }, h('strong', text)); }

// One equation of the paper: its coefficient table, then its constants and baseline survival.
function equationBlock(eq, model, r) {
  const rows = list(eq.coefficients).filter((k) => k && (has(k.term) || has(k.key)) && isNum(k.beta));   // a row without a label says nothing
  if (!rows.length) return null;
  const withMean = rows.some((k) => isNum(k.mean)), withPoints = rows.some((k) => has(k.score));
  const ratio = rows.some((k) => has(k.hr)) ? 'hr' : rows.some((k) => has(k.odds_ratio)) ? 'odds_ratio' : null;
  const head = ['Term', 'β'].concat(withMean ? ['Mean'] : [], ratio ? [ratio === 'hr' ? 'Hazard ratio' : 'Odds ratio'] : [], withPoints ? ['Points'] : []);
  const body = rows.map((k) => [has(k.term) ? String(k.term) : String(k.key), printed(k.beta)]
    .concat(withMean ? [printed(k.mean)] : [], ratio ? [printed(k[ratio])] : [], withPoints ? [printed(k.score)] : []));
  const facts = [];
  Object.entries(eq.constants && typeof eq.constants === 'object' ? eq.constants : {}).forEach(([name, v]) => {
    if (isNum(valueOf(v))) facts.push(words(name) + ' = ' + valueOf(v));
  });
  const survival = eq.baseline_survival || model.baseline_survival;
  if (survival && typeof survival === 'object') {
    const years = Object.keys(survival).filter((y) => isNum(survival[y]));
    const year = years.includes(String(r.horizonYears)) ? String(r.horizonYears) : years[years.length - 1];
    if (year) facts.push('Baseline survival at ' + year + (year === '1' ? ' year' : ' years') + ' = ' + survival[year]);
  }
  return h('div', caption('Equation: ' + words(eq.id)), table(head, body),
    facts.length ? h('p.small.dim', { style: { 'margin-top': '6px' } }, facts.join(' · ')) : null);
}

// The paper's points table: what each answer scores. The factor name is printed once per group.
function pointsBlock(t) {
  const items = list(t.items).filter((x) => x && (has(x.factor) || has(x.category)) && has(x.points));
  if (!items.length || items.length !== list(t.items).length) return null;   // a table with unnamed rows would mislead
  let last = null;
  const body = items.map((x) => {
    const factor = has(x.factor) ? String(x.factor) : '';
    const row = [factor === last ? '' : factor, printed(x.category), printed(x.points)];
    last = factor;
    return row;
  });
  return h('div', caption('Points table: ' + words(t.id) + (has(t.applies_to) ? ' (' + t.applies_to + ')' : '')),
    table(['Factor', 'Answer', 'Points'], body));
}

// The paper's table that turns a total score into a risk.
function riskBlock(t) {
  const rows = list(t.rows).filter((x) => x && has(x.score) && has(x.risk));
  if (!rows.length) return null;
  return h('div', caption('Points to risk' + (isNum(t.horizon_years) ? ', ' + t.horizon_years + ' years' : '') + ': ' + words(t.id)),
    table(['Total points', 'Risk'], rows.map((x) => [String(x.score), asPercent(x.risk)])));
}

/**
 * r:   one result as results.js normalises it (id, horizonYears)
 * sex: 'male' | 'female' | anything else. When the paper has one equation for men and one for
 *      women, only the person's own is shown.
 * Returns a <div> for the drawer. It is empty until the data file has loaded, and stays empty
 * when the file has nothing for this formula.
 */
export function publishedSection(r, sex) {
  const slot = h('div', { style: { display: 'none' } });
  if (NOT_SHOWN.has(r.id)) return slot;
  load().then((m) => {
    try {
      const model = m && typeof m.getCoefficients === 'function' ? m.getCoefficients(COEFFICIENT_ID[r.id] || r.id) : null;
      if (!model) return;
      let equations = list(model.equations);
      const own = sex === 'male' ? 'men' : sex === 'female' ? 'women' : null;
      if (own && equations.some((e) => e.id === 'men') && equations.some((e) => e.id === 'women')) equations = equations.filter((e) => e.id === own);
      const blocks = equations.map((e) => equationBlock(e, model, r))
        .concat(list(model.points_tables).map(pointsBlock), list(model.score_to_risk).map(riskBlock)).filter(Boolean);
      if (!blocks.length && !has(model.formula)) return;
      slot.replaceChildren(
        h('h4', 'The published numbers'),
        h('details.more',
          h('summary', 'The equation, coefficients and tables as the paper prints them'),
          has(model.citation) ? h('p.small', { style: { 'margin-top': '10px' } }, String(model.citation)) : null,
          has(model.formula) ? h('div.formula', { style: { 'margin-top': '10px' } }, String(model.formula)) : null,
          blocks,
          h('p.small.dim', { style: { 'margin-top': '12px' } },
            'Copied unchanged from the paper\'s tables. A paper often prints more than one version; the arithmetic above shows the one this app uses.')));
      slot.style.display = '';
    } catch (e) {
      console.error('Published numbers skipped:', e);   // never break the drawer
    }
  });
  return slot;
}
