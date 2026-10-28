const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'RhythmDrop');
const V8   = path.join(SRC, 'RhythmDropV8');
const V7   = path.join(SRC, 'v7');
const HTML = path.join(ROOT, 'htmls');

const isBuild = d => fs.existsSync(path.join(d, 'popup.html'));

function appDir() {
  const d = process.env.APP_DIR;
  const tries = d
    ? [path.resolve(d), path.resolve(__dirname, d), path.resolve(SRC, d),
       path.resolve(V7, d), path.resolve(ROOT, d)]
    : [path.join(V7, 'RhythmDropV7'),
       path.join(ROOT, 'RhythmDropV7'),
       path.join(__dirname, 'RhythmDropV7'),
       path.join(process.cwd(), 'RhythmDropV7'),
       ROOT];
  for (const t of tries) if (isBuild(t)) return t;
  console.error('Could not find popup.html.' + (d ? ' APP_DIR=' + d + ' matched nothing.' : ''));
  console.error('Looked in:\n  ' + tries.join('\n  '));
  process.exit(2);
}

const htmlBuild = name => path.join(HTML, name);

const v8Dir = () => (process.env.V8_DIR ? path.resolve(process.env.V8_DIR) : V8);

function chromePath() {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return null;
  const builds = fs.readdirSync(base)
    .filter(n => /^chromium(-\d+)?$/.test(n))
    .map(n => {
      const m = /(\d+)$/.exec(n);
      return { n, rev: m ? Number(m[1]) : 0 };
    })
    .sort((a, b) => b.rev - a.rev);
  for (const b of builds) {
    for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe', 'chrome']) {
      const p = path.join(base, b.n, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function launchOpts() {
  const exe = chromePath();
  return exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] };
}

async function openApp(browser, viewport, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport }, opts.context || {}));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('rd_tutorial', '1');
    localStorage.setItem('rd_profile', JSON.stringify({ username: 'Probe', coins: 50000 }));
  });
  const file = opts.file || path.join(appDir(), 'popup.html');
  await page.goto('file://' + file, { waitUntil: 'load' });
  await page.waitForTimeout(opts.settle || 1300);
  await page.evaluate(() => {
    const s = document.getElementById('boot-splash');
    if (s) s.remove();
    if (typeof showScreen === 'function') showScreen('home');
  });
  await page.waitForTimeout(200);
  return { ctx, page, errors };
}

module.exports = { ROOT, SRC, V7, V8, HTML, appDir, v8Dir, htmlBuild, chromePath, launchOpts, openApp };
