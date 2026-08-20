const {chromium}=require('playwright');const path=require('path');
const {chromeExe}=require('./browser');
// APP_DIR lets this suite run against a variant build (e.g. the
// Redesign folder) instead of only the shipping one.
const DIR=process.env.APP_DIR||path.join(__dirname,'..','RhythmDropV7');const EXE=chromeExe();
(async()=>{const b=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:620}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(DIR,'popup.html'),{waitUntil:'load'});
await p.waitForTimeout(1100);
const r=await p.evaluate(async()=>{
  const s=document.getElementById('boot-splash');if(s)s.remove();
  // Build a deliberately oversized non-square source image.
  const c=document.createElement('canvas');c.width=1400;c.height=900;
  const g=c.getContext('2d');
  g.fillStyle='#FB4F7D';g.fillRect(0,0,1400,900);
  g.fillStyle='#12E0C0';g.fillRect(500,250,400,400);
  const big=c.toDataURL('image/png');
  const small=await downscaleToSquare(big, CUSTOM_AV_SIZE);
  const dim=await new Promise(res=>{const i=new Image();i.onload=()=>res([i.width,i.height]);i.src=small;});
  return {bigLen:big.length, smallLen:small.length, dim, price:CUSTOM_AV_PRICE};
});
console.log('source data-URL chars :', r.bigLen.toLocaleString());
console.log('stored data-URL chars :', r.smallLen.toLocaleString(),
            '('+(100-Math.round(r.smallLen/r.bigLen*100))+'% smaller)');
console.log('stored dimensions     :', r.dim.join('x'));
console.log('price constant        :', r.price);
console.log(errs.length?'ERR '+errs.join('|'):'no page errors');
await b.close();})();
