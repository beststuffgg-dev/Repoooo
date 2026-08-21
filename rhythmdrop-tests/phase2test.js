const {chromium}=require('playwright');const path=require('path');
const {chromeExe}=require('./browser');
const EXE=chromeExe();
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};
(async()=>{const b=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:760}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1500);
await p.evaluate(()=>{const s=document.getElementById('boot-splash');if(s)s.remove();
 localStorage.setItem('rd_tutorial','1');
 if(!profile.username){profile.username='Player';saveProfile();}
 profile.coins=100000;saveProfile();
 showScreen('home');renderHome();
 document.querySelector('.hnav[data-tab="shop"]').click();});
await p.waitForTimeout(400);

console.log('== shop tabs ==');
const tabs=await p.locator('#shop-tabs .set-tab').allTextContents();
ok(tabs.join()==='Avatars,Trails,Effects,Boxes','4 shop tabs: '+tabs.join(', '));
const shown=()=>p.evaluate(()=>['avatars','trails','hitfx','boxes']
  .map(k=>document.getElementById('shop-g-'+k).style.display).join(','));
ok((await shown())==='block,none,none,none','only Avatars shown initially');
await p.locator('#shop-tabs .set-tab').nth(1).click(); await p.waitForTimeout(150);
ok((await shown())==='none,block,none,none','Trails tab switches');

console.log('== trail previews ==');
const tr=await p.evaluate(()=>{
  const cards=[...document.querySelectorAll('#shop-trails .fx-card')];
  const withDemo=cards.filter(c=>c.querySelector('.fx-demo'));
  const tile=document.querySelector('#shop-trails .fx-card:nth-child(2) .fx-demo-tile');
  return {cards:cards.length,withDemo:withDemo.length,
    cls:tile?tile.className:null,
    len:tile?tile.style.getPropertyValue('--tl-len'):null,
    op:tile?tile.style.getPropertyValue('--tl-op'):null};});
ok(tr.cards>0,tr.cards+' trail cards');
ok(tr.withDemo===tr.cards,'every trail card has a preview');
ok(/trail-/.test(tr.cls||''),'preview uses the real shape class: '+tr.cls);
ok(!!tr.len&&!!tr.op,'preview carries the item vars (len '+tr.len+', op '+tr.op+')');

console.log('== hit effect previews ==');
await p.locator('#shop-tabs .set-tab').nth(2).click(); await p.waitForTimeout(150);
const hf=await p.evaluate(()=>{
  const cards=[...document.querySelectorAll('#shop-hitfx .fx-card')];
  const burst=document.querySelector('#shop-hitfx .fx-card:nth-child(3) .fx-demo-burst');
  return {cards:cards.length,
    demos:cards.filter(c=>c.querySelector('.fx-demo')).length,
    cls:burst?burst.className:null,
    scale:burst?burst.style.getPropertyValue('--fx-scale'):null,
    dur:burst?burst.style.getPropertyValue('--fx-dur'):null};});
ok(hf.cards>0,hf.cards+' effect cards');
ok(hf.demos===hf.cards,'every effect card has a preview');
ok(/fx-/.test(hf.cls||''),'preview uses the real shape class: '+hf.cls);
ok(!!hf.scale&&!!hf.dur,'preview carries scale/dur ('+hf.scale+', '+hf.dur+')');
ok((await p.locator('#shop-hitfx .fx-card:first-child .fx-demo-burst').count())===0,
   '"None" renders no burst');

console.log('== mystery boxes ==');
await p.locator('#shop-tabs .set-tab').nth(3).click(); await p.waitForTimeout(150);
const bx=await p.evaluate(()=>[...document.querySelectorAll('#shop-boxes .box-card')]
  .map(c=>c.querySelector('.box-card-name').textContent+'/'+c.querySelector('.box-card-price').textContent));
ok(bx.length===3,'3 box tiers: '+bx.join(', '));
ok(bx[0].startsWith('Common')&&bx[2].startsWith('Epic'),'ordered common -> epic');
const buy=await p.evaluate(async()=>{
  const before=profile.coins;
  // Buying is two clicks now: the first arms the card and shows the odds.
  document.querySelector('#shop-boxes .box-card').click();
  await new Promise(r=>setTimeout(r,60));
  const afterArm=before-profile.coins;
  document.querySelector('#shop-boxes .box-card').click();
  await new Promise(r=>setTimeout(r,60));
  return {armSpent:afterArm, spent:before-profile.coins,
    modal:document.getElementById('box-modal').classList.contains('show')};});
ok(buy.armSpent===0,'the first click spends nothing (spent '+buy.armSpent+')');
ok(buy.spent===800,'a common box costs 800 (spent '+buy.spent+')');
ok(buy.modal,'the reveal modal opens');
await p.evaluate(()=>document.getElementById('box-close').click());

console.log('== epic pulls from the rarest avatars ==');
const epic=await p.evaluate(()=>{
  const seen=[];
  for(let i=0;i<40;i++){
    const sh=store.loadShop(); sh.owned=[]; store.saveShop(sh);
    const d=openBox('epic');
    if(d.item) seen.push(d.item.price);
  }
  return {n:seen.length,min:Math.min(...seen)};});
ok(epic.n>0,'epic boxes drop avatars ('+epic.n+'/40 rolls)');
ok(epic.min>=1800,'and only expensive ones (cheapest '+epic.min+')');

console.log('== themes are free, except the earned ones ==');
await p.evaluate(()=>{progress.cleared={};saveProgress();
  document.querySelector('.hnav[data-tab="themes"]').click();buildThemesGrid();});
await p.waitForTimeout(200);
const th=await p.evaluate(()=>{
  const cards=[...document.querySelectorAll('#themes-grid .theme-card')];
  const locked=cards.filter(c=>c.classList.contains('locked'));
  return {total:cards.length,locked:locked.length,
    labels:locked.slice(0,3).map(c=>(c.querySelector('.theme-price')||{}).textContent),
    anyCoins:cards.some(c=>/coins/i.test(c.textContent))};});
ok(th.total>20,th.total+' themes listed');
ok(th.locked===6,'exactly the 6 area-earned themes are locked (got '+th.locked+')');
ok(!th.anyCoins,'no theme shows a coin price any more');
ok(th.labels.every(l=>/^Clear /.test(l||'')),'locked cards name the area: '+th.labels.join(' | '));
const unlock=await p.evaluate(()=>{
  const c={};for(let i=0;i<15;i++)c['1-'+i]=true;
  progress.cleared=c;saveProgress();buildThemesGrid();
  return {locked:document.querySelectorAll('#themes-grid .theme-card.locked').length,
          walnut:themeOwned('walnut')};});
ok(unlock.walnut===true,'clearing area 1 unlocks Walnut');
ok(unlock.locked===5,'one fewer locked theme (got '+unlock.locked+')');

ok(errs.length===0,'no page errors: '+errs.join(' | '));
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
