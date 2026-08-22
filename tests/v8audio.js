// Does the audio engine actually make a sound?
//
// Every other check on audio.js so far has been structural — the
// roster has twelve ids, the file parses, the functions exist. None of
// that would catch a voice that was lifted from another build and now
// calls a helper that isn't here, or an envelope that ramps to zero
// and stays there. So this renders each instrument through a real
// OfflineAudioContext in Chromium and measures the samples that come
// out.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { launchOpts, v8Dir } = require('./browser');

const SRC = fs.readFileSync(path.join(v8Dir(), 'audio.js'), 'utf8');
const notes = [];
const errors = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

// Rendering one voice at a time, because audio.js builds its context
// lazily and once: re-injecting the source wrapped in a function gives
// each render a clean module scope without redeclaring its top-level
// bindings.
// `setup` must be a real function, not a source string: page.evaluate
// given a string evaluates it as an expression, so an arrow function
// passed that way is merely constructed and never called — which
// renders perfect silence and looks exactly like a dead audio engine.
async function render(page, setup, arg) {
  await page.evaluate(() => {
    // Each render gets a clean slate: audio.js reads its saved volume
    // back on load, so a probe that turns the volume down would
    // otherwise silence every render after it.
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
    // Zero crossings stand in for brightness: a bell and an organ at
    // the same pitch differ mostly in what sits above the fundamental.
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
  // audio.js reads its saved volumes from localStorage as it loads, and
  // an about:blank origin has none — the access throws and takes the
  // whole script with it, which looks exactly like "the engine has no
  // instruments". Give it somewhere to read from.
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
  ok(roster.length === 12, 'audio.js exposes ' + roster.length + ' instruments');

  console.log('== every instrument makes a sound ==');
  const measured = {};
  for (const id of roster) {
    const r = await render(page, id => { window.RD_setInstrument(id); window.RD_playNoteFreq(440, false, 0); }, id);
    measured[id] = r;
    notes.push(`${id.padEnd(9)} peak ${r.peak.toFixed(3)}  rms ${r.rms.toFixed(4)}  ${r.voicedMs.toFixed(0)}ms  ${r.zc} crossings`);
    ok(r.peak > 0.01, `${id}: produces audible output (peak ${r.peak.toFixed(3)})`);
    ok(r.voicedMs > 30, `${id}: sounds for ${r.voicedMs.toFixed(0)}ms, not a click`);
  }

  console.log('== they are twelve different sounds, not one twelve times ==');
  {
    const sig = id => measured[id].zc + ':' + measured[id].rms.toFixed(3);
    const groups = {};
    roster.forEach(id => { (groups[sig(id)] = groups[sig(id)] || []).push(id); });
    const dupes = Object.values(groups).filter(g => g.length > 1);
    ok(dupes.length === 0, dupes.length
      ? 'these render identically: ' + dupes.map(g => g.join('=')).join(', ')
      : 'all 12 render distinctly');
    const zcs = roster.map(id => measured[id].zc);
    notes.push('brightness spread: ' + Math.min(...zcs) + ' to ' + Math.max(...zcs) + ' zero crossings');
    ok(Math.max(...zcs) > Math.min(...zcs) * 1.5, 'the roster spans dull to bright');
  }

  console.log('== the seven voices lifted from V7 all work ==');
  {
    // These are the ones that were not in the v3 base. A helper that
    // did not come across with them would show up as silence here and
    // nowhere else.
    const lifted = ['flute', 'lyre', 'brass', 'organ', 'strings', 'chiptune', 'kalimba'];
    const dead = lifted.filter(id => measured[id].peak <= 0.01);
    ok(dead.length === 0, dead.length ? 'silent after the port: ' + dead.join(', ') : 'all seven ported voices sound');
  }

  console.log('== double-taps, sustain and per-note voices ==');
  {
    const single = await render(page, () => { window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 0); });
    const dtap   = await render(page, () => { window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, true, 0); });
    notes.push(`piano single rms ${single.rms.toFixed(4)}, double-tap rms ${dtap.rms.toFixed(4)}`);
    ok(dtap.rms > single.rms * 1.05, 'a double-tap is fuller than a single (adds the fifth)');

    const dry = await render(page, () => { window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 0); });
    const wet = await render(page, () => { window.RD_setInstrument('piano'); window.RD_playNoteFreq(440, false, 2.5); });
    notes.push(`piano dry ${dry.voicedMs.toFixed(0)}ms, sustain 2.5s ${wet.voicedMs.toFixed(0)}ms`);
    ok(wet.voicedMs > dry.voicedMs * 1.5, 'sustain actually holds the note longer');

    // A campaign chart names a voice per note; the override has to beat
    // the globally selected instrument or every area sounds the same.
    const asSynth  = await render(page, () => { window.RD_setInstrument('synth'); window.RD_playNoteFreq(440, false, 0); });
    const override = await render(page, () => { window.RD_setInstrument('synth'); window.RD_playNoteFreq(440, false, 0, 'bell'); });
    const realBell = measured.bell;
    notes.push(`synth zc ${asSynth.zc}, synth+bell-override zc ${override.zc}, bell zc ${realBell.zc}`);
    ok(override.zc !== asSynth.zc, 'the per-note instrument override changes what is rendered');
    ok(Math.abs(override.zc - realBell.zc) < Math.abs(override.zc - asSynth.zc),
      'and what it renders is the named voice, not the selected one');
  }

  console.log('== the master bus holds a stack of notes without clipping ==');
  {
    // Four lanes plus a three-note chord is the worst realistic case.
    const stack = await render(page, () => {
      window.RD_setInstrument('brass');
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
      window.RD_setInstrument('guitar');
      [0, 1, 2, 3].forEach(l => window.RD_playNote(l, false));
    });
    notes.push('four campaign lane pitches at once: peak ' + r.peak.toFixed(3));
    ok(r.peak > 0.05, 'lane playback from a chart is audible');
    ok(!r.clipped, 'and does not clip');
  }

  ok(errors.length === 0, 'no page errors while rendering (' + errors.join('; ') + ')');
  await b.close();
  console.log('\n--- notes ---');
  notes.forEach(l => console.log('  ' + l));
  console.log('\n' + (fail ? `v8audio: ${fail} of ${pass + fail} probes FAILED` : `v8audio: all ${pass} probes passed`));
  process.exit(fail ? 1 : 0);
})();
