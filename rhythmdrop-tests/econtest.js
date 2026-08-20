// Flat coins per level, and purchases that take two clicks.
const {JSDOM}=require('jsdom');
const {chromeExe}=require('./browser');
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
// The browser half can run against either build; the jsdom half always
// reads the module sources, which the single file inlines verbatim.
const PAGE=process.env.RD_PAGE||path.join(DIR,'popup.html');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};

// ── Part 1: the coin formula, headless ──
const w=new JSDOM('<!doctype html>',{runScripts:'outside-only'}).window;
w.eval(fs.readFileSync(path.join(DIR,'campaign.js'),'utf8'));
const C=w.RD_Campaign;

console.log('== every campaign level pays exactly the same ==');
const paid=new Set(); let minN=1e9,maxN=0;
for(let a=1;a<=10;a++)for(let i=0;i<15;i++){
  const lvl=C.buildCampaignLevel(a,i);
  const n=C.countNotes(lvl); minN=Math.min(minN,n); maxN=Math.max(maxN,n);
  paid.add(C.coinsFor(lvl,{completed:true}));}
ok(paid.size===1,'all 150 levels pay one amount: '+[...paid].join(', '));
ok([...paid][0]===C.COINS_PER_CLEAR,'and it is the flat rate ('+[...paid][0]+')');
console.log('  note counts still range '+minN+'–'+maxN+', coins no longer do');

console.log('== a custom level pays the same as a campaign one ==');
const mk=n=>({name:'c',bpm:120,campaign:false,
  grid:Array.from({length:Math.ceil(n/2)},(_,r)=>[
    r*2<n?{type:'tap',freq:261.63,sustain:0}:null,null,
    r*2+1<n?{type:'tap',freq:329.63,sustain:0}:null,null])});
ok(C.coinsFor(mk(200),{completed:true})===C.COINS_PER_CLEAR,'a 200-note custom pays the flat rate');
ok(C.coinsFor(mk(40),{completed:true})===C.COINS_PER_CLEAR,'a 40-note custom pays the flat rate');

console.log('== but a stub cannot be farmed ==');
const stub=C.coinsFor(mk(4),{completed:true});
ok(stub<C.COINS_PER_CLEAR,'a 4-note stub pays less ('+stub+' vs '+C.COINS_PER_CLEAR+')');
ok(stub===Math.round(C.COINS_PER_CLEAR*4/C.COINS_MIN_NOTES),'pro-rata below the floor, not zero');
ok(C.coinsFor(mk(C.COINS_MIN_NOTES),{completed:true})===C.COINS_PER_CLEAR,'the floor is exactly '+C.COINS_MIN_NOTES+' notes');

console.log('== quitting early pays for what you played ==');
const lvl=C.buildCampaignLevel(5,5);
ok(C.coinsFor(lvl,{completed:false,progress:0})===0,'quit on note one pays nothing');
ok(C.coinsFor(lvl,{completed:false,progress:0.5})===Math.round(C.COINS_PER_CLEAR/2),'halfway pays half');
ok(C.coinsFor(lvl,{completed:false,progress:1})===C.COINS_PER_CLEAR,'a full run that lost still pays full');

console.log('== the Double still pays double ==');
ok(C.coinsFor(lvl,{completed:true,speedMult:2})===C.COINS_PER_CLEAR*2,'2x speed, 2x coins');

// ── Part 2: two-click purchases, in the browser ──
(async()=>{
const b=await chromium.launch({executablePath:chromeExe(),args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:460,height:820}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+PAGE,{waitUntil:'load'});
await p.waitForTimeout(1300);
await p.evaluate(()=>{const s=document.getElementById('boot-splash');if(s)s.remove();
 localStorage.setItem('rd_tutorial','1');
 if(!profile.username){profile.username='Player';saveProfile();}
 profile.coins=99999;saveProfile();
 document.querySelector('.hnav[data-tab="shop"]').click();});
await p.waitForTimeout(300);

console.log('== an avatar takes two clicks ==');
const av=await p.evaluate(async()=>{
  shopTab='avatars';renderShop();
  await new Promise(r=>requestAnimationFrame(r));
  const card=[...document.querySelectorAll('.avatar-card')]
    .find(c=>/\d+\s*coins/.test(c.textContent));
  const name=card.querySelector('.avatar-name').textContent;
  const before=profile.coins;
  card.click();
  await new Promise(r=>setTimeout(r,60));
  const armedCard=[...document.querySelectorAll('.avatar-card')]
    .find(c=>c.querySelector('.avatar-name').textContent===name);
  const afterFirst={coins:profile.coins,armed:armedCard.classList.contains('armed'),
    label:armedCard.querySelector('.avatar-price').textContent};
  armedCard.click();
  await new Promise(r=>setTimeout(r,60));
  return {name,before,afterFirst,afterSecond:profile.coins,
    owned:store.loadShop().owned.includes(
      SHOP_AVATARS.find(a=>a.name===name).id)};});
ok(av.afterFirst.coins===av.before,'the first click spends nothing');
ok(av.afterFirst.armed,'it arms the card instead');
ok(/tap again/i.test(av.afterFirst.label),'and says so: "'+av.afterFirst.label+'"');
ok(av.afterSecond<av.before,'the second click pays ('+av.before+' → '+av.afterSecond+')');
ok(av.owned,'and the avatar is owned');

console.log('== clicking away cancels instead of buying ==');
const cancel=await p.evaluate(async()=>{
  shopTab='avatars';renderShop();
  await new Promise(r=>requestAnimationFrame(r));
  const cards=[...document.querySelectorAll('.avatar-card')]
    .filter(c=>/\d+\s*coins/.test(c.textContent));
  const before=profile.coins;
  cards[0].click();
  await new Promise(r=>setTimeout(r,60));
  // Arming a different card must not buy the first one
  const fresh=[...document.querySelectorAll('.avatar-card')]
    .filter(c=>/\d+\s*coins/.test(c.textContent)||c.classList.contains('armed'));
  fresh[1].click();
  await new Promise(r=>setTimeout(r,60));
  const armedCount=document.querySelectorAll('.avatar-card.armed').length;
  // Leaving the shop clears it
  document.querySelector('.hnav[data-tab="levels"]').click();
  await new Promise(r=>setTimeout(r,60));
  document.querySelector('.hnav[data-tab="shop"]').click();
  await new Promise(r=>setTimeout(r,60));
  return {before,after:profile.coins,armedCount,
    stillArmed:document.querySelectorAll('.armed').length};});
ok(cancel.after===cancel.before,'nothing was bought ('+cancel.before+' → '+cancel.after+')');
ok(cancel.armedCount===1,'only one card is armed at a time ('+cancel.armedCount+')');
ok(cancel.stillArmed===0,'leaving the shop disarms');

console.log('== an effect previews live, then reverts if you back out ==');
const fx=await p.evaluate(async()=>{
  shopTab='hitfx';renderShop();
  await new Promise(r=>requestAnimationFrame(r));
  // Persist a baseline first, or "storage never changed" compares
  // against a key that was never written.
  store.saveSettings(currentSettings);
  const before=currentSettings.hitFx;
  const card=[...document.querySelectorAll('#shop-g-hitfx .fx-card.locked')][0];
  if(!card)return{skip:true};
  card.click();
  await new Promise(r=>setTimeout(r,60));
  const during=currentSettings.hitFx;
  const savedDuring=(store.loadSettings()||{}).hitFx;
  disarmPurchase();
  await new Promise(r=>setTimeout(r,60));
  return {before,during,savedDuring,after:currentSettings.hitFx,coins:profile.coins};});
ok(!fx.skip,'there is a locked effect to test');
ok(fx.during!==fx.before,'the first click applies it live ('+fx.before+' → '+fx.during+')');
ok(fx.savedDuring===fx.before && fx.savedDuring!==fx.during,
  'but never saves it — storage still says '+fx.savedDuring+', not '+fx.during);
ok(fx.after===fx.before,'backing out puts the old effect back');

console.log('== a box shows its odds before it takes your coins ==');
const box=await p.evaluate(async()=>{
  shopTab='boxes';renderShop();
  await new Promise(r=>requestAnimationFrame(r));
  const before=profile.coins;
  const card=document.querySelectorAll('#shop-g-boxes .box-card')[2]; // epic
  card.click();
  await new Promise(r=>setTimeout(r,60));
  const toast=document.querySelector('.toast, #toast');
  const armed=document.querySelectorAll('.box-card.armed').length;
  return {before,after:profile.coins,armed,
    odds:boxOdds('epic'), toast:toast?toast.textContent:''};});
ok(box.after===box.before,'the first click on a 5000-coin box spends nothing');
ok(box.armed===1,'the box is armed');
ok(/%/.test(box.odds),'its odds are quoted from the drop table: '+box.odds);

ok(errs.length===0,'no page errors: '+errs.join(' | '));
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
