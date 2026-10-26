// Campaign themes — one per area, earned by clearing every song in it.
//
// The unlock is derived from campaign progress (areaCleared), not stored,
// so the things worth proving are the rule itself, the places it has to
// hold (the picker, a saved choice on boot) and the moment it fires (the
// clear that finishes an area). Plus what makes a theme worth earning:
// each has its own texture, and none is unreadable.
const { chromium } = require('playwright');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const APP = 'file://' + path.join(v8Dir(), 'popup.html');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

// A progress blob with `full` areas completely cleared, plus any extra keys.
const progressWith = (full, extra) => {
  const cleared = {};
  for (let a = 1; a <= full; a++) for (let i = 0; i < 15; i++) cleared['a' + a + 'l' + i] = true;
  (extra || []).forEach(k => { cleared[k] = true; });
  return JSON.stringify({ xp: 100, cleared });
};

(async () => {
  const b = await chromium.launch(launchOpts());
  const errors = [];
  const open = async (progress, theme) => {
    const ctx = await b.newContext({ viewport: { width: 420, height: 640 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([p, t]) => {
      localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 0 }));
      if (p) localStorage.setItem('rd_progress', p);
      if (t) localStorage.setItem('rd_theme', t);
    }, [progress, theme]);
    await page.goto(APP, { waitUntil: 'load' });
    await page.waitForTimeout(1300);
    // Open the Themes tab the way a player does: panes are built when
    // their tab is shown, not before.
    await page.evaluate(() => { showScreen('home'); renderHome(); document.querySelector('.hnav[data-tab="themes"]').click(); });
    return { ctx, page };
  };

  console.log('== ten themes, one per area ==');
  {
    const { ctx, page } = await open(null);
    const r = await page.evaluate(() => {
      const camp = THEMES.filter(t => t.area);
      const grains = THEMES.map(t => { applyTheme(t.id); return getComputedStyle(document.body).getPropertyValue('--mat-grain').trim(); });
      applyTheme('graphite');
      const need = ['--bg', '--bg2', '--bg3', '--bg4', '--border', '--border2', '--text', '--muted', '--dim',
        '--tap', '--tap2', '--dtap', '--dtap2', '--good', '--perfect', '--miss', '--lane-flash', '--glow-tap', '--glow-dtap', '--accent'];
      const incomplete = [];
      camp.forEach(t => {
        applyTheme(t.id);
        const s = getComputedStyle(document.body);
        const miss = need.filter(v => !s.getPropertyValue(v).trim());
        if (miss.length) incomplete.push(t.id + ': ' + miss.join(','));
      });
      applyTheme('graphite');
      const areas = window.RD_Campaign.AREAS.map(a => a.id);
      return { ids: camp.map(t => t.id), areasOf: camp.map(t => t.area), areas, incomplete, total: THEMES.length,
        distinctGrains: new Set(grains).size, grainCount: grains.length,
        base: (() => { applyTheme('graphite'); return getComputedStyle(document.body).getPropertyValue('--mat-grain').trim(); })(),
        campGrains: camp.map(t => { applyTheme(t.id); return getComputedStyle(document.body).getPropertyValue('--mat-grain').trim(); }),
      };
    });
    notes.push('campaign themes: ' + r.ids.join(', '));
    ok(r.ids.length === 10, 'there are ten campaign themes (' + r.ids.length + ')');
    ok(JSON.stringify(r.areasOf) === JSON.stringify(r.areas), 'one per area, in campaign order (' + r.areasOf.join(',') + ')');
    ok(new Set(r.ids).size === 10, 'with ten distinct ids');
    ok(r.incomplete.length === 0, 'every one defines the whole token set' + (r.incomplete.length ? ': ' + r.incomplete.join(' | ') : ''));
    ok(r.campGrains.every(g => g && g !== 'none' && g.length > 30), 'every one carries its own texture');
    ok(new Set(r.campGrains).size === 10, 'and all ten textures are different from each other');
    ok(r.campGrains.every(g => g !== r.base), 'and none is the shared base grain');
    ok(r.total === 30, 'the twenty existing themes are all still there (' + r.total + ' in total)');
    await ctx.close();
  }

  console.log('== a fresh profile: all ten are locked, none of the others ==');
  {
    const { ctx, page } = await open(null);
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#themes-grid .theme-card')];
      const locked = cards.filter(c => c.classList.contains('locked')).map(c => c.dataset.theme);
      return { cards: cards.length, locked,
        head: document.querySelector('.themes-section') && document.querySelector('.themes-section').textContent,
        lockText: [...document.querySelectorAll('.tc-lock')].map(e => e.textContent),
        pre: THEMES.filter(t => !t.area).every(t => !isThemeLocked(t)) };
    });
    ok(r.cards === 30, 'all 30 are listed (' + r.cards + ')');
    ok(r.locked.length === 10, 'exactly the ten campaign themes are locked (' + r.locked.length + ')');
    ok(r.pre, 'none of the original themes is ever locked');
    ok(/0\/10 earned/i.test(r.head), 'the section says how many are earned: "' + r.head + '"');
    ok(r.lockText[0] === '🔒 Clear Farmstead' && r.lockText[9] === '🔒 Clear Retro-Future',
      'each says which area unlocks it: ' + r.lockText.slice(0, 2).join(' / ') + ' … ' + r.lockText[9]);

    // Tapping a locked card does nothing but explain.
    const t = await page.evaluate(() => {
      const before = store.loadTheme();
      document.querySelector('.theme-card[data-theme="harvest"]').click();
      const toast = document.getElementById('rd-toast');
      return { before, after: store.loadTheme(), cls: document.body.className.includes('theme-harvest'),
        toast: toast ? toast.textContent : '' };
    });
    ok(t.after === t.before && !t.cls, 'tapping a locked theme does not apply it');
    ok(/Farmstead/.test(t.toast) && /Harvest/.test(t.toast), 'it says what to do: "' + t.toast + '"');
    await ctx.close();
  }

  console.log('== the unlock follows the area, and only the whole area ==');
  {
    const cases = [
      ['area 1 at 14 of 15 songs', progressWith(0, Array.from({ length: 14 }, (_, i) => 'a1l' + i)), []],
      ['area 1 complete',           progressWith(1), ['harvest']],
      ['areas 1-3 complete',        progressWith(3), ['harvest', 'lapis', 'marble']],
      // Area 2 done without area 1: unreachable in play, but the rule is per area.
      ['area 2 alone',              progressWith(0, Array.from({ length: 15 }, (_, i) => 'a2l' + i)), ['lapis']],
      ['all ten complete',          progressWith(10), ['harvest', 'lapis', 'marble', 'imperium', 'obsidian', 'jade', 'oakmoss', 'braid', 'concrete', 'chrome']],
    ];
    for (const [label, prog, want] of cases) {
      const { ctx, page } = await open(prog);
      const got = await page.evaluate(() => THEMES.filter(t => t.area && !isThemeLocked(t)).map(t => t.id));
      const shown = await page.evaluate(() => [...document.querySelectorAll('#themes-grid .theme-card:not(.locked)')]
        .map(c => c.dataset.theme).filter(id => THEMES.find(t => t.id === id).area));
      ok(JSON.stringify(got) === JSON.stringify(want), label + ' → ' + (got.join(', ') || 'none'));
      ok(JSON.stringify(shown) === JSON.stringify(want), '   and the picker agrees');
      await ctx.close();
    }
  }

  console.log('== an earned theme can be worn ==');
  {
    const { ctx, page } = await open(progressWith(2));
    const r = await page.evaluate(() => {
      document.querySelector('.theme-card[data-theme="lapis"]').click();
      return { stored: store.loadTheme(), cls: document.body.className, selected: document.querySelector('.theme-card.selected').dataset.theme,
        bg: getComputedStyle(document.body).getPropertyValue('--bg').trim() };
    });
    ok(r.stored === 'lapis' && /theme-lapis/.test(r.cls), 'tapping an earned theme applies it');
    ok(r.selected === 'lapis', 'and marks it selected');
    ok(/gfx-modern/.test(r.cls), 'the graphics style class survives the change');
    // That it is applied again on the next boot is covered below, with the
    // saved choice seeded before load, which does not depend on timing.
    ok(r.bg.toLowerCase() === '#13100b', 'and it really is the new palette (' + r.bg + ')');
    await ctx.close();
  }

  console.log('== a saved theme that is not earned is not worn ==');
  {
    const a = await open(null, 'jade');
    const r1 = await a.page.evaluate(() => ({ cls: document.body.className, stored: store.loadTheme() }));
    ok(!/theme-jade/.test(r1.cls), 'a saved campaign theme with no progress is not applied on boot');
    ok(/theme-graphite/.test(r1.cls) && r1.stored === 'graphite', 'it falls back to the default (' + r1.stored + ')');
    await a.ctx.close();
    const c = await open(progressWith(6), 'jade');
    const r2 = await c.page.evaluate(() => ({ cls: document.body.className, stored: store.loadTheme() }));
    ok(/theme-jade/.test(r2.cls) && r2.stored === 'jade', 'but the same saved theme is kept once the area is cleared');
    await c.ctx.close();
  }

  console.log('== the clear that finishes an area announces its theme ==');
  {
    // Fourteen of fifteen Farmstead songs cleared; play the last one.
    const prog = progressWith(0, Array.from({ length: 14 }, (_, i) => 'a1l' + i));
    const { ctx, page } = await open(prog);
    const r = await page.evaluate(() => {
      const play = (idx, won) => {
        launchCampaignLevel(1, idx);
        document.getElementById('g-overlay').classList.remove('show');
        startGame(); notesHit = notesTotal; score = 100; endGame(won);
        const el = document.getElementById('ov-theme');
        return { shown: el.style.display === 'block', text: el.textContent };
      };
      const out = {};
      out.before = isThemeLocked(themeById('harvest'));
      out.midClear = play(3, true);               // an already-cleared mid-area song
      out.failed = play(14, false);               // failing the last one earns nothing
      out.stillLocked = isThemeLocked(themeById('harvest'));
      out.final = play(14, true);                 // the clear that finishes the area
      out.nowLocked = isThemeLocked(themeById('harvest'));
      out.again = play(14, true);                 // clearing it a second time
      out.other = (() => { launchCampaignLevel(2, 0); document.getElementById('g-overlay').classList.remove('show');
        startGame(); notesHit = notesTotal; score = 1; endGame(true);
        const el = document.getElementById('ov-theme'); return el.style.display === 'block'; })();
      return out;
    });
    ok(r.before, 'Harvest starts locked');
    ok(!r.midClear.shown, 're-clearing a song in the middle of the area announces nothing');
    ok(!r.failed.shown && r.stillLocked, 'failing the last song earns nothing');
    ok(r.final.shown && /Harvest/.test(r.final.text), 'clearing the last song announces it: "' + r.final.text + '"');
    ok(!r.nowLocked, 'and the theme is unlocked');
    ok(!r.again.shown, 'clearing it again does not announce it a second time');
    ok(!r.other, 'the first song of the next area announces nothing');
    await ctx.close();
  }

  console.log('== readable: every theme clears contrast ==');
  {
    const { ctx, page } = await open(progressWith(10));
    const rows = await page.evaluate(() => {
      const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      return THEMES.filter(t => t.area).map(t => {
        applyTheme(t.id);
        const s = getComputedStyle(document.body);
        const v = n => { const d = document.createElement('div'); d.style.color = s.getPropertyValue(n).trim(); document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
        const bg = v('--bg'), bg2 = v('--bg2'), bg3 = v('--bg3');
        return { id: t.id, text: Math.min(cr(v('--text'), bg), cr(v('--text'), bg3)),
          muted: cr(v('--muted'), bg2),
          ink: Math.min(cr(v('--tap'), bg2), cr(v('--dtap'), bg2), cr(v('--accent'), bg), cr(v('--perfect'), bg2), cr(v('--miss'), bg2)),
          scheme: s.colorScheme };
      });
    });
    const worst = k => rows.reduce((a, r) => (r[k] < a.v ? { v: r[k], id: r.id } : a), { v: 99, id: '' });
    notes.push('worst contrast — text ' + worst('text').v.toFixed(1) + ' (' + worst('text').id + '), muted ' + worst('muted').v.toFixed(1)
      + ' (' + worst('muted').id + '), tap/dtap/accent/judgement ' + worst('ink').v.toFixed(1) + ' (' + worst('ink').id + ')');
    ok(worst('text').v >= 7, 'body text is at least 7:1 on every surface in every theme (' + worst('text').v.toFixed(1) + ')');
    ok(worst('muted').v >= 4.5, 'secondary text is at least 4.5:1 (' + worst('muted').v.toFixed(1) + ' at worst)');
    ok(worst('ink').v >= 4.5, 'note, accent and judgement colours are at least 4.5:1 (' + worst('ink').v.toFixed(1) + ' at worst)');
    const light = rows.filter(r => /light/.test(r.scheme)).map(r => r.id);
    ok(JSON.stringify(light) === JSON.stringify(['marble', 'concrete']), 'the two light themes tell the browser so (' + light.join(', ') + ')');
    await ctx.close();
  }

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8themes: ${fail} of ${pass + fail} probes FAILED` : `v8themes: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
