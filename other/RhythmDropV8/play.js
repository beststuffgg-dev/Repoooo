// ═══════════════════════════════════════════
//  RhythmDrop V8 — play.js
//
//  The gameplay engine: the note queue, tile spawning, the animation
//  loop, input and scoring, lives and streaks, the Double, and the
//  results/quit paths. Also the live-generation glue (Generate,
//  Endless, keep-as-custom) that launches a run.
//
//  Split out of game.js — a plain (non-module) script sharing the same
//  global scope. It reads shell state (currentSettings, profile) and
//  calls shell helpers (showScreen, addCoins, recordBest, grantXp, …)
//  at runtime; this file is declaration-only, so its load position is
//  not load-order sensitive as long as game.js (boot) loads last.
// ═══════════════════════════════════════════

// ══════════════════════════════════════
//  GAME ENGINE
// ══════════════════════════════════════
const TILE_H     = 38;
const HIT_BOTTOM = 52;
// The timing tolerance is chosen in Settings: a stricter window scores
// the same notes on a tighter beat. Kept in one place so the judging
// and any on-screen band can never disagree.
const HIT_WINDOWS = { strict: 0.7, normal: 1.0, forgiving: 1.45 };
function hitTol() {
  const mult = HIT_WINDOWS[currentSettings.hitWindow] || 1.0;
  return TILE_H * 1.8 * mult;
}
const DTAP_MS    = 320;
const SPEED_INC  = 0.10 / 60;

let gameLevel   = null;
let gameQueue   = [];
let activeTiles = [];
let score = 0, combo = 0, lives = 3, maxLives = 3;
// Notes struck this run, against the chart's total. A run that ends
// early is paid out on this ratio, so dying on the first note earns
// first-note money rather than the whole level's.
let notesHit = 0, notesTotal = 0;
let lifeScoreMult = 1; // difficulty scaling from chosen starting lives
let streak = 0; // consecutive hits for streak bonus
let running = false, lastT = 0, raf = null;
let beatAccum = 0, beatIdx = 0;
let baseBeatMs = 500, currentBeatMs = 500;
let speedMult = 1, gameTimeMs = 0;
// The Double: a cleared level replayed at twice the speed. It is a
// harder run at something you have already finished, so it pays double
// straight out of the XP and coin formulas (both key off actual speed)
// rather than as a bolted-on bonus. runSpeedBase is 2 during a Double
// and 1 otherwise; the in-run ramp multiplies on top of it.
let doubleMode = false;
let runSpeedBase = 1;
let fbTimers  = [0,0,0,0];
let lastTapT  = {0:0,1:0,2:0,3:0};
let chaosMode = false;
// Q and R are reserved for quit/restart hotkeys, so they're excluded.
const CHAOS_LETTERS = 'ABCDEFGHIJKLMNOPSTUVWXYZ'.split('');
let equippedTrailColor = null; // color of equipped note trail, resolved at game start
const STREAK_TRAIL_AT = 100;   // streak at which the trail effect kicks in

const laneEls = [0,1,2,3].map(i => document.getElementById('lane'+i));
const btnEls  = [0,1,2,3].map(i => document.getElementById('btn'+i));
const fbEls   = [0,1,2,3].map(i => document.getElementById('fb'+i));
const scoreEl = document.getElementById('g-score');
const comboEl = document.getElementById('g-combo');
const livesEl = document.getElementById('g-lives');
const overlay = document.getElementById('g-overlay');
const ovTitle = document.getElementById('ov-title');
const ovScore = document.getElementById('ov-score');
const ovScLbl = document.getElementById('ov-score-lbl');
const ovBtn   = document.getElementById('ov-btn');
const lvlName = document.getElementById('g-lvlname');
const spdBadge= document.getElementById('speed-badge');

// Use clientHeight (layout px) not getBoundingClientRect (which is scaled by the
// UI-scale `zoom`), so tile-fall math stays consistent at any UI scale.
function laneH() { return laneEls[0].clientHeight || 380; }
function hitY()  { return laneH() - HIT_BOTTOM; }

function buildQueue(lvl) {
  // Each campaign note names the voice it was composed for — an area's
  // lead and its accompaniment are different instruments inside one
  // song. Dropping `inst` here is what made every era sound the same:
  // the twelve voices were synthesised, baked into all 150 charts, and
  // then never reached the audio engine.
  const fallbackFreqs = lvl.laneFreqs || [261.63,329.63,392.00,523.25];
  const songInst = lvl.instrument || null;
  if (lvl.grid) {
    const q = [];
    lvl.grid.forEach((row, ri) => row.forEach((cell, ci) => {
      if (!cell) return;
      const type    = typeof cell === 'string' ? cell : cell.type;
      const freq    = (typeof cell === 'object' && cell.freq) ? cell.freq : fallbackFreqs[ci];
      const sustain = (typeof cell === 'object' && cell.sustain) ? cell.sustain : 0;
      const inst    = (typeof cell === 'object' && cell.inst) ? cell.inst : songInst;
      q.push({ beatIdx:ri, lane:ci, type, freq, sustain, inst });
    }));
    return q.sort((a, b) => a.beatIdx - b.beatIdx);
  }
  return lvl.notes.map(n => ({
    beatIdx: n.b, lane: n.l, type: n.t,
    freq: n.freq || fallbackFreqs[n.l],
    sustain: n.sustain || 0,
    inst: n.inst || songInst,
  }));
}

// Which voice a note should sound in. The song names one; the player
// can override that in Settings if they would rather hear their own
// instrument everywhere. Off by default, because a chart written for a
// lyre stops sounding like the place it is set when it isn't one.
function voiceFor(note) {
  if (currentSettings.songVoices === false) return null;   // player's choice wins
  return (note && note.inst) || null;
}

function totalBeats(lvl) {
  return lvl.grid ? lvl.grid.length : (lvl.beats || lvl.notes.length);
}

function spawnTile(note) {
  const el = document.createElement('div');
  el.className = 'tile tile-' + note.type;
  const h = note.type === 'dtap' ? Math.round(TILE_H * 1.5) : TILE_H;
  if (note.sustain > 0) {
    el.style.boxShadow = '0 0 12px rgba(245,158,11,0.7)';
    el.style.borderTop = '2px solid var(--perfect)';
  }
  el.style.height = h + 'px'; el.style.top = -h + 'px';

  // Chaos mode: assign a random key from the whole keyboard (A–Z).
  // Double presses keep the same key (it's stored once per tile).
  let chaosCode = null;
  if (chaosMode) {
    const letter = CHAOS_LETTERS[Math.floor(Math.random() * CHAOS_LETTERS.length)];
    chaosCode = 'Key' + letter;
    const keyLbl = document.createElement('div');
    keyLbl.className = 'tile-chaos-key';
    keyLbl.textContent = letter;
    el.appendChild(keyLbl);
  }

  laneEls[note.lane].appendChild(el);
  return { el, lane:note.lane, chaosCode, y:-h, type:note.type, h, freq:note.freq||null, sustain:note.sustain||0, firstTapped:false, done:false };
}

function launchLevel(lvl, asDouble) {
  gameLevel = lvl;
  // Only a Double launch keeps doubleMode set; every other launch path
  // clears it so a normal run is never accidentally sped up.
  doubleMode = !!asDouble;
  lvlName.textContent = lvl.name + (asDouble ? '  ·  DOUBLE' : '');
  baseBeatMs = Math.round(60000 / lvl.bpm);
  ovTitle.innerHTML = 'Rhythm<span>Drop</span>';
  ovScore.style.display = 'none'; ovScLbl.style.display = 'none';
  ovBtn.textContent = 'Play';
  ovBtn.onclick = () => { overlay.classList.remove('show'); startGame(); };

  // Chaos mode toggle
  chaosMode = false;
  const chaosBtn = document.getElementById('ov-chaos-toggle');
  if (chaosBtn) {
    chaosBtn.classList.remove('on');
    chaosBtn.textContent = '🎲 Chaos Keys: OFF';
    chaosBtn.onclick = () => {
      chaosMode = !chaosMode;
      chaosBtn.classList.toggle('on', chaosMode);
      chaosBtn.textContent = '🎲 Chaos Keys: ' + (chaosMode ? 'ON' : 'OFF');
    };
  }

  overlay.classList.add('show');
  showScreen('game');
}

function launchCustom(lvl) { launchLevel(lvl); }

// ══════════════════════════════════════
//  LIVE GENERATION
//
//  V8 ships a baked campaign, but V7's composer is bundled as
//  RD_Generator so a fresh chart can still be rolled on the spot — for
//  the Generate button and for endless runs. A generated level is a
//  normal level object (grid, bpm, laneFreqs, per-note voices), so the
//  rest of the game treats it like any other.
// ══════════════════════════════════════
const GEN = () => window.RD_Generator;

// Turns a composer level into something launchLevel and the Custom tab
// are happy with: a name, and a flag so it is never mistaken for a
// campaign level (which would try to mark an area cleared).
function _prepGenerated(lvl, label) {
  lvl.campaign = false;
  lvl.generated = true;
  if (!lvl.name) lvl.name = label || 'Generated';
  return lvl;
}

let lastGenerated = null;

function generateLevel(band) {
  const G = GEN();
  if (!G) { showToast('Generator not available', true); return null; }
  const [lo, hi] = (band || '3-6').split('-').map(Number);
  const code = G.rollEndlessCode(lo, hi);
  const lvl = _prepGenerated(G.buildCodeLevel(code), G.songTitle ? G.songTitle(code) : 'Generated');
  lvl.shareCode = code;
  return lvl;
}

function playGenerated(band) {
  const lvl = generateLevel(band);
  if (!lvl) return;
  lastGenerated = lvl;
  launchLevel(lvl);
}

// After a generated run the player can keep the chart as a custom level.
function saveGenerated(lvl) {
  if (!lvl) return;
  const arr = store.load();
  arr.push({
    id: 'g' + Date.now(),
    name: lvl.name || 'Generated',
    bpm: lvl.bpm,
    diff: lvl.diff || (lvl.difficulty <= 3 ? 'easy' : lvl.difficulty <= 6 ? 'medium' : 'hard'),
    grid: lvl.grid.map(r => r.map(c => c ? { ...c } : null)),
    bgMode: lvl.bgMode || 'none',
    laneFreqs: lvl.laneFreqs ? [...lvl.laneFreqs] : undefined,
    bassPattern: lvl.bassPattern || [],
    generated: true, shareCode: lvl.shareCode || null,
  });
  store.save(arr);
  showToast('Saved to your custom levels');
}

function startGame() {
  activeTiles.forEach(t => t.el.remove()); activeTiles = [];
  maxLives = currentSettings.lives || 3;
  // Score scaling by chosen lives: +20% per heart under 3, -10% per heart over 3
  lifeScoreMult = maxLives < 3 ? 1 + 0.20 * (3 - maxLives)
                : maxLives > 3 ? 1 - 0.10 * (maxLives - 3)
                : 1;
  score = 0; combo = 0; lives = maxLives; streak = 0;
  beatAccum = 0; beatIdx = 0; gameTimeMs = 0;
  runSpeedBase = doubleMode ? 2 : 1;
  speedMult = runSpeedBase;
  currentBeatMs = Math.round(baseBeatMs / speedMult);
  fbTimers = [0,0,0,0]; lastTapT = {0:0,1:0,2:0,3:0};
  gameQueue = buildQueue(gameLevel);
  notesHit = 0; notesTotal = gameQueue.length;
  scoreEl.textContent = '0'; comboEl.textContent = '×1'; comboEl.style.color = 'var(--tap)';
  spdBadge.textContent = '1.0×'; spdBadge.classList.remove('show');
  updateLives();

  // Resolve the equipped note-trail color for this run
  const _shop = store.loadShop();
  const _tr = _shop.equippedTrail ? trailById(_shop.equippedTrail) : null;
  equippedTrailColor = _tr ? _tr.color : null;

  if (window.RD_setLaneFreqs && gameLevel.laneFreqs) window.RD_setLaneFreqs(gameLevel.laneFreqs);
  else if (window.RD_setLaneFreqs) window.RD_setLaneFreqs([261.63,329.63,392.00,523.25]);

  const bgM = gameLevel.bgMode || 'none';
  const bp  = gameLevel.bassPattern || [];
  if (window.RD_startBg) window.RD_startBg(bgM, gameLevel.bpm, bp.length ? bp : null);

  running = true; lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(now - lastT, 80); lastT = now;
  gameTimeMs += dt;

  // Speed ramp: +10% per 60 s, on top of whatever the run started at
  // (2x for a Double).
  const newMult = runSpeedBase + Math.floor(gameTimeMs / 60000) * SPEED_INC * 60;
  if (newMult !== speedMult) {
    speedMult     = newMult;
    currentBeatMs = Math.round(baseBeatMs / speedMult);
    spdBadge.textContent = speedMult.toFixed(1) + '×';
    spdBadge.classList.add('show');
    setTimeout(() => spdBadge.classList.remove('show'), 2000);
    if (window.RD_updateBgBpm) window.RD_updateBgBpm(gameLevel.bpm * speedMult);
  }

  const th  = laneH();
  const spd = th / (currentBeatMs * 4);

  beatAccum += dt;
  if (beatAccum >= currentBeatMs) {
    beatAccum -= currentBeatMs;
    while (gameQueue.length && gameQueue[0].beatIdx <= beatIdx)
      activeTiles.push(spawnTile(gameQueue.shift()));
    beatIdx++;
    if (!gameQueue.length && !activeTiles.length && beatIdx > totalBeats(gameLevel) + 8) {
      endGame(true); return;
    }
  }

  for (let i = activeTiles.length - 1; i >= 0; i--) {
    const t = activeTiles[i];
    if (t.done) { t.el.remove(); activeTiles.splice(i,1); continue; }
    t.y += spd * dt; t.el.style.top = t.y + 'px';
    if (t.y > th + (t.h || TILE_H)) {
      t.el.remove(); activeTiles.splice(i,1);
      damage(t.lane); if (!running) return;
    }
  }

  for (let i = 0; i < 4; i++) {
    if (fbTimers[i] > 0) { fbTimers[i] -= dt; if (fbTimers[i] <= 0) fbEls[i].classList.remove('show'); }
  }
  raf = requestAnimationFrame(loop);
}

// ── Tap mechanic ──────────────────────────────────
// Normal mode: a press maps to a lane, matches tiles in that lane.
function tapLane(keyIdx) {
  if (!running) return;
  let best = null, bestDist = Infinity;
  const hl = hitY();
  for (const t of activeTiles) {
    if (t.done || t.lane !== keyIdx) continue;
    const d = Math.abs((t.y + (t.h || TILE_H) / 2) - hl);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  processTap(best, bestDist, keyIdx);
}

// Chaos mode: a press matches the tile whose assigned key == pressed key.
// Double-press tiles keep the same key, so the same code matches both presses.
function tapChaos(code) {
  if (!running) return;
  let best = null, bestDist = Infinity;
  const hl = hitY();
  for (const t of activeTiles) {
    if (t.done || t.chaosCode !== code) continue;
    const d = Math.abs((t.y + (t.h || TILE_H) / 2) - hl);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  // No tile anywhere on the board uses this key → ignore the press (no penalty).
  if (!best && !activeTiles.some(t => !t.done && t.chaosCode === code)) return;
  processTap(best, bestDist, best ? best.lane : null);
}

// Shared hit/miss processing. glowLane may be null (chaos miss with no target lane).
function processTap(best, bestDist, glowLane) {
  const now = performance.now();
  const gl = (glowLane != null) ? glowLane : (best ? best.lane : 0);
  const isDtap = best && best.type === 'dtap';
  laneEls[gl].classList.add(isDtap ? 'glow-dtap' : 'glow-tap');
  setTimeout(() => { laneEls[gl].classList.remove('glow-tap','glow-dtap'); }, 120);

  if (best && bestDist < hitTol()) {
    const tLane = best.lane;
    if (best.type === 'tap') {
      best.done = true; lastTapT[tLane] = 0;
      if (window.RD_playNote) window.RD_playNote(tLane, false, best.freq, best.sustain || 0, voiceFor(best));
      hit(tLane, bestDist);
    } else {
      if (!best.firstTapped) {
        best.firstTapped = true;
        best.el.classList.add('primed');
        lastTapT[tLane] = now;
        if (window.RD_playNote) window.RD_playNote(tLane, false, best.freq, best.sustain || 0, voiceFor(best));
      } else {
        const elapsed = now - lastTapT[tLane];
        if (elapsed <= DTAP_MS) {
          best.done = true; lastTapT[tLane] = 0;
          if (window.RD_playNote) window.RD_playNote(tLane, true, best.freq, best.sustain || 0, voiceFor(best));
          hit(tLane, bestDist);
        } else {
          best.firstTapped = false;
          best.el.classList.remove('primed');
          lastTapT[tLane] = now;
          damage(tLane);
        }
      }
    }
  } else {
    lastTapT[gl] = 0;
    damage(gl);
  }
}

function hit(lane, dist) {
  combo++;
  streak++;
  notesHit++;
  const pct = dist / hitTol();
  let pts, label, color;
  if      (pct < 0.2) { pts = 300; label = 'PERFECT'; color = 'var(--perfect)'; }
  else if (pct < 0.6) { pts = 150; label = 'GREAT';   color = 'var(--good)'; }
  else                { pts = 60;  label = 'GOOD';    color = 'var(--tap)'; }
  // Combo multiplier: 8% per combo hit
  pts = Math.round(pts * (1 + (combo - 1) * 0.08));
  // Streak bonus: 5% per consecutive streak
  if (streak > 1) pts = Math.round(pts * (1 + (streak - 1) * 0.05));
  // Lives-based difficulty scaling
  pts = Math.round(pts * lifeScoreMult);
  score += pts; scoreEl.textContent = score;
  comboEl.textContent = '×' + combo;
  comboEl.style.color = combo >= 10 ? 'var(--dtap)' : combo >= 5 ? 'var(--perfect)' : 'var(--tap)';
  showFb(lane, label, color);

  // Minimalist tap effect on every successful hit
  spawnTapPulse(lane);
  // Note trail effect once the streak hits the threshold
  if (equippedTrailColor && streak >= STREAK_TRAIL_AT) spawnStreakTrail(lane);
}

// Minimalist hit feedback: a thin ring that expands and fades at the hit bar
function spawnTapPulse(lane) {
  const laneEl = laneEls[lane];
  if (!laneEl) return;
  const ring = document.createElement('div');
  ring.className = 'tap-pulse';
  ring.style.top = hitY() + 'px';
  laneEl.appendChild(ring);
  setTimeout(() => ring.remove(), 360);
}

// Small fire-trail burst at the hit bar of a lane, in the equipped trail color
function spawnStreakTrail(lane) {
  const laneEl = laneEls[lane];
  if (!laneEl) return;
  const baseY = hitY();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'streak-particle';
    const color = trailParticleColor(equippedTrailColor);
    p.style.background = color;
    p.style.boxShadow = '0 0 8px ' + color;
    p.style.left = (15 + Math.random() * 70) + '%';
    p.style.top  = (baseY - Math.random() * 10) + 'px';
    p.style.animationDelay = (i * 25) + 'ms';
    laneEl.appendChild(p);
    setTimeout(() => p.remove(), 650);
  }
}

function damage(lane) {
  combo = 0; streak = 0;
  comboEl.textContent = '×1'; comboEl.style.color = 'var(--tap)';
  lives = Math.max(0, lives - 1); updateLives();
  showFb(lane, 'MISS', 'var(--miss)');
  if (lives <= 0) endGame(false);
}

function updateLives() {
  livesEl.textContent = '♥'.repeat(lives) + '♡'.repeat(maxLives - lives);
}

function showFb(lane, text, color) {
  fbEls[lane].textContent = text; fbEls[lane].style.color = color;
  fbEls[lane].classList.add('show'); fbTimers[lane] = 520;
}

function endGame(won) {
  running = false; cancelAnimationFrame(raf);
  activeTiles.forEach(t => t.el.remove()); activeTiles = [];
  if (window.RD_stopBg) window.RD_stopBg();
  if (window.RD_resetLaneFreqs) window.RD_resetLaneFreqs();

  // ── What the run was worth ──
  const levelName = gameLevel ? gameLevel.name : 'Unknown';
  const isCampaign = !!(gameLevel && gameLevel.campaign);
  // A failed run pays for the share of the chart it actually struck,
  // or quitting on the first note would pay the same as clearing.
  const runProgress = notesTotal > 0 ? Math.min(1, notesHit / notesTotal) : (won ? 1 : 0);

  let coinsEarned, xpGain = 0, xpRes = null;
  if (isCampaign) {
    const rewardOpts = { completed: won, progress: runProgress, speedMult: runSpeedBase };
    coinsEarned = CAM().coinsFor(gameLevel, rewardOpts);
    xpGain      = CAM().xpFor(gameLevel,    rewardOpts);
    addCoins(coinsEarned);
    xpRes = grantXp(xpGain);
    if (won) {
      progress.cleared[CAM().levelKey(gameLevel.areaId, gameLevel.levelIdx)] = true;
      saveProgress();
    }
    recordBest(gameLevel, score, coinsEarned);
    addHighScore(profile.username || 'Player', score, levelName, { logOnly: true });
  } else {
    coinsEarned = addHighScore(profile.username || 'Player', score, levelName);
  }

  ovTitle.innerHTML = won ? 'Level <span>Clear!</span>' : 'Game <span>Over</span>';
  ovScore.textContent = score; ovScore.style.display = 'block'; ovScLbl.style.display = 'block';

  const ovCurr = document.getElementById('ov-currency-reward');
  if (ovCurr) {
    ovCurr.style.display = 'block';
    ovCurr.textContent = '+' + coinsEarned + ' 🪙 earned';
  }
  const ovXp = document.getElementById('ov-xp');
  if (ovXp) {
    ovXp.style.display = xpGain ? 'block' : 'none';
    if (xpGain) {
      const note = won ? [] : [Math.round(runProgress * 100) + '% of the chart'];
      ovXp.textContent = '+' + xpGain + ' XP' + (note.length ? ' (' + note.join(' · ') + ')' : '');
    }
  }
  const ovLv = document.getElementById('ov-levelup');
  if (ovLv) {
    const up = xpRes && xpRes.levelUp;
    ovLv.style.display = up ? 'block' : 'none';
    if (up) ovLv.textContent = '★ Level ' + xpRes.level;
  }

  const ovStreak = document.getElementById('ov-streak-bonus');
  if (ovStreak) {
    const parts = [];
    if (streak > 1) parts.push('Streak bonus +' + (streak-1)*5 + '%');
    if (lifeScoreMult > 1)      parts.push('Low-lives bonus +' + Math.round((lifeScoreMult - 1) * 100) + '%');
    else if (lifeScoreMult < 1) parts.push('Extra-lives penalty −' + Math.round((1 - lifeScoreMult) * 100) + '%');
    ovStreak.style.display = parts.length ? 'block' : 'none';
    ovStreak.textContent = parts.join(' · ');
  }

  const hideRewards = () => {
    if (ovCurr) ovCurr.style.display = 'none';
    if (ovStreak) ovStreak.style.display = 'none';
    if (ovXp) ovXp.style.display = 'none';
    if (ovLv) ovLv.style.display = 'none';
  };

  const gen = gameLevel && gameLevel.generated;
  ovBtn.textContent = (gen && gameLevel.endless) ? 'Next song' : 'Play Again';
  ovBtn.onclick = () => {
    hideRewards();
    overlay.classList.remove('show');
    // Endless keeps rolling a new chart; everything else replays this one.
    if (gen && gameLevel.endless) {
      const nxt = generateLevel(gameLevel._band || '4-7');
      if (nxt) { nxt.endless = true; nxt._band = gameLevel._band; lastGenerated = nxt; launchLevel(nxt); return; }
    }
    startGame();
  };

  // After a generated run, offer to keep the chart as a custom level.
  syncGeneratedKeepBtn(gen && won);
  // After clearing a campaign level, offer the Double — a 2x replay.
  // Only off a real clear, and never chained out of a Double itself.
  syncDoubleBtn(isCampaign && won && !doubleMode);
  overlay.classList.add('show');
}

// The Double button — a 2x replay of the level just cleared. Built on
// demand so the overlay markup did not have to change, and it launches
// the same level with doubleMode set.
function syncDoubleBtn(show) {
  let btn = document.getElementById('ov-double-btn');
  if (!show) { if (btn) btn.style.display = 'none'; return; }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'ov-double-btn';
    btn.className = 'chaos-toggle';
    btn.style.marginTop = '4px';
    ovBtn.parentNode.insertBefore(btn, ovBtn);
  }
  btn.style.display = '';
  btn.textContent = '⚡ The Double — 2× speed, 2× reward';
  btn.onclick = () => {
    const lvl = gameLevel;
    overlay.classList.remove('show');
    launchLevel(lvl, true);   // relaunch this level as a Double
  };
}

// A "Keep this level" button on the results overlay, shown only after a
// generated run so the player can save a chart they liked. Built once,
// on demand, so the overlay markup did not have to change.
function syncGeneratedKeepBtn(show) {
  let btn = document.getElementById('ov-keep-btn');
  if (!show) { if (btn) btn.style.display = 'none'; return; }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'ov-keep-btn';
    btn.className = 'chaos-toggle';
    btn.style.marginTop = '4px';
    ovBtn.parentNode.insertBefore(btn, ovBtn);
  }
  btn.style.display = '';
  btn.textContent = '💾 Keep this level';
  btn.disabled = false;
  btn.onclick = () => {
    saveGenerated(lastGenerated || gameLevel);
    btn.textContent = '✓ Saved to Custom';
    btn.disabled = true;
  };
}

function quitToMenu() {
  running = false; cancelAnimationFrame(raf);
  activeTiles.forEach(t => t.el.remove()); activeTiles = [];
  if (window.RD_stopBg) window.RD_stopBg();
  if (window.RD_resetLaneFreqs) window.RD_resetLaneFreqs();
  if (score > 0 && gameLevel) addHighScore(profile.username || 'Player', score, gameLevel.name);
  showScreen('home'); renderHome();
}
