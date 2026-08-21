// Creator multi-select: drag a rectangle, then cut / copy / paste,
// scoped to the level being edited.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  copySelection, deleteSelection, armPaste, cancelPaste, commitPaste,
  clearSelection, paintSelection, updateClipButtons, buildGrid, inSel,
  cellType, cellFreq, cellSustain,
  get crGrid(){return crGrid}, set crGrid(v){crGrid=v},
  get crSel(){return crSel}, set crSel(v){crSel=v},
  get crClip(){return crClip}, set crClip(v){crClip=v},
  get crPasting(){return crPasting}, set crPasting(v){crPasting=v},
  get crHover(){return crHover}, set crHover(v){crHover=v},
};`;
const { window, D, notes, probe, report, T } = boot({ hook: HOOK });

const tap = f => ({ type: 'tap', freq: f, sustain: 0 });
const dtap = f => ({ type: 'dtap', freq: f, sustain: 0.5 });

function freshGrid() {
  const g = Array.from({ length: 16 }, () => [null, null, null, null]);
  g[2][0] = tap(261.63); g[2][1] = dtap(329.63);
  g[3][1] = tap(392.00); g[4][0] = tap(523.25);
  T().crGrid = g;
  T().crClip = null;
  T().clearSelection();
  return g;
}

const countNotes = g => g.flat().filter(Boolean).length;

probe('a selection covers exactly the rectangle it names', () => {
  freshGrid();
  T().crSel = { r0: 2, c0: 0, r1: 4, c1: 1 };
  const inside = [], outside = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) (T().inSel(r, c) ? inside : outside).push(r + ',' + c);
  notes.push(`selection 2,0-4,1 covers ${inside.length} cells`);
  if (inside.length !== 6) throw new Error('covers ' + inside.length + ' cells, expected 6');
  if (T().inSel(1, 0) || T().inSel(5, 0) || T().inSel(2, 2)) throw new Error('the selection leaks outside its rectangle');
});

probe('copy takes the cells and leaves the chart alone', () => {
  const g = freshGrid();
  const before = countNotes(g);
  T().crSel = { r0: 2, c0: 0, r1: 4, c1: 1 };
  if (!T().copySelection(false)) throw new Error('copy returned false');
  const clip = T().crClip;
  notes.push(`copied ${clip.h}x${clip.w}, ${clip.cells.flat().filter(Boolean).length} notes`);
  if (clip.h !== 3 || clip.w !== 2) throw new Error(`clipboard is ${clip.h}x${clip.w}`);
  if (countNotes(T().crGrid) !== before) throw new Error('copy changed the chart');
});

probe('the clipboard holds copies, not references', () => {
  freshGrid();
  T().crSel = { r0: 2, c0: 0, r1: 2, c1: 1 };
  T().copySelection(false);
  T().crGrid[2][0].freq = 111;
  if (T().crClip.cells[0][0].freq === 111) throw new Error('editing the chart mutated the clipboard');
});

probe('cut takes the cells and clears them', () => {
  const g = freshGrid();
  const before = countNotes(g);
  T().crSel = { r0: 2, c0: 0, r1: 2, c1: 1 };
  T().copySelection(true);
  const after = countNotes(T().crGrid);
  notes.push(`cut 1x2: ${before} notes -> ${after}`);
  if (after !== before - 2) throw new Error(`${before} -> ${after}`);
  if (!T().crClip || T().crClip.cells.flat().filter(Boolean).length !== 2) throw new Error('cut did not fill the clipboard');
});

probe('paste drops the block anchored at its first cell', () => {
  freshGrid();
  T().crSel = { r0: 2, c0: 0, r1: 3, c1: 1 };
  T().copySelection(false);
  T().commitPaste(9, 2);
  const g = T().crGrid;
  const src = [[g[2][0], g[2][1]], [g[3][0], g[3][1]]];
  const dst = [[g[9][2], g[9][3]], [g[10][2], g[10][3]]];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const a = src[r][c], b = dst[r][c];
    if (!a !== !b) throw new Error(`cell ${r},${c} differs in occupancy after paste`);
    if (a && (a.type !== b.type || Math.abs(a.freq - b.freq) > 1e-6 || a.sustain !== b.sustain))
      throw new Error(`cell ${r},${c} did not paste faithfully`);
  }
  notes.push('pasted block matches the source in type, pitch and sustain');
});

probe('paste keeps every field, including sustain', () => {
  freshGrid();
  T().crSel = { r0: 2, c0: 1, r1: 2, c1: 1 };   // the dtap with sustain .5
  T().copySelection(false);
  T().commitPaste(12, 3);
  const p = T().crGrid[12][3];
  if (!p || p.type !== 'dtap' || p.sustain !== 0.5) throw new Error('pasted as ' + JSON.stringify(p));
});

probe('paste clamps to the four lanes rather than dropping notes', () => {
  freshGrid();
  T().crSel = { r0: 2, c0: 0, r1: 2, c1: 1 };  // 1x2
  T().copySelection(false);
  T().commitPaste(8, 3);                        // would need lanes 3 and 4
  const g = T().crGrid;
  const landed = [g[8][0], g[8][1], g[8][2], g[8][3]].filter(Boolean).length;
  notes.push('a 1x2 block pasted at lane 3 landed ' + landed + ' notes');
  if (landed !== 2) throw new Error('clamping lost a note: ' + landed + ' landed');
});

probe('pasting past the end grows the chart instead of truncating', () => {
  freshGrid();
  const rows = T().crGrid.length;
  T().crSel = { r0: 2, c0: 0, r1: 4, c1: 0 };   // 3 rows
  T().copySelection(false);
  T().commitPaste(rows - 1, 0);
  notes.push(`chart grew ${rows} -> ${T().crGrid.length} rows to fit the paste`);
  if (T().crGrid.length < rows + 2) throw new Error('the chart did not grow: ' + T().crGrid.length);
  if (!T().crGrid[rows + 1]) throw new Error('a grown row is missing');
  if (T().crGrid.slice(rows).some(r => r.length !== 4)) throw new Error('a grown row is not four lanes wide');
});

probe('paste leaves the block selected, so it can be moved again', () => {
  freshGrid();
  T().crSel = { r0: 2, c0: 0, r1: 3, c1: 1 };
  T().copySelection(false);
  T().commitPaste(9, 1);
  const s = T().crSel;
  if (!s) throw new Error('nothing is selected after a paste');
  if (s.r0 !== 9 || s.c0 !== 1 || s.r1 !== 10 || s.c1 !== 2)
    throw new Error('selection after paste is ' + JSON.stringify(s));
});

probe('delete clears the selection without touching the clipboard', () => {
  const g = freshGrid();
  const before = countNotes(g);
  T().crSel = { r0: 2, c0: 0, r1: 2, c1: 1 };
  T().copySelection(false);
  const clip = T().crClip;
  T().crSel = { r0: 3, c0: 0, r1: 4, c1: 1 };
  T().deleteSelection();
  if (T().crClip !== clip) throw new Error('delete overwrote the clipboard');
  if (countNotes(T().crGrid) !== before - 2) throw new Error('delete removed the wrong number of notes');
});

probe('arming a paste clears the selection and shows the ghost', () => {
  freshGrid();
  T().crSel = { r0: 2, c0: 0, r1: 2, c1: 1 };
  T().copySelection(false);
  T().armPaste();
  if (T().crSel) throw new Error('the old selection survived arming');
  if (!T().crPasting) throw new Error('paste is not armed');
  T().cancelPaste();
  if (T().crPasting) throw new Error('cancel did not disarm');
});

probe('paste with an empty clipboard is a no-op, not a crash', () => {
  freshGrid();
  T().crClip = null;
  T().armPaste();
  if (T().crPasting) throw new Error('armed a paste with nothing to paste');
  T().commitPaste(3, 0);   // must not throw
});

probe('the toolbar buttons follow what is actually possible', () => {
  freshGrid();
  T().crSel = null; T().crClip = null;
  T().updateClipButtons();
  const cut = D.getElementById('cr-cut'), paste = D.getElementById('cr-paste');
  if (cut && !cut.disabled) throw new Error('cut is enabled with nothing selected');
  if (paste && !paste.disabled) throw new Error('paste is enabled with an empty clipboard');
  T().crSel = { r0: 0, c0: 0, r1: 1, c1: 1 };
  T().updateClipButtons();
  if (cut && cut.disabled) throw new Error('cut is disabled with a live selection');
});

probe('the selection is scoped to the chart being edited', () => {
  // A selection that outlived the level would paste into the next one.
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/clearSelection\(\)/.test(src)) throw new Error('nothing ever clears the selection');
  const calls = (src.match(/clearSelection\(\)/g) || []).length;
  notes.push('clearSelection() called from ' + calls + ' places');
  if (calls < 2) throw new Error('the selection is only cleared once — it can outlive a level');
});

report('selecttest');
