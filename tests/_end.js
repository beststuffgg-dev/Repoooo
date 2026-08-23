const {chromium}=require('playwright');const path=require('path');
const {launchOpts,v8Dir}=require('./browser');
const OUT='/tmp/claude-0/-home-user-Repoooo/050eb574-5d03-5241-8e85-e1721be8a6f1/scratchpad/';
(async()=>{
const b=await chromium.launch(launchOpts());
const errs=[];
// Endless tab — profile with everything cleared
{
  const ctx=await b.newContext({viewport:{width:440,height:720},deviceScaleFactor:2});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('endless: '+e.message));
  await p.addInitScript(()=>{
    localStorage.setItem('rd_profile',JSON.stringify({username:'P',coins:5000}));
    const cleared={}; for(let a=1;a<=10;a++)for(let i=0;i<15;i++)cleared['a'+a+'l'+i]=true;
    localStorage.setItem('rd_progress',JSON.stringify({xp:50000,cleared}));
  });
  await p.goto('file://'+path.join(v8Dir(),'popup.html'),{waitUntil:'load'});
  await p.waitForTimeout(1300);
  const r=await p.evaluate(()=>{
    showScreen('home'); renderHome();
    const chips=[...document.querySelectorAll('.area-chip')];
    const endlessChip=chips.find(c=>c.className.includes('endless-chip'));
    const locked=endlessChip.className.includes('locked');
    endlessChip.click();
    return {chipCount:chips.length, endlessLocked:locked,
      bands:document.querySelectorAll('.endless-band').length,
      selText:document.querySelector('.area-chip.endless-chip.sel .ac-name')?.textContent};
  });
  console.log('endless tab:',JSON.stringify(r));
  await p.locator('html').screenshot({path:OUT+'v8-endless-tab.png'});
  await ctx.close();
}
// narrow/tall: adv panel overlays; wide/short and square: still usable
for(const [w,h,tag] of [[360,780,'narrow-tall'],[900,420,'wide-short'],[600,600,'square']]){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(tag+': '+e.message));
  await p.addInitScript(()=>localStorage.setItem('rd_profile',JSON.stringify({username:'P',coins:5000})));
  await p.goto('file://'+path.join(v8Dir(),'popup.html'),{waitUntil:'load'});
  await p.waitForTimeout(1200);
  const r=await p.evaluate(async()=>{
    openCreator(null);
    document.getElementById('adv-toggle').click();
    await new Promise(r=>setTimeout(r,300));
    const grid=document.getElementById('cr-grid').getBoundingClientRect();
    const panel=document.getElementById('adv-panel').getBoundingClientRect();
    return {win:document.documentElement.offsetWidth, overlay:document.body.classList.contains('adv-overlay'),
      gridW:Math.round(grid.width), panelW:Math.round(panel.width), gridVisible:grid.width>60};
  });
  console.log(tag.padEnd(11),JSON.stringify(r));
  await ctx.close();
}
console.log('errors:',errs.length?errs:'none');
await b.close();})();
