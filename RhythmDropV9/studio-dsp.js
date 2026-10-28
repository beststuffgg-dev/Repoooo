window.RD_StudioDSP = (function () {
  'use strict';

  const ANALYSIS_RATE = 22050;
  const FRAME = 1024;
  const HOP = 256;

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
      const half = len >> 1;
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const vr = re[b] * cr - im[b] * ci;
          const vi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - vr; im[b] = im[a] - vi;
          re[a] += vr; im[a] += vi;
          const nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  const windows = {};
  function hann(n) {
    if (!windows[n]) {
      const w = new Float64Array(n);
      for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
      windows[n] = w;
    }
    return windows[n];
  }

  function toMono(buffer) {
    const ch = buffer.numberOfChannels;
    const n = buffer.length;
    const out = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < n; i++) out[i] += d[i] / ch;
    }
    return out;
  }

  const tick = () => new Promise(r => setTimeout(r, 0));

  async function onsetCurve(x, sr, progress) {
    const frames = Math.max(0, Math.floor((x.length - FRAME) / HOP));
    const flux = new Float32Array(frames);
    const re = new Float64Array(FRAME), im = new Float64Array(FRAME);
    const w = hann(FRAME);
    const bins = Math.min(FRAME / 2 - 1, Math.floor(7000 / (sr / FRAME)));
    let prev = new Float64Array(bins), cur = new Float64Array(bins);
    for (let f = 0; f < frames; f++) {
      const s = f * HOP;
      for (let i = 0; i < FRAME; i++) { re[i] = x[s + i] * w[i]; im[i] = 0; }
      fft(re, im);
      let sum = 0;
      for (let k = 1; k <= bins; k++) cur[k - 1] = Math.log(1 + 240 * Math.hypot(re[k], im[k]) / FRAME);
      for (let k = 0; k < bins; k++) {
        const a = prev[k > 1 ? k - 2 : 0], b = prev[k > 0 ? k - 1 : 0], c = prev[k], d1 = prev[k + 1 < bins ? k + 1 : k], e = prev[k + 2 < bins ? k + 2 : k];
        const ref = Math.max(a, b, c, d1, e);
        const d = cur[k] - ref;
        if (d > 0) sum += d;
      }
      flux[f] = f ? sum : 0;
      const t = prev; prev = cur; cur = t;
      if (progress && f % 400 === 399) { progress(f / frames); await tick(); }
    }
    return { flux, hop: HOP, frame: FRAME, sr };
  }

  function pickOnsets(curve, opts) {
    opts = opts || {};
    const flux = curve.flux, n = flux.length;
    if (!n) return [];
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) sm[i] = (flux[Math.max(0, i - 1)] + 2 * flux[i] + flux[Math.min(n - 1, i + 1)]) / 4;
    const w = 18;
    const prefix = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + sm[i];
    const sorted = Array.from(sm).sort((a, b) => a - b);
    const top = sorted[Math.floor(n * 0.98)] || 1;
    const minGap = Math.round((opts.minGapSec || 0.06) * curve.sr / curve.hop);
    const sens = opts.sensitivity || 1;
    const picks = [];
    for (let i = 2; i < n - 2; i++) {
      const lo = Math.max(0, i - w), hi = Math.min(n, i + w + 1);
      const mean = (prefix[hi] - prefix[lo]) / (hi - lo);
      const thr = mean * (1.25 / sens) + 0.06 * top;
      if (sm[i] < thr) continue;
      if (sm[i] < sm[i - 1] || sm[i] < sm[i + 1] || sm[i] < sm[i - 2] || sm[i] < sm[i + 2]) continue;
      picks.push(i);
    }
    const out = [];
    for (const i of picks) {
      const last = out[out.length - 1];
      if (last !== undefined && i - last < minGap) {
        if (sm[i] > sm[last]) out[out.length - 1] = i;
      } else out.push(i);
    }
    const after = Math.round((opts.echoSec || 0.14) * curve.sr / curve.hop);
    const kept = out.filter((i, idx) => {
      for (let j = idx - 1; j >= 0 && i - out[j] <= after; j--) if (sm[out[j]] >= 0.7 * sm[i]) return false;
      return true;
    });
    const bias = opts.biasSec === undefined ? 0.0115 : opts.biasSec;
    return kept.map(i => ({ t: Math.max(0, (i * curve.hop + curve.frame * 0.4) / curve.sr - bias), strength: sm[i] / top }));
  }

  function estimateTempo(curve, onsetsList) {
    const flux = curve.flux, n = flux.length;
    if (n < 200) return { bpm: 120, offset: 0, confidence: 0 };
    let mean = 0;
    for (let i = 0; i < n; i++) mean += flux[i];
    mean /= n;
    const e = new Float32Array(n);
    for (let i = 0; i < n; i++) e[i] = Math.max(0, flux[i] - mean * 0.9);
    const fps = curve.sr / curve.hop;
    const lagMin = Math.floor(fps * 60 / 200), lagMax = Math.ceil(fps * 60 / 55);
    const ac = new Float64Array(lagMax * 4 + 2);
    for (let lag = 1; lag < ac.length; lag++) {
      let s = 0;
      for (let i = 0; i + lag < n; i++) s += e[i] * e[i + lag];
      ac[lag] = s / (n - lag);
    }
    let best = 0, bestLag = lagMin, second = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      const bpm = fps * 60 / lag;
      let score = ac[lag] + 0.5 * (ac[lag * 2] || 0) + 0.25 * (ac[lag * 3] || 0);
      const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.9, 2));
      score *= 0.55 + 0.45 * prior;
      if (score > best) { second = best; best = score; bestLag = lag; }
      else if (score > second) second = score;
    }
    let refined = bestLag;
    const a = ac[bestLag - 1], b = ac[bestLag], c = ac[bestLag + 1];
    const den = a - 2 * b + c;
    if (den !== 0) refined = bestLag + 0.5 * (a - c) / den;
    while (fps * 60 / refined < 80) refined /= 2;
    while (fps * 60 / refined > 170) refined *= 2;
    const bpm = fps * 60 / refined;
    const period = refined;
    const phaseBins = 48;
    const acc = new Float64Array(phaseBins);
    for (let i = 0; i < n; i++) {
      const ph = ((i % period) / period);
      acc[Math.min(phaseBins - 1, Math.floor(ph * phaseBins))] += e[i];
    }
    let bp = 0;
    for (let p = 0; p < phaseBins; p++) if (acc[p] > acc[bp]) bp = p;
    let offsetFrames = (bp + 0.5) / phaseBins * period;
    let offset = offsetFrames * curve.hop / curve.sr;
    if (onsetsList && onsetsList.length) {
      const beat = 60 / bpm;
      let bestO = offset, bestFit = -1;
      for (let d = -0.04; d <= 0.04; d += 0.005) {
        const o = offset + d;
        let fit = 0;
        for (const on of onsetsList) {
          const ph = ((on.t - o) / beat) % 1;
          const dist = Math.min(Math.abs(ph), 1 - Math.abs(ph));
          fit += on.strength * Math.exp(-Math.pow(dist * beat / 0.02, 2));
        }
        if (fit > bestFit) { bestFit = fit; bestO = o; }
      }
      offset = bestO;
    }
    const beatSec = 60 / bpm;
    offset = ((offset % beatSec) + beatSec) % beatSec;
    return { bpm: Math.round(bpm * 10) / 10, offset, confidence: best > 0 ? Math.min(1, (best - second) / best + 0.3) : 0 };
  }

  const FRACS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  function pitchesAt(x, sr, t, opts) {
    opts = opts || {};
    const maxNotes = opts.maxNotes || 3;
    const len = Math.max(0.09, Math.min(opts.len || 0.3, 0.45));
    const start = Math.max(0, Math.round((t + (opts.skip === undefined ? 0.025 : opts.skip)) * sr));
    const n = Math.min(Math.round(len * sr), x.length - start);
    if (n < 512) return [];
    const nfft = 16384;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    const w = hann(n);
    let energy = 0;
    for (let i = 0; i < n; i++) { const v = x[start + i] * w[i]; re[i] = v; energy += v * v; }
    if (energy / n < 1e-9) return [];
    fft(re, im);
    const half = nfft / 2;
    const binHz = sr / nfft;
    const mag = new Float64Array(half);
    for (let k = 0; k < half; k++) mag[k] = Math.hypot(re[k], im[k]);

    const fresh = new Float64Array(mag);
    const bStart = Math.round(t * sr) - n - Math.round(0.012 * sr);
    if (bStart >= 0 && opts.novelty !== false) {
      const bre = new Float64Array(nfft), bim = new Float64Array(nfft);
      for (let i = 0; i < n; i++) bre[i] = x[bStart + i] * w[i];
      fft(bre, bim);
      for (let k = 0; k < half; k++) fresh[k] = Math.max(0, mag[k] - 1.2 * Math.hypot(bre[k], bim[k]));
    }

    const white = new Float64Array(half);
    let top = 0;
    for (let k = 1; k < half; k++) if (fresh[k] > top) top = fresh[k];
    const gate = opts.gate === undefined ? 0.02 : opts.gate;
    for (let k = 1; k < half; k++) {
      const r = fresh[k] / (top + 1e-12);
      white[k] = r > gate ? Math.pow(r, opts.comp === undefined ? 0.5 : opts.comp) : 0;
    }

    const lowMidi = opts.lowMidi || 36, highMidi = opts.highMidi || 96;
    const nCand = highMidi - lowMidi + 1;
    const peakAt = (f, tolFrac) => {
      const c = f / binHz;
      const r = Math.max(1, Math.ceil(c * tolFrac));
      const lo = Math.max(1, Math.floor(c - r)), hi = Math.min(half - 2, Math.ceil(c + r));
      let m = 0;
      for (let k = lo; k <= hi; k++) if (white[k] > m) m = white[k];
      return m;
    };
    const salience = m => {
      const f0 = 440 * Math.pow(2, (m - 69) / 12);
      let s = 0, present = 0;
      for (let h = 1; h <= 10; h++) {
        const f = f0 * h;
        if (f > sr * 0.45) break;
        const p = peakAt(f, 0.022);
        if (p > 0) { s += p / Math.pow(h, opts.hexp === undefined ? 0.9 : opts.hexp); if (h <= 6) present++; }
      }
      if (present < 2) return 0;
      const p1 = peakAt(f0, 0.022);
      let pmax = p1;
      for (let h = 2; h <= 4; h++) pmax = Math.max(pmax, peakAt(f0 * h, 0.022));
      if (p1 < 0.06 * pmax) return 0;
      if (p1 < 0.15 * pmax) s *= 0.4;
      return s;
    };
    const clearHarmonics = m => {
      const f0 = 440 * Math.pow(2, (m - 69) / 12);
      for (let h = 1; h <= 14; h++) {
        const c = f0 * h / binHz;
        const r = Math.max(2, Math.ceil(c * 0.03));
        for (let k = Math.max(1, Math.floor(c - r)); k <= Math.min(half - 1, Math.ceil(c + r)); k++) white[k] = 0;
      }
    };

    const found = [];
    let firstScore = 0;
    for (let round = 0; round < maxNotes; round++) {
      let best = -1, bs = 0;
      for (let i = 0; i < nCand; i++) {
        if (found.some(f => Math.abs(f.midi - (lowMidi + i)) <= 1)) continue;
        const s = salience(lowMidi + i);
        if (s > bs) { bs = s; best = lowMidi + i; }
      }
      if (best < 0 || bs <= 0) break;
      if (round === 0) firstScore = bs;
      else if (bs < firstScore * (opts.minRatio || 0.32)) break;
      let pick = best;
      for (let d = 12; d <= 24 && pick - 12 >= lowMidi; d += 12) {
        const lower = pick - 12;
        const sl = salience(lower);
        const fund = peakAt(440 * Math.pow(2, (lower - 69) / 12), 0.02);
        if (sl >= bs * 0.72 && fund > 0.5) { pick = lower; bs = Math.max(bs, sl); } else break;
      }
      found.push({ midi: pick, freq: 440 * Math.pow(2, (pick - 69) / 12), score: bs, conf: Math.min(1, bs / Math.max(firstScore, 1e-9)) * (round === 0 ? 1 : 0.9) });
      clearHarmonics(pick);
    }
    const strong = found.length ? found[0].score : 0;
    found.forEach(f => { f.conf = Math.min(1, 0.35 + 0.65 * Math.min(1, strong / 6) ) * (f === found[0] ? 1 : f.score / strong); });
    return found.sort((a, b) => a.midi - b.midi);
  }

  function quantile(sorted, q) {
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  }

  function assignLanes(events, lanes) {
    const all = [];
    events.forEach(ev => ev.notes.forEach(n => all.push(n.midi)));
    all.sort((a, b) => a - b);
    if (!all.length) return events.map(() => []);
    const cuts = [];
    for (let i = 1; i < lanes; i++) cuts.push(quantile(all, i / lanes));
    const laneOf = m => { let l = 0; while (l < cuts.length && m >= cuts[l] + 0.0001 && m > cuts[l]) l++; return Math.min(lanes - 1, l); };
    return events.map(ev => {
      const used = new Set();
      const out = [];
      ev.notes.slice().sort((a, b) => a.midi - b.midi).forEach(n => {
        let l = laneOf(n.midi);
        while (used.has(l) && l < lanes - 1) l++;
        while (used.has(l) && l > 0) l--;
        if (used.has(l)) return;
        used.add(l);
        out.push({ lane: l, midi: n.midi, freq: n.freq });
      });
      return out;
    });
  }

  function buildGrid(events, opts) {
    const lanes = opts.lanes || 4;
    const res = opts.res || 1;
    const rowSec = 60 / opts.bpm / res;
    const laneNotes = assignLanes(events, lanes);
    const placed = [];
    events.forEach((ev, i) => {
      let row = Math.round((ev.t - opts.offset) / rowSec);
      if (row < 0) row = 0;
      placed.push({ row, ev, notes: laneNotes[i] });
    });
    placed.sort((a, b) => a.row - b.row || a.ev.t - b.ev.t);
    const rows = [];
    const ensure = r => { while (rows.length <= r) rows.push(new Array(lanes).fill(null)); };
    const laneBusyUntil = new Array(lanes).fill(-1);
    placed.forEach(p => {
      let row = p.row;
      const need = p.notes.map(n => n.lane);
      let guard = 0;
      while (guard++ < 64) {
        ensure(row);
        if (need.every(l => !rows[row][l] && laneBusyUntil[l] < row)) break;
        row++;
      }
      ensure(row);
      const holdRows = p.ev.hold ? Math.max(1, Math.round(p.ev.hold / rowSec)) : 0;
      if (holdRows) ensure(row + holdRows);
      p.notes.forEach(n => {
        const cell = { type: 'tap', freq: n.freq, sustain: 0 };
        if (holdRows) { cell.hold = holdRows; laneBusyUntil[n.lane] = row + holdRows; }
        rows[row][n.lane] = cell;
      });
    });
    ensure(rows.length + 1);
    return rows;
  }

  return { ANALYSIS_RATE, toMono, fft, onsetCurve, pickOnsets, estimateTempo, pitchesAt, assignLanes, buildGrid };
})();
