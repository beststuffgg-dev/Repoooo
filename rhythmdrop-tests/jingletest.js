// Each instrument's jingle is a real phrase: several notes, under two
// seconds, and it actually reaches the synth.
const {chromium}=require('playwright');const path=require('path');
const {chromeExe}=require('./browser');
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};
(async()=>{
const b=await chromium.launch({executablePath:chromeExe(),args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:460,height:760}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1300);
await p.evaluate(()=>{const s=document.getElementById('boot-splash');if(s)s.remove();
 localStorage.setItem('rd_tutorial','1');if(!profile.username){profile.username='Player';saveProfile();}
 // The context is lazy — sound one note so it exists to be observed.
 RD_playNoteFreq(261.63,false,0);});
await p.waitForTimeout(200);

console.log('== every instrument has a phrase ==');
const r=await p.evaluate(async()=>{
  const out={};
  for(const inst of RD_INSTRUMENTS){
    const calls=[];
    const real=window._probe=null;
    // Intercept at the synth boundary by wrapping the public entry the
    // jingle uses for each note.
    const len=RD_jingleLength(inst.id);
    out[inst.id]={len};
  }
  return out;});
const lens=Object.entries(r);
ok(lens.length===12,'12 instruments ('+lens.length+')');
ok(lens.every(([,v])=>v.len<=2000),'all under 2s: max '+Math.max(...lens.map(([,v])=>v.len))+'ms');
ok(lens.every(([,v])=>v.len>=1000),'all at least 1s: min '+Math.min(...lens.map(([,v])=>v.len))+'ms');

console.log('== the notes actually reach the synth ==');
const heard=await p.evaluate(async()=>{
  const out={};
  for(const inst of RD_INSTRUMENTS){
    const seen=[];
    const c=RD_getContext();
    const realOsc=c.createOscillator.bind(c);
    c.createOscillator=()=>{const o=realOsc();
      const rs=o.start.bind(o);o.start=(...a)=>{seen.push(o.frequency.value);return rs(...a);};return o;};
    RD_playJingle(inst.id);
    await new Promise(r=>setTimeout(r,2100));
    c.createOscillator=realOsc;
    out[inst.id]=seen.length;
  }
  return out;});
Object.entries(heard).forEach(([id,n])=>ok(n>=4,id+' sounded '+n+' oscillators'));

console.log('== a new jingle cancels the last ==');
const cancel=await p.evaluate(async()=>{
  const c=RD_getContext();let n=0;
  const realOsc=c.createOscillator.bind(c);
  c.createOscillator=()=>{const o=realOsc();const rs=o.start.bind(o);
    o.start=(...a)=>{n++;return rs(...a);};return o;};
  RD_playJingle('organ');            // 4 notes over 700ms
  await new Promise(r=>setTimeout(r,200));
  const before=n;
  RD_stopJingle();
  await new Promise(r=>setTimeout(r,900));
  c.createOscillator=realOsc;
  return {before,after:n};});
ok(cancel.after===cancel.before,'stopping silences the rest ('+cancel.before+' → '+cancel.after+')');

console.log('== the button lights for the length of the phrase ==');
await p.evaluate(()=>{showScreen('settings');buildSettingsPanel();});
await p.waitForTimeout(200);
const lit=await p.evaluate(async()=>{
  const btn=document.querySelector('[data-inst="piano"]');
  if(!btn)return{missing:true};
  btn.click();
  await new Promise(r=>setTimeout(r,120));
  const b2=document.querySelector('[data-inst="piano"]');
  const during=b2.classList.contains('inst-playing');
  await new Promise(r=>setTimeout(r,2400));
  const after=document.querySelector('[data-inst="piano"]').classList.contains('inst-playing');
  return{during,after};});
ok(!lit.missing,'the instrument buttons carry data-inst');
ok(lit.during,'the button lights while it plays');
ok(!lit.after,'and goes out when it ends');

ok(errs.length===0,'no page errors: '+errs.join(' | '));
await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
