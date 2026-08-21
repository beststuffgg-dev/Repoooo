// Per-level best scores: every level keeps its own record, and a
// record on level 7 survives fifty better runs elsewhere.
//
// The old build kept a single top-50 log, so a personal best was
// evicted by unrelated runs. This checks the replacement, and the
// one-time lift of the old log into it.
const { boot } = require('./harness');
const HOOK = `
;window.__t = {
  store, bestFor, recordLevelBest, levelKeyFor,
  get profile(){return profile},
};`;

const OLD_SCORES = Array.from({ length: 30 }, (_, i) => ({
  level: 'Old Song ' + i, score: 1000 + i * 10, coins: 5, date: 1700000000000 + i,
}));

const { window, notes, probe, report, T } = boot({
  hook: HOOK,
  storage: { rd_scores: OLD_SCORES, rd_profile: { username: 'P', coins: 0 } },
});
const C = window.RD_Campaign;

const lvl = (name, rows) => ({ name, bpm: 120, grid: Array.from({ length: rows }, () => [{ type: 'tap', freq: 440, sustain: 0 }, null, null, null]) });

probe('the old top-50 log was lifted into per-level records', () => {
  if (!window.localStorage.getItem('rd_bests_migrated')) throw new Error('migration did not run');
  const bests = T().store.loadBests();
  const lifted = Object.keys(bests).filter(k => k.startsWith('n:'));
  notes.push(`migrated ${lifted.length} records out of ${OLD_SCORES.length} old rows`);
  if (lifted.length !== OLD_SCORES.length) throw new Error('lifted ' + lifted.length);
});

probe('migration runs once, not on every boot', () => {
  // The flag is what stops a later, worse run being overwritten by a
  // stale row from the old log.
  if (window.localStorage.getItem('rd_bests_migrated') !== '1') throw new Error('flag not set');
});

probe('a migrated record is readable through bestFor', () => {
  const got = T().bestFor(lvl('Old Song 3', 40));
  if (!got) throw new Error('no record found for a migrated level');
  if (got.score !== 1030) throw new Error('score came back as ' + got.score);
});

probe('every level keeps its own record — no top-N eviction', () => {
  const mine = lvl('Mine', 40);
  T().recordLevelBest(mine, 4242, 150);
  // Fifty better runs on other levels.
  for (let i = 0; i < 50; i++) T().recordLevelBest(lvl('Other ' + i, 40), 90000 + i, 150);
  const got = T().bestFor(mine);
  notes.push('records held after 50 unrelated runs: ' + Object.keys(T().store.loadBests()).length);
  if (!got || got.score !== 4242) throw new Error('the record was evicted: ' + JSON.stringify(got));
});

probe('a worse run does not overwrite the record', () => {
  const l = lvl('Keep', 40);
  T().recordLevelBest(l, 5000, 10);
  const beat = T().recordLevelBest(l, 4000, 10);
  if (beat) throw new Error('a worse run reported beating the record');
  if (T().bestFor(l).score !== 5000) throw new Error('the record was lowered to ' + T().bestFor(l).score);
});

probe('a better run does overwrite it, and says so', () => {
  const l = lvl('Beat', 40);
  T().recordLevelBest(l, 5000, 10);
  if (!T().recordLevelBest(l, 6000, 20)) throw new Error('beating the record returned false');
  const got = T().bestFor(l);
  if (got.score !== 6000 || got.coins !== 20) throw new Error(JSON.stringify(got));
});

probe('campaign levels key off their identity, not their name', () => {
  const a = C.buildCampaignLevel(1, 0), b = C.buildCampaignLevel(2, 0);
  const ka = T().levelKeyFor(a), kb = T().levelKeyFor(b);
  if (!ka || !kb) throw new Error('a campaign level has no record key');
  if (ka === kb) throw new Error('two different campaign levels share the key ' + ka);
});

probe('two customs with the same name but different lengths stay apart', () => {
  const a = lvl('Same', 40), b = lvl('Same', 80);
  T().recordLevelBest(a, 111, 1);
  T().recordLevelBest(b, 222, 1);
  if (T().bestFor(a).score !== 111 || T().bestFor(b).score !== 222)
    throw new Error('records collided: ' + T().bestFor(a).score + ' / ' + T().bestFor(b).score);
});

probe('a level with no record reads as null, not zero', () => {
  // Zero would render as a real personal best of nothing.
  if (T().bestFor(lvl('Never Played', 40)) !== null) throw new Error('an unplayed level reported a record');
});

probe('every campaign level can hold a record', () => {
  let keyed = 0;
  const keys = new Set();
  for (const area of C.AREAS) {
    for (let i = 0; i < C.LEVELS_PER_AREA; i++) {
      const k = T().levelKeyFor(C.buildCampaignLevel(area.id, i));
      if (k) { keyed++; keys.add(k); }
    }
  }
  notes.push(`${keyed} campaign levels keyed, ${keys.size} distinct`);
  if (keyed !== 150) throw new Error('only ' + keyed + ' levels produced a key');
  if (keys.size !== 150) throw new Error('key collisions: ' + keys.size + ' distinct keys for 150 levels');
});

report('beststest');
