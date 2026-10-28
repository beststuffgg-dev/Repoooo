let _ctx = null;
function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended' && typeof _ctx.resume === 'function') {
    try { const r = _ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {  }
  }
  return _ctx;
}

let _masterVol = parseFloat(localStorage.getItem('rd_master_vol'));
if (isNaN(_masterVol)) _masterVol = 1;
let _musicVol = parseFloat(localStorage.getItem('rd_music_vol'));
if (isNaN(_musicVol)) _musicVol = 1;

let _masterGain = null, _limiter = null, _ceiling = null;

const CEIL = 0.97;
function _ceilingCurve(n) {
  const c = new Float32Array(n);
  const k = 1.6, norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    c[i] = (Math.tanh(x * k) / norm) * CEIL;
  }
  return c;
}

function masterGain() {
  if (!_masterGain) {
    const c = ctx();
    _masterGain = c.createGain();
    _masterGain.gain.value = _masterVol;
    let tail = _masterGain;
    if (typeof c.createDynamicsCompressor === 'function') {
      _limiter = c.createDynamicsCompressor();
      _limiter.threshold.value = -8;
      _limiter.knee.value      = 6;
      _limiter.ratio.value     = 12;
      _limiter.attack.value    = 0.003;
      _limiter.release.value   = 0.18;
      tail.connect(_limiter);
      tail = _limiter;
    }
    if (typeof c.createWaveShaper === 'function') {
      _ceiling = c.createWaveShaper();
      _ceiling.curve = _ceilingCurve(1024);
      _ceiling.oversample = '2x';
      tail.connect(_ceiling);
      tail = _ceiling;
    }
    tail.connect(c.destination);
  }
  return _masterGain;
}

let _bgGain = null;
function bgGain() {
  if (!_bgGain) {
    _bgGain = ctx().createGain();
    _bgGain.gain.value = _musicVol;
    _bgGain.connect(masterGain());
  }
  return _bgGain;
}

window.RD_setVolume = v => {
  _masterVol = v;
  if (_masterGain) _masterGain.gain.value = v;
  localStorage.setItem('rd_master_vol', v);
};
window.RD_getVolume = () => _masterVol;
window.RD_setMusicVolume = v => {
  _musicVol = v;
  if (_bgGain) _bgGain.gain.value = v;
  localStorage.setItem('rd_music_vol', v);
};
window.RD_getMusicVolume = () => _musicVol;

const NOTE_TABLE = (function () {
  const LETTERS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const table = {};
  for (let midi = 33; midi <= 108; midi++) {
    const semitone = ((midi % 12) + 12) % 12;
    const octave   = Math.floor(midi / 12) - 1;
    const name     = LETTERS[semitone] + octave;
    const freq     = 440 * Math.pow(2, (midi - 69) / 12);
    table[name]    = parseFloat(freq.toFixed(2));
  }
  return table;
})();

window.RD_NOTE_TABLE = NOTE_TABLE;

window.RD_NOTE_NAMES = (function () {
  const order = [];
  for (let midi = 33; midi <= 108; midi++) {
    const LETTERS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const semitone = ((midi % 12) + 12) % 12;
    const octave   = Math.floor(midi / 12) - 1;
    order.push(LETTERS[semitone] + octave);
  }
  return order;
})();

window.RD_freqToName = function (freq) {
  let best = null, bestDiff = Infinity;
  for (const [name, f] of Object.entries(NOTE_TABLE)) {
    const d = Math.abs(f - freq);
    if (d < bestDiff) { bestDiff = d; best = name; }
  }
  return best;
};

window.RD_nameToFreq = function (name) {
  return NOTE_TABLE[name] || null;
};

const DEF_FREQS = [
  NOTE_TABLE['C4'],
  NOTE_TABLE['E4'],
  NOTE_TABLE['G4'],
  NOTE_TABLE['C5'],
];
let laneFreqs = [...DEF_FREQS];
window.RD_setLaneFreqs   = f  => { laneFreqs = f; };
window.RD_resetLaneFreqs = () => { laneFreqs = [...DEF_FREQS]; };

let _instrument = 'synth';
const ROSTER = [
  { id:'synth',    label:'Synth',       icon:'🎛️' },
  { id:'violin',   label:'Violin',      icon:'🎻' },
  { id:'cello',    label:'Cello',       icon:'🎻' },
  { id:'flute',    label:'Flute',       icon:'🪈' },
  { id:'clarinet', label:'Clarinet',    icon:'🎷' },
  { id:'trumpet',  label:'Trumpet',     icon:'🎺' },
  { id:'horn',     label:'French Horn', icon:'📯' },
  { id:'harp',     label:'Harp',        icon:'🎼' },
  { id:'piano',    label:'Piano',       icon:'🎹' },
  { id:'drums',    label:'Drum Kit',    icon:'🥁' },
  { id:'kazoo',    label:'Kazoo',       icon:'🎶' },
];
window.RD_INSTRUMENTS = ROSTER;

const LEGACY_VOICES = {
  chiptune:'synth', strings:'violin', brass:'trumpet', guitar:'harp', lyre:'harp',
  kalimba:'harp', bell:'harp', marimba:'piano', organ:'clarinet',
};
const ROSTER_IDS = new Set(ROSTER.map(r => r.id));
function resolveInst(id) {
  if (id && ROSTER_IDS.has(id)) return id;
  return LEGACY_VOICES[id] || 'synth';
}
window.RD_resolveInstrument = resolveInst;
window.RD_LEGACY_INSTRUMENTS = LEGACY_VOICES;

window.RD_setInstrument = id => { _instrument = resolveInst(id); };
window.RD_getInstrument = () => _instrument;

(function () {
  const saved = localStorage.getItem('rd_instrument');
  if (saved) {
    _instrument = resolveInst(saved);
    if (_instrument !== saved) localStorage.setItem('rd_instrument', _instrument);
  }
})();

window.RD_saveInstrument = id => {
  _instrument = resolveInst(id);
  localStorage.setItem('rd_instrument', _instrument);
};

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampTo = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const freqToMidiF = f => 69 + 12 * Math.log2(f / 440);

function noiseBuf(c) {
  if (!c._rdNoise) {
    const n = Math.floor(c.sampleRate * 1.5);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    let s = 2463534242;
    for (let i = 0; i < n; i++) {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      d[i] = s / 2147483648 - 1;
    }
    c._rdNoise = b;
  }
  return c._rdNoise;
}

function noiseSource(c, t, loop) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf(c);
  src.loop = !!loop;
  return src;
}

function holdAndRelease(param, at, tail) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(at);
  else param.cancelScheduledValues(at);
  param.setTargetAtTime(0, at, tail / 4);
}

const FIT = () => window.RD_VOICE_FIT || {};

const TUNE = {
  violin:   { level: 0.255, attackMax: 0.12, rel: 0.16, detune: [-3, 3], scoop: 18, scoopT: 0.07, brightT: 0.16, vibDelay: 0.16, vibRise: 0.3, vibK: 1.5, noiseK: 1.6, noiseBurst: 2.2, sus: 0.94 },
  cello:    { level: 0.355, attackMax: 0.14, rel: 0.2,  detune: [-3.5, 3.5], scoop: 14, scoopT: 0.08, brightT: 0.2, vibDelay: 0.2, vibRise: 0.35, vibK: 1.4, noiseK: 1.5, noiseBurst: 2.0, sus: 0.94 },
  flute:    { level: 0.254,  attackMax: 0.07, rel: 0.1,  detune: [0], scoop: 0, scoopT: 0, brightT: 0.08, vibDelay: 0.25, vibRise: 0.3, vibK: 1.2, noiseK: 2.2, noiseBurst: 2.6, sus: 0.96 },
  clarinet: { level: 0.158, attackMax: 0.07, rel: 0.1,  detune: [0], scoop: 0, scoopT: 0, brightT: 0.1, vibDelay: 0.3, vibRise: 0.3, vibK: 1.0, noiseK: 1.6, noiseBurst: 1.6, sus: 0.97 },
  trumpet:  { level: 0.206,  attackMax: 0.06, rel: 0.1,  detune: [0], scoop: 25, scoopT: 0.05, brightT: 0.09, vibDelay: 0.35, vibRise: 0.3, vibK: 1.0, noiseK: 1.4, noiseBurst: 1.8, sus: 0.96 },
  horn:     { level: 0.164, attackMax: 0.09, rel: 0.16, detune: [0], scoop: 30, scoopT: 0.07, brightT: 0.14, vibDelay: 0.35, vibRise: 0.3, vibK: 1.0, noiseK: 1.4, noiseBurst: 1.5, sus: 0.96 },
  harp:     { level: 0.2,  dry: 1.25, pedalMax: 6, twin: 0, thump: 0.5 },
  piano:    { level: 0.22, dry: 1.1,  pedalMax: 7, twin: 0.9, thump: 0.7 },
};

const MAX_VOICES = 30;
const _active = [];

function trackVoice(c, h) {
  const now = c.currentTime;
  for (let i = _active.length - 1; i >= 0; i--) {
    const v = _active[i];
    if (v.endAt < now - 0.05) _active.splice(i, 1);
    else if (v.endAt === Infinity && now - v.t0 > 40) v.release(now);
  }
  while (_active.length >= MAX_VOICES) {
    const v = _active.shift();
    v.stop(0.04);
  }
  _active.push(h);
  return h;
}

function fitTables(fit, midi, vb) {
  const z = fit.zones;
  let lo = z[0], hi = z[z.length - 1], w = 0;
  if (midi > z[0].m && midi < z[z.length - 1].m) {
    for (let i = 0; i < z.length - 1; i++) {
      if (z[i].m <= midi && z[i + 1].m > midi) { lo = z[i]; hi = z[i + 1]; w = (midi - lo.m) / (hi.m - lo.m); break; }
    }
  } else if (midi >= z[z.length - 1].m) lo = hi = z[z.length - 1];
  else lo = hi = z[0];
  const n = Math.max(lo.h.length, hi.h.length);
  const h = new Float64Array(n);
  const mix = (zn, k) => {
    const a = zn.h[k] === undefined ? -70 : zn.h[k];
    const b = zn.hl && zn.hl[k] !== undefined ? zn.hl[k] : a;
    return a + (b - a) * vb;
  };
  for (let k = 0; k < n; k++) { const a = mix(lo, k), b = mix(hi, k); h[k] = a + (b - a) * w; }
  const gOf = zn => (zn.g || 0) + ((zn.gl === undefined ? zn.g || 0 : zn.gl) - (zn.g || 0)) * vb;
  const out = { h, g: gOf(lo) + (gOf(hi) - gOf(lo)) * w };
  if (lo.d) {
    const lerpArr = (a, b, len) => {
      const r = new Float64Array(len);
      for (let k = 0; k < len; k++) { const x = a[Math.min(k, a.length - 1)], y = b[Math.min(k, b.length - 1)]; r[k] = x + (y - x) * w; }
      return r;
    };
    out.d = lerpArr(lo.d, hi.d, n);
    out.s = lerpArr(lo.s || lo.d, hi.s || hi.d, n);
    out.B = (lo.B || 0) + ((hi.B || 0) - (lo.B || 0)) * w;
  }
  return out;
}

function waveFor(c, id, midi, vb, tb, kMax) {
  if (!c._rdWaves) c._rdWaves = new Map();
  const key = id + '|' + Math.round(midi * 4) + '|' + Math.round(vb * 4);
  let hit = c._rdWaves.get(key);
  if (hit) return hit;
  const real = new Float32Array(kMax + 1), imag = new Float32Array(kMax + 1);
  let pw = 0;
  for (let k = 1; k <= kMax; k++) {
    const a = Math.pow(10, (tb.h[k - 1] === undefined ? -70 : tb.h[k - 1]) / 20);
    imag[k] = a; pw += a * a / 2;
  }
  const norm = 1 / Math.sqrt(pw || 1);
  hit = { wave: c.createPeriodicWave(real, imag, { disableNormalization: true }), norm };
  c._rdWaves.set(key, hit);
  return hit;
}

function sustainedVoice(c, out, t, f, vel, id) {
  const fit = FIT()[id];
  const tune = TUNE[id];
  if (!fit || !fit.zones || !fit.zones.length) return synthVoice(c, out, t, f, vel);
  const midi = freqToMidiF(f);
  const vb = clamp01((vel - 0.3) / 0.55);
  const tb = fitTables(fit, midi, vb);
  const kMax = Math.max(2, Math.min(tb.h.length, Math.floor(Math.min(15000, c.sampleRate * 0.45) / f)));
  const { wave, norm } = waveFor(c, id, midi, vb, tb, kMax);
  const amp = tune.level * norm * (vel / 0.6) * Math.pow(10, clampTo(tb.g, -6, 6) * 0.5 / 20);
  const attack = clampTo(fit.attack || 0.06, 0.02, tune.attackMax);

  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(amp, t + attack);
  env.gain.linearRampToValueAtTime(amp * tune.sus, t + attack + 0.25);
  env.connect(out);

  let top = f;
  for (let k = kMax; k >= 1; k--) if (tb.h[k - 1] > -45) { top = k * f; break; }
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 0.4;
  const b0 = clampTo(fit.bright0 || 1, 0.35, 1);
  const open = Math.min(c.sampleRate * 0.45, Math.max(top * 1.5, f * 3));
  lp.frequency.setValueAtTime(Math.max(f * 2.5, open * b0 * b0), t);
  lp.frequency.linearRampToValueAtTime(open, t + tune.brightT + attack);
  lp.connect(env);

  const nodes = [];
  const oscs = tune.detune.map(dc => {
    const o = c.createOscillator();
    o.setPeriodicWave(wave);
    o.frequency.value = f;
    o.detune.setValueAtTime(dc - tune.scoop, t);
    if (tune.scoop) o.detune.linearRampToValueAtTime(dc, t + tune.scoopT);
    const share = c.createGain();
    share.gain.value = 1 / tune.detune.length;
    o.connect(share); share.connect(lp);
    o.start(t);
    nodes.push(o);
    return o;
  });

  const vib = fit.vib || { rate: 0, depth: 0 };
  if (vib.rate > 0 && vib.depth > 0.5) {
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.type = 'sine'; lfo.frequency.value = vib.rate;
    lg.gain.setValueAtTime(0, t);
    lg.gain.setValueAtTime(0, t + tune.vibDelay);
    lg.gain.linearRampToValueAtTime(vib.depth * tune.vibK, t + tune.vibDelay + tune.vibRise);
    lfo.connect(lg);
    oscs.forEach(o => lg.connect(o.detune));
    lfo.start(t);
    nodes.push(lfo);
  }

  const nz = fit.noise;
  if (nz && nz.db > -60) {
    const ns = noiseSource(c, t, true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = clampTo(nz.hz, Math.max(500, f * 1.5), 7000); bp.Q.value = 0.8;
    const ng = c.createGain();
    const lvl = amp * Math.pow(10, nz.db / 20) * tune.noiseK * 1.7;
    ng.gain.setValueAtTime(lvl * tune.noiseBurst, t);
    ng.gain.linearRampToValueAtTime(lvl, t + attack + 0.08);
    ns.connect(bp); bp.connect(ng); ng.connect(env);
    ns.start(t);
    nodes.push(ns);
  }

  let released = false;
  const h = {
    t0: t, endAt: Infinity,
    release(at) {
      if (released) return;
      released = true;
      const w = Math.max(at === undefined ? t : at, c.currentTime, t + 0.01);
      holdAndRelease(env.gain, w, tune.rel);
      const end = w + tune.rel * 2 + 0.05;
      nodes.forEach(n => { try { n.stop(end); } catch (e) {} });
      h.endAt = end;
    },
    stop(fade) {
      if (released) return;
      released = true;
      const w = Math.max(c.currentTime, t);
      holdAndRelease(env.gain, w, fade || 0.03);
      const end = w + (fade || 0.03) * 2 + 0.03;
      nodes.forEach(n => { try { n.stop(end); } catch (e) {} });
      h.endAt = end;
    },
  };
  return h;
}

function synthVoice(c, out, t, f, vel) {
  const o1 = c.createOscillator(), o2 = c.createOscillator();
  const filt = c.createBiquadFilter(), g = c.createGain();
  o1.type = o2.type = 'sawtooth';
  o1.frequency.value = f;
  o2.frequency.value = f * 1.006;
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(3200, t);
  filt.frequency.exponentialRampToValueAtTime(500, t + 0.9);
  filt.Q.value = 1.4;
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
  g.gain.setValueAtTime(vel * 0.7, t + 0.1);
  o1.connect(filt); o2.connect(filt);
  filt.connect(g); g.connect(out);
  o1.start(t); o2.start(t);
  let released = false;
  const h = {
    t0: t, endAt: Infinity,
    release(at) {
      if (released) return;
      released = true;
      const w = Math.max(at === undefined ? t : at, c.currentTime, t + 0.01);
      holdAndRelease(g.gain, w, 0.12);
      const end = w + 0.3;
      o1.stop(end); o2.stop(end);
      h.endAt = end;
    },
    stop(fade) {
      if (released) return;
      released = true;
      const w = Math.max(c.currentTime, t);
      holdAndRelease(g.gain, w, fade || 0.03);
      const end = w + 0.1;
      o1.stop(end); o2.stop(end);
      h.endAt = end;
    },
  };
  return h;
}

function kazooVoice(c, out, t, f, vel) {
  const k = 26;
  const real = new Float32Array(k + 1), imag = new Float32Array(k + 1);
  let pw = 0;
  for (let i = 1; i <= k; i++) { imag[i] = Math.pow(i, -0.8) * (i % 2 === 0 ? 0.9 : 1); pw += imag[i] * imag[i] / 2; }
  if (!c._rdKazoo) c._rdKazoo = c.createPeriodicWave(real, imag, { disableNormalization: true });
  const norm = 1 / Math.sqrt(pw);
  const o = c.createOscillator();
  o.setPeriodicWave(c._rdKazoo);
  o.frequency.value = f;
  o.detune.setValueAtTime(-60, t);
  o.detune.linearRampToValueAtTime(0, t + 0.05);

  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 5.6;
  lg.gain.setValueAtTime(0, t);
  lg.gain.setValueAtTime(0, t + 0.12);
  lg.gain.linearRampToValueAtTime(22, t + 0.5);
  lfo.connect(lg); lg.connect(o.detune);

  const buzz = c.createWaveShaper();
  const curve = new Float32Array(257);
  for (let i = 0; i < 257; i++) { const x = (i - 128) / 128; curve[i] = Math.tanh(x * 2.4); }
  buzz.curve = curve;
  const pre = c.createGain();
  pre.gain.value = 0.9;
  const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), f3 = c.createBiquadFilter();
  f1.type = 'peaking'; f1.frequency.value = 1050; f1.Q.value = 3; f1.gain.value = 9;
  f2.type = 'peaking'; f2.frequency.value = 2500; f2.Q.value = 4; f2.gain.value = 7;
  f3.type = 'lowpass'; f3.frequency.value = 6200; f3.Q.value = 0.5;

  const am = c.createGain();
  am.gain.value = 0.8;
  const rattle = c.createOscillator(), rg = c.createGain();
  rattle.frequency.value = 118; rg.gain.value = 0.2;
  rattle.connect(rg); rg.connect(am.gain);

  const env = c.createGain();
  const amp = 0.24 * norm * (vel / 0.6);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(amp, t + 0.03);
  env.gain.linearRampToValueAtTime(amp * 0.9, t + 0.25);

  o.connect(pre); pre.connect(buzz); buzz.connect(f1); f1.connect(f2); f2.connect(f3); f3.connect(am); am.connect(env); env.connect(out);

  const ns = noiseSource(c, t, true);
  const nb = c.createBiquadFilter();
  nb.type = 'bandpass'; nb.frequency.value = 3200; nb.Q.value = 0.9;
  const ng = c.createGain();
  ng.gain.value = amp * 0.09;
  ns.connect(nb); nb.connect(ng); ng.connect(env);

  const nodes = [o, lfo, rattle, ns];
  nodes.forEach(n => n.start(t));
  let released = false;
  const h = {
    t0: t, endAt: Infinity,
    release(at) {
      if (released) return;
      released = true;
      const w = Math.max(at === undefined ? t : at, c.currentTime, t + 0.01);
      holdAndRelease(env.gain, w, 0.08);
      const end = w + 0.2;
      nodes.forEach(n => { try { n.stop(end); } catch (e) {} });
      h.endAt = end;
    },
    stop(fade) {
      if (released) return;
      released = true;
      const w = Math.max(c.currentTime, t);
      holdAndRelease(env.gain, w, fade || 0.03);
      const end = w + 0.1;
      nodes.forEach(n => { try { n.stop(end); } catch (e) {} });
      h.endAt = end;
    },
  };
  return h;
}

function pluckedVoice(c, out, t, f, vel, id, o) {
  const fit = FIT()[id];
  const tune = TUNE[id];
  if (!fit || !fit.zones || !fit.zones.length) return synthVoice(c, out, t, f, vel);
  const midi = freqToMidiF(f);
  const vb = clamp01((vel - 0.3) / 0.55);
  const tb = fitTables(fit, midi, vb);
  const crowded = _active.length > 14;
  const nMax = Math.min(tb.h.length, crowded ? 8 : 24, Math.floor(Math.min(14000, c.sampleRate * 0.45) / f));
  const B = tb.B || 0;
  let pw = 0;
  const amps = [];
  for (let k = 1; k <= nMax; k++) {
    const a = Math.pow(10, tb.h[k - 1] / 20);
    amps.push(a); pw += a * a / 2;
  }
  const norm = 1 / Math.sqrt(pw || 1);
  const level = tune.level * norm * (vel / 0.6) * Math.pow(10, clampTo(tb.g, -6, 6) * 0.5 / 20);
  const damp = o.pedal ? clampTo(Math.max(o.dur || 0, tune.dry), tune.dry, tune.pedalMax) : tune.dry;
  const knee = 0.9;

  const master = c.createGain();
  master.gain.value = 1;
  master.connect(out);
  const nodes = [];
  const gains = [];
  const addPartial = (freq, a, k, detuneCents) => {
    if (a * level < 1e-4) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    if (detuneCents) o.detune.value = detuneCents;
    const d = clampTo(tb.d[k - 1], 0.1, 8), s = clampTo(tb.s[k - 1], 0.3, 30);
    const peak = a * level;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    const kneeLevel = peak * Math.pow(10, -3 * knee / d);
    g.gain.exponentialRampToValueAtTime(Math.max(kneeLevel, 1e-5), t + 0.003 + knee);
    const tail = Math.min(damp, 12);
    g.gain.exponentialRampToValueAtTime(Math.max(kneeLevel * Math.pow(10, -3 * Math.max(0, tail - knee) / s), 1e-6), t + 0.003 + Math.max(tail, knee + 0.05));
    o.connect(g); g.connect(master);
    o.start(t);
    nodes.push(o); gains.push(g);
  };
  for (let k = 1; k <= nMax; k++) {
    const fk = k * f * Math.sqrt(1 + B * k * k);
    addPartial(fk, amps[k - 1], k, 0);
    if (tune.twin && k <= 5) addPartial(fk, amps[k - 1] * 0.7, k, tune.twin * (k % 2 ? 1 : -1));
  }

  if (tune.thump) {
    const ns = noiseSource(c, t, false);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = clampTo(f * (id === 'harp' ? 6 : 3), 300, 6000); bp.Q.value = 1.1;
    const ng = c.createGain();
    const lv = level * 0.55 * tune.thump;
    ng.gain.setValueAtTime(lv, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + (id === 'harp' ? 0.02 : 0.03));
    ns.connect(bp); bp.connect(ng); ng.connect(master);
    ns.start(t); ns.stop(t + 0.06);
  }

  let released = false;
  const natural = t + Math.min(damp, 12) + 0.35;
  const h = {
    t0: t, endAt: natural,
    release(at) {
      if (released) return;
      released = true;
      const w = Math.max(at === undefined ? t : at, c.currentTime, t + 0.01);
      holdAndRelease(master.gain, w, 0.12);
      const end = w + 0.3;
      nodes.forEach(n => { try { n.stop(end); } catch (e) {} });
      h.endAt = Math.min(h.endAt, end);
    },
    stop(fade) {
      if (released) return;
      released = true;
      const w = Math.max(c.currentTime, t);
      holdAndRelease(master.gain, w, fade || 0.03);
      const end = w + 0.12;
      nodes.forEach(n => { try { n.stop(end); } catch (e) {} });
      h.endAt = end;
    },
  };
  const stopAt = natural + 0.1;
  nodes.forEach(n => n.stop(stopAt));
  return h;
}

const DRUM_BY_PC = ['kick', 'rim', 'tomLo', 'clap', 'snare', 'tomMid', 'hatOpen', 'hatClosed', 'tomHi', 'ride', 'cowbell', 'crash'];
const DRUM_LABELS = {
  kick:'Kick', rim:'Rim shot', tomLo:'Floor tom', clap:'Clap', snare:'Snare', tomMid:'Mid tom',
  hatOpen:'Open hat', hatClosed:'Closed hat', tomHi:'High tom', ride:'Ride', cowbell:'Cowbell', crash:'Crash',
};
function drumPieceOf(freq) {
  const midi = Math.round(freqToMidiF(freq));
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  let piece = DRUM_BY_PC[pc];
  if (pc === 0 && oct >= 5) piece = 'crash';
  return { piece, oct, midi };
}
window.RD_drumLabel = freq => DRUM_LABELS[drumPieceOf(freq).piece];
window.RD_drumPiece = freq => drumPieceOf(freq).piece;

function noiseHit(c, out, t, o) {
  const ns = noiseSource(c, t, false);
  const f = c.createBiquadFilter();
  f.type = o.type || 'bandpass'; f.frequency.value = o.freq; f.Q.value = o.q || 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.lvl, t + (o.att || 0.002));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dec);
  ns.connect(f); f.connect(g); g.connect(out);
  ns.start(t, o.off || 0); ns.stop(t + o.dec + 0.05);
}

function toneHit(c, out, t, o) {
  const os = c.createOscillator(), g = c.createGain();
  os.type = o.type || 'sine';
  os.frequency.setValueAtTime(o.f0, t);
  if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + (o.sweep || 0.06));
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.lvl, t + (o.att || 0.002));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dec);
  os.connect(g); g.connect(out);
  os.start(t); os.stop(t + o.dec + 0.05);
}

function metalHit(c, out, t, o) {
  const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
  const g = c.createGain(), hp = c.createBiquadFilter(), bp = c.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = o.hp;
  bp.type = 'bandpass'; bp.frequency.value = o.bp; bp.Q.value = o.q || 0.7;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.lvl, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dec);
  const oscs = ratios.map(r => {
    const os = c.createOscillator();
    os.type = 'square'; os.frequency.value = o.base * r;
    os.connect(hp); os.start(t); os.stop(t + o.dec + 0.05);
    return os;
  });
  hp.connect(bp); bp.connect(g); g.connect(out);
  return oscs;
}

function drumVoice(c, out, t, f, vel) {
  const { piece, oct } = drumPieceOf(f);
  const v = (vel / 0.6) * 0.42;
  const tune = Math.pow(2, (oct - 4) * 0.2);
  switch (piece) {
    case 'kick':
      toneHit(c, out, t, { f0: 150, f1: 44, sweep: 0.07, lvl: v * 1.3, dec: 0.34 });
      noiseHit(c, out, t, { type: 'lowpass', freq: 1800, q: 0.7, lvl: v * 0.35, dec: 0.012 });
      break;
    case 'snare':
      toneHit(c, out, t, { f0: 215, f1: 185, sweep: 0.04, type: 'triangle', lvl: v * 0.85, dec: 0.16 });
      noiseHit(c, out, t, { freq: 2600, q: 0.28, lvl: v * 1.4, dec: 0.22 });
      noiseHit(c, out, t, { freq: 400, q: 0.5, lvl: v * 0.5, dec: 0.14 });
      break;
    case 'rim':
      toneHit(c, out, t, { f0: 900, type: 'triangle', lvl: v * 0.7, dec: 0.24 });
      toneHit(c, out, t, { f0: 460, type: 'triangle', lvl: v * 0.4, dec: 0.2 });
      noiseHit(c, out, t, { freq: 1900, q: 0.35, lvl: v * 0.7, dec: 0.3 });
      noiseHit(c, out, t, { freq: 600, q: 0.8, lvl: v * 0.6, dec: 0.22 });
      break;
    case 'clap':
      [0, 0.011, 0.022].forEach((d, i) => noiseHit(c, out, t + d, { freq: 1400, q: 1.1, lvl: v * 0.8, dec: i === 2 ? 0.2 : 0.02, att: 0.001 }));
      break;
    case 'tomLo': case 'tomMid': case 'tomHi': {
      const base = piece === 'tomLo' ? 82 : piece === 'tomMid' ? 118 : 165;
      toneHit(c, out, t, { f0: base * tune * 1.45, f1: base * tune, sweep: 0.1, lvl: v * 1.2, dec: 0.62 });
      noiseHit(c, out, t, { freq: 900, q: 0.4, lvl: v * 0.35, dec: 0.1 });
      noiseHit(c, out, t, { freq: 3200, q: 0.4, lvl: v * 0.18, dec: 0.06 });
      break;
    }
    case 'hatClosed':
      metalHit(c, out, t, { base: 320, hp: 7000, bp: 10000, q: 0.5, lvl: v * 0.55, dec: 0.055 });
      break;
    case 'hatOpen':
      metalHit(c, out, t, { base: 320, hp: 6500, bp: 9500, q: 0.5, lvl: v * 0.5, dec: 0.4 });
      break;
    case 'ride':
      metalHit(c, out, t, { base: 380, hp: 5000, bp: 7500, q: 0.6, lvl: v * 0.4, dec: 0.9 });
      toneHit(c, out, t, { f0: 5200, lvl: v * 0.05, dec: 0.5 });
      break;
    case 'crash':
      metalHit(c, out, t, { base: 190, hp: 300, bp: 2500, q: 0.3, lvl: v * 0.4, dec: 1.6 });
      noiseHit(c, out, t, { freq: 900, q: 0.35, lvl: v * 0.5, dec: 1.7 });
      noiseHit(c, out, t, { freq: 4500, q: 0.35, lvl: v * 0.45, dec: 1.4 });
      break;
    case 'cowbell':
      toneHit(c, out, t, { f0: 560, type: 'square', lvl: v * 0.3, dec: 0.28 });
      toneHit(c, out, t, { f0: 845, type: 'square', lvl: v * 0.3, dec: 0.22 });
      break;
  }
  const h = {
    t0: t, endAt: t + 1.5,
    release() {},
    stop() { h.endAt = 0; },
  };
  return h;
}

function voiceMaker(id) {
  switch (id) {
    case 'violin': case 'cello': case 'flute': case 'clarinet': case 'trumpet': case 'horn':
      return sustainedVoice;
    case 'harp': case 'piano':
      return pluckedVoice;
    case 'drums': return drumVoice;
    case 'kazoo': return kazooVoice;
    default: return synthVoice;
  }
}

window.RD_getContext = () => ctx();
window.RD_getMaster = () => masterGain();
window.RD_voiceCount = () => _active.length;

window.RD_noteOn = function (freq, opts) {
  opts = opts || {};
  const c = ctx();
  const id = resolveInst(opts.inst || _instrument);
  const t = Math.max(opts.when || 0, c.currentTime);
  const vel = opts.vel == null ? 0.6 : opts.vel;
  const maker = voiceMaker(id);
  const h = trackVoice(c, maker(c, masterGain(), t, freq, vel, id, { dur: opts.dur, pedal: !!opts.pedal }));
  if (opts.dur > 0 && maker !== pluckedVoice) h.release(t + opts.dur);
  return { release: at => h.release(at), stop: fade => h.stop(fade), voice: id };
};

function _playWithInstrument(freq, isDtap, sustainSec, instOverride) {
  const baseDur  = isDtap ? 0.62 : 0.42;
  const dur      = sustainSec > 0 ? Math.max(baseDur, sustainSec) : baseDur;
  const inst     = instOverride || _instrument;
  const pedal    = sustainSec > 0;
  window.RD_noteOn(freq, { inst, vel: 0.6, dur, pedal });
  if (isDtap) window.RD_noteOn(freq * Math.pow(2, 7 / 12), { inst, vel: 0.3, dur: Math.min(dur * 0.7, 0.55), pedal });
}

window.RD_playNote = function (lane, isDtap, freqOverride, sustainSec, inst) {
  const freq = freqOverride || laneFreqs[lane] || DEF_FREQS[lane] || 261.63;
  _playWithInstrument(freq, isDtap, sustainSec || 0, inst);
};

window.RD_playNoteFreq = function (freq, isDtap, sustainSec, inst) {
  _playWithInstrument(freq, isDtap, sustainSec || 0, inst);
};

function _synthNote(freq, vol, dur, dest) {
  const c = ctx(), t = c.currentTime;
  const o1 = c.createOscillator(), o2 = c.createOscillator();
  const filt = c.createBiquadFilter(), g = c.createGain();
  o1.type = o2.type = 'sawtooth';
  o1.frequency.value = freq;
  o2.frequency.value = freq * 1.006;
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(3200, t);
  filt.frequency.exponentialRampToValueAtTime(500, t + dur * 0.85);
  filt.Q.value = 1.4;
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.setValueAtTime(vol * 0.7, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o1.connect(filt); o2.connect(filt);
  filt.connect(g); g.connect(dest || masterGain());
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}


window.RD_flashLane = function (laneEl) {
  laneEl.style.transition = 'none';
  laneEl.style.background = 'var(--lane-flash)';
  setTimeout(() => {
    laneEl.style.transition = 'background 0.3s';
    laneEl.style.background = '';
  }, 80);
};

let bgMode   = 'none';
let bgTimer  = null;
let bgBeatMs = 500;
let bgStep   = 0;

function kick() {
  const c = ctx(), t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.07);
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.65, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g); g.connect(bgGain());
  o.start(t); o.stop(t + 0.18);
}

function snare() {
  const c = ctx(), t = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * 0.18, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = 2400; filt.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  src.connect(filt); filt.connect(g); g.connect(bgGain());
  src.start(t); src.stop(t + 0.2);
}

function hihat(vol) {
  const c = ctx(), t = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass'; filt.frequency.value = 9000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(filt); filt.connect(g); g.connect(bgGain());
  src.start(t); src.stop(t + 0.06);
}

const DRUM_PAT = ['K','h','S','h','K','h','S','h','K','h','S','h','K','h','S','H'];
function drumStep(s) {
  const p = DRUM_PAT[s % 16];
  if      (p === 'K') kick();
  else if (p === 'S') snare();
  else if (p === 'h') hihat(0.10);
  else if (p === 'H') hihat(0.18);
}

const BASS_PAT_DEFAULT = [
  NOTE_TABLE['C2'], 0, NOTE_TABLE['C2'], 0,
  NOTE_TABLE['F2'], 0, NOTE_TABLE['D2'], 0,
];
let bassPattern = [...BASS_PAT_DEFAULT];

function bassStep(s) {
  const f = bassPattern[s % bassPattern.length];
  if (f > 0) _synthNote(f, 0.28, 0.38, bgGain());
}

function bgTick() {
  if      (bgMode === 'drums') drumStep(bgStep);
  else if (bgMode === 'bass')  bassStep(bgStep);
  bgStep = (bgStep + 1) % 16;
}

window.RD_startBg = function (mode, bpm, customBassPattern) {
  window.RD_stopBg();
  bgMode = mode || 'none';
  if (bgMode === 'none') return;
  bassPattern = (customBassPattern && customBassPattern.length)
    ? customBassPattern
    : [...BASS_PAT_DEFAULT];
  bgBeatMs = Math.round((60000 / bpm) / 4);
  bgStep = 0;
  bgTick();
  bgTimer = setInterval(bgTick, bgBeatMs);
};

window.RD_updateBgBpm = function (bpm) {
  if (!bgTimer) return;
  clearInterval(bgTimer);
  bgBeatMs = Math.round((60000 / bpm) / 4);
  bgTimer = setInterval(bgTick, bgBeatMs);
};

window.RD_stopBg = function () {
  if (bgTimer) { clearInterval(bgTimer); bgTimer = null; }
  bgMode = 'none'; bgStep = 0;
};

window.RD_Audio = {
  playLaneNote:   window.RD_playNote,
  startMenuMusic: () => {},
  stopMenuMusic:  () => {},
};
