window.RD_Ink = (function () {
  'use strict';

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function parse(c) {
    c = String(c || '').trim();
    let m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return m[1].split('').map(h => parseInt(h + h, 16));
    m = /^#([0-9a-f]{6})/i.exec(c);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    return [128, 128, 128];
  }
  const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) {
    const x = parse(a), y = parse(b);
    return hex(x.map((v, i) => v + (y[i] - v) * t));
  }
  const lighten = (c, t) => mix(c, '#ffffff', t);
  const darken = (c, t) => mix(c, '#000000', t);
  function luminance(c) {
    const [r, g, b] = parse(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function outline(size, r, amp, seed) {
    const rand = rng(seed);
    const pad = 3.2;
    const x0 = pad, y0 = pad, x1 = size - pad, y1 = size - pad;
    const rr = Math.min(r, (x1 - x0) / 2 - 1);
    const pts = [];
    const seg = (ax, ay, bx, by, nx, ny, n) => {
      for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, ay + (by - ay) * i / n, nx, ny]);
    };
    const arc = (cx, cy, a0, a1, n) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * i / n;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.cos(a), Math.sin(a)]);
      }
    };
    const PI = Math.PI;
    seg(x0 + rr, y0, x1 - rr, y0, 0, -1, 6);
    arc(x1 - rr, y0 + rr, -PI / 2, 0, 4);
    seg(x1, y0 + rr, x1, y1 - rr, 1, 0, 6);
    arc(x1 - rr, y1 - rr, 0, PI / 2, 4);
    seg(x1 - rr, y1, x0 + rr, y1, 0, 1, 6);
    arc(x0 + rr, y1 - rr, PI / 2, PI, 4);
    seg(x0, y1 - rr, x0, y0 + rr, -1, 0, 6);
    arc(x0 + rr, y0 + rr, PI, PI * 1.5, 4);
    const n = pts.length;
    const waves = [0, 1, 2].map(k => ({ f: 3 + k * 2 + Math.floor(rand() * 3), p: rand() * 6.283, a: (1 - k * 0.28) * (0.55 + rand() * 0.6) }));
    const out = pts.map((p, i) => {
      const u = i / n * 6.283185;
      let w = 0;
      waves.forEach(q => { w += Math.sin(u * q.f + q.p) * q.a; });
      const d = w * amp;
      return [p[0] + p[2] * d, p[1] + p[3] * d];
    });
    return out;
  }

  function smooth(pts) {
    const n = pts.length;
    let d = 'M' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + c1[0].toFixed(2) + ' ' + c1[1].toFixed(2) + ' ' + c2[0].toFixed(2) + ' ' + c2[1].toFixed(2) + ' ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
    }
    return d + 'Z';
  }

  const wavyPath = (size, r, amp, seed) => smooth(outline(size, r, amp, seed));

  function line(x0, y0, x1, y1, amp, seed, n) {
    const rand = rng(seed);
    const ph = rand() * 6.283, f = 1.2 + rand() * 1.6, ph2 = rand() * 6.283;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const pts = [];
    n = n || 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = Math.sin(t * 6.283 * f + ph) * 0.8 + Math.sin(t * 6.283 * f * 2.3 + ph2) * 0.35;
      pts.push([x0 + dx * t + nx * w * amp, y0 + dy * t + ny * w * amp]);
    }
    let d = 'M' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2);
    for (let i = 0; i < n; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(2) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(2) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(2) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(2) + ' ' +
        p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
    }
    return d;
  }

  const SIZE = 48;
  function boxSvg(o) {
    const size = o.size || SIZE, r = o.r === undefined ? 12 : o.r;
    const amp = o.amp === undefined ? 1.1 : o.amp;
    const seed = o.seed || 1;
    const main = wavyPath(size, r, amp, seed);
    const echo = wavyPath(size, r, amp * 1.25, seed + 77);
    const sw = o.strokeW === undefined ? 2 : o.strokeW;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
    if (o.fill && o.fill !== 'none') s += '<path d="' + main + '" fill="' + o.fill + '"/>';
    if (o.mode === 'hover') {
      s += '<path d="' + main + '" fill="none" stroke="' + o.stroke + '" stroke-width="' + (sw + 2.6) + '" stroke-linejoin="round"/>';
      s += '<path d="' + main + '" fill="none" stroke="#ffffff" stroke-width="' + (sw + 0.5) + '" stroke-linejoin="round"/>';
    } else if (o.mode === 'press') {
      s += '<path d="' + main + '" fill="none" stroke="' + o.stroke + '" stroke-width="' + (sw + 2.6) + '" stroke-linejoin="round"/>';
      s += '<path d="' + main + '" fill="none" stroke="#ffffff" stroke-width="' + (sw + 1) + '" stroke-linejoin="round"/>';
    } else if (sw > 0) {
      s += '<path d="' + main + '" fill="none" stroke="' + o.stroke + '" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round"/>';
      s += '<path d="' + echo + '" fill="none" stroke="' + o.stroke + '" stroke-width="' + (sw * 0.55) + '" stroke-linejoin="round" opacity=".5"/>';
    }
    return s + '</svg>';
  }

  const uri = svg => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  const cache = {};
  function boxURL(o) {
    const key = JSON.stringify(o);
    return cache[key] || (cache[key] = uri(boxSvg(o)));
  }

  const TONES = {
    card: {
      sel: '.level-card, .avatar-card, #daily-card, #endless-card, .endless-band, .song-row, .area-chip, .custom-av-upload, .hs-entry, #profile-bar, .home-hero, #home-hero, .st-item, .gen-box, .ov-key, .ov-leg, .ov-logo, .hud-combo, .leg-pill',
      fill: t => t.card, ink: t => t.ink, press: t => lighten(t.card, 0.4)
    },
    button: {
      sel: 'button:not(.hnav):not(.lane-btn):not(.cr-cell):not(.tool-btn):not(.cr-back):not(.ov-key), .ic-btn, .chaos-toggle, .bg-radio-btn, .adv-toggle, .cce-btn, .cce-pitch, .gen-main, .gen-go, .gen-play, .uname-btn, .ctf-apply, .cr-save-btn, .mb-close-btn, .ov-play-btn, .glass-trans-btn, .cr-add-btn',
      fill: t => t.raised, ink: t => t.ink, press: t => lighten(t.raised, 0.45)
    },
    field: {
      sel: 'select, input[type="text"], input[type="number"], textarea, .uname-input, .ctf-input',
      fill: t => lighten(t.bg, 0.5), ink: t => t.ink, press: t => lighten(t.bg, 0.7)
    },
    tool: {
      sel: '.tool-btn, .cr-back, .hnav',
      fill: t => 'none', ink: t => t.inkSoft, press: t => lighten(t.card, 0.5)
    },
  };
  const ACTIVE = ':is(.active, .selected, .sel, .on, .is-active, .playing, [aria-pressed="true"])';

  function themeTokens(read) {
    const g = (k, d) => (read(k) || d).trim() || d;
    const bg = g('--bg', '#f4ecdc');
    const text = g('--text', '#2b241a');
    return {
      bg, text,
      card: g('--bg3', '#eadfc8'),
      raised: g('--bg4', '#e3d6b9'),
      accent: g('--accent', '#e0553a'),
      tap: g('--tap', '#3f88c5'),
      dtap: g('--dtap', '#e0553a'),
      ink: g('--ink', text),
      inkSoft: g('--ink-soft', mix(text, bg, 0.55)),
    };
  }

  function rules(tokens, opts) {
    opts = opts || {};
    const amp = opts.flat ? 0.25 : (opts.amp === undefined ? 1.1 : opts.amp);
    const out = [];
    const b = 'border-width:1px;border-style:solid;border-color:transparent !important;border-radius:12px;box-shadow:none !important;';
    const emit = (name, selector, fill, ink, press, themeFill) => {
      const mk = (variant, mode, f) => boxURL({ fill: f, stroke: ink, seed: 11 + variant * 29 + name.length * 5, amp, mode, r: 13, strokeW: 2 });
      const bi = (v, mode, f) => mk(v, mode, f) + ' 20 fill / 9px / 4px stretch';
      const base = ':is(' + selector + ')';
      out.push(base + '{' + b + 'background:transparent !important;border-image:' + bi(0, 'rest', fill) + ';}');
      out.push(base + ':nth-child(3n+2){border-image-source:' + mk(1, 'rest', fill) + ';}');
      out.push(base + ':nth-child(3n){border-image-source:' + mk(2, 'rest', fill) + ';}');
      out.push(base + ':is(:hover,:focus-visible){border-image-source:' + mk(0, 'hover', fill) + ';outline:none;}');
      out.push(base + ':active{border-image-source:' + mk(0, 'press', press) + ';}');
      if (!themeFill) {
        out.push(base + ACTIVE + '{border-image-source:' + mk(0, 'rest', tokens.accent) + ';color:' + (luminance(tokens.accent) > 0.5 ? '#2b241a' : '#ffffff') + ';}');
        out.push(base + ACTIVE + ':is(:hover,:focus-visible){border-image-source:' + mk(0, 'hover', tokens.accent) + ';}');
        out.push(base + ACTIVE + ':active{border-image-source:' + mk(0, 'press', lighten(tokens.accent, 0.4)) + ';}');
      } else {
        out.push(base + '.selected{border-image-source:' + mk(0, 'hover', fill) + ';}');
      }
    };
    Object.keys(TONES).forEach(name => {
      const T = TONES[name];
      emit(name, T.sel, T.fill(tokens), T.ink(tokens), T.press(tokens), false);
    });
    (opts.extra || []).forEach((e, i) => emit('x' + i, e.sel, e.fill, e.ink || tokens.ink, lighten(e.fill, 0.4), true));
    return out.join('\n');
  }

  function blob(cx, cy, r, amp, seed, n) {
    const rand = rng(seed);
    n = n || 14;
    const waves = [0, 1].map(k => ({ f: 2 + k * 2 + Math.floor(rand() * 2), p: rand() * 6.283, a: (1 - k * 0.4) * (0.5 + rand() * 0.5) }));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const u = i / n * 6.283185;
      let w = 0;
      waves.forEach(q => { w += Math.sin(u * q.f + q.p) * q.a; });
      const rr = r + w * amp;
      pts.push([cx + Math.cos(u) * rr, cy + Math.sin(u) * rr]);
    }
    return smooth(pts);
  }

  function dotURL(color, o) {
    o = o || {};
    const size = o.size || 24, r = size * 0.36;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<path d="' + blob(size / 2, size / 2, r, size * 0.045, o.seed || 5) + '" fill="' + color + '"/>' +
      (o.ring ? '<path d="' + blob(size / 2, size / 2, r * 1.15, size * 0.05, (o.seed || 5) + 9) + '" fill="none" stroke="' + o.ring + '" stroke-width="' + (size * 0.07) + '" opacity=".6"/>' : '') +
      '</svg>';
    return uri(svg);
  }

  function lineURL(color, o) {
    o = o || {};
    const w = o.w || 8, h = o.h || 48, sw = o.sw || 2;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<path d="' + line(w / 2, 0, w / 2, h, o.amp === undefined ? 1.1 : o.amp, o.seed || 3, 8) + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round"/></svg>';
    return uri(svg);
  }

  function hLineURL(color, o) {
    o = o || {};
    const w = o.w || 64, h = o.h || 8, sw = o.sw || 2.4;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<path d="' + line(0, h / 2, w, h / 2, o.amp === undefined ? 1.3 : o.amp, o.seed || 4, 10) + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round"/></svg>';
    return uri(svg);
  }

  function playRules(t, opts) {
    opts = opts || {};
    const amp = opts.flat ? 0.2 : 1.0;
    const bi = (o) => boxURL(Object.assign({ amp, r: 12 }, o)) + ' 20 fill / 9px / 0 stretch';
    const white = '#ffffff';
    const tapFill = t.tap, dtapFill = t.dtap;
    const holdFill = mix(t.tap, t.bg, 0.55);
    const css = [];
    css.push('.lane{border-width:1px !important;border-style:solid !important;border-color:transparent !important;border-radius:12px;background:transparent !important;border-image:' + boxURL({ fill: mix(t.bg, t.ink, 0.04), stroke: t.ink, amp, r: 12, seed: 41, strokeW: 1.8 }) + ' 20 fill / 9px / 0 stretch;}');
    css.push('.lane:nth-child(even){border-image-source:' + boxURL({ fill: mix(t.bg, t.ink, 0.09), stroke: t.ink, amp, r: 12, seed: 43, strokeW: 1.8 }) + ';}');
    css.push('.lane.glow-tap{border-image-source:' + boxURL({ fill: mix(t.bg, t.tap, 0.3), stroke: t.ink, amp, r: 12, seed: 41, strokeW: 1.8 }) + ';}');
    css.push('.lane.glow-dtap{border-image-source:' + boxURL({ fill: mix(t.bg, t.dtap, 0.3), stroke: t.ink, amp, r: 12, seed: 43, strokeW: 1.8 }) + ';}');
    css.push('.lane-hitbar{height:8px;bottom:50px;background:' + hLineURL(t.ink, { w: 80, h: 8, sw: 3 }) + ' repeat-x center/80px 8px !important;box-shadow:none !important;}');
    css.push('.lane-hitglow{background:none !important;}');
    css.push('.tile{background:none !important;box-shadow:none !important;filter:none;}');
    css.push('.tile-tap{border-width:2px;border-style:solid;border-color:transparent;border-radius:9px;border-image:' + bi({ fill: tapFill, stroke: t.ink, seed: 51, strokeW: 2.2 }) + ';}');
    css.push('.tile-dtap{border-width:2px !important;border-style:solid !important;border-color:transparent !important;border-radius:9px;border-image:' + bi({ fill: dtapFill, stroke: t.ink, seed: 53, strokeW: 2.2 }) + ';}');
    css.push('.tile-dtap.primed{border-image-source:' + boxURL({ fill: lighten(dtapFill, 0.35), stroke: t.ink, amp, r: 12, seed: 53, strokeW: 2.2, mode: 'hover' }) + ';animation:none;}');
    css.push('.tile-hold{border-width:2px !important;border-style:solid !important;border-color:transparent !important;border-radius:9px;border-image:' + bi({ fill: holdFill, stroke: t.ink, seed: 55, strokeW: 2 }) + ';}');
    css.push('.tile-hold.held{border-image-source:' + boxURL({ fill: lighten(holdFill, 0.3), stroke: t.ink, amp, r: 12, seed: 55, strokeW: 2, mode: 'hover' }) + ';}');
    const dot = dotURL(white, { size: 24, seed: 7, ring: t.ink });
    css.push('.tile-tap:not(.tile-hold)::before,.tile-dtap::before{content:"";position:absolute;inset:auto;width:18px;height:18px;left:50%;top:50%;margin:-9px 0 0 -9px;background:' + dot + ' center/18px 18px no-repeat !important;border:0;opacity:1;}');
    css.push('.tile-dtap::before{margin-left:-21px;}');
    css.push('.tile-tap:not(.tile-hold)::after{content:none !important;}');
    css.push('.tile-dtap::after{content:"" !important;position:absolute;width:18px;height:18px;left:50%;top:50%;margin:-9px 0 0 3px;background:' + dotURL(white, { size: 24, seed: 9, ring: t.ink }) + ' center/18px 18px no-repeat;}');
    css.push('.tile-hold::before{content:"";position:absolute;left:50%;bottom:10px;top:auto;height:18px;width:18px;margin-left:-9px;right:auto;border-radius:0;box-shadow:none;filter:none;background:' + dot + ' center/18px 18px no-repeat !important;}');
    css.push('.tile-hold::after{content:"";position:absolute;left:50%;margin-left:-3px;width:6px;top:8px;bottom:30px;background:' + lineURL(white, { w: 6, h: 64, sw: 2, amp: 0.9 }) + ' center/6px 100% repeat-y;pointer-events:none;}');
    css.push('.hold-fill{left:50% !important;right:auto !important;width:5px;margin-left:-2.5px;bottom:28px !important;border-radius:3px !important;background:' + t.ink + ' !important;box-shadow:none !important;opacity:0;}');
    css.push('.tile-hold.held .hold-fill{opacity:.85 !important;}');
    css.push('.lane-btn{background:none !important;border-width:1px !important;border-style:solid !important;border-color:transparent !important;border-image:' + boxURL({ fill: mix(t.bg, t.ink, 0.12), stroke: t.ink, amp, r: 12, seed: 61, strokeW: 1.8 }) + ' 20 fill / 9px / 0 stretch;box-shadow:none !important;}');
    css.push('.lane-btn:active,.lane-btn.down{border-image-source:' + boxURL({ fill: lighten(mix(t.bg, t.ink, 0.12), 0.5), stroke: t.ink, amp, r: 12, seed: 61, strokeW: 1.8, mode: 'press' }) + ';}');
    return css.join('\n');
  }

  return { playRules, dotURL, lineURL, hLineURL, blob, rng, parse, hex, mix, lighten, darken, luminance, wavyPath, line, boxSvg, boxURL, uri, rules, themeTokens, TONES, SIZE };
})();
