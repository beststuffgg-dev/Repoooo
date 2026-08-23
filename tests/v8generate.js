// Live generation, brought back from V7.
//
// V8 ships a baked campaign, but V7's composer is bundled as
// RD_Generator so a fresh chart can be rolled on the spot. This checks
// two things: the bundled composer still composes real, deterministic,
// playable charts, and the game surfaces them — Generate, keep, and
// endless — without letting a generated run touch campaign progress.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { launchOpts, v8Dir } = require('./browser');

const DIR = v8Dir();
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

console.log('== the composer is bundled, and does not collide with the engine ==');
{
  const sb = { window: {}, Math, Date, console, JSON, localStorage: { getItem: () => null, setItem: () => {} } };
  sb.window.window = sb.window;
  const ctx = vm.createContext(sb);
  for (const f of ['levels.js', 'campaign.js', 'audio.js', 'generator.js']) {
    vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx);
  }
  const G = sb.window.RD_Generator, C = sb.window.RD_Campaign;
  ok(!!G, 'generator.js defines RD_Generator');
  ok(!!C, 'and the progression engine RD_Campaign is still separate');
  ok(G !== C, 'the two are different objects');
  ok(typeof G.rollEndlessCode === 'function' && typeof G.buildCodeLevel === 'function',
    'the generator exposes rollEndlessCode and buildCodeLevel');

  // The bundled composer must be a faithful copy of V7's, or a fix to
  // V7 silently stops reaching V8.
  const bundled = fs.readFileSync(path.join(DIR, 'generator.js'), 'utf8');
  const v7src = fs.readFileSync(path.join(__dirname, '..', 'other', 'v7', 'RhythmDropV7', 'campaign.js'), 'utf8');
  // The bundle must be V7's composer, not a fork of it — otherwise a
  // fix to the campaign generator silently stops reaching V8. Compare
  // the two with whitespace collapsed (the bundle adds a header banner
  // and renames the export; neither changes behaviour).
  const canon = t => t
    .replace(/window\.RD_(Generator|Campaign) = \{/, 'EXPORT')
    .replace(/^\/\/[^\n]*\n/gm, '')   // drop comment-only lines (the banner)
    .replace(/\s+/g, ' ').trim();
  ok(canon(bundled) === canon(v7src),
    'the bundled composer is V7\'s, verbatim but for the banner and export name');
  // And it is not accidentally the empty string matching the empty string.
  ok(canon(v7src).length > 20000, 'the compared body is the whole composer (' + canon(v7src).length + ' chars)');

  console.log('== a generated chart is real, playable and deterministic ==');
  const code = 'MB4CB' + '1A2B3C4D'.slice(0, 4);   // a fixed, valid code
  let a, b;
  try { a = G.buildCodeLevel(G.rollEndlessCode(3, 6)); } catch (e) { a = null; }
  ok(a && a.grid && a.grid.length > 0, 'rollEndlessCode + buildCodeLevel yields a chart with a grid');
  if (a) {
    let n = 0; a.grid.forEach(r => r.forEach(c => { if (c) n++; }));
    notes.push('a rolled chart: "' + (a.name || '?') + '", ' + a.bpm + 'bpm, ' + n + ' notes, ' + a.instrument);
    ok(n > 20, 'it has ' + n + ' notes');
    ok(a.laneFreqs && a.laneFreqs.length === 4, 'it carries four lane pitches');
    ok(a.grid.every(r => r.length === 4), 'every row is four lanes wide');
    // per-note voices, the thing that makes areas sound different
    const withInst = a.grid.flat().filter(c => c && c.inst).length;
    ok(withInst > 0, 'its notes name their own voice (' + withInst + ' of them)');
  }
  // Determinism: the same code builds the same chart every time.
  const fixed = G.rollEndlessCode(4, 4);
  const x = G.buildCodeLevel(fixed), y = G.buildCodeLevel(fixed);
  ok(JSON.stringify(x.grid) === JSON.stringify(y.grid), 'the same code composes the identical chart twice');

  // Difficulty bands actually differ.
  const easy = [], hard = [];
  for (let i = 0; i < 8; i++) {
    let e = 0, h = 0;
    G.buildCodeLevel(G.rollEndlessCode(1, 2)).grid.forEach(r => r.forEach(c => { if (c) e++; }));
    G.buildCodeLevel(G.rollEndlessCode(8, 9)).grid.forEach(r => r.forEach(c => { if (c) h++; }));
    easy.push(e); hard.push(h);
  }
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  notes.push('avg notes — easy band ' + avg(easy).toFixed(0) + ', hard band ' + avg(hard).toFixed(0));
  ok(avg(hard) > avg(easy), 'the hard band composes denser charts than the easy band');
}

(async () => {
  const b = await chromium.launch(launchOpts());
  const ctx = await b.newContext({ viewport: { width: 460, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 })));
  await page.goto('file://' + path.join(DIR, 'popup.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1400);

  console.log('== Generate & play, from the creator menu, launches a chart ==');
  {
    const r = await page.evaluate(async () => {
      openCreator(null);
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 260));
      document.querySelector('.adv-mode[data-mode="generate"]').click();
      document.querySelector('#gen-band .gen-band-btn[data-band="3-6"]').click();
      document.getElementById('gen-play').click();
      await new Promise(r => setTimeout(r, 200));
      const out = { screen: document.querySelector('.screen.active').id,
        name: gameLevel.name, generated: gameLevel.generated, campaign: !!gameLevel.campaign };
      let n = 0; gameLevel.grid.forEach(row => row.forEach(c => { if (c) n++; }));
      out.notes = n;
      return out;
    });
    ok(r.screen === 'game', 'Generate & play launches straight into the chart');
    ok(r.notes > 20, 'the launched chart has notes (' + r.notes + ')');
    ok(r.generated && !r.campaign, 'it is flagged generated and not campaign');
    notes.push('generated and launched: "' + r.name + '"');
  }

  console.log('== a generated clear keeps progress clean, and can be saved ==');
  {
    const r = await page.evaluate(() => {
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      const before = Object.keys(progress.cleared).length;
      const customsBefore = store.load().length;
      notesHit = notesTotal; score = 9000;
      endGame(true);
      const keep = document.getElementById('ov-keep-btn');
      const out = {
        clearsBefore: before, clearsAfter: Object.keys(progress.cleared).length,
        keepShown: !!keep && keep.style.display !== 'none',
        customsBefore,
      };
      keep.click();
      out.customsAfter = store.load().length;
      out.savedGenerated = store.load().slice(-1)[0].generated === true;
      out.keepDisabledAfter = keep.disabled;
      return out;
    });
    ok(r.clearsAfter === r.clearsBefore, 'a generated clear marks no campaign level cleared');
    ok(r.keepShown, 'the results screen offers to keep the chart');
    ok(r.customsAfter === r.customsBefore + 1, 'keeping it saves one custom level');
    ok(r.savedGenerated, 'and the saved level is flagged as generated');
    ok(r.keepDisabledAfter, 'the keep button disables after saving, so it is not saved twice');
  }

  console.log('== an Endless run keeps rolling a fresh song on Next ==');
  {
    // The Endless tab UI is covered in v8creator; this drives the run
    // mechanics: an endless run offers "Next" and rolls another chart
    // rather than replaying, and never silently saves what it rolls.
    const r = await page.evaluate(() => {
      const lvl = generateLevel('4-7');
      lvl.endless = true; lvl._band = '4-7';
      lastGenerated = lvl;
      launchLevel(lvl);
      const out = { first: gameLevel.name, endless: gameLevel.endless };
      document.getElementById('g-overlay').classList.remove('show'); startGame();
      notesHit = notesTotal; score = 4000; endGame(true);
      out.btnLabel = document.getElementById('ov-btn').textContent;
      out.customsBeforeNext = store.load().length;
      document.getElementById('ov-btn').click();   // Next song
      out.second = gameLevel.name;
      out.stillEndless = gameLevel.endless;
      out.customsAfterNext = store.load().length;
      out.screen = document.querySelector('.screen.active').id;
      return out;
    });
    ok(r.endless, 'launching flags the run endless');
    ok(/next/i.test(r.btnLabel), 'the results button says "' + r.btnLabel + '"');
    ok(r.stillEndless && r.screen === 'game', 'Next song rolls straight into another endless run');
    ok(r.customsAfterNext === r.customsBeforeNext, 'endless does not silently save every song it rolls');
    notes.push('endless rolled "' + r.first + '" then "' + r.second + '"');
  }

  ok(errors.length === 0, 'no page errors through generation (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8generate: ${fail} of ${pass + fail} probes FAILED` : `v8generate: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
