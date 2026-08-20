const {chromium}=require('playwright');const path=require('path');
const {chromeExe}=require('./browser');
const EXE=chromeExe();
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};
(async()=>{const b=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:700}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1500);
await p.evaluate(()=>{const s=document.getElementById('boot-splash');if(s)s.remove();
 localStorage.setItem('rd_tutorial','1');
 if(!profile.username){profile.username='Player';saveProfile();}
 showScreen('home'); renderHome();
 document.querySelector('.hnav[data-tab="settings"]').click();});
await p.waitForTimeout(400);

console.log('== settings tabs ==');
const tabs=await p.locator('#tab-settings .set-tab').allTextContents();
ok(tabs.length===4,'4 tabs (got '+tabs.length+'): '+tabs.join(', '));
ok(tabs.join()==='Play,Audio,Look,Data','tabs are Play/Audio/Look/Data');
ok(await p.locator('#tab-settings .set-tab.active').count()===1,'one tab active');
const vis=()=>p.evaluate(()=>[...document.querySelectorAll('#tab-settings .set-group')]
  .map(g=>g.style.display).join(','));
ok((await vis())==='block,none,none,none','only the first group is shown');

console.log('== each tab has content and switches ==');
for(let i=0;i<4;i++){
  await p.locator('#tab-settings .set-tab').nth(i).click();
  await p.waitForTimeout(120);
  const shown=await p.evaluate(()=>{const g=[...document.querySelectorAll('#tab-settings .set-group')]
    .find(x=>x.style.display!=='none');return g?g.children.length:0;});
  ok(shown>0,'tab '+tabs[i]+' has '+shown+' items');
}

console.log('== audio tab: volume + output ==');
await p.locator('#tab-settings .set-tab').nth(1).click();
await p.waitForTimeout(150);
ok(await p.locator('#set-vol-val').count()===1,'volume readout present');
const volSel='#tab-settings input[type=range]';
ok(await p.locator('#set-vol').count()===1,'volume slider present');
const v=await p.evaluate(()=>{
  const r=document.getElementById('set-vol');
  r.value='40'; r.dispatchEvent(new Event('input',{bubbles:true}));
  r.dispatchEvent(new Event('change',{bubbles:true}));
  return {setting:currentSettings.volume, engine:window.RD_getVolume(),
          label:document.getElementById('set-vol-val').textContent,
          saved:JSON.parse(localStorage.getItem('rd_settings')).volume};});
ok(Math.abs(v.setting-0.4)<1e-9,'setting updated to 0.4 (got '+v.setting+')');
ok(Math.abs(v.engine-0.4)<1e-9,'audio engine volume updated (got '+v.engine+')');
ok(v.label==='40%','readout shows '+v.label);
ok(Math.abs(v.saved-0.4)<1e-9,'persisted to localStorage');
const outUI=await p.evaluate(()=>({can:window.RD_canPickOutput(),
  hasSel:!!document.querySelector('#tab-settings select option[value=""]'),
  txt:document.querySelector('#tab-settings .set-group:nth-child(3)')?'':''}));
ok(typeof outUI.can==='boolean','output capability probed: '+outUI.can);

console.log('== look tab: brightness ==');
await p.locator('#tab-settings .set-tab').nth(2).click();
await p.waitForTimeout(150);
ok(await p.locator('#set-bri-val').count()===1,'brightness readout present');
const bset=await p.evaluate(()=>{
  const r=document.getElementById('set-bri');
  r.value='130'; r.dispatchEvent(new Event('input',{bubbles:true}));
  r.dispatchEvent(new Event('change',{bubbles:true}));
  return {setting:currentSettings.brightness,
    cssVar:getComputedStyle(document.documentElement).getPropertyValue('--app-brightness').trim(),
    filter:getComputedStyle(document.body).filter,
    label:document.getElementById('set-bri-val').textContent};});
ok(Math.abs(bset.setting-1.3)<1e-9,'brightness setting 1.3 (got '+bset.setting+')');
ok(bset.cssVar==='1.3','--app-brightness is '+bset.cssVar);
ok(/brightness\(1\.3\)/.test(bset.filter),'body filter applied: '+bset.filter);
ok(bset.label==='130%','readout shows '+bset.label);

console.log('== survives a reload ==');
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1500);
const after=await p.evaluate(()=>({vol:currentSettings.volume,bri:currentSettings.brightness,
  engine:window.RD_getVolume(),
  cssVar:getComputedStyle(document.documentElement).getPropertyValue('--app-brightness').trim()}));
ok(Math.abs(after.vol-0.4)<1e-9,'volume restored');
ok(Math.abs(after.bri-1.3)<1e-9,'brightness restored');
ok(Math.abs(after.engine-0.4)<1e-9,'engine volume restored on boot');
ok(after.cssVar==='1.3','brightness re-applied on boot');

console.log('== gesture resume is armed ==');
ok(await p.evaluate(()=>typeof window.RD_setVolume==='function'
  &&typeof window.RD_setOutput==='function'
  &&typeof window.RD_listOutputs==='function'),'audio API exposed');

ok(errs.length===0,'no page errors: '+errs.join(' | '));
await p.screenshot({path:path.join(process.env.SHOT_DIR||require('os').tmpdir(),'14-settings-tabs.png')});
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
