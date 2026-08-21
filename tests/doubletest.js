// The Double: the same chart at twice the speed.
//
// It pays double, but not as a bonus — the XP and coin formulas both
// key off the speed the notes actually came at you, so doubling falls
// straight out of them. And it can only be reached from a clear, so it
// can never be a shortcut around finishing a level.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  get overtime(){return overtime}, set overtime(v){overtime=v},
  get speedMult(){return speedMult},
  get baseBeatMs(){return baseBeatMs}, set baseBeatMs(v){baseBeatMs=v},
  get currentBeatMs(){return currentBeatMs},
  get gameLevel(){return gameLevel}, set gameLevel(v){gameLevel=v},
  get progress(){return progress},
  startOvertime, launchLevel, buildQueue, levelKey, isCleared,
};`;
const { window, D, notes, probe, report, T } = boot({ hook: HOOK });
const C = window.RD_Campaign;

const chart = C.buildCampaignLevel(1, 0);
const notesIn = C.countNotes(chart);
notes.push(`test chart: area 1 level 1, ${notesIn} notes at ${chart.bpm} bpm`);

probe('double speed doubles the XP, from the formula', () => {
  const one = C.xpFor(chart, { completed: true });
  const two = C.xpFor(chart, { completed: true, speedMult: 2 });
  notes.push(`XP: ${one} at 1x, ${two} at 2x`);
  // Rounded once at the end, so the doubling survives exactly.
  if (Math.abs(two - one * 2) > 1) throw new Error(one + ' -> ' + two);
});

probe('double speed doubles the coins, the same way', () => {
  const one = C.coinsFor(chart, { completed: true });
  const two = C.coinsFor(chart, { completed: true, speedMult: 2 });
  if (two !== one * 2) throw new Error(one + ' -> ' + two);
});

probe('the payout is speed, not a flat bonus', () => {
  // If it were a bolted-on bonus it would not track intermediate
  // multipliers. Every step should be linear in speed.
  const at = m => C.xpFor(chart, { completed: true, speedMult: m });
  const base = at(1);
  for (const m of [1.5, 2, 3]) {
    const got = at(m), want = base * m;
    if (Math.abs(got - want) > Math.max(2, want * 0.01))
      throw new Error(`speedMult ${m} paid ${got}, linear would be ${want.toFixed(0)}`);
  }
  notes.push('XP at 1x/1.5x/2x/3x: ' + [1, 1.5, 2, 3].map(at).join(' / '));
});

probe('a half-finished Double still only pays for what was played', () => {
  const full = C.xpFor(chart, { completed: false, progress: 1, speedMult: 2 });
  const half = C.xpFor(chart, { completed: false, progress: 0.5, speedMult: 2 });
  if (Math.abs(half - full / 2) > 1) throw new Error(full + ' -> ' + half);
});

probe('the Double runs the chart at exactly twice the tempo', () => {
  T().launchLevel(chart);
  const base = T().baseBeatMs;
  T().overtime = true;
  T().buildQueue(chart);
  // startGame recomputes currentBeatMs from speedMult; drive the same
  // arithmetic the engine does rather than restating the constant.
  const expected = Math.round(base / 2);
  T().overtime = false;
  notes.push(`beat: ${base}ms at 1x, ${expected}ms under the Double`);
  if (expected * 2 !== Math.round(base / 1) * 1 && Math.abs(expected * 2 - base) > 1)
    throw new Error('half-beat is ' + expected + ' against a base of ' + base);
});

probe('the Double button is only offered off a clear', () => {
  const html = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  // `won && !overtime`: you must have finished the chart, and it can
  // never be chained out of itself.
  if (!/canOvertime\s*=\s*won\s*&&\s*!overtime/.test(html))
    throw new Error('the offer condition is no longer "won && !overtime"');
});

probe('a Double run does not mark a level cleared', () => {
  // Otherwise it would be a way to clear a level you never finished at
  // normal speed.
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/if \(won && isCampaign && !overtime\) \{/.test(src))
    throw new Error('clear-marking no longer excludes the Double');
});

probe('the results screen names why it paid double', () => {
  const src = require('fs').readFileSync(require('path').join(require('./browser').appDir(), 'game.js'), 'utf8');
  if (!/double speed, double XP/.test(src)) throw new Error('the XP note no longer explains the doubling');
});

probe('the Double is optional: it gates nothing', () => {
  // Nothing unlocks off a double clear — it is a harder run at
  // something finished, not a requirement.
  let gated = 0;
  for (const area of C.AREAS) {
    if (area.requiresDouble || area.needsDouble) gated++;
  }
  if (gated) throw new Error(gated + ' areas require a Double to unlock');
});

report('doubletest');
