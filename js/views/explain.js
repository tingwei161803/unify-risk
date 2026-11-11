// "Your report, explained" (#/explain, issue #37).
//
// Page order:
//   1. Title and disclaimer.
//   2. The written reading. It starts by itself when this packet has no saved reading and takes
//      about 25 s; a "Write again" button asks for a fresh one.
//      - It sends { packet } to POST /api/interpret (api/interpret.py). The model follows
//        docs/report-interpreter.md and returns a short Markdown narrative in three parts:
//        "Your health right now", "What this means for you", "What you should do".
//      - The page draws it with a small renderer that only ever writes text with textContent.
//      - Two markers colour a phrase: !!text!! red bold, ^^text^^ amber bold. The status words
//        (High ▲, Very high ▲▲, Borderline ▲, Low ▼, Normal) get the table's colours.
//      - Footer: the model, and any number the server found in neither the packet nor the guide.
//      - On failure only this block shows the unavailable note and a Retry button.
//   3. The details, computed in the browser; no AI is involved.
//      - Where you stand now: every lab reading from interpretLabs() (via assess()) with its
//        normal range, a coloured status and what it means, plus the metabolic-syndrome count.
//      - What you can change: the engine's what-ifs (js/engine/whatif.js), each estimate before
//        and after.
//
// The packet: the person (profile, labs, the sample person's name, region and populationIds),
// assess() results, lab readings and metabolic syndrome, the validation cells in
// js/data/evidence.js for the person's population rows, the lab reports (`report` is the
// newest, `previousReports` the rest, oldest first), and the flat what-ifs.
// If the call fails, the page says so and the rest of the app keeps working.

import { getPersona } from '../data/personas.js';
import { buildPacket, readingFingerprint, safe } from './explain-packet.js';

const CACHE_PREFIX = 'unify-risk:explain:';
const ORDER_NOTE = 'Sorted by the size of each estimate, largest first. Time frames differ, so this is not an order of urgency.';

// Status → colour class. The word and the arrow always stay, so colour is never the only signal.
const TONE = { 'very-high': 'high', high: 'high', borderline: 'mid', low: 'low', normal: 'ok' };
const STATUS_WORDS = [
  ['Very high ▲▲', 'high'], ['High ▲', 'high'], ['Borderline ▲', 'mid'], ['Low ▼', 'low'], ['Normal', 'ok']
];

const CSS = `
.ex {
  color-scheme: light; /* the app has light tokens only (css/app.css) */
  --ex-high: #b42318; --ex-mid: #9a5300; --ex-low: #1d5fa8; --ex-ok: #1d6b45;
  --ex-radius-ctl: 8px; --ex-focus: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);
}
.ex-for { margin: -12px 0 32px; color: var(--muted); font-size: 0.9rem; }
.ex-section { margin: 0 0 44px; }
.ex-reading { margin-bottom: 52px; }
.ex-reading .ex-doc { margin-top: 0; }
.ex-reading .ex-doc h2 { font-size: 1.25rem; margin: 24px 0 8px; }
.ex-reading .ex-doc h2:first-child { margin-top: 0; }
.ex-reading .ex-actions { margin-top: 12px; }
.ex-waiting p { margin: 4px 0; }
.ex-next { margin: 16px 0 0; }
.ex a.btn:focus-visible { outline: none; box-shadow: var(--ex-focus); }
.ex a.btn:hover { background: color-mix(in srgb, var(--accent) 88%, var(--ink)); }
.ex-details > h2 { margin: 0 0 20px; font-size: 1.5rem; padding-top: 24px; border-top: 1px solid var(--line); }
.ex-section > h3 { margin: 0 0 4px; font-size: 1.15rem; }
.ex-section > h2 { margin: 0 0 4px; font-size: 1.25rem; }
.ex-section > .ex-sub { margin: 0 0 12px; color: var(--muted); font-size: 0.9rem; }
.ex-tablewrap { overflow-x: auto; margin: 12px 0 12px; border: 1px solid var(--line); border-radius: var(--radius);
  background: var(--surface); }
.ex-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; font-variant-numeric: tabular-nums; }
.ex-table th { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line);
  font: 600 0.68rem/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: .1em;
  text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.ex-table td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
.ex-table tbody tr:last-child td { border-bottom: 0; }
.ex-table td.ex-num { white-space: nowrap; }
.ex-table td.ex-range { color: var(--muted); font-size: 0.82rem; min-width: 180px; }
.ex-table td.ex-mean { min-width: 220px; }
.ex-table td.ex-after { color: var(--accent); font-weight: 600; white-space: nowrap; }
.ex-table th.ex-group { background: color-mix(in srgb, var(--line) 30%, var(--surface)); color: var(--ink); }
.ex-change { font-weight: 600; }
.ex-table tr:has(+ tr.ex-cont) td { border-bottom-color: transparent; }
.ex-table tr.ex-cont td { padding-top: 0; }
.ex-st { white-space: nowrap; }
.ex-high { color: var(--ex-high); font-weight: 700; }
.ex-mid { color: var(--ex-mid); font-weight: 700; }
.ex-low { color: var(--ex-low); font-weight: 700; }
.ex-ok { color: var(--ex-ok); }
.ex-mets { margin: 0; font-size: 0.95rem; }
.ex-caveat { margin: 0; color: var(--muted); font-size: 0.85rem; }
.ex-actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 4px 0 8px; }
.ex .btn { transition: background-color .15s ease, border-color .15s ease, color .15s ease; }
.ex .btn:hover { background: color-mix(in srgb, var(--accent) 88%, var(--ink)); }
.ex .btn.secondary:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.ex .btn:focus-visible { outline: none; box-shadow: var(--ex-focus); }
.ex .btn[disabled] { opacity: .55; cursor: progress; }
.ex-hint { color: var(--muted); font-size: 0.85rem; }
.ex-status { margin: 8px 0 0; min-height: 1.5em; color: var(--muted); font-variant-numeric: tabular-nums; }
.ex-note { margin: 12px 0 0; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--warn) 45%, var(--line));
  border-radius: var(--ex-radius-ctl); background: color-mix(in srgb, var(--warn) 7%, var(--surface)); color: var(--ink); }
.ex-note strong { color: var(--warn); }
.ex-doc { margin-top: 8px; padding: 20px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
.ex-doc h2 { font-size: 1.2rem; margin: 24px 0 8px; }
.ex-doc h3 { font-size: 1.05rem; margin: 20px 0 8px; }
.ex-doc h4 { font-size: 1rem; margin: 16px 0 6px; }
.ex-doc > :first-child { margin-top: 0; }
.ex-doc > :last-child { margin-bottom: 0; }
.ex-doc p { margin: 12px 0; }
.ex-doc ul, .ex-doc ol { margin: 12px 0; padding-left: 24px; }
.ex-doc li { margin: 4px 0; }
.ex-doc blockquote { margin: 12px 0; padding: 4px 0 4px 14px; border-left: 3px solid var(--line); color: var(--muted); }
.ex-doc hr { border: 0; border-top: 1px solid var(--line); margin: 20px 0; }
.ex-doc code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.85em; }
.ex-doc .ex-tablewrap { margin: 12px 0; }
.ex-foot { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.85rem;
  font-variant-numeric: tabular-nums; }
.ex-foot .ex-traced { color: var(--ex-ok); font-weight: 600; }
.ex-foot .ex-untraced { color: var(--ex-high); font-weight: 700; }
@media (max-width: 680px) {
  .ex-table { font-size: 0.82rem; }
  .ex-table th, .ex-table td { padding: 8px 10px; }
  .ex-doc { padding: 16px; }
  /* Lab readings become one small card per test: name and result, status, meaning, then the range. */
  .ex-standwrap { overflow: visible; }
  .ex-stand, .ex-stand tbody { display: block; }
  .ex-stand thead { display: none; }
  .ex-stand tr { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 12px 14px;
    border-bottom: 1px solid var(--line); }
  .ex-stand tbody tr:last-child { border-bottom: 0; }
  .ex-stand td, .ex-stand th { display: block; border: 0; padding: 0; min-width: 0; }
  .ex-stand td:first-child { font-weight: 600; }
  .ex-stand td.ex-num { text-align: right; }
  .ex-stand td.ex-st, .ex-stand td.ex-mean, .ex-stand td.ex-range { grid-column: 1 / -1; }
  .ex-stand td.ex-range::before { content: "Normal range: "; }
  .ex-stand tr:has(> th.ex-group) { display: block; padding: 8px 14px; background: color-mix(in srgb, var(--line) 30%, var(--surface)); }
}
@media (prefers-reduced-motion: reduce) { .ex * { transition: none !important; } }
@media print {
  .ex-actions, .ex-status, .ex-note .ex-actions { display: none; }
  .ex-tablewrap { overflow: visible; border: 0; }
  .ex-section { break-inside: avoid-page; }
}
`;

export async function render(root, ctx) {
  addStyles();
  const view = el('div', { class: 'ex' });
  root.append(view);

  const record = ctx.store.get();
  const persona = record.personaId ? getPersona(record.personaId) : null;
  const { person, assessed, scenarios, packet } = await buildPacket(record, persona);

  // Readings prepared in advance for the sample people (tools/build-readings.mjs). One is used only
  // when this page would send exactly the same inputs; edited answers or a new report fall back to a live reading.
  const readings = await import('../data/readings.js').then((m) => m.READINGS || {}).catch(() => ({}));
  const pre = readings[person.id];
  const prepared = pre && pre.fingerprint === readingFingerprint(packet) ? pre : null;

  view.append(
    el('h1', {}, 'Your report, explained'),
    el('p', { class: 'lead' }, 'What your numbers say about your health right now, and what to do next, in plain English. ' +
      'Not a diagnosis. Not medical advice.'),
    el('p', { class: 'ex-for' }, `For ${person.name}${persona && persona.tagline ? ` · ${persona.tagline}` : ''}`));

  if (assessed.placeholder) {
    view.append(el('p', { class: 'ex-note' }, el('strong', {}, 'Placeholder numbers. '),
      'The formula engine is not loaded, so the estimates below are not real.'));
  }

  view.append(
    reportSection(ctx, packet, prepared),
    el('section', { class: 'ex-details', 'aria-labelledby': 'ex-details' },
      el('h2', { id: 'ex-details' }, 'The details'),
      standSection(assessed.labs, assessed.metabolicSyndrome),
      changesSection(scenarios)));
}

// ---------- 1. Where you stand now (engine only) ----------

function standSection(readings, mets) {
  const section = el('section', { class: 'ex-section', 'aria-labelledby': 'ex-stand' },
    el('h3', { id: 'ex-stand' }, 'Where you stand now'),
    el('p', { class: 'ex-sub' }, 'Each reading against its published normal range. Red means above the range, ' +
      'amber borderline, blue below it, green within it.'));

  const rows = Array.isArray(readings) ? readings : [];
  if (!rows.length) {
    section.append(el('p', { class: 'muted' }, 'No lab values or measurements yet. Add a report on the Lab report page.'));
  } else {
    const body = el('tbody');
    const groups = [['measurement', 'Measurements'], ['blood', 'Blood and urine tests']];
    const known = new Set(groups.map(([g]) => g));
    for (const [group, title] of [...groups, ['other', 'Other']]) {
      const inGroup = rows.filter((r) => (group === 'other' ? !known.has(r.group) : r.group === group));
      if (!inGroup.length) continue;
      body.append(el('tr', {}, el('th', { class: 'ex-group', colspan: '5', scope: 'colgroup' }, title)));
      for (const r of inGroup) {
        const tone = TONE[r.status] || '';
        const notNormal = r.status && r.status !== 'normal';
        body.append(el('tr', {},
          el('td', {}, r.label || r.key),
          el('td', { class: 'ex-num' }, [r.value, r.unit].filter((x) => x !== undefined && x !== null && x !== '').join(' ')),
          el('td', { class: 'ex-range' }, r.standard || '—'),
          el('td', { class: `ex-st ${tone ? `ex-${tone}` : ''}` }, r.statusLabel || r.status || '—'),
          el('td', { class: `ex-mean ${notNormal && tone ? `ex-${tone}` : ''}` }, r.explanation || '')));
      }
    }
    section.append(el('div', { class: 'ex-tablewrap ex-standwrap' },
      el('table', { class: 'ex-table ex-stand' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Test'), el('th', { scope: 'col' }, 'Your result'),
          el('th', { scope: 'col' }, 'Normal range'), el('th', { scope: 'col' }, 'Status'), el('th', { scope: 'col' }, 'What it means'))),
        body)));
  }
  section.append(metsLine(mets));
  return section;
}

function metsLine(mets) {
  if (!mets || !Number.isFinite(mets.count)) {
    return el('p', { class: 'ex-mets muted' }, 'Metabolic syndrome: not assessed (some readings are missing).');
  }
  const met = (mets.items || []).filter((i) => i.met === true).map((i) => String(i.label || '').toLowerCase()).filter(Boolean);
  const of = mets.of || 5;
  const text = `Metabolic syndrome: ${mets.count} of ${of} Taiwan criteria met${met.length ? ` (${met.join(', ')})` : ''}. ` +
    '3 or more is the published line.';
  return el('p', { class: `ex-mets ${mets.count >= 3 ? 'ex-high' : ''}` }, text);
}

// ---------- 2. What you can change (engine only) ----------

function changesSection(scenarios) {
  const section = el('section', { class: 'ex-section', 'aria-labelledby': 'ex-changes' },
    el('h3', { id: 'ex-changes' }, 'What you can change'),
    el('p', { class: 'ex-sub' }, 'Changes the published formulas respond to, with each estimate now and after the change. ' +
      'Sorted by the size of the change, largest first.'));

  if (scenarios === null) {
    section.append(el('p', { class: 'muted' }, 'Not available yet: the what-if part of the engine is not loaded.'));
    return section;
  }
  if (!scenarios.length) {
    section.append(el('p', { class: 'muted' }, 'None of the changes these formulas respond to applies to your answers.'));
    return section;
  }

  const body = el('tbody');
  for (const s of scenarios) {
    (s.effects || []).forEach((e, i) => {
      body.append(el('tr', { class: i > 0 ? 'ex-cont' : null },
        el('td', {}, i === 0 ? el('span', { class: 'ex-change' }, s.label) : '',
          i === 0 && s.change ? el('div', { class: 'muted' }, s.change) : ''),
        el('td', {}, e.name || e.formulaId),
        el('td', { class: 'ex-num' }, e.before ?? ''),
        el('td', { class: 'ex-after' }, `→ ${e.after ?? ''}`)));
    });
  }
  section.append(
    el('div', { class: 'ex-tablewrap' },
      el('table', { class: 'ex-table' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Change'), el('th', { scope: 'col' }, 'Estimate'),
          el('th', { scope: 'col' }, 'Now'), el('th', { scope: 'col' }, 'After'))),
        body)),
    el('p', { class: 'ex-caveat' }, 'These formulas come from observational studies. They show how each estimate responds, ' +
      'not a promise of what will happen to you.'));
  return section;
}

// ---------- 3. Written report (AI) ----------

function reportSection(ctx, packet, prepared) {
  const key = cacheKey(ctx.store.user(), packet);
  const writeBtn = el('button', { type: 'button', class: 'btn secondary' }, 'Write again');
  const status = el('p', { class: 'ex-status', role: 'status', 'aria-live': 'polite' });
  const out = el('div', { class: 'ex-out' });
  const actions = el('div', { class: 'ex-actions' });
  const section = el('section', { class: 'ex-section ex-reading', 'aria-label': 'Your reading' },
    out, status,
    el('div', { class: 'ex-actions-wrap' }, actions),
    el('p', { class: 'ex-next' }, el('a', { class: 'btn', href: '#/plan' }, 'See next steps →')));
  actions.append(writeBtn,
      el('span', { class: 'ex-hint' }, 'Written by an AI model from your own numbers. A number that appears in neither ' +
        'your data nor the report guide is flagged below the reading. A new reading takes about 25 seconds and uses the AI provider picked at the top.'));

  let ticker = null;
  const stopTicker = () => { if (ticker) clearInterval(ticker); ticker = null; };

  const showReport = (data, source) => {
    out.replaceChildren(el('div', { class: 'ex-doc' }, ...renderMarkdown(data.markdown || '')), footer(data, source));
    actions.hidden = false;
  };

  const write = async () => {
    stopTicker();
    writeBtn.disabled = true;
    const started = Date.now();
    out.replaceChildren(el('div', { class: 'ex-doc ex-waiting' },
      el('p', {}, el('strong', {}, 'Reading your numbers…')),
      el('p', { class: 'muted' }, 'Your written reading usually takes about 25 seconds. The details below are already ready.')));
    const tick = () => { status.textContent = `Writing your reading… ${Math.round((Date.now() - started) / 1000)} s`; };
    tick();
    ticker = setInterval(tick, 1000);
    try {
      const data = await ctx.callApi('interpret', { packet });
      if (!data || typeof data.markdown !== 'string' || !data.markdown.trim()) throw new Error('the reply was empty');
      const saved = { ...data, at: new Date().toISOString() };
      writeCache(key, saved);
      status.textContent = '';
      showReport(saved, 'live');
    } catch (error) {
      status.textContent = '';
      actions.hidden = true; // the note below has its own Retry button
      const retry = el('button', { type: 'button', class: 'btn secondary' }, 'Retry');
      retry.addEventListener('click', () => write());
      out.replaceChildren(el('div', { class: 'ex-note' },
        el('strong', {}, 'The written report is unavailable right now'),
        ` (${shortReason(error)}). Your results page still works.`,
        el('div', { class: 'ex-actions' }, retry)));
    } finally {
      stopTicker();
      writeBtn.disabled = false;
    }
  };

  writeBtn.addEventListener('click', () => write());
  if (prepared) {
    showReport(prepared, 'prepared'); // same inputs as when it was prepared: no call, no wait
  } else {
    const cached = readCache(key);
    if (cached) showReport(cached, 'cache');
    else write(); // no saved reading for this packet: start straight away (not awaited, the details render now)
  }

  return section;
}

function footer(data, source) {
  const foot = el('div', { class: 'ex-foot' });
  const who = [data.model, data.provider].filter(Boolean).join(' · ');
  if (source === 'prepared') {
    const day = data.generatedAt ? new Date(data.generatedAt).toLocaleDateString() : '';
    foot.append(el('div', {}, ['Prepared in advance from this sample person\'s numbers', data.model, day].filter(Boolean).join(' · ') +
      '. "Write again" asks for a fresh one.'));
  } else {
    const when = source === 'cache' && data.at ? ` Saved ${new Date(data.at).toLocaleString()}.` : '';
    const took = Number.isFinite(data.seconds) ? ` in ${Math.round(data.seconds)} s` : '';
    foot.append(el('div', {}, `Written by ${who || 'the AI model'}${took}.${when}`));
  }
  const checked = Number.isFinite(data.numbersChecked) ? data.numbersChecked : null;
  const untraced = Array.isArray(data.untraced) ? data.untraced : [];
  if (untraced.length) {
    foot.append(el('div', { class: 'ex-untraced' },
      `Check these numbers: they were not found in your data or the report guide: ${untraced.join(', ')}.`));
  } else if (checked === 0) {
    foot.append(el('div', {}, 'This reading quotes no numbers to check.'));
  } else if (checked !== null) {
    foot.append(el('div', { class: 'ex-traced' }, `${checked} numbers found; none is missing from your data and the report guide. This check does not confirm each number is used correctly, so compare them with your results.`));
  } else {
    foot.append(el('div', {}, 'The numbers in this reading were not checked.'));
  }
  foot.append(el('div', {}, ORDER_NOTE));
  foot.append(el('div', {}, 'Not a diagnosis. Not medical advice.'));
  return foot;
}



// ---------- Markdown → DOM (text only, never innerHTML) ----------

function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const nodes = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(Math.max(heading[1].length, 2), 4); // # and ## → h2; the page has the only <h1>
      nodes.push(el(`h${level}`, {}, ...inline(heading[2].replace(/\s+#+\s*$/, ''))));
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { nodes.push(el('hr')); i++; continue; }

    if (/^\s*\|/.test(line)) {
      const block = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
      nodes.push(table(block));
      continue;
    }
    if (/^\s*>/.test(line)) {
      const block = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) block.push(lines[i++].replace(/^\s*>\s?/, ''));
      nodes.push(el('blockquote', {}, ...renderMarkdown(block.join('\n'))));
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const block = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && block.length))) {
        block.push(lines[i++]);
      }
      nodes.push(list(block));
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*\||\s*>|\s*([-*+]|\d+[.)])\s+|\s*(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i])) {
      para.push(lines[i++].trim());
    }
    if (para.length) nodes.push(el('p', {}, ...inline(para.join(' '))));
    else i++;
  }
  return nodes;
}

function list(block) {
  // One level of nesting: items indented by 2+ spaces belong to the item above.
  const ordered = /^\s*\d+[.)]\s+/.test(block[0]);
  const root = el(ordered ? 'ol' : 'ul');
  let last = null;
  let sub = null;
  for (const raw of block) {
    const m = raw.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (!m) { if (last) last.append(' ', ...inline(raw.trim())); continue; }
    const nested = m[1].length >= 2 && last;
    const item = el('li', {}, ...inline(m[3]));
    if (nested) {
      if (!sub || sub.parentNode !== last) { sub = el(/\d/.test(m[2]) ? 'ol' : 'ul'); last.append(sub); }
      sub.append(item);
    } else {
      root.append(item);
      last = item;
      sub = null;
    }
  }
  return root;
}

function table(block) {
  const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const isRule = (row) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(row);
  const rows = block.filter((r) => !isRule(r)).map(cells);
  const hasHeader = block.length > 1 && isRule(block[1]);
  const head = hasHeader ? rows.shift() : null;
  const t = el('table', { class: 'ex-table' });
  if (head) t.append(el('thead', {}, el('tr', {}, ...head.map((c) => el('th', { scope: 'col' }, ...inline(c))))));
  t.append(el('tbody', {}, ...rows.map((r) => el('tr', {}, ...r.map((c) => el('td', {}, ...inline(c)))))));
  return el('div', { class: 'ex-tablewrap' }, t);
}

// Inline marks. !!text!! red bold, ^^text^^ amber bold, **bold**, *italic* / _italic_, `code`.
// Links [text](url) keep their text only. Status words get the table's colours.
const INLINE = /(!!.+?!!|\^\^.+?\^\^|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
const STATUS_RE = new RegExp(`(${STATUS_WORDS.map(([w]) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

function inline(text) {
  const out = [];
  const source = String(text).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  let last = 0;
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(source))) {
    if (m.index > last) out.push(...statusWords(source.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith('!!')) out.push(el('span', { class: 'ex-high' }, ...inline(tok.slice(2, -2))));
    else if (tok.startsWith('^^')) out.push(el('span', { class: 'ex-mid' }, ...inline(tok.slice(2, -2))));
    else if (tok.startsWith('**') || tok.startsWith('__')) out.push(el('strong', {}, ...inline(tok.slice(2, -2))));
    else if (tok.startsWith('`')) out.push(el('code', {}, tok.slice(1, -1)));
    else out.push(el('em', {}, ...inline(tok.slice(1, -1))));
    last = m.index + tok.length;
    INLINE.lastIndex = last;
  }
  if (last < source.length) out.push(...statusWords(source.slice(last)));
  return out;
}

function statusWords(text) {
  const parts = String(text).split(STATUS_RE);
  return parts.filter((p) => p !== '').map((p) => {
    const hit = STATUS_WORDS.find(([w]) => w === p);
    return hit ? el('span', { class: `ex-st ex-${hit[1]}` }, p) : p;
  });
}

// ---------- Helpers ----------

function cacheKey(user, packet) {
  const text = JSON.stringify(packet);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${CACHE_PREFIX}${user}:${(h >>> 0).toString(16)}`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data.markdown === 'string' ? data : null;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* storage blocked: the reading shows this time only */ }
}

function shortReason(error) {
  const text = String((error && error.message) || error || 'unknown error');
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}


function addStyles() {
  if (document.getElementById('ex-styles')) return;
  const style = document.createElement('style');
  style.id = 'ex-styles';
  style.textContent = CSS;
  document.head.append(style);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false || child === '') continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
