#!/usr/bin/env node
// Generates RhythmDropV7-Redesign/ from RhythmDropV7/.
//
// The Redesign is a visual-only alternate build: same JS, same
// features, same tests, only popup.html differs. Generating it rather
// than hand-maintaining a second copy is what makes that claim
// enforceable — every .js file is copied byte-for-byte, so the two
// builds cannot drift apart in behaviour.
//
//   node tools/build-redesign.js
//   node tools/build-single.js RhythmDropV7-Redesign RhythmDrop-Redesign.html
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'RhythmDropV7');
const OUT = path.join(ROOT, 'RhythmDropV7-Redesign');

// A static fractal-noise tile. Static, not animated: the point is to
// break up large flat panels so they don't read as vector fills, and a
// moving grain would cost a repaint every frame for that.
const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' " +
  "stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E";

// Sentinels so the divergence between the two builds is not merely
// asserted in prose but checkable: redesigntest.js strips everything
// between them and the result must equal the shipping popup.html byte
// for byte.
const OPEN = '/* ▼▼▼ REDESIGN ▼▼▼ */';
const CLOSE = '/* ▲▲▲ REDESIGN ▲▲▲ */';

const CSS = `
${OPEN}
/* ══════════════════════════════════════
   REDESIGN — film grain
   The only thing between this build and the shipping one, along with
   the ghost lanes below. Overlay blending only nudges existing pixels
   toward or away from mid-grey, so this neither tints nor darkens
   anything — it just stops large flat panels reading as vector fills.
   body needs position:relative to be the containing block for it.
══════════════════════════════════════ */
body { position:relative; }
body::after {
  content:''; position:absolute; inset:0;
  pointer-events:none; z-index:9999;
  mix-blend-mode:overlay; opacity:.05;
  background-image:url("${GRAIN}");
  background-size:160px 160px;
}

/* ══════════════════════════════════════
   REDESIGN — ghost lanes
   Four faintly tinted lanes tilted away behind the wordmark, echoing
   the actual play board. The source mockup ran this at a 64° tilt;
   this is 16° — a quarter of it — so the grid stays legibly
   rectangular rather than dominating the masthead.

   It is sized to fit inside the hero's own box (bottom:0, height:92px)
   rather than hanging past it and relying on the ancestor to clip.
   That reliance is what broke: #home already carries its own 3D tilt
   from lighting.js, and nesting a second perspective/rotateX inside an
   already-3D-transformed ancestor is a spot where Chromium's overflow
   clipping misses, so the strip bled into the nav and the song list
   below. Fitting it inside the box leaves nothing needing to be
   clipped. The mask fades both edges so it ends without a hard stop.

   Purely decorative: pointer-events:none, aria-hidden, and gone
   entirely under reduced motion.
══════════════════════════════════════ */
#hero-ghost {
  position:absolute; left:0; right:0; bottom:0; height:92px;
  pointer-events:none; z-index:0; overflow:hidden;
  perspective:300px; perspective-origin:50% 100%;
  -webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 20%,#000 80%,transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0%,#000 20%,#000 80%,transparent 100%);
}
#hero-ghost .gl-floor {
  position:absolute; inset:0 12px 0 12px;
  display:flex; gap:7px;
  transform:rotateX(16deg); transform-origin:50% 100%;
}
#hero-ghost .gl-floor i {
  flex:1; border-radius:4px 4px 0 0;
  background:linear-gradient(180deg,
    transparent 0%,
    color-mix(in srgb,var(--tap) 8%,transparent) 55%,
    color-mix(in srgb,var(--tap) 20%,transparent) 100%);
  border:1px solid color-mix(in srgb,var(--tap) 11%,transparent);
  border-bottom:none;
}
#hero-ghost .gl-floor i:nth-child(2n) {
  background:linear-gradient(180deg,
    transparent 0%,
    color-mix(in srgb,var(--dtap) 8%,transparent) 55%,
    color-mix(in srgb,var(--dtap) 18%,transparent) 100%);
  border-color:color-mix(in srgb,var(--dtap) 10%,transparent);
}
/* The wordmark and the legend sit in front of it. */
#home-hero .hero-row, #home-hero .legend-row { position:relative; z-index:1; }
body.reduce-motion #hero-ghost { display:none; }
@media (prefers-reduced-motion: reduce) { #hero-ghost { display:none; } }
${CLOSE}
`;

const MARKUP =
  '  <!--' + OPEN + '-->\n' +
  '  <div id="hero-ghost" aria-hidden="true">\n' +
  '    <div class="gl-floor"><i></i><i></i><i></i><i></i></div>\n' +
  '  </div>\n' +
  '  <!--' + CLOSE + '-->\n';

function patchPopup(html) {
  // The stylesheet ends at the last </style> before the body.
  const marker = '</style>';
  const at = html.indexOf(marker);
  if (at < 0) throw new Error('no </style> in popup.html');
  let out = html.slice(0, at) + CSS + html.slice(at);

  const heroOpen = '  <div id="home-hero">\n';
  if (!out.includes(heroOpen)) throw new Error('no #home-hero open tag in popup.html');
  out = out.replace(heroOpen, heroOpen + MARKUP);

  const title = '<title>RhythmDrop</title>';
  if (!out.includes(title)) throw new Error('no <title> in popup.html');
  out = out.replace(title, '<title>RhythmDrop — Redesign</title>');
  return out;
}

function patchManifest(json) {
  const m = JSON.parse(json);
  // So the two can be loaded as unpacked extensions side by side and
  // told apart in the toolbar. Nothing in the JS reads the manifest,
  // so this is presentation only.
  m.name = 'RhythmDrop (Redesign)';
  m.action.default_title = 'RhythmDrop (Redesign)';
  m.version_name = m.version_name + ' — Redesign';
  return JSON.stringify(m, null, 2) + '\n';
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(SRC)) throw new Error('no source build at ' + SRC);
fs.rmSync(OUT, { recursive: true, force: true });
copyTree(SRC, OUT);
fs.writeFileSync(path.join(OUT, 'popup.html'), patchPopup(fs.readFileSync(path.join(SRC, 'popup.html'), 'utf8')));
fs.writeFileSync(path.join(OUT, 'manifest.json'), patchManifest(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8')));

const js = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));
for (const f of js) {
  if (fs.readFileSync(path.join(SRC, f)).compare(fs.readFileSync(path.join(OUT, f))) !== 0)
    throw new Error('JS diverged: ' + f);
}
console.log('RhythmDropV7 -> RhythmDropV7-Redesign');
console.log('  ' + js.length + ' JS files copied byte-for-byte: ' + js.join(', '));
console.log('  popup.html patched (film grain, ghost lanes, title), manifest renamed');
module.exports = { OPEN, CLOSE, SRC, OUT };
