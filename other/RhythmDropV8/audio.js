// ═══════════════════════════════════════════
//  RhythmDrop V8 — audio.js
//
//  Twelve instruments, synthesized from oscillators and envelopes.
//  No samples and no network fetches, which is what lets the whole
//  game ship as a single file that requests nothing.
//
//  Seven of the twelve exist because the campaign needs them: each
//  area is composed for its own voice, and a chart that asks for a
//  lyre and gets a fallback stops sounding like the place it is set.
//
//  Per-note sustain/pedal (0 = off, 0.5–3.0 s), per-note instrument
//  override, full chromatic note table A1–C8.
// ═══════════════════════════════════════════

// ── AudioContext (lazy) ───────────────────
let _ctx = null;
function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Volume levels (0–1), persisted ────────
let _masterVol = parseFloat(localStorage.getItem('rd_master_vol'));
if (isNaN(_masterVol)) _masterVol = 1;
let _musicVol = parseFloat(localStorage.getItem('rd_music_vol'));
if (isNaN(_musicVol)) _musicVol = 1;

// ── Master gain, through a limiter ────────
//  Four lanes can fire in the same frame and a campaign chord stacks
//  three notes on one beat, so the naive sum clips constantly. The
//  limiter holds the sum without ducking the individual hits.
let _masterGain = null, _limiter = null;
function masterGain() {
  if (!_masterGain) {
    const c = ctx();
    _masterGain = c.createGain();
    _masterGain.gain.value = _masterVol;
    if (typeof c.createDynamicsCompressor === 'function') {
      _limiter = c.createDynamicsCompressor();
      _limiter.threshold.value = -8;
      _limiter.knee.value      = 6;
      _limiter.ratio.value     = 12;
      _limiter.attack.value    = 0.003;
      _limiter.release.value   = 0.18;
      _masterGain.connect(_limiter);
      _limiter.connect(c.destination);
    } else {
      _masterGain.connect(c.destination);
    }
  }
  return _masterGain;
}

// ── Music (background) gain — feeds master ──
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

// ══════════════════════════════════════════
//  FULL CHROMATIC FREQUENCY TABLE
// ══════════════════════════════════════════
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

// ── Lane default frequencies (C4 maj pentatonic) ──
const DEF_FREQS = [
  NOTE_TABLE['C4'],
  NOTE_TABLE['E4'],
  NOTE_TABLE['G4'],
  NOTE_TABLE['C5'],
];
let laneFreqs = [...DEF_FREQS];
window.RD_setLaneFreqs   = f  => { laneFreqs = f; };
window.RD_resetLaneFreqs = () => { laneFreqs = [...DEF_FREQS]; };

// ══════════════════════════════════════════
//  INSTRUMENT THEME
// ══════════════════════════════════════════
// The roster the baked campaign charts are resolved against. Removing
// one here without re-baking leaves levels asking for a voice that no
// longer exists — v8levels.js asserts the two stay in step.
let _instrument = 'synth';
window.RD_INSTRUMENTS = [
  { id:'synth',    label:'Synth',    icon:'🎛️' },
  { id:'piano',    label:'Piano',    icon:'🎹' },
  { id:'guitar',   label:'Guitar',   icon:'🎸' },
  { id:'marimba',  label:'Marimba',  icon:'🪘' },
  { id:'bell',     label:'Bell',     icon:'🔔' },
  { id:'flute',    label:'Flute',    icon:'🪈' },
  { id:'lyre',     label:'Lyre',     icon:'🎻' },
  { id:'brass',    label:'Brass',    icon:'🎺' },
  { id:'organ',    label:'Organ',    icon:'🎹' },
  { id:'strings',  label:'Strings',  icon:'🎻' },
  { id:'chiptune', label:'Chiptune', icon:'👾' },
  { id:'kalimba',  label:'Kalimba',  icon:'🎶' },
];
window.RD_setInstrument = id => { _instrument = id; };
window.RD_getInstrument = () => _instrument;

// ── Load saved instrument ──
(function () {
  const saved = localStorage.getItem('rd_instrument');
  if (saved) _instrument = saved;
})();

window.RD_saveInstrument = id => {
  _instrument = id;
  localStorage.setItem('rd_instrument', id);
};

// ══════════════════════════════════════════
//  SYNTHESIS — one function per instrument
// ══════════════════════════════════════════

// Shared helper: connect chain o→filt→g→master, start/stop
function _chain(osc, filt, g, dur) {
  if (filt) { osc.connect(filt); filt.connect(g); }
  else        osc.connect(g);
  g.connect(masterGain());
  osc.start(ctx().currentTime);
  osc.stop(ctx().currentTime + dur + 0.05);
}

// ─── SYNTH ────────────────────────────────
// Warm two-detuned-saw + lowpass sweep (original)
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

// ─── PIANO ────────────────────────────────
// Sampled-style: triangle fundamental + several harmonic partials
// Attack pluck spike, then exponential decay
function _pianoNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;

  // Fundamentals with slight detuning (piano string chorus effect)
  const partials = [
    { mult:1.0,    amp:1.00, type:'triangle' },
    { mult:2.0,    amp:0.35, type:'triangle' },
    { mult:3.0,    amp:0.18, type:'sine'     },
    { mult:4.0,    amp:0.09, type:'sine'     },
    { mult:0.9995, amp:0.45, type:'triangle' }, // unison detune for width
  ];

  partials.forEach(p => {
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = p.type;
    osc.frequency.value = freq * p.mult;

    // Piano envelope: sharp attack, steep initial decay, long tail
    const pk = vol * p.amp;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(pk, t + 0.005);    // fast attack
    g.gain.exponentialRampToValueAtTime(pk * 0.55, t + 0.05);
    g.gain.exponentialRampToValueAtTime(pk * 0.18, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(g); g.connect(masterGain());
    osc.start(t); osc.stop(t + dur + 0.05);
  });

  // Bright click transient (hammer strike)
  const click = c.createOscillator();
  const cg    = c.createGain();
  click.type  = 'sawtooth';
  click.frequency.value = freq * 5;
  cg.gain.setValueAtTime(vol * 0.25, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
  click.connect(cg); cg.connect(masterGain());
  click.start(t); click.stop(t + 0.025);
}

// ─── GUITAR ───────────────────────────────
// Karplus–Strong inspired: short noise burst through lowpass → decaying loop
// Approximated here with fast-decaying saw + filtered harmonics
function _guitarNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;

  // Body resonance: three partials mimicking string harmonics
  const partials = [
    { mult:1.0, amp:1.00, decay:dur },
    { mult:2.0, amp:0.50, decay:dur * 0.65 },
    { mult:3.0, amp:0.22, decay:dur * 0.40 },
    { mult:4.0, amp:0.10, decay:dur * 0.25 },
  ];

  partials.forEach(p => {
    const osc  = c.createOscillator();
    const filt = c.createBiquadFilter();
    const g    = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq * p.mult;

    // Guitar body low-pass (warm)
    filt.type = 'lowpass';
    filt.frequency.value = Math.min(freq * p.mult * 4, 5000);
    filt.Q.value = 0.6;

    const pk = vol * p.amp;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(pk, t + 0.004);       // pluck attack
    g.gain.exponentialRampToValueAtTime(pk * 0.6, t + 0.04); // settle
    g.gain.exponentialRampToValueAtTime(0.001, t + p.decay);

    osc.connect(filt); filt.connect(g); g.connect(masterGain());
    osc.start(t); osc.stop(t + p.decay + 0.05);
  });

  // Pick noise burst
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate);
  const bd  = buf.getChannelData(0);
  for (let i = 0; i < bd.length; i++) bd[i] = (Math.random() * 2 - 1) * (1 - i / bd.length);
  const src  = c.createBufferSource(); src.buffer = buf;
  const nf   = c.createBiquadFilter();
  nf.type = 'bandpass'; nf.frequency.value = freq * 2; nf.Q.value = 2;
  const ng = c.createGain();
  ng.gain.setValueAtTime(vol * 0.3, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(nf); nf.connect(ng); ng.connect(masterGain());
  src.start(t); src.stop(t + 0.05);
}

// ─── MARIMBA ──────────────────────────────
// Mallet hit: fast sine attack with overtones, quick initial decay, then long sustain
function _marimbaNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;

  const partials = [
    { mult:1.0,  amp:1.00 },
    { mult:3.95, amp:0.35 }, // marimba 2nd partial ~4×
    { mult:9.87, amp:0.10 }, // 3rd partial ~10×
  ];

  partials.forEach(p => {
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * p.mult;

    const pk = vol * p.amp;
    // Marimba: very fast attack, fast body decay, gentle long tail
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(pk, t + 0.002);
    g.gain.exponentialRampToValueAtTime(pk * 0.3, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur, dur * (p.amp)));

    osc.connect(g); g.connect(masterGain());
    osc.start(t); osc.stop(t + dur + 0.05);
  });

  // Mallet transient (noise burst)
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.012), c.sampleRate);
  const bd  = buf.getChannelData(0);
  for (let i = 0; i < bd.length; i++) bd[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const ng  = c.createGain();
  ng.gain.setValueAtTime(vol * 0.15, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
  src.connect(ng); ng.connect(masterGain());
  src.start(t); src.stop(t + 0.015);
}

// ─── BELL ─────────────────────────────────
// FM-style bell: carrier + modulator giving inharmonic ring
function _bellNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;

  // FM synthesis: carrier modulated by a slightly inharmonic modulator
  const modRatio  = 3.5;    // creates bell-like inharmonic spectrum
  const modDepth  = freq * 4;

  const mod  = c.createOscillator();
  const modG = c.createGain();
  mod.type  = 'sine';
  mod.frequency.value = freq * modRatio;
  modG.gain.setValueAtTime(modDepth, t);
  modG.gain.exponentialRampToValueAtTime(modDepth * 0.1, t + dur * 0.3);
  modG.gain.exponentialRampToValueAtTime(0.001, t + dur);
  mod.connect(modG);

  const car  = c.createOscillator();
  const carG = c.createGain();
  car.type  = 'sine';
  car.frequency.value = freq;
  modG.connect(car.frequency); // FM connection
  carG.gain.setValueAtTime(0.001, t);
  carG.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  carG.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.04);
  carG.gain.exponentialRampToValueAtTime(0.001, t + dur);
  car.connect(carG); carG.connect(masterGain());

  // Shimmer overtone (pure octave)
  const sh  = c.createOscillator();
  const shG = c.createGain();
  sh.type = 'sine'; sh.frequency.value = freq * 2.001;
  shG.gain.setValueAtTime(vol * 0.3, t);
  shG.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.5);
  sh.connect(shG); shG.connect(masterGain());

  mod.start(t);  mod.stop(t + dur + 0.05);
  car.start(t);  car.stop(t + dur + 0.05);
  sh.start(t);   sh.stop(t + dur * 0.5 + 0.05);
}

// ─── FLUTE ────────────────────────────────
// Near-pure sine with breath noise and a slow attack. The
// noise is what stops it sounding like a test tone.
function _fluteNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;

  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  // slight pitch scoop into the note, like a real embouchure
  o.frequency.setValueAtTime(freq * 0.988, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.07);       // slow attack
  g.gain.setValueAtTime(vol * 0.85, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(masterGain());
  o.start(t); o.stop(t + dur + 0.05);

  // second harmonic, quiet
  const o2 = c.createOscillator(), g2 = c.createGain();
  o2.type = 'sine'; o2.frequency.value = freq * 2;
  g2.gain.setValueAtTime(0.001, t);
  g2.gain.exponentialRampToValueAtTime(vol * 0.12, t + 0.09);
  g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8);
  o2.connect(g2); g2.connect(masterGain());
  o2.start(t); o2.stop(t + dur + 0.05);

  // breath
  const len = Math.max(1, Math.floor(c.sampleRate * Math.min(dur, 0.4)));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const bd = buf.getChannelData(0);
  for (let i = 0; i < len; i++) bd[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq * 2.4; bp.Q.value = 1.1;
  const bg = c.createGain();
  bg.gain.setValueAtTime(vol * 0.10, t);
  bg.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur, 0.35));
  src.connect(bp); bp.connect(bg); bg.connect(masterGain());
  src.start(t); src.stop(t + Math.min(dur, 0.4));
}

// ─── LYRE ─────────────────────────────────
// Gut string: bright pluck, fast decay, odd harmonics.
function _lyreNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;
  [{ m:1, a:1 }, { m:2, a:0.42 }, { m:3, a:0.26 }, { m:5, a:0.10 }].forEach(p => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = p.m === 1 ? 'triangle' : 'sine';
    o.frequency.value = freq * p.m;
    const pk = vol * p.a;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(pk, t + 0.004);
    g.gain.exponentialRampToValueAtTime(pk * 0.25, t + dur * 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur * (1 / p.m + 0.4));
    o.connect(g); g.connect(masterGain());
    o.start(t); o.stop(t + dur + 0.05);
  });
}

// ─── BRASS ────────────────────────────────
// Sawtooth through a filter that opens as the note speaks —
// that rising brightness is the whole character of a horn.
function _brassNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;
  const o1 = c.createOscillator(), o2 = c.createOscillator();
  const f = c.createBiquadFilter(), g = c.createGain();
  o1.type = o2.type = 'sawtooth';
  o1.frequency.value = freq;
  o2.frequency.value = freq * 1.003;
  f.type = 'lowpass'; f.Q.value = 2.4;
  f.frequency.setValueAtTime(freq * 1.2, t);
  f.frequency.exponentialRampToValueAtTime(freq * 6, t + 0.10);   // it blooms
  f.frequency.exponentialRampToValueAtTime(freq * 2.4, t + dur);
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.045);
  g.gain.setValueAtTime(vol * 0.9, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(masterGain());
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

// ─── ORGAN ────────────────────────────────
// Drawbar stack: fundamental plus octaves and a fifth, all
// sustained flat with almost no envelope. That flatness is
// what makes it read as an organ rather than a pad.
function _organNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;
  [{ m:0.5, a:0.30 }, { m:1, a:1 }, { m:1.5, a:0.45 },
   { m:2, a:0.55 }, { m:3, a:0.22 }, { m:4, a:0.16 }].forEach(p => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq * p.m;
    const pk = vol * p.a * 0.55;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(pk, t + 0.02);
    g.gain.setValueAtTime(pk, t + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(masterGain());
    o.start(t); o.stop(t + dur + 0.05);
  });
}

// ─── STRINGS ──────────────────────────────
// Ensemble: several detuned saws, slow swell, gentle vibrato.
function _stringsNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;
  const f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'lowpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(freq * 2.2, t);
  f.frequency.linearRampToValueAtTime(freq * 4.5, t + dur * 0.6);

  const vib = c.createOscillator(), vibG = c.createGain();
  vib.type = 'sine'; vib.frequency.value = 5.2;
  vibG.gain.value = freq * 0.006;
  vib.connect(vibG);

  [0.994, 1, 1.006, 1.011].forEach(d => {
    const o = c.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = freq * d;
    vibG.connect(o.frequency);
    o.connect(f);
    o.start(t); o.stop(t + dur + 0.05);
  });

  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(vol * 0.6, t + Math.min(0.22, dur * 0.4));
  g.gain.setValueAtTime(vol * 0.55, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  f.connect(g); g.connect(masterGain());
  vib.start(t); vib.stop(t + dur + 0.05);
}

// ─── CHIPTUNE ─────────────────────────────
// Square wave with a duty sweep and a fast arpeggio blip, the
// way an NES stacked notes it could not play simultaneously.
function _chipNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol * 0.5, t);
  g.gain.setValueAtTime(vol * 0.5, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);   // stepped, not smooth
  o.connect(g); g.connect(masterGain());
  o.start(t); o.stop(t + dur + 0.02);

  // arpeggio blip on the fifth
  const o2 = c.createOscillator(), g2 = c.createGain();
  o2.type = 'square'; o2.frequency.setValueAtTime(freq * 1.5, t);
  g2.gain.setValueAtTime(vol * 0.22, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o2.connect(g2); g2.connect(masterGain());
  o2.start(t); o2.stop(t + 0.06);
}

// ─── KALIMBA ──────────────────────────────
// Thumb piano: pure-ish tine with a wooden thunk under it.
function _kalimbaNote(freq, vol, dur) {
  const c = ctx(), t = c.currentTime;
  [{ m:1, a:1 }, { m:2.76, a:0.18 }, { m:5.4, a:0.06 }].forEach(p => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq * p.m;
    const pk = vol * p.a;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(pk, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur * (p.m === 1 ? 1 : 0.3));
    o.connect(g); g.connect(masterGain());
    o.start(t); o.stop(t + dur + 0.05);
  });
  const th = c.createOscillator(), tg = c.createGain();
  th.type = 'sine'; th.frequency.setValueAtTime(freq * 0.5, t);
  th.frequency.exponentialRampToValueAtTime(freq * 0.3, t + 0.04);
  tg.gain.setValueAtTime(vol * 0.3, t);
  tg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  th.connect(tg); tg.connect(masterGain());
  th.start(t); th.stop(t + 0.07);
}

// ══════════════════════════════════════════
//  UNIFIED PLAY FUNCTION
//  dur = base decay; sustainSec = extra pedal time (0 = off)
// ══════════════════════════════════════════
// instOverride lets a single note use a different voice from the
// level default, which is what makes multi-instrument songs work.

// ══════════════════════════════════════════
//  UNIFIED PLAY FUNCTION
//  dur = base decay; sustainSec = extra pedal time (0 = off)
// ══════════════════════════════════════════
// instOverride lets a single note name its own voice. Campaign charts
// use it: an area's lead and its accompaniment are different
// instruments inside the same song.
function _voice(id) {
  switch (id) {
    case 'piano':    return _pianoNote;
    case 'guitar':   return _guitarNote;
    case 'marimba':  return _marimbaNote;
    case 'bell':     return _bellNote;
    case 'flute':    return _fluteNote;
    case 'lyre':     return _lyreNote;
    case 'brass':    return _brassNote;
    case 'organ':    return _organNote;
    case 'strings':  return _stringsNote;
    case 'chiptune': return _chipNote;
    case 'kalimba':  return _kalimbaNote;
    default:         return _synthNote;
  }
}

function _playWithInstrument(freq, isDtap, sustainSec, instOverride) {
  const baseDur  = isDtap ? 0.62 : 0.42;
  // sustainSec extends the note's decay time (pedal effect)
  const dur      = sustainSec > 0 ? Math.max(baseDur, sustainSec) : baseDur;
  const play     = _voice(instOverride || _instrument);

  play(freq, isDtap ? 0.52 : 0.60, dur);

  // Double-tap: a fifth on top, in the same voice.
  if (isDtap) play(freq * 1.5, 0.28, Math.min(dur * 0.7, 0.55));
}

// ── Public game API ───────────────────────
// sustainSec: per-note pedal length (0 = off, 0.5–3.0)
window.RD_playNote = function (lane, isDtap, freqOverride, sustainSec, inst) {
  const freq = freqOverride || laneFreqs[lane] || DEF_FREQS[lane] || 261.63;
  _playWithInstrument(freq, isDtap, sustainSec || 0, inst);
};

window.RD_playNoteFreq = function (freq, isDtap, sustainSec, inst) {
  _playWithInstrument(freq, isDtap, sustainSec || 0, inst);
};

// ── Lane button glow flash ────────────────
window.RD_flashLane = function (laneEl) {
  laneEl.style.transition = 'none';
  laneEl.style.background = 'var(--lane-flash)';
  setTimeout(() => {
    laneEl.style.transition = 'background 0.3s';
    laneEl.style.background = '';
  }, 80);
};

// ═══════════════════════════════════════════
//  BACKGROUND SOUNDTRACK
// ═══════════════════════════════════════════
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
  if (f > 0) _synthNote(f, 0.28, 0.38, bgGain()); // bass always uses synth pluck
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
