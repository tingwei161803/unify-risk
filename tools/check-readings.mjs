// Fails loudly when a prepared reading in js/data/readings.js no longer fits the code. Offline tool,
// not part of the app. Run it before merging anything that touches the engine, the sample people,
// the lab wording, the services or the reading prompt:
//
//   node tools/check-readings.mjs
//
// Two checks:
//   1. Fingerprint: each sample person's packet, built by js/views/explain-packet.js exactly as the
//      Explained page builds it, must have the fingerprint stored with that person's reading.
//      A mismatch means the page silently skips the prepared reading and calls the model live.
//   2. Sources: the files in tools/readings-sources.mjs must hash the same as when the readings were
//      made (tools/readings-sources.json). A change there leaves the fingerprint intact but can make
//      a prepared reading say something the page no longer says.
// Exit code 1 when either check fails; the fix is `node tools/build-readings.mjs`.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PERSONAS } from '../js/data/personas.js';
import { READINGS } from '../js/data/readings.js';
import { buildPacket, readingFingerprint } from '../js/views/explain-packet.js';
import { sourceHashes } from './readings-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'tools', 'readings-sources.json');

let failed = false;

console.log('Prepared readings: fingerprint check');
for (const persona of PERSONAS) {
  const reading = READINGS[persona.id];
  if (!reading) {
    console.log(`  MISSING  ${persona.id}: no prepared reading`);
    failed = true;
    continue;
  }
  const record = { personaId: persona.id, profile: { ...persona.profile }, labs: { ...persona.labs }, reports: [] };
  const { packet } = await buildPacket(record, persona);
  const ok = readingFingerprint(packet) === reading.fingerprint;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'ok      ' : 'STALE   '} ${persona.id}`);
}
for (const id of Object.keys(READINGS)) {
  if (!PERSONAS.some((p) => p.id === id)) console.log(`  note     ${id}: reading for a person who is no longer a sample person`);
}

console.log('Prepared readings: source check');
if (!existsSync(MANIFEST)) {
  console.log('  MISSING  tools/readings-sources.json: re-run node tools/build-readings.mjs to record it');
  failed = true;
} else {
  const recorded = JSON.parse(readFileSync(MANIFEST, 'utf8')).files || {};
  const now = sourceHashes(ROOT);
  for (const [file, hash] of Object.entries(now)) {
    const ok = recorded[file] === hash;
    if (!ok) failed = true;
    console.log(`  ${ok ? 'ok      ' : 'CHANGED '} ${file}`);
  }
}

if (failed) {
  console.log('\nSome prepared readings no longer fit the code. Re-run: node tools/build-readings.mjs');
  process.exit(1);
}
console.log('\nAll prepared readings fit the current code.');
