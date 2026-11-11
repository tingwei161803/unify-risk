// Router. Maps the URL hash to a view and hands each view the same context.
// Views load on demand, so one broken page cannot take the others down.

import { store } from './store.js';
import { runAll } from './engine/run.js';
import { callApi } from './api.js';
import { currentUser, signOut } from './auth.js';

const ROUTES = [
  { path: '/', label: 'Home', load: () => import('./views/home.js') },
  { path: '/inputs', label: 'Questionnaire', load: () => import('./views/inputs.js') },
  { path: '/report', label: 'Lab report', load: () => import('./views/report.js') },
  { path: '/results', label: 'Results', load: () => import('./views/results.js') },
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

window.addEventListener('hashchange', render);
render();
