// Materials have to be visible, not just declared: a wood theme and a
// steel theme must render measurably different edges and surfaces.
const {chromium}=require('playwright');const path=require('path');
const {chromeExe}=require('./browser');
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};
(async()=>{
const b=await chromium.launch({executablePath:chromeExe(),args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1300);

const read=(theme)=>p.evaluate(async(th)=>{
  // showScreen re-applies the saved theme, so switch after it — doing
  // it first measured the same theme six times.
  showScreen('game');
  document.body.className=document.body.className
    .split(' ').filter(c=>!c.startsWith('theme-')).join(' ');
  if(th)document.body.classList.add('theme-'+th);
  // box-shadow built from calc(var(--mat-spec)) needs a frame to
  // recompute; reading in the same tick returns the old material.
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const cap=document.querySelector('#lane0 .lane-btn');
  const lane=document.getElementById('lane0');
  const before=getComputedStyle(lane,'::before');
  const cs=getComputedStyle(cap);
  const root=getComputedStyle(document.body);
  return {
    bevel:parseFloat(root.getPropertyValue('--mat-bevel')),
    spec:parseFloat(root.getPropertyValue('--mat-spec')),
    grain:root.getPropertyValue('--mat-grain').trim(),
    capBorder:cs.borderTopColor,
    capShadow:cs.boxShadow,
    laneGrain:before.backgroundImage,
  };},theme);

console.log('== every theme declares a full material ==');
const themes=['walnut','bone','amber','vapor','blueprint','mono'];
const got={};
for(const t of themes){got[t]=await read(t);}
themes.forEach(t=>{
  ok(!isNaN(got[t].bevel),t+' bevel='+got[t].bevel);
  ok(!isNaN(got[t].spec), t+' spec='+got[t].spec);
});

console.log('== bevel actually changes the rendered edge ==');
ok(got.walnut.capBorder!==got.amber.capBorder,
  'wood and metal keycaps have different lit edges:\n    wood  '+got.walnut.capBorder+'\n    metal '+got.amber.capBorder);
const distinctBorders=new Set(themes.map(t=>got[t].capBorder)).size;
ok(distinctBorders>=4,'edges differ across themes ('+distinctBorders+' distinct of '+themes.length+')');

console.log('== specular actually changes the rendered highlight ==');
const distinctShadows=new Set(themes.map(t=>got[t].capShadow)).size;
ok(distinctShadows>=4,'keycap highlights differ ('+distinctShadows+' distinct)');

console.log('== grain reaches the lane floor ==');
ok(/repeating-linear-gradient/.test(got.walnut.laneGrain),'wood grain is painted in the lane');
ok(got.walnut.laneGrain!==got.amber.laneGrain,'and metal does not get the wood grain');

ok(errs.length===0,'no page errors: '+errs.join(' | '));
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
