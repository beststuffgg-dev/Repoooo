#!/usr/bin/env node
// Builds the single-file game: every <script src="..."> in popup.html
// is replaced, in place, by the contents of that file. The result opens
// from a double-click, a phone browser or any static host, and makes
// zero network requests.
//
//   node other/tools/build-single.js         -> htmls/RhythmDrop.html
//   node other/tools/build-single.js other/RhythmDropV7-Redesign htmls/RhythmDrop-Redesign.html
//
// Both arguments are resolved from the repo root. The .html builds are
// generated, never hand-maintained: edit the source folder and re-run
// this (or tools/package.sh, which does everything).
'use strict';
const fs = require('fs');
const path = require('path');

// tools/ lives under other/, so the repo root is two levels up.
const ROOT = path.join(__dirname, '..', '..');
const srcDir = path.resolve(ROOT, process.argv[2] || 'other/RhythmDropV7');
const outFile = path.resolve(ROOT, process.argv[3] || 'htmls/RhythmDrop.html');

const SRC_TAG = /<script\s+src="([^"]+)"\s*><\/script>/g;

function build() {
  const popup = path.join(srcDir, 'popup.html');
  if (!fs.existsSync(popup)) throw new Error('no popup.html in ' + srcDir);
  const html = fs.readFileSync(popup, 'utf8');

  const tags = html.match(SRC_TAG);
  // A silent zero-match pass writes a file that looks fine and loads
  // nothing. Fail loudly instead.
  if (!tags || !tags.length) throw new Error('no <script src> tags in ' + popup);

  const inlined = [];
  const out = html.replace(SRC_TAG, (whole, src) => {
    const file = path.join(srcDir, src);
    if (!fs.existsSync(file)) throw new Error('script not found: ' + file);
    const code = fs.readFileSync(file, 'utf8');
    // A literal </script> anywhere in the source would close the tag
    // early and dump the rest of the file into the document as text.
    if (/<\/script/i.test(code)) throw new Error('"</script" appears inside ' + src);
    inlined.push(src + ' (' + code.length.toLocaleString() + ' chars)');
    return '<script data-from="' + src + '">\n' + code + '\n</script>';
  });

  // Belt and braces: if any src tag survived the pass, the output would
  // silently try to fetch a file that isn't next to it.
  SRC_TAG.lastIndex = 0;
  if (SRC_TAG.test(out)) throw new Error('a <script src> tag survived inlining');

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, out);
  return { inlined, bytes: Buffer.byteLength(out) };
}

const r = build();
console.log(path.relative(ROOT, srcDir) + ' -> ' + path.relative(ROOT, outFile));
r.inlined.forEach(l => console.log('  inlined ' + l));
console.log('  ' + r.bytes.toLocaleString() + ' bytes, 0 network requests');
