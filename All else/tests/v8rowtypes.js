const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { launchOpts, v8Dir } = require('./browser');

const DIR = v8Dir();
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const load = (...files) => {
  const sb = { window: {} };
  sb.window.window = sb.window;
  const ctx = vm.createContext(sb);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx);
  return sb.window;
};

const T = 'tap', D = 'dtap';
const cell = (type, extra) => Object.assign({ type, freq: 440, sustain: 0, inst: 'piano' }, extra);
const mixedRows = grid => grid.filter(row => {
  const types = new Set(row.filter(Boolean).map(c => c.type));
  return types.size > 1;
}).length;

console.log('== the rule ==');
{
  const { uniformRowTypes, isUniform } = load('rowtypes.js').RD_RowTypes;
  const row = (...t) => [0, 1, 2, 3].map(i => t[i] ? cell(t[i]) : null);

  let g = [row(T, T, D), row(D, D, T), row(D), row(T)];
  uniformRowTypes(g);
  ok(g[0].filter(Boolean).every(c => c.type === T), 'two taps and a double become taps');
  ok(g[1].filter(Boolean).every(c => c.type === D), 'two doubles and a tap become doubles');
  ok(g[2][0].type === D && g[3][0].type === T, 'a row that was already uniform is left alone');
  ok(isUniform(g), 'the whole grid is uniform afterwards');

  const before = [row(T, D)]; before[0][0].freq = 261.63; before[0][1].sustain = 1.5; before[0][1].inst = 'lyre';
  const snap = JSON.stringify(before.map(r => r.map(c => c && { ...c, type: 0 })));
  uniformRowTypes(before);
  ok(JSON.stringify(before.map(r => r.map(c => c && { ...c, type: 0 }))) === snap,
    'lanes, pitches, sustains and voices are untouched — only the type moves');
  ok(before[0][2] === null && before[0][3] === null, 'empty lanes stay empty');

  const song = [];
  for (let i = 0; i < 6; i++) song.push(row(D, D, D), row(T, D), row(T, T, T), row(T, D));
  const sharesOf = grid => { let n = 0, d = 0; grid.forEach(r => r.forEach(c => { if (c) { n++; if (c.type === D) d++; } })); return d / n; };
  const s0 = sharesOf(song);
  const tieIdx = song.map((r, i) => (r.filter(Boolean).length === 2 ? i : -1)).filter(i => i >= 0);
  uniformRowTypes(song);
  ok(isUniform(song), 'ties are resolved too');
  const s1 = sharesOf(song);
  notes.push('steering: double share ' + (100 * s0).toFixed(1) + '% -> ' + (100 * s1).toFixed(1) + '%');
  ok(Math.abs(s1 - s0) < 0.05, 'and the double share holds (' + (100 * s0).toFixed(1) + '% -> ' + (100 * s1).toFixed(1) + '%)');
  const tieTypes = tieIdx.map(i => song[i].filter(Boolean)[0].type);
  ok(tieTypes.includes(T) && tieTypes.includes(D), 'tied rows split both ways rather than all going one way');

  const mk = () => [row(T, D), row(D, T), row(T, T, D), row(D, D, T), row(T, D)];
  const a = mk(), b = mk();
  uniformRowTypes(a); uniformRowTypes(b);
  ok(JSON.stringify(a) === JSON.stringify(b), 'the same grid always resolves the same way');
  const again = JSON.stringify(a); uniformRowTypes(a);
  ok(JSON.stringify(a) === again, 'running it twice changes nothing');

  const withHold = (type, hold) => cell(type, hold ? { hold } : {});
  const hg = [[withHold(T, 3), withHold(T), withHold(D), null], [withHold(D), withHold(D), withHold(T, 2), null], [withHold(T, 2), null, null, null]];
  uniformRowTypes(hg);
  ok(hg[0][0].type === T && hg[0][0].hold === 3, 'a hold head in a row that resolves to taps keeps its hold');
  ok(hg[1][2].type === D && hg[1][2].hold === undefined, 'a hold head turned into a double loses its hold, so a double never carries one');
  ok(hg[2][0].hold === 2, 'a lone hold head is left alone');

  ok(uniformRowTypes([]).length === 0, 'an empty grid is fine');
  ok(isUniform(uniformRowTypes([row(), row(T, T), row()])), 'rows with no notes are skipped');
}

console.log('== the baked campaign ==');
{
  const D_ = load('levels.js').RD_LEVEL_DATA;
  let rows = 0, mixed = 0, notesN = 0, doubles = 0;
  for (const l of D_.levels) {
    const byRow = {};
    for (let i = 0; i < l.nt.length; i += 6) {
      (byRow[l.nt[i]] = byRow[l.nt[i]] || new Set()).add(l.nt[i + 2] === 1 ? 1 : 0);
      notesN++; if (l.nt[i + 2] === 1) doubles++;
    }
    for (const r in byRow) { rows++; if (byRow[r].size > 1) mixed++; }
  }
  notes.push(D_.levels.length + ' songs, ' + rows.toLocaleString() + ' rows, ' + notesN.toLocaleString() + ' notes, '
    + (100 * doubles / notesN).toFixed(1) + '% doubles');
  ok(D_.levels.length === 150, 'all 150 songs are present');
  ok(rows > 20000, 'the check looked at ' + rows.toLocaleString() + ' rows, not nothing');
  ok(mixed === 0, 'no row in any of the 150 songs mixes a tap and a double (' + mixed + ' do)');
  const share = doubles / notesN;
  ok(share > 0.18 && share < 0.28, 'the campaign still has its doubles — ' + (100 * share).toFixed(1) + '% of notes');
}

(async () => {
  const b = await chromium.launch(launchOpts());
  const ctx = await b.newContext({ viewport: { width: 460, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 0 })));
  await page.goto('file://' + path.join(DIR, 'popup.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1400);

  console.log('== live generation ==');
  {
    const r = await page.evaluate(() => {
      const mixed = grid => grid.filter(row => new Set(row.filter(Boolean).map(c => c.type)).size > 1).length;
      const G = window.RD_Generator;
      const out = { raw: 0, rawRows: 0, gen: 0, genRows: 0, charts: 0, doubles: 0, notes: 0, bands: {} };
      for (const band of ['1-3', '3-6', '6-9', '1-9']) {
        const [lo, hi] = band.split('-').map(Number);
        let m = 0;
        for (let i = 0; i < 40; i++) {
          const rawLvl = G.buildCodeLevel(G.rollEndlessCode(lo, hi));
          out.raw += mixed(rawLvl.grid); out.rawRows += rawLvl.grid.length;
          const lvl = generateLevel(band);
          const mm = mixed(lvl.grid);
          m += mm; out.gen += mm; out.genRows += lvl.grid.length; out.charts++;
          lvl.grid.forEach(row => row.forEach(c => { if (c) { out.notes++; if (c.type === 'dtap') out.doubles++; } }));
        }
        out.bands[band] = m;
      }
      return out;
    });
    notes.push('raw composer: ' + r.raw + ' mixed rows in ' + r.rawRows.toLocaleString() + ' rows; through generateLevel: ' + r.gen);
    ok(r.raw > 100, 'the composer does mix rows on its own (' + r.raw + ' of them) — so the check below means something');
    ok(r.charts === 160, 'generated ' + r.charts + ' charts across every difficulty band');
    ok(r.gen === 0, 'none of them has a tap and a double on one row (' + r.gen + ' do)');
    ok(Object.values(r.bands).every(v => v === 0), 'true in every band: ' + JSON.stringify(r.bands));
    ok(r.doubles > 0 && r.doubles / r.notes < 0.45, 'generated charts still contain doubles (' + (100 * r.doubles / r.notes).toFixed(1) + '% of notes)');
  }

  console.log('== every generation path goes through it ==');
  {
    const r = await page.evaluate(async () => {
      const mixed = grid => grid.filter(row => new Set(row.filter(Boolean).map(c => c.type)).size > 1).length;
      const out = {};
      openCreator(null);
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 260));
      document.querySelector('.adv-mode[data-mode="generate"]').click();
      document.getElementById('gen-into-grid').click();
      await new Promise(r => setTimeout(r, 200));
      const cells = [...document.querySelectorAll('#cr-grid .cr-cell')];
      const lanes = 4, rowsN = cells.length / lanes;
      let m = 0, filled = 0;
      for (let rI = 0; rI < rowsN; rI++) {
        const kinds = new Set();
        for (let l = 0; l < lanes; l++) {
          const c = cells[rI * lanes + l];
          if (c.classList.contains('is-tap')) { kinds.add('t'); filled++; }
          if (c.classList.contains('is-dtap')) { kinds.add('d'); filled++; }
        }
        if (kinds.size > 1) m++;
      }
      out.creatorFilled = filled; out.creatorMixed = m;
      document.getElementById('gen-play').click();
      out.playMixed = mixed(gameLevel.grid);
      const lvl = generateLevel('4-7'); lvl.endless = true; lvl._band = '4-7'; lastGenerated = lvl;
      launchLevel(lvl);
      document.getElementById('g-overlay').classList.remove('show'); startGame();
      notesHit = notesTotal; score = 1; endGame(true);
      document.getElementById('ov-btn').click();
      out.endlessMixed = mixed(gameLevel.grid);
      out.endless = !!gameLevel.endless;
      return out;
    });
    ok(r.creatorFilled > 20, 'the creator fill produced a chart (' + r.creatorFilled + ' notes)');
    ok(r.creatorMixed === 0, 'the creator\'s Generate into grid has no mixed rows (' + r.creatorMixed + ')');
    ok(r.playMixed === 0, 'Generate & play has none (' + r.playMixed + ')');
    ok(r.endless && r.endlessMixed === 0, 'the next Endless song has none (' + r.endlessMixed + ')');
  }

  console.log('== the composer itself is untouched ==');
  {
    const gen = fs.readFileSync(path.join(DIR, 'generator.js'), 'utf8');
    ok(!/RD_RowTypes|uniformRowTypes/.test(gen), 'generator.js is still V7\'s composer — the rule is applied around it, not inside it');
  }

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8rowtypes: ${fail} of ${pass + fail} probes FAILED` : `v8rowtypes: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
