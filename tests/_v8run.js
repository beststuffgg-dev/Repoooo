const {chromium}=require('playwright');const path=require('path');
const {ROOT,launchOpts}=require('./browser');
const APP=path.join(ROOT,'other','RhythmDropV8','popup.html');
(async()=>{
const b=await chromium.launch(launchOpts());
const ctx=await b.newContext({viewport:{width:900,height:800}});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>localStorage.setItem('rd_profile',JSON.stringify({username:'P',coins:0})));
await p.goto('file://'+APP,{waitUntil:'load'}); await p.waitForTimeout(1500);

const r = await p.evaluate(async()=>{
  showScreen('home'); renderHome();
  const out={};
  out.areaChips=document.querySelectorAll('.area-chip').length;
  out.lockedChips=document.querySelectorAll('.area-chip.locked').length;
  out.songRows=document.querySelectorAll('.song-row').length;
  out.lockedRows=document.querySelectorAll('.song-row.locked').length;
  out.firstSong=document.querySelector('.song-name')?.textContent;
  out.firstMeta=document.querySelector('.song-meta')?.textContent;
  out.dailyShown=document.getElementById('daily-card').classList.contains('show');
  out.xp0=document.getElementById('xp-num').textContent;

  // claim the daily
  document.getElementById('daily-card').click();
  out.coinsAfterDaily=profile.coins;
  out.dailyGone=!document.getElementById('daily-card').classList.contains('show');

  // play the first campaign level to completion via the queue
  launchCampaignLevel(1,0);
  document.getElementById('g-overlay').classList.remove('show');
  startGame();
  out.queue=gameQueue.length;
  out.levelName=gameLevel.name;
  out.laneFreqs=gameLevel.laneFreqs.slice(0,2);
  // simulate a clean clear
  notesHit=notesTotal; score=12345;
  endGame(true);
  out.coinsAfterClear=profile.coins;
  out.xpAfter=progress.xp;
  out.cleared=Object.keys(progress.cleared);
  out.ovXp=document.getElementById('ov-xp').textContent;
  out.ovCoins=document.getElementById('ov-currency-reward').textContent;
  out.levelUp=document.getElementById('ov-levelup').style.display;
  showScreen('home'); renderHome();
  out.rowsDone=document.querySelectorAll('.song-row.done').length;
  out.song2Locked=document.querySelectorAll('.song-row')[1].classList.contains('locked');
  out.best=document.querySelectorAll('.song-best')[0].textContent;
  out.xp1=document.getElementById('xp-num').textContent;
  return out;
});
console.log(JSON.stringify(r,null,1));
console.log('errors:',errs.length?errs:'none');
await b.close();})();
