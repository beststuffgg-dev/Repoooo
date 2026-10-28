function getNoteNames() {
  return window.RD_NOTE_NAMES || ['C4','D4','E4','G4','A4','C5'];
}
function freqToName(freq) {
  if (crInstrument === 'drums' && window.RD_drumLabel) return window.RD_drumLabel(freq);
  if (window.RD_freqToName) return window.RD_freqToName(freq);
  return freq.toFixed(2) + ' Hz';
}
function nameToFreq(name) {
  if (window.RD_nameToFreq) return window.RD_nameToFreq(name) || 261.63;
  return 261.63;
}

let editIdx    = null;
let crGrid     = [];
let crTool     = 'tap';
let crAdvOpen  = false;
let crBgMode   = 'none';
let crLanes = 4;
let crInstrument = 'synth';
let crNoteInst = null;
let crLaneFreqs = [261.63,329.63,392.00,523.25];
const crEmptyRow = () => window.RD_Lanes.emptyRow(crLanes);
let crBassSteps = [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
let _bassPickerFreq = 65.41;

let crCursor = 0;
let crSel    = new Set();
let crClip   = null;
const selKey   = (r, c) => r + ',' + c;
const parseKey = k => k.split(',').map(Number);

function creatorActive() {
  const el = document.getElementById('creator');
  return !!(el && el.classList.contains('active'));
}

function openCreator(idx) {
  crCursor = 0;
  crSel.clear();
  crHist.undo.length = 0; crHist.redo.length = 0; crHist.last = null;
  crNoteInst = null;
  editIdx = idx;
  const customs = store.load();
  if (idx !== null && customs[idx]) {
    const l = customs[idx];
    document.getElementById('cr-name').value = l.name || '';
    document.getElementById('cr-bpm').value  = l.bpm  || 120;
    document.getElementById('cr-diff').value = l.diff || 'medium';
    crLanes = window.RD_Lanes.laneCountOf(l);
    crInstrument = window.RD_resolveInstrument(l.instrument || (window.RD_getInstrument && window.RD_getInstrument()));
    crGrid = l.grid.map(r => {
      const row = r.map(cell => {
        if (!cell) return null;
        if (typeof cell === 'string') return { type: cell, freq: null };
        return { ...cell };
      });
      while (row.length < crLanes) row.push(null);
      return row;
    });
    crBgMode    = l.bgMode    || 'none';
    crLaneFreqs = l.laneFreqs ? [...l.laneFreqs] : window.RD_Lanes.defaultFreqs(crLanes);
    crAdvOpen   = false;
    crBassSteps = l.bassSteps
      ? l.bassSteps.map(s => ({ ...s }))
      : [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
    while (crGrid.length < 8) crGrid.push(crEmptyRow());
    normalizeCrHolds();
  } else {
    document.getElementById('cr-name').value = '';
    document.getElementById('cr-bpm').value  = 120;
    document.getElementById('cr-diff').value = 'medium';
    crLanes     = 4;
    crInstrument = window.RD_resolveInstrument(window.RD_getInstrument && window.RD_getInstrument());
    crGrid      = Array.from({ length:16 }, () => crEmptyRow());
    crBgMode    = 'none';
    crLaneFreqs = window.RD_Lanes.defaultFreqs(4);
    crAdvOpen   = false;
    crBassSteps = [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
  }
  setTool('tap');
  buildGrid();
  buildAdvPanel();
  document.getElementById('adv-panel').classList.remove('open');

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

const TOOL_CLASS = { tap:' at', dtap:' ad', hold:' ah', move:' am', erase:' ae', select:' as' };
function setTool(t) {
  crTool = t;
  ['tap','dtap','hold','move','erase','select'].forEach(x => {
    const b = document.getElementById('t-' + x);
    if (b) b.className = 'tool-btn' + (x === t ? TOOL_CLASS[x] : '');
  });
  const bar = document.getElementById('cr-selbar');
  if (bar) bar.classList.toggle('show', t === 'select');
  const wrap = document.querySelector('.cr-grid-wrap');
  if (wrap) wrap.classList.toggle('drag-tool', t === 'hold' || t === 'move');
  if (t !== 'select' && crSel.size) crSel.clear();
  if (document.getElementById('cr-grid')) buildGrid();
}
document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

function moveCursor(d) {
  crCursor = Math.max(0, crCursor + d);
  while (crCursor >= crGrid.length) crGrid.push(crEmptyRow());
  buildGrid();
}
const DEFAULT_HOLD = 2;

function cellHold(cell) {
  return cell && typeof cell === 'object' && cell.type !== 'dtap' && cell.hold > 0 ? Math.floor(cell.hold) : 0;
}

function holdSpace(r, c) {
  let n = 0;
  while (crGrid[r + n + 1] && !crGrid[r + n + 1][c]) n++;
  return n;
}

function holdHeadRow(r, c) {
  if (crGrid[r] && crGrid[r][c]) return -1;
  let rr = r - 1;
  while (rr >= 0 && !(crGrid[rr] && crGrid[rr][c])) rr--;
  if (rr < 0) return -1;
  return cellHold(crGrid[rr][c]) >= r - rr ? rr : -1;
}

function normalizeCrHolds() {
  for (let r = 0; r < crGrid.length; r++) {
    for (let c = 0; c < crLanes; c++) {
      const cell = crGrid[r][c];
      if (!cell || typeof cell !== 'object' || cell.hold === undefined) continue;
      const n = Math.min(cellHold(cell), holdSpace(r, c));
      if (n > 0) cell.hold = n; else delete cell.hold;
    }
  }
}

function placeCell(r, c, cell) {
  while (r >= crGrid.length) crGrid.push(crEmptyRow());
  const own = holdHeadRow(r, c);
  if (own >= 0) {
    const head = crGrid[own][c];
    head.hold = r - own - 1;
    if (head.hold < 1) delete head.hold;
  }
  if (cell && cell.hold) {
    const n = Math.min(cell.hold, holdSpace(r, c));
    if (n > 0) cell.hold = n; else delete cell.hold;
  }
  crGrid[r][c] = cell;
}

function newCellFor(lane) {
  const cell = { type: crTool === 'dtap' ? 'dtap' : 'tap', freq: crLaneFreqs[lane], sustain: crDefaultSustain };
  if (crTool === 'hold') cell.hold = DEFAULT_HOLD;
  if (crNoteInst) cell.inst = crNoteInst;
  return cell;
}

let crPreviewAt = 0;
function crPreview(freq, isDtap, inst) {
  if (!freq || !window.RD_playNoteFreq) return;
  const now = performance.now();
  if (now - crPreviewAt < 60) return;
  crPreviewAt = now;
  window.RD_playNoteFreq(freq, !!isDtap, 0, inst || crInstrument);
}
function crPreviewCell(cell) {
  if (cell) crPreview(cell.freq, cell.type === 'dtap', cell.inst);
}

const crHist = { undo: [], redo: [], last: null, busy: false };
const crSnapshot = () => JSON.stringify({ g: crGrid, n: crLanes, f: crLaneFreqs });

function crRecord() {
  if (crHist.busy || crDrag || crMove) return;
  const now = crSnapshot();
  if (crHist.last === null) { crHist.last = now; return; }
  if (now === crHist.last) return;
  crHist.undo.push(crHist.last);
  if (crHist.undo.length > 200) crHist.undo.shift();
  crHist.redo.length = 0;
  crHist.last = now;
}

function crRestore(json) {
  const st = JSON.parse(json);
  crHist.busy = true;
  const lanesChanged = st.n !== crLanes;
  crGrid = st.g; crLanes = st.n; crLaneFreqs = st.f;
  crSel.clear();
  crCursor = Math.min(crCursor, crGrid.length - 1);
  if (lanesChanged) { syncLaneExpansion('creator'); buildAdvPanel(); }
  buildGrid();
  crHist.last = crSnapshot();
  crHist.busy = false;
  buildGrid();
  if (editIdx !== null) autoSave();
}

function crUndo() {
  if (!crHist.undo.length) return;
  crHist.redo.push(crHist.last);
  crRestore(crHist.undo.pop());
}

function crRedo() {
  if (!crHist.redo.length) return;
  crHist.undo.push(crHist.last);
  crRestore(crHist.redo.pop());
}

function planMove(keys, dr, dc) {
  const moving = new Set(keys);
  const items = [], dests = [];
  let reason = null;
  keys.forEach(k => {
    const [r, c] = parseKey(k);
    const cell = crGrid[r] && crGrid[r][c];
    if (!cell) return;
    const nr = r + dr, nc = c + dc;
    items.push({ r, c, nr, nc, cell });
    dests.push([nr, nc]);
    if (nc < 0 || nc >= crLanes || nr < 0 || nr > crGrid.length + 64) { reason = reason || 'range'; return; }
    const there = crGrid[nr] && crGrid[nr][nc];
    if (there && !moving.has(selKey(nr, nc))) reason = reason || 'occupied';
    const own = holdHeadRow(nr, nc);
    if (own >= 0 && !moving.has(selKey(own, nc))) reason = reason || 'occupied';
  });
  return { ok: items.length > 0 && !reason, reason: items.length ? reason : 'empty', items, dests };
}

function applyMove(plan) {
  plan.items.forEach(it => { crGrid[it.r][it.c] = null; });
  const next = new Set();
  plan.items.forEach(it => {
    const cell = { ...it.cell };
    if (it.nc !== it.c && Math.abs((cell.freq || 0) - crLaneFreqs[it.c]) < 0.01) cell.freq = crLaneFreqs[it.nc];
    while (it.nr >= crGrid.length) crGrid.push(crEmptyRow());
    crGrid[it.nr][it.nc] = cell;
    next.add(selKey(it.nr, it.nc));
  });
  normalizeCrHolds();
  return next;
}

let crMove = null;
let crRefuse = null;

function typeNoteAtCursor(lane) {
  if (lane < 0 || lane >= crLanes) return;
  while (crCursor >= crGrid.length) crGrid.push(crEmptyRow());
  if (cellType(crGrid[crCursor][lane])) {
    crGrid[crCursor][lane] = null;
  } else {
    placeCell(crCursor, lane, newCellFor(lane));
  }
  buildGrid();
  if (editIdx !== null) autoSave();
}

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
  let anchorR, anchorC;
  if (crSel.size) { const b = selBounds(); anchorR = b.minR; anchorC = b.minC; }
  else { anchorR = crCursor; anchorC = 0; }
  const next = new Set();
  crClip.forEach(it => {
    const r = anchorR + it.dr, c = anchorC + it.dc;
    if (c < 0 || c >= crLanes) return;
    while (r >= crGrid.length) crGrid.push(crEmptyRow());
    crGrid[r][c] = { ...it.cell };
    next.add(selKey(r, c));
  });
  normalizeCrHolds();
  crSel = next;
  buildGrid();
  if (editIdx !== null) autoSave();
  showToast('Pasted ' + next.size);
}
function selMove(dr, dc) {
  if (!crSel.size) return;
  const plan = planMove(crSel, dr, dc);
  if (!plan.ok) {
    if (plan.reason === 'occupied') showToast('Something is in the way', true);
    return;
  }
  const next = applyMove(plan);
  crSel = next;
  crCursor = Math.max(0, Math.min(crGrid.length - 1, crCursor + dr));
  buildGrid();
  if (editIdx !== null) autoSave();
  if (next.size === 1) { const [r, c] = parseKey([...next][0]); crPreviewCell(crGrid[r][c]); }
}

function handleCreatorKey(e, keyMap) {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) crRedo(); else crUndo(); return true; }
  if (mod && e.code === 'KeyY') { e.preventDefault(); crRedo(); return true; }
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
    if (crTool === 'select' && crSel.size) selMove(dr, dc);
    else if (dc === 0) moveCursor(dr);
    return true;
  }
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); moveCursor(1); return true; }

  if (e.code in keyMap) {
    e.preventDefault();
    const lane = keyMap[e.code];
    typeNoteAtCursor(lane);
    crPreviewCell(crGrid[crCursor] && crGrid[crCursor][lane]);
    return true;
  }
  return false;
}

(function wireUndo() {
  const u = document.getElementById('cr-undo'), r = document.getElementById('cr-redo');
  if (u) u.addEventListener('click', crUndo);
  if (r) r.addEventListener('click', crRedo);
})();

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

const ADV_PANEL_W = 360;
const ADV_PANEL_MIN = 170;

function openAdvPanel() {
  const room = Math.max(0, getMaxDims().maxW - currentSettings.width - laneExpansion);
  const grow = Math.min(ADV_PANEL_W, room);
  if (grow >= ADV_PANEL_MIN) {
    advExpansion = grow;
    document.body.classList.remove('adv-overlay');
    document.documentElement.style.setProperty('--adv-w', grow + 'px');
  } else {
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
  document.querySelectorAll('.adv-mode').forEach(b => b.classList.toggle('sel', b.dataset.mode === 'settings'));
  const setPane = document.getElementById('adv-settings');
  const genPane = document.getElementById('adv-generate');
  if (setPane) setPane.classList.add('show');
  if (genPane) genPane.classList.remove('show');
  buildAdvPanel();
  buildGrid();
});

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

function buildGrid() {
  const adv = crAdvOpen;
  const g   = document.getElementById('cr-grid');
  g.innerHTML = '';
  g.style.setProperty('--cr-lanes', crLanes);

  const blank = document.createElement('div'); g.appendChild(blank);
  const headerKeys = keysFor(crLanes).map(keyCodeLabel);
  headerKeys.forEach(k => {
    const h = document.createElement('div');
    h.style.cssText = 'text-align:center;font-size:10px;font-weight:700;color:var(--tap);padding:2px 0;font-family:var(--font-data)';
    h.textContent = k; g.appendChild(h);
  });

  const bodyOf = new Map();
  crGrid.forEach((row, ri) => row.forEach((cell, ci) => {
    const n = cellHold(cell);
    for (let k = 1; k <= n; k++) bodyOf.set((ri + k) + ',' + ci, { head: ri, tail: k === n });
  }));
  const srcKeys = new Set(), dropKeys = new Set();
  if (crMove && crMove.plan) {
    crMove.plan.items.forEach(it => srcKeys.add(selKey(it.r, it.c)));
    crMove.plan.dests.forEach(([r, c]) => dropKeys.add(selKey(r, c)));
  }

  crGrid.forEach((row, ri) => {
    const lbl = document.createElement('div');
    lbl.className = 'cr-row-num' + (ri === crCursor ? ' cur' : '');
    lbl.textContent = ri + 1; g.appendChild(lbl);

    row.forEach((cell, ci) => {
      const type = cellType(cell);
      const body = bodyOf.get(ri + ',' + ci);
      const holdN = cellHold(cell);

      const el = document.createElement('div');
      el.className = 'cr-cell' + (type ? ' is-' + type : '')
        + (holdN ? ' is-hold-head' : '')
        + (body ? ' is-hold-body' + (body.tail ? ' is-hold-tail' : '') : '')
        + (ri === crCursor ? ' cur' : '')
        + (crSel.has(selKey(body ? body.head : ri, ci)) ? ' cr-cell-sel' : '')
        + (cell && cell.inst ? ' has-inst' : '')
        + (srcKeys.has(selKey(ri, ci)) ? ' is-moving' : '')
        + (dropKeys.has(selKey(ri, ci)) ? (crMove.plan.ok ? ' is-drop' : ' is-drop-bad') : '')
        + (crRefuse && crRefuse.r === ri && crRefuse.c === ci ? ' cr-refuse' : '');
      el.dataset.r = ri;
      el.dataset.c = ci;
      if (cell && cell.inst) el.title = instLabel(cell.inst);
      if (type && crAdvOpen) {
        el.classList.add('cr-cell-named');
        const name = document.createElement('span');
        name.className = 'cr-cell-note';
        name.textContent = freqToName(cellFreq(cell, ci)) + (cell && cell.inst ? ' ' + instAbbr(cell.inst) : '');
        el.appendChild(name);
        if (cellSustain(cell) > 0) {
          const dot = document.createElement('span');
          dot.className = 'cr-cell-sus';
          dot.title = 'sustain ' + cellSustain(cell).toFixed(1) + 's';
          el.appendChild(dot);
        }
      }
      el.addEventListener('click', ev => {
        if (performance.now() - crGestureEnd < 300) return;
        crCursor = ri;
        const tr = body ? body.head : ri;
        if (crTool === 'select' || (crTool === 'move' && ev.shiftKey)) {
          const k = selKey(tr, ci);
          if (crSel.has(k)) crSel.delete(k); else if (crGrid[tr][ci]) crSel.add(k);
          buildGrid();
          return;
        }
        if (crTool === 'erase') { crGrid[tr][ci] = null; buildGrid(); return; }
        const cur = cellType(crGrid[tr][ci]);
        if (!cur) {
          if (crTool === 'move') { buildGrid(); return; }
          placeCell(ri, ci, newCellFor(ci));
          crPreviewCell(crGrid[ri][ci]);
          buildGrid();
        } else {
          openCellEditor(body ? g.querySelector('.cr-cell[data-r="' + tr + '"][data-c="' + ci + '"]') || el : el, tr, ci);
        }
      });
      g.appendChild(el);
    });
  });
  crRecord();
  const undoBtn = document.getElementById('cr-undo'), redoBtn = document.getElementById('cr-redo');
  if (undoBtn) undoBtn.disabled = !crHist.undo.length;
  if (redoBtn) redoBtn.disabled = !crHist.redo.length;
}

function instLabel(id) {
  const r = (window.RD_INSTRUMENTS || []).find(i => i.id === window.RD_resolveInstrument(id));
  return r ? r.label : id;
}

const INST_ABBR = { synth:'Sy', violin:'Vn', cello:'Vc', flute:'Fl', clarinet:'Cl', trumpet:'Tp', horn:'Hn', harp:'Hp', piano:'Pf', drums:'Dr', kazoo:'Kz' };
function instAbbr(id) {
  return INST_ABBR[window.RD_resolveInstrument(id)] || '';
}

let crGestureEnd = 0;
let crDrag = null;

function setHoldLength(head, lane, want) {
  const cell = crGrid[head] && crGrid[head][lane];
  if (!cell) return false;
  while (want > holdSpace(head, lane) && want < 512 && crGrid.length < head + want + 1) crGrid.push(crEmptyRow());
  const n = Math.max(1, Math.min(want, holdSpace(head, lane)));
  if (cellHold(cell) === n) return false;
  cell.hold = n;
  return true;
}

let crHoldVoice = null;

(function wireGridDrag() {
  const g = document.getElementById('cr-grid');
  const cellAt = ev => {
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const cell = hit && hit.closest ? hit.closest('.cr-cell') : null;
    if (cell && cell.dataset.r !== undefined) return [+cell.dataset.r, +cell.dataset.c];
    const firstRow = [...g.querySelectorAll('.cr-cell[data-r="0"]')];
    const col = firstRow.reduce((best, el, i) => {
      const b = el.getBoundingClientRect();
      const d = ev.clientX < b.left ? b.left - ev.clientX : ev.clientX > b.right ? ev.clientX - b.right : 0;
      return d < best.d ? { d, i } : best;
    }, { d: Infinity, i: 0 }).i;
    const col0 = [...g.querySelectorAll('.cr-cell[data-c="0"]')];
    const lastEl = col0[col0.length - 1];
    if (!lastEl) return null;
    const lb = lastEl.getBoundingClientRect();
    if (ev.clientY <= lb.bottom) return null;
    const step = col0.length > 1 ? col0[1].getBoundingClientRect().top - col0[0].getBoundingClientRect().top : 27;
    return [crGrid.length - 1 + Math.ceil((ev.clientY - lb.bottom) / Math.max(10, step)), col];
  };

  g.addEventListener('pointerdown', ev => {
    const el = ev.target.closest ? ev.target.closest('.cr-cell') : null;
    if (!el || el.dataset.r === undefined) return;
    const r = +el.dataset.r, c = +el.dataset.c;
    if (crTool === 'move' && !ev.shiftKey) {
      const head = el.classList.contains('is-hold-body') ? holdHeadRow(r, c) : r;
      if (head < 0 || !crGrid[head] || !crGrid[head][c]) return;
      const key = selKey(head, c);
      const keys = crSel.has(key) && crSel.size > 1 ? new Set(crSel) : new Set([key]);
      ev.preventDefault();
      try { g.setPointerCapture(ev.pointerId); } catch (_) {}
      crMove = { keys, ar: head, ac: c, gr: r, dr: 0, dc: 0, id: ev.pointerId, plan: null, fromSel: keys.size > 1 || crSel.has(key), last: '' };
      return;
    }
    let head = -1, placed = false;
    if (el.classList.contains('is-hold-tail')) head = holdHeadRow(r, c);
    else if (crTool === 'hold' && !crGrid[r][c] && holdHeadRow(r, c) < 0) {
      placeCell(r, c, newCellFor(c));
      head = r;
      placed = true;
      crDrag = { head, lane: c, id: ev.pointerId, moved: false, placed };
      buildGrid();
      if (window.RD_noteOn) {
        const cell = crGrid[r][c];
        crHoldVoice = window.RD_noteOn(cell.freq, { inst: cell.inst || crInstrument, vel: 0.6 });
      }
    }
    if (head < 0) return;
    ev.preventDefault();
    try { g.setPointerCapture(ev.pointerId); } catch (_) {}
    crDrag = { head, lane: c, id: ev.pointerId, moved: false, placed };
  });

  g.addEventListener('pointermove', ev => {
    if (crMove && ev.pointerId === crMove.id) {
      const at = cellAt(ev);
      if (!at || at[1] === null) return;
      const dr = at[0] - crMove.gr, dc = at[1] - crMove.ac;
      const sig = dr + ',' + dc;
      if (sig === crMove.last) return;
      crMove.last = sig;
      crMove.dr = dr; crMove.dc = dc;
      crMove.plan = dr || dc ? planMove(crMove.keys, dr, dc) : null;
      if (crMove.plan && crMove.plan.ok && crMove.keys.size === 1) {
        const it = crMove.plan.items[0];
        const cell = it.cell;
        const f = it.nc !== it.c && Math.abs((cell.freq || 0) - crLaneFreqs[it.c]) < 0.01 ? crLaneFreqs[it.nc] : cell.freq;
        crPreview(f, cell.type === 'dtap', cell.inst);
      }
      buildGrid();
      return;
    }
    if (!crDrag || ev.pointerId !== crDrag.id) return;
    const at = cellAt(ev);
    if (!at) return;
    if (setHoldLength(crDrag.head, crDrag.lane, at[0] - crDrag.head)) {
      crDrag.moved = true;
      buildGrid();
    }
  });

  const end = ev => {
    if (crMove && ev.pointerId === crMove.id) {
      const mv = crMove;
      crMove = null;
      if (mv.plan && (mv.dr || mv.dc)) {
        if (mv.plan.ok) {
          const next = applyMove(mv.plan);
          if (mv.fromSel) crSel = next;
          crCursor = Math.min(crGrid.length - 1, Math.max(0, mv.ar + mv.dr));
          crGestureEnd = performance.now();
        } else {
          const [r, c] = mv.plan.dests[0] || [mv.ar, mv.ac];
          crRefuse = { r, c };
          setTimeout(() => { crRefuse = null; buildGrid(); }, 380);
          crGestureEnd = performance.now();
        }
      }
      buildGrid();
      if (editIdx !== null) autoSave();
      return;
    }
    if (!crDrag || ev.pointerId !== crDrag.id) return;
    if (crDrag.moved || crDrag.placed) crGestureEnd = performance.now();
    crDrag = null;
    if (crHoldVoice) { crHoldVoice.release(); crHoldVoice = null; }
    buildGrid();
    if (editIdx !== null) autoSave();
  };
  g.addEventListener('pointerup', end);
  g.addEventListener('pointercancel', end);
})();

function openCellEditor(anchorEl, ri, ci) {
  document.querySelectorAll('.cr-cell-editor').forEach(e => e.remove());
  const cell = crGrid[ri][ci];
  if (!cell) return;

  const pop = document.createElement('div');
  pop.className = 'cr-cell-editor';

  const write = patch => {
    const cur = crGrid[ri] && crGrid[ri][ci];
    if (!cur) return;
    const next = Object.assign({
      type: cellType(cur) || 'tap',
      freq: cellFreq(cur, ci),
      sustain: cellSustain(cur),
    }, typeof cur === 'object' ? cur : {}, patch);
    if (next.inst === null) delete next.inst;
    if (next.type === 'dtap' || !(next.hold > 0)) delete next.hold;
    else {
      const n = Math.min(Math.floor(next.hold), holdSpace(ri, ci));
      if (n > 0) next.hold = n; else delete next.hold;
    }
    crGrid[ri][ci] = next;
    if (patch.freq !== undefined || patch.type !== undefined || patch.inst !== undefined) crPreviewCell(next);
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

    const pitchBtn = document.createElement('button');
    pitchBtn.className = 'cce-pitch';
    pitchBtn.textContent = '♪ ' + freqToName(cellFreq(c, ci));
    pitchBtn.addEventListener('click', () => {
      openNotePickerModal(pitchBtn, cellFreq(crGrid[ri][ci], ci), f => write({ freq: f }));
    });
    pop.appendChild(pitchBtn);

    if (cellType(c) !== 'dtap') {
      const holdLabel = document.createElement('div');
      holdLabel.className = 'cce-sublabel';
      holdLabel.textContent = 'Hold (rows)';
      pop.appendChild(holdLabel);
      const holdRow = document.createElement('div');
      holdRow.className = 'cce-sus';
      const room = holdSpace(ri, ci);
      [[0, 'off'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6'], [8, '8']].forEach(([v, label]) => {
        const btn = document.createElement('button');
        btn.className = 'cce-schip' + (cellHold(c) === v ? ' on' : '');
        btn.textContent = label;
        if (v > room) { btn.disabled = true; btn.style.opacity = '.35'; }
        btn.addEventListener('click', () => write({ hold: v }));
        holdRow.appendChild(btn);
      });
      pop.appendChild(holdRow);
    }

    const instLabelEl = document.createElement('div');
    instLabelEl.className = 'cce-sublabel';
    instLabelEl.textContent = 'Instrument';
    pop.appendChild(instLabelEl);
    const instRow = document.createElement('div');
    instRow.className = 'cce-sus cce-insts';
    [{ id: null, label: 'Level' }].concat((window.RD_INSTRUMENTS || []).map(i => ({ id: i.id, label: i.label.replace('French ', '') }))).forEach(it => {
      const btn = document.createElement('button');
      const cur = c.inst ? window.RD_resolveInstrument(c.inst) : null;
      btn.className = 'cce-schip' + (cur === it.id ? ' on' : '');
      btn.textContent = it.label;
      btn.addEventListener('click', () => write({ inst: it.id }));
      instRow.appendChild(btn);
    });
    pop.appendChild(instRow);

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

let crGenBand = '3-6';
function generateIntoGrid(band) {
  const lvl = generateLevel(band || crGenBand);
  if (!lvl || !lvl.grid) { showToast('Could not generate', true); return; }
  crGrid = lvl.grid.map(r => {
    const row = r.map(c => (c ? { ...c } : null));
    while (row.length < crLanes) row.push(null);
    return row.slice(0, crLanes);
  });
  while (crGrid.length < 8) crGrid.push(crEmptyRow());
  const genFreqs = lvl.laneFreqs ? [...lvl.laneFreqs] : window.RD_Lanes.defaultFreqs(4);
  while (genFreqs.length < crLanes) genFreqs.push(window.RD_Lanes.defaultFreqs(crLanes)[genFreqs.length]);
  crLaneFreqs = genFreqs.slice(0, crLanes);
  crBgMode = lvl.bgMode || 'none';
  const nameEl = document.getElementById('cr-name');
  const bpmEl  = document.getElementById('cr-bpm');
  if (nameEl && !nameEl.value) nameEl.value = lvl.name || 'Generated';
  if (bpmEl) bpmEl.value = lvl.bpm || 120;
  if (lvl.instrument) crInstrument = window.RD_resolveInstrument(lvl.instrument);
  buildAdvPanel();
  buildGrid();
  showToast('Generated ' + crGrid.length + ' beats — edit or save');
}

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
  for (let i = 0; i < 4; i++) crGrid.push(crEmptyRow());
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
    lanes:       crLanes,
    instrument:  crInstrument,
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

function autoSave() {
  if (editIdx === null) return;
  const name        = document.getElementById('cr-name').value.trim() || 'untitled';
  const bpm         = parseInt(document.getElementById('cr-bpm').value) || 120;
  const diff        = document.getElementById('cr-diff').value;
  const bassPattern = crBassSteps.map(s => s.active ? s.freq : 0);
  const lvl = {
    id: 'c' + Date.now(), name, bpm, diff,
    lanes:       crLanes,
    instrument:  crInstrument,
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

let crDefaultSustain = 0;

function setCreatorLanes(n) {
  n = window.RD_Lanes.clamp(n);
  if (n === crLanes) return;
  if (n < crLanes) {
    let lost = 0;
    crGrid.forEach(row => { for (let c = n; c < crLanes; c++) if (row[c]) lost++; });
    if (lost && !confirm(lost + ' note' + (lost === 1 ? '' : 's') + ' in the lanes being removed will be deleted. Continue?')) {
      buildLaneCountControl();
      return;
    }
  }
  const defs = window.RD_Lanes.defaultFreqs(n);
  const was = window.RD_Lanes.defaultFreqs(crLanes);
  const pristine = crLaneFreqs.length === was.length && crLaneFreqs.every((f, c) => Math.abs(f - was[c]) < 0.01);
  const freqs = [];
  for (let c = 0; c < n; c++) freqs.push(pristine || c >= crLanes ? defs[c] : crLaneFreqs[c]);
  crGrid = crGrid.map(row => {
    const next = row.slice(0, n);
    while (next.length < n) next.push(null);
    return next;
  });
  crLaneFreqs = freqs;
  crLanes = n;
  crSel.clear();
  crCursor = Math.min(crCursor, crGrid.length - 1);
  syncLaneExpansion('creator');
  buildAdvPanel();
  buildGrid();
  if (editIdx !== null) autoSave();
}

function buildLaneCountControl() {
  document.querySelectorAll('#cr-lane-count .bg-radio-btn').forEach(b => {
    b.classList.toggle('sel', +b.dataset.lanes === crLanes);
    b.onclick = () => setCreatorLanes(+b.dataset.lanes);
  });
}

function applyNoteInstToSelection(id) {
  let n = 0;
  crSel.forEach(k => {
    const [r, c] = parseKey(k);
    const cell = crGrid[r] && crGrid[r][c];
    if (!cell) return;
    if (id) cell.inst = id; else delete cell.inst;
    n++;
  });
  if (n) { buildGrid(); if (editIdx !== null) autoSave(); }
  return n;
}

function buildAdvNoteInstRow() {
  const row = document.getElementById('adv-noteinst-row');
  if (!row) return;
  row.innerHTML = '';
  const items = [{ id: null, label: 'Level' }].concat((window.RD_INSTRUMENTS || []).map(i => ({ id: i.id, label: i.label })));
  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'bg-radio-btn' + (crNoteInst === it.id ? ' sel' : '');
    btn.dataset.noteinst = it.id || '';
    btn.textContent = it.label;
    btn.addEventListener('click', () => {
      crNoteInst = it.id;
      const n = applyNoteInstToSelection(it.id);
      crPreview(crLaneFreqs[0], false, it.id);
      buildAdvNoteInstRow();
      const hint = document.getElementById('adv-noteinst-hint');
      if (hint) hint.textContent = n ? 'Set on ' + n + ' selected note' + (n === 1 ? '' : 's') + '. New notes use ' + (it.id ? it.label : 'the level voice') + '.'
        : 'New notes use ' + (it.id ? it.label : 'the level voice') + '. Select notes first to change ones already placed.';
    });
    row.appendChild(btn);
  });
}

function buildAdvPanel() {
  buildAdvNoteInstRow();
  buildLaneCountControl();
  buildLaneNoteGrid();
  buildBgRadio();
  buildBassEditor();
  buildAdvInstrumentRow();
  buildAdvSustainControl();
}

function buildAdvInstrumentRow() {
  const row = document.getElementById('adv-instrument-row');
  if (!row) return;
  row.innerHTML = '';
  const instruments = window.RD_INSTRUMENTS || [
    { id:'synth', label:'Synth', icon:'🎛️' },
    { id:'piano', label:'Piano', icon:'🎹' },
  ];
  const cur = crInstrument;
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
      crInstrument = inst.id;
      buildAdvInstrumentRow();
      if (window.RD_playNoteFreq) window.RD_playNoteFreq(261.63, false, 0, inst.id);
      if (editIdx !== null) autoSave();
    });
    row.appendChild(btn);
  });
}

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

function buildLaneNoteGrid() {
  const g = document.getElementById('lane-note-grid');
  g.innerHTML = '';
  const keys = keysFor(crLanes).map(keyCodeLabel);
  keys.forEach((k, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:20px 1fr;gap:4px;align-items:center;margin-bottom:4px;';

    const lbl = document.createElement('div');
    lbl.className = 'lnote-label';
    lbl.textContent = k;

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
        crPreview(newFreq, false);
        buildLaneNoteGrid();
        buildGrid();
      });
    });

    row.appendChild(lbl);
    row.appendChild(badge);
    g.appendChild(row);
  });
}

function buildBgRadio() {
  document.querySelectorAll('.bg-radio-btn[data-bg]').forEach(b => {
    b.classList.toggle('sel', b.dataset.bg === crBgMode);
    b.onclick = () => {
      crBgMode = b.dataset.bg;
      document.querySelectorAll('.bg-radio-btn[data-bg]').forEach(x => x.classList.remove('sel'));
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
