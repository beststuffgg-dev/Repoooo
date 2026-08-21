const {chromium}=require('playwright');const path=require('path');
const {chromeExe}=require('./browser');
const EXE=chromeExe();
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};
(async()=>{const b=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:620}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1500);
await p.evaluate(()=>{const s=document.getElementById('boot-splash');if(s)s.remove();
 localStorage.setItem('rd_tutorial','1');
 if(!profile.username){profile.username='Player';saveProfile();}});

console.log('== the XP formula doubles with speed ==');
const f=await p.evaluate(()=>{const l=RD_Campaign.buildCampaignLevel(3,7);
 return {notes:RD_Campaign.countNotes(l),bpm:l.bpm,
  normal:RD_Campaign.xpFor(l,{completed:true,progress:1}),
  dbl:RD_Campaign.xpFor(l,{completed:true,progress:1,speedMult:2}),
  legacy:RD_Campaign.xpFor(l,{completed:true,progress:1})};});
// Within 1: the formula rounds at two points, so 2x can land a
// single XP either side of exactly double.
ok(Math.abs(f.dbl-f.normal*2)<=1,`Double pays 2x (${f.normal} -> ${f.dbl})`);
ok(f.legacy===f.normal,'omitting speedMult behaves as before');
console.log(`  area 3 lvl 7: ${f.notes} notes @ ${f.bpm} BPM -> ${f.normal} XP normal, ${f.dbl} XP on the Double`);

console.log('== the Double really runs at 2x ==');
const sp=await p.evaluate(async()=>{
 launchLevel(RD_Campaign.buildCampaignLevel(1,0));
 document.getElementById('g-overlay').classList.remove('show');
 startGame(buildQueue(gameLevel));
 const normalBeat=currentBeatMs, base=baseBeatMs;
 endGame(true);
 overtime=true; startGame(buildQueue(gameLevel));
 const dblBeat=currentBeatMs, mult=speedMult;
 endGame(true); overtime=false;
 return {base,normalBeat,dblBeat,mult};});
ok(sp.mult===2,'speedMult is 2 on the Double');
ok(sp.dblBeat===Math.round(sp.normalBeat/2),
   `beat interval halves: ${sp.normalBeat}ms -> ${sp.dblBeat}ms`);

console.log('== a finished Double actually grants the XP ==');
const g=await p.evaluate(()=>{
 progress.xp=0;saveProgress();
 const lvl=RD_Campaign.buildCampaignLevel(2,4);
 // clear it normally
 launchLevel(lvl);document.getElementById('g-overlay').classList.remove('show');
 startGame(buildQueue(gameLevel));notesHit=notesTotal;endGame(true);
 const afterNormal=progress.xp;
 // now the Double
 overtime=true;startGame(buildQueue(gameLevel));notesHit=notesTotal;endGame(true);
 const afterDouble=progress.xp;overtime=false;
 return {normal:afterNormal,doubleGain:afterDouble-afterNormal,
   text:document.getElementById('ov-xp').textContent,
   btn:document.getElementById('ov-overtime').textContent};});
ok(g.doubleGain>0,'the Double grants XP (was 0 before): +'+g.doubleGain);
ok(Math.abs(g.doubleGain-g.normal*2)<=1,`and it is 2x the normal clear (${g.normal} -> ${g.doubleGain})`);
ok(/double speed, double XP/.test(g.text),'results card explains it: "'+g.text+'"');
ok(/twice the XP/.test(g.btn),'button reads: "'+g.btn+'"');

console.log('== the Double still cannot clear a level ==');
const c=await p.evaluate(()=>{
 progress.cleared={};saveProgress();
 const lvl=RD_Campaign.buildCampaignLevel(4,2);
 launchLevel(lvl);document.getElementById('g-overlay').classList.remove('show');
 overtime=true;startGame(buildQueue(gameLevel));notesHit=notesTotal;endGame(true);
 overtime=false;
 return Object.keys(progress.cleared).length;});
ok(c===0,'a Double win does not mark the level cleared');

console.log('== no stale "no XP" copy anywhere ==');
const stale=await p.evaluate(()=>document.body.innerHTML.match(/no XP|coins only/gi)||[]);
ok(stale.length===0,'found stale copy: '+stale.join(', '));

ok(errs.length===0,'no page errors: '+errs.join('|'));
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
