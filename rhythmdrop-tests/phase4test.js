// Phase 4: two-stage note placement, the advanced-panel sound preview,
// and the panel growing the window instead of squeezing the grid.
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
  const page = await browser.newPage({ viewport: { width: 460, height: 760 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(DIR, 'popup.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1300);

  await page.evaluate(() => {
    const s = document.getElementById('boot-splash'); if (s) s.remove();
    localStorage.setItem('rd_tutorial', '1');
    if (!profile.username) { profile.username = 'Player'; saveProfile(); }
    openCreator(null);
    crGrid = Array.from({ length: 12 }, () => [null, null, null, null]);
    buildGrid();
  });
  await page.waitForTimeout(150);

  const cell = (r, c) => page.locator(`#cr-grid [data-r="${r}"][data-c="${c}"]`);
  const at = (r, c) => page.evaluate(([r, c]) => {
    const v = crGrid[r][c];
    return v ? { type: v.type, freq: v.freq } : null;
  }, [r, c]);

  // ── 1. Click once to place ────────────────────────────
  console.log('== one click places a note ==');
  await page.click('#t-tap');
  await cell(2, 1).click();
  let c21 = await at(2, 1);
  ok(c21 && c21.type === 'tap', 'first click placed a tap (got ' + JSON.stringify(c21) + ')');
  const laneDefault = await page.evaluate(() => crLaneFreqs[1]);
  ok(c21 && Math.abs(c21.freq - laneDefault) < 0.01, 'it took the lane default pitch');

  // ── 2. Click again opens the pitch picker ─────────────
  console.log('== a second click opens the pitch menu ==');
  ok(!(await page.locator('#note-picker-modal').count()), 'no picker before the second click');
  await cell(2, 1).click();
  await page.waitForTimeout(120);
  ok(await page.locator('#note-picker-modal').count() === 1, 'second click opened the picker');
  const stillThere = await at(2, 1);
  ok(stillThere && stillThere.type === 'tap', 'the note survived the second click (not toggled off)');

  // The picker applies live; ✕ dismisses it.
  const picked = await page.evaluate(async () => {
    const m = document.getElementById('note-picker-modal');
    const g = [...m.querySelectorAll('button')].find(b => b.textContent.trim() === 'G');
    if (g) g.click();
    await new Promise(r => setTimeout(r, 80));
    const live = crGrid[2][1] && crGrid[2][1].freq;
    const x = [...m.querySelectorAll('button')].find(b => b.textContent.trim() === '✕');
    if (x) x.click();
    await new Promise(r => setTimeout(r, 120));
    return { live, freq: crGrid[2][1] && crGrid[2][1].freq,
             open: !!document.getElementById('note-picker-modal') };
  });
  ok(!picked.open, 'the close button dismisses the picker');
  ok(Math.abs(picked.live - laneDefault) > 0.01, 'the pitch applies as you pick (' + picked.live + ')');
  ok(Math.abs(picked.freq - picked.live) < 0.01, 'and it stays after closing (' + picked.freq + ')');

  // ── 3. Erase is still how you clear a note ────────────
  console.log('== the erase tool still clears ==');
  await page.click('#t-erase');
  await cell(2, 1).click();
  ok((await at(2, 1)) === null, 'erase cleared the cell');

  // ── 4. Switching type in place ────────────────────────
  console.log('== a different tool retypes rather than picking ==');
  await page.click('#t-tap');
  await cell(3, 0).click();
  await page.click('#t-dtap');
  await cell(3, 0).click();
  await page.waitForTimeout(100);
  const c30 = await at(3, 0);
  ok(c30 && c30.type === 'dtap', 'tap became a ×2 (got ' + (c30 && c30.type) + ')');
  ok(!(await page.locator('#note-picker-modal').count()), 'retyping did not open the picker');
  await cell(3, 0).click();
  await page.waitForTimeout(120);
  ok(await page.locator('#note-picker-modal').count() === 1, 'clicking the ×2 again opens the picker');
  await page.evaluate(() => {
    const m = document.getElementById('note-picker-modal');
    const x = [...m.querySelectorAll('button')].find(b => /cancel|close|×/i.test(b.textContent));
    if (x) x.click(); else m.remove();
  });
  await page.waitForTimeout(80);

  // ── 5. The preview button exists at the top of the panel ──
  console.log('== the advanced panel has a preview button on top ==');
  await page.click('#adv-toggle');
  await page.waitForTimeout(250);
  ok(await page.locator('#adv-preview').count() === 1, 'there is a preview button');
  const order = await page.evaluate(() => {
    const panel = document.getElementById('adv-panel');
    return [...panel.children].indexOf(document.getElementById('adv-preview'));
  });
  ok(order === 0, 'it is the first thing in the panel (index ' + order + ')');
  const sticky = await page.evaluate(() =>
    getComputedStyle(document.getElementById('adv-preview')).position);
  ok(sticky === 'sticky', 'it stays put while the panel scrolls (position: ' + sticky + ')');

  // ── 6. It plays the chart with the configured instrument ──
  console.log('== the preview actually sounds the chart ==');
  const played = await page.evaluate(async () => {
    const calls = [];
    const real = window.RD_playNoteFreq;
    window.RD_playNoteFreq = (f, d, s, i) => { calls.push({ f, d, s, i }); };
    crGrid = Array.from({ length: 12 }, () => [null, null, null, null]);
    crGrid[0][0] = { type: 'tap',  freq: 261.63, sustain: 0 };
    crGrid[0][2] = { type: 'tap',  freq: 329.63, sustain: 0 };
    crGrid[1][1] = { type: 'dtap', freq: 392.00, sustain: 1 };
    document.getElementById('cr-bpm').value = 240;   // 250ms a beat
    buildGrid();
    const btn = document.getElementById('adv-preview');
    btn.click();
    const playing = btn.classList.contains('playing');
    // 2 rows at 250ms + a 1s sustain tail before the button releases.
    await new Promise(r => setTimeout(r, 1800));
    window.RD_playNoteFreq = real;
    return { calls, playing, stillPlaying: btn.classList.contains('playing') };
  });
  ok(played.playing, 'the button marks itself playing');
  ok(played.calls.length === 3, 'it played all three notes (got ' + played.calls.length + ')');
  ok(played.calls.some(c => Math.abs(c.f - 261.63) < 0.01) &&
     played.calls.some(c => Math.abs(c.f - 392.0) < 0.01), 'it used the cells\' own pitches');
  ok(played.calls.some(c => c.d === true), 'a ×2 is previewed as a ×2');
  ok(played.calls.some(c => c.s === 1), 'sustain carried through');
  const inst = await page.evaluate(() => RD_getInstrument());
  ok(played.calls.every(c => c.i === inst), 'every note used the chosen instrument (' + inst + ')');
  ok(!played.stillPlaying, 'the button releases when the preview ends');

  // ── 7. Empty chart falls back to the lane defaults ────
  console.log('== an empty chart auditions the lanes ==');
  const empty = await page.evaluate(async () => {
    const calls = [];
    const real = window.RD_playNoteFreq;
    window.RD_playNoteFreq = f => calls.push(f);
    crGrid = Array.from({ length: 8 }, () => [null, null, null, null]);
    buildGrid();
    document.getElementById('cr-bpm').value = 240;
    document.getElementById('adv-preview').click();
    await new Promise(r => setTimeout(r, 1700));
    window.RD_playNoteFreq = real;
    return { calls, lanes: [...crLaneFreqs] };
  });
  ok(empty.calls.length === 4, 'played one note per lane (got ' + empty.calls.length + ')');
  ok(empty.calls.every((f, i) => Math.abs(f - empty.lanes[i]) < 0.01), 'in lane order');

  // ── 8. Clicking mid-preview stops it ──────────────────
  console.log('== clicking again stops the preview ==');
  const stopped = await page.evaluate(async () => {
    const calls = [];
    const real = window.RD_playNoteFreq;
    window.RD_playNoteFreq = f => calls.push(f);
    crGrid = Array.from({ length: 12 }, () => [null, null, null, null]);
    for (let r = 0; r < 8; r++) crGrid[r][0] = { type: 'tap', freq: 261.63, sustain: 0 };
    document.getElementById('cr-bpm').value = 120;   // 500ms a beat
    buildGrid();
    const btn = document.getElementById('adv-preview');
    btn.click();
    await new Promise(r => setTimeout(r, 700));      // ~2 notes in
    btn.click();
    const after = calls.length;
    await new Promise(r => setTimeout(r, 900));
    window.RD_playNoteFreq = real;
    return { after, final: calls.length, cls: btn.classList.contains('playing') };
  });
  ok(stopped.after < 8, 'stopped part way through (' + stopped.after + ' of 8)');
  ok(stopped.final === stopped.after, 'no notes fired after the stop');
  ok(!stopped.cls, 'the button cleared its playing state');

  // ── 9. Leaving the creator kills the preview ──────────
  console.log('== leaving the creator silences it ==');
  const left = await page.evaluate(async () => {
    const calls = [];
    const real = window.RD_playNoteFreq;
    window.RD_playNoteFreq = f => calls.push(f);
    document.getElementById('adv-preview').click();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('cr-back').click();
    const at = calls.length;
    await new Promise(r => setTimeout(r, 1200));
    window.RD_playNoteFreq = real;
    return { at, final: calls.length };
  });
  ok(left.final === left.at, 'nothing played after going back (' + left.at + ' → ' + left.final + ')');

  // ── 10. The panel grows the window, and gives it back ──
  console.log('== the panel resizes the extension, not the grid ==');
  // Sized like the real popup: html.as-popup with an explicit box, which
  // is the only mode where "grow the window" means anything.
  const size = await page.evaluate(async () => {
    document.documentElement.classList.add('as-popup');
    document.documentElement.style.width  = currentSettings.width + 'px';
    document.documentElement.style.height = currentSettings.height + 'px';
    openCreator(null);
    await new Promise(r => setTimeout(r, 150));
    const root = document.documentElement;
    const h = () => parseInt(root.style.height, 10);
    const before = h();
    const gridBefore = document.getElementById('cr-grid-wrap').getBoundingClientRect().height;
    if (!crAdvOpen) document.getElementById('adv-toggle').click();
    await new Promise(r => setTimeout(r, 250));
    const open = h();
    const gridOpen = document.getElementById('cr-grid-wrap').getBoundingClientRect().height;
    const panelH = document.getElementById('adv-panel').getBoundingClientRect().height;
    document.getElementById('adv-toggle').click();
    await new Promise(r => setTimeout(r, 250));
    return {
      before, open, after: h(), gridBefore, gridOpen, panelH,
      overlay: document.body.classList.contains('panel-overlay'),
    };
  });
  ok(size.open > size.before, 'opening grew the window (' + size.before + ' → ' + size.open + ')');
  ok(size.open === 900, 'it grew to the window cap (' + size.open + 'px)');
  ok(Math.abs(size.panelH - (size.open - size.before)) < 6,
     'the panel is exactly the space that was added (' + Math.round(size.panelH) + 'px)');
  ok(size.after === size.before, 'closing restored the old height (' + size.after + ')');
  ok(size.gridOpen >= size.gridBefore - 2,
     'the grid was not squeezed (' + Math.round(size.gridBefore) + ' → ' + Math.round(size.gridOpen) + ')');
  ok(!size.overlay, 'no overlay fallback needed at this size');

  // ── 11. Capped windows fall back to the overlay ───────
  console.log('== at the cap it overlays instead of trapping the panel ==');
  const capped = await page.evaluate(async () => {
    document.documentElement.style.height = '890px';
    document.getElementById('adv-toggle').click();
    await new Promise(r => setTimeout(r, 200));
    const o = document.body.classList.contains('panel-overlay');
    const visible = document.getElementById('adv-panel').classList.contains('open');
    const h = parseInt(document.documentElement.style.height, 10);
    document.getElementById('adv-toggle').click();
    await new Promise(r => setTimeout(r, 200));
    return { o, visible, capped: h <= 900,
             cleared: document.body.classList.contains('panel-overlay') };
  });
  ok(capped.capped, 'the window never grew past the 900px cap');
  ok(capped.o, 'near the cap it switched to overlay');
  ok(capped.visible, 'the panel is still shown');
  ok(!capped.cleared, 'the overlay class is removed on close');

  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILURES, ' + pass + ' passed' : 'all ' + pass + ' probes passed'));
  process.exit(fail ? 1 : 0);
})();
