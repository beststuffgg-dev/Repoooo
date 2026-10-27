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
  const sheet = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  const rules = [];
  let depth = 0, buf = '', head = '', bodyStart = 0;
  for (let i = 0; i < sheet.length; i++) {
    const ch = sheet[i];
    if (ch === '"' || ch === "'") {
      const from = i;
      i++;
      while (i < sheet.length && sheet[i] !== ch) { if (sheet[i] === '\\') i++; i++; }
      if (depth === 0) buf += sheet.slice(from, i + 1);
      continue;
    }
    if (ch === '{') {
      if (depth === 0) { head = buf.trim(); bodyStart = i + 1; }
      depth++;
      buf = '';
    } else if (ch === '}') {
      depth--;
      if (depth === 0) rules.push({ head, body: sheet.slice(bodyStart, i) });
      buf = '';
    } else if (depth === 0) buf += ch;
  }

  const modern = rules.filter(r => !/^@/.test(r.head) && /gfx-modern/.test(r.head));
  const parts = modern.flatMap(r => r.head.split(',').map(s => s.trim()).filter(Boolean));
  notes.push(parts.length + ' selectors in the graphics layer');
  ok(parts.length > 20, 'the graphics layer is in the stylesheet (' + parts.length + ' selectors)');

  const unscoped = parts.filter(p => !/^body\.gfx-modern\b/.test(p));
  ok(unscoped.length === 0, unscoped.length
    ? 'these are not scoped to body.gfx-modern: ' + unscoped.slice(0, 4).join(' | ')
    : 'every one of the ' + parts.length + ' selectors is scoped under body.gfx-modern');

  const mentions = (sheet.match(/gfx-modern/g) || []).length;
  const scopedMentions = (parts.join(' ').match(/gfx-modern/g) || []).length;
  ok(mentions === scopedMentions, 'no other rule, value or at-rule references gfx-modern (' + (mentions - scopedMentions) + ' do)');

  const keyframes = new Set(rules.filter(r => /^@keyframes/.test(r.head)).map(r => r.head.replace(/^@keyframes\s+/, '')));
  const used = [...new Set(modern.flatMap(r => [...r.body.matchAll(/animation(?:-name)?\s*:\s*([\w-]+)/g)].map(m => m[1])))];
  ok(used.every(n => /-m$/.test(n) && keyframes.has(n)), used.length
    ? 'animations in the layer are uniquely named so they cannot shadow the originals (' + used.join(', ') + ')'
    : 'no animations in the layer');
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
