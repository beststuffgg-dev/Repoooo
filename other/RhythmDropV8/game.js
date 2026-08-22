// ═══════════════════════════════════════════════════
//  RhythmDrop game.js v4
//  Changes from v3:
//  1. No audio preview when selecting notes in creator
//  2. A/S/D/F keys play lane notes when NOT in-game
//  3. Note picker opens by clicking the note label
//     inside the cell itself (no separate trigger button)
//  4. Uses full chromatic freq table from audio.js v4
// ═══════════════════════════════════════════════════

// How much extra width the advanced creator panel is currently
// borrowing from the window. Declared here rather than beside the
// sizing code because showScreen reads it, and showScreen can run
// before that point during boot — a `let` is in the temporal dead zone
// until its own line executes.
let advExpansion = 0;

// The four demo levels the v3 build shipped are gone: the campaign in
// levels.js is the level list now, and a second parallel one that
// nothing linked to was only ever going to drift.

// ── Persistence ──────────────────────────────────
const store = {
  load:             ()  => { try { return JSON.parse(localStorage.getItem('rd_levels')||'[]'); } catch { return []; } },
  save:             a   => localStorage.setItem('rd_levels', JSON.stringify(a)),
  loadTheme:        ()  => localStorage.getItem('rd_theme')||'graphite',
  saveTheme:        t   => localStorage.setItem('rd_theme', t),
  loadCustomTheme:  ()  => { try { return JSON.parse(localStorage.getItem('rd_custom_theme')||'null'); } catch { return null; } },
  saveCustomTheme:  t   => localStorage.setItem('rd_custom_theme', JSON.stringify(t)),
  loadGlassTrans:   ()  => { const v = parseFloat(localStorage.getItem('rd_glass_trans')); return isNaN(v) ? 0.5 : v; },
  saveGlassTrans:   v   => localStorage.setItem('rd_glass_trans', v),
  loadSettings:     ()  => { try { return JSON.parse(localStorage.getItem('rd_settings')||'null'); } catch { return null; } },
  saveSettings:     s   => localStorage.setItem('rd_settings', JSON.stringify(s)),
  // Profile
  loadProfile:      ()  => { try { return JSON.parse(localStorage.getItem('rd_profile')||'null'); } catch { return null; } },
  saveProfile:      p   => localStorage.setItem('rd_profile', JSON.stringify(p)),
  // High scores: array of {name, score, level, coins, date}
  loadScores:       ()  => { try { return JSON.parse(localStorage.getItem('rd_scores')||'[]'); } catch { return []; } },
  saveScores:       a   => localStorage.setItem('rd_scores', JSON.stringify(a)),
  // Per-level best: { [levelName]: {name, score, coins, date} } — never evicted
  loadBests:        ()  => { try { return JSON.parse(localStorage.getItem('rd_bests')||'{}'); } catch { return {}; } },
  saveBests:        b   => localStorage.setItem('rd_bests', JSON.stringify(b)),
  // Shop: owned avatar ids + equipped, plus owned trail ids + equipped trail
  loadShop:         ()  => {
    try {
      const s = JSON.parse(localStorage.getItem('rd_shop')||'{}');
      return {
        owned:         Array.isArray(s.owned) ? s.owned : [],
        equipped:      s.equipped || null,
        ownedTrails:   Array.isArray(s.ownedTrails) ? s.ownedTrails : [],
        equippedTrail: s.equippedTrail || null,
      };
    } catch { return { owned:[], equipped:null, ownedTrails:[], equippedTrail:null }; }
  },
  saveShop:         s   => localStorage.setItem('rd_shop', JSON.stringify(s)),
  // Custom avatar data URL
  loadCustomAv:     ()  => localStorage.getItem('rd_custom_av')||null,
  saveCustomAv:     d   => localStorage.setItem('rd_custom_av', d),
  // Campaign progress: total XP and which levels are cleared.
  loadProgress:     ()  => {
    try {
      const p = JSON.parse(localStorage.getItem('rd_progress')||'{}');
      return { xp: p.xp || 0, cleared: p.cleared || {} };
    } catch { return { xp: 0, cleared: {} }; }
  },
  saveProgress:     p   => localStorage.setItem('rd_progress', JSON.stringify(p)),
  // Daily reward: { day, streak }
  loadDaily:        ()  => { try { return JSON.parse(localStorage.getItem('rd_daily')||'null'); } catch { return null; } },
  saveDaily:        d   => localStorage.setItem('rd_daily', JSON.stringify(d)),
};

// ── Profile state ──────────────────────────────
let profile = store.loadProfile() || { username: null, coins: 0, bestScore: 0 };
function saveProfile() { store.saveProfile(profile); }

function addCoins(n) {
  profile.coins += n;
  saveProfile();
  updateProfileBar();
}

function updateProfileBar() {
  const el = document.getElementById('pbar-username');
  const coins = document.getElementById('pbar-coins');
  const hs = document.getElementById('pbar-hs');
  if (el) el.textContent = profile.username || 'Player';
  if (coins) coins.textContent = '🪙 ' + profile.coins + ' coins';
  if (hs) {
    const scores = store.loadScores();
    const best = scores.length ? Math.max(...scores.map(s=>s.score)) : 0;
    hs.textContent = '🏆 Best: ' + best;
  }
  updateAvatarDisplay();
}

function updateAvatarDisplay() {
  const bar = document.getElementById('pbar-avatar');
  if (!bar) return;
  const shop = store.loadShop();
  renderAvatarInto(bar, shop.equipped);
}

function renderAvatarInto(el, avatarId) {
  el.innerHTML = '';
  if (!avatarId) {
    el.innerHTML = '<span class="default-av">🎵</span>';
    return;
  }
  if (avatarId === 'custom') {
    const d = store.loadCustomAv();
    if (d) {
      const img = document.createElement('img');
      img.src = d; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;';
      el.appendChild(img);
    } else {
      el.innerHTML = '<span class="default-av">🎵</span>';
    }
    return;
  }
  const av = SHOP_AVATARS.find(a => a.id === avatarId);
  if (av) {
    const sp = document.createElement('span');
    sp.className = 'big-emoji';
    sp.textContent = av.emoji;
    el.appendChild(sp);
  } else {
    el.innerHTML = '<span class="default-av">🎵</span>';
  }
}

// ── Shop avatars catalog ────────────────────
const SHOP_AVATARS = [
  { id:'av_star',   name:'Star',    emoji:'⭐', price:200 },
  { id:'av_fire',   name:'Blaze',   emoji:'🔥', price:300 },
  { id:'av_ghost',  name:'Ghost',   emoji:'👻', price:250 },
  { id:'av_robot',  name:'Robot',   emoji:'🤖', price:400 },
  { id:'av_cat',    name:'Cat',     emoji:'🐱', price:350 },
  { id:'av_dj',     name:'DJ',      emoji:'🎧', price:500 },
  { id:'av_crown',  name:'Crown',   emoji:'👑', price:800 },
  { id:'av_gem',    name:'Gem',     emoji:'💎', price:600 },
  { id:'av_space',  name:'Space',   emoji:'🚀', price:450 },
  // ── Ultra-expensive / prestige tier ──
  { id:'av_unicorn', name:'Unicorn',  emoji:'🦄', price:5000 },
  { id:'av_dragon',  name:'Dragon',   emoji:'🐉', price:12000 },
  { id:'av_galaxy',  name:'Galaxy',   emoji:'🌌', price:25000 },
  { id:'av_alien',   name:'Cosmic',   emoji:'👽', price:50000 },
  { id:'av_phoenix', name:'Phoenix',  emoji:'🔥🦅', price:100000 },
  { id:'av_goat',    name:'G.O.A.T.', emoji:'🐐', price:250000 },
  { id:'av_deity',   name:'Deity',    emoji:'⚡👑', price:1000000 },
  // ── Beyond-prestige tier ──
  { id:'av_blackhole', name:'Black Hole', emoji:'🕳️',  price:2000000 },
  { id:'av_infinity',  name:'Infinity',   emoji:'♾️',  price:5000000 },
  { id:'av_diadem',    name:'Diadem',     emoji:'👑💎', price:10000000 },
  { id:'av_universe',  name:'Universe',   emoji:'🌠',  price:25000000 },
  { id:'av_ascended',  name:'Ascended',   emoji:'😇⚡', price:100000000 },
];

// Special multi-color trails (gradient + particle palette)
const SPECIAL_TRAILS = {
  rainbow: { grad:'linear-gradient(0deg,#ff3a6e,#f59e0b,#22c55e,#3b82f6,#a855f7)', palette:['#ff3a6e','#f59e0b','#22c55e','#3b82f6','#a855f7'] },
  aurora:  { grad:'linear-gradient(0deg,#34d399,#22d3ee,#a78bfa)',                 palette:['#34d399','#22d3ee','#a78bfa'] },
  prism:   { grad:'linear-gradient(0deg,#f472b6,#818cf8,#22d3ee,#a3e635)',         palette:['#f472b6','#818cf8','#22d3ee','#a3e635'] },
};
function trailGradient(color)       { return SPECIAL_TRAILS[color] ? SPECIAL_TRAILS[color].grad : 'linear-gradient(0deg,' + color + ',transparent)'; }
function trailParticleColor(color)  { const s = SPECIAL_TRAILS[color]; return s ? s.palette[Math.floor(Math.random() * s.palette.length)] : color; }

// ── Note trail effects catalog (color by price/rarity) ──
const SHOP_TRAILS = [
  { id:'tr_green',   name:'Green Flame',   color:'#22c55e', price:300 },
  { id:'tr_blue',    name:'Blue Flame',    color:'#3b82f6', price:500 },
  { id:'tr_cyan',    name:'Cyan Flame',    color:'#06b6d4', price:900 },
  { id:'tr_purple',  name:'Purple Flame',  color:'#a855f7', price:2000 },
  { id:'tr_red',     name:'Crimson Flame', color:'#ef4444', price:4000 },
  { id:'tr_gold',    name:'Gold Flame',    color:'#f59e0b', price:12000 },
  { id:'tr_rainbow', name:'Rainbow Flame', color:'rainbow', price:50000 },
  // ── Higher-priced special trails ──
  { id:'tr_plasma',  name:'Plasma Flame',  color:'#e879f9', price:120000 },
  { id:'tr_ember',   name:'Ember Storm',   color:'#fb7185', price:350000 },
  { id:'tr_aurora',  name:'Aurora',        color:'aurora',  price:900000 },
  { id:'tr_prism',   name:'Prismatic',     color:'prism',   price:3000000 },
  { id:'tr_cosmic',  name:'Cosmic Glow',   color:'#c4b5fd', price:15000000 },
];
function trailById(id) { return SHOP_TRAILS.find(t => t.id === id) || null; }

// ── Mystery boxes catalog ──
// Each box draws from items priced within [minPrice, maxPrice]; pricier boxes
// raise the floor, so their loot is much higher rarity.
const MYSTERY_BOXES = [
  { id:'box_basic',  name:'Basic Box',  emoji:'📦', price:1000,     minPrice:0,        maxPrice:1000 },
  { id:'box_rare',   name:'Rare Box',   emoji:'🎁', price:6000,     minPrice:600,      maxPrice:5000 },
  { id:'box_epic',   name:'Epic Box',   emoji:'🪩', price:30000,    minPrice:2000,     maxPrice:50000 },
  { id:'box_legend', name:'Legend Box', emoji:'🌟', price:150000,   minPrice:12000,    maxPrice:1000000 },
  { id:'box_divine', name:'Divine Box', emoji:'🔮', price:1500000,  minPrice:1000000,  maxPrice:25000000 },
  { id:'box_cosmic', name:'Cosmic Box', emoji:'💫', price:20000000, minPrice:5000000,  maxPrice:100000000 },
];

// Rarity tier derived purely from an item's price (steeper at the top)
function rarityForPrice(p) {
  if (p >= 10000000) return { name:'Celestial',  color:'#fde047' };
  if (p >= 1000000)  return { name:'Divine',     color:'#f0abfc' };
  if (p >= 50000)    return { name:'Mythic',     color:'#ff3a6e' };
  if (p >= 10000)    return { name:'Legendary',  color:'#f59e0b' };
  if (p >= 2000)     return { name:'Epic',       color:'#a855f7' };
  if (p >= 600)      return { name:'Rare',       color:'#3b82f6' };
  return               { name:'Common',     color:'#9ca3af' };
}

// One-time: seed the per-level bests map from any surviving legacy scores
(function migrateBests() {
  const bests = store.loadBests();
  if (Object.keys(bests).length) return;
  const scores = store.loadScores();
  if (!scores.length) return;
  scores.forEach(s => {
    const lv = s.level || 'Unknown';
    const prev = bests[lv];
    if (!prev || s.score > prev.score) bests[lv] = { name: s.name, score: s.score, coins: s.coins, date: s.date };
  });
  store.saveBests(bests);
})();

// ── High score management ───────────────────
// Logs a run and pays the score-derived coin reward.
//
// `opts.logOnly` records the run without paying for it or writing a
// per-level best: campaign runs take that path, because the campaign
// pays a flat reward per clear and keeps its own record keyed by level
// id. Without the flag a campaign clear was paid twice — once flat and
// once again as score/1000 — which is exactly the score-derived payout
// the flat reward exists to replace.
function addHighScore(name, score, levelName, opts) {
  opts = opts || {};
  const coins = opts.logOnly ? 0 : Math.floor(score / 1000);
  const scores = store.loadScores();
  scores.push({ name, score, level: levelName, coins, date: Date.now() });
  scores.sort((a,b) => b.score - a.score);
  store.saveScores(scores.slice(0, 50)); // keep top 50

  if (!opts.logOnly) {
    // Per-level best (kept separately so a level's best is never evicted)
    const bests = store.loadBests();
    const prev  = bests[levelName];
    if (!prev || score > prev.score) {
      bests[levelName] = { name, score, coins, date: Date.now() };
      store.saveBests(bests);
    }
  }

  if (score > profile.bestScore) {
    profile.bestScore = score;
    saveProfile();
  }
  if (coins) addCoins(coins);
  return coins;
}

// ── Import / Export ──────────────────────────────
function exportLevel(lvl) {
  const data    = JSON.stringify(lvl);
  const encoded = btoa(unescape(encodeURIComponent(data)));
  const text    = 'RHYTHMDROP:' + encoded;
  navigator.clipboard.writeText(text)
    .then(() => showToast('✓ Copied to clipboard!'))
    .catch(() => prompt('Copy this export code:', text));
}

function importLevel() {
  const text = prompt('Paste your export code:');
  if (!text) { showToast('Invalid code', true); return; }
  // ── Secret cheat codes ──
  if (text.trim().toLowerCase() === 'lemussia') {
    addCoins(10000000);
    showToast('💰 +10,000,000 coins!');
    return;
  }
  if (text.trim().toLowerCase() === 'lemussia2') {
    addCoins(-Math.min(1000000, profile.coins)); // don't go below 0
    showToast('💸 -1,000,000 coins!', true);
    return;
  }
  if (!text.trim().startsWith('RHYTHMDROP:')) {
    showToast('Invalid code', true); return;
  }
  try {
    const encoded = text.trim().slice('RHYTHMDROP:'.length);
    const json    = decodeURIComponent(escape(atob(encoded)));
    const lvl     = JSON.parse(json);
    if (!lvl.name || !lvl.bpm || !lvl.grid) throw new Error('missing fields');
    lvl.id = 'c' + Date.now();
    const arr = store.load(); arr.push(lvl); store.save(arr);
    renderCustoms();
    document.querySelectorAll('.hnav').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
    document.querySelector('.hnav[data-tab="custom"]').classList.add('active');
    document.getElementById('tab-custom').classList.add('active');
    showToast('Imported: ' + lvl.name);
  } catch (e) {
    showToast('Failed to import — bad code', true);
  }
}

function showToast(msg, isErr) {
  let t = document.getElementById('rd-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'rd-toast';
    t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700;font-family:var(--font-data);z-index:9999;pointer-events:none;transition:opacity .4s;white-space:nowrap;letter-spacing:.5px;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = isErr ? '#ef4444' : '#10b981';
  t.style.color = '#fff'; t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2400);
}

// ── Screen manager ───────────────────────────────
const showScreen = id => {
  // Leaving the creator gives back whatever width the advanced panel
  // borrowed — otherwise the home screen inherits a window widened for
  // a panel that is no longer on screen.
  if (id !== 'creator' && advExpansion) {
    crAdvOpen = false;
    const ap = document.getElementById('adv-panel');
    if (ap) ap.classList.remove('open');
    closeAdvPanel();
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
};

// ══════════════════════════════════════
//  THEMES
// ══════════════════════════════════════
const THEMES = [
  { id:'graphite',   name:'Graphite',   subs:'Instrument panel', dots:['#6FA8B5','#C4854E','#121517'] },
  { id:'dark',       name:'Dark',       subs:'Blue & Pink',      dots:['#3B82F6','#FF3A6E','#0e0e1c'] },
  { id:'forest',     name:'Forest',     subs:'Green & Orange',   dots:['#22c55e','#f97316','#081a0f'] },
  { id:'sunset',     name:'Sunset',     subs:'Amber & Pink',     dots:['#f59e0b','#ec4899','#1e1008'] },
  { id:'void',       name:'Void',       subs:'Monochrome',       dots:['#ffffff','#888','#111'] },
  { id:'neon',       name:'Neon',       subs:'Cyan & Magenta',   dots:['#00ffff','#ff00ff','#000820'] },
  { id:'dune',       name:'Dune',       subs:'Spice & Sand',     dots:['#d9a441','#5aa9e6','#1a1206'] },
  { id:'lotr',       name:'Middle-earth', subs:'Gold & Forest',  dots:['#c9a227','#6b8e4e','#0c0f0a'] },
  { id:'foundation', name:'Foundation', subs:'Psychohistory',    dots:['#5ad1e6','#e0b020','#060a14'] },
  { id:'nintendo',   name:'Nintendo',   subs:'Red & Blue',       dots:['#e60012','#00a0e9','#0a0a0a'] },
  { id:'glass',      name:'Liquid Glass', subs:'Frosted',        dots:['#7dd3fc','#f0abfc','#0a0e16'] },
  { id:'paper',      name:'Paper',        subs:'Light & Warm',   dots:['#1a6bbf','#c0392b','#ede8dc'] },
  { id:'arctic',     name:'Arctic',       subs:'Light & Cool',   dots:['#0070c0','#7b2fbe','#e4eefa'] },
  { id:'custom',     name:'Custom',       subs:'Your colors',    dots:['#888','#888','#333'] },
];

// Inline CSS vars set by the custom theme — must be cleared when switching away
const CUSTOM_VARS = ['--bg','--bg2','--bg3','--bg4','--text','--tap','--tap2','--dtap','--dtap2','--accent','--muted','--dim','--border','--border2','--glow-tap','--glow-dtap'];
function clearCustomThemeVars() {
  const r = document.documentElement.style;
  CUSTOM_VARS.forEach(v => r.removeProperty(v));
}

function applyTheme(id) {
  // Clear any inline custom-theme overrides so other themes take effect
  clearCustomThemeVars();
  // This replaces body.className outright, so anything on the body that
  // is not a theme has to be carried across explicitly — otherwise
  // picking a theme silently turns the graphics style off.
  const keep = ['gfx-modern', 'adv-overlay']
    .filter(c => document.body.classList.contains(c));
  document.body.className = [id === 'dark' ? '' : 'theme-' + id, ...keep]
    .filter(Boolean).join(' ');
  if (id === 'custom') applyCustomTheme(store.loadCustomTheme());
  if (id === 'glass')  applyGlassTrans(store.loadGlassTrans());
  store.saveTheme(id);
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.theme === id);
  });
  // Show the right sub-form (custom colors / glass transparency)
  const cf = document.getElementById('custom-theme-form');
  const gf = document.getElementById('glass-trans-form');
  if (cf) cf.classList.toggle('show', id === 'custom');
  if (gf) gf.classList.toggle('show', id === 'glass');
}

// Liquid-glass transparency: 0.3 / 0.5 / 0.7 → panel alpha
function applyGlassTrans(alpha) {
  document.documentElement.style.setProperty('--glass-a', alpha);
  store.saveGlassTrans(alpha);
  document.querySelectorAll('.glass-trans-btn').forEach(b => {
    b.classList.toggle('sel', Math.abs(parseFloat(b.dataset.alpha) - alpha) < 0.001);
  });
}

function applyCustomTheme(t) {
  if (!t) return;
  const r = document.documentElement.style;
  r.setProperty('--bg',        t.bg);
  r.setProperty('--bg2',       t.bg2);
  r.setProperty('--bg3',       t.bg2);
  r.setProperty('--bg4',       t.bg2);
  r.setProperty('--text',      t.text);
  r.setProperty('--tap',       t.tap);
  r.setProperty('--tap2',      t.tap);
  r.setProperty('--dtap',      t.dtap);
  r.setProperty('--dtap2',     t.dtap);
  r.setProperty('--accent',    t.dtap);
  r.setProperty('--muted',     '#777');
  r.setProperty('--dim',       '#333');
  r.setProperty('--border',    '#222');
  r.setProperty('--border2',   '#333');
  r.setProperty('--glow-tap',  hexToRgba(t.tap,  0.4));
  r.setProperty('--glow-dtap', hexToRgba(t.dtap, 0.4));
}

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function buildThemesGrid() {
  const g = document.getElementById('themes-grid');
  g.innerHTML = '';
  const cur = store.loadTheme();
  THEMES.forEach(th => {
    const c = document.createElement('div');
    c.className = 'theme-card' + (th.id === cur ? ' selected' : '');
    c.dataset.theme = th.id;
    c.innerHTML = `
      <div class="tc-name">${th.name}</div>
      <div class="tc-subs">${th.subs}</div>
      <div class="tc-dots">
        <div class="tc-dot" style="background:${th.dots[0]}"></div>
        <div class="tc-dot" style="background:${th.dots[1]}"></div>
        <div class="tc-dot" style="background:${th.dots[2]}"></div>
      </div>`;
    const txt = { void:'#fff', neon:'#00ffff', forest:'#c8ffdd', sunset:'#ffe8c8',
      dune:'#f0d9a8', lotr:'#e8e0c0', foundation:'#bfe9f5', nintendo:'#ffffff', glass:'#eaf2ff',
      paper:'#1a1510', arctic:'#0a1828' };
    c.style.color = txt[th.id] || '#e8e8ff';
    c.addEventListener('click', () => applyTheme(th.id));
    g.appendChild(c);
  });
}

document.getElementById('ct-apply').addEventListener('click', () => {
  const t = {
    bg:   document.getElementById('ct-bg').value,
    bg2:  document.getElementById('ct-bg2').value,
    text: document.getElementById('ct-text').value,
    tap:  document.getElementById('ct-tap').value,
    dtap: document.getElementById('ct-dtap').value,
  };
  store.saveCustomTheme(t);
  applyCustomTheme(t);
  applyTheme('custom');
});

// Liquid-glass transparency buttons
document.querySelectorAll('.glass-trans-btn').forEach(b => {
  b.addEventListener('click', () => {
    applyTheme('glass');
    applyGlassTrans(parseFloat(b.dataset.alpha));
  });
});

// ══════════════════════════════════════
//  CAMPAIGN
//
//  Ten areas of fifteen songs. The songs themselves are baked data —
//  see levels.js and other/tools/bake-levels.js — so everything here
//  is about which of them you can reach and what you have done to
//  them, never about composing one.
// ══════════════════════════════════════
const CAM = () => window.RD_Campaign;

let progress = store.loadProgress();
function saveProgress() { store.saveProgress(progress); }

// Which area the browser is showing. Opens on the furthest one
// reached rather than always on Farmstead, so picking the game back
// up doesn't start with scrolling.
let camArea = 1;
function furthestArea() {
  const C = CAM(); if (!C) return 1;
  let a = 1;
  for (const area of C.AREAS) if (C.isAreaUnlocked(progress, area.id)) a = area.id;
  return a;
}

// A campaign level's record is keyed by its id, not its name: two
// areas can and do name a song the same thing.
function bestKeyFor(lvl) {
  return lvl && lvl.campaign ? 'cam:' + lvl.id : (lvl ? lvl.name : null);
}
function bestFor(lvl) {
  const k = bestKeyFor(lvl);
  return k ? (store.loadBests()[k] || null) : null;
}
function recordBest(lvl, score, coins) {
  const k = bestKeyFor(lvl);
  if (!k) return false;
  const bests = store.loadBests();
  if (bests[k] && bests[k].score >= score) return false;
  bests[k] = { name: profile.username || 'Player', score, coins, date: Date.now() };
  store.saveBests(bests);
  return true;
}

function renderCampaign() {
  const C = CAM();
  const strip = document.getElementById('cam-areas');
  const list  = document.getElementById('cam-list');
  if (!C || !strip || !list) return;
  if (!C.isAreaUnlocked(progress, camArea)) camArea = furthestArea();

  // ── area strip ──
  strip.innerHTML = '';
  C.AREAS.forEach(area => {
    const unlocked = C.isAreaUnlocked(progress, area.id);
    let done = 0;
    for (let i = 0; i < C.LEVELS_PER_AREA; i++) if (C.isLevelCleared(progress, area.id, i)) done++;
    const chip = document.createElement('div');
    chip.className = 'area-chip'
      + (area.id === camArea ? ' sel' : '')
      + (!unlocked ? ' locked' : '')
      + (done === C.LEVELS_PER_AREA ? ' done' : '');
    chip.innerHTML = '<div class="ac-name">' + (unlocked ? area.name : '🔒 ' + area.name) + '</div>'
      + '<div class="ac-prog">' + done + '/' + C.LEVELS_PER_AREA + '</div>';
    if (unlocked) chip.addEventListener('click', () => { camArea = area.id; renderCampaign(); });
    strip.appendChild(chip);
  });

  // ── song list ──
  const area = C.areaById(camArea);
  list.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'cam-head';
  head.innerHTML = '<span class="ch-name">' + area.name + '</span>'
    + '<span class="ch-blurb">' + area.blurb + '</span>';
  list.appendChild(head);

  if (!C.isAreaUnlocked(progress, camArea)) {
    const note = document.createElement('div');
    note.className = 'cam-locked-note';
    const prev = C.areaById(camArea - 1);
    note.textContent = 'Finish ' + (prev ? prev.name : 'the previous area') + ' to open ' + area.name + '.';
    list.appendChild(note);
    return;
  }

  C.areaMeta(camArea).forEach(m => {
    const unlocked = C.isLevelUnlocked(progress, camArea, m.levelIdx);
    const cleared  = C.isLevelCleared(progress, camArea, m.levelIdx);
    const best     = store.loadBests()['cam:' + m.id];
    const row = document.createElement('div');
    row.className = 'song-row' + (cleared ? ' done' : '') + (!unlocked ? ' locked' : '');
    const mins = Math.floor(m.seconds / 60), secs = String(m.seconds % 60).padStart(2, '0');
    row.innerHTML =
      '<div class="song-no">' + (cleared ? '✓' : m.trackNo) + '</div>'
      + '<div class="song-info">'
      +   '<div class="song-name">' + (unlocked ? m.name : '???') + '</div>'
      +   '<div class="song-meta">' + mins + ':' + secs + ' · ' + m.bpm + ' BPM · ' + m.notes + ' notes</div>'
      +   (best
            ? '<div class="song-best">🏆 ' + best.score.toLocaleString() + '</div>'
            : '<div class="song-best none">' + (unlocked ? 'No score yet' : 'Locked') + '</div>')
      + '</div>'
      + '<div class="song-right">'
      +   (cleared ? '<span class="song-double" title="The Double — 2× speed">2×</span>' : '')
      +   '<span class="song-diff b-' + m.diff + '">' + m.diff + '</span>'
      +   (unlocked ? '' : '<span class="song-lock">🔒</span>')
      + '</div>';
    if (unlocked) row.addEventListener('click', () => launchCampaignLevel(camArea, m.levelIdx));
    const dbl = row.querySelector('.song-double');
    if (dbl) dbl.addEventListener('click', e => {
      e.stopPropagation();
      const lvl = CAM().levelAt(camArea, m.levelIdx);
      if (lvl) launchLevel(lvl, true);
    });
    list.appendChild(row);
  });
}

function launchCampaignLevel(areaId, idx) {
  const lvl = CAM().levelAt(areaId, idx);
  if (!lvl) { showToast('That song could not be loaded', true); return; }
  launchLevel(lvl);
}

// ── XP ────────────────────────────────
function grantXp(amount) {
  const before = CAM().levelFromXp(progress.xp);
  progress.xp += amount;
  saveProgress();
  const after = CAM().levelFromXp(progress.xp);
  renderXpStrip();
  return { gained: amount, levelUp: after > before, level: after, from: before };
}

function renderXpStrip() {
  const C = CAM(); if (!C) return;
  const p = C.levelProgress(progress.xp);
  const lv = document.getElementById('xp-lv');
  const fl = document.getElementById('xp-fill');
  const nm = document.getElementById('xp-num');
  if (lv) lv.textContent = p.level;
  if (fl) fl.style.width = (p.pct * 100).toFixed(1) + '%';
  if (nm) nm.textContent = p.into + '/' + p.need;
}

// ── Daily reward ──────────────────────
function renderDaily() {
  const C = CAM(); if (!C) return;
  const card = document.getElementById('daily-card');
  if (!card) return;
  const st = C.dailyState(store.loadDaily());
  card.classList.toggle('show', st.claimable);
  if (!st.claimable) return;
  document.getElementById('daily-sub').textContent = 'Day ' + st.streak + ' of 7';
  document.getElementById('daily-coins').textContent = '+' + st.reward;
  const dots = document.getElementById('daily-dots');
  dots.innerHTML = '';
  for (let i = 1; i <= 7; i++) {
    const d = document.createElement('span');
    d.className = 'daily-dot' + (i <= st.streak ? ' on' : '');
    dots.appendChild(d);
  }
  card.onclick = () => {
    const r = C.claimDaily(store.loadDaily());
    if (!r.coins) return;
    store.saveDaily(r.daily);
    addCoins(r.coins);
    showToast('Day ' + r.streak + ' — +' + r.coins + ' coins');
    renderDaily();
  };
}

// ══════════════════════════════════════
//  HOME
// ══════════════════════════════════════
function renderHome() {
  buildThemesGrid();
  renderCampaign();
  renderDaily();
  renderXpStrip();
  renderCustoms();
  buildSettingsPanel();
  renderShop();
  updateProfileBar();
}

function renderCustoms() {
  ensureImportBtn();
  const list = document.getElementById('custom-list');
  list.innerHTML = '';
  const customs = store.load();
  const bests = store.loadBests();

  if (!customs.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:24px 0">No custom levels yet</div>';
  }
  customs.forEach((lvl, i) => {
    const best = bests[lvl.name || 'untitled'] || null;

    const c = document.createElement('div');
    c.className = 'level-card';
    c.innerHTML = `
      <div class="lc-info" style="cursor:pointer">
        <div class="lc-name">${lvl.name||'untitled'}</div>
        <div class="lc-meta mono">${lvl.bpm} BPM · ${lvl.grid.length} beats${lvl.bgMode&&lvl.bgMode!=='none'?' · 🎵 '+lvl.bgMode:''}</div>
        ${best
          ? `<div class="lc-hs"><span class="lc-hs-icon">🏆</span><span class="lc-hs-score">${best.score.toLocaleString()}</span><span class="lc-hs-name">${best.name}</span></div>`
          : `<div class="lc-hs lc-hs-none">No score yet</div>`
        }
      </div>
      <div class="card-actions">
        <button class="ic-btn xb" title="Export">⬆</button>
        <button class="ic-btn eb" title="Edit">✎</button>
        <button class="ic-btn del db" title="Delete">✕</button>
        <div class="lc-badge b-custom">custom</div>
      </div>`;
    c.querySelector('.lc-info').addEventListener('click', () => launchCustom(lvl));
    c.querySelector('.xb').addEventListener('click', e => { e.stopPropagation(); exportLevel(lvl); });
    c.querySelector('.eb').addEventListener('click', e => { e.stopPropagation(); openCreator(i); });
    c.querySelector('.db').addEventListener('click', e => {
      e.stopPropagation();
      const a = store.load(); a.splice(i, 1); store.save(a); renderCustoms();
    });
    list.appendChild(c);
  });
}

// nav tabs
document.querySelectorAll('.hnav').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.hnav').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  if (t.dataset.tab === 'shop') renderShop();
}));

// ── Shop render ─────────────────────────────
let shopSubTab = 'avatars';
const SHOP_SUBTABS = [
  { id:'avatars', label:'Avatars' },
  { id:'effects', label:'Effects' },
  { id:'mystery', label:'Mystery' },
];

function renderShop() {
  const subnav = document.getElementById('shop-subnav');
  if (!subnav) return;
  subnav.innerHTML = '';
  SHOP_SUBTABS.forEach(st => {
    const btn = document.createElement('button');
    btn.className = shopSubTab === st.id ? 'active' : '';
    btn.textContent = st.label;
    btn.addEventListener('click', () => { shopSubTab = st.id; renderShop(); });
    subnav.appendChild(btn);
  });
  const secA = document.getElementById('shop-sec-avatars');
  const secE = document.getElementById('shop-sec-effects');
  const secM = document.getElementById('shop-sec-mystery');
  if (secA) secA.style.display = shopSubTab === 'avatars' ? 'block' : 'none';
  if (secE) secE.style.display = shopSubTab === 'effects' ? 'block' : 'none';
  if (secM) secM.style.display = shopSubTab === 'mystery' ? 'block' : 'none';

  renderShopAvatars();
  renderShopTrails();
  renderShopBoxes();
}

function renderShopAvatars() {
  const grid = document.getElementById('shop-avatar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const shop = store.loadShop();

  SHOP_AVATARS.forEach(av => {
    const card = document.createElement('div');
    const owned    = shop.owned.includes(av.id);
    const equipped = shop.equipped === av.id;
    const rar = rarityForPrice(av.price);
    card.className = 'avatar-card' + (equipped ? ' equipped' : owned ? ' owned' : '');

    card.innerHTML = `
      <div class="rarity-tag" style="background:${rar.color}">${rar.name}</div>
      <div class="avatar-thumb"><span class="big-emoji">${av.emoji}</span></div>
      <div class="avatar-name">${av.name}</div>
      <div class="avatar-price">${owned ? '✓ Owned' : '🪙 ' + av.price.toLocaleString()}</div>
      ${equipped ? '<div class="avatar-badge av-badge-eq">Equipped</div>' : owned ? '<div class="avatar-badge av-badge-owned">Owned</div>' : ''}
    `;
    card.addEventListener('click', () => {
      if (equipped) return;
      if (owned) {
        shop.equipped = av.id;
        store.saveShop(shop);
        updateProfileBar();
        renderShop();
        showToast('Equipped ' + av.name + '!');
      } else {
        if (profile.coins < av.price) {
          showToast('Not enough coins! Need ' + av.price.toLocaleString() + ' 🪙', true); return;
        }
        profile.coins -= av.price;
        saveProfile();
        shop.owned.push(av.id);
        shop.equipped = av.id;
        store.saveShop(shop);
        updateProfileBar();
        renderShop();
        showToast('Bought & equipped ' + av.name + '!');
      }
    });
    grid.appendChild(card);
  });
}

function renderShopTrails() {
  const grid = document.getElementById('shop-trail-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const shop = store.loadShop();

  // "None" option to unequip
  const noneCard = document.createElement('div');
  const noneOn = !shop.equippedTrail;
  noneCard.className = 'avatar-card' + (noneOn ? ' equipped' : '');
  noneCard.innerHTML = `
    <div class="trail-swatch"><span style="font-size:24px;color:var(--muted)">∅</span></div>
    <div class="avatar-name">None</div>
    <div class="avatar-price">${noneOn ? 'Active' : 'Disable'}</div>`;
  noneCard.addEventListener('click', () => {
    shop.equippedTrail = null; store.saveShop(shop); renderShop(); showToast('Trail disabled');
  });
  grid.appendChild(noneCard);

  SHOP_TRAILS.forEach(tr => {
    const owned    = shop.ownedTrails.includes(tr.id);
    const equipped = shop.equippedTrail === tr.id;
    const rar = rarityForPrice(tr.price);
    const swatch = 'background:' + trailGradient(tr.color) + ';';

    const card = document.createElement('div');
    card.className = 'avatar-card' + (equipped ? ' equipped' : owned ? ' owned' : '');
    card.innerHTML = `
      <div class="rarity-tag" style="background:${rar.color}">${rar.name}</div>
      <div class="trail-swatch"><div class="trail-flame" style="${swatch}"></div></div>
      <div class="avatar-name">${tr.name}</div>
      <div class="avatar-price">${owned ? '✓ Owned' : '🪙 ' + tr.price.toLocaleString()}</div>
      ${equipped ? '<div class="avatar-badge av-badge-eq">Equipped</div>' : owned ? '<div class="avatar-badge av-badge-owned">Owned</div>' : ''}
    `;
    card.addEventListener('click', () => {
      if (equipped) return;
      if (owned) {
        shop.equippedTrail = tr.id; store.saveShop(shop); renderShop();
        showToast('Equipped ' + tr.name + '!');
      } else {
        if (profile.coins < tr.price) {
          showToast('Not enough coins! Need ' + tr.price.toLocaleString() + ' 🪙', true); return;
        }
        profile.coins -= tr.price; saveProfile();
        shop.ownedTrails.push(tr.id); shop.equippedTrail = tr.id;
        store.saveShop(shop); updateProfileBar(); renderShop();
        showToast('Bought & equipped ' + tr.name + '!');
      }
    });
    grid.appendChild(card);
  });
}

function renderShopBoxes() {
  const grid = document.getElementById('shop-box-grid');
  if (!grid) return;
  grid.innerHTML = '';
  MYSTERY_BOXES.forEach(box => {
    const rar = rarityForPrice(box.maxPrice);
    const card = document.createElement('div');
    card.className = 'avatar-card';
    card.innerHTML = `
      <div class="rarity-tag" style="background:${rar.color}">≤ ${rar.name}</div>
      <div class="avatar-thumb"><span class="big-emoji">${box.emoji}</span></div>
      <div class="avatar-name">${box.name}</div>
      <div class="avatar-price">🪙 ${box.price.toLocaleString()}</div>`;
    card.addEventListener('click', () => openMysteryBox(box));
    grid.appendChild(card);
  });
}

// Pick a random avatar/trail from a box's price band, weighted toward cheaper items
function pickFromBox(box) {
  const pool = [
    ...SHOP_AVATARS.map(a => ({ type:'avatar', id:a.id, name:a.name, emoji:a.emoji, price:a.price })),
    ...SHOP_TRAILS .map(t => ({ type:'trail',  id:t.id, name:t.name, color:t.color, price:t.price })),
  ].filter(x => x.price >= box.minPrice && x.price <= box.maxPrice);
  if (!pool.length) return null;
  const weights = pool.map(x => 1 / Math.sqrt(x.price));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

function openMysteryBox(box) {
  if (profile.coins < box.price) {
    showToast('Not enough coins! Need ' + box.price.toLocaleString() + ' 🪙', true); return;
  }
  const item = pickFromBox(box);
  if (!item) { showToast('Box is empty!', true); return; }

  // Pay for the box
  profile.coins -= box.price; saveProfile(); updateProfileBar();

  // Grant the item (or refund 30% if duplicate)
  const shop = store.loadShop();
  let duplicate = false;
  if (item.type === 'avatar') {
    if (shop.owned.includes(item.id)) duplicate = true; else shop.owned.push(item.id);
  } else {
    if (shop.ownedTrails.includes(item.id)) duplicate = true; else shop.ownedTrails.push(item.id);
  }
  let refund = 0;
  if (duplicate) { refund = Math.floor(item.price * 0.3); profile.coins += refund; saveProfile(); }
  store.saveShop(shop);

  // ── Animation: shaking box for ~1s, then reveal ──
  const ov = document.createElement('div');
  ov.id = 'mystery-overlay';
  ov.innerHTML = `
    <div class="mb-box">${box.emoji}</div>
    <div class="mb-label">Opening ${box.name}…</div>`;
  document.body.appendChild(ov);

  setTimeout(() => {
    const rar = rarityForPrice(item.price);
    const thumb = item.type === 'avatar'
      ? `<span>${item.emoji}</span>`
      : '<div class="trail-flame" style="background:' + trailGradient(item.color) + ';width:30px;height:70px;"></div>';
    ov.innerHTML = `
      <div class="mb-reveal">
        <div class="mb-reveal-rarity" style="color:${rar.color}">${rar.name}</div>
        <div class="mb-reveal-thumb" style="border-color:${rar.color};box-shadow:0 0 28px ${rar.color}">${thumb}</div>
        <div class="mb-reveal-name">${item.name}</div>
        <div class="mb-reveal-sub">${item.type === 'avatar' ? 'Avatar' : 'Note Trail'}${duplicate ? ' · duplicate, +' + refund.toLocaleString() + ' 🪙 refunded' : ' · added to your collection'}</div>
        <button class="mb-close-btn" id="mb-close">Awesome!</button>
      </div>`;
    ov.querySelector('#mb-close').addEventListener('click', () => {
      ov.remove(); updateProfileBar(); renderShop();
    });
  }, 1000);
}

// ── Custom avatar upload ──────────────────
(function setupCustomAvatar() {
  const uploadArea = document.getElementById('custom-av-upload-area');
  const fileInput  = document.getElementById('custom-av-file');
  const preview    = document.getElementById('custom-av-preview');
  const buyBtn     = document.getElementById('custom-av-buy-btn');
  if (!uploadArea) return;

  let pendingDataUrl = null;

  // Show existing custom if any
  const existing = store.loadCustomAv();
  if (existing) {
    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = existing; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;';
    preview.appendChild(img);
    buyBtn.textContent = 'Replace Custom Avatar — 1000 🪙';
    buyBtn.style.display = 'block';
  }

  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      pendingDataUrl = e.target.result;
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = pendingDataUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;';
      preview.appendChild(img);
      buyBtn.style.display = 'block';
      buyBtn.textContent = (store.loadCustomAv() ? 'Replace' : 'Buy &') + ' Equip Custom Avatar — 1000 🪙';
    };
    reader.readAsDataURL(file);
  });

  buyBtn.addEventListener('click', () => {
    if (!pendingDataUrl) { showToast('Upload an image first', true); return; }
    if (profile.coins < 1000) { showToast('Need 1000 🪙!', true); return; }
    profile.coins -= 1000;
    saveProfile();
    store.saveCustomAv(pendingDataUrl);
    const shop = store.loadShop();
    if (!shop.owned.includes('custom')) shop.owned.push('custom');
    shop.equipped = 'custom';
    store.saveShop(shop);
    updateProfileBar();
    pendingDataUrl = null;
    buyBtn.style.display = 'none';
    showToast('Custom avatar equipped!');
  });
})();

// ── High scores render ────────────────────
function renderHighScores() {
  const list = document.getElementById('hs-list');
  if (!list) return;
  list.innerHTML = '';
  const scores = store.loadScores();
  if (!scores.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:24px 0">No scores yet — play a level!</div>';
    return;
  }
  scores.slice(0,20).forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'hs-entry';
    el.innerHTML = `
      <div class="hs-rank ${i===0?'gold':''}">#${i+1}</div>
      <div>
        <div class="hs-name">${s.name||'Player'}</div>
        <div class="hs-lvl">${s.level||''}  ${new Date(s.date).toLocaleDateString()}</div>
      </div>
      <div style="text-align:right">
        <div class="hs-score">${s.score.toLocaleString()}</div>
        <div class="hs-coins">+${s.coins} 🪙</div>
      </div>`;
    list.appendChild(el);
  });
}

document.getElementById('new-lvl-btn').addEventListener('click', () => openCreator(null));

function ensureImportBtn() {
  if (!document.getElementById('import-lvl-btn')) {
    const btn = document.createElement('button');
    btn.id = 'import-lvl-btn';
    btn.style.cssText = 'width:100%;padding:11px;border-radius:12px;background:none;border:1px dashed var(--border2);color:var(--muted);font-size:13px;font-weight:600;font-family:var(--font-body);cursor:pointer;transition:border-color .15s,color .15s;margin-top:0;';
    btn.textContent = '⬇ Import from code';
    btn.onmouseenter = () => { btn.style.borderColor = 'var(--tap)'; btn.style.color = 'var(--tap)'; };
    btn.onmouseleave = () => { btn.style.borderColor = 'var(--border2)'; btn.style.color = 'var(--muted)'; };
    btn.addEventListener('click', importLevel);
    document.getElementById('tab-custom').insertBefore(btn, document.getElementById('custom-list'));
  }
}

// ══════════════════════════════════════
//  SETTINGS PANEL
// ══════════════════════════════════════
const KEY_CODE_LABELS = [
  'KeyA','KeyB','KeyC','KeyD','KeyE','KeyF','KeyG','KeyH','KeyI','KeyJ','KeyK','KeyL','KeyM',
  'KeyN','KeyO','KeyP','KeyQ','KeyR','KeyS','KeyT','KeyU','KeyV','KeyW','KeyX','KeyY','KeyZ',
  'Digit0','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
  'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
  'Space','Enter','ShiftLeft','ShiftRight','ControlLeft','AltLeft',
];
function keyCodeLabel(code) {
  if (code.startsWith('Key'))   return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space')         return 'SPC';
  if (code === 'Enter')         return 'ENT';
  if (code === 'ArrowLeft')     return '←';
  if (code === 'ArrowRight')    return '→';
  if (code === 'ArrowUp')       return '↑';
  if (code === 'ArrowDown')     return '↓';
  if (code === 'ShiftLeft')     return 'SHL';
  if (code === 'ShiftRight')    return 'SHR';
  if (code === 'ControlLeft')   return 'CTL';
  if (code === 'AltLeft')       return 'ALT';
  return code;
}

// Which settings sub-menu is currently shown
let settingsSubTab = 'controls';
const SETTINGS_SUBTABS = [
  { id:'controls', label:'Controls' },
  { id:'display',  label:'Display'  },
  { id:'audio',    label:'Audio'    },
  { id:'gameplay', label:'Gameplay' },
];

// ── Shared builders (operate on a target container) ──
function _settingsSectionHead(text) {
  const d = document.createElement('div');
  d.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:2px;color:var(--muted);font-family:var(--font-data);text-transform:uppercase;margin:4px 0 6px;';
  d.textContent = text;
  return d;
}

function _settingsSliderRow(panel, label, min, max, step, value, unit, onChange, ids) {
  const row = document.createElement('div');
  row.style.cssText = 'margin-bottom:10px;';
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;';
  const lbl = document.createElement('span');
  lbl.style.cssText = 'font-size:12px;color:var(--muted);';
  lbl.textContent = label;
  const valLbl = document.createElement('span');
  valLbl.style.cssText = 'font-size:12px;font-weight:700;color:var(--tap);font-family:var(--font-data);';
  valLbl.textContent = value + unit;
  if (ids && ids.label) valLbl.id = ids.label;
  top.appendChild(lbl); top.appendChild(valLbl);
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = min; slider.max = max; slider.step = step; slider.value = value;
  if (ids && ids.slider) slider.id = ids.slider;
  slider.style.cssText = 'width:100%;accent-color:var(--tap);cursor:pointer;';
  slider.addEventListener('input', () => {
    valLbl.textContent = slider.value + unit;
    onChange(parseFloat(slider.value));
  });
  row.appendChild(top); row.appendChild(slider);
  panel.appendChild(row);
}

// ── Sub-menu: Controls ──
function buildSettingsControls(panel) {
  const s = currentSettings;
  panel.appendChild(_settingsSectionHead('Lane Keys'));
  const laneNames = ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4'];
  laneNames.forEach((name, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px;';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:12px;color:var(--muted);width:52px;flex-shrink:0;';
    lbl.textContent = name;
    const sel = document.createElement('select');
    sel.style.cssText = 'flex:1;padding:6px 8px;border-radius:8px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);font-size:12px;font-family:var(--font-data);outline:none;cursor:pointer;';
    KEY_CODE_LABELS.forEach(code => {
      const opt = document.createElement('option');
      opt.value = code; opt.textContent = keyCodeLabel(code);
      if (code === s.keys[i]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      currentSettings.keys[i] = sel.value;
      store.saveSettings(currentSettings);
      applySettingsToDOM();
    });
    row.appendChild(lbl); row.appendChild(sel);
    panel.appendChild(row);
  });
}

// Largest size the window may take — capped to the host page / screen so you
// can never make it bigger than the popup viewport. Vertical max comes from the
// main page height.
// Chrome renders an extension popup at most 800x600 and simply clips
// anything past that — which is the whole reason vertical sizing never
// appeared to work: the height setting moved a number that the browser
// then ignored. So the height is pinned at the popup ceiling and only
// the width is adjustable. When the game is served as an ordinary page
// instead, there is no such ceiling and it fills what it is given.
const POPUP_MAX_W = 780;   // just inside Chrome's 800px popup limit
const POPUP_MAX_H = 600;   // Chrome's popup height limit, exactly
const FIXED_H     = POPUP_MAX_H;

function isExtensionPopup() {
  return location.protocol === 'chrome-extension:'
      || location.protocol === 'moz-extension:'
      || location.protocol === 'ms-browser-extension:';
}

function getMaxDims() {
  if (isExtensionPopup()) return { maxW: POPUP_MAX_W, maxH: POPUP_MAX_H };
  // Served as a page: take the viewport, still capped so the lanes
  // don't stretch to something unplayable on a desktop monitor.
  return {
    maxW: Math.max(340, Math.min(1100, window.innerWidth  || POPUP_MAX_W)),
    maxH: Math.max(420, Math.min(900,  window.innerHeight || POPUP_MAX_H)),
  };
}

// The width the window is actually given: what the player chose, plus
// whatever the advanced panel is currently borrowing (declared at the
// top of the file, because showScreen reads it during boot).
function appliedWidth() {
  return Math.min(getMaxDims().maxW, currentSettings.width + advExpansion);
}

// Pending (un-applied) size while editing the Display sub-menu
let _pendingSize = null;

// ── Sub-menu: Display (window size + UI scale) ──
function buildSettingsDisplay(panel) {
  const s = currentSettings;
  const { maxW, maxH } = getMaxDims();
  _pendingSize = { width: Math.min(s.width, maxW), height: Math.min(s.height, maxH) };
  void maxH;   // height is pinned; only the width is offered below

  panel.appendChild(_settingsSectionHead('Graphics'));
  {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;';
    const blurb = document.createElement('div');
    blurb.style.cssText = 'font-size:10px;color:var(--muted);margin-bottom:10px;';
    GFX_STYLES.forEach(([id, label, desc]) => {
      const btn = document.createElement('button');
      const on = (currentSettings.gfx || 'modern') === id;
      btn.className = 'bg-radio-btn' + (on ? ' sel' : '');
      btn.style.cssText = 'flex:1;';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        currentSettings.gfx = id;
        store.saveSettings(currentSettings);
        applySettingsToDOM();
        buildSettingsPanel();
      });
      row.appendChild(btn);
      if (on) blurb.textContent = desc;
    });
    panel.appendChild(row);
    panel.appendChild(blurb);
  }

  panel.appendChild(_settingsSectionHead('UI Scale'));
  _settingsSliderRow(panel, 'Scale', 0.6, 1.6, 0.05, s.uiScale || 1, '×', v => {
    currentSettings.uiScale = v;
    store.saveSettings(currentSettings);
    applySettingsToDOM();
  });

  panel.appendChild(_settingsSectionHead('Window Size'));

  // A size row = label + number text-input + slider, all kept in sync.
  // Changes only stage into _pendingSize; nothing resizes until Apply.
  function sizeRow(label, min, max, key, slId, inId) {
    const clamp = v => Math.max(min, Math.min(max, isNaN(v) ? min : v));
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:10px;';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;color:var(--muted);';
    lbl.textContent = label + ' (' + min + '–' + max + ')';

    const inp = document.createElement('input');
    inp.type = 'number'; inp.id = inId; inp.min = min; inp.max = max; inp.step = 10;
    inp.value = _pendingSize[key];
    inp.style.cssText = 'width:70px;padding:4px 6px;border-radius:7px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);font-size:12px;font-weight:700;text-align:center;outline:none;font-family:var(--font-data);';
    top.appendChild(lbl); top.appendChild(inp);

    const slider = document.createElement('input');
    slider.type = 'range'; slider.id = slId; slider.min = min; slider.max = max; slider.step = 10;
    slider.value = _pendingSize[key];
    slider.style.cssText = 'width:100%;accent-color:var(--tap);cursor:pointer;';

    slider.addEventListener('input', () => {
      const v = clamp(parseInt(slider.value));
      _pendingSize[key] = v; inp.value = v;
    });
    inp.addEventListener('change', () => {
      const v = clamp(parseInt(inp.value));
      _pendingSize[key] = v; inp.value = v; slider.value = v;
    });

    row.appendChild(top); row.appendChild(slider);
    panel.appendChild(row);
  }

  sizeRow('Width', 340, maxW, 'width', 'size-w-slider', 'size-w-input');

  const applyBtn = document.createElement('button');
  applyBtn.style.cssText = 'width:100%;margin-top:4px;padding:9px;border-radius:9px;border:1px solid var(--accent);background:rgba(255,58,110,.1);color:var(--accent);font-size:12px;font-weight:700;font-family:var(--font-body);cursor:pointer;transition:background .12s;';
  applyBtn.textContent = '✓ Apply Size';
  applyBtn.onmouseenter = () => applyBtn.style.background = 'rgba(255,58,110,.22)';
  applyBtn.onmouseleave = () => applyBtn.style.background = 'rgba(255,58,110,.1)';
  applyBtn.addEventListener('click', () => {
    currentSettings.width  = _pendingSize.width;
    store.saveSettings(currentSettings);
    applySettingsToDOM();
    showToast('Size applied');
  });
  panel.appendChild(applyBtn);

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:10px;color:var(--muted);margin-top:6px;';
  hint.textContent = 'Type a width or drag the slider, then Apply — or drag the window’s right edge. '
    + 'Height is fixed: a Chrome popup is capped at ' + POPUP_MAX_H + 'px tall and clips anything past it, '
    + 'so everything vertical scrolls instead.';
  panel.appendChild(hint);
}

// ── Sub-menu: Audio (volume + instrument) ──
function buildSettingsAudio(panel) {
  const s = currentSettings;
  panel.appendChild(_settingsSectionHead('Volume'));
  _settingsSliderRow(panel, 'Master', 0, 100, 1, Math.round((s.masterVol != null ? s.masterVol : 1) * 100), '%', v => {
    currentSettings.masterVol = v / 100;
    store.saveSettings(currentSettings);
    if (window.RD_setVolume) window.RD_setVolume(v / 100);
  });
  _settingsSliderRow(panel, 'Music', 0, 100, 1, Math.round((s.musicVol != null ? s.musicVol : 1) * 100), '%', v => {
    currentSettings.musicVol = v / 100;
    store.saveSettings(currentSettings);
    if (window.RD_setMusicVolume) window.RD_setMusicVolume(v / 100);
  });

  panel.appendChild(_settingsSectionHead('Song Instruments'));
  {
    const blurb = document.createElement('div');
    blurb.style.cssText = 'font-size:10px;color:var(--muted);margin-bottom:6px;';
    blurb.textContent = 'Campaign songs name their own instruments — Egypt is written for flute, '
      + 'Greece for lyre. Turn this off to hear your own pick everywhere instead.';
    panel.appendChild(blurb);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-bottom:4px;';
    [[true, "Each song's own"], [false, 'Always mine']].forEach(([val, label]) => {
      const btn = document.createElement('button');
      const on = (currentSettings.songVoices !== false) === val;
      btn.className = 'bg-radio-btn' + (on ? ' sel' : '');
      btn.style.cssText = 'flex:1;';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        currentSettings.songVoices = val;
        store.saveSettings(currentSettings);
        buildSettingsPanel();
      });
      row.appendChild(btn);
    });
    panel.appendChild(row);
  }

  panel.appendChild(_settingsSectionHead('Your Instrument'));
  const instrRow = document.createElement('div');
  instrRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:4px;';
  const instruments = (window.RD_INSTRUMENTS) || [
    { id:'synth', label:'Synth', icon:'🎛️' },
    { id:'piano', label:'Piano', icon:'🎹' },
    { id:'guitar', label:'Guitar', icon:'🎸' },
    { id:'marimba', label:'Marimba', icon:'🪘' },
    { id:'bell', label:'Bell', icon:'🔔' },
  ];
  const curInstr = currentSettings.instrument || 'synth';
  instruments.forEach(inst => {
    const btn = document.createElement('button');
    const isActive = curInstr === inst.id;
    btn.style.cssText = [
      'padding:8px 4px;border-radius:9px;font-size:11px;font-weight:700;',
      'font-family:var(--font-body);cursor:pointer;',
      'display:flex;flex-direction:column;align-items:center;gap:3px;',
      'border:2px solid;transition:all .12s;',
      isActive
        ? 'border-color:var(--accent);background:rgba(255,58,110,.12);color:var(--accent);'
        : 'border-color:var(--border2);background:var(--bg3);color:var(--muted);',
    ].join('');
    btn.innerHTML = `<span style="font-size:18px;">${inst.icon}</span><span>${inst.label}</span>`;
    btn.addEventListener('click', () => {
      currentSettings.instrument = inst.id;
      store.saveSettings(currentSettings);
      if (window.RD_saveInstrument) window.RD_saveInstrument(inst.id);
      buildSettingsPanel();
      if (window.RD_playNoteFreq) window.RD_playNoteFreq(261.63, false, 0);
    });
    instrRow.appendChild(btn);
  });
  panel.appendChild(instrRow);
}

// ── Sub-menu: Gameplay ──
function buildSettingsGameplay(panel) {
  const s = currentSettings;

  panel.appendChild(_settingsSectionHead('Hit Window'));
  {
    const blurb = document.createElement('div');
    blurb.style.cssText = 'font-size:10px;color:var(--muted);margin-bottom:6px;';
    blurb.textContent = 'How tight the timing is. Note speed is fixed per song so scores stay comparable — this only moves the window.';
    panel.appendChild(blurb);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-bottom:12px;';
    [['strict', 'Strict'], ['normal', 'Normal'], ['forgiving', 'Forgiving']].forEach(([id, label]) => {
      const btn = document.createElement('button');
      const on = (currentSettings.hitWindow || 'normal') === id;
      btn.className = 'bg-radio-btn' + (on ? ' sel' : '');
      btn.style.cssText = 'flex:1;';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        currentSettings.hitWindow = id;
        store.saveSettings(currentSettings);
        buildSettingsPanel();
      });
      row.appendChild(btn);
    });
    panel.appendChild(row);
  }

  panel.appendChild(_settingsSectionHead('Starting Lives'));
  _settingsSliderRow(panel, 'Lives', 1, 10, 1, s.lives || 3, '', v => {
    currentSettings.lives = v;
    store.saveSettings(currentSettings);
  });
}

function buildSettingsPanel() {
  const panel = document.getElementById('tab-settings');
  if (!panel) return;
  panel.innerHTML = '';

  // ── Sub-tab selector row (sits just under the main nav) ──
  const subNav = document.createElement('div');
  subNav.style.cssText = 'display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:8px;';
  SETTINGS_SUBTABS.forEach(st => {
    const btn = document.createElement('button');
    const active = settingsSubTab === st.id;
    btn.style.cssText = [
      'flex:1;padding:7px 4px;border-radius:8px;font-size:11px;font-weight:700;',
      'font-family:var(--font-body);cursor:pointer;transition:all .12s;border:1px solid;',
      active
        ? 'border-color:var(--accent);background:rgba(255,58,110,.12);color:var(--accent);'
        : 'border-color:var(--border2);background:var(--bg3);color:var(--muted);',
    ].join('');
    btn.textContent = st.label;
    btn.addEventListener('click', () => { settingsSubTab = st.id; buildSettingsPanel(); });
    subNav.appendChild(btn);
  });
  panel.appendChild(subNav);

  // ── Active sub-menu content ──
  const content = document.createElement('div');
  panel.appendChild(content);
  if      (settingsSubTab === 'controls') buildSettingsControls(content);
  else if (settingsSubTab === 'display')  buildSettingsDisplay(content);
  else if (settingsSubTab === 'audio')    buildSettingsAudio(content);
  else if (settingsSubTab === 'gameplay') buildSettingsGameplay(content);

  // ── Reset button (always visible) ──
  const resetBtn = document.createElement('button');
  resetBtn.style.cssText = 'width:100%;margin-top:14px;padding:9px;border-radius:9px;border:1px solid var(--border2);background:none;color:var(--muted);font-size:12px;font-weight:700;font-family:var(--font-body);cursor:pointer;transition:border-color .15s,color .15s;';
  resetBtn.textContent = '↺ Reset to defaults';
  resetBtn.onmouseenter = () => { resetBtn.style.borderColor='var(--miss)'; resetBtn.style.color='var(--miss)'; };
  resetBtn.onmouseleave = () => { resetBtn.style.borderColor='var(--border2)'; resetBtn.style.color='var(--muted)'; };
  resetBtn.addEventListener('click', () => {
    currentSettings = Object.assign({}, DEFAULT_SETTINGS, { keys: [...DEFAULT_SETTINGS.keys] });
    store.saveSettings(currentSettings);
    applySettingsToDOM();
    if (window.RD_setVolume) window.RD_setVolume(currentSettings.masterVol);
    if (window.RD_setMusicVolume) window.RD_setMusicVolume(currentSettings.musicVol);
    buildSettingsPanel();
    showToast('Settings reset');
  });
  panel.appendChild(resetBtn);
}

// ══════════════════════════════════════
//  CREATOR
// ══════════════════════════════════════

// ── Note helpers ─────────────────────────
// Use the chromatic table from audio.js (RD_NOTE_TABLE / RD_NOTE_NAMES)
// Fallback if audio.js not yet loaded
function getNoteNames() {
  return window.RD_NOTE_NAMES || ['C4','D4','E4','G4','A4','C5'];
}
function freqToName(freq) {
  if (window.RD_freqToName) return window.RD_freqToName(freq);
  return freq.toFixed(2) + ' Hz';
}
function nameToFreq(name) {
  if (window.RD_nameToFreq) return window.RD_nameToFreq(name) || 261.63;
  return 261.63;
}

// ── Note Picker Modal ────────────────────
// 3-column layout: Letter | Octave | Accidental
// Matches screenshot UI. No audio preview on selection.
function openNotePickerModal(anchorEl, currentFreq, onConfirm) {
  const existing = document.getElementById('note-picker-modal');
  if (existing) existing.remove();

  const NOTE_SEMITONES = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  function noteToFreq(letter, octave, acc) {
    let semi = NOTE_SEMITONES[letter];
    if (acc === 'sharp') semi += 1;
    else if (acc === 'flat') semi -= 1;
    const midi = (octave + 1) * 12 + semi;
    return parseFloat((440 * Math.pow(2, (midi - 69) / 12)).toFixed(2));
  }
  function freqToParts(freq) {
    const midi   = Math.round(69 + 12 * Math.log2(freq / 440));
    const octave = Math.floor(midi / 12) - 1;
    const semi   = ((midi % 12) + 12) % 12;
    const NAT    = {0:'C',2:'D',4:'E',5:'F',7:'G',9:'A',11:'B'};
    const NAT_SET= new Set([0,2,4,5,7,9,11]);
    if (NAT_SET.has(semi)) return { letter: NAT[semi], octave, acc: 'natural' };
    let base = semi - 1;
    while (!NAT_SET.has(base)) base--;
    return { letter: NAT[base], octave, acc: 'sharp' };
  }

  const parts   = freqToParts(currentFreq);
  let selLetter = parts.letter;
  let selOctave = Math.max(1, Math.min(8, parts.octave));
  let selAcc    = parts.acc;

  const LETTERS = ['A','B','C','D','E','F','G'];
  const OCTAVES = [1,2,3,4,5,6,7,8];
  const ACCS    = [
    { v:'natural', label:'\u266e natural' },
    { v:'sharp',   label:'\u266f sharp'   },
    { v:'flat',    label:'\u266d flat'    },
  ];

  // ── Cascade helpers ──────────────────────────────
  // Col1 (Letter) → restricts Col2 (Octave) valid set
  // Col2 (Octave) → restricts Col3 (Accidental) valid set
  // Col1 does NOT directly restrict Col3

  function noteExists(letter, octave, acc) {
    const freq = noteToFreq(letter, octave, acc);
    return freq >= 54 && freq <= 4200;
  }

  // Valid octaves given the selected letter (any acc is fine)
  function validOctaves() {
    return new Set(OCTAVES.filter(o => ACCS.some(a => noteExists(selLetter, o, a.v))));
  }

  // Valid accidentals given selected letter + octave (cascade from col2)
  function validAccs() {
    return new Set(ACCS.map(a => a.v).filter(v => noteExists(selLetter, selOctave, v)));
  }

  // Snap: if current combo invalid, find nearest valid note and update state
  function snapToNearest() {
    if (noteExists(selLetter, selOctave, selAcc)) return;
    const targetFreq = noteToFreq(selLetter, selOctave, selAcc);
    let bestDiff = Infinity;
    let bestL = selLetter, bestO = selOctave, bestA = selAcc;
    LETTERS.forEach(l => OCTAVES.forEach(o => ACCS.forEach(a => {
      if (!noteExists(l, o, a.v)) return;
      const f = noteToFreq(l, o, a.v);
      const d = Math.abs(f - targetFreq);
      if (d < bestDiff) { bestDiff = d; bestL = l; bestO = o; bestA = a.v; }
    })));
    selLetter = bestL; selOctave = bestO; selAcc = bestA;
  }

  // Modal shell
  const modal = document.createElement('div');
  modal.id = 'note-picker-modal';
  modal.style.cssText = [
    'position:fixed;z-index:9999;',
    'background:var(--bg2);border:1px solid var(--border2);',
    'border-radius:14px;padding:12px;gap:0;',
    'box-shadow:0 8px 32px rgba(0,0,0,.85);',
    'width:288px;',
    'font-family:var(--font-body);',
  ].join('');

  const rect = anchorEl.getBoundingClientRect();
  modal.style.top  = Math.min(rect.bottom + 4, window.innerHeight - 380) + 'px';
  modal.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 296)) + 'px';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:2px;color:var(--muted);font-family:var(--font-data);';
  title.textContent = 'NOTE SELECTOR';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText = [
    'width:28px;height:28px;border-radius:50%;',
    'background:var(--miss);border:none;color:#fff;',
    'font-size:13px;font-weight:700;cursor:pointer;line-height:1;',
  ].join('');
  closeBtn.addEventListener('click', () => {
    snapToNearest();
    onConfirm(noteToFreq(selLetter, selOctave, selAcc));
    if (typeof autoSave === 'function') autoSave();
    modal.remove();
    document.removeEventListener('click', outsideClick);
  });
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // 3-column grid
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-items:stretch;';

  const BTN = [
    'width:100%;padding:8px 4px;border-radius:8px;',
    'border:1px solid var(--border2);',
    'background:var(--bg3);color:var(--text);',
    'font-size:13px;font-weight:600;cursor:pointer;',
    'font-family:var(--font-body);',
    'transition:background .1s,border-color .1s,color .1s,opacity .1s;',
    'display:block;box-sizing:border-box;',
  ].join('');

  function noteExists(letter, octave, acc) {
    const freq = noteToFreq(letter, octave, acc);
    return freq >= 54 && freq <= 4200;
  }

  function styleBtn(btn, active, dimmed) {
    btn.style.background  = active ? 'var(--tap)' : 'var(--bg3)';
    btn.style.borderColor = active ? 'var(--tap)' : 'var(--border2)';
    btn.style.color       = active ? '#fff'        : 'var(--text)';
    btn.style.opacity     = (dimmed && !active) ? '0.3' : '1';
    btn.style.cursor      = (dimmed && !active) ? 'not-allowed' : 'pointer';
  }

  const colLBtns = [], colOBtns = [], colABtns = [];

  function refreshAllCols() {
    // Col1: all letters always selectable (root of cascade — never dimmed)
    colLBtns.forEach((btn, idx) => styleBtn(btn, LETTERS[idx] === selLetter, false));

    // Col2: valid octaves for the selected letter (any acc); cascade from col1
    const vO = validOctaves();
    colOBtns.forEach((btn, idx) => styleBtn(btn, OCTAVES[idx] === selOctave, !vO.has(OCTAVES[idx])));

    // Col3: valid accs for selected letter + octave; cascade from col2 only
    const vA = validAccs();
    colABtns.forEach((btn, idx) => styleBtn(btn, ACCS[idx].v === selAcc, !vA.has(ACCS[idx].v)));
  }

  function makeCol(items, getLabel, onSelect, btnArr) {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.style.cssText = BTN;
      btn.textContent   = getLabel(item);
      btnArr.push(btn);
      btn.addEventListener('click', () => {
        onSelect(item);
        snapToNearest();
        refreshAllCols();
        onConfirm(noteToFreq(selLetter, selOctave, selAcc));
        if (typeof autoSave === 'function') autoSave();
      });
      col.appendChild(btn);
    });
    return col;
  }

  const colL = makeCol(LETTERS, l=>l,        l=>{selLetter=l;}, colLBtns);
  const colO = makeCol(OCTAVES, o=>String(o), o=>{selOctave=o;}, colOBtns);
  const colA = makeCol(ACCS,    a=>a.label,   a=>{selAcc=a.v;},  colABtns);
  colA.style.height = '100%';
  colA.querySelectorAll('button').forEach(b => { b.style.flex='1'; b.style.minHeight='54px'; });

  refreshAllCols();

  grid.appendChild(colL);
  grid.appendChild(colO);
  grid.appendChild(colA);
  modal.appendChild(grid);
  document.body.appendChild(modal);

  function outsideClick(e) {
    if (!modal.contains(e.target) && e.target !== anchorEl) {
      snapToNearest();
      onConfirm(noteToFreq(selLetter, selOctave, selAcc));
      modal.remove();
      document.removeEventListener('click', outsideClick);
    }
  }
  setTimeout(() => document.addEventListener('click', outsideClick), 0);
}

// ── Creator state ─────────────────────────
let editIdx    = null;
let crGrid     = [];
let crTool     = 'tap';
let crAdvOpen  = false;
let crBgMode   = 'none';
let crLaneFreqs = [261.63,329.63,392.00,523.25];
let crBassSteps = [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
let _bassPickerFreq = 65.41;

function openCreator(idx) {
  editIdx = idx;
  const customs = store.load();
  if (idx !== null && customs[idx]) {
    const l = customs[idx];
    document.getElementById('cr-name').value = l.name || '';
    document.getElementById('cr-bpm').value  = l.bpm  || 120;
    document.getElementById('cr-diff').value = l.diff || 'medium';
    crGrid = l.grid.map(r => r.map(cell => {
      if (!cell) return null;
      if (typeof cell === 'string') return { type: cell, freq: null };
      return { ...cell };
    }));
    crBgMode    = l.bgMode    || 'none';
    crLaneFreqs = l.laneFreqs ? [...l.laneFreqs] : [261.63,329.63,392.00,523.25];
    crAdvOpen   = false;
    crBassSteps = l.bassSteps
      ? l.bassSteps.map(s => ({ ...s }))
      : [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
    while (crGrid.length < 8) crGrid.push([null,null,null,null]);
  } else {
    document.getElementById('cr-name').value = '';
    document.getElementById('cr-bpm').value  = 120;
    document.getElementById('cr-diff').value = 'medium';
    crGrid      = Array.from({ length:16 }, () => [null,null,null,null]);
    crBgMode    = 'none';
    crLaneFreqs = [261.63,329.63,392.00,523.25];
    crAdvOpen   = false;
    crBassSteps = [0,1,2,3,4,5,6,7].map(() => ({ active:false, freq:65.41 }));
  }
  setTool('tap');
  buildGrid();
  buildAdvPanel();
  document.getElementById('adv-panel').classList.remove('open');

  // Export button for existing levels
  const existingExpBtn = document.getElementById('cr-export-btn');
  if (existingExpBtn) existingExpBtn.remove();
  if (editIdx !== null) {
    const expBtn = document.createElement('button');
    expBtn.id = 'cr-export-btn';
    expBtn.style.cssText = 'font-size:11px;font-weight:700;padding:6px 11px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--muted);cursor:pointer;font-family:var(--font-body);';
    expBtn.textContent = '⬆ Export';
    expBtn.addEventListener('click', () => {
      const arr = store.load();
      if (arr[editIdx]) exportLevel(arr[editIdx]);
    });
    document.querySelector('.cr-header').insertBefore(expBtn, document.getElementById('cr-save'));
  }
  showScreen('creator');
}

function setTool(t) {
  crTool = t;
  ['tap','dtap','erase'].forEach(x => {
    const b = document.getElementById('t-' + x);
    b.className = 'tool-btn' + (x === t ? (t==='tap'?' at':t==='dtap'?' ad':' ae') : '');
  });
}
document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

// ── Advanced panel: opens sideways, and takes its space from a wider
//    window rather than from the grid ──
//
//  Asking for the space is the whole point: the chart you are editing
//  must not move or shrink because you opened a settings panel. If the
//  window has nowhere left to grow — already at the popup's width cap —
//  the panel floats over the grid instead, which is at least usable.
const ADV_PANEL_W = 300;
const ADV_PANEL_MIN = 170;   // a sliver of panel is worse than none

function openAdvPanel() {
  const room = Math.max(0, getMaxDims().maxW - currentSettings.width);
  const grow = Math.min(ADV_PANEL_W, room);
  if (grow >= ADV_PANEL_MIN) {
    advExpansion = grow;
    document.body.classList.remove('adv-overlay');
    document.documentElement.style.setProperty('--adv-w', grow + 'px');
  } else {
    // No room to widen: overlay, sized to leave the grid readable.
    advExpansion = 0;
    document.body.classList.add('adv-overlay');
    document.documentElement.style.setProperty('--adv-w',
      Math.max(ADV_PANEL_MIN, Math.min(ADV_PANEL_W, currentSettings.width - 120)) + 'px');
  }
  applySettingsToDOM();
}

function closeAdvPanel() {
  advExpansion = 0;
  document.body.classList.remove('adv-overlay');
  applySettingsToDOM();
}

document.getElementById('adv-toggle').addEventListener('click', () => {
  crAdvOpen = !crAdvOpen;
  if (crAdvOpen) openAdvPanel(); else closeAdvPanel();
  document.getElementById('adv-panel').classList.toggle('open', crAdvOpen);
  buildAdvPanel();
  buildGrid();
});

// ── Helpers ───────────────────────────────
function cellType(cell) {
  if (!cell) return null;
  return typeof cell === 'string' ? cell : cell.type;
}
function cellFreq(cell, lane) {
  if (!cell) return crLaneFreqs[lane];
  if (typeof cell === 'string') return crLaneFreqs[lane];
  return cell.freq || crLaneFreqs[lane];
}
function cellSustain(cell) {
  if (!cell || typeof cell === 'string') return 0;
  return cell.sustain || 0;
}

// ── Grid builder ──────────────────────────
// In advanced mode: filled cells show a note-name badge.
// Clicking that badge opens the note picker (no separate button).
// Clicking the type badge toggles tap ↔ dtap.
// ✕ erases the cell.
function buildGrid() {
  const adv = crAdvOpen;
  const g   = document.getElementById('cr-grid');
  g.innerHTML = '';

  // Header row
  const blank = document.createElement('div'); g.appendChild(blank);
  const headerKeys = currentSettings.keys.map(code => code.startsWith('Key') ? code.slice(3) : keyCodeLabel(code));
  headerKeys.forEach(k => {
    const h = document.createElement('div');
    h.style.cssText = 'text-align:center;font-size:10px;font-weight:700;color:var(--tap);padding:2px 0;font-family:var(--font-data)';
    h.textContent = k; g.appendChild(h);
  });

  crGrid.forEach((row, ri) => {
    const lbl = document.createElement('div');
    lbl.className = 'cr-row-num'; lbl.textContent = ri + 1; g.appendChild(lbl);

    row.forEach((cell, ci) => {
      const type = cellType(cell);

      // One chip per cell in every mode. Empty: the current tool fills
      // it. Filled: the tool erases (erase tool) or the second tap opens
      // the editor. That two-stage placement is why there are no inline
      // dropdowns any more — note, type and sustain all live in the
      // popup, so a cell stays a cell.
      const el = document.createElement('div');
      el.className = 'cr-cell' + (type ? ' is-' + type : '');
      if (type && crAdvOpen) {
        // In advanced mode the chip carries the note name, so a chart's
        // pitches are legible at a glance without opening anything.
        el.classList.add('cr-cell-named');
        const name = document.createElement('span');
        name.className = 'cr-cell-note';
        name.textContent = freqToName(cellFreq(cell, ci));
        el.appendChild(name);
        if (cellSustain(cell) > 0) {
          const dot = document.createElement('span');
          dot.className = 'cr-cell-sus';
          dot.title = 'sustain ' + cellSustain(cell).toFixed(1) + 's';
          el.appendChild(dot);
        }
      }
      el.addEventListener('click', () => {
        const cur = cellType(crGrid[ri][ci]);
        if (crTool === 'erase') { crGrid[ri][ci] = null; buildGrid(); return; }
        if (!cur) {
          // First tap: place a note at the lane's default pitch.
          crGrid[ri][ci] = { type: crTool === 'dtap' ? 'dtap' : 'tap',
                             freq: crLaneFreqs[ci], sustain: crDefaultSustain };
          buildGrid();
        } else {
          // Second tap on an existing note opens the editor.
          openCellEditor(el, ri, ci);
        }
      });
      g.appendChild(el);
    });
  });
}

// The whole note editor in one popup: type, pitch and sustain. This is
// what replaced the inline type badge, note dropdown and sustain
// dropdown that used to crowd every filled cell in advanced mode.
function openCellEditor(anchorEl, ri, ci) {
  document.querySelectorAll('.cr-cell-editor').forEach(e => e.remove());
  const cell = crGrid[ri][ci];
  if (!cell) return;

  const pop = document.createElement('div');
  pop.className = 'cr-cell-editor';

  const write = patch => {
    crGrid[ri][ci] = Object.assign({
      type: cellType(crGrid[ri][ci]) || 'tap',
      freq: cellFreq(crGrid[ri][ci], ci),
      sustain: cellSustain(crGrid[ri][ci]),
    }, patch);
    buildGrid();
    render();
  };

  function render() {
    const c = crGrid[ri][ci];
    if (!c) { pop.remove(); return; }
    pop.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'cce-head';
    head.textContent = 'Edit note';
    pop.appendChild(head);

    // Type
    const typeRow = document.createElement('div');
    typeRow.className = 'cce-row';
    [['tap', 'TAP'], ['dtap', '×2']].forEach(([t, label]) => {
      const btn = document.createElement('button');
      btn.className = 'cce-btn' + (cellType(c) === t ? ' on' : '') + (t === 'dtap' ? ' dtap' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => write({ type: t }));
      typeRow.appendChild(btn);
    });
    pop.appendChild(typeRow);

    // Pitch — the existing note picker, opened from a button.
    const pitchBtn = document.createElement('button');
    pitchBtn.className = 'cce-pitch';
    pitchBtn.textContent = '♪ ' + freqToName(cellFreq(c, ci));
    pitchBtn.addEventListener('click', () => {
      openNotePickerModal(pitchBtn, cellFreq(crGrid[ri][ci], ci), f => write({ freq: f }));
    });
    pop.appendChild(pitchBtn);

    // Sustain — chips, not a dropdown.
    const susLabel = document.createElement('div');
    susLabel.className = 'cce-sublabel';
    susLabel.textContent = 'Sustain';
    pop.appendChild(susLabel);
    const susRow = document.createElement('div');
    susRow.className = 'cce-sus';
    [[0, 'off'], [0.5, '.5'], [1, '1'], [1.5, '1.5'], [2, '2'], [2.5, '2.5'], [3, '3']].forEach(([v, label]) => {
      const btn = document.createElement('button');
      btn.className = 'cce-schip' + (Math.abs(cellSustain(c) - v) < 0.01 ? ' on' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => write({ sustain: v }));
      susRow.appendChild(btn);
    });
    pop.appendChild(susRow);

    // Erase / done
    const foot = document.createElement('div');
    foot.className = 'cce-row';
    const erase = document.createElement('button');
    erase.className = 'cce-btn erase';
    erase.textContent = '✕ Erase';
    erase.addEventListener('click', () => { crGrid[ri][ci] = null; buildGrid(); pop.remove(); });
    const done = document.createElement('button');
    done.className = 'cce-btn done';
    done.textContent = 'Done';
    done.addEventListener('click', () => pop.remove());
    foot.appendChild(erase); foot.appendChild(done);
    pop.appendChild(foot);
  }

  render();
  document.body.appendChild(pop);
  positionPopup(pop, anchorEl);

  // A tap anywhere else closes it, the same way the note picker does.
  setTimeout(() => {
    const close = ev => {
      if (pop.contains(ev.target)) return;
      if (ev.target.closest && ev.target.closest('#note-picker-modal')) return;
      pop.remove();
      document.removeEventListener('click', close, true);
    };
    document.addEventListener('click', close, true);
  }, 0);
}

// Places a popup next to its anchor, nudged back on-screen if it would
// spill off an edge.
function positionPopup(pop, anchorEl) {
  const a = anchorEl.getBoundingClientRect();
  pop.style.visibility = 'hidden';
  pop.style.left = '0px'; pop.style.top = '0px';
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = a.left, top = a.bottom + 4;
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  if (left + w > vw - 6) left = vw - w - 6;
  if (left < 6) left = 6;
  if (top + h > vh - 6) top = a.top - h - 4;
  if (top < 6) top = 6;
  pop.style.left = Math.round(left) + 'px';
  pop.style.top = Math.round(top) + 'px';
  pop.style.visibility = 'visible';
}

(function wireGenerate() {
  const btn = document.getElementById('gen-btn');
  if (btn) btn.addEventListener('click', () => {
    const band = (document.getElementById('gen-diff') || {}).value || '3-6';
    playGenerated(band);
  });
  const endless = document.getElementById('endless-card');
  if (endless) endless.addEventListener('click', () => {
    const band = (document.getElementById('endless-diff') || {}).value || '4-7';
    const lvl = generateLevel(band);
    if (!lvl) return;
    lvl.endless = true; lvl._band = band;
    lastGenerated = lvl;
    launchLevel(lvl);
  });
})();

document.getElementById('cr-add-rows').addEventListener('click', () => {
  for (let i = 0; i < 4; i++) crGrid.push([null,null,null,null]);
  buildGrid();
});

document.getElementById('cr-back').addEventListener('click', () => {
  showScreen('home'); renderHome();
});

document.getElementById('cr-save').addEventListener('click', () => {
  const name        = document.getElementById('cr-name').value.trim() || 'untitled';
  const bpm         = parseInt(document.getElementById('cr-bpm').value) || 120;
  const diff        = document.getElementById('cr-diff').value;
  const bassPattern = crBassSteps.map(s => s.active ? s.freq : 0);
  const lvl = {
    id: 'c' + Date.now(), name, bpm, diff,
    grid:        crGrid.map(r => r.map(cell => cell ? { ...cell } : null)),
    bgMode:      crBgMode,
    laneFreqs:   [...crLaneFreqs],
    bassSteps:   crBassSteps.map(s => ({ ...s })),
    bassPattern
  };
  const arr = store.load();
  if (editIdx !== null && arr[editIdx]) arr[editIdx] = lvl; else arr.push(lvl);
  store.save(arr);
  document.querySelectorAll('.hnav').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
  document.querySelector('.hnav[data-tab="custom"]').classList.add('active');
  document.getElementById('tab-custom').classList.add('active');
  showScreen('home'); renderHome();
});

// ── Auto-save on note change ──────────────
function autoSave() {
  if (editIdx === null) return;
  const name        = document.getElementById('cr-name').value.trim() || 'untitled';
  const bpm         = parseInt(document.getElementById('cr-bpm').value) || 120;
  const diff        = document.getElementById('cr-diff').value;
  const bassPattern = crBassSteps.map(s => s.active ? s.freq : 0);
  const lvl = {
    id: 'c' + Date.now(), name, bpm, diff,
    grid:        crGrid.map(r => r.map(cell => cell ? { ...cell } : null)),
    bgMode:      crBgMode,
    laneFreqs:   [...crLaneFreqs],
    bassSteps:   crBassSteps.map(s => ({ ...s })),
    bassPattern
  };
  const arr = store.load();
  if (arr[editIdx]) arr[editIdx] = lvl;
  store.save(arr);
}

// ── Advanced panel ────────────────────────
let crDefaultSustain = 0; // sustain applied to newly placed cells

function buildAdvPanel() {
  buildLaneNoteGrid();
  buildBgRadio();
  buildBassEditor();
  buildAdvInstrumentRow();
  buildAdvSustainControl();
}

// Instrument picker inside advanced panel
function buildAdvInstrumentRow() {
  const row = document.getElementById('adv-instrument-row');
  if (!row) return;
  row.innerHTML = '';
  const instruments = window.RD_INSTRUMENTS || [
    { id:'synth', label:'Synth', icon:'🎛️' },
    { id:'piano', label:'Piano', icon:'🎹' },
    { id:'guitar', label:'Guitar', icon:'🎸' },
    { id:'marimba', label:'Marimba', icon:'🪘' },
    { id:'bell', label:'Bell', icon:'🔔' },
  ];
  const cur = (window.RD_getInstrument && window.RD_getInstrument()) || 'synth';
  instruments.forEach(inst => {
    const btn = document.createElement('button');
    const active = cur === inst.id;
    btn.style.cssText = [
      'padding:5px 8px;border-radius:7px;font-size:10px;font-weight:700;',
      'font-family:var(--font-body);cursor:pointer;',
      'display:flex;flex-direction:column;align-items:center;gap:1px;',
      'border:2px solid;transition:all .12s;',
      active
        ? 'border-color:var(--accent);background:rgba(255,58,110,.12);color:var(--accent);'
        : 'border-color:var(--border2);background:var(--bg3);color:var(--muted);',
    ].join('');
    btn.innerHTML = `<span style="font-size:14px">${inst.icon}</span><span>${inst.label}</span>`;
    btn.addEventListener('click', () => {
      if (window.RD_saveInstrument) window.RD_saveInstrument(inst.id);
      currentSettings.instrument = inst.id;
      store.saveSettings(currentSettings);
      buildAdvInstrumentRow();
      // Preview note
      if (window.RD_playNoteFreq) window.RD_playNoteFreq(261.63, false, 0);
    });
    row.appendChild(btn);
  });
}

// Sustain default control in advanced panel
function buildAdvSustainControl() {
  const slider = document.getElementById('adv-sustain-slider');
  const label  = document.getElementById('adv-sustain-label');
  if (!slider || !label) return;

  slider.value = crDefaultSustain;
  label.textContent = crDefaultSustain === 0 ? 'off' : crDefaultSustain.toFixed(1) + 's';

  slider.oninput = () => {
    crDefaultSustain = parseFloat(slider.value);
    label.textContent = crDefaultSustain === 0 ? 'off' : crDefaultSustain.toFixed(1) + 's';
    label.style.color = crDefaultSustain > 0 ? 'var(--perfect)' : 'var(--muted)';
  };
}

// Lane default note pickers (in Advanced panel sidebar)
// These also use the note-badge-click pattern, no preview
function buildLaneNoteGrid() {
  const g = document.getElementById('lane-note-grid');
  g.innerHTML = '';
  const keys = currentSettings.keys.map(code => code.startsWith('Key') ? code.slice(3) : keyCodeLabel(code));
  keys.forEach((k, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:20px 1fr;gap:4px;align-items:center;margin-bottom:4px;';

    const lbl = document.createElement('div');
    lbl.className = 'lnote-label';
    lbl.textContent = k;

    // Note badge — click to open picker, no preview
    const freq     = crLaneFreqs[i];
    const noteName = freqToName(freq);
    const badge    = document.createElement('div');
    badge.style.cssText = [
      'padding:4px 6px;border-radius:6px;border:1px solid var(--border2);',
      'background:var(--bg3);color:var(--text);font-size:10px;font-weight:700;',
      'font-family:var(--font-data);cursor:pointer;text-align:center;',
      'transition:border-color .1s,color .1s;',
    ].join('');
    badge.textContent = noteName;
    badge.title = 'Click to change default note for lane ' + k;
    badge.addEventListener('mouseenter', () => {
      badge.style.borderColor = 'var(--tap)';
      badge.style.color       = 'var(--tap)';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.borderColor = 'var(--border2)';
      badge.style.color       = 'var(--text)';
    });
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      openNotePickerModal(badge, crLaneFreqs[i], (newFreq) => {
        crLaneFreqs[i] = newFreq;
        buildLaneNoteGrid(); // refresh labels
        buildGrid();          // update cells that inherit this freq
      });
    });

    row.appendChild(lbl);
    row.appendChild(badge);
    g.appendChild(row);
  });
}

function buildBgRadio() {
  document.querySelectorAll('.bg-radio-btn').forEach(b => {
    b.classList.toggle('sel', b.dataset.bg === crBgMode);
    b.onclick = () => {
      crBgMode = b.dataset.bg;
      document.querySelectorAll('.bg-radio-btn').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      const bassEl = document.getElementById('bass-editor');
      bassEl.classList.toggle('open', crBgMode === 'bass');
      if (crBgMode === 'bass') buildBassNotePicker();
    };
  });
  const bassEl = document.getElementById('bass-editor');
  bassEl.classList.toggle('open', crBgMode === 'bass');
  if (crBgMode === 'bass') buildBassNotePicker();
}

// Bass note picker — no preview on selection
function buildBassNotePicker() {
  const wrap = document.getElementById('bass-note-sel-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  const noteName = freqToName(_bassPickerFreq);
  const badge    = document.createElement('div');
  badge.style.cssText = [
    'display:inline-block;padding:4px 10px;border-radius:6px;border:1px solid var(--border2);',
    'background:var(--bg3);color:var(--text);font-size:11px;font-weight:700;',
    'font-family:var(--font-data);cursor:pointer;',
    'transition:border-color .1s,color .1s;',
  ].join('');
  badge.textContent = noteName + ' ▾';
  badge.title = 'Click to choose bass note';
  badge.addEventListener('mouseenter', () => {
    badge.style.borderColor = 'var(--tap)'; badge.style.color = 'var(--tap)';
  });
  badge.addEventListener('mouseleave', () => {
    badge.style.borderColor = 'var(--border2)'; badge.style.color = 'var(--text)';
  });
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    openNotePickerModal(badge, _bassPickerFreq, (newFreq) => {
      _bassPickerFreq = newFreq;
      buildBassNotePicker();
    });
  });
  wrap.appendChild(badge);
}

function buildBassEditor() {
  buildBassNotePicker();
  const g = document.getElementById('bass-step-grid');
  g.innerHTML = '';
  crBassSteps.forEach((step, i) => {
    const el = document.createElement('div');
    el.className = 'bass-step' + (step.active ? ' active' : '');
    const name   = freqToName(step.freq);
    const noteLbl = step.active ? name : '—';
    el.innerHTML = `<span>${i+1}</span><span class="bass-step-note">${noteLbl}</span>`;
    el.addEventListener('click', () => {
      const selFreq = _bassPickerFreq;
      if (!step.active)                    { step.active = true;  step.freq = selFreq; }
      else if (Math.abs(step.freq - selFreq) < 1) { step.active = false; }
      else                                 { step.freq = selFreq; }
      buildBassEditor();
    });
    g.appendChild(el);
  });
}

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

// ── Settings ──────────────────────────────────────
// 'modern' is the updated look; 'classic' is the original, kept as a
// real choice rather than a fallback. The graphics layer is additive,
// so 'classic' is simply the class being absent.
const GFX_STYLES = [
  ['modern',  'Modern',  'Lit edges, depth on the board, glow on the strike line'],
  ['classic', 'Classic', 'The original flat look, exactly as it was'],
];

const DEFAULT_SETTINGS = {
  keys: ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  gfx: 'modern',
  songVoices: true,   // play each song in the instruments it was written for
  hitWindow: 'normal', // strict | normal | forgiving
  width: 420,
  height: 640,
  lives: 3,
  instrument: 'synth',
  uiScale: 1,
  masterVol: 1,
  musicVol: 1,
};

let currentSettings = Object.assign({}, DEFAULT_SETTINGS);

function loadAndApplySettings() {
  const saved = store.loadSettings();
  if (saved) {
    if (saved.keys && saved.keys.length === 4) currentSettings.keys = saved.keys;
    if (saved.width)      currentSettings.width      = saved.width;
    if (saved.height)     currentSettings.height     = saved.height;
    if (saved.lives)      currentSettings.lives      = saved.lives;
    if (saved.instrument) currentSettings.instrument = saved.instrument;
    if (saved.gfx)            currentSettings.gfx        = saved.gfx;
    if (typeof saved.songVoices === 'boolean') currentSettings.songVoices = saved.songVoices;
    if (saved.hitWindow)      currentSettings.hitWindow  = saved.hitWindow;
    if (saved.uiScale)        currentSettings.uiScale   = saved.uiScale;
    if (saved.masterVol != null) currentSettings.masterVol = saved.masterVol;
    if (saved.musicVol  != null) currentSettings.musicVol  = saved.musicVol;
  }
  applySettingsToDOM();
  // Apply saved instrument + volumes to audio engine
  if (window.RD_saveInstrument)  window.RD_saveInstrument(currentSettings.instrument || 'synth');
  if (window.RD_setVolume)       window.RD_setVolume(currentSettings.masterVol);
  if (window.RD_setMusicVolume)  window.RD_setMusicVolume(currentSettings.musicVol);
}

// Live-sync the Display size controls to a given size (used by manual drag-resize)
function updateSizeControls(w, h) {
  if (_pendingSize) { _pendingSize.width = w; _pendingSize.height = h; }
  const ws = document.getElementById('size-w-slider'), wi = document.getElementById('size-w-input');
  if (ws) ws.value = w;  if (wi) wi.value = w;
}

// Watch for manual corner-drag resizes (CSS resize:both on <html>) and persist
// them to the same width/height settings, keeping the sliders in sync.
let _resizeSaveTimer = null;
function observeManualResize() {
  if (!window.ResizeObserver) return;
  const ro = new ResizeObserver(() => {
    // Subtract whatever the advanced panel borrowed, or opening it once
    // would be remembered as the player's chosen width forever.
    const w = Math.round(document.documentElement.offsetWidth) - advExpansion;
    if (w === currentSettings.width) return;
    currentSettings.width = w;
    updateSizeControls(w, currentSettings.height);
    clearTimeout(_resizeSaveTimer);
    _resizeSaveTimer = setTimeout(() => store.saveSettings(currentSettings), 200);
  });
  ro.observe(document.documentElement);

  // If the host page itself changes size, re-apply the caps.
  window.addEventListener('resize', () => applySettingsToDOM());
}

function applySettingsToDOM() {
  // Cap the window so it can never exceed the host page / popup viewport.
  const { maxW, maxH } = getMaxDims();
  currentSettings.width  = Math.max(340, Math.min(currentSettings.width, maxW));
  // The height is not a setting any more: it is whatever the host will
  // actually render, so nothing can ask for a size that gets clipped.
  currentSettings.height = Math.min(FIXED_H, maxH);
  const root = document.documentElement;
  root.style.maxWidth  = maxW + 'px';
  root.style.maxHeight = maxH + 'px';
  root.style.width  = appliedWidth() + 'px';
  root.style.height = currentSettings.height + 'px';
  // Graphics style. Additive: the class going on is the whole change,
  // so taking it off restores the original look exactly.
  document.body.classList.toggle('gfx-modern', currentSettings.gfx !== 'classic');
  // UI scale — zoom the whole interface without changing the window box
  document.body.style.zoom = currentSettings.uiScale || 1;
  // Update lane key labels in game
  const keyLabels = ['A','S','D','F'];
  currentSettings.keys.forEach((code, i) => {
    const label = code.startsWith('Key') ? code.slice(3) : code;
    const el = document.querySelector(`#btn${i} .lane-key`);
    if (el) el.textContent = label;
    keyLabels[i] = label;
  });
  // Update overlay key display
  const ovKeys = document.querySelectorAll('.ov-key');
  currentSettings.keys.forEach((code, i) => {
    const label = code.startsWith('Key') ? code.slice(3) : code;
    if (ovKeys[i]) ovKeys[i].textContent = label;
  });
  // Update column headers in creator grid
  const crHeaders = document.querySelectorAll('#cr-grid > div:not(.cr-row-num)');
  // Will be rebuilt by buildGrid() so no need here
}

function buildKeyMap() {
  const map = {};
  currentSettings.keys.forEach((code, i) => { map[code] = i; });
  return map;
}

// ── Input ─────────────────────────────────────────
// Keys: in-game → tapLane; outside game → play the lane's current note

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  const KEY_MAP = buildKeyMap();

  // Chaos mode: any letter key A–Z (except reserved Q/R) is a potential target.
  if (running && chaosMode && /^Key[A-Z]$/.test(e.code) && e.code !== 'KeyQ' && e.code !== 'KeyR') {
    e.preventDefault();
    tapChaos(e.code);
    return;
  }

  if (e.code in KEY_MAP) {
    e.preventDefault();
    const lane = KEY_MAP[e.code];
    if (running) {
      // In-game: normal tap mechanic
      tapLane(lane);
    } else {
      // Outside game: play the lane note (home / creator)
      if (window.RD_playNote) {
        const freq = crLaneFreqs[lane] || [261.63,329.63,392.00,523.25][lane];
        window.RD_playNote(lane, false, freq);
        // Brief visual flash on lane buttons in game screen (if visible) is skipped
        // since we're not on the game screen; no side effect needed
      }
    }
    return;
  }

  if (e.code === 'KeyR' && running) startGame();
  if (e.code === 'KeyQ') quitToMenu();
});

btnEls.forEach((el, i) => {
  el.addEventListener('click',      ()  => tapLane(i));
  el.addEventListener('touchstart', ev => { ev.preventDefault(); tapLane(i); });
});

// Avatar click → open shop tab
const pbarAvatar = document.getElementById('pbar-avatar');
if (pbarAvatar) {
  pbarAvatar.addEventListener('click', () => {
    document.querySelectorAll('.hnav').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
    const shopNav = document.querySelector('.hnav[data-tab="shop"]');
    if (shopNav) shopNav.classList.add('active');
    const shopTab = document.getElementById('tab-shop');
    if (shopTab) shopTab.classList.add('active');
    renderShop();
  });
}

document.getElementById('g-menu-btn').addEventListener('click', quitToMenu);

// ── Boot ──────────────────────────────────────────
loadAndApplySettings();
observeManualResize();
applyTheme(store.loadTheme());
const ct = store.loadCustomTheme();
if (ct && store.loadTheme() === 'custom') applyCustomTheme(ct);

// Username setup
const unameInput   = document.getElementById('uname-input');
const unameConfirm = document.getElementById('uname-confirm');
if (unameConfirm) {
  unameConfirm.addEventListener('click', () => {
    const name = (unameInput ? unameInput.value.trim() : '') || 'Player';
    profile.username = name;
    saveProfile();
    showScreen('home');
    renderHome();
  });
  if (unameInput) {
    unameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') unameConfirm.click();
    });
  }
}

if (!profile.username) {
  showScreen('username-screen');
} else {
  showScreen('home');
  renderHome();
}
