#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FIT = path.join(__dirname, 'out', 'fit.json');
const OUT = path.join(__dirname, '..', '..', '..', 'RhythmDropV9', 'voices.js');
const ORDER = ['violin', 'cello', 'flute', 'clarinet', 'trumpet', 'horn', 'harp', 'piano'];

const fit = JSON.parse(fs.readFileSync(FIT, 'utf8'));
const r1 = v => Math.round(v * 10) / 10;
const trim = arr => {
  const a = arr.map(v => Math.round(v));
  while (a.length > 4 && a[a.length - 1] <= -58) a.pop();
  return a;
};

const out = {};
for (const id of ORDER) {
  const v = fit[id];
  if (!v) continue;
  const o = { kind: v.kind, attack: v.attack, zones: [] };
  if (v.vib) o.vib = v.vib;
  if (v.noise) o.noise = v.noise;
  if (v.bright0) o.bright0 = v.bright0;
  for (const z of v.zones) {
    const zz = { m: Math.round(z.m * 100) / 100, h: trim(z.h), g: z.g };
    if (z.hl && JSON.stringify(z.hl) !== JSON.stringify(z.h)) { zz.hl = trim(z.hl); zz.gl = z.gl; }
    if (z.d) { zz.d = z.d.slice(0, zz.h.length).map(r1); zz.s = z.s.slice(0, zz.h.length).map(r1); zz.B = z.B; }
    o.zones.push(zz);
  }
  out[id] = o;
}

const text = 'window.RD_VOICE_FIT = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(OUT, text);
console.log('wrote ' + OUT + ' (' + text.length.toLocaleString() + ' bytes)');
