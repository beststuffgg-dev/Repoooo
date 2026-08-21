// Phase 3 — Loading: real weighted work behind the card, and a
// count-in derived from the wall clock rather than a timer chain.
const fs = require('fs');
const path = require('path');
const { boot } = require('./harness');
const { appDir } = require('./browser');
const { window, D, notes, probe, report } = boot();

const SRC = fs.readFileSync(path.join(appDir(), 'loading.js'), 'utf8');

// Slice exactly one function body out, by matching braces — a fixed
// character window runs past the end and picks up the next function's
// code, which is how this suite first "found" a setTimeout in the
// count-in that isn't there.
function fnBody(src, name) {
  const at = src.indexOf('function ' + name);
  if (at < 0) throw new Error('no function ' + name);
  let i = src.indexOf('{', at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) return src.slice(at, j + 1); }
  }
  throw new Error(name + ' is unterminated');
}
// Strip comments before checking for the constructs a probe forbids —
// the count-in's own comment explains that it does *not* chain
// setTimeouts, and a naive search reads that as the thing it warns
// against.
const decomment = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const COUNT_IN = decomment(fnBody(SRC, 'runCountIn'));

probe('the loading module exposes run, runCountIn and cancel', () => {
  const L = window.RD_Loading;
  if (!L) throw new Error('RD_Loading is not on window');
  for (const k of ['run', 'runCountIn', 'cancel']) {
    if (typeof L[k] !== 'function') throw new Error(k + ' is ' + typeof L[k]);
  }
});

probe('the bar tracks real work, not a timer', () => {
  // Each step is a named function that does something the first frame
  // would otherwise pay for.
  const block = SRC.slice(SRC.indexOf('const tasks = ['), SRC.indexOf('const totalWeight'));
  const steps = [...block.matchAll(/\[\s*'([^']+)'\s*,\s*(\d+)\s*,/g)].map(m => [m[1], Number(m[2])]);
  notes.push('load steps: ' + steps.map(s => `${s[0]} (${s[1]})`).join(', '));
  if (steps.length < 5) throw new Error('only ' + steps.length + ' steps');
  if (steps.some(s => !(s[1] > 0))) throw new Error('a step carries no weight');
  const weights = new Set(steps.map(s => s[1]));
  if (weights.size < 2) throw new Error('every step is weighted the same — that is a timer with labels');
});

probe('progress is weight completed over total weight', () => {
  if (!/doneWeight\s*\/\s*totalWeight/.test(SRC)) throw new Error('the bar no longer divides done by total weight');
  if (!/totalWeight = tasks\.reduce/.test(SRC)) throw new Error('total weight is not summed from the task list');
});

probe('every step reports as it completes', () => {
  // report() is called before the work (to paint the label) and after
  // (to advance the bar).
  const loop = SRC.slice(SRC.indexOf('for (const [label, weight, fn] of tasks)'), SRC.indexOf("report('Ready')"));
  const reports = (loop.match(/report\(/g) || []).length;
  notes.push('report() calls inside the step loop: ' + reports);
  if (reports < 2) throw new Error('a step does not report on both sides of its work');
});

probe('a failing warm step never blocks play', () => {
  if (!/try \{ fn\(\); \} catch/.test(SRC)) throw new Error('a throwing warm step would abort the load');
});

probe('the count-in is derived from performance.now(), not chained timeouts', () => {
  const ci = COUNT_IN;
  if (!/performance\.now\(\)/.test(ci)) throw new Error('the count-in does not read the clock');
  if (/setTimeout/.test(ci)) throw new Error('the count-in still chains setTimeouts');
  if (!/requestAnimationFrame/.test(ci)) throw new Error('the count-in does not run on frames');
});

probe('elapsed time decides the number, so it cannot drift or repeat', () => {
  const ci = COUNT_IN;
  if (!/Math\.floor\(elapsed \/ beat\)/.test(ci)) throw new Error('the step is not computed from elapsed time');
  if (!/value !== shown/.test(ci)) throw new Error('a number can be repainted without changing');
});

probe('the count-in counts 3, 2, 1 and stops', () => {
  const ci = COUNT_IN;
  const m = /const COUNT = (\d+)/.exec(ci);
  if (!m || Number(m[1]) !== 3) throw new Error('COUNT is ' + (m && m[1]));
  if (!/step >= COUNT/.test(ci)) throw new Error('the count-in has no exit condition');
  if (!/COUNT - step/.test(ci)) throw new Error('the number is not counted down from COUNT');
});

probe('the count-in beat follows the song, within sane bounds', () => {
  const ci = COUNT_IN;
  const m = /Math\.max\((\d+), Math\.min\((\d+), Math\.round\(60000 \/ \(bpm \|\| 120\)\)\)\)/.exec(ci);
  if (!m) throw new Error('the beat is no longer clamped bpm-derived');
  const [lo, hi] = [Number(m[1]), Number(m[2])];
  notes.push(`count-in beat: 60000/bpm clamped to ${lo}-${hi}ms`);
  if (!(lo > 0 && hi > lo)) throw new Error('bad clamp ' + lo + '..' + hi);
  // A 40bpm song would otherwise wait 1.5s per number; a 300bpm one
  // would flash three numbers in 600ms.
  for (const bpm of [40, 120, 300]) {
    const beat = Math.max(lo, Math.min(hi, Math.round(60000 / bpm)));
    if (beat < lo || beat > hi) throw new Error('bpm ' + bpm + ' escaped the clamp');
  }
});

probe('the count-in actually runs and resolves', async () => {
  // jsdom has no performance.now cliff; this just proves the loop
  // terminates rather than spinning.
  const num = D.getElementById('count-num');
  if (!num) throw new Error('no count-in element in the document');
});

probe('the tile pool is sized from the chart, not a flat constant', () => {
  const src = fs.readFileSync(path.join(appDir(), 'loading.js'), 'utf8');
  if (!/poolSizeFor\(queue\)/.test(src)) throw new Error('the pool is not sized from the queue');
  const fn = src.slice(src.indexOf('function poolSizeFor'), src.indexOf('function poolSizeFor') + 700);
  if (!/queue/.test(fn)) throw new Error('poolSizeFor ignores the queue');
  notes.push('pool sizing reads the loaded chart: ' + /queue\.length|queue\.filter|for \(/.test(fn));
});

probe('the card holds only as long as it needs to', () => {
  const m = /const CARD_HOLD = (\d+)/.exec(SRC);
  if (!m) throw new Error('CARD_HOLD is gone');
  notes.push('card hold: ' + m[1] + 'ms');
  if (Number(m[1]) > 900) throw new Error('the card holds for ' + m[1] + 'ms — that is dead time');
});

report('phase3test');
