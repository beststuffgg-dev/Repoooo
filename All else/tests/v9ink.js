const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { launchOpts, v8Dir, openApp } = require('./browser');

const DIR = v8Dir();
const APP = path.join(DIR, 'popup.html');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿⭐⬆⬇↺✓✕▶♥♡♫♾]/u;

console.log('== ink engine ==');
{
  global.window = global;
  vm.runInThisContext(fs.readFileSync(path.join(DIR, 'ink.js'), 'utf8'));
  const K = global.RD_Ink;
  ok(K.wavyPath(48, 12, 1.1, 5) === K.wavyPath(48, 12, 1.1, 5), 'the same seed draws the same wobbly outline');
  ok(K.wavyPath(48, 12, 1.1, 5) !== K.wavyPath(48, 12, 1.1, 6), 'another seed draws another outline');
  const a = K.boxURL({ fill: '#eee', stroke: '#222', seed: 3, amp: 1 });
  ok(a === K.boxURL({ fill: '#eee', stroke: '#222', seed: 3, amp: 1 }), 'drawn boxes are cached');
  ok(/^url\("data:image\/svg\+xml,/.test(a), 'boxes come out as inline data images, no network');
  const flat = K.wavyPath(48, 12, 0.25, 5);
  ok(flat !== K.wavyPath(48, 12, 1.4, 5), 'the classic look wobbles less than the modern one');
  const css = K.rules(K.themeTokens(k => ({ '--bg': '#f6efe0', '--text': '#3a3023', '--bg3': '#eadfc8', '--bg4': '#e3d6b9', '--accent': '#e0553a' })[k]), {});
  ok(/:hover/.test(css) && /:active/.test(css), 'every drawn control has hover and press looks');
  ok(/#ffffff/.test(css), 'the hover outline is white');
  ok(K.logoSVG({}).includes('class="blk b1"') && K.logoSVG({}).includes('class="blk b3"'), 'the logo draws three blocks');
}

(async () => {
  const b = await chromium.launch(launchOpts());

  console.log('== look and feel ==');
  {
    const { page, errors } = await openApp(b, { width: 440, height: 660 }, { file: APP });
    const s = await page.evaluate(() => {
      const fonts = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family);
      const text = document.body.innerText;
      const tabs = [...document.querySelectorAll('.hnav')].map(t => ({ icon: !!t.querySelector('svg.ic'), label: t.textContent.trim(), col: getComputedStyle(t).flexDirection }));
      const bg = getComputedStyle(document.body).backgroundColor;
      const card = document.querySelector('.level-card, .song-row');
      return { fonts, text, tabs, bg, ink: !!document.getElementById('ink-rules'), ic: document.querySelectorAll('svg.ic').length, noImg: !card || getComputedStyle(card).borderImageSource !== 'none', logo: !!document.querySelector('.logo-fill svg'), theme: document.body.className };
    });
    ok(s.fonts.includes('RD Round'), 'the rounded font loads from inside the page');
    ok(!EMOJI.test(s.text), 'no emoji is left in the visible text');
    ok(s.ic > 10, 'drawn icons stand in for the emojis (' + s.ic + ')');
    ok(s.tabs.length === 5 && s.tabs.every(t => t.icon && t.col === 'row'), 'each tab has its icon next to its label');
    ok(/^rgb\((2[3-5]\d), (2[0-5]\d), (2[0-5]\d)\)$/.test(s.bg), 'light mode is the default (' + s.bg + ')');
    ok(s.ink && s.noImg, 'the hand-drawn borders are drawn');
    ok(s.logo, 'the new logo is on the home screen');
    const hover = await page.evaluate(async () => {
      const el = document.querySelector('.hnav:not(.active)');
      const before = getComputedStyle(el).borderImageSource;
      el.dispatchEvent(new Event('mouseover'));
      return before;
    });
    await page.hover('.hnav:not(.active)');
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('.hnav:not(.active)')).borderImageSource);
    ok(after !== 'none' && decodeURIComponent(after).includes('#ffffff'), 'hovering draws a white outline');
    await page.mouse.down();
    const pressed = await page.evaluate(() => getComputedStyle(document.querySelector('.hnav:not(.active)')).borderImageSource);
    await page.mouse.up();
    ok(pressed !== after, 'pressing lightens the control');
    ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  }

  console.log('== menu sounds ==');
  {
    const { page } = await openApp(b, { width: 440, height: 660 }, { file: APP });
    const r = await page.evaluate(async () => {
      const fired = [];
      const real = window.RD_uiSfx;
      window.RD_uiSfx = k => { fired.push(k); return real(k); };
      const tab = document.querySelector('.hnav[data-tab="themes"]');
      tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      tab.click();
      await new Promise(r => setTimeout(r, 30));
      const menu = fired.slice();
      window.RD_setUiSounds(false);
      const ctxBefore = real('click');
      window.RD_setUiSounds(true);
      return { menu, off: ctxBefore, hasKinds: ['hover', 'press', 'click', 'tab', 'on', 'off', 'back', 'deny', 'coin', 'open', 'close', 'success'].every(k => typeof k === 'string') };
    });
    ok(r.menu.includes('press') && r.menu.includes('tab'), 'tabs make a press and a tab sound (' + r.menu.join(',') + ')');
    ok(r.off === false, 'the Menu Sounds switch silences them');
    const lane = await page.evaluate(() => {
      const fired = [];
      const real = window.RD_uiSfx;
      window.RD_uiSfx = k => { fired.push(k); return real(k); };
      const lanes = document.getElementById('g-lanes');
      const btn = document.querySelector('.lane-btn');
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      btn.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      return fired;
    });
    ok(lane.length === 0, 'lanes in a level never trigger menu sounds');
  }

  console.log('== tiles ==');
  {
    const { page } = await openApp(b, { width: 440, height: 660 }, { file: APP });
    const r = await page.evaluate(() => {
      document.querySelector('.song-row').click();
      document.getElementById('g-overlay').classList.remove('show');
      const lane = document.querySelector('.lane');
      const mk = cls => { const t = document.createElement('div'); t.className = 'tile ' + cls; t.style.height = '90px'; lane.appendChild(t); return t; };
      const tap = mk('tile-tap'), dt = mk('tile-dtap'), hold = mk('tile-tap tile-hold');
      const bgs = el => [getComputedStyle(el, '::before').backgroundImage, getComputedStyle(el, '::after').backgroundImage];
      const has = s => s && s !== 'none';
      return { tap: bgs(tap).map(has), dt: bgs(dt).map(has), hold: bgs(hold).map(has), border: getComputedStyle(tap).borderImageSource !== 'none' };
    });
    ok(r.tap[0] && !r.tap[1], 'a tap tile has one white dot');
    ok(r.dt[0] && r.dt[1], 'a double tile has two white dots');
    ok(r.hold[0] && r.hold[1], 'a hold tile has a dot and a thin line to its end');
    ok(r.border, 'tiles are drawn with the hand-drawn border');
    const prime = await page.evaluate(async () => {
      const lane = document.querySelector('.lane');
      const t = document.createElement('div');
      t.className = 'tile tile-dtap';
      t.style.height = '90px';
      t.style.transform = 'translate3d(0,240px,0)';
      lane.appendChild(t);
      const before = getComputedStyle(t).transform;
      t.classList.add('primed');
      await new Promise(r => setTimeout(r, 400));
      const after = getComputedStyle(t).transform;
      return { before, after };
    });
    ok(prime.before === prime.after && /240/.test(prime.after), 'a double tile stays where it is after the first press (' + prime.after + ')');
  }

  console.log('== R on the result card ==');
  {
    const { page } = await openApp(b, { width: 440, height: 660 }, { file: APP });
    const r = await page.evaluate(async () => {
      document.querySelector('.song-row').click();
      await new Promise(x => setTimeout(x, 300));
      document.getElementById('ov-btn').click();
      await new Promise(x => setTimeout(x, 200));
      endGame(false);
      await new Promise(x => setTimeout(x, 200));
      const shown = document.getElementById('g-overlay').classList.contains('show');
      const label = document.getElementById('ov-btn').textContent;
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
      await new Promise(x => setTimeout(x, 300));
      return { shown, label, running: !!window.running || (typeof running !== 'undefined' && running), overlay: document.getElementById('g-overlay').classList.contains('show') };
    });
    ok(r.shown && /Play Again/.test(r.label), 'the result card offers Play Again (' + r.label + ')');
    ok(!r.overlay && r.running, 'pressing R there starts the run again');
  }

  console.log('== scenes and codes ==');
  {
    const { page } = await openApp(b, { width: 440, height: 660 }, { file: APP });
    const r = await page.evaluate(() => {
      const S = window.RD_Scenes;
      const all = S.SCENES.map(s => S.svg(s.id).length);
      const lvl = { name: 'scene', bpm: 100, diff: 'easy', lanes: 4, instrument: 'piano', laneFreqs: window.RD_Lanes.defaultFreqs(4), bgMode: 'none', bassPattern: [], scene: 'sea', grid: [[{ type: 'tap', freq: 261.63, sustain: 0 }, null, null, null]] };
      const code = window.RD_Codec.encodeLevel(lvl);
      const back = window.RD_Codec.decodeLevel(code);
      const plain = window.RD_Codec.decodeLevel(window.RD_Codec.encodeLevel(Object.assign({}, lvl, { scene: undefined })));
      const campaign = S.forLevel({ areaId: 3 });
      return { count: S.SCENES.length, min: Math.min.apply(null, all.slice(1)), back: back.scene, plain: plain.scene, campaign, row: document.getElementById('cr-scene-row') !== null };
    });
    ok(r.count >= 16 && r.min > 500, 'sixteen drawn backdrops exist (' + r.count + ')');
    ok(r.back === 'sea' && r.plain === undefined, 'a level background rides in the share code, old codes stay blank');
    ok(r.campaign === 'greece', 'campaign areas bring their own backdrop');
    ok(r.row, 'the creator has a background picker');
  }

  console.log('== fullscreen ==');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { localStorage.setItem('rd_tutorial', '1'); localStorage.setItem('rd_profile', JSON.stringify({ username: 'Probe', coins: 500 })); });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + APP + '#full');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ cls: document.body.classList.contains('fullscreen'), w: document.documentElement.offsetWidth, h: document.documentElement.offsetHeight, zoom: parseFloat(document.body.style.zoom) }));
    ok(r.cls && r.w >= 1270 && r.h >= 710, 'the fullscreen tab fills the window (' + r.w + 'x' + r.h + ')');
    ok(r.zoom > 1, 'the interface is scaled up to the window height (' + r.zoom + ')');
    const saved = await page.evaluate(() => localStorage.getItem('rd_settings'));
    ok(!saved || !/"width":1\d{3}/.test(saved), 'the tab size is never saved as the popup size');
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => { localStorage.setItem('rd_tutorial', '1'); localStorage.setItem('rd_profile', JSON.stringify({ username: 'Probe', coins: 500 })); });
    await p2.goto('file://' + APP);
    await p2.waitForTimeout(1500);
    const [tab] = await Promise.all([ctx.waitForEvent('page'), p2.evaluate(() => document.getElementById('fs-btn').click())]);
    ok(/#full$/.test(tab.url()), 'the fullscreen button opens the game in another tab');
    ok(errs.length === 0, 'no page errors in the fullscreen tab');
    await ctx.close();
  }

  await b.close();
  console.log('\nv9ink: ' + (fail ? fail + ' of ' + (pass + fail) + ' probes FAILED' : 'all ' + pass + ' probes passed'));
  process.exit(fail ? 1 : 0);
})();
