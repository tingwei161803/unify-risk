// Demo sign-in. Test accounts only: no passwords, no server, no real personal data.
// Each test account opens one fictional sample person, so switching accounts switches people.

import { store, SESSION_KEY } from './store.js';
import { PERSONAS } from './data/personas.js';

const MAX_ACCOUNTS = 3;

/** testuser1 → first sample person, testuser2 → second, and so on. */
export const TEST_ACCOUNTS = PERSONAS.slice(0, MAX_ACCOUNTS).map((persona, index) => ({
  user: `testuser${index + 1}`,
  persona
}));

export function currentUser() {
  const user = store.user();
  return user === 'guest' ? null : user;
}

/** Returns { ok: true } or { ok: false, error }. */
export function signIn(name) {
  const user = String(name || '').trim().toLowerCase();
  const account = TEST_ACCOUNTS.find((a) => a.user === user);
  if (!account) {
    return { ok: false, error: `Unknown account. Try ${TEST_ACCOUNTS.map((a) => a.user).join(', ')}.` };
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user }));
  } catch {
    return { ok: false, error: 'This browser is blocking storage, so sign-in cannot be remembered.' };
  }
  // First sign-in: start from the account's sample person. Later sign-ins keep what was saved.
  if (!store.get().personaId) store.loadPersona(account.persona.id);
  return { ok: true };
}

export function signOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* nothing to clear */ }
}
