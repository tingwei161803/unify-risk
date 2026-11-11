// Files that shape the text of a prepared reading but that the packet fingerprint cannot see:
// the prompt, the guide it quotes, and the wording the packet carries (lab sentences, services,
// what-ifs). tools/build-readings.mjs records their hashes in tools/readings-sources.json when it
// writes js/data/readings.js; tools/check-readings.mjs compares them with the files as they are now.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const SOURCE_FILES = [
  'api/interpret.py',
  'docs/report-interpreter.md',
  'js/views/explain-packet.js',
  'js/engine/labs.js',
  'js/engine/whatif.js',
  'js/data/services.js'
];

export function sourceHashes(root) {
  const out = {};
  for (const file of SOURCE_FILES) {
    out[file] = createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex').slice(0, 16);
  }
  return out;
}
