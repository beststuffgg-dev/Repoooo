window.RD_Spectro = (function () {
  'use strict';

  const LO = 24, HI = 108, NM = HI - LO + 1;
  const HOP = 512;
  const NS = 4096, NL = 16384;
  const SPLIT = 60;
  const tick = () => new Promise(r => setTimeout(r, 0));
  const D = () => window.RD_StudioDSP;
  const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

  function binRange(m, n, sr) {
    const hz = sr / n;
    const lo = midiFreq(m - 0.5) / hz, hi = midiFreq(m + 0.5) / hz;
    let a = Math.ceil(lo), b = Math.floor(hi);
    if (b < a) { a = Math.round(midiFreq(m) / hz); b = a; }
    return [a, b];
  }

  async function spectrogram(pcm, sr, progress) {
    const frames = Math.max(0, Math.floor((pcm.length - NS) / HOP) + 1);
    const mag = new Float32Array(frames * NM);
    const ds = D();
    const hs = new Float64Array(NS), hl = new Float64Array(NL);
    for (let i = 0; i < NS; i++) hs[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (NS - 1));
    for (let i = 0; i < NL; i++) hl[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (NL - 1));
    const gs = 2 / (NS / 2), gl = 2 / (NL / 2);
    const rs = [], rl = [];
    for (let m = LO; m <= HI; m++) { rs.push(binRange(m, NS, sr)); rl.push(binRange(m, NL, sr)); }
    const reS = new Float64Array(NS), imS = new Float64Array(NS), reL = new Float64Array(NL), imL = new Float64Array(NL);
    const shortM = new Float32Array(frames * NM);
    for (let f = 0; f < frames; f++) {
      const st = f * HOP;
      for (let i = 0; i < NS; i++) { reS[i] = pcm[st + i] * hs[i]; imS[i] = 0; }
      ds.fft(reS, imS);
      for (let k = 0; k < NM; k++) {
        let mx = 0;
        for (let b = rs[k][0]; b <= rs[k][1]; b++) { const v = Math.hypot(reS[b], imS[b]); if (v > mx) mx = v; }
        shortM[f * NM + k] = mx * gs;
      }
      if (f % 2 === 0) {
        const c = st + NS / 2 - NL / 2;
        for (let i = 0; i < NL; i++) { const j = c + i; reL[i] = (j >= 0 && j < pcm.length ? pcm[j] : 0) * hl[i]; imL[i] = 0; }
        ds.fft(reL, imL);
        for (let k = 0; k < NM; k++) {
          let mx = 0;
          for (let b = rl[k][0]; b <= rl[k][1]; b++) { const v = Math.hypot(reL[b], imL[b]); if (v > mx) mx = v; }
          const val = mx * gl;
          mag[f * NM + k] = val;
          if (f + 1 < frames) mag[(f + 1) * NM + k] = val;
        }
      }
      if (f % 64 === 63) { progress && progress(f / frames); await tick(); }
    }
    const db = new Float32Array(frames * NM), sdb = new Float32Array(frames * NM);
    for (let f = 0; f < frames; f++) {
      for (let k = 0; k < NM; k++) {
        const i = f * NM + k, m = LO + k;
        const lv = m < SPLIT ? mag[i] : shortM[i];
        db[i] = 20 * Math.log10(lv + 1e-7);
        sdb[i] = 20 * Math.log10(shortM[i] + 1e-7);
      }
    }
    return { db, sdb, frames, hop: HOP, sr, nm: NM, lo: LO, shift: (m) => (m < SPLIT ? NL : NS) / 2 / sr };
  }

  function context(spec) {
    const { db, frames, nm, hop, sr } = spec;
    const band = new Float32Array(frames * nm);
    for (let f = 0; f < frames; f++) {
      const base = f * nm;
      for (let k = 0; k < nm; k++) {
        let mx = -200;
        const a = Math.max(0, k - 12), b = Math.min(nm - 1, k + 12);
        for (let j = a; j <= b; j++) if (db[base + j] > mx) mx = db[base + j];
        band[base + k] = mx;
      }
    }
    const r = Math.round(0.9 * sr / hop), stepF = 4;
    const ctx = new Float32Array(frames * nm);
    const coarse = [];
    for (let f = 0; f < frames; f += stepF) {
      const a = Math.max(0, f - r), b = Math.min(frames - 1, f + r);
      const row = new Float32Array(nm);
      for (let k = 0; k < nm; k++) {
        const arr = [];
        for (let i = a; i <= b; i += 3) arr.push(band[i * nm + k]);
        arr.sort((x, y) => x - y);
        row[k] = arr[Math.floor(arr.length * 0.8)];
      }
      coarse.push(row);
    }
    for (let f = 0; f < frames; f++) {
      const c = Math.min(coarse.length - 1, Math.round(f / stepF));
      for (let k = 0; k < nm; k++) ctx[f * nm + k] = coarse[c][k];
    }
    const all = [];
    for (let i = 0; i < db.length; i += 37) all.push(db[i]);
    all.sort((x, y) => x - y);
    const top = all[Math.floor(all.length * 0.999)];
    const med = new Float32Array(nm);
    for (let k = 0; k < nm; k++) {
      const col = [];
      for (let f = 0; f < frames; f += 3) col.push(db[f * nm + k]);
      col.sort((x, y) => x - y);
      med[k] = col[Math.floor(col.length / 2)];
    }
    const noise = top;
    return { ctx, top, med };
  }

  function detectFrames(spec, c, v) {
    const { db, frames, nm } = spec;
    const act = new Uint8Array(frames * nm);
    const loc = new Float32Array(nm);
    const cand = [];
    const OV = [[12, 2], [19, 0], [24, 0], [28, 0], [31, 0], [34, 0], [36, 0], [38, 0], [40, 0]];
    for (let f = 0; f < frames; f++) {
      const base = f * nm;
      for (let k = 0; k < nm; k++) {
        const a = Math.max(0, k - 7), b = Math.min(nm - 1, k + 7);
        const arr = [];
        for (let j = a; j <= b; j++) arr.push(db[base + j]);
        arr.sort((x, y) => x - y);
        loc[k] = arr[Math.floor(arr.length / 2)];
      }
      cand.length = 0;
      for (let k = 1; k < nm - 1 - 8; k++) {
        const d = db[base + k];
        const floor = Math.max(c.top - v.absRange, c.med[k] + v.medMargin, c.ctx[base + k] - v.range);
        if (d < floor || d < loc[k] + v.prom) continue;
        if (d < db[base + k - 1] || d < db[base + k + 1]) continue;
        cand.push(k);
      }
      const pbase = base - nm;
      if (f > 0) {
        for (let k = 1; k < nm - 1; k++) {
          if (!act[pbase + k] || cand.includes(k)) continue;
          const d = db[base + k];
          const floor = Math.max(c.top - v.absRange - v.hyst, c.med[k] + v.medMargin - v.hyst, c.ctx[base + k] - v.range - v.hyst);
          if (d < floor || d < loc[k] + v.prom * 0.4) continue;
          if (d < db[base + k - 1] || d < db[base + k + 1]) continue;
          if (d < db[pbase + k] - 10) continue;
          cand.push(k);
        }
        cand.sort((x, y) => x - y);
      }
      const kept = [];
      for (const k of cand) {
        let over = false;
        for (const [iv, gap] of OV) {
          const lk = k - iv;
          if (lk < 0) continue;
          if (kept.includes(lk) && db[base + k] < db[base + lk] - (LO + lk < 52 && iv <= 24 ? -v.lowOvertone : gap) + v.overtone) { over = true; break; }
        }
        if (over) continue;
        let kk = k;
        if (LO + k < v.fundBelow && k - 12 >= 0) {
          const lo = db[base + k - 12];
          if (lo > db[base + k] - v.fundGap && lo > Math.max(c.top - v.absRange, c.med[k - 12] + v.medMargin) && lo >= db[base + k - 13] - 1 && lo >= db[base + k - 11] - 1) kk = k - 12;
        }
        if (!kept.includes(kk)) kept.push(kk);
      }
      kept.sort((x, y) => db[base + y] - db[base + x]);
      kept.slice(0, v.maxNotes).forEach(k => { act[base + k] = 1; });
    }
    return act;
  }

  function tracks(spec, act, v) {
    const { frames, nm, db, sdb, hop, sr } = spec;
    const fr = hop / sr;
    const out = [];
    const gap = v.gapFrames;
    for (let k = 0; k < nm; k++) {
      const m = LO + k;
      let start = -1, lastOn = -1;
      const close = (end) => {
        if (start < 0) return;
        out.push({ k, m, f0: start, f1: end });
        start = -1;
      };
      for (let f = 0; f < frames; f++) {
        if (act[f * nm + k]) { if (start < 0) start = f; lastOn = f; }
        else if (start >= 0 && f - lastOn > gap) close(lastOn);
      }
      close(lastOn);
    }
    const notes = [];
    for (const t of out) {
      const k = t.k, m = t.m;
      const sh = (m < SPLIT ? NL : NS) / 2 / sr;
      const sm = (f) => spec.sdb[Math.max(0, Math.min(frames - 1, f)) * nm + k];
      const lm = (f) => spec.db[Math.max(0, Math.min(frames - 1, f)) * nm + k];
      const wide = (f) => {
        let mx = -200;
        for (let j = Math.max(0, k - 1); j <= Math.min(nm - 1, k + 1); j++) mx = Math.max(mx, spec.sdb[Math.max(0, Math.min(frames - 1, f)) * nm + j]);
        return mx;
      };
      const lowSearch = Math.round((m < SPLIT ? 0.45 : 0.2) / fr);
      let bestF = t.f0, bestRise = -1e9;
      for (let f = Math.max(2, t.f0 - lowSearch); f <= Math.min(frames - 3, t.f0 + Math.round(0.12 / fr)); f++) {
        const rise = sm(f + 2) - sm(f - 2);
        if (rise > bestRise) { bestRise = rise; bestF = f; }
      }
      const splits = [bestF];
      const seg = [];
      for (let f = t.f0; f <= t.f1; f++) seg.push(f);
      const sigF = (f) => (m < SPLIT ? Math.max(sm(f), lm(f)) : sm(f));
      let lastSplit = bestF;
      for (let f = Math.max(t.f0, bestF) + 3; f <= t.f1; f++) {
        if (f - lastSplit < Math.round(v.minSplit / fr)) continue;
        let mn = 1e9;
        for (let j = Math.max(lastSplit + 1, f - 8); j < f; j++) mn = Math.min(mn, sigF(j));
        const rise = sigF(f) - mn;
        const near = sm(f + 1) >= sm(f) && sm(f) >= sm(f - 1) - 0.5;
        if (rise >= v.restrike && near) {
          let pk = f; while (pk + 1 <= t.f1 && sm(pk + 1) > sm(pk)) pk++;
          splits.push(f); lastSplit = f; f = Math.max(f, pk);
        }
      }
      for (let i = 0; i < splits.length; i++) {
        const a = splits[i], b = i + 1 < splits.length ? splits[i + 1] - 1 : t.f1;
        const onsetFrames = a;
        const onT = onsetFrames * fr + NS / 2 / sr * 0.0 - 0.0;
        const end = b * fr + (m < SPLIT ? 0 : 0);
        let level = -200;
        for (let f = a; f <= Math.min(b, a + 6); f++) level = Math.max(level, wide(f));
        const lenFrames = b - a + 1;
        if (lenFrames * fr < v.minDur) continue;
        const rise = Math.max(0, sm(a + 2) - sm(a - 3));
        notes.push({ midi: m, t: onT, end, level, rise, freq: midiFreq(m) });
      }
    }
    return notes;
  }

  function params(seed) {
    const base = { lowOvertone: 26, absRange: 48, medMargin: 12, range: 34, hyst: 9, prom: 6, overtone: 0, fundBelow: 50, fundGap: 27, maxNotes: 6, gapFrames: 4, minDur: 0.09, minSplit: 0.12, restrike: 4.5 };
    if (!seed) return base;
    let s = seed * 2654435761 >>> 0;
    const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return Object.assign(base, {
      absRange: base.absRange + (r() - 0.5) * 6,
      medMargin: base.medMargin + (r() - 0.5) * 3,
      range: base.range + (r() - 0.5) * 6,
      prom: base.prom + (r() - 0.5) * 2,
      overtone: (r() - 0.5) * 2,
      restrike: base.restrike + (r() - 0.5) * 1.2,
      gapFrames: 3 + Math.floor(r() * 3),
      minDur: 0.08 + r() * 0.03
    });
  }

  function notesFor(spec, seed) {
    const v = params(seed);
    const c = spec._ctx || (spec._ctx = context(spec));
    const act = detectFrames(spec, c, v);
    return tracks(spec, act, v);
  }

  return { LO, HI, HOP, spectrogram, notesFor, params, context, detectFrames, tracks };
})();
