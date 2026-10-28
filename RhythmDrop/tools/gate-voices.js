#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('../../tests/node_modules/playwright');
const { launchOpts } = require('../../tests/browser');
const D = require('./lib/dsp');

const CACHE = process.env.VSCO_DIR || '/tmp/vsco/x';
const V8 = path.join(__dirname, '..', 'RhythmDropV8');
const SRC = fs.readFileSync(path.join(V8, 'voices.js'), 'utf8') + '\n' + fs.readFileSync(path.join(V8, 'audio.js'), 'utf8');
const ONLY = process.argv.slice(2);

const has = (...ts) => s => ts.every(t => s.name.toLowerCase().includes(t));
const REF = {
  violin:   { dir: 'SViolinVib',     pick: has('_f'),  dur: 1.5 },
  cello:    { dir: 'CelloEnsSusVib', pick: has('_v3'), dur: 1.5 },
  flute:    { dir: 'FluteSusVib',    pick: has('_v1'), dur: 1.5 },
  clarinet: { dir: 'ClarinetSus',    pick: has('_v3'), dur: 1.5 },
  trumpet:  { dir: 'TrumpetSus',     pick: has('_v3'), dur: 1.5 },
  horn:     { dir: 'FHornSus',       pick: has('_v3'), dur: 1.5 },
  harp:     { dir: 'Harp',           pick: has('_mf'), dur: 1.5 },
  piano:    { dir: 'UprightPiano',   pick: has('dyn2'), dur: 1.5 },
};

function trimOnset(x) {
  let pk = 0;
  for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
  const th = pk * 0.03;
  let s = 0;
  while (s < x.length && Math.abs(x[s]) < th) s++;
  return x.subarray(Math.max(0, s - 220));
}

function normalise(x, seconds) {
  const n = Math.min(x.length, Math.round(seconds * D.SR));
  let e = 0;
  for (let i = 0; i < n; i++) e += x[i] * x[i];
  const g = 0.1 / Math.sqrt(e / n + 1e-12);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * g;
  return out;
}

function distances(a, b, seconds) {
  const n = Math.round(seconds * D.SR);
  const A = D.logMel(a.subarray(0, n), 2048, 512, 1000), B = D.logMel(b.subarray(0, n), 2048, 512, 1000);
  const m = Math.min(A.length, B.length);
  let top = -200;
  A.forEach(r => r.forEach(v => { if (v > top) top = v; }));
  const floor = top - 60;
  const cl = v => Math.max(v, floor);
  let temporal = 0, cnt = 0;
  const avgA = new Float64Array(D.MEL_BANDS), avgB = new Float64Array(D.MEL_BANDS);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < D.MEL_BANDS; k++) {
      temporal += Math.abs(cl(A[i][k]) - cl(B[i][k]));
      cnt++;
      avgA[k] += cl(A[i][k]) / m; avgB[k] += cl(B[i][k]) / m;
    }
  }
  let spectral = 0;
  for (let k = 0; k < D.MEL_BANDS; k++) spectral += Math.abs(avgA[k] - avgB[k]);
  const cen = (M) => M.map(row => {
    let num = 0, den = 0;
    row.forEach((v, k) => { const p = Math.pow(10, Math.max(v, -90) / 10); num += k * p; den += p; });
    return den ? num / den : 0;
  });
  const cA = cen(A.slice(0, m)), cB = cen(B.slice(0, m));
  let centroid = 0;
  for (let i = 0; i < m; i++) centroid += Math.abs(cA[i] - cB[i]);
  return { temporal: temporal / cnt, spectral: spectral / D.MEL_BANDS, centroid: centroid / m };
}

function riseTime(x) {
  const fr = D.rmsFrames(x, 220);
  const ref = Math.max(...fr.slice(2, 40));
  let a = 0, b = 0;
  for (let i = 0; i < fr.length; i++) { if (fr[i] >= 0.1 * ref) { a = i; break; } }
  for (let i = a; i < fr.length; i++) { if (fr[i] >= 0.8 * ref) { b = i; break; } }
  return (b - a) * 0.005;
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.evaluate(() => {
    const mem = {};
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } } });
  });
  const render = async (inst, freq, vel, dur) => {
    await page.evaluate(() => {
      const off = new OfflineAudioContext(1, 44100 * 3, 44100);
      window.__off = off;
      window.AudioContext = function () { return off; };
    });
    await page.addScriptTag({ content: '(function(){' + SRC + '\n})();' });
    await page.evaluate(([i, f, v, d]) => { window.RD_noteOn(f, { inst: i, vel: v, dur: d }); }, [inst, freq, vel, dur]);
    const arr = await page.evaluate(async () => Array.from((await window.__off.startRendering()).getChannelData(0)));
    return Float32Array.from(arr);
  };

  const summary = [];
  for (const [id, cfg] of Object.entries(REF)) {
    if (ONLY.length && !ONLY.includes(id)) continue;
    const allSamples = D.parseInstrument(path.join(CACHE, cfg.dir)).filter(s => s.file);
    const samples = allSamples.filter(cfg.pick);
    const byNote = new Map();
    samples.forEach(s => { if (!byNote.has(s.base)) byNote.set(s.base, s); });
    const bases = [...byNote.keys()].sort((a, b) => a - b);
    const chosen = bases.filter((_, i) => i % 2 === 0).slice(0, 9);
    const rows = [];
    for (const base of chosen) {
      const s = byNote.get(base);
      const real = trimOnset(D.decodeFile(s.file));
      const synth = trimOnset(await render(id, D.midiToHz(base), 0.6, cfg.dur));
      const secs = 1.2;
      const rn = normalise(real, secs), sn = normalise(synth, secs);
      const d = distances(rn, sn, secs);
      const shifted = trimOnset(D.decodeFile(s.file));
      const neigh = bases[bases.indexOf(base) + 1] !== undefined ? byNote.get(bases[bases.indexOf(base) + 1]) : byNote.get(bases[bases.indexOf(base) - 1]);
      const other = trimOnset(D.decodeFile(neigh.file));
      const dn = distances(rn, normalise(other, secs), secs);
      const alt = allSamples.find(a => a.base === base && a !== s);
      let take = null;
      if (alt) take = distances(rn, normalise(trimOnset(D.decodeFile(alt.file)), secs), secs);
      rows.push({ base, d, dn, take, rise: [riseTime(real), riseTime(synth)] });
      console.log(('  ' + id).padEnd(11) + 'midi ' + String(base).padEnd(3)
        + ' temporal ' + d.temporal.toFixed(1).padStart(5) + ' dB   spectral ' + d.spectral.toFixed(1).padStart(5)
        + ' dB   centroid ' + d.centroid.toFixed(1).padStart(5) + ' bands   (other take: ' + (take ? take.temporal.toFixed(1) + '/' + take.spectral.toFixed(1) : 'n/a') + ', other note: ' + dn.temporal.toFixed(1) + '/' + dn.spectral.toFixed(1) + ')   rise real ' + riseTime(real).toFixed(3) + ' synth ' + riseTime(synth).toFixed(3));
    }
    const avg = k => rows.reduce((a, r) => a + r.d[k], 0) / rows.length;
    const withTake = rows.filter(r => r.take);
    const baseT = withTake.length ? withTake.reduce((a, r) => a + r.take.temporal, 0) / withTake.length : null;
    const baseS = withTake.length ? withTake.reduce((a, r) => a + r.take.spectral, 0) / withTake.length : null;
    const sameRows = withTake.length ? withTake : rows;
    const sT = sameRows.reduce((a, r) => a + r.d.temporal, 0) / sameRows.length;
    const sS = sameRows.reduce((a, r) => a + r.d.spectral, 0) / sameRows.length;
    summary.push({ id, temporal: avg('temporal'), spectral: avg('spectral'), centroid: avg('centroid'), takeTemporal: baseT, takeSpectral: baseS, onBaselineNotesTemporal: sT, onBaselineNotesSpectral: sS });
  }
  if (!ONLY.length || ONLY.includes('drums')) {
    const DR = [
      ['snare', 329.63, '256/Snare2_HitSN_v5_rr6_Sum.wav'],
      ['snare', 329.63, '256/Snare3M_HitSN_v3_rr7_Sum.wav'],
      ['rim', 277.18, '256/Snare2_rimshot_v2_rr5_Sum.wav'],
      ['tomLo', 293.66, '256/TomL_HitS_v3_rr6_Mid.wav'],
      ['tomHi', 415.30, '256/TomH_HitS_v3_rr3_Mid.wav'],
      ['crash', 523.25, '256/cymbal_crash2_f2.wav'],
    ];
    console.log('');
    for (const [piece, freq, file] of DR) {
      const real = trimOnset(D.decodeFile(path.join(path.dirname(CACHE), file)));
      const synth = trimOnset(await render('drums', freq, 0.6, 0.4));
      const secs = 0.7;
      const d = distances(normalise(real, 0.3), normalise(synth, 0.3), secs);
      console.log(('  drums ' + piece).padEnd(16) + ' temporal ' + d.temporal.toFixed(1).padStart(5) + ' dB   spectral ' + d.spectral.toFixed(1).padStart(5) + ' dB   centroid ' + d.centroid.toFixed(1).padStart(5) + ' bands   vs ' + path.basename(file));
    }
  }
  console.log('\nvoice      temporal  spectral  centroid | same-note takes: temporal spectral | ratio');
  summary.forEach(r => {
    const ratio = r.takeTemporal ? r.onBaselineNotesTemporal / r.takeTemporal : null;
    console.log(r.id.padEnd(10) + r.temporal.toFixed(1).padStart(8) + r.spectral.toFixed(1).padStart(10) + r.centroid.toFixed(1).padStart(10)
      + ' | ' + (r.takeTemporal ? r.takeTemporal.toFixed(1).padStart(8) + r.takeSpectral.toFixed(1).padStart(9) : '     n/a      n/a')
      + ' | ' + (ratio ? ratio.toFixed(2) + 'x' + (ratio <= 1.5 ? ' PASS' : ' FAIL') : ''));
  });
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', 'gate.json'), JSON.stringify(summary, null, 1));
  await browser.close();
})();
