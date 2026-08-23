#!/usr/bin/env node
// Bakes the 150 campaign charts into a permanent data file.
//
// The generator itself is kept, not replaced: this loads v7's
// campaign.js — the same deterministic mulberry32 composer that wrote
// these songs — runs it once over every area and level, and writes the
// result out as plain data. V8 then loads that file instead of
// composing at boot.
//
// Why bake at all: a chart that exists as a file can be listened to,
// hand-edited, diffed and reviewed. A chart that only exists as a seed
// can only be re-derived, and any change to the composer silently
// rewrites all 150 songs under the player's feet.
//
//   node other/tools/bake-levels.js
//
// Re-run it deliberately, and expect the diff to show every song that
// moved.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const GENERATOR = path.join(ROOT, 'other', 'v7', 'RhythmDropV7', 'campaign.js');
const OUT = path.join(ROOT, 'other', 'RhythmDropV8', 'levels.js');

// The instrument roster V8 ships. The composer resolves each area's
// voice against whatever `window.RD_INSTRUMENTS` says the target build
// has, falling back to a near neighbour when it is missing — so baking
// against an empty roster silently collapses ten area voices into four
// and every song after Farmstead comes out wrong. This list is what
// makes the bake honest, and v8levels.js asserts the shipped audio
// engine still provides every id the baked charts reference.
const ROSTER = ['synth', 'piano', 'guitar', 'marimba', 'bell', 'flute',
  'lyre', 'brass', 'organ', 'strings', 'chiptune', 'kalimba'];

// Campaign songs are capped to two minutes. The composer aims for
// 1m30–3m by difficulty, which left the back half of the campaign
// running past three minutes a track — too long for a pick-up-and-play
// popup. Capping is done here, on the baked grid, by dropping WHOLE
// BARS from the tail: a bar is a complete musical phrase, so the song
// still ends on a bar line rather than mid-figure. Shorter songs are
// left exactly as composed.
const MAX_SECONDS = 120;

function capToLength(lvl) {
  const rows = lvl.grid.length;
  const seconds = Math.round((rows * 60) / lvl.bpm);
  if (seconds <= MAX_SECONDS) return { grid: lvl.grid, rows, seconds, capped: false };
  const rowsPerBar = Math.max(1, Math.round(rows / (lvl._bars || (rows / 4))));
  const maxRows = Math.floor((MAX_SECONDS * lvl.bpm) / 60);
  // Whole bars only, and at least a few so nothing collapses to a stub.
  const bars = Math.max(4, Math.floor(maxRows / rowsPerBar));
  const keep = Math.min(rows, bars * rowsPerBar);
  return {
    grid: lvl.grid.slice(0, keep),
    rows: keep,
    seconds: Math.round((keep * 60) / lvl.bpm),
    capped: true,
  };
}

// campaign.js is an IIFE that hangs one global off `window` and never
// touches the DOM, so a bare context is all it needs.
function loadGenerator() {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  sandbox.window.RD_INSTRUMENTS = ROSTER.map(id => ({ id }));
  vm.runInContext(fs.readFileSync(GENERATOR, 'utf8'), vm.createContext(sandbox));
  const C = sandbox.window.RD_Campaign;
  if (!C || typeof C.buildCampaignLevel !== 'function') throw new Error('generator did not expose buildCampaignLevel');
  return C;
}

// Pitches are stored as MIDI numbers rather than frequencies: the
// composer draws every note from an equal-tempered table, so the
// number is exact, a third of the size, and readable by a human.
const toMidi = f => Math.round(69 + 12 * Math.log2(f / 440));
const toFreq = m => parseFloat((440 * Math.pow(2, (m - 69) / 12)).toFixed(2));

function main() {
  const C = loadGenerator();
  const instruments = [];
  const instIdx = id => {
    const i = instruments.indexOf(id || '');
    return i < 0 ? (instruments.push(id || ''), instruments.length - 1) : i;
  };

  const areas = C.AREAS.map(a => ({
    id: a.id, key: a.key, name: a.name, blurb: a.blurb, instrument: a.instrument,
  }));

  const levels = [];
  let notesTotal = 0, drift = 0, capped = 0;

  for (const area of C.AREAS) {
    for (let idx = 0; idx < C.LEVELS_PER_AREA; idx++) {
      const l = C.buildCampaignLevel(area.id, idx);
      const cap = capToLength(l);
      l.grid = cap.grid;                 // trimmed to whole bars under MAX_SECONDS
      if (cap.capped) capped++;
      // Flat note list: row, lane, type, midi, sustain in tenths, instrument.
      // Five small integers beats an object per note by a wide margin at
      // 150 charts, and the shape is still obvious at a glance.
      const nt = [];
      l.grid.forEach((row, r) => row.forEach((cell, lane) => {
        if (!cell) return;
        const midi = toMidi(cell.freq);
        // Prove the pitch survives the round trip rather than assuming it.
        if (Math.abs(toFreq(midi) - cell.freq) > 0.02) drift++;
        nt.push(r, lane, cell.type === 'dtap' ? 1 : 0, midi,
          Math.round((cell.sustain || 0) * 10), instIdx(cell.inst));
        notesTotal++;
      }));

      levels.push({
        id: l.id, n: l.name, a: l.areaId, x: l.levelIdx, t: l.trackNo,
        b: l.bpm, r: l.grid.length, d: l.diff, df: l.difficulty,
        sn: l.styleName, sec: Math.round((l.grid.length * 60) / l.bpm), bg: l.bgMode, ins: instIdx(l.instrument),
        lf: l.laneFreqs.map(toMidi), bp: (l.bassPattern || []).map(f => (f > 0 ? toMidi(f) : 0)),
        nt,
      });
    }
  }

  if (drift) throw new Error(drift + ' notes did not survive the freq->midi round trip');

  const body = {
    v: 1,
    generated: 'other/tools/bake-levels.js',
    areas, instruments, levels,
  };

  const out = [
    '// GENERATED FILE — do not hand-edit the note data.',
    '// Written by other/tools/bake-levels.js from the deterministic',
    '// composer in other/v7/RhythmDropV7/campaign.js. Re-run that tool',
    '// to regenerate; expect the diff to show every song that moved.',
    '//',
    '// ' + levels.length + ' levels, ' + notesTotal.toLocaleString() + ' notes, ' + areas.length + ' areas.',
    '// Notes are flat runs of six ints: row, lane, type(0=tap,1=x2),',
    '// midi, sustain*10, instrument index.',
    'window.RD_LEVEL_DATA = ' + JSON.stringify(body) + ';',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out);

  console.log('baked ' + levels.length + ' levels -> ' + path.relative(ROOT, OUT));
  console.log('  ' + areas.length + ' areas, ' + notesTotal.toLocaleString() + ' notes, '
    + instruments.length + ' instruments (' + instruments.filter(Boolean).join(', ') + ')');
  console.log('  ' + capped + ' of ' + levels.length + ' trimmed to <=' + MAX_SECONDS + 's on a bar line; rest as composed');
  console.log('  ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB, every pitch exact through midi');
}

main();
