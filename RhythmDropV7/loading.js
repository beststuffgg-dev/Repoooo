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
      let n = 3;

      function tick() {
        num.textContent = n;
        num.classList.remove('tick');
        void num.offsetWidth;              // restart the animation
        num.classList.add('tick');
        if (window.RD_playNoteFreq) {
          try { window.RD_playNoteFreq(n === 1 ? 523.25 : 392.00, false, 0); } catch (e) {}
        }
        n--;
        if (n >= 1) {
          setTimeout(tick, beat);
        } else {
          setTimeout(() => {
            wrap.classList.remove('show');
            num.classList.remove('tick');
            resolve();
          }, beat);
        }
      }
      tick();
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

    // ── The actual work, weighted by measured cost ──
    const tasks = [
      () => warmAudio(),
      () => preloadInstrument(queue),
      () => prebuildTilePool(64),
      () => paintStaticLayers(),
    ];

    const queueDone = (async () => {
      for (const task of tasks) {
        try { task(); } catch (e) { /* a warm step must never block play */ }
        await yieldToPaint();
      }
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
