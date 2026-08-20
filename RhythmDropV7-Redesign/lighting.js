// ═══════════════════════════════════════════
//  RhythmDrop lighting.js — v6 Phase 1
//  One pointer listener drives every 3D effect.
//
//  Writes to :root:
//    --mx / --my        cursor position, 0..1
//    --lx / --ly        same, as percentages (for gradients)
//    --tilt-x / --tilt-y  panel rotation, in deg
//
//  Nothing else in the app listens to the pointer for
//  lighting. CSS reads these properties; JS never touches
//  individual elements on move.
// ═══════════════════════════════════════════

(function () {
  'use strict';

  const root = document.documentElement;

  // How far the panel rotates at the screen edges, in degrees.
  // Kept deliberately small — past ~6deg it reads as a toy.
  const TILT_MAX = 5;

  // Easing toward the target so the panel settles instead of snapping.
  const EASE = 0.18;

  let targetX = 0.5, targetY = 0.5;   // where the cursor is
  let curX    = 0.5, curY    = 0.5;   // where the panel currently points
  let raf     = null;
  let settled = true;

  // ── Reduced motion ─────────────────────────
  // Respected live, not just at load — someone can flip the
  // OS setting with the popup open.
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;

  function applyMotionPreference() {
    reducedMotion = motionQuery.matches;
    document.body.classList.toggle('reduce-motion', reducedMotion);
    if (reducedMotion) {
      // Park the light dead centre and stop the loop.
      curX = curY = targetX = targetY = 0.5;
      writeVars();
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }
  }

  if (motionQuery.addEventListener) {
    motionQuery.addEventListener('change', applyMotionPreference);
  } else if (motionQuery.addListener) {
    motionQuery.addListener(applyMotionPreference);   // older engines
  }

  // ── Writing the properties ─────────────────
  function writeVars() {
    const s = root.style;
    s.setProperty('--mx', curX.toFixed(3));
    s.setProperty('--my', curY.toFixed(3));
    s.setProperty('--lx', (curX * 100).toFixed(1) + '%');
    s.setProperty('--ly', (curY * 100).toFixed(1) + '%');
    s.setProperty('--tilt-x', ((0.5 - curY) * 2 * TILT_MAX).toFixed(2) + 'deg');
    s.setProperty('--tilt-y', ((curX - 0.5) * 2 * TILT_MAX).toFixed(2) + 'deg');
  }

  // ── The loop ───────────────────────────────
  // Runs only while the panel is still catching up to the
  // cursor, then stops. An idle popup burns no frames.
  function tick() {
    raf = null;

    const dx = targetX - curX;
    const dy = targetY - curY;

    if (Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008) {
      curX = targetX; curY = targetY;
      writeVars();
      settled = true;
      return;
    }

    curX += dx * EASE;
    curY += dy * EASE;
    writeVars();
    raf = requestAnimationFrame(tick);
  }

  function wake() {
    settled = false;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // ── Input ──────────────────────────────────
  function onMove(e) {
    if (reducedMotion) return;
    targetX = e.clientX / window.innerWidth;
    targetY = e.clientY / window.innerHeight;
    wake();
  }

  // Cursor left the popup — drift the light back to centre
  // rather than leaving the panel stuck at an angle.
  function onLeave() {
    if (reducedMotion) return;
    targetX = 0.5;
    targetY = 0.5;
    wake();
  }

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);

  // ── Public handle ──────────────────────────
  // Phase 5's settings panel will drive tilt strength and the
  // specular sweep through these instead of touching the CSS.
  window.RD_Lighting = {
    setTiltStrength(mult) {
      root.style.setProperty('--fx-tilt-mult', String(mult));
    },
    setGlow(mult) {
      root.style.setProperty('--fx-glow-mult', String(mult));
    },
    center() { onLeave(); },
    isReducedMotion() { return reducedMotion; },
  };

  // ── Boot ───────────────────────────────────
  writeVars();
  applyMotionPreference();
})();

// ═══════════════════════════════════════════
//  Phase 2 — per-element local light
//  Raised surfaces catch the light on the edge
//  nearest the cursor. Delegated: one listener for
//  every card, present and future, so cards created
//  later by renderShop()/renderCustoms() work with
//  no extra wiring.
// ═══════════════════════════════════════════
(function () {
  'use strict';

  const SELECTOR = '.level-card, .avatar-card';

  // Measuring the card on every pointermove forced a layout flush per
  // event — a hundred a second on a quick mouse, and the worst of it
  // landed while scrolling the campaign list. Two changes: the rect is
  // measured once per card rather than once per event, and the style
  // write is coalesced into a single rAF.
  let pending = null;      // { card, x, y }
  let raf = null;
  let lastCard = null, lastRect = null;

  function flush() {
    raf = null;
    const p = pending;
    pending = null;
    if (!p) return;

    if (p.card !== lastCard) {
      lastCard = p.card;
      lastRect = p.card.getBoundingClientRect();
    }
    const r = lastRect;
    if (!r || !r.width || !r.height) return;

    p.card.style.setProperty('--cx', (((p.x - r.left) / r.width)  * 100).toFixed(1) + '%');
    p.card.style.setProperty('--cy', (((p.y - r.top)  / r.height) * 100).toFixed(1) + '%');
  }

  document.addEventListener('pointermove', function (e) {
    if (window.RD_Lighting && window.RD_Lighting.isReducedMotion()) return;

    const card = e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!card) { lastCard = null; lastRect = null; return; }

    pending = { card, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(flush);
  }, { passive: true });

  // A scroll or a resize moves every card, so the cached rect goes.
  const dropCache = () => { lastCard = null; lastRect = null; };
  window.addEventListener('scroll', dropCache, { passive: true, capture: true });
  window.addEventListener('resize', dropCache, { passive: true });
})();
