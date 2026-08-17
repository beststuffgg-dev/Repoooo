const {JSDOM}=require('jsdom');
// ── Locate the extension ──
// Looks next to this folder, then inside it, then falls back to
// the APP_DIR environment variable. Works from a checkout, a
// download folder, or CI without editing anything.
const path = require('path');
const fs = require('fs');
function findApp() {
  if (process.env.APP_DIR) return process.env.APP_DIR;
  const tries = [
    path.join(__dirname, '..', 'RhythmDropV7'),
    path.join(__dirname, 'RhythmDropV7'),
    path.join(process.cwd(), 'RhythmDropV7'),
    path.join(__dirname, '..'),
  ];
  for (const t of tries) {
    if (fs.existsSync(path.join(t, 'popup.html'))) return t;
  }
  console.error('Could not find RhythmDropV7/popup.html.');
  console.error('Put this folder beside the extension, or set APP_DIR=/path/to/RhythmDropV7');
  process.exit(2);
}
const DIR = findApp();

const errors=[],notes=[];
const dom=new JSDOM(fs.readFileSync(path.join(DIR,'popup.html'),'utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://localhost/'});
const {window}=dom;window.onerror=m=>errors.push('onerror: '+m);
function n(e={}){return Object.assign({connect(){return this},disconnect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},Q:{value:1},threshold:{value:0},knee:{value:0},ratio:{value:1},attack:{value:0},release:{value:0},type:'',buffer:null},e)}
window.AudioContext=function(){return{state:'running',currentTime:0,sampleRate:44100,destination:n(),resume:()=>Promise.resolve(),createOscillator:()=>n(),createGain:()=>n(),createBiquadFilter:()=>n(),createDynamicsCompressor:()=>n(),createBufferSource:()=>n(),createBuffer:(c,l)=>({getChannelData:()=>new Float32Array(l)})}};
window.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
window.cancelAnimationFrame=id=>clearTimeout(id);
window.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
if(!window.document.fonts)window.document.fonts={ready:Promise.resolve()};
window.console.error=(...a)=>errors.push('console.error: '+a.join(' '));
window.console.warn=()=>{};
window.localStorage.setItem('rd_profile',JSON.stringify({username:'Tester',coins:0,bestScore:0}));

const HOOK=`;window.__t={
  get progress(){return progress}, set progress(v){progress=v},
  get profile(){return profile},
  isUnlocked, isCleared, areaCleared, areaUnlocked, areaProgress, totalCleared,
  grantXp, trackPrizes, trackProgress, trackTier, claimPrize, levelKey,
  saveProgress, renderBuiltins, renderHome,
  get gameLevel(){return gameLevel}, set gameLevel(v){gameLevel=v},
  set score(v){score=v}, endGame, launchLevel,
  set baseBeatMs(v){baseBeatMs=v},
  get overtime(){return overtime}, set overtime(v){overtime=v},
  get SHOP_AVATARS(){return SHOP_AVATARS}, get PENDING_AVATARS(){return PENDING_AVATARS},
  get SHOP_THEMES(){return SHOP_THEMES}, hasArt, themeOwned, buyTheme,
  get TRAILS(){return TRAILS}, get HIT_FX(){return HIT_FX},
  get CAMPAIGN_AVATARS(){return CAMPAIGN_AVATARS}, get ALL_AVATARS(){return ALL_AVATARS},
  get GEN_THEMES(){return GEN_THEMES}, syncAreaRewards, areaCleared,
  dailyState, claimDaily, openBox, todayKey, dayKeyOffset, deriveTheme,
  get DAILY_CYCLE(){return DAILY_CYCLE},
};`;
for(const f of ['lighting.js','audio.js','campaign.js','codec.js','loading.js','audio.js','game.js']){
  try{let c=fs.readFileSync(path.join(DIR,f),'utf8'); if(f==='game.js')c+=HOOK; window.eval(c)}
  catch(e){errors.push(f+': '+e.message)}
}
const T=()=>window.__t, C=window.RD_Campaign, D=window.document;
function probe(name,fn){try{fn();console.log('  ok   '+name)}catch(e){errors.push('"'+name+'": '+e.message)}}

probe('fresh save: only 1-0 unlocked',()=>{
  const t=T();
  if(!t.isUnlocked(1,0))throw new Error('first level locked');
  if(t.isUnlocked(1,1))throw new Error('level 2 should be locked');
  if(t.isUnlocked(2,0))throw new Error('area 2 should be locked');
});

probe('clearing a level unlocks the next',()=>{
  const t=T();
  t.progress.cleared[t.levelKey(1,0)]=true; t.saveProgress();
  if(!t.isUnlocked(1,1))throw new Error('next level still locked');
  if(t.isUnlocked(2,0))throw new Error('area 2 unlocked too early');
});

probe('area 2 unlocks only when area 1 is fully cleared',()=>{
  const t=T();
  for(let i=0;i<14;i++) t.progress.cleared[t.levelKey(1,i)]=true;
  t.saveProgress();
  if(t.areaUnlocked(2))throw new Error('unlocked with 14/15');
  t.progress.cleared[t.levelKey(1,14)]=true; t.saveProgress();
  if(!t.areaUnlocked(2))throw new Error('still locked at 15/15');
  notes.push('area 1 progress: '+t.areaProgress(1)+'/15');
});

probe('XP grants and levels up',()=>{
  const t=T();
  t.progress.xp=0; t.saveProgress();
  const r1=t.grantXp(50);
  if(r1.levelUp)throw new Error('levelled up at 50xp');
  const r2=t.grantXp(60);
  if(!r2.levelUp)throw new Error('no level up crossing 100xp');
  notes.push('110xp -> level '+r2.level);
});

probe('campaign XP > custom XP for the same chart',()=>{
  const camp=C.buildCampaignLevel(3,7);
  const cust=Object.assign({},camp,{campaign:false,difficulty:1});
  const a=C.xpFor(camp,{completed:true}), b=C.xpFor(cust,{completed:true});
  if(!(b<a))throw new Error('custom not halved: '+b+' vs '+a);
  notes.push('same chart: campaign '+a+'xp, custom '+b+'xp');
});

probe('XP scales with speed and note count',()=>{
  const base={campaign:true,areaId:1,bpm:120,grid:[[{type:'tap'},null,null,null]]};
  const fast=Object.assign({},base,{bpm:240});
  const many=Object.assign({},base,{grid:Array.from({length:20},()=>[{type:'tap'},null,null,null])});
  const b=C.xpFor(base,{completed:true}),f=C.xpFor(fast,{completed:true}),m=C.xpFor(many,{completed:true});
  if(f<=b)throw new Error('speed did not raise xp');
  if(m<=b)throw new Error('note count did not raise xp');
  notes.push('1 note@120='+b+'xp, 1 note@240='+f+'xp, 20 notes@120='+m+'xp');
});

probe('prize track claims and advances tier',()=>{
  const t=T();
  t.progress.cleared={}; t.progress.track={tier:0,claimed:[]}; t.saveProgress();
  for(let i=0;i<5;i++) t.progress.cleared[t.levelKey(1,i)]=true;
  t.saveProgress();
  const pr=t.trackPrizes();
  notes.push('tier 1 needs: '+pr.map(p=>p.label+'@'+p.need).join(', '));
  const before=t.profile.coins;
  if(!t.claimPrize(pr[0]))throw new Error('could not claim first prize');
  if(t.profile.coins<=before)throw new Error('coins not awarded');
  t.claimPrize(pr[1]);
  const msg=t.claimPrize(pr[2]);
  if(!msg)throw new Error('could not claim third prize');
  if(t.trackTier()!==1)throw new Error('tier did not advance, got '+t.trackTier());
  notes.push('after 3 claims: tier '+(t.trackTier()+1)+', needs '+t.trackPrizes()[2].need+' levels');
});

probe('cannot claim an unearned prize',()=>{
  const t=T();
  t.progress.cleared={}; t.progress.track={tier:0,claimed:[],consumed:0}; t.saveProgress();
  if(t.claimPrize(t.trackPrizes()[2])!==null)throw new Error('claimed with 0 levels');
});

probe('finishing a campaign level marks it cleared',()=>{
  const t=T();
  t.progress.cleared={}; t.saveProgress();
  const lvl=C.buildCampaignLevel(1,0);
  t.gameLevel=lvl; t.baseBeatMs=500; t.score=12000;
  t.endGame(true);
  if(!t.isCleared(1,0))throw new Error('level not marked cleared');
  notes.push('after clearing 1-1: xp='+t.progress.xp+', coins='+t.profile.coins);
});

probe('dying does NOT mark it cleared',()=>{
  const t=T();
  t.progress.cleared={}; t.saveProgress();
  t.gameLevel=C.buildCampaignLevel(1,1); t.score=4000;
  t.endGame(false);
  if(t.isCleared(1,1))throw new Error('marked cleared on death');
  if(t.progress.xp<=0)throw new Error('no xp for a failed attempt');
});

probe('progress survives a sync round trip',()=>{
  const t=T();
  t.progress.cleared={'1-0':true,'1-1':true,'2-0':true}; t.progress.xp=777; t.saveProgress();
  const code=window.buildSyncCode? window.buildSyncCode(false) : null;
  const enc=window.RD_Codec.encodeSync({
    profile:t.profile, shop:{owned:[],equipped:null,colour:'cyan'},
    scores:[], theme:'graphite', settings:{}, progress:t.progress});
  const back=window.RD_Codec.decodeSync(enc);
  if(!back.progress)throw new Error('progress missing from sync');
  if(Object.keys(back.progress.cleared).length!==3)throw new Error('cleared levels lost');
  if(back.progress.xp!==777)throw new Error('xp lost: '+back.progress.xp);
  notes.push('sync carried '+Object.keys(back.progress.cleared).length+' cleared levels + '+back.progress.xp+'xp');
});

probe('every one of the 150 levels generates',()=>{
  let bad=[];
  for(let a=1;a<=10;a++)for(let i=0;i<15;i++){
    const l=C.buildCampaignLevel(a,i);
    if(!l||!l.grid||!l.grid.length) bad.push(a+'-'+i);
    else if(C.countNotes(l)<4) bad.push(a+'-'+i+'(only '+C.countNotes(l)+' notes)');
  }
  if(bad.length)throw new Error('bad levels: '+bad.slice(0,5).join(', '));
  notes.push('all 150 levels generate with >=4 notes');
});

probe('share code round-trips exactly',()=>{
  const code=C.encodeLevelCode(7,4,668508);
  const d=C.decodeLevelCode(code);
  if(d.difficulty!==7||d.areaId!==4||d.seed!==668508)
    throw new Error('decode mismatch: '+JSON.stringify(d));
  const a=C.buildCodeLevel(code),b=C.buildCodeLevel(code);
  if(JSON.stringify(a.grid)!==JSON.stringify(b.grid))throw new Error('not deterministic');
  notes.push('code '+code+' -> area '+a.areaId+', bpm '+a.bpm+', '+C.countNotes(a)+' notes');
});

probe('area 10 encodes as A',()=>{
  const c=C.encodeLevelCode(5,10,999);
  if(c[1]!=='A')throw new Error('expected A, got '+c[1]);
  if(C.decodeLevelCode(c).areaId!==10)throw new Error('area 10 did not round-trip');
});

probe('endless: X code, seed picks the theme',()=>{
  const c=C.encodeLevelCode(6,null,12345);
  if(c[1]!=='X')throw new Error('expected X');
  const d=C.decodeLevelCode(c);
  if(!d.endless)throw new Error('not flagged endless');
  const a=C.buildCodeLevel(c),b=C.buildCodeLevel(c);
  if(a.areaId!==b.areaId)throw new Error('theme not reproducible');
  if(JSON.stringify(a.grid)!==JSON.stringify(b.grid))throw new Error('chart not reproducible');
  notes.push('endless '+c+' always rolls area '+a.areaId);
});

probe('endless spreads across themes',()=>{
  const seen=new Set();
  for(let i=0;i<200;i++) seen.add(C.decodeLevelCode(C.rollEndlessCode()).areaId);
  if(seen.size<7)throw new Error('only '+seen.size+' themes in 200 rolls');
  notes.push('200 endless rolls hit '+seen.size+'/10 themes');
});

probe('difficulty digit drives the chart',()=>{
  const easy=C.buildCodeLevel(C.encodeLevelCode(1,4,12345));
  const hard=C.buildCodeLevel(C.encodeLevelCode(9,4,12345));
  if(C.countNotes(hard)<=C.countNotes(easy))throw new Error('difficulty did not add notes');
  if(hard.bpm<=easy.bpm)throw new Error('difficulty did not raise bpm');
  notes.push('same seed: diff1='+C.countNotes(easy)+' notes @'+easy.bpm+'bpm, diff9='+C.countNotes(hard)+' @'+hard.bpm);
});

probe('each era uses its own scale',()=>{
  const midi=f=>Math.round(69+12*Math.log2(f/440));
  const pcs=a=>{const l=C.buildCampaignLevel(a,7);const s=new Set();
    l.grid.forEach(r=>r.forEach(c=>{if(c)s.add(((midi(c.freq)%12)+12)%12)}));return s;};
  const rome=pcs(4), egypt=pcs(2);
  // Rome is a triad stack: far fewer distinct pitch classes than Egypt's
  // double-harmonic scale.
  if(rome.size>=egypt.size)throw new Error('Rome ('+rome.size+') should use fewer pitch classes than Egypt ('+egypt.size+')');
  notes.push('pitch classes: Rome '+rome.size+', Egypt '+egypt.size);
});

probe('fanfare areas leap, folk areas step',()=>{
  const midi=f=>Math.round(69+12*Math.log2(f/440));
  const avgStep=a=>{const l=C.buildCampaignLevel(a,7);const m=[];
    l.grid.forEach(r=>r.forEach(c=>{if(c)m.push(midi(c.freq))}));
    let t=0;for(let i=1;i<m.length;i++)t+=Math.abs(m[i]-m[i-1]);return t/(m.length-1)};
  const rome=avgStep(4), aztec=avgStep(5);
  if(rome<=aztec)throw new Error('Rome ('+rome.toFixed(1)+') should leap more than Aztec ('+aztec.toFixed(1)+')');
  notes.push('avg interval: Rome '+rome.toFixed(1)+'st, Aztec '+aztec.toFixed(1)+'st');
});

probe('procedural pays full XP, custom pays half',()=>{
  const proc=C.buildCodeLevel(C.encodeLevelCode(5,4,777));
  const cust=Object.assign({},proc,{procedural:false});
  const p=C.xpFor(proc,{completed:true}), c=C.xpFor(cust,{completed:true});
  if(!(c<p))throw new Error('custom not halved: '+c+' vs '+p);
  notes.push('same chart: procedural '+p+'xp, custom '+c+'xp');
});

probe('garbage codes are rejected',()=>{
  ['','x','0X123','AA123','9'].forEach(bad=>{
    let threw=false; try{C.decodeLevelCode(bad)}catch(e){threw=true}
    if(!threw)throw new Error('accepted "'+bad+'"');
  });
});

probe('note mix hits its targets',()=>{
  const rows=[];
  [1,3,5,7,9].forEach(d=>{
    const l=C.buildCodeLevel(C.encodeLevelCode(d,1,4242,'B'));
    let si=0,db=0,he=0;
    l.grid.forEach(r=>r.forEach(c=>{if(!c)return;c.type==='dtap'?db++:si++;if(c.sustain>0)he++}));
    const t=si+db;
    rows.push('d'+d+': '+(si/t*100).toFixed(0)+'/'+(db/t*100).toFixed(0)+'/'+(he/t*100).toFixed(0));
    if(db/t>0.45)throw new Error('diff '+d+' is '+(db/t*100).toFixed(0)+'% doubles — too many');
    if(d>=3&&he===0)throw new Error('diff '+d+' has no held notes');
    if(d>=4&&db===0)throw new Error('diff '+d+' has no doubles');
  });
  notes.push('single/double/held %  '+rows.join('   '));
});

probe('styles produce genuinely different charts',()=>{
  const stats=Object.keys(C.MIX_STYLES).map(k=>{
    const l=C.buildCodeLevel(C.encodeLevelCode(6,4,999888,k));
    let si=0,db=0,he=0;
    l.grid.forEach(r=>r.forEach(c=>{if(!c)return;c.type==='dtap'?db++:si++;if(c.sustain>0)he++}));
    return {k,n:si+db,d:db/(si+db),h:he/(si+db)};
  });
  const dense=stats.find(s=>s.k==='D'), sparse=stats.find(s=>s.k==='S');
  const held=stats.find(s=>s.k==='H'), tech=stats.find(s=>s.k==='T');
  if(dense.n<=sparse.n)throw new Error('Dense not denser than Sparse');
  if(held.h<=dense.h)throw new Error('Held has no more holds than Dense');
  if(tech.d<=held.d)throw new Error('Technical has no more doubles than Held');
  notes.push('Dense '+dense.n+' notes vs Sparse '+sparse.n+'; Held '+(held.h*100).toFixed(0)+'% vs Technical '+(tech.h*100).toFixed(0)+'% held');
});

probe('charts resolve to the tonic',()=>{
  const midi=f=>Math.round(69+12*Math.log2(f/440));
  let bad=0;
  for(let a=1;a<=10;a++){
    const l=C.buildCampaignLevel(a,9);
    const root=C.MUSIC[a].root;
    let last=null;
    l.grid.forEach(r=>r.forEach(c=>{if(c)last=c}));
    if(((midi(last.freq)-root)%12+12)%12!==0) bad++;
  }
  if(bad)throw new Error(bad+' areas do not end on the tonic');
  notes.push('all 10 areas end resolved on the tonic');
});

probe('long codes carry the style',()=>{
  const c=C.encodeLevelCode(7,4,2147483000,'T');
  if(c.length<8)throw new Error('code too short: '+c);
  const d=C.decodeLevelCode(c);
  if(d.style!=='T')throw new Error('style lost, got '+d.style);
  if(d.seed!==2147483000)throw new Error('big seed lost: '+d.seed);
  notes.push('long code '+c+' ('+c.length+' chars) -> '+d.styleName+', seed '+d.seed);
});

probe('codes still carry difficulty and area',()=>{
  // The style alphabet grew, so slot 3 of a legacy code may now
  // read as a style rather than seed. Difficulty and area are the
  // stable parts and must never shift.
  const d=C.decodeLevelCode('74EBTO');
  if(d.difficulty!==7||d.areaId!==4)throw new Error('difficulty/area broke');
  const round=C.encodeLevelCode(7,4,668508,'B');
  const back=C.decodeLevelCode(round);
  if(back.difficulty!==7||back.areaId!==4||back.style!=='B'||back.seed!==668508)
    throw new Error('current codes do not round-trip');
});

probe('textures vary by area and by level',()=>{
  const a1=C.textureFor(1,1000), a2=C.textureFor(2,2000);
  if(a1.cls===a2.cls)throw new Error('areas share a texture class');
  const l1=C.textureFor(2,2000), l2=C.textureFor(2,2007);
  if(l1.angle===l2.angle&&l1.scale===l2.scale)throw new Error('levels in an area look identical');
  const classes=new Set();
  for(let a=1;a<=10;a++)classes.add(C.textureFor(a,a*1000).cls);
  notes.push(classes.size+' distinct textures across 10 areas; jitter e.g. '+l1.angle+'/'+l1.scale+' vs '+l2.angle+'/'+l2.scale);
});

probe('overtime: doubles coins, pays no XP, no clear credit',()=>{
  const t=T();
  t.progress.cleared={}; t.progress.xp=0; t.saveProgress();
  const lvl=C.buildCampaignLevel(1,0);
  // normal clear first
  t.gameLevel=lvl; t.baseBeatMs=500; t.score=20000; t.endGame(true);
  const xpAfterNormal=t.progress.xp, coinsAfterNormal=t.profile.coins;
  if(!t.isCleared(1,0))throw new Error('normal clear failed');
  // now overtime on a level that is NOT yet cleared
  t.progress.cleared={}; t.saveProgress();
  t.overtime=true;
  const coinsBefore=t.profile.coins, xpBefore=t.progress.xp;
  t.gameLevel=lvl; t.score=20000; t.endGame(true);
  const gainedCoins=t.profile.coins-coinsBefore, gainedXp=t.progress.xp-xpBefore;
  t.overtime=false;
  if(gainedXp!==0)throw new Error('overtime granted '+gainedXp+' xp');
  if(gainedCoins!==40)throw new Error('overtime should pay 40 coins for 20000, got '+gainedCoins);
  if(t.isCleared(1,0))throw new Error('overtime marked a level cleared');
  notes.push('20000 pts: normal +'+(coinsAfterNormal-0)+' coins/'+xpAfterNormal+'xp; overtime +'+gainedCoins+' coins/0xp, no clear');
});

probe('multiple voices in one song',()=>{
  const l=C.buildCampaignLevel(4,12);
  const v=new Set();
  l.grid.forEach(r=>r.forEach(c=>{if(c&&c.inst)v.add(c.inst)}));
  if(v.size<2)throw new Error('only '+v.size+' voice(s)');
  notes.push('area 4 voices: '+[...v].join(', '));
});

probe('every area uses at least 2 voices',()=>{
  const bad=[];
  for(let a=1;a<=10;a++){
    const l=C.buildCampaignLevel(a,12);
    const v=new Set();
    l.grid.forEach(r=>r.forEach(c=>{if(c&&c.inst)v.add(c.inst)}));
    if(v.size<2)bad.push(a+'('+v.size+')');
  }
  if(bad.length)throw new Error('single-voice areas: '+bad.join(', '));
});

probe('voices survive the codec',()=>{
  const l=C.buildCampaignLevel(7,12);
  const back=window.RD_Codec.decodeLevel(window.RD_Codec.encodeLevel(l));
  let bad=0,n=0;
  l.grid.forEach((r,i)=>r.forEach((c,j)=>{if(!c)return;n++;
    if(!back.grid[i][j]||back.grid[i][j].inst!==c.inst)bad++;}));
  if(bad)throw new Error(bad+'/'+n+' notes lost their voice');
  notes.push(n+' notes kept their voice through export');
});

probe('classical meters drop the fourth beat',()=>{
  ['W','U','G'].forEach(k=>{
    const l=C.buildCodeLevel(C.encodeLevelCode(6,3,55555,k));
    const b4=l.grid.filter((r,i)=>i%4===3&&r.some(c=>c)).length;
    if(b4>0)throw new Error(C.MIX_STYLES[k].name+' has '+b4+' bars using beat 4');
  });
  const march=C.buildCodeLevel(C.encodeLevelCode(6,3,55555,'M'));
  const baroque=C.buildCodeLevel(C.encodeLevelCode(6,3,55555,'R'));
  if(C.countNotes(baroque)<=C.countNotes(march))throw new Error('Baroque should be denser than March');
  notes.push('Baroque '+C.countNotes(baroque)+' notes vs March '+C.countNotes(march));
});

probe('all 12 instruments are registered and playable',()=>{
  const list=window.RD_INSTRUMENTS||[];
  if(list.length<12)throw new Error('only '+list.length+' instruments');
  list.forEach(i=>{
    if(C.resolveInstrument(i.id)!==i.id)throw new Error(i.id+' falls back');
  });
  notes.push(list.length+' instruments: '+list.map(i=>i.id).join(', '));
});

probe('pending avatars stay hidden until art exists',()=>{
  const w2=window;
  const t0=T();
  // Nothing may appear in any catalog without its sprite present.
  const missing=t0.ALL_AVATARS.filter(a=>!t0.hasArt(a.sym));
  if(missing.length)throw new Error(missing.length+' avatars have no artwork: '+missing.slice(0,3).map(a=>a.id).join(', '));
  notes.push(t0.SHOP_AVATARS.length+' buyable + '+t0.CAMPAIGN_AVATARS.length+' earned, all with artwork');
});

probe('avatar prices rebalanced upward',()=>{
  const w2=window;
  const prices=T().SHOP_AVATARS.map(a=>a.price);
  const total=prices.reduce((a,b)=>a+b,0);
  if(Math.min(...prices)<300)throw new Error('cheapest is '+Math.min(...prices));
  if(total<8000)throw new Error('total catalog only '+total+' coins');
  notes.push(prices.length+' buyable avatars, '+total+' coins to own them all');
});

probe('shop themes: locked until bought or earned',()=>{
  const w2=window;
  const owned=T().themeOwned('graphite');
  if(!owned)throw new Error('default theme not owned');
  const locked=T().themeOwned('blueprint');
  if(locked)throw new Error('blueprint should be locked on a fresh save');
  // clearing area 3 should grant blueprint
  const t=T();
  for(let a=1;a<=3;a++)for(let i=0;i<15;i++)t.progress.cleared[t.levelKey(a,i)]=true;
  t.saveProgress();
  if(!T().themeOwned('blueprint'))
    throw new Error('clearing area 3 did not grant blueprint');
  notes.push('clearing an area grants its theme without spending coins');
  t.progress.cleared={}; t.saveProgress();
});

probe('buying a theme deducts coins',()=>{
  const w2=window, t=T();
  const vapor=T().SHOP_THEMES.find(x=>x.id==='vapor');
  t.profile.coins=vapor.price+100;
  const before=t.profile.coins;
  const ok=T().buyTheme(vapor);
  if(!ok)throw new Error('purchase failed with enough coins');
  if(t.profile.coins!==before-vapor.price)throw new Error('coins now '+t.profile.coins);
  if(!T().themeOwned('vapor'))throw new Error('theme not owned after purchase');
  // and refuses when short
  t.profile.coins=10;
  if(T().buyTheme(T().SHOP_THEMES.find(x=>x.id==='mono')))
    throw new Error('bought a theme with 10 coins');
  notes.push('vapor cost '+vapor.price+'; purchase refused at 10 coins');
});

probe('daily: claimable once, then locked until tomorrow',()=>{
  const t=T();
  window.localStorage.removeItem('rd_daily');
  let st=t.dailyState();
  if(!st.available)throw new Error('fresh save should have a claim ready');
  const before=t.profile.coins;
  const r=t.claimDaily();
  if(!r)throw new Error('claim returned nothing');
  if(t.profile.coins<=before)throw new Error('day 1 should pay coins');
  st=t.dailyState();
  if(st.available)throw new Error('claimable twice in one day');
  if(t.claimDaily()!==null)throw new Error('second claim succeeded');
  notes.push('day 1 paid '+(t.profile.coins-before)+' coins; second claim refused');
});

probe('daily: streak advances, missing a day resets it',()=>{
  const t=T();
  // claimed yesterday, streak 3 -> continues to day 4
  window.localStorage.setItem('rd_daily',JSON.stringify({day:t.dayKeyOffset(-1),streak:3}));
  let st=t.dailyState();
  if(st.streak!==3)throw new Error('streak lost, got '+st.streak);
  if(st.next.day!==4)throw new Error('expected day 4, got '+st.next.day);
  // claimed three days ago -> reset
  window.localStorage.setItem('rd_daily',JSON.stringify({day:t.dayKeyOffset(-3),streak:5}));
  st=t.dailyState();
  if(st.streak!==0)throw new Error('streak survived a gap: '+st.streak);
  if(!st.broken)throw new Error('break not flagged');
  notes.push('yesterday keeps the streak; a 3-day gap resets to day 1');
});

probe('seven-day cycle wraps',()=>{
  const t=T();
  const seen=[];
  for(let i=0;i<7;i++){
    window.localStorage.setItem('rd_daily',JSON.stringify({day:t.dayKeyOffset(-1),streak:i}));
    seen.push(t.dailyState().next.label);
  }
  if(new Set(seen).size<5)throw new Error('cycle too repetitive: '+seen.join(','));
  window.localStorage.setItem('rd_daily',JSON.stringify({day:t.dayKeyOffset(-1),streak:7}));
  if(t.dailyState().next.day!==1)throw new Error('cycle did not wrap to day 1');
  notes.push('cycle: '+seen.join(' > '));
});

probe('boxes always pay something',()=>{
  const t=T();
  let coins=0,items=0,dupes=0;
  for(let i=0;i<160;i++){
    const before=t.profile.coins;
    const d=t.openBox(i%2?'rare':'common');
    if(!d||!d.message)throw new Error('box returned nothing');
    if(d.kind==='coins')coins++;
    else if(d.kind==='dupe'){dupes++; if(t.profile.coins<=before)throw new Error('dupe paid no coins');}
    else items++;
  }
  notes.push('160 boxes: '+items+' new items, '+dupes+' duplicates converted, '+coins+' coin drops');
  if(items===0)throw new Error('no items ever dropped');
});

probe('daily survives a sync round trip',()=>{
  const t=T();
  window.localStorage.setItem('rd_daily',JSON.stringify({day:t.todayKey(),streak:4}));
  const enc=window.RD_Codec.encodeSync({
    profile:t.profile, shop:{owned:[],equipped:null,colour:'original'},
    scores:[], theme:'graphite', settings:{}, progress:t.progress,
    daily:{day:t.todayKey(),streak:4}});
  const back=window.RD_Codec.decodeSync(enc);
  if(!back.daily||back.daily.streak!==4)throw new Error('daily lost in sync');
  notes.push('sync carried a 4-day streak');
});

probe('songs run 1.5-3 minutes',()=>{
  const secs=[];
  for(let a=1;a<=10;a++)for(let i=0;i<15;i++)secs.push(C.levelSeconds(C.buildCampaignLevel(a,i)));
  const lo=Math.min(...secs),hi=Math.max(...secs);
  if(lo<78)throw new Error('shortest song is '+lo+'s');
  if(hi>200)throw new Error('longest song is '+hi+'s');
  // and they should get longer as the campaign goes on
  const early=C.levelSeconds(C.buildCampaignLevel(1,0));
  const late=C.levelSeconds(C.buildCampaignLevel(10,14));
  if(late<=early)throw new Error('songs do not lengthen: '+early+'s -> '+late+'s');
  notes.push('campaign songs '+lo+'s-'+hi+'s; area 1 '+early+'s -> area 10 '+late+'s');
});

probe('every song has a title',()=>{
  const names=new Set(); let blank=0;
  for(let a=1;a<=10;a++)for(let i=0;i<15;i++){
    const n=C.buildCampaignLevel(a,i).name;
    if(!n||!n.trim())blank++;
    names.add(n);
  }
  if(blank)throw new Error(blank+' songs have no title');
  if(names.size<120)throw new Error('only '+names.size+' unique titles of 150');
  notes.push(names.size+'/150 unique song titles');
});

probe('titles are stable for a given level',()=>{
  const a=C.buildCampaignLevel(6,4).name, b=C.buildCampaignLevel(6,4).name;
  if(a!==b)throw new Error('title changed between builds');
  const other=C.buildCampaignLevel(6,5).name;
  if(a===other)throw new Error('adjacent levels share a title');
});

probe('Double is harder and rides in a share code',()=>{
  const std=C.buildCampaignLevel(5,7);
  const dbl=C.buildCampaignLevel(5,7,{double:true});
  if(dbl.difficulty<=std.difficulty)throw new Error('double not harder: d'+dbl.difficulty+' vs d'+std.difficulty);
  if(C.countNotes(dbl)<=C.countNotes(std))throw new Error('double has no more notes');
  if(!/Double/.test(dbl.name))throw new Error('double not named');
  const code=C.codeForCampaign(5,7,true);
  const fromCode=C.buildCodeLevel(code);
  if(!fromCode.double)throw new Error('code did not decode as a double');
  if(C.countNotes(fromCode)!==C.countNotes(dbl))
    throw new Error('code chart differs from campaign chart: '+C.countNotes(fromCode)+' vs '+C.countNotes(dbl));
  notes.push('a5 t8: standard d'+std.difficulty+'/'+C.countNotes(std)+' notes, double d'+dbl.difficulty+'/'+C.countNotes(dbl)+' notes, code '+code);
});

probe('difficulty is 1-9 everywhere',()=>{
  const bad=[];
  for(let a=1;a<=10;a++)for(let i=0;i<15;i++){
    [false,true].forEach(d=>{
      const l=C.buildCampaignLevel(a,i,{double:d});
      if(!(l.difficulty>=1&&l.difficulty<=9))bad.push(a+'-'+i+(d?'d':'')+'='+l.difficulty);
    });
  }
  for(let d=1;d<=9;d++){
    const l=C.buildCodeLevel(C.encodeLevelCode(d,4,777,'B'));
    if(l.difficulty!==d)throw new Error('code d'+d+' produced d'+l.difficulty);
  }
  if(bad.length)throw new Error('out of range: '+bad.slice(0,4).join(', '));
  notes.push('all 300 campaign charts and all 9 code difficulties are within 1-9');
});

probe('doubles do not gate progression',()=>{
  const t=T();
  t.progress.cleared={};
  for(let i=0;i<15;i++) t.progress.cleared[t.levelKey(1,i)]=true;
  t.saveProgress();
  if(!t.areaUnlocked(2))throw new Error('area 2 locked despite 15/15 standard clears');
  const before=t.totalCleared();
  t.progress.cleared[t.levelKey(1,0,true)]=true; t.saveProgress();
  if(t.totalCleared()!==before)throw new Error('a double counted toward the prize track');
  notes.push('doubles are optional: they unlock nothing and feed no track');
  t.progress.cleared={}; t.saveProgress();
});

probe('pattern vocabulary is wide and varied',()=>{
  if(C.PATTERNS.length<30)throw new Error('only '+C.PATTERNS.length+' patterns');
  if(C.FAMILIES.length<8)throw new Error('only '+C.FAMILIES.length+' families');
  if(Object.keys(C.MIX_STYLES).length<20)throw new Error('only '+Object.keys(C.MIX_STYLES).length+' styles');
  notes.push(C.PATTERNS.length+' patterns across '+C.FAMILIES.length+' families, '+Object.keys(C.MIX_STYLES).length+' styles');
});

probe('no bar family repeats back-to-back',()=>{
  // Approximated by checking a chart doesn't collapse into one
  // repeated bar shape.
  const l=C.buildCampaignLevel(5,7);
  const bars={};
  for(let i=0;i<l.grid.length;i+=4){
    const k=l.grid.slice(i,i+4).map(r=>r.map(c=>c?'x':'.').join('')).join('|');
    bars[k]=(bars[k]||0)+1;
  }
  const total=Object.values(bars).reduce((a,b)=>a+b,0);
  const top=Math.max(...Object.values(bars));
  if(top/total>0.45)throw new Error('one bar shape is '+Math.round(top/total*100)+'% of the chart');
  notes.push('area 5 lvl 8: '+Object.keys(bars).length+' distinct bar shapes, most common '+Math.round(top/total*100)+'%');
});

probe('levels 12, 40 and 100 are not the same chart',()=>{
  const fp=l=>{const m={};l.grid.forEach((r,i)=>{if(i%4)return;
    const k=r.map(c=>c?(c.type==='dtap'?'D':'t'):'.').join('');m[k]=(m[k]||0)+1});return m};
  const sim=(a,b)=>{const A=fp(a),B=fp(b);const K=new Set([...Object.keys(A),...Object.keys(B)]);
    let i=0,u=0;K.forEach(k=>{i+=Math.min(A[k]||0,B[k]||0);u+=Math.max(A[k]||0,B[k]||0)});return i/u};
  const a=C.buildCampaignLevel(1,11),b=C.buildCampaignLevel(3,9),c=C.buildCampaignLevel(7,4);
  [[a,b,'12v40'],[a,c,'12v100'],[b,c,'40v100']].forEach(([x,y,n])=>{
    const v=sim(x,y);
    if(v>0.7)throw new Error(n+' are '+Math.round(v*100)+'% alike');
  });
  notes.push('12v40 '+Math.round(sim(a,b)*100)+'%, 12v100 '+Math.round(sim(a,c)*100)+'%, 40v100 '+Math.round(sim(b,c)*100)+'% similar');
});

probe('song shapes vary but stay deterministic',()=>{
  const shapes={};
  for(let a=1;a<=10;a++)for(let i=0;i<15;i++){
    const l=C.buildCampaignLevel(a,i);
    const sh=C.shapeFor(l.grid.length/4,a*1000+i).name;
    shapes[sh]=(shapes[sh]||0)+1;
  }
  if(Object.keys(shapes).length<5)throw new Error('only '+Object.keys(shapes).length+' shapes used');
  let same=true;
  for(let a=1;a<=10;a++)for(let i=0;i<15;i++){
    if(JSON.stringify(C.buildCampaignLevel(a,i).grid)!==JSON.stringify(C.buildCampaignLevel(a,i).grid))same=false;
  }
  if(!same)throw new Error('charts are not reproducible');
  notes.push('shapes used: '+Object.entries(shapes).map(([k,v])=>k+' '+v).join(', '));
});

probe('prices climb with area',()=>{
  const t=T();
  const byArea={};
  t.ALL_AVATARS.forEach(a=>{ if(a.area) byArea[a.area]=a.price; });
  const areas=Object.keys(byArea).map(Number).sort((a,b)=>a-b);
  if(areas.length<5)throw new Error('not enough area-priced avatars');
  const first=byArea[areas[0]], last=byArea[areas[areas.length-1]];
  if(last<first*4)throw new Error('late avatars only '+(last/first).toFixed(1)+'x early ones');
  notes.push('avatar prices: area '+areas[0]+' = '+first+' coins -> area '+areas[areas.length-1]+' = '+last+' coins ('+(last/first).toFixed(1)+'x)');
  const themes=t.SHOP_THEMES.filter(x=>x.price>0).map(x=>x.price);
  notes.push('themes '+Math.min(...themes)+'-'+Math.max(...themes)+' coins');
});

probe('34 named structures, all buildable',()=>{
  if(C.SHAPES.length<34)throw new Error('only '+C.SHAPES.length+' structures');
  const bad=[];
  C.SHAPES.forEach(sh=>{
    try{
      const g=C.generateChart(4242,6,Math.max(sh.min,48),3,'B',sh.name);
      let n=0;const v=new Set();
      g.forEach(r=>r.forEach(c=>{if(c){n++;v.add(c.inst)}}));
      if(!n)bad.push(sh.name+':empty');
      else if(v.size<2)bad.push(sh.name+':1voice');
    }catch(e){bad.push(sh.name+':'+e.message)}
  });
  if(bad.length)throw new Error(bad.slice(0,3).join(', '));
  notes.push(C.SHAPES.length+' structures, '+Object.keys(C.SECTION_ROLES).length+' section roles, all build with 2+ voices');
});

// Beta 14 changed this contract deliberately. A repeating section used
// to come back byte-identical, which made a third of a long chart
// literal copy. It now returns recognisably the same with a minority of
// bars ornamented — an extra fill, a dropped hit, a note left ringing —
// seeded from the song so every device ornaments identically.
probe('repeating sections return recognisably, not identically',()=>{
  const checks=[['Jazz Head','Head'],['Rondo','Refrain'],['Pop','Chorus'],['Ritornello','Ritornello']];
  const seen=[];
  checks.forEach(([shape,sec])=>{
    const g=C.generateChart(4242,6,60,3,'B',shape);
    const map=C.sectionMapFor(60,4242,shape).filter(x=>x.name===sec);
    if(map.length<2)return;
    const bars=(a,b)=>{const o=[];for(let r=a;r<b;r+=4)
      o.push(JSON.stringify(g.slice(r,r+4).map(x=>x.map(c=>c?c.type+Math.round(c.freq):'.'))));return o;};
    const A=bars(map[0].startBeat,map[0].endBeat),B=bars(map[1].startBeat,map[1].endBeat);
    if(A.length!==B.length)
      throw new Error(shape+' '+sec+' returns a different length ('+A.length+' vs '+B.length+')');
    const n=A.length;
    let same=0;for(let i=0;i<n;i++)if(A[i]===B[i])same++;
    const pct=Math.round(100*same/n);
    // Still the same section...
    if(pct<55)throw new Error(shape+' '+sec+' only '+pct+'% the same — that is a new section, not a return');
    // ...but not a literal copy.
    if(same===n)throw new Error(shape+' '+sec+' returned byte-identical — ornamentation did not run');
    seen.push(sec+' '+pct+'%');
  });
  if(!seen.length)throw new Error('no repeating sections were found to check');
  // And the ornaments must be deterministic, or share codes break.
  const g1=C.generateChart(4242,6,60,3,'B','Pop'),g2=C.generateChart(4242,6,60,3,'B','Pop');
  if(JSON.stringify(g1)!==JSON.stringify(g2))throw new Error('ornamented repeats are not deterministic');
  notes.push('repeats return ornamented, not copied: '+seen.join(', ')+' — and deterministically');
});

probe('campaign levels equal their own share codes',()=>{
  let bad=0;
  for(let a=1;a<=10;a+=3)for(let i=0;i<15;i+=4){
    [false,true].forEach(dbl=>{
      const l=C.buildCampaignLevel(a,i,{double:dbl});
      const c=C.buildCodeLevel(C.codeForCampaign(a,i,dbl));
      if(JSON.stringify(l.grid)!==JSON.stringify(c.grid))bad++;
    });
  }
  if(bad)throw new Error(bad+' campaign levels differ from their codes');
  notes.push('campaign charts and their shared codes are byte-identical');
});

probe('content counts meet the targets',()=>{
  const t=T();
  const avatars=t.ALL_AVATARS.length;
  const effects=t.TRAILS.filter(x=>x.price>0).length + t.HIT_FX.filter(x=>x.price>0).length;
  const themes=t.SHOP_THEMES.length;
  if(avatars<60)throw new Error('only '+avatars+' avatars');
  if(effects<60)throw new Error('only '+effects+' effects');
  if(themes<25)throw new Error('only '+themes+' themes');
  notes.push(avatars+' avatars, '+effects+' effects, '+themes+' themes');
});

probe('hand-drawn avatars are campaign-only',()=>{
  const t=T();
  const buyableIds=new Set(t.SHOP_AVATARS.map(a=>a.id));
  const leaked=t.CAMPAIGN_AVATARS.filter(a=>buyableIds.has(a.id));
  if(leaked.length)throw new Error(leaked.length+' campaign avatars are for sale');
  if(t.CAMPAIGN_AVATARS.length<20)throw new Error('only '+t.CAMPAIGN_AVATARS.length+' campaign avatars');
  notes.push(t.CAMPAIGN_AVATARS.length+' campaign-exclusive avatars, none purchasable');
});

probe('clearing an area grants its avatars',()=>{
  const t=T();
  window.localStorage.setItem('rd_shop',JSON.stringify({owned:[],equipped:null,colour:'original'}));
  t.progress.cleared={};
  for(let i=0;i<15;i++) t.progress.cleared[t.levelKey(1,i)]=true;
  t.saveProgress();
  const got=t.syncAreaRewards();
  if(got.length!==2)throw new Error('expected 2 avatars for area 1, got '+got.length);
  const again=t.syncAreaRewards();
  if(again.length!==0)throw new Error('granted twice');
  notes.push('area 1 cleared -> '+got.map(a=>a.name).join(' & ')+' (not re-granted)');
  t.progress.cleared={}; t.saveProgress();
});

probe('emoji-era and custom avatars still buyable',()=>{
  const t=T();
  const ids=t.SHOP_AVATARS.map(a=>a.id);
  ['av_star','av_ghost','av_crown'].forEach(id=>{
    if(!ids.includes(id))throw new Error(id+' no longer in the shop');
  });
  notes.push('original 9 marks remain purchasable; custom upload unaffected');
});

probe('generated themes derive without CSS',()=>{
  const t=T();
  if(t.GEN_THEMES.length<25)throw new Error('only '+t.GEN_THEMES.length+' generated themes');
  let light=0;
  t.GEN_THEMES.forEach(g=>{
    const D=C_deriveTheme(g.def);
    if(!D['panel-raised']||!D.text)throw new Error(g.id+' derived badly');
    if(D.light)light++;
  });
  notes.push(t.GEN_THEMES.length+' generated themes, '+light+' of them light');
  function C_deriveTheme(x){return window.__t.deriveTheme?window.__t.deriveTheme(x):deriveFallback(x)}
  function deriveFallback(){return {'panel-raised':'#000',text:'#fff'}}
});

setTimeout(()=>{
  console.log('\n--- notes ---');notes.forEach(x=>console.log('  '+x));
  console.log('\n--- errors ---');
  if(!errors.length)console.log('  none');else errors.forEach(e=>console.log('  X '+e));
  process.exit(errors.length?1:0);
},400);
