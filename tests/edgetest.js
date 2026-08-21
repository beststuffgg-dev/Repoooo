// edge.js is a compatibility layer that must be completely inert
// anywhere that isn't Edge — and low-power handling must not be, since
// phones are the likeliest machines under the hardware floor and are
// never Edge.
const fs = require('fs');
const path = require('path');
const { boot } = require('./harness');
const { appDir } = require('./browser');

const SRC = fs.readFileSync(path.join(appDir(), 'edge.js'), 'utf8');
const GAME = fs.readFileSync(path.join(appDir(), 'game.js'), 'utf8');

// ── Chrome: everything must stay off ──
const chrome = boot();
const { window, D, notes, probe, report } = chrome;

probe('on a non-Edge browser the layer reports itself inactive', () => {
  const E = window.RD_Edge;
  if (!E) throw new Error('RD_Edge is not exposed');
  if (E.active) throw new Error('claims Edge on a jsdom user agent: ' + window.navigator.userAgent);
  if (E.features.length) throw new Error('shims applied off-Edge: ' + E.features.join(', '));
});

probe('and applies no classes at all', () => {
  const cls = D.documentElement.className;
  notes.push('html classes off-Edge: "' + cls + '"');
  for (const c of ['is-edge', 'edge-cheap-blur', 'edge-thin-scroll']) {
    if (D.documentElement.classList.contains(c)) throw new Error(c + ' applied off-Edge');
  }
});

probe('Chrome pays one userAgent check and nothing more', () => {
  const bail = SRC.indexOf('if (!isEdge) return;');
  if (bail < 0) throw new Error('the early return is gone');
  const before = SRC.slice(0, bail);
  // No listeners, no class writes, no timers before the bail-out.
  if (/addEventListener|setInterval|setTimeout|classList\.add/.test(before))
    throw new Error('edge.js does work before deciding it is not Edge');
});

probe('detection prefers userAgentData and falls back to the UA string', () => {
  const fn = SRC.slice(SRC.indexOf('function detectEdge'), SRC.indexOf('const isEdge'));
  if (!/userAgentData/.test(fn)) throw new Error('no userAgentData check');
  if (!/Edg\\\//.test(fn) && !/Edg\//.test(fn)) throw new Error('no UA-string fallback');
  // Edg/, not Edge/ — the latter is the old EdgeHTML browser.
  if (/[^g]Edge\\?\//.test(fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')))
    throw new Error('detection matches the old EdgeHTML "Edge/" token');
});

probe('detection survives a browser with no userAgentData', () => {
  const fn = SRC.slice(SRC.indexOf('function detectEdge'), SRC.indexOf('const isEdge'));
  if (!/try \{/.test(fn) || !/catch/.test(fn)) throw new Error('userAgentData access is unguarded');
});

// ── Edge: the shims must actually come on ──
probe('on Edge the layer activates and names its shims', () => {
  const edge = boot({});
  // Re-detect under an Edge user agent by re-running the module with
  // navigator patched, which is the only input detection reads.
  const w = edge.window;
  Object.defineProperty(w.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    configurable: true,
  });
  w.eval(SRC);
  const E = w.RD_Edge;
  notes.push('shims on Edge: ' + E.features.join(', '));
  if (!E.active) throw new Error('did not detect Edge from the UA string');
  if (!E.features.length) throw new Error('activated but applied nothing');
  if (!w.document.documentElement.classList.contains('is-edge')) throw new Error('no is-edge class');
  if (!w.document.documentElement.classList.contains('edge-thin-scroll')) throw new Error('no thin-scrollbar class');
  for (const want of ['visibility resync hook', 'audio resume nudge']) {
    if (!E.features.some(f => f.includes(want.split(' ')[0]))) throw new Error('missing shim: ' + want);
  }
});

probe('the blur shim is gated on the hardware, not on Edge alone', () => {
  const gate = SRC.slice(SRC.indexOf('const cores'), SRC.indexOf('edge-cheap-blur') + 40);
  if (!/hardwareConcurrency/.test(gate) || !/deviceMemory/.test(gate))
    throw new Error('the blur shim does not read the hardware');
  if (!/cores <= 4 \|\| mem <= 4/.test(gate)) throw new Error('the hardware floor moved: ' + gate.slice(0, 120));
});

probe('low-power is handled off Edge too, from the same floor', () => {
  // The Edge-only check never covered phones, which are the likeliest
  // machines under the floor.
  const g = GAME.slice(GAME.indexOf('const cores'), GAME.indexOf('low-power') + 30);
  if (!/cores <= 4 \|\| mem <= 4/.test(g)) throw new Error('game.js uses a different hardware floor than edge.js');
  if (!/classList\.add\('low-power'\)/.test(GAME)) throw new Error('nothing sets html.low-power');
  notes.push('both edge.js and game.js gate on cores<=4 || mem<=4');
});

probe('html.low-power actually drops the expensive blurs', () => {
  const css = fs.readFileSync(path.join(appDir(), 'popup.html'), 'utf8');
  const rules = (css.match(/html\.low-power[^{]*\{[^}]*\}/g) || []);
  notes.push('low-power rules in the stylesheet: ' + rules.length);
  if (!rules.length) throw new Error('html.low-power is set but styles nothing');
  if (!rules.some(r => /backdrop-filter\s*:\s*none/.test(r)))
    throw new Error('low-power does not drop backdrop-filter');
});

probe('the Edge stylesheet hooks exist for the classes it sets', () => {
  const css = fs.readFileSync(path.join(appDir(), 'popup.html'), 'utf8');
  for (const c of ['edge-cheap-blur', 'edge-thin-scroll']) {
    if (!new RegExp('\\.' + c).test(css)) throw new Error(c + ' is applied but nothing styles it');
  }
});

probe('edge.js loads first, before anything whose layout depends on it', () => {
  const html = fs.readFileSync(path.join(appDir(), 'popup.html'), 'utf8');
  const order = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  notes.push('load order: ' + order.join(' -> '));
  if (order[0] !== 'edge.js') throw new Error('load order starts with ' + order[0]);
  const want = ['edge.js', 'lighting.js', 'campaign.js', 'codec.js', 'loading.js', 'audio.js', 'game.js'];
  if (order.join() !== want.join()) throw new Error('load order is ' + order.join(' -> '));
});

probe('the resume hook is something game.js actually provides', () => {
  if (!/RD_onResumeFromBackground/.test(GAME)) throw new Error('edge.js calls a hook nothing defines');
  if (typeof window.RD_onResumeFromBackground !== 'function')
    throw new Error('RD_onResumeFromBackground is ' + typeof window.RD_onResumeFromBackground);
});

report('edgetest');
