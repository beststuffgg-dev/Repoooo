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
    m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(c);
    if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255];
    m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    return [128, 128, 128];
  }
  const alpha = (c, a) => { const q = parse(c); return 'rgba(' + Math.round(q[0]) + ',' + Math.round(q[1]) + ',' + Math.round(q[2]) + ',' + a + ')'; };
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
        const sw = o.strokeW === undefined ? 2.8 : o.strokeW;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
    let fillAttr = o.fill;
    if (o.grad) {
      s += '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + o.grad[0] + '"/><stop offset="1" stop-color="' + o.grad[1] + '"/></linearGradient></defs>';
      fillAttr = 'url(#g)';
    }
    if (fillAttr && fillAttr !== 'none') s += '<path d="' + main + '" fill="' + fillAttr + '"/>';
    if (o.mode === 'hover') {
      s += '<path d="' + main + '" fill="none" stroke="' + o.stroke + '" stroke-width="' + (sw + 2.6) + '" stroke-linejoin="round"/>';
      s += '<path d="' + main + '" fill="none" stroke="#ffffff" stroke-width="' + (sw + 0.5) + '" stroke-linejoin="round"/>';
    } else if (o.mode === 'press') {
      s += '<path d="' + main + '" fill="none" stroke="' + o.stroke + '" stroke-width="' + (sw + 2.6) + '" stroke-linejoin="round"/>';
      s += '<path d="' + main + '" fill="none" stroke="#ffffff" stroke-width="' + (sw + 1) + '" stroke-linejoin="round"/>';
    } else if (sw > 0) {
      s += '<path d="' + main + '" fill="none" stroke="' + o.stroke + '" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round"/>';
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
      sel: '.level-card, .avatar-card, #daily-card, #endless-card, .endless-band, .area-chip, .custom-av-upload, .hs-entry, .st-item, .gen-box, .ov-key, .ov-leg, .ov-logo, .hud-combo, .leg-pill',
      fill: t => lighten(t.card, 0.4), grad: t => [lighten(t.card, 0.75), lighten(t.card, 0.3)], ink: t => t.ink, press: t => lighten(t.card, 0.7), elev: 1, move: true
    },
    button: {
      sel: ':where(button:not(.hnav):not(.lane-btn):not(.cr-cell):not(.tool-btn):not(.cr-back):not(.ov-key)), .ic-btn, .chaos-toggle, .bg-radio-btn, .adv-toggle, .cce-btn, .cce-pitch, .gen-main, .gen-play, .ctf-apply, .glass-trans-btn, .cr-add-btn',
      fill: t => t.raised, grad: t => [lighten(t.raised, 0.6), t.raised], ink: t => t.ink, press: t => lighten(t.raised, 0.45), elev: 2, move: true
    },
    panel: {
      sel: '#profile-bar, #home-hero, .home-hero',
      fill: t => lighten(t.bg, 0.45), grad: t => [lighten(t.bg, 0.7), lighten(t.bg, 0.3)], ink: t => t.ink, press: t => lighten(t.bg, 0.6), elev: 0
    },
    group: {
      sel: '.cam-songs',
      fill: t => alpha(lighten(t.bg, 0.25), 0.6), ink: t => darken(t.ink, 0.05), press: t => lighten(t.bg, 0.4), elev: 1, strokeW: 4.6, r: 7, still: true
    },
    row: {
      sel: '.cam-songs .song-row',
      fill: t => lighten(t.card, 0.7), grad: t => [lighten(t.card, 0.9), lighten(t.card, 0.55)], ink: t => t.ink, press: t => lighten(t.card, 0.9), elev: 3, r: 4, strokeW: 3.2, flat: true
    },
    primary: {
      sel: '.ov-play-btn, .uname-btn, .gen-go, .cr-save-btn, #new-lvl-btn, #custom-av-buy-btn, .mb-close-btn',
      fill: t => t.accent, grad: t => [lighten(t.accent, 0.28), t.accent], ink: t => t.ink, press: t => lighten(t.accent, 0.35), elev: 3, move: true, onAccent: true
    },
    field: {
      sel: 'select, input[type="text"], input[type="number"], textarea, .uname-input, .ctf-input',
      fill: t => lighten(t.bg, 0.5), ink: t => t.ink, press: t => lighten(t.bg, 0.7), elev: 0, inset: true
    },
    tool: {
      sel: '.tool-btn, .cr-back, .hnav',
      fill: t => 'none', ink: t => t.inkSoft, press: t => lighten(t.card, 0.5), elev: 0
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
    const amp = opts.flat ? 0.1 : (opts.amp === undefined ? 0.3 : opts.amp);
    const out = [];
    const ik = tokens.ink;
    const shadow = (lvl, st) => {
      if (!lvl) return 'none';
      const k = lvl;
      if (st === 'rest') return '0 ' + (k + 1) + 'px 0 ' + alpha(ik, 0.2) + ',0 ' + (k * 4 + 2) + 'px ' + (k * 5 + 5) + 'px -' + (k * 2 + 3) + 'px ' + alpha(ik, 0.4);
      if (st === 'hover') return '0 ' + (k + 3) + 'px 0 ' + alpha(ik, 0.2) + ',0 ' + (k * 5 + 5) + 'px ' + (k * 6 + 8) + 'px -' + (k * 2 + 3) + 'px ' + alpha(ik, 0.45);
      return '0 0 0 ' + alpha(ik, 0.2) + ',0 1px 2px ' + alpha(ik, 0.3);
    };
    const b = 'border-width:1px;border-style:solid;border-color:transparent !important;border-radius:9px;';
    const emit = (name, selector, T, fill, grad, press, themeFill) => {
      const inkC = T.ink;
      const mk = (variant, mode, f, g) => boxURL({ fill: f, grad: g, stroke: inkC, seed: 11 + variant * 29 + name.length * 5, amp, mode, r: T.r || 13, strokeW: T.strokeW || 2.8 });
      const bi = (v, mode, f, g) => mk(v, mode, f, g) + ' 20 fill / 12px / 4px stretch';
      const base = ':is(' + selector + ')';
      const sh = lvl => ';box-shadow:' + shadow(lvl, 'rest') + ' !important';
      if (T.flat) {
        out.push(base + '{border-width:1px;border-style:solid;border-color:transparent transparent ' + alpha(ik, 0.14) + ' transparent !important;border-radius:0;background:transparent !important;border-image:none;box-shadow:none !important;transition:transform .14s,box-shadow .14s;position:relative;}');
        out.push(base + ':is(:hover,:focus-visible){border-image:' + bi(0, 'hover', fill, grad) + ';border-color:transparent !important;box-shadow:' + shadow(T.elev, 'hover') + ' !important;transform:translateY(-3px) scale(1.02);z-index:6;outline:none;}');
        out.push(base + ':active{border-image-source:' + mk(0, 'press', press, null) + ';box-shadow:' + shadow(T.elev, 'press') + ' !important;transform:translateY(0) scale(1.0);}');
        return;
      }
      out.push(base + '{' + b + 'background:transparent !important;border-image:' + bi(0, 'rest', fill, grad) + sh(T.elev) + ';' + (T.move ? 'transition:transform .12s, box-shadow .12s;' : '') + '}');
      if (T.still) return;
      out.push(base + ':is(:hover,:focus-visible){border-image-source:' + mk(0, 'hover', fill, grad) + ';outline:none;box-shadow:' + shadow(T.elev, 'hover') + ' !important;' + (T.move ? 'transform:translateY(-1px);' : '') + '}');
      out.push(base + ':active{border-image-source:' + mk(0, 'press', press, null) + ';box-shadow:' + shadow(T.elev, 'press') + ' !important;' + (T.move ? 'transform:translateY(2px);' : '') + '}');
      if (!themeFill && !T.onAccent) {
        const acc = tokens.accent, ag = [lighten(acc, 0.28), acc];
        out.push(base + ACTIVE + '{border-image-source:' + mk(0, 'rest', acc, ag) + ';color:' + (luminance(acc) > 0.5 ? '#2b241a' : '#ffffff') + ';}');
        out.push(base + ACTIVE + ':is(:hover,:focus-visible){border-image-source:' + mk(0, 'hover', acc, ag) + ';}');
        out.push(base + ACTIVE + ':active{border-image-source:' + mk(0, 'press', lighten(acc, 0.4), null) + ';}');
      } else if (themeFill) {
        out.push(base + '.selected{border-image-source:' + mk(0, 'hover', fill, grad) + ';}');
      }
      if (T.onAccent) out.push(base + '{color:' + (luminance(tokens.accent) > 0.5 ? '#2b241a' : '#ffffff') + ';}');
    };
    Object.keys(TONES).forEach(name => {
      const T = TONES[name];
      emit(name, T.sel, Object.assign({}, T, { ink: T.ink(tokens) }), T.fill(tokens), T.grad ? T.grad(tokens) : null, T.press(tokens), false);
    });
    (opts.extra || []).forEach((e, i) => emit('x' + i, e.sel, { ink: e.ink || tokens.ink, elev: 1, move: true }, e.fill, [lighten(e.fill, 0.35), e.fill], lighten(e.fill, 0.4), true));
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
    const amp = opts.flat ? 0.1 : 0.3;
    const bi = (o) => boxURL(Object.assign({ amp, r: 12 }, o)) + ' 20 fill / 9px / 0 stretch';
    const white = '#ffffff';
    const tapFill = t.tap, dtapFill = t.dtap;
    const holdFill = mix(t.tap, t.bg, 0.55);
    const css = [];
    css.push('.lane{border-width:1px !important;border-style:solid !important;border-color:transparent !important;border-radius:12px;background:transparent !important;border-image:' + boxURL({ fill: alpha(mix(t.bg, t.ink, 0.04), 0.82), stroke: t.ink, amp, r: 12, seed: 41, strokeW: 2.4 }) + ' 20 fill / 9px / 0 stretch;box-shadow:0 3px 0 ' + alpha(t.ink, 0.14) + ',0 10px 16px -8px ' + alpha(t.ink, 0.35) + ';}');
    css.push('.lane:nth-child(even){border-image-source:' + boxURL({ fill: alpha(mix(t.bg, t.ink, 0.09), 0.82), stroke: t.ink, amp, r: 12, seed: 43, strokeW: 2.4 }) + ';}');
    css.push('.lane.glow-tap{border-image-source:' + boxURL({ fill: alpha(mix(t.bg, t.tap, 0.3), 0.85), stroke: t.ink, amp, r: 12, seed: 41, strokeW: 2.4 }) + ';}');
    css.push('.lane.glow-dtap{border-image-source:' + boxURL({ fill: alpha(mix(t.bg, t.dtap, 0.3), 0.85), stroke: t.ink, amp, r: 12, seed: 43, strokeW: 2.4 }) + ';}');
    const sh = c => '0 5px 0 ' + darken(c, 0.4) + ',0 10px 12px -5px ' + alpha(t.ink, 0.45);
    css.push('.tile{background:none !important;filter:none;}');
    css.push('.tile-tap{border-width:2px;border-style:solid;border-color:transparent;border-radius:9px;border-image:' + bi({ fill: tapFill, grad: [lighten(tapFill, 0.3), tapFill], stroke: t.ink, seed: 51, strokeW: 3 }) + ';box-shadow:' + sh(tapFill) + ';}');
    css.push('.tile-dtap{border-width:2px !important;border-style:solid !important;border-color:transparent !important;border-radius:9px;border-image:' + bi({ fill: dtapFill, grad: [lighten(dtapFill, 0.3), dtapFill], stroke: t.ink, seed: 53, strokeW: 3 }) + ';box-shadow:' + sh(dtapFill) + ';}');
    css.push('.tile-dtap.primed{border-image-source:' + boxURL({ fill: lighten(dtapFill, 0.35), stroke: t.ink, amp, r: 12, seed: 53, strokeW: 3, mode: 'hover' }) + ';}');
    css.push('.tile-hold{border-width:2px !important;border-style:solid !important;border-color:transparent !important;border-radius:9px;border-image:' + bi({ fill: holdFill, grad: [lighten(holdFill, 0.3), holdFill], stroke: t.ink, seed: 55, strokeW: 2.8 }) + ';box-shadow:' + sh(holdFill) + ';}');
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
    css.push('.lane-btn{background:none !important;border-width:1px !important;border-style:solid !important;border-color:transparent !important;border-image:' + boxURL({ fill: mix(t.bg, t.ink, 0.12), stroke: t.ink, amp, r: 12, seed: 61, strokeW: 2.4 }) + ' 20 fill / 9px / 0 stretch;box-shadow:0 4px 0 ' + alpha(t.ink, 0.28) + ',0 8px 10px -4px ' + alpha(t.ink, 0.4) + ' !important;transition:transform .06s;}');
    css.push('.lane-btn:active,.lane-btn.down{border-image-source:' + boxURL({ fill: lighten(mix(t.bg, t.ink, 0.12), 0.5), stroke: t.ink, amp, r: 12, seed: 61, strokeW: 2.4, mode: 'press' }) + ';box-shadow:0 0 0 ' + alpha(t.ink, 0.28) + ' !important;transform:translateY(4px);}');
    return css.join('\n');
  }

  function curve(points, closed, amp, seed) {
    const rand = rng(seed || 1);
    const ph = rand() * 6.283, f = 2 + rand() * 2;
    const pts = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[(i + 1) % n];
      const last = i === n - 1 && !closed;
      pts.push([a[0] + Math.sin(i * f + ph) * amp * 0.6, a[1] + Math.cos(i * f * 1.3 + ph) * amp * 0.6]);
      if (!last) {
        const mx = (a[0] + b[0]) / 2 + Math.sin(i * 2.1 + ph) * amp, my = (a[1] + b[1]) / 2 + Math.cos(i * 1.7 + ph) * amp;
        pts.push([mx, my]);
      }
    }
    const m = pts.length;
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    const segs = closed ? m : m - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = pts[closed ? (i - 1 + m) % m : Math.max(0, i - 1)], p1 = pts[i], p2 = pts[(i + 1) % m], p3 = pts[closed ? (i + 2) % m : Math.min(m - 1, i + 2)];
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d + (closed ? 'Z' : '');
  }

  function cube(cx, cy, k, col, ink, seed) {
    const T = [cx, cy - k], L = [cx - k * 0.87, cy - k * 0.5], R = [cx + k * 0.87, cy - k * 0.5], C = [cx, cy];
    const BL = [cx - k * 0.87, cy + k * 0.5], BR = [cx + k * 0.87, cy + k * 0.5], B = [cx, cy + k];
    const f = (pts, fill, sd) => '<path d="' + curve(pts, true, k * 0.06, seed + sd) + '" fill="' + fill + '" stroke="' + ink + '" stroke-width="' + Math.max(1.4, k * 0.13) + '" stroke-linejoin="round"/>';
    return f([T, R, C, L], lighten(col, 0.38), 1) + f([L, C, B, BL], col, 2) + f([C, R, BR, B], darken(col, 0.2), 3);
  }

  function logoSVG(o) {
    o = o || {};
    const ink = o.ink || '#2f2a24', tap = o.tap || '#3f88c5', dtap = o.dtap || '#e0553a', hold = o.hold || '#f2b92c';
    const paper = o.paper || '#fbf4e4';
    const anim = o.anim ? ' logo-anim' : '';
    const W = 3;
    const stroke = (d, fill, extra) => '<path d="' + d + '" fill="' + fill + '" stroke="' + ink + '" stroke-width="' + W + '" stroke-linejoin="round" stroke-linecap="round"' + (extra || '') + '/>' +
      '<path d="' + d + '" fill="none" stroke="' + ink + '" stroke-width="1" opacity=".16" transform="translate(.8 -.6) rotate(.4 64 64)"/>';
    const trail = d => '<path d="' + d + '" fill="none" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>';
    const dot = (x, y) => '<path d="' + blob(x, y, 3.6, 0.35, x + y, 10) + '" fill="#ffffff" stroke="' + ink + '" stroke-width="1.8"/>';
    const slab = 'M10 68C26 58 48 47 64 43C68 42 71 42 75 44L118 69C106 75 90 81 77 87C67 91 56 95 45 93C39 92 35 89 31 85C25 79 17 73 10 68Z';
    const tiles = [
      { cls: 'b1', col: tap, d: 'M38 22C47 21.500 56 21.500 66 22C64 32 60 39 53 43C48 46 42 45.500 38.500 43.500C41 36 41 29 38 22Z', dot: [51, 34], trail: 'M52 6C53 12 52.500 17 52 20' },
      { cls: 'b3', col: dtap, d: 'M78 14C89 19 99 24 108 27C104 37 99 45 91 50C86 53 80 54 75 53C74 49 74 45 73 41C79 35 81 25 78 14Z', dot: [92, 37], trail: 'M104 6C103 12 101 17 99 21' },
      { cls: 'b2', col: hold, d: 'M86 56C93 57 100 59 107 62C105 67 101 71 96 74C92 76 87 77 82 78C79 76 76 74 73 71C80 69 85 64 86 56Z', dot: [91, 68], trail: 'M112 46C108 52 104 57 100 61' },
    ];
    let g = '';
    g += '<g transform="translate(0 6)">' + stroke(slab, darken(paper, 0.28)) + '</g>';
    g += stroke(slab, paper);
    g += '<path d="M33 70C42 66 51 62 59 57" fill="none" stroke="' + ink + '" stroke-width="2" stroke-linecap="round" opacity=".55"/>';
    g += '<path d="M50 83C62 79 74 74 86 68" fill="none" stroke="' + ink + '" stroke-width="2" stroke-linecap="round" opacity=".55"/>';
    tiles.forEach(t => {
      g += '<g class="blk ' + t.cls + '">' + trail(t.trail);
      g += '<g transform="translate(0 4.500)">' + stroke(t.d, darken(t.col, 0.32)) + '</g>';
      g += stroke(t.d, t.col);
      g += '<path d="' + t.d + '" fill="' + lighten(t.col, 0.45) + '" opacity=".35" transform="translate(0 0) scale(1)" clip-path="none" style="mix-blend-mode:normal" stroke="none"/>'.replace(/<path[^>]*opacity=".35"[^>]*\/>/, '');
      g += dot(t.dot[0], t.dot[1]) + '</g>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" class="rd-logo-svg' + anim + '" aria-hidden="true">' + g + '</svg>';
  }

  return { logoSVG, cube, curve, alpha, playRules, dotURL, lineURL, hLineURL, blob, rng, parse, hex, mix, lighten, darken, luminance, wavyPath, line, boxSvg, boxURL, uri, rules, themeTokens, TONES, SIZE };
})();
