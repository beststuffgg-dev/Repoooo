# RhythmDrop — test harnesses

Twenty-eight suites, one command. Three cover **V8**, the current game;
the other twenty-five cover **V7**, kept alongside it under `other/v7/`
and still green. Most boot the build in jsdom with a stubbed Web Audio
graph; six drive real Chromium, because jsdom has no layout engine and
structurally cannot catch a layout bug.

## V8 — the current game

| Suite | Covers |
|---|---|
| `v8levels.js` | The 150 baked songs against the build that plays them: the flat encoding decoding back to real charts, every voice the charts reference existing in `audio.js`, zero minor seconds across 8,658 chords, and the generator still being present to re-bake with |
| `v8campaign.js` | Flat coins per clear, partial runs, the XP curve and its linearity in speed, the density cap, unlock chaining, and the seven-day daily including its lapse |
| `v8ui.js` | Real Chromium: the pinned height, the advanced panel widening the window without moving the grid, the overlay fallback at the cap, and one whole run from the campaign list to the results screen |

```bash
npm run test:v8          # just these three
V8_DIR=/path/to/build npm run test:v8
```

The V8 suites always test `other/RhythmDropV8` unless `V8_DIR` says
otherwise, so `APP_DIR` never affects them.

## V7 — kept alongside

## Setup

```bash
npm install          # jsdom and playwright
npm test             # runs all 25
```

Node 18 or newer. `run-all.js` exits non-zero if any suite fails, so it
drops straight into CI or a pre-commit hook.

## Which build gets tested

`APP_DIR` picks it. Unset, it's the shipping one:

```bash
npm test                                    # everything, 28 suites
APP_DIR=RhythmDropV7-Redesign npm test      # V7's suites against its variant
```

`APP_DIR` selects which **V7** build its suites run against. It accepts
a bare folder name, or a path relative to this folder, to `other/`, to
`other/v7/`, or to the repo root — whichever you happen to type. Unset,
it's `other/v7/RhythmDropV7/`, with fallbacks for this folder sitting
beside a bare extension (which is how it works if you unzip it on its
own):

```
somewhere/
├── RhythmDropV7/     the unzipped extension
└── tests/            this folder
```

`browser.js` is the only file that knows any of that. Every suite asks
it, so moving a folder is one edit rather than eight copies of the same
path list going stale at different rates.

`redesigntest` and `singlefiletest` test V7's generated artifacts
directly rather than whatever `APP_DIR` points at, so they run once and
are skipped when `APP_DIR` is the Redesign. The three V8 suites are
skipped then too, for the same reason: they name their own build.

### V7's suites

**Core**

| Suite | Covers |
|---|---|
| `smoke.js` | Boot with no errors, username flow, every tab, campaign locking, theme switching, light mode, shop, cosmetics, profile, creator modes, generator |
| `smoke2.js` | Scoring and streaks, lives and pips, hit windows, tile pool recycling, coin rules, v5 save migration, custom theme contrast |
| `progression.js` | Chart generation and determinism, all 150 campaign levels, song structures and forms, XP curve, share codes, doubles, prize track, dailies and boxes, economy pricing, content counts |
| `fidelity.js` | A level survives export and import with every field intact — title, tempo, difficulty, instrument, per-note pitch, sustain and voice, across the full chromatic range |
| `codectest.js` | LZW round trips, unicode names, code sizes, and backward compatibility with v2, v3 and the old v5 JSON format |

**Generation & economy**

| Suite | Covers |
|---|---|
| `chordtest.js` | Every simultaneous stack in all 150 charts — 8,658 stacks, 15,869 intervals, zero minor seconds, 88% consonant, triads stacked in thirds |
| `econtest.js` | Flat coins per clear, the stub guard, partial runs, and the two-click arm-then-confirm purchase flow |
| `doubletest.js` | The Double's payout is linear in speed rather than a bolted-on bonus, and it is gated on an existing clear |
| `beststest.js` | Per-level records survive fifty unrelated runs; the old top-50 log migrates once |

**UI & features**

| Suite | Covers |
|---|---|
| `phase1test.js` | Settings tabs, key remapping, lives, the three hit windows, volume, the feature-detected output picker, brightness as a root filter |
| `phase2test.js` | Shop tabs and stock, themes earned by clearing an area, mystery box drop tables, live previews |
| `phase3test.js` | The loading screen does real weighted work; the count-in is derived from `performance.now()`, not a timer chain |
| `phase4test.js` | The creator's sound preview plays the chart's own bars; the advanced panel grows the window and gives it back |
| `selecttest.js` | Multi-select rectangles, cut/copy/paste, lane clamping, chart growth, clipboard isolation |
| `avtest.js` | The avatar roster, colourway palettes, campaign-exclusive avatars staying off the shelf, downscaled custom uploads |
| `jingletest.js` | 12 instruments, 12 real ~2s phrases in three shapes, no samples, no network, one limiter |
| `edgetest.js` | `edge.js` is completely inert off Edge and active on it; low-power gating is shared, not Edge-only |

**Presentation**

| Suite | Covers |
|---|---|
| `csscheck.js` | The stylesheet parses, no rule is orphaned by a stray `/* */`, every `var()` resolves, and state is a glow beneath rather than a recoloured border |
| `mattest.js` | The six base materials render measurably different edges, faces, grains and blurs |
| `combotest.js` | Combo tiers and milestones, and the drawn hit-window band matching `hitTol()` exactly at all three settings |

**Browser-driven** — real Chromium, because these are the ones jsdom cannot answer

| Suite | Covers |
|---|---|
| `visualverify.js` | The judged line against the drawn bar at six screen sizes; found the strike line sitting 12–19px off the bar, and the drawn window frozen at 46.5px |
| `touchverify.js` | Whole-lane taps, simultaneous-finger chords, and the ghost double-fire on the keycap |
| `layouttest.js` | The campaign list viewport no longer tracks window height, and the header collapse moves content 1:1 with the wheel |
| `redesigntest.js` | Ghost-lane containment measured at four sizes and in the single file, plus an exact divergence audit against the shipping build |
| `singlefiletest.js` | The generated `.html` builds inline every module byte-for-byte, boot clean, make zero network requests, and keep the same layout invariants |

Individually:

```bash
npm run smoke
npm run layout
npm run chords
```

## Shared scaffolding

- `harness.js` — the jsdom boot: locates the build, stubs `AudioContext`,
  `requestAnimationFrame`, `matchMedia`, `ResizeObserver` and
  `document.fonts`, evals the modules in load order, and provides
  `probe()` / `report()`. A platform stub gained here is gained
  everywhere at once.
- `browser.js` — resolves which Chromium to launch (newest installed
  build, `PW_CHROME` to override — Playwright's own default asks for a
  headless-shell build that isn't always installed next to the full
  browser) and which build to point at, and boots the popup past the
  splash and first-run screens.

`let` and `const` bindings don't survive across separate `eval` calls,
so anything module-scoped has to be exported through a hook appended
to the file that declares it — see the `HOOK` string at the top of any
suite that reaches into internals.

## Reading the output

Most suites print each probe, then a notes block with measured values,
then errors. **`errors: none` is a pass.** The notes block is usually
more useful than a failure message: it carries the actual numbers, so
you can see whether a value drifted or a rule broke.

## When something fails

Three failure modes are worth naming because all three have happened
here:

- **A stale test.** If behaviour changed deliberately, the test is
  wrong, not the code. Fix the expectation and say so.
- **A test that passes for the wrong reason.** Several probes were
  silently vacuous until an assertion was added that they'd found
  anything at all. `chordtest` asserts it found 500+ stacks before
  claiming zero minor seconds; `mattest` was reading `--mat-*` off
  `<html>` when the theme classes are on `<body>`, and reported all
  seven materials as identical.
- **A test reading its own subject's comments.** `phase3test` searched
  the count-in for `setTimeout` and found it — inside the comment
  explaining that the count-in doesn't use one. Comments are stripped
  before that class of check now.

## Adding a suite

```js
const { boot } = require('./harness');
const HOOK = `;window.__t = { /* module-scoped things you need */ };`;
const { window, D, notes, probe, report, T } = boot({ hook: HOOK });

probe('the thing does the thing', () => { /* throw on failure */ });
report('mysuite');
```

Then register it in the `SUITES` array in `run-all.js` and add a
`scripts` entry in `package.json`.
