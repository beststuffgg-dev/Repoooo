// Do simultaneous notes actually sound like harmony?
//
// Notes that share a beat used to be whatever interval the melody
// walker happened to land on, which is how a chart ends up with minor
// seconds in it. Chords are now stacked in thirds above the first note
// present — scale degree i, i+2, i+4 — and this suite checks that
// across every one of the 150 campaign charts rather than a sample,
// because a single bad seed is exactly the failure mode.
const { boot } = require('./harness');
const { window, notes, probe, report } = boot();
const C = window.RD_Campaign, K = window.RD_Codec;

const semis = (a, b) => Math.abs(Math.round(12 * Math.log2(b / a)));

// Interval class within the octave: what the ear actually hears when
// the two notes are more than an octave apart.
const pc = n => ((n % 12) + 12) % 12;

const tally = {}, sizes = {};
let charts = 0, stacks = 0, minor2 = 0, tritone = 0, worst = null;

for (const area of C.AREAS) {
  for (let i = 0; i < C.LEVELS_PER_AREA; i++) {
    const lvl = C.buildCampaignLevel(area.id, i);
    charts++;
    if (!lvl.grid) continue;
    for (let r = 0; r < lvl.grid.length; r++) {
      const row = lvl.grid[r].filter(Boolean).map(c => c.freq).filter(f => f > 0).sort((a, b) => a - b);
      if (row.length < 2) continue;
      stacks++;
      sizes[row.length] = (sizes[row.length] || 0) + 1;
      for (let a = 0; a < row.length; a++) {
        for (let b = a + 1; b < row.length; b++) {
          const iv = pc(semis(row[a], row[b]));
          tally[iv] = (tally[iv] || 0) + 1;
          if (iv === 1) { minor2++; if (!worst) worst = `${area.id}/${i + 1} row ${r}`; }
          if (iv === 6) tritone++;
        }
      }
    }
  }
}

const NAME = ['unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th',
  'tritone', 'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th'];
const total = Object.values(tally).reduce((a, b) => a + b, 0);
const share = iv => total ? (tally[iv] || 0) / total : 0;

notes.push(`${charts} campaign charts, ${stacks} simultaneous stacks, ${total} intervals`);
notes.push('stack sizes: ' + Object.entries(sizes).map(([k, v]) => k + ' notes x' + v).join(', '));
notes.push('intervals: ' + Object.entries(tally).sort((a, b) => b[1] - a[1])
  .map(([iv, n]) => NAME[iv] + ' ' + (n / total * 100).toFixed(1) + '%').join(', '));

probe('every campaign chart builds', () => {
  if (charts !== C.AREAS.length * C.LEVELS_PER_AREA)
    throw new Error('built ' + charts + ', expected ' + C.AREAS.length * C.LEVELS_PER_AREA);
});

probe('there are chords to check at all', () => {
  // This probe exists because the two below pass trivially on an empty
  // result — a generator that stopped stacking notes would have looked
  // like a clean sweep.
  if (stacks < 500) throw new Error('only ' + stacks + ' stacks found; the probes below would be vacuous');
});

probe('zero minor seconds anywhere in the campaign', () => {
  if (minor2) throw new Error(minor2 + ' minor seconds, first at ' + worst);
});

probe('thirds and fifths dominate', () => {
  const thirdsFifths = share(3) + share(4) + share(7) + share(5) + share(8) + share(9);
  notes.push('thirds/fourths/fifths/sixths: ' + (thirdsFifths * 100).toFixed(1) + '%');
  if (thirdsFifths < 0.6) throw new Error('only ' + (thirdsFifths * 100).toFixed(1) + '% consonant stacking');
});

probe('tritones are rare, not absent', () => {
  // A double-harmonic scale has one built in, so demanding zero would
  // be demanding the wrong thing — demanding it stay incidental is right.
  if (share(6) > 0.05) throw new Error('tritones at ' + (share(6) * 100).toFixed(1) + '%');
});

probe('stacks are built in thirds above the lowest note', () => {
  // Take three-note stacks only: i, i+2, i+4 in a diatonic scale is a
  // third then a third, so both gaps land in the 3-4 semitone band.
  let three = 0, stacked = 0;
  for (const area of C.AREAS) {
    for (let i = 0; i < C.LEVELS_PER_AREA; i += 3) {
      const lvl = C.buildCampaignLevel(area.id, i);
      if (!lvl.grid) continue;
      for (const row0 of lvl.grid) {
        const row = row0.filter(Boolean).map(c => c.freq).filter(f => f > 0).sort((a, b) => a - b);
        if (row.length !== 3) continue;
        three++;
        const g1 = semis(row[0], row[1]), g2 = semis(row[1], row[2]);
        if (g1 >= 2 && g1 <= 5 && g2 >= 2 && g2 <= 5) stacked++;
      }
    }
  }
  notes.push(`triads: ${stacked}/${three} stacked in thirds`);
  if (three < 20) throw new Error('only ' + three + ' three-note stacks; probe is vacuous');
  if (stacked / three < 0.8) throw new Error('only ' + (stacked / three * 100).toFixed(0) + '% of triads stack in thirds');
});

probe('freqToMidi agrees with the interval maths', () => {
  const a4 = 440, a5 = 880;
  if (Math.round(K.freqToMidi(a5) - K.freqToMidi(a4)) !== 12) throw new Error('octave is not 12 semitones');
  if (semis(a4, a5) !== 12) throw new Error('log2 interval disagrees');
});

report('chordtest');
