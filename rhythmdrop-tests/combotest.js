// Combo tiers past 50, milestones, and the hit-window overlay.
const {chromium}=require('playwright');const path=require('path');
const {chromeExe}=require('./browser');
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};
(async()=>{
const b=await chromium.launch({executablePath:chromeExe(),args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1300);
await p.evaluate(()=>{const s=document.getElementById('boot-splash');if(s)s.remove();
 localStorage.setItem('rd_tutorial','1');if(!profile.username){profile.username='Player';saveProfile();}
 launchLevel(RD_Campaign.buildCampaignLevel(3,8));
 document.getElementById('g-overlay').classList.remove('show');});
await p.waitForTimeout(200);

const at=(n)=>p.evaluate((n)=>{applyComboTier(n);
  const c=document.getElementById('g-combo');
  return {cls:[...c.classList].filter(x=>x.startsWith('tier-')),
    body:[...document.body.classList].filter(x=>x.startsWith('combo-')),
    color:c.style.color};},n);

console.log('== below 50 the old colour ramp is untouched ==');
for(const n of [0,1,4,5,9,10,25,49]){
  const r=await at(n);
  ok(r.cls.length===0,'combo '+n+': no tier class');
  ok(r.color!=='','combo '+n+': still colour-ramped ('+r.color+')');
}

console.log('== the tiers land on their thresholds ==');
const t50=await at(50),  t74=await at(74);
const t75=await at(75),  t99=await at(99);
const t100=await at(100),t200=await at(200);
ok(t50.cls[0]==='tier-hot','50 → hot');
ok(t74.cls[0]==='tier-hot','74 → still hot');
ok(t75.cls[0]==='tier-blaze','75 → blaze');
ok(t99.cls[0]==='tier-blaze','99 → still blaze');
ok(t100.cls[0]==='tier-nova','100 → nova');
ok(t200.cls[0]==='tier-nova','200 → still nova');

console.log('== the lanes take the heat too ==');
ok(t50.body.length===0,'50 leaves the board alone');
ok(t75.body.includes('combo-blaze'),'75 lights the lanes');
ok(t100.body.includes('combo-nova'),'100 lights them harder');
ok(!t100.body.includes('combo-blaze'),'and the tiers do not stack');

console.log('== breaking the combo clears everything ==');
const broke=await at(0);
ok(broke.cls.length===0 && broke.body.length===0,'back to nothing');

console.log('== milestones announce once ==');
const ms=await p.evaluate(async()=>{
  const el=document.getElementById('combo-milestone');
  const seen=[];
  for(const n of [49,50,51,74,75,99,100,149,150]){
    el.classList.remove('show');
    applyComboTier(n);
    await new Promise(r=>setTimeout(r,30));
    if(el.classList.contains('show'))seen.push(n+':'+el.textContent);
  }
  return seen;});
ok(ms.length===4,'four milestones fired: '+ms.join(', '));
ok(ms.every(s=>/^(50|75|100|150):/.test(s)),'on 50/75/100/150 only');

console.log('== ending a run drops the heat ==');
const after=await p.evaluate(()=>{applyComboTier(140);
  endGame(false);
  return {cls:[...document.getElementById('g-combo').classList].filter(x=>x.startsWith('tier-')),
    body:[...document.body.classList].filter(x=>x.startsWith('combo-'))};});
ok(after.cls.length===0 && after.body.length===0,'results card is not still glowing');

console.log('== the hit window matches what the code judges ==');
const hz=await p.evaluate(async()=>{
  const out={};
  for(const w of ['strict','normal','forgiving']){
    currentSettings.hitWindow=w; currentSettings.showHitZone=true;
    applyHitZone();
    await new Promise(r=>requestAnimationFrame(r));
    const lane=document.querySelector('#lane0');
    const z=lane.querySelector('.lane-hitzone');
    const cap=lane.querySelector('.lane-btn');
    const lr=lane.getBoundingClientRect(), zr=z.getBoundingClientRect();
    out[w]={drawn:zr.height, judged:hitTol(),
      shown:getComputedStyle(z).display,
      zBottom:zr.bottom, capTop:cap.getBoundingClientRect().top,
      laneTop:lr.top, laneBottom:lr.bottom,
      zi:parseInt(getComputedStyle(z).zIndex,10),
      tileZi:parseInt(getComputedStyle(document.querySelector('.tile')||z).zIndex,10)};}
  currentSettings.showHitZone=false; applyHitZone();
  out.off=getComputedStyle(document.querySelector('#lane0 .lane-hitzone')).display;
  return out;});
['strict','normal','forgiving'].forEach(w=>{
  ok(Math.abs(hz[w].drawn-hz[w].judged)<2,
    w+': drawn '+hz[w].drawn.toFixed(0)+'px vs one side of the window '+hz[w].judged.toFixed(0)+'px');
  ok(hz[w].shown==='block',w+': visible when enabled');});
ok(hz.strict.drawn<hz.normal.drawn && hz.normal.drawn<hz.forgiving.drawn,
  'the band grows with the setting');
ok(hz.off==='none','and disappears when turned off');

console.log('== it stays above the buttons and inside the lane ==');
['strict','normal','forgiving'].forEach(w=>{
  ok(hz[w].zBottom<=hz[w].capTop+1,
    w+': does not run over the keycaps ('+hz[w].zBottom.toFixed(0)+' vs cap top '+hz[w].capTop.toFixed(0)+')');
  ok(hz[w].zBottom<=hz[w].laneBottom+0.5 && hz[w].laneTop-0.5<=hz[w].zBottom-hz[w].drawn,
    w+': fits inside the lane, nothing clipped');});

console.log('== falling tiles draw over it, not under ==');
ok(hz.normal.zi<4,'the band sits below the tile layer (z-index '+hz.normal.zi+' vs tiles 4)');

ok(errs.length===0,'no page errors: '+errs.join(' | '));
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
