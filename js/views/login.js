// Sign-in page: pick a test account or type its name.

import { TEST_ACCOUNTS, signIn } from '../auth.js';

export function render(root, ctx) {
  root.innerHTML = `
    <h1>Sign in</h1>
    <p class="lead">Demo sign-in. Test accounts only, no password. Each account opens one fictional sample person.</p>
    <form id="form" class="row" autocomplete="off">
      <input id="user" class="field" placeholder="testuser1" aria-label="Account name">
      <button class="btn" type="submit">Sign in</button>
    </form>
    <p id="error" class="warn" role="alert"></p>
    <h2>Test accounts</h2>
    <div id="accounts"></div>`;

  const error = root.querySelector('#error');
  const enter = (name) => {
    const result = signIn(name);
    if (result.ok) ctx.go('#/');
    else error.textContent = result.error;
  };

  root.querySelector('#form').addEventListener('submit', (event) => {
    event.preventDefault();
    enter(root.querySelector('#user').value);
  });

  const accounts = root.querySelector('#accounts');
  for (const account of TEST_ACCOUNTS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card card-button';
    card.innerHTML = '<h2></h2><div class="muted"></div>';
    card.querySelector('h2').textContent = account.user;
    card.querySelector('.muted').textContent = `${account.persona.name} · ${account.persona.tagline}`;
    card.addEventListener('click', () => enter(account.user));
    accounts.append(card);
  }
}
