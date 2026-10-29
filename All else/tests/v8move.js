const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = path.join(v8Dir(), 'popup.html');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const INIT = () => {
  window.__plays = [];
  window.spyAudio = () => {
    window.__plays.length = 0;
    if (window.RD_playNoteFreq.__spy) return;
    const real = window.RD_playNoteFreq;
    window.RD_playNoteFreq = (f, d, s, i) => { window.__plays.push({ f: +f.toFixed(2), d: !!d, i: i || null }); return real(f, d, s, i); };
    window.RD_playNoteFreq.__spy = true;
  };
  window.cellEl = (r, c) => document.querySelector('#cr-grid .cr-cell[data-r="' + r + '"][data-c="' + c + '"]');
  window.fresh = () => { openCreator(null); crGestureEnd = 0; };
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

  const pos = (r, c) => page.evaluate(([r, c]) => {
    const el = cellEl(r, c);
    el.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }, [r, c]);
  const drag = async (from, to, steps) => {
    const a = await pos(...from), z = await pos(...to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(z.x, z.y, { steps: steps || 6 });
    await page.mouse.up();
    await page.waitForTimeout(30);
  };

  console.log('== the Move tool drags a note ==');
  {
    await page.evaluate(() => { fresh(); crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0 }; setTool('move'); });
    ok(await page.evaluate(() => document.getElementById('t-move').className.includes('am')), 'there is a Move tool in the toolbar');
    await drag([1, 0], [5, 2]);
    const r = await page.evaluate(() => ({ from: crGrid[1][0], to: crGrid[5][2], count: crGrid.flat().filter(Boolean).length }));
    ok(r.from === null && r.to && r.to.type === 'tap', 'dragging a note to another cell moves it there');
    ok(r.count === 1, 'and leaves nothing behind');
    ok(r.to && Math.abs(r.to.freq - 392) < 0.01, 'a note on its lane\'s default pitch takes the new lane\'s default (' + (r.to && r.to.freq) + ')');
  }

  console.log('== a custom pitch is kept ==');
  {
    await page.evaluate(() => { fresh(); crGrid[1][0] = { type: 'tap', freq: 440, sustain: 1.5, inst: 'cello' }; setTool('move'); });
    await drag([1, 0], [3, 3]);
    const r = await page.evaluate(() => crGrid[3][3]);
    ok(r && r.freq === 440 && r.sustain === 1.5 && r.inst === 'cello', 'a note with its own pitch, sustain and instrument keeps them all');
  }

  console.log('== blocked moves are refused, with a cue ==');
  {
    await page.evaluate(() => { fresh(); crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0 }; crGrid[4][2] = { type: 'dtap', freq: 392, sustain: 0 }; setTool('move'); });
    const a = await pos(1, 0), z = await pos(4, 2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(z.x, z.y, { steps: 5 });
    const during = await page.evaluate(() => ({ bad: document.querySelectorAll('#cr-grid .is-drop-bad').length, good: document.querySelectorAll('#cr-grid .is-drop').length, moving: document.querySelectorAll('#cr-grid .is-moving').length }));
    await page.mouse.up();
    const after = await page.evaluate(() => ({ keep: !!crGrid[1][0], other: crGrid[4][2].type, refuse: document.querySelectorAll('#cr-grid .cr-refuse').length }));
    ok(during.bad === 1 && during.good === 0, 'hovering an occupied cell marks the drop red');
    ok(during.moving === 1, 'and dims the note being carried');
    ok(after.keep && after.other === 'dtap', 'dropping there changes nothing, and nothing is overwritten');
    ok(after.refuse === 1, 'the cell shakes to say no');
    await page.waitForTimeout(450);
    const gone = await page.evaluate(() => document.querySelectorAll('#cr-grid .cr-refuse').length);
    ok(gone === 0, 'and the cue goes away again');
    await page.evaluate(() => { fresh(); crGrid[1][1] = { type: 'tap', freq: 329.63, sustain: 0 }; setTool('move'); });
    const r = await page.evaluate(() => { const plan = planMove(new Set(['1,1']), 0, -5); const p2 = planMove(new Set(['1,1']), -3, 0); return [plan.ok, plan.reason, p2.ok, p2.reason]; });
    ok(!r[0] && r[1] === 'range' && !r[2] && r[3] === 'range', 'moving off the grid is refused (' + r.join() + ')');
  }

  console.log('== a selection moves together ==');
  {
    await page.evaluate(() => {
      fresh();
      crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0 };
      crGrid[2][1] = { type: 'tap', freq: 329.63, sustain: 0 };
      crGrid[3][0] = { type: 'dtap', freq: 261.63, sustain: 0 };
      setTool('select');
      crSel = new Set(['1,0', '2,1']);
      setTool('move');
      crSel = new Set(['1,0', '2,1']);
      buildGrid();
    });
    await drag([1, 0], [4, 1]);
    const r = await page.evaluate(() => ({ a: crGrid[4][1], b: crGrid[5][2], oldA: crGrid[1][0], oldB: crGrid[2][1], stay: crGrid[3][0] && crGrid[3][0].type, sel: [...crSel].sort().join(' ') }));
    ok(r.a && r.b && r.oldA === null && r.oldB === null, 'dragging one selected note carries the whole selection');
    ok(r.stay === 'dtap', 'and leaves the rest alone');
    ok(r.sel === '4,1 5,2', 'the selection follows (' + r.sel + ')');
    await page.evaluate(() => { crSel = new Set(['4,1', '5,2']); buildGrid(); });
    const a = await pos(4, 1), z = await pos(4, 3);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(z.x, z.y, { steps: 4 });
    await page.mouse.up();
    const r2 = await page.evaluate(() => ({ a: !!crGrid[4][1], moved: !!crGrid[5][4] || !!crGrid[4][3] }));
    ok(r2.a && !r2.moved, 'if any note of a group would leave the grid, none moves');
  }

  console.log('== holds move as one piece ==');
  {
    await page.evaluate(() => { fresh(); crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0, hold: 3 }; crGrid[10][1] = { type: 'tap', freq: 329.63, sustain: 0 }; setTool('move'); });
    await drag([3, 0], [7, 1]);
    const r = await page.evaluate(() => ({ head: crGrid[5][1], old: crGrid[1][0], bodies: document.querySelectorAll('#cr-grid .is-hold-body').length }));
    ok(r.head && r.head.hold === 3 && r.old === null, 'dragging a hold by its body moves the head and keeps its length');
    ok(r.bodies === 3, 'and the body is drawn in the new place');
    await page.evaluate(() => { crGrid[5][1].hold = 3; buildGrid(); });
    await drag([5, 1], [8, 1]);
    const r2 = await page.evaluate(() => crGrid[8][1]);
    ok(r2 && r2.hold === 1, 'moved next to another note in its lane it is shortened to fit (' + (r2 && r2.hold) + ')');
  }

  console.log('== placing a note plays it ==');
  {
    await page.waitForTimeout(150);
    await page.evaluate(() => { fresh(); spyAudio(); crInstrument = 'violin'; setTool('tap'); });
    const a = await pos(2, 2);
    await page.mouse.click(a.x, a.y);
    let plays = await page.evaluate(() => __plays.slice());
    ok(plays.length === 1 && Math.abs(plays[0].f - 392) < 0.01 && plays[0].i === 'violin', 'clicking a cell plays that cell\'s pitch with the level\'s voice (' + JSON.stringify(plays) + ')');
    await page.waitForTimeout(100);
    await page.evaluate(() => { __plays.length = 0; setTool('dtap'); });
    const b2 = await pos(3, 0);
    await page.mouse.click(b2.x, b2.y);
    plays = await page.evaluate(() => __plays.slice());
    ok(plays.length === 1 && plays[0].d === true, 'a double plays as a double');
    await page.waitForTimeout(100);
    await page.evaluate(() => { __plays.length = 0; });
    await page.keyboard.press('KeyD');
    plays = await page.evaluate(() => __plays.slice());
    ok(plays.length === 1, 'typing a note plays it once');
    await page.waitForTimeout(100);
    await page.evaluate(() => { __plays.length = 0; });
    await page.keyboard.press('KeyD');
    plays = await page.evaluate(() => __plays.slice());
    ok(plays.length === 0, 'and removing it is silent');
  }

  console.log('== moving, editing and picking pitches play ==');
  {
    await page.evaluate(() => { fresh(); spyAudio(); crInstrument = 'piano'; crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0 }; setTool('move'); });
    await page.evaluate(() => { __plays.length = 0; });
    await drag([1, 0], [4, 3], 8);
    const plays = await page.evaluate(() => __plays.map(p => p.f));
    ok(plays.length >= 1 && plays.length <= 4, 'dragging a note across lanes plays as it goes, not on every pixel (' + plays.length + ' sounds)');
    ok(Math.abs(plays[plays.length - 1] - 523.25) < 0.01, 'ending on the pitch it lands with (' + plays[plays.length - 1] + ')');
    await page.waitForTimeout(120);
    await page.evaluate(() => { __plays.length = 0; crGestureEnd = 0; setTool('tap'); cellEl(4, 3).click(); });
    await page.waitForTimeout(80);
    await page.evaluate(() => { __plays.length = 0; });
    const r = await page.evaluate(async () => {
      const chip = [...document.querySelectorAll('.cr-cell-editor .cce-btn')].find(b => b.textContent === '×2');
      chip.click();
      const first = __plays.length ? __plays[__plays.length - 1] : null;
      await new Promise(r => setTimeout(r, 100));
      __plays.length = 0;
      const open = id => document.querySelector('.cr-cell-editor [data-sec="' + id + '"] .cce-sum').click();
      open('note');
      const a = [...document.querySelectorAll('.cr-cell-editor .cce-pick')][0];
      [...a.children].find(b => b.textContent === 'A').click();
      return { first, afterPick: __plays.slice(), freq: crGrid[4][3].freq };
    });
    ok(r.first && r.first.d === true, 'switching a note to a double in the editor plays it');
    ok(r.afterPick.length >= 1 && Math.abs(r.afterPick[r.afterPick.length - 1].f - r.freq) < 0.01, 'choosing a pitch in the picker plays the pitch you chose (' + r.freq + ')');
    await page.evaluate(() => { document.querySelectorAll('.cr-cell-editor, #note-picker-modal').forEach(e => e.remove()); });
  }

  console.log('== undo and redo ==');
  {
    const r = await page.evaluate(async () => {
      fresh();
      const out = {};
      out.cantYet = document.getElementById('cr-undo').disabled;
      setTool('tap');
      cellEl(1, 0).click();
      await new Promise(r => setTimeout(r, 380));
      cellEl(2, 1).click();
      out.two = crGrid.flat().filter(Boolean).length;
      out.canUndo = !document.getElementById('cr-undo').disabled;
      crUndo();
      out.afterUndo = crGrid.flat().filter(Boolean).length;
      out.redoOn = !document.getElementById('cr-redo').disabled;
      crUndo();
      out.afterTwo = crGrid.flat().filter(Boolean).length;
      crRedo();
      out.afterRedo = crGrid.flat().filter(Boolean).length;
      cellEl(5, 3).click();
      out.redoCleared = document.getElementById('cr-redo').disabled;
      return out;
    });
    ok(r.cantYet, 'there is nothing to undo in a fresh level');
    ok(r.two === 2 && r.canUndo, 'placing notes enables Undo ' + JSON.stringify(r));
    ok(r.afterUndo === 1 && r.afterTwo === 0, 'undo takes them back one at a time');
    ok(r.redoOn && r.afterRedo === 1, 'redo puts one back');
    ok(r.redoCleared, 'a new edit clears the redo list');
  }

  console.log('== undo covers moves, holds, erasing and lane changes ==');
  {
    await page.evaluate(() => { fresh(); crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0 }; setTool('move'); buildGrid(); });
    await drag([1, 0], [6, 1]);
    let r = await page.evaluate(() => { const moved = !!crGrid[6][1]; crUndo(); return { moved, back: !!crGrid[1][0] && !crGrid[6][1] }; });
    ok(r.moved && r.back, 'a drag is one undo step');
    await page.evaluate(() => { fresh(); setTool('hold'); });
    const a = await pos(1, 1);
    const z = await pos(6, 1);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(z.x, z.y, { steps: 6 });
    await page.mouse.up();
    r = await page.evaluate(() => { const len = crGrid[1][1] && crGrid[1][1].hold; crUndo(); return { len, gone: crGrid[1][1] === null, undoLeft: crHist.undo.length }; });
    ok(r.len === 5 && r.gone && r.undoLeft === 0, 'placing and stretching a hold is one step ' + JSON.stringify(r));
    r = await page.evaluate(async () => {
      fresh();
      setTool('tap');
      crGrid[2][2] = { type: 'tap', freq: 392, sustain: 0 }; buildGrid();
      setTool('erase');
      cellEl(2, 2).click();
      const erased = crGrid[2][2] === null;
      crUndo();
      const back = !!crGrid[2][2];
      setCreatorLanes(6);
      const six = crLanes;
      crUndo();
      return { erased, back, six, lanes: crLanes, width: crGrid[0].length, freqs: crLaneFreqs.length };
    });
    ok(r.erased && r.back, 'erasing can be undone');
    ok(r.six === 6 && r.lanes === 4 && r.width === 4 && r.freqs === 4, 'and so can a change of lane count');
    const key = await page.evaluate(async () => {
      fresh();
      setTool('tap');
      crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0 }; buildGrid();
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, bubbles: true }));
      const undone = crGrid[1][0] === null;
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: true, bubbles: true }));
      const redone = !!crGrid[1][0];
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY', ctrlKey: true, bubbles: true }));
      return { undone, redone, again: !!crGrid[1][0] };
    });
    ok(key.undone && key.redone && key.again, 'Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y work from the keyboard');
  }

  console.log('== per-note instruments ==');
  {
    const r = await page.evaluate(async () => {
      fresh();
      crInstrument = 'piano';
      setTool('tap');
      document.getElementById('adv-toggle').click();
      await new Promise(r => setTimeout(r, 300));
      const chips = [...document.querySelectorAll('#adv-noteinst-row button')];
      const out = { chips: chips.map(b => b.textContent) };
      chips.find(b => b.textContent === 'Flute').click();
      cellEl(1, 0).click();
      out.placed = crGrid[1][0].inst;
      chips.find(b => b.textContent === 'Level').click();
      document.querySelectorAll('#adv-noteinst-row button')[0].click();
      cellEl(2, 1).click();
      out.level = crGrid[2][1].inst;
      out.dot = document.querySelectorAll('#cr-grid .has-inst').length;
      out.tag = cellEl(1, 0).querySelector('.cr-cell-note') && cellEl(1, 0).querySelector('.cr-cell-note').textContent;
      out.title = cellEl(1, 0).title;
      setTool('select');
      cellEl(1, 0).click(); cellEl(2, 1).click();
      [...document.querySelectorAll('#adv-noteinst-row button')].find(b => b.textContent === 'Violin').click();
      out.both = [crGrid[1][0].inst, crGrid[2][1].inst];
      out.hint = document.getElementById('adv-noteinst-hint').textContent;
      [...document.querySelectorAll('#adv-noteinst-row button')].find(b => b.textContent === 'Level').click();
      out.cleared = [crGrid[1][0].inst, crGrid[2][1].inst];
      setTool('tap');
      return out;
    });
    ok(r.chips.length === 12 && r.chips[0] === 'Level', 'the Advanced panel offers every instrument, plus the level\'s own (' + r.chips.length + ')');
    ok(r.placed === 'flute', 'notes placed after picking Flute are Flute notes');
    ok(r.level === undefined, 'and picking Level goes back to the level voice');
    ok(r.dot === 1 && /Fl/.test(r.tag || '') && r.title === 'Flute', 'a note with its own instrument is marked, named and tagged (' + r.tag + ')');
    ok(r.both.join() === 'violin,violin', 'with notes selected, a pick is applied to all of them');
    ok(/2 selected/.test(r.hint), 'and says so (' + r.hint + ')');
    ok(r.cleared.join() === ',' || (r.cleared[0] === undefined && r.cleared[1] === undefined), 'Level on a selection removes their own instrument');
    const e = await page.evaluate(async () => {
      document.getElementById('adv-toggle').click();
      fresh();
      crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0 }; buildGrid();
      cellEl(1, 0).click();
      const open = id => document.querySelector('.cr-cell-editor [data-sec="' + id + '"] .cce-sum').click();
      open('inst');
      const row = document.querySelector('.cr-cell-editor .cce-insts');
      const chips = [...row.children].map(b => b.textContent);
      [...row.children].find(b => b.textContent === 'Harp').click();
      const first = crGrid[1][0].inst;
      [...document.querySelector('.cr-cell-editor .cce-insts').children].find(b => b.textContent === 'Level').click();
      const second = crGrid[1][0].inst;
      document.querySelectorAll('.cr-cell-editor').forEach(x => x.remove());
      return { chips, first, second };
    });
    ok(e.chips.length === 12 && e.first === 'harp' && e.second === undefined, 'the cell editor sets one note\'s instrument and clears it again');
    const q = await page.evaluate(() => {
      fresh();
      crInstrument = 'cello';
      crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0, inst: 'flute' };
      crGrid[2][1] = { type: 'dtap', freq: 329.63, sustain: 0 };
      document.getElementById('cr-name').value = 'mixed';
      document.getElementById('cr-save').click();
      const saved = store.load().pop();
      const code = RD_Codec.encodeLevel(saved);
      const back = RD_Codec.decodeLevel(code);
      launchLevel(saved);
      const q = buildQueue(saved);
      showScreen('home');
      return { level: saved.instrument, cells: [saved.grid[1][0].inst, saved.grid[2][1].inst], back: [back.instrument, back.grid[1][0].inst, back.grid[2][1].inst], queue: q.map(n => n.inst) };
    });
    ok(q.level === 'cello' && q.cells.join() === 'flute,', 'a saved level keeps its voice and its notes\' own voices');
    ok(q.back.join() === 'cello,flute,', 'and so does its share code ' + JSON.stringify(q));
    ok(q.queue.join() === 'flute,cello', 'in play, a note\'s own voice wins over the level\'s (' + q.queue + ')');
  }

  console.log('== the cell editor no longer loses a note\'s other fields ==');
  {
    const r = await page.evaluate(() => {
      fresh();
      crGrid[1][0] = { type: 'tap', freq: 261.63, sustain: 0, inst: 'cello', hold: 2 };
      buildGrid();
      cellEl(1, 0).click();
      const open = id => document.querySelector('.cr-cell-editor [data-sec="' + id + '"] .cce-sum').click();
      open('sus');
      const sus = document.querySelector('.cr-cell-editor .cce-susrow');
      [...sus.children].find(b => b.textContent === '1').click();
      const c = crGrid[1][0];
      document.querySelectorAll('.cr-cell-editor').forEach(x => x.remove());
      return { sustain: c.sustain, inst: c.inst, hold: c.hold };
    });
    ok(r.sustain === 1 && r.inst === 'cello' && r.hold === 2, 'changing the sustain keeps the instrument and the hold');
  }

  console.log('== imports are sanitised ==');
  {
    const r = await page.evaluate(() => {
      const lvl = { name: 'odd', bpm: 120, grid: [[{ type: 'tap', freq: 440 }, { type: 'nope' }, null], 'junk', [null, { type: 'dtap', freq: 330 }, null, null, null, null, null], []], laneFreqs: [261.63, 329.63, 392, 523.25] };
      sanitizeImportedGrid(lvl);
      return { widths: lvl.grid.map(r => r.length), cells: lvl.grid.flat().filter(Boolean).length, lanes: lvl.lanes, freqs: lvl.laneFreqs.length };
    });
    ok(r.widths.every(w => w === 4) && r.lanes === 4, 'every imported row is made as wide as the level (' + r.widths + ')');
    ok(r.cells === 2, 'unknown note types and malformed rows are dropped, real ones kept (' + r.cells + ')');
    const t = await page.evaluate(() => { try { sanitizeImportedGrid({ grid: [] }); return 'accepted'; } catch (e) { return 'refused'; } });
    ok(t === 'refused', 'an empty chart is refused');
  }

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n' + (fail ? `v8move: ${fail} of ${pass + fail} probes FAILED` : `v8move: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
