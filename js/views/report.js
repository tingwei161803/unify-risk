// Lab report page (#/report, issue #6).
//
// 1. The person picks or drops a photo or PDF of a check-up report.
// 2. ctx.callApi('recognize', { filename, dataUrl }) asks the server (api/recognize.py) to copy
//    the printed values. If that call fails for any reason, the page loads a fictional sample
//    report instead and says "demo data". The flow never blocks.
// 3. Every value is shown in its own row with its unit, printed range and how clearly it was
//    read. The person corrects anything that is wrong and ticks each row and the report date.
// 4. Only then "Save to my record" calls ctx.store.addReport(report), which merges report.labs
//    into the record. Measurements printed on the report (height, weight, waist, blood
//    pressure) go to the profile with ctx.store.setProfile().
//
// Units (#42): a value printed in another known unit (for example cholesterol in mmol/L) is
// converted to the unit the app stores, and the printed value and unit stay on the saved item.
// A value in a unit the app cannot convert blocks Save until it is corrected; ticking the row
// does not override that.
// Dates (#42): an older report never overwrites newer values. For each value on the report, if
// another report of the same person (or the sample person's own latest report) is more recent,
// the current value is kept and the older report is saved as history only.
//
// Saved report: { date, source, labs, measurements, items, lab, demo, personId }
//   labs: Person.labs keys; items: [{ key, label, value, unit, range, flag,
//   printedValue?, printedUnit?, converted? }] as checked; personId: the sample person the
//   record belongs to, so reports of different people are not mixed.
// Everything that comes from a file or the API is written with textContent.

const MEASUREMENTS = {
  heightCm: ['Height', 'cm'], weightKg: ['Weight', 'kg'], waistCm: ['Waist circumference', 'cm'],
  sbp: ['Systolic blood pressure', 'mmHg'], dbp: ['Diastolic blood pressure', 'mmHg']
};
const LABS = {
  totalCholMgDl: ['Total cholesterol', 'mg/dL'], hdlMgDl: ['HDL cholesterol', 'mg/dL'],
  ldlMgDl: ['LDL cholesterol', 'mg/dL'], tgMgDl: ['Triglycerides', 'mg/dL'],
  fastingGlucoseMgDl: ['Fasting glucose', 'mg/dL'], hba1cPct: ['HbA1c', '%'],
  creatinineMgDl: ['Creatinine', 'mg/dL'], egfrMlMin: ['eGFR', 'mL/min/1.73m²'],
  uacrMgG: ['Urine albumin-to-creatinine ratio', 'mg/g'], astUL: ['AST (GOT)', 'U/L'],
  altUL: ['ALT (GPT)', 'U/L'], plateletsK: ['Platelets', '10³/µL']
};
const SHOWN_ONLY = { bmi: ['Body-mass index (BMI)', 'kg/m²'] };
// Names for the "Saved as" menu (the unit is in its own column).
const SHORT = {
  heightCm: 'Height', weightKg: 'Weight', waistCm: 'Waist', sbp: 'Systolic BP', dbp: 'Diastolic BP',
  totalCholMgDl: 'Total cholesterol', hdlMgDl: 'HDL', ldlMgDl: 'LDL', tgMgDl: 'Triglycerides',
  fastingGlucoseMgDl: 'Fasting glucose', hba1cPct: 'HbA1c', creatinineMgDl: 'Creatinine',
  egfrMlMin: 'eGFR', uacrMgG: 'UACR', astUL: 'AST', altUL: 'ALT', plateletsK: 'Platelets'
};
const KEYS = { ...MEASUREMENTS, ...LABS, ...SHOWN_ONLY };
// Conversions to the unit the app stores (the unit is part of each key, docs/interfaces.md).
// Keys are unit spellings as normalised by unitKey(). mg/dL per mmol/L follows from molar mass:
//   cholesterol (total, HDL, LDL) × 38.67, the factor CAIDE already uses in js/engine/formulas/caide.js
//   triglycerides × 88.57; glucose × 18.016; creatinine µmol/L ÷ 88.4
//   UACR mg/mmol × 8.84 (creatinine 113.12 g/mol)
//   HbA1c IFCC mmol/mol → NGSP % = 0.0915 × IFCC + 2.15 (IFCC–NGSP master equation,
//     Hoelzel W, et al. Clin Chem 2004;50:166–174)
//   weight lb × 0.45359237; height and waist in × 2.54 (exact by definition)
const CHOL = { 'mmol/l': [(v) => v * 38.67, '× 38.67'] };
const INCH = [(v) => v * 2.54, '× 2.54'];
const POUND = [(v) => v * 0.45359237, '× 0.4536'];
const CONVERT = {
  totalCholMgDl: CHOL, hdlMgDl: CHOL, ldlMgDl: CHOL,
  tgMgDl: { 'mmol/l': [(v) => v * 88.57, '× 88.57'] },
  fastingGlucoseMgDl: { 'mmol/l': [(v) => v * 18.016, '× 18.016'] },
  creatinineMgDl: { 'umol/l': [(v) => v / 88.4, '÷ 88.4'] },
  uacrMgG: { 'mg/mmol': [(v) => v * 8.84, '× 8.84'] },
  hba1cPct: { 'mmol/mol': [(v) => 0.0915 * v + 2.15, '0.0915 × value + 2.15'] },
  weightKg: { lb: POUND, lbs: POUND },
  heightCm: { in: INCH, inch: INCH, inches: INCH },
  waistCm: { in: INCH, inch: INCH, inches: INCH }
};
// How a convertible unit is written in messages.
const UNIT_NAME = { 'mmol/l': 'mmol/L', 'umol/l': 'µmol/L', lb: 'lb', lbs: 'lb', in: 'in', inch: 'in', inches: 'in' };
// Other spellings of the unit the app stores (same number, nothing to convert).
const SAME = {
  astUL: ['iu/l'], altUL: ['iu/l'],
  plateletsK: ['109/l', 'k/ul', '1000/ul'],
  egfrMlMin: ['ml/min'],
  uacrMgG: ['mg/gcr', 'mg/gcreatinine', 'ug/mg'],
  hba1cPct: ['%ngsp']
};
const READ = {
  high: ['Clear', 'Read clearly'],
  medium: ['Check', 'Read through blur or an unusual layout. Compare it with your paper.'],
  low: ['Unsure', 'The reader was unsure. Compare it with your paper.'],
  sample: ['Sample', 'From a fictional sample report'],
  typed: ['Typed', 'Typed in by you']
};

const CSS = `
:root {
  --rr-surface: var(--surface, #ffffff); --rr-ink: var(--ink, #1d2327); --rr-muted: var(--muted, #5d6870);
  --rr-line: var(--line, #dcdad2); --rr-accent: var(--accent, #0b6e69); --rr-warn: var(--warn, #a4580c);
  --rr-good: var(--good, #1d6b45); --rr-radius: var(--radius, 12px);
  --rr-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
.rr { color-scheme: light; } /* matches the light tokens in css/app.css */
.rr-drop { display: grid; justify-items: center; gap: 4px; text-align: center; cursor: pointer;
  padding: 32px 20px; border: 2px dashed var(--rr-line); transition: border-color .15s ease, background .15s ease; }
.rr-drop:hover, .rr-drop.is-over { border-color: var(--rr-accent);
  background: color-mix(in srgb, var(--rr-accent) 5%, var(--rr-surface)); }
.rr-drop:focus-within { border-color: var(--rr-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--rr-accent) 30%, transparent); }
.rr-drop strong { font-size: 1.15rem; color: var(--rr-ink); }
.rr-file { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
.rr-alt { margin: 0 0 8px; }
.rr-status { min-height: 1.5em; margin: 12px 0 0; font-variant-numeric: tabular-nums; }
.rr-status.is-good { color: var(--rr-good); }
.rr-note { margin: 16px 0 0; padding: 12px 16px; border-radius: 10px; font-size: .95rem;
  border: 1px solid color-mix(in srgb, var(--rr-warn) 40%, transparent);
  background: color-mix(in srgb, var(--rr-warn) 7%, var(--rr-surface)); }
.rr-tag { font-family: var(--rr-mono); font-size: .68rem; letter-spacing: .12em; text-transform: uppercase;
  font-weight: 600; margin-right: 8px; color: var(--rr-warn); }
.rr-label { font-family: var(--rr-mono); font-size: .68rem; letter-spacing: .14em; text-transform: uppercase;
  color: var(--rr-muted); margin: 0 0 10px; }
.rr-review { margin: 28px 0 0; }
.rr-meta-grid { display: grid; grid-template-columns: 200px minmax(0, 1fr) auto; gap: 16px; align-items: end; }
.rr-f { display: grid; gap: 4px; min-width: 0; }
.rr-f > span { font-size: .8rem; color: var(--rr-muted); }
.rr .rr-in { min-width: 0; width: 100%; height: 46px; padding: 8px 12px; color: var(--rr-ink); }
.rr .rr-in:focus-visible { outline: none; border-color: var(--rr-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--rr-accent) 30%, transparent); }
.rr .rr-num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.rr .rr-in.is-empty { border-color: var(--rr-warn); }
.rr-chip.is-unit:empty { display: none; }
.rr-check { display: inline-flex; align-items: center; gap: 10px; min-height: 46px; cursor: pointer; white-space: nowrap; }
.rr-check input { width: 22px; height: 22px; margin: 0; accent-color: var(--rr-good); cursor: pointer; }
.rr-check input:focus-visible { outline: 2px solid var(--rr-accent); outline-offset: 2px; }
.rr-progress { display: flex; align-items: center; gap: 14px; margin: 24px 0 12px; color: var(--rr-muted);
  font-size: .9rem; font-variant-numeric: tabular-nums; }
.rr-bar { flex: 1; max-width: 240px; height: 6px; border-radius: 999px; background: var(--rr-line); overflow: hidden; }
.rr-bar > i { display: block; height: 100%; width: 0; background: var(--rr-good); transition: width .2s ease; }
.rr-items { list-style: none; margin: 0; padding: 0; }
.rr-item { padding: 14px 18px; margin-bottom: 12px; }
.rr-item.is-unsure { box-shadow: inset 4px 0 0 var(--rr-warn); }
.rr-item.is-checked { border-color: color-mix(in srgb, var(--rr-good) 45%, var(--rr-line)); }
.rr-item-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 0 10px; }
.rr-name { font-weight: 650; }
.rr-chip { font-size: .72rem; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--rr-line);
  color: var(--rr-muted); white-space: nowrap; }
.rr-chip.is-high { color: var(--rr-good); border-color: color-mix(in srgb, var(--rr-good) 40%, transparent); }
.rr-chip.is-medium, .rr-chip.is-low, .rr-chip.is-flag { color: var(--rr-warn); border-color: color-mix(in srgb, var(--rr-warn) 45%, transparent); }
.rr-chip.is-conv { color: var(--rr-accent); border-color: color-mix(in srgb, var(--rr-accent) 40%, transparent); }
.rr-item.is-blocked { box-shadow: inset 4px 0 0 var(--rr-warn); border-color: color-mix(in srgb, var(--rr-warn) 55%, var(--rr-line)); }
.rr-done .rr-note { margin: 12px 0 16px; }
.rr-done ul { margin: 0 0 16px; padding-left: 20px; }
.rr-spacer { flex: 1; }
.rr-item-head .link { margin-left: auto; } /* stays on the right when the header wraps */
.rr-grid, .rr-cols { display: grid; grid-template-columns: 110px 150px minmax(0, .9fr) minmax(0, 1.4fr) 128px; gap: 12px; align-items: center; }
.rr-cols { padding: 0 19px 6px; font-family: var(--rr-mono); font-size: .66rem; letter-spacing: .12em; text-transform: uppercase; color: var(--rr-muted); }
.rr-grid .rr-f > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.rr-hint { font-size: .9rem; margin: 4px 0 16px; }
.rr-actions .btn:disabled { opacity: .45; cursor: not-allowed; }
.rr-done { margin-top: 20px; }
.rr-done h2 { color: var(--rr-good); }
@media (max-width: 720px) {
  .rr-meta-grid { grid-template-columns: 1fr; }
  .rr-cols { display: none; }
  .rr-grid { grid-template-columns: 1fr 1fr; align-items: end; }
  .rr-grid .rr-f > span { position: static; width: auto; height: auto; overflow: visible; clip: auto; }
  .rr-grid .rr-f-key { grid-column: 1 / -1; order: 5; }
  .rr-actions .btn { flex: 1 1 100%; text-align: center; }
}
@media (prefers-reduced-motion: reduce) { .rr * { transition: none !important; } }
@media print {
  .rr-drop, .rr-alt, .rr-actions, .rr-check, .rr-note, .rr-progress, .rr-hint, .link { display: none !important; }
  .rr-item { break-inside: avoid; box-shadow: none; }
}
`;

export function render(root, ctx) {
  addStyles();
  const view = el('div', { class: 'rr' });
  root.append(view);

  const input = el('input', { type: 'file', id: 'rr-file', class: 'rr-file', accept: 'application/pdf,image/png,image/jpeg,image/webp' });
  const drop = el('label', { class: 'card rr-drop', for: 'rr-file' }, input,
    el('strong', {}, 'Choose a report file'),
    el('span', { class: 'muted' }, 'or drop it here · PDF, PNG, JPEG or WebP, up to 10 MB · a clear phone photo works'));
  const sampleBtn = el('button', { type: 'button', class: 'btn secondary' }, 'Use a sample report');
  const status = el('p', { class: 'rr-status muted', role: 'status', 'aria-live': 'polite' });
  const note = el('div', { class: 'rr-note', hidden: '' });
  const form = el('form', { class: 'rr-review', hidden: '', novalidate: '' });
  const done = el('div', { class: 'card rr-done', hidden: '' });

  view.append(
    el('h1', {}, 'Lab report'),
    el('p', { class: 'lead' }, 'Upload a photo or PDF of a check-up report. We copy the numbers printed on it, ' +
      'and you check each one before it goes into your record.'),
    drop,
    el('div', { class: 'row rr-alt' }, el('span', { class: 'muted' }, 'No report at hand?'), sampleBtn),
    status, note, form, done);

  let state = null;
  let ticker = null;

  input.addEventListener('change', () => { if (input.files[0]) read(input.files[0]); });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    if (e.dataTransfer?.files?.[0]) read(e.dataTransfer.files[0]);
  });
  sampleBtn.addEventListener('click', async () => show(await demoReport(ctx, '', 'You chose a sample report.')));
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });

  async function read(file) {
    form.hidden = true; note.hidden = true; done.hidden = true;
    const started = Date.now();
    const tick = () => say(`Reading ${file.name}… ${Math.round((Date.now() - started) / 1000)} s ` +
      '(this can take up to a minute)');
    tick();
    clearInterval(ticker);
    ticker = setInterval(tick, 1000);
    let result;
    try {
      const dataUrl = await asDataUrl(file);
      const reply = await ctx.callApi('recognize', { filename: file.name, dataUrl });
      if (!reply?.report?.labs) throw new Error('The reader sent an unexpected answer.');
      result = fromReply(reply, file.name);
    } catch (error) {
      result = await demoReport(ctx, file.name, readable(error));
    } finally {
      clearInterval(ticker);
    }
    show(result);
  }

  function show(result) {
    done.hidden = true;
    state = {
      result,
      date: result.date, dateChecked: false,
      rows: result.items.map((item, i) => ({ ...item, id: i, checked: false }))
    };
    if (result.demo) {
      note.replaceChildren(el('span', { class: 'rr-tag' }, 'Demo data'),
        `${result.reason} The values below come from a fictional sample report${result.sampleOf ? ` (${result.sampleOf})` : ''}, ` +
        'so you can try the rest of the flow.');
    }
    note.hidden = !result.demo;
    const n = state.rows.length;
    say(n ? `Found ${n} value${n === 1 ? '' : 's'}${result.date ? ` on the report dated ${result.date}` : ''}. Check each one below.`
      : 'No values were found. Add them by hand below, or try a clearer photo.');
    draw();
  }

  function draw() {
    const dateInput = el('input', { type: 'date', class: 'field rr-in', value: state.date, 'aria-label': 'Report date' });
    dateInput.addEventListener('input', () => { state.date = dateInput.value; update(); });
    const dateCheck = checkbox('Date checked', state.dateChecked, (on) => { state.dateChecked = on; update(); });
    const list = el('ol', { class: 'rr-items' }, ...state.rows.map(drawRow));
    const cols = el('div', { class: 'rr-cols', 'aria-hidden': 'true' },
      el('span', {}, 'Value'), el('span', {}, 'Unit'), el('span', {}, 'Printed range'), el('span', {}, 'Saved as'), el('span', {}, ''));
    const progressText = el('span');
    const bar = el('i');
    const saveBtn = el('button', { type: 'submit', class: 'btn' }, 'Save to my record');
    const allBtn = el('button', { type: 'button', class: 'btn secondary' }, 'Confirm all after checking');
    const addBtn = el('button', { type: 'button', class: 'btn secondary' }, 'Add a value');

    allBtn.addEventListener('click', () => {
      state.dateChecked = true;
      state.rows.forEach((row) => { if (complete(row) && unitReady(row)) row.checked = true; });
      draw();
      const units = state.rows.filter((row) => complete(row) && !unitReady(row)).length;
      const left = state.rows.filter((row) => !row.checked).length - units;
      const parts = [];
      if (left) parts.push(`${left} row${left === 1 ? ' needs' : 's need'} a value or a test name first.`);
      if (units) parts.push(`${units} row${units === 1 ? ' has' : 's have'} a unit the app cannot use; fix ${units === 1 ? 'it' : 'them'} before saving.`);
      say(parts.length ? parts.join(' ') : 'Everything is checked.', parts.length ? 'warn' : 'is-good');
    });
    addBtn.addEventListener('click', () => {
      state.rows.push({ id: Date.now(), key: 'totalCholMgDl', label: KEYS.totalCholMgDl[0], value: '', unit: KEYS.totalCholMgDl[1],
        range: '', flag: '', confidence: 'typed', checked: false });
      draw();
      form.querySelector('.rr-item:last-child input')?.focus();
    });

    form.replaceChildren(
      el('div', { class: 'card' },
        el('p', { class: 'rr-label' }, 'Report'),
        el('div', { class: 'rr-meta-grid' },
          el('label', { class: 'rr-f' }, el('span', {}, 'Report date'), dateInput),
          el('div', { class: 'rr-f' }, el('span', {}, 'File'),
            el('span', { class: 'muted' }, [state.result.source, state.result.lab].filter(Boolean).join(' · ') || '—')),
          dateCheck)),
      el('div', { class: 'rr-progress' }, progressText, el('div', { class: 'rr-bar', 'aria-hidden': 'true' }, bar)),
      ...(state.rows.length ? [cols, list] : [el('p', { class: 'card muted' }, 'No values yet. Use “Add a value” to type them in.')]),
      el('p', { class: 'muted rr-hint' }, 'Compare each row with your paper report. Fix anything that was read wrong, ' +
        'then tick Checked. Rows marked Check or Unsure need a closer look.'),
      el('div', { class: 'row rr-actions' }, addBtn, allBtn, saveBtn));
    form.hidden = false;

    function update() {
      const count = state.rows.filter((row) => row.checked).length + (state.dateChecked ? 1 : 0);
      const total = state.rows.length + 1;
      const blocked = state.rows.filter((row) => complete(row) && !unitReady(row)).length;
      progressText.textContent = `${count} of ${total} checked: ${state.rows.length} value${state.rows.length === 1 ? '' : 's'} and the date` +
        (blocked ? ` · ${blocked} unit${blocked === 1 ? '' : 's'} to fix` : '');
      bar.style.width = `${Math.round((count / total) * 100)}%`;
      // A wrong unit blocks Save even when its row is ticked (#42).
      saveBtn.disabled = !(state.rows.length && count === total && state.date && state.rows.every(complete) && !blocked);
    }
    state.update = update;
    update();
  }

  function drawRow(row) {
    const [chipText, chipTitle] = READ[row.confidence] || READ.low;
    const value = el('input', { class: 'field rr-in rr-num', inputmode: 'decimal', value: String(row.value ?? ''), 'aria-label': `${row.label} value` });
    const unit = el('input', { class: 'field rr-in', value: row.unit, 'aria-label': `${row.label} unit` });
    const unitWarn = el('span', { class: 'rr-chip is-flag is-unit', title: 'The printed unit is not the one the app expects' });
    const range = el('input', { class: 'field rr-in', value: row.range, 'aria-label': `${row.label} printed range` });
    const key = el('select', { class: 'field rr-in', 'aria-label': `What ${row.label} is saved as` },
      el('optgroup', { label: 'Lab values' }, ...Object.keys(LABS).map((k) => el('option', { value: k }, SHORT[k]))),
      el('optgroup', { label: 'Measurements' }, ...Object.keys(MEASUREMENTS).map((k) => el('option', { value: k }, SHORT[k]))),
      el('optgroup', { label: 'Not saved' },
        el('option', { value: 'bmi' }, 'BMI (the app works it out)'),
        el('option', { value: 'other' }, 'Other test (kept with the report only)')));
    key.value = KEYS[row.key] ? row.key : 'other';
    const remove = el('button', { type: 'button', class: 'link' }, 'Remove');
    const item = el('li', { class: `card rr-item${['medium', 'low'].includes(row.confidence) ? ' is-unsure' : ''}` },
      el('div', { class: 'rr-item-head' },
        el('span', { class: 'rr-name' }, row.label),
        ['medium', 'low', 'typed'].includes(row.confidence) ? el('span', { class: `rr-chip is-${row.confidence}`, title: chipTitle }, chipText) : null,
        row.flag ? el('span', { class: 'rr-chip is-flag', title: 'Marked on the report' }, row.flag === 'H' ? 'High on report' : 'Low on report') : null,
        unitWarn,
        el('span', { class: 'rr-spacer' }), remove),
      el('div', { class: 'rr-grid' },
        el('label', { class: 'rr-f' }, el('span', {}, 'Value'), value),
        el('label', { class: 'rr-f' }, el('span', {}, 'Unit'), unit),
        el('label', { class: 'rr-f rr-f-range' }, el('span', {}, 'Printed range'), range),
        el('label', { class: 'rr-f rr-f-key' }, el('span', {}, 'Saved as'), key),
        checkbox('Checked', row.checked, (on) => { row.checked = on; item.classList.toggle('is-checked', on); state.update(); },
          `Checked: ${row.label}`)));
    item.classList.toggle('is-checked', row.checked);

    const sync = () => {
      const check = unitCheck(row);
      const stored = (LABS[row.key] || MEASUREMENTS[row.key])?.[1];
      unitWarn.textContent = check.state === 'convert' ? `Saved as ${check.value} ${stored} (${row.value} ${row.unit} ${check.factor})`
        : check.state === 'blocked' ? check.message : '';
      unitWarn.classList.toggle('is-flag', check.state === 'blocked');
      unitWarn.classList.toggle('is-conv', check.state === 'convert');
      unitWarn.title = check.state === 'convert' ? 'Converted to the unit the app stores; the printed value is kept with the report'
        : 'The app cannot use this unit as it is';
      item.classList.toggle('is-blocked', check.state === 'blocked');
      unit.setAttribute('aria-invalid', String(check.state === 'blocked' && /unit/i.test(check.message)));
      value.setAttribute('aria-invalid', String(check.state === 'blocked' && !/unit/i.test(check.message)));
      value.classList.toggle('is-empty', String(row.value ?? '').trim() === '');
      state.update?.();
    };
    value.addEventListener('input', () => { row.value = asValue(value.value); sync(); });
    unit.addEventListener('input', () => { row.unit = unit.value.trim(); sync(); });
    range.addEventListener('input', () => { row.range = range.value.trim(); });
    key.addEventListener('change', () => {
      row.key = key.value;
      if (!row.unit && KEYS[row.key]) { row.unit = KEYS[row.key][1]; unit.value = row.unit; }
      sync();
    });
    remove.addEventListener('click', () => {
      state.rows = state.rows.filter((r) => r !== row);
      draw();
      say(`Removed ${row.label}.`);
    });
    sync();
    return item;
  }

  async function save() {
    if (!state) return;
    const ready = state.rows.length && state.date && state.dateChecked && state.rows.every((row) => row.checked && complete(row));
    if (!ready) return say('Check every row and the report date first.', 'warn');
    const blocked = state.rows.filter((row) => !unitReady(row));
    if (blocked.length) return say(`Fix the unit on ${blocked.map((row) => row.label).join(', ')} first.`, 'warn');

    // Store each value in the app's unit; a converted value keeps what was printed (#42).
    const items = state.rows.map((row) => {
      const { key, label, value, unit, range, flag } = row;
      const check = unitCheck(row);
      if (check.state !== 'convert') return { key, label, value, unit, range, flag };
      const stored = (LABS[key] || MEASUREMENTS[key])[1];
      return { key, label, value: check.value, unit: stored, range, flag, printedValue: value, printedUnit: unit, converted: check.factor };
    });
    const pick = (table) => Object.fromEntries(items.filter((it) => table[it.key] && typeof it.value === 'number').map((it) => [it.key, it.value]));
    const labs = pick(LABS);
    const measurements = pick(MEASUREMENTS);
    const { result } = state;

    // Which values are newer elsewhere: other reports of this person, or the sample person's own
    // latest report (the values loadPersona copied). Read before the new report is added.
    const record = ctx.store.get();
    const personId = record.personaId || null;
    const before = { ...record.labs };
    const others = await datedSources(record, personId);
    const date = String(state.date);
    const newerFor = (key, part) => others.find((s) => typeof s[part][key] === 'number' && s.date > date);

    ctx.store.addReport({ date: state.date, source: result.source, labs, measurements, items, lab: result.lab || '',
      demo: result.demo, ...(personId ? { personId } : {}) });

    // addReport merges every lab value; put back the ones a newer report already gives.
    const keepLabs = {};
    const applyMeasurements = {};
    let kept = 0;
    for (const key of Object.keys(labs)) {
      const newer = newerFor(key, 'labs');
      if (!newer) continue;
      keepLabs[key] = key in before ? before[key] : newer.labs[key];
      kept++;
    }
    for (const [key, value] of Object.entries(measurements)) {
      if (newerFor(key, 'measurements')) kept++;
      else applyMeasurements[key] = value;
    }
    if (Object.keys(keepLabs).length) ctx.store.setLabs(keepLabs);
    if (Object.keys(applyMeasurements).length) ctx.store.setProfile(applyMeasurements);

    const saved = Object.keys(labs).length + Object.keys(measurements).length;
    const applied = saved - kept;
    const latest = others.map((s) => s.date).filter(Boolean).sort().pop() || '';
    const older = Boolean(latest && date && date < latest);
    const conversions = items.filter((it) => it.converted);
    form.hidden = true;
    note.hidden = true;
    say('');
    done.replaceChildren(
      el('h2', {}, older ? `Saved the report dated ${state.date} as history` : `Saved ${saved} value${saved === 1 ? '' : 's'} from the report dated ${state.date}`),
      older ? el('p', { class: 'rr-note' }, el('span', { class: 'rr-tag' }, 'Older report'),
        applied ? `This report (${state.date}) is older than your latest (${latest}). It is saved as history; ` +
          `${applied} value${applied === 1 ? ' that no newer report has was' : 's that no newer report has were'} added to your record.`
          : `This report (${state.date}) is older than your latest (${latest}). It is saved as history and does not change your current values.`) : null,
      conversions.length ? el('ul', {}, ...conversions.map((it) =>
        el('li', {}, `${it.label}: printed ${it.printedValue} ${it.printedUnit}, saved as ${it.value} ${it.unit} (${it.converted})`))) : null,
      older ? null : el('p', { class: 'muted' }, `${Object.keys(labs).length} lab value${Object.keys(labs).length === 1 ? '' : 's'} and ` +
        `${Object.keys(measurements).length} measurement${Object.keys(measurements).length === 1 ? '' : 's'} are now in your record` +
        `${result.demo ? ' (from a fictional sample report)' : ''}. Other tests stay with the report.`),
      el('div', { class: 'row' }, el('a', { class: 'btn', href: '#/results' }, 'See your results'),
        el('button', { type: 'button', class: 'btn secondary', onclick: () => { done.hidden = true; input.value = ''; input.focus(); } }, 'Add another report')));
    done.hidden = false;
  }

  function say(text, kind = '') {
    status.textContent = text;
    status.className = `rr-status ${kind || 'muted'}`;
  }
}

// ---- data -----------------------------------------------------------------------------------

function fromReply(reply, filename) {
  const items = Array.isArray(reply.items) && reply.items.length ? reply.items
    : Object.entries({ ...(reply.measurements || {}), ...reply.report.labs }).map(([key, value]) =>
      ({ key, label: KEYS[key]?.[0] || key, value, unit: KEYS[key]?.[1] || '', range: '', flag: '', confidence: 'medium' }));
  return {
    demo: reply.demo === true, reason: reply.demo ? 'The server sent sample values.' : '',
    date: String(reply.report.date || ''), source: String(reply.report.source || filename), lab: String(reply.lab || ''),
    items: items.map(cleanItem)
  };
}

// A fictional sample report: js/data/reports.js when it exists, else the sample person's own labs.
async function demoReport(ctx, filename, reason) {
  const stem = filename.replace(/\.[^.]+$/, '');
  const record = ctx.store.get();
  try {
    const { REPORTS } = await import('../data/reports.js');
    const report = REPORTS.find((r) => r.file && r.file.split('/').pop() === filename) || REPORTS.find((r) => r.id === stem) ||
      newest(REPORTS.filter((r) => r.personId === stem.split('-')[0])) || newest(REPORTS.filter((r) => r.personId === record.personaId)) ||
      newest(REPORTS);
    if (report) {
      return { demo: true, reason, date: report.date || '', source: filename || `${report.id} (sample)`, lab: report.lab || '',
        sampleOf: report.personId, items: report.items.map((it) => cleanItem({ ...it, confidence: 'sample' })) };
    }
  } catch { /* js/data/reports.js is not on main yet */ }
  const { PERSONAS } = await import('../data/personas.js');
  const person = PERSONAS.find((p) => p.id === stem.split('-')[0]) || PERSONAS.find((p) => p.id === record.personaId) ||
    PERSONAS.find((p) => p.labs && Object.keys(p.labs).length);
  const ranges = person?.report?.printedRanges || {};
  const values = { ...pickKeys(person?.profile || {}, MEASUREMENTS), ...pickKeys(person?.labs || {}, LABS) };
  return {
    demo: true, reason, date: person?.report?.date || '', source: filename || 'sample report', lab: '', sampleOf: person?.name,
    items: Object.entries(values).map(([key, value]) => cleanItem({ key, label: KEYS[key][0], value, unit: KEYS[key][1],
      range: ranges[key] || '', flag: flagFor(value, ranges[key], key), confidence: 'sample' }))
  };
}

function cleanItem(it) {
  const key = KEYS[it.key] ? it.key : 'other';
  return {
    key, label: String(it.label || KEYS[key]?.[0] || 'Other test').slice(0, 80), value: asValue(it.value),
    unit: String(it.unit ?? '').slice(0, 30), range: String(it.range ?? '').slice(0, 40),
    flag: it.flag === 'H' || it.flag === 'L' ? it.flag : '',
    confidence: READ[it.confidence] ? it.confidence : 'low'
  };
}

// 'H' above the printed range, 'L' below it, '' inside or when the range cannot be read.
function flagFor(value, range, key) {
  if (typeof value !== 'number' || !range) return '';
  let text = String(range).replace(/^[a-z ]+/i, '').trim(); // drop "men ", "women "
  const pair = text.match(/^([<≤>≥]?)\s*([\d.]+)\s*\/\s*([\d.]+)$/); // blood pressure: "<130/85"
  if (pair) text = pair[1] + (key === 'dbp' ? pair[3] : pair[2]);
  const num = (s) => Number(String(s).replace(/[^\d.]/g, ''));
  const between = text.match(/^([\d.]+)\s*[–-]\s*([\d.]+)$/);
  if (between) return value < num(between[1]) ? 'L' : value > num(between[2]) ? 'H' : '';
  if (/^</.test(text)) return value >= num(text) ? 'H' : '';
  if (/^≤/.test(text)) return value > num(text) ? 'H' : '';
  if (/^>/.test(text)) return value <= num(text) ? 'L' : '';
  if (/^≥/.test(text)) return value < num(text) ? 'L' : '';
  return '';
}

function pickKeys(source, table) {
  return Object.fromEntries(Object.entries(source).filter(([k, v]) => table[k] && typeof v === 'number'));
}

function newest(reports) {
  return reports.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
}

function complete(row) {
  return String(row.value ?? '').trim() !== '';
}

// Can this row be saved as it is? 'ok' and 'na' (BMI, other tests) save as they are; 'convert'
// saves the converted value; 'blocked' stops Save with a message; 'empty' waits for a value.
function unitCheck(row) {
  const stored = (LABS[row.key] || MEASUREMENTS[row.key])?.[1];
  if (!stored) return { state: 'na' };
  if (!complete(row)) return { state: 'empty' };
  if (typeof row.value !== 'number') return { state: 'blocked', message: 'Type the value as a number' };
  const unit = unitKey(row.unit || '');
  if (!unit) return { state: 'blocked', message: `Add the unit printed on the report (the app stores ${stored})` };
  if (unit === unitKey(stored) || (SAME[row.key] || []).includes(unit)) return { state: 'ok' };
  const conversion = CONVERT[row.key]?.[unit];
  if (conversion) return { state: 'convert', value: round2(conversion[0](row.value)), factor: conversion[1] };
  const convertible = [...new Set(Object.keys(CONVERT[row.key] || {}).map((u) => UNIT_NAME[u] || u))];
  return { state: 'blocked', message: `Unit ${row.unit} cannot be used for ${SHORT[row.key] || row.label}: change it to ${stored}` +
    `${convertible.length ? ` or ${convertible.join(', ')}` : ''}` };
}

function unitReady(row) {
  return unitCheck(row).state !== 'blocked';
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

// Dated sources of current values for one person: their saved reports (reports of another sample
// person are left out, #42 / F08), plus the sample person's own latest sample report, which is
// what loadPersona copied into the record (js/data/reports.js, #5).
async function datedSources(record, personId) {
  const sources = (record.reports || [])
    .filter((r) => !personId || !r.personId || r.personId === personId)
    .map((r) => ({ date: String(r.date || ''), labs: r.labs || {}, measurements: r.measurements || {} }));
  if (!personId) return sources;
  try {
    const [{ reportsFor }, { PERSONAS }] = await Promise.all([import('../data/reports.js'), import('../data/personas.js')]);
    const latest = reportsFor(personId).slice(-1)[0];
    const persona = PERSONAS.find((p) => p.id === personId);
    if (latest && persona) {
      sources.push({ date: String(latest.date || ''), labs: { ...persona.labs }, measurements: pickKeys(persona.profile || {}, MEASUREMENTS) });
    }
  } catch { /* no sample data: only the saved reports count */ }
  return sources;
}

function asValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  const text = String(value ?? '').trim();
  return /^[+-]?\d+(\.\d+)?$/.test(text.replace(/,/g, '')) ? Number(text.replace(/,/g, '')) : text;
}

function unitKey(unit) {
  return String(unit).toLowerCase().replace(/[µμ]/g, 'u').replace(/³/g, '3').replace(/²/g, '2').replace(/[\s^*×]/g, '').replace(/^x10/, '10');
}

function readable(error) {
  const text = String(error?.message || error || '');
  if (/failed to fetch|networkerror|load failed/i.test(text)) return 'The server could not be reached.';
  return text.length > 200 ? `${text.slice(0, 200)}…` : (text || 'The live reader is not available.');
}

function asDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) return reject(new Error('The file is larger than 10 MB.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

// ---- DOM ------------------------------------------------------------------------------------

function checkbox(text, checked, onChange, label) {
  const box = el('input', { type: 'checkbox', ...(label ? { 'aria-label': label } : {}) });
  box.checked = !!checked;
  box.addEventListener('change', () => onChange(box.checked));
  return el('label', { class: 'rr-check' }, box, el('span', {}, text));
}

function addStyles() {
  if (document.getElementById('rr-styles')) return;
  const style = document.createElement('style');
  style.id = 'rr-styles';
  style.textContent = CSS;
  document.head.append(style);
}

// Elements with text children only (never innerHTML), so report text cannot inject markup.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
