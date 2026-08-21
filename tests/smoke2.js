const {JSDOM}=require('jsdom');
// ── Locate the extension ──
// Looks next to this folder, then inside it, then falls back to
// the APP_DIR environment variable. Works from a checkout, a
// download folder, or CI without editing anything.
const path = require('path');
const fs = require('fs');
// Resolving the build under test is browser.js's job — it is the one
// file that knows the repo layout.
const findApp = require('./browser').appDir;
const DIR = findApp();

const errors=[],notes=[];
const dom=new JSDOM(fs.readFileSync(path.join(DIR,'popup.html'),'utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://localhost/'});
const {window}=dom;
window.onerror=m=>errors.push('onerror: '+m);
function n(e={}){return Object.assign({connect(){return this},disconnect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},Q:{value:1},threshold:{value:0},knee:{value:0},ratio:{value:1},attack:{value:0},release:{value:0},type:'',buffer:null},e)}
window.AudioContext=function(){return{state:'running',currentTime:0,sampleRate:44100,destination:n(),resume:()=>Promise.resolve(),createOscillator:()=>n(),createGain:()=>n(),createBiquadFilter:()=>n(),createDynamicsCompressor:()=>n(),createBufferSource:()=>n(),createBuffer:(c,l)=>({getChannelData:()=>new Float32Array(l)})}};
window.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
window.cancelAnimationFrame=id=>clearTimeout(id);
window.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
if(!window.document.fonts)window.document.fonts={ready:Promise.resolve()};
window.console.error=(...a)=>errors.push('console.error: '+a.join(' '));
window.console.warn=()=>{};

// simulate a v5 user: old theme id + existing profile
window.localStorage.setItem('rd_theme','neon');
window.localStorage.setItem('rd_profile',JSON.stringify({username:'OldUser',coins:5000,bestScore:1234}));

const HOOK=`
;window.__t={
  get LEVELS(){return LEVELS}, get activeTiles(){return activeTiles},
  set activeTiles(v){activeTiles=v},
  get lives(){return lives}, set lives(v){lives=v},
  get maxLives(){return maxLives}, set maxLives(v){maxLives=v},
  get score(){return score}, set score(v){score=v},
  get combo(){return combo}, set combo(v){combo=v},
  get streak(){return streak}, set streak(v){streak=v},
  get profile(){return profile},
  get currentSettings(){return currentSettings},
  get ctDraft(){return ctDraft}, set ctDraft(v){ctDraft=v},
  get gameLevel(){return gameLevel}, set gameLevel(v){gameLevel=v},
  get notesHit(){return notesHit}, set notesHit(v){notesHit=v},
  get notesTotal(){return notesTotal}, set notesTotal(v){notesTotal=v},
  set baseBeatMs(v){baseBeatMs=v}, get running(){return running},
  hitTol, spawnTile, retireTile, updateLives, hit, endGame,
  updateCtPreview, startGame, deriveTheme,
};`;
for(const f of ['lighting.js','campaign.js','codec.js','loading.js','audio.js','game.js']){
  try{
    let code=fs.readFileSync(path.join(DIR,f),'utf8');
    if(f==='game.js') code+=HOOK;
    window.eval(code);
  }catch(e){errors.push(f+': '+e.message)}
}
const T=()=>window.__t;

const D=window.document;
function probe(name,fn){try{fn();console.log('  ok: '+name)}catch(e){errors.push('"'+name+'": '+e.message)}}

probe('v5 theme migrated',()=>{
  const cls=D.body.className;
  notes.push('body class after migration: "'+cls+'" (expected theme-vapor)');
  if(!cls.includes('vapor'))throw new Error('neon did not migrate to vapor, got: '+cls);
});
probe('profile preserved',()=>{
  const t=D.getElementById('pbar-username').textContent;
  if(t!=='OldUser')throw new Error('username lost: '+t);
  notes.push('coins shown: '+D.getElementById('pbar-coins').textContent.trim());
});
probe('start a game directly',()=>{
  const t=T();t.gameLevel=t.LEVELS[0];t.baseBeatMs=Math.round(60000/t.LEVELS[0].bpm);t.startGame();
  if(!t.running)throw new Error('game did not start');
});
probe('tile pool recycles',()=>{
  const t=T();
  window.RD_TILE_POOL=[];
  for(let i=0;i<8;i++){const e=D.createElement('div');e.className='tile';window.RD_TILE_POOL.push(e)}
  const before=window.RD_TILE_POOL.length;
  const tile=t.spawnTile({lane:0,type:'tap',freq:440,sustain:0});
  const during=window.RD_TILE_POOL.length;
  t.retireTile(tile);
  const after=window.RD_TILE_POOL.length;
  notes.push('pool '+before+' -> spawn '+during+' -> retire '+after);
  if(during!==before-1)throw new Error('spawn did not draw from pool');
  if(after!==before)throw new Error('retire did not return to pool');
});
probe('life pips render + decrement',()=>{
  const t=T();t.maxLives=3;t.lives=3;t.updateLives();
  const pips=D.querySelectorAll('#g-lives .pip');
  if(pips.length!==3)throw new Error('expected 3 pips, got '+pips.length);
  t.lives=1;t.updateLives();
  const lit=D.querySelectorAll('#g-lives .pip.lit').length;
  notes.push('pips lit after losing 2: '+lit);
  if(lit!==1)throw new Error('expected 1 lit pip, got '+lit);
});
probe('hit window changes tolerance',()=>{
  const t=T();
  t.currentSettings.hitWindow='normal';const norm=t.hitTol();
  t.currentSettings.hitWindow='strict';const strict=t.hitTol();
  t.currentSettings.hitWindow='forgiving';const forg=t.hitTol();
  notes.push('hitTol strict/normal/forgiving: '+strict.toFixed(1)+' / '+norm.toFixed(1)+' / '+forg.toFixed(1));
  if(!(strict<norm&&norm<forg))throw new Error('hit window not ordered');
  t.currentSettings.hitWindow='normal';
});
probe('streak bonus compounds',()=>{
  const t=T();t.score=0;t.combo=0;t.streak=0;t.hit(0,1);
  const first=t.score;
  for(let i=0;i<9;i++)t.hit(0,1);
  const tenth=t.score;
  notes.push('score after 1 hit: '+first+', after 10: '+tenth);
  if(tenth<=first*10)throw new Error('streak/combo not compounding');
});
probe('coins: every level pays the same, whatever the score',()=>{
  const t=T();
  const flat=window.RD_Campaign.COINS_PER_CLEAR;
  // A campaign clear pays the flat rate...
  t.gameLevel=window.RD_Campaign.buildCampaignLevel(1,0);
  let before=t.profile.coins;
  t.score=25000; t.notesTotal=1; t.notesHit=1; t.endGame(true);
  const camp=t.profile.coins-before;
  // ...and so does a custom chart, and so does a run worth ten times
  // the score. Coins count levels finished, not points scored.
  t.gameLevel=Object.assign({},window.RD_Campaign.buildCampaignLevel(1,0),{campaign:false});
  before=t.profile.coins;
  t.score=250000; t.notesTotal=1; t.notesHit=1; t.endGame(true);
  const cust=t.profile.coins-before;
  notes.push('campaign +'+camp+' coins, custom at 10x the score +'+cust+' coins');
  if(camp!==flat)throw new Error('campaign should pay '+flat+', got '+camp);
  if(cust!==flat)throw new Error('custom should pay '+flat+', got '+cust);
});
probe('coins: a run that ends early pays for what it played',()=>{
  const t=T();
  const flat=window.RD_Campaign.COINS_PER_CLEAR;
  t.gameLevel=window.RD_Campaign.buildCampaignLevel(1,0);
  let before=t.profile.coins;
  t.score=25000; t.notesTotal=100; t.notesHit=0; t.endGame(false);
  const quit=t.profile.coins-before;
  before=t.profile.coins;
  t.score=25000; t.notesTotal=100; t.notesHit=50; t.endGame(false);
  const half=t.profile.coins-before;
  notes.push('quit on note 1: +'+quit+' coins, halfway: +'+half);
  if(quit!==0)throw new Error('quitting instantly should pay 0, got '+quit);
  if(half!==Math.round(flat/2))throw new Error('halfway should pay '+Math.round(flat/2)+', got '+half);
});
probe('contrast warning fires on bad pair',()=>{
  const t=T();t.ctDraft.bg='#171C24';t.ctDraft.text='#1A1A1A';t.updateCtPreview();
  const el=D.getElementById('ct-contrast');
  if(!el.className.includes('warn'))throw new Error('no warning for dark-on-dark: '+el.className);
  notes.push('contrast warning text: '+el.textContent.slice(0,52)+'...');
  t.ctDraft.text='#E6EAF2';t.updateCtPreview();
  if(!D.getElementById('ct-contrast').className.includes('ok'))throw new Error('good pair not marked ok');
});
probe('derived theme inverts for light panels',()=>{
  const t=T();
  const d=t.deriveTheme({bg:'#171C24',text:'#E6EAF2',tap:'#22D3EE',dtap:'#FB4F7D',mat:'metal'});
  const l=t.deriveTheme({bg:'#EDE8DE',text:'#232019',tap:'#1E7A8C',dtap:'#C2325C',mat:'paper'});
  notes.push('dark raised='+d['panel-raised']+' vs panel='+d.panel);
  notes.push('light raised='+l['panel-raised']+' vs panel='+l.panel);
  if(!d.light===true&&l.light!==true)throw new Error('light detection failed');
  if(l.light!==true)throw new Error('light panel not detected as light');
  if(d.light!==false)throw new Error('dark panel misdetected');
});

setTimeout(()=>{
  console.log('\n--- notes ---');notes.forEach(x=>console.log('  '+x));
  console.log('\n--- errors ---');
  if(!errors.length)console.log('  none');else errors.forEach(e=>console.log('  X '+e));
  process.exit(errors.length?1:0);
},500);
