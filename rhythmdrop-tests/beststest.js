// Per-level bests: every level keeps its record, not just the top 50.
const { chromium } = require('playwright');
const {chromeExe}=require('./browser');
const path = require('path');

// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR = process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
const EXE = chromeExe();

let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 620 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(DIR, 'popup.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    const s = document.getElementById('boot-splash'); if (s) s.remove();
    localStorage.setItem('rd_tutorial', '1');
    if (!profile.username) { profile.username = 'Player'; saveProfile(); }
  });

  console.log('== the case that motivated this: 150 levels vs a 50-row log ==');
  const r = await page.evaluate(() => {
    localStorage.removeItem('rd_bests');
    localStorage.removeItem('rd_scores');
    const out = {};

    // Post a score on all 150 campaign levels, ascending, so the early
    // ones are exactly what a top-50 log would evict.
    for (let a = 1; a <= 10; a++) {
      for (let i = 0; i < 15; i++) {
        const lvl = RD_Campaign.campaignLevelMeta(a, i);
        addHighScore('Player', 1000 + (a * 15 + i) * 100, lvl.name, 1);
        recordLevelBest(lvl, 1000 + (a * 15 + i) * 100, 5);
      }
    }
    out.logRows = store.loadScores().length;
    out.bestRows = Object.keys(store.loadBests()).length;

    // The very first level's record must have survived.
    out.first = bestFor(RD_Campaign.campaignLevelMeta(1, 0));
    out.last  = bestFor(RD_Campaign.campaignLevelMeta(10, 14));
    out.bytes = (localStorage.getItem('rd_bests') || '').length;
    return out;
  });
  ok(r.logRows === 50, `run log still caps at 50 (got ${r.logRows})`);
  ok(r.bestRows === 150, `every level kept a record (got ${r.bestRows})`);
  ok(r.first && r.first.score === 1000 + 15 * 100,
     'the FIRST level still has its best, which the 50-row log had evicted');
  ok(r.last && r.last.score === 1000 + (10 * 15 + 14) * 100, 'the last level too');
  console.log(`  150 records in ${(r.bytes / 1024).toFixed(1)} KB of localStorage`);

  console.log('== identity is the level, not its name ==');
  const id = await page.evaluate(() => {
    localStorage.removeItem('rd_bests');
    const out = {};
    // Two different customs deliberately sharing a name.
    const a = { name: 'Untitled', bpm: 120, grid: new Array(32).fill([null,null,null,null]) };
    const b = { name: 'Untitled', bpm: 140, grid: new Array(64).fill([null,null,null,null]) };
    recordLevelBest(a, 5000, 5);
    recordLevelBest(b, 9000, 9);
    out.a = bestFor(a).score;
    out.b = bestFor(b).score;
    out.keys = Object.keys(store.loadBests()).length;

    // A campaign level and the Double of it are separate records.
    const c = RD_Campaign.campaignLevelMeta(2, 3);
    recordLevelBest(c, 4000, 4);
    recordLevelBest(Object.assign({}, c, { double: true }), 8000, 8);
    out.std = bestFor(c).score;
    out.dbl = bestFor(Object.assign({}, c, { double: true })).score;

    // A shared code keys on the code itself.
    const k = RD_Campaign.buildCodeLevel('74BEBTO');
    recordLevelBest(k, 7777, 7);
    out.code = bestFor(k).score;
    return out;
  });
  ok(id.a === 5000 && id.b === 9000, `two customs named "Untitled" keep separate records (${id.a}, ${id.b})`);
  ok(id.keys === 2, 'and occupy two keys, not one');
  ok(id.std === 4000 && id.dbl === 8000, `the Double is its own record (${id.std} vs ${id.dbl})`);
  ok(id.code === 7777, 'shared codes key on the code');

  console.log('== only improvements overwrite ==');
  const imp = await page.evaluate(() => {
    localStorage.removeItem('rd_bests');
    const lvl = RD_Campaign.campaignLevelMeta(1, 0);
    const first = recordLevelBest(lvl, 5000, 5);
    const worse = recordLevelBest(lvl, 3000, 3);
    const better = recordLevelBest(lvl, 7000, 7);
    return { first, worse, better, final: bestFor(lvl).score };
  });
  ok(imp.first === true, 'first run recorded');
  ok(imp.worse === false, 'a worse run does not overwrite');
  ok(imp.better === true, 'a better run does');
  ok(imp.final === 7000, `keeps the highest (${imp.final})`);

  console.log('== migration from the old log ==');
  const mig = await page.evaluate(() => {
    localStorage.removeItem('rd_bests');
    localStorage.removeItem('rd_bests_migrated');
    store.saveScores([{ name: 'Player', score: 4242, level: 'Plough Reel', coins: 4, date: 1 }]);
    // re-run the migration the same way boot does
    const bests = store.loadBests();
    store.loadScores().forEach(s => {
      const k = 'n:' + s.level;
      if (!bests[k] || bests[k][0] < s.score) bests[k] = [s.score, s.coins, s.date];
    });
    store.saveBests(bests);
    return { found: bestFor({ name: 'Plough Reel', grid: [] }) };
  });
  ok(mig.found && mig.found.score === 4242, 'an old name-keyed record is still found');

  console.log('== survives a sync round trip ==');
  const sync = await page.evaluate(() => {
    localStorage.removeItem('rd_bests');
    const l1 = RD_Campaign.campaignLevelMeta(1, 0);
    const l2 = RD_Campaign.campaignLevelMeta(5, 9);
    recordLevelBest(l1, 6000, 6);
    recordLevelBest(l2, 8000, 8);
    const code = buildSyncCode(false);

    // Wipe, then apply: the codes must come back.
    localStorage.removeItem('rd_bests');
    applySyncCode(code);
    const after = { a: bestFor(l1), b: bestFor(l2) };

    // Merge must take the higher of the two sides, never clobber.
    recordLevelBest(l1, 9999, 9);          // local is now better
    applySyncCode(code);                    // re-import the older 6000
    return { after, merged: bestFor(l1).score, len: code.length };
  });
  ok(sync.after.a && sync.after.a.score === 6000, 'best survives export/import');
  ok(sync.after.b && sync.after.b.score === 8000, 'and so does the second one');
  ok(sync.merged === 9999, `merge keeps the better side (${sync.merged})`);
  console.log(`  sync code with 2 bests: ${sync.len} chars`);

  console.log('== a full save syncs at a sane size ==');
  const size = await page.evaluate(() => {
    localStorage.removeItem('rd_bests');
    for (let a = 1; a <= 10; a++) for (let i = 0; i < 15; i++) {
      recordLevelBest(RD_Campaign.campaignLevelMeta(a, i), 100000 + a * 1000 + i, 99);
    }
    return { len: buildSyncCode(false).length, keys: Object.keys(store.loadBests()).length };
  });
  ok(size.keys === 150, '150 records present');
  ok(size.len < 6000, `sync code stays pasteable at ${size.len} chars`);

  console.log('== the level list shows it ==');
  const ui = await page.evaluate(() => {
    showScreen('home'); renderBuiltins();
    const rows = document.querySelectorAll('#cam-scroll .lvl-row');
    const withBest = document.querySelectorAll('#cam-scroll .lvl-best');
    return { rows: rows.length, badges: withBest.length,
             sample: withBest[0] ? withBest[0].textContent.trim() : null };
  });
  ok(ui.rows === 15, 'era renders 15 rows');
  ok(ui.badges === 15, `every row shows its best (${ui.badges})`);
  console.log(`  first row best reads "${ui.sample}"`);

  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await browser.close();
  console.log('\n' + (fail ? `${fail} FAILURES, ${pass} passed` : `all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
