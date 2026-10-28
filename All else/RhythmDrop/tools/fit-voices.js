#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const D = require('./lib/dsp');

const CACHE = process.env.VSCO_DIR || '/tmp/vsco/x';
const OUT = path.join(__dirname, '..', '..', '..', 'RhythmDropV9', 'voices.js');
const ONLY = process.argv.slice(2);

const has = (...ts) => s => ts.every(t => s.name.toLowerCase().includes(t));
const any = (...fs_) => s => fs_.some(f => f(s));

const VOICES = {
  violin:   { dir: 'SViolinVib',      kind: 'bow',   soft: has('_p'),  loud: has('_f'),  kmax: 36 },
  cello:    { dir: 'CelloEnsSusVib',  kind: 'bow',   soft: has('_v1'), loud: has('_v3'), kmax: 36 },
  flute:    { dir: 'FluteSusVib',     kind: 'wind',  soft: has('_v1'), loud: has('_v1'), kmax: 24 },
  clarinet: { dir: 'ClarinetSus',     kind: 'wind',  soft: has('_v1'), loud: has('_v3'), kmax: 36 },
  trumpet:  { dir: 'TrumpetSus',      kind: 'brass', soft: has('_v1'), loud: has('_v3'), kmax: 40 },
  horn:     { dir: 'FHornSus',        kind: 'brass', soft: has('_v1'), loud: has('_v3'), kmax: 40 },
  harp:     { dir: 'Harp',            kind: 'pluck', soft: has('_mf'), loud: any(has('_mf'), has('_f')), kmax: 16 },
  piano:    { dir: 'UprightPiano',    kind: 'pluck', soft: has('dyn1'), loud: has('dyn3'), kmax: 20 },
};

const noteHz = s => D.midiToHz(s.base);
const round1 = v => Math.round(v * 10) / 10;
const median = a => { const b = a.filter(v => isFinite(v)).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const nextPow2 = n => { let p = 1; while (p < n) p <<= 1; return p; };

function envelope(x) {
  const rms = D.rmsFrames(x, 441);
  const ref = (() => {
    const lo = Math.min(rms.length - 2, 50), hi = Math.min(rms.length, 120);
    let sum = 0, n = 0;
    for (let i = lo; i < hi; i++) { sum += rms[i]; n++; }
    return n ? sum / n : Math.max(...rms);
  })();
  const pk = Math.max(...rms);
  const pi = rms.indexOf(pk);
  let t10 = 0;
  for (let i = 0; i < rms.length; i++) { if (rms[i] >= 0.1 * ref) { t10 = i; break; } }
  let t90 = t10;
  for (let i = t10; i < rms.length; i++) { if (rms[i] >= 0.8 * ref) { t90 = i; break; } }
  return { rms, pk, pi, t10, t90, attack: Math.min(0.9, Math.max(0.01, (t90 - t10) * 0.01 + 0.01)) };
}

function harmonicFit(mag, binHz, f0n, kmax, bTry) {
  let f0 = f0n;
  let best = null;
  for (let k = 1; k <= 6; k++) {
    const p = D.peakNear(mag, binHz, k * f0n, Math.max(0.04 * k * f0n, 3 * binHz));
    if (!best || p.a > best.a) best = { k, a: p.a, f: p.f };
  }
  f0 = best.f / best.k;
  for (let it = 0; it < 2; it++) {
    let num = 0, den = 0;
    for (let k = 1; k <= Math.min(kmax, 10); k++) {
      const fk = k * f0 * Math.sqrt(1 + (bTry || 0) * k * k);
      const p = D.peakNear(mag, binHz, fk, Math.max(0.2 * f0, 3 * binHz));
      num += p.a * p.f / Math.sqrt(1 + (bTry || 0) * k * k) * k;
      den += p.a * k * k;
    }
    if (den > 0) f0 = num / den;
  }
  return f0;
}

function analyseSustained(x, f0n, kmax) {
  const env = envelope(x);
  const steadyStart = Math.max(Math.round(0.45 * D.SR), env.t90 * 441 + Math.round(0.12 * D.SR));
  let len = Math.min(Math.round(1.2 * D.SR), x.length - steadyStart - 200);
  if (len < 0.35 * D.SR) {
    len = Math.min(Math.round(0.8 * D.SR), x.length - 200);
    if (len < 0.2 * D.SR) return null;
  }
  const start = Math.min(steadyStart, x.length - len - 100);
  const nfft = nextPow2(len * 2);
  const binHz = D.SR / nfft;
  const mag = D.magSpectrum(x, start, len, nfft);
  const f0 = harmonicFit(mag, binHz, f0n, kmax);
  const nh = Math.max(4, Math.min(kmax, Math.floor(14000 / f0)));
  const amps = [], floors = [];
  let harmPow = 0, floorPow = 0, floorCentNum = 0;
  for (let k = 1; k <= nh; k++) {
    const lo = Math.max(1, Math.floor((k - 0.5) * f0 / binHz)), hi = Math.min(mag.length - 1, Math.ceil((k + 0.5) * f0 / binHz));
    let p = 0;
    for (let i = lo; i <= hi; i++) p += mag[i] * mag[i];
    amps.push(Math.sqrt(p));
    harmPow += p;
    const fl = Math.floor((k + 0.5) * f0 / binHz);
    const w = Math.max(2, Math.floor(0.06 * f0 / binHz));
    let fp = 0, cnt = 0;
    for (let i = fl - w; i <= fl + w; i++) if (i > 0 && i < mag.length) { fp += mag[i] * mag[i]; cnt++; }
    if (cnt) {
      const perBin = fp / cnt;
      const span = (hi - lo + 1);
      floors.push(perBin * span);
      floorPow += perBin * span;
      floorCentNum += perBin * span * (k + 0.5) * f0;
    }
  }
  const mx = Math.max(...amps);
  const h = amps.map(a => Math.max(-70, round1(20 * Math.log10(a / mx + 1e-9))));
  const noiseDb = round1(10 * Math.log10(floorPow / Math.max(harmPow, 1e-12) + 1e-9));
  const noiseHz = floorPow > 0 ? Math.round(floorCentNum / floorPow) : 2000;

  let rmsSteady = 0;
  for (let i = 0; i < len; i++) rmsSteady += x[start + i] * x[start + i];
  rmsSteady = Math.sqrt(rmsSteady / len);

  const vib = vibratoOf(x, f0, amps, start, len);

  let centSteady = 0, pw = 0;
  for (let k = 1; k <= nh; k++) { centSteady += k * f0 * amps[k - 1] * amps[k - 1]; pw += amps[k - 1] * amps[k - 1]; }
  centSteady /= pw;
  const eStart = Math.max(0, Math.round((env.t10 * 441) + (env.t90 - env.t10) * 441 * 0.5));
  const eLen = 4096;
  let bright0 = 1;
  if (eStart + eLen < x.length) {
    const m2 = D.magSpectrum(x, eStart, eLen, 8192);
    const b2 = D.SR / 8192;
    let cn = 0, cp = 0;
    for (let i = 1; i < m2.length && i * b2 < 14000; i++) { cn += i * b2 * m2[i] * m2[i]; cp += m2[i] * m2[i]; }
    if (cp > 0) bright0 = Math.min(1.6, (cn / cp) / (centSteady || 1));
  }

  return { f0, h, noiseDb, noiseHz, rms: rmsSteady, attack: env.attack, vib, bright0, nh };
}

function vibratoOf(x, f0, amps, start, len) {
  let kk = 1, av = Math.max(...amps);
  for (let k = 1; k <= amps.length; k++) if (amps[k - 1] > 0.25 * av && k * f0 < 3000) kk = k;
  const fr = 2048, hop = 441, nfft = 32768, binHz = D.SR / nfft;
  const track = [];
  for (let s = start; s + fr < start + len + 30000 && s + fr < x.length; s += hop) {
    const m = D.magSpectrum(x, s, fr, nfft);
    const p = D.peakNear(m, binHz, kk * f0, 0.025 * kk * f0 + 3 * binHz);
    track.push(1200 * Math.log2(p.f / (kk * f0)));
  }
  if (track.length < 60) return { rate: 0, depth: 0 };
  const win = 70;
  const dev = track.map((v, i) => {
    let a = 0, n = 0;
    for (let j = Math.max(0, i - win); j <= Math.min(track.length - 1, i + win); j++) { a += track[j]; n++; }
    return v - a / n;
  });
  const sorted = [...dev].sort((a, b) => a - b);
  const depth = (sorted[Math.floor(sorted.length * 0.93)] - sorted[Math.floor(sorted.length * 0.07)]) / 2;
  const n = nextPow2(dev.length * 8);
  const re = new Float64Array(n), im = new Float64Array(n);
  dev.forEach((v, i) => { re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (dev.length - 1))); });
  D.fft(re, im);
  const rb = 100 / n;
  let bestF = 0, bestV = 0;
  for (let i = Math.floor(3.5 / rb); i <= Math.ceil(8.5 / rb); i++) {
    const v = Math.hypot(re[i], im[i]);
    if (v > bestV) { bestV = v; bestF = i * rb; }
  }
  let all = 0;
  for (let i = Math.floor(0.5 / rb); i < Math.ceil(30 / rb); i++) all += Math.hypot(re[i], im[i]);
  const tonal = all > 0 ? bestV / all : 0;
  return { rate: tonal > 0.012 ? round1(bestF) : 0, depth: round1(depth), tonal: +tonal.toFixed(3) };
}

function analysePluck(x, f0n, kmax) {
  const env = envelope(x);
  const nfft = 65536;
  const binHz = D.SR / nfft;
  const m0 = D.magSpectrum(x, 0, 8192, nfft);
  let f0 = harmonicFit(m0, binHz, f0n, kmax);
  let B = 0;
  const bs = [];
  for (let k = 3; k <= 10; k++) {
    const p = D.peakNear(m0, binHz, k * f0, Math.max(0.2 * f0, 3 * binHz));
    const r = p.f / (k * f0);
    bs.push((r * r - 1) / (k * k));
  }
  B = Math.max(0, median(bs));
  if (B > 0) f0 = harmonicFit(m0, binHz, f0n, kmax, B);
  const nh = Math.max(4, Math.min(kmax, Math.floor(12000 / f0)));
  const hop = 2205, win = 8192;
  const frames = [];
  for (let s = 0; s + win < Math.min(x.length, 4 * D.SR); s += hop) {
    const m = D.magSpectrum(x, s, win, nfft);
    const row = [];
    for (let k = 1; k <= nh; k++) {
      const fk = k * f0 * Math.sqrt(1 + B * k * k);
      row.push(D.peakNear(m, binHz, fk, Math.max(0.15 * f0, 3 * binHz)).a);
    }
    frames.push(row);
  }
  const tc = i => (i * hop + win / 2) / D.SR;
  const slopeOf = (pts, lo, hi, top) => {
    const use = pts.filter(p => p.t >= lo && p.t <= hi && p.db > top - 60 && p.db > -100);
    if (use.length < 3) return null;
    const n = use.length;
    const st = use.reduce((a, p) => a + p.t, 0), sy = use.reduce((a, p) => a + p.db, 0);
    const stt = use.reduce((a, p) => a + p.t * p.t, 0), sty = use.reduce((a, p) => a + p.t * p.db, 0);
    const den = n * stt - st * st;
    if (den <= 0) return null;
    const slope = (n * sty - st * sy) / den;
    return { slope, icpt: (sy - slope * st) / n };
  };
  const amps0 = [], early = [], late = [];
  for (let k = 0; k < nh; k++) {
    const pts = frames.map((row, i) => ({ t: tc(i), db: 20 * Math.log10(row[k] + 1e-12) }));
    const top = Math.max(...pts.map(p => p.db));
    const e = slopeOf(pts, 0.1, 0.9, top);
    const l = slopeOf(pts, 0.9, 3.2, top);
    const es = e ? e.slope : -30;
    amps0.push((e ? e.icpt : pts[0].db) + es * 0.03);
    early.push(Math.max(0.1, Math.min(20, es < -0.4 ? 60 / -es : 20)));
    late.push(Math.max(0.2, Math.min(40, l && l.slope < -0.3 ? 60 / -l.slope : 40)));
  }
  const smooth = arr => {
    const med = arr.map((v, i) => median([arr[Math.max(0, i - 1)], v, arr[Math.min(arr.length - 1, i + 1)]]));
    let m = Infinity;
    return med.map(v => { m = Math.min(m, v); return m; });
  };
  const mx = Math.max(...amps0);
  const h = amps0.map(a => Math.max(-70, round1(a - mx)));
  let rms = 0;
  const L = Math.min(x.length, 8820);
  for (let i = 0; i < L; i++) rms += x[i] * x[i];
  rms = Math.sqrt(rms / L);
  return { f0, h, d: smooth(early).map(round1), s: smooth(late).map(round1), B: +B.toExponential(2), rms, attack: env.attack, nh };
}

function pick(samples, fn) {
  const byNote = new Map();
  for (const s of samples) if (fn(s) && s.file && !byNote.has(s.base)) byNote.set(s.base, s);
  return byNote;
}

function fitVoice(id, cfg) {
  const dir = path.join(CACHE, cfg.dir);
  const samples = D.parseInstrument(dir);
  const soft = pick(samples, cfg.soft), loud = pick(samples, cfg.loud);
  const notes = [...soft.keys()].sort((a, b) => a - b);
  const zones = [];
  const stats = { attack: [], vr: [], vd: [], nz: [], nzh: [], b0: [] };
  for (const base of notes) {
    const s = soft.get(base);
    const l = loud.get(base) || s;
    const fa = cfg.kind === 'pluck' ? analysePluck : analyseSustained;
    let xs, xl;
    try { xs = D.decodeFile(s.file); xl = l === s ? xs : D.decodeFile(l.file); } catch (e) { console.error('  skip', s.name, e.message); continue; }
    const a = fa(xs, D.midiToHz(base), cfg.kmax);
    const b = l === s ? a : fa(xl, D.midiToHz(base), cfg.kmax);
    if (!a || !b) continue;
    const z = { m: Math.round(D.hzToMidi(a.f0) * 100) / 100, h: a.h, hl: b.h, g: 20 * Math.log10(a.rms + 1e-9), gl: 20 * Math.log10(b.rms + 1e-9) };
    if (cfg.kind === 'pluck') { z.d = a.d; z.s = a.s; z.B = a.B; }
    zones.push(z);
    stats.attack.push(a.attack);
    if (a.vib) { stats.vr.push(a.vib.rate); stats.vd.push(a.vib.depth); stats.nz.push(a.noiseDb); stats.nzh.push(a.noiseHz); stats.b0.push(a.bright0); }
    console.log('  ' + id.padEnd(9) + 'midi ' + String(base).padEnd(3) + ' f0 ' + a.f0.toFixed(1).padStart(7) + '  nh ' + String(a.nh).padEnd(3)
      + (cfg.kind === 'pluck' ? ' B ' + a.B + ' T60[1..3] ' + a.d.slice(0, 3).join('/') : ' vib ' + a.vib.rate + 'Hz ' + a.vib.depth + 'c(' + a.vib.tonal + ') noise ' + a.noiseDb + 'dB@' + a.noiseHz + ' b0 ' + a.bright0.toFixed(2)) + ' att ' + a.attack.toFixed(3));
  }
  zones.sort((p, q) => p.m - q.m);
  const gMed = median(zones.map(z => z.g)), glMed = median(zones.map(z => z.gl));
  zones.forEach(z => { z.g = round1(Math.max(-8, Math.min(8, z.g - gMed))); z.gl = round1(Math.max(-8, Math.min(8, z.gl - glMed))); });
  const out = { kind: cfg.kind, zones };
  out.attack = +median(stats.attack).toFixed(3);
  if (cfg.kind !== 'pluck') {
    out.vib = { rate: round1(median(stats.vr.filter(v => v > 0)) || 0), depth: round1(median(stats.vd)) };
    out.noise = { db: round1(median(stats.nz)), hz: Math.round(median(stats.nzh)) };
    out.bright0 = +median(stats.b0).toFixed(2);
  }
  return out;
}

const result = {};
for (const [id, cfg] of Object.entries(VOICES)) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  console.log('fitting ' + id + ' from ' + cfg.dir);
  result[id] = fitVoice(id, cfg);
}
const prevPath = path.join(__dirname, 'out', 'fit.json');
fs.mkdirSync(path.dirname(prevPath), { recursive: true });
let prev = {};
try { prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')); } catch (e) {}
fs.writeFileSync(prevPath, JSON.stringify(Object.assign(prev, result)));
console.log('wrote ' + prevPath);
