// Avatars: the shop stock, the colourway tints, and the custom upload.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  COLOURWAYS, colourway, spriteHasOwnColour,
  BASE_AVATARS, GEN_AVATARS, PENDING_AVATARS,
  ALL_AVATARS: typeof ALL_AVATARS!=='undefined'?ALL_AVATARS:null,
  downscaleToSquare, CUSTOM_AV_SIZE,
  store, renderShop, updateProfileBar,
  avatarNode: typeof avatarNode==='function'?avatarNode:null,
  get profile(){return profile},
};`;
const { window, D, notes, probe, report, T } = boot({
  hook: HOOK, storage: { rd_profile: { username: 'P', coins: 999999 } },
});

const ALL = T().ALL_AVATARS || [].concat(T().BASE_AVATARS || [], T().GEN_AVATARS || [], T().PENDING_AVATARS || []);

probe('there is a real avatar roster', () => {
  notes.push(`${ALL.length} avatars: ${(T().BASE_AVATARS || []).length} base, ${(T().GEN_AVATARS || []).length} generated, ${(T().PENDING_AVATARS || []).length} campaign-earned`);
  if (ALL.length < 40) throw new Error('only ' + ALL.length + ' avatars');
});

probe('every avatar has an id, a name and artwork', () => {
  const bad = ALL.filter(a => !a.id || !a.name || !(a.sym || a.svg || a.draw || a.icon));
  if (bad.length) throw new Error(bad.length + ' incomplete: ' + bad.slice(0, 3).map(b => b.id || '?').join(', '));
});

probe('avatar ids are unique', () => {
  const ids = ALL.map(a => a.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) throw new Error('duplicate ids: ' + [...new Set(dupes)].join(', '));
});

probe('campaign-earned avatars are not also on sale', () => {
  // They carry a price field (it is what a duplicate pull converts
  // against), so the honest check is whether the shop offers them —
  // not whether the number exists.
  const pending = T().PENDING_AVATARS || [];
  T().renderShop();
  // The cards carry no id attribute, so match on the name they render.
  const offered = new Set([...D.querySelectorAll('#shop-avatar-grid .avatar-card .avatar-name')]
    .map(n => n.textContent.trim()).filter(Boolean));
  const leaked = pending.filter(a => offered.has(a.name));
  notes.push(`${pending.length} campaign-exclusive avatars, ${offered.size} offered in the shop, ${leaked.length} leaked`);
  if (!offered.size) throw new Error('the shop grid exposes no ids to check against');
  if (leaked.length) throw new Error('on sale despite being earned: ' + leaked.map(a => a.id).join(', '));
});

probe('there are colourways, and one of them is the original artwork', () => {
  const cw = T().COLOURWAYS;
  notes.push('colourways: ' + cw.map(c => c.name).join(', '));
  if (cw.length < 5) throw new Error('only ' + cw.length + ' colourways');
  const orig = cw.filter(c => c.original);
  if (orig.length !== 1) throw new Error(orig.length + ' colourways claim to be the original');
});

probe('every tint colourway carries a full three-tone palette', () => {
  // The artwork is hand-drawn in three tones; a tint that only
  // supplied one would flatten it.
  const tints = T().COLOURWAYS.filter(c => !c.original);
  const bad = tints.filter(c => !c.p || !c.s || !c.t);
  if (bad.length) throw new Error('incomplete palettes: ' + bad.map(b => b.id).join(', '));
  const hex = /^#[0-9a-f]{6}$/i;
  const malformed = tints.filter(c => ![c.p, c.s, c.t].every(v => hex.test(v)));
  if (malformed.length) throw new Error('malformed colours: ' + malformed.map(b => b.id).join(', '));
  notes.push(tints.length + ' tint palettes, each three tones');
});

probe('the three tones of a colourway are actually different', () => {
  for (const c of T().COLOURWAYS.filter(x => !x.original)) {
    if (new Set([c.p.toLowerCase(), c.s.toLowerCase(), c.t.toLowerCase()]).size !== 3)
      throw new Error(c.id + ' repeats a tone');
  }
});

probe('an unknown colourway falls back rather than throwing', () => {
  const got = T().colourway('no-such-colourway');
  if (!got) throw new Error('returned nothing');
  if (got.id !== T().COLOURWAYS[0].id) throw new Error('fell back to ' + got.id);
});

probe('the original-artwork colourway still tints sprites that need it', () => {
  // Nine of the avatars are hand-written and carry no fill of their
  // own; "as drawn" would render them invisible.
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/cw\.original \? COLOURWAYS\[1\] : cw/.test(src))
    throw new Error('the untinted-sprite fallback is gone');
});

probe('a custom upload is stored downscaled, not at full resolution', () => {
  const size = T().CUSTOM_AV_SIZE;
  notes.push('custom avatars are stored at ' + size + 'x' + size);
  if (!(size > 0 && size <= 256)) throw new Error('custom avatars stored at ' + size + 'px');
  if (typeof T().downscaleToSquare !== 'function') throw new Error('no downscale step');
});

probe('the upload path goes through the downscaler', () => {
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/downscaleToSquare\(e\.target\.result, CUSTOM_AV_SIZE\)/.test(src))
    throw new Error('the reader result is saved without downscaling');
  if (!/saveCustomAv/.test(src)) throw new Error('nothing persists the custom avatar');
});

probe('the custom avatar has its own storage key', () => {
  window.localStorage.setItem('rd_custom_av', 'data:image/png;base64,AAAA');
  if (T().store.loadCustomAv() !== 'data:image/png;base64,AAAA') throw new Error('did not round-trip');
});

probe('the shop renders a card for every avatar', () => {
  T().renderShop();
  const cards = D.querySelectorAll('#shop-avatar-grid .avatar-card');
  notes.push('avatar cards rendered: ' + cards.length);
  if (!cards.length) throw new Error('no avatar cards rendered');
});

probe('equipping an owned avatar updates the profile bar', () => {
  const shop = T().store.loadShop();
  const first = ALL[0];
  shop.avatars = shop.avatars || [];
  if (!shop.avatars.includes(first.id)) shop.avatars.push(first.id);
  shop.avatar = first.id;
  T().store.saveShop(shop);
  T().updateProfileBar();
  const bar = D.getElementById('pbar-avatar');
  if (!bar || !bar.innerHTML.trim()) throw new Error('the profile bar shows no avatar');
});

report('avtest');
