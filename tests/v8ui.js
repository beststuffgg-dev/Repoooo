const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = path.join(v8Dir(), 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const open = async (b, w, h) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [], net = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith('file://') && !u.startsWith('data:')) net.push(u);
  });
  await page.addInitScript(() => localStorage.setItem('rd_profile', JSON.stringify({ username: 'Probe', coins: 0 })));
  await page.goto('file://' + APP, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { showScreen('home'); renderHome(); });
  return { ctx, page, errors, net };
};

(async () => {
  const b = await chromium.launch(launchOpts());

  console.log('== it boots, and asks the network for nothing ==');
  const { ctx, page, errors, net } = await open(b, 1000, 820);
  {
    const r = await page.evaluate(() => ({
      levels: RD_LEVEL_DATA.levels.length,
      instruments: (window.RD_INSTRUMENTS || []).length,
      screens: document.querySelectorAll('.screen').length,
      active: document.querySelector('.screen.active').id,
    }));
    ok(r.levels === 150, r.levels + ' levels loaded');
    ok(r.instruments === 12, r.instruments + ' instruments');
    ok(r.active === 'home', 'lands on the home screen');
    ok(net.length === 0, 'zero network requests (' + net.slice(0, 2).join(', ') + ')');
  }

  console.log('== both edges move; height goes up to 760 ==');
  {
    const r = await page.evaluate(() => {
      currentSettings.width = 640; currentSettings.height = 560; applySettingsToDOM();
      const set = { w: document.documentElement.offsetWidth, h: document.documentElement.offsetHeight };
      currentSettings.height = 9999; applySettingsToDOM();
      const capped = document.documentElement.offsetHeight;
      return { set, capped, setting: currentSettings.height,
        resize: getComputedStyle(document.documentElement).resize };
    });
    notes.push('width→640, height→560 both applied; a 9999px height capped to ' + r.capped);
    ok(/both/.test(r.resize), 'the corner grip resizes both ways (' + r.resize + ')');
    ok(r.set.w === 640, 'width follows its setting (' + r.set.w + ')');
    ok(r.set.h === 560, 'height follows its setting too (' + r.set.h + ')');
    ok(r.capped === 760 && r.setting === 760, 'asking for 9999px is capped to 760 (' + r.setting + ')');
  }

  console.log('== Advanced opens sideways and widens the window ==');
  {
    const r = await page.evaluate(async () => {
      currentSettings.width = 420; applySettingsToDOM();
      openCreator(null);
      await new Promise(r => setTimeout(r, 140));
      const grid = document.getElementById('cr-grid');
      const panel = document.getElementById('adv-panel');
      const before = { win: document.documentElement.offsetWidth,
                       grid: grid.getBoundingClientRect().width };
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 340));
      const after = { win: document.documentElement.offsetWidth,
                      grid: grid.getBoundingClientRect().width,
                      panel: panel.getBoundingClientRect().width,
                      panelLeft: panel.getBoundingClientRect().left,
                      gridRight: grid.getBoundingClientRect().right,
                      overlay: document.body.classList.contains('adv-overlay') };
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 340));
      return { before, after, closed: { win: document.documentElement.offsetWidth,
        grid: grid.getBoundingClientRect().width, saved: currentSettings.width } };
    });
    notes.push(`window ${r.before.win} → ${r.after.win} → ${r.closed.win}; `
      + `grid ${r.before.grid.toFixed(0)} → ${r.after.grid.toFixed(0)} → ${r.closed.grid.toFixed(0)}`);
    ok(r.after.win > r.before.win, 'the window widened by ' + (r.after.win - r.before.win) + 'px');
    ok(r.after.panel >= 170, 'the panel is a usable column (' + r.after.panel.toFixed(0) + 'px)');
    ok(Math.abs(r.after.grid - r.before.grid) < 2, 'the grid kept its width — the panel took the new space, not the chart');
    ok(r.after.panelLeft >= r.after.gridRight - 1, 'the panel sits beside the grid, not over it');
    ok(!r.after.overlay, 'it widened rather than falling back to an overlay');
    ok(r.closed.win === r.before.win, 'closing gave the width back exactly');
    ok(r.closed.saved === 420, 'the transient widening was not saved as the chosen width');
  }

  console.log('== with no room left it overlays instead of opening a sliver ==');
  {
    const r = await page.evaluate(async () => {
      showScreen('home');
      currentSettings.width = getMaxDims().maxW; applySettingsToDOM();
      openCreator(null); await new Promise(r => setTimeout(r, 140));
      const before = document.documentElement.offsetWidth;
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 340));
      const panel = document.getElementById('adv-panel');
      const res = { before, after: document.documentElement.offsetWidth,
        overlay: document.body.classList.contains('adv-overlay'),
        pos: getComputedStyle(panel).position, w: panel.getBoundingClientRect().width };
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 200));
      showScreen('home');
      return res;
    });
    notes.push('at the width cap: window ' + r.before + ' → ' + r.after + ', panel floats at ' + r.w.toFixed(0) + 'px');
    ok(r.overlay, 'falls back to the overlay');
    ok(r.pos === 'absolute', 'the panel floats over the grid');
    ok(r.w >= 170, 'and is still wide enough to use');
    ok(r.after === r.before, 'the window did not grow past its cap');
  }

  console.log('== leaving the creator hands the width back ==');
  {
    const r = await page.evaluate(async () => {
      currentSettings.width = 420; applySettingsToDOM();
      openCreator(null); await new Promise(r => setTimeout(r, 140));
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 340));
      const open = document.documentElement.offsetWidth;
      showScreen('home');
      await new Promise(r => setTimeout(r, 340));
      return { open, home: document.documentElement.offsetWidth,
        stillOpen: document.getElementById('adv-panel').classList.contains('open') };
    });
    ok(r.home === 420, 'home is back to ' + r.home + 'px, not the ' + r.open + 'px the panel needed');
    ok(!r.stillOpen, 'and the panel is closed');
  }

  console.log('== the campaign browser ==');
  {
    const r = await page.evaluate(() => {
      renderHome();
      return {
        chips: document.querySelectorAll('.area-chip:not(.endless-chip)').length,
        endlessChip: document.querySelectorAll('.area-chip.endless-chip').length,
        locked: document.querySelectorAll('.area-chip:not(.endless-chip).locked').length,
        rows: document.querySelectorAll('.song-row').length,
        lockedRows: document.querySelectorAll('.song-row.locked').length,
        first: document.querySelector('.song-name').textContent,
        meta: document.querySelector('.song-meta').textContent,
        daily: document.getElementById('daily-card').classList.contains('show'),
      };
    });
    notes.push('first song: ' + r.first + ' — ' + r.meta);
    ok(r.chips === 10, r.chips + ' area chips');
    ok(r.endlessChip === 1, 'plus the Endless tab');
    ok(r.locked === 9, 'nine areas locked on a fresh profile');
    ok(r.rows === 15, r.rows + ' songs in the open area');
    ok(r.lockedRows === 14, 'only the first song is playable');
    ok(r.daily, 'the daily card is offered');
  }

  console.log('== panes are built when their tab is shown ==');
  {
    const f = await open(b, 420, 640);
    const sizes = () => f.page.evaluate(() => ({
      themes: document.querySelectorAll('#themes-grid .theme-card').length,
      shop: document.querySelectorAll('#shop-avatar-grid .avatar-card').length,
      settings: document.getElementById('tab-settings').children.length,
      levels: document.querySelectorAll('.song-row').length,
    }));
    const tab = name => f.page.evaluate(n => document.querySelector('.hnav[data-tab="' + n + '"]').click(), name);

    const boot = await sizes();
    ok(boot.levels === 15, 'the visible pane is built at startup (' + boot.levels + ' songs)');
    ok(boot.themes === 0 && boot.shop === 0 && boot.settings === 0,
      'the hidden Themes, Shop and Settings panes are not (' + boot.themes + '/' + boot.shop + '/' + boot.settings + ')');

    await tab('shop');     const s = await sizes();
    ok(s.shop > 10, 'opening Shop builds it (' + s.shop + ' avatars)');
    ok(s.themes === 0 && s.settings === 0, 'and only it');
    await tab('themes');   const t = await sizes();
    ok(t.themes === 30, 'opening Themes builds it (' + t.themes + ' themes)');
    await tab('settings'); const g = await sizes();
    ok(g.settings > 0, 'opening Settings builds it (' + g.settings + ' blocks)');

    await tab('themes');
    const earned = await f.page.evaluate(() => {
      const before = document.querySelectorAll('#themes-grid .theme-card.locked').length;
      for (let i = 0; i < 15; i++) progress.cleared['a1l' + i] = true;
      launchCampaignLevel(1, 14);
      document.getElementById('g-overlay').classList.remove('show'); startGame();
      quitToMenu();
      return { before, after: document.querySelectorAll('#themes-grid .theme-card.locked').length };
    });
    ok(earned.before === 10 && earned.after === 9, 'returning to the menu refreshes the pane in view: a theme just earned shows as unlocked (' + earned.before + ' → ' + earned.after + ' locked)');

    await f.page.evaluate(() => { document.querySelector('.hnav[data-tab="levels"]').click(); document.getElementById('shop-avatar-grid').innerHTML = ''; });
    await f.page.evaluate(() => document.getElementById('pbar-avatar').click());
    const jump = await f.page.evaluate(() => ({ active: document.querySelector('.hnav.active').dataset.tab, cards: document.querySelectorAll('#shop-avatar-grid .avatar-card').length }));
    ok(jump.active === 'shop' && jump.cards > 10, 'the avatar shortcut opens a populated Shop (' + jump.cards + ' avatars)');
    await f.ctx.close();
  }

  console.log('== one run, end to end ==');
  {
    const r = await page.evaluate(() => {
      const out = {};
      document.getElementById('daily-card').click();
      out.afterDaily = profile.coins;
      launchCampaignLevel(1, 0);
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      out.queue = gameQueue.length;
      out.name = gameLevel.name;
      notesHit = notesTotal; score = 12345;
      endGame(true);
      out.coins = profile.coins;
      out.xp = progress.xp;
      out.cleared = Object.keys(progress.cleared);
      showScreen('home'); renderHome();
      out.done = document.querySelectorAll('.song-row.done').length;
      out.secondOpen = !document.querySelectorAll('.song-row')[1].classList.contains('locked');
      out.best = document.querySelector('.song-best').textContent;
      out.xpStrip = document.getElementById('xp-num').textContent;
      out.dailyGone = !document.getElementById('daily-card').classList.contains('show');
      return out;
    });
    notes.push(`played ${r.name} (${r.queue} notes): +${r.xp} XP, coins ${r.afterDaily} → ${r.coins}`);
    ok(r.queue > 0, 'the chart built a queue of ' + r.queue + ' notes');
    ok(r.coins === r.afterDaily + 150, 'a clear paid exactly 150 coins, not a score-derived amount');
    ok(r.xp > 0, 'the run granted XP (' + r.xp + ')');
    ok(r.cleared.length === 1 && r.cleared[0] === 'a1l0', 'the level is marked cleared');
    ok(r.done === 1, 'the list shows it cleared');
    ok(r.secondOpen, 'and the next song is unlocked');
    ok(/12,345/.test(r.best), 'the record is on the row (' + r.best.trim() + ')');
    ok(r.xpStrip !== '0/60', 'the XP strip moved (' + r.xpStrip + ')');
    ok(r.dailyGone, 'the daily card is gone once claimed');
  }

  ok(errors.length === 0, 'no page errors through all of it (' + errors.join('; ') + ')');
  await ctx.close();
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8ui: ${fail} of ${pass + fail} probes FAILED` : `v8ui: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
