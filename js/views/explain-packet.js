// The packet the Explained page sends to /api/interpret, and its fingerprint.
//
// Shared by js/views/explain.js (in the browser) and tools/build-readings.mjs (in Node), so a
// reading prepared in advance for a sample person is shown only when the page would have sent
// exactly the same inputs. Pure ES module: no DOM, no storage.

import { assess } from '../engine/run.js';
import { getEvidence } from '../data/evidence.js';
import { reportsFor } from '../data/reports.js';
import { followUpTests, matchingServices } from '../data/services.js';

/**
 * Build everything the page needs from a store record and its sample person (or null).
 * Returns { person, assessed, scenarios, packet }: `scenarios` feeds the what-if table,
 * `packet` is the body sent to /api/interpret.
 */
export async function buildPacket(record, persona) {
  const person = buildPerson(record, persona);
  const engineInput = { profile: person.profile, labs: person.labs };
  const assessed = assess(engineInput);
  const { report, previousReports } = pickReports(record, persona);
  const whatif = await import('../engine/whatif.js').catch(() => null);
  const scenarios = whatif ? safe(() => whatif.whatIfs(engineInput), []) : null;
  const flat = whatif ? safe(() => whatif.whatIfsFlat(engineInput), []) : [];

  // Same context shape as js/views/plan.js, so the reading and the Next steps page agree.
  const serviceCtx = { profile: person.profile, labs: person.labs, results: assessed.results, labRows: assessed.labs,
    mets: assessed.metabolicSyndrome, region: person.region };
  const packet = {
    region: person.region,
    person,
    report,
    previousReports,
    results: assessed.results,
    labs: assessed.labs,
    metabolicSyndrome: assessed.metabolicSyndrome,
    evidence: evidenceFor(assessed.results, person.populationIds),
    whatIfs: flat,
    services: safe(() => matchingServices(serviceCtx), []),
    followUpTests: safe(() => followUpTests(serviceCtx), [])
  };
  return { person, assessed, scenarios, packet };
}

/**
 * A short, stable id of the inputs that decide what a reading says: who, their answers and lab
 * values, the reports in use, and every formula result. Key order does not matter.
 */
export function readingFingerprint(packet) {
  const p = packet || {};
  const person = p.person || {};
  const reportOf = (r) => (r ? {
    date: r.date || null,
    labs: r.labs || null,
    items: Array.isArray(r.items) ? r.items.map((i) => [i.key, i.value, i.unit]) : null
  } : null);
  const basis = {
    id: person.id || null,
    region: p.region || null,
    profile: person.profile || {},
    labs: person.labs || {},
    report: reportOf(p.report),
    previous: (p.previousReports || []).map(reportOf),
    results: (p.results || []).map((r) => [r.modelId, r.status, r.value ?? null, r.display ?? null])
  };
  return hash53(canonical(basis));
}

export function buildPerson(record, persona) {
  const profile = { ...(record.profile || {}) };
  const sexRow = profile.sex === 'female' ? 'women' : profile.sex === 'male' ? 'men' : null;
  const rows = persona && Array.isArray(persona.populationIds) && persona.populationIds.length
    ? persona.populationIds.slice()
    : ['tw', sexRow].filter(Boolean);
  // Age rows from js/data/evidence.js, so "checked in people like you" covers older adults too.
  const age = Number(profile.age);
  if (age >= 65 && !rows.includes('65plus')) rows.push('65plus');
  if (age >= 80 && !rows.includes('80plus')) rows.push('80plus');
  return {
    id: record.personaId || 'me',
    name: persona ? persona.name : 'you',
    region: record.region || (persona && persona.region) || 'TW',
    populationIds: rows,
    profile,
    labs: { ...(record.labs || {}) }
  };
}

export function pickReports(record, persona) {
  // The store keeps confirmed reports newest first; js/data/reports.js lists a sample person's oldest first.
  // loadPersona() keeps earlier reports in the record, so with a sample person only reports tagged
  // with that person's id count; untagged ones are ignored.
  const stored = Array.isArray(record.reports) ? record.reports : [];
  const mine = record.personaId ? stored.filter((r) => r && r.personId === record.personaId) : stored;
  if (mine.length) return { report: mine[0], previousReports: mine.slice(1).reverse() };
  const sample = persona ? safe(() => reportsFor(persona.id), []) : [];
  if (sample.length) return { report: sample[sample.length - 1], previousReports: sample.slice(0, -1) };
  return { report: null, previousReports: [] };
}

function evidenceFor(results, rows) {
  const out = {};
  for (const r of results || []) {
    const id = r.modelId;
    if (!id || out[id]) continue;
    const cells = {};
    for (const row of rows) {
      const cell = getEvidence(id, row);
      if (cell) cells[row] = cell;
    }
    out[id] = cells;
  }
  return out;
}

// JSON with object keys sorted at every level, so equal inputs give equal text.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

// cyrb53: a small 53-bit string hash (public domain), as hex.
function hash53(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export function safe(fn, fallback) {
  try { return fn(); } catch (error) { console.error(error); return fallback; }
}
