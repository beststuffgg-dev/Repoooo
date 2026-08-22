const {chromium}=require('playwright');const path=require('path');
const {ROOT,launchOpts}=require('./browser');
const APP=path.join(ROOT,'other','RhythmDropV8','popup.html');
let pass=0,fail=0; const ok=(c,m)=>{c?(pass++,console.log('  ok: '+m)):(fail++,console.log('  FAIL: '+m));};
(async()=>{
const b=await chromium.launch(launchOpts());
const ctx=await b.newContext({viewport:{width:1000,height:820}});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>localStorage.setItem('rd_profile',JSON.stringify({username:'P',coins:5000})));
await p.goto('file://'+APP,{waitUntil:'load'}); await p.waitForTimeout(1500);

console.log('== the height is pinned; only the width moves ==');
{
  const r=await p.evaluate(()=>{
    showScreen('home');
    const before={w:document.documentElement.offsetWidth,h:document.documentElement.offsetHeight};
    currentSettings.width=640; applySettingsToDOM();
    const after={w:document.documentElement.offsetWidth,h:document.documentElement.offsetHeight};
    currentSettings.height=999; applySettingsToDOM();
    const forced={h:document.documentElement.offsetHeight, setting:currentSettings.height};
    return {before,after,forced,resize:getComputedStyle(document.documentElement).resize};
  });
  ok(r.resize==='horizontal', 'the window grip is horizontal only (got '+r.resize+')');
  ok(r.after.w===640, 'width follows the setting: '+r.before.w+' -> '+r.after.w);
  ok(r.after.h===r.before.h, 'height did not move with it: '+r.before.h+' -> '+r.after.h);
  ok(r.forced.setting===600 && r.forced.h===600, 'asking for a 999px height is pinned back to '+r.forced.setting);
}

console.log('== opening Advanced widens the window instead of shrinking the grid ==');
{
  const r=await p.evaluate(async()=>{
    currentSettings.width=420; applySettingsToDOM();
    openCreator(null);
    await new Promise(r=>setTimeout(r,120));
    const grid=document.getElementById('cr-grid');
    const before={win:document.documentElement.offsetWidth, grid:grid.getBoundingClientRect().width,
                  panel:document.getElementById('adv-panel').getBoundingClientRect().width};
    document.getElementById('adv-toggle').click();
    await new Promise(r=>setTimeout(r,320));
    const after={win:document.documentElement.offsetWidth, grid:grid.getBoundingClientRect().width,
                 panel:document.getElementById('adv-panel').getBoundingClientRect().width,
                 overlay:document.body.classList.contains('adv-overlay')};
    document.getElementById('adv-toggle').click();
    await new Promise(r=>setTimeout(r,320));
    const closed={win:document.documentElement.offsetWidth, grid:grid.getBoundingClientRect().width,
                  saved:currentSettings.width};
    return {before,after,closed};
  });
  console.log(`   window ${r.before.win} -> ${r.after.win} -> ${r.closed.win}`);
  console.log(`   grid   ${r.before.grid.toFixed(0)} -> ${r.after.grid.toFixed(0)} -> ${r.closed.grid.toFixed(0)}`);
  console.log(`   panel  ${r.before.panel.toFixed(0)} -> ${r.after.panel.toFixed(0)}`);
  ok(r.after.win>r.before.win, 'the window widened when the panel opened');
  ok(r.after.panel>150, 'the panel is a real column ('+r.after.panel.toFixed(0)+'px)');
  ok(Math.abs(r.after.grid-r.before.grid)<2, 'the grid kept its width — the panel took the new space, not the chart');
  ok(!r.after.overlay, 'it widened rather than falling back to an overlay');
  ok(r.closed.win===r.before.win, 'closing gave the width back exactly');
  ok(r.closed.saved===420, 'the transient widening was not saved as the chosen width (got '+r.closed.saved+')');
}

console.log('== with no room left it overlays instead ==');
{
  const r=await p.evaluate(async()=>{
    showScreen('home');
    currentSettings.width=getMaxDims().maxW; applySettingsToDOM();
    openCreator(null); await new Promise(r=>setTimeout(r,120));
    const before=document.documentElement.offsetWidth;
    document.getElementById('adv-toggle').click();
    await new Promise(r=>setTimeout(r,320));
    const panel=document.getElementById('adv-panel');
    const res={before, after:document.documentElement.offsetWidth,
      overlay:document.body.classList.contains('adv-overlay'),
      pos:getComputedStyle(panel).position, w:panel.getBoundingClientRect().width};
    document.getElementById('adv-toggle').click();
    return res;
  });
  console.log(`   at the cap: window ${r.before} -> ${r.after}, panel ${r.w.toFixed(0)}px ${r.pos}`);
  ok(r.overlay, 'falls back to the overlay when the window cannot grow');
  ok(r.pos==='absolute', 'the panel floats over the grid (position '+r.pos+')');
  ok(r.w>=170, 'and is still wide enough to use ('+r.w.toFixed(0)+'px)');
}
ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
await b.close();
console.log('\n'+(fail?fail+' of '+(pass+fail)+' FAILED':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
