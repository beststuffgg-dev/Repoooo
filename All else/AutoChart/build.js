#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..', '..');
const V9 = path.join(REPO, 'RhythmDropV9');
const files = [
  path.join(V9, 'lanes.js'), path.join(V9, 'codec.js'), path.join(V9, 'voices.js'), path.join(V9, 'audio.js'),
  path.join(V9, 'studio-dsp.js'), path.join(__dirname, 'autochart.js'), path.join(__dirname, 'app.js'),
];
const scripts = files.map(f => fs.readFileSync(f, 'utf8').replace(/<\/script>/gi, '<\\/script>')).join('\n;\n');
const html = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf8').replace('/*SCRIPTS*/', () => scripts);
const out = path.join(REPO, 'Auto Level Generator.html');
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' (' + (html.length / 1024).toFixed(0) + ' KB)');
