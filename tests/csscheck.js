const fs = require('fs');
const path = require('path');
const { appDir } = require('./browser');

const DIR = appDir();
const html = fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8');

let pass = 0, fail = 0;
const notes = [];
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL: ' + m)); if (c) console.log('  ok: ' + m); };

const sheets = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
ok(sheets.length > 0, `found ${sheets.length} <style> block(s)`);
const css = sheets.join('\n');
notes.push(`${css.split('\n').length} lines of CSS, ${css.length.toLocaleString()} chars`);

const lineAt = i => css.slice(0, i).split('\n').length;

{
  let i = 0, open = 0, bad = null, count = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      count++;
      const end = css.indexOf('*/', i + 2);
      if (end < 0) { open++; bad = lineAt(i); break; }
      i = end + 2;
    } else if (css.startsWith('*/', i)) {
      bad = lineAt(i); open++; break;
    } else i++;
  }
  notes.push(count + ' comments');
  ok(open === 0, bad ? `unbalanced comment at line ${bad}` : 'every comment is closed, and none closes twice');
}

const bare = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
{
  let depth = 0, worst = 0, badLine = null;
  for (let i = 0; i < bare.length; i++) {
    const c = bare[i];
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < bare.length && bare[i] !== q) { if (bare[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '{') { depth++; worst = Math.max(worst, depth); }
    else if (c === '}') { depth--; if (depth < 0 && badLine === null) badLine = lineAt(i); }
  }
  ok(badLine === null, badLine ? `a } closes nothing at line ${badLine}` : 'no unmatched closing brace');
  ok(depth === 0, depth === 0 ? 'every block is closed' : `${depth} block(s) left open at end of sheet`);
  notes.push('deepest nesting: ' + worst + ' (at-rules inside at-rules)');
}

{
  let depth = 0, orphans = [], buf = '', start = 0;
  for (let i = 0; i < bare.length; i++) {
    const c = bare[i];
    if (c === '"' || c === "'") { const q = c; i++; while (i < bare.length && bare[i] !== q) { if (bare[i] === '\\') i++; i++; } continue; }
    if (c === '{') { depth++; buf = ''; continue; }
    if (c === '}') { depth--; buf = ''; continue; }
    if (depth === 0) {
      if (c === ';') {
        const t = buf.trim();
        if (t && !t.startsWith('@')) orphans.push(lineAt(start) + ': ' + t.slice(0, 60));
        buf = '';
      } else {
        if (!buf.trim()) start = i;
        buf += c;
      }
    }
  }
  ok(orphans.length === 0, orphans.length ? `${orphans.length} declaration(s) outside any rule: ${orphans.slice(0, 3).join(' | ')}` : 'no rule orphaned outside a block');
}

{
  let bad = [];
  const re = /(^|[};])\s*\{/g;
  let m;
  while ((m = re.exec(bare))) bad.push(lineAt(m.index));
  ok(bad.length === 0, bad.length ? `${bad.length} block(s) with no selector, first at line ${bad[0]}` : 'every block has a selector');
}

{
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<style>' + css + '</style>');
  const sheet = dom.window.document.styleSheets[0];
  const count = sheet ? sheet.cssRules.length : 0;
  notes.push('cssom parsed ' + count + ' top-level rules');
  const selectors = (bare.match(/\{/g) || []).length;
  ok(count > 400, `the CSSOM kept ${count} top-level rules out of ~${selectors} blocks`);
}

{
  const required = ['--r-1', '--r-2', '--r-3', '--lift-1', '--lift-2', '--lift-3',
    '--bevel-lit', '--ease-out', '--tap', '--dtap', '--mat-spec', '--mat-gloss', '--mat-bevel', '--mat-grain',
    '--sel-glow', '--sel-glow-good', '--sel-glow-arm'];
  const missing = required.filter(t => !new RegExp('\\' + t + '\\s*:').test(bare));
  ok(missing.length === 0, missing.length ? 'undeclared design tokens: ' + missing.join(', ') : `all ${required.length} structural tokens are declared`);
}
{
  const declared = new Set([...bare.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const runtime = new Set();
  for (const f of ['game.js', 'lighting.js', 'audio.js', 'loading.js', 'edge.js']) {
    const p2 = path.join(DIR, f);
    if (!fs.existsSync(p2)) continue;
    for (const m of fs.readFileSync(p2, 'utf8').matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) runtime.add(m[1]);
  }
  const used = new Set([...bare.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map(m => m[1]));
  const undef = [...used].filter(t => !declared.has(t) && !runtime.has(t));
  notes.push(runtime.size + ' tokens written from JS at runtime');
  notes.push(`${declared.size} tokens declared, ${used.size} referenced`);
  ok(undef.length === 0, undef.length ? 'var() references nothing declares: ' + undef.join(', ') : 'every var() resolves to a declared token');
}

{
  const rules = bare.split('}');
  const offenders = rules.filter(r => {
    const sel = r.split('{')[0] || '';
    const body = r.split('{')[1] || '';
    if (!/\.(selected|active|armed|equipped|cleared|done)\b/.test(sel)) return false;
    if (/:focus-visible/.test(sel)) return false;
    return /border-color\s*:\s*var\(--(accent|tap|dtap|perfect|good)\)/.test(body);
  }).map(r => (r.split('{')[0] || '').trim().slice(0, 60));
  notes.push(offenders.length ? 'outline-style selection still on: ' + offenders.join(' | ') : 'selection is shadow-based throughout');
  ok(offenders.length === 0, offenders.length === 0
    ? 'every selection state is a glow beneath, not a recoloured border'
    : `${offenders.length} components still signal selection with a border colour: ${offenders.join(' | ')}`);
}

console.log('\n--- notes ---');
notes.forEach(l => console.log('  ' + l));
console.log('\n--- errors ---\n  ' + (fail ? fail + ' failed' : 'none'));
console.log('\n' + (fail ? 'csscheck: FAILED' : `csscheck: all ${pass} probes passed`));
process.exit(fail ? 1 : 0);
