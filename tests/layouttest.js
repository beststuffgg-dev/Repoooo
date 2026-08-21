// The two layout bugs from the handoff's open items, guarded by
// measurement so neither can come back quietly.
//
// Real Chromium, not jsdom: both are layout bugs, and jsdom has no
// layout engine. Both were originally reported by eye and only became
// actionable once they had numbers on them, so the numbers are what
// this asserts.
const { chromium } = require('playwright');
const { launchOpts, openApp } = require('./browser');

let pass = 0, fail = 0;
const notes = [];
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const HEIGHTS = [760, 700, 640, 580, 520, 460];

(async () => {
  const b = await chromium.launch(launchOpts());

  // ══════════════════════════════════════
  //  (a) A shorter window scrolls more; it does not crush the list.
  // ══════════════════════════════════════
  console.log('== a shorter window means more scrolling, not a smaller list ==');
  const rows = [];
  for (const h of HEIGHTS) {
    const { ctx, page, errors } = await openApp(b, { width: 420, height: h });
    const r = await page.evaluate(() => {
      const pane = document.getElementById('tab-levels');
      const cam = document.getElementById('cam-scroll');
      const one = cam.querySelector('.lvl-row');
      return {
        pane: pane.clientHeight, paneScroll: pane.scrollHeight,
        listView: cam.clientHeight, listContent: cam.scrollHeight,
        rows: cam.querySelectorAll('.lvl-row').length,
        rowH: one ? one.getBoundingClientRect().height : 0,
        // Every sibling in the pane holds its full size; none may shrink.
        shrink: [...pane.children].map(c => getComputedStyle(c).flexShrink),
      };
    });
    rows.push([h, r]);
    ok(errors.length === 0, `420x${h}: no page errors (${errors.join('; ')})`);
    await ctx.close();
  }

  const views = rows.map(([, r]) => r.listView);
  const contents = rows.map(([, r]) => r.listContent);
  rows.forEach(([h, r]) => notes.push(
    `420x${h}  pane ${r.pane}  listViewport ${r.listView}  listContent ${r.listContent}  paneScroll ${r.paneScroll}  rows ${r.rows}`));

  ok(new Set(views).size === 1,
    `the list viewport stops tracking window height (${[...new Set(views)].join(', ')}px at every size)`);
  ok(new Set(contents).size === 1,
    `list content stays constant at ${contents[0]}px — nothing is being truncated`);
  ok(views[0] === contents[0],
    'the list is at its natural height, so the pane is the only scroller');

  {
    // The original bug: at 520 the list viewport was 39px, under one
    // 48.7px row, and the levels tab rendered nothing.
    const short = rows.find(([h]) => h === 520)[1];
    ok(short.rows > 0, `420x520 renders ${short.rows} level rows (it used to render 0)`);
    ok(short.listView > short.rowH,
      `the list viewport (${short.listView}px) is bigger than one row (${short.rowH.toFixed(1)}px)`);
    ok(short.paneScroll > short.pane,
      `the pane scrolls instead: ${short.paneScroll}px of content in a ${short.pane}px pane`);
    ok(short.shrink.every(s => Number(s) === 0),
      'no child of the pane may shrink: flex-shrink is ' + [...new Set(short.shrink)].join('/'));
  }

  // ══════════════════════════════════════
  //  (b) The header collapses continuously, and the content does not
  //      shift while it does.
  // ══════════════════════════════════════
  console.log('== the header collapse never moves the content under it ==');
  {
    const { ctx, page, errors } = await openApp(b, { width: 420, height: 640 });
    // The home screen carries a cursor-driven 3D tilt; it scales
    // getBoundingClientRect by a hair and would show up as drift.
    await page.evaluate(() => { document.getElementById('home').style.transform = 'none'; });
    const setup = await page.evaluate(() => {
      RD_Header.measure();
      return { C: RD_Header.total, hero: document.getElementById('home-hero').getBoundingClientRect().height };
    });
    notes.push(`collapsible budget: ${setup.C.toFixed(1)}px (hero ${setup.hero.toFixed(1)}px + bar and nav deltas)`);
    ok(setup.C > setup.hero, 'the budget is the hero plus the bar and nav deltas, not the hero alone');

    const STEP = 20, TICKS = 26;
    const seen = [];
    for (let i = 0; i < TICKS; i++) {
      await page.mouse.move(210, 420);
      await page.mouse.wheel(0, STEP);
      await page.waitForTimeout(35);
      seen.push(await page.evaluate(() => {
        const el = document.querySelector('#cam-scroll > *');
        return {
          top: el.getBoundingClientRect().top,
          collapse: RD_Header.collapsed,
          scrollTop: document.getElementById('tab-levels').scrollTop,
          pad: parseFloat(getComputedStyle(document.getElementById('tab-levels')).paddingTop),
          hero: document.getElementById('home-hero').getBoundingClientRect().height,
          compact: document.body.classList.contains('compact'),
        };
      }));
    }

    let worst = 0, worstAt = 0;
    for (let i = 1; i < seen.length; i++) {
      const moved = seen[i - 1].top - seen[i].top;
      if (Math.abs(moved - STEP) > worst) { worst = Math.abs(moved - STEP); worstAt = i; }
    }
    notes.push(`content moved 1:1 with the wheel across ${TICKS} ticks; worst deviation ${worst.toFixed(2)}px (tick ${worstAt})`);
    ok(worst < 1.5, `content tracks the wheel exactly — worst deviation ${worst.toFixed(2)}px (a jump would be ~119px)`);

    // The collapse itself has to actually happen, or the probe above
    // passes on a header that never moves.
    const collapses = seen.map(s => s.collapse);
    ok(Math.max(...collapses) >= setup.C - 1, `the header collapses its full ${setup.C.toFixed(0)}px budget`);
    ok(collapses.every((c, i) => i === 0 || c >= collapses[i - 1] - 0.01), 'the collapse is monotone — it never oscillates');
    ok(new Set(collapses).size > 4, `the collapse is continuous, not binary (${new Set(collapses).size} distinct values)`);
    ok(Math.min(...seen.map(s => s.hero)) < 1, 'the hero reaches zero height rather than stalling on its own padding');

    // The pixels the header gives up have to reappear inside the
    // scroller, or the content moves twice per scrolled pixel. The
    // pane's padding-top is where they go, and it must track the
    // collapse exactly — this is the whole mechanism.
    const pad0 = Math.min(...seen.map(s => s.pad - s.collapse));
    const drift = Math.max(...seen.map(s => Math.abs((s.pad - s.collapse) - pad0)));
    notes.push(`pane padding tracks the collapse from a ${pad0}px base; worst drift ${drift.toFixed(2)}px`);
    ok(drift < 0.5, `the pane's padding grows by exactly the collapse (drift ${drift.toFixed(2)}px)`);
    ok(seen.some(s => s.collapse > 0 && s.scrollTop > 0),
      'the pane scrolls natively throughout — scrollTop is never forced');

    // The class survives only as a cosmetic switch.
    ok(seen.some(s => s.compact) && seen.some(s => !s.compact), 'the compact class still toggles, for the cosmetic swaps');

    // Scrolling back up must expand it again, with no hysteresis gap.
    for (let i = 0; i < TICKS + 4; i++) {
      await page.mouse.wheel(0, -STEP);
      await page.waitForTimeout(25);
    }
    const back = await page.evaluate(() => ({
      collapse: RD_Header.collapsed,
      hero: document.getElementById('home-hero').getBoundingClientRect().height,
      compact: document.body.classList.contains('compact'),
    }));
    notes.push(`after scrolling back to the top: collapse ${back.collapse.toFixed(1)}px, hero ${back.hero.toFixed(1)}px`);
    ok(back.collapse < 1, 'scrolling back to the top fully expands the header');
    ok(!back.compact, 'and drops the compact class with it');
    ok(errors.length === 0, 'no page errors through the whole collapse (' + errors.join('; ') + ')');
    await ctx.close();
  }

  console.log('== the header re-measures when the window changes ==');
  {
    const { ctx, page } = await openApp(b, { width: 420, height: 700 });
    const before = await page.evaluate(() => RD_Header.total);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => RD_Header.total);
    notes.push(`collapsible budget at 420px: ${before.toFixed(1)}px, at 320px: ${after.toFixed(1)}px`);
    ok(after > 0, 'the budget is still measured after a resize');
    await ctx.close();
  }

  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `layouttest: ${fail} of ${pass + fail} probes FAILED` : `layouttest: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
