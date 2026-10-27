#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const GENERATOR = path.join(ROOT, 'RhythmDrop', 'v7', 'RhythmDropV7', 'campaign.js');
const OUT = path.join(ROOT, 'RhythmDrop', 'RhythmDropV8', 'levels.js');
const ROWTYPES = path.join(ROOT, 'RhythmDrop', 'RhythmDropV8', 'rowtypes.js');

const ROSTER = ['synth', 'piano', 'guitar', 'marimba', 'bell', 'flute',
  'lyre', 'brass', 'organ', 'strings', 'chiptune', 'kalimba'];

const MAX_SECONDS = 120;

function capToLength(lvl) {
  const rows = lvl.grid.length;
  const seconds = Math.round((rows * 60) / lvl.bpm);
  if (seconds <= MAX_SECONDS) return { grid: lvl.grid, rows, seconds, capped: false };
  const rowsPerBar = Math.max(1, Math.round(rows / (lvl._bars || (rows / 4))));
  const maxRows = Math.floor((MAX_SECONDS * lvl.bpm) / 60);
  const bars = Math.max(4, Math.floor(maxRows / rowsPerBar));
  const keep = Math.min(rows, bars * rowsPerBar);
  return {
    grid: lvl.grid.slice(0, keep),
    rows: keep,
    seconds: Math.round((keep * 60) / lvl.bpm),
    capped: true,
  };
}

function loadGenerator() {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  sandbox.window.RD_INSTRUMENTS = ROSTER.map(id => ({ id }));
  vm.runInContext(fs.readFileSync(GENERATOR, 'utf8'), vm.createContext(sandbox));
  const C = sandbox.window.RD_Campaign;
  if (!C || typeof C.buildCampaignLevel !== 'function') throw new Error('generator did not expose buildCampaignLevel');
  return C;
}

function loadRowTypes() {
  const sandbox = { window: {} };
  vm.runInContext(fs.readFileSync(ROWTYPES, 'utf8'), vm.createContext(sandbox));
  return sandbox.window.RD_RowTypes;
}

const toMidi = f => Math.round(69 + 12 * Math.log2(f / 440));
const toFreq = m => parseFloat((440 * Math.pow(2, (m - 69) / 12)).toFixed(2));

function main() {
  const C = loadGenerator();
  const RowTypes = loadRowTypes();
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
      l.grid = cap.grid;
      if (cap.capped) capped++;
      RowTypes.uniformRowTypes(l.grid);
      const nt = [];
      l.grid.forEach((row, r) => row.forEach((cell, lane) => {
        if (!cell) return;
        const midi = toMidi(cell.freq);
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
    generated: 'RhythmDrop/tools/bake-levels.js',
    warning: 'GENERATED FILE - do not hand-edit the note data. Re-run RhythmDrop/tools/bake-levels.js to regenerate it.',
    areas, instruments, levels,
  };

  const out = [
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
