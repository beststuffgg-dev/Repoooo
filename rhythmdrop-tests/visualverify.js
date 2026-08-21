// Does what is drawn match what the code actually judges?
// Every probe compares a rendered pixel position against the number
// the engine uses, rather than trusting either on its own.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
// Which Chromium to launch and which build to point at both live in
// browser.js, so APP_DIR and PW_CHROME mean the same thing in every
// suite instead of being re-derived per file.
const {launchOpts,appDir}=require('./browser');
const LAUNCH=launchOpts();
const DIR=appDir();
let fail=0,pass=0;
const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};

const SIZES=[[420,640],[360,520],[390,844],[412,915],[700,900],[320,480]];

(async()=>{
const b=await chromium.launch(LAUNCH);

console.log('== the judged line sits exactly on the strike bar, at every size ==');
for(const [w,h] of SIZES){
  const ctx=await b.newContext({viewport:{width:w,height:h}});
  const p=await ctx.newPage();
  await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
  await p.waitForTimeout(1200);
  const r=await p.evaluate(async()=>{
    const s=document.getElementById('boot-splash');if(s)s.remove();
    localStorage.setItem('rd_tutorial','1');
    if(!profile.username){profile.username='P';saveProfile();}
    currentSettings.lives=999; currentSettings.showHitZone=true; applySettingsToDOM();
    const lvl={id:'d',name:'D',bpm:60,campaign:false,
      grid:Array.from({length:30},()=>[{type:'tap',freq:261.63,sustain:0},null,null,null])};
    launchLevel(lvl);
    document.getElementById('g-overlay').classList.remove('show');
    startGame(buildQueue(lvl));
    await new Promise(r=>setTimeout(r,900));
    const lane=document.getElementById('lane0');
    const lr=lane.getBoundingClientRect();
    // Padding-box origin: the coordinate space tiles are laid out in.
    const padTop = lr.top + lane.clientTop;
    const bar=lane.querySelector('.lane-hitbar').getBoundingClientRect();
    const zone=lane.querySelector('.lane-hitzone').getBoundingClientRect();
    return {
      judge: hitY(),
      barCenter: (bar.top+bar.bottom)/2 - padTop,
      tol: hitTol(),
      zoneH: zone.height,
      zoneBottom: zone.bottom - padTop,
      laneH: laneH(), clientH: lane.clientHeight,
      beatMs: currentBeatMs,
    };
  });
  const drift = r.judge - r.barCenter;
  const windowMs = r.tol / (r.laneH/(r.beatMs*4));
  ok(Math.abs(drift)<=1.5, `${w}x${h}: judge line on the bar (drift ${drift.toFixed(2)}px)`);
  ok(Math.abs(r.laneH-r.clientH)<0.5, `${w}x${h}: cached height matches live padding box`);
  ok(Math.abs(r.zoneH-r.tol)<1.5, `${w}x${h}: drawn window = judged window (${r.zoneH.toFixed(1)} vs ${r.tol.toFixed(1)})`);
  ok(Math.abs(r.zoneBottom-r.judge)<1.5, `${w}x${h}: window sits on the strike line`);
  console.log(`   ${w}x${h}  laneH=${r.laneH.toFixed(0)}  tol=${r.tol.toFixed(1)}px = ${windowMs.toFixed(0)}ms`);
  await ctx.close();
}

console.log('== the window is the same duration on every screen ==');
{
  const wins=[];
  for(const [w,h] of SIZES){
    const ctx=await b.newContext({viewport:{width:w,height:h}});
    const p=await ctx.newPage();
    await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
    await p.waitForTimeout(1200);
    const r=await p.evaluate(async()=>{
      const s=document.getElementById('boot-splash');if(s)s.remove();
      localStorage.setItem('rd_tutorial','1');
      if(!profile.username){profile.username='P';saveProfile();}
      currentSettings.lives=999; applySettingsToDOM();
      const lvl={id:'d',name:'D',bpm:120,campaign:false,
        grid:Array.from({length:30},()=>[{type:'tap',freq:261.63,sustain:0},null,null,null])};
      launchLevel(lvl);
      document.getElementById('g-overlay').classList.remove('show');
      startGame(buildQueue(lvl));
      await new Promise(r=>setTimeout(r,900));
      return {tol:hitTol(), laneH:laneH(), beatMs:currentBeatMs};
    });
    wins.push(r.tol/(r.laneH/(r.beatMs*4)));
    await ctx.close();
  }
  const spread = Math.max(...wins)-Math.min(...wins);
  ok(spread<3, `all sizes within 3ms of each other (spread ${spread.toFixed(1)}ms, ~${wins[0].toFixed(0)}ms)`);
}

console.log('== a PERFECT hit really is visually on the line ==');
{
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();
  await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
  await p.waitForTimeout(1200);
  const r=await p.evaluate(async()=>{
    const s=document.getElementById('boot-splash');if(s)s.remove();
    localStorage.setItem('rd_tutorial','1');
    if(!profile.username){profile.username='P';saveProfile();}
    currentSettings.lives=999; applySettingsToDOM();
    const lvl={id:'d',name:'D',bpm:60,campaign:false,
      grid:Array.from({length:40},()=>[{type:'tap',freq:261.63,sustain:0},null,null,null])};
    launchLevel(lvl);
    document.getElementById('g-overlay').classList.remove('show');
    startGame(buildQueue(lvl));
    // Wait until a tile's centre is within the PERFECT band (<20% of
    // the window), then fire the tap and record where it was drawn.
    for(let i=0;i<600;i++){
      const t=activeTiles.find(t=>t.lane===0&&!t.done);
      if(t){
        const c=t.y+(t.h||38)/2;
        if(Math.abs(c-hitY()) < hitTol()*0.2){
          const lane=document.getElementById('lane0');
          const padTop=lane.getBoundingClientRect().top+lane.clientTop;
          const tileRect=t.el.getBoundingClientRect();
          const drawnCentre=(tileRect.top+tileRect.bottom)/2-padTop;
          const bar=lane.querySelector('.lane-hitbar').getBoundingClientRect();
          const barCentre=(bar.top+bar.bottom)/2-padTop;
          const before=score;
          tapLane(0);
          await new Promise(r=>setTimeout(r,30));
          return {drawnCentre, barCentre, modelCentre:c, scored:score-before,
                  fb:document.getElementById('fb0').textContent};
        }
      }
      await new Promise(r=>requestAnimationFrame(r));
    }
    return {timeout:true};
  });
  ok(!r.timeout,'found a tile inside the perfect band');
  if(!r.timeout){
    ok(Math.abs(r.drawnCentre-r.modelCentre)<1.5,
      `the tile the engine judges is where it is drawn (drawn ${r.drawnCentre.toFixed(1)} vs model ${r.modelCentre.toFixed(1)})`);
    ok(Math.abs(r.drawnCentre-r.barCentre)<20,
      `and it is visually on the bar when PERFECT (${Math.abs(r.drawnCentre-r.barCentre).toFixed(1)}px off)`);
    ok(r.fb==='PERFECT', `it scored PERFECT (got "${r.fb}", +${r.scored})`);
  }
  await ctx.close();
}

console.log('== resizing mid-song re-aligns everything ==');
{
  const ctx=await b.newContext({viewport:{width:420,height:640}});
  const p=await ctx.newPage();
  await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
  await p.waitForTimeout(1200);
  await p.evaluate(async()=>{
    const s=document.getElementById('boot-splash');if(s)s.remove();
    localStorage.setItem('rd_tutorial','1');
    if(!profile.username){profile.username='P';saveProfile();}
    currentSettings.lives=999; currentSettings.showHitZone=true; applySettingsToDOM();
    const lvl={id:'d',name:'D',bpm:60,campaign:false,
      grid:Array.from({length:60},()=>[{type:'tap',freq:261.63,sustain:0},null,null,null])};
    launchLevel(lvl);
    document.getElementById('g-overlay').classList.remove('show');
    startGame(buildQueue(lvl));
    await new Promise(r=>setTimeout(r,600));
  });
  const before=await p.evaluate(()=>({laneH:laneH(),tol:hitTol()}));
  await p.setViewportSize({width:412,height:915});
  await p.waitForTimeout(500);
  const after=await p.evaluate(()=>{
    const lane=document.getElementById('lane0');
    const padTop=lane.getBoundingClientRect().top+lane.clientTop;
    const bar=lane.querySelector('.lane-hitbar').getBoundingClientRect();
    return {laneH:laneH(), clientH:lane.clientHeight, tol:hitTol(),
            judge:hitY(), barCentre:(bar.top+bar.bottom)/2-padTop};
  });
  ok(after.laneH>before.laneH, `lane grew with the window (${before.laneH.toFixed(0)} -> ${after.laneH.toFixed(0)})`);
  ok(Math.abs(after.laneH-after.clientH)<0.5,'cache followed the live size');
  ok(Math.abs(after.judge-after.barCentre)<1.5,
    `judge line still on the bar after resize (drift ${(after.judge-after.barCentre).toFixed(2)}px)`);
  ok(after.tol>before.tol, `window widened with the taller lane (${before.tol.toFixed(1)} -> ${after.tol.toFixed(1)}px)`);
  await ctx.close();
}

console.log('== the Width/Height settings actually resize the app ==');
{
  const ctx=await b.newContext({viewport:{width:900,height:1000}});
  const p=await ctx.newPage();
  await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
  await p.waitForTimeout(1200);
  const r=await p.evaluate(async()=>{
    const s=document.getElementById('boot-splash');if(s)s.remove();
    localStorage.setItem('rd_tutorial','1');
    if(!profile.username){profile.username='P';saveProfile();}
    // Width/Height deliberately only apply in a real extension popup —
    // applying them to a served page strands the app in a corner of a
    // much bigger viewport. Stub the protocol check so the popup path
    // is exercised here.
    window.isExtensionPopup = () => true;
    document.documentElement.classList.add('as-popup');
    currentSettings.width=420; currentSettings.height=640; applySettingsToDOM();
    await new Promise(r=>requestAnimationFrame(r));
    const small={w:document.documentElement.getBoundingClientRect().width,
                 h:document.documentElement.getBoundingClientRect().height};
    currentSettings.width=640; currentSettings.height=880; applySettingsToDOM();
    await new Promise(r=>requestAnimationFrame(r));
    const big={w:document.documentElement.getBoundingClientRect().width,
               h:document.documentElement.getBoundingClientRect().height};
    return {small,big};
  });
  ok(Math.abs(r.small.w-420)<2 && Math.abs(r.small.h-640)<2,
    `420x640 setting renders 420x640 (got ${r.small.w.toFixed(0)}x${r.small.h.toFixed(0)})`);
  ok(Math.abs(r.big.w-640)<2 && Math.abs(r.big.h-880)<2,
    `640x880 setting renders 640x880 (got ${r.big.w.toFixed(0)}x${r.big.h.toFixed(0)})`);
  await ctx.close();
}

await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);
})();
