# RhythmDrop V7 — Handoff

A four-lane rhythm game shipped as a Chrome extension popup. No build step, no dependencies, no network calls — everything is hand-written JS/HTML/CSS, loaded as plain `<script>` tags in a fixed order.

This document is the single reference for what's built, how it's built, and what's still open. It's written for whoever picks this project up next — human or another Claude session — to read once and not need to re-derive from commit history.

## Contents

1. [Overview & artifacts](#1-overview--artifacts)
2. [Feature inventory](#2-feature-inventory)
3. [Visual design system](#3-visual-design-system-the-look)
4. [The Redesign variant](#4-the-redesign-variant)
5. [Architecture](#5-architecture)
6. [Testing](#6-testing)
7. [Open items](#7-open-items)

---

## 1. Overview & artifacts

RhythmDrop is a tap-to-the-beat game: four lanes (keys **A S D F**), notes fall from the top, you hit them on the strike line. A 150-song campaign across 10 historical/thematic areas, a level creator, a shop economy, and a settings system sit around that core loop.

**Three shipped build forms, all generated from the same source:**

| Artifact | What it is |
|---|---|
| `RhythmDropV7/` | The real source — a folder of separate `.js`/`.html` files, loadable directly as an unpacked Chrome extension |
| `RhythmDropV7-Final.zip` | The same folder, zipped, for distribution |
| `RhythmDrop.html` | The entire game as one self-contained file — every script inlined into `popup.html` by `tools/build-single.js`, so it opens and runs from a double-click, a phone browser, or any static host, with zero network requests |

The single-file build is **generated, not hand-maintained** — running `node tools/build-single.js` reproduces it exactly. Never hand-edit `RhythmDrop.html` directly; edit the source folder and rebuild.

**The Redesign variant ships in the same three forms**, kept alongside the originals rather than replacing them — `RhythmDropV7-Redesign/`, `RhythmDropV7-Redesign.zip`, `RhythmDrop-Redesign.html`. Same JS, same features, same tests; only `popup.html` differs. See [§4](#4-the-redesign-variant).

    node tools/build-single.js                                             # -> RhythmDrop.html
    node tools/build-single.js RhythmDropV7-Redesign RhythmDrop-Redesign.html

---

## 2. Feature inventory

### Core gameplay
- Four lanes, two note types: **tap** (single hit) and **double-tap** (×2, needs two hits, worth more)
- Three hit windows — **Strict / Normal / Forgiving** — chosen in Settings, scales the timing tolerance around the judging line; note *speed* is locked per-level (changing it would make scores incomparable)
- The timing window is expressed **in beats, not pixels** (`HIT_TOL_BEATS`). Tiles cross the lane in a fixed number of beats, so a pixel tolerance buys less time the taller the screen — the old flat 68.4px was a 246ms window in the 420x640 popup but only 164ms on a tall phone, i.e. the same chart judged a third more strictly purely because of the display. As a fraction of a beat it is the same duration on every screen
- Scoring: PERFECT/GREAT/GOOD tiers by timing accuracy, a combo multiplier (+8%/hit) and a streak multiplier (+5%/hit) that compound
- Combo escalates through three visual tiers past 50 (hot → blaze → nova) — color/glow only, never moves the badge or disrupts the board
- Lives system, with a results screen showing score, XP, and coins earned
- **The Double**: replay any cleared level at **2× speed** — genuinely harder (the XP and coin formulas both key off actual speed, so it pays double, not as a bonus but because the formula treats speed honestly). Cannot be used to clear a level you haven't already cleared — it's a harder run at something you've finished, not a shortcut around finishing it
- Optional hit-window visualizer: draws the actual timing band above the strike line, sized directly from `hitTol()` itself, so what you see cannot drift from what counts
- Lane height is measured from the lane's **padding box** (`clientHeight`) — the box absolutely-positioned tiles and the strike bar are actually laid out against — and kept current by a `ResizeObserver`, which catches URL-bar hides, orientation flips, safe-area insets resolving, panel-driven window growth and late webfont reflow. None of those fire `resize`. Note the observer's `contentRect` is the only trustworthy reading inside the callback: `getBoundingClientRect()` on the same element still returns the *previous* box during that layout pass

### Campaign — 10 areas × 15 levels, fully deterministic
- Every level is generated from `mulberry32(seed)` — **never `Math.random()`** anywhere in generation — so the same seed produces the identical chart on every device, every time
- Each area has its own musical profile: scale, melodic leap bias, chord frequency, preferred rhythm-pattern families (e.g. Farmstead is folk/pentatonic/stepwise; Egypt uses a double-harmonic scale with the augmented second that reads as "ancient Near East")
- Melody moves in phrases (arcs up, resolves down, cadences toward the tonic at phrase ends) rather than as an unbroken stream — this one change is most of what makes the charts sound composed rather than random
- Seed-derived structural variation (phrase length, section shape) so campaign songs don't all follow one skeleton, without breaking cross-device determinism
- **Chord generation**: notes sharing a beat stack in thirds above the first note present (scale degree *i*, *i+2*, *i+4*) rather than being independently walked — this is what makes simultaneous hits sound like actual harmony instead of whatever interval the melody walker happened to land on. Verified across all 150 charts: zero minor seconds, thirds/fifths dominant
- **Density anti-farm**: past 85% of a chart's grid filled, additional notes pay only 15% of normal XP — closes a bug in the old build where a solid wall of notes was the fastest possible farming pattern. No generated campaign chart comes near the threshold; this only bites custom charts built to exploit it
- Campaign levels are built **through their own share code** (`buildCampaignLevel → codeForCampaign → buildCodeLevel`) — a load-bearing invariant. Don't special-case campaign generation outside that path or codes and gameplay will silently diverge

### Level creator
- Grid-based chart editor: click a tool (tap / double-tap / erase / select), draw the chart
- **Two-stage note placement**: click an empty cell places a note at the lane's default pitch; clicking that note *again* opens the pitch picker — clicking a different tool over an existing note retypes it in place without opening the picker
- **Multi-select**: drag-select a rectangle, then cut / copy / paste, scoped to the level being edited. After pasting, the block follows the cursor and pastes anchored from its first cell
- **Advanced panel**: per-theme instrument/scale, per-lane default pitch, default sustain, background sound (drums/bass loop). A **preview-sound button** is pinned to the top of the panel — plays the chart's actual opening bars with the instrument/pitches/sustain/background currently configured
- The panel **grows the window** rather than covering the grid when opened (up to a cap), and gives the space back on close — falls back to an overlay only when the window has no room left to grow
- A density warning appears live while editing, once a chart crosses the same 85% threshold the XP formula penalizes, so the payout drop is never a surprise after the fact

### Economy
- **Flat coin reward per level clear** (`COINS_PER_CLEAR = 150` in `campaign.js`), replacing an old score-derived formula that let a single clear pay anywhere from ~100 to ~180,000 coins depending on chart length and combo — coins now measure "levels cleared," not "how long was the chart"
- Guards: charts under 40 notes pay pro-rata (stops a 4-note stub from being the fastest coin source in the game — no real chart, campaign or custom, is short enough to trigger this); a run that ends early pays for the fraction of the chart actually struck; the Double pays double coins, consistent with the XP treatment
- **Two-click "arm then confirm" purchases** everywhere coins are spent: the first click *previews* (an avatar goes on the profile bar, an effect applies live to the board, a box shows the real odds it rolls on — read off the same table the roll uses, so the numbers can't drift) and arms the card; only a second click on the same card spends. Arming something else, changing tab, leaving the shop, or waiting a few seconds disarms and reverts the preview — nothing is ever written to storage until the second click confirms
- Items already owned still equip in one click — the two-step flow exists specifically to guard spending, not browsing

### Progression
- XP curve (`xpForLevel`), level-up detection, XP formula keys off actual note count and actual speed (so the Double paying double XP falls straight out of the formula rather than being a bolted-on bonus)
- **Per-level best score is saved for every level**, not capped to a top-N list (a personal record on level 7 survives fifty better runs elsewhere)
- Prize track (coin/avatar rewards at level-count milestones), daily login rewards on a 7-day cycle that lapses on a missed day
- Mystery boxes at three rarity tiers, weighted drop tables, duplicate-conversion (an already-owned pull converts to ~1/3 its coin value instead of doing nothing)

### Customization
- **12 instruments**, each synthesized in `audio.js`; each has a real ~2-second audio **jingle** (arpeggio/chord/run shaped to the instrument's character) rather than a single test note, so you can actually hear the difference between a kalimba and an organ before picking it
- Avatar shop with **colourways** (tint palettes applied over hand-drawn 3-tone artwork)
- Trails and hit-effects, each previewable live in the shop before buying
- Custom avatar upload (stored downscaled, not full-resolution, to keep localStorage sane)
- Theme system: 10 area themes (unlocked by playing that area, not purchased) + 6 base "material" themes (walnut/bone/amber/vapor/blueprint/mono), each declaring a full material (specular strength, gloss, bevel hardness, grain texture) — not just a palette swap

### Settings
- Tabbed: **Play / Audio / Look / Data**
- Key remapping per lane, starting lives, hit window
- Volume, output device picker (where the browser supports `setSinkId`)
- Brightness (root-level CSS filter, covers every screen uniformly)
- Reduced-motion respected throughout — combo tier glow, milestone pop, armed-purchase pulse, and page transitions all check it
- Data tab: sync codes (export/import your whole profile — coins, levels, scores, settings — as a short text code), individual level share codes

### Platform
- **Edge compatibility layer** — `edge.js`, a separate file that's completely inert unless the browser is actually Edge (detected via `userAgentData` brands or UA sniffing as fallback); when active it trims blur costs on low-core machines, thins scrollbars, and adds a visibility-change audio-resume nudge (Edge's Efficiency Mode throttles background tabs harder than Chrome)
- **Touch** — the whole lane column is the tap target, not just the 50px keycap (which on a phone was a small thing to hit repeatedly while reading notes at the top of the screen). Delegated at the lanes container and driven from `changedTouches`, so two or three fingers landing in the same frame all register — the browser coalesces simultaneous touches into one event, and per-element binding saw only the first, which silently dropped chords on touch but not on keyboard. `#g-lanes` sets `touch-action:none`, which removes gesture-recognition latency but also makes Chromium dispatch `touchstart` as **non-cancelable** — `preventDefault()` becomes a no-op and the compatibility click still fires, so the click path carries an explicit ghost-click guard instead
- **Low-power devices** — `html.low-power`, set by `game.js` from the same hardware floor `edge.js` uses (≤4 cores or ≤4GB), drops full-screen `backdrop-filter` blurs on modals and veils. The Edge-only check never covered phones, which are the likeliest machines to be under that floor
- First-run tutorial (localStorage-gated, shows once)
- "Update 7" label under the wordmark; small "made by Claude" credit

### Performance
- Campaign level browser used to regenerate up to 150 charts per render (145–281ms); now caches, ~6ms
- Loading screen does **real weighted work** (audio warm-up, instrument preload, tile-pool prebuild, sprite/effect warm, static layer paint) rather than a timer with a spinner over it — each step reports as it completes
- Count-in (3-2-1) is derived from `performance.now()`, not a chain of `setTimeout`s, so it can't drift or repeat a number on a late frame
- Tile pool is sized from the actual note density of the loaded chart instead of a flat constant
- Frame-budget verified: with 7 tiles on screen and the top combo tier lit, median frame time 16.7ms, zero frames over 20ms

---

## 3. Visual design system ("the look")

The full token system, component inventory, and screen-by-screen hierarchy is written up as its own artifact: **[RhythmDrop Instrument Panel](https://claude.ai/code/artifact/c0fa5f5f-4219-465b-a508-3eb080dc500a)**. Summary of what's actually load-bearing in `popup.html`:

**Palette** — near-neutral graphite surfaces (not blue-black — that's the tell of a stock dark-mode template), two desaturated hues carrying every reading a player has to make at speed: a dusty instrument teal (`--tap`, and the single app-wide accent) and a burnt amber (`--dtap`). Judgement colors — sage/brass/brick — are semantic only and never double as a second decorative accent.

**Type** — three roles, never crossed: Archivo (display, used sparingly — wordmark, area names, score), Inter Tight (body), Space Mono (data — BPM, scores, note names, hex codes).

**Structure tokens** — `--r-1/2/3` (8/13/20px, a deliberately short radius scale — a wider spread is what makes a UI read as assembled rather than designed), `--lift-1/2/3` (wide, soft, low-opacity elevation with a hairline kept at every step so edges still read once the shadow itself goes dark), `--sheen` (the lit top edge every raised surface catches), `--ease-out` (one motion curve, named, reused everywhere instead of a bare `ease`).

**Selection rule — the one hard constraint to carry forward**: state (selected / active / armed / equipped / cleared) is shown with a **shadow or glow beneath the element, never an outline or a recolored border**. A stroked ring is a debugging affordance; a light beneath is what a raised object actually does when it's the one catching attention. The single exception is the keyboard focus ring (`:focus-visible`), kept because that convention is load-bearing for accessibility. This was swept across ~18 components in `popup.html` — theme cards, creator tool buttons, avatar cards, armed-purchase cards, background-sound/bass-step selectors, custom-theme material picker, style/trail pickers, profile avatar slots, area/level/theme-block "cleared" markers, prize-track nodes, and effect cards — converting `border-color:var(--X)` selection signals to `box-shadow` glows, falling back to each element's neutral resting border underneath.

**Component language** — one segmented-control pattern (recessed track, selected cell lifts on a tonal gradient with an accent wash bleeding up from beneath) used identically for the main nav, campaign era tabs, and settings sub-tabs. One grouped-list pattern (a single floating card with hairline-divided rows and a left-rail selection marker) replacing what used to be 15 separately bordered/shadowed/rounded cards per screen. Translucent floating bars (profile bar, prize track) with `backdrop-filter` blur, so they read as sheets of material rather than painted rectangles.

---

## 4. The Redesign variant

`RhythmDropV7-Redesign/` is a **visual-only alternate build**, kept as a second copy alongside the original `RhythmDropV7/` rather than replacing it — same JS, same features, same tests, only `popup.html` differs. It exists to explore a look sourced from an uploaded Claude Design mockup (`RhythmDrop.dc.html`) without putting the shipping build at risk.

**What it adds, on top of everything in §3:**
- A **film-grain overlay** (`body::after`, a static fractal-noise SVG data-URI, `mix-blend-mode:overlay`, ~5% opacity) across the whole popup — doesn't tint or darken anything (overlay blending only nudges existing pixels toward/away from mid-grey), just breaks up large flat panels so they don't read as vector fills
- A **decorative "ghost lane" perspective strip** behind the home-screen wordmark: four faintly tinted lanes tilted away in 3D (`perspective` + `rotateX`), echoing the actual play board. The source mockup ran this at a steep 64° tilt; **this was implemented at 25% of that — 16°** — per the explicit ask, so the grid stays legibly rectangular rather than dominating the masthead. Purely decorative: `pointer-events:none`, no gameplay involvement, `aria-hidden`, and hidden entirely under reduced-motion

**Status: verified and packaged.**

The perspective strip *was* bleeding past the hero's bounds into the nav bar and song list below — `overflow:hidden` on the ancestor wasn't clipping it, because `#home` already carries its own subtle 3D tilt (from `lighting.js`), and nesting a second `perspective`/`rotateX` inside an already-3D-transformed ancestor is a spot where Chromium's overflow clipping misses. The fix stops relying on ancestor clipping at all: the strip is sized to fit inside the hero's own box (`bottom:0`, `height:92px`, rather than a taller box hanging past `bottom:-6px`) with a `mask-image` fade at both edges, so there is nothing left needing to be clipped.

That fix is now confirmed by measurement, not by eye. At 420x700, 390x844, 360x640 and 900x1000, the painted bottom of the tilted lanes lands *above* the nav's top edge every time (e.g. 180.6 vs 181.6 at 420px), and `elementFromPoint` at the nav's centre returns the nav itself, never the strip. The strip also computes `pointer-events:none` and carries `aria-hidden="true"` at all four sizes. The same check against the generated single-file build gives 178.5 vs 179.5 — the containment survives inlining.

**Identity.** So the two builds can't be confused — and can be loaded as unpacked extensions side by side — the Redesign carries its own name: manifest `name` `RhythmDrop (Redesign)`, `version_name` `UPD7 Beta 14 — Redesign`, and `<title>` `RhythmDrop — Redesign`. Nothing in the JS reads the manifest, so this is presentation only.

**Regression.** All 22 suites pass against `RhythmDropV7-Redesign/` (`APP_DIR=../RhythmDropV7-Redesign node run-all.js`), identically to the shipping build. The `popup.html` diff against `RhythmDropV7/` is exactly the two blocks above plus `body{position:relative}` (which the film grain's `position:absolute` needs as a containing block) and the strip's markup — no other divergence, which is what keeps the two builds' behaviour identical.

---

## 5. Architecture

**Load order is fixed and matters**: `edge.js → lighting.js → campaign.js → codec.js → loading.js → audio.js → game.js`. Each file is an IIFE exposing one global (`window.RD_Campaign`, `window.RD_Codec`, `window.RD_Audio`, `window.RD_Lighting`, `window.RD_Loading`, `window.RD_Edge`, plus flat exports like `window.RD_INSTRUMENTS`, `window.RD_TILE_POOL`). `game.js` is the only file that reaches into DOM and wires everything together, and it assumes every earlier module is already on `window`.

**Determinism invariant**: campaign chart generation never calls `Math.random()` — only `mulberry32(seed)`. Campaign levels are built *through* their own share code path (`buildCampaignLevel → codeForCampaign → buildCodeLevel`), not generated once and separately encoded — this is what guarantees a level and its share code can never drift apart.

**Codec**: share/sync codes are LZW-compressed, varint-packed, base64url-encoded. Voice (instrument) is encoded as a state change, not a per-note field, to keep codes short.

**localStorage keys**: `rd_profile`, `rd_progress`, `rd_shop`, `rd_settings`, `rd_scores`, `rd_levels`, `rd_daily`, `rd_theme`, `rd_custom_theme`, `rd_custom_av`, `rd_bests`, `rd_tutorial`, `rd_bests_migrated`.

**No build step**: `RhythmDropV7/` is loaded directly as an unpacked extension. `RhythmDrop.html` is generated from it by `tools/build-single.js` (now committed — it walks `popup.html`'s `<script src="...">` tags and inlines each file's contents in place, and throws rather than writing a broken file if no tag matches or one survives the pass). It takes an optional source folder and output path, which is how the Redesign's bundle is built. Re-run it after any source change to keep the single-file builds in sync; never hand-edit either `.html`.

---

## 6. Testing

**One suite now, not two.** Everything lives in `rhythmdrop-tests/` and runs from one command:

    cd rhythmdrop-tests && npm install && node run-all.js

That is **22 harnesses, ~450 probes**, and it exits non-zero if any suite fails, so it drops straight into CI or a pre-commit hook. The session-authored tests that used to live only in a scratchpad are now committed alongside the original five.

`APP_DIR` picks which build to test — unset it's the shipping one:

    APP_DIR=../RhythmDropV7-Redesign node run-all.js

**Core** — `smoke.js`, `smoke2.js` (screens, shop, avatars, themes, key handling, contrast; scoring, lives, tile pool, migration), `progression.js` (XP/level/coin economy, the Double's payout math), `fidelity.js` (audio rendering under `OfflineAudioContext`), `codectest.js` (codec round-tripping, LZW/varint edge cases, unicode, size).

**Generation & economy** — `chordtest.js` (harmonic correctness across all 150 campaign charts — zero minor seconds verified), `econtest.js` (flat coin rewards, two-click purchase flow), `doubletest.js`, `beststest.js`.

**UI & features** — `phase1test.js`–`phase4test.js` (one per roadmap phase: settings tabs/audio config/brightness, shop tabs/previews/mystery boxes, real weighted loading and the time-based count-in, creator sound preview and panel resizing), `selecttest.js` (creator multi-select and cut/copy/paste), `avtest.js`, `jingletest.js`, `edgetest.js`.

**Presentation** — `csscheck.js` (stylesheet parses clean, no rules orphaned by a stray `/* */`), `mattest.js` (all 6 base themes render measurably different edges and highlights), `combotest.js` (combo tiers, milestones, and the hit-window visualizer's drawn band matching `hitTol()` exactly at all three settings).

**Browser-driven — the two that matter most.** `visualverify.js` and `touchverify.js` launch real Chromium rather than jsdom, because *jsdom has no layout engine and structurally cannot catch a layout bug*. `visualverify` compares rendered pixel positions against the numbers the engine actually judges with, at six screen sizes; it is what found the strike line sitting 12–19px off the bar it was drawn on, and the drawn hit window frozen at 46.5px on every screen. `touchverify` covers whole-lane taps, simultaneous-finger chords, and the ghost double-fire on the keycap.

`browser.js` resolves which Chromium to launch (newest installed build, `PW_CHROME` to override) — Playwright's own default asks for a headless-shell build that isn't always installed next to the full browser.

**Standard step after any change**: re-run the suite against the generated single-file build too, to confirm inlining didn't change behaviour.

---

## 7. Open items

Everything previously listed here has landed — the Redesign is verified, packaged and committed (§4), the build script and all session-authored tests are in the repo (§5, §6), and the handoff doc and outline-to-shadow sweep are on `main`. What's left is genuine open work:

- **Unresolved, needs the user**: they reported "the hit code is broken for all levels", and I could not reproduce it under either reading. Hit detection measures 100% via the autoplayer on every level tested, and share codes round-trip 150/150 with UI entry launching the right song and rejecting bad codes cleanly. Both apparent failures during investigation turned out to be bugs in the test, not the game. **If this is still happening, the most likely cause is the audio-offset fix**: `offsetPx` is now derived from the real beat length rather than a fixed constant, so a device calibrated against the old behaviour would need re-calibrating in Settings. Ask what they're actually seeing before changing hit code.
- **Tuning, not a bug**: the low-density styles leave levels 53–71% empty rows (Drone 0.55, Ballad 0.7, Lullaby 0.6, Nocturne 0.65). After the meter fix the median across the campaign is 29.9% (down from 38.6%) and the longest silence is 8 beats (down from 13), so nothing is structurally dead any more — these are just sparse by design. Worth a listen to decide whether sparse reads as "atmospheric" or "empty" before touching the numbers.
- **Repo-side polish**: the GitHub About sidebar (short description, topics, homepage link) is still empty. No connected tool can set it — it's a one-click manual edit in repo Settings.
