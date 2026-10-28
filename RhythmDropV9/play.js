const TILE_H     = 38;
const HIT_BOTTOM = 52;
const HIT_WINDOWS = { strict: 0.7, normal: 1.0, forgiving: 1.45 };
function hitTol() {
  const mult = HIT_WINDOWS[currentSettings.hitWindow] || 1.0;
  return TILE_H * 1.8 * mult;
}
const DTAP_MS    = 320;
const HOLD_GRACE_MS = 110;
const HOLD_TAIL_MS  = 140;
const HOLD_TICK_PTS = 25;
const HOLD_DONE_PTS = 120;
const SPEED_INC  = 0.10 / 60;

let gameLevel   = null;
let gameQueue   = [];
let activeTiles = [];
let score = 0, combo = 0, lives = 3, maxLives = 3;
let notesHit = 0, notesTotal = 0;
let lifeScoreMult = 1;
let streak = 0;
let running = false, lastT = 0, raf = null;
let beatAccum = 0, beatIdx = 0;
let baseBeatMs = 500, currentBeatMs = 500;
let speedMult = 1, gameTimeMs = 0;
let doubleMode = false;
let runSpeedBase = 1;
let laneCount = 4;
let fbTimers  = [0,0,0,0];
let lastTapT  = [0,0,0,0];
let chaosMode = false;
const CHAOS_LETTERS = 'ABCDEFGHIJKLMNOPSTUVWXYZ'.split('');
let equippedTrailColor = null;
const STREAK_TRAIL_AT = 100;

let laneEls = [0,1,2,3].map(i => document.getElementById('lane'+i));
let btnEls  = [0,1,2,3].map(i => document.getElementById('btn'+i));
let fbEls   = [0,1,2,3].map(i => document.getElementById('fb'+i));
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

function translateLevelVoices(l) {
  const R = window.RD_resolveInstrument;
  if (!R || !l) return false;
  let changed = false;
  if (l.instrument && R(l.instrument) !== l.instrument) { l.instrument = R(l.instrument); changed = true; }
  (l.grid || []).forEach(row => row.forEach(c => {
    if (c && typeof c === 'object' && c.inst && R(c.inst) !== c.inst) { c.inst = R(c.inst); changed = true; }
  }));
  return changed;
}

function buildLanes(n) {
  n = window.RD_Lanes.clamp(n);
  const host = document.getElementById('g-lanes');
  host.dataset.lanes = n;
  if (n !== laneCount || laneEls.length !== n || !document.getElementById('lane0')) {
    host.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.dataset.lane = i;
      lane.id = 'lane' + i;
      lane.innerHTML = '<div class="lane-hitglow"></div><div class="lane-hitbar"></div>'
        + '<div class="lane-fb" id="fb' + i + '"></div>'
        + '<div class="lane-btn" id="btn' + i + '"><span class="lane-key"></span></div>';
      host.appendChild(lane);
    }
    laneCount = n;
    laneEls = Array.from(host.children);
    btnEls  = laneEls.map(l => l.querySelector('.lane-btn'));
    fbEls   = laneEls.map(l => l.querySelector('.lane-fb'));
    fbTimers = new Array(n).fill(0);
    lastTapT = new Array(n).fill(0);
  }
  if (typeof applySettingsToDOM === 'function') applySettingsToDOM();
}

function laneH() { return laneEls[0].clientHeight || 380; }
function hitY()  { return laneH() - HIT_BOTTOM; }

function buildQueue(lvl) {
  const fallbackFreqs = lvl.laneFreqs || window.RD_Lanes.defaultFreqs(window.RD_Lanes.laneCountOf(lvl));
  const songInst = lvl.instrument || null;
  if (lvl.grid) {
    const q = [];
    lvl.grid.forEach((row, ri) => row.forEach((cell, ci) => {
      if (!cell) return;
      const type    = typeof cell === 'string' ? cell : cell.type;
      const freq    = (typeof cell === 'object' && cell.freq) ? cell.freq : fallbackFreqs[ci];
      const sustain = (typeof cell === 'object' && cell.sustain) ? cell.sustain : 0;
      const inst    = (typeof cell === 'object' && cell.inst) ? cell.inst : songInst;
      const hold    = (type === 'tap' && typeof cell === 'object' && cell.hold > 0) ? Math.floor(cell.hold) : 0;
      q.push({ beatIdx:ri, lane:ci, type, freq, sustain, inst, hold });
    }));
    return q.sort((a, b) => a.beatIdx - b.beatIdx);
  }
  return lvl.notes.map(n => ({
    beatIdx: n.b, lane: n.l, type: n.t,
    freq: n.freq || fallbackFreqs[n.l],
    sustain: n.sustain || 0,
    inst: n.inst || songInst,
    hold: (n.t === 'tap' && n.hold > 0) ? Math.floor(n.hold) : 0,
  }));
}

function voiceFor(note) {
  if (currentSettings.songVoices === false) return null;
  return (note && note.inst) || null;
}

function totalBeats(lvl) {
  return lvl.grid ? lvl.grid.length : (lvl.beats || lvl.notes.length);
}

function scrollRows() { return (gameLevel && gameLevel.scrollRows > 0) ? gameLevel.scrollRows : 4; }

function rowPx() { return laneH() / scrollRows(); }

function headPt(t) {
  return t.y + (t.hold ? t.h - TILE_H / 2 : (t.h || TILE_H) / 2);
}

function tailPt(t) {
  return t.y + TILE_H / 2;
}

function spawnTile(note) {
  const el = document.createElement('div');
  el.className = 'tile tile-' + note.type + (note.hold ? ' tile-hold' : '');
  const h = note.hold ? Math.round(TILE_H + note.hold * rowPx())
          : note.type === 'dtap' ? Math.round(TILE_H * 1.5) : TILE_H;
  if (note.sustain > 0) {
    el.style.boxShadow = '0 0 12px rgba(245,158,11,0.7)';
    el.style.borderTop = '2px solid var(--perfect)';
  }
  el.style.height = h + 'px'; el.style.transform = 'translateY(' + -h + 'px)';

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
  return { el, lane:note.lane, chaosCode, y:-h, type:note.type, h, freq:note.freq||null, sustain:note.sustain||0, inst:note.inst||null,
           hold:note.hold||0, pending:0, held:false, down:false, releasedAt:0, tickAcc:0, voice:null, missed:false, dropped:false,
           firstTapped:false, done:false };
}

function launchLevel(lvl, asDouble) {
  gameLevel = lvl;
  buildLanes(window.RD_Lanes.laneCountOf(lvl));
  doubleMode = !!asDouble;
  lvlName.textContent = lvl.name + (asDouble ? '  ·  DOUBLE' : '');
  baseBeatMs = Math.round(60000 / lvl.bpm);
  ovTitle.innerHTML = 'Rhythm<span>Drop</span>';
  ovScore.style.display = 'none'; ovScLbl.style.display = 'none';
  ovBtn.textContent = 'Play';
  ovBtn.onclick = () => { overlay.classList.remove('show'); startGame(); };

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

const GEN = () => window.RD_Generator;

function _prepGenerated(lvl, label) {
  translateLevelVoices(lvl);
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
  window.RD_RowTypes.uniformRowTypes(lvl.grid);
  lvl.shareCode = code;
  return lvl;
}

function playGenerated(band) {
  const lvl = generateLevel(band);
  if (!lvl) return;
  lastGenerated = lvl;
  launchLevel(lvl);
}

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
    lanes: window.RD_Lanes.laneCountOf(lvl),
    bassPattern: lvl.bassPattern || [],
    generated: true, shareCode: lvl.shareCode || null,
  });
  store.save(arr);
  showToast('Saved to your custom levels');
}

function startGame() {
  if (typeof releaseAllLanes === 'function') releaseAllLanes();
  releaseHeldVoices();
  activeTiles.forEach(t => t.el.remove()); activeTiles = [];
  maxLives = currentSettings.lives || 3;
  lifeScoreMult = maxLives < 3 ? 1 + 0.20 * (3 - maxLives)
                : maxLives > 3 ? 1 - 0.10 * (maxLives - 3)
                : 1;
  score = 0; combo = 0; lives = maxLives; streak = 0;
  beatAccum = 0; beatIdx = 0; gameTimeMs = 0;
  runSpeedBase = doubleMode ? 2 : 1;
  speedMult = runSpeedBase;
  currentBeatMs = Math.round(baseBeatMs / speedMult);
  fbTimers = new Array(laneCount).fill(0); lastTapT = new Array(laneCount).fill(0);
  gameQueue = buildQueue(gameLevel);
  notesHit = 0; notesTotal = gameQueue.length;
  scoreEl.textContent = '0'; comboEl.textContent = '×1'; comboEl.style.color = 'var(--tap)';
  spdBadge.textContent = '1.0×'; spdBadge.classList.remove('show');
  updateLives();

  const _shop = store.loadShop();
  const _tr = _shop.equippedTrail ? trailById(_shop.equippedTrail) : null;
  equippedTrailColor = _tr ? _tr.color : null;

  if (window.RD_setLaneFreqs && gameLevel.laneFreqs) window.RD_setLaneFreqs(gameLevel.laneFreqs);
  else if (window.RD_setLaneFreqs) window.RD_setLaneFreqs(window.RD_Lanes.defaultFreqs(laneCount));

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
  const spd = th / (currentBeatMs * scrollRows());

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
    t.y += spd * dt; t.el.style.transform = 'translateY(' + t.y + 'px)';
    if (t.hold) {
      if (!t.held && !t.missed && !t.dropped) {
        if (headPt(t) - hitY() > hitTol()) {
          t.missed = true; t.el.classList.add('missed');
          damage(t.lane); if (!running) return;
        }
      } else if (t.held) {
        if (t.down) {
          t.tickAcc += dt;
          const iv = currentBeatMs / 2;
          while (t.tickAcc >= iv) { t.tickAcc -= iv; holdTick(t); }
        } else if (gameTimeMs - t.releasedAt > HOLD_GRACE_MS) {
          dropHold(t);
        }
        if (t.held && tailPt(t) >= hitY()) completeHold(t);
      }
      if (t.y > th + t.h) { endVoice(t); t.el.remove(); activeTiles.splice(i,1); }
      continue;
    }
    if (t.y > th + (t.h || TILE_H)) {
      t.el.remove(); activeTiles.splice(i,1);
      damage(t.lane); if (!running) return;
    }
  }

  for (let i = 0; i < laneCount; i++) {
    if (fbTimers[i] > 0) { fbTimers[i] -= dt; if (fbTimers[i] <= 0) fbEls[i].classList.remove('show'); }
  }
  raf = requestAnimationFrame(loop);
}

function endVoice(t) {
  if (t.voice) { t.voice.release(); t.voice = null; }
}

function holdTick(t) {
  t.pending += Math.round(HOLD_TICK_PTS * lifeScoreMult);
}

function completeHold(t) {
  t.held = false; t.down = false; t.done = true;
  t.el.classList.remove('held');
  endVoice(t);
  score += t.pending + Math.round(HOLD_DONE_PTS * lifeScoreMult);
  t.pending = 0;
  scoreEl.textContent = score;
  showFb(t.lane, 'HOLD', 'var(--perfect)');
  spawnTapPulse(t.lane);
}

function dropHold(t) {
  t.held = false; t.down = false; t.dropped = true;
  t.el.classList.remove('held');
  t.el.classList.add('dropped');
  t.pending = 0;
  endVoice(t);
  showFb(t.lane, 'NO HOLD', 'var(--muted)');
}

function releaseHold(t) {
  t.down = false;
  const remain = (hitY() - tailPt(t)) / (laneH() / (currentBeatMs * scrollRows()));
  if (remain <= HOLD_TAIL_MS) completeHold(t);
  else t.releasedAt = gameTimeMs;
}

function onLaneRelease(lane) {
  if (!running) return;
  for (const t of activeTiles) if (t.hold && t.held && t.down && t.lane === lane) releaseHold(t);
}

function onChaosRelease(code) {
  if (!running) return;
  for (const t of activeTiles) if (t.hold && t.held && t.down && t.chaosCode === code) releaseHold(t);
}

function releaseHeldVoices() {
  activeTiles.forEach(endVoice);
}

function tapLane(keyIdx) {
  if (!running) return;
  const regrab = activeTiles.find(t => t.hold && t.held && !t.down && t.lane === keyIdx);
  if (regrab) { regrab.down = true; return; }
  let best = null, bestDist = Infinity;
  const hl = hitY();
  for (const t of activeTiles) {
    if (t.done || t.lane !== keyIdx || t.held || t.missed || t.dropped) continue;
    const d = Math.abs(headPt(t) - hl);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  processTap(best, bestDist, keyIdx);
}

function tapChaos(code) {
  if (!running) return;
  const regrab = activeTiles.find(t => t.hold && t.held && !t.down && t.chaosCode === code);
  if (regrab) { regrab.down = true; return; }
  let best = null, bestDist = Infinity;
  const hl = hitY();
  for (const t of activeTiles) {
    if (t.done || t.chaosCode !== code || t.held || t.missed || t.dropped) continue;
    const d = Math.abs(headPt(t) - hl);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  if (!best && !activeTiles.some(t => !t.done && !t.held && t.chaosCode === code)) return;
  processTap(best, bestDist, best ? best.lane : null);
}

function processTap(best, bestDist, glowLane) {
  const now = performance.now();
  const gl = (glowLane != null) ? glowLane : (best ? best.lane : 0);
  const isDtap = best && best.type === 'dtap';
  laneEls[gl].classList.add(isDtap ? 'glow-dtap' : 'glow-tap');
  setTimeout(() => { laneEls[gl].classList.remove('glow-tap','glow-dtap'); }, 120);

  if (best && bestDist < hitTol()) {
    const tLane = best.lane;
    if (best.hold) {
      best.held = true; best.down = true; best.tickAcc = 0; lastTapT[tLane] = 0;
      best.el.classList.add('held');
      if (window.RD_noteOn) best.voice = window.RD_noteOn(best.freq, { inst: voiceFor(best) || undefined, vel: 0.6 });
      hit(tLane, bestDist);
    } else if (best.type === 'tap') {
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
  pts = Math.round(pts * (1 + (combo - 1) * 0.08));
  if (streak > 1) pts = Math.round(pts * (1 + (streak - 1) * 0.05));
  pts = Math.round(pts * lifeScoreMult);
  score += pts; scoreEl.textContent = score;
  comboEl.textContent = '×' + combo;
  comboEl.style.color = combo >= 10 ? 'var(--dtap)' : combo >= 5 ? 'var(--perfect)' : 'var(--tap)';
  showFb(lane, label, color);

  spawnTapPulse(lane);
  if (equippedTrailColor && streak >= STREAK_TRAIL_AT) spawnStreakTrail(lane);
}

function spawnTapPulse(lane) {
  const laneEl = laneEls[lane];
  if (!laneEl) return;
  const ring = document.createElement('div');
  ring.className = 'tap-pulse';
  ring.style.top = hitY() + 'px';
  laneEl.appendChild(ring);
  setTimeout(() => ring.remove(), 360);
}

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
  if (typeof releaseAllLanes === 'function') releaseAllLanes();
  releaseHeldVoices();
  running = false; cancelAnimationFrame(raf);
  activeTiles.forEach(t => t.el.remove()); activeTiles = [];
  if (window.RD_stopBg) window.RD_stopBg();
  if (window.RD_resetLaneFreqs) window.RD_resetLaneFreqs();

  const levelName = gameLevel ? gameLevel.name : 'Unknown';
  const isCampaign = !!(gameLevel && gameLevel.campaign);
  const runProgress = notesTotal > 0 ? Math.min(1, notesHit / notesTotal) : (won ? 1 : 0);

  let coinsEarned, xpGain = 0, xpRes = null, newTheme = null;
  if (isCampaign) {
    const rewardOpts = { completed: won, progress: runProgress, speedMult: runSpeedBase };
    coinsEarned = CAM().coinsFor(gameLevel, rewardOpts);
    xpGain      = CAM().xpFor(gameLevel,    rewardOpts);
    addCoins(coinsEarned);
    xpRes = grantXp(xpGain);
    if (won) {
      const areaDone = () => CAM().areaCleared(progress, gameLevel.areaId);
      const wasDone = areaDone();
      progress.cleared[CAM().levelKey(gameLevel.areaId, gameLevel.levelIdx)] = true;
      saveProgress();
      if (!wasDone && areaDone()) newTheme = THEMES.find(t => t.area === gameLevel.areaId) || null;
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
  const ovTheme = document.getElementById('ov-theme');
  if (ovTheme) {
    ovTheme.style.display = newTheme ? 'block' : 'none';
    if (newTheme) ovTheme.textContent = '🎨 ' + newTheme.name + ' theme unlocked — find it in Themes';
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
    if (ovTheme) ovTheme.style.display = 'none';
  };

  const gen = gameLevel && gameLevel.generated;
  ovBtn.textContent = (gen && gameLevel.endless) ? 'Next song' : 'Play Again';
  ovBtn.onclick = () => {
    hideRewards();
    overlay.classList.remove('show');
    if (gen && gameLevel.endless) {
      const nxt = generateLevel(gameLevel._band || '4-7');
      if (nxt) { nxt.endless = true; nxt._band = gameLevel._band; lastGenerated = nxt; launchLevel(nxt); return; }
    }
    startGame();
  };

  syncGeneratedKeepBtn(gen && won);
  syncDoubleBtn(isCampaign && won && !doubleMode);
  overlay.classList.add('show');
}

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
    launchLevel(lvl, true);
  };
}

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
  if (typeof releaseAllLanes === 'function') releaseAllLanes();
  releaseHeldVoices();
  running = false; cancelAnimationFrame(raf);
  activeTiles.forEach(t => t.el.remove()); activeTiles = [];
  if (window.RD_stopBg) window.RD_stopBg();
  if (window.RD_resetLaneFreqs) window.RD_resetLaneFreqs();
  if (score > 0 && gameLevel) addHighScore(profile.username || 'Player', score, gameLevel.name);
  showScreen('home'); renderHome();
}
