// ═══════════════════════════════════════════
//  RhythmDrop V8 — generator.js
//
//  This is V7's deterministic composer, bundled into V8 as a runtime
//  module so the campaign can be regenerated and endless runs can roll
//  a fresh song every time — the live generation V7 had that V8's
//  baked campaign gave up. It is a byte-for-byte copy of
//  other/v7/RhythmDropV7/campaign.js with one change: it exposes
//  window.RD_Generator instead of window.RD_Campaign, because V8
//  already has an RD_Campaign of its own (the progression engine that
//  reads the baked data). The two do not collide.
//
//  It touches no DOM and reads window.RD_INSTRUMENTS to resolve each
//  area's voice, so it loads after audio.js.
//
//  DO NOT hand-edit — re-copy from v7 if the composer changes.
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  RhythmDrop campaign.js — UPD7 Beta 1
//
//  150 hand-authored charts is not realistic, so every campaign
//  level is generated from a seed. Same seed, same chart, on
//  every device — which is also what makes shareable level
//  codes nearly free to add later.
//
//  Exposes: RD_Campaign
// ═══════════════════════════════════════════

(function () {
  'use strict';

  // ══════════════════════════════════════
  //  Deterministic RNG
  //  Math.random() is useless here — two players with the same
  //  seed must get byte-identical charts. mulberry32 is small,
  //  fast, and has good enough distribution for note placement.
  // ══════════════════════════════════════
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ══════════════════════════════════════
  //  Areas
  //  Travelling forward through time: the game should look and
  //  sound different by the time you reach the end.
  //  Themes and instruments land in Beta 2; the ids are declared
  //  now so progression can already reference them.
  // ══════════════════════════════════════
  const AREAS = [
    { id:1,  key:'farmstead', name:'Farmstead',    blurb:'Fields and folk songs',
      theme:'area-farmstead', instrument:'guitar',  material:'wood',   bpm:[84, 104] },
    { id:2,  key:'egypt',     name:'Egypt',        blurb:'Sandstone and reed flutes',
      theme:'area-egypt',     instrument:'flute',   material:'stone',  bpm:[90, 112] },
    { id:3,  key:'greece',    name:'Greece',       blurb:'Marble and the lyre',
      theme:'area-greece',    instrument:'lyre',    material:'marble', bpm:[96, 118] },
    { id:4,  key:'rome',      name:'Rome',         blurb:'Bronze horns on the road',
      theme:'area-rome',      instrument:'brass',   material:'metal',  bpm:[102, 124] },
    { id:5,  key:'aztec',     name:'Aztec',        blurb:'Obsidian and turquoise',
      theme:'area-aztec',     instrument:'marimba', material:'stone',  bpm:[108, 130] },
    { id:6,  key:'maya',      name:'Maya',         blurb:'Jade bells over the cenote',
      theme:'area-maya',      instrument:'bell',    material:'glass',  bpm:[114, 136] },
    { id:7,  key:'england',   name:'Old England',  blurb:'Oak, moss and pipe organ',
      theme:'area-england',   instrument:'organ',   material:'wood',   bpm:[120, 142] },
    { id:8,  key:'napoleon',  name:'Napoleonic',   blurb:'Drums and gold braid',
      theme:'area-napoleon',  instrument:'brass',   material:'metal',  bpm:[126, 148] },
    { id:9,  key:'modern',    name:'Modern',       blurb:'Concrete and clean glass',
      theme:'area-modern',    instrument:'piano',   material:'glass',  bpm:[132, 154] },
    { id:10, key:'retro',     name:'Retro-Future', blurb:'Neon and chiptune',
      theme:'area-retro',     instrument:'chiptune',material:'rubber', bpm:[138, 168] },
  ];

  const LEVELS_PER_AREA = 15;

  // Surface weave per area. Two areas can share a material and
  // still not look like the same object.
  const AREA_TEXTURE = {
    1:'weave', 2:'carve', 3:'vein',  4:'hammer', 5:'carve',
    6:'jade',  7:'oak',   8:'hammer',9:'brush',  10:'scan',
  };

  // Per-level jitter, derived from the seed so it is stable for
  // a given level rather than changing every time you open it.
  function textureFor(areaId, seed) {
    const rnd = mulberry32((seed | 0) ^ 0x5EED);
    return {
      cls:   'tex-' + (AREA_TEXTURE[areaId] || 'weave'),
      angle: Math.round(70 + rnd() * 50) + 'deg',
      scale: (0.78 + rnd() * 0.75).toFixed(2),
      op:    (0.72 + rnd() * 0.7).toFixed(2),
    };
  }

  // Beta 2 adds these instruments; until then they fall back to
  // something that already exists rather than failing silently.
  const INSTRUMENT_FALLBACK = {
    flute:'bell', lyre:'guitar', brass:'synth',
    organ:'piano', chiptune:'synth',
  };

  function resolveInstrument(id) {
    const have = (window.RD_INSTRUMENTS || []).some(i => i.id === id);
    return have ? id : (INSTRUMENT_FALLBACK[id] || 'synth');
  }

  // ══════════════════════════════════════
  //  Chart generation
  //
  //  The risk with 150 generated levels isn't difficulty, it's
  //  sameness. So rather than sprinkling notes at random, the
  //  generator assembles bars from a vocabulary of patterns and
  //  widens that vocabulary as the campaign progresses.
  // ══════════════════════════════════════

  // Each pattern fills one 4-beat bar. lane values are relative
  // and get rotated per bar so the same pattern doesn't always
  // sit under the same finger.
  // Each pattern fills one 4-beat bar. Lanes are relative and get
  // rotated per bar, so the same figure doesn't always sit under
  // the same finger.
  //
  // `fam` groups them so a bar can be chosen by *kind* — a run, a
  // roll, a rest — rather than at random. That is what stops
  // level 40 feeling like level 12 with more notes: the generator
  // varies the vocabulary it draws from, not just the density.
  const PATTERNS = [
    // ── pulses: the spine ──
    { name:'pulse',    fam:'pulse', minDiff:0, beats:[[0,0],[2,0]] },
    { name:'downbeat', fam:'pulse', minDiff:0, beats:[[0,0]] },
    { name:'halves',   fam:'pulse', minDiff:0, beats:[[0,0],[2,2]] },
    { name:'four',     fam:'pulse', minDiff:1, beats:[[0,0],[1,0],[2,0],[3,0]] },

    // ── walks: stepwise movement ──
    { name:'walk',     fam:'walk',  minDiff:0, beats:[[0,0],[1,1],[2,2],[3,3]] },
    { name:'walkdown', fam:'walk',  minDiff:1, beats:[[0,3],[1,2],[2,1],[3,0]] },
    { name:'stair',    fam:'walk',  minDiff:3, beats:[[0,0],[1,1],[2,2],[3,3],[3,0]] },
    { name:'amble',    fam:'walk',  minDiff:1, beats:[[0,1],[1,2],[3,3]] },

    // ── alternations: left-right figures ──
    { name:'alt2',     fam:'alt',   minDiff:1, beats:[[0,0],[1,3],[2,0],[3,3]] },
    { name:'alt4',     fam:'alt',   minDiff:3, beats:[[0,0],[1,3],[2,1],[3,2]] },
    { name:'bounce',   fam:'alt',   minDiff:2, beats:[[0,0],[1,3],[2,1],[3,2]] },
    { name:'zigzag',   fam:'alt',   minDiff:4, beats:[[0,0],[1,2],[2,1],[3,3]] },
    { name:'pendulum', fam:'alt',   minDiff:5, beats:[[0,1],[1,3],[2,0],[3,2]] },

    // ── runs: consecutive movement, the technical bars ──
    { name:'run',      fam:'run',   minDiff:1, beats:[[0,0],[1,1],[2,2],[3,1]] },
    { name:'runup',    fam:'run',   minDiff:4, beats:[[0,0],[1,1],[1,2],[2,3],[3,2]] },
    { name:'burst',    fam:'run',   minDiff:5, beats:[[0,0],[1,1],[1,2],[2,3],[3,0],[3,2]] },
    { name:'weave',    fam:'run',   minDiff:6, beats:[[0,1],[1,0],[1,3],[2,2],[3,1],[3,2]] },
    { name:'cascade',  fam:'run',   minDiff:7, beats:[[0,0],[0,1],[1,2],[1,3],[2,2],[2,1],[3,0]] },

    // ── rolls: same lane repeated, a drum figure ──
    { name:'gallop',   fam:'roll',  minDiff:3, beats:[[0,0],[1,0],[2,2],[3,2]] },
    { name:'triple',   fam:'roll',  minDiff:5, beats:[[0,0],[1,0],[2,0],[3,3]] },
    { name:'stutter',  fam:'roll',  minDiff:6, beats:[[0,1],[0,2],[1,1],[2,3],[3,3]] },

    // ── chords: simultaneous lanes ──
    { name:'pair',     fam:'chord', minDiff:0, beats:[[0,0],[0,2]] },
    { name:'chord',    fam:'chord', minDiff:2, beats:[[0,0],[0,2],[2,1],[2,3]] },
    { name:'cross',    fam:'chord', minDiff:4, beats:[[0,0],[0,3],[1,1],[2,2],[3,0],[3,3]] },
    { name:'stack',    fam:'chord', minDiff:6, beats:[[0,0],[0,1],[0,2],[2,3],[3,1]] },
    { name:'bookend',  fam:'chord', minDiff:5, beats:[[0,0],[0,3],[3,0],[3,3]] },

    // ── syncopation: the off-beat feel ──
    { name:'offbeat',  fam:'synco', minDiff:1, beats:[[1,1],[3,3]] },
    { name:'push',     fam:'synco', minDiff:3, beats:[[0,0],[1,2],[3,1]] },
    { name:'backbeat', fam:'synco', minDiff:2, beats:[[1,0],[3,2]] },
    { name:'limp',     fam:'synco', minDiff:6, beats:[[0,0],[1,1],[3,2],[3,0]] },

    // ── sparse: breathing room, not an absence of ideas ──
    { name:'hold',     fam:'sparse', minDiff:0, beats:[[0,0]] },
    { name:'echo',     fam:'sparse', minDiff:1, beats:[[0,0],[3,0]] },
    { name:'question', fam:'sparse', minDiff:2, beats:[[0,1],[2,2]] },
  ];

  const FAMILIES = ['pulse','walk','alt','run','roll','chord','synco','sparse'];

  // ══════════════════════════════════════
  //  NOTE MIX
  //
  //  Rolling each note type independently gave clumpy results —
  //  six doubles in a row, then none for twenty beats. Instead
  //  each chart gets a quota and the generator steers toward it,
  //  so every level has a deliberate blend of singles, doubles
  //  and held notes rather than a random one.
  //
  //  Styles let one seed produce genuinely different charts.
  // ══════════════════════════════════════
  const MIX_STYLES = {
    B: { name:'Balanced',  dtap:1.00, sus:1.00, density:1.00 },
    D: { name:'Dense',     dtap:1.15, sus:0.60, density:1.35 },
    S: { name:'Sparse',    dtap:0.85, sus:1.30, density:0.70 },
    H: { name:'Held',      dtap:0.70, sus:2.20, density:0.85 },
    T: { name:'Technical', dtap:1.70, sus:0.45, density:1.15 },
    F: { name:'Flowing',   dtap:0.55, sus:1.60, density:1.05 },
    // ── Classical forms ──
    // These carry a meter and a pattern bias, not just a note
    // blend, so they change the shape of the bar rather than
    // only how many doubles land in it.
    W: { name:'Waltz',     dtap:0.55, sus:1.40, density:0.85, meter:3,
         favour:['pulse','walk','pair'] },
    M: { name:'March',     dtap:0.95, sus:0.45, density:1.15, meter:2,
         favour:['gallop','pulse','pair'] },
    R: { name:'Baroque',   dtap:0.70, sus:0.35, density:1.40, meter:4,
         favour:['run','stair','walk','weave'], sequence:true },
    N: { name:'Nocturne',  dtap:0.35, sus:2.40, density:0.65, meter:4,
         favour:['pair','chord','pulse'] },
    U: { name:'Minuet',    dtap:0.60, sus:0.90, density:0.95, meter:3,
         favour:['walk','stair','pair'] },
    G: { name:'Gigue',     dtap:1.20, sus:0.50, density:1.25, meter:3,
         favour:['gallop','run','bounce'] },
    // The Double: the harder cut of a song. It rides in the style
    // slot so it travels in a share code like everything else —
    // 74ZEBTO is the double of 74BEBTO.
    Z: { name:'Double',    dtap:1.45, sus:0.55, density:1.55, meter:4,
         favour:['burst','cross','weave','gallop'], double:true },

    // ── Genres ──
    // These bias whole *families* rather than named patterns, so
    // they change what kind of bar shows up instead of picking
    // from a short list of figures.
    A: { name:'Anthem',    dtap:0.85, sus:1.30, density:1.00, meter:4,
         fams:{ chord:4, pulse:3, walk:2 } },
    E: { name:'Ballad',    dtap:0.40, sus:2.10, density:0.70, meter:4,
         fams:{ sparse:4, walk:3, chord:2 } },
    J: { name:'Swing',     dtap:1.05, sus:0.70, density:1.10, meter:4,
         fams:{ synco:5, alt:3, roll:2 } },
    K: { name:'Folk',      dtap:0.60, sus:0.90, density:0.95, meter:3,
         fams:{ walk:4, pulse:3, sparse:2 } },
    L: { name:'Drone',     dtap:0.30, sus:2.60, density:0.55, meter:4,
         fams:{ sparse:5, chord:3, pulse:2 } },
    O: { name:'Motorik',   dtap:1.15, sus:0.35, density:1.30, meter:4,
         fams:{ roll:4, pulse:4, run:2 } },
    P: { name:'Breakbeat', dtap:1.35, sus:0.45, density:1.25, meter:4,
         fams:{ synco:4, roll:3, run:3 } },
    Q: { name:'Etude',     dtap:1.10, sus:0.40, density:1.35, meter:4,
         fams:{ run:5, walk:3, alt:2 } },
    V: { name:'Fanfare',   dtap:0.90, sus:1.10, density:1.05, meter:4,
         fams:{ chord:4, roll:3, pulse:2 } },
    Y: { name:'Lullaby',   dtap:0.25, sus:2.40, density:0.60, meter:3,
         fams:{ sparse:5, walk:2, chord:2 } },
  };
  const MIX_KEYS = Object.keys(MIX_STYLES);

  // Target share of each note type at a given difficulty.
  // A one-off style built from a base plus explicit double and
  // held-note shares, so the editor's sliders drive the same
  // quota system the campaign uses rather than a parallel one.
  function styleWithMix(base, dblShare, susShare) {
    const b = MIX_STYLES[base] || MIX_STYLES.B;
    const key = '_gen';
    MIX_STYLES[key] = Object.assign({}, b, {
      name: b.name + ' (custom mix)',
      dtapAbs: Math.max(0, Math.min(0.45, dblShare)),
      susAbs:  Math.max(0, Math.min(0.40, susShare)),
    });
    return key;
  }

  function mixTargets(d, style) {
    const st = MIX_STYLES[style] || MIX_STYLES.B;
    // Doubles climb with difficulty but never dominate — past
    // about 40% the chart stops reading as rhythm and starts
    // reading as a stutter test.
    // An explicit share from the editor wins over the curve.
    if (st.dtapAbs !== undefined || st.susAbs !== undefined) {
      return {
        dtap: st.dtapAbs !== undefined ? st.dtapAbs : Math.min(0.40, (0.06 + d * 0.035) * st.dtap),
        sus:  st.susAbs  !== undefined ? st.susAbs  : (d < 2 ? 0 : Math.min(0.30, (0.03 + d * 0.018) * st.sus)),
      };
    }
    const dtap = Math.min(0.40, (0.06 + d * 0.035) * st.dtap);
    // Held notes appear from difficulty 2 and stay a garnish.
    const sus  = d < 2 ? 0 : Math.min(0.30, (0.03 + d * 0.018) * st.sus);
    return { dtap, sus };
  }

  // Generates ONE section of bars. Song form is assembled from
  // several of these — see generateChart below.
  // difficulty: 1..9. musicId picks the era. style picks the blend.
  function generateSection(seed, difficulty, bars, musicId, style, opts) {
    opts = opts || {};
    const rnd = mulberry32(seed);
    const d   = Math.max(1, Math.min(9, difficulty));
    const mus = MUSIC[musicId] || MUSIC[1];
    const st  = MIX_STYLES[style] || MIX_STYLES.B;
    const tgt = mixTargets(d, style);

    const eligible = PATTERNS.filter(p => p.minDiff <= d - 1);

    // Weight each family: the style's leaning plus a floor, so
    // nothing is ever impossible.
    const famWeight = {};
    FAMILIES.forEach(f => { famWeight[f] = 1; });
    Object.keys(st.fams || {}).forEach(f => { famWeight[f] = (famWeight[f] || 1) + st.fams[f]; });

    let lastFam = null;

    function pickFamily() {
      // Never the same family twice running — that repetition was
      // the main source of sameness across 150 levels.
      const opts = FAMILIES.filter(f =>
        f !== lastFam && eligible.some(p => p.fam === f));
      const use = opts.length ? opts : FAMILIES.filter(f => eligible.some(p => p.fam === f));
      const total = use.reduce((n, f) => n + (famWeight[f] || 1), 0);
      let roll = rnd() * total;
      for (const f of use) { roll -= (famWeight[f] || 1); if (roll <= 0) return f; }
      return use[use.length - 1];
    }

    function pickPattern(fam) {
      let opts = eligible.filter(p => p.fam === fam);
      if (!opts.length) opts = eligible;
      const weighted = [];
      opts.forEach(p => {
        let n = 1;
        if ((mus.favour || []).includes(p.name)) n += 2;
        if ((st.favour  || []).includes(p.name)) n += 2;
        for (let i = 0; i < n; i++) weighted.push(p);
      });
      return weighted[Math.floor(rnd() * weighted.length)];
    }

    // Meter: waltzes and minuets want three beats to the bar, so
    // the fourth beat of the pattern is dropped rather than the
    // bar being stretched.
    const meter = st.meter || 4;

    const intensity = opts.intensity === undefined ? 1 : opts.intensity;

    // ── Melodic walker with phrase shape ──
    // Music moves in phrases, not an unbroken stream. Every four
    // bars the line arcs up and comes back, and the last bar of
    // a phrase resolves toward the tonic. That single change is
    // most of what makes these charts sound composed.
    let deg = opts.startDeg || 0;
    const top = mus.scale.length - 1;

    const OCT_STEP = octStep(mus);
    const degMidi  = i => degMidiOf(mus, i);

    // The degree the last nextPitch() call actually sounded, octave
    // shift included, so a chord harmonises the note beside it rather
    // than the one the walker happened to be standing on.
    let lastDeg = 0;

    function stepTo(target) {
      deg += Math.sign(target - deg) || (rnd() < 0.5 ? -1 : 1);
      deg = Math.max(0, Math.min(top, deg));
    }

    function nextPitch(posInPhrase, cadence) {
      if (cadence) {
        // Resolve: walk down toward the tonic.
        stepTo(0);
      } else if (rnd() < mus.leap) {
        deg += (rnd() < 0.5 ? -1 : 1) * (2 + Math.floor(rnd() * 3));
      } else {
        // Bias upward in the first half of a phrase, down in the
        // second, so the line has an arc.
        const up = posInPhrase < 0.5;
        deg += (rnd() < (up ? 0.62 : 0.38)) ? 1 : -1;
      }
      if (deg < 0)   deg = -deg;
      if (deg > top) deg = top - (deg - top);
      deg = Math.max(0, Math.min(top, deg));

      let midi = mus.root + mus.scale[deg];
      lastDeg = deg;
      if (rnd() < mus.octave) { midi += 12; lastDeg = deg + OCT_STEP; }
      return midiToFreq(midi + 12);
    }

    // ── Quota steering ──
    let placed = 0, dtaps = 0, susts = 0;
    function wantDtap() {
      if (tgt.dtap <= 0) return false;
      const share = placed ? dtaps / placed : 0;
      // Push toward the target rather than rolling a flat chance.
      const p = tgt.dtap + (tgt.dtap - share) * 0.9;
      return rnd() < Math.max(0.02, Math.min(0.6, p));
    }
    function wantSustain() {
      if (tgt.sus <= 0) return 0;
      const share = placed ? susts / placed : 0;
      const p = tgt.sus + (tgt.sus - share) * 0.9;
      if (rnd() >= Math.max(0, Math.min(0.5, p))) return 0;
      // Longer holds at higher difficulty; 3s stays rare.
      const table = d < 4 ? [0.5, 1] : d < 7 ? [0.5, 1, 1.5, 2] : [1, 1.5, 2, 2.5, 3];
      return table[Math.floor(rnd() * table.length)];
    }

    // Bars per phrase. Four is the default and stays the common
    // case, but a song that breathes in threes or sixes puts its
    // rests and cadences somewhere else entirely — structural
    // variety for free, and seed-derived so it is identical
    // everywhere.
    const PHRASE = opts.phrase || 4;
    const grid = [];
    let restedLastBar = false;

    for (let bar = 0; bar < bars; bar++) {
      const posInPhrase = (bar % PHRASE) / PHRASE;
      const isLastBar   = bar === bars - 1;
      const cadenceBar  = isLastBar || (bar % PHRASE === PHRASE - 1);

      // Rests land at phrase ends, where music actually breathes,
      // instead of at random points mid-line.
      //
      // Never two bars running, though. A rest bar is completely
      // empty, so back-to-back rests read as the game having stopped
      // rather than the music breathing — measured at up to 13 beats
      // of unbroken silence, 5.6 seconds mid-song, and a median
      // longest gap of 6 beats across the campaign. One bar of air is
      // phrasing; two is a bug report.
      const restChance = (cadenceBar ? 0.22 : 0.05) * (2 - st.density) / intensity;
      const rest = !isLastBar && bar > 0 && !restedLastBar && rnd() < restChance;
      restedLastBar = rest;

      // A bar is as many beats as the meter says. This used to push
      // four rows whatever the style, and merely decline to place
      // notes past the meter — so a 3/4 waltz was really 4/4 with a
      // silent fourth beat, and a 2/4 march was 4/4 half empty.
      // Measured across the 150 campaign charts: styles with meter 3
      // put 0% of their notes on beat 4, and the march put 0% on
      // beats 3 AND 4, i.e. half of every bar was structurally
      // silent. 39 of 150 levels were affected.
      const rows = Array.from({ length: meter }, () => [null, null, null, null]);

      // The scale degree sounding on each beat of this bar, so the
      // chord step can harmonise against the melody rather than
      // guessing.
      const beatDeg  = [];
      // How far up the stack of thirds each beat has already been
      // voiced, so a third note on a beat becomes the fifth and not
      // another third.
      const beatStack = [];

      if (!rest) {
        lastFam = pickFamily();
        const pat = pickPattern(lastFam);
        const rotate = Math.floor(rnd() * 4);

        // Density trims beats out or fills extra ones in, so
        // Dense is genuinely denser and Sparse genuinely sparser
        // rather than only differing in how often bars rest.
        let beats = pat.beats.slice();
        // Patterns are written in four. Trim to the meter first, so
        // the density pass below adds and removes beats within the
        // bar that actually exists — trimming afterwards threw away
        // part of the density a dense style had just asked for.
        if (meter < 4) beats = beats.filter(([b]) => b < meter);
        if (st.density < 1 && beats.length > 2) {
          const drop = Math.round(beats.length * (1 - st.density) * 0.6);
          for (let i = 0; i < drop; i++) beats.splice(Math.floor(rnd() * beats.length), 1);
        } else if (st.density > 1) {
          const add = Math.round(beats.length * (st.density - 1));
          for (let i = 0; i < add; i++) {
            const b = Math.floor(rnd() * meter);
            const taken = beats.filter(x => x[0] === b).map(x => x[1]);
            const free  = [0, 1, 2, 3].filter(l => !taken.includes(l));
            if (free.length) beats.push([b, free[Math.floor(rnd() * free.length)]]);
          }
          beats.sort((x, y) => x[0] - y[0]);
        }

        beats.forEach(([b, lane], i) => {
          const L = (lane + rotate) % 4;
          if (rows[b][L]) return;

          const cadence = cadenceBar && i === beats.length - 1;
          const isDtap  = wantDtap();
          const sustain = wantSustain();

          // A second note on a beat that is already sounding is not
          // another step of the melody — it is harmony. Half the
          // patterns here place two or three notes on one beat, and
          // walking the melody for each of them is what made
          // simultaneous hits land on whatever interval the walker
          // happened to reach. Stack them in thirds above the note
          // already there and those same patterns play as chords.
          let freq;
          if (beatDeg[b] === undefined) {
            freq = nextPitch(posInPhrase, cadence);
            beatDeg[b]   = lastDeg;
            beatStack[b] = 0;
          } else {
            beatStack[b] += 2;
            freq = midiToFreq(degMidi(beatDeg[b] + beatStack[b]) + 12);
          }

          rows[b][L] = { type: isDtap ? 'dtap' : 'tap', freq, sustain };
          placed++;
          if (isDtap) dtaps++;
          if (sustain > 0) susts++;
        });

        // ── Chords ───────────────────────────────────
        // A real triad rather than one stray interval: take a beat
        // that already carries melody, treat its degree as the chord
        // root, and fill free lanes with the degrees stacked in
        // thirds above it. Stacking scale degrees is what builds a
        // triad, and it is also why the chord can never contain a
        // second — which is what made simultaneous hits sour before.
        if (rnd() < mus.chord) {
          // Beats that have a note to harmonise and room beside it.
          // Restricted to the meter, or a waltz picks up a stray
          // note on beat four and stops being in three.
          const cands = [];
          for (let b = 0; b < meter; b++) {
            if (beatDeg[b] === undefined) continue;
            const free = [0, 1, 2, 3].filter(l => !rows[b][l]);
            if (!free.length) continue;
            // Downbeats carry harmony; mid-bar chords sound incidental.
            const weight = b === 0 ? 3 : (b === meter - 1 ? 2 : 1);
            for (let w = 0; w < weight; w++) cands.push({ b, free });
          }

          if (cands.length) {
            const { b, free } = cands[Math.floor(rnd() * cands.length)];
            const root = beatDeg[b];

            // Third, then fifth, then the seventh once the charts are
            // busy enough to carry it. Difficulty decides how much of
            // the stack actually gets voiced.
            const stack = [2, 4];
            if (d >= 7 && rnd() < 0.35) stack.push(6);
            const want = d < 3 ? 1
                       : d < 6 ? (rnd() < 0.45 ? 2 : 1)
                       : Math.min(stack.length, rnd() < 0.6 ? stack.length : 2);

            // Cadence chords ring: a held triad is what resolution
            // sounds like. Mid-phrase ones stay short.
            const hold = (cadenceBar && d >= 3) ? 1.5 : 0;

            const lanes = free.slice();
            for (let t = 0; t < want && lanes.length; t++) {
              const L = lanes.splice(Math.floor(rnd() * lanes.length), 1)[0];
              // Continue the beat's own stack rather than restarting
              // it, so this never doubles a tone already sounding.
              beatStack[b] = (beatStack[b] || 0) + 2;
              rows[b][L] = {
                type: 'tap',
                freq: midiToFreq(degMidi(root + Math.max(stack[t], beatStack[b])) + 12),
                sustain: hold,
              };
              placed++;
              if (hold > 0) susts++;
            }
          }
        }
      }
      grid.push(...rows);
    }

    // Only the closing section resolves to the tonic. Ending a
    // verse there would make every section sound like the end.
    // Scan lanes backwards too — a chord can leave a later note
    // in the same row, and resolving the wrong one leaves it hanging.
    if (!opts.resolve) return grid;

    for (let r = grid.length - 1; r >= 0; r--) {
      const row = grid[r];
      let li = -1;
      for (let l = row.length - 1; l >= 0; l--) if (row[l]) { li = l; break; }
      if (li >= 0) {
        row[li].freq = midiToFreq(mus.root + mus.scale[0] + 12);
        if (row[li].sustain === 0 && d >= 3) row[li].sustain = 1.5;
        break;
      }
    }
    return grid;
  }

  // ══════════════════════════════════════
  //  MUSICAL PROFILES
  //
  //  Each area generates notes an instrument of that era could
  //  plausibly have played. That means three things per area:
  //  the scale it draws from, how the melody moves through it
  //  (folk steps vs fanfare leaps), and which rhythm patterns
  //  it favours.
  //
  //  scale = semitone offsets from the root.
  // ══════════════════════════════════════
  const MUSIC = {
    1: { // Farmstead — folk. Major pentatonic, stepwise, plain rhythm.
      root:57, scale:[0,2,4,7,9,12,14,16],       // A major pentatonic
      leap:0.18, chord:0.10, octave:0.10,
      favour:['pulse','walk','pair','offbeat'],
    },
    2: { // Egypt — double harmonic. The augmented second is the
        // sound people read as ancient near-east.
      root:50, scale:[0,1,4,5,7,8,11,12],        // D double harmonic
      leap:0.30, chord:0.06, octave:0.14,
      favour:['pulse','pair','offbeat','run'],
    },
    3: { // Greece — Dorian, the mode named for them. Flowing,
        // mostly stepwise, lyre-like.
      root:50, scale:[0,2,3,5,7,9,10,12],        // D dorian
      leap:0.22, chord:0.14, octave:0.10,
      favour:['walk','run','stair','pair'],
    },
    4: { // Rome — brass fanfare. Bugle-style: leaps through the
        // harmonic series, almost no stepwise motion.
      root:48, scale:[0,4,7,12,16,19,24],        // C major triad stack
      leap:0.72, chord:0.26, octave:0.20,
      favour:['pulse','gallop','chord','pair'],
    },
    5: { // Aztec — minor pentatonic, syncopated, percussive.
      root:45, scale:[0,3,5,7,10,12,15,17],      // A minor pentatonic
      leap:0.34, chord:0.18, octave:0.12,
      favour:['offbeat','bounce','gallop','cross'],
    },
    6: { // Maya — anhemitonic, bell-like. No semitones at all,
        // which is what makes struck metal read as ceremonial.
      root:52, scale:[0,2,4,7,9,12,14,16],
      leap:0.40, chord:0.22, octave:0.24,
      favour:['pair','chord','pulse','stair'],
    },
    7: { // Old England — Mixolydian. The flat seventh is the
        // whole sound of English modal folk and church organ.
      root:43, scale:[0,2,4,5,7,9,10,12],        // G mixolydian
      leap:0.24, chord:0.30, octave:0.10,
      favour:['walk','chord','pulse','stair'],
    },
    8: { // Napoleonic — military march. Triadic bugle calls on a
        // rigid duple pulse.
      root:46, scale:[0,4,7,12,16,19],
      leap:0.66, chord:0.20, octave:0.16,
      favour:['gallop','pulse','pair','run'],
    },
    9: { // Modern — minor pentatonic with the blue note.
      root:48, scale:[0,3,5,6,7,10,12,15],       // C blues
      leap:0.36, chord:0.16, octave:0.14,
      favour:['run','bounce','cross','burst'],
    },
    10:{ // Retro-Future — chiptune. Fast arpeggios, wide leaps,
        // chromatic passing tones.
      root:48, scale:[0,3,5,7,10,12,15,17,19,24],
      leap:0.58, chord:0.24, octave:0.30,
      favour:['burst','weave','run','gallop'],
    },
  };

  const midiToFreq = m => parseFloat((440 * Math.pow(2, (m - 69) / 12)).toFixed(2));

  // ── Harmony helpers ──────────────────────
  // Chords are built by stacking scale degrees in thirds — degree i,
  // i+2, i+4 — which is what a triad is, and why a chord built this
  // way can never contain a second.

  // How many degrees a scale takes to climb an octave. The tables run
  // past their own octave, so this is where they start repeating; a
  // stacked third that runs off the end wraps here instead of being
  // clamped, which used to collapse high chords into unisons.
  const OCT_STEP = {};
  function octStep(mus) {
    const key = mus.root + ':' + mus.scale.join(',');
    if (OCT_STEP[key] !== undefined) return OCT_STEP[key];
    let n = mus.scale.length;
    for (let i = 1; i < mus.scale.length; i++) {
      if (mus.scale[i] - mus.scale[0] >= 12) { n = i; break; }
    }
    return (OCT_STEP[key] = n);
  }

  // The MIDI note a scale degree sounds, counting past the end of the
  // table into the octaves above.
  function degMidiOf(mus, i) {
    const step = octStep(mus);
    const oct  = Math.floor(i / step);
    return mus.root + mus.scale[i - oct * step] + oct * 12;
  }

  // The degree a frequency is sitting on. Lets a note added after the
  // fact harmonise what it lands beside instead of picking a pitch out
  // of the air.
  function degOfFreq(mus, freq) {
    const midi = Math.round(69 + 12 * Math.log2(freq / 440)) - 12;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < octStep(mus) * 3; i++) {
      const d = Math.abs(degMidiOf(mus, i) - midi);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Lane default pitches for an area: the first four scale degrees.
  function scaleFreqs(areaId) {
    const m = MUSIC[areaId] || MUSIC[1];
    return [0, 1, 2, 3].map(i => midiToFreq(m.root + m.scale[i % m.scale.length] + 12));
  }

  const SCALES = Array.from({ length: 10 }, (_, i) => scaleFreqs(i + 1));

  function areaById(id) { return AREAS.find(a => a.id === id); }

  // A campaign seed is areaId*1000 + levelIdx, so a code can be
  // recognised as one of the 150 and placed within its area.
  // Anything else is a shared or endless code.
  function campaignIndexFor(areaId, seed) {
    const i = seed - areaId * 1000;
    return (i >= 0 && i < LEVELS_PER_AREA) ? i : null;
  }

  // Tempo. The campaign ramps across an area and steps up at the
  // boundary, which is the whole point of the per-area bpm band —
  // deriving it from the difficulty digit instead made all 15
  // levels of an area the same speed, and the jitter pushed the
  // late areas past their own ceiling.
  function tempoFor(area, seed, difficulty, levelIdx) {
    const lo = area.bpm[0], hi = area.bpm[1];
    let pos;
    if (levelIdx !== null && levelIdx !== undefined) {
      pos = LEVELS_PER_AREA > 1 ? levelIdx / (LEVELS_PER_AREA - 1) : 0;
    } else {
      // Shared and endless codes have no place in an area, so the
      // difficulty digit sets the pace and the seed spreads it a
      // little either side.
      pos = (difficulty - 1) / 8 + (mulberry32(seed ^ 0x9E37)() - 0.5) * 0.12;
    }
    return Math.round(lo + (hi - lo) * Math.max(0, Math.min(1, pos)));
  }

  // Difficulty across the whole campaign, 1..9.
  function difficultyFor(areaId, levelIdx) {
    const progress = ((areaId - 1) * LEVELS_PER_AREA + levelIdx) / (AREAS.length * LEVELS_PER_AREA);
    return Math.max(1, Math.min(9, Math.round(1 + progress * 8)));
  }

  // ══════════════════════════════════════
  //  SONG FORM
  //
  //  A chart used to be one undifferentiated stream of bars.
  //  Real songs have a chorus you recognise when it comes back,
  //  and quieter parts between that make its return land.
  //
  //     short   intro  verse  CHORUS  verse  CHORUS  outro
  //     long    intro  verse  CHORUS  verse  CHORUS  bridge  CHORUS  outro
  //
  //  The chorus is generated ONCE and repeated verbatim — that
  //  literal repetition is what makes it a chorus rather than
  //  just another verse.
  // ══════════════════════════════════════

  // Sections can each carry their own voice. A chorus arriving on
  // brass after a flute verse does the same job as an arrangement
  // change in a real song.
  const SECTION_VOICES = {
    1:  { lead:'guitar',   chorus:'strings',  soft:'kalimba'  },
    2:  { lead:'flute',    chorus:'lyre',     soft:'flute'    },
    3:  { lead:'lyre',     chorus:'strings',  soft:'flute'    },
    4:  { lead:'brass',    chorus:'organ',    soft:'lyre'     },
    5:  { lead:'marimba',  chorus:'brass',    soft:'kalimba'  },
    6:  { lead:'bell',     chorus:'marimba',  soft:'kalimba'  },
    7:  { lead:'organ',    chorus:'strings',  soft:'lyre'     },
    8:  { lead:'brass',    chorus:'organ',    soft:'flute'    },
    9:  { lead:'piano',    chorus:'strings',  soft:'piano'    },
    10: { lead:'chiptune', chorus:'synth',    soft:'chiptune' },
  };

  function voicesFor(areaId) {
    const v = SECTION_VOICES[areaId] || SECTION_VOICES[1];
    return {
      lead:   resolveInstrument(v.lead),
      chorus: resolveInstrument(v.chorus),
      soft:   resolveInstrument(v.soft),
    };
  }

  function tagVoice(rows, inst) {
    rows.forEach(r => r.forEach(c => { if (c) c.inst = inst; }));
    return rows;
  }

  // ══════════════════════════════════════
  //  SECTION VARIATION
  //
  //  A chorus that returns byte-identical is what made long songs
  //  read as a loop — a third of every chart was literal copy. Real
  //  songs bring the chorus back recognisably the same and then
  //  change one bar in four: an extra fill, a dropped hit, a note
  //  left ringing.
  //
  //  Only a minority of bars are touched, so the section is still
  //  obviously itself, and the row count never changes — the plan
  //  and the chart have to agree on length.
  //
  //  Seeded from the song, so every device ornaments identically.
  // ══════════════════════════════════════
  function varyRows(rows, seed, musicId, d, meter) {
    const rnd = mulberry32(seed >>> 0);
    const mus = MUSIC[musicId] || MUSIC[1];
    // Bars are `meter` rows now, so walking them four at a time would
    // ornament across bar lines in a waltz.
    const m    = meter || 4;
    const bars = Math.floor(rows.length / m);

    for (let b = 0; b < bars; b++) {
      if (rnd() > 0.28) continue;          // most bars return untouched
      const base = b * m;

      const cells = [];
      for (let r = base; r < base + m && r < rows.length; r++) {
        for (let l = 0; l < 4; l++) if (rows[r][l]) cells.push([r, l]);
      }
      if (!cells.length) continue;

      const roll = rnd();
      if (roll < 0.30) {
        // An extra note alongside one that is already there — so it
        // has to harmonise that note, not sound a degree picked out
        // of the air. A third or a fifth above whatever is in the row.
        const [r] = cells[Math.floor(rnd() * cells.length)];
        const free = [0, 1, 2, 3].filter(l => !rows[r][l]);
        if (free.length) {
          const L    = free[Math.floor(rnd() * free.length)];
          const src  = rows[r].find(c => c);
          const base = src ? degOfFreq(mus, src.freq) : 0;
          const step = rnd() < 0.6 ? 2 : 4;
          rows[r][L] = {
            type: 'tap',
            freq: midiToFreq(degMidiOf(mus, base + step) + 12),
            sustain: 0,
            inst: src ? src.inst : undefined,
          };
        }
      } else if (roll < 0.55) {
        // Drop a hit — the ear reads the gap as a breath.
        if (cells.length > 1) {
          const [r, l] = cells[Math.floor(rnd() * cells.length)];
          rows[r][l] = null;
        }
      } else if (roll < 0.80) {
        // Harden one hit into a double.
        if (d >= 2) {
          const [r, l] = cells[Math.floor(rnd() * cells.length)];
          rows[r][l].type = 'dtap';
        }
      } else {
        // Let the last note of the bar ring, or cut one that did.
        const [r, l] = cells[cells.length - 1];
        rows[r][l].sustain = rows[r][l].sustain ? 0 : (d < 5 ? 1 : 1.5);
      }
    }
    return rows;
  }

  // The plan divides the bar budget up rather than multiplying it.
  // Getting this wrong made every song roughly twice its target
  // length, because the unit was bars/7 while the multipliers
  // summed to 13.
  // Several song shapes rather than one. Which a song uses is
  // chosen from its seed, so it is still identical everywhere —
  // varied, not random at play time.
  // ══════════════════════════════════════
  //  SECTION ROLES
  //  A shape can name any section; this table says how to build
  //  one. `repeat` marks sections that come back verbatim — that
  //  literal return is what makes a chorus a chorus.
  // ══════════════════════════════════════
  const SECTION_ROLES = {
    Intro:      { intensity:0.70, voice:'soft',   deg:0 },
    Verse:      { intensity:1.00, voice:'lead',   deg:1 },
    Prechorus:  { intensity:1.15, voice:'lead',   deg:3, lift:true },
    Chorus:     { intensity:1.35, voice:'chorus', deg:2, repeat:true },
    Refrain:    { intensity:1.20, voice:'chorus', deg:2, repeat:true },
    Head:       { intensity:1.10, voice:'chorus', deg:1, repeat:true },
    Ritornello: { intensity:1.15, voice:'chorus', deg:0, repeat:true },
    Bridge:     { intensity:0.80, voice:'soft',   deg:4 },
    Break:      { intensity:0.50, voice:'soft',   deg:0, style:'L' },
    Solo:       { intensity:1.25, voice:'lead',   deg:5, style:'Q' },
    Drop:       { intensity:1.50, voice:'chorus', deg:2, style:'P' },
    Build:      { intensity:1.10, voice:'lead',   deg:3, lift:true },
    Exposition: { intensity:1.00, voice:'lead',   deg:0 },
    Development:{ intensity:1.15, voice:'soft',   deg:4, style:'R' },
    Recap:      { intensity:1.05, voice:'lead',   deg:0, repeat:true },
    Trio:       { intensity:0.90, voice:'soft',   deg:2 },
    Variation:  { intensity:1.10, voice:'lead',   deg:2 },
    Cadenza:    { intensity:1.30, voice:'lead',   deg:6, style:'Q' },
    Coda:       { intensity:0.85, voice:'chorus', deg:0 },
    Outro:      { intensity:0.60, voice:'soft',   deg:0 },
  };

  // ══════════════════════════════════════
  //  SONG STRUCTURES
  //  34 named forms. `min` is the bar budget a form needs before
  //  it is worth using — a 10-section suite in 12 bars is just
  //  noise. Which form a song uses comes from its seed, so it is
  //  varied but identical on every device.
  // ══════════════════════════════════════
  const SHAPES = [
    // ── popular forms ──
    { name:'Pop',        min:0,
      parts:[['Intro',1],['Verse',2],['Chorus',2],['Verse',2],['Chorus',2],['Outro',1]] },
    { name:'Pop (full)', min:40,
      parts:[['Intro',1],['Verse',2],['Prechorus',1],['Chorus',2],['Verse',2],
             ['Prechorus',1],['Chorus',2],['Bridge',1],['Chorus',2],['Outro',1]] },
    { name:'Anthem',     min:34,
      parts:[['Intro',1],['Verse',2],['Prechorus',1],['Chorus',3],['Verse',2],
             ['Chorus',3],['Outro',1]] },
    { name:'Ballad',     min:26,
      parts:[['Intro',2],['Verse',3],['Chorus',2],['Verse',3],['Outro',2]] },
    { name:'Power Ballad', min:38,
      parts:[['Intro',2],['Verse',2],['Prechorus',1],['Chorus',2],['Verse',2],
             ['Chorus',2],['Solo',2],['Chorus',3],['Outro',1]] },
    { name:'AABA',       min:24,
      parts:[['Verse',2],['Verse',2],['Bridge',2],['Verse',2],['Outro',1]] },
    { name:'Verse-Refrain', min:20,
      parts:[['Verse',2],['Refrain',1],['Verse',2],['Refrain',1],['Verse',2],['Refrain',2]] },
    { name:'Strophic',   min:16,
      parts:[['Verse',3],['Verse',3],['Verse',3],['Coda',1]] },

    // ── club and electronic ──
    { name:'House',      min:36,
      parts:[['Intro',2],['Build',2],['Drop',3],['Break',2],['Build',2],['Drop',3],['Outro',2]] },
    { name:'Trance',     min:44,
      parts:[['Intro',3],['Build',2],['Break',2],['Build',2],['Drop',4],
             ['Break',2],['Drop',3],['Outro',2]] },
    { name:'Dubstep',    min:34,
      parts:[['Intro',1],['Build',2],['Drop',3],['Verse',2],['Build',1],['Drop',3],['Outro',1]] },
    { name:'Drum & Bass',min:36,
      parts:[['Intro',2],['Drop',3],['Break',2],['Drop',3],['Break',1],['Drop',3],['Outro',1]] },
    { name:'Ambient',    min:22,
      parts:[['Intro',3],['Verse',3],['Break',2],['Verse',3],['Outro',3]] },
    { name:'Techno',     min:32,
      parts:[['Intro',2],['Verse',3],['Build',1],['Drop',3],['Break',2],['Drop',3],['Outro',2]] },

    // ── classical forms ──
    { name:'Sonata',     min:48,
      parts:[['Exposition',3],['Exposition',3],['Development',3],['Recap',3],['Coda',2]] },
    { name:'Rondo',      min:30,
      parts:[['Refrain',2],['Verse',2],['Refrain',2],['Bridge',2],['Refrain',2],['Coda',1]] },
    { name:'Minuet & Trio', min:30,
      parts:[['Verse',2],['Verse',2],['Trio',2],['Trio',2],['Verse',2],['Coda',1]] },
    { name:'Theme & Variations', min:36,
      parts:[['Exposition',2],['Variation',2],['Variation',2],['Variation',2],
             ['Variation',2],['Coda',2]] },
    { name:'Concerto',   min:46,
      parts:[['Ritornello',2],['Verse',3],['Ritornello',2],['Development',2],
             ['Cadenza',2],['Ritornello',2],['Coda',1]] },
    { name:'Nocturne',   min:26,
      parts:[['Intro',2],['Verse',3],['Bridge',2],['Verse',3],['Coda',2]] },
    { name:'Prelude',    min:14,
      parts:[['Intro',1],['Verse',3],['Development',2],['Coda',1]] },
    { name:'Waltz',      min:28,
      parts:[['Intro',1],['Verse',2],['Trio',2],['Verse',2],['Trio',2],['Coda',1]] },
    { name:'March',      min:30,
      parts:[['Intro',1],['Verse',2],['Verse',2],['Trio',3],['Verse',2],['Coda',1]] },
    { name:'Overture',   min:42,
      parts:[['Intro',2],['Exposition',3],['Verse',2],['Development',3],
             ['Recap',3],['Coda',2]] },

    // ── baroque ──
    { name:'Fugue',      min:40,
      parts:[['Exposition',2],['Exposition',2],['Development',3],['Exposition',2],
             ['Development',2],['Recap',2],['Coda',1]] },
    { name:'Ritornello', min:38,
      parts:[['Ritornello',2],['Verse',2],['Ritornello',2],['Verse',2],
             ['Ritornello',2],['Verse',2],['Ritornello',2]] },
    { name:'Passacaglia',min:32,
      parts:[['Exposition',2],['Variation',2],['Variation',2],['Variation',2],
             ['Variation',2],['Variation',2],['Coda',1]] },
    { name:'Suite',      min:44,
      parts:[['Intro',1],['Verse',2],['Bridge',1],['Chorus',2],['Verse',2],
             ['Break',1],['Chorus',2],['Bridge',1],['Chorus',2],['Outro',1]] },
    { name:'Chorale',    min:20,
      parts:[['Verse',2],['Refrain',2],['Verse',2],['Refrain',2],['Coda',1]] },

    // ── jazz ──
    { name:'Jazz Head',  min:34,
      parts:[['Head',2],['Solo',3],['Solo',3],['Head',2],['Coda',1]] },
    { name:'Blues',      min:24,
      parts:[['Head',2],['Verse',2],['Solo',2],['Verse',2],['Head',2]] },
    { name:'Bebop',      min:38,
      parts:[['Head',2],['Solo',2],['Solo',2],['Bridge',2],['Solo',2],['Head',2],['Coda',1]] },
    { name:'Swing',      min:30,
      parts:[['Intro',1],['Head',2],['Verse',2],['Solo',3],['Head',2],['Outro',1]] },
    { name:'Ballad (jazz)', min:28,
      parts:[['Intro',2],['Head',3],['Solo',3],['Head',3],['Coda',2]] },
  ];

  function shapeFor(bars, seed, name) {
    if (name) {
      const named = SHAPES.find(sh => sh.name === name);
      if (named) return named;
    }
    const opts = SHAPES.filter(sh => bars >= sh.min);
    const rnd  = mulberry32((seed | 0) ^ 0x5A1E);
    return opts[Math.floor(rnd() * opts.length)] || SHAPES[0];
  }

  function sectionPlan(bars, seed, name) {
    const shape = shapeFor(bars, seed === undefined ? 0 : seed, name);

    // A repeating section comes back VERBATIM, so every occurrence
    // has to be the same length. A few shapes ask for a longer
    // final chorus (Power Ballad wants 2,2,3); honouring that would
    // mean the cached chorus no longer fills the bars the plan
    // allotted it, and the song silently runs long. First occurrence
    // wins.
    const firstMult = {};
    const parts = shape.parts.map(([n2, mult]) => {
      if (!(SECTION_ROLES[n2] || {}).repeat) return [n2, mult];
      if (firstMult[n2] === undefined) firstMult[n2] = mult;
      return [n2, firstMult[n2]];
    });

    const units = parts.reduce((n, p) => n + p[1], 0);
    const unit  = Math.max(2, Math.floor(bars / units));
    const plan  = parts.map(([n2, mult]) => [n2, unit * mult]);

    // Rounding down leaves a shortfall, which on a ten-section
    // form cost enough bars to drop a song under its target
    // length. Hand the remainder to the longest sections — but a
    // repeating section can only grow in step with its own
    // repeats, so it is topped up as a group or not at all.
    const groups = [];
    const groupOf = {};
    plan.forEach(([n2], idx) => {
      if (!(SECTION_ROLES[n2] || {}).repeat) { groups.push([idx]); return; }
      if (groupOf[n2] === undefined) { groupOf[n2] = groups.length; groups.push([]); }
      groups[groupOf[n2]].push(idx);
    });
    groups.sort((a, b) => plan[b[0]][1] - plan[a[0]][1]);

    let spent = plan.reduce((n, p) => n + p[1], 0);
    let grew = true;
    while (spent < bars && grew) {
      grew = false;
      for (const g of groups) {
        if (spent + g.length > bars) continue;
        g.forEach(idx => { plan[idx][1] += 1; });
        spent += g.length;
        grew = true;
        if (spent >= bars) break;
      }
    }
    return plan;
  }

  // Beat offsets of each section, for anything that wants to
  // display structure.
  function sectionMapFor(bars, seed, shapeName, meter) {
    let at = 0;
    const m = meter || 4;
    return sectionPlan(bars, seed, shapeName).map(([name, len]) => {
      const start = at; at += len * m;
      return { name, startBeat: start, endBeat: at };
    });
  }

  // Actual bars a plan produces, so callers can check their maths.
  function planBars(bars, seed) {
    return sectionPlan(bars, seed).reduce((n, p) => n + p[1], 0);
  }

  function generateChart(seed, difficulty, bars, musicId, style, shapeName) {
    const V = voicesFor(musicId || 1);
    const d = Math.max(1, Math.min(9, difficulty));
    const plan = sectionPlan(bars, seed, shapeName);

    // Sections marked `repeat` are generated once and returned to
    // with fresh ornaments. Each repeating NAME gets its own cache,
    // so a rondo with a refrain and a fugue with a subject both work.
    const cache = {};

    // How many bars a phrase runs for. Four is the common case and
    // stays the default; threes and sixes move every cadence and
    // rest in the song, which is a bigger structural difference than
    // any amount of note-level shuffling. Drawn from the seed, so a
    // given song phrases the same way on every device.
    const phrase = [4, 4, 4, 4, 3, 6][
      Math.floor(mulberry32(((seed | 0) ^ 0x9F2A5E) >>> 0)() * 6)] || 4;

    // The song's meter. Every section runs in it — a role may swap the
    // style but never the meter, or a waltz stops being in three
    // halfway through — so bar arithmetic anywhere below uses this.
    const songMeter = (MIX_STYLES[style] || MIX_STYLES.B).meter || 4;

    function sectionFor(name, len, index, isLast) {
      const role = SECTION_ROLES[name] || SECTION_ROLES.Verse;

      // In a shape with no chorus at all, the contrasting section
      // takes the chorus voice — otherwise an AABA song plays
      // start to finish on one instrument.
      const hasChorusish = plan.some(p => (SECTION_ROLES[p[0]] || {}).repeat);
      let voiceKey = role.voice;
      if (!hasChorusish && (name === 'Bridge' || name === 'Trio' || name === 'Development')) {
        voiceKey = 'chorus';
      }
      const voice = V[voiceKey] || V.lead;

      // Deep copy so a later transposition can't mutate the original.
      // The length check is a guard, not a feature: sectionPlan keeps
      // every occurrence of a repeating section the same size, and if
      // that ever stops being true we regenerate rather than hand back
      // a section that doesn't fill its bars.
      if (role.repeat && cache[name] && cache[name].length === len * songMeter) {
        const back = cache[name].map(r => r.map(c => (c ? Object.assign({}, c) : null)));
        // Same chorus, different fills. `index` makes each return
        // ornament differently from the last.
        return tagVoice(
          varyRows(back, seed ^ hashName(name) ^ (0x5B * (index + 1)), musicId, d, songMeter),
          voice);
      }

      // A section can override the song's style — a Solo runs as
      // an etude, a Break as a drone — which is most of what makes
      // a jazz head sound different from the solo after it.
      // A role can swap the style — a Solo runs as an etude, a
      // Break as a drone — but it must not change the METER, or a
      // waltz stops being in three halfway through.
      let useStyle = role.style || style;
      if (role.style) {
        const roleSt = MIX_STYLES[role.style] || MIX_STYLES.B;
        if ((roleSt.meter || 4) !== songMeter) {
          MIX_STYLES['_role_' + role.style] =
            Object.assign({}, roleSt, { meter: songMeter });
          useStyle = '_role_' + role.style;
        }
      }
      const useDiff  = Math.max(1, Math.min(9,
        d + (role.intensity >= 1.3 ? 1 : role.intensity <= 0.6 ? -2 : 0)));

      let rows = generateSection(
        seed ^ (0x100 * (index + 1)) ^ hashName(name),
        useDiff, len, musicId, useStyle,
        { intensity: role.intensity, startDeg: role.deg, resolve: isLast,
          phrase: phrase });

      rows = tagVoice(rows, voice);

      if (role.repeat) cache[name] = rows.map(r => r.map(c => (c ? Object.assign({}, c) : null)));
      return rows;
    }

    const grid = [];
    const repeats = {};
    plan.forEach(([name, len]) => { repeats[name] = (repeats[name] || 0) + 1; });
    const seenSoFar = {};

    plan.forEach(([name, len], i) => {
      const isLast = i === plan.length - 1;
      seenSoFar[name] = (seenSoFar[name] || 0) + 1;
      const rows = sectionFor(name, len, i, isLast);

      // The final return of a repeating section lifts a whole tone,
      // so the last chorus isn't simply the first one again.
      const role = SECTION_ROLES[name] || {};
      if (role.repeat && repeats[name] > 2 && seenSoFar[name] === repeats[name]) {
        rows.forEach(r => r.forEach(c => { if (c && c.freq) c.freq = c.freq * 1.122462; }));
      }
      grid.push(...rows);
    });
    return grid;
  }

  // Small stable hash so each section name seeds differently.
  function hashName(n) {
    let h = 0;
    for (let i = 0; i < n.length; i++) h = ((h << 5) - h + n.charCodeAt(i)) | 0;
    return h & 0xFFFF;
  }

  // ══════════════════════════════════════
  //  SONG TITLES
  //  Two banks per area, combined deterministically from the
  //  seed. Every level is a named piece rather than "Egypt 7",
  //  and the same seed always yields the same title.
  // ══════════════════════════════════════
  const TITLE_WORDS = {
    1:  { a:['Harvest','Barley','Meadow','Cider','Furrow','Hearth','Millstone','Thresher',
             'Orchard','Haywain','Plough','Sheaf','Pasture','Brookside','Dawn'],
          b:['Reel','Jig','Round','Song','Dance','Air','Waltz','Carol','March','Refrain'] },
    2:  { a:['Nile','Scarab','Obelisk','Sandstorm','Cartouche','Lotus','Sphinx','Papyrus',
             'Amber Sun','Reed','Alabaster','Coronation','Delta','Ibis','Oasis'],
          b:['Procession','Hymn','Lament','Rite','Ascension','Chant','Invocation','Passage'] },
    3:  { a:['Aegean','Olive','Amphora','Delphi','Ionian','Marble','Laurel','Siren',
             'Odyssey','Cypress','Harbour','Argos','Meridian','Muse','Thalassa'],
          b:['Ode','Chorus','Elegy','Verse','Idyll','Lyric','Fragment','Prelude'] },
    4:  { a:['Legion','Aqueduct','Forum','Triumph','Aurelian','Colossus','Via Appia',
             'Standard','Senate','Vesuvius','Centurion','Rubicon','Imperium','Bronze','Arch'],
          b:['Fanfare','March','Advance','Salute','Anthem','Call','Cadence','Overture'] },
    5:  { a:['Obsidian','Quetzal','Turquoise','Sunstone','Cenote','Feathered','Jaguar',
             'Tenochtitlan','Cacao','Volcano','Eagle','Tribute','Codex','Ash','Serpent'],
          b:['Rite','Dance','Offering','Drums','Ascent','Ceremony','Reckoning','Pulse'] },
    6:  { a:['Jade','Cenote','Glyph','Stelae','Copan','Rainforest','Ballcourt','Kukulkan',
             'Limestone','Solstice','Macaw','Calendar','Mist','Temple','Green Water'],
          b:['Bells','Chant','Passage','Eclipse','Vigil','Mosaic','Cycle','Chime'] },
    7:  { a:['Greenwood','Tithe','Abbey','Oakshade','Michaelmas','Wayfarer','Moss',
             'Beltane','Longbow','Cloister','Ale House','Bramble','Fenland','Yule','Hollow'],
          b:['Ballad','Round','Carol','Air','Measure','Galliard','Ayre','Refrain'] },
    8:  { a:['Grenadier','Austerlitz','Column','Bicorne','Powder','Cuirass','Old Guard',
             'Cannonade','Eagle','Frost March','Bivouac','Sabre','Redoubt','Drumline','Retreat'],
          b:['March','Quickstep','Fanfare','Tattoo','Advance','Parade','Salute','Charge'] },
    9:  { a:['Concrete','Signal','Overpass','Neon Rain','Terminal','Rooftop','Static',
             'Nightbus','Glasshouse','Crosswalk','Undercurrent','Circuit','Late Shift','Grid','Drift'],
          b:['Study','Sketch','Motion','Loop','Nocturne','Interval','Frame','Pulse'] },
    10: { a:['Chrome','Vector','Hyperlane','Starfall','Cassette','Magenta','Orbital',
             'Lightspeed','Synthwave','Horizon','Prism','Overdrive','Zero Hour','Arcade','Void'],
          b:['Drive','Runner','Protocol','Sequence','Cascade','Signal','Ascent','Rush'] },
  };

  function songTitle(areaId, seed) {
    const w = TITLE_WORDS[areaId] || TITLE_WORDS[1];
    const rnd = mulberry32((seed | 0) ^ 0x717E);
    return w.a[Math.floor(rnd() * w.a.length)] + ' ' + w.b[Math.floor(rnd() * w.b.length)];
  }

  // ══════════════════════════════════════
  //  SONG LENGTH
  //  A chart is a song, so it should last like one: 1m30 early,
  //  up to 3m by the end of the campaign.
  //  bars = seconds x bpm / 60 / 4
  // ══════════════════════════════════════
  const SONG_MIN_SEC = 90;
  const SONG_MAX_SEC = 180;

  function barsForSeconds(seconds, bpm, meter) {
    // A bar is `meter` beats, so a 3/4 song needs more bars than a 4/4
    // one to last the same time. Dividing by a fixed 4 made every
    // waltz and march a quarter to a half shorter than its target.
    return Math.max(8, Math.round((seconds * bpm) / 60 / (meter || 4)));
  }

  function songSeconds(progress01) {
    return Math.round(SONG_MIN_SEC + (SONG_MAX_SEC - SONG_MIN_SEC) * progress01);
  }

  function levelSeconds(lvl) {
    if (!lvl || !lvl.grid || !lvl.bpm) return 0;
    return Math.round((lvl.grid.length * 60) / lvl.bpm);
  }

  // Campaign identity in one place, so the level, its share code
  // and its list row can't disagree about which song they mean.
  function campaignStyle(areaId, levelIdx, isDouble) {
    // Rotate the mix style so consecutive levels in an area feel
    // different even at the same difficulty.
    return isDouble
      ? 'Z'                                        // the Double style
      : MIX_KEYS[(areaId * 5 + levelIdx * 3) % MIX_KEYS.length];
  }

  function campaignFields(areaId, levelIdx, isDouble, area) {
    return {
      id:        'cam-' + areaId + '-' + levelIdx + (isDouble ? '-d' : ''),
      campaign:  true,
      procedural:false,
      double:    !!isDouble,
      areaId:    areaId,
      areaName:  area.name,
      levelIdx:  levelIdx,
      trackNo:   levelIdx + 1,
    };
  }

  // Title, tempo and length without generating a note. The campaign
  // browser draws 150 rows, and building every chart to read a name
  // off it cost a quarter of a second of main thread per render.
  function campaignLevelMeta(areaId, levelIdx, opts) {
    opts = opts || {};
    const area = areaById(areaId);
    if (!area) return null;
    const meta = codePlan(codeForCampaign(areaId, levelIdx, opts.double));
    return Object.assign(meta, campaignFields(areaId, levelIdx, opts.double, area));
  }

  // opts.double builds the harder cut of the same song: same
  // title and tempo, denser chart, difficulty pushed up. It is a
  // separate clear from the standard version, not a replacement.
  function buildCampaignLevel(areaId, levelIdx, opts) {
    opts = opts || {};
    const area = areaById(areaId);
    if (!area) return null;

    // Build it THROUGH its own share code. Anything else lets the
    // campaign chart and the shared chart drift apart, which is
    // exactly the bug this replaces.
    const lvl = buildCodeLevel(codeForCampaign(areaId, levelIdx, opts.double));
    return Object.assign(lvl, campaignFields(areaId, levelIdx, opts.double, area));
  }


  // ══════════════════════════════════════
  //  XP
  //  Scales with the work the chart actually asked for: how many
  //  notes, how fast they came, and how hard the chart was.
  // ══════════════════════════════════════
  function countNotes(lvl) {
    if (lvl.grid) {
      let n = 0;
      lvl.grid.forEach(r => r.forEach(c => { if (c) n++; }));
      return n;
    }
    return lvl.notes ? lvl.notes.length : 0;
  }

  // The share code for a campaign level, so any song in the
  // campaign can be handed to someone who hasn't unlocked it.
  function codeForCampaign(areaId, levelIdx, isDouble) {
    return encodeLevelCode(
      difficultyFor(areaId, levelIdx), areaId,
      areaId * 1000 + levelIdx,
      campaignStyle(areaId, levelIdx, isDouble));
  }

  // Share of the grid that can be filled before XP stops paying per
  // note, and what the notes past that point are worth.
  const DENSITY_CAP  = 0.85;
  const SURPLUS_RATE = 0.15;

  // How full a chart's grid is, 0..1. Note-list levels have no grid to
  // measure, so they are never treated as over-dense.
  function fillOf(lvl) {
    const rows = (lvl && lvl.grid) ? lvl.grid.length : 0;
    if (!rows) return 0;
    const lanes = lvl.grid[0].length || 4;
    return countNotes(lvl) / (rows * lanes);
  }

  // The note count XP is actually paid on, after the density penalty.
  function payableNotes(lvl, notes) {
    if (notes === undefined) notes = countNotes(lvl);
    const rows = (lvl && lvl.grid) ? lvl.grid.length : 0;
    if (!rows) return notes;
    const cap = rows * (lvl.grid[0].length || 4) * DENSITY_CAP;
    return notes > cap ? cap + (notes - cap) * SURPLUS_RATE : notes;
  }

  // ── Coins ────────────────────────────────
  // Every level pays the same. Coins used to be score/1000, and score
  // compounds with the combo multiplier, so across the 150 campaign
  // charts a clear paid anywhere from 116 to 181,002 — a 1560x spread
  // in which the reward for finishing a level had almost nothing to
  // do with finishing it and almost everything to do with how long it
  // was. Flat, coins become a count of levels cleared.
  const COINS_PER_CLEAR = 150;
  // The one exception is a chart too short to be a song. Without a
  // floor, a four-note custom level would be the fastest coin source
  // in the game by an order of magnitude. This is a stub guard, not a
  // difficulty curve: the shortest campaign chart has 51 notes, so
  // every real level — authored or generated — pays the full rate.
  const COINS_MIN_NOTES = 40;

  function coinsFor(lvl, opts) {
    opts = opts || {};
    const notes = countNotes(lvl);
    let c = COINS_PER_CLEAR * Math.min(1, notes / COINS_MIN_NOTES);
    // The Double is the same chart at twice the speed, so it pays
    // twice — the same reasoning as the XP formula.
    c *= opts.speedMult || 1;
    // A failed run pays for the share of the chart it got through,
    // or quitting on the first note would pay the same as clearing.
    if (!opts.completed) {
      const p = opts.progress === undefined ? 1 : opts.progress;
      c *= Math.max(0, Math.min(1, p));
    }
    return Math.max(0, Math.round(c));
  }

  function xpFor(lvl, opts) {
    opts = opts || {};
    const notes = countNotes(lvl);
    // XP scales with how fast the notes actually came at you, so a run
    // played at double speed is worth double — that falls straight out
    // of the formula rather than being a bonus bolted onto it. The
    // Double passes speedMult 2.
    const speed = ((lvl.bpm || 120) * (opts.speedMult || 1)) / 120;
    const diff  = lvl.campaign
      ? 1 + ((lvl.areaId || 1) - 1) * 0.15
      : 1 + ((lvl.difficulty || 1) - 1) * 0.2;

    // A wall of notes is not a harder chart, it is a longer one with
    // the key held down — filling every box was the cheapest XP per
    // second in the game. Past DENSITY_CAP of the grid the surplus
    // notes pay a fraction, so a musical chart always beats a solid
    // block of the same length.
    const paid = payableNotes(lvl, notes);

    // Rounded once, at the end. Rounding at every step let the errors
    // compound, so a run worth exactly twice another could come out
    // two XP off and stop looking like a doubling.
    let xp = paid * speed * diff;

    // Custom levels earn half: a self-authored 500-note chart
    // shouldn't be an XP faucet. Procedural levels are generated
    // from a seed, so they can't be gamed and pay full.
    if (!lvl.campaign && !lvl.procedural) xp *= 0.5;

    // A failed run pays for the part of the chart it actually got
    // through. Paying the full note count regardless meant quitting
    // out of an area-10 song on the first note earned 80% of
    // clearing it, which made dying the fastest way to level.
    if (opts.completed) {
      // Finishing beats dying partway.
      xp *= 1.25;
    } else {
      const p = opts.progress === undefined ? 1 : opts.progress;
      xp *= Math.max(0, Math.min(1, p));
    }
    return Math.max(1, Math.round(xp));
  }

  // Cumulative XP needed to REACH level n. Deliberately steep
  // enough that level 2 arrives in the first session.
  function xpForLevel(n) {
    if (n <= 1) return 0;
    return Math.round(100 * Math.pow(n - 1, 1.5));
  }

  // Invert the curve rather than walking it. This runs on every
  // XP strip repaint, and at level 100 the loop was doing a hundred
  // Math.pow calls to answer a question the exponent already knows.
  // The curve is rounded, so step off the estimate to land exactly.
  function levelFromXp(totalXp) {
    if (!(totalXp > 0)) return 1;
    let n = Math.floor(Math.pow(totalXp / 100, 2 / 3)) + 1;
    n = Math.max(1, Math.min(999, n));
    while (n > 1 && xpForLevel(n) > totalXp) n--;
    while (n < 999 && xpForLevel(n + 1) <= totalXp) n++;
    return n;
  }

  function levelProgress(totalXp) {
    const lv   = levelFromXp(totalXp);
    const cur  = xpForLevel(lv);
    const next = xpForLevel(lv + 1);
    return {
      level: lv,
      into:  totalXp - cur,
      need:  next - cur,
      pct:   Math.max(0, Math.min(1, (totalXp - cur) / Math.max(1, next - cur))),
    };
  }

  // ══════════════════════════════════════
  //  SHARE CODES
  //
  //    7 4 A2F9C
  //    ^ ^ ^
  //    | | └── seed, base36
  //    | └──── area 1-9, A for area 10, X for endless
  //    └────── difficulty 1-9
  //
  //  Difficulty first so it is readable at a glance. The area
  //  character is what carries the era's music and theme, so
  //  two people playing the same code get the same chart AND
  //  the same instrument, scale and palette.
  //
  //  X means endless: the theme is derived from the seed, so
  //  it is random but still identical for everyone.
  // ══════════════════════════════════════
  const AREA_CHARS = '123456789A';

  //    7 4 B 1KZ8M2Q
  //    ^ ^ ^ ^
  //    | | | └── seed, base36, up to 8 chars (~2.8 trillion)
  //    | | └──── style: B D S H T F  (blend of singles/doubles/holds)
  //    | └────── area 1-9, A for area 10, X for endless
  //    └──────── difficulty 1-9
  //
  //  The style character is what stops one seed from meaning one
  //  chart: the same pattern can arrive Dense, Held or Technical.
  //
  //  The style alphabet is now FROZEN. Adding a letter to it
  //  changes how existing codes parse, because a code with that
  //  letter in slot 3 previously read it as part of the seed.
  //  Any future style needs a new code version, not a new letter.
  //  Six-character codes from Beta 2 still work and default to
  //  Balanced, so nothing anyone already shared has broken.

  function areaToChar(areaId) {
    return areaId === null || areaId === undefined ? 'X' : AREA_CHARS[areaId - 1] || '1';
  }
  function charToArea(ch) {
    if (ch === 'X') return null;
    const i = AREA_CHARS.indexOf(ch);
    return i < 0 ? 1 : i + 1;
  }

  function endlessArea(seed) {
    return 1 + (Math.abs(seed) % AREAS.length);
  }

  function encodeLevelCode(difficulty, areaId, seed, style) {
    const d = Math.max(1, Math.min(9, difficulty || 1));
    const st = MIX_STYLES[style] ? style : 'B';
    const s = Math.abs(seed | 0).toString(36).toUpperCase().slice(0, 8);
    return String(d) + areaToChar(areaId) + st + s;
  }

  function decodeLevelCode(code) {
    const t = String(code || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (t.length < 3) throw new Error('code too short');

    const difficulty = parseInt(t[0], 10);
    if (!difficulty || difficulty < 1 || difficulty > 9) throw new Error('bad difficulty');

    const areaCh = t[1];
    if (areaCh !== 'X' && AREA_CHARS.indexOf(areaCh) < 0) throw new Error('bad area');

    // Third character is a style only if it is one of the style
    // letters AND there is a seed after it. Otherwise this is a
    // Beta 2 code and the rest is all seed.
    let style = 'B', seedStr;
    if (MIX_STYLES[t[2]] && t.length > 3) { style = t[2]; seedStr = t.slice(3); }
    else                                  { seedStr = t.slice(2); }

    const seed = parseInt(seedStr, 36);
    if (!isFinite(seed) || isNaN(seed)) throw new Error('bad seed');

    const declared = charToArea(areaCh);
    return {
      difficulty, style,
      styleName: MIX_STYLES[style].name,
      endless: declared === null,
      areaId:  declared === null ? endlessArea(seed) : declared,
      seed,
      code: t,
    };
  }

  // Everything about a coded level EXCEPT the notes: tempo, length,
  // title, instrument. Generating a chart is the expensive part, and
  // a level list only needs this much. Both the list and the full
  // build read it, so a row can never disagree with the song it
  // launches.
  function codePlan(code) {
    const d    = decodeLevelCode(code);
    const area = areaById(d.areaId);
    const st   = MIX_STYLES[d.style];
    const isDouble = !!st.double;
    // The double sits two rungs above the difficulty digit, so a
    // 7 double plays like a 9.
    const diff = isDouble ? Math.min(9, d.difficulty + 2) : d.difficulty;

    const levelIdx = d.endless ? null : campaignIndexFor(d.areaId, d.seed);
    const bpm  = tempoFor(area, d.seed, d.difficulty, levelIdx);
    // Procedural songs run 1m30 to 3m by difficulty. Bars are as long
    // as the meter, so the meter has to be in the sum or a waltz comes
    // out short of its target.
    const meter = st.meter || 4;
    const bars = barsForSeconds(songSeconds((d.difficulty - 1) / 8), bpm, meter);
    const chartSeed = isDouble ? (d.seed ^ 0xD0B) : d.seed;
    // The section plan is cheap, so the exact length is known
    // without placing a single note.
    const rows = planBars(bars, chartSeed) * meter;

    return {
      id:         'code-' + d.code,
      name:       songTitle(d.areaId, d.seed) + (isDouble ? ' (Double)' : ''),
      areaName:   area.name,
      shareCode:  d.code,
      endless:    d.endless,
      areaId:     d.areaId,
      campaign:   false,
      procedural: true,
      difficulty: diff,
      double:     isDouble,
      style:      d.style,
      styleName:  st.name,
      diff:       diff <= 3 ? 'easy' : diff <= 6 ? 'medium' : 'hard',
      bpm,
      bgMode:     d.difficulty % 3 === 0 ? 'drums' : d.difficulty % 3 === 1 ? 'bass' : 'none',
      instrument: resolveInstrument(area.instrument),
      laneFreqs:  scaleFreqs(d.areaId),
      bassPattern: [],
      seed:       d.seed,
      rows,
      seconds:    Math.round((rows * 60) / bpm),
      _bars:      bars,
      _chartSeed: chartSeed,
    };
  }

  function buildCodeLevel(code) {
    const p = codePlan(code);
    p.grid = generateChart(p._chartSeed, p.difficulty, p._bars, p.areaId, p.style);
    return p;
  }

  // A fresh endless run: random difficulty band and seed.
  function rollEndlessCode(minDiff, maxDiff) {
    // 8 base36 chars of seed space, so endless doesn't start
    // repeating charts after a few hundred runs.
    const seed = Math.floor(Math.random() * 2147483647);
    const lo = minDiff || 1, hi = maxDiff || 9;
    const d  = lo + Math.floor(Math.random() * (hi - lo + 1));
    const st = MIX_KEYS[Math.floor(Math.random() * MIX_KEYS.length)];
    return encodeLevelCode(d, null, seed, st);
  }

  window.RD_Generator = {
    encodeLevelCode, decodeLevelCode, codeForCampaign, buildCodeLevel, codePlan,
    campaignLevelMeta, campaignIndexFor, tempoFor, rollEndlessCode, endlessArea,
    AREA_TEXTURE, textureFor, songTitle, planBars, SHAPES, shapeFor, SECTION_ROLES, levelSeconds, barsForSeconds, songSeconds, generateSection, sectionMapFor, voicesFor, SECTION_VOICES,
    styleWithMix, PATTERNS, FAMILIES, MUSIC, scaleFreqs, MIX_STYLES, MIX_KEYS, mixTargets,
    AREAS, LEVELS_PER_AREA, SCALES,
    areaById, buildCampaignLevel, difficultyFor,
    generateChart, mulberry32, resolveInstrument,
    xpFor, xpForLevel, levelFromXp, levelProgress, countNotes,
    fillOf, payableNotes, DENSITY_CAP,
    coinsFor, COINS_PER_CLEAR, COINS_MIN_NOTES,
  };
})();
