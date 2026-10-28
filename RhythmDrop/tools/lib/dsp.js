const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SR = 44100;

function decodeFile(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg failed on ' + file + ': ' + String(r.stderr));
  const b = r.stdout;
  const out = new Float32Array(b.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = b.readFloatLE(i * 4);
  return out;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

const hannCache = new Map();
function hann(n) {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    hannCache.set(n, w);
  }
  return w;
}

function magSpectrum(x, start, n, nfft) {
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  const w = hann(n);
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    const v = (x[start + i] || 0) * w[i];
    re[i] = v; wsum += w[i];
  }
  fft(re, im);
  const m = new Float64Array(nfft / 2);
  for (let i = 0; i < m.length; i++) m[i] = 2 * Math.hypot(re[i], im[i]) / wsum;
  return m;
}

function peakNear(mag, binHz, f, halfWidthHz) {
  const lo = Math.max(1, Math.floor((f - halfWidthHz) / binHz));
  const hi = Math.min(mag.length - 2, Math.ceil((f + halfWidthHz) / binHz));
  let best = lo, bv = -1;
  for (let i = lo; i <= hi; i++) if (mag[i] > bv) { bv = mag[i]; best = i; }
  const a = mag[best - 1], b = mag[best], c = mag[best + 1];
  const d = (a - 2 * b + c);
  const off = d !== 0 ? 0.5 * (a - c) / d : 0;
  return { f: (best + off) * binHz, a: b - 0.25 * (a - c) * off };
}

function rmsFrames(x, hop) {
  const out = [];
  for (let s = 0; s + hop <= x.length; s += hop) {
    let sum = 0;
    for (let i = 0; i < hop; i++) sum += x[s + i] * x[s + i];
    out.push(Math.sqrt(sum / hop));
  }
  return out;
}

const MEL_BANDS = 64;
function hzToMel(f) { return 2595 * Math.log10(1 + f / 700); }
function melToHz(m) { return 700 * (Math.pow(10, m / 2595) - 1); }

function melBank(nfft, sr) {
  const lo = hzToMel(40), hi = hzToMel(Math.min(16000, sr / 2 - 100));
  const pts = [];
  for (let i = 0; i < MEL_BANDS + 2; i++) pts.push(melToHz(lo + (hi - lo) * i / (MEL_BANDS + 1)));
  const bins = pts.map(f => f / (sr / nfft));
  const bank = [];
  for (let b = 0; b < MEL_BANDS; b++) {
    const row = new Float64Array(nfft / 2);
    for (let k = Math.floor(bins[b]); k <= Math.ceil(bins[b + 2]) && k < nfft / 2; k++) {
      let v = 0;
      if (k >= bins[b] && k <= bins[b + 1]) v = (k - bins[b]) / (bins[b + 1] - bins[b]);
      else if (k > bins[b + 1] && k <= bins[b + 2]) v = (bins[b + 2] - k) / (bins[b + 2] - bins[b + 1]);
      row[k] = Math.max(0, v);
    }
    bank.push(row);
  }
  return bank;
}

const bankCache = new Map();
function logMel(x, frame, hop, maxFrames) {
  const nfft = frame;
  let bank = bankCache.get(nfft);
  if (!bank) { bank = melBank(nfft, SR); bankCache.set(nfft, bank); }
  const frames = [];
  for (let s = 0; s + frame <= x.length && frames.length < maxFrames; s += hop) {
    const m = magSpectrum(x, s, frame, nfft);
    const row = new Float64Array(MEL_BANDS);
    for (let b = 0; b < MEL_BANDS; b++) {
      let e = 0;
      for (let k = 0; k < m.length; k++) if (bank[b][k]) e += bank[b][k] * m[k] * m[k];
      row[b] = 10 * Math.log10(e + 1e-12);
    }
    frames.push(row);
  }
  return frames;
}

function parseInstrument(dir) {
  const xml = fs.readFileSync(path.join(dir, 'Instrument.xml'), 'utf8');
  const out = [];
  const re = /<Sample>([\s\S]*?)<\/Sample>/g;
  let m, idx = 0;
  const samplesStart = xml.indexOf('<Samples>');
  const body = xml.slice(samplesStart);
  while ((m = re.exec(body))) {
    const s = m[1];
    const get = tag => { const mm = new RegExp('<' + tag + '>([^<]*)</' + tag + '>').exec(s); return mm ? mm[1] : null; };
    const name = get('Name');
    const base = parseInt(get('BaseNote'), 10);
    if (isNaN(base)) { idx++; continue; }
    const file = fs.readdirSync(path.join(dir, 'SampleData'))
      .find(f => f.startsWith('Sample' + String(idx).padStart(2, '0') + ' '));
    out.push({
      idx, name, base,
      noteStart: parseInt(get('NoteStart'), 10), noteEnd: parseInt(get('NoteEnd'), 10),
      velStart: parseInt(get('VelocityStart'), 10), velEnd: parseInt(get('VelocityEnd'), 10),
      file: file ? path.join(dir, 'SampleData', file) : null,
    });
    idx++;
  }
  return out;
}

const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);
const hzToMidi = f => 69 + 12 * Math.log2(f / 440);

module.exports = {
  SR, decodeFile, fft, hann, magSpectrum, peakNear, rmsFrames, logMel, MEL_BANDS,
  parseInstrument, midiToHz, hzToMidi,
};
