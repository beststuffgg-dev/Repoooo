window.RD_AutoChart = (function () {
  'use strict';

  const D = () => window.RD_StudioDSP;
  const DIFFICULTY = {
    easy:   { perSec: 1.3, chord: 1, maxHolds: 1 },
    medium: { perSec: 2.2, chord: 2, maxHolds: 2 },
    hard:   { perSec: 3.4, chord: 3, maxHolds: 3 },
  };
  const tick = () => new Promise(r => setTimeout(r, 0));

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
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

  function bandLevel(x, sr, start, n, freq) {
    if (start < 0 || start + n > x.length) return 0;
    const w = hann(n);
    let best = 0;
    for (const r of [0.988, 1, 1.012]) {
      const om = 2 * Math.PI * freq * r / sr, c = 2 * Math.cos(om);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < n; i++) { const s0 = x[start + i] * w[i] + c * s1 - s2; s2 = s1; s1 = s0; }
      const m = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) * 2 / n;
      if (m > best) best = m;
    }
    return best;
  }

  const STEP = 0.04;

  function noteTrace(x, sr, t, freq, maxDur) {
    const len = Math.round(0.09 * sr);
    const frames = Math.max(0, Math.floor(maxDur / STEP));
    const out = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      const start = Math.round((t + 0.02 + i * STEP) * sr);
      let e = 0;
      for (let h = 1; h <= 3; h++) if (freq * h < sr * 0.45) e += bandLevel(x, sr, start, len, freq * h);
      out[i] = e;
    }
    return out;
  }

  function noteLength(trace) {
    let peak = 0;
    for (let i = 0; i < Math.min(5, trace.length); i++) if (trace[i] > peak) peak = trace[i];
    if (peak < 1e-6) return 0;
    let low = Infinity;
    for (let i = 3; i < trace.length; i++) {
      if (trace[i] < low) low = trace[i];
      if (i > 4 && trace[i] > 1.7 * low && trace[i] > 0.25 * peak && low < 0.7 * peak) return (i - 1) * STEP;
      if (trace[i] < 0.3 * peak) return i * STEP;
    }
    return trace.length * STEP;
  }

  function timbre(x, sr, t, midi, trace) {
    const f0 = 440 * Math.pow(2, (midi - 69) / 12);
    const nfft = 8192, n = Math.round(0.2 * sr);
    const start = Math.round((t + 0.05) * sr);
    if (start + n > x.length) return null;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    const w = hann(n);
    for (let i = 0; i < n; i++) re[i] = x[start + i] * w[i];
    D().fft(re, im);
    const binHz = sr / nfft;
    const amps = [];
    for (let h = 1; h <= 16 && f0 * h < sr * 0.45; h++) {
      const c = Math.round(f0 * h / binHz);
      let m = 0;
      for (let k = c - 3; k <= c + 3; k++) m = Math.max(m, Math.hypot(re[k] || 0, im[k] || 0));
      amps.push(m);
    }
    const mx = Math.max(...amps, 1e-12);
    let rolloff = 0;
    amps.forEach((m, i) => { if (m / mx > 0.03) rolloff = i + 1; });
    const odd = amps.filter((_, i) => i % 2 === 0).reduce((a, m) => a + m * m, 0);
    const even = amps.filter((_, i) => i % 2 === 1).reduce((a, m) => a + m * m, 0);
    let high = 0, all = 0;
    for (let k = 1; k < nfft / 2; k++) { const e = re[k] * re[k] + im[k] * im[k]; all += e; if (k * binHz > 3000) high += e; }
    let decay = null;
    if (trace && trace.length > 9) {
      const early = Math.max(trace[1], trace[2]);
      if (early > 1e-6) decay = trace[8] / early;
    }
    return { rolloff, oddEven: even > 0 ? odd / even : 20, highFrac: all > 0 ? high / all : 0, decay };
  }

  function family(f, midi) {
    if (!f) return null;
    if (f.decay !== null && f.decay < 0.75) return 'plucked';
    if (f.rolloff >= 7 || f.highFrac > 0.1) return 'strings';
    return 'winds';
  }

  function voiceFor(fam, f, midi) {
    if (fam === 'plucked') return midi >= 80 ? 'harp' : 'piano';
    if (fam === 'strings') return midi >= 55 ? 'violin' : 'cello';
    if (fam === 'winds') {
      if (f && f.oddEven < 12) return midi >= 58 ? 'trumpet' : 'horn';
      return midi >= 72 ? 'flute' : 'clarinet';
    }
    return null;
  }

  function thinOnsets(onsets, perSec, dur) {
    const win = 4;
    const keep = new Set();
    for (let t0 = 0; t0 < dur; t0 += win) {
      const inWin = onsets.map((o, i) => ({ o, i })).filter(e => e.o.t >= t0 && e.o.t < t0 + win);
      inWin.sort((a, b) => b.o.strength - a.o.strength);
      inWin.slice(0, Math.max(1, Math.round(perSec * win))).forEach(e => keep.add(e.i));
    }
    return onsets.filter((_, i) => keep.has(i));
  }

  const FPS = 100;

  async function onsetCurve100(x, sr, progress) {
    const FRAME = 1024, HOP = Math.round(sr / FPS);
    const frames = Math.max(0, Math.floor((x.length - FRAME) / HOP));
    const flux = new Float32Array(frames);
    const re = new Float64Array(FRAME), im = new Float64Array(FRAME);
    const w = hann(FRAME);
    const bins = Math.min(FRAME / 2 - 1, Math.floor(7000 / (sr / FRAME)));
    let prev = new Float64Array(bins), cur = new Float64Array(bins);
    for (let f = 0; f < frames; f++) {
      const st = f * HOP;
      for (let i = 0; i < FRAME; i++) { re[i] = x[st + i] * w[i]; im[i] = 0; }
      D().fft(re, im);
      let sum = 0;
      for (let k = 1; k <= bins; k++) cur[k - 1] = Math.log(1 + 240 * Math.hypot(re[k], im[k]) / FRAME);
      for (let k = 0; k < bins; k++) {
        const ref = Math.max(prev[k > 1 ? k - 2 : 0], prev[k > 0 ? k - 1 : 0], prev[k], prev[k + 1 < bins ? k + 1 : k], prev[k + 2 < bins ? k + 2 : k]);
        const d = cur[k] - ref;
        if (d > 0) sum += d;
      }
      flux[f] = f ? sum : 0;
      const t = prev; prev = cur; cur = t;
      if (progress && f % 400 === 399) { progress(f / frames); await tick(); }
    }
    return { flux, hop: HOP, frame: FRAME, sr };
  }

  function pickLocal(curve, sens) {
    const flux = curve.flux, n = flux.length;
    if (!n) return [];
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) sm[i] = (flux[Math.max(0, i - 1)] + 2 * flux[i] + flux[Math.min(n - 1, i + 1)]) / 4;
    const fps = curve.sr / curve.hop, w = Math.round(0.209 * fps), nb = Math.max(2, Math.round(0.023 * fps));
    const prefix = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + sm[i];
    const R = Math.round(3 * curve.sr / curve.hop), stride = 16;
    const tops = [];
    for (let c = 0; c < n; c += stride) {
      const a = Math.max(0, c - R), b = Math.min(n, c + R);
      const arr = [];
      for (let i = a; i < b; i += 2) arr.push(sm[i]);
      arr.sort((x, y) => x - y);
      tops.push(arr[Math.floor(arr.length * 0.96)] || 1e-9);
    }
    const topAt = i => tops[Math.min(tops.length - 1, Math.round(i / stride))];
    const picks = [];
    for (let i = nb; i < n - nb; i++) {
      const lo = Math.max(0, i - w), hi = Math.min(n, i + w + 1);
      const mean = (prefix[hi] - prefix[lo]) / (hi - lo);
      const top = topAt(i);
      if (sm[i] < mean * (1.25 / sens) + 0.06 * top) continue;
      let isPeak = true;
      for (let d = 1; d <= nb && isPeak; d++) if (sm[i] < sm[i - d] || sm[i] < sm[i + d]) isPeak = false;
      if (!isPeak) continue;
      picks.push(i);
    }
    const minGap = Math.round(0.06 * curve.sr / curve.hop);
    const out = [];
    for (const i of picks) {
      const last = out[out.length - 1];
      if (last !== undefined && i - last < minGap) { if (sm[i] > sm[last]) out[out.length - 1] = i; } else out.push(i);
    }
    const after = Math.round(0.14 * curve.sr / curve.hop);
    const kept = out.filter((i, idx) => {
      for (let j = idx - 1; j >= 0 && i - out[j] <= after; j--) if (sm[out[j]] >= 0.7 * sm[i]) return false;
      return true;
    });
    return kept.map(i => ({ t: Math.max(0, (i * curve.hop + curve.frame * 0.4) / curve.sr - 0.0115), strength: Math.min(1.5, sm[i] / topAt(i)) }));
  }

  const MINP = 10, MAXP = 30, NEED = 3;
  const specCache = new WeakMap();

  function cluster(passes) {
    const items = [];
    passes.forEach((ns, p) => ns.forEach(n => items.push({ p, n, midi: n.midi, t: n.t })));
    items.sort((a, b) => a.midi - b.midi || a.t - b.t);
    const groups = [];
    items.forEach(it => {
      const g = groups[groups.length - 1];
      if (g && g.midi === it.midi && it.t - g.last <= 0.16) { g.items.push(it); g.last = it.t; }
      else groups.push({ midi: it.midi, last: it.t, items: [it] });
    });
    groups.forEach(g => { g.votes = new Set(g.items.map(i => i.p)).size; });
    return groups;
  }

  function tally(passes) {
    const gs = cluster(passes);
    const ok = gs.filter(g => g.votes >= NEED).length;
    return { agreed: ok, pending: gs.filter(g => g.votes === NEED - 1).length > 0.08 * Math.max(1, ok) };
  }

  function median(a) { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; }

  function agreedNotes(passes) {
    return cluster(passes).filter(g => g.votes >= Math.min(NEED, passes.length)).map(g => ({
      midi: g.midi, freq: g.items[0].n.freq, t: median(g.items.map(i => i.n.t)), end: median(g.items.map(i => i.n.end)),
      level: median(g.items.map(i => i.n.level)), rise: median(g.items.map(i => i.n.rise)), votes: g.votes
    }));
  }

  function toEvents(notes, onsets, top, cfg, pcm, sr) {
    const diffs = [];
    notes.forEach(n => {
      let best = null;
      for (const o of onsets) { const d = n.t - o.t; if (Math.abs(d) < 0.16 && (best === null || Math.abs(d) < Math.abs(best))) best = d; }
      if (best !== null) diffs.push(best);
    });
    const bias = diffs.length > 8 ? median(diffs) : 0;
    notes.forEach(n => { n.t -= bias; n.end -= bias; });
    notes = notes.filter(n => {
      for (const o of onsets) if (Math.abs(n.t - o.t) < 0.09) return true;
      return n.rise >= 5 || n.end - n.t >= 0.3;
    });
    notes.forEach(n => {
      let best = null;
      for (const o of onsets) if (Math.abs(n.t - o.t) < 0.06 && (best === null || Math.abs(n.t - o.t) < Math.abs(n.t - best.t))) best = o;
      if (best) n.t = best.t;
      n.t = Math.max(0, n.t);
      n.length = Math.max(0.1, n.end - n.t);
      n.strength = Math.max(0, Math.min(1, (n.level - (top - 50)) / 50)) * 0.6 + Math.max(0, Math.min(1, n.rise / 18)) * 0.4;
    });
    notes.sort((a, b) => a.t - b.t || a.midi - b.midi);
    const events = [];
    notes.forEach(n => {
      const e = events[events.length - 1];
      if (e && n.t - e.t < 0.045) e.notes.push(n);
      else events.push({ t: n.t, notes: [n] });
    });
    events.forEach(e => {
      e.notes.sort((a, b) => b.strength - a.strength);
      e.notes = e.notes.slice(0, cfg.chord).sort((a, b) => a.midi - b.midi);
      e.strength = Math.max.apply(null, e.notes.map(n => n.strength));
    });
    return events;
  }

  async function analyse(pcm, sr, opts, progress) {
    const dur = pcm.length / sr;
    const cfg = opts.full ? { perSec: 1e3, chord: 6, maxHolds: 8 } : (DIFFICULTY[opts.difficulty] || DIFFICULTY.medium);
    const step = (p, msg) => progress && progress(p, msg);
    const S = window.RD_Spectro;

    step(0, 'Reading the spectrogram');
    let spec = specCache.get(pcm);
    if (!spec) { spec = await S.spectrogram(pcm, sr, p => step(p * 0.55, 'Reading the spectrogram')); specCache.set(pcm, spec); S.notesFor(spec, 0); }
    const curve = await onsetCurve100(pcm, sr, p => step(0.55 + p * 0.1, 'Listening for note starts'));
    const allOnsets = pickLocal(curve, 1.3);
    const tempo = D().estimateTempo(curve, D().pickOnsets(curve));

    const passes = [];
    let agreed = 0;
    while (passes.length < MAXP) {
      step(0.65 + 0.3 * passes.length / MAXP, 'Pass ' + (passes.length + 1) + ': finding notes');
      await tick();
      passes.push(S.notesFor(spec, passes.length));
      if (passes.length < MINP) continue;
      const c = tally(passes);
      const settled = Math.abs(c.agreed - agreed) <= 0.03 * Math.max(1, c.agreed);
      agreed = c.agreed;
      if (!c.pending || (passes.length > MINP && settled)) break;
    }
    const all = agreedNotes(passes);
    let events = toEvents(all, allOnsets, spec._ctx.top, cfg, pcm, sr);

    const win = 4, keep = [];
    for (let t0 = 0; t0 < dur; t0 += win) {
      const inWin = events.filter(e => e.t >= t0 && e.t < t0 + win).sort((a, b) => b.strength - a.strength);
      keep.push.apply(keep, inWin.slice(0, Math.max(1, Math.round(cfg.perSec * (opts.density || 1) * win))));
    }
    events = keep.sort((a, b) => a.t - b.t);

    if (opts.instruments !== false) {
      for (let i = 0; i < events.length; i++) {
        const e = events[i], top = e.notes[e.notes.length - 1];
        const reach = Math.min(6, Math.max(0.6, top.length));
        const tr = noteTrace(pcm, sr, e.t, top.freq, reach);
        e.feat = timbre(pcm, sr, e.t, top.midi, tr);
        e.fam = family(e.feat, top.midi);
        if (i % 40 === 39) await tick();
      }
      for (let i = 0; i < events.length; i++) {
        const votes = {};
        for (let j = Math.max(0, i - 3); j <= Math.min(events.length - 1, i + 3); j++) {
          const f = events[j].fam;
          if (f) votes[f] = (votes[f] || 0) + (j === i ? 1.5 : 1);
        }
        const best = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0] || null;
        events[i].family = best;
        const top = events[i].notes[events[i].notes.length - 1];
        events[i].inst = voiceFor(best, events[i].fam === best ? events[i].feat : null, top.midi);
      }
    }
    step(1, 'Done');
    return { events, tempo, onsets: allOnsets.length, kept: events.length, duration: dur, passes: passes.length, agreed };
  }

  function layout(analysis, opts) {
    const cfg = DIFFICULTY[opts.difficulty] || DIFFICULTY.medium;
    const lanes = opts.lanes || 4;
    const rand = rng(opts.seed || 1);
    const bpm = opts.bpm || analysis.tempo.bpm;
    const offset = opts.offset === undefined ? analysis.tempo.offset : opts.offset;
    const events = analysis.events;
    const iois = [];
    for (let i = 1; i < events.length; i++) iois.push(events[i].t - events[i - 1].t);
    iois.sort((a, b) => a - b);
    const med = iois.length ? iois[Math.floor(iois.length / 2)] : 1;
    const res = opts.res || (med < 0.6 * 60 / bpm ? 2 : 1);
    const rowSec = 60 / bpm / res;

    const all = [];
    events.forEach(e => e.notes.forEach(n => all.push(n.midi)));
    all.sort((a, b) => a - b);
    const q = f => all[Math.min(all.length - 1, Math.floor(f * all.length))] || 60;
    const cuts = [];
    for (let i = 1; i < lanes; i++) cuts.push(q(i / lanes));
    const bandOf = m => { let l = 0; while (l < cuts.length && m > cuts[l]) l++; return Math.min(lanes - 1, l); };

    const rows = [];
    const ensure = r => { while (rows.length <= r) rows.push(new Array(lanes).fill(null)); };
    const busy = new Array(lanes).fill(-1);
    const holds = [];
    let prevLane = -1, prevT = -9, madeHolds = 0, instCount = {};

    events.forEach(ev => {
      let row = Math.max(0, Math.round((ev.t - offset) / rowSec));
      const notes = ev.notes.slice().sort((a, b) => a.midi - b.midi);
      let guard = 0, picks = null;
      while (guard++ < 24 && !picks) {
        ensure(row);
        const used = new Set();
        const tryPick = [];
        let ok = true;
        notes.forEach((n, idx) => {
          const base = bandOf(n.midi);
          const single = cfg.chord === 1 && rows[row].some(Boolean);
          const options = single ? [] : [base, base - 1, base + 1].filter(l => l >= 0 && l < lanes && !used.has(l) && !rows[row][l] && busy[l] < row);
          if (!options.length) { ok = false; return; }
          const w = options.map(l => (l === base ? 0.62 : 0.19) * ((l === prevLane && ev.t - prevT < 0.35) ? 0.35 : 1));
          let r = rand() * w.reduce((a, b) => a + b, 0), pick = options[0];
          for (let k = 0; k < options.length; k++) { r -= w[k]; if (r <= 0) { pick = options[k]; break; } }
          used.add(pick);
          tryPick.push({ lane: pick, n });
        });
        if (ok) picks = tryPick; else row++;
      }
      if (!picks) return;
      ensure(row);
      picks.sort((a, b) => a.n.midi - b.n.midi);
      const lane = picks.map(p => p.lane).sort((a, b) => a - b);
      picks.forEach((p, i) => { p.lane = lane[i]; });
      const live = holds.filter(h => h > row).length;
      picks.forEach(p => {
        const cell = { type: 'tap', freq: p.n.freq, sustain: 0 };
        if (ev.inst) { cell.inst = ev.inst; instCount[ev.inst] = (instCount[ev.inst] || 0) + 1; }
        const rowsLong = Math.round(p.n.length / rowSec) - 1;
        if (opts.holds !== false && p.n.length >= Math.max(0.55, 1.1 * 60 / bpm) && rowsLong >= 1 && live + 1 <= cfg.maxHolds && madeHolds < 1e9) {
          const n = Math.min(8, rowsLong);
          cell.hold = n;
          busy[p.lane] = row + n;
          holds.push(row + n);
          madeHolds++;
        }
        rows[row][p.lane] = cell;
      });
      prevLane = picks[picks.length - 1].lane;
      prevT = ev.t;
    });
    ensure(rows.length + 1);

    const mainInst = Object.keys(instCount).sort((a, b) => instCount[b] - instCount[a])[0] || 'piano';
    const notesN = rows.flat().filter(Boolean).length;
    const level = {
      name: (opts.name || 'Auto level').slice(0, 28),
      bpm: Math.max(40, Math.min(260, Math.round(bpm * res))),
      diff: opts.difficulty || 'medium',
      lanes,
      instrument: mainInst,
      grid: rows,
      bgMode: 'none',
      laneFreqs: window.RD_Lanes ? window.RD_Lanes.defaultFreqs(lanes) : undefined,
      bassPattern: [],
    };
    if (res > 1) level.scrollRows = 4 * res;
    return { level, stats: { notes: notesN, holds: madeHolds, rows: rows.length, res, bpm: level.bpm, instruments: instCount, seconds: analysis.duration } };
  }

  return { DIFFICULTY, analyse, layout, noteTrace, noteLength, timbre, family, voiceFor, rng };
})();
