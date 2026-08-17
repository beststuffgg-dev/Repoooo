#!/usr/bin/env node
// Runs every harness and exits non-zero if any fails, so this can
// drop straight into CI or a pre-commit hook.
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  ['smoke.js',       'UI — boot, tabs, campaign, shop, editor, themes'],
  ['smoke2.js',      'Gameplay — scoring, lives, tile pool, migration'],
  ['progression.js', 'Progression — generation, XP, codes, dailies, economy'],
  ['fidelity.js',    'Codec fidelity — every level field survives a round trip'],
  ['codectest.js',   'Codec internals — LZW, unicode, size, compatibility'],
];

let failed = 0;
for (const [file, blurb] of SUITES) {
  process.stdout.write('\n\x1b[1m' + file + '\x1b[0m — ' + blurb + '\n');
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) failed++;
}

console.log('\n' + '─'.repeat(58));
if (failed) {
  console.log('\x1b[31m%d of %d suites FAILED\x1b[0m', failed, SUITES.length);
  process.exit(1);
}
console.log('\x1b[32mall %d suites passed\x1b[0m', SUITES.length);
