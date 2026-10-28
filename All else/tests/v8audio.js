const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const SRC = fs.readFileSync(path.join(v8Dir(), 'voices.js'), 'utf8') + '\n' + fs.readFileSync(path.join(v8Dir(), 'audio.js'), 'utf8');
const notes = [];
const errors = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

async function render(page, setup, arg) {
  await page.evaluate(() => {
    try { window.localStorage.removeItem('rd_master_vol'); window.localStorage.removeItem('rd_music_vol'); } catch (e) {}
    const off = new OfflineAudioContext(1, 44100 * 3, 44100);
    window.__off = off;
    window.AudioContext = function () { return off; };
    window.webkitAudioContext = window.AudioContext;
  });
  await page.addScriptTag({ content: '(function(){' + SRC + '\n})();' });
  const loaded = await page.evaluate(() => typeof window.RD_playNoteFreq === 'function');
  if (!loaded) throw new Error('audio.js did not finish loading: ' + (errors[errors.length - 1] || 'no error reported'));
  await page.evaluate(setup, arg);
  return page.evaluate(async () => {
    const buf = await window.__off.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0, nonSilent = 0;
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      sum += d[i] * d[i];
      if (a > 0.001) nonSilent++;
    }
    let zc = 0;
    for (let i = 1; i < d.length; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) zc++;
    return {
      peak, rms: Math.sqrt(sum / d.length),
      voicedMs: (nonSilent / 44.1), zc,
      clipped: d.some(v => Math.abs(v) > 1.0),
    };
  });
}

(async () => {
  const b = await chromium.launch(launchOpts());
  const page = await b.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('about:blank');
  await page.evaluate(() => {
    const mem = {};
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: k => (k in mem ? mem[k] : null),
        setItem: (k, v) => { mem[k] = String(v); },
        removeItem: k => { delete mem[k]; },
      },
    });
  });

  const roster = await (async () => {
    await page.evaluate(() => { window.AudioContext = function () { return new OfflineAudioContext(1, 1024, 44100); }; });
    await page.addScriptTag({ content: '(function(){' + SRC + '\n})();' });
    return page.evaluate(() => window.RD_INSTRUMENTS.map(i => i.id));
  })();
  ok(roster.length === 11, 'audio.js exposes ' + roster.length + ' instruments: ' + roster.join(', '));
  ok(['synth', 'violin', 'cello', 'flute', 'clarinet', 'trumpet', 'horn', 'harp', 'piano', 'drums', 'kazoo'].every(id => roster.includes(id)), 'the roster is synth, nine orchestra and kit voices, and the kazoo');

  console.log('== every instrument makes a sound ==');
  const measured = {};
  for (const id of roster) {
    const r = await render(page, id => { window.RD_setInstrument(id); window.RD_playNoteFreq(440, false, 0); }, id);
    measured[id] = r;
    notes.push(`${id.padEnd(9)} peak ${r.peak.toFixed(3)}  rms ${r.rms.toFixed(4)}  ${r.voicedMs.toFixed(0)}ms  ${r.zc} crossings`);
    ok(r.peak > 0.01, `${id}: produces audible output (peak ${r.peak.toFixed(3)})`);
    ok(r.voicedMs > 30, `${id}: sounds for ${r.voicedMs.toFixed(0)}ms, not a click`);
  }

  console.log('== they are eleven different sounds, not one eleven times ==');
  {
    const sig = id => measured[id].zc + ':' + measured[id].rms.toFixed(3);
    const groups = {};
    roster.forEach(id => { (groups[sig(id)] = groups[sig(id)] || []).push(id); });
    const dupes = Object.values(groups).filter(g => g.length > 1);
    ok(dupes.length === 0, dupes.length
      ? 'these render identically: ' + dupes.map(g => g.join('=')).join(', ')
      : 'all ' + roster.length + ' render distinctly');
    const zcs = roster.map(id => measured[id].zc);
    notes.push('brightness spread: ' + Math.min(...zcs) + ' to ' + Math.max(...zcs) + ' zero crossings');
    ok(Math.max(...zcs) > Math.min(...zcs) * 1.5, 'the roster spans dull to bright');
  }

  console.log('== double-taps, sustain and per-note voices ==');
  {
    const single = await render(page, () => { window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 0); });
    const dtap   = await render(page, () => { window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, true, 0); });
    notes.push(`piano single rms ${single.rms.toFixed(4)}, double-tap rms ${dtap.rms.toFixed(4)}`);
    ok(dtap.zc > single.zc, 'a double-tap carries more upper content than a single (' + single.zc + ' -> ' + dtap.zc + ' crossings)');
    await render(page, () => {
      window.__calls = [];
      const real = window.RD_noteOn;
      window.RD_noteOn = (f, o) => { window.__calls.push([f, o && o.inst]); return real(f, o); };
      window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, true, 0);
    });
    const calls = await page.evaluate(() => window.__calls);
    notes.push('a double-tap on 440 Hz plays ' + calls.map(c => c[0].toFixed(2)).join(' + '));
    ok(calls.length === 2 && Math.abs(calls[1][0] - 440 * Math.pow(2, 7 / 12)) < 0.01, 'and its second voice is the equal-tempered fifth, 7 semitones up (' + calls.map(c => c[0].toFixed(2)).join(', ') + ')');

    const dry = await render(page, () => { window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 0); });
    const wet = await render(page, () => { window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 2.5); });
    notes.push(`piano dry ${dry.voicedMs.toFixed(0)}ms, sustain 2.5s ${wet.voicedMs.toFixed(0)}ms`);
    ok(wet.voicedMs > dry.voicedMs * 1.5, 'sustain actually holds the note longer');

    const asSynth  = await render(page, () => { window.RD_setInstrument('synth'); window.RD_playNoteFreq(440, false, 0); });
    const override = await render(page, () => { window.RD_setInstrument('synth'); window.RD_playNoteFreq(440, false, 0, 'flute'); });
    const realBell = measured.flute;
    notes.push(`synth zc ${asSynth.zc}, synth+flute-override zc ${override.zc}, flute zc ${realBell.zc}`);
    ok(override.zc !== asSynth.zc, 'the per-note instrument override changes what is rendered');
    ok(Math.abs(override.zc - realBell.zc) < Math.abs(override.zc - asSynth.zc),
      'and what it renders is the named voice, not the selected one');
  }

  console.log('== the master bus holds a stack of notes without clipping ==');
  {
    const stack = await render(page, () => {
      window.RD_setInstrument('trumpet');
      [261.63, 329.63, 392.00, 523.25, 659.26, 783.99, 880].forEach(f =>
        window.RD_playNoteFreq(f, true, 0));
    });
    notes.push('seven simultaneous double-taps: peak ' + stack.peak.toFixed(3));
    ok(stack.peak > 0.05, 'the stack is actually loud (peak ' + stack.peak.toFixed(3) + ')');
    ok(!stack.clipped, 'and the limiter keeps it inside full scale');
  }

  console.log('== volume controls reach the output ==');
  {
    const loud  = await render(page, () => { window.RD_setVolume(1);    window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 0); });
    const quiet = await render(page, () => { window.RD_setVolume(0.25); window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 0); });
    const off   = await render(page, () => { window.RD_setVolume(0);    window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 0); });
    notes.push(`master volume 1.0 / 0.25 / 0 -> peak ${loud.peak.toFixed(3)} / ${quiet.peak.toFixed(3)} / ${off.peak.toFixed(3)}`);
    ok(quiet.peak < loud.peak * 0.6, 'turning the master down makes it quieter');
    ok(off.peak < 0.001, 'and zero is actually silent');
  }

  console.log('== a campaign chart plays with the pitches it was baked with ==');
  {
    const r = await render(page, () => {
      window.RD_setLaneFreqs([440, 493.88, 554.37, 659.26]);
      window.RD_setInstrument('harp');
      [0, 1, 2, 3].forEach(l => window.RD_playNote(l, false));
    });
    notes.push('four campaign lane pitches at once: peak ' + r.peak.toFixed(3));
    ok(r.peak > 0.05, 'lane playback from a chart is audible');
    ok(!r.clipped, 'and does not clip');
  }

  console.log('== a note can be held and released ==');
  {
    const tail = async (id, hold) => render(page, ([i, h]) => {
      const n = window.RD_noteOn(440, { inst: i, vel: 0.6 });
      n.release(h);
    }, [id, hold]);
    for (const id of ['violin', 'flute', 'trumpet', 'synth', 'kazoo']) {
      const short = await tail(id, 0.5), long = await tail(id, 1.6);
      notes.push(id + ' held to 0.5s sounds ' + short.voicedMs.toFixed(0) + 'ms, to 1.6s ' + long.voicedMs.toFixed(0) + 'ms');
      ok(long.voicedMs > short.voicedMs + 700, id + ': a note held longer sounds longer (' + short.voicedMs.toFixed(0) + ' -> ' + long.voicedMs.toFixed(0) + 'ms)');
      ok(short.voicedMs < 1100, id + ': and stops after its release instead of ringing on (' + short.voicedMs.toFixed(0) + 'ms)');
    }
    const never = await render(page, () => { window.RD_noteOn(440, { inst: 'violin', vel: 0.6 }); });
    ok(never.voicedMs > 2900, 'a note nobody releases keeps sounding (' + never.voicedMs.toFixed(0) + 'ms of a 3s render)');
  }

  console.log('== the sound has nothing random in it ==');
  {
    const grab = () => page.evaluate(async () => Array.from((await window.__off.startRendering()).getChannelData(0)).slice(2000, 2400));
    const run = async id => {
      await page.evaluate(() => { const off = new OfflineAudioContext(1, 44100 * 2, 44100); window.__off = off; window.AudioContext = function () { return off; }; });
      await page.addScriptTag({ content: '(function(){' + SRC + '\n})();' });
      await page.evaluate(i => { window.RD_noteOn(330, { inst: i, vel: 0.6, dur: 0.8 }); }, id);
      return grab();
    };
    for (const id of ['violin', 'flute', 'harp', 'drums']) {
      const a = await run(id), b = await run(id);
      const worst = a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
      ok(a.length === 400 && a.some(v => Math.abs(v) > 0.001) && worst < 1e-5, id + ': two renders of the same note agree to within ' + worst.toExponential(1) + ' (float rounding, nothing random)');
    }
  }

  console.log('== the engine\'s limits and aliases ==');
  {
    await page.evaluate(() => { const off = new OfflineAudioContext(1, 44100 * 2, 44100); window.__off = off; window.AudioContext = function () { return off; }; });
    await page.addScriptTag({ content: '(function(){' + SRC + '\n})();' });
    const out = await page.evaluate(() => {
      const o = {};
      for (let i = 0; i < 80; i++) window.RD_noteOn(200 + i * 5, { inst: 'violin', vel: 0.4 });
      o.voices = window.RD_voiceCount();
      const al = window.RD_resolveInstrument;
      o.alias = ['chiptune', 'strings', 'brass', 'guitar', 'lyre', 'kalimba', 'bell', 'marimba', 'organ', 'flute', 'nonsense', undefined].map(al);
      window.RD_saveInstrument('organ');
      o.saved = [window.RD_getInstrument(), localStorage.getItem('rd_instrument')];
      o.piece = [261.63, 329.63, 392, 523.25, 73.42, 440].map(f => window.RD_drumPiece(f));
      o.label = window.RD_drumLabel(329.63);
      o.fit = Object.keys(window.RD_VOICE_FIT).sort();
      o.zones = Object.fromEntries(Object.entries(window.RD_VOICE_FIT).map(([k, v]) => [k, v.zones.length]));
      return o;
    });
    ok(out.voices <= 30, 'the polyphony cap holds: 80 notes at once keep ' + out.voices + ' voices');
    ok(out.alias.join() === 'synth,violin,trumpet,harp,harp,harp,harp,piano,clarinet,flute,synth,synth',
      'every old voice id resolves to a new one (' + out.alias.join() + ')');
    ok(out.saved[0] === 'clarinet' && out.saved[1] === 'clarinet', 'saving an old id stores its replacement');
    ok(out.piece.join() === 'kick,snare,hatClosed,crash,tomLo,ride', 'the drum kit maps pitch to a piece (' + out.piece.join() + ')');
    ok(out.label === 'Snare', 'and can name it for the picker (' + out.label + ')');
    ok(out.fit.join() === 'cello,clarinet,flute,harp,horn,piano,trumpet,violin', 'fitted tables ship for the eight pitched voices');
    ok(Object.values(out.zones).every(n => n >= 9), 'each fitted from at least nine recorded notes (' + JSON.stringify(out.zones) + ')');
  }

  ok(errors.length === 0, 'no page errors while rendering (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8audio: ${fail} of ${pass + fail} probes FAILED` : `v8audio: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
