// Phase 4 — Creator: the advanced panel's sound preview, and the
// panel growing the window instead of covering the grid.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  startAdvPreview, stopAdvPreview, advPreviewRows, buildAdvPreview,
  expandForPanel, retractPanel, fitPanelToExpansion,
  WINDOW_CAP, ADV_PANEL_PX, PANEL_MIN_PX,
  get panelExpansion(){return panelExpansion},
  get crGrid(){return crGrid}, set crGrid(v){crGrid=v},
  get crLaneFreqs(){return crLaneFreqs},
  get crBgMode(){return crBgMode}, set crBgMode(v){crBgMode=v},
  get crAdvOpen(){return crAdvOpen}, set crAdvOpen(v){crAdvOpen=v},
  get crDefaultSustain(){return crDefaultSustain},
  get currentSettings(){return currentSettings},
  newLevel: typeof newLevel==='function'?newLevel:null,
  openCreator: typeof openCreator==='function'?openCreator:null,
  toggleAdv: typeof toggleAdv==='function'?toggleAdv:null,
};`;
const { window, D, notes, probe, report, T } = boot({ hook: HOOK });

const root = D.documentElement;
const H = () => parseInt(root.style.height, 10) || T().currentSettings.height;

probe('the preview button lives at the top of the panel', () => {
  const panel = D.getElementById('adv-panel');
  const btn = D.getElementById('adv-preview');
  if (!panel) throw new Error('no advanced panel');
  if (!btn) throw new Error('no preview button');
  if (!panel.contains(btn)) throw new Error('the preview button is not inside the panel');
  const kids = [...panel.children];
  const at = kids.findIndex(k => k === btn || k.contains(btn));
  notes.push(`preview button is child ${at + 1} of ${kids.length} in the panel`);
  if (at > 1) throw new Error('the preview button is buried at position ' + (at + 1));
});

probe('the preview plays the chart, not a test note', () => {
  T().crGrid = Array.from({ length: 12 }, (_, r) => [
    r % 3 === 0 ? { type: 'tap', freq: 261.63, sustain: 0 } : null,
    r % 4 === 1 ? { type: 'dtap', freq: 329.63, sustain: 0 } : null, null, null,
  ]);
  const rows = T().advPreviewRows();
  notes.push(`preview rows from a 12-row chart: ${rows.length}`);
  if (!rows.length) throw new Error('the preview found nothing to play');
  const played = rows.flat();
  if (!played.length) throw new Error('the preview rows carry no notes');
  // The freqs must come from the chart's own cells.
  if (!played.some(n => Math.abs(n.freq - 261.63) < 0.01)) throw new Error('the chart pitches are not what plays');
  if (!played.some(n => n.dtap)) throw new Error('double-taps are not carried into the preview');
});

probe('the preview is capped so it stays short', () => {
  T().crGrid = Array.from({ length: 400 }, () => [{ type: 'tap', freq: 440, sustain: 0 }, null, null, null]);
  const rows = T().advPreviewRows();
  notes.push('preview rows from a 400-row chart: ' + rows.length);
  if (rows.length > 8) throw new Error('the preview would play ' + rows.length + ' rows');
});

probe('an empty chart auditions the lane defaults instead of silence', () => {
  T().crGrid = Array.from({ length: 16 }, () => [null, null, null, null]);
  const rows = T().advPreviewRows();
  if (!rows.length) throw new Error('an empty chart previews nothing at all');
  const freqs = rows.flat().map(n => n.freq);
  const lanes = T().crLaneFreqs;
  notes.push('empty-chart preview uses the lane defaults: ' + freqs.map(f => f.toFixed(1)).join(', '));
  if (!freqs.every(f => lanes.some(l => Math.abs(l - f) < 0.01)))
    throw new Error('the fallback is not the lane defaults');
});

probe('clicking again stops it', () => {
  T().crGrid = Array.from({ length: 8 }, () => [{ type: 'tap', freq: 440, sustain: 0 }, null, null, null]);
  T().startAdvPreview();
  const btn = D.getElementById('adv-preview');
  if (!btn.classList.contains('playing')) throw new Error('the button does not mark itself playing');
  T().stopAdvPreview();
  if (btn.classList.contains('playing')) throw new Error('stopping left the button marked playing');
});

probe('the preview names the instrument it is about to use', () => {
  T().buildAdvPreview();
  const sub = D.getElementById('adv-preview-sub');
  notes.push('preview button subtitle: "' + (sub ? sub.textContent : '(none)') + '"');
  if (!sub || !sub.textContent.trim()) throw new Error('the button does not name the instrument');
});

// ── the panel grows the window rather than covering the grid ──
probe('opening the panel grows the window', () => {
  T().retractPanel();
  const before = H();
  const exp = T().fitPanelToExpansion('adv-panel', T().ADV_PANEL_PX);
  const after = H();
  notes.push(`window ${before}px -> ${after}px, panel took ${exp.amount}px, overlay=${exp.overlay}`);
  if (!exp.overlay && after - before !== exp.amount) throw new Error('the window did not grow by the panel amount');
  if (exp.amount > 0 && after <= before) throw new Error('the window did not grow at all');
  T().retractPanel();
});

probe('closing gives the space back exactly', () => {
  const before = H();
  T().fitPanelToExpansion('adv-panel', T().ADV_PANEL_PX);
  T().retractPanel();
  const after = H();
  if (after !== before) throw new Error(`${before} -> ${after}: the window did not return to its size`);
});

probe('growth stops at the cap', () => {
  T().retractPanel();
  root.style.height = (T().WINDOW_CAP.h - 40) + 'px';
  const exp = T().expandForPanel(T().ADV_PANEL_PX, 'h');
  notes.push(`40px of room left: took ${exp.amount}px, overlay=${exp.overlay}`);
  if (H() > T().WINDOW_CAP.h) throw new Error('the window grew past the cap to ' + H());
  T().retractPanel();
});

probe('with no room left it overlays instead of trapping the panel', () => {
  T().retractPanel();
  root.style.height = T().WINDOW_CAP.h + 'px';
  const exp = T().expandForPanel(T().ADV_PANEL_PX, 'h');
  if (!exp.overlay) throw new Error('a full window did not fall back to the overlay');
  if (!D.body.classList.contains('panel-overlay')) throw new Error('the overlay class was not applied');
  T().retractPanel();
  if (D.body.classList.contains('panel-overlay')) throw new Error('the overlay class survived the close');
});

probe('a sliver of window takes the overlay path too', () => {
  // A 10px panel is worse than an overlay.
  T().retractPanel();
  root.style.height = (T().WINDOW_CAP.h - 10) + 'px';
  const exp = T().expandForPanel(T().ADV_PANEL_PX, 'h');
  notes.push(`10px of room: overlay=${exp.overlay}, took ${exp.amount}px (minimum is ${T().PANEL_MIN_PX}px)`);
  if (exp.amount > 0 && exp.amount < T().PANEL_MIN_PX)
    throw new Error('opened a ' + exp.amount + 'px panel, under the ' + T().PANEL_MIN_PX + 'px minimum');
  T().retractPanel();
});

probe('only one panel expands at a time', () => {
  T().retractPanel();
  root.style.height = '640px';
  const a = T().expandForPanel(200, 'h');
  const b = T().expandForPanel(200, 'h');
  if (a !== b) throw new Error('a second panel expanded on top of the first');
  T().retractPanel();
});

probe('a density warning exists, at the same threshold XP penalises', () => {
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/DENSITY_CAP|densit/i.test(src)) throw new Error('no density warning in the creator');
  const cap = window.RD_Campaign.DENSITY_CAP;
  notes.push('density cap shared by the warning and the XP formula: ' + (cap * 100) + '%');
  if (cap !== 0.85) throw new Error('the cap is ' + cap);
});

report('phase4test');
