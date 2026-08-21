// Phase 1 — Settings: the tabbed panel, audio configuration, and
// brightness as a root-level filter.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  SETTINGS_TABS, buildSettingsPanel, applySettingsToDOM, applyBrightness,
  get settingsTab(){return settingsTab}, set settingsTab(v){settingsTab=v},
  get currentSettings(){return currentSettings},
  store, HIT_WINDOWS,
};`;
const { window, D, notes, probe, report, T } = boot({ hook: HOOK });

T().buildSettingsPanel();

probe('settings are tabbed Play / Audio / Look / Data', () => {
  const keys = T().SETTINGS_TABS.map(t => t[0]);
  const labels = T().SETTINGS_TABS.map(t => t[1]);
  notes.push('settings tabs: ' + labels.join(' / '));
  if (keys.length !== 4) throw new Error(keys.length + ' tabs: ' + keys.join(', '));
  const want = ['play', 'audio', 'look', 'data'];
  if (keys.join() !== want.join()) throw new Error('tabs are ' + keys.join(', '));
});

probe('the tab strip renders one cell per tab, one active', () => {
  const tabs = D.querySelectorAll('#tab-settings .set-tab');
  if (tabs.length !== 4) throw new Error(tabs.length + ' cells rendered');
  const active = [...tabs].filter(t => t.classList.contains('active'));
  if (active.length !== 1) throw new Error(active.length + ' cells active at once');
});

probe('clicking a tab swaps the visible group', () => {
  const tabs = [...D.querySelectorAll('#tab-settings .set-tab')];
  const before = T().settingsTab;
  const other = tabs.find(t => !t.classList.contains('active'));
  other.dispatchEvent(new window.Event('click', { bubbles: true }));
  if (T().settingsTab === before) throw new Error('the tab did not change');
  // The groups are class-only, in tab order — there is no per-tab id.
  const shown = [...D.querySelectorAll('#tab-settings .set-group')]
    .filter(g => g.style.display !== 'none');
  notes.push('groups visible after a switch: ' + shown.length);
  if (shown.length !== 1) throw new Error(shown.length + ' groups visible at once');
  T().settingsTab = before; T().buildSettingsPanel();
});

probe('every lane key can be remapped', () => {
  const keys = T().currentSettings.keys;
  if (!Array.isArray(keys) || keys.length !== 4) throw new Error('keys: ' + JSON.stringify(keys));
  notes.push('default keys: ' + keys.join(' '));
  const saved = keys.slice();
  T().currentSettings.keys = ['j', 'k', 'l', ';'];
  T().applySettingsToDOM();
  const caps = [...D.querySelectorAll('.lane-btn')].map(b => b.textContent.trim().toLowerCase());
  T().currentSettings.keys = saved;
  T().applySettingsToDOM();
  if (!caps.some(c => c.includes('j'))) throw new Error('keycaps did not follow the remap: ' + caps.join(','));
});

probe('starting lives is a setting, and it takes', () => {
  const s = T().currentSettings;
  if (typeof s.lives !== 'number') throw new Error('lives is ' + typeof s.lives);
  const was = s.lives;
  s.lives = 7; T().applySettingsToDOM();
  if (T().currentSettings.lives !== 7) throw new Error('lives did not stick');
  s.lives = was; T().applySettingsToDOM();
});

probe('the three hit windows are selectable and distinct', () => {
  const w = T().HIT_WINDOWS;
  const keys = Object.keys(w);
  notes.push('hit windows: ' + keys.map(k => k + ' x' + w[k].mult).join(', '));
  if (keys.length !== 3) throw new Error(keys.length + ' windows');
  const mults = keys.map(k => w[k].mult);
  if (new Set(mults).size !== 3) throw new Error('two windows share a multiplier');
  if (!(mults[0] < mults[1] && mults[1] < mults[2])) throw new Error('windows are not ordered strict < normal < forgiving');
});

probe('note speed is NOT a setting', () => {
  // Deliberate: changing it would make scores incomparable between
  // players, so it is locked per level.
  const s = T().currentSettings;
  if ('speed' in s || 'noteSpeed' in s || 'fallSpeed' in s)
    throw new Error('a speed setting exists: ' + Object.keys(s).filter(k => /speed/i.test(k)).join(', '));
});

probe('volume rides the master gain', () => {
  const s = T().currentSettings;
  if (typeof s.volume !== 'number') throw new Error('no volume setting');
  s.volume = 0.4; T().applySettingsToDOM();
  if (window.RD_getVolume && Math.abs(window.RD_getVolume() - 0.4) > 1e-6)
    throw new Error('the audio engine reports ' + window.RD_getVolume());
  s.volume = 1; T().applySettingsToDOM();
});

probe('the output picker is offered only where setSinkId exists', () => {
  const can = window.RD_canPickOutput && window.RD_canPickOutput();
  notes.push('setSinkId available in this environment: ' + !!can);
  // Feature-detected: where it is missing the control must simply not
  // be offered, rather than appearing and failing on click.
  T().settingsTab = 'audio'; T().buildSettingsPanel();
  // The picker is a <select> of output devices; nothing else in the
  // panel is one, so its presence is the signal.
  const picker = D.querySelector('#tab-settings select.set-select, #tab-settings select');
  const looksLikeOutput = picker && /output|device|speaker/i.test(picker.parentElement.textContent);
  if (!can && looksLikeOutput) throw new Error('an output picker was rendered without setSinkId support');
  notes.push('output picker rendered: ' + !!looksLikeOutput);
  T().settingsTab = 'play'; T().buildSettingsPanel();
});

probe('brightness is a filter on the app root, covering every screen', () => {
  const root = D.documentElement;
  T().currentSettings.brightness = 0.7;
  T().applyBrightness ? T().applyBrightness() : T().applySettingsToDOM();
  const v = root.style.getPropertyValue('--app-brightness');
  notes.push('--app-brightness at 0.7: ' + v);
  if (!v || Math.abs(parseFloat(v) - 0.7) > 0.001) throw new Error('root filter is "' + v + '"');
  T().currentSettings.brightness = 1;
  T().applyBrightness ? T().applyBrightness() : T().applySettingsToDOM();
});

probe('brightness is clamped, so the app cannot be turned off', () => {
  for (const [set, lo, hi] of [[0, 0.3, 1.6], [99, 0.3, 1.6], [-5, 0.3, 1.6]]) {
    T().currentSettings.brightness = set;
    T().applyBrightness ? T().applyBrightness() : T().applySettingsToDOM();
    const v = parseFloat(D.documentElement.style.getPropertyValue('--app-brightness'));
    if (!(v >= lo && v <= hi)) throw new Error('brightness ' + set + ' resolved to ' + v);
  }
  T().currentSettings.brightness = 1;
  T().applyBrightness ? T().applyBrightness() : T().applySettingsToDOM();
});

probe('settings survive a save and load', () => {
  const s = T().currentSettings;
  s.hitWindow = 'strict'; s.lives = 5; s.brightness = 0.9;
  T().store.saveSettings ? T().store.saveSettings(s) : window.localStorage.setItem('rd_settings', JSON.stringify(s));
  const back = JSON.parse(window.localStorage.getItem('rd_settings'));
  if (back.hitWindow !== 'strict' || back.lives !== 5) throw new Error('round trip lost: ' + JSON.stringify(back));
  notes.push('saved settings keys: ' + Object.keys(back).join(', '));
});

probe('reduced motion is honoured across the app, not per-effect', () => {
  const css = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'popup.html'), 'utf8');
  const guards = (css.match(/reduce-motion/g) || []).length;
  notes.push('reduce-motion guards in the stylesheet: ' + guards);
  if (guards < 8) throw new Error('only ' + guards + ' reduced-motion guards');
  if (!/@media \(prefers-reduced-motion: reduce\)/.test(css)) throw new Error('no prefers-reduced-motion media query');
});

report('phase1test');
