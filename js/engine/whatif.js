// What if: the changes a person could make, and how each formula's estimate responds (issue #37).
//
//   import { whatIfs, whatIfsFlat, LEVERS } from './js/engine/whatif.js';
//   whatIfs(person)      // [{ id, label, change, effects: [{ formulaId, name, before, after, beforeValue, afterValue }] }]
//   whatIfsFlat(person)  // [{ formulaId, change, before, after }]  (the report packet, docs/report-interpreter.md)
//
// How it works: every lever that applies to this person makes a changed copy of the person
// (smoking, blood pressure, weight, activity, vegetables, cholesterol). The engine (runAll in
// index.js) runs on the original and on each copy, and only results that are computed both
// times and whose estimate moved are kept. `before` and `after` are the engine's own display
// strings. When only a point score moved inside the same printed band (FINDRISC 19 → 17 stays
// "about 1 in 3"), the points are added to the display so the movement is visible.
//
// Order: levers with the largest total drop in probability (risk results only) come first;
// levers that move nothing are left out.
//
// Read with care: these formulas come from observational studies. The numbers show how the
// formulas respond when one input changes and everything else stays the same; they are not a
// promise of what making the change would achieve. Not a diagnosis. Not medical advice.

import { runAll } from './index.js';
import { bmi, round } from './util.js';

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

function copy(person) {
  const p = person || {};
  return { ...p, profile: { ...(p.profile || {}) }, labs: { ...(p.labs || {}) } };
}

// Each lever: applies(person) -> bool; apply(person) -> changed copy; change(person) -> text with
// the person's own values.
export const LEVERS = [
  {
    id: 'quit-smoking',
    label: 'Quit smoking',
    applies: (p) => p.profile.smoking === 'current',
    apply: (p) => { const c = copy(p); c.profile.smoking = 'former'; return c; },
    change: () => 'Smoking: current → quit'
  },
  {
    id: 'bp-130-80',
    label: 'Blood pressure down to 130/80',
    applies: (p) => {
      const s = num(p.profile.sbp), d = num(p.profile.dbp);
      return Number.isFinite(s) && Number.isFinite(d) && (s > 130 || d > 80);
    },
    apply: (p) => {
      const c = copy(p);
      c.profile.sbp = Math.min(num(p.profile.sbp), 130);
      c.profile.dbp = Math.min(num(p.profile.dbp), 80);
      return c;
    },
    change: (p) => `Blood pressure ${p.profile.sbp}/${p.profile.dbp} → ${Math.min(num(p.profile.sbp), 130)}/${Math.min(num(p.profile.dbp), 80)} mmHg`
  },
  {
    id: 'bp-120-80',
    label: 'Blood pressure down to 120/80',
    applies: (p) => {
      const s = num(p.profile.sbp), d = num(p.profile.dbp);
      return Number.isFinite(s) && Number.isFinite(d) && s > 120;
    },
    apply: (p) => {
      const c = copy(p);
      c.profile.sbp = Math.min(num(p.profile.sbp), 120);
      c.profile.dbp = Math.min(num(p.profile.dbp), 80);
      return c;
    },
    change: (p) => `Blood pressure ${p.profile.sbp}/${p.profile.dbp} → ${Math.min(num(p.profile.sbp), 120)}/${Math.min(num(p.profile.dbp), 80)} mmHg`
  },
  {
    id: 'weight-5pct',
    label: '5% less body weight',
    applies: (p) => {
      const h = num(p.profile.heightCm), w = num(p.profile.weightKg);
      return Number.isFinite(h) && Number.isFinite(w) && h > 0 && bmi(p.profile) >= 24;
    },
    apply: (p) => { const c = copy(p); c.profile.weightKg = round(num(p.profile.weightKg) * 0.95, 1); return c; },
    change: (p) => {
      const w = num(p.profile.weightKg), w2 = round(w * 0.95, 1);
      const b = round(bmi(p.profile), 1), b2 = round(bmi({ ...p.profile, weightKg: w2 }), 1);
      const waist = Number.isFinite(num(p.profile.waistCm)) ? `; waist kept at ${p.profile.waistCm} cm` : '';
      return `Weight ${w} → ${w2} kg (BMI ${b} → ${b2})${waist}`;
    }
  },
  {
    id: 'active-daily',
    label: '30 minutes of activity every day',
    applies: (p) => p.profile.active30minDaily !== true,
    apply: (p) => { const c = copy(p); c.profile.active30minDaily = true; return c; },
    change: () => 'Active at least 30 minutes a day: no → yes'
  },
  {
    id: 'exercise-twice-weekly',
    label: 'Leisure exercise at least twice a week',
    applies: (p) => p.profile.exerciseTwiceWeekly !== true,
    apply: (p) => { const c = copy(p); c.profile.exerciseTwiceWeekly = true; return c; },
    change: () => 'Leisure exercise at least twice a week: no → yes'
  },
  {
    id: 'veg-fruit-daily',
    label: 'Vegetables or fruit every day',
    applies: (p) => p.profile.vegFruitDaily !== true,
    apply: (p) => { const c = copy(p); c.profile.vegFruitDaily = true; return c; },
    change: () => 'Vegetables or fruit every day: no → yes'
  },
  {
    id: 'cholesterol-minus-40',
    label: 'Total cholesterol 40 mg/dL lower',
    applies: (p) => num(p.labs.totalCholMgDl) >= 200,
    apply: (p) => { const c = copy(p); c.labs.totalCholMgDl = num(p.labs.totalCholMgDl) - 40; return c; },
    change: (p) => `Total cholesterol ${p.labs.totalCholMgDl} → ${num(p.labs.totalCholMgDl) - 40} mg/dL`
  }
];

// A result is a probability when the engine says kind 'risk', or (older engine without `kind`)
// when its value is a number between 0 and 1.
function isRisk(r) {
  if (r.kind) return r.kind === 'risk';
  return Number.isFinite(r.value) && r.value >= 0 && r.value <= 1;
}

const points = (r) => (r.score && Number.isFinite(r.score.points) ? r.score.points : null);

function shown(r, withPoints) {
  if (!withPoints || points(r) === null) return r.display;
  return `${r.display} (${points(r)} of ${r.score.max} points)`;
}

function effectsOf(before, after) {
  const byId = new Map(after.map((r) => [r.id, r]));
  const out = [];
  for (const b of before) {
    const a = byId.get(b.id);
    if (!a || b.status !== 'computed' || a.status !== 'computed') continue;
    const valueMoved = Number.isFinite(b.value) && Number.isFinite(a.value) ? Math.abs(b.value - a.value) > 1e-12 : b.value !== a.value;
    const displayMoved = b.display !== a.display;
    const pointsMoved = points(b) !== points(a);
    if (!valueMoved && !displayMoved && !pointsMoved) continue;
    // Same display but different points: show the points so the change is visible.
    const withPoints = !displayMoved && pointsMoved;
    out.push({
      formulaId: b.id,
      name: b.name,
      before: shown(b, withPoints),
      after: shown(a, withPoints),
      beforeValue: b.value,
      afterValue: a.value,
      risk: isRisk(b)
    });
  }
  return out;
}

function riskDrop(effects) {
  return effects.reduce((sum, e) => sum + (e.risk && Number.isFinite(e.beforeValue) && Number.isFinite(e.afterValue) ? e.beforeValue - e.afterValue : 0), 0);
}

export function whatIfs(person, { includeScores = false } = {}) {
  const p = copy(person);
  const opts = { includeScores };
  const before = runAll(p, opts);
  const levers = [];
  LEVERS.forEach((lever, order) => {
    if (!lever.applies(p)) return;
    const effects = effectsOf(before, runAll(lever.apply(p), opts))
      .filter((e) => includeScores || e.risk);
    if (!effects.length) return;
    levers.push({
      id: lever.id,
      label: lever.label,
      change: lever.change(p),
      effects: effects.map(({ risk, ...e }) => e),
      _drop: riskDrop(effects),
      _order: order
    });
  });
  levers.sort((x, y) => (y._drop - x._drop) || (y.effects.length - x.effects.length) || (x._order - y._order));
  return levers.map(({ _drop, _order, ...l }) => l);
}

export function whatIfsFlat(person, options) {
  return whatIfs(person, options).flatMap((l) => l.effects.map((e) => ({
    formulaId: e.formulaId,
    change: l.change,
    before: e.before,
    after: e.after
  })));
}
