// LLM report trial (experiment, never merged): one interpretation report per sample case.
// Provider order: JOHNCLAUDE -> Gemini -> OpenRouter Claude Opus 5.5 -> Groq -> NVIDIA -> CLAUDE_API_KEY.
// Falls back only on error. With COMPARE_GEMINI=1 it also writes a Gemini version of every report.
// Keys come from environment variables (GitHub Actions secrets) and are never printed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'out');
const SYSTEM = await fs.readFile(path.join(DIR, 'system.md'), 'utf8');
const CONFIG = JSON.parse(await fs.readFile(path.join(DIR, 'run-config.json'), 'utf8'));
const KEYS = ['JOHNCLAUDE', 'OPENGSA_GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'GROQ_API_KEY', 'NVIDIA_API_KEY', 'CLAUDE_API_KEY'];
const SECRET_VALUES = KEYS.map(k => process.env[k]).filter(v => v && v.length > 6);
const scrub = s => SECRET_VALUES.reduce((acc, v) => acc.split(v).join('***'), String(s));
const TIMEOUT_MS = 900_000;

async function http(url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, ok: res.ok, json, text, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

// Status and error type only for auth/not-found errors; a short message otherwise. Never the key.
function errInfo(r) {
  const e = (r.json && (r.json.error || r.json)) || {};
  const type = (typeof e === 'object' && (e.type || e.status || e.code)) || '';
  const quiet = [401, 403, 404].includes(r.status);
  const msg = quiet ? '' : String((typeof e === 'object' && e.message) || r.text || '').slice(0, 300);
  return scrub(`HTTP ${r.status} ${type} ${msg}`.trim());
}

/* ---------- providers ---------- */

async function anthropic(pv, key, system, user) {
  const body = {
    model: pv.model, max_tokens: 16000, output_config: { effort: 'high' },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
    fallbacks: 'default'
  };
  const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-beta': 'server-side-fallback-2026-07-01' };
  let r = await http('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  if (r.status === 400 && /fallback/i.test(r.text)) { // retry once without the refusal-fallback beta
    delete body.fallbacks; delete headers['anthropic-beta'];
    r = await http('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  }
  if (!r.ok) throw new Error(errInfo(r));
  const j = r.json;
  if (j.stop_reason === 'refusal') throw new Error('refusal ' + JSON.stringify(j.stop_details || {}));
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  if (!text) throw new Error('empty response, stop_reason ' + j.stop_reason);
  return { text, model: j.model || pv.model, ms: r.ms, usage: j.usage, stop: j.stop_reason };
}

let geminiPick = null;
function pickGemini(key) {
  geminiPick = geminiPick || (async () => {
    const r = await http('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': key } });
    if (!r.ok) throw new Error('list models: ' + errInfo(r));
    const names = (r.json.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
    console.log('gemini models listed:', names.filter(n => n.startsWith('gemini')).join(', '));
    const bad = /(image|tts|audio|live|vision|embedding|customtools|computer|robotics|exp|learnlm|lite)/i;
    const ver = n => { const m = n.match(/^gemini-(\d+(?:\.\d+)?)-/); return m ? parseFloat(m[1]) : -1; };
    const choose = kind => names.filter(n => new RegExp(`^gemini-\\d+(?:\\.\\d+)?-${kind}`).test(n) && !bad.test(n))
      .sort((a, b) => ver(b) - ver(a) || (Number(a.includes('preview')) - Number(b.includes('preview'))) || a.length - b.length)[0];
    const model = choose('pro') || choose('flash');
    console.log('gemini model chosen:', model);
    if (!model) throw new Error('no gemini pro or flash model listed');
    return model;
  })();
  return geminiPick;
}

async function gemini(pv, key, system, user) {
  const model = await pickGemini(key);
  const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 32768 } };
  const r = await http(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(errInfo(r));
  const cand = (r.json.candidates || [])[0];
  const text = cand && cand.content && (cand.content.parts || []).filter(p => !p.thought && p.text).map(p => p.text).join('').trim();
  if (!text) throw new Error('empty response, finishReason ' + (cand && cand.finishReason) + ' ' + JSON.stringify(r.json.promptFeedback || {}));
  return { text, model, ms: r.ms, usage: r.json.usageMetadata, stop: cand.finishReason };
}

function openaiCompat(base) {
  return async (pv, key, system, user) => {
    if (!pv.model) {
      pv.modelPick = pv.modelPick || (async () => {
        const r = await http(base + '/models', { headers: { Authorization: 'Bearer ' + key } });
        if (!r.ok) throw new Error('list models: ' + errInfo(r));
        const ids = (r.json.data || []).map(m => m.id);
        const m = pv.prefer.find(x => ids.includes(x));
        console.log(pv.id, 'model chosen:', m);
        if (!m) throw new Error('none of the preferred models is listed');
        return m;
      })();
    }
    const model = pv.model || await pv.modelPick;
    const r = await http(base + '/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 12000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
    });
    if (!r.ok) throw new Error(errInfo(r));
    const ch = (r.json.choices || [])[0];
    const text = ch && ch.message && String(ch.message.content || '').trim();
    if (!text) throw new Error('empty response, finish_reason ' + (ch && ch.finish_reason));
    return { text, model: r.json.model || model, ms: r.ms, usage: r.json.usage, stop: ch.finish_reason };
  };
}

const PROVIDERS = [
  { id: 'johnclaude', env: 'JOHNCLAUDE', model: 'claude-opus-5-5', call: anthropic },
  { id: 'gemini', env: 'OPENGSA_GEMINI_API_KEY', call: gemini },
  { id: 'openrouter-opus', env: 'OPENROUTER_API_KEY', model: 'anthropic/claude-opus-5.5', call: openaiCompat('https://openrouter.ai/api/v1') },
  { id: 'groq', env: 'GROQ_API_KEY', prefer: ['openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct-0905', 'moonshotai/kimi-k2-instruct', 'llama-3.3-70b-versatile'], call: openaiCompat('https://api.groq.com/openai/v1') },
  { id: 'nvidia', env: 'NVIDIA_API_KEY', prefer: ['openai/gpt-oss-120b', 'deepseek-ai/deepseek-v3.1', 'meta/llama-3.3-70b-instruct', 'nvidia/llama-3.3-nemotron-super-49b-v1.5'], call: openaiCompat('https://integrate.api.nvidia.com/v1') },
  { id: 'claude', env: 'CLAUDE_API_KEY', model: 'claude-opus-5-5', call: anthropic }
];

const userMessage = packet => 'Write the report for this person, following the guide and its trial addendum. Input packet (JSON):\n\n```json\n' + JSON.stringify(packet, null, 2) + '\n```';
const transient = msg => /HTTP (408|409|425|429|5\d\d)|aborted|fetch failed|overloaded/i.test(msg);

async function tryProvider(pv, user, attempts) {
  const key = process.env[pv.env];
  if (!key) { attempts.push({ provider: pv.id, skipped: 'secret not set' }); return null; }
  for (let i = 0; i < 2; i++) {
    try {
      return { provider: pv.id, ...(await pv.call(pv, key, SYSTEM, user)) };
    } catch (e) {
      const msg = scrub(e && e.message || e);
      attempts.push({ provider: pv.id, error: msg });
      if (!transient(msg)) break;
      await new Promise(res => setTimeout(res, 8000));
    }
  }
  return null;
}

async function save(name, res, extra) {
  await fs.writeFile(path.join(OUT, name + '.md'), res.text + '\n');
  await fs.writeFile(path.join(OUT, name + '.meta.json'), JSON.stringify({ provider: res.provider, model: res.model, latencyMs: res.ms, stop: res.stop, usage: res.usage, ...extra }, null, 2) + '\n');
}

await fs.mkdir(OUT, { recursive: true });
const files = (await fs.readdir(path.join(DIR, 'cases'))).filter(f => f.endsWith('.json')).sort()
  .filter(f => !CONFIG.cases || !CONFIG.cases.length || CONFIG.cases.includes(f.replace(/\.json$/, '')));
const summary = [];
await Promise.all(files.map(async file => {
  const id = file.replace(/\.json$/, '');
  const packet = JSON.parse(await fs.readFile(path.join(DIR, 'cases', file), 'utf8'));
  const user = userMessage(packet);
  const jobs = [];
  if (CONFIG.generate !== false) jobs.push((async () => {
    const attempts = [];
    let res = null;
    for (const pv of PROVIDERS) { res = await tryProvider(pv, user, attempts); if (res) break; }
    if (res) await save(id, res, { attempts });
    else await fs.writeFile(path.join(OUT, id + '.failed.json'), JSON.stringify({ attempts }, null, 2) + '\n');
    summary.push({ case: id, kind: 'primary', provider: res && res.provider, model: res && res.model, ms: res && res.ms, attempts });
    console.log(`${id} primary: ${res ? `${res.provider} / ${res.model} in ${Math.round(res.ms / 1000)} s` : 'FAILED'}; attempts: ${JSON.stringify(attempts)}`);
  })());
  if (CONFIG.compareGemini && process.env.OPENGSA_GEMINI_API_KEY) jobs.push((async () => {
    const attempts = [];
    const res = await tryProvider(PROVIDERS.find(p => p.id === 'gemini'), user, attempts);
    if (res) await save(id + '.gemini', res, { attempts });
    summary.push({ case: id, kind: 'gemini-compare', provider: res && res.provider, model: res && res.model, ms: res && res.ms, attempts });
    console.log(`${id} gemini compare: ${res ? `${res.model} in ${Math.round(res.ms / 1000)} s` : 'FAILED'}; attempts: ${JSON.stringify(attempts)}`);
  })());
  await Promise.all(jobs);
}));
await fs.writeFile(path.join(OUT, 'run-summary.json'), JSON.stringify(summary, null, 2) + '\n');
if (CONFIG.generate !== false && !summary.some(s => s.kind === 'primary' && s.provider)) { console.error('No report was generated.'); process.exit(1); }
