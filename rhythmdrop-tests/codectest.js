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
const dom=new JSDOM('<body></body>',{runScripts:'outside-only'});
const w=dom.window;
w.eval(fs.readFileSync(path.join(DIR,'codec.js'),'utf8'));
const C=w.RD_Codec;
let fail=0;
const ok=(n,c)=>{console.log((c?'  ok  ':'  FAIL')+' '+n); if(!c)fail++;};

// ── LZW round trip on nasty inputs ──
['', 'a', 'aaaaaaaaaa', 'ababababab', 'Café ☕ ünïcode',
 '.'.repeat(500), JSON.stringify({a:[1,2,3],b:'x'.repeat(200)}),
 'TATATATATAT'.repeat(50)].forEach((s,i)=>{
  ok('lzw roundtrip #'+i+' (len '+s.length+')', C.unpack(C.pack(s))===s);
});

// ── Build a realistic 64-beat level ──
function makeLevel(beats){
  const grid=[];
  for(let r=0;r<beats;r++){
    const row=[null,null,null,null];
    if(r%2===0) row[r%4]={type:'tap',freq:261.63,sustain:0};
    if(r%8===0) row[(r+2)%4]={type:'dtap',freq:392.00,sustain:1.5};
    if(r%16===0) row[3]={type:'tap',freq:523.25,sustain:3};
    grid.push(row);
  }
  return {name:'Midnight Drive',bpm:128,bgMode:'drums',
    laneFreqs:[261.63,329.63,392.00,523.25],
    bassPattern:[65.41,0,65.41,0,87.31,0,73.42,0],grid};
}

[32,64,128,256].forEach(beats=>{
  const lvl=makeLevel(beats);
  const oldCode='RHYTHMDROP:'+Buffer.from(JSON.stringify(lvl)).toString('base64');
  const newCode=C.encodeLevel(lvl);
  const pct=((1-newCode.length/oldCode.length)*100).toFixed(1);
  console.log(`  ${String(beats).padStart(3)} beats: v5 ${String(oldCode.length).padStart(6)} chars -> v6 ${String(newCode.length).padStart(5)} chars  (${pct}% smaller)`);
  const back=C.decodeLevel(newCode);
  ok('  roundtrip '+beats+' beats',
    back.name===lvl.name && back.bpm===lvl.bpm && back.bgMode===lvl.bgMode &&
    back.grid.length===lvl.grid.length &&
    JSON.stringify(back.grid)===JSON.stringify(lvl.grid) &&
    JSON.stringify(back.laneFreqs)===JSON.stringify(lvl.laneFreqs) &&
    JSON.stringify(back.bassPattern)===JSON.stringify(lvl.bassPattern));
});

// ── Backward compatibility with v5 codes ──
const v5lvl=makeLevel(48);
const v5code='RHYTHMDROP:'+Buffer.from(JSON.stringify(v5lvl)).toString('base64');
const fromV5=C.decodeLevel(v5code);
ok('reads v5 RHYTHMDROP: code', fromV5.name===v5lvl.name && fromV5.grid.length===48);
ok('reads bare v5 base64 (no prefix)',
   C.decodeLevel(Buffer.from(JSON.stringify(v5lvl)).toString('base64')).bpm===128);

// ── Unicode level name ──
const uni=makeLevel(16); uni.name='Café ☕ 夜';
ok('unicode name survives', C.decodeLevel(C.encodeLevel(uni)).name==='Café ☕ 夜');

// ── Sustain + custom pitch fidelity ──
const s2=makeLevel(8);
s2.grid[1][0]={type:'tap',freq:466.16,sustain:2.5};
const r2=C.decodeLevel(C.encodeLevel(s2));
ok('custom pitch exact', Math.abs(r2.grid[1][0].freq-466.16)<0.02);
ok('sustain exact', r2.grid[1][0].sustain===2.5);

// ── Sync code ──
const sync=C.encodeSync({
  profile:{username:'Alex',coins:4230,bestScore:88120},
  shop:{owned:['av_star','av_dj','custom'],equipped:'av_dj'},
  scores:Array.from({length:30},(_,i)=>({name:'Alex',score:9000-i*100,level:'Midnight Drive',coins:9,date:1750000000000+i})),
  theme:'walnut', customTheme:{mat:'wood',bg:'#2A1B0E'},
  settings:{lives:3,instrument:'piano',hitWindow:'normal',audioOffset:-12},
  levels:[makeLevel(64),makeLevel(32)],
});
console.log('\n  sync code length (2 levels + 30 scores): '+sync.length+' chars');
const back=C.decodeSync(sync);
ok('sync: username', back.profile.username==='Alex');
ok('sync: coins', back.profile.coins===4230);
ok('sync: owned avatars', back.shop.owned.join()==='av_star,av_dj,custom');
ok('sync: equipped', back.shop.equipped==='av_dj');
ok('sync: scores capped at 25', back.scores.length===25);
ok('sync: score fields intact', back.scores[0].score===9000 && back.scores[0].level==='Midnight Drive');
ok('sync: theme', back.theme==='walnut');
ok('sync: settings', back.settings.instrument==='piano' && back.settings.audioOffset===-12);
ok('sync: levels round-trip', back.levels.length===2 && back.levels[0].grid.length===64 &&
   JSON.stringify(back.levels[0].grid)===JSON.stringify(makeLevel(64).grid));

const noLevels=C.encodeSync({
  profile:{username:'Alex',coins:10,bestScore:5},shop:{owned:[],equipped:null},
  scores:[],theme:'graphite',settings:{lives:3}});
console.log('  sync code length (profile only): '+noLevels.length+' chars');
ok('sync without levels', C.decodeSync(noLevels).levels.length===0);

// ── Rejects garbage ──
let threw=false; try{C.decodeSync('RDSYNC1:@@@@')}catch(e){threw=true}
ok('rejects corrupt sync code', threw);
threw=false; try{C.decodeLevel('not a code at all')}catch(e){threw=true}
ok('rejects garbage level code', threw);

console.log(fail? '\n  '+fail+' FAILURES' : '\n  all passing');
process.exit(fail?1:0);
