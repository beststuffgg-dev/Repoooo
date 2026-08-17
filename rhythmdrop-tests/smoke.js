// Boots RhythmDrop in jsdom and reports any runtime error.
// Catches the class of bug that only appears when the code
// actually runs — undefined refs, null DOM lookups on boot,
// broken handlers — which linting can't see.
const { JSDOM } = require('jsdom');
// ── Locate the extension ──
// Looks next to this folder, then inside it, then falls back to
// the APP_DIR environment variable. Works from a checkout, a
// download folder, or CI without editing anything.
const path = require('path');
const fs = require('fs');
function findApp() {
  if (process.env.APP_DIR) return process.env.APP_DIR;
  const tries = [
    path.join(__dirname, '..', 'RhythmDropV7'),
    path.join(__dirname, 'RhythmDropV7'),
    path.join(process.cwd(), 'RhythmDropV7'),
    path.join(__dirname, '..'),
  ];
  for (const t of tries) {
    if (fs.existsSync(path.join(t, 'popup.html'))) return t;
  }
  console.error('Could not find RhythmDropV7/popup.html.');
  console.error('Put this folder beside the extension, or set APP_DIR=/path/to/RhythmDropV7');
  process.exit(2);
}
const DIR = findApp();


const html = fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8');

const errors = [];
const logs = [];

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://localhost/',
});
const { window } = dom;

window.onerror = (m) => errors.push('window.onerror: ' + m);

// Web Audio stub — enough surface for the engine to build graphs.
function stubNode(extra = {}) {
  return Object.assign({
    connect() { return this; },
    disconnect() {},
    start() {}, stop() {},
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    gain:      { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    Q:         { value: 1 },
    // DynamicsCompressorNode params (master-bus limiter)
    threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 1 },
    attack:    { value: 0 }, release: { value: 0 },
    type: '',
    buffer: null,
  }, extra);
}
window.AudioContext = function () {
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: stubNode(),
    resume() { return Promise.resolve(); },
    createOscillator: () => stubNode(),
    createGain: () => stubNode(),
    createBiquadFilter: () => stubNode(),
    createDynamicsCompressor: () => stubNode(),
    createBufferSource: () => stubNode(),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
};

window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.scrollTo = () => {};
if (!window.document.fonts) window.document.fonts = { ready: Promise.resolve() };

const origError = window.console.error;
window.console.error = (...a) => { logs.push('console.error: ' + a.join(' ')); };
window.console.warn = () => {};

// Fund the test account so shop paths are reachable, but leave
// username null so the first-boot flow still runs.
window.localStorage.setItem('rd_profile',
  JSON.stringify({ username: null, coins: 9999, bestScore: 0 }));

// Run the scripts in load order.
for (const f of ['lighting.js', 'campaign.js', 'codec.js', 'loading.js', 'audio.js', 'game.js']) {
  try {
    window.eval(fs.readFileSync(path.join(DIR, f), 'utf8'));
    console.log('  loaded ' + f);
  } catch (e) {
    errors.push(f + ' THREW: ' + e.message + '\n    ' + (e.stack || '').split('\n')[1]);
  }
}

// Exercise the paths a user hits immediately.
const probes = [
  ['set username', () => {
    window.document.getElementById('uname-input').value = 'TestUser';
    window.document.getElementById('uname-confirm').click();
  }],
  ['open each tab', () => {
    window.document.querySelectorAll('.hnav').forEach(t => t.click());
  }],
  ['apply every theme', () => {
    window.document.querySelectorAll('.theme-card').forEach(c => c.click());
  }],
  ['edit custom theme', () => {
    const bg = window.document.getElementById('ct-bg');
    bg.value = '#EDE8DE';
    bg.dispatchEvent(new window.Event('input'));
    window.document.querySelectorAll('.ct-mat').forEach(m => m.click());
    window.document.getElementById('ct-apply').click();
  }],
  ['settings panel', () => {
    const p = window.document.getElementById('tab-settings');
    if (!p.children.length) throw new Error('settings panel empty');
    p.querySelectorAll('button').forEach(b => {
      if (!/Calibrate|Reset/i.test(b.textContent)) b.click();
    });
  }],
  ['launch a campaign level', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="levels"]').click();
    const row = D.querySelector('#cam-scroll .lvl-row:not(.locked)');
    if (!row) throw new Error('no playable song');
    row.click();
    if (!D.getElementById('game').classList.contains('active')) throw new Error('game did not open');
  }],
  // Beta 14 split the campaign into one tab per era: the pane renders
  // only the open era, so the ten blocks are now ten tabs.
  ['campaign era tabs', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="levels"]').click();
    const tabs = D.querySelectorAll('#cam-areas .cam-tab');
    if (tabs.length !== 11) throw new Error('expected 10 eras + Endless, got ' + tabs.length);
    if (!/Farmstead/.test(tabs[0].textContent)) throw new Error('first tab is not Farmstead');
    if (!/Endless/.test(tabs[10].textContent)) throw new Error('last tab is not Endless');
    const locked = [...tabs].filter(t => t.classList.contains('locked')).length;
    if (locked !== 10) throw new Error('expected 9 eras + Endless locked, got ' + locked);
    if (D.querySelectorAll('#cam-areas .cam-tab.active').length !== 1)
      throw new Error('exactly one era should be open');
    const blocks = D.querySelectorAll('#cam-scroll .theme-block');
    if (blocks.length !== 1) throw new Error('one era at a time, got ' + blocks.length);
    logs.push('  11 tabs (10 eras + Endless), ' + locked + ' locked, one era rendered');
  }],
  ['switching era tab swaps the songs', () => {
    const D = window.document;
    const tabs = D.querySelectorAll('#cam-areas .cam-tab');
    const before = D.querySelector('#cam-scroll .tb-name').textContent;
    tabs[2].click();
    const after = D.querySelector('#cam-scroll .tb-name').textContent;
    if (before === after) throw new Error('era did not change');
    if (D.querySelectorAll('#cam-scroll .lvl-row').length !== 15)
      throw new Error('era should show 15 songs');
    tabs[10].click();
    if (!D.querySelector('#cam-scroll .endless-block')) throw new Error('no Endless block on its tab');
    tabs[0].click();
    logs.push('  ' + before + ' -> ' + after + ' -> Endless -> back');
  }],
  ['theme 1 shows 15 songs, only the first playable', () => {
    const D = window.document;
    const first = D.querySelector('#cam-scroll .theme-block:not(.locked)');
    if (!first) throw new Error('no unlocked theme');
    const rows = first.querySelectorAll('.lvl-row');
    if (rows.length !== 15) throw new Error('expected 15 songs, got ' + rows.length);
    const open = first.querySelectorAll('.lvl-row:not(.locked)').length;
    if (open !== 1) throw new Error('expected 1 playable song, got ' + open);
    if (!first.querySelector('.lvl-row.current')) throw new Error('next song not highlighted');
    const title = rows[0].querySelector('.lvl-song').textContent;
    const facts = rows[0].querySelector('.lvl-facts').textContent;
    if (!title || /^\s*$/.test(title)) throw new Error('song has no title');
    logs.push('  first song: "' + title + '" — ' + facts);
  }],
  ['locked eras still show their songs behind the veil', () => {
    const D = window.document;
    D.querySelectorAll('#cam-areas .cam-tab')[3].click();   // a locked era
    const locked = D.querySelector('#cam-scroll .theme-block.locked');
    if (!locked) throw new Error('locked era did not render');
    const rows = locked.querySelectorAll('.lvl-row');
    if (rows.length !== 15) throw new Error('locked era hides its songs');
    if (!locked.querySelector('.tb-veil .ic')) throw new Error('no lock icon');
    D.querySelectorAll('#cam-areas .cam-tab')[0].click();
  }],
  ['prize track renders', () => {
    const D = window.document;
    const nodes = D.querySelectorAll('#prize-track .pt-node');
    if (nodes.length !== 3) throw new Error('expected 3 prizes, got ' + nodes.length);
    logs.push('  prize track: ' + [...nodes].map(n =>
      n.querySelector('.pt-label').textContent.replace(/\s+/g,' ')).join(' | '));
  }],
  ['xp strip renders', () => {
    const D = window.document;
    if (!D.getElementById('xp-lv').textContent) throw new Error('no level shown');
    logs.push('  xp: level ' + D.getElementById('xp-lv').textContent +
              ' (' + D.getElementById('xp-num').textContent + ')');
  }],
  ['round-trip a level through export', () => {
    const lvl = { name:'Probe', bpm:120, bgMode:'none',
      laneFreqs:[261.63,329.63,392.00,523.25], bassPattern:[],
      grid:[[{type:'tap',freq:261.63,sustain:0},null,null,null],
            [null,null,{type:'dtap',freq:392,sustain:1.5},null]] };
    const code = window.RD_Codec.encodeLevel(lvl);
    const back = window.RD_Codec.decodeLevel(code);
    if (JSON.stringify(back.grid) !== JSON.stringify(lvl.grid)) throw new Error('grid mismatch');
    logs.push('  level code: ' + code.length + ' chars');
  }],
  ['sync generate + restore in settings', () => {
    window.document.querySelector('.hnav[data-tab="settings"]').click();
    const btns = [...window.document.querySelectorAll('#tab-settings .sync-btn')];
    if (btns.length !== 3) throw new Error('expected 3 sync buttons, got ' + btns.length);
    btns[0].click();  // Generate
    const box = window.document.getElementById('sync-box');
    if (!box.value.startsWith('RDSYNC1:')) throw new Error('no code generated');
    logs.push('  sync code: ' + box.value.length + ' chars');
    btns[2].click();  // Restore its own code — must not corrupt anything
    if (!window.document.getElementById('pbar-username').textContent) throw new Error('profile lost');
  }],
  ['first-boot restore panel', () => {
    const alt = window.document.getElementById('uname-restore');
    if (!alt) throw new Error('restore button missing');
    alt.click();
    if (!window.document.getElementById('uname-sync').classList.contains('show'))
      throw new Error('sync panel did not open');
  }],
  ['lane style toggle', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="settings"]').click();
    const opts = [...D.querySelectorAll('#tab-settings .style-opt')];
    if (opts.length !== 2) throw new Error('expected 2 style options, got ' + opts.length);
    opts[1].click();                                  // pick Light
    if (!D.body.classList.contains('lane-light')) throw new Error('lane-light class not applied');
    logs.push('  after picking Light, body = "' + D.body.className + '"');

    // theme switch must not drop the lane class
    D.querySelector('.hnav[data-tab="themes"]').click();
    const walnut = D.querySelector('.theme-card[data-theme="walnut"]');
    if (walnut) walnut.click();
    if (!D.body.classList.contains('lane-light'))
      throw new Error('lane style lost when theme changed: "' + D.body.className + '"');
    logs.push('  after theme change, body = "' + D.body.className + '"');

    // and back to Button
    D.querySelector('.hnav[data-tab="settings"]').click();
    [...D.querySelectorAll('#tab-settings .style-opt')][0].click();
    if (D.body.classList.contains('lane-light')) throw new Error('did not revert to keycap');
  }],
  ['avatars are SVG, not emoji', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="shop"]').click();
    const svgs = D.querySelectorAll('#shop-avatar-grid .avatar-thumb svg.av');
    if (svgs.length < 9) throw new Error('expected at least 9 SVG avatars, got ' + svgs.length);
    const uses = [...D.querySelectorAll('#shop-avatar-grid use')].map(u => u.getAttribute('href'));
    uses.forEach(h => { if (!D.querySelector(h)) throw new Error('missing symbol ' + h); });
    logs.push('  avatar symbols resolved: ' + uses.length);
  }],
  ['colourway changes avatar tint', () => {
    const D = window.document;
    const sw = [...D.querySelectorAll('#shop-colourways .cw')];
    if (sw.length !== 7) throw new Error('expected 7 colourways (As drawn + 6 tints), got ' + sw.length);
    // buy one so there is something equipped to tint
    const card = D.querySelector('#shop-avatar-grid .avatar-card');
    card.click();
    const before = D.querySelector('#pbar-avatar svg.av').style.getPropertyValue('--av-p');
    // index 0 is 'As drawn'; pick a real tint
    sw[4].click();
    const after = D.querySelector('#pbar-avatar svg.av').style.getPropertyValue('--av-p');
    if (before === after) throw new Error('tint did not change (' + before + ')');
    logs.push('  tint ' + (before || 'as-drawn') + ' -> ' + after);
  }],
  ['profile screen', () => {
    const D = window.document;
    D.getElementById('pbar-avatar').click();
    if (!D.getElementById('profile-screen').classList.contains('active'))
      throw new Error('profile screen did not open');
    const stats = D.querySelectorAll('#pf-stats .pf-stat');
    if (stats.length !== 6) throw new Error('expected 6 stat tiles, got ' + stats.length);
    logs.push('  stats: ' + [...stats].map(s =>
      s.querySelector('.pf-stat-l').textContent + '=' + s.querySelector('.pf-stat-v').textContent).join(', '));
    if (!D.querySelectorAll('#pf-avatars .pf-slot').length) throw new Error('no avatar slots');
    if (!D.querySelectorAll('#pf-colourways .cw').length) throw new Error('no colourways');
    if (!D.getElementById('pf-av').querySelector('svg.av')) throw new Error('no hero avatar');
    D.getElementById('pf-back').click();
    if (!D.getElementById('home').classList.contains('active')) throw new Error('back failed');
  }],
  ['equipping from profile persists', () => {
    const D = window.document;
    D.getElementById('pbar-avatar').click();
    const owned = [...D.querySelectorAll('#pf-avatars .pf-slot:not(.locked)')];
    if (!owned.length) throw new Error('no owned avatars to equip');
    owned[0].click();
    if (!D.querySelector('#pf-avatars .pf-slot.on')) throw new Error('nothing marked equipped');
    D.getElementById('pf-back').click();
  }],
  ['area theme applies on play and reverts on quit', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="levels"]').click();
    D.querySelector('#cam-scroll .lvl-row:not(.locked)').click();
    if (!D.body.classList.contains('area-farmstead'))
      throw new Error('area theme not applied: "' + D.body.className + '"');
    logs.push('  in-level body = "' + D.body.className + '"');
    D.getElementById('g-menu-btn').click();
    if (D.body.className.includes('area-'))
      throw new Error('area theme stuck after quit: "' + D.body.className + '"');
  }],
  ['trails and hit effects in shop', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="shop"]').click();
    const t = D.querySelectorAll('#shop-trails .fx-card');
    const f = D.querySelectorAll('#shop-hitfx .fx-card');
    if (t.length < 30) throw new Error('expected 30+ trails, got ' + t.length);
    if (f.length < 30) throw new Error('expected 30+ hit effects, got ' + f.length);
    // free options equip without charge
    const before = D.querySelectorAll('#shop-trails .fx-card.on').length;
    if (before !== 1) throw new Error('expected exactly 1 equipped trail');
    logs.push('  cosmetics: ' + t.length + ' trails, ' + f.length + ' effects');
  }],
  ['buying a trail applies its class', () => {
    const D = window.document;
    const cards = [...D.querySelectorAll('#shop-trails .fx-card')];
    cards[1].click();                       // Comet, 250 coins
    if (!D.body.classList.contains('trail-comet'))
      throw new Error('trail class not applied: "' + D.body.className + '"');
    logs.push('  after buying Comet: "' + D.body.className + '"');
  }],
  ['light mode toggles with the theme', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="themes"]').click();
    const bone = D.querySelector('.theme-card[data-theme="bone"]');
    if (!bone) throw new Error('bone theme card missing');
    bone.click();                                   // may be locked -> buys
    bone.click();
    if (!D.body.classList.contains('light'))
      throw new Error('light class not set on Bone: "' + D.body.className + '"');
    logs.push('  on Bone: "' + D.body.className + '"');
    const graphite = D.querySelector('.theme-card[data-theme="graphite"]');
    graphite.click();
    if (D.body.classList.contains('light'))
      throw new Error('light class stuck on a dark theme');
  }],
  ['dark area overrides light theme, restores after', () => {
    const D = window.document;
    // Bone is earned by clearing area 9 now rather than bought, so this
    // picks whichever light theme is actually available — the point of
    // the probe is the light/dark handoff, not which theme does it.
    D.querySelector('.hnav[data-tab="themes"]').click();
    const light = [...D.querySelectorAll('.theme-card:not(.locked)')]
      .find(c => window.themeIsLight(c.dataset.theme));
    if (!light) throw new Error('no unlocked light theme to test with');
    light.click();
    if (!D.body.classList.contains('light'))
      throw new Error('setup: not light (tried ' + light.dataset.theme + ')');
    D.querySelector('.hnav[data-tab="levels"]').click();
    D.querySelector('#cam-scroll .lvl-row:not(.locked)').click();
    if (D.body.classList.contains('light'))
      throw new Error('light survived into a dark area: "' + D.body.className + '"');
    D.getElementById('g-menu-btn').click();
    if (!D.body.classList.contains('light'))
      throw new Error('light not restored after leaving: "' + D.body.className + '"');
    logs.push('  light -> area -> light restored');
    D.querySelector('.hnav[data-tab="themes"]').click();
    D.querySelector('.theme-card[data-theme="graphite"]').click();
  }],
  ['area emblems render on campaign cards', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="levels"]').click();
    const em = D.querySelectorAll('#cam-scroll .tb-emblem svg');
    if (!em.length) throw new Error('no emblems rendered');
    logs.push('  emblems rendered on ' + em.length + ' theme block(s)');
  }],
  // Beta 14 moved the daily from a card in the list to a pill docked to
  // the bottom of the popup, which exists only while a reward is due.
  ['daily pill docks and claims', () => {
    const D = window.document;
    window.localStorage.removeItem('rd_daily');
    D.querySelector('.hnav[data-tab="levels"]').click();
    const dock = D.getElementById('daily-dock');
    if (!dock) throw new Error('no daily dock');
    if (!dock.classList.contains('show')) throw new Error('dock hidden on a fresh save');
    const pill = dock.querySelector('.daily-pill');
    if (!pill) throw new Error('no daily pill');
    const label = pill.querySelector('.daily-pill-text').textContent;
    pill.click();
    if (dock.classList.contains('show')) throw new Error('still docked after claiming');
    if (D.body.classList.contains('daily-docked'))
      throw new Error('prize track clearance not released after claiming');
    logs.push('  daily pill "' + label + '" claimed, dock removed');
  }],
  ['custom song theme picker', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="custom"]').click();
    const mk = D.getElementById('new-lvl-btn'); if (mk) mk.click();
    const adv = D.getElementById('adv-toggle'); if (adv) adv.click();
    const opts = D.querySelectorAll('#adv-theme-pick .tp-opt');
    if (opts.length !== 11) throw new Error('expected None + 10 themes, got ' + opts.length);
    opts[3].click();                                  // pick a theme
    if (!D.querySelector('#adv-theme-pick .tp-opt.on'))
      throw new Error('theme not marked selected');
    logs.push('  theme picker: ' + opts.length + ' options, selection sticks');
    const back = D.getElementById('cr-back'); if (back) back.click();
  }],
  ['difficulty badges on every song row', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="levels"]').click();
    const badges = D.querySelectorAll('#cam-scroll .diff-badge');
    // One era renders at a time now, so a full era is 15 badges.
    if (badges.length !== 15) throw new Error('only ' + badges.length + ' difficulty badges');
    const vals = [...new Set([...badges].map(b => b.textContent))].sort();
    vals.forEach(v => { if (!/^[1-9]$/.test(v)) throw new Error('bad difficulty "' + v + '"'); });
    logs.push('  ' + badges.length + ' badges, difficulties present: ' + vals.join(','));
  }],
  ['creator: Custom / Generate switch', () => {
    const D = window.document;
    D.querySelector('.hnav[data-tab="custom"]').click();
    const mk = D.getElementById('new-lvl-btn'); if (mk) mk.click();
    const opts = D.querySelectorAll('.cr-mode-opt');
    if (opts.length !== 2) throw new Error('expected 2 modes, got ' + opts.length);
    opts[1].click();
    if (!D.getElementById('gen-pane').classList.contains('show'))
      throw new Error('generate pane did not open');
    const shapes = D.querySelectorAll('#gen-shape option');
    if (shapes.length < 30) throw new Error('only ' + shapes.length + ' genres');
    logs.push('  generate pane: ' + shapes.length + ' genres, form = ' +
      D.getElementById('gen-form').textContent.slice(0, 46) + '…');
  }],
  ['generate produces an editable chart', () => {
    const D = window.document;
    D.getElementById('gen-shape').value = 'Jazz Head';
    D.getElementById('gen-shape').dispatchEvent(new window.Event('change'));
    D.getElementById('gen-diff').value = 6;
    D.getElementById('gen-len').value = 120;
    D.getElementById('gen-go').click();
    const cells = D.querySelectorAll('#cr-grid .cell, #cr-grid .cr-cell, #cr-grid > div');
    if (!cells.length) throw new Error('grid empty after generate');
    if (!D.querySelector('.cr-mode-opt.on').dataset.mode.match(/custom/))
      throw new Error('did not return to custom for editing');
    logs.push('  ' + D.getElementById('gen-note').textContent);
  }],
  ['shop cards', () => {
    const n = window.document.querySelectorAll('#shop-avatar-grid .avatar-card').length;
    if (n < 9) throw new Error('expected at least 9 avatar cards, got ' + n);
    logs.push('  avatar cards rendered: ' + n);
  }],
];

for (const [name, fn] of probes) {
  try { fn(); console.log('  ok: ' + name); }
  catch (e) { errors.push('PROBE "' + name + '": ' + e.message); }
}

setTimeout(() => {
  console.log('\n--- notes ---');
  logs.forEach(l => console.log('  ' + l));
  console.log('\n--- errors ---');
  if (!errors.length) console.log('  none');
  else errors.forEach(e => console.log('  ✗ ' + e));
  process.exit(errors.length ? 1 : 0);
}, 400);
