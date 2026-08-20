// Finds the Chromium the browser-driven suites should launch.
//
// Playwright's own default resolution asks for a headless-shell build
// that isn't necessarily installed alongside the full browser, so
// leaving executablePath undefined fails on machines that only have
// the latter. Resolve it ourselves, newest build first, and let
// PW_CHROME override for anything unusual.
const fs = require('fs');
const path = require('path');

function chromeExe() {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return undefined; }
  const builds = dirs
    .filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => +b.split('-')[1] - +a.split('-')[1]);
  for (const d of builds) {
    const exe = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  // Nothing found — hand back undefined and let Playwright try its own
  // lookup, so the error the user sees is Playwright's, not ours.
  return undefined;
}

module.exports = { chromeExe };
