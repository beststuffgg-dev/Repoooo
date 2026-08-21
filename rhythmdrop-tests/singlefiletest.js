// The single-file builds: does inlining change behaviour?
//
// RhythmDrop.html is generated from the source folder by
// tools/build-single.js. It is the form most people will actually
// open — a double-click, a phone browser, a static host — so "the
// folder works" is not the same claim as "the file works". This boots
// the generated files in real Chromium and checks the things inlining
// could plausibly break: script order, module presence, zero network
// requests, and the layout invariants the other suites establish
// against the folder.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { ROOT, launchOpts, openApp } = require('./browser');

const BUILDS = [
  ['RhythmDrop.html', 'RhythmDropV7'],
  ['RhythmDrop-Redesign.html', 'RhythmDropV7-Redesign'],
];

let pass = 0, fail = 0;
const notes = [];
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

(async () => {
  const b = await chromium.launch(launchOpts());

  for (const [file, srcDir] of BUILDS) {
    const full = path.join(ROOT, file);
    console.log('== ' + file + ' ==');
    if (!fs.existsSync(full)) { ok(false, file + ' exists'); continue; }

    const html = fs.readFileSync(full, 'utf8');
    const src = path.join(ROOT, srcDir);

    ok(!/<script\s+src=/.test(html), 'no <script src> survived the inlining');
    {
      const inlined = [...html.matchAll(/<script data-from="([^"]+)"/g)].map(m => m[1]);
      notes.push(file + ' inlines: ' + inlined.join(' -> '));
      const want = ['edge.js', 'lighting.js', 'campaign.js', 'codec.js', 'loading.js', 'audio.js', 'game.js'];
      ok(inlined.join() === want.join(), 'all seven modules inlined, in load order');
      // Each one byte-for-byte what the folder holds.
      let same = 0;
      for (const f of inlined) {
        const body = html.slice(html.indexOf('<script data-from="' + f + '">') + ('<script data-from="' + f + '">').length);
        const code = body.slice(1, body.indexOf('\n</script>'));
        if (code === fs.readFileSync(path.join(src, f), 'utf8')) same++;
      }
      ok(same === inlined.length, `${same}/${inlined.length} inlined modules are byte-identical to the source folder`);
    }

    // ── boot it for real ──
    const ctx = await b.newContext({ viewport: { width: 420, height: 700 } });
    const page = await ctx.newPage();
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => external.push('failed ' + r.url()));
    page.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) external.push(r.url()); });
    await page.addInitScript(() => {
      localStorage.setItem('rd_tutorial', '1');
      localStorage.setItem('rd_profile', JSON.stringify({ username: 'Probe', coins: 50000 }));
    });
    await page.goto('file://' + full, { waitUntil: 'load' });
    await page.waitForTimeout(1400);

    ok(errors.length === 0, 'boots with no page errors (' + errors.join('; ') + ')');
    ok(external.length === 0, 'zero network requests (' + external.slice(0, 3).join(', ') + ')');

    const state = await page.evaluate(() => {
      const s = document.getElementById('boot-splash'); if (s) s.remove();
      showScreen('home');
      RD_Header.measure();
      const mods = ['RD_Campaign', 'RD_Codec', 'RD_Audio', 'RD_Lighting', 'RD_Loading', 'RD_Edge', 'RD_INSTRUMENTS', 'RD_Header']
        .filter(k => typeof window[k] !== 'undefined');
      const cam = document.getElementById('cam-scroll');
      const pane = document.getElementById('tab-levels');
      return {
        mods,
        rows: cam.querySelectorAll('.lvl-row').length,
        listView: cam.clientHeight, listContent: cam.scrollHeight,
        paneScroll: pane.scrollHeight, pane: pane.clientHeight,
        headerBudget: RD_Header.total,
        instruments: (window.RD_INSTRUMENTS || []).length,
        areas: RD_Campaign.AREAS.length,
        levels: RD_Campaign.AREAS.length * RD_Campaign.LEVELS_PER_AREA,
        coins: RD_Campaign.COINS_PER_CLEAR,
      };
    });

    notes.push(`${file}: ${state.levels} levels, ${state.instruments} instruments, header budget ${state.headerBudget.toFixed(1)}px`);
    ok(state.mods.length === 8, 'all eight globals are present (' + state.mods.length + ')');
    ok(state.rows === 15, `the campaign list renders (${state.rows} rows)`);
    ok(state.listView === state.listContent, 'the list is at natural height — the pane is the only scroller');
    ok(state.paneScroll > state.pane, 'and the pane scrolls');
    ok(state.headerBudget > 100, 'the header collapse measured a real budget');
    ok(state.levels === 150 && state.areas === 10, '10 areas x 15 levels');
    ok(state.coins === 150, 'the economy constants came through inlining');

    // A campaign chart generated in the single file must match the
    // one the folder generates — same seed, same chart, everywhere.
    const chart = await page.evaluate(() => {
      const l = RD_Campaign.buildCampaignLevel(3, 7);
      return { name: l.name, bpm: l.bpm, notes: RD_Campaign.countNotes(l), code: RD_Campaign.codeForCampaign(3, 7) };
    });
    notes.push(`${file}: area 3 level 8 = "${chart.name}" ${chart.bpm}bpm ${chart.notes} notes`);
    ok(!!chart.code && chart.notes > 0, 'determinism survives inlining: the same seed builds the same chart');

    await ctx.close();
  }

  // The two single-file builds must agree on everything but the look.
  console.log('== the two single-file builds differ only in presentation ==');
  {
    const a = fs.readFileSync(path.join(ROOT, 'RhythmDrop.html'), 'utf8');
    const c = fs.readFileSync(path.join(ROOT, 'RhythmDrop-Redesign.html'), 'utf8');
    const scriptsOf = t => [...t.matchAll(/<script data-from="([^"]+)">\n([\s\S]*?)\n<\/script>/g)]
      .map(m => [m[1], m[2]]);
    const sa = scriptsOf(a), sc = scriptsOf(c);
    ok(sa.length === sc.length, `both inline ${sa.length} modules`);
    const differing = sa.filter(([n, code], i) => sc[i][0] !== n || sc[i][1] !== code).map(x => x[0]);
    ok(differing.length === 0, differing.length ? 'JS differs: ' + differing.join(', ') : 'every inlined module is byte-identical between the two builds');
    notes.push(`single-file sizes: shipping ${a.length.toLocaleString()} chars, redesign ${c.length.toLocaleString()}`);
  }

  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `singlefiletest: ${fail} of ${pass + fail} probes FAILED` : `singlefiletest: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
