(function () {
  'use strict';

  const DSP = () => window.RD_StudioDSP;
  const $ = id => document.getElementById(id);
  const MAX_SECONDS = 15 * 60;
  const RATES = [0.25, 0.5, 0.75, 1, 1.25];

  const St = {
    name: '', pcm: null, sr: 22050, dur: 0, url: null,
    curve: null, onsets: [], peaks: null,
    bpm: 120, offset: 0, res: 1, lanes: 4, chord: 3, snap: true, latencyMs: 60, inst: 'piano',
    taps: [], rate: 1, loopA: null, loopB: null, loop: false,
    view: { start: 0, span: 30 }, busy: false,
  };

  const audio = new Audio();
  audio.preload = 'auto';
  audio.preservesPitch = true;
  audio.webkitPreservesPitch = true;

  let clockMedia = 0, clockPerf = 0, lastMedia = -1;
  function mediaNow() {
    const m = audio.currentTime;
    if (audio.paused) { lastMedia = m; clockMedia = m; clockPerf = performance.now(); return m; }
    if (m !== lastMedia) { lastMedia = m; clockMedia = m; clockPerf = performance.now(); return m; }
    return clockMedia + (performance.now() - clockPerf) / 1000 * audio.playbackRate;
  }

  const fmtTime = t => {
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  };
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

  function status(msg, err) {
    const el = $('st-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!err);
  }

  function active() {
    const el = $('studio');
    return !!(el && el.classList.contains('active'));
  }

  function buildOverview() {
    const cols = 4096;
    const n = St.pcm.length;
    const peaks = new Float32Array(cols * 2);
    for (let c = 0; c < cols; c++) {
      const a = Math.floor(c / cols * n), b = Math.max(a + 1, Math.floor((c + 1) / cols * n));
      let lo = 0, hi = 0;
      for (let i = a; i < b; i++) { const v = St.pcm[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      peaks[c * 2] = lo; peaks[c * 2 + 1] = hi;
    }
    St.peaks = peaks;
  }

  let drawQueued = false;
  function redraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; draw(); });
  }

  function viewBounds() {
    const span = Math.min(St.view.span, St.dur || 1);
    const start = Math.max(0, Math.min(St.view.start, Math.max(0, (St.dur || 0) - span)));
    return { start, span };
  }

  function draw() {
    const cv = $('st-wave');
    if (!cv || !St.pcm) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(100, Math.floor(cv.clientWidth * dpr)), h = Math.floor(120 * dpr);
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    const g = cv.getContext('2d');
    const css = getComputedStyle(document.body);
    const col = n => css.getPropertyValue(n).trim() || '#888';
    g.clearRect(0, 0, w, h);
    const { start, span } = viewBounds();
    const t2x = t => (t - start) / span * w;
    const mid = h / 2;

    g.fillStyle = col('--tap');
    const samplesPerPx = span * St.sr / w;
    for (let x = 0; x < w; x++) {
      const t0 = start + x / w * span, t1 = start + (x + 1) / w * span;
      let lo = 0, hi = 0;
      if (samplesPerPx > St.pcm.length / 4096) {
        const c0 = Math.max(0, Math.floor(t0 / St.dur * 4096)), c1 = Math.min(4095, Math.max(c0, Math.floor(t1 / St.dur * 4096)));
        for (let c = c0; c <= c1; c++) { if (St.peaks[c * 2] < lo) lo = St.peaks[c * 2]; if (St.peaks[c * 2 + 1] > hi) hi = St.peaks[c * 2 + 1]; }
      } else {
        const a = Math.floor(t0 * St.sr), b = Math.min(St.pcm.length, Math.max(a + 1, Math.floor(t1 * St.sr)));
        for (let i = a; i < b; i++) { const v = St.pcm[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      }
      const amp = 1.6;
      g.fillRect(x, mid - Math.min(1, hi * amp) * mid * 0.92, 1, Math.max(1, (Math.min(1, hi * amp) + Math.min(1, -lo * amp)) * mid * 0.92));
    }

    const beat = 60 / St.bpm;
    if (span / beat < 90) {
      g.fillStyle = col('--border2');
      for (let b = Math.floor((start - St.offset) / beat); ; b++) {
        const t = St.offset + b * beat;
        if (t > start + span) break;
        if (t >= start) g.fillRect(Math.round(t2x(t)), 0, 1, h);
      }
    }

    g.fillStyle = col('--muted');
    for (const o of St.onsets) {
      if (o.t < start || o.t > start + span) continue;
      g.fillRect(Math.round(t2x(o.t)), h - 8 * dpr, 1, 8 * dpr);
    }

    if (St.loopA !== null || St.loopB !== null) {
      g.fillStyle = 'rgba(255,255,255,.08)';
      const a = St.loopA === null ? start : St.loopA, b = St.loopB === null ? start + span : St.loopB;
      g.fillRect(t2x(a), 0, Math.max(1, t2x(b) - t2x(a)), h);
      g.fillStyle = col('--perfect');
      if (St.loopA !== null) g.fillRect(t2x(St.loopA), 0, 2, h);
      if (St.loopB !== null) g.fillRect(t2x(St.loopB), 0, 2, h);
    }

    for (const tp of St.taps) {
      if (tp.t > start + span || tp.t + tp.hold < start) continue;
      g.fillStyle = tp.hold ? col('--perfect') : col('--dtap');
      if (tp.hold) { g.globalAlpha = 0.25; g.fillRect(t2x(tp.t), 0, Math.max(2, t2x(tp.t + tp.hold) - t2x(tp.t)), h); g.globalAlpha = 1; }
      g.fillRect(Math.round(t2x(tp.t)) - 1, 0, 2, h);
    }

    const ph = mediaNow();
    g.fillStyle = col('--text');
    g.fillRect(Math.round(t2x(ph)), 0, 2, h);
  }

  function seek(t) {
    audio.currentTime = Math.max(0, Math.min(St.dur, t));
    lastMedia = -1;
    updateTime();
    redraw();
  }

  function updateTime() {
    const el = $('st-time');
    if (el) el.textContent = fmtTime(mediaNow());
  }

  let rafId = 0;
  function frame() {
    rafId = 0;
    if (!active()) return;
    if (St.loop && St.loopA !== null && St.loopB !== null && St.loopB > St.loopA && audio.currentTime >= St.loopB) {
      audio.currentTime = St.loopA;
      lastMedia = -1;
    }
    if (!audio.paused) {
      const { start, span } = viewBounds();
      const t = mediaNow();
      if (t > start + span * 0.9 || t < start) St.view.start = Math.max(0, t - span * 0.1);
      updateTime();
      redraw();
    }
    rafId = requestAnimationFrame(frame);
  }
  function ensureFrame() { if (!rafId) rafId = requestAnimationFrame(frame); }

  function setPlayLabel() {
    const b = $('st-play');
    if (b) b.textContent = audio.paused ? '▶ Play' : '❚❚ Pause';
  }

  function togglePlay() {
    if (!St.pcm) return;
    if (audio.paused) {
      const p = audio.play();
      if (p && p.catch) p.catch(() => status('The browser would not start playback.', true));
    } else audio.pause();
    setPlayLabel();
    ensureFrame();
  }
  audio.addEventListener('play', () => { setPlayLabel(); ensureFrame(); });
  audio.addEventListener('pause', () => { setPlayLabel(); redraw(); });
  audio.addEventListener('ended', () => { setPlayLabel(); redraw(); });

  function setRate(r) {
    St.rate = r;
    audio.playbackRate = r;
    audio.preservesPitch = true;
    audio.webkitPreservesPitch = true;
    document.querySelectorAll('#st-speeds button').forEach(b => b.classList.toggle('on', +b.dataset.rate === r));
  }

  function snapOnset(t) {
    const win = Math.max(0.03, Math.min(0.12, 0.1 * St.rate));
    let best = null, bs = 0;
    for (const o of St.onsets) {
      const d = Math.abs(o.t - t);
      if (d > win) { if (o.t > t + win) break; continue; }
      const score = (0.3 + Math.min(1.5, o.strength)) / (0.03 + d);
      if (score > bs) { bs = score; best = o; }
    }
    return best ? best.t : t;
  }

  function nextBoundary(t) {
    let n = Infinity;
    for (const o of St.onsets) if (o.t > t + 0.06) { n = o.t; break; }
    for (const tp of St.taps) if (tp.t > t + 0.06 && tp.t < n) n = tp.t;
    return n;
  }

  function analyseTap(tap) {
    const next = nextBoundary(tap.t);
    const len = isFinite(next) ? Math.max(0.12, Math.min(0.32, next - tap.t - 0.02)) : 0.3;
    const found = DSP().pitchesAt(St.pcm, St.sr, tap.t, { maxNotes: St.chord, len });
    tap.notes = found;
    tap.flagged = !found.length || found[0].conf < 0.55;
  }

  function insertTap(tap) {
    let i = St.taps.length;
    while (i > 0 && St.taps[i - 1].t > tap.t) i--;
    St.taps.splice(i, 0, tap);
  }

  function addTap(rawT) {
    const tap = { raw: rawT, t: St.snap ? snapOnset(rawT) : rawT, hold: 0, notes: [], flagged: false };
    insertTap(tap);
    analyseTap(tap);
    renderList();
    redraw();
    return tap;
  }

  let down = null;
  function tapDown() {
    if (!St.pcm || down) return;
    const t = mediaNow() - (St.latencyMs / 1000) * audio.playbackRate;
    const startMedia = mediaNow();
    down = { tap: addTap(Math.max(0, t)), startMedia };
    $('st-pad').classList.add('down');
  }
  function tapUp() {
    if (!down) return;
    const d = down;
    down = null;
    $('st-pad').classList.remove('down');
    const held = mediaNow() - d.startMedia;
    const beat = 60 / St.bpm;
    if (held >= Math.max(0.25, 0.7 * beat / St.res)) {
      d.tap.hold = held;
      renderList();
      redraw();
    }
  }

  function removeTap(i) {
    St.taps.splice(i, 1);
    renderList();
    redraw();
  }

  function nudge(i, ms) {
    const tap = St.taps[i];
    if (!tap) return;
    tap.t = Math.max(0, tap.t + ms / 1000);
    St.taps.sort((a, b) => a.t - b.t);
    analyseTap(tap);
    renderList();
    redraw();
  }

  function compare(i) {
    const tap = St.taps[i];
    if (!tap || !window.RD_getContext) return;
    const c = window.RD_getContext();
    const t0 = Math.max(0, tap.t - 0.03);
    const a = Math.floor(t0 * St.sr);
    const n = Math.min(St.pcm.length - a, Math.floor(0.8 * St.sr));
    if (n <= 0) return;
    const buf = c.createBuffer(1, n, St.sr);
    buf.copyToChannel(St.pcm.subarray(a, a + n), 0);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = 0.9;
    src.connect(g);
    g.connect(c.destination);
    const at = c.currentTime + 0.03;
    src.start(at);
    const notes = tap.notes.length ? tap.notes : [];
    notes.forEach(nn => window.RD_noteOn(nn.freq, { inst: St.inst, vel: 0.6, when: at + 0.95, dur: 0.7 }));
  }

  function renderList() {
    const host = $('st-list');
    const count = $('st-count');
    if (count) count.textContent = St.taps.length + (St.taps.length === 1 ? ' tap' : ' taps');
    const make = $('st-make');
    if (make) make.disabled = !St.taps.length;
    if (!host) return;
    host.innerHTML = '';
    St.taps.forEach((tp, i) => {
      const row = document.createElement('div');
      row.className = 'st-item' + (tp.flagged ? ' low' : '');
      const notes = tp.notes.length
        ? tp.notes.map(n => '<span class="pill">' + noteName(n.midi) + '</span>').join('')
        : '<span class="pill">no pitch found</span>';
      row.innerHTML = '<span class="n mono">' + (i + 1) + '</span><span class="t mono">' + fmtTime(tp.t) + '</span>'
        + '<span class="notes">' + notes + (tp.hold ? '<span class="pill hold">hold ' + tp.hold.toFixed(2) + 's</span>' : '') + '</span>';
      const mk = (label, title, fn) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = label; b.title = title;
        b.addEventListener('click', fn);
        row.appendChild(b);
      };
      mk('▶', 'Hear the original, then the notes found', () => compare(i));
      mk('◀', 'Nudge 10 ms earlier', () => nudge(i, -10));
      mk('▶|', 'Nudge 10 ms later', () => nudge(i, 10));
      mk('✕', 'Delete', () => removeTap(i));
      host.appendChild(row);
    });
  }

  function syncInputs() {
    $('st-bpm').value = St.bpm;
    $('st-off').value = St.offset.toFixed(3);
  }

  function setLoopButton() {
    const b = $('st-loop');
    if (!b) return;
    b.textContent = St.loop ? 'Loop on' : 'Loop off';
    b.classList.toggle('on', St.loop);
  }

  let tempoTaps = [];
  function tapTempo() {
    const now = performance.now();
    if (tempoTaps.length && now - tempoTaps[tempoTaps.length - 1] > 2000) tempoTaps = [];
    tempoTaps.push(now);
    tempoTaps = tempoTaps.slice(-9);
    if (tempoTaps.length >= 3) {
      const gaps = [];
      for (let i = 1; i < tempoTaps.length; i++) gaps.push(tempoTaps[i] - tempoTaps[i - 1]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      St.bpm = Math.round(60000 / avg * 10) / 10;
      syncInputs();
      redraw();
    }
  }

  async function analyse() {
    St.busy = true;
    status('Listening for the beat… 0%');
    const curve = await DSP().onsetCurve(St.pcm, St.sr, p => status('Listening for the beat… ' + Math.round(p * 100) + '%'));
    St.curve = curve;
    St.onsets = DSP().pickOnsets(curve);
    const tempo = DSP().estimateTempo(curve, St.onsets);
    St.bpm = tempo.bpm;
    St.offset = tempo.offset;
    syncInputs();
    St.busy = false;
    status(St.onsets.length + ' note starts found, about ' + Math.round(St.bpm) + ' BPM. Press play and tap the notes you want.');
    St.taps.forEach(analyseTap);
    renderList();
    redraw();
  }

  async function loadFile(file) {
    if (!file) return;
    if (St.busy) return;
    audio.pause();
    status('Reading ' + file.name + '…');
    let buf;
    try {
      const data = await file.arrayBuffer();
      const ctx = new OfflineAudioContext(1, 1, DSP().ANALYSIS_RATE);
      buf = await ctx.decodeAudioData(data);
    } catch (e) {
      status('That file could not be read as audio.', true);
      return;
    }
    if (buf.duration > MAX_SECONDS) { status('That track is longer than 15 minutes.', true); return; }
    St.name = file.name.replace(/\.[^.]+$/, '');
    St.pcm = DSP().toMono(buf);
    St.sr = buf.sampleRate;
    St.dur = buf.duration;
    St.taps = [];
    St.onsets = [];
    St.loopA = St.loopB = null;
    St.loop = false;
    St.view = { start: 0, span: Math.min(30, St.dur) };
    if (St.url) URL.revokeObjectURL(St.url);
    St.url = URL.createObjectURL(file);
    audio.src = St.url;
    audio.load();
    setRate(St.rate);
    buildOverview();
    $('st-main').hidden = false;
    setLoopButton();
    renderList();
    redraw();
    ensureFrame();
    await analyse();
  }

  function zoom(factor, anchor) {
    const { start, span } = viewBounds();
    const a = anchor === undefined ? mediaNow() : anchor;
    const next = Math.max(2, Math.min(St.dur, span * factor));
    St.view.span = next;
    St.view.start = Math.max(0, Math.min(St.dur - next, a - (a - start) / span * next));
    redraw();
  }

  function guessDifficulty(rows) {
    const secs = rows.length * 60 / Math.max(1, St.bpm * St.res);
    const per = St.taps.length / Math.max(1, secs);
    return per < 1.6 ? 'easy' : per < 3 ? 'medium' : 'hard';
  }

  function makeLevel() {
    if (!St.taps.length) return null;
    const detected = St.taps.flatMap(t => t.notes.map(n => n.midi)).sort((a, b) => a - b);
    const median = detected.length ? detected[Math.floor(detected.length / 2)] : 60;
    const fallback = { midi: median, freq: 440 * Math.pow(2, (median - 69) / 12) };
    const events = St.taps.map(tp => ({
      t: tp.t, hold: tp.hold,
      notes: tp.notes.length ? tp.notes.map(n => ({ midi: n.midi, freq: n.freq })) : [fallback],
    }));
    const rows = DSP().buildGrid(events, { bpm: St.bpm, offset: St.offset, res: St.res, lanes: St.lanes });
    const lvl = {
      id: 'c' + Date.now(),
      name: (St.name || 'Studio level').slice(0, 28),
      bpm: Math.max(40, Math.min(260, Math.round(St.bpm * St.res))),
      diff: guessDifficulty(rows),
      lanes: St.lanes,
      instrument: St.inst,
      grid: rows,
      bgMode: 'none',
      laneFreqs: window.RD_Lanes.defaultFreqs(St.lanes),
      bassSteps: [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ active: false, freq: 65.41 })),
      bassPattern: [],
    };
    if (St.res > 1) lvl.scrollRows = 4 * St.res;
    return lvl;
  }

  function make() {
    const lvl = makeLevel();
    if (!lvl) return null;
    audio.pause();
    const arr = store.load();
    arr.push(lvl);
    store.save(arr);
    openCreator(arr.length - 1);
    showToast('Level made from ' + St.taps.length + ' taps. Check it over and press Save when it looks right.');
    return lvl;
  }

  function open() {
    showScreen('studio');
    ensureFrame();
    redraw();
  }

  function fillInstruments() {
    const sel = $('st-inst');
    if (!sel || sel.options.length) return;
    (window.RD_INSTRUMENTS || []).forEach(i => {
      const o = document.createElement('option');
      o.value = i.id; o.textContent = i.label;
      if (i.id === St.inst) o.selected = true;
      sel.appendChild(o);
    });
  }

  function wire() {
    fillInstruments();
    $('st-pick').addEventListener('click', () => $('st-file').click());
    $('st-file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });
    const drop = $('st-drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });
    $('st-back').addEventListener('click', () => { audio.pause(); showScreen('home'); renderHome(); });
    $('st-make').addEventListener('click', make);
    $('st-play').addEventListener('click', togglePlay);
    document.querySelectorAll('#st-speeds button').forEach(b => b.addEventListener('click', () => setRate(+b.dataset.rate)));
    $('st-a').addEventListener('click', () => { St.loopA = mediaNow(); if (St.loopB !== null && St.loopB <= St.loopA) St.loopB = null; redraw(); });
    $('st-b').addEventListener('click', () => { const t = mediaNow(); if (St.loopA !== null && t > St.loopA) { St.loopB = t; St.loop = true; setLoopButton(); redraw(); } });
    $('st-loop').addEventListener('click', () => { St.loop = !St.loop; setLoopButton(); });
    $('st-zoom-in').addEventListener('click', () => zoom(0.5));
    $('st-zoom-out').addEventListener('click', () => zoom(2));
    $('st-lat').addEventListener('input', e => { St.latencyMs = +e.target.value; $('st-lat-v').textContent = St.latencyMs + ' ms'; });
    $('st-undo').addEventListener('click', () => { St.taps.pop(); renderList(); redraw(); });
    $('st-clear').addEventListener('click', () => { St.taps = []; renderList(); redraw(); });
    $('st-bpm').addEventListener('input', e => { St.bpm = Math.max(40, Math.min(260, +e.target.value || 120)); redraw(); });
    $('st-off').addEventListener('input', e => { St.offset = +e.target.value || 0; redraw(); });
    $('st-detect').addEventListener('click', () => {
      if (!St.curve) return;
      const t = DSP().estimateTempo(St.curve, St.onsets);
      St.bpm = t.bpm; St.offset = t.offset; syncInputs(); redraw();
    });
    $('st-half').addEventListener('click', () => { St.bpm = Math.max(40, Math.round(St.bpm / 2 * 10) / 10); syncInputs(); redraw(); });
    $('st-double').addEventListener('click', () => { St.bpm = Math.min(260, Math.round(St.bpm * 2 * 10) / 10); syncInputs(); redraw(); });
    $('st-tempo').addEventListener('click', tapTempo);
    $('st-res').addEventListener('change', e => { St.res = +e.target.value; });
    $('st-lanes').addEventListener('change', e => { St.lanes = +e.target.value; });
    $('st-chord').addEventListener('change', e => { St.chord = +e.target.value; St.taps.forEach(analyseTap); renderList(); });
    $('st-snap').addEventListener('change', e => { St.snap = e.target.checked; });
    $('st-inst').addEventListener('change', e => { St.inst = e.target.value; });

    const pad = $('st-pad');
    pad.addEventListener('pointerdown', e => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (_) {} tapDown(); });
    pad.addEventListener('pointerup', tapUp);
    pad.addEventListener('pointercancel', tapUp);

    const cv = $('st-wave');
    let scrub = false;
    const timeAt = e => { const r = cv.getBoundingClientRect(); const { start, span } = viewBounds(); return start + (e.clientX - r.left) / r.width * span; };
    cv.addEventListener('pointerdown', e => { scrub = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} seek(timeAt(e)); });
    cv.addEventListener('pointermove', e => { if (scrub) seek(timeAt(e)); });
    cv.addEventListener('pointerup', () => { scrub = false; });
    cv.addEventListener('pointercancel', () => { scrub = false; });
    cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.8 : 1.25, timeAt(e)); }, { passive: false });
    window.addEventListener('resize', redraw);

    document.addEventListener('keydown', e => {
      if (!active()) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) tapDown(); return; }
      if (e.repeat) return;
      if (e.code === 'KeyP') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'Backspace') { e.preventDefault(); St.taps.pop(); renderList(); redraw(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); seek(mediaNow() - 2); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); seek(mediaNow() + 2); }
      else if (/^Digit[1-5]$/.test(e.code)) setRate(RATES[+e.code.slice(5) - 1]);
    });
    document.addEventListener('keyup', e => {
      if (active() && e.code === 'Space') { e.preventDefault(); tapUp(); }
    });
  }

  wire();

  if (location.hash === '#studio' && typeof profile !== 'undefined' && profile.username) setTimeout(open, 0);

  window.RD_Studio = {
    state: St, audio, open, loadFile, addTap, tapDown, tapUp, make, makeLevel, mediaNow, setRate, seek,
    analyseTap, snapOnset, compare, active, nudge, removeTap,
  };
})();
