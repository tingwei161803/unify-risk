// Questionnaire: one question at a time, in large type.
//
// Every answer is written to the store as it is entered (ctx.store.setProfile / setLabs), so a
// reload keeps it. Every question can be skipped: a formula that lacks an input says what is
// missing instead of guessing.
//
// To add or rename a field, edit QUESTIONS below. `path` is the key in docs/interfaces.md
// (Person): a bare key is a profile field, 'labs.<key>' is a lab value.
//
// This file also holds the small helpers the other views share (h, mount, fieldLabel, ...).

import { EVIDENCE } from '../data/evidence.js';
import { PERSONAS } from '../data/personas.js';

// Optional: which formulas read each answer. js/engine/run.js lists it once the engine is wired in.
const engineQuestions = await import('../engine/run.js').then((m) => (Array.isArray(m.QUESTIONS) ? m.QUESTIONS : [])).catch(() => []);

const STEP_KEY = 'unify-risk:inputs-step';
const DISCLAIMER = 'Not a diagnosis. Not medical advice.';
const YES_NO = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }];

// One entry per screen. A screen asks either for one choice (`path` + `options`) or for one or
// two numbers that belong together (`fields`). Paths are the engine's field names: a bare key is
// read from person.profile, 'labs.<key>' from person.labs.
export const QUESTIONS = [
  { id: 'age', section: 'About you', title: 'How old are you?',
    fields: [{ path: 'age', label: 'Age', unit: 'years', min: 18, max: 110 }] },
  { id: 'sex', section: 'About you', title: 'What was your sex at birth?',
    help: 'The formulas are fitted separately for women and men.',
    path: 'sex', label: 'Sex at birth',
    options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] },
  { id: 'region', section: 'About you', title: 'Where do you live?',
    help: 'Used to show whether each formula has been checked in people where you live. Skip it if neither fits.',
    path: 'record.region', label: 'Where you live',   // kept on the record, not in the profile; a formula may use 'region' for something else
    options: [{ value: 'TW', label: 'Taiwan' }, { value: 'US', label: 'United States' }] },
  { id: 'body', section: 'About you', title: 'How tall are you, and how much do you weigh?',
    help: 'Used together as body-mass index.',
    fields: [{ path: 'heightCm', label: 'Height', unit: 'cm', min: 120, max: 210 },
      { path: 'weightKg', label: 'Weight', unit: 'kg', min: 30, max: 200 }] },
  { id: 'waist', section: 'About you', title: 'What is your waist measurement?',
    help: 'Measured below the ribs, usually at the level of the belly button. Skip it if you do not know.',
    fields: [{ path: 'waistCm', label: 'Waist', unit: 'cm', min: 50, max: 160 }] },
  { id: 'education', section: 'About you', title: 'How many years of schooling did you complete?',
    help: 'Primary school 6, junior high 9, high school 12, university 16.',
    fields: [{ path: 'educationYears', label: 'Years of schooling', unit: 'years', min: 0, max: 25 }] },

  { id: 'smoking', section: 'Habits', title: 'Do you smoke?',
    help: 'Choose Currently if you have smoked in the past 12 months: that is how the Revised FSRP stroke formula counts it.',
    path: 'smoking', label: 'Smoking',
    options: [{ value: 'never', label: 'Never' }, { value: 'former', label: 'Quit' }, { value: 'current', label: 'Currently' }] },
  { id: 'active', section: 'Habits', title: 'Are you physically active for at least 30 minutes on most days?',
    help: 'At work or in your free time, including ordinary daily activity.',
    path: 'active30minDaily', label: 'At least 30 minutes of activity a day', options: YES_NO },
  { id: 'exercise', section: 'Habits', title: 'Do you exercise in your free time at least twice a week?',
    help: 'Exercise that leaves you a little out of breath.',
    path: 'exerciseTwiceWeekly', label: 'Leisure exercise at least twice a week', options: YES_NO },
  { id: 'veg', section: 'Habits', title: 'Do you eat vegetables, fruit or berries every day?',
    path: 'vegFruitDaily', label: 'Vegetables, fruit or berries every day', options: YES_NO },

  { id: 'bp', section: 'Blood pressure and history', title: 'What was your most recent blood pressure reading?',
    help: 'The top number is systolic, the bottom number is diastolic. Skip it if you have no recent reading.',
    fields: [{ path: 'sbp', label: 'Systolic (top number)', short: 'Systolic blood pressure', unit: 'mmHg', min: 70, max: 250 },
      { path: 'dbp', label: 'Diastolic (bottom number)', short: 'Diastolic blood pressure', unit: 'mmHg', min: 40, max: 150 }] },
  { id: 'bpTreated', section: 'Blood pressure and history', title: 'Do you take medicine for high blood pressure?',
    path: 'bpTreated', label: 'Takes blood-pressure medicine', options: YES_NO },
  { id: 'diabetes', section: 'Blood pressure and history', title: 'Has a doctor ever told you that you have diabetes?',
    help: 'Taking medicine for diabetes counts as yes. Borderline or prediabetes does not: the next question asks about that.',
    path: 'diabetes', label: 'Has diabetes', options: YES_NO },
  { id: 'glucoseHistory', section: 'Blood pressure and history', title: 'Have you ever been told your blood sugar was high?',
    help: 'In a health check, during an illness, or during pregnancy.',
    path: 'highGlucoseHistory', label: 'Ever told blood sugar was high', options: YES_NO },
  { id: 'afib', section: 'Blood pressure and history', title: 'Has a doctor ever told you that you have atrial fibrillation?',
    help: 'An irregular heart rhythm.',
    path: 'afib', label: 'Atrial fibrillation', options: YES_NO },
  { id: 'cvd', section: 'Blood pressure and history', title: 'Have you ever had a heart attack, angina or heart failure?',
    help: 'Narrowed arteries in the legs count too.',
    path: 'cvdHistory', label: 'Heart disease or heart failure', options: YES_NO },
  { id: 'stroke', section: 'Blood pressure and history', title: 'Have you ever had a stroke?',
    help: 'The stroke formulas estimate a first stroke, so they do not apply after one.',
    path: 'strokeHistory', label: 'Earlier stroke', options: YES_NO },
  { id: 'famStroke', section: 'Family', title: 'Has a parent, brother or sister had a stroke?',
    path: 'familyStroke', label: 'Parent or sibling had a stroke', options: YES_NO },
  { id: 'famDiabetes', section: 'Family', title: 'Does anyone in your family have diabetes?',
    path: 'familyDiabetes', label: 'Relatives with diabetes',
    options: [{ value: 'none', label: 'No' },
      { value: 'second', label: 'Grandparent, aunt, uncle or first cousin' },
      { value: 'first', label: 'Parent, brother, sister or child' }] },

  { id: 'cholesterol', section: 'Lab values (optional)', title: 'What are your cholesterol values?',
    help: 'From a blood test. Skip any lab value you do not have; the formulas that need it will say so.',
    fields: [{ path: 'labs.totalCholMgDl', label: 'Total cholesterol', unit: 'mg/dL', min: 80, max: 400 },
      { path: 'labs.hdlMgDl', label: 'HDL cholesterol', unit: 'mg/dL', min: 10, max: 120 }] },
  { id: 'glucose', section: 'Lab values (optional)', title: 'What are your blood sugar values?',
    help: 'From a blood test. Skip any lab value you do not have.',
    fields: [{ path: 'labs.fastingGlucoseMgDl', label: 'Fasting glucose', unit: 'mg/dL', min: 40, max: 500 },
      { path: 'labs.hba1cPct', label: 'HbA1c', unit: '%', min: 3.5, max: 16 }] },
  { id: 'lipids', section: 'Lab values (optional)', title: 'What are your LDL cholesterol and triglyceride values?',
    fields: [{ path: 'labs.ldlMgDl', label: 'LDL cholesterol', unit: 'mg/dL', min: 20, max: 300 },
      { path: 'labs.tgMgDl', label: 'Triglycerides', unit: 'mg/dL', min: 20, max: 2000 }] },
  { id: 'kidney', section: 'Lab values (optional)', title: 'What are your kidney test values?',
    help: 'Enter eGFR if your report prints it. Creatinine is the blood test it is worked out from.',
    fields: [{ path: 'labs.creatinineMgDl', label: 'Creatinine', unit: 'mg/dL', min: 0.3, max: 12 },
      { path: 'labs.egfrMlMin', label: 'eGFR', unit: 'mL/min/1.73 m²', min: 3, max: 150 }] },
  { id: 'liver', section: 'Lab values (optional)', title: 'What are your liver enzyme values?',
    fields: [{ path: 'labs.astUL', label: 'AST (GOT)', unit: 'U/L', min: 5, max: 500 },
      { path: 'labs.altUL', label: 'ALT (GPT)', unit: 'U/L', min: 5, max: 500 }] },
  { id: 'platelets', section: 'Lab values (optional)', title: 'What is your platelet count?',
    help: 'In thousands per microlitre. If your report prints 10,000/µL, multiply by 10 (18.0 becomes 180).',
    fields: [{ path: 'labs.plateletsK', label: 'Platelets', unit: '10³/µL', min: 20, max: 700 }] }
];

// A field the engine lists (js/engine/run.js QUESTIONS) that has no screen above, for example the
// input of a newly added formula, is asked plainly at the end, so no formula is left unanswerable.
QUESTIONS.push(...engineQuestions.map((x) => {
  if (!x || typeof x.key !== 'string' || QUESTIONS.some((q) => pathsOf(q).includes(x.key))) return null;
  const label = x.label || fieldLabel(x.key);
  if (x.type === 'number') {
    return { id: 'x-' + x.key, section: 'More answers', title: label,
      fields: [{ path: x.key, label, unit: x.unit || '', min: -Infinity, max: Infinity }] };
  }
  const options = x.type === 'yesno' ? YES_NO : (Array.isArray(x.options) ? x.options : [])
    .map((v) => ({ value: v, label: String(v).charAt(0).toUpperCase() + String(v).slice(1) }));
  return options.length ? { id: 'x-' + x.key, section: 'More answers', title: label, path: x.key, label, options } : null;
}).filter(Boolean));

/* ---------------- shared with the results view ---------------- */

// h('div.panel.tight', { onclick: fn, 'aria-label': 'x' }, child, [children], 'text')
// Strings always become text nodes; there is deliberately no way to inject markup.
export function h(spec, attrs, ...kids) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  const isAttrs = attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs);
  if (isAttrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') for (const [prop, val] of Object.entries(v)) el.style.setProperty(prop, val);
      else el.setAttribute(k, v === true ? '' : v);
    }
  } else kids.unshift(attrs);
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(add); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

/** Replace everything in `root` with the given nodes; null and false are skipped. */
export function mount(root, ...nodes) {
  root.replaceChildren(...nodes.filter((n) => n !== null && n !== undefined && n !== false));
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
}

function pathsOf(q) { return q.fields ? q.fields.map((f) => f.path) : [q.path]; }

/** The person in the shape the engine reads: { profile, labs } (docs/interfaces.md). */
export function personFrom(state) {
  return { profile: (state && state.profile) || {}, labs: (state && state.labs) || {} };
}

// Ids of the formulas that get a card on the results page. The engine keeps score-only formulas
// out of runAll, so an answer is not said to be "used by" a formula the person will never see.
let cardIds = null;
function hasCard(id) {
  if (!cardIds) {
    try { cardIds = new Set(host.ctx.runAll({ profile: {}, labs: {} }).map((r) => r && (r.modelId || r.id))); } catch (e) { cardIds = new Set(); }
  }
  return !cardIds.size || cardIds.has(id);
}

/** Names of the formulas that read the answers on this screen, e.g. ['Revised FSRP', 'CAIDE']. */
function usedBy(q) {
  const ids = new Set();
  pathsOf(q).forEach((path) => {
    const meta = engineQuestions.find((x) => x.key === path);
    (meta && Array.isArray(meta.usedBy) ? meta.usedBy : []).forEach((id) => ids.add(id));
  });
  return [...ids].filter(hasCard).map((id) => (EVIDENCE[id] ? EVIDENCE[id].name : id));
}

/** Where the person lives: the saved choice (record.region), else the region of their sample person. */
export function regionOf(state) {
  if (state && has(state.region)) return state.region;
  const persona = state && state.personaId ? PERSONAS.find((p) => p.id === state.personaId) : null;
  return persona ? persona.region : undefined;
}

/** One answer by its questionnaire path: 'age', 'labs.totalCholMgDl'. */
export function readAnswer(state, path) {
  const person = personFrom(state);
  if (path.startsWith('labs.')) return person.labs[path.slice(5)];
  if (path === 'record.region') return regionOf(state);
  return getPath(person.profile, path);
}

/** 'labs.tc' -> 'Total cholesterol'. Unknown paths are turned into readable words. */
export function fieldLabel(path) {
  for (const q of QUESTIONS) {
    if (q.path === path) return q.label;
    const f = q.fields && q.fields.find((x) => x.path === path);
    if (f) return f.short || f.label;
  }
  const words = String(path).split('.').pop().replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A stored answer as the person saw it: 'current' -> 'Currently', true -> 'Yes', 148 -> '148 mmHg'. */
export function answerText(path, value) {
  if (value === null || value === undefined || value === '') return '(blank)';
  for (const q of QUESTIONS) {
    if (q.path === path) {
      const option = q.options.find((o) => o.value === value);
      if (option) return option.label;
    }
    const f = q.fields && q.fields.find((x) => x.path === path);
    if (f) return value + ' ' + f.unit;
  }
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return String(value);
}

/** Whether the questionnaire has a question that asks for `path`. */
export function hasQuestionFor(path) {
  return QUESTIONS.some((q) => pathsOf(q).includes(path));
}

/** Make the questionnaire open at the question that asks for `path`. Returns false if none does. */
export function openQuestionFor(path) {
  const i = QUESTIONS.findIndex((q) => pathsOf(q).includes(path));
  if (i < 0) return false;
  step = i;
  owner = null;   // keep this step even if the next render is for another account
  rememberStep();
  return true;
}

/** After a page change, start keyboard and screen-reader users at the page heading. */
export function focusHeading(root) {
  const h1 = root.querySelector('h1');
  if (h1 && !root.contains(document.activeElement)) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
}

/** The disclaimer line, unless the page shell already shows it outside this view. */
export function disclaimer(root) {
  const shellHasIt = [...document.querySelectorAll('footer, .foot, [data-disclaimer]')]
    .some((el) => !root.contains(el) && /not a diagnosis/i.test(el.textContent));
  return shellHasIt ? null : h('p.disclaimer', { 'data-disclaimer': true }, DISCLAIMER);
}

/* ---------------- view state ---------------- */

let step = null;          // index of the question on screen
let owner = null;         // the account `step` belongs to
let host = null;          // { root, ctx } of the latest render call
let advanceTimer = null;
let shownQ = null, shownAt = 0;   // the question on screen and when it appeared
let confirmClear = false;         // "Start blank" asks once more before clearing
let confirmTimer = null;
let confirmAt = 0;
const drafts = {};        // path -> text being typed, kept if the app re-renders this view mid-typing

function rememberStep() {
  try { sessionStorage.setItem(STEP_KEY, QUESTIONS[step].id); } catch (e) { /* private mode */ }
}
function restoreStep() {
  let saved = null;
  try { saved = sessionStorage.getItem(STEP_KEY); } catch (e) { /* private mode */ }
  const i = QUESTIONS.findIndex((q) => q.id === saved);
  if (i >= 0) return i;
  return 0;
}

function stateNow() { return host.ctx.store.get() || {}; }
function has(v) { return v !== null && v !== undefined && v !== ''; }
function isAnswered(q, state) { return pathsOf(q).every((p) => has(readAnswer(state, p))); }
// A bare path is a profile field; 'labs.<key>' is a lab value. undefined clears the answer.
function save(path, value) {
  const store = host.ctx.store;
  if (path.startsWith('labs.')) store.setLabs({ [path.slice(5)]: value });
  else if (path === 'record.region') store.set({ region: value });   // kept on the record, not in the profile
  else store.setProfile({ [path]: value });
}
function go(hash) {
  if (host.ctx && typeof host.ctx.go === 'function') host.ctx.go(hash);
  else location.hash = hash;
}

/* ---------------- numbers ---------------- */

function parseNumber(text) {
  const t = String(text).trim().replace(',', '.');
  if (t === '' || !/^-?\d*\.?\d+$/.test(t)) return NaN;
  return Number(t);
}
function rangeError(f, text) {
  if (String(text).trim() === '') return '';
  const v = parseNumber(text);
  const name = f.short || f.label;
  if (Number.isNaN(v)) return name + ' must be a number. Leave it empty to skip.';
  if (v < f.min || v > f.max) return name + ' must be between ' + f.min + ' and ' + f.max + ' ' + f.unit + '. Leave it empty to skip.';
  return '';
}

function numberFields(q, state) {
  return h('div.qz-fields', { role: 'group', 'aria-labelledby': 'qz-count qz-title' }, q.fields.map((f) => {
    const id = 'qz-' + f.path.replace(/\./g, '-');
    const stored = readAnswer(state, f.path);
    const text = drafts[f.path] !== undefined ? drafts[f.path] : has(stored) ? String(stored) : '';
    const input = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', value: text,
      'data-path': f.path, 'aria-describedby': id + '-unit ' + (q.help ? 'qz-help ' : '') + 'qz-err',
      oninput: () => {
        drafts[f.path] = input.value;
        input.removeAttribute('aria-invalid');
        setError('');
        if (input.value.trim() === '') save(f.path, undefined);
        else if (!rangeError(f, input.value)) save(f.path, parseNumber(input.value));
        refreshNav();
      },
      onblur: () => {
        const message = rangeError(f, input.value);
        setError(message);
        if (message) input.setAttribute('aria-invalid', 'true');
      },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) next(); } } });   // a held key answers once
    return h('div.qz-field', h('label', { for: id }, f.label), h('div.qz-num', input, h('span.unit', { id: id + '-unit' }, f.unit)));
  }));
}

/* ---------------- choices ---------------- */

function choiceOptions(q, state) {
  const current = readAnswer(state, q.path);
  const inline = q.options.length <= 3 && q.options.every((o) => o.label.length <= 12);
  // Picking an option answers and moves on, which is what a button does; so these are a group of
  // toggle buttons (all reachable with Tab), not radios.
  return h('div.qz-opts' + (inline ? '.inline' : ''), { role: 'group', 'aria-labelledby': 'qz-count qz-title',
    'aria-describedby': q.help ? 'qz-help' : null,
    onkeydown: (e) => {
      const o = q.options[Number(e.key) - 1];
      if (e.repeat && (o || e.key === 'Enter')) { e.preventDefault(); return; }   // a held key answers once
      if (o && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); choose(q, o, true); }
    } },
  q.options.map((o, i) => h('button.qz-opt' + (current === o.value ? '.on' : ''),
    { type: 'button', 'aria-pressed': String(current === o.value), onclick: () => choose(q, o) },
    h('span.key', { 'aria-hidden': 'true' }, String(i + 1)), h('span', o.label))));
}

function choose(q, option, viaKey) {
  // A double-click or a key still held from the previous question must not answer this one too.
  if (!viaKey && performance.now() - shownAt < 300) return;
  save(q.path, option.value);
  draw();
  clearTimeout(advanceTimer);
  // only if this question is still on screen (the person may have left the page meanwhile)
  advanceTimer = setTimeout(() => { if (QUESTIONS[step] === q && host.root.querySelector('.qz')) next(); }, 240);
}

/* ---------------- navigation ---------------- */

function setError(message) {
  const el = host.root.querySelector('#qz-err');
  if (!el) return;
  if (message) el.replaceChildren(h('span.sr', 'Error: '), message); else el.replaceChildren();
}

function next() {
  clearTimeout(advanceTimer);
  const q = QUESTIONS[step];
  if (q.fields) {
    for (const f of q.fields) {
      const input = host.root.querySelector('input[data-path="' + f.path + '"]');
      const message = input ? rangeError(f, input.value) : '';
      if (message) { setError(message); input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    }
    q.fields.forEach((f) => { delete drafts[f.path]; });
  }
  if (step >= QUESTIONS.length - 1) { step = 0; rememberStep(); go('#/results'); return; }   // next visit starts at the top
  step += 1;
  draw();
}

function back() {
  clearTimeout(advanceTimer);
  if (step > 0) { step -= 1; draw(); }
}

function startBlank() {
  if (confirmClear && performance.now() - confirmAt < 500) return;   // the second click of a double-click
  clearTimeout(confirmTimer);
  if (!confirmClear) {
    confirmClear = true;
    confirmAt = performance.now();
    confirmTimer = setTimeout(() => { confirmClear = false; if (host.root.querySelector('.qz')) draw(); }, 4000);
    draw();
    const ask = host.root.querySelector('.qz-top .btn.danger');
    if (ask) ask.focus({ preventScroll: true });
    return;
  }
  confirmClear = false;
  clearTimeout(advanceTimer);
  Object.keys(drafts).forEach((k) => { delete drafts[k]; });
  // Clear the answers only. Saved lab reports and the chosen region stay with the record.
  host.ctx.store.set({ personaId: null, profile: {}, labs: {} });
  step = 0;
  draw();
}

// "Skip" while the question on screen has no answer, "Next" once it has one.
function refreshNav() {
  const btn = host.root.querySelector('#qz-next');
  if (!btn) return;
  const q = QUESTIONS[step], last = step === QUESTIONS.length - 1;
  const typed = q.fields ? q.fields.some((f) => has((drafts[f.path] || '').trim())) : false;
  const answered = typed || pathsOf(q).some((p) => has(readAnswer(stateNow(), p)));
  btn.textContent = last ? 'See my results' : answered ? 'Next' : 'Skip';
  btn.className = 'btn lg' + (answered || last ? '' : ' secondary');
}

/* ---------------- render ---------------- */

function draw() {
  const { root } = host;
  const state = stateNow();
  step = Math.max(0, Math.min(QUESTIONS.length - 1, step));
  rememberStep();
  const q = QUESTIONS[step];
  if (q !== shownQ) { shownQ = q; shownAt = performance.now(); }
  const formulas = usedBy(q);
  const done = QUESTIONS.filter((x) => isAnswered(x, state)).length;

  // keep the caret where it was if the app re-rendered this view while someone was typing
  const active = document.activeElement;
  const typingIn = active && root.contains(active) && active.getAttribute ? active.getAttribute('data-path') : null;

  mount(root,
    h('section.qz',
      h('div.qz-top',
        h('div', h('span.micro', 'Questionnaire · ' + q.section),
          h('div.qz-count', { id: 'qz-count' }, 'Question ' + (step + 1) + ' of ' + QUESTIONS.length, h('span.dim', ' · ' + done + ' answered'))),
        h('div.row',
          state.personaId ? h('span.sample-badge', 'Sample data') : null,
          done ? h('button.btn.sm.' + (confirmClear ? 'danger' : 'ghost'), { type: 'button', onclick: startBlank },
            confirmClear ? 'Clear all ' + done + ' answers?' : 'Start blank') : null,
          h('button.btn.sm.ghost', { type: 'button', onclick: () => go('#/results') }, 'See results'))),
      // one dot per question: progress at a glance, and a way to jump to any question
      h('div.qz-dots', { role: 'group', 'aria-label': 'All questions' }, QUESTIONS.map((x, i) =>
        h('button.qz-dot' + (isAnswered(x, state) ? '.done' : '') + (i === step ? '.on' : ''),
          { type: 'button', title: (i + 1) + '. ' + x.title, 'aria-label': 'Question ' + (i + 1) + ': ' + x.title + (isAnswered(x, state) ? ' (answered)' : ''),
            'aria-current': i === step ? 'step' : null, onclick: () => { clearTimeout(advanceTimer); step = i; draw(); } }))),
      h('div.qz-card',
        h('h1.qz-title', { id: 'qz-title' }, q.title),
        q.help ? h('p.qz-help', { id: 'qz-help' }, q.help) : null,
        h('div.qz-body', q.fields ? numberFields(q, state) : choiceOptions(q, state),
          // which formulas read this answer
          formulas.length ? h('div.qz-used', h('span', 'Used by'), formulas.map((f) => h('span.pill.plain.mute', f))) : null),
        h('p.qz-err', { id: 'qz-err', role: 'alert' }),
        h('div.qz-nav',
          h('button.btn.lg.ghost', { type: 'button', onclick: back, disabled: step === 0 }, 'Back'),
          q.fields ? h('span.grow') : h('span.grow.qz-note', 'Choosing an answer moves you on.'),
          h('button.btn.lg', { type: 'button', id: 'qz-next', onclick: next }, 'Next')))),
    disclaimer(root));

  refreshNav();
  const again = typingIn ? root.querySelector('input[data-path="' + typingIn + '"]') : null;
  const target = again || root.querySelector('.qz-fields input') || root.querySelector('.qz-opt.on') || root.querySelector('.qz-opt');
  if (target) {
    target.focus({ preventScroll: true });
    if (target.tagName === 'INPUT') { const end = target.value.length; target.setSelectionRange(end, end); }
  }
}

export function render(root, ctx) {
  host = { root, ctx };
  clearTimeout(advanceTimer);
  // Text typed before leaving the page is not kept: the store may have changed in between.
  Object.keys(drafts).forEach((k) => { delete drafts[k]; });
  // Another account starts at its own first question.
  const user = typeof ctx.store.user === 'function' ? ctx.store.user() : '';
  let savedOwner = null;
  try { savedOwner = sessionStorage.getItem(STEP_KEY + '-owner'); } catch (e) { /* private mode */ }
  const otherAccount = owner !== null ? owner !== user : step === null && savedOwner !== null && savedOwner !== user;
  if (otherAccount) {
    step = null;
    try { sessionStorage.removeItem(STEP_KEY); } catch (e) { /* private mode */ }
  }
  owner = user;
  try { sessionStorage.setItem(STEP_KEY + '-owner', user); } catch (e) { /* private mode */ }
  clearTimeout(confirmTimer);
  if (step === null) step = restoreStep();
  shownQ = null;
  confirmClear = false;
  window.scrollTo(0, 0);   // the router keeps the previous page's scroll position
  draw();
}
