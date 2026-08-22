// The updated graphics, and the promise that the old ones still work.
//
// "Keeping the old style available" is only worth anything if the old
// style is actually untouched, so the guarantee here is structural: the
// whole graphics layer is scoped under one body class, so with the
// class off there is nothing left to render differently. That is
// checked by reading the stylesheet, not by trusting the intent.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const DIR = v8Dir();
const HTML = fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

console.log('== the graphics layer is strictly additive ==');
{
  const at = HTML.indexOf('UPDATED GRAPHICS');
  ok(at > 0, 'the graphics block is in the stylesheet');
  // Slice from the comment's own opening, not from the text inside it:
  // starting mid-comment leaves the stripper an unbalanced `*/` and it
  // hands the banner back as if it were a selector.
  const start = HTML.lastIndexOf('/*', at);
  const end = HTML.lastIndexOf('/*', HTML.indexOf('CREATOR (standard)', at));
  const block = HTML.slice(start, end);

  // Strip comments, then read every selector the block declares.
  const bare = block.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const selectors = [];
  let depth = 0, buf = '';
  for (let i = 0; i < bare.length; i++) {
    const ch = bare[i];
    if (ch === '{') {
      if (depth === 0) { const t = buf.trim(); if (t) selectors.push(t); buf = ''; }
      depth++;
    } else if (ch === '}') { depth--; buf = ''; }
    else if (depth === 0) buf += ch;
  }
  // Split comma-separated groups; keyframes and at-rules are their own thing.
  const rules = [];
  selectors.forEach(sel => {
    if (/^@/.test(sel)) { rules.push(sel); return; }
    sel.split(',').forEach(s => { const t = s.trim(); if (t) rules.push(t); });
  });
  notes.push(rules.length + ' selectors in the graphics block');

  const unscoped = rules.filter(r => !/^@/.test(r) && !/^body\.gfx-modern\b/.test(r));
  ok(unscoped.length === 0, unscoped.length
    ? 'these are not scoped to body.gfx-modern: ' + unscoped.slice(0, 4).join(' | ')
    : 'every one of the ' + rules.length + ' selectors is scoped under body.gfx-modern');

  const atRules = rules.filter(r => /^@/.test(r));
  ok(atRules.every(r => /^@keyframes\s+[\w-]*-m\b/.test(r)), atRules.length
    ? 'at-rules are uniquely named so they cannot shadow the originals (' + atRules.join(', ') + ')'
    : 'no at-rules in the block');

  // Nothing outside the block may mention the class, or "class off ==
  // original" stops being true.
  const outside = HTML.slice(0, start) + HTML.slice(end);
  ok(!/gfx-modern/.test(outside), 'no rule outside the block references gfx-modern');
}

console.log('== the old style is offered as a real choice ==');
{
  const game = fs.readFileSync(path.join(DIR, 'game.js'), 'utf8');
  ok(/GFX_STYLES\s*=\s*\[/.test(game), 'there is a styles list to pick from');
  const m = game.match(/GFX_STYLES = \[([\s\S]*?)\];/);
  const ids = [...(m ? m[1] : '').matchAll(/\['([\w-]+)'/g)].map(x => x[1]);
  notes.push('styles offered: ' + ids.join(', '));
  ok(ids.includes('classic') && ids.includes('modern'), 'both classic and modern are offered');
  ok(/gfx:\s*'modern'/.test(game), 'modern is the default');
  ok(/classList\.toggle\('gfx-modern'/.test(game), 'the setting drives the class');
  // applyTheme replaces body.className wholesale — the class has to be
  // carried across or picking a theme turns the graphics off.
  ok(/keep = \[[^\]]*'gfx-modern'/.test(game), 'the class survives a theme change');
}

(async () => {
  const b = await chromium.launch(launchOpts());

  const boot = async settings => {
    const ctx = await b.newContext({ viewport: { width: 820, height: 760 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(s => {
      localStorage.setItem('rd_profile', JSON.stringify({ username: 'Player', coins: 5000 }));
      if (s) localStorage.setItem('rd_settings', s);
    }, settings);
    await page.goto('file://' + path.join(DIR, 'popup.html'), { waitUntil: 'load' });
    await page.waitForTimeout(1300);
    await page.evaluate(() => { showScreen('home'); renderHome(); });
    return { ctx, page, errors };
  };

  console.log('== the setting takes, persists and survives a theme change ==');
  {
    const { ctx, page, errors } = await boot(null);
    const r = await page.evaluate(() => {
      const out = {};
      out.defaultOn = document.body.classList.contains('gfx-modern');
      currentSettings.gfx = 'classic'; applySettingsToDOM();
      out.offAfterClassic = !document.body.classList.contains('gfx-modern');
      currentSettings.gfx = 'modern'; applySettingsToDOM();
      out.backOn = document.body.classList.contains('gfx-modern');
      // Every theme, both ways round.
      out.survives = [];
      THEMES.forEach(t => {
        applyTheme(t.id);
        out.survives.push(t.id + ':' + document.body.classList.contains('gfx-modern'));
      });
      applyTheme('dark');
      out.themeCount = THEMES.length;
      return out;
    });
    ok(r.defaultOn, 'modern is on by default');
    ok(r.offAfterClassic, 'choosing classic takes the class off');
    ok(r.backOn, 'and choosing modern puts it back');
    const lost = r.survives.filter(s => s.endsWith(':false'));
    notes.push('themes checked: ' + r.themeCount);
    ok(lost.length === 0, lost.length ? 'the class was lost switching to: ' + lost.join(', ')
      : 'the class survives all ' + r.themeCount + ' theme switches');
    ok(errors.length === 0, 'no errors switching styles and themes (' + errors.join('; ') + ')');
    await ctx.close();
  }

  console.log('== the choice is reachable in Settings, and sticks ==');
  {
    const { ctx, page } = await boot(null);
    const r = await page.evaluate(() => {
      settingsSubTab = 'display'; buildSettingsPanel();
      const btns = [...document.querySelectorAll('#tab-settings .bg-radio-btn')]
        .filter(b => /classic|modern/i.test(b.textContent));
      const classic = btns.find(b => /classic/i.test(b.textContent));
      if (!classic) return { found: 0 };
      classic.click();
      const saved = JSON.parse(localStorage.getItem('rd_settings') || '{}');
      return { found: btns.length, gfx: currentSettings.gfx, saved: saved.gfx,
        cls: document.body.classList.contains('gfx-modern') };
    });
    ok(r.found === 2, 'both styles are offered as buttons in Settings');
    ok(r.gfx === 'classic', 'clicking Classic changes the setting');
    ok(r.saved === 'classic', 'and writes it to storage');
    ok(!r.cls, 'and takes the class off immediately');
    await ctx.close();
  }

  console.log('== the two styles genuinely look different, everywhere ==');
  {
    const screens = [
      ['home',    () => { showScreen('home'); renderHome(); }],
      ['shop',    () => { showScreen('home'); renderHome();
                          [...document.querySelectorAll('.hnav')].find(t => t.dataset.tab === 'shop').click(); }],
      ['creator', () => { openCreator(null); }],
    ];
    const shots = {};
    for (const style of ['classic', 'modern']) {
      shots[style] = {};
      for (const [name, setup] of screens) {
        const { ctx, page } = await boot(JSON.stringify({ gfx: style }));
        await page.evaluate(setup);
        await page.waitForTimeout(350);
        shots[style][name] = await page.locator('html').screenshot();
        await ctx.close();
      }
    }
    for (const [name] of screens) {
      const differs = Buffer.compare(shots.classic[name], shots.modern[name]) !== 0;
      ok(differs, name + ': modern renders differently from classic');
    }
    // And re-rendering the same style twice is stable, so the check
    // above is measuring the style and not rendering noise.
    const { ctx, page } = await boot(JSON.stringify({ gfx: 'classic' }));
    await page.evaluate(() => { showScreen('home'); renderHome(); });
    await page.waitForTimeout(350);
    const again = await page.locator('html').screenshot();
    await ctx.close();
    ok(Buffer.compare(shots.classic.home, again) === 0,
      'the same style renders identically twice — the comparison is stable');
  }

  console.log('== the board picks up the new depth ==');
  {
    const { ctx, page } = await boot(null);
    const r = await page.evaluate(async () => {
      launchCampaignLevel(1, 0);
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      // Wait for a tile to actually exist rather than guessing at a
      // delay — at 700ms none had spawned yet, and measuring nothing
      // reads exactly like measuring something unstyled.
      const t0 = Date.now();
      while (!document.querySelector('.tile') && Date.now() - t0 < 6000) {
        await new Promise(r => setTimeout(r, 100));
      }
      const lane = document.getElementById('lane0');
      const bar = lane.querySelector('.lane-hitbar');
      const tile = document.querySelector('.tile');
      return {
        sawTile: !!tile,
        laneAfter: getComputedStyle(lane, '::after').backgroundImage.slice(0, 30),
        barShadow: getComputedStyle(bar).boxShadow.length,
        tileShadow: tile ? getComputedStyle(tile).boxShadow.length : 0,
        tileRadius: tile ? getComputedStyle(tile).borderRadius : '',
      };
    });
    ok(r.sawTile, 'a tile spawned to measure');
    ok(r.laneAfter !== 'none' && r.laneAfter.length > 4, 'the lane has a depth gradient');
    ok(r.barShadow > 20, 'the strike line carries a bloom');
    ok(r.tileShadow > 40, 'tiles carry a lit edge and a cast glow');
    notes.push('tile radius under modern: ' + r.tileRadius);
    await ctx.close();
  }

  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8graphics: ${fail} of ${pass + fail} probes FAILED` : `v8graphics: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
