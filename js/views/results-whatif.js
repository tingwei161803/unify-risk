// What moves these numbers: a section of the results page.
//
// Each card changes one of the person's answers (not smoking, systolic pressure at 130 mmHg,
// 5 kg lighter, ...), runs the same published formulas again on a copy of the person, and shows
// every estimate that moved, before and after.
//
// Every figure comes from runAll (the engine's `display`, or its `value`); this file never
// computes an estimate. The cards compare two sets of answers and promise no effect.
//
//   whatIfSection(personFrom(state), ctx.runAll)   // a <section>, or null when nothing moves

import { h } from './inputs.js';

const MIN_CHANGE = 0.0005;   // two estimates closer than this count as unchanged
const MAX_CARDS = 4;
const CAVEAT = 'These figures come from running the same published formulas again with one answer changed. '
  + 'They compare two people who differ in that one answer; they are not a promise that changing it would change your own risk by this amount.';

/* ---------------- formatting ---------------- */

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
/** an open band in the engine's wording ('more than 35%', '3% or less'): its value is only the edge of the band */
function isOpenBand(display) { return /^more than\b|\bor less$/i.test(String(display || '')); }
/** probability -> "6.6%" (copied from results.js, which does not export it) */
function pct(p) {
  if (!isNum(p)) return '—';
  const v = p * 100;
  if (v > 0 && v < 0.05) return '<0.1%';
  return (v >= 99.95 ? '100' : v.toFixed(1)) + '%';
}
/** one of the person's own answers: at most two decimals, no trailing zeros */
function num(x) { return String(Number(x.toFixed(2))); }
/** the gap between two estimates in whole people out of 100: "About 2 fewer in 100" */
function apart(before, after) {
  const n = Math.round((after - before) * 100);
  if (n === 0) return 'Less than 1 in 100 apart';
  return 'About ' + Math.abs(n) + (n < 0 ? ' fewer' : ' more') + ' in 100';
}

/* ---------------- the answers to change ---------------- */

// Each entry reads the profile and returns null when it does not apply, otherwise
// { title, detail, patch }. `patch` is merged into a copy of the profile; every other answer
// (dbp, waistCm, ...) stays as the person gave it.
const LEVERS = [
  (p) => (p.smoking === 'current'
    ? { title: 'Not smoking', detail: 'Smoking: currently → quit', patch: { smoking: 'former' } } : null),
  (p) => (isNum(p.sbp) && p.sbp >= 130
    ? { title: 'Systolic blood pressure under 130 mmHg', detail: num(p.sbp) + ' → 129 mmHg', patch: { sbp: 129 } } : null),
  (p) => (p.active30minDaily === false
    ? { title: 'Active for 30 minutes a day', detail: 'Daily activity: no → yes', patch: { active30minDaily: true } } : null),
  (p) => (p.exerciseTwiceWeekly === false
    ? { title: 'Leisure exercise twice a week', detail: 'Exercise twice a week: no → yes', patch: { exerciseTwiceWeekly: true } } : null),
  (p) => (p.vegFruitDaily === false
    ? { title: 'Vegetables or fruit every day', detail: 'Daily vegetables or fruit: no → yes', patch: { vegFruitDaily: true } } : null),
  (p) => {   // applies from a body-mass index of 24 kg/m²
    if (!isNum(p.heightCm) || !isNum(p.weightKg) || p.heightCm <= 0) return null;
    const m = p.heightCm / 100;
    if (!(p.weightKg / (m * m) >= 24)) return null;
    const lighter = Number((p.weightKg - 5).toFixed(2));   // drops floating-point dust: 65.1 minus 5 is not exactly 60.1
    return { title: '5 kg lighter', detail: num(p.weightKg) + ' → ' + lighter + ' kg', patch: { weightKg: lighter } };
  }
];

/* ---------------- engine output ---------------- */

// A fresh person with `patch` merged into the profile. profile and labs are flat maps
// (docs/interfaces.md), so copying both shares nothing with the object this file was given.
function copyOf(person, patch) {
  const src = person && typeof person === 'object' ? person : {};
  return { ...src, profile: { ...src.profile, ...patch }, labs: { ...src.labs } };
}

// runAll output -> Map of formula id -> { name, value, display }, computed estimates only.
// Accepts both result shapes, as normalise() in results.js does: modelId or id, 'ok' or 'computed'.
function computedById(raw) {
  const out = new Map();
  (Array.isArray(raw) ? raw : []).forEach((r) => {
    if (!r || typeof r !== 'object') return;
    const id = r.modelId || r.id || r.name;
    const done = r.status === 'ok' || r.status === 'computed';
    if (!id || !done || !isNum(r.value) || r.value < 0 || r.value > 1) return;   // a probability, 0 to 1
    out.set(id, { name: String(r.name || id), value: r.value, display: typeof r.display === 'string' ? r.display : '' });
  });
  return out;
}

// The changes that apply to this person and move at least one estimate, largest move first.
function movers(person, runAll) {
  const profile = person && person.profile && typeof person.profile === 'object' ? person.profile : {};
  const levers = LEVERS.map((make) => make(profile)).filter(Boolean);
  if (!levers.length) return [];
  const base = computedById(runAll(copyOf(person)));
  if (!base.size) return [];
  const found = [];
  levers.forEach((lever) => {
    let changed;
    try { changed = computedById(runAll(copyOf(person, lever.patch))); } catch (e) { return; }   // a throw drops this lever
    const rows = [];
    base.forEach((before, id) => {
      const after = changed.get(id);
      if (after && Math.abs(after.value - before.value) >= MIN_CHANGE) rows.push({ before, after });
    });
    if (!rows.length) return;
    const largest = Math.max(...rows.map((r) => Math.abs(r.after.value - r.before.value)));
    found.push({ title: lever.title, detail: lever.detail, rows, largest });
  });
  return found.sort((a, b) => b.largest - a.largest).slice(0, MAX_CARDS);
}

/* ---------------- cards ---------------- */

function card(lever) {
  // one axis for the whole card, so its rows can be compared with each other
  const max = Math.max(...lever.rows.map((r) => Math.max(r.before.value, r.after.value))) * 1.15;
  const at = (v) => (v / max * 100).toFixed(1) + '%';
  return h('div.panel.lever',
    h('h3', lever.title),
    h('p.small', lever.detail),
    lever.rows.map(({ before, after }) => {
      const worded = before.display && after.display;   // the engine's own wording, when both runs give it
      return h('div.ba',
        h('span', before.name),
        h('span.nums', worded ? before.display : pct(before.value), h('span.arrow', '→'), worded ? after.display : pct(after.value)),
        h('div.dumb', { 'aria-hidden': 'true' },
          h('i.seg-l', { style: { left: at(Math.min(before.value, after.value)), width: at(Math.abs(after.value - before.value)) } }),
          h('i.p.b', { style: { left: at(before.value) } }),
          h('i.p.a', { style: { left: at(after.value) } })),
        // no "about N fewer" beside an open band: the gap to "more than 35%" is not a figure
        isOpenBand(before.display) || isOpenBand(after.display) ? null : h('div.delta', apart(before.value, after.value)));
    }));
}

/**
 * person: { profile, labs } as in docs/interfaces.md (Person)
 * runAll: the engine function, runAll(person) -> one result per formula
 * Returns a <section> element, or null when no change of one answer moves any estimate.
 */
export function whatIfSection(person, runAll) {
  try {
    if (typeof runAll !== 'function') return null;
    const levers = movers(person, runAll);
    if (!levers.length) return null;
    return h('section',
      h('div.sec-head',
        h('span.micro', 'What moves these numbers'),
        h('h2', 'Change one answer and the formulas recompute'),
        h('p.sub', 'Each card changes one of your answers and runs the same published formulas again. Everything else stays as you answered it.')),
      h('div.grid2', levers.map(card)),
      h('div.callout.warn', { style: { 'margin-top': '16px' } }, CAVEAT));
  } catch (e) {
    console.error('What-if section skipped:', e);   // never break the results page
    return null;
  }
}
