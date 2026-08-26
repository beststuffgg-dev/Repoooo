// ═══════════════════════════════════════════
//  RhythmDrop V8 — notepicker.js
//
//  The note-selector modal: a Letter | Octave | Accidental cascade that
//  resolves to a frequency and calls back with it. A self-contained
//  reusable picker — the creator opens it for a cell's pitch, for each
//  lane's default note, and for the bass line.
//
//  Split out of creator.js — a plain (non-module) script sharing the
//  same global scope. It calls autoSave() (creator.js) at runtime, so
//  popup.html loads this before creator.js.
// ═══════════════════════════════════════════

// ── Note Picker Modal ────────────────────
// 3-column layout: Letter | Octave | Accidental
// Matches screenshot UI. No audio preview on selection.
function openNotePickerModal(anchorEl, currentFreq, onConfirm) {
  const existing = document.getElementById('note-picker-modal');
  if (existing) existing.remove();

  const NOTE_SEMITONES = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  function noteToFreq(letter, octave, acc) {
    let semi = NOTE_SEMITONES[letter];
    if (acc === 'sharp') semi += 1;
    else if (acc === 'flat') semi -= 1;
    const midi = (octave + 1) * 12 + semi;
    return parseFloat((440 * Math.pow(2, (midi - 69) / 12)).toFixed(2));
  }
  function freqToParts(freq) {
    const midi   = Math.round(69 + 12 * Math.log2(freq / 440));
    const octave = Math.floor(midi / 12) - 1;
    const semi   = ((midi % 12) + 12) % 12;
    const NAT    = {0:'C',2:'D',4:'E',5:'F',7:'G',9:'A',11:'B'};
    const NAT_SET= new Set([0,2,4,5,7,9,11]);
    if (NAT_SET.has(semi)) return { letter: NAT[semi], octave, acc: 'natural' };
    let base = semi - 1;
    while (!NAT_SET.has(base)) base--;
    return { letter: NAT[base], octave, acc: 'sharp' };
  }

  const parts   = freqToParts(currentFreq);
  let selLetter = parts.letter;
  let selOctave = Math.max(1, Math.min(8, parts.octave));
  let selAcc    = parts.acc;

  const LETTERS = ['A','B','C','D','E','F','G'];
  const OCTAVES = [1,2,3,4,5,6,7,8];
  const ACCS    = [
    { v:'natural', label:'\u266e natural' },
    { v:'sharp',   label:'\u266f sharp'   },
    { v:'flat',    label:'\u266d flat'    },
  ];

  // ── Cascade helpers ──────────────────────────────
  // Col1 (Letter) → restricts Col2 (Octave) valid set
  // Col2 (Octave) → restricts Col3 (Accidental) valid set
  // Col1 does NOT directly restrict Col3

  function noteExists(letter, octave, acc) {
    const freq = noteToFreq(letter, octave, acc);
    return freq >= 54 && freq <= 4200;
  }

  // Valid octaves given the selected letter (any acc is fine)
  function validOctaves() {
    return new Set(OCTAVES.filter(o => ACCS.some(a => noteExists(selLetter, o, a.v))));
  }

  // Valid accidentals given selected letter + octave (cascade from col2)
  function validAccs() {
    return new Set(ACCS.map(a => a.v).filter(v => noteExists(selLetter, selOctave, v)));
  }

  // Snap: if current combo invalid, find nearest valid note and update state
  function snapToNearest() {
    if (noteExists(selLetter, selOctave, selAcc)) return;
    const targetFreq = noteToFreq(selLetter, selOctave, selAcc);
    let bestDiff = Infinity;
    let bestL = selLetter, bestO = selOctave, bestA = selAcc;
    LETTERS.forEach(l => OCTAVES.forEach(o => ACCS.forEach(a => {
      if (!noteExists(l, o, a.v)) return;
      const f = noteToFreq(l, o, a.v);
      const d = Math.abs(f - targetFreq);
      if (d < bestDiff) { bestDiff = d; bestL = l; bestO = o; bestA = a.v; }
    })));
    selLetter = bestL; selOctave = bestO; selAcc = bestA;
  }

  // Modal shell
  const modal = document.createElement('div');
  modal.id = 'note-picker-modal';
  modal.style.cssText = [
    'position:fixed;z-index:9999;',
    'background:var(--bg2);border:1px solid var(--border2);',
    'border-radius:14px;padding:12px;gap:0;',
    'box-shadow:0 8px 32px rgba(0,0,0,.85);',
    'width:288px;',
    'font-family:var(--font-body);',
  ].join('');

  const rect = anchorEl.getBoundingClientRect();
  modal.style.top  = Math.min(rect.bottom + 4, window.innerHeight - 380) + 'px';
  modal.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 296)) + 'px';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:2px;color:var(--muted);font-family:var(--font-data);';
  title.textContent = 'NOTE SELECTOR';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText = [
    'width:28px;height:28px;border-radius:50%;',
    'background:var(--miss);border:none;color:#fff;',
    'font-size:13px;font-weight:700;cursor:pointer;line-height:1;',
  ].join('');
  closeBtn.addEventListener('click', () => {
    snapToNearest();
    onConfirm(noteToFreq(selLetter, selOctave, selAcc));
    if (typeof autoSave === 'function') autoSave();
    modal.remove();
    document.removeEventListener('click', outsideClick);
  });
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // 3-column grid
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-items:stretch;';

  const BTN = [
    'width:100%;padding:8px 4px;border-radius:8px;',
    'border:1px solid var(--border2);',
    'background:var(--bg3);color:var(--text);',
    'font-size:13px;font-weight:600;cursor:pointer;',
    'font-family:var(--font-body);',
    'transition:background .1s,border-color .1s,color .1s,opacity .1s;',
    'display:block;box-sizing:border-box;',
  ].join('');

  function noteExists(letter, octave, acc) {
    const freq = noteToFreq(letter, octave, acc);
    return freq >= 54 && freq <= 4200;
  }

  function styleBtn(btn, active, dimmed) {
    btn.style.background  = active ? 'var(--tap)' : 'var(--bg3)';
    btn.style.borderColor = active ? 'var(--tap)' : 'var(--border2)';
    btn.style.color       = active ? '#fff'        : 'var(--text)';
    btn.style.opacity     = (dimmed && !active) ? '0.3' : '1';
    btn.style.cursor      = (dimmed && !active) ? 'not-allowed' : 'pointer';
  }

  const colLBtns = [], colOBtns = [], colABtns = [];

  function refreshAllCols() {
    // Col1: all letters always selectable (root of cascade — never dimmed)
    colLBtns.forEach((btn, idx) => styleBtn(btn, LETTERS[idx] === selLetter, false));

    // Col2: valid octaves for the selected letter (any acc); cascade from col1
    const vO = validOctaves();
    colOBtns.forEach((btn, idx) => styleBtn(btn, OCTAVES[idx] === selOctave, !vO.has(OCTAVES[idx])));

    // Col3: valid accs for selected letter + octave; cascade from col2 only
    const vA = validAccs();
    colABtns.forEach((btn, idx) => styleBtn(btn, ACCS[idx].v === selAcc, !vA.has(ACCS[idx].v)));
  }

  function makeCol(items, getLabel, onSelect, btnArr) {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.style.cssText = BTN;
      btn.textContent   = getLabel(item);
      btnArr.push(btn);
      btn.addEventListener('click', () => {
        onSelect(item);
        snapToNearest();
        refreshAllCols();
        onConfirm(noteToFreq(selLetter, selOctave, selAcc));
        if (typeof autoSave === 'function') autoSave();
      });
      col.appendChild(btn);
    });
    return col;
  }

  const colL = makeCol(LETTERS, l=>l,        l=>{selLetter=l;}, colLBtns);
  const colO = makeCol(OCTAVES, o=>String(o), o=>{selOctave=o;}, colOBtns);
  const colA = makeCol(ACCS,    a=>a.label,   a=>{selAcc=a.v;},  colABtns);
  colA.style.height = '100%';
  colA.querySelectorAll('button').forEach(b => { b.style.flex='1'; b.style.minHeight='54px'; });

  refreshAllCols();

  grid.appendChild(colL);
  grid.appendChild(colO);
  grid.appendChild(colA);
  modal.appendChild(grid);
  document.body.appendChild(modal);

  function outsideClick(e) {
    if (!modal.contains(e.target) && e.target !== anchorEl) {
      snapToNearest();
      onConfirm(noteToFreq(selLetter, selOctave, selAcc));
      modal.remove();
      document.removeEventListener('click', outsideClick);
    }
  }
  setTimeout(() => document.addEventListener('click', outsideClick), 0);
}
