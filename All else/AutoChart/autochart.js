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

  const MINP = 3, MAXP = 5, NEED = 3;
  const VARIANTS = [
    { sens: 1, skip: 0.025, lenK: 1 }, { sens: 1, skip: 0.035, lenK: 0.9 }, { sens: 1, skip: 0.018, lenK: 1.1 },
    { sens: 1, skip: 0.042, lenK: 0.95 }, { sens: 1, skip: 0.03, lenK: 1.05 }
  ];

  function cluster(passes) {
    const items = [];
    passes.forEach((ev, p) => ev.forEach(e => e.notes.forEach(n => items.push({ t: e.t, midi: n.midi, p, e, n }))));
    items.sort((a, b) => a.midi - b.midi || a.t - b.t);
    const groups = [];
    items.forEach(it => {
      const g = groups[groups.length - 1];
      if (g && g.midi === it.midi && it.t - g.last <= 0.07) { g.items.push(it); g.last = it.t; }
      else groups.push({ midi: it.midi, last: it.t, items: [it] });
    });
    groups.forEach(g => { g.votes = new Set(g.items.map(i => i.p)).size; });
    return groups;
  }

  function tally(passes) {
    const gs = cluster(passes);
    return { agreed: gs.filter(g => g.votes >= NEED).length, pending: gs.filter(g => g.votes === NEED - 1).length > 0.08 * Math.max(1, gs.filter(g => g.votes >= NEED).length) };
  }

  function consensus(passes) {
    const gs = cluster(passes).filter(g => g.votes >= Math.min(NEED, passes.length));
    const byEvent = new Map();
    gs.forEach(g => {
      const ts = g.items.map(i => i.t).sort((a, b) => a - b);
      const t = ts[Math.floor(ts.length / 2)];
      const lens = g.items.map(i => i.n.length).sort((a, b) => a - b);
      const first = g.items[0];
      const key = Math.round(t / 0.07);
      const note = { midi: g.midi, freq: first.n.freq, conf: first.n.conf, length: lens[Math.floor(lens.length / 2)], trace: first.n.trace, votes: g.votes };
      const ev = byEvent.get(key) || { t, strength: first.e.strength, notes: [], fam: first.e.fam, feat: first.e.feat };
      ev.notes.push(note);
      byEvent.set(key, ev);
    });
    const out = [...byEvent.values()].sort((a, b) => a.t - b.t);
    out.forEach(e => e.notes.sort((a, b) => a.midi - b.midi));
    return out;
  }

  async function onePass(pcm, sr, cfg, opts, curve, v, passNo, step, dur) {
    const all = D().pickOnsets(curve, { sensitivity: v.sens });
    const onsets = thinOnsets(all, cfg.perSec * (opts.density || 1), dur);
    const events = [];
    for (let i = 0; i < onsets.length; i++) {
      const o = onsets[i];
      const next = onsets[i + 1] ? onsets[i + 1].t : Infinity;
      const len = isFinite(next) ? Math.max(0.12, Math.min(0.32, next - o.t - 0.02)) : 0.3;
      const found = D().pitchesAt(pcm, sr, o.t, { maxNotes: cfg.chord, len: len * v.lenK, lowMidi: 31, skip: v.skip });
      if (found.length) {
        const reach = Math.min(6, (isFinite(next) ? next - o.t : 6) + 0.6);
        found.forEach(n => {
          if (n.midi >= 64 || n.midi - 12 < 28) return;
          const st = Math.round((o.t + 0.12) * sr), w = Math.round(0.3 * sr);
          const hi = bandLevel(pcm, sr, st, w, n.freq), lo = bandLevel(pcm, sr, st, w, n.freq / 2);
          if (lo > 0.015 * hi) { n.midi -= 12; n.freq = 440 * Math.pow(2, (n.midi - 69) / 12); }
        });
        const fresh = found.filter(n => {
          const ringing = events.some(e => e.notes.some(a => e.t + a.length > o.t - 0.03 && [0, 12, 19, 24].includes(n.midi - a.midi)));
          if (!ringing) return true;
          const w = Math.round(0.09 * sr);
          const before = bandLevel(pcm, sr, Math.max(0, Math.round((o.t - 0.1) * sr)), w, n.freq);
          const after = bandLevel(pcm, sr, Math.round((o.t + 0.07) * sr), w, n.freq);
          return after > 1.8 * before;
        });
        if (fresh.length) { found.length = 0; fresh.forEach(n => found.push(n)); } else found.length = 0;
        if (!found.length) continue;
        const notes = found.map(n => {
          const tr = noteTrace(pcm, sr, o.t, n.freq, Math.max(0.5, reach));
          return { midi: n.midi, freq: n.freq, conf: n.conf, length: noteLength(tr), trace: tr };
        });
        let fam = null, feat = null;
        if (opts.instruments !== false) {
          const top = notes[notes.length - 1];
          feat = timbre(pcm, sr, o.t, top.midi, top.trace);
          fam = family(feat, top.midi);
        }
        events.push({ t: o.t, strength: o.strength, notes, fam, feat });
      }
      if (i % 12 === 11) { step(0.3 + 0.7 * ((passNo + i / onsets.length) / MAXP), 'Pass ' + (passNo + 1) + ': naming notes'); await tick(); }
    }
    return events;
  }


  async function analyse(pcm, sr, opts, progress) {
    const dur = pcm.length / sr;
    const cfg = DIFFICULTY[opts.difficulty] || DIFFICULTY.medium;
    const step = (p, msg) => progress && progress(p, msg);

    step(0, 'Listening for note starts');
    const curve = await D().onsetCurve(pcm, sr, p => step(p * 0.3, 'Listening for note starts'));
    const allOnsets = D().pickOnsets(curve);
    const tempo = D().estimateTempo(curve, allOnsets);

    const passes = [];
    let agreed = 0;
    while (passes.length < MAXP) {
      passes.push(await onePass(pcm, sr, cfg, opts, curve, VARIANTS[passes.length], passes.length, step, dur));
      if (passes.length < MINP) continue;
      const c = tally(passes);
      const settled = Math.abs(c.agreed - agreed) <= 0.03 * Math.max(1, c.agreed);
      agreed = c.agreed;
      if (!c.pending || (passes.length > MINP && settled)) break;
    }
    const events = consensus(passes);
    if (opts.instruments !== false) {
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
