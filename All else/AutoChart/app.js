(function () {
  const $ = id => document.getElementById(id);
  const A = window.RD_AutoChart, D = window.RD_StudioDSP;
  const S = { pcm: null, sr: 22050, name: '', analysis: null, key: '', result: null, playing: [], timer: null };

  const status = (m, err) => { $('status').textContent = m || ''; $('status').style.color = err ? 'var(--bad)' : ''; };
  const setProg = p => { $('prog').style.width = Math.round(p * 100) + '%'; };

  async function load(file) {
    if (!file) return;
    status('Reading ' + file.name + '…');
    try {
      const data = await file.arrayBuffer();
      const ctx = new OfflineAudioContext(1, 1, D.ANALYSIS_RATE);
      const buf = await ctx.decodeAudioData(data);
      if (buf.duration > 15 * 60) throw new Error('long');
      S.pcm = D.toMono(buf); S.sr = buf.sampleRate; S.analysis = null; S.key = '';
      S.name = file.name.replace(/\.[^.]+$/, '');
      $('name').value = S.name.slice(0, 28);
      $('fname').textContent = file.name + ' · ' + Math.floor(buf.duration / 60) + ':' + String(Math.round(buf.duration % 60)).padStart(2, '0');
      $('opts').hidden = false; $('result').hidden = true; $('share').hidden = true; $('reroll').disabled = true;
      status('Ready. Choose a difficulty and press Generate.');
      setProg(0);
    } catch (e) {
      status(e.message === 'long' ? 'That track is longer than 15 minutes.' : 'That file could not be read as audio.', true);
    }
  }

  function options() {
    return { difficulty: $('diff').value, lanes: +$('lanes').value, instruments: $('inst').checked, holds: $('holds').checked,
             density: +$('density').value, seed: +$('seed').value || 1, name: $('name').value.trim() || 'Auto level' };
  }

  async function generate(reuse) {
    if (!S.pcm) return;
    const o = options();
    $('go').disabled = true; $('reroll').disabled = true;
    const key = [o.difficulty, o.instruments, o.density].join('|');
    try {
      if (!reuse || !S.analysis || S.key !== key) {
        S.analysis = await A.analyse(S.pcm, S.sr, o, (p, m) => { setProg(p); status(m + '…'); });
        S.key = key;
      }
      setProg(1);
      S.result = A.layout(S.analysis, o);
      show();
      status('Done after ' + S.analysis.passes + ' passes; notes kept only where at least 3 passes agreed. Listen below, then copy the code into RhythmDrop.');
    } catch (e) {
      status('Something went wrong: ' + e.message, true);
    }
    $('go').disabled = false; $('reroll').disabled = false;
  }

  const FAM = { piano: 'Piano', harp: 'Harp', violin: 'Violin', cello: 'Cello', flute: 'Flute', clarinet: 'Clarinet', trumpet: 'Trumpet', horn: 'French horn' };

  function show() {
    const r = S.result, st = r.stats;
    $('result').hidden = false; $('share').hidden = false;
    const mins = Math.floor(st.seconds / 60) + ':' + String(Math.round(st.seconds % 60)).padStart(2, '0');
    $('stats').innerHTML = [['notes', st.notes], ['holds', st.holds], ['rows', st.rows], ['BPM', st.bpm], ['song length', mins], ['lanes', r.level.lanes]]
      .map(([k, v]) => '<div class="stat"><b>' + v + '</b><span>' + k + '</span></div>').join('');
    const ins = st.instruments;
    $('insts').innerHTML = Object.keys(ins).sort((a, b) => ins[b] - ins[a]).map(k => '<span class="chip">' + (FAM[k] || k) + ' · ' + ins[k] + '</span>').join('') || '<span class="chip">instruments not detected</span>';
    r.level.name = $('name').value.trim() || 'Auto level';
    $('code').value = RD_Codec.encodeLevel(r.level);
    draw();
  }

  const COLORS = { piano: '#6fa8b5', harp: '#8fd0b5', violin: '#e0894a', cello: '#c2563a', flute: '#c9a227', clarinet: '#7c8fd8', trumpet: '#e4637a', horn: '#b07cd8' };

  function draw() {
    const cv = $('roll'), r = S.result.level;
    const dpr = window.devicePixelRatio || 1;
    cv.width = cv.clientWidth * dpr; cv.height = 200 * dpr;
    const g = cv.getContext('2d');
    const rows = r.grid.length, lanes = r.lanes;
    const w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    const cw = w / Math.max(rows, 1), lh = h / lanes;
    r.grid.forEach((row, ri) => row.forEach((c, li) => {
      if (!c) return;
      g.fillStyle = COLORS[c.inst] || '#6fa8b5';
      const x = ri * cw, y = li * lh + 2 * dpr;
      g.fillRect(x, y, Math.max(2 * dpr, (c.hold ? (c.hold + 1) * cw : cw)), lh - 4 * dpr);
    }));
  }

  function stopPlay() {
    clearInterval(S.timer); S.timer = null;
    S.playing.forEach(h => { try { h.stop(0.05); } catch (e) {} }); S.playing = [];
    $('play').textContent = '▶ Hear the chart';
  }

  function play() {
    if (S.timer) { stopPlay(); return; }
    const r = S.result.level, rowSec = 60 / r.bpm;
    const c = RD_getContext();
    const list = [];
    r.grid.forEach((row, ri) => row.forEach(cell => {
      if (!cell) return;
      list.push({ at: ri * rowSec, freq: cell.freq, inst: cell.inst || r.instrument, dur: cell.hold ? (cell.hold + 1) * rowSec : 0.5 });
    }));
    list.sort((a, b) => a.at - b.at);
    const end = list.length ? list[list.length - 1].at + 1.5 : 0;
    let i = 0, t0 = null;
    const pump = () => {
      if (t0 === null) t0 = c.currentTime + 0.15;
      const now = c.currentTime - t0;
      while (i < list.length && list[i].at < now + 1.2) {
        const n = list[i++];
        const h = RD_noteOn(n.freq, { inst: n.inst, vel: 0.6, when: t0 + n.at, dur: n.dur });
        S.playing.push(h);
      }
      if (S.playing.length > 80) S.playing = S.playing.slice(-60);
      if (now > end) stopPlay();
    };
    const go = () => { pump(); S.timer = setInterval(pump, 150); };
    $('play').textContent = '■ Stop';
    if (c.state === 'suspended' && c.resume) c.resume().then(go, go); else go();
  }

  $('pick').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', e => { load(e.target.files[0]); e.target.value = ''; });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => load(e.dataTransfer.files[0]));
  $('go').addEventListener('click', () => generate(false));
  $('reroll').addEventListener('click', () => { $('seed').value = (+$('seed').value || 1) + 1; generate(true); });
  $('lanes').addEventListener('change', () => { if (S.analysis) generate(true); });
  $('seed').addEventListener('change', () => { if (S.analysis) generate(true); });
  $('holds').addEventListener('change', () => { if (S.analysis) generate(true); });
  $('name').addEventListener('input', () => { if (S.result) { S.result.level.name = $('name').value.trim() || 'Auto level'; $('code').value = RD_Codec.encodeLevel(S.result.level); } });
  $('play').addEventListener('click', play);
  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('code').value); } catch (e) { $('code').select(); document.execCommand('copy'); }
    $('copy').textContent = 'Copied ✓'; setTimeout(() => { $('copy').textContent = 'Copy code'; }, 1500);
  });
  $('save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('code').value], { type: 'text/plain' }));
    a.download = ($('name').value.trim() || 'level') + '.txt';
    a.click();
  });
  window.RD_AutoApp = { state: S, generate, load };
})();
