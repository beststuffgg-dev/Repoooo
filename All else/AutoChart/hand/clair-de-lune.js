#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const REPO = path.join(__dirname, '..', '..', '..');
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(REPO, 'RhythmDropV9', 'lanes.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(REPO, 'RhythmDropV9', 'codec.js'), 'utf8'));

const SCORE = `
0.5: E4~1.2 G4
1.0: G5 E5~1.0
2.8: C5~1.3 E5
4.2: F4~1.2 Ab4~1.2 F5
4.6: B4 D5
5.1: C5 E5
5.6: D5~1.0 B4
6.3: B4~2.3 Ab4~1.8
8.3: E4~1.2 G4
8.8: A4 C5 E5
9.0: G5
9.3: D5 B4
9.7: A4~1.3 C5~1.3
10.4: E5~1.1
10.9: B4
11.8: C5~1.1
12.5: D4~1.3 F4 F5 D5
12.9: B4
13.0: G4
13.4: A4~1.1 C5
13.9: B4
14.5: G5~2.0
16.7: D4~1.2 F4~1.3 C5 F5
17.1: A4
17.6: B4
18.0: A4
18.5: D5
19.0: A4
19.4: D4~1.0 F4~1.3 G4
19.9: A4
20.8: C4 D4 C5 D5
20.9: A3~2.6
21.3: F4 F5
21.7: G4
22.2: F4~1.2 F5~1.1
22.4: G5
23.6: D4~1.0 E4~1.2 Ab4 D5
23.8: E5
24.9: C4~1.0 C5~1.0
25.0: G3~3.0 D5
25.1: G4
25.4: E4
25.9: F4 F5
26.3: E4
26.8: A4
27.3: E4
27.7: D4 F4 D5
27.8: F3~1.2
28.2: E4
28.3: E5
28.6: D4 F4
28.7: D5~1.1
29.1: E3~1.6 G3~2.8 E4~2.4
29.2: G4
29.5: C4 C5
30.0: D4~1.7 D5
30.5: C4 C5
31.9: F4~1.5 A4~1.1 D3~1.6 B3
32.0: G3~1.8 F3 G4
32.6: G2~1.0
33.3: C4 E4 E5
33.7: E4 G4 D5
33.8: G3~3.7 E3~1.5
34.2: C4~1.9
34.3: E4~1.9 G4
34.6: E5~1.0 G5
36.0: C5~1.0 E5
37.8: A3~3.8 F2~3.9
37.9: F4~1.9 A4 D5 C4~1.8
38.3: E5
38.8: D5
39.7: F3~1.8
41.6: E2~4.1 E3
42.0: C4 G4 C5 D5
42.1: E4~0.9 G3~2.2
42.5: D4~1.2 D5~1.0
42.9: C4~1.0
43.0: G4 C5~1.3 E4~1.3 G5
44.3: E4~1.4 C4 C5~1.8 G4
44.4: G3~1.7 D5
45.1: E5
46.1: A3~3.5 F2~3.8
46.2: A4 D5 F4~2.1 C4~1.5
46.7: E5
47.1: D5~1.1
48.5: C5~1.4
49.9: G2~4.1 G3~1.2
50.3: E3~1.8 C4 C5 G4
50.5: E4 Bb3
50.8: D4 D5
51.2: C4
51.3: A4 C5 E4~1.7
51.9: D5~1.9
52.0: G5 G4
52.4: C5~1.7
53.3: D4 E4~1.0
53.8: G5
54.2: A3~3.1 A2
54.5: D4~1.1 B4 D5 A4 E4~2.0
54.6: E3~1.5
55.0: E5
55.4: D5~1.1
56.1: C4 C5
56.5: D4~1.5
57.0: E5~1.2
57.5: A4
58.2: D3~4.5 A2~2.9 Gb3~4.1
58.3: Gb4
58.4: Ab5
59.2: E4 A4 F4
60.1: D4 F4 A4 D5
60.5: C4
60.6: D4 F4 A4 D5
61.1: D4 F4 A4 D5
61.5: C4 C5 F5~1.3
61.6: F4 A4
62.0: C4 C5 F4 A4
`;

const ROW = 0.25, LANES = 4, CUTS = [55, 64, 71];
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOf(tok) {
  const m = /^([A-G])([b#]?)(\d)$/.exec(tok);
  return (parseInt(m[3], 10) + 1) * 12 + NAMES[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0);
}
const laneOf = m => { let l = 0; while (l < CUTS.length && m > CUTS[l]) l++; return l; };

const events = [];
SCORE.trim().split('\n').forEach(line => {
  const [t, rest] = line.split(':');
  const notes = rest.trim().split(/\s+/).map(tok => {
    const [n, h] = tok.split('~');
    return { midi: midiOf(n), sec: h ? parseFloat(h) : 0 };
  });
  events.push({ row: Math.round(parseFloat(t) / ROW), notes });
});

const rows = [];
const ensure = r => { while (rows.length <= r) rows.push(new Array(LANES).fill(null)); };
const busyUntil = new Array(LANES).fill(-1);
const placed = [];
events.forEach(ev => {
  ensure(ev.row);
  ev.notes.slice().sort((a, b) => a.midi - b.midi).forEach(n => {
    const base = laneOf(n.midi);
    const order = [base, base + 1, base - 1, base + 2, base - 2].filter(l => l >= 0 && l < LANES);
    const lane = order.find(l => !rows[ev.row][l] && busyUntil[l] < ev.row);
    if (lane === undefined) return;
    const cell = { type: 'tap', freq: 440 * Math.pow(2, (n.midi - 69) / 12), sustain: 0 };
    rows[ev.row][lane] = cell;
    placed.push({ row: ev.row, lane, cell, hold: n.sec >= 0.75 ? Math.round(n.sec / ROW) - 1 : 0 });
  });
});
placed.forEach(p => {
  if (p.hold < 1) return;
  let end = p.row + p.hold;
  for (let r = p.row + 1; r <= end; r++) {
    if (rows[r] && rows[r][p.lane]) { end = r - 2; break; }
  }
  const h = end - p.row;
  if (h >= 1) { p.cell.hold = h; }
});
const occupied = new Array(LANES).fill(-1);
placed.sort((a, b) => a.row - b.row).forEach(p => {
  if (!p.cell.hold) return;
  if (occupied[p.lane] >= p.row) { delete p.cell.hold; return; }
  occupied[p.lane] = p.row + p.cell.hold;
});

const level = {
  name: 'Clair de Lune',
  bpm: 240,
  diff: 'medium',
  lanes: LANES,
  instrument: 'piano',
  grid: rows,
  bgMode: 'none',
  laneFreqs: window.RD_Lanes.defaultFreqs(LANES),
  bassPattern: [],
  scrollRows: 8,
};
const code = window.RD_Codec.encodeLevel(level);
const back = window.RD_Codec.decodeLevel(code);
let n = 0, holds = 0;
back.grid.forEach(r => r.forEach(c => { if (c) { n++; if (c.hold) holds++; } }));
const out = path.join(REPO, 'Clair de Lune (hand-written) - RhythmDrop code.txt');
fs.writeFileSync(out, code);
console.log('wrote ' + out + ': ' + n + ' notes, ' + holds + ' holds, ' + rows.length + ' rows, ' + (rows.length * ROW).toFixed(0) + ' s');
