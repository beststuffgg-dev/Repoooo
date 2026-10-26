// ═══════════════════════════════════════════
//  RhythmDrop V8 — rowtypes.js
//
//  One row, one kind of note. A tap and a ×2 slab never share a row.
//
//  The composer picks a type per note, so a chord could land a single
//  tap beside a double, and the player would have to hold two different
//  rhythms in one beat. This takes a finished grid and makes every row
//  uniform without touching a single lane, pitch, sustain or voice.
//
//  It is shared on purpose: the game runs it over every freshly
//  generated chart (play.js, generateLevel) and the baker runs it over
//  the campaign (other/tools/bake-levels.js). The composer itself stays
//  V7's, verbatim, so a fix to it keeps reaching V8.
//
//  No DOM, no randomness — the same grid always comes out the same.
//
//  Exposes: RD_RowTypes
// ═══════════════════════════════════════════
window.RD_RowTypes = (function () {
  'use strict';

  const counts = row => {
    let tap = 0, dtap = 0;
    for (const c of row) if (c) (c.type === 'dtap' ? dtap++ : tap++);
    return { tap, dtap };
  };

  // Rewrites `grid` in place and returns it.
  //
  // A mixed row takes whichever type it has more of, which retypes the
  // fewest notes. A tie has no majority, so it is steered by the song's
  // own original share of doubles: it becomes a double only while the
  // chart is running under that share. Breaking every tie the same way
  // instead moves a song's doubles by 5–8 points across the campaign;
  // steering holds the worst single song to 3.
  function uniformRowTypes(grid) {
    let total = 0, doubles = 0;
    for (const row of grid) {
      const n = counts(row);
      total += n.tap + n.dtap; doubles += n.dtap;
    }
    if (!total || !doubles) return grid;      // all taps, or all doubles
    const want = doubles / total;

    let placed = 0, placedDoubles = 0;
    for (const row of grid) {
      const n = counts(row), size = n.tap + n.dtap;
      if (!size) continue;
      let dtap = n.dtap > 0 && n.tap === 0;
      if (n.tap > 0 && n.dtap > 0) {
        dtap = n.dtap > n.tap ? true
             : n.dtap < n.tap ? false
             : (placed ? placedDoubles / placed : 0) < want;
        const type = dtap ? 'dtap' : 'tap';
        for (const c of row) if (c) c.type = type;
      }
      placed += size;
      if (dtap) placedDoubles += size;
    }
    return grid;
  }

  const isUniform = grid => grid.every(row => {
    const n = counts(row);
    return !(n.tap && n.dtap);
  });

  return { uniformRowTypes, isUniform };
})();
