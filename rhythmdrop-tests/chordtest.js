// Phase 5: chords are real triads, and a wall of notes stops paying.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR = process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
const w = dom.window;
['campaign.js','codec.js'].forEach(f => w.eval(fs.readFileSync(path.join(DIR,f),'utf8')));
const C = w.RD_Campaign, CO = w.RD_Codec;

let fail=0, pass=0;
const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};

// A row's simultaneous notes, as semitone intervals above its lowest.
function chordsIn(lvl) {
  const out=[];
  lvl.grid.forEach(row=>{
    const f=row.filter(Boolean).map(c=>c.freq).sort((a,b)=>a-b);
    if(f.length<2) return;
    out.push(f.map(x=>Math.round(12*Math.log2(x/f[0]))));
  });
  return out;
}

console.log('== every area produces chords ==');
let total=0, withChords=0, allIv=[];
for(let a=1;a<=10;a++){
  let areaChords=0;
  for(let i=0;i<15;i++){
    const lvl=C.buildCampaignLevel(a,i);
    const ch=chordsIn(lvl);
    total++; if(ch.length){withChords++;areaChords++;}
    ch.forEach(c=>c.slice(1).forEach(iv=>allIv.push(iv)));
  }
  ok(areaChords>0,'area '+a+' has chords in '+areaChords+'/15 levels');
}
ok(withChords/total>0.8, withChords+' of '+total+' levels contain a chord');

console.log('== no sour intervals ==');
const semis=allIv.map(iv=>((iv%12)+12)%12);
const minor2=semis.filter(x=>x===1).length;
const major2=semis.filter(x=>x===2).length;
const tritone=semis.filter(x=>x===6).length;
ok(minor2===0,'no minor seconds (found '+minor2+' of '+semis.length+')');
ok(major2/semis.length<0.06,'major seconds are rare ('+major2+'/'+semis.length+')');
console.log('  interval mix: '+[0,1,2,3,4,5,6,7,8,9,10,11]
  .map(s=>s+':'+semis.filter(x=>x===s).length).filter(x=>!/:0$/.test(x)).join(' '));

console.log('== chords stack in thirds, not unisons ==');
const uni=semis.filter(x=>x===0).length;
ok(uni/semis.length<0.10,'few unisons ('+uni+'/'+semis.length+') — degrees wrap instead of clamping');
const thirds=semis.filter(x=>x===3||x===4).length;
const fifths=semis.filter(x=>x===7).length;
ok(thirds+fifths>semis.length*0.4,'thirds and fifths dominate ('+(thirds+fifths)+'/'+semis.length+')');

console.log('== three-note chords appear at high difficulty ==');
const size=(a)=>{let n=0;for(let i=0;i<15;i++){
  chordsIn(C.buildCampaignLevel(a,i)).forEach(c=>{if(c.length>=3)n++;});}return n;};
const lowA=size(1), highA=size(9);
ok(highA>lowA,'late areas voice fuller chords ('+lowA+' vs '+highA+' 3-note rows)');

console.log('== still identical every time ==');
const a=C.buildCampaignLevel(6,7), b=C.buildCampaignLevel(6,7);
ok(JSON.stringify(a.grid)===JSON.stringify(b.grid),'same level twice is byte-identical');

console.log('== still round-trips through its own share code ==');
let codeOk=0;
for(let a2=1;a2<=10;a2++)for(let i=0;i<15;i+=3){
  const lvl=C.buildCampaignLevel(a2,i);
  const dec=C.buildCodeLevel(C.codeForCampaign(a2,i));
  if(dec&&JSON.stringify(dec.grid)===JSON.stringify(lvl.grid))codeOk++;
}
ok(codeOk===50,'all 50 sampled campaign levels match their code ('+codeOk+')');

console.log('== density penalty ==');
const mk=(rows,perRow)=>({name:'x',bpm:120,campaign:false,procedural:true,
  grid:Array.from({length:rows},()=>Array.from({length:4},(_,i)=>
    i<perRow?{type:'tap',freq:261.63,sustain:0}:null))});
const full=mk(32,4), dense=mk(32,4);
ok(Math.abs(C.fillOf(mk(32,4))-1)<1e-9,'a solid block reads as 100% full');
ok(Math.abs(C.fillOf(mk(32,2))-0.5)<1e-9,'half full reads as 50%');
ok(C.DENSITY_CAP===0.85,'the cap is 85%');

const under=mk(32,3);                       // 75% — under the cap
ok(C.payableNotes(under)===96,'a 75% chart pays every note ('+C.payableNotes(under)+')');
const over=C.payableNotes(full);            // 128 notes, cap 108.8
ok(Math.abs(over-(108.8+19.2*0.15))<0.01,'a 100% chart pays '+over.toFixed(1)+' of 128');

const xpUnder=C.xpFor(under,{completed:true});
const xpFull =C.xpFor(full ,{completed:true});
ok(xpFull>xpUnder,'more notes still pays more');
ok(xpFull/xpUnder < 128/96,'but not proportionally ('+(xpFull/xpUnder).toFixed(2)+'x for 1.33x the notes)');
const perNote=(xpFull/128)/(xpUnder/96);
ok(perNote<0.9,'per-note value drops past the cap ('+(perNote*100).toFixed(0)+'% of normal)');

console.log('== the penalty never touches generated charts ==');
let maxFill=0, worst='';
for(let a3=1;a3<=10;a3++)for(let i=0;i<15;i++){
  const lvl=C.buildCampaignLevel(a3,i);
  const f=C.fillOf(lvl);
  if(f>maxFill){maxFill=f;worst='area '+a3+' level '+(i+1);}
}
ok(maxFill<C.DENSITY_CAP,'densest campaign chart is '+(maxFill*100).toFixed(1)+'% ('+worst+')');
for(let a4=1;a4<=10;a4++){
  const lvl=C.buildCampaignLevel(a4,14);
  ok(C.payableNotes(lvl)===C.countNotes(lvl),'area '+a4+' pays full');
}

console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);
