#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const D = require('./lib/dsp');

const CACHE = process.env.VSCO_DIR || '/tmp/vsco/x';
const PACK = path.dirname(CACHE);
const V8 = path.join(__dirname, '..', 'RhythmDropV8');
const OUT = process.argv[2] || path.join(__dirname, 'out', 'audition.html');
const RATE = 22050;

const has = (...ts) => s => ts.every(t => s.name.toLowerCase().includes(t));
const REF = {
  violin:   { dir: 'SViolinVib',     pick: has('_f') },
  cello:    { dir: 'CelloEnsSusVib', pick: has('_v3') },
  flute:    { dir: 'FluteSusVib',    pick: has('_v1') },
  clarinet: { dir: 'ClarinetSus',    pick: has('_v3') },
  trumpet:  { dir: 'TrumpetSus',     pick: has('_v3') },
  horn:     { dir: 'FHornSus',       pick: has('_v3') },
  harp:     { dir: 'Harp',           pick: has('_mf') },
  piano:    { dir: 'UprightPiano',   pick: has('dyn2') },
};
const DRUMS = [
  ['Snare', 329.63, '256/Snare2_HitSN_v5_rr6_Sum.wav'],
  ['Rim shot', 277.18, '256/Snare2_rimshot_v2_rr5_Sum.wav'],
  ['Low tom', 293.66, '256/TomL_HitS_v3_rr6_Mid.wav'],
  ['High tom', 415.30, '256/TomH_HitS_v3_rr3_Mid.wav'],
  ['Crash', 523.25, '256/cymbal_crash2_f2.wav'],
];

function onsetTrim(x) {
  let pk = 0;
  for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
  let s = 0;
  while (s < x.length && Math.abs(x[s]) < pk * 0.03) s++;
  return x.subarray(Math.max(0, s - 220));
}

function resample(x, seconds) {
  const n = Math.min(Math.floor(seconds * D.SR), x.length);
  const ratio = D.SR / RATE;
  const m = Math.floor(n / ratio);
  const out = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const p = i * ratio, a = Math.floor(p), f = p - a;
    out[i] = x[a] * (1 - f) + (x[Math.min(a + 1, n - 1)] * f);
  }
  let pk = 0;
  out.forEach(v => { pk = Math.max(pk, Math.abs(v)); });
  const g = pk > 0 ? 0.8 / pk : 1;
  const fade = Math.floor(RATE * 0.05);
  for (let i = 0; i < m; i++) {
    out[i] *= g;
    if (i > m - fade) out[i] *= (m - i) / fade;
  }
  return out;
}

function wavBase64(x) {
  const n = x.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  return buf.toString('base64');
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const gate = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'gate.json'), 'utf8')); } catch (e) { return []; } })();
const cards = [];

for (const [id, cfg] of Object.entries(REF)) {
  const samples = D.parseInstrument(path.join(CACHE, cfg.dir)).filter(s => s.file && cfg.pick(s));
  const byNote = new Map();
  samples.forEach(s => { if (!byNote.has(s.base)) byNote.set(s.base, s); });
  const bases = [...byNote.keys()].sort((a, b) => a - b);
  const at = f => bases[Math.min(bases.length - 1, Math.floor(f * bases.length))];
  const picks = [...new Set([at(0.15), at(0.5), at(0.85)])];
  const rows = picks.map(b => {
    const real = onsetTrim(D.decodeFile(byNote.get(b).file));
    return { name: noteName(b), freq: +D.midiToHz(b).toFixed(2), wav: wavBase64(resample(real, 1.6)) };
  });
  const g = gate.find(r => r.id === id);
  cards.push({ id, label: id[0].toUpperCase() + id.slice(1), rows, note: g ? 'spectral distance to the real note: ' + g.spectral.toFixed(1) + ' dB (the old ' + 'voice was 7 to 11 dB)' : '' });
}
cards.push({
  id: 'drums', label: 'Drum kit',
  rows: DRUMS.map(([name, freq, file]) => {
    const real = onsetTrim(D.decodeFile(path.join(PACK, file)));
    return { name, freq, wav: wavBase64(resample(real, 1.4)) };
  }),
  note: 'kick, hats, clap and cowbell have no free recording to compare with, so only the pieces above are measured',
});
cards.push({
  id: 'kazoo', label: 'Kazoo',
  rows: [{ name: 'A3', freq: 220 }, { name: 'A4', freq: 440 }, { name: 'E5', freq: 659.26 }],
  note: 'no free kazoo recording exists, so this one is judged by ear alone',
});
cards.push({
  id: 'synth', label: 'Synth',
  rows: [{ name: 'C4', freq: 261.63 }, { name: 'C5', freq: 523.25 }],
  note: 'the oscillator voice, kept from before',
});

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RhythmDrop instrument audition</title>
<style>
:root{--bg:#101315;--card:#181d20;--line:#2a3236;--text:#e7eef0;--mut:#8da0a6;--acc:#6fa8b5}
@media (prefers-color-scheme:light){:root{--bg:#f4f1ea;--card:#fff;--line:#d8d2c4;--text:#1b2124;--mut:#5d6b70;--acc:#1e7a8c}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif;padding:20px 16px 60px}
main{max-width:760px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}
p.lead{color:var(--mut);margin:0 0 20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:0 0 14px}
.card h2{font-size:17px;margin:0}
.card .n{color:var(--mut);font-size:12.5px;margin:2px 0 8px}
.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--line)}
.row b{width:54px;font-variant-numeric:tabular-nums}
button{font:inherit;font-size:13.5px;padding:6px 12px;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--text);cursor:pointer}
button:hover{border-color:var(--acc);color:var(--acc)}
button.go{border-color:var(--acc);color:var(--acc)}
</style></head><body><main>
<h1>Instrument audition</h1>
<p class="lead">Each voice, the real recording it was fitted to and the version RhythmDrop plays. "Real" is a short clip of a CC0 recording (VSCO 2 Community Edition); "Game" plays the actual game engine, live. "Real then game" plays them back to back. Tell me which voices are not convincing.</p>
<div id="cards"></div>
</main>
<script>
${fs.readFileSync(path.join(V8, 'voices.js'), 'utf8')}
${fs.readFileSync(path.join(V8, 'audio.js'), 'utf8')}
</script>
<script>
const CARDS = ${JSON.stringify(cards)};
let current = null;
function stopAll() { if (current) { current.pause(); current = null; } }
function playReal(wav) { stopAll(); const a = new Audio('data:audio/wav;base64,' + wav); current = a; return a.play().then(() => new Promise(r => { a.onended = r; })); }
function playGame(id, freq) { RD_getContext(); RD_noteOn(freq, { inst: id, vel: 0.6, dur: 1.2 }); return new Promise(r => setTimeout(r, id === 'piano' || id === 'harp' ? 1500 : 1500)); }
const host = document.getElementById('cards');
CARDS.forEach(c => {
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<h2>' + c.label + '</h2><div class="n">' + c.note + '</div>';
  c.rows.forEach(r => {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<b>' + r.name + '</b>';
    const mk = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; row.appendChild(b); };
    if (r.wav) mk('Real', () => playReal(r.wav));
    mk('Game', () => { stopAll(); playGame(c.id, r.freq); }, 'go');
    if (r.wav) mk('Real then game', () => playReal(r.wav).then(() => playGame(c.id, r.freq)));
    card.appendChild(row);
  });
  host.appendChild(card);
});
</script></body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, page);
console.log('wrote ' + OUT + ' (' + (page.length / 1048576).toFixed(1) + ' MB)');
