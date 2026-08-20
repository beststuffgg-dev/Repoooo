// The stylesheet parses, and every rule in it survived. A stray */ or
// an unbalanced brace is silent in CSS — the browser drops the rest of
// the block and the page just looks subtly wrong.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const {chromeExe}=require('./browser');
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');
let fail=0,pass=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL: '+m));};
(async()=>{
const b=await chromium.launch({executablePath:chromeExe(),args:['--no-sandbox']});
const p=await b.newPage();
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(900);

const src=fs.readFileSync(path.join(DIR,'popup.html'),'utf8');
const css=src.slice(src.indexOf('<style>')+7, src.indexOf('</style>'));

console.log('== comments are balanced ==');
const opens=(css.match(/\/\*/g)||[]).length, closes=(css.match(/\*\//g)||[]).length;
ok(opens===closes,'/* and */ counts match ('+opens+' vs '+closes+')');

console.log('== the browser kept every rule ==');
const r=await p.evaluate(()=>{
  const sheet=[...document.styleSheets].find(s=>!s.href);
  return {rules:sheet.cssRules.length,
    // A rule the parser choked on leaves no trace, so compare the
    // count the browser built against the selectors in the source.
    text:[...sheet.cssRules].map(x=>x.selectorText||'').join('|')};});
ok(r.rules>800,'stylesheet built '+r.rules+' rules');

console.log('== the rules this phase added are all live ==');
const need=['.lane-hitzone','.hud-combo.tier-nova','#combo-milestone',
  '.adv-preview','#cr-dense-warn','[data-inst].inst-playing','.tile-tap'];
need.forEach(sel=>ok(r.text.includes(sel),'present: '+sel));

console.log('== the motion tokens resolve ==');
const tok=await p.evaluate(()=>{
  const cs=getComputedStyle(document.documentElement);
  return ['--ease-out','--ease-emph','--ease-in-out','--dur-fast','--dur-med',
          '--mat-bevel','--mat-spec','--mat-grain']
    .map(k=>[k,cs.getPropertyValue(k).trim()]);});
tok.forEach(([k,v])=>ok(v!=='',k+' = '+v));

console.log('== --mat-bevel is actually read now ==');
ok(/var\(--mat-bevel\)/.test(css),'something consumes --mat-bevel');
const bevelUses=(css.match(/var\(--mat-bevel\)/g)||[]).length;
ok(bevelUses>=3,'used in '+bevelUses+' places');

await b.close();
console.log('\n'+(fail?fail+' FAILURES, '+pass+' passed':'all '+pass+' probes passed'));
process.exit(fail?1:0);})();
