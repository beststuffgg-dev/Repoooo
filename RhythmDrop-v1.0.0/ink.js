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

  const THIN_SEL = ['button', 'select', 'input'].map(t => ['border:', 'border: ', 'border-style', 'border-color', 'border-width'].map(k => t + '[style*="' + k + '"]').join(', ')).join(', ') + ', #studio-btn, #import-lvl-btn, #g-menu-btn, .shop-subnav button:not(.active), .lane-count-btn:not(.sel), .bg-radio-btn:not(.sel), .cr-diff-sel, .cr-title-input, .bpm-input, .st-speeds button:not(.on), .st-field :is(input, select)';

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
      fill: t => alpha(lighten(t.bg, 0.25), 0.6), ink: t => darken(t.ink, 0.05), press: t => lighten(t.bg, 0.4), elev: 1, strokeW: 4.6, r: 17, still: true
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
    const lightTheme = luminance(tokens.bg) > 0.4;
    const deepen = c => lightTheme ? darken(c, 0.1) : lighten(c, 0.1);
    const emit = (name, selector, T, fill, grad, press, themeFill) => {
      const inkC = deepen(T.ink);
      const mk = (variant, mode, f, g) => boxURL({ fill: f, grad: g, stroke: inkC, seed: 11 + variant * 29 + name.length * 5, amp, mode, r: T.r || 13, strokeW: T.strokeW || 2.8 });
      const bi = (v, mode, f, g) => mk(v, mode, f, g) + ' 20 fill / 12px / 4px stretch';
      const base = ':is(' + selector + ')';
      const sh = lvl => ';box-shadow:' + shadow(lvl, 'rest') + ' !important';
      if (T.flat) {
        out.push(base + '{border-width:1px;border-style:solid;border-color:transparent transparent ' + alpha(ik, 0.14) + ' transparent !important;border-radius:0;background:transparent !important;border-image:none;box-shadow:none !important;transition:transform .14s,box-shadow .14s;position:relative;}');
        out.push(base + ':is(:hover,:focus-visible){border-image:' + bi(0, 'hover', fill, grad) + ';border-color:transparent !important;box-shadow:' + shadow(T.elev, 'hover') + ' !important;transform:translateY(-2px) scale(1.012);z-index:6;outline:none;}');
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
    const thinStroke = deepen(tokens.inkSoft);
    const thin = boxURL({ fill: 'none', stroke: thinStroke, seed: 71, amp, r: 12, strokeW: 1.9 }) + ' 20 fill / 12px / 4px stretch';
    out.push(THIN_SEL + '{border-width:1px !important;border-style:solid !important;border-color:transparent !important;border-image:' + thin + ' !important;}');
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
    const holdStroke = mode => boxURL({ fill: 'none', stroke: t.ink, amp, r: 12, seed: 55, strokeW: mode ? 2 : 2.8, mode });
    const holdFace = 'linear-gradient(180deg,' + lighten(holdFill, 0.55) + ' 0,' + lighten(holdFill, 0.25) + ' 9px,' + holdFill + ' 9px,' + holdFill + ' calc(100% - 15px),' + darken(holdFill, 0.12) + ' calc(100% - 15px),' + darken(holdFill, 0.3) + ' 100%),linear-gradient(90deg,' + alpha('#ffffff', 0.32) + ' 0,' + alpha('#ffffff', 0) + ' 16%,' + alpha('#000000', 0) + ' 84%,' + alpha('#000000', 0.2) + ' 100%)';
    const holdWall = d => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => Math.round(i * d * 0.35) + 'px ' + Math.max(1, Math.round(i * d)) + 'px 0 ' + darken(mix(holdFill, t.tap, 0.75), 0.22 + i * 0.03)).join(',');
    css.push('.tile-hold{border-width:2px !important;border-style:solid !important;border-color:transparent !important;border-radius:9px;background:' + holdFace + ' !important;border-image:' + holdStroke() + ' 20 fill / 12px / 4px stretch;box-shadow:' + holdWall(1) + ',0 22px 20px -8px ' + alpha(t.ink, 0.55) + ',inset 0 2px 0 ' + alpha('#ffffff', 0.55) + ';}');
    css.push('.tile-hold.held{border-image-source:' + holdStroke('hover') + ';box-shadow:' + holdWall(0.4) + ',0 8px 10px -4px ' + alpha(t.ink, 0.5) + ',inset 0 2px 0 ' + alpha('#ffffff', 0.6) + ';}');
    const dot = dotURL(white, { size: 24, seed: 7, ring: t.ink });
    css.push('.tile-tap:not(.tile-hold)::before,.tile-dtap::before{content:"";position:absolute;inset:auto;width:18px;height:18px;left:50%;top:50%;margin:-9px 0 0 -9px;background:' + dot + ' center/18px 18px no-repeat !important;border:0;opacity:1;}');
    css.push('.tile-dtap::before{margin-left:-21px;}');
    css.push('.tile-tap:not(.tile-hold)::after{content:none !important;}');
    css.push('.tile-dtap::after{content:"" !important;position:absolute;width:18px;height:18px;left:50%;top:50%;margin:-9px 0 0 3px;background:' + dotURL(white, { size: 24, seed: 9, ring: t.ink }) + ' center/18px 18px no-repeat;}');
    css.push('.tile-hold::before{content:"";position:absolute;left:50%;bottom:10px;top:auto;height:18px;width:18px;margin-left:-9px;right:auto;border-radius:0;box-shadow:none;filter:none;background:' + dot + ' center/18px 18px no-repeat !important;}');
    css.push('.tile-hold::after{content:"";position:absolute;left:50%;margin-left:-3px;width:6px;top:8px;bottom:30px;background:' + lineURL(white, { w: 6, h: 64, sw: 2, amp: 0.9 }) + ' center/6px 100% repeat-y;pointer-events:none;}');
    css.push('.hold-fill{left:5px !important;right:5px !important;width:auto !important;margin:0 !important;bottom:5px !important;border-radius:6px !important;z-index:0 !important;background:' + alpha(lighten(holdFill, 0.7), 0.7) + ' !important;box-shadow:inset 0 2px 0 ' + alpha('#ffffff', 0.55) + ' !important;opacity:0;transition:opacity .08s;}');
    css.push('.tile-hold.held .hold-fill{opacity:1 !important;}');
    css.push('.tile-hold::before,.tile-hold::after{z-index:2;}');
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
})();;
window.RD_Scenes = (function () {
  'use strict';

  const W = 400, H = 640;
  const SCENES = [
    { id: 'paper', name: 'Blank paper' },
    { id: 'meadow', name: 'Green wash' },
    { id: 'night', name: 'Midnight' },
    { id: 'sea', name: 'Blue wash' },
    { id: 'city', name: 'Concrete' },
    { id: 'mountains', name: 'Lavender' },
    { id: 'farmstead', name: 'Straw' },
    { id: 'egypt', name: 'Sand' },
    { id: 'greece', name: 'Marble' },
    { id: 'rome', name: 'Terracotta' },
    { id: 'aztec', name: 'Stone' },
    { id: 'maya', name: 'Jade' },
    { id: 'england', name: 'Fog' },
    { id: 'napoleon', name: 'Parchment' },
    { id: 'modern', name: 'Graph paper' },
    { id: 'retro', name: 'Indigo dots' },
  ];
  const AREA = { 1: 'farmstead', 2: 'egypt', 3: 'greece', 4: 'rome', 5: 'aztec', 6: 'maya', 7: 'england', 8: 'napoleon', 9: 'modern', 10: 'retro' };

  const SPEC = {
    meadow:    { a: '#dff0cf', b: '#b9dc9c', tex: 'wash', grain: 0.10 },
    night:     { a: '#39426b', b: '#1f2441', tex: 'grain', grain: 0.14, dark: true },
    sea:       { a: '#d9ecf8', b: '#9ccbea', tex: 'wash', grain: 0.10 },
    city:      { a: '#dcdcd8', b: '#bcbdb9', tex: 'grain', grain: 0.16 },
    mountains: { a: '#e9e2f6', b: '#c3b4e3', tex: 'wash', grain: 0.10 },
    farmstead: { a: '#fbf0c2', b: '#efd98d', tex: 'lines', grain: 0.10 },
    egypt:     { a: '#f6e5b5', b: '#e6c785', tex: 'dunes', grain: 0.14 },
    greece:    { a: '#f3f7fb', b: '#cfe1f2', tex: 'marble', grain: 0.08 },
    rome:      { a: '#f3d5bd', b: '#e0a47c', tex: 'grain', grain: 0.16 },
    aztec:     { a: '#dcd9cb', b: '#b6b39f', tex: 'grain', grain: 0.2 },
    maya:      { a: '#d5eadb', b: '#8fc4a4', tex: 'wash', grain: 0.14 },
    england:   { a: '#e8edf1', b: '#c3cdd6', tex: 'wash', grain: 0.12 },
    napoleon:  { a: '#f0e4c8', b: '#dcc79b', tex: 'grain', grain: 0.2 },
    modern:    { a: '#f1f4f7', b: '#d9e0e8', tex: 'grid', grain: 0.06 },
    retro:     { a: '#443f8a', b: '#1f1c4d', tex: 'dots', grain: 0.12, dark: true },
  };
  const ids = SCENES.map(s => s.id);
  const valid = id => ids.indexOf(id) >= 0;

  function build(id) {
    const sp = SPEC[id];
    if (!sp) return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"/>';
    const line = sp.dark ? '#ffffff' : '#3a3023';
    let defs = '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sp.a + '"/><stop offset="1" stop-color="' + sp.b + '"/></linearGradient>' +
      '<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 ' + (sp.dark ? 1 : 0.2) + ' 0 0 0 0 ' + (sp.dark ? 1 : 0.17) + ' 0 0 0 0 ' + (sp.dark ? 1 : 0.1) + ' 0 0 0 ' + (sp.grain * 4) + ' ' + (-sp.grain * 1.4) + '"/></filter>' +
      '<filter id="w" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="3" seed="9" result="t"/><feColorMatrix in="t" values="0 0 0 0 ' + (sp.dark ? 1 : 1) + ' 0 0 0 0 ' + (sp.dark ? 1 : 1) + ' 0 0 0 0 ' + (sp.dark ? 1 : 1) + ' 0 0 0 1.6 -.55"/></filter>' +
      '<filter id="m" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency=".004 .012" numOctaves="4" seed="5"/><feColorMatrix values="0 0 0 0 .55 0 0 0 0 .62 0 0 0 0 .72 0 0 0 -3 1.35"/></filter>';
    let body = '<rect width="' + W + '" height="' + H + '" fill="url(#g)"/>';
    if (sp.tex === 'wash') body += '<rect width="' + W + '" height="' + H + '" filter="url(#w)" opacity=".55"/>';
    if (sp.tex === 'marble') body += '<rect width="' + W + '" height="' + H + '" filter="url(#m)" opacity=".55"/>';
    if (sp.tex === 'lines') for (let y = 28; y < H; y += 32) body += '<path d="M0 ' + y + 'H' + W + '" stroke="' + line + '" stroke-opacity=".08" stroke-width="1.4"/>';
    if (sp.tex === 'grid') {
      for (let y = 0; y <= H; y += 26) body += '<path d="M0 ' + y + 'H' + W + '" stroke="#5a7a9a" stroke-opacity=".16" stroke-width="1"/>';
      for (let x = 0; x <= W; x += 26) body += '<path d="M' + x + ' 0V' + H + '" stroke="#5a7a9a" stroke-opacity=".16" stroke-width="1"/>';
    }
    if (sp.tex === 'dots') for (let y = 14; y < H; y += 28) for (let x = 14 + ((y / 28) % 2 ? 14 : 0); x < W; x += 28) body += '<circle cx="' + x + '" cy="' + y + '" r="1.6" fill="#ffffff" fill-opacity=".22"/>';
    if (sp.tex === 'dunes') for (let i = 0; i < 6; i++) { const y = 80 + i * 104; body += '<path d="M-10 ' + y + 'C100 ' + (y - 30) + ' 200 ' + (y + 28) + ' 300 ' + (y - 8) + 'S400 ' + (y + 10) + ' 410 ' + (y - 6) + '" fill="none" stroke="#a9843f" stroke-opacity=".12" stroke-width="2"/>'; }
    body += '<rect width="' + W + '" height="' + H + '" filter="url(#n)"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice"><defs>' + defs + '</defs>' + body + '</svg>';
  }

  const cache = {};
  function svg(id) {
    if (!valid(id)) id = 'paper';
    return cache[id] || (cache[id] = build(id));
  }
  const url = id => (!SPEC[valid(id) ? id : 'paper']) ? 'none' : 'url("data:image/svg+xml,' + encodeURIComponent(svg(id)) + '")';
  const forArea = a => AREA[a] || 'meadow';
  const forLevel = lvl => (lvl && lvl.scene && valid(lvl.scene)) ? lvl.scene : (lvl && lvl.areaId ? forArea(lvl.areaId) : 'paper');

  return { SCENES, AREA, valid, svg, url, forArea, forLevel };
})();;
window.RD_Icons = (function () {
  'use strict';

  const I = {
    coin: ['M12 4a8 8 0 1 0 .01 0Z|a', 'M12 8v8', 'M9.5 10.3c.6-.9 1.6-1.3 2.5-1.3s1.8.4 2 1.1c.3 1.4-4.4.9-4.1 2.7.2.7 1.2 1.2 2.1 1.2s2-.4 2.5-1.2'],
    heart: ['M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.2C19.500 15.400 12 20 12 20Z|a'],
    'heart-o': ['M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.2C19.500 15.400 12 20 12 20Z'],
    lock: ['M6 11h12v9.500H6Z|a', 'M8.500 11V8a3.500 3.500 0 0 1 7 0v3', 'M12 14.500v2.500'],
    trophy: ['M7 4h10v5.500a5 5 0 0 1-10 0Z|a', 'M7 6H4v2a3 3 0 0 0 3 3', 'M17 6h3v2a3 3 0 0 1-3 3', 'M12 14.500V18', 'M8 20.500h8'],
    note: ['M9 18V6.500l10-2V16', 'M9 18a2.600 2.600 0 1 1-5.200 0 2.600 2.600 0 0 1 5.200 0Z|a', 'M19 16a2.600 2.600 0 1 1-5.200 0 2.600 2.600 0 0 1 5.200 0Z|a'],
    dice: ['M5 5h14v14H5Z|a', 'M8.500 8.500h.1', 'M15.500 8.500h.1', 'M12 12h.1', 'M8.500 15.500h.1', 'M15.500 15.500h.1'],
    piano: ['M3 6h18v12H3Z|a', 'M9 12v6', 'M15 12v6', 'M7 6v6h4V6', 'M13 6v6h4V6|b'],
    'piano-note': ['M2.500 9h13v9h-13Z|a', 'M7 13v5', 'M11 13v5', 'M5 9v4h3V9', 'M16 11V4.500l5-1V9.500', 'M16 11a1.800 1.800 0 1 1-3.600 0 1.800 1.800 0 0 1 3.600 0Z|b', 'M21 9.500a1.800 1.800 0 1 1-3.600 0 1.800 1.800 0 0 1 3.600 0Z|b'],
    crown: ['M4 17.500 3 8l5 4 4-7 4 7 5-4-1 9.500Z|a', 'M4.500 20.500h15'],
    bolt: ['M13.500 3 5.500 14H11l-1 7 8-11h-5.500Z|a'],
    gift: ['M4.500 11h15v9.500h-15Z|a', 'M3.500 7.500h17V11h-17Z|b', 'M12 7.500v13', 'M12 7.500C10 3.500 6 4.500 7.500 7.500M12 7.500c2-4 6-3 4.500 0'],
    headphones: ['M4.500 15v-3a7.500 7.500 0 0 1 15 0v3', 'M4 14h3.500v6H4Z|a', 'M16.500 14H20v6h-3.500Z|a'],
    gem: ['M6.500 4h11l4 6L12 20.500 2.500 10Z|a', 'M2.500 10h19', 'M9.500 4 8 10l4 10.500L16 10 14.500 4'],
    flame: ['M12 3c.8 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .2 1.800 1 2.600 2 3-.6-3.600-1-6 1-9Z|a'],
    infinity: ['M12 12c-2-3-3-4-5-4a4 4 0 0 0 0 8c2 0 3-1 5-4s3-4 5-4a4 4 0 0 1 0 8c-2 0-3-1-5-4'],
    sliders: ['M4 7h16', 'M4 12h16', 'M4 17h16', 'M8 4.500v5|a', 'M15 9.500v5|a', 'M10 14.500v5|a'],
    'arrow-up': ['M12 19V5', 'M6 11l6-6 6 6'],
    'arrow-down': ['M12 5v14', 'M6 13l6 6 6-6'],
    'arrow-left': ['M19 12H5', 'M11 6l-6 6 6 6'],
    'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
    download: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'],
    'chev-down': ['M6 9l6 6 6-6'],
    pause: ['M8 5v14', 'M16 5v14'],
    play: ['M8 5l11 7-11 7Z|a'],
    check: ['M5 12.500l4.500 4.500L19 7'],
    cross: ['M6 6l12 12', 'M18 6 6 18'],
    minus: ['M6 12h12'],
    plus: ['M12 6v12', 'M6 12h12'],
    star: ['M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9Z|a'],
    'glow-star': ['M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9Z|a', 'M20 3v3M18.500 4.500h3'],
    ghost: ['M6 20.500V10.500a6 6 0 0 1 12 0v10l-2.500-2-3.500 2-3.500-2Z|a', 'M9.500 10.500h.1', 'M14.500 10.500h.1'],
    robot: ['M5 8h14v11H5Z|a', 'M12 8V4.500', 'M12 4.500h.1', 'M9 12.500h.1', 'M15 12.500h.1', 'M9 16h6', 'M3 12v3M21 12v3'],
    cat: ['M5 20V9l3 2h8l3-2v11Z|a', 'M9.500 14h.1', 'M14.500 14h.1', 'M11 17h2'],
    rocket: ['M12 3c4 2.500 5 7 4 12H8c-1-5 0-9.500 4-12Z|a', 'M8 15l-3 4h4', 'M16 15l3 4h-4', 'M12 9.500h.1', 'M10 19.500c.5 1.500 1.500 2 2 2.500.5-.5 1.500-1 2-2.500'],
    unicorn: ['M7 20v-8l4-3 6 2v9Z|a', 'M11 9 14 2.500 14.500 10', 'M13.500 13h.1'],
    dragon: ['M4 19c0-7 4-13 12-14-1 2-1 4 0 5 2 0 4 1 4 3 0 3-2 6-8 6Z|a', 'M14 10h.1', 'M7 13l2 2'],
    galaxy: ['M12 12m-1.500 0a1.500 1.500 0 1 0 3 0 1.500 1.500 0 1 0-3 0|a', 'M12 12c0-4 4-6 7-4-2-2.500-8-2.500-9 1.500', 'M12 12c0 4-4 6-7 4 2 2.500 8 2.500 9-1.500'],
    alien: ['M12 21c-4 0-7-4-7-9a7 7 0 0 1 14 0c0 5-3 9-7 9Z|a', 'M8 12.500c1 0 2 .6 2.200 1.500-1 .1-2-.5-2.200-1.500Z|b', 'M16 12.500c-1 0-2 .6-2.200 1.500 1 .1 2-.5 2.200-1.500Z|b'],
    eagle: ['M3 8c4 0 7 2 9 6 2-4 5-6 9-6-1 6-4 10-9 12-5-2-8-6-9-12Z|a', 'M12 14v6'],
    goat: ['M7 20V11l5-2 5 2v9Z|a', 'M7 11 5 5c2 0 3 1 4 3M17 11l2-6c-2 0-3 1-4 3', 'M10 14h.1M14 14h.1', 'M12 17v3'],
    blackhole: ['M12 3.500a8.500 8.500 0 1 0 .01 0Z', 'M12 7.500a4.500 4.500 0 1 0 .01 0Z', 'M12 11a1 1 0 1 0 .01 0Z|a'],
    'shooting-star': ['M14 3l1.800 3.700 4 .6-2.900 2.800.7 4-3.600-1.900L11.400 14l.7-4L9.200 7.300l4-.6Z|a', 'M9 12l-6 7', 'M11 15l-5 5'],
    angel: ['M12 15.500a5 5 0 1 0 .01 0Z|a', 'M8 4.500c1.200-1 2.500-1.500 4-1.500s2.800.5 4 1.500', 'M10.500 15h.1M13.500 15h.1', 'M10.500 17.500c.8.5 2.200.5 3 0'],
    box: ['M4 8l8-4 8 4v9l-8 4-8-4Z|a', 'M4 8l8 4 8-4', 'M12 12v9'],
    disco: ['M12 6l7 3v6l-7 3-7-3V9Z|a', 'M5 9l7 3 7-3M12 12v6', 'M9 7.500l1 4M15 7.500l-1 4', 'M12 2v3', 'M19 3v3M17.500 4.500h3'],
    crystal: ['M12 4a8 8 0 1 0 .01 0Z|a', 'M8 9c1-1.500 2.500-2 4-2', 'M7 20.500h10'],
    sparkle: ['M12 3c.8 5 4 8.200 9 9-5 .8-8.200 4-9 9-.8-5-4-8.200-9-9 5-.8 8.200-4 9-9Z|a'],
    moneybag: ['M8.500 8c-2 2-4 5-4 8 0 3 3 4.500 7.500 4.500s7.500-1.500 7.500-4.500c0-3-2-6-4-8', 'M8.500 8 9.500 4h5l1 4Z|a', 'M12 12v5'],
    moneywings: ['M12 7a5 5 0 1 0 .01 0Z|a', 'M7 10c-3-2-5-1-5 1.500 2.500 0 3 1 5 .5', 'M17 10c3-2 5-1 5 1.500-2.500 0-3 1-5 .5'],
    seedling: ['M12 21v-9', 'M12 13c-5 0-7-3-7-7 4 0 7 2 7 7Z|a', 'M12 15c4 0 6-2 6-6-4 0-6 2-6 6Z|a'],
    skull: ['M12 3.500a8 8 0 0 0-8 8c0 3 1.500 5 3.500 6V21h9v-3.500c2-1 3.500-3 3.500-6a8 8 0 0 0-8-8Z|a', 'M9 12.500h.1', 'M15 12.500h.1', 'M10.500 17v3.500M13.500 17v3.500'],
    pencil: ['M4 20l1-5L16 4l4 4L9 19Z|a', 'M14 6l4 4'],
    undo: ['M9 7 4 12l5 5', 'M4 12h10a5 5 0 0 1 0 10'],
    redo: ['M15 7l5 5-5 5', 'M20 12H10a5 5 0 0 0 0 10'],
    reset: ['M4 12a8 8 0 1 0 3-6.200', 'M4 4v4.500h4.500'],
    floppy: ['M4 4h13l3 3v13H4Z|a', 'M8 4v5h8V4', 'M8 20v-6h8v6'],
    palette: ['M12 3a9 9 0 0 0 0 18c1.500 0 2-1 1.500-2s0-2.500 1.500-2.500H18a3 3 0 0 0 3-3C21 6.500 17 3 12 3Z|a', 'M7.500 11h.1', 'M10 7.500h.1', 'M14.500 7.500h.1', 'M17 11h.1'],
    trash: ['M5 7h14', 'M9.500 7V4h5v3', 'M7 7l1 13.500h8L17 7|a'],
    scissors: ['M6 7.500a2.500 2.500 0 1 0 .01 0Z', 'M6 16.500a2.500 2.500 0 1 0 .01 0Z', 'M8 9l12 9M8 15 20 6'],
    gear: ['M9.7 5.2 L9.8 2.2 L14.2 2.2 L14.3 5.2 L16.7 6.6 L19.4 5.2 L21.5 9.0 L19.1 10.6 L19.1 13.4 L21.5 15.0 L19.4 18.8 L16.7 17.4 L14.3 18.8 L14.2 21.8 L9.8 21.8 L9.7 18.8 L7.3 17.4 L4.6 18.8 L2.5 15.0 L4.9 13.4 L4.9 10.6 L2.5 9.0 L4.6 5.2 L7.3 6.6Z|a', 'M12 9.2a2.800 2.800 0 1 0 .01 0Z'],
    sq: ['M5 5h14v14H5Z|a'],
    dtap: ['M8 4l5 5-5 5-5-5Z|a', 'M16 10l5 5-5 5-5-5Z|a'],
    hold: ['M9 3.500h6v17H9Z|a', 'M12 7v7'],
    move: ['M12 3v18M3 12h18', 'M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3'],
    select: ['M4 4h16v16H4Z', 'M8 12h8M12 8v8'],
    'tri-up': ['M12 5l8 14H4Z|a'],
    'tri-down': ['M12 19 4 5h16Z|a'],
    levels: ['M5 21V4', 'M5 5c4-2 6 2 10 0v8c-4 2-6-2-10 0Z|a', 'M3 21h6'],
    shop: ['M4 10.500 5.500 5h13L20 10.500', 'M4 10.500h16v2a3 3 0 0 1-5.300 1.900 3 3 0 0 1-4.700 0A3 3 0 0 1 4 12.500Z|a', 'M5.500 15v5h13v-5', 'M10 20v-4h4v4'],
    studio: ['M4 12v0', 'M3 12h2M7 7v10M11 4v16M15 8v8M19 10v4'],
    flag: ['M5 21V4', 'M5 5h11l-2 4 2 4H5Z|a'],
    expand: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
    shrink: ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'],
    'opt-pin': ['M12 14.500s-5-3.800-5-8a5 5 0 0 1 10 0c0 4.200-5 8-5 8Z|a', 'M12 4.800a2 2 0 1 0 .01 0Z|b', 'M4.500 20c2.600-3.400 4.800 1.800 7.200-.4s3.600-2.300 7.800-.6'],
    'opt-peaks': ['M2.500 19.500 9 8l4 7 3-4.500 5.500 9Z|a', 'M7.500 11l1.500 1.500 1.500-1'],
    'opt-list': ['M4 5h16v14H4Z|a', 'M8 9.500h8', 'M8 14.500h5', 'M6.500 9.500h.1', 'M6.500 14.500h.1'],
    'opt-play': ['M12 3.500a8.500 8.500 0 1 0 .01 0Z|a', 'M10 8.500l5.500 3.500-5.500 3.500Z|b'],
    'opt-target': ['M12 3.500a8.500 8.500 0 1 0 .01 0Z|a', 'M12 7.500a4.500 4.500 0 1 0 .01 0Z|b', 'M12 11a1 1 0 1 0 .01 0Z|a'],
    'opt-stairs': ['M3.500 20.500h5v-5h5v-5h7v10.500Z|a', 'M8.500 15.500v5M13.500 10.500v5'],
    violin: ['M9 10c0-2 1.500-3 3-3s3 1 3 3c0 1.500-1 2-1 3s1 2 1 3.500c0 2-1.500 3.500-3 3.500s-3-1.500-3-3.500c0-1.500 1-2.500 1-3.500s-1-1.500-1-3Z|a', 'M12 3v10', 'M10.500 14h3'],
    flute: ['M3 19 19 5l2 2L5 21Z|a', 'M8 16h.1M11 13h.1M14 10h.1'],
    sax: ['M14 3l2 2v10a5 5 0 1 1-5-5', 'M5.500 19.500h5|a', 'M16 7h2'],
    trumpet: ['M3 10.500h10l7-3.500v10l-7-3.500H3Z|a', 'M7 10.500V7.500M10 10.500V7.500'],
    horn: ['M12 12a2 2 0 1 0 .01 0Z|a', 'M12 8a4 4 0 1 1-4 4', 'M12 4a8 8 0 1 1-8 8', 'M4 12 2 8'],
    harp: ['M7 20V7c0-2.500 3.500-3 6-1l4 4v10', 'M10 8.500V20M13 10.500V20M16 12.500V20'],
    drum: ['M4 10c0-2 3-3 8-3s8 1 8 3v7c0 2-3 3-8 3s-8-1-8-3Z|a', 'M4 10c0 2 3 3 8 3s8-1 8-3', 'M7 3l5 6M17 3l-5 6'],
    notes: ['M5 17V8l7-1.500V15', 'M5 17a2 2 0 1 0 .01 0Z|a', 'M12 15a2 2 0 1 0 .01 0Z|a', 'M15 12V6l5-1v7', 'M15 12a2 2 0 1 0 .01 0Z|a', 'M20 10a2 2 0 1 0 .01 0Z|a'],
    dots: ['M6 12h.1M12 12h.1M18 12h.1'],
    check2: ['M4 12.500l4 4L20 6'],
  };

  const MAP = {
    '🪙': 'coin', '♥': 'heart', '❤': 'heart', '♡': 'heart-o', '🔒': 'lock', '🏆': 'trophy', '🎵': 'note', '♪': 'note',
    '🎲': 'dice', '🎹': 'piano', '👑': 'crown', '⚡': 'bolt', '🎁': 'gift', '🎧': 'headphones', '💎': 'gem', '🔥': 'flame',
    '♾': 'infinity', '🎛': 'sliders', '🎻': 'violin', '🪈': 'flute', '🎷': 'sax', '🎺': 'trumpet', '📯': 'horn', '🎼': 'harp', '🥁': 'drum', '🎶': 'notes', '⬆': 'arrow-up', '↑': 'arrow-up', '↓': 'arrow-down', '⬇': 'download', '⇩': 'download',
    '▾': 'chev-down', '❚': 'pause', '◀': 'arrow-left', '←': 'arrow-left', '→': 'arrow-right', '▶': 'play', '▸': 'play',
    '✓': 'check', '✕': 'cross', '✖': 'cross', '−': 'minus', '⭐': 'star', '★': 'star', '🌟': 'glow-star', '👻': 'ghost',
    '🤖': 'robot', '🐱': 'cat', '🚀': 'rocket', '🦄': 'unicorn', '🐉': 'dragon', '🌌': 'galaxy', '👽': 'alien', '🦅': 'eagle',
    '🐐': 'goat', '🕳': 'blackhole', '🌠': 'shooting-star', '😇': 'angel', '📦': 'box', '🪩': 'disco', '🔮': 'crystal',
    '💫': 'sparkle', '💰': 'moneybag', '💸': 'moneywings', '🌱': 'seedling', '💀': 'skull', '✎': 'pencil', '↺': 'reset',
    '💾': 'floppy', '🎨': 'palette', '🗑': 'trash', '✂': 'scissors', '⚙': 'gear', '↶': 'undo', '↷': 'redo', '■': 'sq',
    '◆': 'dtap', '▮': 'hold', '✥': 'move', '▦': 'select', '▲': 'tri-up', '▼': 'tri-down',
  };

  const COLORS = {
    coin: ['#f2b92c'], heart: ['#e0553a'], lock: ['#d7b25a'], trophy: ['#f2b92c'], note: ['#6aa6d8'], dice: ['#ffffff'],
    piano: ['#ffffff', '#3a3023'], 'piano-note': ['#ffffff', '#6aa6d8'], crown: ['#f2b92c'], bolt: ['#f7d94c'], gift: ['#e0553a', '#f2b92c'],
    headphones: ['#6aa6d8'], gem: ['#7fd6e8'], flame: ['#f2803a'], sliders: ['#e0553a'], play: ['#e0553a'], star: ['#f7d94c'],
    'glow-star': ['#f7d94c'], violin: ['#c98a4b'], flute: ['#d8c27a'], sax: ['#e0a63a', '#e0a63a'], trumpet: ['#f2b92c'], horn: ['#e0a63a'], harp: ['#f0d9a8'], drum: ['#e0553a'], notes: ['#6aa6d8'], 'opt-pin': ['#e0553a', '#ffffff'], 'opt-peaks': ['#9cc4e4'], 'opt-list': ['#fff3c4'], 'opt-play': ['#f2b92c', '#e0553a'], 'opt-target': ['#ffffff', '#e0553a'], 'opt-stairs': ['#7fc47a'], ghost: ['#ffffff'], robot: ['#b9c4cc'], cat: ['#f0b070'], rocket: ['#e8e8e8'], unicorn: ['#ffffff'],
    dragon: ['#6dbb6a'], galaxy: ['#b48be0'], alien: ['#8fd36a', '#2b2b2b'], eagle: ['#b9854e'], goat: ['#e5ddd0'], blackhole: ['#3a3023'],
    'shooting-star': ['#f7d94c'], angel: ['#ffe9b5'], box: ['#d9a96b'], disco: ['#bcd0ee'], crystal: ['#c7a6ee'], sparkle: ['#f7d94c'],
    moneybag: ['#7fc47a'], moneywings: ['#f2b92c'], seedling: ['#7fc47a'], skull: ['#ffffff'], pencil: ['#f2b92c'], floppy: ['#6aa6d8'],
    palette: ['#f0d9a8'], trash: ['#d8d0c0'], gear: ['#d8d0c0'], sq: ['#3f88c5'], dtap: ['#e0553a'], hold: ['#9cc4e4'], 'tri-up': ['#3a3023'],
    'tri-down': ['#3a3023'], levels: ['#e0553a'], shop: ['#f2b92c'], flag: ['#e0553a'],
  };

  const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);
  const RE = new RegExp('(' + KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'g');

  function symbol(name) {
    const parts = I[name];
    const pal = COLORS[name] || [];
    let body = '';
    parts.forEach(p => {
      const [d, f] = p.split('|');
      const fill = f ? 'var(--ic-' + f + ',' + (pal[f === 'a' ? 0 : 1] || 'none') + ')' : 'none';
      body += '<path d="' + d + '" fill="' + fill + '"/>';
    });
    return '<symbol id="ic-' + name + '" viewBox="0 0 24 24">' + body + '</symbol>';
  }

  function spriteMarkup() {
    return '<svg id="icon-sprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
      '<filter id="ic-wobble" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter>' +
      Object.keys(I).map(symbol).join('') + '</defs></svg>';
  }

  const CSS = '.ic{display:inline-block;width:1.15em;height:1.15em;vertical-align:-.22em;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;fill:none;flex-shrink:0;overflow:visible}' +
    '.ic.ic-big{width:2.2em;height:2.2em}.ic.ic-xl{width:3.2em;height:3.2em}.ic+.ic{margin-left:.05em}';

  const html = (name, cls) => '<svg class="ic ic-' + name + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#ic-' + name + '"/></svg>';

  function node(name) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ic ic-' + name);
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#ic-' + name);
    s.appendChild(u);
    return s;
  }

  const SKIP = 'option, textarea, script, style, svg, input, select, [data-noicon]';

  function convertText(t) {
    const text = t.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(text)) return;
    RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = RE.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(node(MAP[m[1]]));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    t.parentNode.replaceChild(frag, t);
  }

  function convert(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !(root.parentNode.closest && root.parentNode.closest(SKIP))) convertText(root); return; }
    if (root.nodeType !== 1 || (root.closest && root.closest(SKIP))) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentNode.closest && n.parentNode.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const list = [];
    while (w.nextNode()) list.push(w.currentNode);
    list.forEach(convertText);
  }

  function install() {
    const style = document.createElement('style');
    style.id = 'ic-css';
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('afterbegin', spriteMarkup());
    convert(document.body);
    new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.type === 'characterData') convert(m.target);
        else m.addedNodes.forEach(n => convert(n));
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (typeof document !== 'undefined') {
    if (document.body) install();
    else document.addEventListener('DOMContentLoaded', install);
  }

  return { html, MAP, names: Object.keys(I), symbol, spriteMarkup, convert };
})();;
window.RD_InkUI = (function () {
  'use strict';

  const HOVER_SEL = 'button, .hnav, .area-chip, .song-row, .level-card, .avatar-card, .theme-card, #daily-card, #endless-card, .endless-band, .tool-btn, .ic-btn, .cr-back, #pbar-avatar, .custom-av-upload, [role="button"], label.toggle';
  const SKIP_SEL = '#g-lanes, .lane, .lane-btn, #cr-grid, .cr-cell, .bass-step, input[type="range"], #g-overlay .ov-key';

  let styleEl = null;
  let last = '';

  let probe = null;
  function read(k) {
    if (!probe) {
      probe = document.createElement('i');
      probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
    }
    probe.style.color = 'var(' + k + ')';
    return getComputedStyle(probe).color;
  }

  function fillLogos(tokens) {
    document.querySelectorAll('[data-logo]').forEach(el => {
      el.innerHTML = window.RD_Ink.logoSVG({ ink: tokens.ink, ring: tokens.dtap, tap: tokens.tap, dtap: tokens.accent, paper: window.RD_Ink.lighten(tokens.bg, 0.55), anim: el.hasAttribute('data-anim') });
    });
  }

  function refresh() {
    if (!window.RD_Ink || !document.body) return;
    fillLogos(window.RD_Ink.themeTokens(read));
    const flat = !document.body.classList.contains('gfx-modern');
    const key = (window.RD_THEMES ? 't' : '') + document.body.className + '|' + flat + '|' + read('--bg') + read('--bg3') + read('--bg4') + read('--accent') + read('--text') + read('--ink');
    if (key === last) return;
    last = key;
    const tokens = window.RD_Ink.themeTokens(read);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'ink-rules';
      document.head.appendChild(styleEl);
    }
    const extra = (window.RD_THEMES || []).map(t => ({ sel: '.theme-card[data-theme="' + t.id + '"]', fill: t.bg, ink: t.text || '#3a3023' }));
    styleEl.textContent = window.RD_Ink.rules(tokens, { flat, extra }) + '\n' + window.RD_Ink.playRules(tokens, { flat });
  }

  function kindFor(el) {
    if (el.closest('.locked, [disabled], .disabled')) return 'deny';
    if (el.closest('.hnav, .shop-subnav button')) return 'tab';
    if (el.closest('.cr-back, #g-menu-btn, .mb-close-btn, .ov-menu-btn')) return 'back';
    if (el.closest('.chaos-toggle, .adv-toggle, .bg-radio-btn')) return el.closest('.on, .sel, .active') ? 'on' : 'off';
    return 'click';
  }

  function sfx(kind) {
    if (typeof window.RD_uiSfx === 'function') window.RD_uiSfx(kind);
  }

  function labelIcons(root) {
    (root || document).querySelectorAll('button[title]:not([aria-label])').forEach(b => { b.setAttribute('aria-label', b.getAttribute('title')); });
    (root || document).querySelectorAll('svg.ic').forEach(s => { if (!s.hasAttribute('aria-hidden')) s.setAttribute('aria-hidden', 'true'); });
  }

  function install() {
    labelIcons();
    let queued = false;
    new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; labelIcons(); }); }).observe(document.body, { childList: true, subtree: true });
    let hovering = null;
    document.addEventListener('pointerover', e => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest && e.target.closest(HOVER_SEL);
      if (!el || el === hovering || el.closest(SKIP_SEL)) return;
      hovering = el;
      sfx('hover');
    }, true);
    document.addEventListener('pointerout', e => {
      if (hovering && !hovering.contains(e.relatedTarget)) hovering = null;
    }, true);
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest && e.target.closest(HOVER_SEL);
      if (!el || el.closest(SKIP_SEL)) return;
      sfx('press');
    }, true);
    document.addEventListener('click', e => {
      const el = e.target.closest && e.target.closest(HOVER_SEL);
      if (!el || el.closest(SKIP_SEL)) return;
      setTimeout(() => sfx(kindFor(el)), 0);
    }, true);
    refresh();
    new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (typeof document !== 'undefined') {
    if (document.body) install();
    else document.addEventListener('DOMContentLoaded', install);
  }

  return { refresh, kindFor };
})();
