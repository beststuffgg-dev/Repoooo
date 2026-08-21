// The jsdom boot every non-browser suite needs: locate the build, stub
// the parts of the platform jsdom doesn't have (Web Audio, rAF,
// matchMedia, document.fonts), then eval the extension's scripts in
// load order.
//
// This was copy-pasted into each suite before. Factored out so that a
// platform stub gained in one place — the limiter's compressor node
// was the last one — is gained everywhere at once.
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// Where the build under test lives is browser.js's job — it is the one
// file that knows the repo layout, so a folder move is one edit rather
// than eight copies of the same list going stale at different rates.
const { appDir: findApp } = require('./browser');

const LOAD_ORDER = ['edge.js', 'lighting.js', 'campaign.js', 'codec.js', 'loading.js', 'audio.js', 'game.js'];

function audioNode(extra = {}) {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  return Object.assign({
    connect() { return this; }, disconnect() {}, start() {}, stop() {},
    frequency: param(), detune: param(), gain: param(), Q: param(),
    threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
    playbackRate: param(), delayTime: param(), pan: param(),
    type: '', buffer: null, loop: false, curve: null, oversample: '',
    reduction: 0, onended: null,
  }, extra);
}

function boot(opts = {}) {
  const DIR = opts.dir || findApp();
  const errors = [], notes = [];
  const dom = new JSDOM(fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8'),
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://localhost/' });
  const { window } = dom;
  window.onerror = m => errors.push('onerror: ' + m);

  const ctx = () => ({
    state: 'running', currentTime: 0, sampleRate: 44100, destination: audioNode(),
    resume: () => Promise.resolve(), close: () => Promise.resolve(), suspend: () => Promise.resolve(),
    createOscillator: () => audioNode(), createGain: () => audioNode(),
    createBiquadFilter: () => audioNode(), createDynamicsCompressor: () => audioNode(),
    createBufferSource: () => audioNode(), createStereoPanner: () => audioNode(),
    createWaveShaper: () => audioNode(), createDelay: () => audioNode(),
    createConvolver: () => audioNode(), createChannelMerger: () => audioNode(),
    createBuffer: (c, l) => ({ length: l, numberOfChannels: c, sampleRate: 44100,
      getChannelData: () => new Float32Array(l) }),
  });
  window.AudioContext = window.webkitAudioContext = function () { return ctx(); };
  window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
  window.cancelAnimationFrame = id => clearTimeout(id);
  window.matchMedia = q => ({ matches: !!(opts.media && opts.media[q]), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  if (!window.document.fonts) window.document.fonts = { ready: Promise.resolve() };
  // jsdom has no layout engine, so these read 0 and any code that
  // divides by them would produce Infinity rather than a wrong number.
  if (!window.ResizeObserver) window.ResizeObserver = function () {
    return { observe() {}, unobserve() {}, disconnect() {} };
  };
  window.console.error = (...a) => errors.push('console.error: ' + a.join(' '));
  window.console.warn = () => {};

  for (const [k, v] of Object.entries(opts.storage || {})) {
    window.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

  for (const f of LOAD_ORDER) {
    const file = path.join(DIR, f);
    if (!fs.existsSync(file)) continue;
    try {
      let code = fs.readFileSync(file, 'utf8');
      // `let` and `const` bindings don't survive across separate eval
      // calls, so anything module-scoped has to be exported through a
      // hook appended to the file that declares it.
      if (f === 'game.js' && opts.hook) code += opts.hook;
      if (f === 'campaign.js' && opts.campaignHook) code += opts.campaignHook;
      window.eval(code);
    } catch (e) { errors.push(f + ': ' + e.message); }
  }

  const D = window.document;
  let pass = 0, fail = 0;
  function probe(name, fn) {
    try { fn(); pass++; console.log('  ok: ' + name); }
    catch (e) { fail++; errors.push('"' + name + '": ' + e.message); console.log('  FAIL: ' + name + ' — ' + e.message); }
  }
  function report(title) {
    if (notes.length) { console.log('\n--- notes ---'); notes.forEach(l => console.log('  ' + l)); }
    console.log('\n--- errors ---');
    if (errors.length) errors.forEach(l => console.log('  ' + l));
    else console.log('  none');
    const bad = fail || errors.length;
    console.log('\n' + (bad ? `${title}: FAILED` : `${title}: all ${pass} probes passed`));
    process.exit(bad ? 1 : 0);
  }
  return { DIR, dom, window, D, errors, notes, probe, report, T: () => window.__t };
}

module.exports = { boot, findApp, audioNode, LOAD_ORDER };
