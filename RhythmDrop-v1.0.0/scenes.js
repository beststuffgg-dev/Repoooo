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
})();
