// Builds RhythmDrop.html: popup.html with every <script src> replaced by
// the file's contents, so the whole game is one file you can open
// anywhere. Nothing else about the page changes.
const fs = require('fs');
const path = require('path');

// Defaults build the shipping game; pass a source folder and an output
// path to build a variant (e.g. the Redesign).
//   node tools/build-single.js RhythmDropV7-Redesign RhythmDrop-Redesign.html
const SRC = process.argv[2] || path.join(__dirname, '..', 'RhythmDropV7');
const OUT = process.argv[3] || path.join(__dirname, '..', 'RhythmDrop.html');

let html = fs.readFileSync(path.join(SRC, 'popup.html'), 'utf8');

const tag = /<script src="([^"]+)"><\/script>\n?/g;
const inlined = [];
html = html.replace(tag, (_, file) => {
  const js = fs.readFileSync(path.join(SRC, file), 'utf8');
  inlined.push(file);
  return `<script data-from="${file}">\n${js}\n</script>\n`;
});

if (!inlined.length) throw new Error('no <script src> tags found — did popup.html change shape?');
if (/<script src=/.test(html)) throw new Error('a <script src> survived the inline pass');

fs.writeFileSync(OUT, html);
console.log('inlined ' + inlined.length + ': ' + inlined.join(', '));
console.log(OUT + '  ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
