#!/usr/bin/env node
// Runs every harness and exits non-zero if any fails, so this can
// drop straight into CI or a pre-commit hook.
const { spawnSync } = require('child_process');
const path = require('path');

// The first five run under jsdom, which has no layout engine — it can
// check logic but never what a pixel actually did. The last two drive
// a real browser for exactly that reason: they compare rendered
// positions against the numbers the engine judges with, which is how
// the strike line was found sitting ~17px off the bar it was drawn on.
const SUITES = [
  ['smoke.js',        'UI — boot, tabs, campaign, shop, editor, themes'],
  ['smoke2.js',       'Gameplay — scoring, lives, tile pool, migration'],
  ['progression.js',  'Progression — generation, XP, codes, dailies, economy'],
  ['fidelity.js',     'Codec fidelity — every level field survives a round trip'],
  ['codectest.js',    'Codec internals — LZW, unicode, size, compatibility'],
  ['visualverify.js', 'Layout — judged line vs drawn bar, at six screen sizes'],
  ['touchverify.js',  'Touch — whole-lane taps, multi-finger chords, no ghost clicks'],
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
