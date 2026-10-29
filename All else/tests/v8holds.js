const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = path.join(v8Dir(), 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const INIT = () => {
  window.holdLevel = (rows, hold, extra) => {
    const grid = Array.from({ length: rows }, () => [null, null, null, null]);
    grid[2][0] = { type: 'tap', freq: 261.63, sustain: 0, hold };
    if (extra) extra(grid);
    return { name: 'holds', bpm: 120, diff: 'easy', bgMode: 'none', laneFreqs: [261.63, 329.63, 392, 523.25], grid };
  };
  window.__spy = { on: [], released: 0, stopped: 0 };
  window.waitFor = (fn, ms) => new Promise(res => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      let v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v || performance.now() - t0 > (ms || 6000)) { clearInterval(iv); res(v); }
    }, 3);
  });
  window.startHold = (lvl, lives) => {
    currentSettings.lives = lives || 9;
    launchLevel(lvl);
    document.getElementById('g-overlay').classList.remove('show');
    startGame();
    const real = window.RD_noteOn;
    if (!real.__wrapped) {
      window.RD_noteOn = (f, o) => {
        const h = real(f, o);
        window.__spy.on.push([f, o && o.inst]);
        return { release: a => { window.__spy.released++; return h.release(a); }, stop: x => { window.__spy.stopped++; return h.stop(x); }, voice: h.voice };
      };
      window.RD_noteOn.__wrapped = true;
    }
  };
  window.holdTile = () => activeTiles.find(t => t.hold);
  window.atHead = (tol) => { const t = holdTile(); return t && Math.abs(headPt(t) - hitY()) < (tol || 5) ? t : null; };
  window.key = (code, down) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
};

(async () => {
  const b = await chromium.launch(launchOpts());
  const ctx = await b.newContext({ viewport: { width: 520, height: 820 } });
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

  const reload = async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const s = document.getElementById('boot-splash'); if (s) s.remove(); showScreen('home'); });
  };

  console.log('== the hold tile is drawn where it is judged ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 3));
      await waitFor(() => holdTile());
      const t = holdTile();
      await waitFor(() => t.y > 60);
      const lane = laneEls[0].getBoundingClientRect();
      const tile = t.el.getBoundingClientRect();
      const out = {
        h: t.h, expected: TILE_H + 3 * rowPx(), tileH: tile.height,
        headCentre: tile.bottom - TILE_H / 2 - lane.top, judged: headPt(t),
        hasClass: t.el.classList.contains('tile-hold') && t.el.classList.contains('tile-tap'),
        capH: parseFloat(getComputedStyle(t.el, '::before').height),
      };
      quitToMenu();
      return out;
    });
    ok(Math.abs(r.h - r.expected) < 1 && Math.abs(r.tileH - r.expected) < 1.5, 'a 3-row hold is ' + r.tileH.toFixed(0) + 'px tall: one tile plus three rows (' + r.expected.toFixed(0) + ')');
    ok(Math.abs(r.headCentre - r.judged) < 1.5, 'its head sits on the judged point (' + r.headCentre.toFixed(1) + ' vs ' + r.judged.toFixed(1) + ')');
    ok(r.hasClass, 'it is a tap with a hold class');
    ok(Math.abs(r.capH - 38) < 1, 'the head cap is one tile high (' + r.capH + 'px)');
  }

  console.log('== hold the key through to the tail ==');
  {
    const r = await page.evaluate(async () => {
      __spy.on = []; __spy.released = 0;
      startHold(holdLevel(40, 2));
      const t = await waitFor(() => atHead(5));
      const s0 = score;
      key('KeyA', true);
      const out = { held: t.held, down: t.down, combo: combo, hit: notesHit, voices: __spy.on.length };
      await waitFor(() => t.done, 4000);
      out.done = t.done;
      out.comboAfter = combo;
      out.hitAfter = notesHit;
      out.lives = lives;
      out.gained = score - s0;
      out.released = __spy.released;
      key('KeyA', false);
      out.livesAfterKeyUp = lives;
      quitToMenu();
      return out;
    });
    ok(r.held && r.down, 'hitting the head holds it');
    ok(r.combo === 1 && r.hit === 1, 'the head counts as one hit (combo ' + r.combo + ')');
    ok(r.voices === 1, 'and starts one sustained voice (' + r.voices + ')');
    ok(r.done, 'holding to the tail completes it');
    ok(r.comboAfter === 1 && r.hitAfter === 1, 'ticks and the finish do not grow the combo (' + r.comboAfter + ')');
    ok(r.gained > 150, 'but they pay: ' + r.gained + ' points over the head');
    ok(r.released === 1, 'the voice is released once, at the tail');
    ok(r.lives === 9 && r.livesAfterKeyUp === 9, 'holding past the tail costs nothing');
  }

  console.log('== the hold fills up as you hold it ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 4));
      const t = await waitFor(() => atHead(5));
      const before = t.fill.getBoundingClientRect().height;
      key('KeyA', true);
      await new Promise(r => setTimeout(r, 250));
      const a = t.fill.getBoundingClientRect().height;
      await new Promise(r => setTimeout(r, 450));
      const b = t.fill.getBoundingClientRect().height;
      const op = parseFloat(getComputedStyle(t.fill).opacity);
      key('KeyA', false);
      quitToMenu();
      return { before, a, b, op, h: t.h };
    });
    ok(r.b > r.a + 8 && r.a >= 18, 'a bright fill climbs the hold the longer it is held (' + r.a.toFixed(0) + 'px then ' + r.b.toFixed(0) + 'px of ' + r.h + ')');
    ok(r.op > 0.5, 'and shows only while it is held');
  }

  console.log('== letting go early drops it ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 4));
      const t = await waitFor(() => atHead(5));
      key('KeyA', true);
      await new Promise(r => setTimeout(r, 120));
      const livesBefore = lives;
      const scoreBefore = score;
      key('KeyA', false);
      const out = { stillHeld: t.held };
      await waitFor(() => t.dropped, 1000);
      out.gained = score - scoreBefore; out.dropped = t.dropped; out.combo = combo; out.lostLife = livesBefore - lives; out.cls = t.el.classList.contains('dropped');
      out.released = __spy.released;
      await new Promise(r => setTimeout(r, 1500));
      out.livesLater = livesBefore - lives;
      quitToMenu();
      return out;
    });
    ok(r.stillHeld, 'letting go does not drop it at once (a grace of ~110ms)');
    ok(r.dropped && r.cls, 'then it is dropped and dimmed');
    ok(r.combo === 1 && r.lostLife === 0, 'no life is lost and the combo is kept (' + r.lostLife + ')');
    ok(r.gained === 0, 'but the hold pays nothing beyond its head (' + r.gained + ')');
    ok(r.livesLater === 0, 'and the falling tile costs nothing (' + r.livesLater + ')');
  }

  console.log('== a quick re-grab keeps it ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 4));
      const t = await waitFor(() => atHead(5));
      key('KeyA', true);
      await new Promise(r => setTimeout(r, 100));
      key('KeyA', false);
      await new Promise(r => setTimeout(r, 40));
      const downBefore = t.down;
      key('KeyA', true);
      const out = { downBefore, downAfter: t.down, held: t.held, dropped: t.dropped, hits: notesHit, combo };
      await waitFor(() => t.done, 4000);
      out.done = t.done; out.lives = lives; out.hitsAfter = notesHit;
      key('KeyA', false);
      quitToMenu();
      return out;
    });
    ok(!r.downBefore && r.downAfter && r.held && !r.dropped, 'pressing again within the grace takes it back');
    ok(r.hits === 1 && r.hitsAfter === 1, 'without counting a second head');
    ok(r.done && r.lives === 9, 'and it still finishes, no life lost');
  }

  console.log('== releasing just before the tail is fine ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 3));
      const t = await waitFor(() => atHead(5));
      key('KeyA', true);
      const near = await waitFor(() => (hitY() - tailPt(t)) / (laneH() / (currentBeatMs * 4)) < 90, 4000);
      key('KeyA', false);
      await new Promise(r => setTimeout(r, 40));
      const out = { done: t.done, dropped: t.dropped, lives, combo };
      quitToMenu();
      return out;
    });
    ok(r.done && !r.dropped && r.lives === 9, 'a release within ~140ms of the tail completes it, without losing a life');
    ok(r.combo === 1, 'and keeps the combo (' + r.combo + ')');
  }

  console.log('== missing the head costs one life ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 4), 5);
      const t = await waitFor(() => holdTile());
      await waitFor(() => t.missed, 5000);
      const out = { missed: t.missed, lives, cls: t.el.classList.contains('missed') };
      await waitFor(() => !activeTiles.includes(t) || !running, 8000);
      out.livesEnd = lives; out.gone = !activeTiles.includes(t);
      quitToMenu();
      return out;
    });
    ok(r.missed && r.cls, 'a hold whose head slides past the window is marked missed');
    ok(r.lives === 4, 'at the moment it is missed, not when it leaves the screen (' + r.lives + ')');
    ok(r.livesEnd === 4 && r.gone, 'and leaving the screen costs nothing more (' + r.livesEnd + ')');
  }

  console.log('== too early and too late presses ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 3), 5);
      const t = await waitFor(() => holdTile());
      await waitFor(() => hitY() - headPt(t) < hitTol() + 40 && hitY() - headPt(t) > hitTol() + 20, 3000);
      key('KeyA', true); key('KeyA', false);
      const out = { held: t.held, lives, combo };
      quitToMenu();
      return out;
    });
    ok(!r.held && r.lives === 4, 'a press far above the strike line misses and does not hold (' + r.lives + ' lives)');
  }

  console.log('== losing focus lets go of everything ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 4));
      const t = await waitFor(() => atHead(5));
      key('KeyA', true);
      await new Promise(r => setTimeout(r, 60));
      window.dispatchEvent(new Event('blur'));
      await waitFor(() => t.dropped, 1000);
      const out = { dropped: t.dropped, held: t.held };
      key('KeyA', false);
      quitToMenu();
      return out;
    });
    ok(r.dropped && !r.held, 'a blur releases the hold, and the grace runs out');
  }

  console.log('== the pointer holds like a key ==');
  {
    await page.evaluate(() => { startHold(holdLevel(40, 4)); });
    const lanePos = await page.evaluate(async () => {
      await waitFor(() => holdTile());
      const l = laneEls[0].getBoundingClientRect();
      return { x: l.x + l.width / 2, y: l.y + l.height * 0.4 };
    });
    await page.evaluate(() => waitFor(() => atHead(6)));
    await page.mouse.move(lanePos.x, lanePos.y);
    await page.mouse.down();
    const mid = await page.evaluate(() => { const t = holdTile(); return { held: t.held, down: t.down }; });
    await page.waitForTimeout(300);
    const still = await page.evaluate(() => { const t = holdTile(); return { held: t.held, down: t.down, dropped: t.dropped }; });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const t = holdTile(); return { dropped: t.dropped, cls: t.el.classList.contains('dropped') }; });
    ok(mid.held && mid.down, 'pressing the lane with the mouse takes the head');
    ok(still.held && still.down && !still.dropped, 'and it stays held while the button is down');
    ok(after.dropped, 'letting go of the button early drops it');
    await page.evaluate(() => quitToMenu());
  }

  console.log('== touch: the finger stays on the lane ==');
  {
    await page.evaluate(() => { startHold(holdLevel(40, 4)); });
    await page.evaluate(() => waitFor(() => atHead(7)));
    const cdp = await ctx.newCDPSession(page);
    const pos = await page.evaluate(() => { const l = laneEls[0].getBoundingClientRect(); return { x: l.x + l.width / 2, y: l.y + l.height * 0.4 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pos.x, y: pos.y, id: 1 }] });
    await page.waitForTimeout(250);
    const during = await page.evaluate(() => { const t = holdTile(); return { held: t.held, down: t.down }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => holdTile().dropped);
    ok(during.held && during.down, 'a finger on the lane holds it');
    ok(after, 'and lifting it early drops it');
    await page.evaluate(() => quitToMenu());
  }

  console.log('== chaos keys: hold the letter you were given ==');
  {
    const r = await page.evaluate(async () => {
      startHold(holdLevel(40, 3));
      chaosMode = false;
      quitToMenu();
      launchLevel(holdLevel(40, 3));
      chaosMode = true;
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      const t = await waitFor(() => atHead(6));
      const code = t.chaosCode;
      key(code, true);
      const out = { code: !!code, held: t.held, label: !!t.el.querySelector('.tile-chaos-key') };
      await new Promise(r => setTimeout(r, 90));
      key(code, false);
      await waitFor(() => t.dropped, 1000);
      out.dropped = t.dropped;
      chaosMode = false;
      quitToMenu();
      return out;
    });
    ok(r.code && r.label, 'a hold in chaos mode carries a letter');
    ok(r.held, 'pressing the letter holds it');
    ok(r.dropped, 'and releasing the letter lets go');
  }

  console.log('== the sustained voice ==');
  {
    const r = await page.evaluate(async () => {
      __spy.on = []; __spy.released = 0; __spy.stopped = 0;
      startHold(holdLevel(40, 2), 9);
      const lvlInst = gameLevel.instrument;
      const t = await waitFor(() => atHead(5));
      key('KeyA', true);
      const first = __spy.on.slice();
      key('KeyA', false);
      await new Promise(r => setTimeout(r, 40));
      quitToMenu();
      return { first, released: __spy.released, freq: t.freq };
    });
    ok(r.first.length === 1 && Math.abs(r.first[0][0] - 261.63) < 0.01, 'the head starts the note at its own pitch (' + r.first.map(a => a[0]) + ')');
    ok(r.released >= 1, 'quitting mid-hold lets the voice go (' + r.released + ')');
  }

  console.log('== several holds at once, with taps on top ==');
  {
    const r = await page.evaluate(async () => {
      const lvl = holdLevel(60, 0, g => {
        for (let c = 0; c < 4; c++) g[2][c] = null;
        g[2][0] = { type: 'tap', freq: 261.63, sustain: 0, hold: 8 };
        g[2][1] = { type: 'tap', freq: 329.63, sustain: 0, hold: 8 };
        g[2][2] = { type: 'tap', freq: 392, sustain: 0, hold: 8 };
        [4, 6, 8].forEach(r => { g[r][3] = { type: 'tap', freq: 523.25, sustain: 0 }; });
      });
      __spy.on = [];
      startHold(lvl, 9);
      await waitFor(() => activeTiles.filter(t => t.hold).length === 3 && activeTiles.filter(t => t.hold).every(t => Math.abs(headPt(t) - hitY()) < 9), 6000);
      ['KeyA', 'KeyS', 'KeyD'].forEach(k => key(k, true));
      const held = activeTiles.filter(t => t.hold && t.held).length;
      let tapped = 0;
      for (let i = 0; i < 3; i++) {
        const t = await waitFor(() => activeTiles.find(x => !x.hold && !x.done && x.lane === 3 && Math.abs(headPt(x) - hitY()) < 7), 4000);
        if (!t) break;
        key('KeyF', true); key('KeyF', false);
        tapped += t.done ? 1 : 0;
      }
      const stillHeld = activeTiles.filter(t => t.hold && t.held && t.down).length;
      await waitFor(() => activeTiles.filter(t => t.hold && t.done).length === 3, 6000);
      const out = { held, tapped, stillHeld, done: activeTiles.filter(t => t.hold && t.done).length + 0, combo, lives, voices: __spy.on.length };
      ['KeyA', 'KeyS', 'KeyD'].forEach(k => key(k, false));
      quitToMenu();
      return out;
    });
    ok(r.held === 3, 'three keys held down hold three notes at once (' + r.held + ')');
    ok(r.tapped === 3 && r.stillHeld === 3, 'and taps on a fourth lane in the meantime hit without dropping any (' + r.tapped + ' taps, ' + r.stillHeld + ' still held)');
    ok(r.lives === 9, 'no life lost');
    const e = await page.evaluate(async () => {
      const grid = Array.from({ length: 40 }, () => new Array(8).fill(null));
      for (let c = 0; c < 8; c++) grid[2][c] = { type: 'tap', freq: 261.63 * Math.pow(2, c / 12), sustain: 0, hold: 6 };
      currentSettings.lives = 9;
      launchLevel({ name: 'eight', bpm: 120, diff: 'easy', bgMode: 'none', lanes: 8, grid });
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      await waitFor(() => activeTiles.filter(t => t.hold).length === 8 && activeTiles.every(t => Math.abs(headPt(t) - hitY()) < 9), 6000);
      const codes = keysFor(8);
      codes.forEach(k => key(k, true));
      const held = activeTiles.filter(t => t.held && t.down).length;
      await waitFor(() => activeTiles.every(t => t.done), 6000);
      const done = activeTiles.filter(t => t.done).length;
      codes.forEach(k => key(k, false));
      const out = { held, done, lives, voices: RD_voiceCount() };
      quitToMenu();
      return out;
    });
    ok(e.held === 8, 'all eight lanes can be held at once (' + e.held + ')');
    ok(e.done === 8 && e.lives === 9, 'and all eight finish (' + e.done + ' done, ' + e.lives + ' lives)');
  }

  console.log('== codes carry holds ==');
  {
    const r = await page.evaluate(() => {
      const C = RD_Codec;
      const lvl = holdLevel(12, 4, g => { g[7][2] = { type: 'tap', freq: 392, sustain: 1, hold: 2 }; g[1][1] = { type: 'dtap', freq: 329.63, sustain: 0, hold: 3 }; });
      const back = C.decodeLevel(C.encodeLevel(lvl));
      const flat = g => g.map(r => r.map(c => (c ? c.type[0] + (c.hold || 0) : '-')).join('')).join(' ');
      const plain = holdLevel(12, 0);
      const noHold = C.encodeLevel(plain);
      const clash = holdLevel(12, 6, g => { g[4][0] = { type: 'tap', freq: 261.63, sustain: 0 }; });
      const clamped = C.decodeLevel(C.encodeLevel(clash));
      return {
        flat: flat(back.grid), head: back.grid[2][0].hold, second: back.grid[7][2].hold, sus: back.grid[7][2].sustain,
        dtapHold: back.grid[1][1].hold,
        clampedTo: clamped.grid[2][0].hold,
        sameWithoutHolds: C.encodeLevel(C.decodeLevel(noHold)) === noHold,
      };
    });
    ok(r.head === 4 && r.second === 2 && r.sus === 1, 'hold lengths and sustain survive a round trip (' + r.head + ', ' + r.second + ', sustain ' + r.sus + ')');
    ok(r.dtapHold === undefined, 'a double never carries a hold');
    ok(r.clampedTo === 1, 'a hold that overlaps a later note in its lane is cut short on import (' + r.clampedTo + ')');
    ok(r.sameWithoutHolds, 'a chart without holds still encodes exactly as before');
  }

  console.log('== the creator: placing and lengthening ==');
  {
    await page.evaluate(() => { openCreator(null); setTool('hold'); });
    const cellPos = async (r, c) => page.evaluate(([r, c]) => {
      const el = document.querySelector('#cr-grid .cr-cell[data-r="' + r + '"][data-c="' + c + '"]');
      el.scrollIntoView({ block: 'center' });
      const b = el.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, [r, c]);

    const a = await cellPos(1, 1);
    await page.mouse.click(a.x, a.y);
    let st = await page.evaluate(() => ({ cell: crGrid[1][1], body: document.querySelectorAll('#cr-grid .is-hold-body').length, head: document.querySelectorAll('#cr-grid .is-hold-head').length }));
    ok(st.cell && st.cell.type === 'tap' && st.cell.hold === 2, 'clicking an empty cell with the Hold tool places a hold of two rows');
    ok(st.body === 2 && st.head === 1, 'drawn as a head and two body cells');

    const tail = await cellPos(3, 1);
    const deeper = await cellPos(7, 1);
    await page.mouse.move(tail.x, tail.y);
    await page.mouse.down();
    await page.mouse.move(deeper.x, deeper.y, { steps: 6 });
    await page.mouse.up();
    st = await page.evaluate(() => ({ hold: crGrid[1][1].hold }));
    ok(st.hold === 6, 'dragging the tail down lengthens it to the row under the pointer (' + st.hold + ')');

    const up = await cellPos(4, 1);
    const grip = await cellPos(7, 1);
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(up.x, up.y, { steps: 5 });
    await page.mouse.up();
    st = await page.evaluate(() => ({ hold: crGrid[1][1].hold }));
    ok(st.hold === 3, 'and dragging it back up shortens it (' + st.hold + ')');

    const place = await cellPos(2, 2);
    const drag = await cellPos(6, 2);
    await page.mouse.move(place.x, place.y);
    await page.mouse.down();
    await page.mouse.move(drag.x, drag.y, { steps: 6 });
    await page.mouse.up();
    st = await page.evaluate(() => ({ hold: crGrid[2][2].hold, has: !!crGrid[2][2] }));
    ok(st.has && st.hold === 4, 'pressing an empty cell and dragging in one go places a hold of that length (' + st.hold + ')');

    await page.evaluate(() => { crGrid[9][1] = { type: 'tap', freq: 329.63, sustain: 0 }; buildGrid(); });
    const far = await cellPos(12, 1);
    const g1 = await cellPos(4, 1);
    await page.mouse.move(g1.x, g1.y);
    await page.mouse.down();
    await page.mouse.move(far.x, far.y, { steps: 6 });
    await page.mouse.up();
    st = await page.evaluate(() => ({ hold: crGrid[1][1].hold }));
    ok(st.hold === 7, 'a hold stops at the next note in its lane (' + st.hold + ' rows, the note is on row 10)');

    const beyond = await page.evaluate(() => { const g = document.getElementById('cr-grid'); const last = g.querySelector('.cr-cell:last-child').getBoundingClientRect(); return { x: last.x + last.width / 2 - 200, y: last.bottom + 30, len: crGrid.length }; });
    await page.evaluate(() => { crGrid[2][3] = { type: 'tap', freq: 523.25, sustain: 0, hold: 1 }; buildGrid(); });
    const tl = await cellPos(3, 3);
    await page.mouse.move(tl.x, tl.y);
    await page.mouse.down();
    const wrapBox = await page.evaluate(() => { const l = document.querySelector('#cr-grid .cr-cell:last-child'); l.scrollIntoView({ block: 'end' }); const b = l.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.bottom + 8 }; });
    await page.mouse.move(wrapBox.x - 160, wrapBox.y, { steps: 4 });
    await page.mouse.move(wrapBox.x - 160, wrapBox.y + 6, { steps: 2 });
    await page.mouse.up();
    st = await page.evaluate(() => ({ hold: crGrid[2][3].hold, rows: crGrid.length }));
    ok(st.hold > 1 && st.rows >= 2 + st.hold + 1, 'dragging past the last row grows the grid to fit (' + st.hold + ' rows, grid ' + st.rows + ')');
  }

  console.log('== the creator: tools act on the whole hold ==');
  {
    const r = await page.evaluate(() => {
      openCreator(null);
      crGestureEnd = 0;
      crGrid[1][1] = { type: 'tap', freq: 329.63, sustain: 0, hold: 3 };
      buildGrid();
      const out = {};
      const cell = (r, c) => document.querySelector('#cr-grid .cr-cell[data-r="' + r + '"][data-c="' + c + '"]');
      setTool('select');
      cell(3, 1).click();
      out.selected = [...crSel];
      out.glow = document.querySelectorAll('#cr-grid .cr-cell-sel').length;
      setTool('erase');
      cell(3, 1).click();
      out.erased = crGrid[1][1] === null;
      out.bodyGone = document.querySelectorAll('#cr-grid .is-hold-body').length;
      setTool('tap');
      crGrid[1][1] = { type: 'tap', freq: 329.63, sustain: 0, hold: 3, inst: 'cello' };
      buildGrid();
      cell(3, 1).click();
      out.editor = !!document.querySelector('.cr-cell-editor');
      const summaries = [...document.querySelectorAll('.cr-cell-editor .cce-sum')].map(b => b.textContent);
      out.summary = summaries.join('|');
      document.querySelector('.cr-cell-editor [data-sec="hold"] .cce-sum').click();
      const chips = [...document.querySelector('.cr-cell-editor .cce-holds').children];
      out.chips = chips.length;
      [...document.querySelector('.cr-cell-editor .cce-holds').children].find(b => b.textContent === '2').click();
      out.afterChip = crGrid[1][1].hold;
      out.instKept = crGrid[1][1].inst;
      [...document.querySelectorAll('.cr-cell-editor .cce-btn')].find(b => b.textContent === '×2').click();
      out.afterDouble = [crGrid[1][1].type, crGrid[1][1].hold];
      out.instStill = crGrid[1][1].inst;
      document.querySelectorAll('.cr-cell-editor').forEach(e => e.remove());
      return out;
    });
    ok(r.selected.join() === '1,1' && r.glow === 4, 'selecting any cell of a hold selects its head and lights the whole hold (' + r.selected + ', ' + r.glow + ' cells)');
    ok(r.erased && r.bodyGone === 0, 'erasing its body erases the whole hold');
    ok(/Note.*E4/.test(r.summary) && /Hold.*3 rows/.test(r.summary) && /Instrument.*Cello/.test(r.summary) && /Sustain.*off/.test(r.summary), 'the editor lists each setting with its current value (' + r.summary + ')');
    ok(r.editor && r.chips === 7, 'clicking its body opens the editor, with a Hold row (' + r.chips + ' options)');
    ok(r.afterChip === 2, 'picking 2 shortens it (' + r.afterChip + ')');
    ok(r.instKept === 'cello' && r.instStill === 'cello', 'editing a note keeps its own instrument');
    ok(r.afterDouble[0] === 'dtap' && r.afterDouble[1] === undefined, 'making it a double removes the hold');
  }

  console.log('== the creator: other notes, copy, move, save ==');
  {
    const r = await page.evaluate(() => {
      openCreator(null);
      setTool('tap');
      crGrid[1][1] = { type: 'tap', freq: 329.63, sustain: 0, hold: 4 };
      buildGrid();
      const out = {};
      crCursor = 3;
      typeNoteAtCursor(1);
      out.cut = [crGrid[1][1].hold, !!crGrid[3][1]];
      crGrid[1][1].hold = 1;
      crSel = new Set(['1,1']);
      selCopy();
      crCursor = 6; crSel.clear();
      selPaste();
      out.pasted = crGrid[6][0] ? [crGrid[6][0].hold] : null;
      crGrid[0][0] = { type: 'tap', freq: 261.63, sustain: 0, hold: 2 };
      buildGrid();
      crGrid[2][0] = { type: 'tap', freq: 261.63, sustain: 0 };
      normalizeCrHolds();
      out.clamped = crGrid[0][0].hold;
      crGrid[2][0] = null;
      crGrid[0][0].hold = 2;
      crSel = new Set(['0,0']);
      selMove(1, 0);
      out.moved = [crGrid[1][0] && crGrid[1][0].hold, crGrid[0][0]];
      document.getElementById('cr-name').value = 'holdy';
      document.getElementById('cr-save').click();
      const saved = store.load().pop();
      out.saved = saved.grid.flat().filter(c => c && c.hold).map(c => c.hold);
      openCreator(store.load().length - 1);
      out.reopened = crGrid.flat().filter(c => c && c.hold).map(c => c.hold);
      out.drawn = document.querySelectorAll('#cr-grid .is-hold-body').length;
      return out;
    });
    ok(r.cut[0] === 1 && r.cut[1], 'typing a note into a hold\'s body cuts the hold short and places the note (' + r.cut + ')');
    ok(r.pasted && r.pasted[0] === 1, 'copy and paste carry the hold');
    ok(r.clamped === 1, 'a hold that would run into another note is shortened (' + r.clamped + ')');
    ok(r.moved[0] === 2 && r.moved[1] === null, 'moving a selection moves its hold with it');
    ok(r.saved.length >= 2 && r.saved.join() === r.reopened.join(), 'saved levels keep their holds through a reopen (' + r.saved + ')');
    ok(r.drawn >= 2, 'and draw them (' + r.drawn + ' body cells)');
  }

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8holds: ${fail} of ${pass + fail} probes FAILED` : `v8holds: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
