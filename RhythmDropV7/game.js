// ═══════════════════════════════════════════════════
//  RhythmDrop game.js v4
//  Changes from v3:
//  1. No audio preview when selecting notes in creator
//  2. A/S/D/F keys play lane notes when NOT in-game
//  3. Note picker opens by clicking the note label
//     inside the cell itself (no separate trigger button)
//  4. Uses full chromatic freq table from audio.js v4
// ═══════════════════════════════════════════════════

// ── Built-in levels ──────────────────────────────
const LEVELS = [
  {
    id:'l0', name:'Cascade', diff:'easy', bpm:90, beats:24,
    notes:[
      {b:0,l:0,t:'tap'},{b:2,l:1,t:'tap'},{b:4,l:2,t:'tap'},{b:6,l:3,t:'tap'},
      {b:8,l:0,t:'tap'},{b:9,l:2,t:'tap'},{b:11,l:1,t:'tap'},{b:13,l:3,t:'tap'},
      {b:14,l:0,t:'dtap'},{b:16,l:2,t:'dtap'},
      {b:18,l:1,t:'tap'},{b:19,l:3,t:'tap'},
      {b:20,l:0,t:'tap'},{b:21,l:1,t:'tap'},{b:22,l:2,t:'tap'},{b:23,l:3,t:'tap'},
    ],
    bgMode:'none',
    laneFreqs:[261.63,329.63,392.00,523.25],
    bassPattern:[]
  },
  {
    id:'l1', name:'Strobe', diff:'medium', bpm:125, beats:28,
    notes:[
      {b:0,l:0,t:'tap'},{b:1,l:2,t:'tap'},{b:2,l:1,t:'tap'},{b:3,l:3,t:'tap'},
      {b:4,l:0,t:'dtap'},{b:6,l:1,t:'tap'},{b:7,l:3,t:'tap'},
      {b:8,l:2,t:'dtap'},{b:10,l:0,t:'tap'},{b:11,l:1,t:'tap'},
      {b:12,l:3,t:'dtap'},{b:14,l:2,t:'tap'},{b:15,l:0,t:'tap'},
      {b:16,l:1,t:'dtap'},{b:17,l:3,t:'dtap'},
      {b:18,l:0,t:'tap'},{b:19,l:2,t:'tap'},{b:20,l:1,t:'tap'},{b:21,l:3,t:'tap'},
      {b:22,l:0,t:'dtap'},{b:24,l:2,t:'dtap'},
      {b:25,l:1,t:'tap'},{b:26,l:3,t:'tap'},{b:27,l:0,t:'tap'},
    ],
    bgMode:'drums',
    laneFreqs:[220.00,261.63,329.63,392.00],
    bassPattern:[]
  },
  {
    id:'l2', name:'Echo', diff:'medium', bpm:115, beats:32,
    notes:[
      {b:0,l:0,t:'dtap'},{b:2,l:2,t:'tap'},{b:3,l:3,t:'tap'},
      {b:4,l:1,t:'dtap'},{b:6,l:0,t:'tap'},{b:7,l:2,t:'tap'},
      {b:8,l:3,t:'dtap'},{b:10,l:1,t:'tap'},{b:11,l:0,t:'tap'},
      {b:12,l:2,t:'dtap'},{b:13,l:3,t:'tap'},{b:14,l:1,t:'tap'},
      {b:15,l:0,t:'dtap'},{b:16,l:2,t:'tap'},{b:17,l:3,t:'tap'},
      {b:18,l:1,t:'dtap'},{b:19,l:0,t:'tap'},
      {b:20,l:2,t:'tap'},{b:21,l:3,t:'tap'},{b:22,l:1,t:'tap'},{b:23,l:0,t:'tap'},
      {b:24,l:3,t:'dtap'},{b:25,l:1,t:'dtap'},
      {b:26,l:0,t:'tap'},{b:27,l:2,t:'tap'},{b:28,l:1,t:'tap'},
      {b:29,l:3,t:'dtap'},{b:30,l:0,t:'tap'},{b:31,l:2,t:'tap'},
    ],
    bgMode:'bass',
    laneFreqs:[174.61,220.00,261.63,349.23],
    bassPattern:[65.41,0,65.41,0,87.31,0,73.42,0]
  },
  {
    id:'l3', name:'Overload', diff:'hard', bpm:155, beats:36,
    notes:[
      {b:0,l:0,t:'tap'},{b:1,l:1,t:'tap'},{b:2,l:2,t:'tap'},{b:3,l:3,t:'tap'},
      {b:4,l:0,t:'dtap'},{b:4,l:2,t:'dtap'},{b:5,l:1,t:'tap'},{b:6,l:3,t:'tap'},
      {b:7,l:0,t:'tap'},{b:8,l:1,t:'dtap'},{b:9,l:3,t:'tap'},{b:10,l:2,t:'tap'},
      {b:11,l:0,t:'dtap'},{b:12,l:1,t:'tap'},{b:13,l:2,t:'tap'},
      {b:14,l:3,t:'dtap'},{b:15,l:1,t:'tap'},
      {b:16,l:0,t:'tap'},{b:16,l:3,t:'tap'},
      {b:17,l:2,t:'dtap'},{b:18,l:1,t:'tap'},
      {b:19,l:0,t:'dtap'},{b:20,l:3,t:'tap'},{b:21,l:2,t:'tap'},
      {b:22,l:1,t:'dtap'},{b:22,l:3,t:'dtap'},
      {b:23,l:0,t:'tap'},{b:24,l:1,t:'tap'},{b:25,l:2,t:'tap'},{b:26,l:3,t:'tap'},
      {b:27,l:0,t:'dtap'},{b:28,l:2,t:'dtap'},
      {b:29,l:1,t:'tap'},{b:30,l:3,t:'tap'},{b:31,l:0,t:'tap'},
      {b:32,l:1,t:'dtap'},{b:32,l:3,t:'dtap'},
      {b:33,l:0,t:'tap'},{b:34,l:2,t:'tap'},{b:35,l:1,t:'tap'},
    ],
    bgMode:'drums',
    laneFreqs:[196.00,246.94,293.66,392.00],
    bassPattern:[]
  }
];

// ── Persistence ──────────────────────────────────
const store = {
  load:             ()  => { try { return JSON.parse(localStorage.getItem('rd_levels')||'[]'); } catch { return []; } },
  save:             a   => localStorage.setItem('rd_levels', JSON.stringify(a)),
  loadTheme:        ()  => localStorage.getItem('rd_theme')||'graphite',
  saveTheme:        t   => localStorage.setItem('rd_theme', t),
  loadCustomTheme:  ()  => { try { return JSON.parse(localStorage.getItem('rd_custom_theme')||'null'); } catch { return null; } },
  saveCustomTheme:  t   => localStorage.setItem('rd_custom_theme', JSON.stringify(t)),
  loadSettings:     ()  => { try { return JSON.parse(localStorage.getItem('rd_settings')||'null'); } catch { return null; } },
  saveSettings:     s   => localStorage.setItem('rd_settings', JSON.stringify(s)),
  // Profile
  loadProfile:      ()  => { try { return JSON.parse(localStorage.getItem('rd_profile')||'null'); } catch { return null; } },
  saveProfile:      p   => localStorage.setItem('rd_profile', JSON.stringify(p)),
  // High scores: array of {name, score, level, coins, date}
  loadScores:       ()  => { try { return JSON.parse(localStorage.getItem('rd_scores')||'[]'); } catch { return []; } },
  saveScores:       a   => localStorage.setItem('rd_scores', JSON.stringify(a)),
  // Shop: owned avatar ids, equipped id
  // Every field must be carried through here — the normaliser
  // silently dropping a key means the purchase that wrote it is
  // lost on the next read.
  loadShop:         ()  => { try { const o = JSON.parse(localStorage.getItem('rd_shop')||'{}');
                              return { owned:o.owned||[], equipped:o.equipped||null,
                                       colour:o.colour||'original', themes:o.themes||[], fx:o.fx||[] }; }
                             catch { return {owned:[],equipped:null,colour:'cyan',themes:[],fx:[]}; } },
  saveShop:         s   => localStorage.setItem('rd_shop', JSON.stringify(s)),
  // Daily: { day:'YYYY-MM-DD', streak:n, claimedToday:bool }
  loadDaily:        ()  => { try { const o=JSON.parse(localStorage.getItem('rd_daily')||'{}');
                              return { day:o.day||null, streak:o.streak||0 }; }
                             catch { return {day:null,streak:0}; } },
  saveDaily:        d   => localStorage.setItem('rd_daily', JSON.stringify(d)),
  // Campaign progress: { cleared:{'1-0':true}, xp:0, track:{tier:0,claimed:[]} }
  loadProgress:     ()  => { try { const o=JSON.parse(localStorage.getItem('rd_progress')||'{}');
                              return { cleared:o.cleared||{}, xp:o.xp||0,
                                       track:o.track||{tier:0,claimed:[]} }; }
                             catch { return {cleared:{},xp:0,track:{tier:0,claimed:[]}}; } },
  saveProgress:     p   => localStorage.setItem('rd_progress', JSON.stringify(p)),
  // Custom avatar data URL
  loadCustomAv:     ()  => localStorage.getItem('rd_custom_av')||null,
  saveCustomAv:     d   => localStorage.setItem('rd_custom_av', d),
  // Per-level bests: { levelKey: [score, coins, date] }. Unbounded on
  // purpose — rd_scores is a top-50 run log, which is the wrong shape
  // for "my best on this song" once there are 150 songs plus customs
  // plus shared codes. Every level keeps its own record forever.
  loadBests:        ()  => { try { const o = JSON.parse(localStorage.getItem('rd_bests')||'{}');
                              return (o && typeof o === 'object') ? o : {}; }
                             catch { return {}; } },
  saveBests:        b   => localStorage.setItem('rd_bests', JSON.stringify(b)),
};

// A stable identity for a level's best. Names are not usable: two
// customs can share one, and the campaign's generated titles are not
// unique either (150 songs, 145 distinct titles).
function levelKeyFor(lvl) {
  if (!lvl) return null;
  if (lvl.campaign && lvl.areaId !== undefined && lvl.levelIdx !== undefined) {
    return 'c:' + lvl.areaId + '-' + lvl.levelIdx + (lvl.double ? 'd' : '');
  }
  if (lvl.shareCode) return 'k:' + lvl.shareCode;
  // Customs have no id, so fall back to the same name+size pair the
  // sync importer uses to decide whether two levels are the same one.
  const n = lvl.name || 'untitled';
  return 'u:' + n + '|' + (lvl.grid ? lvl.grid.length : (lvl.beats || 0));
}

function bestFor(lvl, bests) {
  const k = levelKeyFor(lvl);
  if (!k) return null;
  const all = bests || store.loadBests();
  // Records lifted from the old top-50 log are keyed by name, since
  // that is all it carried. Take whichever is higher until a fresh run
  // writes the proper key.
  const rows = [all[k], all['n:' + (lvl.name || 'untitled')]].filter(Boolean);
  if (!rows.length) return null;
  const row = rows.reduce((a, b) => (b[0] > a[0] ? b : a));
  return { score: row[0], coins: row[1], date: row[2] };
}

// Records a run against its level. Returns true if it beat the record.
function recordLevelBest(lvl, score, coins) {
  const k = levelKeyFor(lvl);
  if (!k) return false;
  const bests = store.loadBests();
  const prev = bests[k];
  if (prev && prev[0] >= score) return false;
  bests[k] = [score, coins, Date.now()];
  store.saveBests(bests);
  return true;
}

// One-time lift of the old top-50 log into per-level records, so an
// existing player's history isn't lost the first time they open this
// build. Matching on name is imprecise, but it is all the old format
// carried, and it only ever seeds a record that doesn't exist yet.
(function migrateBests() {
  if (localStorage.getItem('rd_bests_migrated')) return;
  try {
    const bests = store.loadBests();
    let added = 0;
    store.loadScores().forEach(s => {
      if (!s || !s.level) return;
      const k = 'n:' + s.level;
      if (!bests[k] || bests[k][0] < s.score) {
        bests[k] = [s.score, s.coins || 0, s.date || Date.now()];
        added++;
      }
    });
    if (added) store.saveBests(bests);
    localStorage.setItem('rd_bests_migrated', '1');
  } catch (e) { /* a failed migration must never block boot */ }
})();

// ── Profile state ──────────────────────────────
let profile  = store.loadProfile() || { username: null, coins: 0, bestScore: 0 };
let progress = store.loadProgress();
function saveProgress() { store.saveProgress(progress); }

// ══════════════════════════════════════
//  CAMPAIGN PROGRESSION
// ══════════════════════════════════════
const CAM = () => window.RD_Campaign;

function levelKey(areaId, idx, dbl) { return areaId + '-' + idx + (dbl ? 'd' : ''); }
function isCleared(areaId, idx, dbl) { return !!progress.cleared[levelKey(areaId, idx, dbl)]; }

// A level is playable once the one before it is cleared. The
// first level of an area needs the previous area finished.
function isUnlocked(areaId, idx) {
  if (areaId === 1 && idx === 0) return true;
  if (idx > 0) return isCleared(areaId, idx - 1);
  return areaCleared(areaId - 1);
}
function areaCleared(areaId) {
  if (areaId < 1) return true;
  for (let i = 0; i < CAM().LEVELS_PER_AREA; i++) if (!isCleared(areaId, i)) return false;
  return true;
}
function areaUnlocked(areaId) { return areaId === 1 || areaCleared(areaId - 1); }
function areaProgress(areaId) {
  let n = 0;
  for (let i = 0; i < CAM().LEVELS_PER_AREA; i++) if (isCleared(areaId, i)) n++;
  return n;
}
// (areaDoubles removed: the Double is a double-speed replay of a
// finished song now, not a separate level with its own clear.)
// Doubles are optional extras, so they don't count toward the
// prize track or unlocking the next theme.
function totalCleared() {
  return Object.keys(progress.cleared).filter(k => !k.endsWith('d')).length;
}

function grantXp(n) {
  const before = CAM().levelFromXp(progress.xp);
  progress.xp += n;
  const after  = CAM().levelFromXp(progress.xp);
  saveProgress();
  return { gained: n, levelUp: after > before, level: after };
}

// ══════════════════════════════════════
//  PRIZE TRACK
//  Three prizes, always escalating coins -> cosmetic -> avatar.
//  When all three are claimed the tier advances, the requirement
//  rises and the rewards improve, so it keeps running for the
//  whole campaign rather than finishing in area 2.
// ══════════════════════════════════════
function trackTier() { return progress.track.tier || 0; }
function trackNeed()  { return 5 + trackTier() * 3; }   // 5, 8, 11, ...

function trackPrizes() {
  const t = trackTier();
  return [
    { id:'p0', kind:'coins',  label:'Coins',  amount: 150 + t * 100, need: Math.ceil(trackNeed() / 3) },
    { id:'p1', kind:'coins',  label:'Bonus',  amount: 300 + t * 200, need: Math.ceil(trackNeed() * 2 / 3) },
    { id:'p2', kind:'avatar', label:'Avatar', amount: 0,             need: trackNeed() },
  ];
}

// Progress within the current tier only.
function trackProgress() {
  const consumed = (progress.track.consumed || 0);
  return Math.max(0, totalCleared() - consumed);
}

// Two campaign avatars per area, granted on completing it. These
// are never purchasable, so an area's reward is an object you can
// only get by playing it.
function grantAreaAvatars(areaId) {
  const earned = CAMPAIGN_AVATARS.filter(a => a.area === areaId);
  if (!earned.length) return [];
  const shop = store.loadShop();
  shop.owned = shop.owned || [];
  const added = [];
  earned.forEach(a => {
    if (!shop.owned.includes(a.id)) { shop.owned.push(a.id); added.push(a); }
  });
  if (added.length) store.saveShop(shop);
  return added;
}

// Called after any campaign clear: awards anything newly earned.
function syncAreaRewards() {
  const out = [];
  CAM().AREAS.forEach(a => {
    if (areaCleared(a.id)) out.push(...grantAreaAvatars(a.id));
  });
  return out;
}

function claimPrize(prize) {
  const claimed = progress.track.claimed || [];
  if (claimed.includes(prize.id)) return null;
  if (trackProgress() < prize.need) return null;

  let msg;
  if (prize.kind === 'coins') {
    addCoins(prize.amount);
    msg = '+' + prize.amount + ' coins';
  } else {
    // Award the cheapest avatar not yet owned.
    const shop = store.loadShop();
    const next = SHOP_AVATARS.find(a => !(shop.owned || []).includes(a.id));   // buyable set only
    if (next) {
      shop.owned.push(next.id);
      store.saveShop(shop);
      msg = 'Unlocked ' + next.name;
    } else {
      addCoins(1000);
      msg = 'All avatars owned — +1000 coins';
    }
  }

  claimed.push(prize.id);
  progress.track.claimed = claimed;

  // All three claimed: advance the tier and bank the levels spent.
  if (claimed.length >= 3) {
    progress.track.consumed = (progress.track.consumed || 0) + trackNeed();
    progress.track.tier     = trackTier() + 1;
    progress.track.claimed  = [];
  }
  saveProgress();
  return msg;
}
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
  renderCompactStrip();
  if (coins) coins.innerHTML = '<svg class="ic"><use href="#ic-coin"/></svg><span>' + profile.coins.toLocaleString() + ' coins</span>';
  if (hs) {
    const scores = store.loadScores();
    const best = scores.length ? Math.max(...scores.map(s=>s.score)) : 0;
    hs.innerHTML = '<svg class="ic"><use href="#ic-trophy"/></svg><span>Best: ' + best.toLocaleString() + '</span>';
  }
  updateAvatarDisplay();
}

function updateAvatarDisplay() {
  const bar = document.getElementById('pbar-avatar');
  if (!bar) return;
  const shop = store.loadShop();
  renderAvatarInto(bar, shop.equipped, shop.colour);
}


// ── Avatars ───────────────────────────────
// Real vector art instead of emoji: emoji render differently
// on every platform, can't be recoloured, and look wrong at
// large sizes. Each avatar is one two-tone SVG symbol.
// Avatars pending artwork render as their area emblem in outline
// until the SVG lands — adding art is then a one-line change
// (drop the `pending` flag) rather than a rewrite.
const PENDING_AVATARS = [
  { id:'av_scarecrow', name:'Scarecrow', sym:'av-scarecrow', price:scaledPrice(500, 1), area:1 },
  { id:'av_rooster',   name:'Rooster',   sym:'av-rooster',   price:scaledPrice(500, 1), area:1 },
  { id:'av_anubis',    name:'Anubis',    sym:'av-anubis',    price:scaledPrice(500, 2), area:2 },
  { id:'av_scarab',    name:'Scarab',    sym:'av-scarab',    price:scaledPrice(500, 2), area:2 },
  { id:'av_athena',    name:'Athena',    sym:'av-athena',    price:scaledPrice(500, 3), area:3 },
  { id:'av_owl',       name:'Owl',       sym:'av-owl',       price:scaledPrice(500, 3), area:3 },
  { id:'av_centurion', name:'Centurion', sym:'av-centurion', price:scaledPrice(500, 4), area:4 },
  { id:'av_shewolf',   name:'She-Wolf',  sym:'av-shewolf',   price:scaledPrice(500, 4), area:4 },
  { id:'av_jaguar',    name:'Jaguar',    sym:'av-jaguar',    price:scaledPrice(500, 5), area:5 },
  { id:'av_eagle',     name:'Eagle',     sym:'av-eagle',     price:scaledPrice(500, 5), area:5 },
  { id:'av_quetzal',   name:'Quetzal',   sym:'av-quetzal',   price:scaledPrice(500, 6), area:6 },
  { id:'av_jademask',  name:'Jade Mask', sym:'av-jademask',  price:scaledPrice(500, 6), area:6 },
  { id:'av_knight',    name:'Knight',    sym:'av-knight',    price:scaledPrice(500, 7), area:7 },
  { id:'av_stag',      name:'Stag',      sym:'av-stag',      price:scaledPrice(500, 7), area:7 },
  { id:'av_grenadier', name:'Grenadier', sym:'av-grenadier', price:scaledPrice(500, 8), area:8 },
  { id:'av_drummer',   name:'Drummer',   sym:'av-drummer',   price:scaledPrice(500, 8), area:8 },
  { id:'av_headphones',name:'Headphones',sym:'av-headphones',price:scaledPrice(500, 9), area:9 },
  { id:'av_skater',    name:'Skater',    sym:'av-skater',    price:scaledPrice(500, 9), area:9 },
  { id:'av_android',   name:'Android',   sym:'av-android',   price:scaledPrice(500, 10), area:10 },
  { id:'av_visor',     name:'Visor',     sym:'av-visor',     price:scaledPrice(500, 10), area:10 },
];

// Prices climb steeply with the area an item belongs to, so late
// content stays out of reach for a while. With 150 songs plus a
// prize track plus dailies all paying out, a flat 200-800 range
// emptied the shop by area 4.
//
//   area 1  x1.0      area 6  x4.5
//   area 3  x2.0      area 10 x9.0
function areaPriceMult(area) {
  return 1 + (Math.max(1, area || 1) - 1) * 0.9;
}
function scaledPrice(base, area) {
  return Math.round(base * areaPriceMult(area) / 50) * 50;
}

// True once the sprite for an id exists in the document.
function hasArt(sym) {
  return !!document.getElementById(sym);
}

// Generated shop marks. These are the buyable set; the
// hand-drawn ones are campaign rewards and never appear here.
const GEN_AVATARS = [
  { id:'av_g_triad', name:'Triad', sym:'avs-g_triad', price:400 },
  { id:'av_g_quad', name:'Quad', sym:'avs-g_quad', price:530 },
  { id:'av_g_penta', name:'Penta', sym:'avs-g_penta', price:660 },
  { id:'av_g_hexa', name:'Hexa', sym:'avs-g_hexa', price:790 },
  { id:'av_g_hepta', name:'Hepta', sym:'avs-g_hepta', price:920 },
  { id:'av_g_octa', name:'Octa', sym:'avs-g_octa', price:1050 },
  { id:'av_s_nova', name:'Nova', sym:'avs-s_nova', price:1180 },
  { id:'av_s_star', name:'Star', sym:'avs-s_star', price:1310 },
  { id:'av_s_beacon', name:'Beacon', sym:'avs-s_beacon', price:1440 },
  { id:'av_s_flare', name:'Flare', sym:'avs-s_flare', price:1570 },
  { id:'av_s_corona', name:'Corona', sym:'avs-s_corona', price:1700 },
  { id:'av_r_halo', name:'Halo', sym:'avs-r_halo', price:1830 },
  { id:'av_r_orbit', name:'Orbit', sym:'avs-r_orbit', price:1960 },
  { id:'av_r_iris', name:'Iris', sym:'avs-r_iris', price:2090 },
  { id:'av_r_ripple', name:'Ripple', sym:'avs-r_ripple', price:2220 },
  { id:'av_a_up', name:'Ascend', sym:'avs-a_up', price:2350 },
  { id:'av_a_dbl', name:'Cascade', sym:'avs-a_dbl', price:2480 },
  { id:'av_a_bolt', name:'Bolt', sym:'avs-a_bolt', price:2610 },
  { id:'av_a_wave', name:'Wave', sym:'avs-a_wave', price:2740 },
  { id:'av_n_drop', name:'Droplet', sym:'avs-n_drop', price:2870 },
  { id:'av_n_leaf', name:'Leaf', sym:'avs-n_leaf', price:3000 },
  { id:'av_n_moon', name:'Crescent', sym:'avs-n_moon', price:3130 },
  { id:'av_n_sun', name:'Sunburst', sym:'avs-n_sun', price:3260 },
  { id:'av_f_owl', name:'Watcher', sym:'avs-f_owl', price:3390 },
  { id:'av_f_cat', name:'Feline', sym:'avs-f_cat', price:3520 },
  { id:'av_f_bot', name:'Unit', sym:'avs-f_bot', price:3650 },
  { id:'av_f_ghost', name:'Wisp', sym:'avs-f_ghost', price:3780 },
  { id:'av_f_fish', name:'Glide', sym:'avs-f_fish', price:3910 },
  { id:'av_f_bird', name:'Swift', sym:'avs-f_bird', price:4040 },
  { id:'av_o_gem', name:'Prism', sym:'avs-o_gem', price:4170 },
  { id:'av_o_crown', name:'Regal', sym:'avs-o_crown', price:4300 },
  { id:'av_o_key', name:'Key', sym:'avs-o_key', price:4430 },
  { id:'av_o_shield', name:'Aegis', sym:'avs-o_shield', price:4560 },
  { id:'av_o_anvil', name:'Forge', sym:'avs-o_anvil', price:4690 },
  { id:'av_o_cup', name:'Chalice', sym:'avs-o_cup', price:4820 },
  { id:'av_o_disc', name:'Record', sym:'avs-o_disc', price:4950 },
  { id:'av_o_dice', name:'Chance', sym:'avs-o_dice', price:5080 },
  { id:'av_o_hour', name:'Hourglass', sym:'avs-o_hour', price:5210 },
  { id:'av_o_lantern', name:'Lantern', sym:'avs-o_lantern', price:5340 },
  { id:'av_y_eye', name:'Oracle', sym:'avs-y_eye', price:5470 },
  { id:'av_y_spiral', name:'Spiral', sym:'avs-y_spiral', price:5600 },
  { id:'av_y_maze', name:'Labyrinth', sym:'avs-y_maze', price:5730 },
  { id:'av_y_atom', name:'Atom', sym:'avs-y_atom', price:5860 },
  { id:'av_y_note', name:'Quaver', sym:'avs-y_note', price:5990 },
  { id:'av_y_pulse', name:'Signal', sym:'avs-y_pulse', price:6120 },
];

const BASE_AVATARS = [
  { id:'av_star',   name:'Star',   sym:'av-star',   price:300 },
  { id:'av_ghost',  name:'Ghost',  sym:'av-ghost',  price:400 },
  { id:'av_blaze',  name:'Blaze',  sym:'av-blaze',  price:500 },
  { id:'av_cat',    name:'Cat',    sym:'av-cat',    price:650 },
  { id:'av_robot',  name:'Robot',  sym:'av-robot',  price:800 },
  { id:'av_rocket', name:'Rocket', sym:'av-rocket', price:1000 },
  { id:'av_dj',     name:'DJ',     sym:'av-dj',     price:1200 },
  { id:'av_gem',    name:'Gem',    sym:'av-gem',    price:1500 },
  { id:'av_crown',  name:'Crown',  sym:'av-crown',  price:2000 },
];

// The live catalog: base avatars plus any pending ones whose art
// has arrived. Nothing shows a broken slot.
// Buyable with coins.
const SHOP_AVATARS = BASE_AVATARS
  .concat(GEN_AVATARS.filter(a => hasArt(a.sym)));

// Earned by clearing campaign areas — two per area, never for sale.
// Keeping them unbuyable is what makes finishing an area mean
// something beyond the coins.
const CAMPAIGN_AVATARS = PENDING_AVATARS.filter(a => hasArt(a.sym));

// Everything the player can end up owning.
const ALL_AVATARS = SHOP_AVATARS.concat(CAMPAIGN_AVATARS);
function avatarById(id) { return ALL_AVATARS.find(a => a.id === id); }

// Colourways are free once you own an avatar. Charging for them
// would gate self-expression behind a grind; the avatar itself
// is the purchase.
// Three tone slots per colourway:
//   p = body        the main mass of the shape
//   s = detail      shading, secondary forms
//   t = accent      the small bright bit — eyes, a badge, a crest
// Artwork is drawn with three flat marker colours and mapped
// onto these, so one drawing still renders in every colourway.
// 'original' keeps the artwork exactly as drawn — the right
// default now that avatars are authored in colour, with each
// sector sharing a palette. The tints remain for anyone who
// wants a uniform set.
const COLOURWAYS = [
  { id:'original', name:'As drawn', original:true },
  { id:'cyan',   name:'Cyan',   p:'#22D3EE', s:'#0E7490', t:'#E8FBFF' },
  { id:'rose',   name:'Rose',   p:'#FB4F7D', s:'#9D174D', t:'#FFE3EC' },
  { id:'amber',  name:'Amber',  p:'#FBBF24', s:'#B45309', t:'#FFF3D0' },
  { id:'mint',   name:'Mint',   p:'#34D399', s:'#047857', t:'#DFFBEF' },
  { id:'violet', name:'Violet', p:'#A78BFA', s:'#5B21B6', t:'#EFE7FF' },
  { id:'mono',   name:'Mono',   p:'#E6EAF2', s:'#6B7280', t:'#FFFFFF' },
];

function colourway(id) {
  return COLOURWAYS.find(c => c.id === id) || COLOURWAYS[0];
}

// Sprites traced from artwork carry fill attributes; the nine
// original hand-written ones don't and must always be tinted.
function spriteHasOwnColour(sym) {
  const el = document.getElementById(sym);
  return !!(el && el.querySelector('[fill]'));
}

// Renders an avatar into any container at any size. Used by the
// profile bar, the shop grid, and the profile screen, so the
// colourway is applied in exactly one place.
function renderAvatarInto(el, avatarId, cwId) {
  el.innerHTML = '';

  if (avatarId === 'custom') {
    const d = store.loadCustomAv();
    if (d) {
      const img = document.createElement('img');
      img.src = d;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;';
      el.appendChild(img);
      return;
    }
    avatarId = null;
  }

  const av = avatarById(avatarId);
  const sym = av ? av.sym : 'ic-note';
  const cw  = colourway(cwId || (store.loadShop().colour) || 'original');

  const authored = spriteHasOwnColour(sym);
  // Authored art shows as drawn unless a tint is chosen; the older
  // uncoloured sprites always need one.
  const tint = !authored || !cw.original;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'av' + (tint ? ' tint' : '') + (authored ? '' : ' legacy'));
  // Traced art is authored on a 64 grid; the hand-written sprites
  // are 24. Read it off the symbol rather than assuming.
  const src = document.getElementById(sym);
  svg.setAttribute('viewBox', (src && src.getAttribute('viewBox')) || '0 0 24 24');
  if (tint) {
    const use = cw.original ? COLOURWAYS[1] : cw;   // fall back to a real tint
    svg.style.setProperty('--av-p', use.p);
    svg.style.setProperty('--av-s', use.s);
    svg.style.setProperty('--av-t', use.t || use.p);
  }
  if (!av) {
    svg.classList.add('tint');
    svg.style.setProperty('--av-p', 'var(--muted)');
    svg.style.setProperty('--av-s', 'var(--dim)');
    svg.style.setProperty('--av-t', 'var(--muted)');
  }

  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + sym);
  svg.appendChild(use);
  el.appendChild(svg);
}

// A row of colourway swatches. onPick fires with the id.
function buildColourwayRow(wrap, current, onPick) {
  wrap.innerHTML = '';
  COLOURWAYS.forEach(cw => {
    const b = document.createElement('div');
    b.className = 'cw' + (cw.id === current ? ' on' : '');
    b.title = cw.name;
    if (cw.original) {
      b.style.background =
        'conic-gradient(#C0A860 0 33%, #184878 0 66%, #F0C030 0)';
    } else {
      b.style.background = cw.p;
      b.style.setProperty('--cw-s', cw.s);
      b.style.setProperty('--cw-t', cw.t || cw.p);
    }
    b.tabIndex = 0;
    const pick = () => onPick(cw.id);
    b.addEventListener('click', pick);
    b.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); }
    });
    wrap.appendChild(b);
  });
}

// ══════════════════════════════════════
//  PROFILE SCREEN
//  Everything about the player in one place: identity, what
//  they've earned, what they've unlocked, how they've played.
// ══════════════════════════════════════
function renderProfile() {
  const shop   = store.loadShop();
  const scores = store.loadScores();

  // Identity
  renderAvatarInto(document.getElementById('pf-av'), shop.equipped, shop.colour);
  document.getElementById('pf-name').textContent  = profile.username || 'Player';
  document.getElementById('pf-coins').textContent =
    (profile.coins || 0).toLocaleString() + ' coins';

  // Stats, all derived from data already stored — nothing new
  // to track, so this works retroactively for existing players.
  const runs      = scores.length;
  const best      = runs ? Math.max(...scores.map(x => x.score)) : 0;
  const earned    = scores.reduce((n, x) => n + (x.coins || 0), 0);
  const avg       = runs ? Math.round(scores.reduce((n, x) => n + x.score, 0) / runs) : 0;
  const owned     = (shop.owned || []).length;
  const built     = store.load().length;

  const stats = [
    { v: best.toLocaleString(),   l: 'Best Score' },
    { v: runs,                    l: 'Runs' },
    { v: avg.toLocaleString(),    l: 'Average' },
    { v: earned.toLocaleString(), l: 'Coins Earned' },
    { v: owned + '/' + SHOP_AVATARS.length, l: 'Avatars' },
    { v: built,                   l: 'Levels Built' },
  ];
  const sg = document.getElementById('pf-stats');
  sg.innerHTML = '';
  stats.forEach(st => {
    const d = document.createElement('div');
    d.className = 'pf-stat';
    d.innerHTML = '<div class="pf-stat-v"></div><div class="pf-stat-l"></div>';
    d.querySelector('.pf-stat-v').textContent = st.v;
    d.querySelector('.pf-stat-l').textContent = st.l;
    sg.appendChild(d);
  });

  // Colourway
  buildColourwayRow(document.getElementById('pf-colourways'), shop.colour, id => {
    const sh = store.loadShop();
    sh.colour = id;
    store.saveShop(sh);
    uiSound('detent');
    renderProfile();
    updateProfileBar();
  });

  // Owned avatars, plus a slot for a custom one if there is
  // one. Locked avatars still show, greyed, so the shop has
  // something to aim at.
  const grid = document.getElementById('pf-avatars');
  grid.innerHTML = '';

  const slots = SHOP_AVATARS.map(av => ({
    id: av.id, sym: av.sym, name: av.name,
    owned: (shop.owned || []).includes(av.id),
  }));
  if (store.loadCustomAv()) {
    slots.push({ id:'custom', name:'Custom', owned:true, custom:true });
  }

  slots.forEach(sl => {
    const d = document.createElement('div');
    d.className = 'pf-slot'
      + (shop.equipped === sl.id ? ' on' : '')
      + (sl.owned ? '' : ' locked');
    d.title = sl.owned ? sl.name : sl.name + ' — locked';
    if (sl.owned) {
      d.tabIndex = 0;
      renderAvatarInto(d, sl.id, shop.colour);
      const equip = () => {
        const sh = store.loadShop();
        sh.equipped = sl.id;
        store.saveShop(sh);
        uiSound('detent');
        renderProfile();
        updateProfileBar();
      };
      d.addEventListener('click', equip);
      d.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); equip(); }
      });
    } else {
      renderAvatarInto(d, null, shop.colour);
      const svg = d.querySelector('.av use');
      if (svg) svg.setAttribute('href', '#' + sl.sym);
    }
    grid.appendChild(d);
  });

  // Recent runs — most recent first, which is a different view
  // from the leaderboard on the level cards.
  const rec = document.getElementById('pf-recent');
  rec.innerHTML = '';
  const recent = [...scores].sort((a, b) => b.date - a.date).slice(0, 5);
  if (!recent.length) {
    rec.appendChild(emptyState('No runs yet',
      'Play a level and your scores will show up here.', null, null));
  } else {
    recent.forEach((r, i) => {
      const d = document.createElement('div');
      d.className = 'pf-run';
      d.innerHTML = '<div class="pf-run-rank"></div>'
                  + '<div class="pf-run-lvl"></div>'
                  + '<div class="pf-run-score"></div>';
      d.querySelector('.pf-run-rank').textContent  = '#' + (i + 1);
      d.querySelector('.pf-run-lvl').textContent   = r.level || 'Unknown';
      d.querySelector('.pf-run-score').textContent = r.score.toLocaleString();
      rec.appendChild(d);
    });
  }
}

(function wireProfile() {
  const back = document.getElementById('pf-back');
  if (back) back.addEventListener('click', () => { showScreen('home'); renderHome(); });

  const rename = document.getElementById('pf-rename');
  if (rename) rename.addEventListener('click', () => {
    const v = window.prompt('Username:', profile.username || 'Player');
    if (v === null) return;
    const name = v.trim().slice(0, 16);
    if (!name) { showToast('Name cannot be empty', true); return; }
    profile.username = name;
    saveProfile();
    renderProfile();
    updateProfileBar();
    showToast('Renamed to ' + name);
  });
})();

// ── High score management ───────────────────
function addHighScore(name, score, levelName, coinMult) {
  const coins = Math.floor((score / 1000) * (coinMult === undefined ? 1 : coinMult));
  const scores = store.loadScores();
  scores.push({ name, score, level: levelName, coins, date: Date.now() });
  scores.sort((a,b) => b.score - a.score);
  store.saveScores(scores.slice(0, 50)); // keep top 50
  if (score > profile.bestScore) {
    profile.bestScore = score;
    saveProfile();
  }
  addCoins(coins);
  return coins;
}

// ── Import / Export ──────────────────────────────
function copyText(text, okMsg, fallbackLabel) {
  const done = () => showToast(okMsg);
  const manual = () => {
    // Last resort: put it somewhere the user can select it.
    window.prompt(fallbackLabel || 'Copy this code:', text);
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(manual);
    } else {
      manual();
    }
  } catch (e) {
    manual();
  }
}

function exportLevel(lvl) {
  // v2 codes are ~90% shorter than v5's base64(JSON).
  const text = window.RD_Codec
    ? window.RD_Codec.encodeLevel(lvl)
    : 'RHYTHMDROP:' + btoa(unescape(encodeURIComponent(JSON.stringify(lvl))));
  copyText(text, 'Copied — ' + text.length + ' characters', 'Copy this export code:');
}

function importLevel() {
  const text = prompt('Paste your export code:');
  if (!text || !text.trim()) return;
  try {
    // Reads both v6 (RD2:) and v5 (RHYTHMDROP:) codes.
    const lvl = window.RD_Codec.decodeLevel(text);
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

// ══════════════════════════════════════
//  ACCOUNT SYNC
//  No server, no login: the account is the code. Copy it off
//  one device, paste it into another.
// ══════════════════════════════════════
function buildSyncCode(includeLevels) {
  return window.RD_Codec.encodeSync({
    profile:     profile,
    shop:        store.loadShop(),
    scores:      store.loadScores(),
    theme:       store.loadTheme(),
    customTheme: store.loadCustomTheme(),
    settings:    currentSettings,
    progress:    progress,
    daily:       store.loadDaily(),
    bests:       store.loadBests(),
    avatar:      store.loadCustomAv(),
    levels:      includeLevels ? store.load() : null,
  });
}

// Merge rather than clobber: coins and best score take the
// higher of the two, owned avatars union, levels append. Someone
// syncing a second device shouldn't lose what's already there.
function applySyncCode(text) {
  const d = window.RD_Codec.decodeSync(text);

  profile.username  = d.profile.username || profile.username;
  profile.coins     = Math.max(profile.coins     || 0, d.profile.coins     || 0);
  profile.bestScore = Math.max(profile.bestScore || 0, d.profile.bestScore || 0);
  saveProfile();

  const localShop = store.loadShop();
  const owned = Array.from(new Set([...(localShop.owned || []), ...(d.shop.owned || [])]));
  store.saveShop({
    owned,
    equipped: d.shop.equipped || localShop.equipped || null,
    colour:   d.shop.colour   || localShop.colour   || 'cyan',
    themes:   Array.from(new Set([...(localShop.themes || []), ...(d.shop.themes || [])])),
    fx:       Array.from(new Set([...(localShop.fx || []),     ...(d.shop.fx || [])])),
  });

  // Scores: combine, dedupe on (name, score, date), keep the top 50.
  const seen = new Set();
  const merged = [...store.loadScores(), ...d.scores]
    .filter(x => {
      const k = x.name + '|' + x.score + '|' + x.date;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  store.saveScores(merged);

  // Per-level bests merge on the higher score per level. Unlike the
  // run log there is no cap, so nothing is dropped: syncing a second
  // device gives you the better record on every song across both.
  if (d.bests) {
    const bests = store.loadBests();
    Object.keys(d.bests).forEach(k => {
      const incoming = d.bests[k];
      if (!Array.isArray(incoming)) return;
      const mine = bests[k];
      if (!mine || incoming[0] > mine[0]) bests[k] = incoming;
    });
    store.saveBests(bests);
  }

  // Campaign progress merges: cleared levels union, XP takes the
  // higher value. Syncing a second device must never roll you back.
  if (d.progress) {
    progress.cleared = Object.assign({}, progress.cleared, d.progress.cleared || {});
    progress.xp      = Math.max(progress.xp || 0, d.progress.xp || 0);
    if (d.progress.track && (d.progress.track.tier || 0) > trackTier()) {
      progress.track = d.progress.track;
    }
    saveProgress();
  }

  // Keep the longer streak; claiming twice in a day across two
  // devices shouldn't be possible either way.
  if (d.daily) {
    const local = store.loadDaily();
    if ((d.daily.streak || 0) > (local.streak || 0)) store.saveDaily(d.daily);
  }

  if (d.settings)    { Object.assign(currentSettings, d.settings); store.saveSettings(currentSettings); }
  if (d.customTheme) store.saveCustomTheme(d.customTheme);
  if (d.avatar)      store.saveCustomAv(d.avatar);
  if (d.theme)       { store.saveTheme(d.theme); applyTheme(d.theme); }

  let added = 0;
  if (d.levels && d.levels.length) {
    const local = store.load();
    const have  = new Set(local.map(l => l.name + '|' + (l.grid ? l.grid.length : 0)));
    d.levels.forEach(l => {
      const key = l.name + '|' + (l.grid ? l.grid.length : 0);
      if (have.has(key)) return;          // already got this one
      l.id = 'c' + Date.now() + Math.random().toString(36).slice(2, 6);
      local.push(l); added++;
    });
    store.save(local);
  }

  loadAndApplySettings();
  renderHome();
  return { levels: added, coins: profile.coins, name: profile.username };
}

function showToast(msg, isErr) {
  let t = document.getElementById('rd-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'rd-toast';
    document.body.appendChild(t);
  }
  t.className = isErr ? 'err' : '';
  t.innerHTML = '<div class="toast-led"></div>'
              + '<span></span>'
              + '<div class="toast-bar"></div>';
  t.querySelector('span').textContent = msg;

  // restart the countdown hairline
  const bar = t.querySelector('.toast-bar');
  bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';

  requestAnimationFrame(() => t.classList.add('show'));
  uiSound(isErr ? 'error' : 'ok');

  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    t.classList.add('hide');
    setTimeout(() => t.classList.remove('hide'), 300);
  }, 2400);
}

// ══════════════════════════════════════
//  UI SOUND
//  Synthesised through the existing audio engine — the
//  faceplate needs detents. No new assets.
// ══════════════════════════════════════
function uiSound(kind) {
  if (!window.RD_getContext) return;
  const c = window.RD_getContext && window.RD_getContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();

    const spec = {
      tick:     { f1:1400, f2:900,  vol:0.05, dur:0.035, type:'square'   },
      detent:   { f1:900,  f2:600,  vol:0.07, dur:0.045, type:'square'   },
      ok:       { f1:660,  f2:990,  vol:0.08, dur:0.09,  type:'triangle' },
      error:    { f1:320,  f2:190,  vol:0.10, dur:0.13,  type:'sawtooth' },
      purchase: { f1:523,  f2:1046, vol:0.11, dur:0.16,  type:'triangle' },
      thunk:    { f1:220,  f2:110,  vol:0.09, dur:0.10,  type:'sine'     },
    }[kind] || { f1:800, f2:600, vol:0.05, dur:0.04, type:'square' };

    o.type = spec.type;
    o.frequency.setValueAtTime(spec.f1, t);
    o.frequency.exponentialRampToValueAtTime(spec.f2, t + spec.dur);
    f.type = 'lowpass'; f.frequency.value = 5200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(spec.vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);

    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + spec.dur + 0.02);
  } catch (e) { /* UI sound is never load-bearing */ }
}

// ── Screen manager ───────────────────────────────
// Depth encodes hierarchy: home is shallowest, so moving to
// it is "back" and pulls forward; moving away pushes back.
const SCREEN_DEPTH = { 'username-screen':0, home:1, 'profile-screen':2, creator:2, game:2 };

const showScreen = id => {
  // The compact strip only makes sense on the scrolling home
  // screen; anywhere else it should start expanded.
  if (id !== 'home') document.body.classList.remove('compact');
  // The daily pill is docked to the popup, so it would otherwise
  // float over the board and the editor too.
  const dock = document.getElementById('daily-dock');
  if (dock) {
    if (id !== 'home') { dock.classList.remove('show'); document.body.classList.remove('daily-docked'); }
    else if (typeof renderDailyDock === 'function') renderDailyDock();
  }
  const next = document.getElementById(id);
  const cur  = document.querySelector('.screen.active');
  if (!next || cur === next) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (next) next.classList.add('active');
    return;
  }

  const back = cur && (SCREEN_DEPTH[id] ?? 1) < (SCREEN_DEPTH[cur.id] ?? 1);

  if (cur) {
    cur.classList.remove('active');
    cur.classList.toggle('back', back);
    cur.classList.add('leaving');
    const done = () => { cur.classList.remove('leaving','back'); };
    cur.addEventListener('animationend', done, { once:true });
    setTimeout(done, 220);   // guard if the animation never fires
  }

  document.querySelectorAll('.screen').forEach(x => {
    if (x !== cur) x.classList.remove('active');
  });
  next.classList.toggle('back', back);
  next.classList.add('active');
  setTimeout(() => next.classList.remove('back'), 220);
};

// ══════════════════════════════════════
//  THEMES
// ══════════════════════════════════════
// v5 saved a theme id that may no longer exist. Map it to the
// closest material rather than resetting anyone to default.
// Themes whose panel is light. Everything else is dark, and a
// custom theme is judged from its actual luminance.
const LIGHT_THEMES = ['bone'];

function themeIsLight(id) {
  const g = (typeof GEN_THEMES !== 'undefined')
    ? GEN_THEMES.find(t => t.id === id) : null;
  if (g) return isLight(g.def.bg);
  if (id === 'custom') {
    const t = store.loadCustomTheme();
    return !!(t && isLight(t.bg || '#171C24'));
  }
  return LIGHT_THEMES.includes(id);
}

const MIGRATE_THEME = {
  dark:'graphite', forest:'walnut', sunset:'amber',
  void:'mono',     neon:'vapor',
};

const THEMES = [
  { id:'graphite',  name:'Graphite',  subs:'Anodised metal',  mat:'metal',
    dots:['#22D3EE','#FB4F7D','#171C24'], ink:'#E6EAF2' },
  { id:'walnut',    name:'Walnut',    subs:'Oiled wood',      mat:'wood',
    dots:['#6FB3A0','#E0894A','#2A1B0E'], ink:'#F0E2CE' },
  { id:'bone',      name:'Bone',      subs:'Matte paper',     mat:'paper',
    dots:['#1E7A8C','#C2325C','#EDE8DE'], ink:'#232019' },
  { id:'amber',     name:'Amber Room',subs:'Polished brass',  mat:'metal',
    dots:['#E8B355','#D9762E','#1F1508'], ink:'#F6E6C4' },
  { id:'vapor',     name:'Vapor',     subs:'Frosted glass',   mat:'glass',
    dots:['#57E0E8','#F065C8','#1D1136'], ink:'#EFE4FF' },
  { id:'blueprint', name:'Blueprint', subs:'Drafting paper',  mat:'paper',
    dots:['#5BC8FF','#FF9E5B','#0B2440'], ink:'#D6ECFF' },
  { id:'mono',      name:'Mono',      subs:'Matte rubber',    mat:'rubber',
    dots:['#FFFFFF','#FF4757','#141414'], ink:'#F2F2F2' },
  { id:'custom',    name:'Custom',    subs:'Your build',      mat:'custom',
    dots:['#888','#888','#333'], ink:'#E6EAF2' },
];

// How each material handles light. This is the difference
// between brushed aluminium and oak — not just colour.
const MATERIALS = {
  metal:  { label:'Metal',  spec:1.0,  gloss:1.0,  bevel:1.0,  blur:0,
            grain:'none' },
  wood:   { label:'Wood',   spec:0.25, gloss:0.45, bevel:0.5,  blur:0,
            grain:'repeating-linear-gradient(94deg,rgba(0,0,0,.055) 0px,rgba(0,0,0,.055) 1px,rgba(255,255,255,.018) 2px,transparent 5px,transparent 11px)' },
  paper:  { label:'Paper',  spec:0.15, gloss:0.25, bevel:0.3,  blur:0,
            grain:'none' },
  glass:  { label:'Glass',  spec:1.5,  gloss:0.7,  bevel:0.45, blur:3,
            grain:'linear-gradient(135deg,rgba(255,255,255,.04),transparent 60%)' },
  rubber: { label:'Rubber', spec:0.1,  gloss:0.2,  bevel:0.4,  blur:0,
            grain:'none' },
};

function applyTheme(id) {
  // Migrate anyone still on a v5 theme id to its nearest material.
  id = MIGRATE_THEME[id] || id;
  const gen = GEN_THEMES.find(t => t.id === id);
  if (id !== 'custom' && !gen) clearCustomTheme();
  // applyTheme replaces body.className outright, so any class that
  // isn't a theme has to be carried across explicitly.
  // 'daily-docked' belongs here too: it is what gives the prize track
  // clearance under the docked daily pill, and losing it on a theme
  // change left the pill sitting on top of the track.
  const keep = ['reduce-motion', 'lane-light', 'daily-docked']
    .concat(TEX_CLASSES, AREA_THEME_CLASSES, TRAIL_CLASSES)
    .filter(c => document.body.classList.contains(c));
  // Area palettes are all dark, so an active one wins over the
  // base theme's lightness while you're playing it.
  const inDarkArea = AREA_THEME_CLASSES.some(c => keep.includes(c));
  if (!inDarkArea && themeIsLight(id)) keep.push('light');
  // Generated themes have no CSS class — they are derived at
  // runtime from four colours, the same path custom themes use.
  document.body.className = [(id === 'graphite' || gen) ? '' : 'theme-' + id, ...keep]
    .filter(Boolean).join(' ');
  if (gen) {
    applyCustomTheme(gen.def);
    if (!AREA_THEME_CLASSES.some(c => keep.includes(c))) {
      document.body.classList.toggle('light', isLight(gen.def.bg));
    }
  }
  if (id === 'custom') applyCustomTheme(store.loadCustomTheme());
  store.saveTheme(id);
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.theme === id);
  });
}

// ══════════════════════════════════════
//  CUSTOM THEME
//  The old editor took five raw colours with no preview and
//  let you build something unreadable. Now you pick a
//  material (which sets the whole panel ramp) plus two LED
//  hues, and every other shade is derived from those.
// ══════════════════════════════════════

const DEFAULT_CUSTOM = {
  mat:'metal', bg:'#171C24', text:'#E6EAF2',
  tap:'#22D3EE', dtap:'#FB4F7D',
  bevel:100, glow:100, tilt:100,
};

// ── Colour maths ──────────────────────
function hexToRgb(h) {
  h = h.replace('#','');
  if (h.length === 3) h = h.split('').map(c => c+c).join('');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgbToHex(r,g,b) {
  const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  return '#' + c(r) + c(g) + c(b);
}
function hexToRgba(hex, a) {
  const [r,g,b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
// Lighten (amt > 0) or darken (amt < 0) toward white/black.
function shade(hex, amt) {
  const [r,g,b] = hexToRgb(hex);
  const t = amt > 0 ? 255 : 0, p = Math.abs(amt);
  return rgbToHex(r+(t-r)*p, g+(t-g)*p, b+(t-b)*p);
}
// WCAG relative luminance + contrast ratio.
function luminance(hex) {
  const [r,g,b] = hexToRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function contrastRatio(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
  return (hi + 0.05) / (lo + 0.05);
}
function isLight(hex) { return luminance(hex) > 0.4; }

// ── Derive a full token set from the four inputs ──
// This is what stops anyone building an unreadable theme:
// the ramp is computed, not hand-picked.
function deriveTheme(t) {
  const light = isLight(t.bg);
  const d = light ? -1 : 1;   // direction to push raised surfaces

  const panelDeep   = shade(t.bg, -0.22 * d);
  const panel       = t.bg;
  const panelRaised = shade(t.bg,  0.16 * d);
  const bevelLit    = shade(t.bg,  0.45 * d);
  const bevelShade  = shade(t.bg, -0.55 * d);

  return {
    light,
    'panel-deep':   panelDeep,
    'panel':        panel,
    'panel-raised': panelRaised,
    'bevel-lit':    bevelLit,
    'bevel-shade':  bevelShade,
    'bg':   panelDeep, 'bg2': panel, 'bg3': panelRaised, 'bg4': shade(t.bg, 0.26*d),
    'border':  shade(t.bg, 0.10*d),
    'border2': bevelLit,
    'text':    t.text,
    'muted':   light ? shade(t.text, 0.42) : shade(t.text, -0.42),
    'dim':     light ? shade(t.text, 0.68) : shade(t.text, -0.68),
    'tap':     t.tap,
    'tap2':    shade(t.tap,  0.28),
    'dtap':    t.dtap,
    'dtap2':   shade(t.dtap, 0.28),
    'accent':  t.dtap,
    'lane-flash': shade(t.tap, light ? 0.55 : -0.45),
  };
}

function applyCustomTheme(t) {
  if (!t) return;
  t = Object.assign({}, DEFAULT_CUSTOM, t);
  const r = document.documentElement.style;
  const D = deriveTheme(t);

  Object.keys(D).forEach(k => {
    if (k === 'light') return;
    r.setProperty('--' + k, D[k]);
  });
  r.setProperty('--glow-tap',  hexToRgba(t.tap,  0.42));
  r.setProperty('--glow-dtap', hexToRgba(t.dtap, 0.42));

  // Material behaviour
  const m = MATERIALS[t.mat] || MATERIALS.metal;
  const bevelMult = (t.bevel ?? 100) / 100;
  r.setProperty('--mat-spec',  String(m.spec  * ((t.glow ?? 100) / 100)));
  r.setProperty('--mat-gloss', String(m.gloss * bevelMult));
  r.setProperty('--mat-bevel', String(m.bevel * bevelMult));
  r.setProperty('--mat-grain', m.grain);
  r.setProperty('--mat-blur',  m.blur + 'px');
  r.setProperty('--fx-glow-mult', String((t.glow ?? 100) / 100));
  r.setProperty('--fx-tilt-mult', String((t.tilt ?? 100) / 100));
}

// Clear the inline overrides so a preset theme's CSS class wins.
function clearCustomTheme() {
  const r = document.documentElement.style;
  ['panel-deep','panel','panel-raised','bevel-lit','bevel-shade',
   'bg','bg2','bg3','bg4','border','border2','text','muted','dim',
   'tap','tap2','dtap','dtap2','accent','lane-flash',
   'glow-tap','glow-dtap','mat-spec','mat-gloss','mat-bevel',
   'mat-grain','mat-blur','fx-glow-mult','fx-tilt-mult']
    .forEach(k => r.removeProperty('--' + k));
}

function buildThemesGrid() {
  const g = document.getElementById('themes-grid');
  g.innerHTML = '';
  const cur = store.loadTheme();
  THEMES.forEach(th => {
    const c = document.createElement('div');
    c.className = 'theme-card' + (th.id === cur ? ' selected' : '');
    c.dataset.theme = th.id;
    c.tabIndex = 0;
    c.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); c.click(); }
    });
    c.innerHTML = `
      <div class="tc-name">${th.name}</div>
      <div class="tc-subs">${th.subs}</div>
      <div class="tc-dots">
        <div class="tc-dot" style="background:${th.dots[0]}"></div>
        <div class="tc-dot" style="background:${th.dots[1]}"></div>
        <div class="tc-dot" style="background:${th.dots[2]}"></div>
      </div>`;
    c.style.color = th.ink || 'var(--text)';
    // Locked themes show their price and can be bought in place.
    const meta = SHOP_THEMES.find(x => x.id === th.id);
    const owned = !meta || themeOwned(th.id);
    if (!owned) {
      c.classList.add('locked');
      const tag = document.createElement('div');
      tag.className = 'theme-price';
      tag.textContent = meta.price + ' coins';
      c.appendChild(tag);
    }

    c.addEventListener('click', () => {
      if (!owned) {
        if (!buyTheme(meta)) return;
        buildThemesGrid();
      }
      applyTheme(th.id);
      const form = document.getElementById('custom-theme-form');
      form.classList.toggle('show', th.id === 'custom');
      if (th.id === 'custom') { syncCtInputs(); applyCustomTheme(ctDraft); }
    });
    g.appendChild(c);
  });
}

// ══════════════════════════════════════
//  CUSTOM THEME EDITOR UI
// ══════════════════════════════════════
let ctDraft = Object.assign({}, DEFAULT_CUSTOM, store.loadCustomTheme() || {});

function ctEls() {
  return {
    bg:    document.getElementById('ct-bg'),
    text:  document.getElementById('ct-text'),
    tap:   document.getElementById('ct-tap'),
    dtap:  document.getElementById('ct-dtap'),
    bevel: document.getElementById('ct-bevel'),
    glow:  document.getElementById('ct-glow'),
    tilt:  document.getElementById('ct-tilt'),
  };
}

function buildMaterialChips() {
  const wrap = document.getElementById('ct-mats');
  if (!wrap) return;
  wrap.innerHTML = '';
  Object.keys(MATERIALS).forEach(key => {
    const b = document.createElement('div');
    b.className = 'ct-mat' + (ctDraft.mat === key ? ' on' : '');
    b.textContent = MATERIALS[key].label;
    b.addEventListener('click', () => {
      ctDraft.mat = key;
      buildMaterialChips();
      updateCtPreview();
    });
    wrap.appendChild(b);
  });
}

// Paint the preview from the draft without touching the live app,
// so you can see a theme before committing to it.
function updateCtPreview() {
  const box = document.getElementById('ct-preview');
  if (!box) return;
  const D = deriveTheme(ctDraft);
  const set = (k, v) => box.style.setProperty(k, v);
  set('--ctp-panel-deep', D['panel-deep']);
  set('--ctp-panel',      D['panel']);
  set('--ctp-raised',     D['panel-raised']);
  set('--ctp-bevel',      D['bevel-lit']);
  set('--ctp-border',     D['border']);
  set('--ctp-text',       D['text']);
  set('--ctp-muted',      D['muted']);
  set('--ctp-tap',        D['tap']);
  set('--ctp-dtap',       D['dtap']);

  // Contrast check — says so honestly, never blocks.
  const el = document.getElementById('ct-contrast');
  if (el) {
    const ratio = contrastRatio(ctDraft.text, ctDraft.bg);
    el.classList.add('show');
    if (ratio >= 4.5) {
      el.className = 'ct-contrast show ok';
      el.textContent = 'Text contrast ' + ratio.toFixed(1) + ':1 — readable.';
    } else {
      const fixed = isLight(ctDraft.bg) ? '#1A1A1A' : '#F0F0F0';
      el.className = 'ct-contrast show warn';
      el.innerHTML = 'Text contrast ' + ratio.toFixed(1) +
        ':1 — below 4.5:1 and likely hard to read. ' +
        '<u style="cursor:pointer" id="ct-fix">Use ' + fixed + '</u>';
      const fix = document.getElementById('ct-fix');
      if (fix) fix.addEventListener('click', () => {
        ctDraft.text = fixed;
        ctEls().text.value = fixed;
        updateCtPreview();
      });
    }
  }
}

function syncCtInputs() {
  const e = ctEls();
  if (!e.bg) return;
  e.bg.value    = ctDraft.bg;
  e.text.value  = ctDraft.text;
  e.tap.value   = ctDraft.tap;
  e.dtap.value  = ctDraft.dtap;
  e.bevel.value = ctDraft.bevel ?? 100;
  e.glow.value  = ctDraft.glow  ?? 100;
  e.tilt.value  = ctDraft.tilt  ?? 100;
  ['bevel','glow','tilt'].forEach(k => {
    const v = document.getElementById('ct-' + k + '-v');
    if (v) v.textContent = (ctDraft[k] ?? 100) + '%';
  });
  buildMaterialChips();
  updateCtPreview();
}

(function wireCustomEditor() {
  const e = ctEls();
  if (!e.bg) return;

  ['bg','text','tap','dtap'].forEach(k => {
    e[k].addEventListener('input', () => { ctDraft[k] = e[k].value; updateCtPreview(); });
  });
  ['bevel','glow','tilt'].forEach(k => {
    e[k].addEventListener('input', () => {
      ctDraft[k] = parseInt(e[k].value, 10);
      const v = document.getElementById('ct-' + k + '-v');
      if (v) v.textContent = ctDraft[k] + '%';
      updateCtPreview();
    });
  });

  document.getElementById('ct-apply').addEventListener('click', () => {
    store.saveCustomTheme(ctDraft);
    applyTheme('custom');           // re-evaluates light vs dark
    applyCustomTheme(ctDraft);
    buildThemesGrid();
    showToast('Custom theme applied');
  });

  // Reuses the level export mechanism — same encoding, same UX.
  document.getElementById('ct-export').addEventListener('click', () => {
    const code = 'RDTHEME:' + btoa(JSON.stringify(ctDraft));
    copyText(code, 'Theme code copied', 'Copy this theme code:');
  });

  document.getElementById('ct-import').addEventListener('click', () => {
    const raw = prompt('Paste a theme code:');
    if (!raw) return;
    try {
      const json = JSON.parse(atob(raw.replace(/^RDTHEME:/, '').trim()));
      ctDraft = Object.assign({}, DEFAULT_CUSTOM, json);
      syncCtInputs();
      showToast('Theme loaded — press Apply');
    } catch (err) {
      showToast('Invalid theme code', true);
    }
  });

  syncCtInputs();
})();

// ══════════════════════════════════════
//  HOME
// ══════════════════════════════════════
function renderHome() {
  buildThemesGrid();
  renderBuiltins();
  renderCustoms();
  buildSettingsPanel();
  renderShop();
  updateProfileBar();
}

// An empty state should invite the action, not just report absence.
function emptyState(title, body, actionLabel, onAction) {
  const d = document.createElement('div');
  d.className = 'empty-state';
  d.innerHTML =
    '<div class="es-icon"><svg viewBox="0 0 24 24">' +
    '<path d="M9 18V6l10-2v12" stroke-linecap="round"/>' +
    '<circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' +
    '</svg></div>' +
    '<div class="es-title"></div><div class="es-body"></div>';
  d.querySelector('.es-title').textContent = title;
  d.querySelector('.es-body').textContent  = body;
  if (actionLabel) {
    const b = document.createElement('button');
    b.className = 'es-action';
    b.textContent = actionLabel;
    b.addEventListener('click', onAction);
    d.appendChild(b);
  }
  return d;
}

// A 14px strip showing the shape of the chart, so levels are
// distinguishable before you play them.
function chartPreview(lvl) {
  const wrap = document.createElement('div');
  wrap.className = 'lc-chart';
  const rows = lvl.grid ? lvl.grid : null;
  const COLS = 28;

  if (rows && rows.length) {
    const step = Math.max(1, Math.floor(rows.length / COLS));
    for (let i = 0; i < rows.length && wrap.children.length < COLS; i += step) {
      let count = 0, hasD = false;
      for (let j = i; j < Math.min(i + step, rows.length); j++) {
        (rows[j] || []).forEach(c => {
          if (!c) return;
          count++;
          if ((typeof c === 'string' ? c : c.type) === 'dtap') hasD = true;
        });
      }
      const bar = document.createElement('i');
      bar.style.height = Math.max(2, Math.min(14, count * 4)) + 'px';
      if (hasD) bar.className = 'd';
      wrap.appendChild(bar);
    }
  } else if (lvl.notes) {
    const beats = lvl.beats || 32;
    const buckets = new Array(COLS).fill(0);
    const dbl = new Array(COLS).fill(false);
    lvl.notes.forEach(n => {
      const k = Math.min(COLS - 1, Math.floor((n.b / beats) * COLS));
      buckets[k]++; if (n.t === 'dtap') dbl[k] = true;
    });
    buckets.forEach((v, i) => {
      const bar = document.createElement('i');
      bar.style.height = Math.max(2, Math.min(14, v * 4)) + 'px';
      if (dbl[i]) bar.className = 'd';
      wrap.appendChild(bar);
    });
  }
  return wrap;
}

// ══════════════════════════════════════
//  CAMPAIGN BROWSER
//  Two views in one pane: the area list, and the level grid
//  for whichever area you opened.
// ══════════════════════════════════════
// One continuous page: every theme in order, each showing its
// own levels. No drill-down — the shape of the campaign should
// be visible by scrolling.
// Which era is open. 'endless' is the eleventh tab.
let camTab = null;

// Default to where the player actually is: the last area they can
// play, not area 1 forever.
function furthestUnlockedArea() {
  const areas = CAM().AREAS;
  for (let i = areas.length - 1; i >= 0; i--) if (areaUnlocked(areas[i].id)) return areas[i].id;
  return 1;
}

function renderAreaTabs() {
  const host = document.getElementById('cam-areas');
  if (!host) return;
  host.innerHTML = '';

  const mk = (label, sub, opts) => {
    const t = document.createElement('div');
    t.className = 'cam-tab' + (opts.active ? ' active' : '')
                + (opts.locked ? ' locked' : '') + (opts.done ? ' done' : '');
    t.tabIndex = 0;
    t.innerHTML = '<div class="cam-tab-name"></div><div class="cam-tab-sub"></div>';
    t.querySelector('.cam-tab-name').textContent = label;
    t.querySelector('.cam-tab-sub').textContent = sub;
    const go = () => { camTab = opts.key; renderBuiltins(); };
    t.addEventListener('click', go);
    t.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    host.appendChild(t);
    return t;
  };

  let activeEl = null;
  CAM().AREAS.forEach(area => {
    const done     = areaProgress(area.id);
    const total    = CAM().LEVELS_PER_AREA;
    const unlocked = areaUnlocked(area.id);
    const el = mk(area.name, unlocked ? done + '/' + total : 'Locked', {
      key: area.id,
      active: camTab === area.id,
      locked: !unlocked,
      done: done === total,
    });
    if (camTab === area.id) activeEl = el;
  });

  const allDone = CAM().AREAS.every(a => areaCleared(a.id));
  const el = mk('Endless', allDone ? 'Open' : 'Locked', {
    key: 'endless', active: camTab === 'endless', locked: !allDone,
  });
  if (camTab === 'endless') activeEl = el;

  // Keep the open era in view when the strip is scrolled.
  if (activeEl && activeEl.scrollIntoView) {
    activeEl.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

function renderBuiltins() {
  const pane = document.getElementById('cam-scroll');
  if (!pane) return;
  if (camTab === null) camTab = furthestUnlockedArea();

  // The code box lives above the tabs, so it stays reachable from
  // every era rather than being buried in one of them.
  const codeHost = document.getElementById('cam-code');
  if (codeHost && !codeHost.childElementCount) {
    const count = document.createElement('div');
    count.className = 'cam-count';
    codeHost.appendChild(count);
    renderCodeBox(codeHost);
  }
  const count = codeHost && codeHost.querySelector('.cam-count');
  if (count) {
    count.textContent = 'Campaign · ' + totalCleared() + ' of '
      + (CAM().AREAS.length * CAM().LEVELS_PER_AREA) + ' songs cleared';
  }

  renderAreaTabs();

  pane.innerHTML = '';
  if (camTab === 'endless') renderEndlessCard(pane);
  else {
    const area = CAM().areaById(camTab) || CAM().AREAS[0];
    pane.appendChild(buildThemeBlock(area));
  }

  renderDailyDock();
  renderPrizeTrack();
  renderXpStrip();
}

// Play a shared code.
function renderCodeBox(pane) {
  const box = document.createElement('div');
  box.innerHTML = `
    <div class="code-row">
      <input class="code-in" id="code-in" maxlength="12" placeholder="Play a level code…" spellcheck="false">
      <button class="code-go" id="code-go">Play</button>
    </div>
    <div class="code-hint">Difficulty, area, style, seed — e.g. <b>74BEBTO</b>. Same code, same song.</div>`;
  pane.appendChild(box);

  const go = () => {
    const v = box.querySelector('#code-in').value.trim();
    if (!v) return;
    try { launchLevel(CAM().buildCodeLevel(v)); }
    catch (e) { showToast('Not a valid level code', true); }
  };
  box.querySelector('#code-go').addEventListener('click', go);
  box.querySelector('#code-in').addEventListener('keydown', e => {
    if (e.key === 'Enter') go();
  });
}

// Endless, unlocked once the whole campaign is cleared.
// Endless gets the same treatment as a theme: its own block at
// the end of the campaign, locked behind the whole of it.
function renderEndlessCard(pane) {
  const allDone = CAM().AREAS.every(a => areaCleared(a.id));

  const block = document.createElement('div');
  block.className = 'theme-block endless-block' + (allDone ? '' : ' locked');

  const head = document.createElement('div');
  head.className = 'tb-head';
  head.innerHTML = `
    <div class="tb-emblem"><svg viewBox="0 0 24 24"><use href="#ic-infinity"/></svg></div>
    <div class="tb-info">
      <div class="tb-name">Endless</div>
      <div class="tb-blurb">Random era, random song, no ceiling</div>
    </div>
    <div class="tb-count">∞</div>`;
  block.appendChild(head);

  const body = document.createElement('div');
  body.className = 'tb-body';

  [['Casual', 1, 4], ['Standard', 4, 7], ['Punishing', 7, 9]].forEach(([name, lo, hi]) => {
    const row = document.createElement('div');
    row.className = 'lvl-row' + (allDone ? '' : ' locked');
    row.innerHTML = `
      <div class="lvl-no">∞</div>
      <div class="lvl-meta">
        <div class="lvl-song">${name}</div>
        <div class="lvl-facts">difficulty ${lo}–${hi} · new song every run</div>
      </div>
      <div class="diff-badge d${hi}">${hi}</div>
      <div class="lvl-tick"></div>`;
    if (allDone) {
      row.tabIndex = 0;
      const roll = () => launchLevel(CAM().buildCodeLevel(CAM().rollEndlessCode(lo, hi)));
      row.addEventListener('click', roll);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); roll(); }
      });
    }
    body.appendChild(row);
  });
  block.appendChild(body);

  if (!allDone) {
    const left = CAM().AREAS.filter(a => !areaCleared(a.id)).length;
    const veil = document.createElement('div');
    veil.className = 'tb-veil';
    veil.innerHTML = `
      <svg class="ic"><use href="#ic-lock"/></svg>
      <div class="tb-lock-title">Locked</div>
      <div class="tb-lock-sub"></div>`;
    veil.querySelector('.tb-lock-sub').textContent =
      'Finish the campaign to unlock Endless — ' + left + ' theme'
      + (left === 1 ? '' : 's') + ' to go.';
    block.appendChild(veil);
  }
  pane.appendChild(block);
}

// ── Campaign list cost control ────────────────
// Charts are deterministic, so a built level can be kept and handed
// back. The browser draws 150 rows and used to generate every chart
// to read a name and a duration off it — a quarter-second of blocked
// main thread on every repaint of the pane.
const campaignLevelCache = new Map();
function campaignLevel(areaId, idx, dbl) {
  const k = areaId + '-' + idx + (dbl ? 'd' : '');
  let l = campaignLevelCache.get(k);
  if (!l) {
    l = CAM().buildCampaignLevel(areaId, idx, { double: !!dbl });
    campaignLevelCache.set(k, l);
  }
  return l;
}

const whenIdle = window.requestIdleCallback
  ? fn => window.requestIdleCallback(fn, { timeout: 600 })
  : fn => setTimeout(() => fn({ timeRemaining: () => 0 }), 16);

// The note count is the one row fact that needs the actual chart, so
// it arrives after the list is on screen instead of holding it up.
let noteFillQueue = [];
let noteFillRunning = false;
function queueNoteCount(el, areaId, idx, dbl) {
  if (!el) return;
  noteFillQueue.push([el, areaId, idx, dbl]);
  if (noteFillRunning) return;
  noteFillRunning = true;
  whenIdle(function drain(deadline) {
    while (noteFillQueue.length) {
      const [e, a, i, d] = noteFillQueue.shift();
      // A pane repaint detaches the old rows; skip those rather than
      // paying to generate a chart nobody is looking at.
      if (e.isConnected) {
        e.textContent += ' · ' + CAM().countNotes(campaignLevel(a, i, d)) + ' notes';
      }
      if (!deadline.timeRemaining || deadline.timeRemaining() <= 1) break;
    }
    if (noteFillQueue.length) whenIdle(drain);
    else noteFillRunning = false;
  });
}

function buildThemeBlock(area) {
  const unlocked = areaUnlocked(area.id);
  const done     = areaProgress(area.id);
  const complete = done === CAM().LEVELS_PER_AREA;

  const block = document.createElement('div');
  block.className = 'theme-block'
    + (unlocked ? '' : ' locked')
    + (complete ? ' done' : '');

  const emblem = 'emblem-' + area.key;
  const hasEmblem = !!document.getElementById(emblem);

  const head = document.createElement('div');
  head.className = 'tb-head';
  head.innerHTML = `
    <div class="tb-emblem">${hasEmblem
      ? '<svg viewBox="0 0 64 64"><use href="#' + emblem + '"/></svg>'
      : '<span style="font-family:var(--font-data);font-size:12px;color:var(--muted)">' + area.id + '</span>'}</div>
    <div class="tb-info"><div class="tb-name"></div><div class="tb-blurb"></div></div>
    <div class="tb-count">${done}/${CAM().LEVELS_PER_AREA}</div>`;
  head.querySelector('.tb-name').textContent  = area.name;
  head.querySelector('.tb-blurb').textContent = area.blurb;
  block.appendChild(head);

  const body = document.createElement('div');
  body.className = 'tb-body';

  // Read the bests once for the whole era rather than per row.
  const areaBests = store.loadBests();

  for (let i = 0; i < CAM().LEVELS_PER_AREA; i++) {
    // Title, tempo and duration come from the plan, which costs
    // nothing; the chart itself is only built when the row is played.
    const lvl      = CAM().campaignLevelMeta(area.id, i);
    const cleared  = isCleared(area.id, i);
    const playable = unlocked && isUnlocked(area.id, i);
    const isNext   = playable && !cleared;

    const sec = lvl.seconds;
    const dur = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');

    const row = document.createElement('div');
    row.className = 'lvl-row'
      + (playable ? '' : ' locked')
      + (isNext ? ' current' : '');
    row.innerHTML = `
      <div class="lvl-no">${i + 1}</div>
      <div class="lvl-meta">
        <div class="lvl-song"></div>
        <div class="lvl-facts">${dur} · ${lvl.bpm} BPM</div>
      </div>
      <div class="diff-badge d${lvl.difficulty}" title="Difficulty ${lvl.difficulty} of 9">${lvl.difficulty}</div>
      <div class="lvl-tick${!playable && !cleared ? ' is-lock' : ''}">${
        cleared  ? '<svg class="ic"><use href="#ic-check"/></svg>'
      : !playable ? '<svg class="ic"><use href="#ic-lock"/></svg>'
      : ''}</div>`;
    row.querySelector('.lvl-song').textContent = lvl.name;
    // Your record on this song, kept for every song rather than only
    // the fifty best runs overall.
    const rec = bestFor(lvl, areaBests);
    if (rec) {
      const b = document.createElement('div');
      b.className = 'lvl-best';
      b.innerHTML = '<svg class="ic"><use href="#ic-trophy"/></svg><span>'
        + rec.score.toLocaleString() + '</span>';
      b.title = 'Your best on this song';
      row.querySelector('.lvl-meta').appendChild(b);
    }
    queueNoteCount(row.querySelector('.lvl-facts'), area.id, i, false);

    if (playable) {
      row.tabIndex = 0;
      row.title = lvl.name + ' — ' + dur + ' — difficulty ' + lvl.difficulty;
      const play = () => launchLevel(campaignLevel(area.id, i));
      row.addEventListener('click', play);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
      });
    }
    body.appendChild(row);

    // The Double is no longer a second level in the list. It is the
    // same song at double speed, offered on the results card every
    // time you finish this one — see endGame().
  }
  block.appendChild(body);

  // Locked themes keep their content visible but unreachable.
  if (!unlocked) {
    const prev = CAM().areaById(area.id - 1);
    const veil = document.createElement('div');
    veil.className = 'tb-veil';
    veil.innerHTML = `
      <svg class="ic"><use href="#ic-lock"/></svg>
      <div class="tb-lock-title">Locked</div>
      <div class="tb-lock-sub"></div>`;
    veil.querySelector('.tb-lock-sub').textContent =
      'Finish all ' + CAM().LEVELS_PER_AREA + ' songs in ' + (prev ? prev.name : 'the previous theme')
      + ' to unlock ' + area.name + '.';
    block.appendChild(veil);
  }
  return block;
}

// ── Daily reward card ──
// The daily used to be a full card at the top of the campaign list,
// which cost a block of vertical space all day for something you
// interact with once. Now it is a pill docked to the bottom of the
// popup that exists only while a reward is actually waiting, and is
// dismissable if it is in the way.
let dailyDismissed = false;

function renderDailyDock() {
  const dock = document.getElementById('daily-dock');
  const slot = document.getElementById('daily-slot');
  if (!dock || !slot) return;

  const st = dailyState();
  slot.innerHTML = '';

  // Nothing to claim, or waved away for this session: no dock at all.
  if (!st.available || dailyDismissed) {
    dock.classList.remove('show');
    document.body.classList.remove('daily-docked');
    return;
  }

  const dayNum = (st.streak % 7) + 1;
  const pill = document.createElement('div');
  pill.className = 'daily-pill';
  pill.tabIndex = 0;
  pill.innerHTML = `
    <div class="daily-pill-badge"><svg class="ic"><use href="#ic-gift"/></svg></div>
    <div>
      <div class="daily-pill-text"></div>
      <div class="daily-pill-sub"></div>
    </div>
    <button class="daily-pill-x" title="Hide until next time">×</button>`;
  pill.querySelector('.daily-pill-text').textContent = 'Claim day ' + dayNum;
  pill.querySelector('.daily-pill-sub').textContent =
    st.next.label + (st.broken ? ' · streak reset' : '');

  const claim = () => {
    const r = claimDaily();
    if (!r) return;
    if (st.next.kind === 'box') showBox(st.next.rarity, r.msg);
    else { uiSound('purchase'); showToast(r.msg); }
    updateProfileBar();
    renderBuiltins();
  };
  pill.addEventListener('click', e => {
    if (e.target.closest('.daily-pill-x')) {
      dailyDismissed = true;
      renderDailyDock();
      return;
    }
    claim();
  });
  pill.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); claim(); }
  });

  slot.appendChild(pill);
  dock.classList.add('show');
  document.body.classList.add('daily-docked');
}

// Box opening: shake, then reveal. The result is already decided
// by the time this runs — the animation is presentation, not a
// second roll.
function showBox(rarity, message) {
  const modal  = document.getElementById('box-modal');
  const crate  = document.getElementById('box-crate');
  const reveal = document.getElementById('box-reveal');
  const art    = document.getElementById('box-art');
  const msg    = document.getElementById('box-msg');
  if (!modal) { showToast(message); return; }

  reveal.classList.remove('show');
  crate.style.display = 'block';
  modal.classList.add('show');
  uiSound('detent');

  const reduced = window.RD_Lighting && window.RD_Lighting.isReducedMotion();
  setTimeout(() => {
    crate.style.display = 'none';
    msg.textContent = message;

    // Show the item if one was won, otherwise just the message.
    art.innerHTML = '';
    const m = /Unlocked (.+)!/.exec(message);
    const won = m && SHOP_AVATARS.find(a => a.name === m[1]);
    if (won) renderAvatarInto(art, won.id, store.loadShop().colour);

    reveal.classList.add('show');
    uiSound('purchase');
  }, reduced ? 0 : 1000);
}

(function wireBox() {
  const close = document.getElementById('box-close');
  if (close) close.addEventListener('click', () => {
    document.getElementById('box-modal').classList.remove('show');
    updateProfileBar();
    renderBuiltins();
    renderShop();
  });
})();

// ══════════════════════════════════════
//  COMPACT HEADER
//  Collapses the hero and shrinks the strip once a pane is
//  scrolled, giving long lists most of the window back.
// ══════════════════════════════════════
(function wireCompactHeader() {
  const THRESH = 34;   // px of scroll before collapsing
  const RELEASE = 12;  // hysteresis, so it can't flicker on a wobble

  function attach(pane) {
    pane.addEventListener('scroll', () => {
      const y = pane.scrollTop;
      const on = document.body.classList.contains('compact');
      if (!on && y > THRESH) document.body.classList.add('compact');
      else if (on && y < RELEASE) document.body.classList.remove('compact');
    }, { passive:true });
  }

  document.querySelectorAll('.tab-pane, .cam-scroll').forEach(attach);
  const cam = document.getElementById('cam-scroll');
  if (cam) attach(cam);
})();

function renderCompactStrip() {
  const p = CAM().levelProgress(progress.xp);
  const lv = document.getElementById('pc-lv');
  const fl = document.getElementById('pc-xp-fill');
  const co = document.getElementById('pc-coins');
  if (lv) lv.textContent = p.level;
  if (fl) fl.style.width = (p.pct * 100).toFixed(1) + '%';
  if (co) co.textContent = (profile.coins || 0).toLocaleString();
}

// ── XP strip ──
function renderXpStrip() {
  renderCompactStrip();
  const p = CAM().levelProgress(progress.xp);
  const lv = document.getElementById('xp-lv');
  const fl = document.getElementById('xp-fill');
  const nm = document.getElementById('xp-num');
  if (lv) lv.textContent = p.level;
  if (fl) fl.style.width = (p.pct * 100).toFixed(1) + '%';
  if (nm) nm.textContent = p.into + '/' + p.need;
}

// ── Prize track ──
function renderPrizeTrack() {
  const host = document.getElementById('prize-track');
  if (!host) return;

  const prizes  = trackPrizes();
  const have    = trackProgress();
  const claimed = progress.track.claimed || [];
  const max     = prizes[prizes.length - 1].need;

  host.innerHTML = `
    <div class="pt-head">
      <span class="pt-title">Prize Track · Tier ${trackTier() + 1}</span>
      <span class="pt-count">${Math.min(have, max)}/${max} levels</span>
    </div>
    <div class="pt-rail">
      <div class="pt-line"><div class="pt-line-fill" style="width:${Math.min(1, have / max) * 100}%"></div></div>
    </div>`;

  const rail = host.querySelector('.pt-rail');
  prizes.forEach(pz => {
    const isClaimed = claimed.includes(pz.id);
    const ready     = !isClaimed && have >= pz.need;

    const node = document.createElement('div');
    node.className = 'pt-node' + (isClaimed ? ' claimed' : ready ? ' ready' : '');
    node.innerHTML = `
      <div class="pt-dot"><svg class="ic"><use href="#ic-${
        isClaimed ? 'check' : pz.kind === 'avatar' ? 'trophy' : 'coin'}"/></svg></div>
      <div class="pt-label">${isClaimed ? 'Claimed'
        : pz.kind === 'avatar' ? 'Avatar' : pz.amount + ' coins'}<br>${pz.need} lvls</div>`;

    if (ready) {
      node.tabIndex = 0;
      const claim = () => {
        const msg = claimPrize(pz);
        if (msg) { uiSound('purchase'); showToast(msg); renderBuiltins(); updateProfileBar(); }
      };
      node.addEventListener('click', claim);
      node.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); claim(); }
      });
    }
    rail.appendChild(node);
  });
}

function renderCustoms() {
  ensureImportBtn();
  const list = document.getElementById('custom-list');
  list.innerHTML = '';
  const customs = store.load();
  const allBests = store.loadBests();

  if (!customs.length) {
    list.appendChild(emptyState(
      'No custom levels yet',
      'Build your own chart — pick a tempo, place notes on the grid, and set the sound for each one.',
      'Create a level',
      () => openCreator(null)
    ));
  }
  customs.forEach((lvl, i) => {
    // Keyed on the level itself, not its name: two customs can share a
    // name, and the top-50 log dropped older records entirely.
    const best = bestFor(lvl, allBests);

    const c = document.createElement('div');
    c.className = 'level-card';
    c.innerHTML = `
      <div class="lc-info" style="cursor:pointer">
        <div class="lc-name">${lvl.name||'untitled'}</div>
        <div class="lc-meta mono">${lvl.bpm} BPM · ${lvl.grid.length} beats${lvl.bgMode&&lvl.bgMode!=='none'?' · '+lvl.bgMode:''}</div>
        ${best
          ? `<div class="lc-hs"><span class="lc-hs-icon"><svg class="ic"><use href="#ic-trophy"/></svg></span><span class="lc-hs-score">${best.score.toLocaleString()}</span><span class="lc-hs-name">your best</span></div>`
          : `<div class="lc-hs lc-hs-none">No score yet</div>`
        }
      </div>
      <div class="card-actions">
        <button class="ic-btn xb" title="Export" aria-label="Export"><svg class="ic"><use href="#ic-export"/></svg></button>
        <button class="ic-btn eb" title="Edit" aria-label="Edit"><svg class="ic"><use href="#ic-edit"/></svg></button>
        <button class="ic-btn del db" title="Delete" aria-label="Delete"><svg class="ic"><use href="#ic-delete"/></svg></button>
        <div class="lc-badge b-custom">custom</div>
      </div>`;
    c.querySelector('.lc-info').appendChild(chartPreview(lvl));
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
document.querySelectorAll('.hnav').forEach(t => {
  t.tabIndex = 0;
  t.setAttribute('role','tab');
  t.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); t.click(); }
  });
});
document.querySelectorAll('.hnav').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.hnav').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  uiSound('detent');
  if (t.dataset.tab === 'shop') renderShop();
}));

// ── Shop render ─────────────────────────────
function renderShop() {
  const grid = document.getElementById('shop-avatar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const shop = store.loadShop();

  renderCosmetics();

  // Colourway applies to whichever avatar is equipped, so it
  // belongs above the grid rather than on each card.
  const cwHost = document.getElementById('shop-colourways');
  if (cwHost) {
    buildColourwayRow(cwHost, shop.colour, id => {
      const sh = store.loadShop();
      sh.colour = id;
      store.saveShop(sh);
      updateProfileBar();
      renderShop();
      uiSound('detent');
    });
  }

  SHOP_AVATARS.forEach(av => {
    const card = document.createElement('div');
    const owned    = shop.owned.includes(av.id);
    const equipped = shop.equipped === av.id;
    card.className = 'avatar-card' + (equipped ? ' equipped' : owned ? ' owned' : '');
    card.tabIndex = 0;
    card.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); card.click(); }
    });

    card.innerHTML = `
      <div class="avatar-thumb"></div>
      <div class="avatar-name">${av.name}</div>
      <div class="avatar-price">${owned ? 'Owned' : av.price + ' coins'}</div>
      ${equipped ? '<div class="avatar-badge av-badge-eq">Equipped</div>' : owned ? '<div class="avatar-badge av-badge-owned">Owned</div>' : ''}
    `;
    // Locked avatars preview in grey so the artwork still reads.
    renderAvatarInto(card.querySelector('.avatar-thumb'),
                     owned ? av.id : null, shop.colour);
    if (!owned) {
      const t = card.querySelector('.avatar-thumb .av');
      if (t) { t.style.setProperty('--av-p', 'var(--dim)'); t.style.setProperty('--av-s', 'var(--dim)'); }
      const u = card.querySelector('.avatar-thumb use');
      if (u) u.setAttribute('href', '#' + av.sym);
    }
    card.addEventListener('click', () => {
      if (equipped) return; // already on
      if (owned) {
        // Equip it
        shop.equipped = av.id;
        store.saveShop(shop);
        updateProfileBar();
        renderShop();
        showToast('Equipped ' + av.name + '!');
      } else {
        // Buy
        if (profile.coins < av.price) {
          showToast('Not enough coins — need ' + av.price, true); return;
        }
        profile.coins -= av.price;
        saveProfile();
        shop.owned.push(av.id);
        shop.equipped = av.id;
        store.saveShop(shop);
        updateProfileBar();
        renderShop();
        uiSound('purchase');
        showToast('Bought & equipped ' + av.name + '!');
      }
    });
    grid.appendChild(card);
  });
}

// ══════════════════════════════════════
//  DAILY REWARDS
//  One claim per day on a seven-day cycle. Miss a day and the
//  streak resets to the start — the cycle is the reward for
//  turning up, so it has to actually lapse.
// ══════════════════════════════════════
const DAILY_CYCLE = [
  { day:1, kind:'coins', amount:150,  label:'150 coins' },
  { day:2, kind:'xp',    amount:120,  label:'120 XP' },
  { day:3, kind:'coins', amount:300,  label:'300 coins' },
  { day:4, kind:'box',   rarity:'common', label:'Common box' },
  { day:5, kind:'coins', amount:600,  label:'600 coins' },
  { day:6, kind:'xp',    amount:400,  label:'400 XP' },
  { day:7, kind:'box',   rarity:'rare',   label:'Rare box' },
];

// Local date, not UTC — "today" should mean the player's today.
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0');
}
function dayKeyOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0');
}

// Returns { available, streak, next } without mutating anything.
function dailyState() {
  const d = store.loadDaily();
  const today = todayKey();

  if (d.day === today) {
    return { available:false, streak:d.streak, next:DAILY_CYCLE[d.streak % 7] };
  }
  // A gap of more than one day breaks the run.
  const continued = d.day === dayKeyOffset(-1);
  const streak = continued ? d.streak : 0;
  return { available:true, streak, next:DAILY_CYCLE[streak % 7], broken:!continued && !!d.day };
}

function claimDaily() {
  const st = dailyState();
  if (!st.available) return null;

  const reward = st.next;
  let msg;

  if (reward.kind === 'coins') {
    addCoins(reward.amount);
    msg = '+' + reward.amount + ' coins';
  } else if (reward.kind === 'xp') {
    const r = grantXp(reward.amount);
    msg = '+' + reward.amount + ' XP' + (r.levelUp ? ' — level ' + r.level + '!' : '');
    renderXpStrip();
  } else {
    const drop = openBox(reward.rarity);
    msg = drop.message;
  }

  store.saveDaily({ day: todayKey(), streak: st.streak + 1 });
  return { msg, day: (st.streak % 7) + 1 };
}

// ══════════════════════════════════════
//  BOXES
//  Weighted pull from the cosmetic pool. A duplicate converts
//  to coins rather than being a dead pull — a box should never
//  be worth nothing.
// ══════════════════════════════════════
const BOX_TABLES = {
  common: [
    { pool:'trail',  weight:34 },
    { pool:'fx',     weight:34 },
    { pool:'avatar', weight:22, maxPrice:800 },
    { pool:'coins',  weight:10, amount:200 },
  ],
  rare: [
    { pool:'avatar', weight:58 },
    { pool:'trail',  weight:16 },
    { pool:'fx',     weight:16 },
    { pool:'coins',  weight:10, amount:800 },
  ],
};

function pickWeighted(rows) {
  const total = rows.reduce((n, r) => n + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of rows) { roll -= r.weight; if (roll <= 0) return r; }
  return rows[rows.length - 1];
}

function openBox(rarity) {
  const table = BOX_TABLES[rarity] || BOX_TABLES.common;
  const row   = pickWeighted(table);
  const shop  = store.loadShop();

  if (row.pool === 'coins') {
    addCoins(row.amount);
    return { kind:'coins', message:'+' + row.amount + ' coins' };
  }

  let candidates, ownedList, saveOwned;
  if (row.pool === 'avatar') {
    candidates = SHOP_AVATARS.filter(a => !row.maxPrice || a.price <= row.maxPrice);
    ownedList  = shop.owned || [];
    saveOwned  = id => { const sh = store.loadShop(); sh.owned = sh.owned || []; sh.owned.push(id); store.saveShop(sh); };
  } else if (row.pool === 'trail') {
    candidates = TRAILS.filter(t => t.price > 0);
    ownedList  = shop.fx || [];
    saveOwned  = id => { const sh = store.loadShop(); sh.fx = sh.fx || []; sh.fx.push(id); store.saveShop(sh); };
  } else {
    candidates = HIT_FX.filter(t => t.price > 0);
    ownedList  = shop.fx || [];
    saveOwned  = id => { const sh = store.loadShop(); sh.fx = sh.fx || []; sh.fx.push(id); store.saveShop(sh); };
  }

  if (!candidates.length) {
    addCoins(300);
    return { kind:'coins', message:'+300 coins' };
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  // Duplicate: convert at roughly a third of its price.
  if (ownedList.includes(pick.id)) {
    const value = Math.max(100, Math.round((pick.price || 300) / 3));
    addCoins(value);
    return { kind:'dupe', message:'Duplicate ' + pick.name + ' — +' + value + ' coins' };
  }

  saveOwned(pick.id);
  return { kind:row.pool, item:pick, message:'Unlocked ' + pick.name + '!' };
}

// ══════════════════════════════════════
//  SHOP THEMES
//  Distinct from area themes, which are earned by clearing the
//  area. These are bought, and priced against the rebalanced
//  economy rather than the old one.
// ══════════════════════════════════════
// Themes follow the same curve, keyed to the area they evoke.
const GEN_THEMES = [
  { id:'th_ember_metal', name:'Ember Metal', price:1200, def:{ mat:'metal', bg:'#221815', text:'#EEECEB', tap:'#E16546', dtap:'#5AE1B9' } },
  { id:'th_ember_wood', name:'Ember Wood', price:1460, def:{ mat:'wood', bg:'#221815', text:'#EEECEB', tap:'#E16546', dtap:'#5AE1B9' } },
  { id:'th_ember_paper', name:'Ember Paper', price:1720, def:{ mat:'paper', bg:'#221815', text:'#EEECEB', tap:'#E16546', dtap:'#5AE1B9' } },
  { id:'th_ember_glass', name:'Ember Glass', price:1980, def:{ mat:'glass', bg:'#EBE2DF', text:'#272120', tap:'#9D3419', dtap:'#1EAD82' } },
  { id:'th_ember_rubber', name:'Ember Rubber', price:2240, def:{ mat:'rubber', bg:'#221815', text:'#EEECEB', tap:'#E16546', dtap:'#5AE1B9' } },
  { id:'th_amber_metal', name:'Amber Metal', price:2500, def:{ mat:'metal', bg:'#221E15', text:'#EEEDEB', tap:'#E1AD46', dtap:'#5ACBE1' } },
  { id:'th_amber_wood', name:'Amber Wood', price:2760, def:{ mat:'wood', bg:'#221E15', text:'#EEEDEB', tap:'#E1AD46', dtap:'#5ACBE1' } },
  { id:'th_amber_paper', name:'Amber Paper', price:3020, def:{ mat:'paper', bg:'#221E15', text:'#EEEDEB', tap:'#E1AD46', dtap:'#5ACBE1' } },
  { id:'th_amber_glass', name:'Amber Glass', price:3280, def:{ mat:'glass', bg:'#221E15', text:'#EEEDEB', tap:'#E1AD46', dtap:'#5ACBE1' } },
  { id:'th_amber_rubber', name:'Amber Rubber', price:3540, def:{ mat:'rubber', bg:'#221E15', text:'#EEEDEB', tap:'#E1AD46', dtap:'#5ACBE1' } },
  { id:'th_citrine_metal', name:'Citrine Metal', price:3800, def:{ mat:'metal', bg:'#EBEADF', text:'#272620', tap:'#9D9519', dtap:'#1E6FAD' } },
  { id:'th_citrine_wood', name:'Citrine Wood', price:4060, def:{ mat:'wood', bg:'#222115', text:'#EEEEEB', tap:'#E1D646', dtap:'#5AA7E1' } },
  { id:'th_citrine_paper', name:'Citrine Paper', price:4320, def:{ mat:'paper', bg:'#222115', text:'#EEEEEB', tap:'#E1D646', dtap:'#5AA7E1' } },
  { id:'th_citrine_glass', name:'Citrine Glass', price:4580, def:{ mat:'glass', bg:'#222115', text:'#EEEEEB', tap:'#E1D646', dtap:'#5AA7E1' } },
  { id:'th_citrine_rubber', name:'Citrine Rubber', price:4840, def:{ mat:'rubber', bg:'#222115', text:'#EEEEEB', tap:'#E1D646', dtap:'#5AA7E1' } },
  { id:'th_verdant_metal', name:'Verdant Metal', price:5100, def:{ mat:'metal', bg:'#152218', text:'#EBEEEC', tap:'#46E165', dtap:'#B95AE1' } },
  { id:'th_verdant_wood', name:'Verdant Wood', price:5360, def:{ mat:'wood', bg:'#152218', text:'#EBEEEC', tap:'#46E165', dtap:'#B95AE1' } },
  { id:'th_verdant_paper', name:'Verdant Paper', price:5620, def:{ mat:'paper', bg:'#DFEBE2', text:'#202721', tap:'#199D34', dtap:'#821EAD' } },
  { id:'th_verdant_glass', name:'Verdant Glass', price:5880, def:{ mat:'glass', bg:'#152218', text:'#EBEEEC', tap:'#46E165', dtap:'#B95AE1' } },
  { id:'th_verdant_rubber', name:'Verdant Rubber', price:6140, def:{ mat:'rubber', bg:'#152218', text:'#EBEEEC', tap:'#46E165', dtap:'#B95AE1' } },
  { id:'th_jade_metal', name:'Jade Metal', price:6400, def:{ mat:'metal', bg:'#15221E', text:'#EBEEED', tap:'#46E1B2', dtap:'#E15AC6' } },
  { id:'th_jade_wood', name:'Jade Wood', price:6660, def:{ mat:'wood', bg:'#15221E', text:'#EBEEED', tap:'#46E1B2', dtap:'#E15AC6' } },
  { id:'th_jade_paper', name:'Jade Paper', price:6920, def:{ mat:'paper', bg:'#15221E', text:'#EBEEED', tap:'#46E1B2', dtap:'#E15AC6' } },
  { id:'th_jade_glass', name:'Jade Glass', price:7180, def:{ mat:'glass', bg:'#15221E', text:'#EBEEED', tap:'#46E1B2', dtap:'#E15AC6' } },
  { id:'th_jade_rubber', name:'Jade Rubber', price:7440, def:{ mat:'rubber', bg:'#DFEBE7', text:'#202725', tap:'#199D76', dtap:'#AD1E90' } }
];

const SHOP_THEMES = [
  { id:'graphite',  name:'Graphite',    price:0    },
  { id:'walnut',    name:'Walnut',      price:900,  area:1  },
  { id:'blueprint', name:'Blueprint',   price:1200, area:3  },
  { id:'amber',     name:'Amber Room',  price:2000, area:4  },
  { id:'mono',      name:'Mono',        price:3200, area:8  },
  { id:'bone',      name:'Bone',        price:3600, area:9  },
  { id:'vapor',     name:'Vapor',       price:4500, area:10 },
].concat(GEN_THEMES);

function themeOwned(id) {
  if (id === 'graphite' || id === 'custom') return true;
  const shop = store.loadShop();
  // Clearing the matching area also grants its shop theme, so
  // playing the campaign unlocks looks rather than only coins.
  const byArea = { walnut:1, amber:4, vapor:10, bone:9, blueprint:3, mono:8 };
  if (byArea[id] && areaCleared(byArea[id])) return true;
  return (shop.themes || []).includes(id);
}

function buyTheme(t) {
  if (profile.coins < t.price) {
    showToast('Not enough coins — need ' + t.price, true);
    return false;
  }
  profile.coins -= t.price;
  saveProfile();
  const shop = store.loadShop();
  shop.themes = shop.themes || [];
  shop.themes.push(t.id);
  store.saveShop(shop);
  uiSound('purchase');
  showToast('Unlocked ' + t.name);
  updateProfileBar();
  return true;
}

// ── Trails & hit effects in the shop ──────
// Owned cosmetics live in the same shop record as avatars, so
// they sync with everything else for free.
function renderCosmetics() {
  const shop = store.loadShop();
  shop.fx = shop.fx || [];

  const build = (hostId, list, settingKey, applyFn) => {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';
    list.forEach(item => {
      const owned = item.price === 0 || shop.fx.includes(item.id);
      const on    = (currentSettings[settingKey] || list[0].id) === item.id;

      const c = document.createElement('div');
      c.className = 'fx-card' + (on ? ' on' : '') + (owned ? '' : ' locked');
      c.tabIndex = 0;
      c.innerHTML = '<div class="fx-name"></div><div class="fx-cost"></div>';
      c.querySelector('.fx-name').textContent = item.name;
      c.querySelector('.fx-cost').textContent =
        on ? 'Equipped' : owned ? 'Owned' : item.price + ' coins';

      const pick = () => {
        if (on) return;
        if (!owned) {
          if (profile.coins < item.price) {
            showToast('Not enough coins — need ' + item.price, true); return;
          }
          profile.coins -= item.price;
          saveProfile();
          const sh = store.loadShop();
          sh.fx = sh.fx || [];
          sh.fx.push(item.id);
          store.saveShop(sh);
          uiSound('purchase');
          showToast('Unlocked ' + item.name);
        } else {
          uiSound('detent');
        }
        currentSettings[settingKey] = item.id;
        store.saveSettings(currentSettings);
        applyFn();
        updateProfileBar();
        renderCosmetics();
      };
      c.addEventListener('click', pick);
      c.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      host.appendChild(c);
    });
  };

  build('shop-trails', TRAILS,  'trail', applyTrailClass);
  build('shop-hitfx',  HIT_FX,  'hitFx', applyHitFxVars);
}

// ── Custom avatar upload ──────────────────
// One price, named once. The markup and one of the two labels used to
// say 1000 while the purchase actually charged 2500.
const CUSTOM_AV_PRICE = 2500;

// Avatars render at 40px at the very largest, but the uploaded file was
// stored at full resolution as a data URL. That sits in localStorage
// (which is a few MB in total) and rides along inside account sync
// codes, which are meant to be copy-pasteable. Downscale to a small
// square first: the avatar looks identical and the payload stops being
// a problem.
const CUSTOM_AV_SIZE = 128;

function downscaleToSquare(dataUrl, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        // Cover-crop, so a portrait photo isn't squashed into the circle.
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(c.toDataURL('image/png'));
      } catch (err) { reject(err); }
    };
    img.onerror = () => reject(new Error('not an image'));
    img.src = dataUrl;
  });
}

(function setupCustomAvatar() {
  const uploadArea = document.getElementById('custom-av-upload-area');
  const fileInput  = document.getElementById('custom-av-file');
  const preview    = document.getElementById('custom-av-preview');
  const buyBtn     = document.getElementById('custom-av-buy-btn');
  if (!uploadArea || !fileInput || !preview || !buyBtn) return;

  let pendingDataUrl = null;

  const showPreview = src => {
    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;';
    preview.appendChild(img);
  };

  const syncButton = () => {
    const have = !!store.loadCustomAv();
    if (pendingDataUrl) {
      buyBtn.style.display = 'block';
      buyBtn.textContent = (have ? 'Replace' : 'Buy &') + ' Equip Custom Avatar — '
        + CUSTOM_AV_PRICE.toLocaleString() + ' coins';
    } else {
      // Nothing staged: no button. It used to sit there offering a
      // purchase that could only answer "Upload an image first".
      buyBtn.style.display = 'none';
    }
  };

  const existing = store.loadCustomAv();
  if (existing) showPreview(existing);
  syncButton();

  uploadArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showToast('That is not an image', true); return; }

    const reader = new FileReader();
    reader.onerror = () => showToast('Could not read that file', true);
    reader.onload = e => {
      downscaleToSquare(e.target.result, CUSTOM_AV_SIZE).then(small => {
        pendingDataUrl = small;
        showPreview(small);
        syncButton();
      }).catch(() => showToast('Could not read that image', true));
    };
    reader.readAsDataURL(file);
    // Let the same file be picked again after a cancel.
    fileInput.value = '';
  });

  buyBtn.addEventListener('click', () => {
    if (!pendingDataUrl) { showToast('Upload an image first', true); return; }
    if (profile.coins < CUSTOM_AV_PRICE) {
      showToast('Need ' + CUSTOM_AV_PRICE.toLocaleString() + ' coins', true);
      return;
    }
    try {
      store.saveCustomAv(pendingDataUrl);
    } catch (err) {
      // Quota is the realistic failure here, and charging for a
      // purchase that did not persist would be the worst outcome.
      showToast('Could not save that image', true);
      return;
    }
    profile.coins -= CUSTOM_AV_PRICE;
    saveProfile();
    const shop = store.loadShop();
    if (!shop.owned.includes('custom')) shop.owned.push('custom');
    shop.equipped = 'custom';
    store.saveShop(shop);
    updateProfileBar();
    pendingDataUrl = null;
    syncButton();
    uiSound('purchase');
    showToast('Custom avatar equipped!');
  });
})();

// ── High scores render ────────────────────

document.getElementById('new-lvl-btn').addEventListener('click', () => openCreator(null));

function ensureImportBtn() {
  if (!document.getElementById('import-lvl-btn')) {
    const btn = document.createElement('button');
    btn.id = 'import-lvl-btn';
    btn.style.cssText = 'width:100%;padding:11px;border-radius:12px;background:none;border:1px dashed var(--border2);color:var(--muted);font-size:13px;font-weight:600;font-family:var(--font-body);cursor:pointer;transition:border-color .15s,color .15s;margin-top:0;';
    btn.innerHTML = '<svg class="ic"><use href="#ic-import"/></svg><span>Import from code</span>';
    btn.style.display = 'flex'; btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center'; btn.style.gap = '7px';
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

function buildSettingsPanel() {
  const panel = document.getElementById('tab-settings');
  if (!panel) return;
  panel.innerHTML = '';

  const s = currentSettings;

  // ── Section heading helper ──
  function sectionHead(text) {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:2px;color:var(--muted);font-family:var(--font-data);text-transform:uppercase;margin:14px 0 6px;';
    d.textContent = text;
    return d;
  }

  // ── CONTROLS section ──
  panel.appendChild(sectionHead('Controls'));

  const laneNames = ['Lane A', 'Lane S', 'Lane D', 'Lane F'];
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
      opt.value = code;
      opt.textContent = keyCodeLabel(code);
      if (code === s.keys[i]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      currentSettings.keys[i] = sel.value;
      store.saveSettings(currentSettings);
      applySettingsToDOM();
    });

    row.appendChild(lbl);
    row.appendChild(sel);
    panel.appendChild(row);
  });

  // ── SIZE section ──
  panel.appendChild(sectionHead('Extension Size'));

  function sliderRow(label, min, max, step, value, unit, onChange) {
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
    top.appendChild(lbl); top.appendChild(valLbl);
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = min; slider.max = max; slider.step = step; slider.value = value;
    slider.style.cssText = 'width:100%;accent-color:var(--tap);cursor:pointer;';
    slider.addEventListener('input', () => {
      valLbl.textContent = slider.value + unit;
      onChange(parseInt(slider.value));
    });
    row.appendChild(top); row.appendChild(slider);
    panel.appendChild(row);
  }

  sliderRow('Width', 320, 700, 10, s.width, 'px', v => {
    currentSettings.width = v;
    store.saveSettings(currentSettings);
    applySettingsToDOM();
  });
  sliderRow('Height', 480, 900, 10, s.height, 'px', v => {
    currentSettings.height = v;
    store.saveSettings(currentSettings);
    applySettingsToDOM();
  });

  // ── VISUALS section ──
  panel.appendChild(sectionHead('Visuals'));

  const lsLabel = document.createElement('div');
  lsLabel.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:6px;';
  lsLabel.textContent = 'Lane Controls';
  panel.appendChild(lsLabel);

  // Area themes recolour the app during play — worth an opt-out
  // for anyone who finds the palette shifts distracting.
  const atWrap = document.createElement('label');
  atWrap.className = 'sync-check';
  atWrap.style.margin = '0 0 9px';
  atWrap.innerHTML = '<input type="checkbox" id="set-area-themes"'
    + (currentSettings.areaThemes !== false ? ' checked' : '') + '>'
    + '<span>Let each area recolour the app while playing it</span>';
  atWrap.querySelector('input').addEventListener('change', e => {
    currentSettings.areaThemes = e.target.checked;
    store.saveSettings(currentSettings);
  });
  panel.appendChild(atWrap);

  const lsGrid = document.createElement('div');
  lsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:7px;';

  const LANE_STYLES = [
    { id:'keycap', label:'Button',
      vis:'<div class="so-cap"></div>',
      note:'A raised cap that presses down when you hit it.' },
    { id:'light',  label:'Light',
      vis:'<div class="so-bloom"></div><div class="so-strip"></div>',
      note:'A backlit strip in the lane floor that flares on hit.' },
  ];

  const lsNote = document.createElement('div');
  lsNote.style.cssText = 'font-size:10px;color:var(--dim);margin-top:6px;font-family:var(--font-data);line-height:1.5;';
  const curStyle = currentSettings.laneStyle || 'keycap';
  lsNote.textContent = (LANE_STYLES.find(x => x.id === curStyle) || LANE_STYLES[0]).note;

  LANE_STYLES.forEach(st => {
    const b = document.createElement('div');
    b.className = 'style-opt' + (curStyle === st.id ? ' on' : '');
    b.tabIndex = 0;
    b.innerHTML = '<div class="so-vis">' + st.vis + '</div>'
                + '<div class="so-label">' + st.label + '</div>';
    const pick = () => {
      currentSettings.laneStyle = st.id;
      store.saveSettings(currentSettings);
      applySettingsToDOM();
      uiSound('detent');
      buildSettingsPanel();
    };
    b.addEventListener('click', pick);
    b.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); }
    });
    lsGrid.appendChild(b);
  });
  panel.appendChild(lsGrid);
  panel.appendChild(lsNote);

  // ── ACCOUNT SYNC section ──
  panel.appendChild(sectionHead('Account Sync'));

  const syncNote = document.createElement('div');
  syncNote.className = 'sync-note';
  syncNote.style.marginBottom = '8px';
  syncNote.textContent = 'Move your profile, coins, avatars, scores and levels '
    + 'to another device. There is no account or login — the code is your account, '
    + 'so treat it like a password.';
  panel.appendChild(syncNote);

  const incWrap = document.createElement('label');
  incWrap.className = 'sync-check';
  incWrap.style.marginBottom = '8px';
  incWrap.innerHTML = '<input type="checkbox" id="sync-inc-levels" checked>'
                    + '<span>Include my custom levels</span>';
  panel.appendChild(incWrap);

  const syncBox = document.createElement('textarea');
  syncBox.className = 'sync-box';
  syncBox.id = 'sync-box';
  syncBox.placeholder = 'Press Generate to create a code, or paste one here to restore.';
  syncBox.spellcheck = false;
  panel.appendChild(syncBox);

  const syncLen = document.createElement('div');
  syncLen.className = 'sync-note';
  syncLen.style.margin = '5px 0 7px';
  panel.appendChild(syncLen);

  const syncActions = document.createElement('div');
  syncActions.className = 'sync-actions';
  syncActions.style.marginBottom = '6px';

  const genBtn = document.createElement('button');
  genBtn.className = 'sync-btn';
  genBtn.textContent = 'Generate';
  genBtn.addEventListener('click', () => {
    try {
      const inc  = document.getElementById('sync-inc-levels').checked;
      const code = buildSyncCode(inc);
      syncBox.value = code;
      syncLen.textContent = code.length.toLocaleString() + ' characters'
        + (inc ? ' · includes ' + store.load().length + ' custom level(s)' : '');
      syncBox.select();
      uiSound('ok');
    } catch (err) {
      showToast('Could not build sync code', true);
    }
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'sync-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    if (!syncBox.value.trim()) { showToast('Generate a code first', true); return; }
    copyText(syncBox.value.trim(), 'Sync code copied', 'Copy this sync code:');
  });

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'sync-btn';
  restoreBtn.textContent = 'Restore';
  restoreBtn.addEventListener('click', () => {
    const code = syncBox.value.trim();
    if (!code) { showToast('Paste a code first', true); return; }
    try {
      const r = applySyncCode(code);
      uiSound('purchase');
      showToast('Restored ' + r.name
        + (r.levels ? ' · +' + r.levels + ' level(s)' : ''));
      buildSettingsPanel();
    } catch (err) {
      showToast('Invalid sync code', true);
    }
  });

  syncActions.appendChild(genBtn);
  syncActions.appendChild(copyBtn);
  syncActions.appendChild(restoreBtn);
  panel.appendChild(syncActions);

  const mergeNote = document.createElement('div');
  mergeNote.className = 'sync-note';
  mergeNote.style.marginBottom = '4px';
  mergeNote.textContent = 'Restoring merges rather than overwrites: coins and best '
    + 'score keep the higher value, avatars combine, and duplicate levels are skipped.';
  panel.appendChild(mergeNote);

  // ── INSTRUMENT section ──
  panel.appendChild(sectionHead('Instrument'));

  const instrRow = document.createElement('div');
  instrRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:4px;';

  const instruments = window.RD_INSTRUMENTS || [];

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
    btn.innerHTML = `<svg class="ic ic-lg"><use href="#${inst.icon}"/></svg><span>${inst.label}</span>`;
    btn.addEventListener('click', () => {
      currentSettings.instrument = inst.id;
      store.saveSettings(currentSettings);
      if (window.RD_saveInstrument) window.RD_saveInstrument(inst.id);
      buildSettingsPanel(); // re-render to update highlights
      // Play a preview note
      if (window.RD_playNoteFreq) window.RD_playNoteFreq(261.63, false, 0);
    });
    instrRow.appendChild(btn);
  });
  panel.appendChild(instrRow);

  // ── GAMEPLAY section ──
  panel.appendChild(sectionHead('Gameplay'));

  const livesVal = s.lives || 3;
  sliderRow('Starting Lives', 1, 10, 1, livesVal, '', v => {
    currentSettings.lives = v;
    store.saveSettings(currentSettings);
  });

  // Hit window — the accessibility lever, since note speed is
  // locked to the level by design.
  const hwRow = document.createElement('div');
  hwRow.style.cssText = 'margin-bottom:4px;';
  const hwLbl = document.createElement('div');
  hwLbl.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:5px;';
  hwLbl.textContent = 'Hit Window';
  hwRow.appendChild(hwLbl);

  const hwBtns = document.createElement('div');
  hwBtns.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:5px;';
  const hwNote = document.createElement('div');
  hwNote.style.cssText = 'font-size:10px;color:var(--dim);margin-top:5px;font-family:var(--font-data);';
  hwNote.textContent = (HIT_WINDOWS[s.hitWindow] || HIT_WINDOWS.normal).note;

  Object.keys(HIT_WINDOWS).forEach(key => {
    const w = HIT_WINDOWS[key];
    const b = document.createElement('button');
    const on = (s.hitWindow || 'normal') === key;
    b.textContent = w.label;
    b.style.cssText = 'padding:8px 4px;border-radius:8px;font-size:11px;font-weight:700;'
      + 'font-family:var(--font-body);cursor:pointer;border:2px solid;transition:all .12s;'
      + (on ? 'border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);'
            : 'border-color:var(--border2);background:var(--bg3);color:var(--muted);');
    b.addEventListener('click', () => {
      currentSettings.hitWindow = key;
      store.saveSettings(currentSettings);
      buildSettingsPanel();
    });
    hwBtns.appendChild(b);
  });
  hwRow.appendChild(hwBtns);
  hwRow.appendChild(hwNote);
  panel.appendChild(hwRow);

  // Note speed is intentionally absent — see HIT_WINDOWS.
  const speedNote = document.createElement('div');
  speedNote.style.cssText = 'font-size:10px;color:var(--dim);margin:8px 0 2px;line-height:1.5;';
  speedNote.textContent = 'Note speed is set by each level and cannot be changed — '
    + 'it is part of the chart, and adjusting it would make scores incomparable.';
  panel.appendChild(speedNote);

  // ── SOUND section ──
  panel.appendChild(sectionHead('Sound'));

  // Audio offset calibration. Web Audio latency varies enough
  // across machines that this genuinely matters.
  const calRow = document.createElement('div');
  calRow.style.cssText = 'margin-bottom:6px;';
  const calVal = document.createElement('div');
  calVal.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:5px;';
  calVal.innerHTML = '<span style="font-size:12px;color:var(--muted)">Audio Offset</span>'
    + '<span id="cal-val" style="font-size:12px;font-weight:700;color:var(--tap);font-family:var(--font-data)">'
    + (s.audioOffset || 0) + ' ms</span>';
  calRow.appendChild(calVal);

  const calBtn = document.createElement('button');
  calBtn.textContent = 'Calibrate — tap along to 8 beats';
  calBtn.style.cssText = 'width:100%;padding:9px;border-radius:9px;border:1px dashed var(--border2);'
    + 'background:none;color:var(--muted);font-size:12px;font-weight:600;'
    + 'font-family:var(--font-body);cursor:pointer;transition:all .15s;';
  calBtn.addEventListener('click', () => runCalibration(calBtn));
  calRow.appendChild(calBtn);
  panel.appendChild(calRow);

  // ── Replay the tutorial ──
  // It shows once on first launch; this is how you get it back.
  const tutBtn = document.createElement('button');
  tutBtn.textContent = 'How to play';
  tutBtn.style.cssText = 'width:100%;margin-bottom:6px;padding:9px;border-radius:9px;'
    + 'border:1px dashed var(--border2);background:none;color:var(--muted);font-size:12px;'
    + 'font-weight:600;font-family:var(--font-body);cursor:pointer;transition:all .15s;';
  tutBtn.addEventListener('click', openTutorial);
  panel.appendChild(tutBtn);

  // ── Reset button ──
  const resetBtn = document.createElement('button');
  resetBtn.style.cssText = 'width:100%;margin-top:8px;padding:9px;border-radius:9px;border:1px solid var(--border2);background:none;color:var(--muted);font-size:12px;font-weight:700;font-family:var(--font-body);cursor:pointer;transition:border-color .15s,color .15s;';
  resetBtn.textContent = '↺ Reset to defaults';
  resetBtn.onmouseenter = () => { resetBtn.style.borderColor='var(--miss)'; resetBtn.style.color='var(--miss)'; };
  resetBtn.onmouseleave = () => { resetBtn.style.borderColor='var(--border2)'; resetBtn.style.color='var(--muted)'; };
  resetBtn.addEventListener('click', () => {
    currentSettings = Object.assign({}, DEFAULT_SETTINGS, { keys: [...DEFAULT_SETTINGS.keys] });
    store.saveSettings(currentSettings);
    applySettingsToDOM();
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
function freqToName(freq) {
  if (window.RD_freqToName) return window.RD_freqToName(freq);
  return freq.toFixed(2) + ' Hz';
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
  crAreaId = null;
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
    crAreaId    = l.areaId || null;
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
    expBtn.innerHTML = '<svg class="ic"><use href="#ic-export"/></svg> Export';
    expBtn.addEventListener('click', () => {
      const arr = store.load();
      if (arr[editIdx]) exportLevel(arr[editIdx]);
    });
    document.querySelector('.cr-header').insertBefore(expBtn, document.getElementById('cr-save'));
  }
  showScreen('creator');
}

// ══════════════════════════════════════
//  CREATOR: MULTI-SELECT AND CLIPBOARD
//
//  Select a rectangle of beats x lanes, then cut, copy or paste it.
//  The clipboard lives in this session only and never leaves the
//  level — this is for moving a phrase around a chart, not for
//  sharing material between them.
//
//  Paste arms rather than drops: the block rides the cursor and lands
//  with its FIRST cell (top-left) wherever you click.
// ══════════════════════════════════════
let crSel     = null;   // { r0, c0, r1, c1 } — normalised, inclusive
let crAnchor  = null;   // drag origin while selecting
let crDragging = false;
let crClip    = null;   // { h, w, cells }
let crPasting = false;  // armed, waiting for a click to place
let crHover   = null;   // { r, c } under the cursor while placing
let crCellEls = [];     // [row][col] -> element, for repaint without rebuild

const inSel = (r, c) => !!crSel && r >= crSel.r0 && r <= crSel.r1 && c >= crSel.c0 && c <= crSel.c1;

function normSel(a, b) {
  return {
    r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r),
    c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c),
  };
}

// Repaints selection state by toggling classes, rather than rebuilding
// the grid on every pointer move.
function paintSelection() {
  const g = document.getElementById('cr-grid');
  if (g) {
    g.classList.toggle('sel-mode', crTool === 'select' && !crPasting);
    g.classList.toggle('paste-mode', crPasting);
  }
  const ghost = (crPasting && crHover && crClip)
    ? { r0: crHover.r, c0: crHover.c,
        r1: crHover.r + crClip.h - 1, c1: crHover.c + crClip.w - 1 }
    : null;

  for (let r = 0; r < crCellEls.length; r++) {
    const row = crCellEls[r] || [];
    for (let c = 0; c < row.length; c++) {
      const el = row[c];
      if (!el) continue;
      el.classList.toggle('sel', !crPasting && inSel(r, c));
      el.classList.toggle('paste-ghost', !!ghost &&
        r >= ghost.r0 && r <= ghost.r1 && c >= ghost.c0 && c <= ghost.c1);
    }
  }
  updateClipButtons();
}

function clearSelection() { crSel = null; crAnchor = null; paintSelection(); }

function copySelection(cut) {
  if (!crSel) return false;
  const h = crSel.r1 - crSel.r0 + 1, w = crSel.c1 - crSel.c0 + 1;
  const cells = [];
  for (let r = 0; r < h; r++) {
    const row = [];
    for (let c = 0; c < w; c++) {
      const cell = crGrid[crSel.r0 + r] && crGrid[crSel.r0 + r][crSel.c0 + c];
      row.push(cell ? Object.assign({}, cell) : null);
      if (cut && crGrid[crSel.r0 + r]) crGrid[crSel.r0 + r][crSel.c0 + c] = null;
    }
    cells.push(row);
  }
  crClip = { h, w, cells };
  if (cut) { buildGrid(); showToast('Cut ' + h + '×' + w); }
  else showToast('Copied ' + h + '×' + w);
  paintSelection();
  return true;
}

function deleteSelection() {
  if (!crSel) return false;
  for (let r = crSel.r0; r <= crSel.r1; r++) {
    for (let c = crSel.c0; c <= crSel.c1; c++) {
      if (crGrid[r]) crGrid[r][c] = null;
    }
  }
  buildGrid();
  return true;
}

function armPaste() {
  if (!crClip) { showToast('Nothing copied yet', true); return; }
  crPasting = true;
  crSel = null;
  crHover = null;
  paintSelection();
  showToast('Click a beat to drop the block');
}

function cancelPaste() { crPasting = false; crHover = null; paintSelection(); }

// Drops the clipboard with its first cell at (r, c). Lanes are clamped;
// beats past the end grow the chart rather than truncating the paste.
function commitPaste(r, c) {
  if (!crClip) return;
  const c0 = Math.max(0, Math.min(c, 4 - crClip.w));
  while (crGrid.length < r + crClip.h) crGrid.push([null, null, null, null]);
  for (let dr = 0; dr < crClip.h; dr++) {
    for (let dc = 0; dc < crClip.w; dc++) {
      const src = crClip.cells[dr][dc];
      crGrid[r + dr][c0 + dc] = src ? Object.assign({}, src) : null;
    }
  }
  crPasting = false;
  crHover = null;
  crSel = { r0: r, c0: c0, r1: r + crClip.h - 1, c1: c0 + crClip.w - 1 };
  buildGrid();
  showToast('Pasted ' + crClip.h + '×' + crClip.w);
}

function updateClipButtons() {
  const has = !!crSel, clip = !!crClip;
  const set = (id, on, armed) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = !on;
    b.classList.toggle('armed', !!armed);
  };
  set('cr-cut', has);
  set('cr-copy', has);
  set('cr-paste', clip, crPasting);
  const info = document.getElementById('cr-selinfo');
  if (info) {
    info.textContent = crPasting
      ? 'placing ' + crClip.h + '×' + crClip.w
      : (crSel ? (crSel.r1 - crSel.r0 + 1) + '×' + (crSel.c1 - crSel.c0 + 1) + ' selected' : '');
  }
}

// Wires one grid cell into selection and placing.
function wireCellSelection(el, ri, ci) {
  el.dataset.r = ri; el.dataset.c = ci;
  (crCellEls[ri] = crCellEls[ri] || [])[ci] = el;

  el.addEventListener('mousedown', e => {
    if (crPasting) { e.preventDefault(); commitPaste(ri, ci); return; }
    if (crTool !== 'select') return;
    e.preventDefault();
    crDragging = true;
    crAnchor = { r: ri, c: ci };
    crSel = normSel(crAnchor, crAnchor);
    paintSelection();
  });

  el.addEventListener('mouseenter', () => {
    if (crPasting) { crHover = { r: ri, c: ci }; paintSelection(); return; }
    if (!crDragging || crTool !== 'select' || !crAnchor) return;
    crSel = normSel(crAnchor, { r: ri, c: ci });
    paintSelection();
  });
}

window.addEventListener('mouseup', () => { crDragging = false; });

function setTool(t) {
  crTool = t;
  if (t !== 'select') { crSel = null; crAnchor = null; }
  if (crPasting && t !== 'select') cancelPaste();
  ['tap','dtap','erase','select'].forEach(x => {
    const b = document.getElementById('t-' + x);
    if (!b) return;
    b.className = 'tool-btn' + (x === t
      ? (t==='tap' ? ' at' : t==='dtap' ? ' ad' : t==='erase' ? ' ae' : ' as')
      : '');
  });
  paintSelection();
}
document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

(function wireClipboardUI() {
  const on = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); };
  on('cr-cut',   () => copySelection(true));
  on('cr-copy',  () => copySelection(false));
  on('cr-paste', armPaste);

  // Keyboard, scoped to the creator so it never fights the board or a
  // text field.
  document.addEventListener('keydown', e => {
    const screen = document.querySelector('.screen.active');
    if (!screen || screen.id !== 'creator') return;
    if (keyboardIsCaptured()) return;

    if (e.key === 'Escape') {
      if (crPasting) { cancelPaste(); e.preventDefault(); }
      else if (crSel) { clearSelection(); e.preventDefault(); }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && crSel) {
      e.preventDefault(); deleteSelection(); return;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'c' && crSel)      { e.preventDefault(); copySelection(false); }
    else if (k === 'x' && crSel) { e.preventDefault(); copySelection(true); }
    else if (k === 'v')          { e.preventDefault(); armPaste(); }
    else if (k === 'a')          {
      e.preventDefault();
      setTool('select');
      crSel = { r0: 0, c0: 0, r1: crGrid.length - 1, c1: 3 };
      paintSelection();
    }
  });
})();

document.getElementById('adv-toggle').addEventListener('click', () => {
  crAdvOpen = !crAdvOpen;
  document.getElementById('adv-panel').classList.toggle('open', crAdvOpen);
  // Grow the window for the panel rather than squeezing the grid,
  // and give the space back when it closes.
  if (crAdvOpen) expandForPanel(220, 'h'); else retractPanel();
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
// The erase tool clears the cell.
function buildGrid() {
  const adv = crAdvOpen;
  const g   = document.getElementById('cr-grid');
  g.innerHTML = '';
  crCellEls = [];

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

      if (adv && type) {
        // ── Advanced filled cell ──────────
        const wrap = document.createElement('div');
        wrap.className = 'cr-adv-wrap';
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
        wireCellSelection(wrap, ri, ci);

        // Top bar: type toggle badge + erase button
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex;align-items:center;gap:3px;';

        const typeBadge = document.createElement('div');
        typeBadge.style.cssText = [
          'flex:1;height:16px;border-radius:3px;font-size:8px;font-weight:700;',
          'font-family:var(--font-data);display:flex;align-items:center;',
          'justify-content:center;cursor:pointer;border:1px solid;',
        ].join('');
        typeBadge.textContent = type === 'tap' ? 'TAP' : '×2';
        typeBadge.style.background  = type === 'tap' ? 'rgba(59,130,246,.4)' : 'rgba(255,58,110,.4)';
        typeBadge.style.borderColor = type === 'tap' ? 'var(--tap)' : 'var(--dtap)';
        typeBadge.style.color       = type === 'tap' ? 'var(--tap)' : 'var(--dtap)';
        typeBadge.title = 'Click to toggle tap ↔ ×2';
        typeBadge.addEventListener('click', () => {
          const cur     = cellType(crGrid[ri][ci]);
          const newType = cur === 'tap' ? 'dtap' : 'tap';
          const freq    = cellFreq(crGrid[ri][ci], ci);
          crGrid[ri][ci] = { type: newType, freq };
          buildGrid();
        });

        const eraseBtn = document.createElement('button');
        eraseBtn.innerHTML = '<svg class="ic"><use href="#ic-close"/></svg>';
        eraseBtn.style.cssText = 'background:none;border:1px solid var(--border2);border-radius:3px;color:var(--muted);font-size:7px;cursor:pointer;padding:0 3px;height:16px;';
        eraseBtn.addEventListener('click', () => { crGrid[ri][ci] = null; buildGrid(); });

        topBar.appendChild(typeBadge);
        topBar.appendChild(eraseBtn);

        // Note label badge — clicking THIS opens the picker
        const freq     = cellFreq(cell, ci);
        const noteName = freqToName(freq);
        const noteBadge = document.createElement('div');
        noteBadge.style.cssText = [
          'width:100%;padding:2px 4px;border-radius:4px;border:1px solid var(--border2);',
          'background:var(--bg3);color:var(--text);font-size:9px;font-weight:700;',
          'font-family:var(--font-data);cursor:pointer;text-align:center;',
          'transition:border-color .1s,color .1s;',
        ].join('');
        noteBadge.textContent = noteName;
        noteBadge.title = 'Click to change note';
        noteBadge.addEventListener('mouseenter', () => {
          noteBadge.style.borderColor = 'var(--tap)';
          noteBadge.style.color       = 'var(--tap)';
        });
        noteBadge.addEventListener('mouseleave', () => {
          noteBadge.style.borderColor = 'var(--border2)';
          noteBadge.style.color       = 'var(--text)';
        });
        noteBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          openNotePickerModal(noteBadge, cellFreq(crGrid[ri][ci], ci), (newFreq) => {
            crGrid[ri][ci] = { type: cellType(crGrid[ri][ci]) || 'tap', freq: newFreq, sustain: cellSustain(crGrid[ri][ci]) };
            buildGrid();
          });
        });

        // Sustain (pedal) selector
        const sustainVal = cellSustain(cell);
        const sustainRow = document.createElement('div');
        sustainRow.style.cssText = 'display:flex;align-items:center;gap:2px;';

        const sustainIcon = document.createElement('span');
        sustainIcon.innerHTML = '<svg class="ic" style="width:8px;height:8px"><use href="#ic-note"/></svg>';
        sustainIcon.style.cssText = 'font-size:7px;flex-shrink:0;opacity:.7;';

        const sustainSel = document.createElement('select');
        sustainSel.style.cssText = [
          'flex:1;padding:1px 2px;border-radius:3px;border:1px solid var(--border2);',
          'background:var(--bg3);color:var(--text);font-size:7px;',
          'font-family:var(--font-data);outline:none;cursor:pointer;',
          sustainVal > 0 ? 'border-color:var(--perfect);color:var(--perfect);' : '',
        ].join('');

        const sustainOptions = [
          { v:0,   l:'off'  },
          { v:0.5, l:'.5s'  },
          { v:1.0, l:'1.0s' },
          { v:1.5, l:'1.5s' },
          { v:2.0, l:'2.0s' },
          { v:2.5, l:'2.5s' },
          { v:3.0, l:'3.0s' },
        ];
        sustainOptions.forEach(o => {
          const opt = document.createElement('option');
          opt.value = o.v; opt.textContent = o.l;
          if (Math.abs(o.v - sustainVal) < 0.01) opt.selected = true;
          sustainSel.appendChild(opt);
        });
        sustainSel.addEventListener('change', () => {
          const sv = parseFloat(sustainSel.value);
          crGrid[ri][ci] = { type: cellType(crGrid[ri][ci]) || 'tap', freq: cellFreq(crGrid[ri][ci], ci), sustain: sv };
          buildGrid();
        });
        sustainRow.appendChild(sustainIcon);
        sustainRow.appendChild(sustainSel);

        wrap.appendChild(topBar);
        wrap.appendChild(noteBadge);
        wrap.appendChild(sustainRow);
        g.appendChild(wrap);

      } else {
        // ── Normal / advanced-empty cell ──
        const el = document.createElement('div');
        el.className = 'cr-cell' + (type ? ' is-' + type : '');
        wireCellSelection(el, ri, ci);
        el.addEventListener('click', () => {
          // Select and paste modes own the pointer; editing resumes
          // when a drawing tool is picked again.
          if (crTool === 'select' || crPasting) return;
          if (crTool === 'erase') {
            crGrid[ri][ci] = null;
          } else if (crTool === 'tap') {
            crGrid[ri][ci] = cellType(crGrid[ri][ci]) === 'tap'
              ? null
              : { type:'tap', freq: crLaneFreqs[ci], sustain: crDefaultSustain };
          } else if (crTool === 'dtap') {
            crGrid[ri][ci] = cellType(crGrid[ri][ci]) === 'dtap'
              ? null
              : { type:'dtap', freq: crLaneFreqs[ci], sustain: crDefaultSustain };
          }
          buildGrid();
        });
        g.appendChild(el);
      }
    });
  });

  paintSelection();
}

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
    bassPattern,
    // The chart's sound belongs to the chart — otherwise a level
    // exported as piano arrives on someone else's device as synth.
    instrument:  (window.RD_getInstrument && window.RD_getInstrument()) || 'synth',
    areaId:      crAreaId || undefined,
    areaName:    crAreaId ? CAM().areaById(crAreaId).name : undefined,
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
    bassPattern,
    // The chart's sound belongs to the chart — otherwise a level
    // exported as piano arrives on someone else's device as synth.
    instrument:  (window.RD_getInstrument && window.RD_getInstrument()) || 'synth',
    areaId:      crAreaId || undefined,
    areaName:    crAreaId ? CAM().areaById(crAreaId).name : undefined,
  };
  const arr = store.load();
  if (arr[editIdx]) arr[editIdx] = lvl;
  store.save(arr);
}

// ── Advanced panel ────────────────────────
let crDefaultSustain = 0; // sustain applied to newly placed cells
let crAreaId = null;      // theme the custom song plays in (null = none)

// Picking a theme gives a custom song the same treatment a
// campaign song gets: palette, texture, scale and instruments.
function buildThemePicker() {
  const host = document.getElementById('adv-theme-pick');
  if (!host) return;
  host.innerHTML = '';

  const opts = [{ id:null, name:'None', key:null }]
    .concat(CAM().AREAS.map(a => ({ id:a.id, name:a.name, key:a.key })));

  opts.forEach(o => {
    const b = document.createElement('div');
    b.className = 'tp-opt' + (crAreaId === o.id ? ' on' : '');
    b.tabIndex = 0;
    const em = o.key ? 'emblem-' + o.key : null;
    b.innerHTML = (em && document.getElementById(em)
        ? '<svg viewBox="0 0 64 64"><use href="#' + em + '"/></svg>'
        : '<svg viewBox="0 0 24 24"><use href="#ic-note"/></svg>')
      + '<div class="tp-name"></div>';
    b.querySelector('.tp-name').textContent = o.name;

    const pick = () => {
      crAreaId = o.id;
      // Adopt the theme's scale so the lane defaults actually
      // sound like the era, not just look like it.
      if (o.id) {
        crLaneFreqs = CAM().scaleFreqs(o.id).slice();
        const area = CAM().areaById(o.id);
        if (area && window.RD_saveInstrument) {
          window.RD_saveInstrument(CAM().resolveInstrument(area.instrument));
        }
      }
      buildThemePicker();
      buildLaneNoteGrid();
      buildAdvInstrumentRow();
      buildGrid();
      uiSound('detent');
    };
    b.addEventListener('click', pick);
    b.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
    });
    host.appendChild(b);
  });
}

// ══════════════════════════════════════
//  GENERATE MODE
//  Same generator the campaign uses, driven by the editor's
//  controls instead of a level index. The result lands in the
//  normal grid, so it can be hand-edited afterwards.
// ══════════════════════════════════════
function fillSelect(el, items, current) {
  if (!el) return;
  el.innerHTML = '';
  items.forEach(it => {
    const o = document.createElement('option');
    o.value = String(it.value);
    o.textContent = it.label;
    if (String(it.value) === String(current)) o.selected = true;
    el.appendChild(o);
  });
}

function genDescribeForm() {
  const note  = document.getElementById('gen-form');
  const shape = document.getElementById('gen-shape');
  if (!note || !shape) return;
  const sh = CAM().SHAPES.find(x => x.name === shape.value);
  if (!sh) { note.textContent = ''; return; }
  note.textContent = sh.parts.map(p => p[0]).join(' › ');
}

function buildGeneratePane() {
  const shapeSel = document.getElementById('gen-shape');
  if (!shapeSel) return;

  fillSelect(shapeSel, CAM().SHAPES.map(s => ({ value:s.name, label:s.name })), 'Pop');
  fillSelect(document.getElementById('gen-theme'),
    [{ value:0, label:'None' }].concat(CAM().AREAS.map(a => ({ value:a.id, label:a.name }))),
    crAreaId || 0);
  fillSelect(document.getElementById('gen-inst'),
    (window.RD_INSTRUMENTS || []).map(i => ({ value:i.id, label:i.label })),
    currentSettings.instrument || 'synth');
  fillSelect(document.getElementById('gen-style'),
    Object.keys(CAM().MIX_STYLES)
      .filter(k => k !== 'Z')
      .map(k => ({ value:k, label:CAM().MIX_STYLES[k].name })),
    'B');

  const bind = (id, fmt) => {
    const r = document.getElementById(id);
    const v = document.getElementById(id + '-v');
    if (!r || !v) return;
    const upd = () => { v.textContent = fmt(parseInt(r.value, 10)); };
    r.oninput = upd; upd();
  };
  bind('gen-diff', n => n);
  bind('gen-len',  n => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'));
  bind('gen-dbl',  n => n + '%');
  bind('gen-sus',  n => n + '%');

  shapeSel.onchange = genDescribeForm;
  genDescribeForm();

  const seedIn = document.getElementById('gen-seed');
  document.getElementById('gen-reroll').onclick = () => {
    seedIn.value = Math.floor(Math.random() * 2147483647).toString(36).toUpperCase();
    uiSound('tick');
  };

  document.getElementById('gen-go').onclick = runGenerate;
}

function runGenerate() {
  const val  = id => document.getElementById(id).value;
  const num  = id => parseInt(val(id), 10);

  const shapeName = val('gen-shape');
  const areaId    = parseInt(val('gen-theme'), 10) || null;
  const inst      = val('gen-inst');
  const baseStyle = val('gen-style');
  const diff      = num('gen-diff');
  const seconds   = num('gen-len');
  const dblPct    = num('gen-dbl');
  const susPct    = num('gen-sus');

  const seedTxt = val('gen-seed').trim();
  const seed = seedTxt
    ? (parseInt(seedTxt, 36) || 1) & 0x7FFFFFFF
    : Math.floor(Math.random() * 2147483647);

  // The doubles and held-note sliders are expressed as a share of
  // notes, so they map onto the style's multipliers rather than
  // overriding the quota system.
  const style = CAM().styleWithMix
    ? CAM().styleWithMix(baseStyle, dblPct / 100, susPct / 100)
    : baseStyle;

  const bpm  = 90 + Math.round((diff - 1) * 7);
  const bars = CAM().barsForSeconds(seconds, bpm);
  const music = areaId || 1;

  const grid = CAM().generateChart(seed, diff, bars, music, style, shapeName);

  // Land it in the editor grid so it can be edited by hand.
  crGrid = grid.map(r => r.map(c => (c ? Object.assign({}, c) : null)));
  crAreaId = areaId;
  if (areaId) crLaneFreqs = CAM().scaleFreqs(areaId).slice();
  if (window.RD_saveInstrument) window.RD_saveInstrument(inst);
  currentSettings.instrument = inst;
  store.saveSettings(currentSettings);

  const nameEl = document.getElementById('cr-name');
  if (nameEl && !nameEl.value.trim()) nameEl.value = CAM().songTitle(music, seed);

  const bpmEl = document.getElementById('cr-bpm');
  if (bpmEl) bpmEl.value = bpm;

  document.getElementById('gen-seed').value = seed.toString(36).toUpperCase();

  let notes = 0;
  grid.forEach(r => r.forEach(c => { if (c) notes++; }));
  const note = document.getElementById('gen-note');
  if (note) {
    note.textContent = shapeName + ' · ' + notes + ' notes · '
      + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
      + ' · ' + bpm + ' BPM · seed ' + seed.toString(36).toUpperCase();
  }

  setCreatorMode('custom');
  buildGrid();
  buildAdvPanel();
  uiSound('purchase');
  showToast('Generated ' + notes + ' notes — edit or save');
}

let creatorMode = 'custom';
function setCreatorMode(m) {
  creatorMode = m;
  document.querySelectorAll('.cr-mode-opt').forEach(o =>
    o.classList.toggle('on', o.dataset.mode === m));
  const gen = document.getElementById('gen-pane');
  if (gen) gen.classList.toggle('show', m === 'generate');
  // Hide the hand-editing furniture while the generator is open.
  ['cr-grid-wrap', 'cr-controls', 'adv-panel', 'adv-toggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (m === 'generate') ? 'none' : '';
  });
}

(function wireCreatorMode() {
  document.querySelectorAll('.cr-mode-opt').forEach(o => {
    o.tabIndex = 0;
    const go = () => {
      setCreatorMode(o.dataset.mode);
      if (o.dataset.mode === 'generate') buildGeneratePane();
      uiSound('detent');
    };
    o.addEventListener('click', go);
    o.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
})();

// ══════════════════════════════════════
//  PANEL EXPANSION
//  A panel that needs room grows the window rather than
//  squeezing the content, and shrinks back when it closes. If
//  the window is already at its cap it overlays instead, which
//  is the old behaviour — so this never traps a panel off-screen.
// ══════════════════════════════════════
const WINDOW_CAP = { w: 700, h: 900 };
let panelExpansion = null;   // { axis, amount } while a panel is open

function expandForPanel(px, axis) {
  if (panelExpansion) return panelExpansion;   // one at a time
  const root = document.documentElement;
  const cur  = axis === 'h'
    ? (parseInt(root.style.height, 10) || currentSettings.height)
    : (parseInt(root.style.width, 10)  || currentSettings.width);
  const cap  = axis === 'h' ? WINDOW_CAP.h : WINDOW_CAP.w;

  const room  = Math.max(0, cap - cur);
  const grow  = Math.min(px, room);

  if (grow > 0) {
    root.style[axis === 'h' ? 'height' : 'width'] = (cur + grow) + 'px';
    panelExpansion = { axis, amount: grow, overlay: grow < px };
  } else {
    // No room: the panel overlays and the content scrolls, as before.
    panelExpansion = { axis, amount: 0, overlay: true };
  }
  document.body.classList.toggle('panel-overlay', panelExpansion.overlay);
  return panelExpansion;
}

function retractPanel() {
  if (!panelExpansion) return;
  const root = document.documentElement;
  if (panelExpansion.amount > 0) {
    const axis = panelExpansion.axis;
    const cur  = parseInt(root.style[axis === 'h' ? 'height' : 'width'], 10) || 0;
    root.style[axis === 'h' ? 'height' : 'width'] = (cur - panelExpansion.amount) + 'px';
  }
  document.body.classList.remove('panel-overlay');
  panelExpansion = null;
}

function buildAdvPanel() {
  buildThemePicker();
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
  const instruments = window.RD_INSTRUMENTS || [];
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
    btn.innerHTML = `<svg class="ic"><use href="#${inst.icon}"/></svg><span>${inst.label}</span>`;
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
const HIT_TOL_BASE = TILE_H * 1.8;
// Widened or tightened by the hit-window setting.
function hitTol() {
  const w = HIT_WINDOWS[currentSettings.hitWindow] || HIT_WINDOWS.normal;
  return HIT_TOL_BASE * w.mult;
}
const DTAP_MS    = 320;
const SPEED_INC  = 0.10 / 60;

let gameLevel   = null;
let gameQueue   = [];
let activeTiles = [];
let score = 0, combo = 0, lives = 3, maxLives = 3;
let streak = 0; // consecutive hits for streak bonus
// Notes struck this run, against the chart's total. A failed run is
// paid out on this ratio, so dying early earns early-death XP.
let notesHit = 0, notesTotal = 0;
let overtime = false;   // double speed, coins only
let running = false, lastT = 0, raf = null;
let beatAccum = 0, beatIdx = 0;
let baseBeatMs = 500, currentBeatMs = 500;
let speedMult = 1, gameTimeMs = 0;
let fbTimers  = [0,0,0,0];
let lastTapT  = {0:0,1:0,2:0,3:0};

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

// Lane height is read every frame by the game loop and by every tap.
// Measuring it with getBoundingClientRect() forces the browser to
// flush layout — and because the loop also writes to each tile in the
// same frame, that read-after-write was a synchronous relayout per
// frame. It only actually changes when the window does, so measure it
// then and cache it.
let _laneH = 0;
function measureLanes() {
  _laneH = (laneEls[0] && laneEls[0].getBoundingClientRect().height) || 380;
  return _laneH;
}
function laneH() { return _laneH || measureLanes(); }
function hitY()  { return laneH() - HIT_BOTTOM; }
window.addEventListener('resize', measureLanes);

function buildQueue(lvl) {
  if (lvl.grid) {
    const q = [];
    const fallbackFreqs = lvl.laneFreqs || [261.63,329.63,392.00,523.25];
    lvl.grid.forEach((row, ri) => row.forEach((cell, ci) => {
      if (!cell) return;
      const type    = typeof cell === 'string' ? cell : cell.type;
      const freq    = (typeof cell === 'object' && cell.freq) ? cell.freq : fallbackFreqs[ci];
      const sustain = (typeof cell === 'object' && cell.sustain) ? cell.sustain : 0;
      const inst    = (typeof cell === 'object' && cell.inst) ? cell.inst : null;
      q.push({ beatIdx:ri, lane:ci, type, freq, sustain, inst });
    }));
    return q.sort((a, b) => a.beatIdx - b.beatIdx);
  }
  const fallbackFreqs = lvl.laneFreqs || [261.63,329.63,392.00,523.25];
  return lvl.notes.map(n => ({
    beatIdx: n.b, lane: n.l, type: n.t,
    freq: n.freq || fallbackFreqs[n.l],
    sustain: n.sustain || 0,
    inst: n.inst || null,
  }));
}

function totalBeats(lvl) {
  return lvl.grid ? lvl.grid.length : (lvl.beats || lvl.notes.length);
}

function spawnTile(note) {
  // Recycle from the pool the preloader built. The old code
  // created and removed a div per note, which is what made
  // long levels degrade over time.
  const pool = window.RD_TILE_POOL;
  const el = (pool && pool.length) ? pool.pop() : document.createElement('div');

  el.className = 'tile tile-' + note.type;
  el.style.display = '';
  el.style.boxShadow = '';
  el.style.borderTop = '';

  const h = note.type === 'dtap' ? Math.round(TILE_H * 1.5) : TILE_H;
  // A voice change should be visible, not only audible — the
  // border hue shifts when the arrangement moves to a new
  // instrument, so you can see the chorus arrive.
  if (note.inst) el.dataset.inst = note.inst;

  // Visual indicator for sustained notes: golden glow
  if (note.sustain > 0) {
    el.style.boxShadow = '0 0 12px rgba(245,158,11,0.7)';
    el.style.borderTop = '2px solid var(--perfect)';
  }
  // Position via transform, never `top`: transform is composited, so
  // a falling tile costs no layout and no paint. `.tile` already
  // declares will-change:transform for exactly this.
  el.style.height = h + 'px';
  el.style.top = '0px';
  el.style.transform = 'translate3d(0,' + (-h) + 'px,0)';
  laneEls[note.lane].appendChild(el);
  return { el, lane:note.lane, y:-h, type:note.type, h, freq:note.freq||null,
           sustain:note.sustain||0, inst:note.inst||null, firstTapped:false, done:false };
}

// Return a tile to the pool instead of destroying it.
function retireTile(t) {
  if (!t || !t.el) return;
  const el = t.el;
  el.className = 'tile';
  el.style.display = 'none';
  delete el.dataset.inst;
  el.style.boxShadow = '';
  el.style.borderTop = '';
  // Clear the fall position too, or a recycled tile re-enters the
  // lane wherever the last one finished.
  el.style.transform = '';
  if (el.parentNode) el.parentNode.removeChild(el);
  if (window.RD_TILE_POOL && window.RD_TILE_POOL.length < 96) {
    window.RD_TILE_POOL.push(el);
  }
}

function launchLevel(lvl) {
  overtime = false;
  gameLevel = lvl;

  // Theme and texture are applied here rather than at startGame,
  // so the title card and count-in are already in the area's
  // palette — arriving in Egypt should look like arriving.
  applyLevelTexture(lvl);
  lvlName.textContent = lvl.name;
  baseBeatMs = Math.round(60000 / lvl.bpm);
  ovTitle.innerHTML = 'Rhythm<span>Drop</span>';
  ovScore.style.display = 'none'; ovScLbl.style.display = 'none';
  ovBtn.textContent = 'Play';
  ovBtn.onclick = () => { overlay.classList.remove('show'); beginLevel(); };
  overlay.classList.add('show');
  showScreen('game');
}

// Runs the preload pipeline, then starts play. Everything
// expensive happens behind the title card, so the first
// frame of the game loop has nothing left to pay for.
function beginLevel() {
  const queue = buildQueue(gameLevel);
  if (window.RD_Loading) {
    window.RD_Loading.run(gameLevel, queue, { onReady: () => startGame(queue) });
  } else {
    startGame(queue);
  }
}

function launchCustom(lvl) { launchLevel(lvl); }

// Put the player's own instrument choice back after a level
// that specified its own.
// Announce, then run the same chart at double speed.
function startOvertime() {
  overtime = true;
  const wrap = document.getElementById('overtime-announce');
  if (!wrap) { startGame(); return; }

  wrap.classList.add('show');
  const word = document.getElementById('ot-word');
  if (word) { word.style.animation = 'none'; void word.offsetWidth; word.style.animation = ''; }
  uiSound('purchase');

  setTimeout(() => {
    wrap.classList.remove('show');
    if (window.RD_Loading) {
      window.RD_Loading.runCountIn(gameLevel.bpm * 2).then(() => startGame());
    } else {
      startGame();
    }
  }, 1400);
}

const TEX_CLASSES = ['tex-weave','tex-carve','tex-vein','tex-hammer',
                     'tex-jade','tex-oak','tex-brush','tex-scan'];

const AREA_THEME_CLASSES = ['area-farmstead','area-egypt','area-greece','area-rome',
  'area-aztec','area-maya','area-england','area-napoleon','area-modern','area-retro'];

const TRAIL_CLASSES = ['trail-comet','trail-ribbon','trail-echo','trail-spark'];

// Cosmetic catalogs. Owned via the shop; 'none' is always free.
const TRAILS = [
  { id:"none", name:"None", len:0, op:0, w:0, price:0, shape:"none" },
  { id:"tr_comet_short", name:"Comet Short", len:26, op:0.34, w:0.3, price:300, shape:"comet" },
  { id:"tr_comet_long", name:"Comet Long", len:64, op:0.22, w:0.42, price:420, shape:"comet" },
  { id:"tr_comet_wide", name:"Comet Wide", len:40, op:0.3, w:0.85, price:540, shape:"comet" },
  { id:"tr_comet_thin", name:"Comet Thin", len:48, op:0.26, w:0.28, price:660, shape:"comet" },
  { id:"tr_comet_bright", name:"Comet Bright", len:36, op:0.55, w:0.5, price:780, shape:"comet" },
  { id:"tr_ribbon_short", name:"Ribbon Short", len:26, op:0.34, w:0.3, price:900, shape:"ribbon" },
  { id:"tr_ribbon_long", name:"Ribbon Long", len:64, op:0.22, w:0.42, price:1020, shape:"ribbon" },
  { id:"tr_ribbon_wide", name:"Ribbon Wide", len:40, op:0.3, w:0.85, price:1140, shape:"ribbon" },
  { id:"tr_ribbon_thin", name:"Ribbon Thin", len:48, op:0.26, w:0.28, price:1260, shape:"ribbon" },
  { id:"tr_ribbon_bright", name:"Ribbon Bright", len:36, op:0.55, w:0.5, price:1380, shape:"ribbon" },
  { id:"tr_echo_short", name:"Echo Short", len:26, op:0.34, w:0.3, price:1500, shape:"echo" },
  { id:"tr_echo_long", name:"Echo Long", len:64, op:0.22, w:0.42, price:1620, shape:"echo" },
  { id:"tr_echo_wide", name:"Echo Wide", len:40, op:0.3, w:0.85, price:1740, shape:"echo" },
  { id:"tr_echo_thin", name:"Echo Thin", len:48, op:0.26, w:0.28, price:1860, shape:"echo" },
  { id:"tr_echo_bright", name:"Echo Bright", len:36, op:0.55, w:0.5, price:1980, shape:"echo" },
  { id:"tr_spark_short", name:"Sparks Short", len:26, op:0.34, w:0.3, price:2100, shape:"spark" },
  { id:"tr_spark_long", name:"Sparks Long", len:64, op:0.22, w:0.42, price:2220, shape:"spark" },
  { id:"tr_spark_wide", name:"Sparks Wide", len:40, op:0.3, w:0.85, price:2340, shape:"spark" },
  { id:"tr_spark_thin", name:"Sparks Thin", len:48, op:0.26, w:0.28, price:2460, shape:"spark" },
  { id:"tr_spark_bright", name:"Sparks Bright", len:36, op:0.55, w:0.5, price:2580, shape:"spark" },
  { id:"tr_blade_short", name:"Blade Short", len:26, op:0.34, w:0.3, price:2700, shape:"blade" },
  { id:"tr_blade_long", name:"Blade Long", len:64, op:0.22, w:0.42, price:2820, shape:"blade" },
  { id:"tr_blade_wide", name:"Blade Wide", len:40, op:0.3, w:0.85, price:2940, shape:"blade" },
  { id:"tr_blade_thin", name:"Blade Thin", len:48, op:0.26, w:0.28, price:3060, shape:"blade" },
  { id:"tr_blade_bright", name:"Blade Bright", len:36, op:0.55, w:0.5, price:3180, shape:"blade" },
  { id:"tr_plume_short", name:"Plume Short", len:26, op:0.34, w:0.3, price:3300, shape:"plume" },
  { id:"tr_plume_long", name:"Plume Long", len:64, op:0.22, w:0.42, price:3420, shape:"plume" },
  { id:"tr_plume_wide", name:"Plume Wide", len:40, op:0.3, w:0.85, price:3540, shape:"plume" },
  { id:"tr_plume_thin", name:"Plume Thin", len:48, op:0.26, w:0.28, price:3660, shape:"plume" },
  { id:"tr_plume_bright", name:"Plume Bright", len:36, op:0.55, w:0.5, price:3780, shape:"plume" },
];
const HIT_FX = [
  { id:"none", name:"None", scale:0, dur:0, price:0, shape:"none" },
  { id:"bloom", name:"Bloom", scale:1.0, dur:0.34, price:0, shape:"bloom" },
  { id:"fx_bloom_soft", name:"Bloom Soft", scale:1.0, dur:0.42, price:400, shape:"bloom" },
  { id:"fx_bloom_sharp", name:"Bloom Sharp", scale:0.8, dur:0.26, price:530, shape:"bloom" },
  { id:"fx_bloom_wide", name:"Bloom Wide", scale:1.6, dur:0.46, price:660, shape:"bloom" },
  { id:"fx_bloom_slow", name:"Bloom Slow", scale:1.2, dur:0.62, price:790, shape:"bloom" },
  { id:"fx_bloom_rapid", name:"Bloom Rapid", scale:0.9, dur:0.2, price:920, shape:"bloom" },
  { id:"fx_shock_soft", name:"Shockwave Soft", scale:1.0, dur:0.42, price:1050, shape:"shock" },
  { id:"fx_shock_sharp", name:"Shockwave Sharp", scale:0.8, dur:0.26, price:1180, shape:"shock" },
  { id:"fx_shock_wide", name:"Shockwave Wide", scale:1.6, dur:0.46, price:1310, shape:"shock" },
  { id:"fx_shock_slow", name:"Shockwave Slow", scale:1.2, dur:0.62, price:1440, shape:"shock" },
  { id:"fx_shock_rapid", name:"Shockwave Rapid", scale:0.9, dur:0.2, price:1570, shape:"shock" },
  { id:"fx_pulse_soft", name:"Pulse Soft", scale:1.0, dur:0.42, price:1700, shape:"pulse" },
  { id:"fx_pulse_sharp", name:"Pulse Sharp", scale:0.8, dur:0.26, price:1830, shape:"pulse" },
  { id:"fx_pulse_wide", name:"Pulse Wide", scale:1.6, dur:0.46, price:1960, shape:"pulse" },
  { id:"fx_pulse_slow", name:"Pulse Slow", scale:1.2, dur:0.62, price:2090, shape:"pulse" },
  { id:"fx_pulse_rapid", name:"Pulse Rapid", scale:0.9, dur:0.2, price:2220, shape:"pulse" },
  { id:"fx_shatter_soft", name:"Shatter Soft", scale:1.0, dur:0.42, price:2350, shape:"shatter" },
  { id:"fx_shatter_sharp", name:"Shatter Sharp", scale:0.8, dur:0.26, price:2480, shape:"shatter" },
  { id:"fx_shatter_wide", name:"Shatter Wide", scale:1.6, dur:0.46, price:2610, shape:"shatter" },
  { id:"fx_shatter_slow", name:"Shatter Slow", scale:1.2, dur:0.62, price:2740, shape:"shatter" },
  { id:"fx_shatter_rapid", name:"Shatter Rapid", scale:0.9, dur:0.2, price:2870, shape:"shatter" },
  { id:"fx_ring_soft", name:"Ring Soft", scale:1.0, dur:0.42, price:3000, shape:"ring" },
  { id:"fx_ring_sharp", name:"Ring Sharp", scale:0.8, dur:0.26, price:3130, shape:"ring" },
  { id:"fx_ring_wide", name:"Ring Wide", scale:1.6, dur:0.46, price:3260, shape:"ring" },
  { id:"fx_ring_slow", name:"Ring Slow", scale:1.2, dur:0.62, price:3390, shape:"ring" },
  { id:"fx_ring_rapid", name:"Ring Rapid", scale:0.9, dur:0.2, price:3520, shape:"ring" },
  { id:"fx_burst_soft", name:"Burst Soft", scale:1.0, dur:0.42, price:3650, shape:"burst" },
  { id:"fx_burst_sharp", name:"Burst Sharp", scale:0.8, dur:0.26, price:3780, shape:"burst" },
  { id:"fx_burst_wide", name:"Burst Wide", scale:1.6, dur:0.46, price:3910, shape:"burst" },
  { id:"fx_burst_slow", name:"Burst Slow", scale:1.2, dur:0.62, price:4040, shape:"burst" },
  { id:"fx_burst_rapid", name:"Burst Rapid", scale:0.9, dur:0.2, price:4170, shape:"burst" },
];

const TRAIL_SHAPES = ['comet','ribbon','echo','spark','blade','plume'];

function applyTrailClass() {
  const b = document.body, r = document.documentElement.style;
  TRAIL_SHAPES.forEach(sh => b.classList.remove('trail-' + sh));

  const t = TRAILS.find(x => x.id === (currentSettings.trail || 'none'));
  if (!t || t.shape === 'none') {
    r.removeProperty('--tl-len'); r.removeProperty('--tl-op'); r.removeProperty('--tl-w');
    return;
  }
  b.classList.add('trail-' + t.shape);
  r.setProperty('--tl-len', t.len + 'px');
  r.setProperty('--tl-op',  String(t.op));
  r.setProperty('--tl-w',   String(t.w));
}

// The hit effect's shape drives the class, its profile the vars.
function applyHitFxVars() {
  const f = HIT_FX.find(x => x.id === (currentSettings.hitFx || 'bloom'));
  const r = document.documentElement.style;
  if (!f) return;
  r.setProperty('--fx-scale', String(f.scale || 1));
  r.setProperty('--fx-dur',   (f.dur || 0.34) + 's');
}

// Fired at the strike plane on a PERFECT. One element, removed
// when its animation ends — no pooling needed at this rate.
function spawnHitFx(lane) {
  const def = HIT_FX.find(x => x.id === (currentSettings.hitFx || 'bloom'));
  const fx  = def ? def.shape : 'bloom';
  if (!def || fx === 'none') return;
  if (window.RD_Lighting && window.RD_Lighting.isReducedMotion()) return;
  const host = laneEls[lane];
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'fx fx-' + fx;
  host.appendChild(el);
  setTimeout(() => el.remove(), 460);
}

function applyLevelTexture(lvl) {
  const b = document.body, r = document.documentElement.style;
  TEX_CLASSES.forEach(c => b.classList.remove(c));
  AREA_THEME_CLASSES.forEach(c => b.classList.remove(c));

  // The area recolours the whole app while you're in it, unless
  // the player has turned that off in Visuals.
  if (lvl && lvl.areaId && currentSettings.areaThemes !== false) {
    const area = CAM().areaById(lvl.areaId);
    if (area && area.theme) { b.classList.add(area.theme); b.classList.remove('light'); }
  }
  if (!lvl || !lvl.areaId || !CAM().textureFor) { clearLevelTexture(); return; }

  const t = CAM().textureFor(lvl.areaId, lvl.seed || 0);
  b.classList.add(t.cls);
  r.setProperty('--tex-angle', t.angle);
  r.setProperty('--tex-scale', t.scale);
  r.setProperty('--tex-op',    t.op);
}

function clearLevelTexture() {
  const b = document.body, r = document.documentElement.style;
  TEX_CLASSES.forEach(c => b.classList.remove(c));
  AREA_THEME_CLASSES.forEach(c => b.classList.remove(c));
  // Coming out of a (always dark) area, the base theme may be
  // light again.
  b.classList.toggle('light', themeIsLight(store.loadTheme()));
  r.removeProperty('--tex-angle');
  r.removeProperty('--tex-scale');
  r.removeProperty('--tex-op');
}

function restorePlayerInstrument() {
  if (window.RD_setInstrument) {
    window.RD_setInstrument(currentSettings.instrument || 'synth');
  }
}

function startGame(preQueue) {
  activeTiles.forEach(retireTile); activeTiles = [];
  maxLives = currentSettings.lives || 3;
  score = 0; combo = 0; lives = maxLives; streak = 0;
  beatAccum = 0; beatIdx = 0; gameTimeMs = 0;
  notesHit = 0;
  speedMult = overtime ? 2 : 1;
  currentBeatMs = Math.round(baseBeatMs / speedMult);

  const otBadge = document.getElementById('ot-badge');
  if (otBadge) otBadge.classList.toggle('show', overtime);
  fbTimers = [0,0,0,0]; lastTapT = {0:0,1:0,2:0,3:0};
  gameQueue = preQueue || buildQueue(gameLevel);
  notesTotal = gameQueue.length;
  scoreEl.textContent = '0'; comboEl.textContent = '×1'; comboEl.style.color = 'var(--tap)';
  spdBadge.textContent = '1.0×'; spdBadge.classList.remove('show');
  updateLives();

  // A level plays in the instrument it was written for. The
  // player's own choice is restored when they leave.
  if (window.RD_setInstrument) {
    window.RD_setInstrument(gameLevel.instrument
      || currentSettings.instrument || 'synth');
  }

  if (window.RD_setLaneFreqs && gameLevel.laneFreqs) window.RD_setLaneFreqs(gameLevel.laneFreqs);
  else if (window.RD_setLaneFreqs) window.RD_setLaneFreqs([261.63,329.63,392.00,523.25]);

  const bgM = gameLevel.bgMode || 'none';
  const bp  = gameLevel.bassPattern || [];
  if (window.RD_startBg) window.RD_startBg(bgM, gameLevel.bpm, bp.length ? bp : null);

  running = true; lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

// Coming back from a backgrounded or throttled tab, the frame clock
// is stale. dt is clamped below so the game cannot lurch, but resetting
// the reference point here means the first frame back is a normal one
// rather than a clamped catch-up. edge.js calls this on visibilitychange
// because Edge's Efficiency Mode throttles far harder than Chrome's.
window.RD_onResumeFromBackground = function () {
  lastT = performance.now();
};

function loop(now) {
  if (!running) return;
  const dt = Math.min(now - lastT, 80); lastT = now;
  gameTimeMs += dt;

  // Speed ramp: +10% per 60 s
  const newMult = 1 + Math.floor(gameTimeMs / 60000) * SPEED_INC * 60;
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
    if (t.done) { retireTile(t); activeTiles.splice(i,1); continue; }
    t.y += spd * dt;
    t.el.style.transform = 'translate3d(0,' + t.y + 'px,0)';
    if (t.y > th + (t.h || TILE_H)) {
      retireTile(t); activeTiles.splice(i,1);
      damage(t.lane); if (!running) return;
    }
  }

  for (let i = 0; i < 4; i++) {
    if (fbTimers[i] > 0) { fbTimers[i] -= dt; if (fbTimers[i] <= 0) fbEls[i].classList.remove('show'); }
  }
  raf = requestAnimationFrame(loop);
}

// ── Tap mechanic ──────────────────────────────────
function tapLane(lane) {
  if (!running) return;

  const isDtapLane = activeTiles.some(t => t.lane === lane && !t.done && t.type === 'dtap');
  laneEls[lane].classList.add(isDtapLane ? 'glow-dtap' : 'glow-tap');
  setTimeout(() => { laneEls[lane].classList.remove('glow-tap','glow-dtap'); }, 120);

  // Keycap physically depresses — the panel language applied to input
  const cap = document.getElementById('btn' + lane);
  if (cap) {
    cap.classList.add('pressed');
    setTimeout(() => cap.classList.remove('pressed'), 90);
  }

  const now = performance.now(), hl = hitY();
  let best = null, bestDist = Infinity;
  for (const t of activeTiles) {
    if (t.lane !== lane || t.done) continue;
    // Shift the judged position by the measured audio latency so
    // the hit lines up with what the player actually heard.
    const offsetPx = ((currentSettings.audioOffset || 0) / currentBeatMs) * (TILE_H * 4);
    const d = Math.abs((t.y + (t.h || TILE_H) / 2) - hl + offsetPx);
    if (d < bestDist) { bestDist = d; best = t; }
  }

  if (best && bestDist < hitTol()) {
    if (best.type === 'tap') {
      best.done = true; lastTapT[lane] = 0;
      if (window.RD_playNote) window.RD_playNote(lane, false, best.freq, best.sustain || 0, best.inst);
      hit(lane, bestDist);
    } else {
      if (!best.firstTapped) {
        best.firstTapped = true;
        best.el.classList.add('primed');
        lastTapT[lane] = now;
        if (window.RD_playNote) window.RD_playNote(lane, false, best.freq, best.sustain || 0, best.inst);
      } else {
        const el = now - lastTapT[lane];
        if (el <= DTAP_MS) {
          best.done = true; lastTapT[lane] = 0;
          if (window.RD_playNote) window.RD_playNote(lane, true, best.freq, best.sustain || 0, best.inst);
          hit(lane, bestDist);
        } else {
          best.firstTapped = false;
          best.el.classList.remove('primed');
          lastTapT[lane] = now;
          damage(lane);
        }
      }
    }
  } else {
    lastTapT[lane] = 0;
    damage(lane);
  }
}

function hit(lane, dist) {
  combo++;
  streak++;
  notesHit++;
  const pct = dist / hitTol();
  let pts, label, color;
  if      (pct < 0.2) { pts = 300; label = 'PERFECT'; color = 'var(--perfect)'; spawnHitFx(lane); }
  else if (pct < 0.6) { pts = 150; label = 'GREAT';   color = 'var(--good)'; }
  else                { pts = 60;  label = 'GOOD';    color = 'var(--tap)'; }
  // Combo multiplier: 8% per combo hit
  pts = Math.round(pts * (1 + (combo - 1) * 0.08));
  // Streak bonus: 5% per consecutive streak
  if (streak > 1) pts = Math.round(pts * (1 + (streak - 1) * 0.05));
  score += pts; scoreEl.textContent = score;
  comboEl.textContent = '×' + combo;
  comboEl.style.color = combo >= 10 ? 'var(--dtap)' : combo >= 5 ? 'var(--perfect)' : 'var(--tap)';
  showFb(lane, label, color);
}

function damage(lane) {
  combo = 0; streak = 0;
  comboEl.textContent = '×1'; comboEl.style.color = 'var(--tap)';
  lives = Math.max(0, lives - 1); updateLives();
  showFb(lane, 'MISS', 'var(--miss)');
  if (lives <= 0) endGame(false);
}

// Numbers count up rather than snapping — the score landing
// is the payoff of the run, so it gets a beat of its own.
function countUp(el, target, ms) {
  if (window.RD_Lighting && window.RD_Lighting.isReducedMotion()) {
    el.textContent = target.toLocaleString(); return;
  }
  const start = performance.now();
  // rAF, not setInterval: a 16ms timer drifts against the refresh rate
  // and lands two updates in one frame and none in the next, which is
  // what made the score counter stutter on the results card.
  if (el._cu) cancelAnimationFrame(el._cu);
  const step = () => {
    const p = Math.min(1, (performance.now() - start) / ms);
    // ease-out so it decelerates into the final number
    const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
    el.textContent = v.toLocaleString();
    if (p < 1) el._cu = requestAnimationFrame(step);
    else { el._cu = 0; el.textContent = target.toLocaleString(); }
  };
  el._cu = requestAnimationFrame(step);
}

function tickCoins(el, total) {
  if (total <= 0) { el.textContent = '+0 coins earned'; return; }
  const steps = Math.min(total, 14);
  let i = 0;
  clearInterval(el._tk);
  el._tk = setInterval(() => {
    i++;
    const v = Math.round((i / steps) * total);
    el.textContent = '+' + v + ' coins earned';
    uiSound('tick');
    if (i >= steps) { clearInterval(el._tk); el.textContent = '+' + total + ' coins earned'; }
  }, 70);
}

function updateLives() {
  // Rebuild only if the count changed, so the losing pip can
  // animate out instead of the whole row flashing.
  if (livesEl.children.length !== maxLives) {
    livesEl.innerHTML = '';
    for (let i = 0; i < maxLives; i++) {
      const p = document.createElement('div');
      p.className = 'pip';
      livesEl.appendChild(p);
    }
  }
  Array.from(livesEl.children).forEach((p, i) => {
    const shouldBeLit = i < lives;
    const wasLit = p.classList.contains('lit');
    if (wasLit && !shouldBeLit) {
      p.classList.add('losing');
      setTimeout(() => p.classList.remove('losing'), 340);
    }
    p.classList.toggle('lit', shouldBeLit);
  });
}

function showFb(lane, text, color) {
  fbEls[lane].textContent = text; fbEls[lane].style.color = color;
  fbEls[lane].classList.add('show'); fbTimers[lane] = 520;
}

function endGame(won) {
  running = false; cancelAnimationFrame(raf);
  activeTiles.forEach(retireTile); activeTiles = [];
  if (window.RD_stopBg) window.RD_stopBg();
  if (window.RD_resetLaneFreqs) window.RD_resetLaneFreqs();

  // Award currency and save high score
  const levelName = gameLevel ? gameLevel.name : 'Unknown';
  const isCampaign = !!(gameLevel && gameLevel.campaign);

  // Custom levels pay half. Procedural levels are generated
  // rather than self-authored, so they can't be farmed and pay full.
  const isGenerated = isCampaign || !!(gameLevel && gameLevel.procedural);

  // The Double pays double coins and no XP at all. It is a wager
  // for money, not a way to shortcut progression — which is why
  // it also can't clear a level you haven't already cleared.
  const coinMult = overtime ? 2 : (isGenerated ? 1 : 0.5);
  const coinsEarned = addHighScore(profile.username || 'Player', score, levelName, coinMult);

  // The run log keeps the top 50 overall; this keeps THIS level's best
  // forever, so a personal record on song 7 survives fifty better runs
  // elsewhere. The Double is a different record from the standard cut.
  const bestBefore = bestFor(gameLevel);
  const newRecord = recordLevelBest(
    Object.assign({}, gameLevel, { double: overtime || gameLevel.double }),
    score, coinsEarned);

  // A loss pays out on the share of the chart actually struck.
  const runProgress = notesTotal ? notesHit / notesTotal : 0;
  const xpGain = overtime
    ? 0
    : CAM().xpFor(gameLevel, { completed: won, progress: runProgress });
  const xpRes  = xpGain ? grantXp(xpGain) : { gained: 0, levelUp: false, level: CAM().levelFromXp(progress.xp) };

  let earnedAvatars = [];
  if (won && isCampaign && !overtime) {
    progress.cleared[levelKey(gameLevel.areaId, gameLevel.levelIdx, gameLevel.double)] = true;
    saveProgress();
    earnedAvatars = syncAreaRewards();
  }

  lvlName.textContent = gameLevel
    ? (gameLevel.name + (gameLevel.areaName ? ' · ' + gameLevel.areaName : ''))
    : '';
  ovTitle.innerHTML = overtime
    ? (won ? 'Double <span>Survived!</span>' : 'Double <span>Over</span>')
    : (won ? 'Level <span>Clear!</span>' : 'Game <span>Over</span>');
  ovScore.style.display = 'block'; ovScLbl.style.display = 'block';
  countUp(ovScore, score, 900);

  const ovCurr = document.getElementById('ov-currency-reward');
  if (ovCurr) {
    ovCurr.style.display = 'block';
    ovCurr.textContent = '+0 coins earned';
    // Coins tick up after the score lands, with a sound per tick.
    setTimeout(() => tickCoins(ovCurr, coinsEarned), 950);
  }
  const ovXp = document.getElementById('ov-xp');
  if (ovXp) {
    ovXp.style.display = 'block';
    const xpNote = [];
    if (!isGenerated) xpNote.push('custom, halved');
    if (!won) xpNote.push(Math.round(runProgress * 100) + '% of the chart');
    ovXp.textContent = overtime
      ? 'No XP on the Double · coins doubled'
      : '+' + xpGain + ' XP' + (xpNote.length ? ' (' + xpNote.join(' · ') + ')' : '');
  }
  const ovLv = document.getElementById('ov-levelup');
  if (ovLv) {
    ovLv.style.display = xpRes.levelUp ? 'block' : 'none';
    if (xpRes.levelUp) { ovLv.textContent = 'LEVEL ' + xpRes.level; uiSound('purchase'); }
  }
  renderXpStrip();

  // Procedural runs show their code so you can pass it on.
  const ovCode = document.getElementById('ov-code');
  if (ovCode) {
    const sc = gameLevel && gameLevel.shareCode;
    ovCode.style.display = sc ? 'block' : 'none';
    if (sc) {
      ovCode.textContent = 'CODE ' + sc;
      ovCode.onclick = () => copyText(sc, 'Code ' + sc + ' copied', 'Copy this level code:');
    }
  }

  const ovStreak = document.getElementById('ov-streak-bonus');
  if (ovStreak) {
    // A personal best on this song is the more interesting fact, so it
    // takes the line when there is one.
    if (newRecord && bestBefore) {
      ovStreak.style.display = 'block';
      ovStreak.textContent = 'New best on this song — beat '
        + bestBefore.score.toLocaleString();
    } else if (newRecord) {
      ovStreak.style.display = 'block';
      ovStreak.textContent = 'First clear recorded';
    } else if (streak > 1) {
      ovStreak.style.display = 'block';
      ovStreak.textContent = 'Streak bonus applied (+' + (streak - 1) * 5 + '%)';
    } else {
      ovStreak.style.display = 'none';
    }
  }

  // The Double: the same song at double speed. Offered every time
  // you finish a level, and only then — you have to have played the
  // whole thing to earn the run at it. Never chained out of itself.
  const otBtn = document.getElementById('ov-overtime');
  if (otBtn) {
    const canOvertime = won && !overtime;
    otBtn.classList.toggle('show', canOvertime);
    if (canOvertime) {
      otBtn.onclick = () => {
        overlay.classList.remove('show');
        if (ovCurr) ovCurr.style.display = 'none';
        if (ovXp)   ovXp.style.display = 'none';
        if (ovLv)   ovLv.style.display = 'none';
        if (ovCode) ovCode.style.display = 'none';
        otBtn.classList.remove('show');
        startOvertime();
      };
    }
  }

  if (earnedAvatars.length) {
    setTimeout(() => {
      showToast('Area complete — unlocked ' + earnedAvatars.map(a => a.name).join(' & '));
      uiSound('purchase');
    }, 1400);
  }

  ovBtn.textContent = 'Play Again';
  ovBtn.onclick = () => {
    overtime = false;
    if (otBtn) otBtn.classList.remove('show');
    if (ovCurr) ovCurr.style.display = 'none';
    if (ovStreak) ovStreak.style.display = 'none';
    if (ovXp) ovXp.style.display = 'none';
    if (ovCode) ovCode.style.display = 'none';
    if (ovLv) ovLv.style.display = 'none';
    overlay.classList.remove('show'); beginLevel();
  };
  overlay.classList.add('show');
}

function quitToMenu() {
  uiSound('thunk');
  retractPanel();
  overtime = false;
  const otb = document.getElementById('ot-badge');
  if (otb) otb.classList.remove('show');
  restorePlayerInstrument();
  clearLevelTexture();
  running = false; cancelAnimationFrame(raf);
  if (window.RD_Loading) window.RD_Loading.cancel();
  activeTiles.forEach(retireTile); activeTiles = [];
  if (window.RD_stopBg) window.RD_stopBg();
  if (window.RD_resetLaneFreqs) window.RD_resetLaneFreqs();
  showScreen('home'); renderHome();
}

// ── Settings ──────────────────────────────────────
const DEFAULT_SETTINGS = {
  keys: ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  width: 420,
  height: 640,
  lives: 3,
  instrument: 'synth',
  hitWindow: 'normal',   // strict | normal | forgiving
  trail: 'none',         // none | comet | ribbon | echo | spark
  hitFx: 'bloom',        // none | bloom | shock | pulse | shatter
  areaThemes: true,      // let each area recolour the app while you play it
  laneStyle: 'keycap',   // keycap | light
  audioOffset: 0,        // ms, measured by the calibration tool
};

// Hit window is where difficulty flexes. Note speed deliberately
// is NOT adjustable — speed is part of what a chart is, and a
// level played slower isn't the same level, which would make
// leaderboard scores incomparable.
const HIT_WINDOWS = {
  strict:    { label:'Strict',    mult:0.7,  note:'Tighter timing, higher skill ceiling' },
  normal:    { label:'Normal',    mult:1.0,  note:'The designed difficulty' },
  forgiving: { label:'Forgiving', mult:1.45, note:'Wider timing, easier to finish' },
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
    if (saved.hitWindow)  currentSettings.hitWindow  = saved.hitWindow;
    if (saved.laneStyle)  currentSettings.laneStyle  = saved.laneStyle;
    if (saved.trail)      currentSettings.trail      = saved.trail;
    if (saved.hitFx)      currentSettings.hitFx      = saved.hitFx;
    if (typeof saved.areaThemes === 'boolean') currentSettings.areaThemes = saved.areaThemes;
    if (typeof saved.audioOffset === 'number') currentSettings.audioOffset = saved.audioOffset;
  }
  applySettingsToDOM();
  // Apply saved instrument to audio engine
  if (window.RD_saveInstrument) window.RD_saveInstrument(currentSettings.instrument || 'synth');
}

// Plays 8 metronome beats and measures the mean offset between
// each beat and the player's tap. Median-of-taps, outliers dropped.
function runCalibration(btn) {
  const BEATS = 8, INTERVAL = 600;
  const taps = [], beats = [];
  let n = 0, done = false;
  const orig = btn.textContent;

  function onTap(e) {
    if (e.code === 'Space' || e.type === 'click') {
      e.preventDefault();
      taps.push(performance.now());
    }
  }
  window.addEventListener('keydown', onTap);
  btn.addEventListener('click', onTap);

  btn.textContent = 'Tap SPACE on each beat…';
  btn.style.borderColor = 'var(--accent)';
  btn.style.color = 'var(--accent)';

  const timer = setInterval(() => {
    if (n >= BEATS) {
      clearInterval(timer);
      finish();
      return;
    }
    beats.push(performance.now());
    if (window.RD_playNoteFreq) {
      try { window.RD_playNoteFreq(n % 4 === 0 ? 523.25 : 392.00, false, 0); } catch (err) {}
    }
    n++;
  }, INTERVAL);

  function finish() {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', onTap);
    btn.removeEventListener('click', onTap);
    btn.style.borderColor = '';
    btn.style.color = '';

    // Pair each tap with its nearest beat, drop wild misses.
    const diffs = [];
    taps.forEach(t => {
      let best = Infinity;
      beats.forEach(b => { const d = t - b; if (Math.abs(d) < Math.abs(best)) best = d; });
      if (Math.abs(best) < INTERVAL / 2) diffs.push(best);
    });

    if (diffs.length < 4) {
      btn.textContent = 'Not enough taps — try again';
      setTimeout(() => { btn.textContent = orig; }, 2200);
      return;
    }
    diffs.sort((a, b) => a - b);
    const median = Math.round(diffs[Math.floor(diffs.length / 2)]);
    currentSettings.audioOffset = median;
    store.saveSettings(currentSettings);
    const v = document.getElementById('cal-val');
    if (v) v.textContent = median + ' ms';
    btn.textContent = 'Calibrated · ' + median + ' ms';
    setTimeout(() => { btn.textContent = orig; }, 2400);
  }
}

function applySettingsToDOM() {
  applyTrailClass();
  applyHitFxVars();
  // Bindings may have just changed; the keydown handler reads a cached
  // map rather than rebuilding one per keystroke.
  if (typeof refreshKeyMap === 'function') refreshKeyMap();
  document.body.classList.toggle('lane-light',
    (currentSettings.laneStyle || 'keycap') === 'light');
  document.documentElement.style.width  = currentSettings.width  + 'px';
  document.documentElement.style.height = currentSettings.height + 'px';
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

// The lane keys are live outside a level too, so you can noodle on the
// four notes from the menus. That must never cost you a keystroke you
// meant for a text field: the handler used to preventDefault() on every
// A/S/D/F anywhere, so a level code typed into the code box came out
// empty, a level named "Sad Ballad" came out " Bll", and a stray Q
// while naming a level quit the creator out from under you.
function keyboardIsCaptured() {
  const el = document.activeElement;
  if (el) {
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
      return true;
    }
  }
  // A modal owns the keyboard while it is up.
  for (const id of ['tut-modal', 'box-modal']) {
    const m = document.getElementById(id);
    if (m && m.classList.contains('show')) return true;
  }
  // The note picker is built on demand, so its presence is its state.
  return !!document.getElementById('note-picker-modal');
}

// Rebuilt only when the bindings change, not on every keystroke.
let KEY_MAP = buildKeyMap();
function refreshKeyMap() { KEY_MAP = buildKeyMap(); }

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (keyboardIsCaptured()) return;

  if (e.code in KEY_MAP) {
    e.preventDefault();
    const lane = KEY_MAP[e.code];
    if (running) {
      // In-game: normal tap mechanic
      tapLane(lane);
    } else if (window.RD_playNote) {
      // Outside a level: sound the lane, and light its key if the
      // board happens to be on screen.
      const freq = crLaneFreqs[lane] || [261.63, 329.63, 392.00, 523.25][lane];
      window.RD_playNote(lane, false, freq);
      const cap = document.getElementById('btn' + lane);
      if (cap) {
        cap.classList.add('pressed');
        setTimeout(() => cap.classList.remove('pressed'), 90);
      }
    }
    return;
  }

  // R and Q belong to the board. Q has to keep working on the results
  // card, where `running` is already false, but must not fire from the
  // menus — it used to quit the creator from anywhere.
  const active = document.querySelector('.screen.active');
  const onBoard = active && active.id === 'game';
  if (e.code === 'KeyR' && running) { running = false; cancelAnimationFrame(raf); beginLevel(); }
  if (e.code === 'KeyQ' && onBoard) quitToMenu();
});

btnEls.forEach((el, i) => {
  el.addEventListener('click',      ()  => tapLane(i));
  el.addEventListener('touchstart', ev => { ev.preventDefault(); tapLane(i); });
});

// Avatar click -> full profile
const pbarAvatar = document.getElementById('pbar-avatar');
if (pbarAvatar) {
  pbarAvatar.title = 'View profile';
  pbarAvatar.addEventListener('click', () => {
    showScreen('profile-screen');
    renderProfile();
  });
}

document.getElementById('g-menu-btn').addEventListener('click', quitToMenu);

// ── Boot ──────────────────────────────────────────
loadAndApplySettings();
applyTheme(store.loadTheme());
const ct = store.loadCustomTheme();
if (ct && store.loadTheme() === 'custom') applyCustomTheme(ct);

// ══════════════════════════════════════
//  FIRST-RUN TUTORIAL
//  Four cards, once, on the first launch. Everything here is a
//  rule you cannot infer from looking at the board — the double
//  tap especially, which players otherwise meet as an unexplained
//  miss. Replayable from Settings so it is never lost for good.
// ══════════════════════════════════════
const TUTORIAL = [
  {
    title: 'Notes fall. You catch them.',
    body: 'Four lanes, four keys — <b>A S D F</b> by default. Hit the key for a lane the moment its note reaches the <b>line</b>. Closer to the line means more points: GOOD, GREAT, then PERFECT.',
    art:  [{ lane:0, y:6 }, { lane:2, y:24 }, { lane:1, y:40 }],
  },
  {
    title: 'Bright notes need two taps.',
    body: 'A note in the <b>second colour</b> is a double — tap its key <b>twice, quickly</b>. One tap arms it, the second lands it. Too slow and it breaks and costs you a life.',
    art:  [{ lane:1, y:10, dtap:true }, { lane:3, y:34, dtap:true }],
  },
  {
    title: 'Long notes ring on.',
    body: 'A <b>tall</b> note is held. Catch it like any other — it simply sounds for longer, so the melody carries. From about the third area on, most songs use them.',
    art:  [{ lane:2, y:8, hold:true }],
  },
  {
    title: 'Clear songs, open the map.',
    body: 'Every song pays <b>XP</b> and <b>coins</b>. Clearing one unlocks the next; clearing all fifteen opens the next era — new palette, new instrument, new scale. Ten eras, then Endless.',
    art:  [{ lane:0, y:8 }, { lane:1, y:20 }, { lane:2, y:32 }, { lane:3, y:44 }],
  },
];

let tutIdx = 0;

function tutorialSeen()     { return localStorage.getItem('rd_tutorial') === '1'; }
function markTutorialSeen() { localStorage.setItem('rd_tutorial', '1'); }

function renderTutorial() {
  const card = TUTORIAL[tutIdx];
  if (!card) return closeTutorial();

  const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
  set('tut-step', 'Step ' + (tutIdx + 1) + ' of ' + TUTORIAL.length);
  set('tut-title', card.title);

  const body = document.getElementById('tut-body');
  if (body) body.innerHTML = card.body;

  // The four-lane diagram, rebuilt per card.
  const art = document.getElementById('tut-art');
  if (art) {
    art.innerHTML = '';
    const caps = currentSettings.keys.map(c => (c.startsWith('Key') ? c.slice(3) : keyCodeLabel(c)));
    for (let i = 0; i < 4; i++) {
      const lane = document.createElement('div');
      lane.className = 'tut-lane';
      card.art.filter(n => n.lane === i).forEach(n => {
        const el = document.createElement('div');
        el.className = 'tut-note' + (n.dtap ? ' d' : '') + (n.hold ? ' hold' : '');
        el.style.top = n.y + 'px';
        lane.appendChild(el);
      });
      const cap = document.createElement('div');
      cap.className = 'tut-cap';
      cap.textContent = caps[i] || ['A','S','D','F'][i];
      lane.appendChild(cap);
      art.appendChild(lane);
    }
    const plane = document.createElement('div');
    plane.className = 'tut-plane';
    art.appendChild(plane);
  }

  const dots = document.getElementById('tut-dots');
  if (dots) {
    dots.innerHTML = '';
    TUTORIAL.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'tut-dot' + (i === tutIdx ? ' on' : '');
      dots.appendChild(d);
    });
  }

  const next = document.getElementById('tut-next');
  if (next) next.textContent = tutIdx === TUTORIAL.length - 1 ? 'Play' : 'Next';
}

function openTutorial() {
  tutIdx = 0;
  const m = document.getElementById('tut-modal');
  if (!m) return;
  renderTutorial();
  m.classList.add('show');
}

function closeTutorial() {
  const m = document.getElementById('tut-modal');
  if (m) m.classList.remove('show');
  markTutorialSeen();
}

(function wireTutorial() {
  const next = document.getElementById('tut-next');
  const skip = document.getElementById('tut-skip');
  if (next) next.addEventListener('click', () => {
    uiSound('detent');
    if (tutIdx >= TUTORIAL.length - 1) closeTutorial();
    else { tutIdx++; renderTutorial(); }
  });
  if (skip) skip.addEventListener('click', closeTutorial);
})();

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
    // The rules land once the player is actually looking at the game.
    if (!tutorialSeen()) openTutorial();
  });
  if (unameInput) {
    unameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') unameConfirm.click();
    });
  }
}

// First-boot restore path
(function wireBootSync() {
  const alt   = document.getElementById('uname-restore');
  const pane  = document.getElementById('uname-sync');
  const box   = document.getElementById('uname-sync-box');
  const go    = document.getElementById('uname-sync-go');
  const back  = document.getElementById('uname-sync-back');
  if (!alt || !pane) return;

  alt.addEventListener('click', () => { pane.classList.add('show'); box.focus(); });
  back.addEventListener('click', () => { pane.classList.remove('show'); });

  go.addEventListener('click', () => {
    const code = box.value.trim();
    if (!code) { showToast('Paste your sync code', true); return; }
    try {
      const r = applySyncCode(code);
      showScreen('home');
      renderHome();
      showToast('Welcome back, ' + r.name);
    } catch (err) {
      showToast('Invalid sync code', true);
    }
  });
})();

if (store.loadTheme() === 'custom') {
  const form = document.getElementById('custom-theme-form');
  if (form) { form.classList.add('show'); syncCtInputs(); }
}

if (!profile.username) {
  showScreen('username-screen');
} else {
  showScreen('home');
  renderHome();
  // Players who already had a profile before the tutorial existed
  // still get it once, behind the boot splash.
  if (!tutorialSeen()) setTimeout(openTutorial, 900);
}
