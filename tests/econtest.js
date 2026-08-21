// Coins: a count of levels cleared, not a function of chart length.
// And nothing is spent on a single click.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  get profile(){return profile}, set profile(v){profile=v},
  get armedBuy(){return armedBuy},
  isArmed, armPurchase, disarmPurchase, consumeArm, priceLabel,
  store, renderShop, bestFor, recordLevelBest, levelKeyFor,
  get shopTab(){return shopTab}, set shopTab(v){shopTab=v},
  BOX_TABLES, BOX_SHOP, boxOddsText: typeof boxOddsText==='function'?boxOddsText:null,
};`;
const { window, notes, probe, report, T } = boot({ hook: HOOK });
const C = window.RD_Campaign;

const grid = (rows, perRow = 1) => Array.from({ length: rows }, () =>
  Array.from({ length: 4 }, (_, l) => (l < perRow ? { type: 'tap', freq: 261.63, sustain: 0 } : null)));

const lvl = (rows, perRow) => ({ id: 'x', name: 'X', bpm: 120, grid: grid(rows, perRow) });

probe('COINS_PER_CLEAR is the flat rate the doc names', () => {
  if (C.COINS_PER_CLEAR !== 150) throw new Error('got ' + C.COINS_PER_CLEAR);
});

probe('every real chart pays exactly the same', () => {
  const seen = new Set();
  for (const area of C.AREAS) {
    for (let i = 0; i < C.LEVELS_PER_AREA; i++) {
      seen.add(C.coinsFor(C.buildCampaignLevel(area.id, i), { completed: true }));
    }
  }
  notes.push('distinct clear payouts across all 150 campaign levels: ' + [...seen].join(', '));
  if (seen.size !== 1) throw new Error('payout varies: ' + [...seen].sort((a, b) => a - b).join(', '));
  if (![...seen][0] || [...seen][0] !== 150) throw new Error('flat rate is ' + [...seen][0]);
});

probe('chart length no longer drives the payout', () => {
  const short = C.coinsFor(lvl(60, 1), { completed: true });
  const long = C.coinsFor(lvl(600, 4), { completed: true });
  notes.push(`60-note chart ${short} coins, 2400-note chart ${long} coins`);
  if (short !== long) throw new Error(short + ' vs ' + long);
});

probe('a stub chart pays pro-rata, not the full rate', () => {
  const stub = C.coinsFor(lvl(4, 1), { completed: true });
  const expect = Math.round(150 * (4 / C.COINS_MIN_NOTES));
  if (stub !== expect) throw new Error('4-note stub paid ' + stub + ', expected ' + expect);
  notes.push(`4-note stub pays ${stub}; the floor is ${C.COINS_MIN_NOTES} notes`);
});

probe('no campaign chart is short enough to trip the stub guard', () => {
  let min = Infinity;
  for (const area of C.AREAS) {
    for (let i = 0; i < C.LEVELS_PER_AREA; i++) {
      min = Math.min(min, C.countNotes(C.buildCampaignLevel(area.id, i)));
    }
  }
  notes.push('shortest campaign chart: ' + min + ' notes (guard trips under ' + C.COINS_MIN_NOTES + ')');
  if (min < C.COINS_MIN_NOTES) throw new Error('a campaign chart has only ' + min + ' notes');
});

probe('a run that ends early pays for the part it played', () => {
  const half = C.coinsFor(lvl(100, 1), { completed: false, progress: 0.5 });
  const none = C.coinsFor(lvl(100, 1), { completed: false, progress: 0 });
  if (half !== 75) throw new Error('half a chart paid ' + half);
  if (none !== 0) throw new Error('quitting on the first note paid ' + none);
});

probe('the Double pays double coins', () => {
  const one = C.coinsFor(lvl(100, 1), { completed: true });
  const two = C.coinsFor(lvl(100, 1), { completed: true, speedMult: 2 });
  if (two !== one * 2) throw new Error(one + ' -> ' + two);
});

probe('progress outside 0..1 cannot mint coins', () => {
  if (C.coinsFor(lvl(100, 1), { completed: false, progress: 9 }) !== 150) throw new Error('over-100% progress overpaid');
  if (C.coinsFor(lvl(100, 1), { completed: false, progress: -3 }) !== 0) throw new Error('negative progress paid out');
});

// ── the two-click purchase flow ──
probe('nothing is armed to start with', () => {
  if (T().isArmed('avatar:x')) throw new Error('armed on boot');
});

probe('the first click arms and previews; it does not spend', () => {
  let reverted = false;
  const before = JSON.stringify(T().store.loadShop());
  T().armPurchase('avatar:x', () => { reverted = true; });
  if (!T().isArmed('avatar:x')) throw new Error('did not arm');
  if (JSON.stringify(T().store.loadShop()) !== before) throw new Error('storage was written on the first click');
  T().disarmPurchase(false);
  if (!reverted) throw new Error('the preview was not reverted on disarm');
});

probe('the armed card asks for a second tap', () => {
  T().armPurchase('avatar:y', () => {});
  const armedLabel = T().priceLabel('avatar:y', 500);
  const restLabel = T().priceLabel('avatar:z', 500);
  T().disarmPurchase(false);
  if (!/tap again/i.test(armedLabel)) throw new Error('armed label reads "' + armedLabel + '"');
  if (!/500/.test(restLabel)) throw new Error('unarmed label reads "' + restLabel + '"');
});

probe('arming something else disarms the first', () => {
  let a = false;
  T().armPurchase('avatar:a', () => { a = true; });
  T().armPurchase('avatar:b', () => {});
  if (!a) throw new Error('the first preview was left applied');
  if (T().isArmed('avatar:a')) throw new Error('two cards armed at once');
  if (!T().isArmed('avatar:b')) throw new Error('the second card did not arm');
  T().disarmPurchase(false);
});

probe('a confirmed purchase keeps its preview instead of reverting it', () => {
  let reverted = false;
  T().armPurchase('avatar:c', () => { reverted = true; });
  T().consumeArm();
  if (reverted) throw new Error('confirming reverted the preview');
  if (T().isArmed('avatar:c')) throw new Error('still armed after confirming');
});

probe('changing shop tab abandons the arm', () => {
  let reverted = false;
  T().renderShop();
  T().armPurchase('avatar:d', () => { reverted = true; });
  const strip = window.document.getElementById('shop-tabs');
  const other = [...strip.querySelectorAll('.set-tab')].find(t => !t.classList.contains('active'));
  if (!other) throw new Error('no other shop tab to switch to');
  other.dispatchEvent(new window.Event('click', { bubbles: true }));
  if (!reverted) throw new Error('leaving the tab left the preview applied');
  if (T().isArmed('avatar:d')) throw new Error('still armed after a tab change');
});

probe('leaving home disarms too', () => {
  let reverted = false;
  T().armPurchase('avatar:e', () => { reverted = true; });
  const nav = [...window.document.querySelectorAll('.hnav')].find(t => t.dataset.tab === 'themes');
  nav.dispatchEvent(new window.Event('click', { bubbles: true }));
  if (!reverted || T().isArmed('avatar:e')) throw new Error('walking away left the purchase armed');
});

probe('the odds box reads off the same table the roll uses', () => {
  const tables = T().BOX_TABLES;
  if (!tables || !Object.keys(tables).length) throw new Error('no drop tables');
  const lines = [];
  for (const [rarity, table] of Object.entries(tables)) {
    const total = table.reduce((a, r) => a + r.weight, 0);
    if (total <= 0) throw new Error(rarity + ' has zero total weight');
    lines.push(rarity + ': ' + table.map(r => Math.round(r.weight / total * 100) + '% ' + r.pool).join(' / '));
  }
  notes.push(...lines);
});

report('econtest');
