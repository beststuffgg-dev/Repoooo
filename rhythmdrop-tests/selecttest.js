// Creator multi-select: drag a rectangle, then cut / copy / paste it
// with the block landing from its first cell.
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

  // Open the creator on a chart with a known pattern in the top rows.
  await page.evaluate(() => {
    const s = document.getElementById('boot-splash'); if (s) s.remove();
    localStorage.setItem('rd_tutorial', '1');
    if (!profile.username) { profile.username = 'Player'; saveProfile(); }
    openCreator(null);
    crGrid = Array.from({ length: 16 }, () => [null, null, null, null]);
    // A 2x2 signature block at rows 0-1, lanes 0-1.
    crGrid[0][0] = { type: 'tap',  freq: 261.63, sustain: 0 };
    crGrid[0][1] = { type: 'dtap', freq: 329.63, sustain: 1.5 };
    crGrid[1][0] = { type: 'dtap', freq: 392.00, sustain: 0 };
    crGrid[1][1] = { type: 'tap',  freq: 523.25, sustain: 0.5 };
    buildGrid();
  });
  await page.waitForTimeout(200);

  const cell = (r, c) => page.locator(`#cr-grid [data-r="${r}"][data-c="${c}"]`);
  // Always re-measure: earlier steps can scroll or reflow the pane, and
  // a stale box silently drags across the wrong cells.
  const dragSelect = async (r0, c0, r1, c1) => {
    await page.click('#t-select');
    const s0 = await cell(r0, c0).boundingBox();
    await page.mouse.move(s0.x + s0.width / 2, s0.y + s0.height / 2);
    await page.mouse.down();
    const s1 = await cell(r1, c1).boundingBox();
    await page.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2, { steps: 6 });
    await page.waitForTimeout(60);
    await page.mouse.up();
  };
  const clickCell = async (r, c) => {
    const bx = await cell(r, c).boundingBox();
    await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
    await page.waitForTimeout(60);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(100);
  };
  const state = () => page.evaluate(() => ({
    sel: crSel, clip: crClip ? { h: crClip.h, w: crClip.w } : null,
    pasting: crPasting,
    grid: crGrid.map(row => row.map(x => x ? (x.type === 'dtap' ? 'D' : 'T') : '.').join('')).join('|'),
  }));

  console.log('== the select tool exists ==');
  ok(await page.locator('#t-select').count() === 1, 'SEL tool button present');
  ok(await page.locator('#cr-cut').count() === 1, 'Cut button present');
  ok(await page.locator('#cr-copy').count() === 1, 'Copy button present');
  ok(await page.locator('#cr-paste').count() === 1, 'Paste button present');
  ok(await page.locator('#cr-cut').isDisabled(), 'Cut disabled with no selection');
  ok(await page.locator('#cr-paste').isDisabled(), 'Paste disabled with an empty clipboard');

  console.log('== drag selects a rectangle ==');
  await dragSelect(0, 0, 1, 1);
  let st = await state();
  ok(st.sel && st.sel.r0 === 0 && st.sel.c0 === 0 && st.sel.r1 === 1 && st.sel.c1 === 1,
     'dragged 0,0 -> 1,1 selects that rectangle (' + JSON.stringify(st.sel) + ')');
  ok(await page.locator('#cr-grid .sel').count() === 4, '4 cells highlighted');
  ok(!(await page.locator('#cr-cut').isDisabled()), 'Cut enabled once something is selected');
  ok((await page.textContent('#cr-selinfo')).includes('2×2'), 'readout shows 2×2');

  console.log('== editing is suppressed while selecting ==');
  const before = (await state()).grid;
  await clickCell(5, 2);
  ok((await state()).grid === before, 'clicking a cell in select mode does not draw a note');

  console.log('== copy, then paste lands from the first cell ==');
  await dragSelect(0, 0, 1, 1);
  await page.click('#cr-copy');
  st = await state();
  ok(st.clip && st.clip.h === 2 && st.clip.w === 2, 'clipboard holds a 2x2 block');

  await page.click('#cr-paste');
  st = await state();
  ok(st.pasting === true, 'paste arms rather than dropping immediately');
  ok(await page.locator('#cr-paste.armed').count() === 1, 'Paste button shows as armed');

  // Ghost follows the cursor.
  const t = await cell(8, 2).boundingBox();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.waitForTimeout(100);
  ok(await page.locator('#cr-grid .paste-ghost').count() === 4,
     'a 2x2 ghost follows the cursor');
  const ghostAt = await page.evaluate(() =>
    [...document.querySelectorAll('#cr-grid .paste-ghost')]
      .map(e => e.dataset.r + ',' + e.dataset.c).sort().join(' '));
  ok(ghostAt === '8,2 8,3 9,2 9,3', 'ghost anchors at the hovered cell: ' + ghostAt);

  // Click drops it there.
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(140);
  st = await state();
  const rows = st.grid.split('|');
  ok(rows[8] === '..TD' && rows[9] === '..DT',
     'block landed with its first cell at 8,2 (rows: ' + rows[8] + ' / ' + rows[9] + ')');
  ok(st.pasting === false, 'placing mode ends after the drop');

  console.log('== pasted notes keep pitch and sustain ==');
  const fid = await page.evaluate(() => ({
    src: { f: crGrid[0][1].freq, s: crGrid[0][1].sustain, t: crGrid[0][1].type },
    dst: { f: crGrid[8][3].freq, s: crGrid[8][3].sustain, t: crGrid[8][3].type },
  }));
  ok(JSON.stringify(fid.src) === JSON.stringify(fid.dst),
     'pitch, sustain and type all copied: ' + JSON.stringify(fid.dst));

  console.log('== cut clears the source ==');
  await dragSelect(8, 2, 9, 3);
  await page.click('#cr-cut');
  st = await state();
  ok(st.grid.split('|')[8] === '....', 'cut emptied the source rows');
  ok(st.clip.h === 2 && st.clip.w === 2, 'and the block is on the clipboard');

  console.log('== a move: cut here, paste there ==');
  await page.click('#cr-paste');
  await clickCell(12, 0);
  st = await state();
  ok(st.grid.split('|')[12] === 'TD..', 'the block moved to row 12 (' + st.grid.split('|')[12] + ')');

  console.log('== lanes clamp, beats grow ==');
  const clamp = await page.evaluate(() => {
    crClip = { h: 1, w: 3, cells: [[{ type:'tap', freq:261.63, sustain:0 },
                                    { type:'tap', freq:261.63, sustain:0 },
                                    { type:'tap', freq:261.63, sustain:0 }]] };
    commitPaste(2, 3);                   // would overflow lane 3+3
    const rowsBefore = crGrid.length;
    commitPaste(rowsBefore + 2, 0);      // past the end
    return { row2: crGrid[2].map(x => x ? 'T' : '.').join(''),
             grew: crGrid.length > rowsBefore };
  });
  ok(clamp.row2 === '.TTT', 'a 3-wide block clamps into the last lanes: ' + clamp.row2);
  ok(clamp.grew, 'pasting past the end grows the chart instead of truncating');

  console.log('== escape and delete ==');
  const esc = await page.evaluate(() => {
    setTool('select');
    crSel = { r0: 0, c0: 0, r1: 1, c1: 1 };
    paintSelection();
    const had = !!crSel;
    deleteSelection();
    const cleared = crGrid[0].every(x => !x) && crGrid[1].every(x => !x);
    armPaste(); const armed = crPasting;
    cancelPaste();
    return { had, cleared, armed, cancelled: !crPasting };
  });
  ok(esc.cleared, 'Delete clears the selected block');
  ok(esc.armed && esc.cancelled, 'paste can be armed and cancelled');

  console.log('== clipboard does not escape the level ==');
  const scoped = await page.evaluate(() => {
    const before = crClip;
    // leaving the creator and coming back must not leak into a level
    return { sessionOnly: !localStorage.getItem('rd_clipboard'), had: !!before };
  });
  ok(scoped.sessionOnly, 'clipboard is session-only, never persisted');

  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await browser.close();
  console.log('\n' + (fail ? `${fail} FAILURES, ${pass} passed` : `all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
