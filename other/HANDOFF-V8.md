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
- **Two graphics styles.** *Modern* (default) gives the board depth, lit tile edges and a glowing strike line; *Classic* is the original flat look, kept as a real choice. See [§5](#5-graphics).
- **Textured themes.** Six material themes ported from V7 — walnut (wood grain), bone (paper tooth), amber (brushed brass), vapor (frosted glass), blueprint (drafting linen), mono (rubber stipple) — each painting a real grain over the faceplate, alongside the flat palette themes.
- **Compact share codes.** A custom level exports as a short `RD2:` code (~93% smaller than the old base64-JSON blob), via the same LZW+varint codec V7 uses. Codes shared from the old build still import.

- **Live generation, and Endless.** V7's composer is bundled (see [§4a](#4a-live-generation)), so Generate rolls a fresh song on the spot and Endless rolls a new one every run. A generated chart can be kept as a custom level.
- **Per-song instruments.** Each of the 150 songs plays in the voices it was composed for — Egypt on flute, Greece on lyre — with a Settings toggle to hear your own pick everywhere instead.
- **Two-stage note placement in the creator.** First tap fills a cell; a second tap opens one popup with type, pitch and sustain, replacing the inline dropdowns.
- **The Double.** Any cleared level can be replayed at 2× speed for 2× reward — offered on the results screen after a clear, and as a 2× badge on cleared song rows.
- **Hit windows.** Strict / Normal / Forgiving, in Settings → Gameplay. Note *speed* stays fixed per song so scores remain comparable; only the timing tolerance moves.

Deliberately **not** ported from V7: share/sync codes as a general import format, the materials system, and the weighted loading pipeline.

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

## 4a. Live generation

V8 ships a baked campaign, but V7's deterministic composer is bundled as `other/RhythmDropV8/generator.js` — the same file as `other/v7/RhythmDropV7/campaign.js`, verbatim but for exposing `window.RD_Generator` instead of `window.RD_Campaign` (V8 already has an `RD_Campaign`, its progression engine; the two do not collide). It loads after `audio.js` because it reads `window.RD_INSTRUMENTS` to resolve each area's voice.

Two entry points use it:

- **Generate** (Custom tab) rolls a random seed at the chosen difficulty band and launches the chart straight away. After a clear, a *Keep this level* button on the results screen saves it as a custom level.
- **Endless** (a card under the ten campaign areas) does the same but flags the run endless, so the results button becomes *Next song* and rolls another chart in the same band.

A generated chart is a normal level object — grid, tempo, lane pitches, per-note voices — flagged `generated` so it is never mistaken for a campaign level (a generated clear marks no area cleared and grants no campaign progress). `v8generate.js` asserts the bundle is V7's composer with only the banner and export name changed, that charts are real and deterministic and denser in the hard band, and that Generate / Keep / Endless all behave.

`generator.js` is a copy — **re-copy it from v7 if the composer changes**, don't hand-edit.

---

## 5. Graphics

Two styles, chosen in Settings → Display: **Modern** (default) and **Classic**. Separately, the default *theme* is now **Graphite** — V7's near-neutral faceplate palette (graphite surfaces, a dusty teal and a burnt amber doing the colour work) with V7's typography (Archivo display, Inter Tight body, Space Mono data). The twelve original themes are all still present, one tap away in the Themes tab.

The whole updated look is one block of CSS scoped under `body.gfx-modern`, and it is **strictly additive** — it does not change a single rule above it. That is what makes "the old style is still available" a fact rather than a hope: with the class off there is nothing left to render differently. `v8graphics.js` parses the stylesheet and asserts every one of the 52 selectors in the block is scoped under that class, that its keyframes are uniquely named so they cannot shadow the originals, and that nothing outside the block mentions the class at all.

Verified by pixel comparison against the build from before the change: home, shop, themes and creator all render **byte-identical** under Classic, and all four differ under Modern.

What Modern adds, all derived from the active theme's own tokens so every one of the twelve themes works under both:

- **The board reads as a shaft.** A dark gradient at the top and shadow pooling at the bottom, so notes arrive out of somewhere instead of appearing on a flat rectangle.
- **Tiles are objects.** A lit top edge, shading pooling beneath it, a gloss that scales with the tile's height, and light cast onto the lane below. The ×2 tile gets a second read — an inner rim and a pair of marks across its face — because it has to be legible at speed.
- **The strike line is the most important pixel on screen**, so it is tapered to read as light rather than a drawn rule, with a bright core and a bloom the tile passes through. The landing glow moved above the line, where the tile actually is when it counts, rather than below it behind the keycaps.
- **Keycaps behave like keys**, with a bevel and a pressed state.
- **Panels get one hairline of light** along the top edge — the cheapest way to make a flat fill read as a surface facing up — plus elevation under cards and rows.
- **The light themes invert it.** A white sheen on a near-white panel is invisible, so under Paper and Arctic the shadow does the work instead.

`applyTheme` replaces `body.className` outright, so the style class is carried across explicitly — otherwise picking a theme would silently turn the graphics off. The suite checks that across all 13 themes.

---

## 6. Architecture

**Load order is fixed**: `levels.js → campaign.js → codec.js → audio.js → generator.js → game.js`. The baked data first, then the engine that reads it, then the codec, then audio, the live generator (endless), and the game that wires them together.

`codec.js` is V7's, unchanged — a self-contained IIFE exposing `window.RD_Codec`. `exportLevel`/`importLevel` go through it, so a custom level shares as a short `RD2:` code instead of a multi-kilobyte base64-JSON blob; `decodeLevel` still reads the old `RHYTHMDROP:` codes, so nothing shared from an earlier build breaks. The codec encodes instrument as a *sticky state change* rather than a per-note field to keep codes short — harmless for creator charts, which carry no per-note voice.

**Textured themes.** The six material themes each set `--mat-grain` (an SVG-noise or gradient texture); a `#home/#creator/#game::after` layer paints it over the faceplate, behind content, with the screen made a stacking context via `isolation:isolate`. Flat themes leave `--mat-grain: none` and paint nothing, so the layer is inert for them and identical under both graphics styles.

- `levels.js` — one global, `window.RD_LEVEL_DATA`. Generated.
- `campaign.js` — one global, `window.RD_Campaign`. Expands baked levels on demand (building all 150 grids at boot would be 40,913 notes of work for a list that shows names and tempos) and carries the XP curve, the coin rules, the density cap, unlock chaining and the daily.
- `audio.js` — twelve voices synthesized from oscillators and envelopes, a limiter on the master bus, per-note sustain and per-note instrument override, and a drum/bass background layer. No samples and no fetches, which is what lets the whole game ship as one file that requests nothing.
- `game.js` — screens, input, the run loop, the campaign browser, the shop, the creator. Script scope, not an IIFE: a top-level `const` here is in the temporal dead zone until its line runs, and `typeof` on a TDZ binding **throws** rather than yielding `"undefined"`, so anything read during boot is declared at the top of the file.

**localStorage keys**: `rd_profile`, `rd_progress`, `rd_settings`, `rd_scores`, `rd_bests`, `rd_levels`, `rd_daily`, `rd_theme`, `rd_custom_theme`, `rd_custom_av`, `rd_shop`, `rd_glass_trans`, `rd_master_vol`, `rd_music_vol`, `rd_instrument`.

**No remote fonts.** The v3 base pulled two families from `fonts.googleapis.com` via a CSS `@import` — render-blocking, at the top of the sheet, and blocked outright in a packed extension, so every popup open waited on the network and then fell back anyway. The stacks name the same faces first for anyone who has them installed.

---

## 7. Testing

```
cd tests && npm install && node run-all.js
```

33 suites. Eight cover V8:

| Suite | Covers |
|---|---|
| `v8levels.js` | The baked campaign against the build that plays it: 150 levels, the flat encoding decoding back to real charts, every referenced voice existing in `audio.js`, zero minor seconds across 8,658 chords |
| `v8campaign.js` | Flat coins, partial runs, the XP curve and its linearity in speed, the density cap, unlock chaining, the seven-day daily and its lapse |
| `v8audio.js` | Every instrument **rendered** through an OfflineAudioContext and measured — not just present. Peak, RMS, duration and brightness per voice, the double-tap fifth, sustain, the per-note override, the output ceiling and the volume controls |
| `v8graphics.js` | That the graphics layer is strictly additive, that Classic and Modern really differ, and that the style survives all 13 theme switches |
| `v8settings.js` | Every setting driven the way a player drives it, with the effect measured elsewhere — the engine's reported volume, the window's real width, the key that actually fires a lane — and all of it surviving a reload |
| `v8generate.js` | The bundled composer is V7's verbatim, generated charts are real and deterministic, and Generate / Keep / Endless behave without touching campaign progress |
| `v8gameplay.js` | The hit window widens the tolerance in order and is applied to judging; the Double runs at half the beat, pays double, is offered only off a clear and never chains |
| `v8ui.js` | Real Chromium: the pinned height, the side panel widening the window without moving the grid, the overlay fallback, and one whole run from the campaign list to the results screen |

The remaining 25 are V7's, unchanged, running against `other/v7/`. `APP_DIR` selects which V7 build they test; `V8_DIR` overrides the V8 one.

**On audio testing.** Everything before `v8audio` was structural — the roster has twelve ids, the file parses, the functions exist — and none of it would have caught a voice that was lifted from another build and no longer works. Rendering the samples caught two real bugs: the limiter was not actually limiting (seven simultaneous double-taps peaked at 1.318, a third past full scale), and `ctx()` called `resume()` unguarded on a context that could not be resumed, where the throw takes the note with it.

---

## 8. Open items

- **After the campaign, there is Endless.** Clearing area 10 no longer dead-ends — the Endless card rolls fresh songs indefinitely. There is still no scored, ranked endless *ladder* the way some rhythm games have; it is practice, not a leaderboard.
- **Difficulty is inherited, not tuned.** The 150 charts carry V7's difficulty curve. Nobody has played them in V8's engine end to end — V8's scoring has v3's lives-based multiplier, which V7 did not have, so the balance may not be the same game.
- **The creator cannot make campaign-shaped levels.** It writes the same grid format, but nothing lets you save one into an area or share it.
- **The 11 above-C8 notes** (§3) are worth a listen before deciding whether to leave them.
- **Modern is not applied to every screen yet.** The board, the campaign list, the shop cards, the profile bar and the creator grid all pick it up; the mystery-box reveal, the results overlay and the username screen still render the same under both.
