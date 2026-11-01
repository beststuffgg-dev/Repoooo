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
    disco: ['M12 5a8 8 0 1 0 .01 0Z|a', 'M4 13h16', 'M12 5v16', 'M7 7c2 3 2 9 0 12M17 7c-2 3-2 9 0 12', 'M12 2v2'],
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
    dots: ['M6 12h.1M12 12h.1M18 12h.1'],
    check2: ['M4 12.500l4 4L20 6'],
  };

  const MAP = {
    '🪙': 'coin', '♥': 'heart', '❤': 'heart', '♡': 'heart-o', '🔒': 'lock', '🏆': 'trophy', '🎵': 'note', '♪': 'note',
    '🎲': 'dice', '🎹': 'piano', '👑': 'crown', '⚡': 'bolt', '🎁': 'gift', '🎧': 'headphones', '💎': 'gem', '🔥': 'flame',
    '♾': 'infinity', '🎛': 'sliders', '⬆': 'arrow-up', '↑': 'arrow-up', '↓': 'arrow-down', '⬇': 'download', '⇩': 'download',
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
    'glow-star': ['#f7d94c'], 'opt-pin': ['#e0553a', '#ffffff'], 'opt-peaks': ['#9cc4e4'], 'opt-list': ['#fff3c4'], 'opt-play': ['#f2b92c', '#e0553a'], 'opt-target': ['#ffffff', '#e0553a'], 'opt-stairs': ['#7fc47a'], ghost: ['#ffffff'], robot: ['#b9c4cc'], cat: ['#f0b070'], rocket: ['#e8e8e8'], unicorn: ['#ffffff'],
    dragon: ['#6dbb6a'], galaxy: ['#b48be0'], alien: ['#8fd36a', '#2b2b2b'], eagle: ['#b9854e'], goat: ['#e5ddd0'], blackhole: ['#3a3023'],
    'shooting-star': ['#f7d94c'], angel: ['#ffe9b5'], box: ['#d9a96b'], disco: ['#d6d6e8'], crystal: ['#c7a6ee'], sparkle: ['#f7d94c'],
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
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  }

  return { html, MAP, names: Object.keys(I), symbol, spriteMarkup, convert };
})();
