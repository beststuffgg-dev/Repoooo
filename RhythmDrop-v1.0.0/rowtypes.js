window.RD_RowTypes = (function () {
  'use strict';

  const counts = row => {
    let tap = 0, dtap = 0;
    for (const c of row) if (c) (c.type === 'dtap' ? dtap++ : tap++);
    return { tap, dtap };
  };

  function uniformRowTypes(grid) {
    let total = 0, doubles = 0;
    for (const row of grid) {
      const n = counts(row);
      total += n.tap + n.dtap; doubles += n.dtap;
    }
    if (!total || !doubles) return grid;
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
        for (const c of row) if (c) { c.type = type; if (dtap) delete c.hold; }
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
