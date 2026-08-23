// The compact share codes, and the textured material themes.
//
// Two V7 things brought across: the codec that turns a multi-kilobyte
// base64-JSON level export into a short RD2 code, and the material
// themes that carry a real grain texture rather than a flat palette.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const DIR = v8Dir();
const APP = path.join(DIR, 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

// A level as V8's creator actually produces one: cells carry type,
// freq and sustain, no per-note instrument.
const SAMPLE = {
  name: 'My Chart', bpm: 140, diff: 'medium', instrument: 'guitar', bgMode: 'bass',
  laneFreqs: [220, 277.18, 329.63, 440],
  bassPattern: [65.41, 0, 65.41, 0, 87.31, 0, 73.42, 0],
  grid: Array.from({ length: 48 }, (_, i) => [
    i % 2 === 0 ? { type: 'tap', freq: 220, sustain: 0 } : null,
    i % 5 === 0 ? { type: 'dtap', freq: 277.18, sustain: 1.5 } : null,
    i % 3 === 0 ? { type: 'tap', freq: 329.63, sustain: 0 } : null,
    i % 7 === 0 ? { type: 'tap', freq: 440, sustain: 0 } : null,
  ]),
};

console.log('== the codec is loaded before the game ==');
{
  const html = fs.readFileSync(APP, 'utf8');
  const order = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  notes.push('load order: ' + order.join(' → '));
  ok(order.includes('codec.js'), 'codec.js is in the load order');
  ok(order.indexOf('codec.js') < order.indexOf('game.js'), 'and loads before game.js');
}

(async () => {
  const b = await chromium.launch(launchOpts());
  const page = await b.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 })));
  await page.goto('file://' + APP, { waitUntil: 'load' });
  await page.waitForTimeout(1400);

  console.log('== the export is small, and round-trips exactly ==');
  {
    const r = await page.evaluate(sample => {
      const oldSize = 'RHYTHMDROP:'.length + btoa(unescape(encodeURIComponent(JSON.stringify(sample)))).length;
      const code = RD_Codec.encodeLevel(sample);
      const back = RD_Codec.decodeLevel(code);
      const flat = g => g.flatMap((row, ri) => row.map((c, ci) =>
        c ? ri + ':' + ci + ':' + c.type + ':' + c.freq + ':' + (c.sustain || 0) : '').filter(Boolean)).join('|');
      return {
        oldSize, newSize: code.length, prefix: code.slice(0, 4),
        name: back.name === sample.name, bpm: back.bpm === sample.bpm,
        diff: back.diff === sample.diff, instrument: back.instrument === sample.instrument,
        bg: back.bgMode === sample.bgMode,
        laneFreqs: JSON.stringify(back.laneFreqs) === JSON.stringify(sample.laneFreqs),
        notes: flat(sample.grid) === flat(back.grid),
        noteCount: flat(sample.grid).split('|').length,
      };
    }, SAMPLE);
    notes.push(`a 57-note chart: ${r.oldSize} chars of base64-JSON → ${r.newSize} of RD2`);
    ok(r.prefix === 'RD2:', 'the code is a compact RD2 code');
    ok(r.newSize < r.oldSize * 0.2, `it is ${(100 * (1 - r.newSize / r.oldSize)).toFixed(0)}% smaller (${r.oldSize} → ${r.newSize})`);
    ok(r.name && r.bpm && r.diff && r.instrument && r.bg && r.laneFreqs, 'every field survives the round trip');
    ok(r.notes, 'all ' + r.noteCount + ' notes survive — type, pitch and sustain exact');
  }

  console.log('== old base64-JSON codes still import ==');
  {
    const r = await page.evaluate(sample => {
      const old = 'RHYTHMDROP:' + btoa(unescape(encodeURIComponent(JSON.stringify(sample))));
      const back = RD_Codec.decodeLevel(old);
      return { name: back.name === sample.name, notes: back.grid.length === sample.grid.length };
    }, SAMPLE);
    ok(r.name && r.notes, 'a code shared from the old build still decodes');
  }

  console.log('== export/import wire through the codec ==');
  {
    const r = await page.evaluate(() => {
      const src = document.documentElement.outerHTML; // not the source; check functions instead
      return {
        exportUsesCodec: /RD_Codec.*encodeLevel|encodeLevel/.test(exportLevel.toString()),
        importUsesCodec: /RD_Codec.*decodeLevel|decodeLevel/.test(importLevel.toString()),
      };
    });
    ok(r.exportUsesCodec, 'exportLevel goes through the codec');
    ok(r.importUsesCodec, 'importLevel goes through the codec');
  }

  console.log('== the textured themes carry a real grain ==');
  {
    const r = await page.evaluate(() => {
      const out = { flat: {}, mat: {} };
      const read = () => getComputedStyle(document.body).getPropertyValue('--mat-grain').trim();
      // Flat themes: no grain.
      ['graphite', 'dark', 'neon'].forEach(t => { applyTheme(t); out.flat[t] = read(); });
      // Material themes: a grain each, and all different.
      ['walnut', 'bone', 'amber', 'vapor', 'blueprint', 'mono'].forEach(t => { applyTheme(t); out.mat[t] = read(); });
      applyTheme('graphite');
      // The picker offers them.
      out.offered = THEMES.filter(t => t.mat).map(t => t.id);
      return out;
    });
    const flatClean = Object.entries(r.flat).filter(([, g]) => !g || g === 'none');
    ok(flatClean.length === 3, 'the flat themes set no grain (graphite/dark/neon)');
    const mats = Object.entries(r.mat);
    ok(mats.every(([, g]) => g && g !== 'none' && g.length > 8), 'all six material themes set a grain');
    const distinct = new Set(mats.map(([, g]) => g));
    ok(distinct.size === 6, 'all six grains are different textures');
    notes.push('material grains: ' + mats.map(([t, g]) => t + '=' + (g.slice(0, 14))).join(', '));
    ok(r.offered.length === 6 && r.offered.join() === 'walnut,bone,amber,vapor,blueprint,mono',
      'all six are offered in the theme picker (' + r.offered.join(', ') + ')');
  }

  console.log('== the grain is painted, behind content, on both graphics styles ==');
  {
    for (const gfx of ['modern', 'classic']) {
      const r = await page.evaluate(style => {
        currentSettings.gfx = style; applySettingsToDOM();
        applyTheme('walnut');
        showScreen('home');
        const bg = getComputedStyle(document.getElementById('home'), '::after').backgroundImage;
        const zHome = getComputedStyle(document.getElementById('home')).isolation;
        applyTheme('graphite');
        const off = getComputedStyle(document.getElementById('home'), '::after').backgroundImage;
        applyTheme('graphite');
        return { painted: bg && bg !== 'none' && bg.length > 10, isolated: zHome, off };
      }, gfx);
      ok(r.painted, gfx + ': the grain layer paints on a material theme');
      ok(r.isolated === 'isolate', gfx + ': the screen is its own stacking context so grain sits behind content');
      ok(!r.off || r.off === 'none', gfx + ': a flat theme paints no grain layer');
    }
    await page.evaluate(() => { currentSettings.gfx = 'modern'; applySettingsToDOM(); applyTheme('graphite'); });
  }

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8codec: ${fail} of ${pass + fail} probes FAILED` : `v8codec: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
