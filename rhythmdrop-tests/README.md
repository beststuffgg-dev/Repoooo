# RhythmDrop V7 — test harnesses

Five Node suites that boot the extension in jsdom with a stubbed Web
Audio graph and exercise it. They catch the class of bug a syntax
check can't: undefined references, null DOM lookups on boot, broken
handlers, silent regressions in generation and encoding.

## Setup

```bash
npm install          # pulls jsdom, the only dependency
npm test             # runs all five
```

Node 18 or newer.

## Where the extension has to be

Each suite finds `popup.html` by looking, in order:

1. `../RhythmDropV7/` — a sibling of this folder
2. `./RhythmDropV7/` — inside this folder
3. `RhythmDropV7/` under the current working directory
4. `../` — this folder sitting directly inside the extension

So the simplest layout is:

```
somewhere/
├── RhythmDropV7/        the unzipped extension
└── rhythmdrop-tests/    this folder
```

Anything else, point at it explicitly:

```bash
APP_DIR=/path/to/RhythmDropV7 npm test
```

## The suites

| Suite | Checks | Covers |
|---|---:|---|
| `smoke.js` | 31 | Boot with no errors, username flow, every tab, campaign locking, theme switching, light mode, shop, cosmetics, profile, creator modes, generator |
| `smoke2.js` | 11 | Scoring and streaks, lives and pips, hit windows, tile pool recycling, coin rules, v5 save migration, custom theme contrast |
| `progression.js` | 62 | Chart generation and determinism, all 150 campaign levels, song structures and forms, XP curve, share codes, doubles, prize track, dailies and boxes, economy pricing, content counts |
| `fidelity.js` | 17 | A level survives export and import with every field intact — title, tempo, difficulty, instrument, per-note pitch, sustain and voice, across the full chromatic range |
| `codectest.js` | 19 | LZW round trips, unicode names, code sizes, and backward compatibility with v2, v3 and the old v5 JSON format |

Individually:

```bash
npm run smoke
npm run progression
```

## Reading the output

`smoke.js`, `smoke2.js` and `progression.js` print each probe, then a
notes block with measured values (song lengths, price curves, chart
similarity), then errors. **`errors: none` is a pass.**

`fidelity.js` and `codectest.js` print per-assertion lines and end
with `all passing`.

`run-all.js` exits non-zero if any suite fails.

## When something fails

The notes block is usually more useful than the failure itself — it
carries the actual numbers, so you can see whether a value drifted or
a rule broke.

Two failure modes are worth naming because both have happened:

- **A stale test.** If behaviour changed deliberately, the test is
  wrong, not the code. Fix the expectation and say so.
- **A test that passes for the wrong reason.** Several probes were
  silently vacuous until an assertion was added that they'd found
  anything at all. If a probe passes on an empty result, it isn't
  testing anything.

## Updated for UPD7 Beta 14

Four probes were rewritten because the behaviour they asserted changed
on purpose, not because they broke:

- **`smoke.js` — campaign area list.** The campaign was split into one
  tab per era, so the pane renders a single era rather than ten stacked
  blocks. Now checks the 11 tabs (10 eras + Endless), the lock states,
  and that switching a tab swaps the songs.
- **`smoke.js` — locked themes / difficulty badges.** Same cause: one
  era at a time means 15 rows, not 150.
- **`smoke.js` — daily card.** The daily moved from a card in the list
  to a pill docked to the bottom of the popup, present only while a
  reward is waiting. Now checks the dock, the claim, and that the
  prize-track clearance class is released afterwards.
- **`progression.js` — repeating sections return verbatim.** Repeats are
  now ornamented rather than copied: the same section returns 73-91%
  identical with a minority of bars varied, seeded from the song so it
  stays deterministic. The probe asserts that band, that it is *not*
  byte-identical, and that two generations of the same chart match.

The stubbed `AudioContext` in `smoke.js`, `smoke2.js` and
`progression.js` also gained `createDynamicsCompressor` and its five
AudioParams, since audio.js now puts a limiter on the master bus.

## Adding a suite

Copy the header of any existing file: it stubs `AudioContext`,
`requestAnimationFrame`, `matchMedia` and `document.fonts`, then evals
the extension's scripts in load order. `progression.js` also appends a
hook object exposing module-scoped internals — `let` and `const`
bindings don't survive across separate `eval` calls, so anything you
want to reach has to be exported through that hook.

Register it in the `SUITES` array in `run-all.js`.
