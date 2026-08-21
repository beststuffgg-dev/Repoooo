// The Redesign variant: does the decorative ghost-lane strip stay
// inside the hero, and is it identical to the shipping build in every
// way that isn't the two visual blocks?
//
// This is a browser suite because the bug it guards was a clipping
// bug: #home already carries its own 3D tilt from lighting.js, and a
// second perspective/rotateX nested inside an already-3D-transformed
// ancestor is a spot where Chromium's overflow clipping misses — the
// strip bled past the hero into the nav and the song list. jsdom has
// no layout engine and structurally cannot see that.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { SRC, launchOpts, openApp, htmlBuild } = require('./browser');

const SHIP = path.join(SRC, 'RhythmDropV7');
const RD = path.join(SRC, 'RhythmDropV7-Redesign');
const SINGLE = htmlBuild('RhythmDrop-Redesign.html');

let fail = 0, pass = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL: ' + m)); };

const SIZES = [[420, 700], [390, 844], [360, 640], [900, 1000]];

const probe = () => {
  const strip = document.getElementById('hero-ghost');
  if (!strip) return { missing: true };
  const nav = document.getElementById('home-nav');
  const navBox = nav.getBoundingClientRect();
  // The painted bottom of the tilted lanes, not the strip's own box:
  // rotateX means the lanes can land somewhere other than where the
  // untransformed element would.
  let painted = -Infinity;
  strip.querySelectorAll('.gl-floor i').forEach(el => {
    painted = Math.max(painted, el.getBoundingClientRect().bottom);
  });
  const cs = getComputedStyle(strip);
  const mid = document.elementFromPoint(navBox.left + navBox.width / 2, navBox.top + navBox.height / 2);
  return {
    painted, navTop: navBox.top,
    pe: cs.pointerEvents,
    hidden: strip.getAttribute('aria-hidden'),
    atNav: mid ? (mid.id || mid.className || mid.tagName) : null,
    navContains: !!(mid && nav.contains(mid)),
    grain: getComputedStyle(document.body, '::after').mixBlendMode,
  };
};

(async () => {
  console.log('== the redesign is the shipping build plus two visual blocks ==');
  ok(fs.existsSync(RD), 'RhythmDropV7-Redesign/ exists');
  const jsFiles = fs.readdirSync(SHIP).filter(f => f.endsWith('.js'));
  let same = 0;
  for (const f of jsFiles) {
    const a = fs.readFileSync(path.join(SHIP, f));
    const b = fs.readFileSync(path.join(RD, f));
    if (a.compare(b) === 0) same++;
    else ok(false, 'JS diverged between builds: ' + f);
  }
  ok(same === jsFiles.length, 'all ' + jsFiles.length + ' JS files byte-identical to the shipping build');
  console.log('   ' + same + '/' + jsFiles.length + ' JS files identical — same behaviour by construction');

  const manifest = JSON.parse(fs.readFileSync(path.join(RD, 'manifest.json'), 'utf8'));
  ok(manifest.name === 'RhythmDrop (Redesign)', 'manifest name is RhythmDrop (Redesign), got ' + manifest.name);
  ok(/— Redesign$/.test(manifest.version_name), 'version_name carries the Redesign suffix, got ' + manifest.version_name);
  const rdHtml = fs.readFileSync(path.join(RD, 'popup.html'), 'utf8');
  ok(/<title>RhythmDrop — Redesign<\/title>/.test(rdHtml), 'title is "RhythmDrop — Redesign"');
  ok(/position:relative/.test(rdHtml.slice(rdHtml.indexOf('REDESIGN — film grain'), rdHtml.indexOf('REDESIGN — ghost lanes'))),
    'body gets position:relative, which the film grain needs as a containing block');

  // Divergence audit, exact rather than eyeballed: strip everything
  // between the redesign sentinels and undo the title, and what's left
  // must be the shipping popup.html byte for byte. That is what keeps
  // "same JS, same features, only popup.html differs" a fact instead
  // of a claim.
  const shipHtml = fs.readFileSync(path.join(SHIP, 'popup.html'), 'utf8');
  const OPEN = '/* \u25bc\u25bc\u25bc REDESIGN \u25bc\u25bc\u25bc */';
  const CLOSE = '/* \u25b2\u25b2\u25b2 REDESIGN \u25b2\u25b2\u25b2 */';
  let stripped = rdHtml.replace('<title>RhythmDrop \u2014 Redesign</title>', '<title>RhythmDrop</title>');
  let blocks = 0;
  for (;;) {
    const a = stripped.indexOf(OPEN);
    if (a < 0) break;
    let b2 = stripped.indexOf(CLOSE, a);
    if (b2 < 0) { ok(false, 'unterminated redesign block'); break; }
    b2 += CLOSE.length;
    // Take the surrounding comment wrapper and the trailing newline with it.
    let s0 = a, e0 = b2;
    if (stripped.slice(s0 - 6, s0) === '  <!--') s0 -= 6;
    if (stripped.slice(e0, e0 + 3) === '-->') e0 += 3;
    while (stripped[e0] === '\n') e0++;
    while (stripped[s0 - 1] === ' ') s0--;
    stripped = stripped.slice(0, s0) + stripped.slice(e0);
    blocks++;
  }
  ok(blocks === 2, 'found both redesign blocks (got ' + blocks + ')');
  const norm = t => t.replace(/\n+/g, '\n');
  ok(norm(stripped) === norm(shipHtml),
    'with the redesign blocks removed, popup.html is the shipping file exactly');
  console.log('   ' + blocks + ' marked blocks, ' + (rdHtml.length - shipHtml.length) + ' chars of divergence, nothing else');

  const b = await chromium.launch(launchOpts());

  console.log('== the ghost strip stays inside the hero, at every size ==');
  for (const [w, h] of SIZES) {
    const { ctx, page, errors } = await openApp(b, { width: w, height: h }, { file: path.join(RD, 'popup.html') });
    const r = await page.evaluate(probe);
    ok(!r.missing, `${w}x${h}: the strip is in the document`);
    if (!r.missing) {
      ok(r.painted < r.navTop, `${w}x${h}: lanes end above the nav (${r.painted.toFixed(1)} vs ${r.navTop.toFixed(1)})`);
      ok(r.navContains, `${w}x${h}: elementFromPoint at the nav centre is the nav, not the strip (got ${r.atNav})`);
      ok(r.pe === 'none', `${w}x${h}: strip computes pointer-events:none (got ${r.pe})`);
      ok(r.hidden === 'true', `${w}x${h}: strip is aria-hidden`);
      ok(r.grain === 'overlay', `${w}x${h}: film grain blends as overlay (got ${r.grain})`);
      console.log(`   ${w}x${h}  lanes end ${r.painted.toFixed(1)}, nav starts ${r.navTop.toFixed(1)}`);
    }
    ok(errors.length === 0, `${w}x${h}: no page errors (${errors.join('; ')})`);
    await ctx.close();
  }

  console.log('== containment survives inlining into the single file ==');
  {
    ok(fs.existsSync(SINGLE), 'RhythmDrop-Redesign.html exists');
    const { ctx, page, errors } = await openApp(b, { width: 420, height: 700 }, { file: SINGLE });
    const r = await page.evaluate(probe);
    ok(!r.missing && r.painted < r.navTop, `single file: lanes end above the nav (${r.painted.toFixed(1)} vs ${r.navTop.toFixed(1)})`);
    ok(r.navContains, 'single file: the nav is on top at its own centre');
    ok(errors.length === 0, 'single file: no page errors (' + errors.join('; ') + ')');
    console.log(`   single  lanes end ${r.painted.toFixed(1)}, nav starts ${r.navTop.toFixed(1)}`);
    await ctx.close();
  }

  console.log('== reduced motion drops the decoration entirely ==');
  {
    const { ctx, page } = await openApp(b, { width: 420, height: 700 },
      { file: path.join(RD, 'popup.html'), context: { reducedMotion: 'reduce' } });
    const shown = await page.evaluate(() => getComputedStyle(document.getElementById('hero-ghost')).display);
    ok(shown === 'none', 'strip is display:none under prefers-reduced-motion (got ' + shown + ')');
    await ctx.close();
  }

  await b.close();
  console.log(fail ? `\n${fail} of ${pass + fail} probes FAILED` : `\nall ${pass} probes passed`);
  process.exit(fail ? 1 : 0);
})();
