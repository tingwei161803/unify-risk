// Results: one card per published formula, in three states.
//   computed        the estimate; the number opens the arithmetic, the source and where it was checked
//   missing         which answers are still needed, with a shortcut to those questions
//   not applicable  why the formula does not cover this person; nothing is extrapolated
//
// Every number on this page comes from ctx.runAll(person), the engine's own checks (runChecks)
// or the validation data. The view never computes a risk itself.
//
// #/results?open=fsrp opens the "show the math" drawer for that formula.

import { h, mount, fieldLabel, answerText, readAnswer, personFrom, regionOf, openQuestionFor, hasQuestionFor, disclaimer, focusHeading } from './inputs.js';
import { EVIDENCE, POPULATIONS, STATUS as EVIDENCE_STATUS } from '../data/evidence.js';
import { PERSONAS } from '../data/personas.js';
import { whatIfSection } from './results-whatif.js';
import { labsSection } from './results-labs.js';
import { publishedSection } from './results-published.js';

// Optional extras from the formula engine: the list of inputs per formula and the checks that
// re-compute each paper's printed examples. The page works without them.
const engine = await import('../engine/index.js').catch(() => null);

const DISEASES = {
  stroke: { label: 'Stroke', event: 'have a stroke' },
  dementia: { label: 'Dementia', event: 'develop dementia' },
  diabetes: { label: 'Type 2 diabetes', event: 'develop type 2 diabetes' },
  cvd: { label: 'Cardiovascular disease', event: 'have a heart attack, stroke or heart failure' },
  kidney: { label: 'Kidney function', event: null },
  // no fixed wording for these two: each formula counts different events, and its card says which
  cardiovascular: { label: 'Cardiovascular disease', event: null },
  mortality: { label: 'Death from any cause', event: null }
};
// The interface document says ok / missing / not_applicable; the engine says computed / missing / not-applicable.
const STATUS = { ok: 'computed', computed: 'computed', missing: 'missing',
  not_applicable: 'not-applicable', 'not-applicable': 'not-applicable' };
const PLACES = { US: 'the US', TW: 'Taiwan', JP: 'Japan', FI: 'Finland', UK: 'the UK', EU: 'Europe', CN: 'China', KR: 'Korea' };
const TONE_CLASS = { good: 'good', accent: 'accent', warn: 'warn', gap: 'gap', neutral: 'mute', mute: 'mute' };
const GROUP_ROWS = ['women', 'men', '65plus', '80plus'];

/* ---------------- formatting ---------------- */

function has(v) { return v !== null && v !== undefined && v !== ''; }
function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
/** probability -> "6.6%" */
function pct(p) {
  if (!isNum(p)) return '—';
  const v = p * 100;
  if (v > 0 && v < 0.05) return '<0.1%';
  return (v >= 99.95 ? '100' : v.toFixed(1)) + '%';
}
/** probability -> whole people out of 100 */
function per100(p) {
  if (!isNum(p)) return '—';
  const v = p * 100;
  return v > 0 && v < 0.5 ? '<1' : String(Math.round(v));
}
// A points table can end in an open band. The engine then gives the edge of the band as `value`
// and says so in `display` ('more than 35%', '3% or less'); the card must not turn that into "about 35".
function openBand(r) {
  const d = String((r && r.display) || '');
  return /^more than\b/i.test(d) ? 'more' : /\bor less$/i.test(d) ? 'less' : '';
}
/** An estimate as people out of 100: in figures ('9', '>35', '≤3') and in words ('about 9', 'more than 35'). */
function outOf100(r) {
  const n = per100(r.value), band = openBand(r);
  if (band === 'more') return { figure: '>' + n, words: 'more than ' + n };
  if (band === 'less') return { figure: '≤' + n, words: n + ' or fewer' };
  return { figure: n, words: n === '<1' ? 'fewer than 1' : 'about ' + n };
}
function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
/** a plain number with at most `digits` decimals and no trailing zeros */
function num(x, digits) {
  if (!isNum(x)) return has(x) ? String(x) : '—';
  return String(Number(x.toFixed(digits === undefined ? 2 : digits)));
}
function shown(v) {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (isNum(v)) return num(v, 3);
  return has(v) ? String(v) : '—';
}
function safeUrl(url) { return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null; }
function diseaseLabel(r) {
  if (DISEASES[r.disease]) return DISEASES[r.disease].label;
  return r.disease ? r.disease.charAt(0).toUpperCase() + r.disease.slice(1) : 'Estimate';
}
function horizon(r) { return r.horizonYears ? ' within ' + r.horizonYears + ' years' : ''; }
// What a formula estimates, in the engine's own words ('First stroke within 10 years'). run.js passes
// on only the disease name, so the sentence is read from the engine's formula list when it is there.
function outcomeOf(r) {
  if (typeof r.outcome === 'string' && /\s/.test(r.outcome)) return r.outcome;
  const id = r.modelId || r.id;
  const f = engine && Array.isArray(engine.FORMULAS) ? engine.FORMULAS.find((x) => x && x.id === id) : null;
  return f && typeof f.outcome === 'string' && /\s/.test(f.outcome) ? f.outcome : '';
}
// Two formulas are compared only when they count the same thing. 'First stroke within 10 years' and
// 'Stroke within 10 years' do; 'Heart failure ...' and 'First heart attack or stroke ...' do not.
function sameEvent(text) {
  return String(text || '').toLowerCase().replace(/\([^)]*\)/g, ' ').split(' within ')[0].replace(/^first\s+/, '').replace(/\s+/g, ' ').trim();
}
function sentence(r) {
  const d = DISEASES[r.disease];
  const words = outOf100(r).words;
  if (d && d.event) return 'Of 100 people with the same answers, ' + words + ' would ' + d.event + horizon(r) + '.';
  // no fixed wording for this disease: say what this formula counts, in the engine's own words
  if (r.outcomeText) {
    const counted = /^[A-Z][a-z]/.test(r.outcomeText) ? r.outcomeText.charAt(0).toLowerCase() + r.outcomeText.slice(1) : r.outcomeText;
    return capital(words) + ' in 100 people with the same answers. Counted: ' + counted + '.';
  }
  return capital(words) + ' in 100 people with the same answers' + horizon(r) + '.';
}
// Our value at the precision the paper prints (0.0099, not 0.01); full precision when a check fails.
function likePrinted(c) {
  if (!isNum(c.actual) || !isNum(c.expected) || !c.pass) return String(c.actual);
  const s = String(c.expected), digits = s.includes('.') ? s.length - 1 - s.indexOf('.') : 0;
  return c.actual.toFixed(digits);
}
// "Framingham Heart Study (US), stroke-free adults aged 55–84; checked ..." -> "Framingham Heart Study (US)"
function shortPopulation(text) {
  if (!text) return null;
  let s = String(text).split(/[:;]/)[0].trim();
  if (s.length > 40 && s.includes(',')) s = s.split(',')[0].trim();
  if (s.includes('(') && !s.includes(')')) s = s.split('(')[0].trim();
  return s.replace(/\.$/, '') || null;
}

/* ---------------- engine output ---------------- */

// One internal shape for the view. It accepts the result format in docs/interfaces.md
// (modelId, outcome: 'stroke', status: 'ok', formula, source.url, missing: ['profile.waistCm'])
// and the engine's own format (id, disease, status: 'computed', equation, source.doi,
// missing: [{ field, label }], score, display, population, notes).
function normalise(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const slug = (s) => (typeof s === 'string' && /^[a-z0-9-]+$/i.test(s) ? s.toLowerCase() : '');
  return list.filter((r) => r && typeof r === 'object' && STATUS[r.status]).map((r) => {
    const id = r.modelId || r.id || r.name;
    const src = r.source || {};
    const labels = Array.isArray(r.missingLabels) ? r.missingLabels : [];
    // A point score lists its points with no coefficient; an equation lists beta, x and beta·x.
    const rawTerms = Array.isArray(r.terms) ? r.terms : [];
    const coefOf = (t) => (has(t.beta) ? t.beta : t.coef);
    const pointScore = rawTerms.length > 0 && !rawTerms.some((t) => isNum(coefOf(t)));
    return {
      id,
      name: r.name || id || 'Formula',
      status: STATUS[r.status],
      disease: slug(r.disease) || slug(r.outcome),
      outcomeText: outcomeOf(r),
      horizonYears: r.horizonYears,
      value: isNum(r.value) && (!r.kind || r.kind === 'risk') ? r.value : null,
      display: r.display || '',
      score: r.score && isNum(r.score.points) ? r.score : null,
      terms: rawTerms.map((t) => (pointScore
        ? { label: t.label, input: t.input, points: isNum(t.points) ? t.points : t.contribution }
        : Object.assign({}, t, { beta: coefOf(t) }))),
      equation: r.equation || r.formula || '',
      notes: Array.isArray(r.notes) ? r.notes : [],
      missing: (Array.isArray(r.missing) ? r.missing : []).map((m, i) => {
        const field = String(typeof m === 'string' ? m : m.field).replace(/^profile\./, '');
        return { field, label: (typeof m === 'object' && m.label) || labels[i] || fieldLabel(field) };
      }),
      reason: r.reason ? String(r.reason).replace(/[.\s]*$/, '.') : '',
      population: r.population || '',
      builtOn: shortPopulation(r.population) || (r.derivedIn ? 'data from ' + (PLACES[r.derivedIn] || r.derivedIn) : null),
      ageRange: Array.isArray(r.ageRange) ? r.ageRange : null,
      source: { citation: src.citation || '', url: safeUrl(src.url) || (src.doi ? safeUrl('https://doi.org/' + src.doi) : null) },
      // True only for the fallback results js/engine/run.js returns if the engine failed to load.
      placeholder: r.placeholder === true
    };
  });
}
function inputsOf(r) {
  const meta = engine && Array.isArray(engine.FORMULAS) ? engine.FORMULAS.find((f) => f.id === r.id) : null;
  return meta && Array.isArray(meta.inputs) ? meta.inputs.map((p) => String(p).replace(/^profile\./, '')) : [];
}
let checksCache = null;
function checksFor(id) {
  if (!engine || typeof engine.runChecks !== 'function') return [];
  if (!checksCache) {
    try { const out = engine.runChecks(); checksCache = Array.isArray(out) ? out : []; } catch (e) { checksCache = []; }
  }
  return checksCache.filter((c) => c.formulaId === id);
}

/* ---------------- validation data ---------------- */

// Which population rows describe this person: where they live first, then sex and age band.
function personOf(state) {
  const profile = state.profile || {};
  const persona = PERSONAS.find((p) => p.id === state.personaId) || null;
  const known = new Map(POPULATIONS.map((p) => [p.id, p.label]));
  // The answer to "Where do you live?" wins; without one, a sample person's own groups are used.
  const answered = has(state.region);
  const fromPersona = persona && (!answered || state.region === persona.region) && Array.isArray(persona.populationIds)
    ? persona.populationIds.filter((id) => !GROUP_ROWS.includes(id)) : [];
  const region = regionOf(state);
  const primary = fromPersona.length ? fromPersona : region === 'TW' ? ['tw'] : [];
  const also = [];
  if (profile.sex === 'female') also.push('women');
  if (profile.sex === 'male') also.push('men');
  if (Number(profile.age) >= 80) also.push('80plus'); else if (Number(profile.age) >= 65) also.push('65plus');
  const ids = [...new Set([...primary, ...also])].filter((id) => known.has(id));
  return { persona, primary: primary.find((id) => known.has(id)) || null, ids, label: (id) => known.get(id) || id };
}
function statusPill(code) {
  const st = EVIDENCE_STATUS[code];
  if (!st) return null;
  return h('span.pill.plain.' + (TONE_CLASS[st.tone] || 'mute'), h('span.code', code), st.label);
}
// "Has this formula been checked in people like me?" for the place the person lives.
function evidenceChip(r, person) {
  const entry = EVIDENCE[r.id];
  const cell = entry && person.primary ? entry.cells[person.primary] : null;
  const st = cell ? EVIDENCE_STATUS[cell.status] : null;
  if (!st) return null;
  return h('span.pill.plain.chk.' + (TONE_CLASS[st.tone] || 'mute'),
    h('span.code', cell.status), person.label(person.primary) + ': ' + st.label);
}

/* ---------------- small charts ---------------- */

function svg(tag, attrs, kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
  (kids || []).forEach((k) => el.appendChild(k));
  return el;
}
/** 10 x 10 people-out-of-100 array, filled from the bottom-left so it reads like a level. */
function iconArray(p, words) {
  const n = Math.max(0, Math.min(100, Math.round(p * 100))), gap = 11.2, dots = [];
  for (let i = 0; i < 100; i++) {
    const row = Math.floor(i / 10), col = i % 10, on = (9 - row) * 10 + col < n;
    dots.push(svg('circle', { cx: col * gap + gap / 2, cy: row * gap + gap / 2, r: 3.6, fill: on ? 'var(--mark-1)' : 'var(--track)' }));
  }
  return svg('svg', { class: 'icon-array', viewBox: '0 0 112 112', role: 'img', 'aria-label': (words || per100(p)) + ' of 100 people' }, dots);
}

/* ---------------- drawer: the arithmetic, the source, where it was checked ---------------- */

// Point scores list { label, input, points }; equations list { label, input, beta, x, contribution }.
function termsTable(r) {
  const terms = r.terms, any = (k) => terms.some((t) => has(t[k]));
  const cols = [{ head: 'Term', cell: (t) => t.label || '' }];
  if (any('input')) cols.push({ head: 'Your answer', n: true, cell: (t) => shown(t.input) });
  if (any('x')) cols.push({ head: 'x', n: true, sym: true, cell: (t) => num(t.x, 4) });
  if (any('beta')) cols.push({ head: 'β', n: true, sym: true, cell: (t) => num(t.beta, 5) });
  if (any('contribution')) {
    const total = terms.reduce((a, t) => a + (isNum(t.contribution) ? t.contribution : 0), 0);
    cols.push({ head: 'β·x', n: true, sym: true, cell: (t) => num(t.contribution, 4), total: num(total, 4) });
    const maxAbs = Math.max(...terms.map((t) => Math.abs(isNum(t.contribution) ? t.contribution : 0)), 0) || 1;
    cols.push({ head: '', cell: (t) => {
      const c = isNum(t.contribution) ? t.contribution : 0, w = Math.abs(c) / maxAbs * 42;
      return h('div.cbar', { 'aria-hidden': 'true' }, c > 0 ? h('i.up', { style: { width: w + 'px' } }) : c < 0 ? h('i.down', { style: { width: w + 'px' } }) : null);
    } });
  }
  if (any('points')) {
    const total = terms.reduce((a, t) => a + (isNum(t.points) ? t.points : 0), 0);
    cols.push({ head: 'Points', n: true, cell: (t) => num(t.points, 1),
      total: r.score && isNum(r.score.max) ? num(r.score.points, 1) + ' of ' + r.score.max : num(total, 1) });
  }
  const hasTotal = cols.some((c) => c.total !== undefined);
  return h('div.tbl-wrap', h('table.tbl',
    h('thead', h('tr', cols.map((c) => h('th' + (c.n ? '.n' : '') + (c.sym ? '.sym' : ''), { scope: 'col' }, c.head)))),
    h('tbody',
      terms.map((t) => h('tr', cols.map((c) => h('td' + (c.n ? '.n' : ''), c.cell(t))))),
      hasTotal ? h('tr.total', cols.map((c, i) => h('td' + (c.n ? '.n' : ''), i === 0 ? 'Sum' : c.total !== undefined ? c.total : ''))) : null)));
}

function checksSection(r) {
  const checks = checksFor(r.id);
  if (!checks.length) return null;
  const all = checks.every((c) => c.pass);
  return h('div', h('h4', 'Does our code reproduce the paper?'),
    h('p.small', all ? 'Yes: the examples printed in the source come out the same here.' : 'Not every printed example is reproduced; see below.'),
    h('div.tbl-wrap', { style: { 'margin-top': '10px' } }, h('table.tbl',
      h('thead', h('tr', h('th', { scope: 'col' }, 'Example in the source'), h('th.n', { scope: 'col' }, 'Printed'), h('th.n', { scope: 'col' }, 'Our code'), h('th', { scope: 'col' }, h('span.sr', 'Result')))),
      h('tbody', checks.map((c) => h('tr',
        h('td.small', String(c.example || ''), c.source ? h('div.dim', String(c.source)) : null),
        h('td.n', String(c.expected)), h('td.n', likePrinted(c)),
        h('td', h('span.pill.' + (c.pass ? 'good' : 'bad'), c.pass ? 'Match' : 'Differs'))))))));
}

function checkedSection(r, person) {
  const entry = EVIDENCE[r.id];
  if (!entry) return null;
  const mine = new Set(person.ids);
  const rows = POPULATIONS.slice().sort((a, b) => (mine.has(b.id) ? 1 : 0) - (mine.has(a.id) ? 1 : 0));
  return h('div', h('h4', 'Where this formula has been checked'),
    h('div.tbl-wrap', h('table.tbl', h('tbody', rows.map((pop) => {
      const cell = entry.cells[pop.id] || {};
      const figures = [
        isNum(cell.oe) ? 'observed / expected ' + num(cell.oe, 2) : null,
        isNum(cell.c) ? 'C-statistic ' + num(cell.c, 2) : null,
        isNum(cell.studies) ? cell.studies + (cell.studies === 1 ? ' study' : ' studies') : null
      ].filter(Boolean).join(' · ');
      const url = cell.doi ? safeUrl('https://doi.org/' + cell.doi) : null;
      return h('tr' + (mine.has(pop.id) ? '.you' : ''),
        h('td', pop.label, mine.has(pop.id) ? h('span.pill.accent', { style: { 'margin-left': '8px' } }, 'you') : null),
        h('td', statusPill(cell.status)),
        h('td.small', figures, figures && url ? ' · ' : '',
          url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'paper') : null));
    })))),
    h('p.small.dim', { style: { 'margin-top': '6px' } },
      'Observed / expected: 1 means the formula was right on; below 1 it over-estimated in that group, above 1 it under-estimated. '
      + '"No validation found" marks a gap in the published literature.'),
    h('p.small', { style: { 'margin-top': '6px' } }, h('a', { href: '#/evidence' }, 'See every formula and every group on the Evidence page')));
}

function closeDrawer() {
  document.querySelectorAll('dialog.drawer[data-results-drawer]').forEach((d) => { if (d.open) d.close(); d.remove(); });
}

function openDrawer(r, person, state, opener) {
  closeDrawer();
  const inputs = inputsOf(r);
  const meaning = r.status === 'computed'
    ? (r.value !== null ? sentence(r) + ' (' + (r.display || pct(r.value)) + ')' : r.display)
    : r.status === 'missing'
      ? (r.missing.length ? 'Not computed yet. Still needed: ' + r.missing.map((m) => m.label).join(', ') + '.' : 'Not computed yet: some answers are missing.')
      : 'Not applicable. ' + (r.reason || 'This formula does not cover your answers.') + ' Nothing is extrapolated outside the range the formula was built for.';
  const range = r.ageRange && has(r.ageRange[0])
    ? 'Built for ages ' + r.ageRange[0] + (has(r.ageRange[1]) ? ' to ' + r.ageRange[1] : ' and over') + '.' : null;

  const dlg = h('dialog.drawer', { 'data-results-drawer': true, 'aria-label': r.name });
  // The drawer belongs to this page: leaving the page (back button, a typed address) closes it.
  const close = () => {
    window.removeEventListener('hashchange', close);
    if (dlg.open) dlg.close();
    // back to the control that opened the drawer (not every browser focuses a button on click)
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    setTimeout(() => dlg.remove(), 260);   // after the slide-out
  };
  window.addEventListener('hashchange', close);
  dlg.appendChild(h('div.drawer-in',
    h('div.drawer-head',
      h('div', h('span.micro', diseaseLabel(r) + (r.horizonYears ? ' · ' + r.horizonYears + ' years' : '')),
        h('h3', { style: { 'margin-top': '4px' } }, r.name),
        evidenceChip(r, person) ? h('div', { style: { 'margin-top': '8px' } }, evidenceChip(r, person)) : null),
      h('button.btn.sm.ghost', { type: 'button', onclick: close }, 'Close')),
    h('div.drawer-body',
      h('div', h('h4', 'What this number means'), h('p', meaning),
        r.outcomeText ? h('p.small', { style: { 'margin-top': '6px' } }, 'What the formula estimates: ' + r.outcomeText + '.') : null,
        r.placeholder ? h('p.small.warn', { style: { 'margin-top': '6px' } }, 'Placeholder number: the real formula is not connected yet.') : null),
      r.status === 'computed' && (r.equation || r.terms.length) ? h('div', h('h4', 'The arithmetic'),
        r.equation ? h('div.formula', r.equation) : null,
        r.terms.length ? h('div', { style: { 'margin-top': '10px' } }, termsTable(r)) : null,
        r.terms.some((t) => isNum(t.contribution)) ? h('p.small.dim', { style: { 'margin-top': '6px' } },
          'Orange to the right pushes the figure up; blue to the left pulls it down.') : null,
        r.notes.length ? h('div.stack', { style: { gap: '4px', 'margin-top': '10px' } }, r.notes.map((n) => h('p.small', '· ' + n))) : null) : null,
      // the paper's own equation, coefficients and tables (js/data/coefficients.js), loaded when a drawer first opens
      publishedSection(r, state && state.profile ? state.profile.sex : null),
      h('div', h('h4', 'Where the formula comes from'),
        r.population ? h('p', r.population) : r.builtOn ? h('p', 'Built on ' + r.builtOn + '.') : null,
        range ? h('p.small', { style: { 'margin-top': '6px' } }, range) : null,
        r.source.citation ? h('p.small', { style: { 'margin-top': '6px' } }, r.source.citation, r.source.url ? ' · ' : '',
          r.source.url ? h('a', { href: r.source.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open the paper') : null)
          : h('p.small.dim', 'No source listed for this formula yet.')),
      checkedSection(r, person),
      checksSection(r),
      inputs.length ? h('div', h('h4', 'Which of your answers it uses'),
        h('div.tbl-wrap', h('table.tbl', h('tbody', inputs.map((path) =>
          h('tr', h('td', fieldLabel(path)), h('td.n', answerText(path, readAnswer(state, path))))))))) : null,
      h('p.small.dim', 'Not a diagnosis. Not medical advice.'))));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', close);
  document.body.appendChild(dlg);
  dlg.showModal();
}

/* ---------------- cards ---------------- */

function cardHead(r) {
  return h('div.row.between',
    h('span.micro', diseaseLabel(r) + (r.horizonYears ? ' · ' + r.horizonYears + ' years' : '')),
    r.placeholder ? h('span.pill.warn', 'Placeholder number') : null);
}
function cardTitle(r) {
  return h('div', h('h3', r.name),
    r.builtOn ? h('p.small.dim', { title: r.population || null }, 'Built on: ' + r.builtOn) : null);
}
// A click anywhere on a card opens its drawer; buttons and links inside the card keep their own action.
function cardOpens(card, r, open) {
  card.addEventListener('click', (e) => {
    if (e.target.closest('button, a') || String(window.getSelection()) !== '') return;
    open(r, card.querySelector('button'));
  });
  return card;
}
function mathButton(r, open, label) {
  return h('button.btn.sm.secondary', { type: 'button', onclick: (e) => open(r, e.currentTarget) }, label || 'Show the math and source');
}

function computedCard(r, person, open) {
  const checks = checksFor(r.id);
  // the number itself is a button: every number opens its equation and source
  const number = r.value !== null
    ? h('button.hero-n', { type: 'button', onclick: (e) => open(r, e.currentTarget), 'aria-label': capital(outOf100(r).words) + ' in 100. Show the math and source for ' + r.name },
      outOf100(r).figure, h('small', '/ 100'))
    : h('button.hero-n', { type: 'button', onclick: (e) => open(r, e.currentTarget), 'aria-label': 'Show the math and source for ' + r.name }, r.display || '—');
  const extras = [
    r.score ? h('span.pill.plain.mute', 'Score: ' + num(r.score.points, 1) + (isNum(r.score.max) ? ' of ' + r.score.max : '') + ' points') : null,
    checks.length && checks.every((c) => c.pass) ? h('span.pill.plain.good', '✓ Reproduces the paper\'s examples') : null
  ].filter(Boolean);
  return cardOpens(h('article.panel.risk', { 'data-model': r.id, 'data-status': r.status },
    cardHead(r),
    h('div.risk-top',
      h('div.stack', { style: { gap: '8px' } },
        cardTitle(r), number,
        r.value !== null ? h('p.cap', sentence(r), h('span.num.dim', ' (' + (r.display || pct(r.value)) + ')')) : null),
      r.value !== null ? iconArray(r.value, outOf100(r).words) : null),
    extras.length ? h('div.also', extras) : null,
    h('div.ev', evidenceChip(r, person), h('span.grow'), mathButton(r, open))), r, open);
}

function missingCard(r, person, open, go) {
  // A formula can need an answer the questionnaire has no question for yet (the engine lists its
  // questions in js/engine/run.js). Such an answer is named, but it is not a link to nowhere.
  const askable = r.missing.filter((m) => hasQuestionFor(m.field));
  const answer = () => { openQuestionFor(askable[0].field); go('#/inputs'); };
  return cardOpens(h('article.panel.risk.locked', { 'data-model': r.id, 'data-status': r.status },
    cardHead(r), cardTitle(r),
    h('p.cap', r.missing.length ? 'Not computed yet. Still needed:' : 'Not computed yet: some answers are missing.'),
    r.missing.length ? h('div.need-list', r.missing.map((m) => (hasQuestionFor(m.field)
      ? h('button.pill.plain.mute.need', { type: 'button',
        'aria-label': 'Answer: ' + m.label, onclick: () => { openQuestionFor(m.field); go('#/inputs'); } }, m.label)
      : h('span.pill.plain.mute', { title: 'The questionnaire does not ask for this yet' }, m.label)))) : null,
    r.missing.length && askable.length < r.missing.length ? h('p.small.dim', { style: { 'margin-top': '8px' } },
      askable.length ? 'The questionnaire does not ask for some of these yet.' : 'The questionnaire does not ask for these yet.') : null,
    h('div.ev', evidenceChip(r, person), h('span.grow'),
      h('div.row.acts', mathButton(r, open, 'Show the source'),
        askable.length || !r.missing.length ? h('button.btn.sm', { type: 'button', onclick: askable.length ? answer : () => go('#/inputs') }, 'Answer these') : null))), r, open);
}

function naCard(r, person, open) {
  return cardOpens(h('article.panel.risk.na', { 'data-model': r.id, 'data-status': r.status },
    cardHead(r), cardTitle(r),
    h('p.cap', h('strong', 'Not applicable. '), r.reason || 'This formula does not cover your answers.'),
    h('div.ev', h('span.small.dim', 'Nothing is extrapolated.'), h('span.grow'), mathButton(r, open, 'Show the source'))), r, open);
}

// Two or more formulas for the same disease and horizon: show the gap between them.
function comparisons(computed, open, person) {
  const groups = new Map();
  computed.filter((r) => r.value !== null && r.disease).forEach((r) => {
    const key = r.disease + '|' + (r.horizonYears || '') + '|' + sameEvent(r.outcomeText);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return [...groups.values()].filter((list) => list.length >= 2).map((list) => {
    const values = list.map((r) => r.value), lo = Math.min(...values), hi = Math.max(...values);
    const headline = list.some(openBand)   // an open band has no upper or lower figure to put in a range
      ? diseaseLabel(list[0]) + horizon(list[0]) + ': ' + list.map((r) => outOf100(r).figure).join(' and ') + ' in 100, depending on the formula'
      : per100(lo) === per100(hi)
        ? diseaseLabel(list[0]) + horizon(list[0]) + ': about ' + per100(hi) + ' in 100 by every formula'
        : diseaseLabel(list[0]) + horizon(list[0]) + ': ' + per100(lo) + ' to ' + per100(hi) + ' in 100, depending on the formula';
    return h('div.panel.cmp',
      h('div.row.between', h('span.micro', 'Same answers, ' + list.length + ' published formulas'),
        list.some((r) => r.placeholder) ? h('span.pill.warn', 'Placeholder numbers') : null),
      h('h3', headline),
      h('div.cmp-rows', list.map((r) => h('div.cmp-row',
        h('div.nm', r.name, r.builtOn ? h('small', 'Built on: ' + r.builtOn) : null),
        // the bar, and under it whether the formula has been checked where this person lives
        h('div.cmp-mid',
          h('div.cmp-track', { 'aria-hidden': 'true' }, // the track is 100 people, so 4 in 100 fills 4% of it (never scaled up to the larger formula)
            h('i', { style: { width: (Math.min(Math.max(r.value, 0), 1) * 100).toFixed(1) + '%' } })),
          evidenceChip(r, person)),
        h('button.linkbtn.v', { type: 'button', onclick: (e) => open(r, e.currentTarget), 'aria-label': capital(outOf100(r).words) + ' in 100. Show the math and source for ' + r.name },
          outOf100(r).figure, h('small', '/ 100'))))),
      h('p.small', 'A full bar would be 100 in 100. Each formula was fitted to a different group of people, so the same answers give different estimates. '
        + 'That gap is why it matters where a formula has been checked.'));
  });
}

/* ---------------- view ---------------- */

export function render(root, ctx) {
  const state = ctx.store.get() || {};
  const profile = state.profile || {};
  const go = (hash) => { closeDrawer(); ctx.go(hash); };
  const person = personOf(state);
  const open = (r, opener) => openDrawer(r, person, state, opener);
  window.scrollTo(0, 0);   // the router keeps the previous page's scroll position

  if (!has(profile.age) && !has(profile.sex)) {
    mount(root, h('section', h('div.empty', h('div.mark', { 'aria-hidden': 'true' }, '◌'),
      h('p', 'Nothing to compute yet. Answer a few questions, or pick a sample person.'),
      h('div.row', { style: { 'justify-content': 'center' } },
        h('button.btn', { type: 'button', onclick: () => go('#/inputs') }, 'Start the questionnaire'),
        h('button.btn.secondary', { type: 'button', onclick: () => go('#/') }, 'See sample people')))),
    disclaimer(root));
    return;
  }

  let results = [], failure = null;
  try { results = normalise(ctx.runAll(personFrom(state))); }
  catch (e) { failure = 'The formulas could not be computed: ' + (e && e.message ? e.message : String(e)); }
  const computed = results.filter((r) => r.status === 'computed');
  const missing = results.filter((r) => r.status === 'missing');
  const na = results.filter((r) => r.status === 'not-applicable');
  const sample = person.persona ? 'Sample data · ' + person.persona.name : state.personaId ? 'Sample data' : null;

  mount(root,
    h('section',
      h('div.sec-head',
        h('div.row.between',
          h('h1', computed.length + (computed.length === 1 ? ' estimate' : ' estimates') + ' from '
            + (results.length > computed.length ? results.length + ' ' : '') + 'published ' + (results.length === 1 ? 'formula' : 'formulas')),
          sample ? h('span.sample-badge', sample) : null),
        h('p.sub', 'Open any number to see the arithmetic, the source paper, and where the formula has been checked.')),
      failure ? h('div.callout.warn', failure) : null,
      h('div.stack', { style: { gap: '16px' } }, comparisons(computed, open, person))),
    computed.length ? h('section', h('div.grid2', computed.map((r) => computedCard(r, person, open)))) : null,
    computed.length ? whatIfSection(personFrom(state), ctx.runAll) : null,
    missing.length ? h('section',
      h('div.sec-head', h('span.micro', 'Waiting for more information'), h('h2', 'These unlock when you add a few answers')),
      h('div.grid2', missing.map((r) => missingCard(r, person, open, go)))) : null,
    na.length ? h('section',
      h('div.sec-head', h('span.micro', 'Not applicable'), h('h2', 'Formulas that do not cover you, and why')),
      h('div.grid2', na.map((r) => naCard(r, person, open)))) : null,
    labsSection(Object.assign(personFrom(state), { region: regionOf(state) },
      person.persona && person.persona.report ? { report: person.persona.report } : null)),
    h('section', h('div.row',
      h('button.btn', { type: 'button', onclick: () => go('#/inputs') }, 'Edit my answers'),
      h('button.btn.secondary', { type: 'button', onclick: () => go('#/plan') }, 'See next steps'),
      h('button.btn.secondary', { type: 'button', onclick: () => go('#/report') }, 'Add a lab report'),
      h('button.btn.secondary', { type: 'button', onclick: () => go('#/evidence') }, 'See the evidence'))),
    disclaimer(root));

  // #/results?open=fsrp
  const wanted = typeof ctx.query === 'function' ? ctx.query().open : null;
  const target = wanted ? results.find((r) => r.id === wanted) : null;
  if (target) open(target); else focusHeading(root);
}
