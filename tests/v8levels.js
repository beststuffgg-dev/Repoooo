const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { v8Dir } = require('./browser');

const DIR = v8Dir();
const notes = [];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok: ' + m)) : (fail++, console.log('  FAIL: ' + m)); };

const sb = { window: {}, Math, Date, console, JSON,
  localStorage: { getItem: () => null, setItem: () => {} } };
sb.window.window = sb.window;
const ctx = vm.createContext(sb);
for (const f of ['levels.js', 'campaign.js', 'audio.js']) {
  vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx);
}
const DATA = sb.window.RD_LEVEL_DATA;
const C = sb.window.RD_Campaign;

ok(!!DATA, 'levels.js defines RD_LEVEL_DATA');
ok(!!C, 'campaign.js defines RD_Campaign');

console.log('== the campaign is all there ==');
ok(DATA.areas.length === 10, DATA.areas.length + ' areas');
ok(DATA.levels.length === 150, DATA.levels.length + ' levels');
ok(C.LEVELS_PER_AREA === 15, C.LEVELS_PER_AREA + ' levels per area');
{
  const perArea = {};
  DATA.levels.forEach(l => { perArea[l.a] = (perArea[l.a] || 0) + 1; });
  const wrong = Object.entries(perArea).filter(([, n]) => n !== 15);
  ok(wrong.length === 0, 'every area has exactly 15' + (wrong.length ? ' — ' + wrong.map(w => w[0] + '=' + w[1]).join(', ') : ''));
  const ids = DATA.levels.map(l => l.id);
  ok(new Set(ids).size === ids.length, 'every level id is unique');
  const idx = DATA.levels.map(l => l.a + ':' + l.x);
  ok(new Set(idx).size === idx.length, 'no two levels claim the same area/slot');
}

console.log('== every song has notes in it ==');
{
  const empty = DATA.levels.filter(l => !l.nt.length);
  ok(empty.length === 0, empty.length ? empty.length + ' empty charts' : 'no empty charts');
  const ragged = DATA.levels.filter(l => l.nt.length % 6 !== 0);
  ok(ragged.length === 0, 'every note is a complete run of six ints');
  let total = 0, min = Infinity, max = 0;
  DATA.levels.forEach(l => { const n = l.nt.length / 6; total += n; min = Math.min(min, n); max = Math.max(max, n); });
  notes.push(`${total.toLocaleString()} notes across 150 charts; shortest ${min}, longest ${max}`);
  ok(min >= C.COINS_MIN_NOTES, 'the shortest chart has ' + min + ' notes — above the ' + C.COINS_MIN_NOTES + '-note stub guard');
}

console.log('== the flat encoding decodes back to real charts ==');
{
  const bad = [], outOfRange = [], laneBad = [], aboveTable = [];
  for (const area of C.AREAS) {
    for (let i = 0; i < C.LEVELS_PER_AREA; i++) {
      const lvl = C.levelAt(area.id, i);
      if (!lvl) { bad.push(area.id + '/' + i); continue; }
      const rec = DATA.levels.find(l => l.a === area.id && l.x === i);
      if (C.countNotes(lvl) !== rec.nt.length / 6) bad.push(lvl.id + ' note count');
      if (lvl.grid.length !== rec.r) bad.push(lvl.id + ' row count');
      for (let r = 0; r < lvl.grid.length; r++) {
        if (lvl.grid[r].length !== 4) laneBad.push(lvl.id + ' row ' + r);
        for (const cell of lvl.grid[r]) {
          if (!cell) continue;
          if (!(cell.freq >= 50 && cell.freq <= 8400)) outOfRange.push(lvl.id + ' ' + cell.freq);
          if (cell.type !== 'tap' && cell.type !== 'dtap') bad.push(lvl.id + ' type ' + cell.type);
          if (cell.freq > 4200) aboveTable.push(lvl.id + ' ' + cell.freq.toFixed(0) + 'Hz');
        }
      }
    }
  }
  ok(bad.length === 0, bad.length ? 'decode mismatches: ' + bad.slice(0, 3).join(', ') : 'all 150 decode to the note and row counts they claim');
  ok(laneBad.length === 0, 'every row is four lanes wide');
  ok(outOfRange.length === 0, outOfRange.length ? outOfRange.length + ' pitches decoded outside any sane range' : 'every pitch decodes to a real audible note');

  const KNOWN_ABOVE_C8 = 11;
  notes.push(aboveTable.length + ' notes sit above C8 (composer quirk, areas 4 and 8): '
    + aboveTable.slice(0, 3).join(', '));
  ok(aboveTable.length <= KNOWN_ABOVE_C8,
    'notes above the top of the table stay at the known ' + KNOWN_ABOVE_C8
    + ' (found ' + aboveTable.length + ')');
}

console.log('== the build can actually play what was baked ==');
{
  const roster = (sb.window.RD_INSTRUMENTS || []).map(i => i.id);
  const used = DATA.instruments.filter(Boolean);
  const missing = used.filter(i => !roster.includes(i));
  notes.push('roster: ' + roster.join(', '));
  ok(roster.length === 12, 'audio.js ships ' + roster.length + ' instruments');
  ok(missing.length === 0, missing.length ? 'levels reference voices the build lacks: ' + missing.join(', ') : 'every voice the campaign asks for exists in audio.js (' + used.length + ' used)');
  const areaVoices = new Set(C.AREAS.map(a => a.instrument));
  ok(areaVoices.size >= 8, areaVoices.size + ' distinct area voices — each era sounds like itself');
}

console.log('== the songs are songs, not noise ==');
{
  const pc = n => ((n % 12) + 12) % 12;
  let stacks = 0, minor2 = 0, worst = null;
  for (const area of C.AREAS) {
    for (let i = 0; i < C.LEVELS_PER_AREA; i++) {
      const lvl = C.levelAt(area.id, i);
      for (const row of lvl.grid) {
        const midis = row.filter(Boolean)
          .map(c => Math.round(69 + 12 * Math.log2(c.freq / 440))).sort((a, b) => a - b);
        if (midis.length < 2) continue;
        stacks++;
        for (let a = 0; a < midis.length; a++) {
          for (let b = a + 1; b < midis.length; b++) {
            if (pc(midis[b] - midis[a]) === 1) { minor2++; if (!worst) worst = lvl.id; }
          }
        }
      }
    }
  }
  notes.push(stacks.toLocaleString() + ' simultaneous stacks in the baked campaign');
  ok(stacks > 500, 'there are chords to check (' + stacks + ')');
  ok(minor2 === 0, minor2 ? minor2 + ' minor seconds, first in ' + worst : 'zero minor seconds across all 150 baked charts');
}

console.log('== the generator is still there to re-bake with ==');
{
  const baker = path.join(__dirname, '..', 'RhythmDrop', 'tools', 'bake-levels.js');
  ok(fs.existsSync(baker), 'RhythmDrop/tools/bake-levels.js exists');
  const gen = path.join(__dirname, '..', 'RhythmDrop', 'v7', 'RhythmDropV7', 'campaign.js');
  ok(fs.existsSync(gen), 'the composer it bakes from is still in the repo');
  const src = fs.readFileSync(path.join(DIR, 'levels.js'), 'utf8');
  ok(/GENERATED FILE/.test(src), 'levels.js says it is generated');
  ok(/bake-levels\.js/.test(src), 'and names the tool that wrote it');
  notes.push('levels.js is ' + (fs.statSync(path.join(DIR, 'levels.js')).size / 1024).toFixed(0) + ' KB');
}

console.log('\n--- notes ---');
notes.forEach(l => console.log('  ' + l));
console.log('\n' + (fail ? `v8levels: ${fail} of ${pass + fail} probes FAILED` : `v8levels: all ${pass} probes passed`));
process.exit(fail ? 1 : 0);
