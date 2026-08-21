// ═══════════════════════════════════════════
//  RhythmDrop loading.js — v6 Phase 3
//
//  The point of this file is that the bar is doing real
//  work, not counting to 100. When the loading UI clears,
//  everything is genuinely ready, so the first frame of
//  play doesn't hitch.
//
//  Two tiers:
//    1. Title card — level name + length, rises and fades.
//       On a warm machine the queue finishes inside this
//       window and no loading indicator is ever seen.
//    2. Bouncing ball — only if the queue is still running
//       when the card is done. Indeterminate on purpose.
// ═══════════════════════════════════════════

(function () {
  'use strict';

  // ── Boot splash ────────────────────────────
  // Held until fonts are ready, so the wordmark never
  // flashes in a fallback face and reflows.
  function dismissBootSplash() {
    const el = document.getElementById('boot-splash');
    if (!el) return;
    el.classList.add('done');
    setTimeout(() => el.remove(), 360);
  }

  const fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready.catch(() => {})
    : Promise.resolve();

  // Minimum hold so the animation reads as intentional rather than a
  // flicker. This was 1150ms, which the splash choreography needed —
  // but it is a wait the player pays every single time they open the
  // popup. The animation is now retimed to finish at ~620ms and this
  // follows it down, roughly halving time-to-interactive.
  const MIN_SPLASH_MS = 660;
  Promise.all([
    fontsReady,
    new Promise(r => setTimeout(r, MIN_SPLASH_MS)),
  ]).then(dismissBootSplash);
  // Hard ceiling. Fonts are local now, so nothing here should ever
  // take this long — but a stalled font load must never trap the user.
  setTimeout(dismissBootSplash, 1800);

  // ═══════════════════════════════════════════
  //  Preload tasks
  // ═══════════════════════════════════════════

  // Yield to the browser so the UI can paint between steps.
  const yieldToPaint = () => new Promise(r => setTimeout(r, 0));

  // ── Warm the audio graph ───────────────────
  // The first node of a given shape is the expensive one, and
  // AudioContext.resume() costs real time. Paying both here is
  // what removes the late first note.
  function warmAudio() {
    try {
      if (!window.RD_playNoteFreq) return;
      const ctx = window.RD_getContext && window.RD_getContext();
      if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
      window.RD_warmSilent = true;
      window.RD_playNoteFreq(261.63, false, 0);
      window.RD_warmSilent = false;
    } catch (e) {
      window.RD_warmSilent = false;
    }
  }

  // ── Pre-instantiate every distinct note in the chart ───────
  // Walks the queue, finds each unique (freq, dtap, sustain)
  // combination and builds it once at zero gain.
  function preloadInstrument(queue) {
    if (!window.RD_playNoteFreq || !queue) return;
    const seen = new Set();
    window.RD_warmSilent = true;
    try {
      for (const n of queue) {
        const key = n.freq + '|' + n.type + '|' + (n.sustain || 0);
        if (seen.has(key)) continue;
        seen.add(key);
        window.RD_playNoteFreq(n.freq, n.type === 'dtap', n.sustain || 0);
        if (seen.size >= 24) break;   // enough to compile every shape
      }
    } catch (e) { /* warming is best-effort */ }
    window.RD_warmSilent = false;
  }

  // ── Tile pool ──────────────────────────────
  // The old code created and removed a div per note, which is
  // why long levels degraded. Build once, recycle forever.
  // Tiles survive between levels, so top the pool up rather than
  // throwing 64 nodes away and building 64 more on every load.
  function prebuildTilePool(n) {
    const pool = window.RD_TILE_POOL || (window.RD_TILE_POOL = []);
    for (let i = pool.length; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'tile';
      el.style.display = 'none';
      pool.push(el);
    }
  }

  // ── Force layout + paint of the static layers ──────────────
  // So frame one only has to move tiles.
  function paintStaticLayers() {
    const lanes = document.getElementById('g-lanes');
    if (lanes) void lanes.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      const l = document.getElementById('lane' + i);
      if (l) void l.getBoundingClientRect();
    }
    const hud = document.getElementById('g-hud');
    if (hud) void hud.getBoundingClientRect();
  }

  // ── Decode the sprites the board will use ──────────────────
  // The lane keycaps, HUD icons and pips all reference symbols from the
  // inline sheet. Touching them here forces the raster before the first
  // frame instead of during it.
  function warmSprites() {
    const seen = new Set();
    document.querySelectorAll('#game svg use').forEach(u => {
      const href = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
      if (!href || seen.has(href)) return;
      seen.add(href);
      const sym = document.getElementById(href.replace('#', ''));
      if (sym) void sym.getBoundingClientRect();
    });
    return seen.size;
  }

  // ── Warm the trail and hit-effect layers ───────────────────
  // Both are CSS-driven and their first use compiles a filter or a
  // shadow. Spawning one off-screen pays that cost up front.
  function warmEffects() {
    const host = document.getElementById('lane0');
    if (!host) return;
    const fx = document.createElement('div');
    fx.className = 'hit-fx';
    fx.style.cssText = 'position:absolute;opacity:0;pointer-events:none;';
    host.appendChild(fx);
    void fx.getBoundingClientRect();
    setTimeout(() => { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 0);
  }

  // ── Size the pool to the chart ─────────────────────────────
  // A dense chart can have far more tiles alive at once than a sparse
  // one. Guessing 64 every time meant long levels allocated mid-song,
  // which is exactly when it is most visible.
  function poolSizeFor(queue) {
    if (!queue || !queue.length) return 64;
    // Peak concurrency: notes whose spawn windows overlap. Four lanes
    // and a fall of roughly four beats, so a beat window of five is a
    // safe upper bound, plus headroom.
    let peak = 0;
    for (let i = 0; i < queue.length; i++) {
      let n = 0;
      for (let j = i; j < queue.length; j++) {
        if (queue[j].beatIdx - queue[i].beatIdx > 5) break;
        n++;
      }
      if (n > peak) peak = n;
      i += 3;                       // sampling is enough for a bound
    }
    return Math.max(64, Math.min(220, peak + 24));
  }

  // ═══════════════════════════════════════════
  //  The bouncing ball (tier 2)
  // ═══════════════════════════════════════════
  let ballTimer = null;
  let ballLane  = 0;
  let ballDir   = 1;

  const TILE_W   = 37;
  const TILE_GAP = 8;
  const HOP_MS   = 380;

  function ballStep() {
    const ball = document.getElementById('load-ball');
    if (!ball) return;

    ballLane += ballDir;
    if (ballLane > 3) { ballLane = 2; ballDir = -1; }
    if (ballLane < 0) { ballLane = 1; ballDir =  1; }

    const x = ballLane * (TILE_W + TILE_GAP) + (TILE_W / 2) - 5.5;
    ball.style.transform = 'translate(' + x + 'px, 53px)';

    const tile = document.querySelector('.load-tile[data-l="' + ballLane + '"]');
    if (tile) {
      tile.classList.add('lit');
      setTimeout(() => tile.classList.remove('lit'), 60);
    }

    // Each landing plays that lane's note quietly — the
    // indicator doubles as proof the audio graph is warm.
    if (window.RD_playNote) {
      try { window.RD_loadTick = true; window.RD_playNote(ballLane, false, null, 0); }
      catch (e) { /* ignore */ }
      window.RD_loadTick = false;
    }
  }

  function startBall() {
    const wrap = document.getElementById('load-ball-wrap');
    if (!wrap) return;
    wrap.classList.add('show');
    ballLane = 0; ballDir = 1;
    const ball = document.getElementById('load-ball');
    if (ball) ball.style.transform = 'translate(13px, 53px)';
    ballStep();
    ballTimer = setInterval(ballStep, HOP_MS);
  }

  function stopBall() {
    if (ballTimer) { clearInterval(ballTimer); ballTimer = null; }
    const wrap = document.getElementById('load-ball-wrap');
    if (wrap) wrap.classList.remove('show');
  }

  // ═══════════════════════════════════════════
  //  Count-in
  //  Not padding — in a rhythm game this is how the
  //  player syncs before the first note.
  // ═══════════════════════════════════════════
  function runCountIn(bpm) {
    return new Promise(resolve => {
      const wrap = document.getElementById('count-in');
      const num  = document.getElementById('count-num');
      if (!wrap || !num) return resolve();

      const beat = Math.max(300, Math.min(700, Math.round(60000 / (bpm || 120))));
      wrap.classList.add('show');

      // The count is derived from the wall clock, not from a chain of
      // setTimeouts. A chained timer drifts under load and can land two
      // firings inside one beat, which is how the same number ended up
      // on screen twice; here the elapsed time decides which number is
      // current, and a number is only painted when it actually changes.
      const COUNT = 3;
      const t0 = performance.now();
      let shown = null;
      let raf = 0;

      const paint = v => {
        num.textContent = v;
        num.classList.remove('tick');
        void num.offsetWidth;              // restart the animation
        num.classList.add('tick');
        if (window.RD_playNoteFreq) {
          try { window.RD_playNoteFreq(v === 1 ? 523.25 : 392.00, false, 0); } catch (e) {}
        }
      };

      const done = () => {
        cancelAnimationFrame(raf);
        wrap.classList.remove('show');
        num.classList.remove('tick');
        resolve();
      };

      const frame = () => {
        const elapsed = performance.now() - t0;
        const step = Math.floor(elapsed / beat);      // 0, 1, 2, then out
        if (step >= COUNT) { done(); return; }
        const value = COUNT - step;                   // 3, 2, 1
        if (value !== shown) { shown = value; paint(value); }
        raf = requestAnimationFrame(frame);
      };
      frame();
    });
  }

  // ═══════════════════════════════════════════
  //  Public entry point
  // ═══════════════════════════════════════════
  //
  //  RD_Loading.run(level, queue, { onReady })
  //
  //  Shows the title card, runs the preload queue behind it,
  //  escalates to the ball only if the queue outlasts the
  //  card, then counts in and resolves.

  let runToken = 0;

  const CARD_RISE = 180;
  // Was 900. The card exists to name the song and to cover the warm-up;
  // the warm-up finishes well inside this on any machine, so the rest
  // was dead time in front of every single level. The count-in that
  // follows is the part the player actually needs.
  const CARD_HOLD = 560;
  const CARD_FADE = 400;

  function formatLength(level, queue) {
    const beats = level.grid
      ? level.grid.length
      : (level.beats || (level.notes ? level.notes.length : 0));
    const bpm = level.bpm || 120;
    const secs = Math.round((beats * 60) / bpm);
    const m = Math.floor(secs / 60);
    const sRem = secs % 60;
    return m + ':' + String(sRem).padStart(2, '0');
  }

  async function run(level, queue, opts) {
    opts = opts || {};
    const myToken = ++runToken;
    const stale = () => myToken !== runToken;
    const veil  = document.getElementById('load-veil');
    const title = document.getElementById('load-title');
    const meta  = document.getElementById('load-meta');
    if (!veil) { if (opts.onReady) opts.onReady(); return; }

    // ── Tier 1: title card ──
    title.textContent = level.name || 'Untitled';
    meta.textContent  = formatLength(level, queue) + ' · ' + (level.bpm || 120) + ' BPM';
    veil.classList.remove('fading');
    veil.classList.add('show');

    // Restart the entrance animations
    [title, meta].forEach(el => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });

    const cardDone = new Promise(r => setTimeout(r, CARD_RISE + CARD_HOLD));

    // ── The actual work ──
    // Each step is named and weighted by roughly what it costs, so the
    // bar tracks real progress instead of counting to 100 on a timer.
    // Every step is something the first frame would otherwise pay for.
    const tasks = [
      ['Waking the audio graph', 1, () => warmAudio()],
      ['Building the voices',    4, () => preloadInstrument(queue)],
      ['Preparing tiles',        2, () => prebuildTilePool(poolSizeFor(queue))],
      ['Decoding icons',         1, () => warmSprites()],
      ['Warming effects',        1, () => warmEffects()],
      ['Laying out the board',   1, () => paintStaticLayers()],
    ];
    const totalWeight = tasks.reduce((n, t) => n + t[1], 0);

    const bar   = document.getElementById('load-bar-fill');
    const stepL = document.getElementById('load-step');
    let doneWeight = 0;
    const report = (label) => {
      if (bar)   bar.style.width = Math.round((doneWeight / totalWeight) * 100) + '%';
      if (stepL) stepL.textContent = label;
    };
    report('Starting');

    const queueDone = (async () => {
      for (const [label, weight, fn] of tasks) {
        report(label);
        // Yield first so the label paints before the work blocks.
        await yieldToPaint();
        try { fn(); } catch (e) { /* a warm step must never block play */ }
        doneWeight += weight;
        report(label);
        await yieldToPaint();
      }
      report('Ready');
    })();

    // ── Tier 2 only if the work outlasts the card ──
    let escalated = false;
    const raceResult = await Promise.race([
      queueDone.then(() => 'work'),
      cardDone.then(() => 'card'),
    ]);

    if (raceResult === 'card') {
      // Card finished first — is the work done too?
      const settled = await Promise.race([
        queueDone.then(() => true),
        new Promise(r => setTimeout(() => r(false), 0)),
      ]);
      if (!settled) { escalated = true; startBall(); await queueDone; }
    } else {
      // Work finished first — let the card play out its hold.
      await cardDone;
    }

    if (escalated) stopBall();

    // ── Dismount straight into the count-in ──
    veil.classList.add('fading');
    await new Promise(r => setTimeout(r, CARD_FADE * 0.6));
    veil.classList.remove('show');
    veil.classList.remove('fading');

    if (stale()) return;
    await runCountIn(level.bpm);

    if (stale()) return;
    if (opts.onReady) opts.onReady();
  }

  // Quitting mid-load must not let a pending onReady fire.
  function cancel() {
    runToken++;
    stopBall();
    const veil = document.getElementById('load-veil');
    const cin  = document.getElementById('count-in');
    if (veil) { veil.classList.remove('show','fading'); }
    if (cin)  { cin.classList.remove('show'); }
  }

  window.RD_Loading = { run, runCountIn, cancel };
})();
