// Everything the app remembers lives in this browser's localStorage, one record per signed-in user.

import { PERSONAS } from './data/personas.js';

export const SESSION_KEY = 'unify-risk:session';
const dataKey = (user) => `unify-risk:v1:${user}`;
const listeners = new Set();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked (private window); the app still works for this page load.
  }
}

const emptyRecord = () => ({
  personaId: null,
  profile: {},          // questionnaire answers
  labs: {},             // lab values, unit in the key name
  reports: [],          // confirmed lab reports, newest first
  consentResearch: false
});

export const store = {
  /** Signed-in user name, or 'guest' when nobody is signed in. */
  user() {
    return read(SESSION_KEY, null)?.user ?? 'guest';
  },

  get() {
    return { ...emptyRecord(), ...read(dataKey(this.user()), {}) };
  },

  set(patch) {
    const next = { ...this.get(), ...patch };
    write(dataKey(this.user()), next);
    listeners.forEach((fn) => fn(next));
    return next;
  },

  setProfile(patch) {
    return this.set({ profile: { ...this.get().profile, ...patch } });
  },

  setLabs(patch) {
    return this.set({ labs: { ...this.get().labs, ...patch } });
  },

  /** Add a confirmed report and merge its values into labs. */
  addReport(report) {
    const current = this.get();
    return this.set({
      reports: [report, ...current.reports],
      labs: { ...current.labs, ...report.labs }
    });
  },

  /** Copy a fictional sample person's answers into this user's record. */
  loadPersona(id) {
    const persona = PERSONAS.find((p) => p.id === id);
    if (!persona) return null;
    return this.set({ personaId: id, profile: { ...persona.profile }, labs: { ...persona.labs } });
  },

  reset() {
    try { localStorage.removeItem(dataKey(this.user())); } catch { /* see write() */ }
    listeners.forEach((fn) => fn(this.get()));
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};
