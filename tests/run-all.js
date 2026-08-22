#!/usr/bin/env node
// Runs every harness and exits non-zero if any fails, so this can
// drop straight into CI or a pre-commit hook.
//
//   node run-all.js
//   APP_DIR=RhythmDropV7-Redesign node run-all.js
//
// The V8 suites always test other/RhythmDropV8 (V8_DIR overrides).
// APP_DIR selects which V7 build the V7 suites run against.
//
// Most suites run under jsdom, which has no layout engine — they can
// check logic but never what a pixel actually did. The browser-driven
// ones at the end drive real Chromium for exactly that reason: they
// compare rendered positions against the numbers the engine judges
// with, which is how the strike line was found sitting ~17px off the
// bar it was drawn on, and how the campaign list was found collapsing
// to a 39px viewport on a short window.
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  // ══ V8 — the current game ══
  ['v8levels.js',   'V8 campaign data — 150 baked songs, and the build that plays them'],
  ['v8campaign.js', 'V8 progression — coins, XP, unlocks, dailies'],
  ['v8audio.js',    'V8 audio — every voice rendered and measured, not just present'],
  ['v8graphics.js', 'V8 graphics — the updated look, and the old one kept intact'],
  ['v8settings.js', 'V8 settings — every control driven, and its effect measured'],
  ['v8generate.js', 'V8 generation — V7\'s composer bundled, Generate and Endless'],
  ['v8gameplay.js', 'V8 gameplay — the hit window and the Double, from V7'],
  ['v8ui.js',       'V8 layout — the side panel, the pinned height, one whole run'],
  // ══ V7 — kept alongside, under other/v7/ ══
  // ── core ──
  ['smoke.js',        'UI — boot, tabs, campaign, shop, editor, themes'],
  ['smoke2.js',       'Gameplay — scoring, lives, tile pool, migration'],
  ['progression.js',  'Progression — generation, XP, codes, dailies, economy'],
  ['fidelity.js',     'Codec fidelity — every level field survives a round trip'],
  ['codectest.js',    'Codec internals — LZW, unicode, size, compatibility'],
  // ── generation & economy ──
  ['chordtest.js',    'Harmony — every chord in all 150 charts'],
  ['econtest.js',     'Economy — flat coins, stub guard, two-click purchases'],
  ['doubletest.js',   'The Double — payout linear in speed, gated on a clear'],
  ['beststest.js',    'Records — per-level bests, and the top-50 migration'],
  // ── UI & features ──
  ['phase1test.js',   'Settings — tabs, keys, windows, audio, brightness'],
  ['phase2test.js',   'Shop — tabs, previews, earned themes, mystery boxes'],
  ['phase3test.js',   'Loading — real weighted work and a clock-driven count-in'],
  ['phase4test.js',   'Creator — sound preview and the panel growing the window'],
  ['selecttest.js',   'Creator — multi-select, cut, copy, paste'],
  ['avtest.js',       'Avatars — roster, colourways, custom upload'],
  ['jingletest.js',   'Audio — 12 instruments, 12 real phrases, one limiter'],
  ['edgetest.js',     'Platform — edge.js inert off Edge, low-power everywhere'],
  // ── presentation ──
  ['csscheck.js',     'Stylesheet — parses clean, tokens resolve, selection glows'],
  ['mattest.js',      'Materials — six themes that render measurably differently'],
  ['combotest.js',    'Combo — tiers, milestones, and the drawn hit window'],
  // ── browser-driven ──
  ['visualverify.js', 'Layout — judged line vs drawn bar, at six screen sizes'],
  ['touchverify.js',  'Touch — whole-lane taps, multi-finger chords, no ghost clicks'],
  ['layouttest.js',   'Layout — list viewport, and the scroll-linked header'],
  ['redesigntest.js', 'Redesign — ghost-lane containment and build divergence'],
  ['singlefiletest.js', 'Single file — inlining changes nothing, and fetches nothing'],
];

const APP = process.env.APP_DIR || '';
// The Redesign is generated from the shipping build, and the
// single-file suites test the generated .html files directly rather
// than whatever APP_DIR points at — so both are run once, against the
// shipping build, not again per variant.
// The V8 suites name their own build, so re-running them for each V7
// variant would just repeat identical work.
const SKIP = /Redesign/.test(APP)
  ? new Set(['redesigntest.js', 'singlefiletest.js', 'v8levels.js', 'v8campaign.js', 'v8audio.js', 'v8graphics.js', 'v8settings.js', 'v8generate.js', 'v8gameplay.js', 'v8ui.js'])
  : new Set();

let failed = [], ran = 0;
for (const [file, blurb] of SUITES) {
  if (SKIP.has(file)) { console.log('\n\x1b[2m' + file + ' — skipped (already the build under test)\x1b[0m'); continue; }
  process.stdout.write('\n\x1b[1m' + file + '\x1b[0m — ' + blurb + '\n');
  ran++;
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) failed.push(file);
}

console.log('\n' + '─'.repeat(58));
if (APP) console.log('build under test: ' + APP);
if (failed.length) {
  console.log('\x1b[31m%d of %d suites FAILED: %s\x1b[0m', failed.length, ran, failed.join(', '));
  process.exit(1);
}
console.log('\x1b[32mall %d suites passed\x1b[0m', ran);
