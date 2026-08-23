const {chromium}=require('playwright');const path=require('path');
const {launchOpts,v8Dir}=require('./browser');
const OUT='/tmp/claude-0/-home-user-Repoooo/050eb574-5d03-5241-8e85-e1721be8a6f1/scratchpad/';
(async()=>{
const b=await chromium.launch(launchOpts());
const errs=[];
// creator generate menu at a wide ratio
{
  const ctx=await b.newContext({viewport:{width:1000,height:640},deviceScaleFactor:2});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('wide: '+e.message));
  await p.addInitScript(()=>localStorage.setItem('rd_profile',JSON.stringify({username:'P',coins:5000})));
  await p.goto('file://'+path.join(v8Dir(),'popup.html'),{waitUntil:'load'});
  await p.waitForTimeout(1300);
  const r=await p.evaluate(async()=>{
    openCreator(null);
    document.getElementById('adv-toggle').click();
    await new Promise(r=>setTimeout(r,300));
    document.querySelector('.adv-mode[data-mode="generate"]').click();
    await new Promise(r=>setTimeout(r,120));
    const genShown=document.getElementById('adv-generate').classList.contains('show');
    document.getElementById('gen-into-grid').click();
    await new Promise(r=>setTimeout(r,150));
    const notes=document.querySelectorAll('.cr-cell.is-tap,.cr-cell.is-dtap').length;
    return {genShown, notes, win:document.documentElement.offsetWidth};
  });
  console.log('generate menu:',JSON.stringify(r));
  await p.locator('html').screenshot({path:OUT+'v8-cr-generate.png'});
  await ctx.close();
}
console.log('errors:',errs.length?errs:'none');
await b.close();})();
