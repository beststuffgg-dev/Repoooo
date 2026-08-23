// Do the settings actually do anything?
//
// Every control here is driven the way a player drives it — the real
// slider, the real button, the real <select> — and then the effect is
// measured somewhere else entirely: the audio engine's reported volume,
// the window's real width, the key that actually triggers a lane. A
// handler that writes to currentSettings and stops is exactly the bug
// this is looking for, and it is invisible to any test that reads the
// setting back.
const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = path.join(v8Dir(), 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const ctx = await b.newContext({ viewport: { width: 1000, height: 820 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 })));
  await page.goto('file://' + APP, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { showScreen('home'); renderHome(); });

  // Open a settings sub-tab and hand back its panel contents.
  const openTab = tab => page.evaluate(t => { settingsSubTab = t; buildSettingsPanel(); }, tab);

  console.log('== controls: remapping a lane key changes what plays it ==');
  {
    await openTab('controls');
    const r = await page.evaluate(async () => {
      const sel = document.querySelectorAll('#tab-settings select')[0];
      if (!sel) return { found: false };
      sel.value = 'KeyJ';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const cap = document.querySelector('#btn0 .lane-key').textContent.trim();
      const saved = JSON.parse(localStorage.getItem('rd_settings') || '{}');
      // And the remapped key must actually reach the lane.
      launchCampaignLevel(1, 0);
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      await new Promise(r => setTimeout(r, 200));
      let firedOnJ = false, firedOnA = false;
      const lane = document.getElementById('lane0');
      const watch = () => lane.className.includes('glow');
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));
      firedOnJ = watch();
      lane.className = lane.className.replace(/ ?glow-\w+/g, '');
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
      firedOnA = watch();
      quitToMenu();
      return { found: true, cap, saved: saved.keys && saved.keys[0], firedOnJ, firedOnA };
    });
    ok(r.found, 'the lane-key selects are rendered');
    ok(r.cap === 'J', 'the keycap follows the remap (shows "' + r.cap + '")');
    ok(r.saved === 'KeyJ', 'and the choice is persisted');
    ok(r.firedOnJ, 'the remapped key triggers the lane');
    ok(!r.firedOnA, 'and the old key no longer does');
    // put it back
    await page.evaluate(() => { currentSettings.keys[0] = 'KeyA'; store.saveSettings(currentSettings); applySettingsToDOM(); });
  }

  console.log('== display: graphics, UI scale and width all reach the DOM ==');
  {
    await openTab('display');
    const r = await page.evaluate(() => {
      const out = {};
      const gfxBtns = [...document.querySelectorAll('#tab-settings .bg-radio-btn')]
        .filter(x => /classic|modern/i.test(x.textContent));
      gfxBtns.find(x => /classic/i.test(x.textContent)).click();
      out.classicOff = !document.body.classList.contains('gfx-modern');
      settingsSubTab = 'display'; buildSettingsPanel();
      [...document.querySelectorAll('#tab-settings .bg-radio-btn')]
        .find(x => /modern/i.test(x.textContent)).click();
      out.modernOn = document.body.classList.contains('gfx-modern');

      settingsSubTab = 'display'; buildSettingsPanel();
      const sliders = [...document.querySelectorAll('#tab-settings input[type=range]')];
      out.sliderCount = sliders.length;
      // UI scale is the first slider in the Display tab.
      const scale = sliders[0];
      scale.value = '1.3';
      scale.dispatchEvent(new Event('input', { bubbles: true }));
      out.zoom = String(document.body.style.zoom);
      scale.value = '1'; scale.dispatchEvent(new Event('input', { bubbles: true }));

      // Width stages into _pendingSize and applies on the button.
      const w = document.getElementById('size-w-slider');
      out.hasWidth = !!w;
      out.widthBefore = document.documentElement.offsetWidth;
      if (w) { w.value = '620'; w.dispatchEvent(new Event('input', { bubbles: true })); }
      out.widthBeforeApply = document.documentElement.offsetWidth;
      const applyBtn = [...document.querySelectorAll('#tab-settings button')]
        .find(x => /apply size/i.test(x.textContent));
      if (applyBtn) applyBtn.click();
      out.widthAfter = document.documentElement.offsetWidth;
      out.savedWidth = (JSON.parse(localStorage.getItem('rd_settings') || '{}')).width;
      return out;
    });
    ok(r.classicOff && r.modernOn, 'the graphics buttons toggle the style both ways');
    ok(r.zoom === '1.3', 'the UI-scale slider zooms the interface (zoom=' + r.zoom + ')');
    ok(r.hasWidth, 'there is a width control');
    ok(r.widthBeforeApply === r.widthBefore, 'dragging width alone does not resize — it stages');
    ok(r.widthAfter === 620, 'Apply resizes the window to ' + r.widthAfter + 'px');
    ok(r.savedWidth === 620, 'and the width is persisted');
    notes.push('display sliders: ' + r.sliderCount + ' (UI scale + width)');
  }

  console.log('== audio: the sliders move the actual engine ==');
  {
    await openTab('audio');
    const r = await page.evaluate(() => {
      const sliders = [...document.querySelectorAll('#tab-settings input[type=range]')];
      const out = { count: sliders.length };
      sliders[0].value = '40'; sliders[0].dispatchEvent(new Event('input', { bubbles: true }));
      out.master = window.RD_getVolume ? window.RD_getVolume() : null;
      sliders[1].value = '20'; sliders[1].dispatchEvent(new Event('input', { bubbles: true }));
      out.music = window.RD_getMusicVolume ? window.RD_getMusicVolume() : null;
      const saved = JSON.parse(localStorage.getItem('rd_settings') || '{}');
      out.savedMaster = saved.masterVol; out.savedMusic = saved.musicVol;

      // The instrument buttons must reach the audio engine, not just the panel.
      const btns = [...document.querySelectorAll('#tab-settings button')]
        .filter(x => /Marimba|Organ|Kalimba/.test(x.textContent));
      out.instButtons = document.querySelectorAll('#tab-settings button').length;
      const organ = btns.find(x => /Organ/.test(x.textContent));
      if (organ) organ.click();
      out.instrument = window.RD_getInstrument ? window.RD_getInstrument() : null;
      out.savedInstrument = (JSON.parse(localStorage.getItem('rd_settings') || '{}')).instrument;
      return out;
    });
    ok(Math.abs(r.master - 0.4) < 1e-6, 'the master slider sets the engine volume (' + r.master + ')');
    ok(Math.abs(r.music - 0.2) < 1e-6, 'the music slider sets the music bus (' + r.music + ')');
    ok(r.savedMaster === 0.4 && r.savedMusic === 0.2, 'both volumes persist');
    ok(r.instrument === 'organ', 'picking an instrument reaches the audio engine (' + r.instrument + ')');
    ok(r.savedInstrument === 'organ', 'and is persisted');
    notes.push('instrument buttons offered: ' + r.instButtons);
    await page.evaluate(() => {
      currentSettings.masterVol = 1; currentSettings.musicVol = 1;
      store.saveSettings(currentSettings); applySettingsToDOM();
    });
  }

  console.log('== gameplay: starting lives reach the run ==');
  {
    await openTab('gameplay');
    const r = await page.evaluate(async () => {
      const sl = document.querySelector('#tab-settings input[type=range]');
      if (!sl) return { found: false };
      sl.value = '7'; sl.dispatchEvent(new Event('input', { bubbles: true }));
      const saved = (JSON.parse(localStorage.getItem('rd_settings') || '{}')).lives;
      launchCampaignLevel(1, 0);
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      await new Promise(r => setTimeout(r, 120));
      const out = { found: true, saved, maxLives, pips: document.getElementById('g-lives').textContent.trim().length };
      quitToMenu();
      return out;
    });
    ok(r.found, 'there is a lives control');
    ok(r.saved === 7, 'the choice is persisted');
    ok(r.maxLives === 7, 'and a run actually starts with ' + r.maxLives + ' lives');
    ok(r.pips >= 7, 'the HUD shows them (' + r.pips + ' pips)');
  }

  console.log('== everything survives a reload ==');
  {
    await page.evaluate(() => {
      Object.assign(currentSettings, {
        keys: ['KeyG', 'KeyH', 'KeyJ', 'KeyK'], gfx: 'classic', uiScale: 1.2,
        width: 560, masterVol: 0.55, musicVol: 0.35, instrument: 'kalimba', lives: 5,
      });
      store.saveSettings(currentSettings);
    });
    await page.reload({ waitUntil: 'load' });
    // Wait for boot to actually finish rather than guessing at a delay:
    // settings are loaded and applied asynchronously, and a fixed
    // timeout raced them on a loaded machine.
    await page.waitForFunction(
      () => typeof currentSettings !== 'undefined' && currentSettings.keys
            && window.RD_getVolume && document.querySelector('#btn0 .lane-key'),
      { timeout: 8000 });
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({
      keys: currentSettings.keys.join(','),
      cap: document.querySelector('#btn0 .lane-key').textContent.trim(),
      gfx: document.body.classList.contains('gfx-modern'),
      zoom: String(document.body.style.zoom),
      width: document.documentElement.offsetWidth,
      master: window.RD_getVolume(), music: window.RD_getMusicVolume(),
      instrument: window.RD_getInstrument(),
      lives: currentSettings.lives,
    }));
    notes.push('after reload: ' + JSON.stringify(r));
    ok(r.keys === 'KeyG,KeyH,KeyJ,KeyK', 'keys restored');
    ok(r.cap === 'G', 'and applied to the keycaps');
    ok(r.gfx === false, 'the classic graphics choice restored');
    ok(r.zoom === '1.2', 'UI scale restored');
    ok(r.width === 560, 'window width restored');
    ok(Math.abs(r.master - 0.55) < 1e-6, 'master volume restored');
    ok(Math.abs(r.music - 0.35) < 1e-6, 'music volume restored');
    ok(r.instrument === 'kalimba', 'instrument restored');
    ok(r.lives === 5, 'lives restored');
  }

  ok(errors.length === 0, 'no page errors through the whole audit (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8settings: ${fail} of ${pass + fail} probes FAILED` : `v8settings: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
