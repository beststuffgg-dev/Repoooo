const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const DIR = v8Dir();
const APP = path.join(DIR, 'popup.html');
const SRC = ['voices.js', 'audio.js', 'studio-dsp.js'].map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const FIXTURE = () => {
  window.makeFixture = async (src, inst, spec) => {
    const SR = 22050;
    const off = new OfflineAudioContext(1, Math.ceil(SR * spec.seconds), SR);
    window.AudioContext = function () { return off; };
    (0, eval)('(function(){' + src + '\n})()');
    const f = m => 440 * Math.pow(2, (m - 69) / 12);
    spec.events.forEach(e => e.notes.forEach(m => window.RD_noteOn(f(m), { inst, vel: 0.6, when: e.t, dur: e.dur || 0.5 })));
    const buf = await off.startRendering();
    const x = buf.getChannelData(0);
    const wav = new Uint8Array(44 + x.length * 2);
    const dv = new DataView(wav.buffer);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + x.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, SR, true);
    dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
    return Array.from(wav);
  };
};

const melody = [60, 62, 64, 67, 72, 69, 65, 60, 76, 71, 62, 79, 55, 83, 59, 64];
const chords = [[60, 64, 67], [62, 65, 69], [55, 59, 62], [65, 69, 72], [72, 76, 79]];
function spec(bpm) {
  const beat = 60 / bpm;
  const events = [];
  melody.forEach((m, i) => events.push({ t: 0.5 + i * beat, notes: [m] }));
  chords.forEach((c, i) => events.push({ t: 0.5 + (16 + i * 2) * beat, notes: c }));
  return { seconds: 0.5 + (16 + chords.length * 2) * beat + 1.5, events, beat };
}

(async () => {
  const b = await chromium.launch(launchOpts());

  console.log('== note starts, from music made with the game\'s own voices ==');
  const pageA = await b.newPage();
  const errors = [];
  pageA.on('pageerror', e => errors.push(e.message));
  await pageA.addInitScript(FIXTURE);
  await pageA.goto('about:blank');
  await pageA.evaluate(() => { const mem = {}; Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } } }); });
  const sp = spec(100);
  const stats = {};
  for (const inst of ['piano', 'flute', 'violin', 'trumpet', 'harp', 'cello']) {
    const r = await pageA.evaluate(async ([src, inst, sp]) => {
      await window.makeFixture(src, inst, sp);
      return null;
    }, [SRC, inst, sp]).catch(() => null);
    const out = await pageA.evaluate(async ([src, inst, sp]) => {
      const SR = 22050;
      const off = new OfflineAudioContext(1, Math.ceil(SR * sp.seconds), SR);
      window.AudioContext = function () { return off; };
      (0, eval)('(function(){' + src + '\n})()');
      const f = m => 440 * Math.pow(2, (m - 69) / 12);
      sp.events.forEach(e => e.notes.forEach(m => window.RD_noteOn(f(m), { inst, vel: 0.6, when: e.t, dur: 0.5 })));
      const buf = await off.startRendering();
      const D = window.RD_StudioDSP;
      const x = D.toMono(buf);
      const curve = await D.onsetCurve(x, SR);
      const ons = D.pickOnsets(curve);
      const used = new Set(), errs = [];
      let tp = 0;
      sp.events.forEach(e => {
        let bi = -1, bd = 1;
        ons.forEach((o, i) => { const d = Math.abs(o.t - e.t); if (d < bd && !used.has(i)) { bd = d; bi = i; } });
        if (bi >= 0 && bd < 0.05) { tp++; used.add(bi); errs.push(Math.abs(ons[bi].t - e.t)); }
      });
      let single = 0, singles = 0, chordHit = 0, chordTruth = 0, extra = 0;
      sp.events.forEach(e => {
        const det = D.pitchesAt(x, SR, e.t, { maxNotes: 3, len: 0.3 }).map(n => n.midi);
        if (e.notes.length === 1) { singles++; if (det.includes(e.notes[0]) && det.length === 1) single++; }
        else { chordTruth += e.notes.length; chordHit += e.notes.filter(m => det.includes(m)).length; }
        extra += det.filter(m => !e.notes.includes(m)).length;
      });
      return { events: sp.events.length, onsets: ons.length, tp, meanErr: errs.reduce((a, b) => a + b, 0) / Math.max(1, errs.length),
               singles, single, chordTruth, chordHit, extra };
    }, [SRC, inst, sp]);
    stats[inst] = out;
    notes.push(`${inst.padEnd(8)} onsets ${out.tp}/${out.events} (+${out.onsets - out.tp} extra, mean error ${(out.meanErr * 1000).toFixed(1)} ms) · single notes ${out.single}/${out.singles} · chord notes ${out.chordHit}/${out.chordTruth} · wrong notes ${out.extra}`);
    ok(out.tp / out.events >= 0.9, inst + ': finds at least 90% of the note starts (' + out.tp + '/' + out.events + ')');
    ok(out.meanErr < 0.02, inst + ': and places them within 20 ms (' + (out.meanErr * 1000).toFixed(1) + ' ms)');
    ok(out.single / out.singles >= 0.85, inst + ': names at least 85% of single notes exactly (' + out.single + '/' + out.singles + ')');
    ok(out.chordHit / out.chordTruth >= 0.7, inst + ': finds at least 70% of the notes inside chords (' + out.chordHit + '/' + out.chordTruth + ')');
    ok(out.extra <= 4, inst + ': rarely invents notes (' + out.extra + ' wrong)');
  }

  console.log('== tempo ==');
  for (const bpm of [90, 120, 150]) {
    const beat = 60 / bpm;
    const events = Array.from({ length: 48 }, (_, i) => ({ t: 0.3 + i * beat, notes: [[60, 64, 67, 72][i % 4]], dur: beat * 0.7 }));
    const r = await pageA.evaluate(async ([src, events, secs]) => {
      const SR = 22050;
      const off = new OfflineAudioContext(1, Math.ceil(SR * secs), SR);
      window.AudioContext = function () { return off; };
      (0, eval)('(function(){' + src + '\n})()');
      const f = m => 440 * Math.pow(2, (m - 69) / 12);
      events.forEach(e => window.RD_noteOn(f(e.notes[0]), { inst: 'piano', vel: 0.6, when: e.t, dur: e.dur }));
      const buf = await off.startRendering();
      const D = window.RD_StudioDSP;
      const x = D.toMono(buf);
      const curve = await D.onsetCurve(x, SR);
      const ons = D.pickOnsets(curve);
      return D.estimateTempo(curve, ons);
    }, [SRC, events, 0.3 + 48 * beat + 1]);
    const beatSec = 60 / bpm;
    const off = ((r.offset - 0.3) % beatSec + beatSec) % beatSec;
    const offErr = Math.min(off, beatSec - off);
    notes.push(`${bpm} BPM -> ${r.bpm} (offset error ${(offErr * 1000).toFixed(0)} ms)`);
    ok(Math.abs(r.bpm - bpm) / bpm < 0.02, bpm + ' BPM is found within 2% (' + r.bpm + ')');
    ok(offErr < 0.04, 'and the first beat within 40 ms (' + (offErr * 1000).toFixed(0) + ' ms)');
  }
  await pageA.close();

  console.log('== the Studio screen, end to end ==');
  const wavBytes = await (async () => {
    const p = await b.newPage();
    await p.addInitScript(FIXTURE);
    await p.goto('about:blank');
    await p.evaluate(() => { const mem = {}; Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } } }); });
    const bytes = await p.evaluate(([src, inst, sp]) => window.makeFixture(src, inst, sp), [SRC, 'piano', spec(100)]);
    await p.close();
    return Buffer.from(bytes);
  })();
  const truth = spec(100);

  const ctx = await b.newContext({ viewport: { width: 900, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.addInitScript(() => {
    localStorage.setItem('rd_tutorial', '1');
    localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 }));
  });
  await page.goto('file://' + APP, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { const s = document.getElementById('boot-splash'); if (s) s.remove(); showScreen('home'); selectHomeTab('custom'); });

  {
    const r = await page.evaluate(() => ({ btn: !!document.getElementById('studio-btn'), text: (document.getElementById('studio-btn') || {}).textContent }));
    ok(r.btn && /Song Studio/.test(r.text), 'the Custom tab has a Song Studio button');
    await page.click('#studio-btn');
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => ({ on: document.getElementById('studio').classList.contains('active'), main: document.getElementById('st-main').hidden, w: document.documentElement.offsetWidth }));
    ok(s.on && s.main, 'it opens the Studio, with nothing loaded yet');
    ok(s.w === 420, 'the window keeps its width (' + s.w + 'px)');
  }

  await page.setInputFiles('#st-file', { name: 'My Song.wav', mimeType: 'audio/wav', buffer: wavBytes });
  await page.waitForFunction(() => /note starts found/.test(document.getElementById('st-status').textContent), null, { timeout: 30000 });
  {
    const r = await page.evaluate(() => ({
      main: !document.getElementById('st-main').hidden, status: document.getElementById('st-status').textContent,
      dur: RD_Studio.state.dur, onsets: RD_Studio.state.onsets.length, bpm: RD_Studio.state.bpm, name: RD_Studio.state.name,
      bpmInput: document.getElementById('st-bpm').value, make: document.getElementById('st-make').disabled,
    }));
    ok(r.main, 'choosing a file shows the waveform and the controls');
    ok(Math.abs(r.dur - truth.seconds) < 0.2 && r.name === 'My Song', 'the file is decoded (' + r.dur.toFixed(1) + 's, "' + r.name + '")');
    ok(r.onsets >= 18, 'its note starts are found (' + r.onsets + ')');
    ok(r.make, 'Make level stays disabled until there is a tap');
    notes.push('studio: ' + r.status);
  }

  console.log('== speeds keep the pitch ==');
  {
    const r = await page.evaluate(() => {
      const out = {};
      const btns = [...document.querySelectorAll('#st-speeds button')];
      out.labels = btns.map(b => b.textContent);
      out.rates = [];
      btns.forEach(b => { b.click(); out.rates.push(RD_Studio.audio.playbackRate); });
      out.preserve = RD_Studio.audio.preservesPitch;
      out.on = btns.filter(b => b.classList.contains('on')).map(b => b.textContent);
      btns[3].click();
      return out;
    });
    ok(r.labels.join() === '0.25×,0.5×,0.75×,1×,1.25×', 'five speeds: ' + r.labels.join(' '));
    ok(r.rates.join() === '0.25,0.5,0.75,1,1.25', 'each one sets the playback rate');
    ok(r.preserve === true, 'with the pitch preserved');
    ok(r.on.join() === '1.25×', 'and the chosen one is marked');
  }

  console.log('== tapping, at half speed ==');
  {
    await page.evaluate(() => { document.getElementById('st-lat').value = 0; document.getElementById('st-lat').dispatchEvent(new Event('input')); RD_Studio.setRate(0.5); });
    await page.click('#st-play');
    await page.waitForTimeout(600);
    const playing = await page.evaluate(() => !RD_Studio.audio.paused);
    ok(playing, 'the song plays');
    const times = [];
    for (let i = 0; i < 3; i++) {
      times.push(await page.evaluate(() => { RD_Studio.tapDown(); const t = RD_Studio.state.taps[RD_Studio.state.taps.length - 1].raw; RD_Studio.tapUp(); return { t, perf: performance.now(), audio: RD_Studio.audio.currentTime }; }));
      await page.waitForTimeout(700);
    }
    const dm1 = times[1].t - times[0].t, dr1 = times[1].perf - times[0].perf;
    const ratio = dm1 / (dr1 / 1000);
    notes.push('half speed: media advanced ' + dm1.toFixed(3) + ' s over ' + (dr1 / 1000).toFixed(3) + ' s of real time (x' + ratio.toFixed(2) + ')');
    ok(ratio > 0.4 && ratio < 0.6, 'taps are stamped in song time, so slowing down makes them land where the music is (x' + ratio.toFixed(2) + ')');
    ok(Math.abs(times[2].t - times[2].audio) < 0.06, 'and the stamp agrees with the player\'s own clock (' + Math.abs(times[2].t - times[2].audio).toFixed(3) + ' s)');
    await page.click('#st-play');
    await page.evaluate(() => { RD_Studio.state.taps = []; RD_Studio.setRate(1); });
  }

  console.log('== snapping and notes ==');
  {
    const r = await page.evaluate(([truthEvents]) => {
      RD_Studio.state.taps = [];
      RD_Studio.state.snap = true;
      const out = [];
      truthEvents.slice(0, 8).forEach((e, i) => {
        const jitter = ((i % 3) - 1) * 0.045;
        const tap = RD_Studio.addTap(e.t + jitter);
        out.push({ truth: e.t, raw: tap.raw, t: tap.t, notes: tap.notes.map(n => n.midi), want: e.notes });
      });
      return out;
    }, [truth.events]);
    const snapErr = r.map(x => Math.abs(x.t - x.truth));
    const rawErr = r.map(x => Math.abs(x.raw - x.truth));
    notes.push('taps off by up to 45 ms: raw mean ' + (rawErr.reduce((a, b) => a + b) / r.length * 1000).toFixed(0) + ' ms, snapped mean ' + (snapErr.reduce((a, b) => a + b) / r.length * 1000).toFixed(0) + ' ms');
    ok(snapErr.every(e => e < 0.025), 'snapping moves every jittered tap onto its note start (worst ' + (Math.max(...snapErr) * 1000).toFixed(0) + ' ms)');
    ok(r.filter(x => x.notes.length === 1 && x.notes[0] === x.want[0]).length >= 7, 'and each tap is given the right note (' + r.filter(x => x.notes[0] === x.want[0]).length + '/8)');
    const list = await page.evaluate(() => ({ items: document.querySelectorAll('#st-list .st-item').length, count: document.getElementById('st-count').textContent, make: document.getElementById('st-make').disabled }));
    ok(list.items === 8 && list.count === '8 taps' && !list.make, 'the list shows them, and Make level wakes up');
    await page.evaluate(() => { RD_Studio.state.snap = false; });
    const raw = await page.evaluate(([e]) => { const tap = RD_Studio.addTap(e.t + 0.04); const r = [tap.raw, tap.t]; RD_Studio.removeTap(RD_Studio.state.taps.indexOf(tap)); return r; }, [truth.events[2]]);
    ok(raw[0] === raw[1], 'with snapping off a tap stays exactly where it was pressed');
    await page.evaluate(() => { RD_Studio.state.snap = true; });
  }

  console.log('== chords, and what the compare button plays ==');
  {
    const r = await page.evaluate(([events]) => {
      RD_Studio.state.taps = [];
      const e = events.find(x => x.notes.length === 3);
      const tap = RD_Studio.addTap(e.t);
      const calls = [];
      const real = window.RD_noteOn;
      window.RD_noteOn = (f, o) => { calls.push([+f.toFixed(1), o.inst]); return real(f, o); };
      RD_Studio.compare(0);
      window.RD_noteOn = real;
      return { got: tap.notes.map(n => n.midi), want: e.notes, calls, flagged: tap.flagged };
    }, [truth.events]);
    ok(r.got.filter(m => r.want.includes(m)).length >= 2, 'a three-note chord is heard with at least two of its notes right (' + r.got.join('+') + ' for ' + r.want.join('+') + ')');
    ok(r.calls.length === r.got.length && r.calls.every(c => c[1] === 'piano'), 'compare plays the original, then exactly those notes on the chosen instrument');
    await page.evaluate(() => { RD_Studio.state.taps = []; });
  }

  console.log('== a held tap becomes a hold ==');
  {
    const r = await page.evaluate(async () => {
      RD_Studio.state.taps = [];
      RD_Studio.audio.currentTime = 2;
      await RD_Studio.audio.play();
      await new Promise(r => setTimeout(r, 200));
      RD_Studio.tapDown();
      await new Promise(r => setTimeout(r, 900));
      RD_Studio.tapUp();
      const long = RD_Studio.state.taps[0].hold;
      RD_Studio.tapDown();
      await new Promise(r => setTimeout(r, 60));
      RD_Studio.tapUp();
      RD_Studio.audio.pause();
      return { long, short: RD_Studio.state.taps[1] ? RD_Studio.state.taps[1].hold : null, items: document.querySelectorAll('#st-list .pill.hold').length };
    });
    ok(r.long > 0.6, 'holding the pad records how long (' + r.long.toFixed(2) + 's)');
    ok(r.short === 0, 'a quick press is an ordinary note');
    ok(r.items === 1, 'and the list marks the hold');
    await page.evaluate(() => { RD_Studio.state.taps = []; });
  }

  console.log('== making the level ==');
  {
    const r = await page.evaluate(([events]) => {
      const S = RD_Studio.state;
      S.taps = [];
      S.snap = true;
      S.bpm = 100; S.offset = 0.5; S.res = 1; S.lanes = 4; S.chord = 3;
      events.forEach(e => RD_Studio.addTap(e.t));
      const lvl = RD_Studio.makeLevel();
      const notesIn = lvl.grid.flat().filter(Boolean);
      const rowOf = [];
      lvl.grid.forEach((row, r) => row.forEach(c => { if (c) rowOf.push(r); }));
      const midi = f => Math.round(69 + 12 * Math.log2(f / 440));
      const want = events.flatMap(e => e.notes).sort((a, b) => a - b);
      const got = notesIn.map(c => midi(c.freq)).sort((a, b) => a - b);
      const byRow = lvl.grid.map(r => r.filter(Boolean).length);
      const lane = (m) => lvl.grid.flatMap(r => r.map((c, i) => c && midi(c.freq) === m ? i : -1).filter(i => i >= 0));
      return { name: lvl.name, bpm: lvl.bpm, lanes: lvl.lanes, width: lvl.grid[0].length, inst: lvl.instrument, rows: lvl.grid.length,
               found: got.filter(m => want.includes(m)).length, wantN: want.length, gotN: got.length,
               firstRow: rowOf[0], lastEventRow: Math.round((events[events.length - 1].t - 0.5) / 0.6), maxRow: Math.max(...rowOf),
               highRight: Math.min(...lane(83)) > Math.max(...lane(55)), scroll: lvl.scrollRows || 4, diff: lvl.diff, chordRow: byRow.filter(n => n >= 2).length };
    }, [truth.events]);
    ok(r.name === 'My Song' && r.lanes === 4 && r.width === 4 && r.inst === 'piano', 'the level is named after the song, with 4 lanes and the chosen instrument');
    ok(r.bpm === 100 && r.scroll === 4, 'at 100 BPM, with the normal fall time');
    ok(r.found / r.wantN >= 0.85 && r.gotN <= r.wantN + 3, 'it holds the notes that were played (' + r.found + ' of ' + r.wantN + ' found, ' + r.gotN + ' placed)');
    ok(r.firstRow === 0, 'the first note is on the first row');
    ok(Math.abs(r.maxRow - r.lastEventRow) <= 1, 'rows follow the beat (last note on row ' + r.maxRow + ', expected ' + r.lastEventRow + ')');
    ok(r.highRight, 'higher notes are placed to the right of lower ones');
    ok(r.chordRow >= 4, 'chords land on one row (' + r.chordRow + ' rows with several notes)');

    const fine = await page.evaluate(([events]) => {
      const S = RD_Studio.state;
      S.res = 2; S.lanes = 8;
      const lvl = RD_Studio.makeLevel();
      const code = RD_Codec.encodeLevel(lvl);
      const back = RD_Codec.decodeLevel(code);
      S.res = 1; S.lanes = 4;
      return { bpm: lvl.bpm, scroll: lvl.scrollRows, lanes: lvl.lanes, width: lvl.grid[0].length, backScroll: back.scrollRows, backLanes: back.lanes, backBpm: back.bpm, sameNotes: back.grid.flat().filter(Boolean).length === lvl.grid.flat().filter(Boolean).length };
    }, [truth.events]);
    ok(fine.bpm === 200 && fine.scroll === 8, 'two rows per beat doubles the tempo and the rows on screen, so the fall time is unchanged (' + fine.bpm + ' BPM, ' + fine.scroll + ' rows)');
    ok(fine.lanes === 8 && fine.width === 8, 'eight lanes make eight-wide rows');
    ok(fine.backScroll === 8 && fine.backLanes === 8 && fine.backBpm === 200 && fine.sameNotes, 'and all of it survives a share code');
  }

  console.log('== finishing opens the normal creator ==');
  {
    const r = await page.evaluate(([events]) => {
      const S = RD_Studio.state;
      S.taps = [];
      S.bpm = 100; S.offset = 0.5; S.res = 2; S.lanes = 6; S.inst = 'harp';
      events.forEach(e => RD_Studio.addTap(e.t));
      const before = store.load().length;
      document.getElementById('st-make').click();
      const after = store.load();
      const saved = after[after.length - 1];
      return {
        added: after.length - before, creator: document.getElementById('creator').classList.contains('active'),
        lanes: crLanes, cells: document.querySelectorAll('#cr-grid .cr-cell').length / crGrid.length, scroll: crScrollRows,
        savedInst: saved.instrument, savedScroll: saved.scrollRows, savedLanes: saved.lanes, crInst: crInstrument,
      };
    }, [truth.events]);
    ok(r.added === 1 && r.creator, 'Make level saves it and opens the Level Creator');
    ok(r.lanes === 6 && r.cells === 6, 'on the lane count chosen');
    ok(r.savedInst === 'harp' && r.crInst === 'harp', 'and the instrument');
    ok(r.scroll === 8 && r.savedScroll === 8, 'the creator keeps the fall time, and so does saving again');
    const again = await page.evaluate(() => {
      crGrid[0][0] = crGrid[0][0] || { type: 'tap', freq: 261.63, sustain: 0 };
      buildGrid();
      document.getElementById('cr-name').value = 'Studio edit';
      document.getElementById('cr-save').click();
      const arr = store.load();
      return arr[arr.length - 1].scrollRows;
    });
    ok(again === 8, 'saving from the creator keeps scrollRows (' + again + ')');
  }

  console.log('== it plays ==');
  {
    const r = await page.evaluate(async () => {
      const arr = store.load();
      const lvl = arr[arr.length - 1];
      currentSettings.lives = 99;
      launchLevel(lvl);
      document.getElementById('g-overlay').classList.remove('show');
      startGame();
      const rows = scrollRows();
      const lanes = document.querySelectorAll('#g-lanes .lane').length;
      await new Promise(r => setTimeout(r, 900));
      const spd = laneH() / (currentBeatMs * rows);
      const out = { rows, lanes, tiles: activeTiles.length, spd, beatMs: currentBeatMs };
      quitToMenu();
      currentSettings.lives = 3;
      return out;
    });
    ok(r.rows === 8 && r.lanes === 6, 'a Studio level plays on its own lane count and scroll rows (' + r.lanes + ' lanes, ' + r.rows + ' rows)');
    ok(r.beatMs === 300, 'at the doubled tempo (' + r.beatMs + ' ms a row)');
  }

  console.log('== keys and the tab ==');
  {
    const r = await page.evaluate(async () => {
      RD_Studio.open();
      RD_Studio.state.taps = [];
      RD_Studio.addTap(1); RD_Studio.addTap(2);
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backspace', bubbles: true }));
      const afterBackspace = RD_Studio.state.taps.length;
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
      const stillThere = document.getElementById('studio').classList.contains('active');
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
      const afterSpace = RD_Studio.state.taps.length;
      return { afterBackspace, stillThere, afterSpace };
    });
    ok(r.afterBackspace === 1, 'Backspace removes the last tap');
    ok(r.stillThere, 'game keys such as Q do nothing in the Studio');
    ok(r.afterSpace === 2, 'Space taps');
    await page.evaluate(() => { RD_Studio.audio.pause(); showScreen('home'); renderHome(); });

    const tab = await ctx.newPage();
    tab.on('pageerror', e => errors.push(e.message));
    await tab.addInitScript(() => { localStorage.setItem('rd_tutorial', '1'); localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5000 })); });
    await tab.goto('file://' + APP + '#studio', { waitUntil: 'load' });
    await tab.waitForTimeout(1500);
    const t = await tab.evaluate(() => ({ on: document.getElementById('studio').classList.contains('active'), w: document.documentElement.offsetWidth }));
    ok(t.on, 'opening the page with #studio goes straight to the Studio (how the extension opens it in a tab)');
    await tab.close();
  }

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8studio: ${fail} of ${pass + fail} probes FAILED` : `v8studio: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
