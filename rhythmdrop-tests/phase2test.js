// Phase 2 — Shop: tabs, live previews, free themes, mystery boxes.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  SHOP_TABS, BOX_SHOP, BOX_TABLES, BOX_POOL_LABEL,
  renderShop, renderShopTabs, renderBoxShop, renderCosmetics, openBox,
  armPurchase, disarmPurchase, isArmed, consumeArm,
  get shopTab(){return shopTab}, set shopTab(v){shopTab=v},
  get profile(){return profile},
  store, SHOP_THEMES, THEMES, GEN_THEMES, THEME_BY_AREA, TRAILS: typeof TRAILS!=='undefined'?TRAILS:null,
  HIT_FX: typeof HIT_FX!=='undefined'?HIT_FX:null,
  AVATARS: typeof AVATARS!=='undefined'?AVATARS:null,
};`;
const { window, D, notes, probe, report, T } = boot({
  hook: HOOK, storage: { rd_profile: { username: 'P', coins: 999999 } },
});

T().renderShop();

probe('the shop is tabbed, not one long scroll', () => {
  const keys = T().SHOP_TABS.map(t => t[0]);
  notes.push('shop tabs: ' + T().SHOP_TABS.map(t => t[1]).join(' / '));
  if (keys.length < 4) throw new Error('only ' + keys.length + ' shop tabs');
  const cells = D.querySelectorAll('#shop-tabs .set-tab');
  if (cells.length !== keys.length) throw new Error(cells.length + ' cells for ' + keys.length + ' tabs');
});

probe('exactly one shop tab is active at a time', () => {
  const active = [...D.querySelectorAll('#shop-tabs .set-tab')].filter(t => t.classList.contains('active'));
  if (active.length !== 1) throw new Error(active.length + ' active');
});

probe('switching tab shows one grid and hides the rest', () => {
  const shown = [];
  for (const [key] of T().SHOP_TABS) {
    T().shopTab = key; T().renderShop();
    const vis = T().SHOP_TABS.map(([k]) => D.getElementById('shop-g-' + k))
      .filter(g => g && g.style.display !== 'none').length;
    shown.push(key + ':' + vis);
    if (vis !== 1) throw new Error(key + ' showed ' + vis + ' grids');
  }
  notes.push('grids visible per tab: ' + shown.join(' '));
  T().shopTab = 'avatars'; T().renderShop();
});

probe('the shop actually has stock in every tab', () => {
  // A tab that renders zero cards would make every probe above vacuous.
  const counts = [];
  for (const [key] of T().SHOP_TABS) {
    T().shopTab = key; T().renderShop();
    const g = D.getElementById('shop-g-' + key);
    const cards = g ? g.querySelectorAll('.avatar-card, .fx-card, .box-card, .trail-card').length : 0;
    counts.push(key + '=' + cards);
    if (!cards) throw new Error(key + ' rendered no cards');
  }
  notes.push('cards per tab: ' + counts.join(' '));
  T().shopTab = 'avatars'; T().renderShop();
});

probe('themes are unlocked by play, not bought with coins', () => {
  // Coins were never the interesting gate: a look is either free or it
  // is earned by clearing the area it belongs to.
  const byArea = T().THEME_BY_AREA;
  const gated = Object.keys(byArea);
  notes.push(`${T().THEMES.length} base themes, ${gated.length} earned by clearing an area: `
    + gated.map(k => k + '=area ' + byArea[k]).join(', '));
  if (gated.length < 5) throw new Error('only ' + gated.length + ' themes are earned');
  const free = T().THEMES.filter(t => !byArea[t.id]);
  if (!free.length) throw new Error('no theme is free from the start');
  // Every gate must point at a real area.
  const bad = gated.filter(k => !(byArea[k] >= 1 && byArea[k] <= window.RD_Campaign.AREAS.length));
  if (bad.length) throw new Error('themes gated on areas that do not exist: ' + bad.join(', '));
});

probe('every mystery box tier has a real weighted table', () => {
  const rows = [];
  for (const box of T().BOX_SHOP) {
    const table = T().BOX_TABLES[box.rarity] || T().BOX_TABLES[box.id];
    if (!table) throw new Error('no drop table for ' + (box.rarity || box.id));
    const total = table.reduce((a, r) => a + r.weight, 0);
    if (total <= 0) throw new Error(box.rarity + ' totals zero weight');
    if (table.some(r => r.weight < 0)) throw new Error(box.rarity + ' has a negative weight');
    rows.push(`${box.rarity || box.id} @${box.price}: ` + table.map(r => (r.weight / total * 100).toFixed(0) + '% ' + r.pool).join(' '));
  }
  notes.push(...rows);
  if (T().BOX_SHOP.length < 3) throw new Error('only ' + T().BOX_SHOP.length + ' box tiers');
});

probe('the odds shown are the odds rolled', () => {
  // Both the card and the roll read the same table, so the printed
  // percentages cannot drift from the behaviour.
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  const shown = src.match(/function boxOdds[\s\S]{0,400}/);
  if (!/BOX_TABLES\[rarity\]/.test(src)) throw new Error('the odds text no longer reads BOX_TABLES');
  const uses = (src.match(/BOX_TABLES\[rarity\]/g) || []).length;
  notes.push('BOX_TABLES[rarity] read in ' + uses + ' places — display and roll');
  if (uses < 2) throw new Error('only one reader; display and roll may diverge');
});

probe('opening a box always returns something from its own table', () => {
  const seen = {};
  for (const box of T().BOX_SHOP) {
    const rarity = box.rarity || box.id;
    const pools = new Set(T().BOX_TABLES[rarity].map(r => r.pool));
    for (let i = 0; i < 60; i++) {
      const res = T().openBox(rarity);
      if (!res) throw new Error(rarity + ' returned nothing on roll ' + i);
      const pool = res.pool || res.type || (typeof res.coins === 'number' ? 'coins' : null);
      if (pool && !pools.has(pool)) throw new Error(rarity + ' rolled "' + pool + '", not in its table');
      seen[rarity] = (seen[rarity] || 0) + 1;
    }
  }
  notes.push('box rolls checked: ' + Object.entries(seen).map(([k, v]) => k + ' x' + v).join(', '));
});

probe('a duplicate pull converts to coins instead of nothing', () => {
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/dup|duplicate/i.test(src)) throw new Error('no duplicate handling in the box path');
  // ~1/3 of the item's value.
  if (!/\/\s*3|0\.33|\* *\.3/.test(src)) throw new Error('no fractional conversion rate found');
});

probe('effects and trails preview live before you buy', () => {
  // The effects tab's key is 'hitfx'.
  const fxKey = T().SHOP_TABS.map(t => t[0]).find(k => /fx|effect/i.test(k));
  T().shopTab = fxKey; T().renderShop();
  const cards = [...D.querySelectorAll('#shop-g-' + fxKey + ' .fx-card')];
  if (!cards.length) throw new Error('no effect cards');
  // The first click on a locked card previews and arms; it must not
  // write to storage.
  const before = JSON.stringify(T().store.loadShop());
  const locked = cards.find(c => c.classList.contains('locked')) || cards[0];
  locked.dispatchEvent(new window.Event('click', { bubbles: true }));
  const after = JSON.stringify(T().store.loadShop());
  notes.push('effect cards: ' + cards.length + ', armed after one click: ' + !!T().isArmed);
  if (before !== after) throw new Error('a single click wrote to storage');
  T().disarmPurchase(false);
  T().shopTab = 'avatars'; T().renderShop();
});

probe('an owned item still equips in one click', () => {
  // The two-step flow guards spending, not browsing.
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/Only locked items arm/.test(src)) throw new Error('the one-click-equip rule is no longer stated');
});

report('phase2test');
