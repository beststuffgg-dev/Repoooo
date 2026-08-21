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

const w=new JSDOM('<body></body>',{runScripts:'outside-only'}).window;
w.eval(fs.readFileSync(path.join(DIR,'codec.js'),'utf8'));
const C=w.RD_Codec;
let fail=0;
const ok=(n,c,extra)=>{console.log((c?'  ok   ':'  FAIL ')+n+(extra?'  ['+extra+']':'')); if(!c)fail++;};

// A level exercising EVERY feature the app supports.
const full={
  id:'c123', name:'Everything Bagel', bpm:143, diff:'expert',
  bgMode:'bass',
  instrument:'marimba',
  laneFreqs:[220.00,277.18,329.63,466.16],           // incl. sharps
  bassPattern:[65.41,0,82.41,0,98.00,0,73.42,0],
  bassSteps:[{active:true,freq:65.41},{active:false,freq:65.41},
             {active:true,freq:82.41},{active:false,freq:65.41},
             {active:true,freq:98.00},{active:false,freq:65.41},
             {active:true,freq:73.42},{active:false,freq:65.41}],
  grid:[
    // every sustain step 0 .. 3.0
    [{type:'tap',freq:220.00,sustain:0},   {type:'dtap',freq:277.18,sustain:0.5},
     {type:'tap',freq:329.63,sustain:1.0}, {type:'dtap',freq:466.16,sustain:1.5}],
    [{type:'tap',freq:220.00,sustain:2.0}, {type:'tap',freq:277.18,sustain:2.5},
     {type:'dtap',freq:329.63,sustain:3.0},null],
    // off-default pitches across the full A1..C8 range
    [{type:'tap',freq:55.00,sustain:0},null,null,{type:'dtap',freq:4186.01,sustain:0}],
    [null,null,null,null],
    [{type:'dtap',freq:110.00,sustain:3.0},{type:'tap',freq:1975.53,sustain:0.5},null,null],
    ...Array.from({length:59},()=>[null,null,null,null]),
  ],
};

const code=C.encodeLevel(full);
const back=C.decodeLevel(code);
console.log('  code length: '+code.length+' chars for a '+full.grid.length+'-beat level\n');

ok('name',        back.name===full.name, back.name);
ok('bpm',         back.bpm===full.bpm, back.bpm);
ok('difficulty',  back.diff===full.diff, back.diff);
ok('instrument',  back.instrument===full.instrument, back.instrument);
ok('bgMode',      back.bgMode===full.bgMode, back.bgMode);
ok('length (beat count)', back.grid.length===full.grid.length, back.grid.length+' beats');
ok('laneFreqs',   JSON.stringify(back.laneFreqs)===JSON.stringify(full.laneFreqs));
ok('bassPattern', JSON.stringify(back.bassPattern)===JSON.stringify(full.bassPattern));
ok('bassSteps rebuilt',
   back.bassSteps.length===full.bassSteps.length &&
   back.bassSteps.every((s,i)=>s.active===full.bassSteps[i].active));

// every cell, field by field
let cellErr=null, cells=0;
full.grid.forEach((row,r)=>row.forEach((cell,c)=>{
  const b=back.grid[r][c];
  if(!cell){ if(b!==null) cellErr=cellErr||`beat ${r} lane ${c}: expected rest, got note`; return; }
  cells++;
  if(!b){cellErr=cellErr||`beat ${r} lane ${c}: note lost`;return}
  if(b.type!==cell.type) cellErr=cellErr||`beat ${r} lane ${c}: type ${b.type}!=${cell.type}`;
  if(Math.abs(b.freq-cell.freq)>0.02) cellErr=cellErr||`beat ${r} lane ${c}: freq ${b.freq}!=${cell.freq}`;
  if(b.sustain!==cell.sustain) cellErr=cellErr||`beat ${r} lane ${c}: sustain ${b.sustain}!=${cell.sustain}`;
}));
ok('all '+cells+' notes exact (type, pitch, sustain)', !cellErr, cellErr||'');

// each sustain value individually
[0,0.5,1.0,1.5,2.0,2.5,3.0].forEach(sv=>{
  const l={name:'s',bpm:120,bgMode:'none',laneFreqs:[261.63,329.63,392,523.25],bassPattern:[],
    grid:[[{type:'tap',freq:261.63,sustain:sv},null,null,null]]};
  const r=C.decodeLevel(C.encodeLevel(l));
  ok('sustain '+sv.toFixed(1)+'s', r.grid[0][0].sustain===sv);
});

// each instrument individually
['synth','piano','guitar','marimba','bell'].forEach(inst=>{
  const l={name:'i',bpm:120,bgMode:'none',instrument:inst,
    laneFreqs:[261.63,329.63,392,523.25],bassPattern:[],
    grid:[[{type:'tap',freq:261.63,sustain:0},null,null,null]]};
  ok('instrument '+inst, C.decodeLevel(C.encodeLevel(l)).instrument===inst);
});

// full chromatic sweep A1..C8
let bad=0;
for(let m=33;m<=108;m++){
  const f=C.midiToFreq(m);
  const l={name:'n',bpm:120,bgMode:'none',laneFreqs:[261.63,329.63,392,523.25],bassPattern:[],
    grid:[[{type:'tap',freq:f,sustain:0},null,null,null]]};
  if(Math.abs(C.decodeLevel(C.encodeLevel(l)).grid[0][0].freq-f)>0.02) bad++;
}
ok('all 76 chromatic notes A1-C8 exact', bad===0, bad?bad+' wrong':'');

// bg modes
['none','drums','bass'].forEach(m=>{
  const l={name:'b',bpm:120,bgMode:m,laneFreqs:[261.63,329.63,392,523.25],bassPattern:[],grid:[[null,null,null,null]]};
  ok('bgMode '+m, C.decodeLevel(C.encodeLevel(l)).bgMode===m);
});

// notes-array (built-in) levels
const builtin={name:'Builtin',bpm:100,beats:8,bgMode:'drums',
  laneFreqs:[261.63,329.63,392,523.25],bassPattern:[],
  notes:[{b:0,l:0,t:'tap'},{b:2,l:1,t:'dtap'},{b:5,l:3,t:'tap'}]};
const bi=C.decodeLevel(C.encodeLevel(builtin));
ok('built-in notes-array exports', bi.grid.length===8 &&
   bi.grid[0][0].type==='tap' && bi.grid[2][1].type==='dtap' && bi.grid[5][3].type==='tap');

// v2 code (no diff/instrument) must still decode
const v2payload='2|Old Level|110|drums|60,64,67,72|36,0|t.3;.4';
const v2code='RD2:'+C.pack(v2payload);
const v2=C.decodeLevel(v2code);
ok('v2 code still decodes', v2.name==='Old Level'&&v2.bpm===110&&v2.grid.length===2,
   'defaults: diff='+v2.diff+' instr='+v2.instrument);

// v5 JSON code
const v5='RHYTHMDROP:'+Buffer.from(JSON.stringify(full)).toString('base64');
const fromV5=C.decodeLevel(v5);
ok('v5 code still decodes with all fields',
   fromV5.name===full.name && fromV5.diff===full.diff &&
   fromV5.instrument===full.instrument && fromV5.grid.length===full.grid.length);

console.log(fail? '\n  '+fail+' FAILURES':'\n  all passing');
process.exit(fail?1:0);
