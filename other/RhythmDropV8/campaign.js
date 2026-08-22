// ═══════════════════════════════════════════
//  RhythmDrop V8 — campaign.js
//
//  The campaign and everything that measures progress through it:
//  which levels exist, which are unlocked, what a run is worth in XP
//  and coins, what your record on each level is, and the daily.
//
//  The 150 songs are NOT composed here. They were composed once by the
//  deterministic generator and baked to levels.js — see
//  other/tools/bake-levels.js. This file reads that data and hands the
//  rest of the game playable level objects. The practical difference:
//  a song is a file you can read and diff, not a seed that silently
//  rewrites itself the day someone touches the composer.
//
//  Exposes: window.RD_Campaign
// ═══════════════════════════════════════════

window.RD_Campaign = (function () {
  'use strict';

  const DATA = window.RD_LEVEL_DATA || { areas: [], levels: [], instruments: [] };
  const AREAS = DATA.areas;
  const LEVELS_PER_AREA = AREAS.length ? DATA.levels.length / AREAS.length : 0;

  // Pitches are baked as MIDI. Rounded to two places to land on exactly
  // the values the note table uses, so a baked note and a hand-placed
  // one of the same name are the same number.
  const midiToFreq = m => parseFloat((440 * Math.pow(2, (m - 69) / 12)).toFixed(2));

  // ── Level expansion ───────────────────────
  // Building all 150 grids at boot would be 40,913 notes of work for a
  // list that only shows names and tempos, so grids are built on
  // demand and kept.
  const _cache = {};

  function recordFor(areaId, idx) {
    return DATA.levels.find(l => l.a === areaId && l.x === idx) || null;
  }

  function expand(rec) {
    if (!rec) return null;
    if (_cache[rec.id]) return _cache[rec.id];

    const grid = Array.from({ length: rec.r }, () => [null, null, null, null]);
    // Flat runs of six: row, lane, type, midi, sustain*10, instrument.
    for (let i = 0; i < rec.nt.length; i += 6) {
      const row = rec.nt[i], lane = rec.nt[i + 1];
      if (!grid[row]) continue;
      grid[row][lane] = {
        type:    rec.nt[i + 2] ? 'dtap' : 'tap',
        freq:    midiToFreq(rec.nt[i + 3]),
        sustain: rec.nt[i + 4] / 10,
        inst:    DATA.instruments[rec.nt[i + 5]] || '',
      };
    }

    const area = areaById(rec.a);
    const lvl = {
      id: rec.id, name: rec.n, campaign: true,
      areaId: rec.a, areaName: area ? area.name : '', levelIdx: rec.x, trackNo: rec.t,
      bpm: rec.b, diff: rec.d, difficulty: rec.df, styleName: rec.sn,
      seconds: rec.sec, bgMode: rec.bg,
      instrument: DATA.instruments[rec.ins] || 'synth',
      laneFreqs: rec.lf.map(midiToFreq),
      bassPattern: rec.bp.map(m => (m > 0 ? midiToFreq(m) : 0)),
      grid,
    };
    _cache[rec.id] = lvl;
    return lvl;
  }

  // Metadata without paying for the grid — what the browser list needs.
  function metaFor(areaId, idx) {
    const rec = recordFor(areaId, idx);
    if (!rec) return null;
    return {
      id: rec.id, name: rec.n, areaId: rec.a, levelIdx: rec.x, trackNo: rec.t,
      bpm: rec.b, diff: rec.d, difficulty: rec.df, styleName: rec.sn,
      seconds: rec.sec, notes: rec.nt.length / 6, rows: rec.r,
    };
  }

  function areaMeta(areaId) {
    const out = [];
    for (let i = 0; i < LEVELS_PER_AREA; i++) {
      const m = metaFor(areaId, i);
      if (m) out.push(m);
    }
    return out;
  }

  const areaById = id => AREAS.find(a => a.id === id) || null;
  const levelAt  = (areaId, idx) => expand(recordFor(areaId, idx));

  // ── Note counting ─────────────────────────
  function countNotes(lvl) {
    if (!lvl) return 0;
    if (lvl.grid) {
      let n = 0;
      for (const row of lvl.grid) for (const c of row) if (c) n++;
      return n;
    }
    return (lvl.notes || []).length;
  }

  // Share of the grid that is filled, 0..1.
  function fillOf(lvl) {
    const rows = (lvl && lvl.grid) ? lvl.grid.length : 0;
    if (!rows) return 0;
    return countNotes(lvl) / (rows * (lvl.grid[0].length || 4));
  }

  // ── XP ────────────────────────────────────
  // Past this share of the grid, extra notes pay a fraction. A wall of
  // notes is not a harder chart, it is a longer one with the key held
  // down, and filling every box used to be the cheapest XP in the game.
  const DENSITY_CAP  = 0.85;
  const SURPLUS_RATE = 0.15;

  function payableNotes(lvl, notes) {
    if (notes === undefined) notes = countNotes(lvl);
    const rows = (lvl && lvl.grid) ? lvl.grid.length : 0;
    if (!rows) return notes;
    const cap = rows * (lvl.grid[0].length || 4) * DENSITY_CAP;
    return notes > cap ? cap + (notes - cap) * SURPLUS_RATE : notes;
  }

  function xpFor(lvl, opts) {
    opts = opts || {};
    // XP tracks how fast the notes actually came at you, so a run at
    // double speed is worth double straight out of the formula rather
    // than as a bonus bolted onto it.
    const speed = ((lvl.bpm || 120) * (opts.speedMult || 1)) / 120;
    const diff  = lvl.campaign
      ? 1 + ((lvl.areaId || 1) - 1) * 0.15
      : 1 + ((lvl.difficulty || 1) - 1) * 0.2;

    let xp = payableNotes(lvl) * speed * diff;
    // A chart you wrote yourself shouldn't be an XP faucet.
    if (!lvl.campaign) xp *= 0.5;

    if (opts.completed) {
      xp *= 1.25;                       // finishing beats dying partway
    } else {
      const p = opts.progress === undefined ? 1 : opts.progress;
      xp *= Math.max(0, Math.min(1, p));
    }
    // Rounded once, at the end: rounding every step lets the errors compound
    // and a run worth exactly twice another stops looking like it.
    return Math.max(1, Math.round(xp));
  }

  // Cumulative XP to REACH level n. Steep enough that level 2 arrives
  // in the first session and level 50 is a real distance away.
  function xpForLevel(n) {
    if (n <= 1) return 0;
    let total = 0;
    for (let i = 2; i <= n; i++) total += Math.round(60 * Math.pow(i - 1, 1.35));
    return total;
  }

  function levelFromXp(xp) {
    let n = 1;
    while (n < 200 && xpForLevel(n + 1) <= xp) n++;
    return n;
  }

  function levelProgress(xp) {
    const level = levelFromXp(xp);
    const base  = xpForLevel(level);
    const next  = xpForLevel(level + 1);
    const span  = Math.max(1, next - base);
    return { level, into: xp - base, need: span, pct: Math.min(1, (xp - base) / span) };
  }

  // ── Coins ─────────────────────────────────
  // Every level pays the same. Coins used to be derived from score, and
  // score compounds with the combo multiplier, so a clear paid anywhere
  // from a hundred to six figures depending mostly on how long the
  // chart was. Flat, coins count levels cleared.
  const COINS_PER_CLEAR = 150;
  // The one exception is a chart too short to be a song — without a
  // floor a four-note stub would be the fastest coin source in the
  // game. A stub guard, not a difficulty curve.
  const COINS_MIN_NOTES = 40;

  function coinsFor(lvl, opts) {
    opts = opts || {};
    let c = COINS_PER_CLEAR * Math.min(1, countNotes(lvl) / COINS_MIN_NOTES);
    c *= opts.speedMult || 1;
    if (!opts.completed) {
      const p = opts.progress === undefined ? 1 : opts.progress;
      c *= Math.max(0, Math.min(1, p));
    }
    return Math.max(0, Math.round(c));
  }

  // ── Unlocking ─────────────────────────────
  // A level opens when the one before it is cleared; an area opens when
  // the previous area is finished. Nothing is gated behind coins.
  const levelKey = (areaId, idx) => 'a' + areaId + 'l' + idx;

  function isLevelCleared(progress, areaId, idx) {
    return !!(progress && progress.cleared && progress.cleared[levelKey(areaId, idx)]);
  }

  function areaCleared(progress, areaId) {
    for (let i = 0; i < LEVELS_PER_AREA; i++) if (!isLevelCleared(progress, areaId, i)) return false;
    return true;
  }

  function isAreaUnlocked(progress, areaId) {
    if (areaId <= 1) return true;
    return areaCleared(progress, areaId - 1);
  }

  function isLevelUnlocked(progress, areaId, idx) {
    if (!isAreaUnlocked(progress, areaId)) return false;
    return idx === 0 || isLevelCleared(progress, areaId, idx - 1);
  }

  function clearedCount(progress) {
    let n = 0;
    for (const a of AREAS) for (let i = 0; i < LEVELS_PER_AREA; i++) if (isLevelCleared(progress, a.id, i)) n++;
    return n;
  }

  // ── Daily reward ──────────────────────────
  // Seven days on a cycle, and a missed day starts it over. The point
  // is coming back tomorrow, not coming back eventually.
  const DAILY_REWARDS = [100, 150, 200, 300, 400, 500, 1000];
  const dayNumber = t => Math.floor((t === undefined ? Date.now() : t) / 86400000);

  function dailyState(daily, now) {
    daily = daily || {};
    const today = dayNumber(now);
    const last  = typeof daily.day === 'number' ? daily.day : null;
    if (last === today) return { claimable: false, streak: daily.streak || 1, reward: 0, day: today };
    // Consecutive day continues the run; anything else restarts it.
    const streak = (last === today - 1) ? Math.min(7, (daily.streak || 0) + 1) : 1;
    return { claimable: true, streak, reward: DAILY_REWARDS[streak - 1], day: today };
  }

  function claimDaily(daily, now) {
    const s = dailyState(daily, now);
    if (!s.claimable) return { daily, coins: 0, streak: s.streak };
    return { daily: { day: s.day, streak: s.streak }, coins: s.reward, streak: s.streak };
  }

  return {
    AREAS, LEVELS_PER_AREA, DATA_VERSION: DATA.v,
    areaById, levelAt, metaFor, areaMeta, midiToFreq,
    countNotes, fillOf, payableNotes, DENSITY_CAP,
    xpFor, xpForLevel, levelFromXp, levelProgress,
    coinsFor, COINS_PER_CLEAR, COINS_MIN_NOTES,
    levelKey, isLevelCleared, areaCleared, isAreaUnlocked, isLevelUnlocked, clearedCount,
    DAILY_REWARDS, dailyState, claimDaily, dayNumber,
  };
})();
