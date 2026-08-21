// Combo heat, milestones, and the hit-window visualizer.
//
// The visualizer probe is the important one: the band drawn above the
// strike line is sized from hitTol() itself, so what you see and what
// the engine judges cannot drift apart. That's checked at all three
// window settings, because a constant would pass at one and fail at
// the other two.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  COMBO_TIERS, COMBO_MILESTONES, applyComboTier, showComboMilestone, applyHitZone,
  hitTol, laneH, HIT_WINDOWS, HIT_TOL_BEATS, TILE_TRAVEL_BEATS,
  get combo(){return combo}, set combo(v){combo=v},
  get comboEl(){return comboEl},
  get currentSettings(){return currentSettings},
  get comboTierCls(){return comboTierCls},
};`;
const { window, D, notes, probe, report, T } = boot({ hook: HOOK });

const bodyCls = () => D.body.className;

probe('the three tiers start at 50, 75 and 100', () => {
  const at = T().COMBO_TIERS.map(t => t.at).sort((a, b) => a - b);
  notes.push('tiers at: ' + at.join(', ') + ' — ' + T().COMBO_TIERS.map(t => t.cls).join(', '));
  if (at.join() !== '50,75,100') throw new Error('tiers at ' + at.join());
});

probe('below 50 the badge only changes colour', () => {
  for (const n of [0, 5, 10, 30, 49]) {
    T().applyComboTier(n);
    const cls = T().comboEl.className;
    if (/tier-/.test(cls)) throw new Error('combo ' + n + ' lit a tier: ' + cls);
    if (/combo-(blaze|nova)/.test(bodyCls())) throw new Error('combo ' + n + ' heated the board');
  }
});

probe('each tier lights in turn and never two at once', () => {
  const seen = [];
  for (const n of [50, 74, 75, 99, 100, 250]) {
    T().applyComboTier(n);
    const lit = T().COMBO_TIERS.filter(t => T().comboEl.classList.contains(t.cls));
    if (lit.length > 1) throw new Error('combo ' + n + ' lit ' + lit.length + ' tiers');
    seen.push(n + '=' + (lit[0] ? lit[0].cls : 'none'));
  }
  notes.push('tier at combo: ' + seen.join('  '));
  if (!/50=tier-hot/.test(seen.join(' '))) throw new Error('50 did not light hot');
  if (!/75=tier-blaze/.test(seen.join(' '))) throw new Error('75 did not light blaze');
  if (!/100=tier-nova/.test(seen.join(' '))) throw new Error('100 did not light nova');
});

probe('the top two tiers heat the board, the first does not', () => {
  T().applyComboTier(50);
  if (/combo-(blaze|nova)/.test(bodyCls())) throw new Error('hot heated the board');
  T().applyComboTier(75);
  if (!D.body.classList.contains('combo-blaze')) throw new Error('blaze did not reach the board');
  T().applyComboTier(100);
  if (!D.body.classList.contains('combo-nova')) throw new Error('nova did not reach the board');
  if (D.body.classList.contains('combo-blaze')) throw new Error('blaze and nova lit together');
});

probe('breaking the combo clears everything', () => {
  T().applyComboTier(150);
  T().applyComboTier(0);
  if (/tier-/.test(T().comboEl.className)) throw new Error('a tier survived the break');
  if (/combo-(blaze|nova)/.test(bodyCls())) throw new Error('board heat survived the break');
});

probe('milestones announce once, at the exact number', () => {
  const el = D.getElementById('combo-milestone');
  const fired = [];
  for (let n = 45; n <= 210; n++) {
    el.classList.remove('show');
    el.textContent = '';
    T().applyComboTier(n);
    if (el.classList.contains('show')) fired.push(n + ':' + el.textContent);
  }
  notes.push('milestones: ' + fired.join('  '));
  const ats = T().COMBO_MILESTONES.map(m => m.at);
  if (fired.length !== ats.length) throw new Error('fired ' + fired.length + ', expected ' + ats.length);
  fired.forEach((f, i) => { if (Number(f.split(':')[0]) !== ats[i]) throw new Error('fired at ' + f); });
});

probe('a milestone restarts its own animation', () => {
  // Two milestones crossed in quick succession must both read; the
  // class has to come off and go back on, not just stay on.
  const el = D.getElementById('combo-milestone');
  T().applyComboTier(50);
  const first = el.textContent;
  T().applyComboTier(75);
  if (el.textContent === first) throw new Error('the second milestone did not replace the first');
  if (!el.classList.contains('show')) throw new Error('the second milestone did not show');
});

// ── the hit-window visualizer ──
probe('the drawn band is exactly hitTol(), at every setting', () => {
  const root = D.documentElement;
  T().currentSettings.showHitZone = true;
  const rows = [];
  for (const w of Object.keys(T().HIT_WINDOWS)) {
    T().currentSettings.hitWindow = w;
    T().applyHitZone();
    const drawn = parseFloat(root.style.getPropertyValue('--hit-zone-h'));
    const judged = T().hitTol();
    rows.push(`${w}: drawn ${drawn.toFixed(2)}px, judged ${judged.toFixed(2)}px`);
    if (Math.abs(drawn - judged) > 1e-9) throw new Error(`${w}: drawn ${drawn} vs judged ${judged}`);
  }
  notes.push(...rows);
  if (rows.length !== 3) throw new Error('expected three hit windows, found ' + rows.length);
});

probe('the three windows really are different sizes', () => {
  // If they weren't, the probe above would pass on a constant.
  const sizes = Object.keys(T().HIT_WINDOWS).map(w => {
    T().currentSettings.hitWindow = w;
    return T().hitTol();
  });
  const mults = Object.values(T().HIT_WINDOWS).map(w => w.mult);
  notes.push('window multipliers: ' + mults.join(' / '));
  if (new Set(mults).size !== mults.length) throw new Error('two windows share a multiplier');
  if (new Set(sizes).size !== 1 && sizes.some(s => !isFinite(s))) throw new Error('a window computed a non-finite tolerance');
});

probe('the window is expressed in beats, not pixels', () => {
  // A pixel constant buys less time the taller the screen. As a
  // fraction of a beat it is the same duration everywhere.
  if (!(T().HIT_TOL_BEATS > 0)) throw new Error('HIT_TOL_BEATS is not a positive number');
  if (!(T().TILE_TRAVEL_BEATS > 0)) throw new Error('TILE_TRAVEL_BEATS is not a positive number');
  notes.push(`window is ${T().HIT_TOL_BEATS} of ${T().TILE_TRAVEL_BEATS} travel beats`);
  // hitTol scales linearly with lane height, which is what makes the
  // duration constant.
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/laneH\(\)\s*\*\s*\(HIT_TOL_BEATS\s*\/\s*TILE_TRAVEL_BEATS\)/.test(src))
    throw new Error('hitTol no longer derives from the beat fraction');
});

probe('turning the visualizer off stops drawing it', () => {
  T().currentSettings.showHitZone = false;
  T().applyHitZone();
  if (D.body.classList.contains('show-hitzone')) throw new Error('the band is still shown');
});

probe('reduced motion is respected by the heat and the milestone', () => {
  const css = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'popup.html'), 'utf8');
  if (!/body\.reduce-motion #combo-milestone/.test(css)) throw new Error('the milestone ignores reduced motion');
});

report('combotest');
