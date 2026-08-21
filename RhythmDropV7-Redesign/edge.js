// ═══════════════════════════════════════════
//  RhythmDrop edge.js — Microsoft Edge compatibility
//
//  Edge is Chromium, so the extension already runs there: the
//  manifest, the APIs and the Web Audio graph are all the same.
//  What differs is the host platform and a handful of Edge-only
//  behaviours that show up as jank rather than as errors.
//
//  This file is INERT everywhere else. It detects Edge first and
//  returns immediately if it is not there, so Chrome pays one
//  userAgent check and nothing more.
//
//  Exposes: RD_Edge  { active, features }
//
//  Loaded FIRST in popup.html — before lighting.js — because the
//  class it puts on <html> gates CSS that the other files' layout
//  depends on.
// ═══════════════════════════════════════════

(function () {
  'use strict';

  // ── Detection ──────────────────────────────
  // Edge (Chromium) reports "Edg/" — deliberately not "Edge/",
  // which was the old EdgeHTML browser. userAgentData is the
  // modern route and is checked first; the UA string is the
  // fallback, since neither is guaranteed.
  function detectEdge() {
    try {
      const brands = navigator.userAgentData && navigator.userAgentData.brands;
      if (brands && brands.some) {
        if (brands.some(b => /edge/i.test(b.brand))) return true;
      }
    } catch (e) { /* userAgentData is not everywhere yet */ }
    return / Edg\//.test(navigator.userAgent || '');
  }

  const isEdge = detectEdge();

  window.RD_Edge = { active: isEdge, features: [] };

  // Everything below this line is Edge-only. Chrome stops here.
  if (!isEdge) return;

  const on = name => window.RD_Edge.features.push(name);
  const root = document.documentElement;

  // A hook for the stylesheet. Anything Edge-specific in CSS hangs
  // off html.is-edge rather than being sniffed again.
  root.classList.add('is-edge');
  on('is-edge class');

  // ── 1. Efficiency mode throttling ──────────
  //
  //  Edge's Efficiency Mode and Sleeping Tabs throttle background
  //  timers hard. A rhythm game that loses its rAF loop mid-song
  //  desyncs: the audio clock keeps running, the tiles do not.
  //  The loop already clamps dt, so the fix is to notice the gap
  //  and let the game pause rather than resume out of sync.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    // Coming back from a throttled state — hand control to the
    // game's own pause path if it has one.
    if (typeof window.RD_onResumeFromBackground === 'function') {
      try { window.RD_onResumeFromBackground(); } catch (e) {}
    }
  });
  on('visibility resync hook');

  // ── 2. backdrop-filter cost ────────────────
  //
  //  Edge composites backdrop-filter more expensively than Chrome
  //  on integrated GPUs, and the game stacks it on full-screen
  //  overlays. Below a hardware floor, swap the blur for a heavier
  //  opaque wash — same read, a fraction of the cost.
  const cores = navigator.hardwareConcurrency || 4;
  const mem   = navigator.deviceMemory || 4;
  if (cores <= 4 || mem <= 4) {
    root.classList.add('edge-cheap-blur');
    on('cheap blur (cores=' + cores + ', mem=' + mem + ')');
  }

  // ── 3. Scrollbars ──────────────────────────
  //
  //  Edge on Windows reserves a wider classic scrollbar than
  //  Chrome, which clips the campaign rows. Prefer the thin
  //  overlay style where the platform supports it.
  root.classList.add('edge-thin-scroll');
  on('thin scrollbars');

  // ── 4. Audio context resume ────────────────
  //
  //  Edge suspends the AudioContext more eagerly than Chrome after
  //  a popup loses focus. Nudging it on the next gesture avoids a
  //  silent first note when the player comes back.
  function nudgeAudio() {
    try {
      const ctx = window.RD_getContext && window.RD_getContext();
      if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
    } catch (e) { /* best effort */ }
  }
  ['pointerdown', 'keydown'].forEach(evt =>
    window.addEventListener(evt, nudgeAudio, { passive: true }));
  on('audio resume nudge');

  // ── 5. Report ──────────────────────────────
  // Visible in the console so a bug report from an Edge user says
  // which shims were live.
  try {
    console.info('[RhythmDrop] Edge compatibility active:',
      window.RD_Edge.features.join(', '));
  } catch (e) { /* console is not load-bearing */ }
})();
