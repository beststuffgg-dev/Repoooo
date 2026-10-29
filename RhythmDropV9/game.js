let advExpansion = 0;
let laneExpansion = 0;

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
  loadProfile:      ()  => { try { return JSON.parse(localStorage.getItem('rd_profile')||'null'); } catch { return null; } },
  saveProfile:      p   => localStorage.setItem('rd_profile', JSON.stringify(p)),
  loadScores:       ()  => { try { return JSON.parse(localStorage.getItem('rd_scores')||'[]'); } catch { return []; } },
  saveScores:       a   => localStorage.setItem('rd_scores', JSON.stringify(a)),
  loadBests:        ()  => { try { return JSON.parse(localStorage.getItem('rd_bests')||'{}'); } catch { return {}; } },
  saveBests:        b   => localStorage.setItem('rd_bests', JSON.stringify(b)),
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
  loadCustomAv:     ()  => localStorage.getItem('rd_custom_av')||null,
  saveCustomAv:     d   => localStorage.setItem('rd_custom_av', d),
  loadProgress:     ()  => {
    try {
      const p = JSON.parse(localStorage.getItem('rd_progress')||'{}');
      return { xp: p.xp || 0, cleared: p.cleared || {} };
    } catch { return { xp: 0, cleared: {} }; }
  },
  saveProgress:     p   => localStorage.setItem('rd_progress', JSON.stringify(p)),
  loadDaily:        ()  => { try { return JSON.parse(localStorage.getItem('rd_daily')||'null'); } catch { return null; } },
  saveDaily:        d   => localStorage.setItem('rd_daily', JSON.stringify(d)),
};

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
  { id:'av_unicorn', name:'Unicorn',  emoji:'🦄', price:5000 },
  { id:'av_dragon',  name:'Dragon',   emoji:'🐉', price:12000 },
  { id:'av_galaxy',  name:'Galaxy',   emoji:'🌌', price:25000 },
  { id:'av_alien',   name:'Cosmic',   emoji:'👽', price:50000 },
  { id:'av_phoenix', name:'Phoenix',  emoji:'🔥🦅', price:100000 },
  { id:'av_goat',    name:'G.O.A.T.', emoji:'🐐', price:250000 },
  { id:'av_deity',   name:'Deity',    emoji:'⚡👑', price:1000000 },
  { id:'av_blackhole', name:'Black Hole', emoji:'🕳️',  price:2000000 },
  { id:'av_infinity',  name:'Infinity',   emoji:'♾️',  price:5000000 },
  { id:'av_diadem',    name:'Diadem',     emoji:'👑💎', price:10000000 },
  { id:'av_universe',  name:'Universe',   emoji:'🌠',  price:25000000 },
  { id:'av_ascended',  name:'Ascended',   emoji:'😇⚡', price:100000000 },
];

const SPECIAL_TRAILS = {
  rainbow: { grad:'linear-gradient(0deg,#ff3a6e,#f59e0b,#22c55e,#3b82f6,#a855f7)', palette:['#ff3a6e','#f59e0b','#22c55e','#3b82f6','#a855f7'] },
  aurora:  { grad:'linear-gradient(0deg,#34d399,#22d3ee,#a78bfa)',                 palette:['#34d399','#22d3ee','#a78bfa'] },
  prism:   { grad:'linear-gradient(0deg,#f472b6,#818cf8,#22d3ee,#a3e635)',         palette:['#f472b6','#818cf8','#22d3ee','#a3e635'] },
};
function trailGradient(color)       { return SPECIAL_TRAILS[color] ? SPECIAL_TRAILS[color].grad : 'linear-gradient(0deg,' + color + ',transparent)'; }
function trailParticleColor(color)  { const s = SPECIAL_TRAILS[color]; return s ? s.palette[Math.floor(Math.random() * s.palette.length)] : color; }

const SHOP_TRAILS = [
  { id:'tr_green',   name:'Green Flame',   color:'#22c55e', price:300 },
  { id:'tr_blue',    name:'Blue Flame',    color:'#3b82f6', price:500 },
  { id:'tr_cyan',    name:'Cyan Flame',    color:'#06b6d4', price:900 },
  { id:'tr_purple',  name:'Purple Flame',  color:'#a855f7', price:2000 },
  { id:'tr_red',     name:'Crimson Flame', color:'#ef4444', price:4000 },
  { id:'tr_gold',    name:'Gold Flame',    color:'#f59e0b', price:12000 },
  { id:'tr_rainbow', name:'Rainbow Flame', color:'rainbow', price:50000 },
  { id:'tr_plasma',  name:'Plasma Flame',  color:'#e879f9', price:120000 },
  { id:'tr_ember',   name:'Ember Storm',   color:'#fb7185', price:350000 },
  { id:'tr_aurora',  name:'Aurora',        color:'aurora',  price:900000 },
  { id:'tr_prism',   name:'Prismatic',     color:'prism',   price:3000000 },
  { id:'tr_cosmic',  name:'Cosmic Glow',   color:'#c4b5fd', price:15000000 },
];
function trailById(id) { return SHOP_TRAILS.find(t => t.id === id) || null; }

const MYSTERY_BOXES = [
  { id:'box_basic',  name:'Basic Box',  emoji:'📦', price:1000,     minPrice:0,        maxPrice:1000 },
  { id:'box_rare',   name:'Rare Box',   emoji:'🎁', price:6000,     minPrice:600,      maxPrice:5000 },
  { id:'box_epic',   name:'Epic Box',   emoji:'🪩', price:30000,    minPrice:2000,     maxPrice:50000 },
  { id:'box_legend', name:'Legend Box', emoji:'🌟', price:150000,   minPrice:12000,    maxPrice:1000000 },
  { id:'box_divine', name:'Divine Box', emoji:'🔮', price:1500000,  minPrice:1000000,  maxPrice:25000000 },
  { id:'box_cosmic', name:'Cosmic Box', emoji:'💫', price:20000000, minPrice:5000000,  maxPrice:100000000 },
];

function rarityForPrice(p) {
  if (p >= 10000000) return { name:'Celestial',  color:'#fde047' };
  if (p >= 1000000)  return { name:'Divine',     color:'#f0abfc' };
  if (p >= 50000)    return { name:'Mythic',     color:'#ff3a6e' };
  if (p >= 10000)    return { name:'Legendary',  color:'#f59e0b' };
  if (p >= 2000)     return { name:'Epic',       color:'#a855f7' };
  if (p >= 600)      return { name:'Rare',       color:'#3b82f6' };
  return               { name:'Common',     color:'#9ca3af' };
}

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

function addHighScore(name, score, levelName, opts) {
  opts = opts || {};
  const coins = opts.logOnly ? 0 : Math.floor(score / 1000);
  const scores = store.loadScores();
  scores.push({ name, score, level: levelName, coins, date: Date.now() });
  scores.sort((a,b) => b.score - a.score);
  store.saveScores(scores.slice(0, 50));

  if (!opts.logOnly) {
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

function exportLevel(lvl) {
  const text = (window.RD_Codec && window.RD_Codec.encodeLevel)
    ? window.RD_Codec.encodeLevel(lvl)
    : 'RHYTHMDROP:' + btoa(unescape(encodeURIComponent(JSON.stringify(lvl))));
  navigator.clipboard.writeText(text)
    .then(() => showToast('✓ Copied — ' + text.length + ' chars'))
    .catch(() => prompt('Copy this level code:', text));
}

function tryCheatCode(text) {
  switch (text.trim().toLowerCase()) {
    case 'lemussia':
      addCoins(10000000);
      showToast('💰 +10,000,000 coins!');
      return true;
    case 'lemussia2':
      addCoins(-Math.min(1000000, profile.coins));
      showToast('💸 -1,000,000 coins!', true);
      return true;
    default:
      return false;
  }
}

function sanitizeImportedGrid(lvl) {
  if (!Array.isArray(lvl.grid) || !lvl.grid.length) throw new Error('empty grid');
  const n = window.RD_Lanes.laneCountOf(lvl);
  lvl.lanes = n;
  lvl.grid = lvl.grid.map(row => {
    const out = new Array(n).fill(null);
    if (Array.isArray(row)) {
      for (let c = 0; c < n; c++) {
        const cell = row[c];
        if (!cell) continue;
        const type = typeof cell === 'string' ? cell : cell.type;
        if (type !== 'tap' && type !== 'dtap') continue;
        out[c] = typeof cell === 'string' ? { type, freq: null } : cell;
      }
    }
    return out;
  });
  if (Array.isArray(lvl.laneFreqs) && lvl.laneFreqs.length !== n) {
    const defs = window.RD_Lanes.defaultFreqs(n);
    lvl.laneFreqs = defs.map((f, i) => lvl.laneFreqs[i] || f);
  }
}

function importLevel() {
  const text = prompt('Paste your export code:');
  if (!text) { showToast('Invalid code', true); return; }
  if (tryCheatCode(text)) return;
  const trimmed = text.trim();
  const looksLikeCode = /^(RD2:|RHYTHMDROP:)/.test(trimmed) || (window.RD_Codec && /^[A-Za-z0-9_-]+$/.test(trimmed));
  if (!looksLikeCode) { showToast('Invalid code', true); return; }
  try {
    let lvl;
    if (window.RD_Codec && window.RD_Codec.decodeLevel) {
      lvl = window.RD_Codec.decodeLevel(trimmed);
    } else {
      const encoded = trimmed.replace(/^RHYTHMDROP:/, '');
      lvl = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    }
    if (!lvl || !lvl.name || !lvl.bpm || !lvl.grid) throw new Error('missing fields');
    translateLevelVoices(lvl);
    sanitizeImportedGrid(lvl);
    lvl.id = 'c' + Date.now();
    const arr = store.load(); arr.push(lvl); store.save(arr);
    renderCustoms();
    selectHomeTab('custom');
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

function syncLaneExpansion(id) {
  if (laneExpansion === 0) return;
  laneExpansion = 0;
  applySettingsToDOM();
}

const showScreen = id => {
  syncLaneExpansion(id);
  if (id !== 'creator' && advExpansion) {
    crAdvOpen = false;
    const ap = document.getElementById('adv-panel');
    if (ap) ap.classList.remove('open');
    closeAdvPanel();
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
};

const THEMES = [
  { id:'graphite',   name:'Graphite',   subs:'Instrument panel', dots:['#6FA8B5','#C4854E','#121517'] },
  { id:'walnut',     name:'Walnut',     subs:'Oiled wood',       dots:['#6FB3A0','#E0894A','#2A1B0E'], mat:true },
  { id:'bone',       name:'Bone',       subs:'Matte paper',      dots:['#1E7A8C','#C2325C','#EDE8DE'], mat:true },
  { id:'amber',      name:'Amber',      subs:'Brushed brass',    dots:['#E8B355','#D9762E','#1F1508'], mat:true },
  { id:'vapor',      name:'Vapor',      subs:'Frosted glass',    dots:['#57E0E8','#F065C8','#1D1136'], mat:true },
  { id:'blueprint',  name:'Blueprint',  subs:'Drafting linen',   dots:['#5BC8FF','#FF9E5B','#0B2440'], mat:true },
  { id:'mono',       name:'Mono',       subs:'Matte rubber',     dots:['#FFFFFF','#FF4757','#141414'], mat:true },
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

  { id:'harvest',  name:'Harvest',    subs:'Straw & poppy',     area:1,  dots:['#E5C46A','#DC6351','#172218'], card:{ bg:'#172218', text:'#EEE8CF' } },
  { id:'lapis',    name:'Lapis',      subs:'Lapis & sandstone', area:2,  dots:['#4F86E0','#D9AE3E','#1D1810'], card:{ bg:'#1D1810', text:'#F3E6C6' } },
  { id:'marble',   name:'Marble',     subs:'Aegean light',      area:3,  dots:['#1F5FAE','#925719','#EFF2F5'], card:{ bg:'#EFF2F5', text:'#1A2330' } },
  { id:'imperium', name:'Imperium',   subs:'Crimson & laurel',  area:4,  dots:['#D65C6C','#D9B04C','#22151A'], card:{ bg:'#22151A', text:'#F4E6DD' } },
  { id:'obsidian', name:'Obsidian',   subs:'Volcanic glass',    area:5,  dots:['#2CC7B4','#F07A38','#10151A'], card:{ bg:'#10151A', text:'#E4F1F0' } },
  { id:'jade',     name:'Jade',       subs:'Carved stone',      area:6,  dots:['#3FD98E','#E3C158','#0B1F18'], card:{ bg:'#0B1F18', text:'#DDF7EA' } },
  { id:'oakmoss',  name:'Oakmoss',    subs:'Pipes & moss',      area:7,  dots:['#9CC25E','#CF6A57','#1D2014'], card:{ bg:'#1D2014', text:'#ECE6CC' } },
  { id:'braid',    name:'Gold Braid', subs:'Navy & scarlet',    area:8,  dots:['#DDB647','#DF5B54','#111A38'], card:{ bg:'#111A38', text:'#E8ECFA' } },
  { id:'concrete', name:'Concrete',   subs:'Poured & glass',    area:9,  dots:['#085F70','#9A3814','#DEE1E4'], card:{ bg:'#DEE1E4', text:'#151A1F' } },
  { id:'chrome',   name:'Chrome',     subs:'Neon grid',         area:10, dots:['#3FE0FF','#FF5CA8','#15103A'], card:{ bg:'#15103A', text:'#EFEAFF' } },
];

const themeById = id => THEMES.find(t => t.id === id) || null;

const isThemeLocked = th => !!(th && th.area && !CAM().areaCleared(progress, th.area));

const CUSTOM_VARS = ['--bg','--bg2','--bg3','--bg4','--text','--tap','--tap2','--dtap','--dtap2','--accent','--muted','--dim','--border','--border2','--glow-tap','--glow-dtap'];
function clearCustomThemeVars() {
  const r = document.documentElement.style;
  CUSTOM_VARS.forEach(v => r.removeProperty(v));
}

function applyTheme(id) {
  clearCustomThemeVars();
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
  const cf = document.getElementById('custom-theme-form');
  const gf = document.getElementById('glass-trans-form');
  if (cf) cf.classList.toggle('show', id === 'custom');
  if (gf) gf.classList.toggle('show', id === 'glass');
}

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
  const txt = { void:'#fff', neon:'#00ffff', forest:'#c8ffdd', sunset:'#ffe8c8',
    dune:'#f0d9a8', lotr:'#e8e0c0', foundation:'#bfe9f5', nintendo:'#ffffff', glass:'#eaf2ff',
    paper:'#1a1510', arctic:'#0a1828' };

  const earned = THEMES.filter(t => t.area && !isThemeLocked(t)).length;
  const total  = THEMES.filter(t => t.area).length;
  let headed = false;

  THEMES.forEach(th => {
    if (th.area && !headed) {
      headed = true;
      const h = document.createElement('div');
      h.className = 'themes-section';
      h.innerHTML = '<span>Campaign themes</span><b>' + earned + '/' + total + ' earned</b>';
      g.appendChild(h);
    }
    const locked = isThemeLocked(th);
    const area = th.area ? CAM().areaById(th.area) : null;
    const c = document.createElement('div');
    c.className = 'theme-card' + (th.id === cur ? ' selected' : '') + (locked ? ' locked' : '');
    c.dataset.theme = th.id;
    c.innerHTML = `
      <div class="tc-name">${th.name}</div>
      <div class="tc-subs">${th.subs}</div>
      <div class="tc-dots">
        <div class="tc-dot" style="background:${th.dots[0]}"></div>
        <div class="tc-dot" style="background:${th.dots[1]}"></div>
        <div class="tc-dot" style="background:${th.dots[2]}"></div>
      </div>`
      + (locked ? '<div class="tc-lock">🔒 Clear ' + area.name + '</div>' : '');
    if (th.card) c.style.background = th.card.bg;
    c.style.color = th.card ? th.card.text : (txt[th.id] || '#e8e8ff');
    c.addEventListener('click', () => {
      if (locked) { showToast('Clear every song in ' + area.name + ' to unlock ' + th.name, true); return; }
      applyTheme(th.id);
    });
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

document.querySelectorAll('.glass-trans-btn').forEach(b => {
  b.addEventListener('click', () => {
    applyTheme('glass');
    applyGlassTrans(parseFloat(b.dataset.alpha));
  });
});

const CAM = () => window.RD_Campaign;

let progress = store.loadProgress();
function saveProgress() { store.saveProgress(progress); }

let camArea = 1;
function furthestArea() {
  const C = CAM(); if (!C) return 1;
  let a = 1;
  for (const area of C.AREAS) if (C.isAreaUnlocked(progress, area.id)) a = area.id;
  return a;
}

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

const emblemSvg = key =>
  '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#emblem-' + key + '"/></svg>';

function renderCampaign() {
  const C = CAM();
  const strip = document.getElementById('cam-areas');
  const list  = document.getElementById('cam-list');
  if (!C || !strip || !list) return;
  if (camArea !== 'endless' && !C.isAreaUnlocked(progress, camArea)) camArea = furthestArea();

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
    chip.innerHTML = '<span class="ac-emblem">' + emblemSvg(area.key) + '</span>'
      + '<div class="ac-text"><div class="ac-name">' + (unlocked ? area.name : '🔒 ' + area.name) + '</div>'
      + '<div class="ac-prog">' + done + '/' + C.LEVELS_PER_AREA + '</div></div>';
    if (unlocked) chip.addEventListener('click', () => { camArea = area.id; renderCampaign(); });
    strip.appendChild(chip);
  });

  const endlessReady = C.AREAS.every(a => C.areaCleared(progress, a.id));
  const echip = document.createElement('div');
  echip.className = 'area-chip endless-chip'
    + (camArea === 'endless' ? ' sel' : '')
    + (!endlessReady ? ' locked' : '');
  echip.innerHTML = '<div class="ac-text"><div class="ac-name">' + (endlessReady ? '♾️ Endless' : '🔒 Endless') + '</div>'
    + '<div class="ac-prog">' + (endlessReady ? 'no end' : 'clear all') + '</div></div>';
  if (endlessReady) echip.addEventListener('click', () => { camArea = 'endless'; renderCampaign(); });
  strip.appendChild(echip);

  const selChip = strip.querySelector('.area-chip.sel');
  if (selChip && selChip.scrollIntoView) {
    try { selChip.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (e) {}
  }

  if (camArea === 'endless') { renderEndlessPane(list, endlessReady); return; }

  const area = C.areaById(camArea);
  list.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'cam-head';
  head.innerHTML = '<span class="ch-emblem">' + emblemSvg(area.key) + '</span>'
    + '<span class="ch-name">' + area.name + '</span>'
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

  const songs = document.createElement('div');
  songs.className = 'cam-songs';
  list.appendChild(songs);

  const bests = store.loadBests();
  C.areaMeta(camArea).forEach(m => {
    const unlocked = C.isLevelUnlocked(progress, camArea, m.levelIdx);
    const cleared  = C.isLevelCleared(progress, camArea, m.levelIdx);
    const best     = bests['cam:' + m.id];
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
    songs.appendChild(row);
  });
}

const ENDLESS_BANDS = [
  ['1-4', '🌱', 'Casual',    'Gentle — a warm-up that never ends'],
  ['4-7', '🔥', 'Standard',  'The campaign\'s middle, rolling forever'],
  ['7-9', '💀', 'Punishing', 'Fast and dense, run after run'],
];

function renderEndlessPane(list, ready) {
  list.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'cam-head';
  head.innerHTML = '<span class="ch-name">Endless</span>'
    + '<span class="ch-blurb">A fresh song every run</span>';
  list.appendChild(head);
  if (!ready) {
    const note = document.createElement('div');
    note.className = 'endless-locked-note';
    note.textContent = 'Clear every campaign area to unlock Endless.';
    list.appendChild(note);
    return;
  }
  const pane = document.createElement('div');
  pane.className = 'endless-pane';
  ENDLESS_BANDS.forEach(([band, emoji, name, sub]) => {
    const card = document.createElement('div');
    card.className = 'endless-band';
    card.innerHTML = '<span class="eb-emoji">' + emoji + '</span>'
      + '<span class="eb-text"><span class="eb-name">' + name + '</span>'
      + '<span class="eb-sub">' + sub + '</span></span>';
    card.addEventListener('click', () => {
      const lvl = generateLevel(band);
      if (!lvl) { showToast('Could not start Endless', true); return; }
      lvl.endless = true; lvl._band = band;
      lastGenerated = lvl;
      launchLevel(lvl);
    });
    pane.appendChild(card);
  });
  list.appendChild(pane);
}

function launchCampaignLevel(areaId, idx) {
  const lvl = CAM().levelAt(areaId, idx);
  if (!lvl) { showToast('That song could not be loaded', true); return; }
  launchLevel(lvl);
}

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

const HOME_PANES = { themes: buildThemesGrid, settings: buildSettingsPanel, shop: renderShop };

function renderHome() {
  renderCampaign();
  renderDaily();
  renderXpStrip();
  renderCustoms();
  updateProfileBar();
  const showing = document.querySelector('.hnav.active');
  const build = showing && HOME_PANES[showing.dataset.tab];
  if (build) build();
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

function selectHomeTab(tab) {
  document.querySelectorAll('.hnav').forEach(x => {
    const on = x.dataset.tab === tab;
    x.classList.toggle('active', on);
    if (on) x.setAttribute('aria-current', 'page');
    else x.removeAttribute('aria-current');
  });
  document.querySelectorAll('.tab-pane').forEach(x => {
    x.classList.toggle('active', x.id === 'tab-' + tab);
  });
  if (HOME_PANES[tab]) HOME_PANES[tab]();
}

document.querySelectorAll('.hnav').forEach(t => t.addEventListener('click', () => selectHomeTab(t.dataset.tab)));

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

  profile.coins -= box.price; saveProfile(); updateProfileBar();

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

(function setupCustomAvatar() {
  const uploadArea = document.getElementById('custom-av-upload-area');
  const fileInput  = document.getElementById('custom-av-file');
  const preview    = document.getElementById('custom-av-preview');
  const buyBtn     = document.getElementById('custom-av-buy-btn');
  if (!uploadArea) return;

  let pendingDataUrl = null;

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

const STUDIO_TAB = location.hash === '#studio';

function openStudio() {
  if (!STUDIO_TAB && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create && chrome.runtime && chrome.runtime.getURL) {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') + '#studio' });
    return;
  }
  window.RD_Studio.open();
}

document.getElementById('studio-btn').addEventListener('click', openStudio);

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

const KEY_CODE_LABELS = [
  'KeyA','KeyB','KeyC','KeyD','KeyE','KeyF','KeyG','KeyH','KeyI','KeyJ','KeyK','KeyL','KeyM',
  'KeyN','KeyO','KeyP','KeyQ','KeyR','KeyS','KeyT','KeyU','KeyV','KeyW','KeyX','KeyY','KeyZ',
  'Digit0','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
  'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
  'Space','Enter','ShiftLeft','ShiftRight','ControlLeft','AltLeft',
  'Semicolon','Quote','Comma','Period','Slash','BracketLeft','BracketRight',
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
  const PUNCT = { Semicolon:';', Quote:"'", Comma:',', Period:'.', Slash:'/', BracketLeft:'[', BracketRight:']' };
  return PUNCT[code] || code;
}

let settingsSubTab = 'controls';
const SETTINGS_SUBTABS = [
  { id:'controls', label:'Controls' },
  { id:'display',  label:'Display'  },
  { id:'audio',    label:'Audio'    },
  { id:'gameplay', label:'Gameplay' },
];

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

function buildSettingsControls(panel) {
  const s = currentSettings;
  panel.appendChild(_settingsSectionHead('Lane Keys'));
  const countRow = document.createElement('div');
  countRow.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;';
  window.RD_Lanes.COUNTS.forEach(n => {
    const b = document.createElement('button');
    b.className = 'lane-count-btn' + (n === settingsLaneCount ? ' sel' : '');
    b.dataset.lanes = n;
    b.textContent = n + ' lanes';
    b.style.cssText = 'flex:1;padding:7px 4px;border-radius:8px;font-size:12px;font-weight:700;font-family:var(--font-body);cursor:pointer;border:1px solid ' + (n === settingsLaneCount ? 'var(--tap)' : 'var(--border2)') + ';background:' + (n === settingsLaneCount ? 'var(--bg3)' : 'none') + ';color:' + (n === settingsLaneCount ? 'var(--tap)' : 'var(--muted)') + ';';
    b.addEventListener('click', () => { settingsLaneCount = n; buildSettingsPanel(); });
    countRow.appendChild(b);
  });
  panel.appendChild(countRow);
  const rowKeys = keysFor(settingsLaneCount);
  rowKeys.forEach((_, i) => {
    const name = 'Lane ' + (i + 1);
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
      if (code === rowKeys[i]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      assignLaneKey(settingsLaneCount, i, sel.value);
      store.saveSettings(currentSettings);
      applySettingsToDOM();
      buildSettingsPanel();
    });
    row.appendChild(lbl); row.appendChild(sel);
    panel.appendChild(row);
  });
}

let settingsLaneCount = 4;

function keysFor(n) {
  n = window.RD_Lanes.clamp(n);
  return n === 4 ? currentSettings.keys : currentSettings['keys' + n];
}

function assignLaneKey(n, lane, code) {
  const row = keysFor(n);
  const clash = row.indexOf(code);
  if (clash >= 0 && clash !== lane) row[clash] = row[lane];
  row[lane] = code;
}

function validKeyRow(row, n) {
  return Array.isArray(row) && row.length === n
    && row.every(k => typeof k === 'string' && k)
    && new Set(row).size === n;
}

const POPUP_MAX_W = 800;
const POPUP_MAX_H = 760;

function isExtensionPopup() {
  if (location.hash === '#studio') return false;
  return location.protocol === 'chrome-extension:'
      || location.protocol === 'moz-extension:'
      || location.protocol === 'ms-browser-extension:';
}

function getMaxDims() {
  if (isExtensionPopup()) return { maxW: POPUP_MAX_W, maxH: POPUP_MAX_H };
  return {
    maxW: Math.max(340, Math.min(1100, window.innerWidth  || POPUP_MAX_W)),
    maxH: Math.max(420, Math.min(POPUP_MAX_H, window.innerHeight || POPUP_MAX_H)),
  };
}

function appliedWidth() {
  return Math.min(getMaxDims().maxW, currentSettings.width + advExpansion + laneExpansion);
}

let _pendingSize = null;

function buildSettingsDisplay(panel) {
  const s = currentSettings;
  const { maxW, maxH } = getMaxDims();
  _pendingSize = { width: Math.min(s.width, maxW), height: Math.min(s.height, maxH) };

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

  sizeRow('Width',  340, maxW, 'width',  'size-w-slider', 'size-w-input');
  sizeRow('Height', 420, maxH, 'height', 'size-h-slider', 'size-h-input');

  const applyBtn = document.createElement('button');
  applyBtn.style.cssText = 'width:100%;margin-top:4px;padding:9px;border-radius:9px;border:1px solid var(--accent);background:rgba(255,58,110,.1);color:var(--accent);font-size:12px;font-weight:700;font-family:var(--font-body);cursor:pointer;transition:background .12s;';
  applyBtn.textContent = '✓ Apply Size';
  applyBtn.onmouseenter = () => applyBtn.style.background = 'rgba(255,58,110,.22)';
  applyBtn.onmouseleave = () => applyBtn.style.background = 'rgba(255,58,110,.1)';
  applyBtn.addEventListener('click', () => {
    currentSettings.width  = _pendingSize.width;
    currentSettings.height = _pendingSize.height;
    store.saveSettings(currentSettings);
    applySettingsToDOM();
    showToast('Size applied');
  });
  panel.appendChild(applyBtn);

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:10px;color:var(--muted);margin-top:6px;';
  hint.textContent = 'Type a size or drag the sliders, then Apply — or drag the window’s right or bottom edge. '
    + 'Sizes go up to ' + POPUP_MAX_W + '×' + POPUP_MAX_H + 'px; a Chrome extension popup is limited by the browser and may clip beyond that.';
  panel.appendChild(hint);
}

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
      + 'Greece for harp. Turn this off to hear your own pick everywhere instead.';
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

  const content = document.createElement('div');
  panel.appendChild(content);
  if      (settingsSubTab === 'controls') buildSettingsControls(content);
  else if (settingsSubTab === 'display')  buildSettingsDisplay(content);
  else if (settingsSubTab === 'audio')    buildSettingsAudio(content);
  else if (settingsSubTab === 'gameplay') buildSettingsGameplay(content);

  const resetBtn = document.createElement('button');
  resetBtn.style.cssText = 'width:100%;margin-top:14px;padding:9px;border-radius:9px;border:1px solid var(--border2);background:none;color:var(--muted);font-size:12px;font-weight:700;font-family:var(--font-body);cursor:pointer;transition:border-color .15s,color .15s;';
  resetBtn.textContent = '↺ Reset to defaults';
  resetBtn.onmouseenter = () => { resetBtn.style.borderColor='var(--miss)'; resetBtn.style.color='var(--miss)'; };
  resetBtn.onmouseleave = () => { resetBtn.style.borderColor='var(--border2)'; resetBtn.style.color='var(--muted)'; };
  resetBtn.addEventListener('click', () => {
    currentSettings = freshSettings();
    store.saveSettings(currentSettings);
    applySettingsToDOM();
    if (window.RD_setVolume) window.RD_setVolume(currentSettings.masterVol);
    if (window.RD_setMusicVolume) window.RD_setMusicVolume(currentSettings.musicVol);
    buildSettingsPanel();
    showToast('Settings reset');
  });
  panel.appendChild(resetBtn);
}

const GFX_STYLES = [
  ['modern',  'Modern',  'Lit edges, depth on the board, glow on the strike line'],
  ['classic', 'Classic', 'The original flat look, exactly as it was'],
];

const DEFAULT_SETTINGS = {
  keys: window.RD_Lanes.defaultKeys(4),
  keys6: window.RD_Lanes.defaultKeys(6),
  keys8: window.RD_Lanes.defaultKeys(8),
  gfx: 'modern',
  songVoices: true,
  hitWindow: 'normal',
  width: 420,
  height: 640,
  lives: 3,
  instrument: 'synth',
  uiScale: 1,
  masterVol: 1,
  musicVol: 1,
};

function freshSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, {
    keys: [...DEFAULT_SETTINGS.keys],
    keys6: [...DEFAULT_SETTINGS.keys6],
    keys8: [...DEFAULT_SETTINGS.keys8],
  });
}

let currentSettings = freshSettings();

function migrateVoices() {
  const arr = store.load();
  let changed = false;
  arr.forEach(l => { if (translateLevelVoices(l)) changed = true; });
  if (changed) store.save(arr);
}

function loadAndApplySettings() {
  const saved = store.loadSettings();
  if (saved) {
    if (validKeyRow(saved.keys, 4)) currentSettings.keys = saved.keys;
    if (validKeyRow(saved.keys6, 6)) currentSettings.keys6 = saved.keys6;
    if (validKeyRow(saved.keys8, 8)) currentSettings.keys8 = saved.keys8;
    if (saved.width)      currentSettings.width      = saved.width;
    if (saved.height)     currentSettings.height     = saved.height;
    if (saved.lives)      currentSettings.lives      = saved.lives;
    if (saved.instrument) currentSettings.instrument = window.RD_resolveInstrument ? window.RD_resolveInstrument(saved.instrument) : saved.instrument;
    if (saved.gfx)            currentSettings.gfx        = saved.gfx;
    if (typeof saved.songVoices === 'boolean') currentSettings.songVoices = saved.songVoices;
    if (saved.hitWindow)      currentSettings.hitWindow  = saved.hitWindow;
    if (saved.uiScale)        currentSettings.uiScale   = saved.uiScale;
    if (saved.masterVol != null) currentSettings.masterVol = saved.masterVol;
    if (saved.musicVol  != null) currentSettings.musicVol  = saved.musicVol;
  }
  applySettingsToDOM();
  migrateVoices();
  if (window.RD_saveInstrument)  window.RD_saveInstrument(currentSettings.instrument || 'synth');
  if (window.RD_setVolume)       window.RD_setVolume(currentSettings.masterVol);
  if (window.RD_setMusicVolume)  window.RD_setMusicVolume(currentSettings.musicVol);
}

function updateSizeControls(w, h) {
  if (_pendingSize) { _pendingSize.width = w; _pendingSize.height = h; }
  const ws = document.getElementById('size-w-slider'), wi = document.getElementById('size-w-input');
  if (ws) ws.value = w;  if (wi) wi.value = w;
  const hs = document.getElementById('size-h-slider'), hi = document.getElementById('size-h-input');
  if (hs) hs.value = h;  if (hi) hi.value = h;
}

let _resizeSaveTimer = null;
function observeManualResize() {
  if (!window.ResizeObserver) return;
  const ro = new ResizeObserver(() => {
    const w = Math.round(document.documentElement.offsetWidth) - advExpansion - laneExpansion;
    const h = Math.round(document.documentElement.offsetHeight);
    let changed = false;
    if (w !== currentSettings.width)  { currentSettings.width  = w; changed = true; }
    if (h !== currentSettings.height) { currentSettings.height = h; changed = true; }
    if (!changed) return;
    updateSizeControls(currentSettings.width, currentSettings.height);
    clearTimeout(_resizeSaveTimer);
    _resizeSaveTimer = setTimeout(() => store.saveSettings(currentSettings), 200);
  });
  ro.observe(document.documentElement);

  window.addEventListener('resize', () => applySettingsToDOM());
}

function applySettingsToDOM() {
  const { maxW, maxH } = getMaxDims();
  currentSettings.width  = Math.max(340, Math.min(currentSettings.width, maxW));
  currentSettings.height = Math.max(420, Math.min(currentSettings.height, maxH));
  const root = document.documentElement;
  root.style.maxWidth  = maxW + 'px';
  root.style.maxHeight = maxH + 'px';
  root.style.width  = appliedWidth() + 'px';
  root.style.height = currentSettings.height + 'px';
  document.body.classList.toggle('gfx-modern', currentSettings.gfx !== 'classic');
  document.body.style.zoom = currentSettings.uiScale || 1;
  const laneKeys = keysFor(laneCount);
  laneKeys.forEach((code, i) => {
    const el = document.querySelector(`#btn${i} .lane-key`);
    if (el) el.textContent = keyCodeLabel(code);
  });
  const ovHost = document.querySelector('.ov-keys');
  if (ovHost) {
    const labels = laneKeys.map(keyCodeLabel);
    const have = [...ovHost.children].map(c => c.textContent);
    if (have.join() !== labels.join()) {
      ovHost.innerHTML = '';
      labels.forEach(l => {
        const d = document.createElement('div');
        d.className = 'ov-key';
        d.textContent = l;
        ovHost.appendChild(d);
      });
    }
  }
}

function activeLaneCount() {
  return typeof creatorActive === 'function' && creatorActive() ? crLanes : laneCount;
}

function buildKeyMap() {
  const map = {};
  keysFor(activeLaneCount()).forEach((code, i) => { map[code] = i; });
  return map;
}

const laneSources = [];
function pressLane(lane, src) {
  const set = laneSources[lane] || (laneSources[lane] = new Set());
  if (set.has(src)) return;
  const first = set.size === 0;
  set.add(src);
  if (!first) return;
  if (running) tapLane(lane);
  else if (window.RD_playNote) window.RD_playNote(lane, false, crLaneFreqs[lane] || window.RD_Lanes.defaultFreqs(activeLaneCount())[lane]);
}
function releaseLane(lane, src) {
  const set = laneSources[lane];
  if (!set || !set.delete(src)) return;
  if (set.size === 0 && typeof onLaneRelease === 'function') onLaneRelease(lane);
}
function releaseAllLanes() {
  laneSources.forEach((set, lane) => {
    if (!set || !set.size) return;
    set.clear();
    if (typeof onLaneRelease === 'function') onLaneRelease(lane);
  });
}

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (window.RD_Studio && window.RD_Studio.active()) return;

  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;

  const KEY_MAP = buildKeyMap();

  if (!running && typeof creatorActive === 'function' && creatorActive()
      && typeof handleCreatorKey === 'function' && handleCreatorKey(e, KEY_MAP)) {
    return;
  }

  if (running && chaosMode && /^Key[A-Z]$/.test(e.code) && e.code !== 'KeyQ' && e.code !== 'KeyR') {
    e.preventDefault();
    tapChaos(e.code);
    return;
  }

  if (e.code in KEY_MAP) {
    e.preventDefault();
    pressLane(KEY_MAP[e.code], 'k' + e.code);
    return;
  }

  if (e.code === 'KeyR' && running) startGame();
  if (e.code === 'KeyQ') quitToMenu();
});

document.addEventListener('keyup', e => {
  if (running && chaosMode && /^Key[A-Z]$/.test(e.code)) onChaosRelease(e.code);
  const map = buildKeyMap();
  if (e.code in map) releaseLane(map[e.code], 'k' + e.code);
});
window.addEventListener('blur', releaseAllLanes);

(function wireLanePointers() {
  const host = document.getElementById('g-lanes');
  const down = new Map();
  host.addEventListener('pointerdown', ev => {
    const ln = ev.target.closest && ev.target.closest('.lane');
    if (!ln || ln.dataset.lane === undefined) return;
    ev.preventDefault();
    const lane = +ln.dataset.lane;
    try { host.setPointerCapture(ev.pointerId); } catch (_) {}
    down.set(ev.pointerId, lane);
    pressLane(lane, 'p' + ev.pointerId);
  });
  const up = ev => {
    const lane = down.get(ev.pointerId);
    if (lane === undefined) return;
    down.delete(ev.pointerId);
    releaseLane(lane, 'p' + ev.pointerId);
  };
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('lostpointercapture', up);
})();

const pbarAvatar = document.getElementById('pbar-avatar');
if (pbarAvatar) {
  pbarAvatar.addEventListener('click', () => selectHomeTab('shop'));
}

document.getElementById('g-menu-btn').addEventListener('click', quitToMenu);

loadAndApplySettings();
observeManualResize();
applyTheme(isThemeLocked(themeById(store.loadTheme())) ? 'graphite' : store.loadTheme());
const ct = store.loadCustomTheme();
if (ct && store.loadTheme() === 'custom') applyCustomTheme(ct);

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
