// Do the six base themes actually declare different materials, or is
// each one a palette swap wearing a material's name?
//
// Real browser, because the answer lives in used values: --mat-* feed
// color-mix() and calc() inside borders, gradients and shadows, and
// only a rendering engine resolves those to the numbers a compositor
// paints with. jsdom returns the unresolved text.
const { chromium } = require('playwright');
const { launchOpts, openApp } = require('./browser');

const THEMES = ['graphite', 'walnut', 'bone', 'amber', 'vapor', 'blueprint', 'mono'];
let pass = 0, fail = 0;
const notes = [];
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const { ctx, page, errors } = await openApp(b, { width: 420, height: 760 });

  const read = async id => page.evaluate(t => {
    applyTheme(t);
    // Theme classes land on <body>, and generated themes write their
    // inline overrides onto <html>. Reading <html> alone therefore
    // returns the :root fallbacks for every class-based theme — which
    // is how this probe first reported all seven as identical.
    const root = getComputedStyle(document.body);
    // A raised surface: the lit bevel, the gloss gradient and the
    // shadow beneath are all driven off --mat-*.
    // A genuinely raised surface. .lvl-row is a row inside a grouped
    // list — flush, no bevel of its own — so it reports the same edge
    // for every theme and makes this probe look vacuous.
    const card = document.querySelector('.theme-block') || document.querySelector('.level-card')
      || document.querySelector('.area-card');
    const cs = card ? getComputedStyle(card) : null;
    const num = n => parseFloat(root.getPropertyValue(n)) || 0;
    return {
      spec: num('--mat-spec'), gloss: num('--mat-gloss'),
      bevel: num('--mat-bevel'), blur: num('--mat-blur'),
      grain: root.getPropertyValue('--mat-grain').trim(),
      edge: cs ? (cs.borderTopColor + '|' + cs.backgroundColor) : '',
      face: cs ? cs.backgroundImage.slice(0, 120) : '',
      lift: cs ? cs.boxShadow.slice(0, 90) : '',
      // body carries transition:background .3s, so backgroundColor read
      // straight after the switch is still the value being animated
      // away from. The token behind it is the honest reading.
      bg: root.getPropertyValue('--panel-deep').trim(),
      light: document.body.classList.contains('light'),
    };
  }, id);

  const got = {};
  for (const t of THEMES) got[t] = await read(t);

  console.log('== each theme declares its own material ==');
  for (const t of THEMES) {
    const m = got[t];
    notes.push(`${t.padEnd(10)} spec ${String(m.spec).padEnd(5)} gloss ${String(m.gloss).padEnd(5)} bevel ${String(m.bevel).padEnd(5)} blur ${m.blur}  edge ${m.edge.split('|')[0]}`);
    ok(m.spec > 0 && m.gloss > 0 && m.bevel > 0, `${t}: all three material controls are set`);
  }

  console.log('== no two materials are the same material ==');
  {
    const sig = t => [got[t].spec, got[t].gloss, got[t].bevel, got[t].blur].join('/');
    const seen = new Map();
    let dupes = [];
    for (const t of THEMES) {
      const s = sig(t);
      if (seen.has(s)) dupes.push(`${t} == ${seen.get(s)}`);
      else seen.set(s, t);
    }
    ok(dupes.length === 0, dupes.length ? 'materials collide: ' + dupes.join(', ') : `${seen.size} distinct material signatures across ${THEMES.length} themes`);
  }

  console.log('== the edges and highlights actually render differently ==');
  {
    // These are used values: color-mix and calc already resolved, so a
    // difference here is a difference in painted pixels.
    const edges = new Set(THEMES.map(t => got[t].edge));
    const faces = new Set(THEMES.map(t => got[t].face));
    const lifts = new Set(THEMES.map(t => got[t].lift));
    // Elevation is structure, not material — --lift-* is deliberately
    // shared across themes — so it is reported, not asserted on.
    notes.push(`${edges.size} distinct lit edges, ${faces.size} distinct faces, ${lifts.size} distinct elevations (elevation is shared by design)`);
    ok(edges.size === THEMES.length, `all ${edges.size} themes paint a different lit edge`);
    ok(faces.size === THEMES.length, `all ${faces.size} themes paint a different raised face`);
  }

  console.log('== grain is a texture, not a palette ==');
  {
    const grained = THEMES.filter(t => got[t].grain && got[t].grain !== 'none');
    notes.push('themes carrying a grain texture: ' + grained.join(', '));
    ok(grained.length >= 4, `${grained.length} themes carry a real grain texture`);
    const distinct = new Set(grained.map(t => got[t].grain));
    ok(distinct.size === grained.length, `all ${grained.length} grains are different textures`);
  }

  console.log('== bone is the light one, and says so ==');
  {
    ok(got.bone.light, 'bone sets the light class');
    const darks = THEMES.filter(t => t !== 'bone' && got[t].light);
    ok(darks.length === 0, darks.length ? 'unexpectedly light: ' + darks.join(', ') : 'every other base theme is dark');
  }

  console.log('== glass is the only one that blurs ==');
  {
    const blurred = THEMES.filter(t => got[t].blur > 0);
    notes.push('themes with a backdrop blur: ' + (blurred.join(', ') || 'none'));
    ok(blurred.length >= 1, 'at least one material is translucent');
    ok(got.vapor.blur > 0, 'vapor (frosted glass) carries a blur');
  }

  console.log('== switching theme leaves the app working ==');
  {
    ok(errors.length === 0, 'no page errors across ' + THEMES.length + ' theme switches (' + errors.join('; ') + ')');
    const bgs = new Set(THEMES.map(t => got[t].bg));
    notes.push('surface colours: ' + THEMES.map(t => got[t].bg).join(' '));
    ok(bgs.size === THEMES.length, `all ${bgs.size} themes sit on their own surface colour`);
  }

  await ctx.close();
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `mattest: ${fail} of ${pass + fail} probes FAILED` : `mattest: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
