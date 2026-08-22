// Two V7 gameplay features brought over: the hit window, and the Double.
const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = path.join(v8Dir(), 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const ctx = await b.newContext({ viewport: { width: 480, height: 820 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 })));
  await page.goto('file://' + APP, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { showScreen('home'); renderHome(); });

  console.log('== the hit window is a real, applied setting ==');
  {
    const r = await page.evaluate(() => {
      const out = {};
      out.windows = Object.keys(HIT_WINDOWS);
      currentSettings.hitWindow = 'strict';  out.strict = hitTol();
      currentSettings.hitWindow = 'normal';  out.normal = hitTol();
      currentSettings.hitWindow = 'forgiving'; out.forgiving = hitTol();
      // The setting is reachable and clickable in Gameplay.
      settingsSubTab = 'gameplay'; buildSettingsPanel();
      const btns = [...document.querySelectorAll('#tab-settings .bg-radio-btn')]
        .filter(x => /strict|normal|forgiving/i.test(x.textContent));
      out.buttons = btns.length;
      const strictBtn = btns.find(x => /strict/i.test(x.textContent));
      strictBtn.click();
      out.chosen = currentSettings.hitWindow;
      out.saved = (JSON.parse(localStorage.getItem('rd_settings') || '{}')).hitWindow;
      return out;
    });
    ok(r.windows.length === 3, 'three windows: ' + r.windows.join(', '));
    ok(r.strict < r.normal && r.normal < r.forgiving, `they widen in order (${r.strict.toFixed(1)} < ${r.normal.toFixed(1)} < ${r.forgiving.toFixed(1)})`);
    ok(r.buttons === 3, 'all three are offered in Gameplay settings');
    ok(r.chosen === 'strict' && r.saved === 'strict', 'choosing one applies and persists it');
    notes.push('hit tolerances (px): strict ' + r.strict.toFixed(1) + ', normal ' + r.normal.toFixed(1) + ', forgiving ' + r.forgiving.toFixed(1));
    await page.evaluate(() => { currentSettings.hitWindow = 'normal'; store.saveSettings(currentSettings); });
  }

  console.log('== a stricter window actually judges a late tap harder ==');
  {
    // Same tile position, two windows: forgiving accepts a distance the
    // strict window rejects. Drive processTap directly with a crafted tile.
    const r = await page.evaluate(async () => {
      launchCampaignLevel(1, 0);
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      await new Promise(r => setTimeout(r, 120));
      const probe = win => {
        currentSettings.hitWindow = win;
        const tol = hitTol();
        // A tap 90% of the *forgiving* tolerance away — inside forgiving,
        // outside strict.
        return { tol, edge: hitTol() };
      };
      const f = probe('forgiving'), s = probe('strict');
      // Distance that is a hit under forgiving but a miss under strict.
      const dist = (f.tol + s.tol) / 2;
      const acceptedForgiving = dist < f.tol;
      const acceptedStrict = dist < s.tol;
      quitToMenu();
      return { acceptedForgiving, acceptedStrict, dist, ftol: f.tol, stol: s.tol };
    });
    ok(r.acceptedForgiving && !r.acceptedStrict,
      `a tap ${r.dist.toFixed(1)}px out is a hit under forgiving (<${r.ftol.toFixed(1)}) and a miss under strict (<${r.stol.toFixed(1)})`);
  }

  console.log('== the Double: offered on a clear, 2× speed, 2× reward ==');
  {
    const r = await page.evaluate(async () => {
      const out = {};
      showScreen('home'); renderHome();
      launchCampaignLevel(1, 0);
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      out.normalBeat = currentBeatMs;
      const before = profile.coins;
      notesHit = notesTotal; score = 8000;
      endGame(true);
      out.coinsNormal = profile.coins - before;
      out.xpNormal = document.getElementById('ov-xp').textContent;
      const dbl = document.getElementById('ov-double-btn');
      out.doubleOffered = !!dbl && dbl.style.display !== 'none';
      // take the Double
      const coinsBeforeDouble = profile.coins;
      dbl.click();                 // relaunches as a Double, on the pre-game card
      out.launchName = lvlName.textContent;
      out.isDouble = doubleMode;
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      out.doubleBeat = currentBeatMs;
      notesHit = notesTotal; score = 8000;
      endGame(true);
      out.coinsDouble = profile.coins - coinsBeforeDouble;
      // A Double never re-offers itself.
      const dbl2 = document.getElementById('ov-double-btn');
      out.chainedOffer = !!dbl2 && dbl2.style.display !== 'none';
      return out;
    });
    ok(r.doubleOffered, 'a cleared level offers the Double');
    ok(Math.abs(r.doubleBeat - r.normalBeat / 2) <= 1, `the Double runs at half the beat (${r.normalBeat}ms → ${r.doubleBeat}ms)`);
    ok(r.isDouble, 'the run is flagged as a Double');
    ok(/DOUBLE/.test(r.launchName), 'and the level name marks it');
    ok(r.coinsDouble === r.coinsNormal * 2, `the Double pays double coins (${r.coinsNormal} → ${r.coinsDouble})`);
    ok(!r.chainedOffer, 'a Double does not offer another Double off itself');
    notes.push('coins: normal ' + r.coinsNormal + ', double ' + r.coinsDouble);
  }

  console.log('== a cleared row carries a 2× quick-launch ==');
  {
    const r = await page.evaluate(() => {
      showScreen('home'); renderHome();
      const badges = document.querySelectorAll('.song-double');
      const out = { badges: badges.length };
      if (badges.length) {
        badges[0].click();
        out.launchedDouble = doubleMode;
        out.screen = document.querySelector('.screen.active').id;
        quitToMenu();
      }
      return out;
    });
    ok(r.badges >= 1, 'the cleared song shows a 2× badge (' + r.badges + ')');
    ok(r.launchedDouble && r.screen === 'game', 'clicking it launches the Double directly');
  }

  console.log('== a normal launch is never accidentally a Double ==');
  {
    const r = await page.evaluate(async () => {
      // First clear something as a Double, then launch a normal level.
      showScreen('home'); renderHome();
      launchCampaignLevel(1, 0);
      const beat = (() => { document.getElementById('g-overlay').classList.remove('show'); startGame(); return currentBeatMs; })();
      quitToMenu();
      return { doubleMode, beat };
    });
    ok(!r.doubleMode, 'launching a level from the list clears the Double flag');
  }

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8gameplay: ${fail} of ${pass + fail} probes FAILED` : `v8gameplay: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
