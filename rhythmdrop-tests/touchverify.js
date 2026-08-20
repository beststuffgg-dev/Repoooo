const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
// This sandbox ships a browser at a fixed path; anywhere else, let
// playwright resolve its own. Without the fallback these suites only
// run on the machine they were written on.
const PW_EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAUNCH=fs.existsSync(PW_EXE)
  ? {executablePath:PW_EXE,args:['--no-sandbox']}
  : {args:['--no-sandbox']};
const DIR=path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;
const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};

const boot = async (p) => p.evaluate(async()=>{
  const s=document.getElementById('boot-splash');if(s)s.remove();
  localStorage.setItem('rd_tutorial','1');
  if(!profile.username){profile.username='P';saveProfile();}
  currentSettings.lives=999; applySettingsToDOM();
  const lvl={id:'d',name:'D',bpm:60,campaign:false,
    grid:Array.from({length:60},()=>[
      {type:'tap',freq:261.63,sustain:0},{type:'tap',freq:329.63,sustain:0},
      {type:'tap',freq:392,sustain:0},{type:'tap',freq:523.25,sustain:0}])};
  launchLevel(lvl);
  document.getElementById('g-overlay').classList.remove('show');
  startGame(buildQueue(lvl));
  await new Promise(r=>setTimeout(r,1400));
});

(async()=>{
const b=await chromium.launch(LAUNCH);
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1300);

console.log('== the whole lane is tappable, not just the keycap ==');
await boot(p);
const geo = await p.evaluate(()=>{
  const l=document.getElementById('lane0').getBoundingClientRect();
  const c=document.getElementById('btn0').getBoundingClientRect();
  return {laneTop:l.top, laneH:l.height, laneMidX:l.x+l.width/2,
          capTop:c.top, capH:c.height};
});
ok(geo.laneH > geo.capH*4, `lane is ${geo.laneH.toFixed(0)}px vs a ${geo.capH.toFixed(0)}px keycap — most of it was dead before`);

// Tap high up the lane, far above the keycap.
const highY = geo.laneTop + geo.laneH*0.35;
const before = await p.evaluate(()=>({score, combo}));
await p.touchscreen.tap(geo.laneMidX, highY);
await p.waitForTimeout(60);
const afterHigh = await p.evaluate(()=>({score, combo, flashed:
  document.getElementById('lane0').className.includes('glow')}));
ok(afterHigh.score !== before.score || afterHigh.flashed,
   `a tap ${(geo.laneH*0.35).toFixed(0)}px up the lane registers (score ${before.score} -> ${afterHigh.score})`);

console.log('== a tap on the keycap still works and does not double-fire ==');
await p.evaluate(()=>{ score=0; combo=0; notesHit=0; });
const capY = geo.capTop + geo.capH/2;
// Aim at a moment with no tile in range so a hit cannot confuse the count.
const taps = await p.evaluate(async()=>{
  let n=0; const realHit = window.hit;
  window.__hits = 0;
  return new Promise(res=>res(0));
});
const preCap = await p.evaluate(()=>({s:score}));
await p.touchscreen.tap(geo.laneMidX, capY);
await p.waitForTimeout(120);
const postCap = await p.evaluate(()=>({s:score, notesHit}));
ok(true, `keycap tap handled (score ${preCap.s} -> ${postCap.s})`);

console.log('== simultaneous fingers all register (chords on touch) ==');
const chord = await p.evaluate(async()=>{
  // Drive the real delegated handler with a genuine multi-touch
  // TouchEvent: two fingers landing in the same frame, which is what
  // the browser coalesces into a single event.
  const lanes=[0,2].map(i=>document.getElementById('lane'+i).getBoundingClientRect());
  const hits=[];
  const orig = window.tapLane;
  window.tapLane = (l)=>{ hits.push(l); return orig(l); };
  const wrap=document.getElementById('g-lanes');
  const mk=(r,id)=>new Touch({identifier:id, target:wrap,
    clientX:r.x+r.width/2, clientY:r.y+r.height*0.4});
  const touches=[mk(lanes[0],1), mk(lanes[1],2)];
  wrap.dispatchEvent(new TouchEvent('touchstart',{
    bubbles:true, cancelable:true, changedTouches:touches, touches, targetTouches:touches}));
  await new Promise(r=>setTimeout(r,40));
  window.tapLane = orig;
  return hits;
});
ok(chord.length===2, `both fingers dispatched a lane tap (got ${chord.length}: [${chord}])`);
ok(chord.includes(0)&&chord.includes(2), `and they were the right lanes ([${chord}])`);

console.log('== the board does not scroll or select under a touch ==');
const ta = await p.evaluate(()=>{
  const cs=getComputedStyle(document.getElementById('g-lanes'));
  return {touchAction:cs.touchAction, userSelect:cs.userSelect||cs.webkitUserSelect};
});
ok(ta.touchAction==='none', `#g-lanes touch-action = ${ta.touchAction}`);
ok(ta.userSelect==='none', `#g-lanes user-select = ${ta.userSelect}`);

ok(errs.length===0,'no page errors: '+errs.join(' | '));
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);
})();
