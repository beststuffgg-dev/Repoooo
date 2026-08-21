// Every instrument gets a real phrase, not a test note.
//
// One note can't tell a kalimba from an organ. Each of the 12 has a
// ~2-second arpeggio, chord or run shaped to its character, so the
// shop audition is worth listening to.
const { boot } = require('./harness');
const { window, notes, probe, report } = boot();

const INST = window.RD_INSTRUMENTS || [];

probe('there are 12 instruments', () => {
  notes.push('instruments: ' + INST.map(i => i.id).join(', '));
  if (INST.length !== 12) throw new Error(INST.length + ' instruments');
});

probe('every instrument has a label and an icon', () => {
  const bad = INST.filter(i => !i.id || !i.label || !i.icon);
  if (bad.length) throw new Error('incomplete: ' + bad.map(b => b.id).join(', '));
});

probe('every instrument has a jingle of its own length', () => {
  const rows = INST.map(i => [i.id, window.RD_jingleLength(i.id)]);
  notes.push('jingle lengths (ms): ' + rows.map(([id, ms]) => id + ' ' + ms).join(', '));
  const bad = rows.filter(([, ms]) => !(ms > 0));
  if (bad.length) throw new Error('no jingle for: ' + bad.map(b => b[0]).join(', '));
});

probe('a jingle is a phrase, not a single note', () => {
  // A single note would come back at the floor length.
  const rows = INST.map(i => [i.id, window.RD_jingleLength(i.id)]);
  const short = rows.filter(([, ms]) => ms < 900);
  if (short.length) throw new Error('too short to be a phrase: ' + short.map(r => r[0] + ' ' + r[1] + 'ms').join(', '));
});

probe('the phrases are about two seconds, not ten', () => {
  const rows = INST.map(i => window.RD_jingleLength(i.id));
  const lo = Math.min(...rows), hi = Math.max(...rows);
  notes.push(`jingle length range: ${lo}-${hi}ms`);
  if (hi > 3500) throw new Error('a jingle runs ' + hi + 'ms');
  if (lo < 900) throw new Error('a jingle is only ' + lo + 'ms');
});

probe('instruments of different families get different phrases', () => {
  // A run for the mallets, a pad for the winds, a hook for the synths:
  // if every instrument shared one phrase the audition would only be
  // testing the timbre, which is half of what it is for.
  const byLen = {};
  for (const i of INST) {
    const ms = window.RD_jingleLength(i.id);
    (byLen[ms] = byLen[ms] || []).push(i.id);
  }
  const shapes = Object.keys(byLen).length;
  notes.push('distinct phrase shapes: ' + shapes + ' — ' +
    Object.entries(byLen).map(([ms, ids]) => `${ms}ms: ${ids.join('/')}`).join('; '));
  if (shapes < 3) throw new Error('only ' + shapes + ' distinct phrase shapes across 12 instruments');
});

probe('playing a jingle returns its own length', () => {
  for (const i of INST) {
    const played = window.RD_playJingle(i.id);
    const stated = window.RD_jingleLength(i.id);
    if (played !== stated) throw new Error(`${i.id}: play returned ${played}, length says ${stated}`);
  }
  window.RD_stopJingle();
});

probe('starting a jingle cancels the one before it', () => {
  // Two at once is noise, not a comparison.
  window.RD_playJingle('piano');
  window.RD_playJingle('organ');
  window.RD_stopJingle();
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'audio.js'), 'utf8');
  if (!/RD_playJingle = function[\s\S]{0,120}RD_stopJingle\(\)/.test(src))
    throw new Error('playJingle no longer stops the previous one first');
});

probe('a held chord is timed from its longest note, not its last', () => {
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'audio.js'), 'utf8');
  if (!/at \+ Math\.max\(sus \* 1000, 320\)/.test(src))
    throw new Error('jingleMs no longer accounts for sustain');
});

probe('an unknown instrument still auditions rather than falling silent', () => {
  const ms = window.RD_jingleLength('nonexistent-instrument');
  if (!(ms > 0)) throw new Error('an unknown id returns ' + ms);
});

probe('every instrument can actually be selected and played', () => {
  for (const i of INST) {
    window.RD_setInstrument(i.id);
    if (window.RD_getInstrument() !== i.id) throw new Error(i.id + ' did not take');
    window.RD_playNote(440, false, 0);   // must not throw
  }
  notes.push('all ' + INST.length + ' instruments select and sound');
});

probe('the synth voices are code, not fetched samples', () => {
  // This is why the whole game is one file with zero requests.
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'audio.js'), 'utf8');
  if (/fetch\(|XMLHttpRequest|decodeAudioData/.test(src))
    throw new Error('audio.js loads something over the network');
  if (!/createOscillator/.test(src)) throw new Error('no oscillators — where does the sound come from?');
});

probe('the master bus carries a limiter', () => {
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'audio.js'), 'utf8');
  if (!/createDynamicsCompressor/.test(src)) throw new Error('no compressor on the bus');
  notes.push('four lanes plus a three-note chord can fire together; the limiter holds the sum');
});

report('jingletest');
