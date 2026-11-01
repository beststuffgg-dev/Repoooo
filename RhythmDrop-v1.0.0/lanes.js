(function () {
  const COUNTS = [4, 6, 8];

  const FREQS = {
    4: [261.63, 329.63, 392.00, 523.25],
    6: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
    8: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25],
  };

  const KEYS = {
    4: ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
    6: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH'],
    8: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'],
  };

  const MIN_WIDTH = { 4: 0, 6: 0, 8: 560 };

  function clamp(n) {
    n = Number(n) | 0;
    return n > 6 ? 8 : n > 4 ? 6 : 4;
  }

  function laneCountOf(lvl) {
    if (!lvl) return 4;
    if (lvl.lanes) return clamp(lvl.lanes);
    if (lvl.grid && lvl.grid.length && lvl.grid[0] && lvl.grid[0].length) return clamp(lvl.grid[0].length);
    if (lvl.laneFreqs && lvl.laneFreqs.length) return clamp(lvl.laneFreqs.length);
    return 4;
  }

  window.RD_Lanes = {
    COUNTS,
    clamp,
    laneCountOf,
    defaultFreqs: n => FREQS[clamp(n)].slice(),
    defaultKeys: n => KEYS[clamp(n)].slice(),
    minWidth: n => MIN_WIDTH[clamp(n)],
    emptyRow: n => new Array(clamp(n)).fill(null),
  };
})();
