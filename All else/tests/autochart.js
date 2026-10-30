const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const DIR = v8Dir();
const TOOL = path.join(DIR, '..', 'Auto Level Generator.html');
const SRC = ['voices.js', 'audio.js'].map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const PIECE = () => {
  window.makePiece = async src => {
    const SR = 22050, SECS = 44;
    const off = new OfflineAudioContext(1, SR * SECS, SR);
    window.AudioContext = function () { return off; };
    (0, eval)('(function(){' + src + '\n})()');
    const f = m => 440 * Math.pow(2, (m - 69) / 12);
    const truth = [];
    const add = (t, midis, inst, dur) => { midis.forEach(m => window.RD_noteOn(f(m), { inst, vel: 0.6, when: t, dur })); truth.push({ t, midis, inst, dur }); };
    const beat = 0.6;
    const prog = [[48, 52, 55], [53, 57, 60], [43, 47, 50], [48, 52, 55]];
    for (let bar = 0; bar < 16; bar++) {
      const t = 1 + bar * 4 * beat;
      const chord = prog[bar % 4];
      add(t, [chord[0] - 12], 'cello', 4 * beat * 0.95);
      const arp = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12];
      arp.forEach((m, i) => add(t + i * beat, [m], 'piano', 0.4));
      if (bar >= 4) add(t + 0.0, [chord[2] + 24], 'violin', 2.2 * beat * 2);
    }
    const buf = await off.startRendering();
    const x = buf.getChannelData(0);
    const wav = new Uint8Array(44 + x.length * 2);
    const dv = new DataView(wav.buffer);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + x.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, SR, true);
    dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
    return { wav: Array.from(wav), truth };
  };
};

(async () => {
  if (!fs.existsSync(TOOL)) { console.log('  FAIL: the generator page is missing; run node "All else/AutoChart/build.js"'); process.exit(1); }
  const b = await chromium.launch(launchOpts());
  const errors = [];

  const maker = await b.newPage();
  await maker.addInitScript(PIECE);
  await maker.goto('about:blank');
  await maker.evaluate(() => { const mem = {}; Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } } }); });
  const piece = await maker.evaluate(src => window.makePiece(src), SRC);
  await maker.close();
  const wav = Buffer.from(piece.wav);
  const truth = piece.truth;
  const truthMidis = new Set(truth.flatMap(t => t.midis));
  const longNotes = truth.filter(t => t.dur > 1.5).length;

  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + TOOL);
  await page.waitForTimeout(500);

  console.log('== loading ==');
  ok(await page.evaluate(() => document.getElementById('opts').hidden), 'nothing to set until a file is chosen');
  await page.setInputFiles('#file', { name: 'Piece.wav', mimeType: 'audio/wav', buffer: wav });
  await page.waitForFunction(() => !document.getElementById('opts').hidden, null, { timeout: 20000 });
  ok(/Piece/.test(await page.evaluate(() => document.getElementById('fname').textContent)), 'the file is read and named');

  const run = async (diff, lanes, extra) => {
    await page.evaluate(([d, l, e]) => {
      document.getElementById('diff').value = d; document.getElementById('lanes').value = l;
      document.getElementById('inst').checked = e.inst !== false; document.getElementById('holds').checked = e.holds !== false;
      document.getElementById('seed').value = e.seed || 1;
    }, [diff, String(lanes), extra || {}]);
    await page.click('#go');
    await page.waitForFunction(() => /Done/.test(document.getElementById('status').textContent) || /wrong/.test(document.getElementById('status').textContent), null, { timeout: 120000 });
    return page.evaluate(() => {
      const r = RD_AutoApp.state.result;
      return { stats: r.stats, level: r.level, code: document.getElementById('code').value, status: document.getElementById('status').textContent };
    });
  };

  console.log('== a medium chart of a three-instrument piece ==');
  const med = await run('medium', 4);
  const cells = [];
  med.level.grid.forEach((row, r) => row.forEach((c, l) => { if (c) cells.push({ r, l, c }); }));
  const midi = f => Math.round(69 + 12 * Math.log2(f / 440));
  const right = cells.filter(x => [0, 1, -1].some(d => truthMidis.has(midi(x.c.freq) + d))).length;
  notes.push(`medium: ${cells.length} notes, ${med.stats.holds} holds, ${med.stats.rows} rows at ${med.stats.bpm} BPM, instruments ${JSON.stringify(med.stats.instruments)}`);
  ok(med.stats.notes === cells.length && cells.length > 40, 'it makes a chart with real content (' + cells.length + ' notes)');
  const wrong = cells.filter(x => ![0, 1, -1].some(d => truthMidis.has(midi(x.c.freq) + d))).map(x => midi(x.c.freq));
  notes.push('wrong pitches: ' + wrong.join(' ') + ' (truth ' + [...truthMidis].sort((a, b) => a - b).join(' ') + ')');
  ok(right / cells.length >= 0.8, 'at least 80% of its notes are pitches that are in the piece (' + right + '/' + cells.length + ')');
  ok(med.stats.holds >= Math.floor(longNotes * 0.3), 'long notes become holds (' + med.stats.holds + ' holds, ' + longNotes + ' long notes in the music)');
  ok(cells.filter(x => x.c.hold).every(x => med.level.grid.slice(x.r + 1, x.r + 1 + x.c.hold).every(row => !row[x.l])), 'and no hold runs into another note in its lane');
  const lanesUsed = new Set(cells.map(x => x.l));
  ok(lanesUsed.size === 4, 'all four lanes are used (' + [...lanesUsed].sort() + ')');
  const insts = Object.keys(med.stats.instruments);
  ok(insts.length >= 2, 'more than one kind of instrument is picked out (' + insts.join(', ') + ')');
  const lowNotes = cells.filter(x => midi(x.c.freq) < 45), highNotes = cells.filter(x => midi(x.c.freq) > 70);
  ok(lowNotes.length && lowNotes.filter(x => ['cello', 'horn', 'clarinet', 'piano'].includes(x.c.inst)).length / lowNotes.length >= 0.6, 'low notes are given low instruments');
  ok(med.status.startsWith('Done'), 'the page says it is done');
  const np = /after (\d+) passes/.exec(med.status); ok(np && +np[1] >= 10 && +np[1] <= 30, 'it ran 10 to 30 passes and says so (' + (np && np[1]) + ')');

  console.log('== difficulty changes the density ==');
  const easy = await run('easy', 4);
  const hard = await run('hard', 4);
  notes.push(`notes: easy ${easy.stats.notes}, medium ${med.stats.notes}, hard ${hard.stats.notes}`);
  ok(easy.stats.notes < med.stats.notes && med.stats.notes <= hard.stats.notes, 'easy < medium <= hard in notes (' + easy.stats.notes + ', ' + med.stats.notes + ', ' + hard.stats.notes + ')');
  const perSec = e => e.stats.notes / e.stats.seconds;
  ok(perSec(easy) < 2.2, 'easy stays gentle (' + perSec(easy).toFixed(2) + ' notes a second)');
  const easyHolds = easy.level.grid.flat().filter(c => c && c.hold).length;
  ok(easyHolds <= easy.stats.holds && easy.level.grid.every((row, r) => row.filter(c => c).length <= 1), 'easy has one note at a time');

  console.log('== lanes, seeds and options ==');
  const eight = await run('medium', 8);
  ok(eight.level.lanes === 8 && eight.level.grid.every(r => r.length === 8), 'eight lanes make eight-wide rows');
  ok(new Set(eight.level.grid.flatMap((row, r) => row.map((c, l) => c ? l : -1)).filter(l => l >= 0)).size >= 6, 'and spread across at least six of them');
  const a1 = await run('medium', 4, { seed: 5 }), a2 = await run('medium', 4, { seed: 5 }), a3 = await run('medium', 4, { seed: 6 });
  ok(a1.code === a2.code, 'the same seed gives the same level');
  const freqs = l => l.grid.flat().filter(Boolean).map(c => c.freq).sort().join();
  ok(a1.code !== a3.code && freqs(a1.level) === freqs(a3.level), 'another seed re-places the notes in the lanes but keeps the same notes');
  const plain = await run('medium', 4, { holds: false, inst: false });
  ok(plain.stats.holds === 0 && Object.keys(plain.stats.instruments).length === 0, 'holds and instruments can be switched off');

  console.log('== the code goes into the game ==');
  const code = a1.code;
  const game = await ctx.newPage();
  game.on('pageerror', e => errors.push(e.message));
  game.on('dialog', d => d.accept(code));
  await game.addInitScript(() => { localStorage.setItem('rd_tutorial', '1'); localStorage.setItem('rd_profile', JSON.stringify({ username: 'P', coins: 5 })); });
  await game.goto('file://' + path.join(DIR, 'popup.html'));
  await game.waitForTimeout(1300);
  const r = await game.evaluate(async () => {
    const s = document.getElementById('boot-splash'); if (s) s.remove();
    const before = store.load().length;
    importLevel();
    const arr = store.load();
    const lvl = arr[arr.length - 1];
    launchLevel(lvl);
    document.getElementById('g-overlay').classList.remove('show');
    currentSettings.lives = 99;
    startGame();
    await new Promise(r => setTimeout(r, 1600));
    const out = { added: arr.length - before, lanes: lvl.lanes, tiles: activeTiles.length, name: lvl.name, hasInst: lvl.grid.flat().some(c => c && c.inst) };
    quitToMenu();
    return out;
  });
  ok(r.added === 1 && r.lanes === 4, 'Import from code accepts it');
  ok(r.tiles > 0, 'and it plays (' + r.tiles + ' notes already falling)');
  ok(r.hasInst, 'with each note on the instrument it was heard on');

  ok(errors.length === 0, 'no page errors (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `autochart: ${fail} of ${pass + fail} probes FAILED` : `autochart: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
