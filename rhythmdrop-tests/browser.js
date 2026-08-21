// Which Chromium do the browser-driven suites launch, and which build
// do they point at?
//
// Playwright's own default asks for a headless-shell build, which is
// not always installed next to the full browser — so resolve the
// newest full Chromium we can actually find, and let PW_CHROME
// override when the machine has something else.
//
// APP_DIR picks the build under test. Unset, it's the shipping one.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function appDir() {
  const d = process.env.APP_DIR;
  if (!d) return path.join(ROOT, 'RhythmDropV7');
  return path.isAbsolute(d) ? d : path.resolve(__dirname, d);
}

function chromePath() {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return null;
  const builds = fs.readdirSync(base)
    // headless_shell is a different, thinner binary; the layout suites
    // need the real browser.
    .filter(n => /^chromium(-\d+)?$/.test(n))
    .map(n => {
      const m = /(\d+)$/.exec(n);
      return { n, rev: m ? Number(m[1]) : 0 };
    })
    .sort((a, b) => b.rev - a.rev);
  for (const b of builds) {
    for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe', 'chrome']) {
      const p = path.join(base, b.n, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function launchOpts() {
  const exe = chromePath();
  // --no-sandbox: these run as root in a container more often than not.
  return exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] };
}

// Boot the popup past the splash and the first-run username screen, so
// a probe starts on the home screen with a real profile.
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

module.exports = { ROOT, appDir, chromePath, launchOpts, openApp };
