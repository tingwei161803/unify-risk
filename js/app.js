// Router. Maps the URL hash to a view and hands each view the same context.
// Views load on demand, so one broken page cannot take the others down.

import { store } from './store.js';
import { runAll } from './engine/run.js';
import { callApi, listProviders, chosenProvider, chooseProvider, lastAiAnswer, onAiAnswer } from './api.js';
import { currentUser, signOut } from './auth.js';

const ROUTES = [
  { path: '/', label: 'Home', load: () => import('./views/home.js') },
  { path: '/inputs', label: 'Questionnaire', load: () => import('./views/inputs.js') },
  { path: '/report', label: 'Lab report', load: () => import('./views/report.js') },
  { path: '/results', label: 'Results', load: () => import('./views/results.js') },
  { path: '/plan', label: 'Next steps', load: () => import('./views/plan.js') },
  { path: '/evidence', label: 'Evidence', load: () => import('./views/evidence.js') },
  { path: '/login', label: null, load: () => import('./views/login.js') }
];

const root = document.getElementById('app');
const nav = document.getElementById('nav');
const session = document.getElementById('session');

const currentPath = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
const go = (hash) => { location.hash = hash; };

/** Query string after the hash path, e.g. #/results?open=fsrp → { open: 'fsrp' }. */
const query = () => Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));

const ctx = { store, runAll, callApi, go, query };

function drawChrome(path) {
  const user = currentUser();
  // Signed out: no navigation, only the sign-in page.
  nav.replaceChildren(...ROUTES.filter((r) => r.label && user).map((r) => {
    const link = document.createElement('a');
    link.href = `#${r.path}`;
    link.textContent = r.label;
    if (r.path === path) link.className = 'active';
    return link;
  }));
  session.replaceChildren();
  if (!user) return;
  const out = document.createElement('button');
  out.className = 'link';
  out.textContent = 'Sign out';
  out.addEventListener('click', () => { signOut(); go('#/login'); });
  session.append(`${user} · `, out);
}

async function render() {
  const path = currentPath();
  // Demo sign-in gate: every page needs a signed-in test account.
  if (!currentUser() && path !== '/login') return go('#/login');
  if (currentUser() && path === '/login') return go('#/');
  const route = ROUTES.find((r) => r.path === path) || ROUTES[0];
  drawChrome(route.path);
  root.replaceChildren();
  try {
    const view = await route.load();
    view.render(root, ctx);
  } catch (error) {
    console.error(error);
    root.innerHTML = '<h1>This page failed to load</h1><p class="warn"></p>';
    root.querySelector('p').textContent = String(error.message || error);
  }
}

// AI provider selector in the header. Lists only the providers whose key is set on the server.
async function drawAiPicker() {
  const box = document.getElementById('ai');
  const providers = await listProviders();
  box.replaceChildren();
  if (!providers.length) {
    box.textContent = 'AI: demo data (no API key set)';
    return;
  }
  // Forget a remembered choice whose key is no longer set.
  if (chosenProvider() && !providers.some((p) => p.name === chosenProvider())) chooseProvider('');

  const select = document.createElement('select');
  select.className = 'field field-small';
  select.setAttribute('aria-label', 'AI provider');
  select.append(new Option('Auto', ''));
  for (const p of providers) select.append(new Option(`${p.name} · ${p.model}`, p.name));
  select.value = chosenProvider();
  select.addEventListener('change', () => chooseProvider(select.value));

  const answered = document.createElement('span');
  const showAnswer = (answer) => {
    answered.textContent = answer ? ` Last answer: ${answer.provider} · ${answer.model}` : '';
  };
  showAnswer(lastAiAnswer());
  onAiAnswer(showAnswer);
  box.append('AI: ', select, answered);
}

window.addEventListener('hashchange', render);
drawAiPicker();
render();
