// ═══════════════════════════════════════════
//  RhythmDrop V8 — creator.js
//
//  The level creator and its note picker: the editing grid, the
//  two-stage cell editor, the advanced panel (instrument, sustain,
//  per-lane pitches, bass line) and the in-creator generation menu.
//
//  Split out of game.js — a plain (non-module) script sharing the same
//  global scope as game.js/play.js. It calls the shell's helpers
//  (showToast, store, showScreen, GEN(), …) at runtime, so load order
//  only requires that every script is present before any handler fires;
//  popup.html loads this before game.js, which keeps the boot code last.
// ═══════════════════════════════════════════

// ══════════════════════════════════════
//  CREATOR
// ══════════════════════════════════════

// ── Note helpers ─────────────────────────
// Use the chromatic table from audio.js (RD_NOTE_TABLE / RD_NOTE_NAMES)
// Fallback if audio.js not yet loaded
function getNoteNames() {
  return window.RD_NOTE_NAMES || ['C4','D4','E4','G4','A4','C5'];
}
function freqToName(freq) {
  if (window.RD_freqToName) return window.RD_freqToName(freq);
  return freq.toFixed(2) + ' Hz';
}
function nameToFreq(name) {
  if (window.RD_nameToFreq) return window.RD_nameToFreq(name) || 261.63;
  return 261.63;
}

// ── Creator state ─────────────────────────
let editIdx    = null;
let crGrid     = [];
let crTool     = 'tap';
let crAdvOpen  = false;
let crBgMode   = 'none';
let crLaneFreqs = [261.63,329.63,392.00,523.25];
let crBassSteps = [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
let _bassPickerFreq = 65.41;

// ── Keyboard entry + multi-select state ───
// The play keys (A S D F) place notes at a row cursor, so a chart can be
// typed as fast as it is played. Select mode gathers a set of cells you
// can copy, cut, paste, nudge or delete as a block.
let crCursor = 0;                 // row the play keys write to
let crSel    = new Set();         // selected cells, keyed "row,lane"
let crClip   = null;              // copied block: [{ dr, dc, cell }]
const selKey   = (r, c) => r + ',' + c;
const parseKey = k => k.split(',').map(Number);

// True while the creator screen is the one on show — the global key
// handler in game.js asks this before treating a keystroke as an edit.
function creatorActive() {
  const el = document.getElementById('creator');
  return !!(el && el.classList.contains('active'));
}

function openCreator(idx) {
  crCursor = 0;
  crSel.clear();
  editIdx = idx;
  const customs = store.load();
  if (idx !== null && customs[idx]) {
    const l = customs[idx];
    document.getElementById('cr-name').value = l.name || '';
    document.getElementById('cr-bpm').value  = l.bpm  || 120;
    document.getElementById('cr-diff').value = l.diff || 'medium';
    crGrid = l.grid.map(r => r.map(cell => {
      if (!cell) return null;
      if (typeof cell === 'string') return { type: cell, freq: null };
      return { ...cell };
    }));
    crBgMode    = l.bgMode    || 'none';
    crLaneFreqs = l.laneFreqs ? [...l.laneFreqs] : [261.63,329.63,392.00,523.25];
    crAdvOpen   = false;
    crBassSteps = l.bassSteps
      ? l.bassSteps.map(s => ({ ...s }))
      : [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
    while (crGrid.length < 8) crGrid.push([null,null,null,null]);
  } else {
    document.getElementById('cr-name').value = '';
    document.getElementById('cr-bpm').value  = 120;
    document.getElementById('cr-diff').value = 'medium';
    crGrid      = Array.from({ length:16 }, () => [null,null,null,null]);
    crBgMode    = 'none';
    crLaneFreqs = [261.63,329.63,392.00,523.25];
    crAdvOpen   = false;
    crBassSteps = [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
  }
  setTool('tap');
  buildGrid();
  buildAdvPanel();
  document.getElementById('adv-panel').classList.remove('open');

  // Export button for existing levels
  const existingExpBtn = document.getElementById('cr-export-btn');
  if (existingExpBtn) existingExpBtn.remove();
  if (editIdx !== null) {
    const expBtn = document.createElement('button');
    expBtn.id = 'cr-export-btn';
    expBtn.style.cssText = 'flex:0 0 auto;font-size:11px;font-weight:700;padding:6px 11px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--muted);cursor:pointer;font-family:var(--font-body);white-space:nowrap;';
    expBtn.textContent = '⬆ Export';
    expBtn.addEventListener('click', () => {
      const arr = store.load();
      if (arr[editIdx]) exportLevel(arr[editIdx]);
    });
    document.querySelector('.cr-header').insertBefore(expBtn, document.getElementById('cr-save'));
  }
  showScreen('creator');
}

const TOOL_CLASS = { tap:' at', dtap:' ad', erase:' ae', select:' as' };
function setTool(t) {
  crTool = t;
  ['tap','dtap','erase','select'].forEach(x => {
    const b = document.getElementById('t-' + x);
    if (b) b.className = 'tool-btn' + (x === t ? TOOL_CLASS[x] : '');
  });
  const bar = document.getElementById('cr-selbar');
  if (bar) bar.classList.toggle('show', t === 'select');
  if (t !== 'select' && crSel.size) crSel.clear();
  if (document.getElementById('cr-grid')) buildGrid();
}
document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

// ── Keyboard note entry ───────────────────
// Move the write cursor, growing the chart when it runs off the end.
function moveCursor(d) {
  crCursor = Math.max(0, crCursor + d);
  while (crCursor >= crGrid.length) crGrid.push([null, null, null, null]);
  buildGrid();
}
// Toggle a note in a lane at the cursor row, using the active tap/dtap
// tool. Typing a lane key again clears it.
function typeNoteAtCursor(lane) {
  if (lane < 0 || lane > 3) return;
  while (crCursor >= crGrid.length) crGrid.push([null, null, null, null]);
  if (cellType(crGrid[crCursor][lane])) {
    crGrid[crCursor][lane] = null;
  } else {
    crGrid[crCursor][lane] = { type: crTool === 'dtap' ? 'dtap' : 'tap',
                               freq: crLaneFreqs[lane], sustain: crDefaultSustain };
  }
  buildGrid();
  if (editIdx !== null) autoSave();
}

// ── Multi-select: copy / cut / paste / move / delete ──
function selBounds() {
  let minR = Infinity, minC = Infinity;
  crSel.forEach(k => { const [r, c] = parseKey(k); if (r < minR) minR = r; if (c < minC) minC = c; });
  return { minR, minC };
}
function selCopy() {
  if (!crSel.size) { showToast('Select notes first', true); return; }
  const { minR, minC } = selBounds();
  const items = [];
  crSel.forEach(k => {
    const [r, c] = parseKey(k);
    const cell = crGrid[r] && crGrid[r][c];
    if (cell) items.push({ dr: r - minR, dc: c - minC, cell: { ...cell } });
  });
  crClip = items;
  showToast(items.length ? 'Copied ' + items.length : 'No notes in selection', !items.length);
}
function selDelete(toast) {
  if (!crSel.size) return;
  crSel.forEach(k => { const [r, c] = parseKey(k); if (crGrid[r]) crGrid[r][c] = null; });
  crSel.clear();
  buildGrid();
  if (editIdx !== null) autoSave();
  if (toast !== false) showToast('Deleted');
}
function selCut() {
  if (!crSel.size) { showToast('Select notes first', true); return; }
  selCopy();
  selDelete(false);
}
function selPaste() {
  if (!crClip || !crClip.length) { showToast('Clipboard empty', true); return; }
  // Anchor the block at the selection's top-left, or — with nothing
  // selected — at the cursor row in lane 1.
  let anchorR, anchorC;
  if (crSel.size) { const b = selBounds(); anchorR = b.minR; anchorC = b.minC; }
  else { anchorR = crCursor; anchorC = 0; }
  const next = new Set();
  crClip.forEach(it => {
    const r = anchorR + it.dr, c = anchorC + it.dc;
    if (c < 0 || c > 3) return;              // never wrap past the four lanes
    while (r >= crGrid.length) crGrid.push([null, null, null, null]);
    crGrid[r][c] = { ...it.cell };
    next.add(selKey(r, c));
  });
  crSel = next;
  buildGrid();
  if (editIdx !== null) autoSave();
  showToast('Pasted ' + next.size);
}
// Nudge the whole selection by (dr, dc). Blocked if any cell would fall
// outside the four lanes or above row 0; overwrites whatever it lands on.
function selMove(dr, dc) {
  if (!crSel.size) return;
  const moves = [];
  let inRange = true;
  crSel.forEach(k => {
    const [r, c] = parseKey(k);
    const nr = r + dr, nc = c + dc;
    if (nc < 0 || nc > 3 || nr < 0) inRange = false;
    moves.push({ r, c, nr, nc });
  });
  if (!inRange) return;
  const picked = moves.map(m => ({ nr: m.nr, nc: m.nc, cell: crGrid[m.r][m.c] ? { ...crGrid[m.r][m.c] } : null }));
  moves.forEach(m => { crGrid[m.r][m.c] = null; });
  const next = new Set();
  picked.forEach(p => {
    while (p.nr >= crGrid.length) crGrid.push([null, null, null, null]);
    crGrid[p.nr][p.nc] = p.cell;
    next.add(selKey(p.nr, p.nc));
  });
  crSel = next;
  crCursor = Math.max(0, Math.min(crGrid.length - 1, crCursor + dr));
  buildGrid();
  if (editIdx !== null) autoSave();
}

// The one entry point the global key handler calls while the creator is
// on screen. Returns true when it consumed the key.
function handleCreatorKey(e, keyMap) {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.code === 'KeyC' || e.code === 'KeyX' || e.code === 'KeyV')) {
    e.preventDefault();
    if (e.code === 'KeyC') selCopy(); else if (e.code === 'KeyX') selCut(); else selPaste();
    return true;
  }
  if ((e.code === 'Delete' || e.code === 'Backspace') && crSel.size) { e.preventDefault(); selDelete(); return true; }
  if (e.code === 'Escape' && crSel.size) { e.preventDefault(); crSel.clear(); buildGrid(); return true; }

  const ARROWS = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  if (ARROWS[e.code]) {
    const [dr, dc] = ARROWS[e.code];
    e.preventDefault();
    if (crTool === 'select' && crSel.size) selMove(dr, dc);   // nudge the block
    else if (dc === 0) moveCursor(dr);                        // else walk the cursor
    return true;
  }
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); moveCursor(1); return true; }

  if (e.code in keyMap) {
    e.preventDefault();
    const lane = keyMap[e.code];
    typeNoteAtCursor(lane);
    if (window.RD_playNote) window.RD_playNote(lane, false, crLaneFreqs[lane] || 261.63);
    return true;
  }
  return false;
}

// ── Selection action bar ──────────────────
(function wireSelBar() {
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  bind('sel-copy',  selCopy);
  bind('sel-cut',   selCut);
  bind('sel-paste', selPaste);
  bind('sel-del',   () => selDelete());
  bind('sel-clear', () => { crSel.clear(); buildGrid(); });
  bind('sel-up',    () => selMove(-1, 0));
  bind('sel-down',  () => selMove(1, 0));
  bind('sel-left',  () => selMove(0, -1));
  bind('sel-right', () => selMove(0, 1));
})();

// ── Advanced panel: opens sideways, and takes its space from a wider
//    window rather than from the grid ──
//
//  Asking for the space is the whole point: the chart you are editing
//  must not move or shrink because you opened a settings panel. If the
//  window has nowhere left to grow — already at the popup's width cap —
//  the panel floats over the grid instead, which is at least usable.
const ADV_PANEL_W = 360;   // wider, so the generation menu has room
const ADV_PANEL_MIN = 170;   // a sliver of panel is worse than none

function openAdvPanel() {
  const room = Math.max(0, getMaxDims().maxW - currentSettings.width);
  const grow = Math.min(ADV_PANEL_W, room);
  if (grow >= ADV_PANEL_MIN) {
    advExpansion = grow;
    document.body.classList.remove('adv-overlay');
    document.documentElement.style.setProperty('--adv-w', grow + 'px');
  } else {
    // No room to widen: overlay, sized to leave the grid readable.
    advExpansion = 0;
    document.body.classList.add('adv-overlay');
    document.documentElement.style.setProperty('--adv-w',
      Math.max(ADV_PANEL_MIN, Math.min(ADV_PANEL_W, currentSettings.width - 120)) + 'px');
  }
  applySettingsToDOM();
}

function closeAdvPanel() {
  advExpansion = 0;
  document.body.classList.remove('adv-overlay');
  applySettingsToDOM();
}

document.getElementById('adv-toggle').addEventListener('click', () => {
  crAdvOpen = !crAdvOpen;
  if (crAdvOpen) openAdvPanel(); else closeAdvPanel();
  document.getElementById('adv-panel').classList.toggle('open', crAdvOpen);
  // Open on the Settings pane each time, with Generate a tap away.
  document.querySelectorAll('.adv-mode').forEach(b => b.classList.toggle('sel', b.dataset.mode === 'settings'));
  const setPane = document.getElementById('adv-settings');
  const genPane = document.getElementById('adv-generate');
  if (setPane) setPane.classList.add('show');
  if (genPane) genPane.classList.remove('show');
  buildAdvPanel();
  buildGrid();
});

// ── Helpers ───────────────────────────────
function cellType(cell) {
  if (!cell) return null;
  return typeof cell === 'string' ? cell : cell.type;
}
function cellFreq(cell, lane) {
  if (!cell) return crLaneFreqs[lane];
  if (typeof cell === 'string') return crLaneFreqs[lane];
  return cell.freq || crLaneFreqs[lane];
}
function cellSustain(cell) {
  if (!cell || typeof cell === 'string') return 0;
  return cell.sustain || 0;
}

// ── Grid builder ──────────────────────────
// In advanced mode: filled cells show a note-name badge.
// Clicking that badge opens the note picker (no separate button).
// Clicking the type badge toggles tap ↔ dtap.
// ✕ erases the cell.
function buildGrid() {
  const adv = crAdvOpen;
  const g   = document.getElementById('cr-grid');
  g.innerHTML = '';

  // Header row
  const blank = document.createElement('div'); g.appendChild(blank);
  const headerKeys = currentSettings.keys.map(code => code.startsWith('Key') ? code.slice(3) : keyCodeLabel(code));
  headerKeys.forEach(k => {
    const h = document.createElement('div');
    h.style.cssText = 'text-align:center;font-size:10px;font-weight:700;color:var(--tap);padding:2px 0;font-family:var(--font-data)';
    h.textContent = k; g.appendChild(h);
  });

  crGrid.forEach((row, ri) => {
    const lbl = document.createElement('div');
    lbl.className = 'cr-row-num' + (ri === crCursor ? ' cur' : '');
    lbl.textContent = ri + 1; g.appendChild(lbl);

    row.forEach((cell, ci) => {
      const type = cellType(cell);

      // One chip per cell in every mode. Empty: the current tool fills
      // it. Filled: the tool erases (erase tool) or the second tap opens
      // the editor. That two-stage placement is why there are no inline
      // dropdowns any more — note, type and sustain all live in the
      // popup, so a cell stays a cell.
      const el = document.createElement('div');
      el.className = 'cr-cell' + (type ? ' is-' + type : '')
        + (ri === crCursor ? ' cur' : '')
        + (crSel.has(selKey(ri, ci)) ? ' cr-cell-sel' : '');
      if (type && crAdvOpen) {
        // In advanced mode the chip carries the note name, so a chart's
        // pitches are legible at a glance without opening anything.
        el.classList.add('cr-cell-named');
        const name = document.createElement('span');
        name.className = 'cr-cell-note';
        name.textContent = freqToName(cellFreq(cell, ci));
        el.appendChild(name);
        if (cellSustain(cell) > 0) {
          const dot = document.createElement('span');
          dot.className = 'cr-cell-sus';
          dot.title = 'sustain ' + cellSustain(cell).toFixed(1) + 's';
          el.appendChild(dot);
        }
      }
      el.addEventListener('click', () => {
        crCursor = ri;
        // Select mode: a click toggles the cell in the selection, empty
        // or not, so a block can be marked out and then acted on.
        if (crTool === 'select') {
          const k = selKey(ri, ci);
          if (crSel.has(k)) crSel.delete(k); else crSel.add(k);
          buildGrid();
          return;
        }
        const cur = cellType(crGrid[ri][ci]);
        if (crTool === 'erase') { crGrid[ri][ci] = null; buildGrid(); return; }
        if (!cur) {
          // First tap: place a note at the lane's default pitch.
          crGrid[ri][ci] = { type: crTool === 'dtap' ? 'dtap' : 'tap',
                             freq: crLaneFreqs[ci], sustain: crDefaultSustain };
          buildGrid();
        } else {
          // Second tap on an existing note opens the editor.
          openCellEditor(el, ri, ci);
        }
      });
      g.appendChild(el);
    });
  });
}

// The whole note editor in one popup: type, pitch and sustain. This is
// what replaced the inline type badge, note dropdown and sustain
// dropdown that used to crowd every filled cell in advanced mode.
function openCellEditor(anchorEl, ri, ci) {
  document.querySelectorAll('.cr-cell-editor').forEach(e => e.remove());
  const cell = crGrid[ri][ci];
  if (!cell) return;

  const pop = document.createElement('div');
  pop.className = 'cr-cell-editor';

  const write = patch => {
    crGrid[ri][ci] = Object.assign({
      type: cellType(crGrid[ri][ci]) || 'tap',
      freq: cellFreq(crGrid[ri][ci], ci),
      sustain: cellSustain(crGrid[ri][ci]),
    }, patch);
    buildGrid();
    render();
  };

  function render() {
    const c = crGrid[ri][ci];
    if (!c) { pop.remove(); return; }
    pop.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'cce-head';
    head.textContent = 'Edit note';
    pop.appendChild(head);

    // Type
    const typeRow = document.createElement('div');
    typeRow.className = 'cce-row';
    [['tap', 'TAP'], ['dtap', '×2']].forEach(([t, label]) => {
      const btn = document.createElement('button');
      btn.className = 'cce-btn' + (cellType(c) === t ? ' on' : '') + (t === 'dtap' ? ' dtap' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => write({ type: t }));
      typeRow.appendChild(btn);
    });
    pop.appendChild(typeRow);

    // Pitch — the existing note picker, opened from a button.
    const pitchBtn = document.createElement('button');
    pitchBtn.className = 'cce-pitch';
    pitchBtn.textContent = '♪ ' + freqToName(cellFreq(c, ci));
    pitchBtn.addEventListener('click', () => {
      openNotePickerModal(pitchBtn, cellFreq(crGrid[ri][ci], ci), f => write({ freq: f }));
    });
    pop.appendChild(pitchBtn);

    // Sustain — chips, not a dropdown.
    const susLabel = document.createElement('div');
    susLabel.className = 'cce-sublabel';
    susLabel.textContent = 'Sustain';
    pop.appendChild(susLabel);
    const susRow = document.createElement('div');
    susRow.className = 'cce-sus';
    [[0, 'off'], [0.5, '.5'], [1, '1'], [1.5, '1.5'], [2, '2'], [2.5, '2.5'], [3, '3']].forEach(([v, label]) => {
      const btn = document.createElement('button');
      btn.className = 'cce-schip' + (Math.abs(cellSustain(c) - v) < 0.01 ? ' on' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => write({ sustain: v }));
      susRow.appendChild(btn);
    });
    pop.appendChild(susRow);

    // Erase / done
    const foot = document.createElement('div');
    foot.className = 'cce-row';
    const erase = document.createElement('button');
    erase.className = 'cce-btn erase';
    erase.textContent = '✕ Erase';
    erase.addEventListener('click', () => { crGrid[ri][ci] = null; buildGrid(); pop.remove(); });
    const done = document.createElement('button');
    done.className = 'cce-btn done';
    done.textContent = 'Done';
    done.addEventListener('click', () => pop.remove());
    foot.appendChild(erase); foot.appendChild(done);
    pop.appendChild(foot);
  }

  render();
  document.body.appendChild(pop);
  positionPopup(pop, anchorEl);

  // A tap anywhere else closes it, the same way the note picker does.
  setTimeout(() => {
    const close = ev => {
      if (pop.contains(ev.target)) return;
      if (ev.target.closest && ev.target.closest('#note-picker-modal')) return;
      pop.remove();
      document.removeEventListener('click', close, true);
    };
    document.addEventListener('click', close, true);
  }, 0);
}

// Places a popup next to its anchor, nudged back on-screen if it would
// spill off an edge.
function positionPopup(pop, anchorEl) {
  const a = anchorEl.getBoundingClientRect();
  pop.style.visibility = 'hidden';
  pop.style.left = '0px'; pop.style.top = '0px';
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = a.left, top = a.bottom + 4;
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  if (left + w > vw - 6) left = vw - w - 6;
  if (left < 6) left = 6;
  if (top + h > vh - 6) top = a.top - h - 4;
  if (top < 6) top = 6;
  pop.style.left = Math.round(left) + 'px';
  pop.style.top = Math.round(top) + 'px';
  pop.style.visibility = 'visible';
}

// Loads a freshly generated chart into the creator grid, so the
// generation menu composes something you can then edit and save —
// which is what "generate, in the creator" should mean.
let crGenBand = '3-6';
function generateIntoGrid(band) {
  const lvl = generateLevel(band || crGenBand);
  if (!lvl || !lvl.grid) { showToast('Could not generate', true); return; }
  crGrid = lvl.grid.map(r => r.map(c => (c ? { ...c } : null)));
  while (crGrid.length < 8) crGrid.push([null, null, null, null]);
  crLaneFreqs = lvl.laneFreqs ? [...lvl.laneFreqs] : [261.63, 329.63, 392.00, 523.25];
  crBgMode = lvl.bgMode || 'none';
  const nameEl = document.getElementById('cr-name');
  const bpmEl  = document.getElementById('cr-bpm');
  if (nameEl && !nameEl.value) nameEl.value = lvl.name || 'Generated';
  if (bpmEl) bpmEl.value = lvl.bpm || 120;
  if (lvl.instrument && window.RD_saveInstrument) {
    currentSettings.instrument = lvl.instrument;
    window.RD_saveInstrument(lvl.instrument);
  }
  buildAdvPanel();
  buildGrid();
  showToast('Generated ' + crGrid.length + ' beats — edit or save');
}

// The advanced panel's Settings / Generate toggle, and the generation
// menu inside it.
(function wireAdvGenerate() {
  document.querySelectorAll('.adv-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      document.querySelectorAll('.adv-mode').forEach(b => b.classList.toggle('sel', b === btn));
      const setPane = document.getElementById('adv-settings');
      const genPane = document.getElementById('adv-generate');
      if (setPane) setPane.classList.toggle('show', mode === 'settings');
      if (genPane) genPane.classList.toggle('show', mode === 'generate');
    });
  });
  document.querySelectorAll('#gen-band .gen-band-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      crGenBand = btn.dataset.band;
      document.querySelectorAll('#gen-band .gen-band-btn').forEach(b => b.classList.toggle('sel', b === btn));
    });
  });
  const into = document.getElementById('gen-into-grid');
  if (into) into.addEventListener('click', () => generateIntoGrid(crGenBand));
  const play = document.getElementById('gen-play');
  if (play) play.addEventListener('click', () => playGenerated(crGenBand));
})();

document.getElementById('cr-add-rows').addEventListener('click', () => {
  for (let i = 0; i < 4; i++) crGrid.push([null,null,null,null]);
  buildGrid();
});

document.getElementById('cr-back').addEventListener('click', () => {
  showScreen('home'); renderHome();
});

document.getElementById('cr-save').addEventListener('click', () => {
  const name        = document.getElementById('cr-name').value.trim() || 'untitled';
  const bpm         = parseInt(document.getElementById('cr-bpm').value) || 120;
  const diff        = document.getElementById('cr-diff').value;
  const bassPattern = crBassSteps.map(s => s.active ? s.freq : 0);
  const lvl = {
    id: 'c' + Date.now(), name, bpm, diff,
    grid:        crGrid.map(r => r.map(cell => cell ? { ...cell } : null)),
    bgMode:      crBgMode,
    laneFreqs:   [...crLaneFreqs],
    bassSteps:   crBassSteps.map(s => ({ ...s })),
    bassPattern
  };
  const arr = store.load();
  if (editIdx !== null && arr[editIdx]) arr[editIdx] = lvl; else arr.push(lvl);
  store.save(arr);
  document.querySelectorAll('.hnav').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
  document.querySelector('.hnav[data-tab="custom"]').classList.add('active');
  document.getElementById('tab-custom').classList.add('active');
  showScreen('home'); renderHome();
});

// ── Auto-save on note change ──────────────
function autoSave() {
  if (editIdx === null) return;
  const name        = document.getElementById('cr-name').value.trim() || 'untitled';
  const bpm         = parseInt(document.getElementById('cr-bpm').value) || 120;
  const diff        = document.getElementById('cr-diff').value;
  const bassPattern = crBassSteps.map(s => s.active ? s.freq : 0);
  const lvl = {
    id: 'c' + Date.now(), name, bpm, diff,
    grid:        crGrid.map(r => r.map(cell => cell ? { ...cell } : null)),
    bgMode:      crBgMode,
    laneFreqs:   [...crLaneFreqs],
    bassSteps:   crBassSteps.map(s => ({ ...s })),
    bassPattern
  };
  const arr = store.load();
  if (arr[editIdx]) arr[editIdx] = lvl;
  store.save(arr);
}

// ── Advanced panel ────────────────────────
let crDefaultSustain = 0; // sustain applied to newly placed cells

function buildAdvPanel() {
  buildLaneNoteGrid();
  buildBgRadio();
  buildBassEditor();
  buildAdvInstrumentRow();
  buildAdvSustainControl();
}

// Instrument picker inside advanced panel
function buildAdvInstrumentRow() {
  const row = document.getElementById('adv-instrument-row');
  if (!row) return;
  row.innerHTML = '';
  const instruments = window.RD_INSTRUMENTS || [
    { id:'synth', label:'Synth', icon:'🎛️' },
    { id:'piano', label:'Piano', icon:'🎹' },
    { id:'guitar', label:'Guitar', icon:'🎸' },
    { id:'marimba', label:'Marimba', icon:'🪘' },
    { id:'bell', label:'Bell', icon:'🔔' },
  ];
  const cur = (window.RD_getInstrument && window.RD_getInstrument()) || 'synth';
  instruments.forEach(inst => {
    const btn = document.createElement('button');
    const active = cur === inst.id;
    btn.style.cssText = [
      'padding:5px 8px;border-radius:7px;font-size:10px;font-weight:700;',
      'font-family:var(--font-body);cursor:pointer;',
      'display:flex;flex-direction:column;align-items:center;gap:1px;',
      'border:2px solid;transition:all .12s;',
      active
        ? 'border-color:var(--accent);background:rgba(255,58,110,.12);color:var(--accent);'
        : 'border-color:var(--border2);background:var(--bg3);color:var(--muted);',
    ].join('');
    btn.innerHTML = `<span style="font-size:14px">${inst.icon}</span><span>${inst.label}</span>`;
    btn.addEventListener('click', () => {
      if (window.RD_saveInstrument) window.RD_saveInstrument(inst.id);
      currentSettings.instrument = inst.id;
      store.saveSettings(currentSettings);
      buildAdvInstrumentRow();
      // Preview note
      if (window.RD_playNoteFreq) window.RD_playNoteFreq(261.63, false, 0);
    });
    row.appendChild(btn);
  });
}

// Sustain default control in advanced panel
function buildAdvSustainControl() {
  const slider = document.getElementById('adv-sustain-slider');
  const label  = document.getElementById('adv-sustain-label');
  if (!slider || !label) return;

  slider.value = crDefaultSustain;
  label.textContent = crDefaultSustain === 0 ? 'off' : crDefaultSustain.toFixed(1) + 's';

  slider.oninput = () => {
    crDefaultSustain = parseFloat(slider.value);
    label.textContent = crDefaultSustain === 0 ? 'off' : crDefaultSustain.toFixed(1) + 's';
    label.style.color = crDefaultSustain > 0 ? 'var(--perfect)' : 'var(--muted)';
  };
}

// Lane default note pickers (in Advanced panel sidebar)
// These also use the note-badge-click pattern, no preview
function buildLaneNoteGrid() {
  const g = document.getElementById('lane-note-grid');
  g.innerHTML = '';
  const keys = currentSettings.keys.map(code => code.startsWith('Key') ? code.slice(3) : keyCodeLabel(code));
  keys.forEach((k, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:20px 1fr;gap:4px;align-items:center;margin-bottom:4px;';

    const lbl = document.createElement('div');
    lbl.className = 'lnote-label';
    lbl.textContent = k;

    // Note badge — click to open picker, no preview
    const freq     = crLaneFreqs[i];
    const noteName = freqToName(freq);
    const badge    = document.createElement('div');
    badge.style.cssText = [
      'padding:4px 6px;border-radius:6px;border:1px solid var(--border2);',
      'background:var(--bg3);color:var(--text);font-size:10px;font-weight:700;',
      'font-family:var(--font-data);cursor:pointer;text-align:center;',
      'transition:border-color .1s,color .1s;',
    ].join('');
    badge.textContent = noteName;
    badge.title = 'Click to change default note for lane ' + k;
    badge.addEventListener('mouseenter', () => {
      badge.style.borderColor = 'var(--tap)';
      badge.style.color       = 'var(--tap)';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.borderColor = 'var(--border2)';
      badge.style.color       = 'var(--text)';
    });
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      openNotePickerModal(badge, crLaneFreqs[i], (newFreq) => {
        crLaneFreqs[i] = newFreq;
        buildLaneNoteGrid(); // refresh labels
        buildGrid();          // update cells that inherit this freq
      });
    });

    row.appendChild(lbl);
    row.appendChild(badge);
    g.appendChild(row);
  });
}

function buildBgRadio() {
  document.querySelectorAll('.bg-radio-btn').forEach(b => {
    b.classList.toggle('sel', b.dataset.bg === crBgMode);
    b.onclick = () => {
      crBgMode = b.dataset.bg;
      document.querySelectorAll('.bg-radio-btn').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      const bassEl = document.getElementById('bass-editor');
      bassEl.classList.toggle('open', crBgMode === 'bass');
      if (crBgMode === 'bass') buildBassNotePicker();
    };
  });
  const bassEl = document.getElementById('bass-editor');
  bassEl.classList.toggle('open', crBgMode === 'bass');
  if (crBgMode === 'bass') buildBassNotePicker();
}

// Bass note picker — no preview on selection
function buildBassNotePicker() {
  const wrap = document.getElementById('bass-note-sel-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  const noteName = freqToName(_bassPickerFreq);
  const badge    = document.createElement('div');
  badge.style.cssText = [
    'display:inline-block;padding:4px 10px;border-radius:6px;border:1px solid var(--border2);',
    'background:var(--bg3);color:var(--text);font-size:11px;font-weight:700;',
    'font-family:var(--font-data);cursor:pointer;',
    'transition:border-color .1s,color .1s;',
  ].join('');
  badge.textContent = noteName + ' ▾';
  badge.title = 'Click to choose bass note';
  badge.addEventListener('mouseenter', () => {
    badge.style.borderColor = 'var(--tap)'; badge.style.color = 'var(--tap)';
  });
  badge.addEventListener('mouseleave', () => {
    badge.style.borderColor = 'var(--border2)'; badge.style.color = 'var(--text)';
  });
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotePickerModal(badge, _bassPickerFreq, (newFreq) => {
      _bassPickerFreq = newFreq;
      buildBassNotePicker();
    });
  });
  wrap.appendChild(badge);
}

function buildBassEditor() {
  buildBassNotePicker();
  const g = document.getElementById('bass-step-grid');
  g.innerHTML = '';
  crBassSteps.forEach((step, i) => {
    const el = document.createElement('div');
    el.className = 'bass-step' + (step.active ? ' active' : '');
    const name   = freqToName(step.freq);
    const noteLbl = step.active ? name : '—';
    el.innerHTML = `<span>${i+1}</span><span class="bass-step-note">${noteLbl}</span>`;
    el.addEventListener('click', () => {
      const selFreq = _bassPickerFreq;
      if (!step.active)                    { step.active = true;  step.freq = selFreq; }
      else if (Math.abs(step.freq - selFreq) < 1) { step.active = false; }
      else                                 { step.freq = selFreq; }
      buildBassEditor();
    });
    g.appendChild(el);
  });
}
