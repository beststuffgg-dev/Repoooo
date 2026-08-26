// The creator's editing power tools: keyboard note entry on the play
// keys, multi-select copy / cut / paste / move / delete, and the now-
// resizable window height.
const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = path.join(v8Dir(), 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const boot = async (b, w, h) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 0 })));
  await page.goto('file://' + APP, { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  await page.evaluate(() => { showScreen('home'); renderHome(); });
  return { ctx, page, errors };
};

(async () => {
  const b = await chromium.launch(launchOpts());

  console.log('== the play keys type notes at a row cursor ==');
  {
    const { ctx, page, errors } = await boot(b, 900, 700);
    const r = await page.evaluate(() => {
      window.__press = (code, opts) => document.body.dispatchEvent(
        new KeyboardEvent('keydown', Object.assign({ code, bubbles: true, cancelable: true }, opts)));
      const filled = () => crGrid.reduce((n, row) => n + row.filter(Boolean).length, 0);
      openCreator(null);
      crGrid = Array.from({ length: 8 }, () => [null, null, null, null]);
      crCursor = 0; buildGrid();
      __press('KeyA');            // lane 0, row 0
      __press('KeyF');            // lane 3, row 0
      __press('Enter');           // advance cursor
      __press('KeyS');            // lane 1, row 1
      const afterType = { r0l0: !!crGrid[0][0], r0l3: !!crGrid[0][3], cursor: crCursor, r1l1: !!crGrid[1][1], total: filled() };
      __press('ArrowUp');         // back to row 0
      __press('KeyA');            // same cell — toggles off
      return { afterType, cursorBack: crCursor, r0l0After: !!crGrid[0][0], total2: filled() };
    });
    ok(r.afterType.r0l0 && r.afterType.r0l3, 'A and F place notes in their lanes on the cursor row');
    ok(r.afterType.cursor === 1, 'Enter advances the cursor one row');
    ok(r.afterType.r1l1, 'S then writes to the new cursor row');
    ok(r.afterType.total === 3, 'three notes typed in total');
    ok(r.cursorBack === 0 && !r.r0l0After && r.total2 === 2, 'typing a lane key again clears that cell');
    ok(errors.length === 0, 'no errors (' + errors.join('; ') + ')');
    await ctx.close();
  }

  console.log('== a text field keeps its keystrokes ==');
  {
    const { ctx, page } = await boot(b, 900, 700);
    const r = await page.evaluate(() => {
      openCreator(null);
      crGrid = Array.from({ length: 8 }, () => [null, null, null, null]); buildGrid();
      const name = document.getElementById('cr-name');
      name.focus();
      const ev = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true, cancelable: true });
      name.dispatchEvent(ev);
      const filled = crGrid.reduce((n, row) => n + row.filter(Boolean).length, 0);
      return { placedNothing: filled === 0, notPrevented: !ev.defaultPrevented };
    });
    ok(r.placedNothing, 'typing A in the name field places no note');
    ok(r.notPrevented, 'and the keystroke is left for the input');
    await ctx.close();
  }

  console.log('== select, copy, paste, move and delete a block ==');
  {
    const { ctx, page, errors } = await boot(b, 900, 700);
    const r = await page.evaluate(() => {
      openCreator(null);
      crGrid = Array.from({ length: 12 }, () => [null, null, null, null]);
      crGrid[0][0] = { type: 'tap',  freq: 261.63, sustain: 0 };
      crGrid[1][1] = { type: 'dtap', freq: 329.63, sustain: 0 };
      setTool('select');
      const barShown = document.getElementById('cr-selbar').classList.contains('show');
      crSel.add('0,0'); crSel.add('1,1'); buildGrid();
      const marked = document.querySelectorAll('.cr-cell-sel').length;

      selCopy();
      const clip = crClip.length;

      // Paste with nothing selected → anchor at the cursor row, lane 0.
      crSel.clear(); crCursor = 4; selPaste();
      const pasted = { at40: !!crGrid[4][0], at51: !!crGrid[5][1], sel: crSel.size };

      // Nudge the pasted block one lane right.
      selMove(0, 1);
      const moved = { off40: !crGrid[4][0], on41: !!crGrid[4][1], off51: !crGrid[5][1], on52: !!crGrid[5][2] };

      // A move that would leave the four lanes is refused.
      crSel.clear(); crSel.add('4,1'); crSel.add('5,2');
      const beforeBlocked = JSON.stringify(crGrid);
      selMove(0, 5);
      const blocked = JSON.stringify(crGrid) === beforeBlocked;

      // Delete clears the selection's cells.
      selDelete();
      const afterDel = { empty41: !crGrid[4][1], empty52: !crGrid[5][2], sel: crSel.size };

      return { barShown, marked, clip, pasted, moved, blocked, afterDel, originals: !!crGrid[0][0] && !!crGrid[1][1] };
    });
    ok(r.barShown, 'the Select tool reveals the action bar');
    ok(r.marked === 2, 'clicking cells marks them (2 selected)');
    ok(r.clip === 2, 'Copy captures the two notes');
    ok(r.pasted.at40 && r.pasted.at51 && r.pasted.sel === 2, 'Paste drops the block at the cursor, keeping its shape');
    ok(r.originals, 'the copied originals are left in place');
    ok(r.moved.off40 && r.moved.on41 && r.moved.off51 && r.moved.on52, 'the arrows nudge the whole block one lane over');
    ok(r.blocked, 'a move past the four lanes is refused');
    ok(r.afterDel.empty41 && r.afterDel.empty52 && r.afterDel.sel === 0, 'Delete clears the selected cells');
    ok(errors.length === 0, 'no errors (' + errors.join('; ') + ')');
    notes.push('copied 2, pasted at row 4, nudged to lanes 1/2, then deleted');
    await ctx.close();
  }

  console.log('== the creator header keeps every control inside the window ==');
  {
    const { ctx, page, errors } = await boot(b, 420, 700);
    const r = await page.evaluate(async () => {
      // A saved level, so Export shows alongside Save, and a long name
      // that would push the buttons off a naive flex row.
      store.save([{ id: 'c1', name: 'A rather long level name goes here', bpm: 180, diff: 'medium',
        grid: Array.from({ length: 8 }, () => [null, null, null, null]) }]);
      currentSettings.width = 420; applySettingsToDOM();
      openCreator(0);
      await new Promise(r => setTimeout(r, 80));
      const win = document.documentElement.clientWidth;
      const controls = [...document.querySelectorAll('.cr-header button, .cr-header select')];
      const outside = controls
        .filter(el => { const b = el.getBoundingClientRect(); return b.right > win + 0.5 || b.left < -0.5; })
        .map(el => (el.textContent || el.value || 'select').trim().slice(0, 8));
      return { win, count: controls.length, outside, hasExport: !!document.getElementById('cr-export-btn') };
    });
    ok(r.count >= 3, 'the header carries its controls (' + r.count + ')');
    ok(r.hasExport, 'Export is present for a saved level');
    ok(r.outside.length === 0, 'no header control spills outside the window' + (r.outside.length ? ' — ' + r.outside.join(', ') : ''));
    ok(errors.length === 0, 'no errors (' + errors.join('; ') + ')');
    notes.push('header fits ' + r.count + ' controls inside a 420px window');
    await ctx.close();
  }

  console.log('== the window resizes vertically as well as horizontally ==');
  {
    const { ctx, page } = await boot(b, 900, 800);
    const r = await page.evaluate(() => {
      currentSettings.width = 520; currentSettings.height = 560; applySettingsToDOM();
      const set = { w: document.documentElement.offsetWidth, h: document.documentElement.offsetHeight };
      currentSettings.height = 760; applySettingsToDOM();
      const tall = document.documentElement.offsetHeight;
      currentSettings.height = 9999; applySettingsToDOM();
      return { set, tall, ceiling: document.documentElement.offsetHeight,
        setting: currentSettings.height, resize: getComputedStyle(document.documentElement).resize };
    });
    ok(/both/.test(r.resize), 'the corner grip is resize:both (' + r.resize + ')');
    ok(r.set.h === 560, 'the height follows its setting (' + r.set.h + ')');
    ok(r.tall === 760, 'the height goes all the way up to 760 (' + r.tall + ')');
    ok(r.ceiling === 760 && r.setting === 760, 'and is capped there (' + r.setting + ')');
    notes.push('height 560→760 applied, 9999 clamped to ' + r.setting + '; resize:' + r.resize);
    await ctx.close();
  }

  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8editor: ${fail} of ${pass + fail} probes FAILED` : `v8editor: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
