// Calls to our own server. API keys stay on the server (see server.py), never here.

const PROVIDER_KEY = 'unify-risk:provider';
const listeners = new Set();
let lastAnswer = null;   // { provider, model } of the most recent AI reply

/** The provider the user picked in the header, or '' for the server's own order. */
export function chosenProvider() {
  try { return localStorage.getItem(PROVIDER_KEY) || ''; } catch { return ''; }
}

export function chooseProvider(name) {
  try {
    if (name) localStorage.setItem(PROVIDER_KEY, name);
    else localStorage.removeItem(PROVIDER_KEY);
  } catch { /* storage blocked: the choice lasts for this page load only */ }
}

/** Providers whose key is set on the server: [{ name, model, accepts }]. Empty when none or offline. */
export async function listProviders() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    return Array.isArray(data.providers) ? data.providers : [];
  } catch {
    return [];
  }
}

export const lastAiAnswer = () => lastAnswer;

/** Runs fn({ provider, model }) after every AI reply. Returns a function that stops it. */
export function onAiAnswer(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * POST /api/<name> with a JSON body. Throws on any failure so the caller can fall back to demo data.
 * The user's provider choice is added as `provider` unless the caller already set one.
 */
export async function callApi(name, payload = {}) {
  const provider = chosenProvider();
  const body = provider && payload.provider === undefined ? { ...payload, provider } : payload;
  const response = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API ${name} failed (${response.status})`);
  if (data.provider) {
    lastAnswer = { provider: data.provider, model: data.model || '' };
    listeners.forEach((fn) => fn(lastAnswer));
  }
  return data;
}
