# RhythmDrop V8 — Handoff

A four-lane rhythm game shipped as a Chrome extension popup. No build step for the app itself, no dependencies, no network calls.

V8 is built on the **v3.0** source — its look, its themes, its intro splash, its shop — with the campaign and progression systems from V7 ported onto it. V7 is not gone: it lives whole under `other/v7/`, still builds, and still passes its own 25 test suites. See [`other/v7/HANDOFF.md`](v7/HANDOFF.md) for that one.

---

## 1. Layout

```
RhythmDropV8.zip          the game, zipped
htmls/RhythmDrop.html     the game as one self-contained file (generated)
tests/                    28 suites — 3 for V8, 25 for V7
other/
  RhythmDropV8/           the source — load this as an unpacked extension
    popup.html              markup, styling, the v3 theme system
    game.js                 screens, input, scoring, campaign UI, shop, creator
    campaign.js             progression: unlocks, XP, coins, records, dailies
    levels.js               THE 150 SONGS, baked — generated, do not hand-edit
    audio.js                12 synthesized instruments, limiter, background layer
  v7/                     the previous game, kept whole and still working
  tools/                  bake-levels.js, build-single.js, build-redesign.js, package.sh
  docs/                   screenshots
```

Regenerate every derived artifact:

```
bash other/tools/package.sh
```

That rebuilds V8's single file and zip, and V7's in place. It deliberately does **not** re-bake the campaign — see §3.

---

## 2. What V8 is

Everything the v3.0 build had — four lanes on **A S D F**, tap and double-tap notes, combo and streak multipliers, lives, the shop (avatars, colourways, note trails, mystery boxes), 12 themes including glass/paper/arctic, the custom theme builder, chaos keys, the intro splash, the level creator with its note picker and per-lane pitches — plus:

- **A 150-song campaign** across ten historically themed areas: Farmstead, Egypt, Greece, Rome, Aztec, Maya, Old England, Napoleonic, Modern, Retro-Future. Each area has its own instrument, scale and rhythmic character.
- **Unlocking that chains**: a song opens when the one before it is cleared, an area opens when the previous one is finished. Nothing is gated behind coins.
- **XP and levels**, keyed off the chart's note count and tempo — so a faster, denser song is worth more, and playing at double speed pays double straight out of the formula.
- **Per-level records**, keyed by level id rather than name (two areas do name a song the same thing).
- **A seven-day daily reward** that lapses on a missed day.
- **Flat coins per clear** (150), replacing v3's score-derived reward. Coins now count levels cleared rather than how long the chart was: the shortest campaign song is 52 notes and the longest 758, and both pay the same.
- **Twelve instruments**, up from five — the campaign needs them, because a chart composed for a lyre that falls back to a guitar stops sounding like the place it is set.

Deliberately **not** ported from V7: share/sync codes, endless mode, the materials system, and the weighted loading pipeline.

---

## 3. The campaign is data, not a seed

The 150 songs were composed once and written to `levels.js`. They are not generated at boot.

```
node other/tools/bake-levels.js
```

loads the deterministic composer that still lives at `other/v7/RhythmDropV7/campaign.js`, runs it over every area and level, and writes the result out. **The composer is kept, not replaced** — the campaign can be regenerated deliberately.

Why bake at all: a song that exists as a file can be read, diffed and reviewed. A song that only exists as a seed can only be re-derived, and any change to the composer silently rewrites all 150 under the player's feet.

**Format.** Each level stores its notes as a flat run of six integers — row, lane, type, MIDI, sustain×10, instrument index. Pitches are MIDI rather than frequencies: the composer draws every note from an equal-tempered table, so the number is exact, a third of the size, and readable. The baker asserts every pitch survives the frequency→MIDI→frequency round trip before writing. 150 levels, 40,913 notes, 623 KB.

**The trap to know about.** The composer resolves each area's voice against whatever `window.RD_INSTRUMENTS` says the target build has, falling back to a near neighbour when one is missing. Baking against an empty roster silently collapses ten area voices into four, and every song after Farmstead comes out wrong — the first bake did exactly that. `bake-levels.js` therefore declares the roster V8 actually ships, and `v8levels.js` asserts the shipped `audio.js` still provides every id the baked charts reference.

**A known quirk, inherited.** 11 notes of the 40,913 sit above C8, up to 5.6 kHz, in the two brass areas (4 and 8). They come from the composer's melody walker running off the top of the chromatic table — the raw baked MIDI numbers carry them, so V7 has always had them too. They are left as composed rather than quietly transposed, and pinned at 11 by the test so the count cannot grow unnoticed.

---

## 4. The two layout changes

**The advanced creator panel opens sideways.** It used to open downward, between the toolbar and the grid, which pushed the chart off the bottom of a window that cannot grow taller. It is now a right-hand column, and opening it *widens the window* rather than taking space from the grid. Measured: the window goes 420 → 720, the grid keeps its width to within a pixel, and closing returns the window to exactly 420. The transient widening is kept separate from the player's chosen width so it is never saved as a preference. At the width cap it falls back to floating over the grid rather than opening an unusable sliver.

**Vertical resizing is gone, and the reason it never worked is the fix.** Chrome renders an extension popup at most 800×600 and clips the rest, so the old height setting was moving a number the browser then ignored. The height is pinned to that ceiling, the corner grip is `resize:horizontal`, and everything vertical scrolls instead. Served as an ordinary page rather than a popup there is no such ceiling, and it takes the viewport.

---

## 5. Architecture

**Load order is fixed**: `levels.js → campaign.js → audio.js → game.js`. The baked data first, then the engine that reads it, then audio, then the game that wires them together.

- `levels.js` — one global, `window.RD_LEVEL_DATA`. Generated.
- `campaign.js` — one global, `window.RD_Campaign`. Expands baked levels on demand (building all 150 grids at boot would be 40,913 notes of work for a list that shows names and tempos) and carries the XP curve, the coin rules, the density cap, unlock chaining and the daily.
- `audio.js` — twelve voices synthesized from oscillators and envelopes, a limiter on the master bus, per-note sustain and per-note instrument override, and a drum/bass background layer. No samples and no fetches, which is what lets the whole game ship as one file that requests nothing.
- `game.js` — screens, input, the run loop, the campaign browser, the shop, the creator. Script scope, not an IIFE: a top-level `const` here is in the temporal dead zone until its line runs, and `typeof` on a TDZ binding **throws** rather than yielding `"undefined"`, so anything read during boot is declared at the top of the file.

**localStorage keys**: `rd_profile`, `rd_progress`, `rd_settings`, `rd_scores`, `rd_bests`, `rd_levels`, `rd_daily`, `rd_theme`, `rd_custom_theme`, `rd_custom_av`, `rd_shop`, `rd_glass_trans`, `rd_master_vol`, `rd_music_vol`, `rd_instrument`.

**No remote fonts.** The v3 base pulled two families from `fonts.googleapis.com` via a CSS `@import` — render-blocking, at the top of the sheet, and blocked outright in a packed extension, so every popup open waited on the network and then fell back anyway. The stacks name the same faces first for anyone who has them installed.

---

## 6. Testing

```
cd tests && npm install && node run-all.js
```

28 suites. Three cover V8:

| Suite | Covers |
|---|---|
| `v8levels.js` | The baked campaign against the build that plays it: 150 levels, the flat encoding decoding back to real charts, every referenced voice existing in `audio.js`, zero minor seconds across 8,658 chords |
| `v8campaign.js` | Flat coins, partial runs, the XP curve and its linearity in speed, the density cap, unlock chaining, the seven-day daily and its lapse |
| `v8ui.js` | Real Chromium: the pinned height, the side panel widening the window without moving the grid, the overlay fallback, and one whole run from the campaign list to the results screen |

The remaining 25 are V7's, unchanged, running against `other/v7/`. `APP_DIR` selects which V7 build they test; `V8_DIR` overrides the V8 one.

---

## 7. Open items

- **The campaign has no ending.** Clearing area 10 leaves you at the last song with nothing after it. V7 had an endless mode for this; it was not ported.
- **Difficulty is inherited, not tuned.** The 150 charts carry V7's difficulty curve. Nobody has played them in V8's engine end to end — V8's scoring has v3's lives-based multiplier, which V7 did not have, so the balance may not be the same game.
- **The creator cannot make campaign-shaped levels.** It writes the same grid format, but nothing lets you save one into an area or share it.
- **The 11 above-C8 notes** (§3) are worth a listen before deciding whether to leave them.
