const {chromium}=require('playwright');const path=require('path');
const {chromeExe}=require('./browser');
const EXE=chromeExe();
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};
(async()=>{const b=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1500);
await p.evaluate(()=>{const s=document.getElementById('boot-splash');if(s)s.remove();
 localStorage.setItem('rd_tutorial','1');
 if(!profile.username){profile.username='Player';saveProfile();}
 showScreen('home');renderHome();});

console.log('== the loading bar tracks real work ==');
const load=await p.evaluate(async()=>{
  const lvl=RD_Campaign.buildCampaignLevel(5,9);
  const q=buildQueue(lvl);
  const seen=[]; const widths=[];
  const bar=document.getElementById('load-bar-fill');
  const step=document.getElementById('load-step');
  // Steps can finish inside a single frame, so observe every mutation
  // rather than sampling on a timer and missing the fast ones.
  const mo=new MutationObserver(()=>{
    if(step.textContent)seen.push(step.textContent);
    widths.push(parseFloat(bar.style.width)||0);
  });
  mo.observe(step,{childList:true,characterData:true,subtree:true});
  mo.observe(bar,{attributes:true,attributeFilter:['style']});
  await new Promise(res=>RD_Loading.run(lvl,q,{onReady:res}));
  mo.disconnect();
  return {labels:[...new Set(seen)],widths,
    pool:(window.RD_TILE_POOL||[]).length,notes:q.length,
    finalWidth:parseFloat(bar.style.width)||0};});
ok(load.labels.length>=5,'bar reported '+load.labels.length+' distinct steps');
ok(load.labels.includes('Building the voices'),'names the voice build');
ok(load.labels.includes('Preparing tiles'),'names the tile pool');
ok(load.labels[load.labels.length-1]==='Ready','ends on Ready: '+load.labels.join(' > '));
const mono=load.widths.every((w,i)=>i===0||w>=load.widths[i-1]);
ok(mono,'progress only ever increases');
ok(load.finalWidth===100,'reaches 100% (got '+load.finalWidth+')');
console.log('  steps: '+load.labels.join(' > '));

console.log('== the pool is sized to the chart ==');
ok(load.pool>=64,'pool at least the old floor (got '+load.pool+' for '+load.notes+' notes)');
const pools=await p.evaluate(async()=>{
  const sparse=buildQueue(RD_Campaign.buildCampaignLevel(1,0));
  const dense =buildQueue(RD_Campaign.buildCampaignLevel(10,14));
  return {sparse:sparse.length,dense:dense.length};});
ok(pools.dense>pools.sparse,'a late chart really is denser ('+pools.sparse+' vs '+pools.dense+' notes)');

console.log('== count-in is clock-derived and never repeats ==');
const ci=await p.evaluate(async()=>{
  const num=document.getElementById('count-num');
  const seq=[]; const times=[];
  const t0=performance.now();
  const obs=setInterval(()=>{
    const v=num.textContent;
    if(v&&(seq.length===0||seq[seq.length-1]!==v)){seq.push(v);times.push(performance.now()-t0);}
  },8);
  await RD_Loading.runCountIn(120);          // 500ms a beat
  clearInterval(obs);
  return {seq,times,total:performance.now()-t0};});
ok(ci.seq.join(',')==='3,2,1','counts down exactly 3,2,1 (got '+ci.seq.join(',')+')');
ok(new Set(ci.seq).size===ci.seq.length,'no number appears twice');
const gaps=ci.times.slice(1).map((t,i)=>Math.round(t-ci.times[i]));
ok(gaps.every(g=>Math.abs(g-500)<90),'each number holds ~one beat: '+gaps.join('ms, ')+'ms');
ok(Math.abs(ci.total-1500)<220,'whole count-in is ~3 beats ('+Math.round(ci.total)+'ms)');

console.log('== it is time-based, not frame-based ==');
const src=require('fs').readFileSync(path.join(DIR,'loading.js'),'utf8');
const fn=src.slice(src.indexOf('function runCountIn'),src.indexOf('function runCountIn')+1600);
ok(/performance\.now\(\)/.test(fn),'count-in reads the wall clock');
ok(/Math\.floor\(elapsed \/ beat\)/.test(fn),'the number is derived from elapsed time');
ok(!/setTimeout\(tick/.test(fn),'no chained setTimeout driving the count');

console.log('== faster tempo, shorter count ==');
const fast=await p.evaluate(async()=>{
  const t0=performance.now();
  await RD_Loading.runCountIn(200);          // 300ms a beat (clamped)
  return performance.now()-t0;});
ok(fast<1200,'200 BPM counts in faster than 120 ('+Math.round(fast)+'ms)');

ok(errs.length===0,'no page errors: '+errs.join(' | '));
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
