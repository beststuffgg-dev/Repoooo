// The generation menu inside the creator, Endless as its own tab, and
// the panel widening across aspect ratios.
const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = path.join(v8Dir(), 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const boot = async (b, w, h, progress) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(prog => {
    localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 }));
    if (prog) localStorage.setItem('rd_progress', JSON.stringify(prog));
  }, progress || null);
  await page.goto('file://' + APP, { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  await page.evaluate(() => { showScreen('home'); renderHome(); });
  return { ctx, page, errors };
};

const allCleared = () => {
  const cleared = {};
  for (let a = 1; a <= 10; a++) for (let i = 0; i < 15; i++) cleared['a' + a + 'l' + i] = true;
  return { xp: 50000, cleared };
};

(async () => {
  const b = await chromium.launch(launchOpts());

  console.log('== Generate lives in the advanced panel, behind a toggle ==');
  {
    const { ctx, page, errors } = await boot(b, 1000, 700);
    const r = await page.evaluate(async () => {
      // It is NOT in the custom tab any more.
      const custom = document.getElementById('tab-custom');
      const genInCustom = !!custom.querySelector('#gen-btn, #gen-diff, .gen-row');
      openCreator(null);
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 260));
      const modes = [...document.querySelectorAll('.adv-mode')].map(m => m.dataset.mode);
      const settingsShownFirst = document.getElementById('adv-settings').classList.contains('show');
      // toggle to Generate
      document.querySelector('.adv-mode[data-mode="generate"]').click();
      await new Promise(r => setTimeout(r, 120));
      const genShown = document.getElementById('adv-generate').classList.contains('show');
      const setHidden = !document.getElementById('adv-settings').classList.contains('show');
      const bands = document.querySelectorAll('#gen-band .gen-band-btn').length;
      return { genInCustom, modes, settingsShownFirst, genShown, setHidden, bands };
    });
    ok(!r.genInCustom, 'the old generate row is gone from the Custom tab');
    ok(r.modes.join() === 'settings,generate', 'the panel has a Settings / Generate toggle');
    ok(r.settingsShownFirst, 'it opens on Settings');
    ok(r.genShown && r.setHidden, 'the toggle switches to the generation menu');
    ok(r.bands === 3, 'the menu offers three difficulty bands');
    ok(errors.length === 0, 'no errors (' + errors.join('; ') + ')');
    await ctx.close();
  }

  console.log('== Generate into grid fills the editor with a real chart ==');
  {
    const { ctx, page } = await boot(b, 1000, 700);
    const r = await page.evaluate(async () => {
      openCreator(null);
      const before = document.querySelectorAll('.cr-cell.is-tap, .cr-cell.is-dtap').length;
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 260));
      document.querySelector('.adv-mode[data-mode="generate"]').click();
      document.querySelector('#gen-band .gen-band-btn[data-band="6-9"]').click();
      document.getElementById('gen-into-grid').click();
      await new Promise(r => setTimeout(r, 200));
      const after = document.querySelectorAll('.cr-cell.is-tap, .cr-cell.is-dtap').length;
      // the notes are editable cells with pitches
      const named = document.querySelectorAll('.cr-cell-note').length;
      return { before, after, named, rows: crGrid.length };
    });
    notes.push('generate-into-grid placed ' + r.after + ' notes across ' + r.rows + ' rows');
    ok(r.before === 0, 'the grid starts empty');
    ok(r.after > 30, 'generating fills it with a real chart (' + r.after + ' notes)');
    ok(r.named > 0, 'the notes are editable cells with pitches');
    await ctx.close();
  }

  console.log('== Endless is its own tab, gated on clearing the campaign ==');
  {
    // Fresh profile: locked.
    const fresh = await boot(b, 460, 760);
    const r0 = await fresh.page.evaluate(() => {
      const chips = [...document.querySelectorAll('.area-chip')];
      const e = chips.find(c => c.className.includes('endless-chip'));
      return { chips: chips.length, present: !!e, locked: e.className.includes('locked'),
        bottomCard: !!document.getElementById('endless-card') };
    });
    ok(r0.chips === 11, 'there are 11 tabs — ten areas plus Endless');
    ok(r0.present, 'Endless is a tab in the era strip');
    ok(r0.locked, 'and it is locked on a fresh profile');
    ok(!r0.bottomCard, 'the old bottom Endless card is gone');
    await fresh.ctx.close();

    // Everything cleared: unlocked, and shows the three bands.
    const done = await boot(b, 460, 760, allCleared());
    const r1 = await done.page.evaluate(() => {
      const e = [...document.querySelectorAll('.area-chip')].find(c => c.className.includes('endless-chip'));
      const wasLocked = e.className.includes('locked');
      e.click();
      return { wasLocked, sel: !!document.querySelector('.area-chip.endless-chip.sel'),
        bands: document.querySelectorAll('.endless-band').length,
        launches: typeof generateLevel === 'function' };
    });
    ok(!r1.wasLocked, 'clearing every area unlocks it');
    ok(r1.sel, 'selecting it marks the tab');
    ok(r1.bands === 3, 'the Endless pane shows three difficulty bands');
    // A band actually launches a run.
    const r2 = await done.page.evaluate(async () => {
      document.querySelectorAll('.endless-band')[1].click();
      await new Promise(r => setTimeout(r, 300));
      // gameLevel is a script-scoped binding, reachable as a bare
      // identifier here but not as window.gameLevel.
      return { onGame: document.getElementById('game').classList.contains('active'),
        endless: !!(typeof gameLevel !== 'undefined' && gameLevel && gameLevel.endless) };
    });
    ok(r2.onGame && r2.endless, 'a band starts an endless run');
    await done.ctx.close();
  }

  console.log('== the panel widens the window, and works at every aspect ratio ==');
  {
    const ratios = [[360, 780, 'narrow-tall'], [900, 420, 'wide-short'], [600, 600, 'square'], [1100, 500, 'ultrawide']];
    for (const [w, h, tag] of ratios) {
      const { ctx, page, errors } = await boot(b, w, h);
      const r = await page.evaluate(async () => {
        openCreator(null);
        const winBefore = document.documentElement.offsetWidth;
        const gridBefore = document.getElementById('cr-grid').getBoundingClientRect().width;
        document.getElementById('adv-toggle').click();
        await new Promise(r => setTimeout(r, 320));
        const grid = document.getElementById('cr-grid').getBoundingClientRect();
        const panel = document.getElementById('adv-panel').getBoundingClientRect();
        return {
          winBefore, winAfter: document.documentElement.offsetWidth,
          gridBefore: Math.round(gridBefore), gridAfter: Math.round(grid.width),
          panelW: Math.round(panel.width), overlay: document.body.classList.contains('adv-overlay'),
          gridVisible: grid.width > 60, panelUsable: panel.width >= 160,
        };
      });
      notes.push(`${tag}: win ${r.winBefore}→${r.winAfter}, grid ${r.gridAfter}, panel ${r.panelW}${r.overlay ? ' (overlay)' : ''}`);
      ok(r.gridVisible, tag + ': the editing grid stays visible');
      ok(r.panelUsable, tag + ': the panel is usable (' + r.panelW + 'px)');
      if (!r.overlay) ok(r.winAfter >= r.winBefore, tag + ': it widened the window (' + r.winBefore + '→' + r.winAfter + ')');
      else ok(r.gridAfter >= r.gridBefore - 2, tag + ': narrow — it overlays without shrinking the grid');
      ok(errors.length === 0, tag + ': no errors');
      await ctx.close();
    }
  }

  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8creator: ${fail} of ${pass + fail} probes FAILED` : `v8creator: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
