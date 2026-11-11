// LLM report trial (experiment, never merged): GPT 6 Astra (OpenRouter openai/gpt-6-astra) reviews each primary report.
// Reads out/<id>.md (or tools/llm-report-trial/reports/<id>.md when the generate step was skipped).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'out');
const CONFIG = JSON.parse(await fs.readFile(path.join(DIR, 'run-config.json'), 'utf8'));
const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = CONFIG.reviewModel || 'openai/gpt-6-astra';
const scrub = s => (KEY && KEY.length > 6 ? String(s).split(KEY).join('***') : String(s));
if (CONFIG.review === false) { console.log('review skipped by run-config.json'); process.exit(0); }
if (!KEY) { console.log('OPENROUTER_API_KEY not set; review skipped'); process.exit(0); }

const system = await fs.readFile(path.join(DIR, 'system.md'), 'utf8');
const rules = system.slice(system.indexOf('## Trial addendum'));
const REVIEWER = 'You are a strict, experienced reviewer of patient-facing health reports written from published risk formulas. ' +
  'You check facts and numbers against the input data, you check that the report follows its rules, and you know how to make health information engaging ' +
  'for an anxious older reader without exaggerating. Be specific and quote exact lines.';

async function review(id) {
  let report;
  try { report = await fs.readFile(path.join(OUT, id + '.md'), 'utf8'); }
  catch { report = await fs.readFile(path.join(DIR, 'reports', id + '.md'), 'utf8'); }
  const packet = await fs.readFile(path.join(DIR, 'cases', id + '.json'), 'utf8');
  const user = [
    'INPUT PACKET the report was written from (JSON):', '```json', packet.trim(), '```', '',
    'RULES the report had to follow:', rules.trim(), '',
    'REPORT TO REVIEW:', '<<<', report.trim(), '>>>', '',
    'Do three things, in Markdown, under exactly these headings:',
    '## Problems',
    'Every factual, number, logic and wording problem. For each: quote the exact line, say what is wrong, give the fix. Check every number against the input packet and the rules; flag any number that is not in either. Flag any of the banned words. Flag anything that overstates or understates the evidence. Rank from most to least serious. If there are none, say so.',
    '## More engaging',
    'Up to 5 concrete suggestions to make this report more engaging and useful for a worried 60-year-old reader (order, tone, visuals, interaction), one or two sentences each.',
    '## Rewritten opening',
    'Rewrite "Your question first" and the start of "Where you stand now" (the table may stay as it is), keeping every number exactly as in the packet and following the rules.'
  ].join('\n');
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, messages: [{ role: 'system', content: REVIEWER }, { role: 'user', content: user }] })
  });
  const text = await res.text();
  let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(scrub(`HTTP ${res.status} ${(j && j.error && (j.error.code || j.error.type)) || ''} ${[401, 403, 404].includes(res.status) ? '' : ((j && j.error && j.error.message) || text).slice(0, 300)}`));
  const ch = j.choices && j.choices[0];
  const out = ch && ch.message && String(ch.message.content || '').trim();
  if (!out) throw new Error('empty review, finish_reason ' + (ch && ch.finish_reason));
  await fs.writeFile(path.join(OUT, id + '.astra.md'), out + '\n');
  await fs.writeFile(path.join(OUT, id + '.astra.meta.json'), JSON.stringify({ model: j.model || MODEL, latencyMs: Date.now() - t0, usage: j.usage, finish: ch.finish_reason }, null, 2) + '\n');
  return j.model || MODEL;
}

await fs.mkdir(OUT, { recursive: true });
const ids = (await fs.readdir(path.join(DIR, 'cases'))).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort()
  .filter(id => !CONFIG.cases || !CONFIG.cases.length || CONFIG.cases.includes(id));
const results = await Promise.all(ids.map(async id => {
  for (let i = 0; i < 2; i++) {
    try { const m = await review(id); console.log(`${id} review: ${m}`); return { id, ok: true }; }
    catch (e) { console.log(`${id} review failed: ${scrub(e.message)}`); if (!/HTTP (429|5\d\d)|fetch failed/.test(e.message)) return { id, ok: false, error: scrub(e.message) }; await new Promise(r => setTimeout(r, 8000)); }
  }
  return { id, ok: false };
}));
await fs.writeFile(path.join(OUT, 'review-summary.json'), JSON.stringify(results, null, 2) + '\n');
