// ═══════════════════════════════════════════
//  RhythmDrop codec.js — v6
//
//  Two jobs:
//    1. Level codes. v5 wrote base64(JSON), which was enormous
//       because a 64-beat grid is 256 cells of mostly nulls and
//       every note carried a 6-digit float. v2 packs the grid
//       into a run-length token stream, stores pitches as MIDI
//       integers, then LZW-compresses the lot.
//       Old RHYTHMDROP: codes still import — see decodeLevel.
//    2. Account sync codes, so a profile can move between
//       devices by copy-paste.
//
//  Both share the same compress → base64url pipeline.
// ═══════════════════════════════════════════

(function () {
  'use strict';

  // ── UTF-8 <-> latin1 byte string ──
  // Everything downstream works on bytes, so a level named
  // "Café" compresses identically to an ASCII one.
  const toBytes   = s => unescape(encodeURIComponent(s));
  const fromBytes = b => decodeURIComponent(escape(b));

  function b64urlFromBytes(bytes) {
    return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function bytesFromB64url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
  }

  // ═══════════════════════════════════════════
  //  LZW
  //  Grids are extremely repetitive — long runs of rests and
  //  the same handful of note tokens — which is exactly what
  //  LZW eats. Operates on bytes, emits 16-bit codes.
  // ═══════════════════════════════════════════
  const LZW_MAX = 0x7FFF;   // ceiling imposed by the varint format

  function lzwCompress(byteStr) {
    if (!byteStr.length) return [];
    const dict = new Map();
    let next = 256;
    let w = byteStr[0];
    const out = [];

    for (let i = 1; i < byteStr.length; i++) {
      const c  = byteStr[i];
      const wc = w + c;
      if (wc.length === 1 || dict.has(wc)) {
        w = wc;
      } else {
        out.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w));
        if (next <= LZW_MAX) dict.set(wc, next++);
        w = c;
      }
    }
    out.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w));
    return out;
  }

  function lzwDecompress(codes) {
    if (!codes.length) return '';
    const dict = [];              // codes 256+ live here
    let next = 256;

    const entryFor = c => (c < 256 ? String.fromCharCode(c) : dict[c - 256]);

    let w = entryFor(codes[0]);
    let out = w;

    for (let i = 1; i < codes.length; i++) {
      const c = codes[i];
      let entry = entryFor(c);
      if (entry === undefined) entry = w + w[0];   // the KwKwK case
      out += entry;
      if (next <= LZW_MAX) { dict[next - 256] = w + entry[0]; next++; }
      w = entry;
    }
    return out;
  }

  // Varint packing. Early LZW codes are mostly single bytes, so
  // fixed 16-bit words wasted ~half the payload on short levels.
  // Here a code under 128 costs one byte; anything larger sets
  // the continuation bit and costs two (up to 32767).
  function codesToBytes(codes) {
    let out = '';
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c < 0x80) {
        out += String.fromCharCode(c);
      } else {
        out += String.fromCharCode(0x80 | ((c >> 8) & 0x7F), c & 0xFF);
      }
    }
    return out;
  }
  function bytesToCodes(bytes) {
    const codes = [];
    for (let i = 0; i < bytes.length; i++) {
      const b0 = bytes.charCodeAt(i);
      if (b0 & 0x80) {
        codes.push(((b0 & 0x7F) << 8) | bytes.charCodeAt(++i));
      } else {
        codes.push(b0);
      }
    }
    return codes;
  }

  // The full pipeline both features share.
  function pack(text) {
    return b64urlFromBytes(codesToBytes(lzwCompress(toBytes(text))));
  }
  function unpack(code) {
    return fromBytes(lzwDecompress(bytesToCodes(bytesFromB64url(code))));
  }

  // ── Pitch as MIDI integer instead of a 6-digit float ──
  // 261.63 (6 chars) becomes 60 (2 chars), and it round-trips
  // exactly because every pitch in the app is equal-tempered.
  function freqToMidi(f) {
    if (!f) return null;
    return Math.round(69 + 12 * Math.log2(f / 440));
  }
  function midiToFreq(m) {
    if (m === null || m === undefined || m === '') return null;
    return parseFloat((440 * Math.pow(2, (m - 69) / 12)).toFixed(2));
  }

  // ═══════════════════════════════════════════
  //  LEVEL v2
  //
  //  Layout, '|' separated:
  //    4 | name | bpm | bgMode | laneMidi | bassMidi | diff | instr | gridTokens
  //
  //  v4 adds per-note voices for multi-instrument songs. Because
  //  a voice persists for a whole section, it is encoded as a
  //  STATE CHANGE (\u0060X) rather than a field on every note — a
  //  200-note chart with three sections spends 3 tokens, not 200.
  //
  //  v2 codes (without diff/instr) still decode — see decodeLevelV2.
  //
  //  Grid tokens, one row at a time, ';' between rows:
  //    .        rest
  //    .N       N consecutive rests (run-length)
  //    t / d    tap / dtap at the lane default, no sustain
  //    T<m>     tap at MIDI m
  //    D<m>     dtap at MIDI m
  //    any of the above + ~<s> for a sustain in half-seconds
  // ═══════════════════════════════════════════

  // One char per instrument. Order is fixed — appending is safe,
  // reordering would break every code ever shared.
  const INST_CHARS = {
    synth:'y', piano:'p', guitar:'g', marimba:'m', bell:'b',
    flute:'f', lyre:'l', brass:'r', organ:'o', strings:'s',
    chiptune:'c', kalimba:'k',
  };
  const CHAR_INST = Object.keys(INST_CHARS)
    .reduce((o, k) => { o[INST_CHARS[k]] = k; return o; }, {});

  function encodeLevel(lvl) {
    const laneFreqs = lvl.laneFreqs || [261.63, 329.63, 392.00, 523.25];
    const laneMidi  = laneFreqs.map(freqToMidi);

    // Built-in levels store a flat notes array rather than a grid.
    // Normalise so either shape can be exported.
    let rows = lvl.grid;
    if (!rows && lvl.notes) {
      const beats = lvl.beats || (Math.max(...lvl.notes.map(n => n.b)) + 1);
      rows = Array.from({ length: beats }, () => [null, null, null, null]);
      lvl.notes.forEach(n => {
        rows[n.b][n.l] = {
          type:    n.t,
          freq:    n.freq || laneFreqs[n.l],
          sustain: n.sustain || 0,
        };
      });
    }
    rows = rows || [];
    // Tracks the voice currently in effect across rows.
    let curInst = null;

    const rowStrs = rows.map(row => {
      let out = '';
      let rest = 0;
      const flush = () => {
        if (!rest) return;
        out += rest > 1 ? '.' + rest : '.';
        rest = 0;
      };

      for (let ci = 0; ci < 4; ci++) {
        const cell = row[ci];
        if (!cell) { rest++; continue; }
        flush();

        const type    = typeof cell === 'string' ? cell : cell.type;
        const freq    = (typeof cell === 'object' && cell.freq) ? cell.freq : null;
        const sustain = (typeof cell === 'object' && cell.sustain) ? cell.sustain : 0;
        const inst    = (typeof cell === 'object' && cell.inst) ? cell.inst : null;
        const midi    = freq ? freqToMidi(freq) : null;
        const isDefault = midi === null || midi === laneMidi[ci];

        // Emit a voice change only when it actually changes.
        if (inst && inst !== curInst && INST_CHARS[inst]) {
          out += '`' + INST_CHARS[inst];
          curInst = inst;
        }

        if (isDefault) out += (type === 'dtap' ? 'd' : 't');
        else           out += (type === 'dtap' ? 'D' : 'T') + midi;

        // sustain in half-seconds: 1.5s -> 3, one char instead of three
        if (sustain > 0) out += '~' + Math.round(sustain * 2);
      }
      flush();
      return out;
    });

    const bass = (lvl.bassPattern || [])
      .map(f => (f > 0 ? freqToMidi(f) : '0')).join(',');

    const packed = [
      '5',
      (lvl.name || 'untitled').replace(/\|/g, '/'),
      lvl.bpm || 120,
      lvl.bgMode || 'none',
      laneMidi.join(','),
      bass,
      lvl.diff || 'custom',
      lvl.instrument || 'synth',
      lvl.areaId || '',
      rowStrs.join(';'),
    ].join('|');

    return 'RD2:' + pack(packed);
  }

  function decodeLevelV2(code) {
    const packed = unpack(code.slice(4).trim());
    const parts  = packed.split('|');
    const ver    = parts[0];
    if (['2','3','4','5'].indexOf(ver) < 0) throw new Error('bad version');

    // v2 had no diff/instrument fields, so the grid sat at index 6.
    const isV3 = ver === '3' || ver === '4' || ver === '5';
    const isV5 = ver === '5';
    const diff       = isV3 ? parts[6] : 'custom';
    const instrument = isV3 ? parts[7] : 'synth';
    const areaId     = isV5 && parts[8] ? parseInt(parts[8], 10) : null;
    const gridStr    = isV5 ? parts[9] : (isV3 ? parts[8] : parts[6]);

    const name     = parts[1];
    const bpm      = parseInt(parts[2], 10);
    const bgMode   = parts[3];
    const laneMidi = parts[4].split(',').map(n => parseInt(n, 10));
    const laneFreqs = laneMidi.map(midiToFreq);

    const bassPattern = parts[5]
      ? parts[5].split(',').map(n => (n === '0' ? 0 : midiToFreq(parseInt(n, 10))))
      : [];

    // Voice carries across rows, exactly as it did when encoding.
    let curInst = null;

    const grid = (gridStr || '').split(';').map(rowStr => {
      const row = [null, null, null, null];
      let ci = 0, i = 0;

      while (i < rowStr.length && ci < 4) {
        const ch = rowStr[i];

        if (ch === '`') {
          curInst = CHAR_INST[rowStr[i + 1]] || null;
          i += 2;
          continue;
        }

        if (ch === '.') {
          i++;
          let num = '';
          while (i < rowStr.length && /\d/.test(rowStr[i])) num += rowStr[i++];
          ci += num ? parseInt(num, 10) : 1;
          continue;
        }

        let type, midi = null;
        if (ch === 't' || ch === 'd') {
          type = ch === 'd' ? 'dtap' : 'tap';
          i++;
        } else if (ch === 'T' || ch === 'D') {
          type = ch === 'D' ? 'dtap' : 'tap';
          i++;
          let num = '';
          while (i < rowStr.length && /\d/.test(rowStr[i])) num += rowStr[i++];
          midi = parseInt(num, 10);
        } else { i++; continue; }

        let sustain = 0;
        if (rowStr[i] === '~') {
          i++;
          let num = '';
          while (i < rowStr.length && /\d/.test(rowStr[i])) num += rowStr[i++];
          sustain = parseInt(num, 10) / 2;
        }

        row[ci] = {
          type,
          freq: midi !== null ? midiToFreq(midi) : laneFreqs[ci],
          sustain,
        };
        if (curInst) row[ci].inst = curInst;
        ci++;
      }
      return row;
    });

    // bassSteps is fully derivable from bassPattern, so it is
    // rebuilt rather than transmitted.
    const bassSteps = bassPattern.map(f => ({
      active: f > 0,
      freq:   f > 0 ? f : 65.41,
    }));

    const out = { name, bpm, bgMode, laneFreqs, bassPattern, bassSteps,
                  diff, instrument, grid };
    if (areaId) out.areaId = areaId;
    return out;
  }

  // ── The reader that accepts both formats ──
  function decodeLevel(text) {
    const t = (text || '').trim();
    if (t.startsWith('RD2:')) return decodeLevelV2(t);

    // v5 and earlier: base64(JSON), with or without the prefix.
    const body = t.startsWith('RHYTHMDROP:') ? t.slice('RHYTHMDROP:'.length) : t;
    const json = decodeURIComponent(escape(atob(body.trim())));
    const lvl  = JSON.parse(json);
    if (!lvl.name || !lvl.bpm || !lvl.grid) throw new Error('missing fields');
    return lvl;
  }

  // ═══════════════════════════════════════════
  //  ACCOUNT SYNC
  //
  //  Everything that makes an account an account: who you are,
  //  what you've earned, what you've bought, what you've built.
  //  Custom levels are included but optional — they dominate the
  //  size, and a code you can't paste is no use to anyone.
  // ═══════════════════════════════════════════

  function buildSyncPayload(parts) {
    // Short keys — this is machine-read, never human-read.
    const p = {
      v: 1,
      u: parts.profile.username || 'Player',
      c: parts.profile.coins || 0,
      b: parts.profile.bestScore || 0,
      o: (parts.shop.owned || []),
      e: parts.shop.equipped || null,
      w: parts.shop.colour || 'cyan',
      h: parts.shop.themes || [],
      q: parts.shop.fx || [],
      s: (parts.scores || []).slice(0, 25).map(x =>
           [x.name, x.score, x.level, x.coins, x.date]),
      t: parts.theme || 'graphite',
      x: parts.customTheme || null,
      g: parts.settings || null,
      r: parts.progress || null,   // campaign progress + XP
      d: parts.daily || null,
      // Per-level bests: { levelKey: [score, coins, date] }. Small even
      // at 150 songs, and it is the record a player would most miss.
      n: parts.bests || null,
    };
    if (parts.avatar) p.a = parts.avatar;                 // custom avatar data URL
    if (parts.levels && parts.levels.length) {
      p.l = parts.levels.map(l => encodeLevel(l).slice(4)); // drop repeated 'RD2:'
    }
    return p;
  }

  function encodeSync(parts) {
    const json = JSON.stringify(buildSyncPayload(parts));
    return 'RDSYNC1:' + pack(json);
  }

  function decodeSync(text) {
    const t = (text || '').trim();
    if (!t.startsWith('RDSYNC1:')) throw new Error('not a sync code');
    const json = unpack(t.slice('RDSYNC1:'.length));
    const p = JSON.parse(json);
    if (!p || p.v !== 1) throw new Error('unsupported sync version');

    return {
      profile: { username: p.u, coins: p.c || 0, bestScore: p.b || 0 },
      shop:    { owned: p.o || [], equipped: p.e || null, colour: p.w || 'cyan',
                 themes: p.h || [], fx: p.q || [] },
      scores:  (p.s || []).map(a => ({
                 name: a[0], score: a[1], level: a[2], coins: a[3], date: a[4],
               })),
      theme:       p.t || 'graphite',
      customTheme: p.x || null,
      settings:    p.g || null,
      progress:    p.r || null,
      daily:       p.d || null,
      bests:       p.n || null,
      avatar:      p.a || null,
      levels:      (p.l || []).map(c => decodeLevelV2('RD2:' + c)),
    };
  }

  window.RD_Codec = {
    encodeLevel, decodeLevel, decodeLevelV2,
    encodeSync, decodeSync,
    pack, unpack,
    freqToMidi, midiToFreq,
  };
})();
