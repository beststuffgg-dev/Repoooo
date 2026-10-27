#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const srcDir = path.resolve(ROOT, process.argv[2] || 'RhythmDrop/RhythmDropV8');
const outFile = path.resolve(ROOT, process.argv[3] || 'htmls/RhythmDrop.html');

const SRC_TAG = /<script\s+src="([^"]+)"\s*><\/script>/g;

function build() {
  const popup = path.join(srcDir, 'popup.html');
  if (!fs.existsSync(popup)) throw new Error('no popup.html in ' + srcDir);
  const html = fs.readFileSync(popup, 'utf8');

  const tags = html.match(SRC_TAG);
  if (!tags || !tags.length) throw new Error('no <script src> tags in ' + popup);

  const inlined = [];
  const out = html.replace(SRC_TAG, (whole, src) => {
    const file = path.join(srcDir, src);
    if (!fs.existsSync(file)) throw new Error('script not found: ' + file);
    const code = fs.readFileSync(file, 'utf8');
    if (/<\/script/i.test(code)) throw new Error('"</script" appears inside ' + src);
    inlined.push(src + ' (' + code.length.toLocaleString() + ' chars)');
    return '<script data-from="' + src + '">\n' + code + '\n</script>';
  });

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
