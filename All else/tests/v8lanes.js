const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = path.join(v8Dir(), 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const INIT = () => {
  window.mkLevelForPage = (n, rows) => ({
    name: 'lanes' + n, bpm: 120, diff: 'easy', lanes: n, bgMode: 'none',
    grid: Array.from({ length: rows || 24 }, (_, r) =>
      Array.from({ length: n }, (_, c) => (r % n === c ? { type: 'tap', freq: 261.63 * Math.pow(2, c / 12), sustain: 0 } : null))),
  });
};

(async () => {
  const b = await chromium.launch(launchOpts());
  const ctx = await b.newContext({ viewport: { width: 900, height: 820 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.addInitScript(INIT);
  await page.addInitScript(() => {
    localStorage.setItem('rd_tutorial', '1');
    localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 }));
  });
  await page.goto('file://' + APP, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { const s = document.getElementById('boot-splash'); if (s) s.remove(); showScreen('home'); });

  console.log('== the lane helper ==');
  {
    const r = await page.evaluate(() => {
      const L = RD_Lanes;
      return {
        counts: L.COUNTS.join(),
        oldLevel: L.laneCountOf({ grid: [[null, null, null, null]] }),
        byFreqs: L.laneCountOf({ laneFreqs: [1, 2, 3, 4, 5, 6] }),
        explicit: L.laneCountOf({ lanes: 8, grid: [[null, null, null, null]] }),
        junk: L.laneCountOf({ lanes: 5 }),
        none: L.laneCountOf(null),
        keys6: L.defaultKeys(6).join(),
        keys8: L.defaultKeys(8).join(),
      };
    });
    ok(r && r.counts === '4,6,8', 'the supported counts are 4, 6 and 8');
    ok(r.oldLevel === 4 && r.none === 4, 'an old four-wide level, or nothing at all, is 4 lanes');
    ok(r.byFreqs === 6 && r.explicit === 8, 'lane count comes from the lanes field first, then the pitches');
    ok(r.junk === 6, 'an odd count is rounded to a supported one (5 -> 6)');
    ok(r.keys6 === 'KeyA,KeyS,KeyD,KeyF,KeyG,KeyH', '6 lanes default to A S D F G H');
    ok(r.keys8 === 'KeyA,KeyS,KeyD,KeyF,KeyG,KeyH,KeyJ,KeyK', '8 lanes default to A S D F G H J K');
  }

  console.log('== the board is built for each lane count ==');
  for (const n of [4, 6, 8]) {
    const r = await page.evaluate(async n => {
      const lvl = mkLevelForPage(n);
      launchLevel(lvl);
      await new Promise(r => setTimeout(r, 400));
      const lanes = [...document.querySelectorAll('#g-lanes .lane')];
      const caps = lanes.map(l => l.querySelector('.lane-key').textContent.trim());
      const ov = [...document.querySelectorAll('.ov-key')].map(e => e.textContent.trim());
      const widths = lanes.map(l => l.getBoundingClientRect().width);
      const rootW = document.documentElement.offsetWidth;
      const bg = lanes.slice(0, 2).map(l => getComputedStyle(l).backgroundColor);
      return { n: lanes.length, caps, ov, minW: Math.min(...widths), rootW, tint: bg[0] !== bg[1],
               ids: lanes.every((l, i) => l.id === 'lane' + i && document.getElementById('btn' + i) && document.getElementById('fb' + i)) };
    }, n);
    ok(r.n === n, n + ' lanes are drawn');
    ok(r.caps.join('') === 'ASDFGHJK'.slice(0, n), 'with the keycaps ' + r.caps.join(' '));
    ok(r.ov.join('') === r.caps.join(''), 'and the same keys on the start card');
    ok(r.ids, 'every lane has its keycap and feedback label');
    ok(r.tint, 'neighbouring lanes alternate their tint');
    notes.push(n + ' lanes: narrowest lane ' + r.minW.toFixed(0) + 'px in a ' + r.rootW + 'px window');
    ok(r.rootW === 420, n + ' lanes leave the window at its width (' + r.rootW + 'px)');
    await page.evaluate(() => { quitToMenu(); });
    await page.waitForTimeout(150);
  }

  console.log('== the width never changes with the lane count ==');
  {
    const r = await page.evaluate(async () => {
      const before = currentSettings.width;
      launchLevel(mkLevelForPage(8));
      await new Promise(r => setTimeout(r, 400));
      const during = currentSettings.width;
      quitToMenu();
      await new Promise(r => setTimeout(r, 400));
      return { before, during, after: currentSettings.width, root: document.documentElement.offsetWidth, saved: (JSON.parse(localStorage.getItem('rd_settings') || '{}')).width };
    });
    ok(r.before === r.during && r.during === r.after, 'the saved width stays ' + r.before + ' through an 8-lane run');
    ok(Math.abs(r.root - r.before) < 2, 'and the window returns to it (' + r.root + 'px)');
  }

  console.log('== the whole lane is a button, for mouse, touch and chords ==');
  for (const n of [4, 8]) {
    await page.evaluate(n => { launchLevel(mkLevelForPage(n)); document.getElementById('g-overlay').classList.remove('show'); }, n);
    await page.waitForTimeout(300);
    const geo = await page.evaluate(() => [...document.querySelectorAll('#g-lanes .lane')].map(l => {
      const r = l.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.3 };
    }));
    const r = await page.evaluate(() => {
      window.__taps = [];
      const orig = window.tapLane;
      window.tapLane = lane => { window.__taps.push(lane); };
      running = true;
      return typeof orig;
    });
    await page.mouse.click(geo[1].x, geo[1].y);
    const tapped = await page.evaluate(() => window.__taps.slice());
    ok(tapped.length === 1 && tapped[0] === 1, n + ' lanes: a mouse click high up lane 2 taps lane 2 once (' + tapped + ')');
    await page.evaluate(() => { window.__taps = []; });
    const last = geo[geo.length - 1];
    await page.touchscreen.tap(last.x, last.y);
    const t2 = await page.evaluate(() => window.__taps.slice());
    ok(t2.length === 1 && t2[0] === n - 1, n + ' lanes: a touch tap high up the last lane taps lane ' + n + ' once (' + t2 + ')');
    await page.evaluate(() => { window.__taps = []; });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { x: geo[0].x, y: geo[0].y, id: 1 }, { x: geo[2].x, y: geo[2].y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const t3 = await page.evaluate(() => window.__taps.slice().sort());
    ok(t3.length === 2 && t3[0] === 0 && t3[1] === 2, n + ' lanes: two fingers at once tap two lanes (' + t3 + ')');
    await page.evaluate(() => { delete window.tapLane; running = false; quitToMenu(); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const s = document.getElementById('boot-splash'); if (s) s.remove(); showScreen('home'); });
  }

  console.log('== touch-action and key-source guards ==');
  {
    const r = await page.evaluate(async () => {
      launchLevel(mkLevelForPage(4));
      document.getElementById('g-overlay').classList.remove('show');
      const cs = getComputedStyle(document.getElementById('g-lanes'));
      const out = { touchAction: cs.touchAction, userSelect: cs.userSelect };
      const taps = [];
      const orig = window.tapLane;
      window.tapLane = l => taps.push(l);
      running = true;
      const kd = code => document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      const ku = code => document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      kd('KeyA'); kd('KeyA'); ku('KeyA'); kd('KeyA'); ku('KeyA');
      out.keyTaps = taps.slice();
      kd('KeyS'); window.dispatchEvent(new Event('blur')); kd('KeyS');
      out.afterBlur = taps.slice();
      ku('KeyS');
      window.tapLane = orig; running = false; quitToMenu();
      return out;
    });
    ok(r.touchAction === 'none', 'the board has touch-action: none');
    ok(r.userSelect === 'none', 'and user-select: none');
    ok(r.keyTaps.join() === '0,0', 'a held key fires once; releasing and pressing again fires again (' + r.keyTaps + ')');
    ok(r.afterBlur.join() === '0,0,1,1', 'losing focus releases every key, so the next press counts (' + r.afterBlur + ')');
  }

  console.log('== keys per lane count ==');
  {
    const r = await page.evaluate(() => {
      const out = {};
      out.d4 = keysFor(4).join(); out.d6 = keysFor(6).join(); out.d8 = keysFor(8).join();
      assignLaneKey(6, 0, 'KeyH');
      out.swapped = keysFor(6).join();
      out.unique = new Set(keysFor(6)).size === 6;
      out.fourUntouched = keysFor(4).join();
      out.defaultsUntouched = DEFAULT_SETTINGS.keys6.join();
      currentSettings = freshSettings();
      assignLaneKey(4, 3, 'KeyZ');
      out.freshDefaults = DEFAULT_SETTINGS.keys.join();
      currentSettings = freshSettings();
      out.bad = [validKeyRow(['KeyA', 'KeyA', 'KeyD', 'KeyF'], 4), validKeyRow(['KeyA'], 4), validKeyRow(['KeyA', 'KeyS', 'KeyD', 'KeyF'], 4)];
      return out;
    });
    ok(r.d4 === 'KeyA,KeyS,KeyD,KeyF', '4 lanes keep A S D F');
    ok(r.d6 === 'KeyA,KeyS,KeyD,KeyF,KeyG,KeyH' && r.d8 === 'KeyA,KeyS,KeyD,KeyF,KeyG,KeyH,KeyJ,KeyK', '6 and 8 lanes extend along the home row');
    ok(r.swapped.startsWith('KeyH,KeyS,KeyD,KeyF,KeyG,KeyA'), 'choosing a key already in use swaps the two lanes (' + r.swapped + ')');
    ok(r.unique, 'no key is ever bound to two lanes');
    ok(r.fourUntouched === 'KeyA,KeyS,KeyD,KeyF', 'remapping 6 lanes leaves the 4-lane keys alone');
    ok(r.defaultsUntouched === 'KeyA,KeyS,KeyD,KeyF,KeyG,KeyH', 'and never edits the shared defaults');
    ok(r.freshDefaults === 'KeyA,KeyS,KeyD,KeyF', 'remapping on a fresh profile does not mutate the defaults');
    ok(r.bad.join() === 'false,false,true', 'duplicate or short saved rows are rejected on load');
  }

  console.log('== the Controls tab offers 4, 6 and 8 lanes ==');
  {
    const r = await page.evaluate(() => {
      selectHomeTab('settings'); settingsSubTab = 'controls'; buildSettingsPanel();
      const counts = [...document.querySelectorAll('.lane-count-btn')].map(b => b.textContent);
      const rows4 = document.querySelectorAll('#tab-settings select').length;
      document.querySelector('.lane-count-btn[data-lanes="8"]').click();
      const sels = [...document.querySelectorAll('#tab-settings select')];
      const rows8 = sels.length;
      const picked = sels.map(s => keyCodeLabel(s.value)).join('');
      sels[7].value = 'KeyA'; sels[7].dispatchEvent(new Event('change'));
      const after = keysFor(8).join();
      const saved = JSON.parse(localStorage.getItem('rd_settings')).keys8.join();
      return { counts, rows4, rows8, picked, after, saved };
    });
    ok(r.counts.join() === '4 lanes,6 lanes,8 lanes', 'a switch for 4, 6 and 8 lanes');
    ok(r.rows4 === 4 && r.rows8 === 8, 'one key selector per lane (' + r.rows4 + ' then ' + r.rows8 + ')');
    ok(r.picked === 'ASDFGHJK', 'showing ' + r.picked);
    ok(r.after.startsWith('KeyK') && r.after.endsWith('KeyA'), 'picking A for lane 8 swaps it with lane 1 (' + r.after + ')');
    ok(r.saved === r.after, 'and the 8-lane keys persist');
    await page.evaluate(() => { currentSettings = freshSettings(); store.saveSettings(currentSettings); });
  }

  console.log('== old four-key settings still load ==');
  {
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => {
      localStorage.setItem('rd_tutorial', '1');
      localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 }));
      localStorage.setItem('rd_settings', JSON.stringify({ keys: ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'], width: 420, height: 640 }));
    });
    await p2.goto('file://' + APP, { waitUntil: 'load' });
    await p2.waitForTimeout(1200);
    const r = await p2.evaluate(() => ({ k4: keysFor(4).join(), k6: keysFor(6).join(), cap: document.querySelector('#btn3 .lane-key').textContent.trim() }));
    ok(r.k4 === 'KeyJ,KeyK,KeyL,Semicolon', 'a saved four-key layout is kept');
    ok(r.k6 === 'KeyA,KeyS,KeyD,KeyF,KeyG,KeyH', 'and 6 lanes fall back to the defaults');
    ok(r.cap === ';', 'punctuation keys read as the symbol (' + r.cap + ')');
    await p2.close();
  }

  console.log('== codec: old codes decode the same, wide levels get version 6 ==');
  {
    const r = await page.evaluate(() => {
      const C = RD_Codec;
      const out = {};
      const four = mkLevelForPage(4); four.laneFreqs = RD_Lanes.defaultFreqs(4);
      const six = mkLevelForPage(6); six.laneFreqs = RD_Lanes.defaultFreqs(6);
      const eight = mkLevelForPage(8); eight.laneFreqs = RD_Lanes.defaultFreqs(8);
      out.c4 = C.encodeLevel(four); out.c6 = C.encodeLevel(six); out.c8 = C.encodeLevel(eight);
      const flat = g => g.map(r => r.map(c => (c ? c.type[0] + Math.round(c.freq) : '-')).join('')).join('/');
      out.round4 = flat(C.decodeLevel(out.c4).grid) === flat(four.grid);
      out.round6 = flat(C.decodeLevel(out.c6).grid) === flat(six.grid);
      out.round8 = flat(C.decodeLevel(out.c8).grid) === flat(eight.grid);
      out.lanes = [C.decodeLevel(out.c4).lanes, C.decodeLevel(out.c6).lanes, C.decodeLevel(out.c8).lanes];
      out.width = C.decodeLevel(out.c8).grid.every(r => r.length === 8);
      out.stable4 = C.encodeLevel(C.decodeLevel(out.c4)) === out.c4;
      return out;
    });
    ok(r.round4 && r.round6 && r.round8, '4, 6 and 8 lane charts survive an export and import exactly');
    ok(r.lanes.join() === '4,6,8', 'the decoded level reports its lane count (' + r.lanes + ')');
    ok(r.width, 'and every row is 8 wide');
    ok(r.stable4, 'a four-lane code re-encodes byte for byte');
    ok(r.c4.length < r.c8.length, 'the wide chart is the larger code (' + r.c4.length + ' vs ' + r.c8.length + ')');
  }

  console.log('== creator: lane count ==');
  {
    const r = await page.evaluate(async () => {
      openCreator(null);
      const out = {};
      out.start = [crLanes, document.querySelectorAll('#cr-grid .cr-cell').length / crGrid.length];
      crGrid[0][3] = { type: 'tap', freq: crLaneFreqs[3], sustain: 0 };
      setCreatorLanes(6);
      out.six = [crLanes, document.querySelectorAll('#cr-grid .cr-cell').length / crGrid.length, crLaneFreqs.length, crGrid.every(r => r.length === 6)];
      out.keptNote = !!crGrid[0][3];
      setCreatorLanes(8);
      out.eightWindow = document.documentElement.offsetWidth;
      crGrid[2][7] = { type: 'dtap', freq: crLaneFreqs[7], sustain: 0 };
      document.getElementById('cr-name').value = 'wide';
      document.getElementById('cr-save').click();
      const saved = store.load().pop();
      out.saved = [saved.lanes, saved.grid[0].length, saved.laneFreqs.length];
      openCreator(store.load().length - 1);
      out.reopened = [crLanes, document.querySelectorAll('#cr-grid .cr-cell').length / crGrid.length, !!crGrid[2][7]];
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', bubbles: true }));
      out.keyK = !!(crGrid[crCursor] && crGrid[crCursor][7]);
      setCreatorLanes(4);
      out.back = [crLanes, crGrid.every(r => r.length === 4)];
      setCreatorLanes(8);
      document.querySelector('.bg-radio-btn[data-bg="drums"]').click();
      out.radios = [crBgMode, document.querySelector('#cr-lane-count .sel').dataset.lanes, document.querySelectorAll('#cr-lane-count .sel').length];
      document.querySelector('#cr-lane-count [data-lanes="6"]').click();
      out.radios2 = [crLanes, crBgMode];
      return out;
    });
    ok(r.start[0] === 4 && r.start[1] === 4, 'a new level starts with 4 lanes');
    ok(r.six[0] === 6 && r.six[1] === 6 && r.six[2] === 6 && r.six[3], 'switching to 6 widens the grid, the rows and the lane pitches');
    ok(r.keptNote, 'and keeps the notes already placed');
    ok(r.eightWindow === 420, 'eight lanes in the creator leave the window at its width (' + r.eightWindow + 'px)');
    ok(r.saved.join() === '8,8,8', 'saving writes lanes: 8 and 8-wide rows');
    ok(r.reopened[0] === 8 && r.reopened[1] === 8 && r.reopened[2], 'reopening restores all 8 lanes and the note in lane 8');
    ok(r.keyK, 'K types a note into lane 8');
    ok(r.back[0] === 4 && r.back[1], 'shrinking back to 4 trims every row');
    ok(r.radios[0] === 'drums' && r.radios[1] === '8' && r.radios[2] === 1, 'the lane switch and the background switch do not interfere (' + r.radios + ')');
    ok(r.radios2[0] === 6 && r.radios2[1] === 'drums', 'and each keeps its own value (' + r.radios2 + ')');
  }

  console.log('== a wide level plays through to the end ==');
  {
    const r = await page.evaluate(async () => {
      const lvl = mkLevelForPage(6, 12);
      lvl.laneFreqs = RD_Lanes.defaultFreqs(6);
      currentSettings.lives = 99;
      launchLevel(lvl);
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      const spawned = new Set();
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 100));
        activeTiles.forEach(t => spawned.add(t.lane));
      }
      const out = { lanes: [...spawned].sort().join(), hasFb: fbEls.length, timers: fbTimers.length };
      showFb(5, 'PERFECT', 'var(--perfect)');
      await new Promise(r => setTimeout(r, 900));
      out.fbCleared = !fbEls[5].classList.contains('show');
      quitToMenu();
      currentSettings.lives = 3;
      return out;
    });
    ok(r.lanes === '0,1,2,3,4,5', 'tiles fall in all six lanes (' + r.lanes + ')');
    ok(r.hasFb === 6 && r.timers === 6, 'every lane has a feedback label and timer');
    ok(r.fbCleared, 'and the last lane\'s label clears itself');
  }

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8lanes: ${fail} of ${pass + fail} probes FAILED` : `v8lanes: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
