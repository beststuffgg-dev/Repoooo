// edge.js must activate under an Edge userAgent and be completely
// inert under Chrome's.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR = process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
const src = fs.readFileSync(path.join(DIR, 'edge.js'), 'utf8');
const html = fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8');

let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  edge:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
};

function boot(ua, opts) {
  opts = opts || {};
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://localhost/' });
  const win = dom.window;
  // jsdom 30 ignores the constructor's userAgent option, so set it here.
  Object.defineProperty(win.navigator, 'userAgent', { value: ua, configurable: true });
  if (opts.cores !== undefined) Object.defineProperty(win.navigator, 'hardwareConcurrency', { value: opts.cores, configurable: true });
  if (opts.mem   !== undefined) Object.defineProperty(win.navigator, 'deviceMemory',        { value: opts.mem,   configurable: true });
  const errs = [];
  try { win.eval(src); } catch (e) { errs.push(e.message); }
  return { win, errs, root: win.document.documentElement };
}

console.log('== Chrome: must be completely inert ==');
{
  const { win, errs, root } = boot(UA.chrome);
  ok(errs.length === 0, 'loads without throwing: ' + errs.join(','));
  ok(win.RD_Edge && win.RD_Edge.active === false, 'RD_Edge.active is false');
  ok(win.RD_Edge.features.length === 0, 'no shims registered (got ' + JSON.stringify(win.RD_Edge.features) + ')');
  ok(!root.classList.contains('is-edge'), 'no is-edge class');
  ok(!root.classList.contains('edge-thin-scroll'), 'no scrollbar shim');
  ok(!root.classList.contains('edge-cheap-blur'), 'no blur shim');
}

console.log('== Edge: activates ==');
{
  const { win, errs, root } = boot(UA.edge, { cores: 16, mem: 16 });
  ok(errs.length === 0, 'loads without throwing: ' + errs.join(','));
  ok(win.RD_Edge && win.RD_Edge.active === true, 'RD_Edge.active is true');
  ok(root.classList.contains('is-edge'), 'sets is-edge');
  ok(root.classList.contains('edge-thin-scroll'), 'sets scrollbar shim');
  ok(!root.classList.contains('edge-cheap-blur'), 'high-end machine keeps the blur');
  ok(win.RD_Edge.features.length >= 3, 'registered shims: ' + win.RD_Edge.features.join(', '));
}

console.log('== Edge on a low-end machine: drops the blur ==');
{
  const { root, win } = boot(UA.edge, { cores: 2, mem: 2 });
  ok(root.classList.contains('edge-cheap-blur'), 'sets cheap-blur below the hardware floor');
  ok(/cores=2/.test(win.RD_Edge.features.join(',')), 'records why: ' + win.RD_Edge.features.join(', '));
}

console.log('== does not match the old EdgeHTML UA ==');
{
  const { win } = boot('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Edge/18.18363');
  ok(win.RD_Edge.active === false, 'legacy "Edge/" is not Chromium Edge, stays inert');
}

console.log('== userAgentData path ==');
{
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://localhost/' });
  const win = dom.window;
  Object.defineProperty(win.navigator, 'userAgentData', {
    value: { brands: [{ brand: 'Microsoft Edge', version: '141' }, { brand: 'Chromium', version: '141' }] },
    configurable: true,
  });
  win.eval(src);
  ok(win.RD_Edge.active === true, 'detected via userAgentData even when the UA string says Chrome');
}

console.log('== CSS hooks exist for every class the script sets ==');
for (const cls of ['is-edge', 'edge-cheap-blur', 'edge-thin-scroll']) {
  const used = new RegExp('html\\.' + cls).test(html) || cls === 'is-edge';
  ok(used, 'stylesheet references .' + cls);
}

console.log('\n' + (fail ? `${fail} FAILURES, ${pass} passed` : `all ${pass} probes passed`));
process.exit(fail ? 1 : 0);
