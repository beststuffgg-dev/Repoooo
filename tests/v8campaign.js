// V8 progression: what a run is worth, what it unlocks, and the daily.
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
for (const f of ['levels.js', 'campaign.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx);
const C = sb.window.RD_Campaign;

console.log('== coins count levels cleared, not chart length ==');
{
  const paid = new Set();
  for (const a of C.AREAS) for (let i = 0; i < C.LEVELS_PER_AREA; i++) {
    paid.add(C.coinsFor(C.levelAt(a.id, i), { completed: true }));
  }
  notes.push('distinct clear payouts across all 150 levels: ' + [...paid].join(', '));
  ok(paid.size === 1, 'every level pays the same on a clear');
  ok([...paid][0] === C.COINS_PER_CLEAR, 'and that is COINS_PER_CLEAR (' + C.COINS_PER_CLEAR + ')');

  // The shortest and longest charts differ by a factor of 14 in notes.
  let shortest = null, longest = null;
  for (const a of C.AREAS) for (let i = 0; i < C.LEVELS_PER_AREA; i++) {
    const l = C.levelAt(a.id, i), n = C.countNotes(l);
    if (!shortest || n < C.countNotes(shortest)) shortest = l;
    if (!longest  || n > C.countNotes(longest))  longest = l;
  }
  notes.push(`shortest ${C.countNotes(shortest)} notes, longest ${C.countNotes(longest)} — both pay `
    + C.coinsFor(longest, { completed: true }));
  ok(C.coinsFor(shortest, { completed: true }) === C.coinsFor(longest, { completed: true }),
    'a 52-note chart and a 758-note chart pay the same');
}

console.log('== a run that ends early pays for what it played ==');
{
  const l = C.levelAt(1, 0);
  ok(C.coinsFor(l, { completed: false, progress: 0.5 }) === 75, 'half a chart pays half');
  ok(C.coinsFor(l, { completed: false, progress: 0 }) === 0, 'quitting on the first note pays nothing');
  ok(C.coinsFor(l, { completed: false, progress: 9 }) === 150, 'over-100% progress cannot overpay');
  ok(C.coinsFor(l, { completed: false, progress: -3 }) === 0, 'negative progress cannot mint coins');
}

console.log('== XP tracks the chart, and finishing beats dying ==');
{
  const l = C.levelAt(1, 0);
  const full = C.xpFor(l, { completed: true });
  const half = C.xpFor(l, { completed: false, progress: 0.5 });
  notes.push('area 1 level 1: ' + full + ' XP cleared, ' + half + ' XP at half');
  ok(full > half, 'clearing pays more than getting halfway');
  // Speed is in the formula, not bolted on: it should stay linear.
  const base = C.xpFor(l, { completed: true, speedMult: 1 });
  for (const m of [1.5, 2, 3]) {
    const got = C.xpFor(l, { completed: true, speedMult: m });
    ok(Math.abs(got - base * m) <= Math.max(2, base * m * 0.01),
      'speed ' + m + '× pays ' + m + '× (' + got + ' vs ' + Math.round(base * m) + ')');
  }
  // Later areas are worth more than the first.
  const early = C.xpFor(C.levelAt(1, 0), { completed: true });
  const late  = C.xpFor(C.levelAt(10, 14), { completed: true });
  notes.push('area 1 level 1: ' + early + ' XP; area 10 level 15: ' + late + ' XP');
  ok(late > early, 'a late-campaign song is worth more than the first one');
}

console.log('== a wall of notes does not out-earn a song ==');
{
  const rows = 100;
  const solid = { bpm: 120, campaign: true, areaId: 1,
    grid: Array.from({ length: rows }, () => Array.from({ length: 4 },
      () => ({ type: 'tap', freq: 440, sustain: 0 }))) };
  const filled = C.fillOf(solid);
  const paid = C.payableNotes(solid);
  notes.push('a fully-filled ' + rows + '-row grid: ' + (filled * 100).toFixed(0) + '% full, '
    + C.countNotes(solid) + ' notes but only ' + paid.toFixed(0) + ' payable');
  ok(filled === 1, 'the test chart really is a solid wall');
  ok(paid < C.countNotes(solid), 'notes past the density cap pay a fraction');
  ok(C.DENSITY_CAP === 0.85, 'the cap is 85%');
}

console.log('== the XP curve climbs ==');
{
  const lv = [1, 2, 5, 10, 25, 50].map(n => C.xpForLevel(n));
  notes.push('XP to reach L1/2/5/10/25/50: ' + lv.join(' / '));
  ok(lv[0] === 0, 'level 1 costs nothing');
  ok(lv.every((v, i) => i === 0 || v > lv[i - 1]), 'every level costs more than the one before');
  ok(C.levelFromXp(0) === 1, 'zero XP is level 1');
  ok(C.levelFromXp(C.xpForLevel(5)) === 5, 'landing exactly on a threshold is that level');
  ok(C.levelFromXp(C.xpForLevel(5) - 1) === 4, 'one XP short is the level below');
  const p = C.levelProgress(C.xpForLevel(3) + 10);
  ok(p.level === 3 && p.into === 10 && p.pct > 0 && p.pct < 1, 'progress into a level reads correctly');
}

console.log('== unlocking chains, and cannot be skipped ==');
{
  const prog = { xp: 0, cleared: {} };
  ok(C.isAreaUnlocked(prog, 1), 'area 1 is open from the start');
  ok(!C.isAreaUnlocked(prog, 2), 'area 2 is not');
  ok(C.isLevelUnlocked(prog, 1, 0), 'the first song is open');
  ok(!C.isLevelUnlocked(prog, 1, 1), 'the second is not');
  ok(!C.isLevelUnlocked(prog, 1, 14), 'and neither is the last one');

  prog.cleared[C.levelKey(1, 0)] = true;
  ok(C.isLevelUnlocked(prog, 1, 1), 'clearing one opens the next');
  ok(!C.isLevelUnlocked(prog, 1, 2), 'but only the next');

  for (let i = 0; i < C.LEVELS_PER_AREA; i++) prog.cleared[C.levelKey(1, i)] = true;
  ok(C.areaCleared(prog, 1), 'finishing fifteen finishes the area');
  ok(C.isAreaUnlocked(prog, 2), 'which opens the next area');
  ok(!C.isAreaUnlocked(prog, 3), 'and only the next area');
  ok(C.clearedCount(prog) === 15, 'cleared count is ' + C.clearedCount(prog));
}

console.log('== the daily runs seven days and lapses on a miss ==');
{
  const DAY = 86400000;
  const t0 = Date.now();
  let daily = null, total = 0;
  const seen = [];
  for (let d = 0; d < 7; d++) {
    const r = C.claimDaily(daily, t0 + d * DAY);
    daily = r.daily; total += r.coins; seen.push(r.coins);
  }
  notes.push('seven days in a row: ' + seen.join(' + ') + ' = ' + total + ' coins');
  ok(seen.every(c => c > 0), 'each of the seven days pays');
  ok(seen[6] > seen[0], 'day seven pays more than day one');

  // Claiming twice in one day pays once.
  const again = C.claimDaily(daily, t0 + 6 * DAY);
  ok(again.coins === 0, 'a second claim on the same day pays nothing');

  // Missing a day restarts the run.
  const lapsed = C.dailyState(daily, t0 + 9 * DAY);
  ok(lapsed.claimable && lapsed.streak === 1, 'missing a day starts the cycle over (streak ' + lapsed.streak + ')');

  // And an unbroken run caps rather than running off the end of the table.
  let long = null;
  for (let d = 0; d < 20; d++) long = C.claimDaily(long, t0 + d * DAY).daily;
  const st = C.dailyState(long, t0 + 20 * DAY);
  ok(st.reward > 0 && st.streak <= 7, 'a 20-day run stays inside the seven-day table (streak ' + st.streak + ')');
}

console.log('\n--- notes ---');
notes.forEach(l => console.log('  ' + l));
console.log('\n' + (fail ? `v8campaign: ${fail} of ${pass + fail} probes FAILED` : `v8campaign: all ${pass} probes passed`));
process.exit(fail ? 1 : 0);
