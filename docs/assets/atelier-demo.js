// Démo animée de l'Atelier d'exercices : un doigt pose le matériel, place les joueurs,
// ajoute des étapes (les flèches se tracent seules) puis lance le mode cinéma.
const NS = 'http://www.w3.org/2000/svg';
const PITCH_TOP = 60; // le terrain occupe y = 60 → 520 de l'écran 1024 × 768

const COLORS = {
  bleu: '#2673f2', rouge: '#e62626', jaune: '#ffd91a', orange: '#ff800d',
  vert: '#33cc4d', violet: '#994de6', rose: '#ff59b3', blanc: '#ffffff',
};
const ARROW = { course: '#ffffff', courseAdv: '#ff8c8c', passe: '#ffdb1a', conduite: '#ff8c1a', tir: '#ff3838' };

// Positions dans le repère du terrain (1024 × 460)
const PLAYERS = [
  { id: 'b1', team: 'bleu', n: 1, p: [340, 220] },
  { id: 'b2', team: 'bleu', n: 2, p: [370, 350] },
  { id: 'b3', team: 'bleu', n: 3, p: [500, 110] },
  { id: 'b4', team: 'bleu', n: 4, p: [560, 340] },
  { id: 'r1', team: 'rouge', n: 1, p: [420, 215] },
  { id: 'r2', team: 'rouge', n: 2, p: [465, 330] },
  { id: 'r3', team: 'rouge', n: 3, p: [600, 150] },
  { id: 'r4', team: 'rouge', n: 4, p: [680, 262] },
  { id: 'j1', team: 'jaune', n: 1, p: [512, 17] },
  { id: 'j2', team: 'jaune', n: 2, p: [512, 443] },
];
const STEPS = [
  { text: 'Départ · 4 contre 4 dans un carré de 30 × 25 m, deux jokers sur les côtés.' },
  {
    text: 'Étape 1 · Le porteur conduit pour fixer, le 3 prend la profondeur.',
    moves: [['b1', [430, 290]], ['r2', [472, 300]], ['b3', [632, 98]], ['r3', [652, 148]]],
  },
  {
    text: 'Étape 2 · Passe dans la course : le 3 est seul derrière la ligne.',
    ball: { to: 'b3', kind: 'passe' },
    moves: [['b4', [672, 352]]],
  },
  {
    text: 'Étape 3 · Frappe dans le mini-but avant le retour du défenseur.',
    ball: { point: [748, 230], kind: 'tir' },
  },
];
const TOOLS = ['Raccourcis', 'Joueur', 'Gardien', 'Ballon', 'Plot', 'Coupelle', 'Piquet', 'Mini-but', 'Zone'];
const toolX = (k) => 72 + k * 109;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

export function initAtelierDemo(root, { reduced = false } = {}) {
  const chrome = root.querySelector('.ad-chrome');
  const pitch = root.querySelector('.ad-pitch');
  const fingerSvg = root.querySelector('.ad-finger');
  const sub = root.querySelector('.ad-cinema-sub');
  const screen = root.querySelector('.device-screen');

  let visible = false;
  let waiters = [];
  let generation = 0;
  const gate = () => (visible ? Promise.resolve() : new Promise((r) => waiters.push(r)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (ms) => { await gate(); await sleep(ms); };
  const tween = (ms, fn, ease = easeInOut) => new Promise((res) => {
    const t0 = performance.now();
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / ms);
      fn(ease(u));
      if (u < 1) requestAnimationFrame(tick);
      else res();
    };
    requestAnimationFrame(tick);
  });

  // ------------------------------------------------ Habillage de l'écran (iPad)
  const defs = el('defs', {}, pitch);
  for (const [name, color] of Object.entries(ARROW)) {
    const m = el('marker', { id: `ad-head-${name}`, viewBox: '0 0 10 10', refX: '6', refY: '5', markerWidth: '4.2', markerHeight: '4.2', orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m);
  }
  const sh = el('filter', { id: 'ad-shadow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feDropShadow', { dx: '0', dy: '2', stdDeviation: '2', 'flood-opacity': '0.35' }, sh);

  // Barre du haut
  el('rect', { x: 0, y: 0, width: 1024, height: 60, fill: '#f7f7f9' }, chrome);
  const save = el('g', { transform: 'translate(18 12)' }, chrome);
  el('rect', { width: 156, height: 36, rx: 18, fill: '#2fb24c' }, save);
  el('circle', { cx: 20, cy: 18, r: 9, fill: '#fff' }, save);
  el('path', { d: 'M15.5 18.2 l3 3 l6-6.5', stroke: '#2fb24c', 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, save);
  el('text', { x: 38, y: 24, fill: '#fff', 'font-size': 17, 'font-weight': 700 }, save).textContent = 'Enregistrer';
  const title = el('text', { x: 512, y: 29, 'text-anchor': 'middle', fill: '#111', 'font-size': 19, 'font-weight': 800 }, chrome);
  title.textContent = 'Jeu 4 contre 4 + 2 jokers';
  el('text', { x: 512, y: 48, 'text-anchor': 'middle', fill: '#2fb24c', 'font-size': 12, 'font-weight': 600 }, chrome).textContent = '✓ Enregistré';
  const sheet = el('g', { transform: 'translate(916 12)' }, chrome);
  el('rect', { width: 90, height: 36, rx: 18, fill: '#e6e7eb' }, sheet);
  el('text', { x: 45, y: 24, 'text-anchor': 'middle', fill: '#2fb24c', 'font-size': 17, 'font-weight': 700 }, sheet).textContent = 'Fiche';

  // Bandeau d'aide
  el('rect', { x: 0, y: 520, width: 1024, height: 36, fill: '#eceef1' }, chrome);
  const film = el('g', { transform: 'translate(18 529)' }, chrome);
  el('rect', { width: 22, height: 18, rx: 3, fill: 'none', stroke: '#2fb24c', 'stroke-width': 2 }, film);
  el('path', { d: 'M5 0v18M17 0v18', stroke: '#2fb24c', 'stroke-width': 2 }, film);
  const hint = el('text', { x: 52, y: 543, fill: '#3a3d44', 'font-size': 15, 'font-weight': 500 }, chrome);

  // Barre des étapes
  el('rect', { x: 0, y: 556, width: 1024, height: 60, fill: '#f7f7f9' }, chrome);
  const play = el('g', { transform: 'translate(22 566)' }, chrome);
  el('rect', { width: 40, height: 40, rx: 12, fill: '#e3f5e7' }, play);
  el('path', { d: 'M15 11 L29 20 L15 29 z', fill: '#2fb24c' }, play);
  const chips = el('g', {}, chrome);
  const addStepBtn = el('g', {}, chrome);
  el('rect', { width: 96, height: 36, rx: 18, fill: '#fff', stroke: '#2fb24c', 'stroke-width': 2, 'stroke-dasharray': '5 4' }, addStepBtn);
  el('text', { x: 48, y: 24, 'text-anchor': 'middle', fill: '#2fb24c', 'font-size': 16, 'font-weight': 700 }, addStepBtn).textContent = '+ Étape';
  const cinemaBtn = el('g', { transform: 'translate(898 566)' }, chrome);
  const cinemaRect = el('rect', { width: 108, height: 40, rx: 12, fill: '#f1dcf7' }, cinemaBtn);
  el('rect', { x: 14, y: 12, width: 20, height: 16, rx: 3, fill: 'none', stroke: '#a62fc2', 'stroke-width': 2.2 }, cinemaBtn);
  el('text', { x: 66, y: 26, 'text-anchor': 'middle', fill: '#a62fc2', 'font-size': 15, 'font-weight': 700 }, cinemaBtn).textContent = 'Cinéma';

  // Tiroir de matériel
  el('rect', { x: 0, y: 616, width: 1024, height: 152, fill: '#ffffff' }, chrome);
  el('line', { x1: 0, y1: 616.5, x2: 1024, y2: 616.5, stroke: '#e2e4e8' }, chrome);
  const toolEls = TOOLS.map((name, k) => {
    const g = el('g', { transform: `translate(${toolX(k)} 666)` }, chrome);
    const bg = el('rect', { x: -34, y: -34, width: 68, height: 68, rx: 16, fill: '#2f9e48' }, g);
    drawToolIcon(name, g);
    el('text', { x: 0, y: 58, 'text-anchor': 'middle', fill: '#2b2e33', 'font-size': 14, 'font-weight': 600 }, g).textContent = name;
    return { g, bg };
  });
  el('rect', { x: 437, y: 752, width: 150, height: 6, rx: 3, fill: '#1b1d21', opacity: 0.85 }, chrome);

  // Palette de chasubles (s'ouvre avec l'outil Joueur)
  const palette = el('g', { opacity: 0, transform: 'translate(36 566)' }, chrome);
  el('rect', { width: 372, height: 44, rx: 22, fill: '#fff', filter: 'url(#ad-shadow-chrome)', stroke: '#e1e3e7' }, palette);
  const cdefs = el('defs', {}, chrome);
  const shc = el('filter', { id: 'ad-shadow-chrome', x: '-20%', y: '-50%', width: '140%', height: '200%' }, cdefs);
  el('feDropShadow', { dx: '0', dy: '4', stdDeviation: '6', 'flood-opacity': '0.18' }, shc);
  const swatches = {};
  Object.entries(COLORS).forEach(([name, c], k) => {
    const cx = 26 + k * 46;
    const ring = el('circle', { cx, cy: 22, r: 17, fill: 'none', stroke: '#2fb24c', 'stroke-width': 3, opacity: 0 }, palette);
    el('circle', { cx, cy: 22, r: 12.5, fill: c, stroke: name === 'blanc' ? '#c9ccd2' : 'none' }, palette);
    swatches[name] = { ring, x: 36 + cx, y: 588 };
  });

  // ------------------------------------------------ Terrain
  const stripes = el('g', {}, pitch);
  for (let k = 0; k < 16; k++) el('rect', { x: k * 64, y: 0, width: 64, height: 460, fill: k % 2 ? '#2f8f3a' : '#36a043' }, stripes);
  const lines = el('g', { stroke: 'rgba(255,255,255,0.85)', 'stroke-width': 3, fill: 'none' }, pitch);
  el('line', { x1: 512, y1: 0, x2: 512, y2: 460 }, lines);
  el('circle', { cx: 512, cy: 230, r: 139 }, lines);
  el('circle', { cx: 512, cy: 230, r: 4, fill: 'rgba(255,255,255,0.85)' }, lines);
  const zoneLayer = el('g', {}, pitch);
  const propLayer = el('g', {}, pitch);
  const arrowLayer = el('g', {}, pitch);
  const tokenLayer = el('g', {}, pitch);
  const ballLayer = el('g', {}, pitch);
  const fxLayer = el('g', {}, pitch);

  // Doigt
  const finger = el('g', { opacity: 0 }, fingerSvg);
  const fingerRing = el('circle', { r: 24, fill: 'rgba(255,255,255,0.28)', stroke: 'rgba(255,255,255,0.95)', 'stroke-width': 3 }, finger);
  el('circle', { r: 24, fill: 'none', stroke: 'rgba(0,0,0,0.25)', 'stroke-width': 1, transform: 'translate(0 1.5)' }, finger);
  const fingerPos = { x: 700, y: 400 };
  const setFinger = (x, y) => { fingerPos.x = x; fingerPos.y = y; finger.setAttribute('transform', `translate(${x} ${y})`); };
  setFinger(700, 400);

  // ------------------------------------------------ État
  let zone = null;
  const tokens = {};
  let ball = null;
  let ballHolder = null;
  let stepChips = [];

  const ballOffset = [13, 11];
  const pos = (id) => tokens[id].p;
  const screenOf = (p) => [p[0], p[1] + PITCH_TOP];

  function setToken(id, p, s = 1) {
    const t = tokens[id];
    t.p = p;
    t.g.setAttribute('transform', `translate(${p[0]} ${p[1]}) scale(${s})`);
    if (ballHolder === id) placeBall([p[0] + ballOffset[0], p[1] + ballOffset[1]]);
  }
  function placeBall(p, s = 1) {
    ball.p = p;
    ball.g.setAttribute('transform', `translate(${p[0]} ${p[1]}) scale(${s})`);
  }

  function makeToken(pl) {
    const g = el('g', { filter: 'url(#ad-shadow)' }, tokenLayer);
    el('circle', { r: 17, fill: COLORS[pl.team], stroke: '#fff', 'stroke-width': 3 }, g);
    const t = el('text', { y: 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, fill: pl.team === 'jaune' ? '#14181f' : '#fff' }, g);
    t.textContent = pl.n;
    tokens[pl.id] = { g, p: pl.p, team: pl.team };
    setToken(pl.id, pl.p, 0);
    return g;
  }

  function makeBall(p) {
    const g = el('g', { filter: 'url(#ad-shadow)' }, ballLayer);
    el('circle', { r: 8.5, fill: '#fff', stroke: '#111', 'stroke-width': 1.5 }, g);
    el('path', { d: 'M0,-3.6 L3.4,-1.1 L2.1,2.9 L-2.1,2.9 L-3.4,-1.1 z', fill: '#111' }, g);
    ball = { g, p };
    placeBall(p, 0);
  }

  function ripple(x, y, color = 'rgba(255,255,255,0.9)') {
    const c = el('circle', { cx: x, cy: y, r: 6, fill: 'none', stroke: color, 'stroke-width': 3 }, fingerSvg);
    tween(450, (u) => { c.setAttribute('r', 6 + u * 26); c.setAttribute('opacity', 1 - u); }).then(() => c.remove());
  }

  async function moveFinger(x, y, ms = 420) {
    const x0 = fingerPos.x;
    const y0 = fingerPos.y;
    await gate();
    await tween(ms, (u) => setFinger(x0 + (x - x0) * u, y0 + (y - y0) * u));
  }
  async function press(down) {
    const r0 = down ? 24 : 18;
    const r1 = down ? 18 : 24;
    await tween(110, (u) => fingerRing.setAttribute('r', r0 + (r1 - r0) * u));
    fingerRing.setAttribute('fill', down ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.28)');
  }
  async function tapAt(x, y, ms) {
    await moveFinger(x, y, ms);
    await press(true);
    ripple(x, y);
    await press(false);
  }

  function selectTool(k) {
    toolEls.forEach((t, i) => {
      t.bg.setAttribute('fill', i === k ? '#1f7a35' : '#2f9e48');
      t.bg.setAttribute('stroke', i === k ? '#ffd91a' : 'none');
      t.bg.setAttribute('stroke-width', i === k ? 4 : 0);
    });
  }
  async function useTool(name) {
    const k = TOOLS.indexOf(name);
    await tapAt(toolX(k), 666);
    selectTool(k);
    await wait(120);
  }
  async function popIn(apply, ms = 380) { await tween(ms, (u) => apply(Math.max(0, easeOutBack(u))), (t) => t); }

  // Puces d'étapes
  function layoutChips() {
    let x = 76;
    stepChips.forEach((c) => {
      c.g.setAttribute('transform', `translate(${x} 568)`);
      c.x = x;
      x += c.w + 10;
    });
    addStepBtn.setAttribute('transform', `translate(${x} 568)`);
    addStepBtn.dataset.x = x;
  }
  function addChip(label) {
    const g = el('g', {}, chips);
    const w = label.length > 2 ? 84 : 44;
    const bg = el('rect', { width: w, height: 36, rx: 18, fill: '#e6e7eb' }, g);
    const t = el('text', { x: w / 2, y: 24, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: '#2b2e33' }, g);
    t.textContent = label;
    stepChips.push({ g, bg, t, w });
    layoutChips();
    activeChip(stepChips.length - 1);
  }
  function activeChip(k) {
    stepChips.forEach((c, i) => {
      c.bg.setAttribute('fill', i === k ? '#2fb24c' : '#e6e7eb');
      c.t.setAttribute('fill', i === k ? '#fff' : '#2b2e33');
    });
  }

  // Flèches
  function wavePath(a, b) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const n = [-d[1], d[0]];
    const wl = 26;
    const amp = 6;
    let path = `M${a[0]},${a[1]}`;
    for (let s = 2; s <= len; s += 2) {
      const env = Math.min(1, s / wl, (len - s) / wl);
      const o = Math.sin((s / wl) * Math.PI * 2) * amp * Math.max(0, env);
      path += ` L${(a[0] + d[0] * s + n[0] * o).toFixed(1)},${(a[1] + d[1] * s + n[1] * o).toFixed(1)}`;
    }
    return path;
  }
  function trim(a, b, s0, s1) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    return [[a[0] + d[0] * s0, a[1] + d[1] * s0], [b[0] - d[0] * s1, b[1] - d[1] * s1]];
  }
  let maskId = 0;
  function makeArrow(kind, a, b, team) {
    const runner = kind === 'course' || kind === 'conduite';
    const [p0, p1] = trim(a, b, runner ? 22 : 12, kind === 'tir' ? 4 : runner ? 24 : 16);
    const colorKey = kind === 'course' && team === 'rouge' ? 'courseAdv' : kind;
    const color = ARROW[colorKey];
    const d = kind === 'conduite' ? wavePath(p0, p1) : `M${p0[0]},${p0[1]} L${p1[0]},${p1[1]}`;
    const g = el('g', {}, arrowLayer);
    const path = el('path', { d, fill: 'none', stroke: color, 'stroke-width': kind === 'tir' ? 5 : 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const len = path.getTotalLength();
    let reveal;
    if (kind === 'course') {
      path.setAttribute('stroke-dasharray', '10 8');
      const id = `ad-mask-${++maskId}`;
      const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1024, height: 460 }, defs);
      reveal = el('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 12, 'stroke-dasharray': len, 'stroke-dashoffset': len }, mask);
      path.setAttribute('mask', `url(#${id})`);
      g.mask = mask;
    } else {
      path.setAttribute('stroke-dasharray', len);
      path.setAttribute('stroke-dashoffset', len);
      reveal = path;
    }
    return {
      g,
      set(u) {
        reveal.setAttribute('stroke-dashoffset', len * (1 - u));
        if (u >= 0.98) path.setAttribute('marker-end', `url(#ad-head-${colorKey})`);
        else path.removeAttribute('marker-end');
      },
      remove() { g.remove(); g.mask?.remove(); },
    };
  }

  function clearArrows() {
    [...arrowLayer.children].forEach((c) => c.remove());
    [...defs.querySelectorAll('mask')].forEach((m) => m.remove());
  }

  // Le doigt fait glisser un joueur (ou le ballon) : la flèche se trace pendant le geste
  async function dragToken(id, to, ms = 760) {
    const from = [...pos(id)];
    const kind = ballHolder === id ? 'conduite' : 'course';
    await moveFinger(...screenOf(from), 380);
    await press(true);
    const arrow = makeArrow(kind, from, to, tokens[id].team);
    await tween(ms, (u) => {
      const p = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
      setToken(id, p);
      setFinger(...screenOf(p));
      arrow.set(u);
    });
    await press(false);
  }
  async function dragBall(target, kind, ms = 640) {
    const from = [...ball.p];
    const to = typeof target === 'string' ? [pos(target)[0] + ballOffset[0], pos(target)[1] + ballOffset[1]] : target;
    await moveFinger(...screenOf(from), 380);
    await press(true);
    ballHolder = null;
    const arrow = makeArrow(kind, from, to);
    await tween(ms, (u) => {
      const p = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
      placeBall(p);
      setFinger(...screenOf(p));
      arrow.set(u);
    });
    if (typeof target === 'string') ballHolder = target;
    await press(false);
  }

  function goalFlash(x, y) {
    const g = el('g', { transform: `translate(${x} ${y})` }, fxLayer);
    const c = el('circle', { r: 10, fill: 'none', stroke: '#ffd91a', 'stroke-width': 5 }, g);
    const t = el('text', { y: -40, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 900, fill: '#fff', stroke: '#e62626', 'stroke-width': 1.5 }, g);
    t.textContent = 'BUT !';
    tween(900, (u) => {
      c.setAttribute('r', 10 + u * 60);
      c.setAttribute('opacity', 1 - u);
      t.setAttribute('opacity', u < 0.7 ? 1 : (1 - u) / 0.3);
      t.setAttribute('transform', `translate(0 ${-u * 14}) scale(${0.8 + u * 0.4})`);
    }).then(() => g.remove());
  }

  function drawZone() {
    zone = el('g', {}, zoneLayer);
    const r = el('rect', { x: 284, y: 40, width: 0, height: 0, fill: 'rgba(255,255,255,0.14)', stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '12 8' }, zone);
    const label = el('text', { x: 296, y: 62, fill: '#fff', 'font-size': 15, 'font-weight': 700, opacity: 0 }, zone);
    label.textContent = '30 × 25 m';
    zone.r = r;
    zone.label = label;
    return zone;
  }
  function makePlot(p) {
    const g = el('g', { transform: `translate(${p[0]} ${p[1]}) scale(0)` }, propLayer);
    el('path', { d: 'M0,-12 L11,8 L-11,8 z', fill: '#ff800d', stroke: '#fff', 'stroke-width': 2 }, g);
    return g;
  }
  function makeMiniGoal(x, y, side) {
    const g = el('g', { transform: `translate(${x} ${y}) scale(0)` }, propLayer);
    el('rect', { x: side < 0 ? -12 : 0, y: -26, width: 12, height: 52, fill: 'rgba(255,255,255,0.25)', stroke: '#fff', 'stroke-width': 3 }, g);
    for (let k = -18; k <= 18; k += 9) el('line', { x1: side < 0 ? -12 : 0, y1: k, x2: side < 0 ? 0 : 12, y2: k, stroke: 'rgba(255,255,255,0.6)', 'stroke-width': 1.2 }, g);
    return g;
  }

  // ------------------------------------------------ Réinitialisation
  function reset() {
    [zoneLayer, propLayer, arrowLayer, tokenLayer, ballLayer, fxLayer].forEach((l) => { while (l.firstChild) l.firstChild.remove(); });
    [...defs.querySelectorAll('mask')].forEach((m) => m.remove());
    [...chips.children].forEach((c) => c.remove());
    stepChips = [];
    Object.keys(tokens).forEach((k) => delete tokens[k]);
    ball = null;
    ballHolder = null;
    selectTool(-1);
    addChip('Départ');
    screen.classList.remove('is-cinema');
    sub.textContent = '';
    sub.classList.remove('is-on');
    hint.textContent = 'Touchez un outil, puis le terrain : l’outil reste actif.';
  }

  // ------------------------------------------------ Mode cinéma (rejoue les étapes)
  function stepState(k) {
    const state = Object.fromEntries(PLAYERS.map((p) => [p.id, p.p]));
    let holder = 'b1';
    let point = null;
    for (let i = 1; i <= k; i++) {
      for (const [id, p] of STEPS[i].moves || []) state[id] = p;
      const b = STEPS[i].ball;
      if (b?.to) { holder = b.to; point = null; }
      if (b?.point) { holder = null; point = b.point; }
    }
    return { state, holder, point };
  }
  function ballPointOf(s) {
    return s.holder ? [s.state[s.holder][0] + ballOffset[0], s.state[s.holder][1] + ballOffset[1]] : s.point;
  }
  async function playStep(k) {
    const a = stepState(k - 1);
    const b = stepState(k);
    clearArrows();
    const arrows = [];
    for (const [id] of STEPS[k].moves || []) {
      const dribble = a.holder === id && b.holder === id;
      arrows.push(makeArrow(dribble ? 'conduite' : 'course', a.state[id], b.state[id], tokens[id].team));
    }
    if (STEPS[k].ball) arrows.push(makeArrow(STEPS[k].ball.kind, ballPointOf(a), ballPointOf(b)));
    sub.textContent = STEPS[k].text;
    activeChip(k);
    await gate();
    await tween(520, (u) => arrows.forEach((ar) => ar.set(u)));
    const b0 = ballPointOf(a);
    ballHolder = null;
    await tween(1150, (u) => {
      for (const p of PLAYERS) {
        const p0 = a.state[p.id];
        const p1 = b.state[p.id];
        setToken(p.id, [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u]);
      }
      const bu = Math.min(1, u * 1.15);
      const target = b.holder ? [tokens[b.holder].p[0] + ballOffset[0], tokens[b.holder].p[1] + ballOffset[1]] : b.point;
      placeBall([b0[0] + (target[0] - b0[0]) * bu, b0[1] + (target[1] - b0[1]) * bu]);
    });
    ballHolder = b.holder;
    if (STEPS[k].ball?.kind === 'tir') goalFlash(748, 230);
    await wait(1300);
  }

  // ------------------------------------------------ Scénario
  async function scenario(gen) {
    reset();
    await wait(500);
    finger.setAttribute('opacity', 1);

    // Zone
    await useTool('Zone');
    await moveFinger(284, 40 + PITCH_TOP, 420);
    await press(true);
    const z = drawZone();
    await tween(700, (u) => {
      z.r.setAttribute('width', 456 * u);
      z.r.setAttribute('height', 380 * u);
      setFinger(284 + 456 * u, 40 + PITCH_TOP + 380 * u);
    });
    await press(false);
    z.label.setAttribute('opacity', 1);
    if (gen !== generation) return;

    // Plots
    await useTool('Plot');
    for (const p of [[284, 40], [740, 40], [740, 420], [284, 420]]) {
      await tapAt(...screenOf(p), 300);
      const plot = makePlot(p);
      popIn((s) => plot.setAttribute('transform', `translate(${p[0]} ${p[1]}) scale(${s})`));
    }
    // Mini-buts
    await useTool('Mini-but');
    for (const [x, side] of [[284, -1], [740, 1]]) {
      await tapAt(...screenOf([x, 230]), 360);
      const g = makeMiniGoal(x, 230, side);
      popIn((s) => g.setAttribute('transform', `translate(${x} 230) scale(${s})`));
    }
    if (gen !== generation) return;

    // Joueurs
    hint.textContent = 'Choisissez la couleur des chasubles, puis touchez le terrain.';
    await useTool('Joueur');
    tween(220, (u) => palette.setAttribute('opacity', u));
    for (const team of ['bleu', 'rouge', 'jaune']) {
      await tapAt(swatches[team].x, swatches[team].y, 320);
      Object.entries(swatches).forEach(([n, s]) => s.ring.setAttribute('opacity', n === team ? 1 : 0));
      for (const pl of PLAYERS.filter((p) => p.team === team)) {
        await tapAt(...screenOf(pl.p), 260);
        makeToken(pl);
        popIn((s) => setToken(pl.id, pl.p, s), 320);
      }
    }
    tween(220, (u) => palette.setAttribute('opacity', 1 - u));
    if (gen !== generation) return;

    // Ballon
    await useTool('Ballon');
    const bp = [PLAYERS[0].p[0] + ballOffset[0], PLAYERS[0].p[1] + ballOffset[1]];
    await tapAt(...screenOf(bp), 360);
    makeBall(bp);
    await popIn((s) => placeBall(bp, s));
    ballHolder = 'b1';
    selectTool(-1);
    await wait(300);

    // Étapes
    hint.textContent = 'Glissez un ballon sur un joueur pour une passe. Les flèches se tracent seules.';
    for (let k = 1; k < STEPS.length; k++) {
      if (gen !== generation) return;
      await tapAt(Number(addStepBtn.dataset.x) + 48, 586, 420);
      addChip(String(k));
      await wait(200);
      const st = STEPS[k];
      if (st.ball) {
        await dragBall(st.ball.to ?? st.ball.point, st.ball.kind);
        if (st.ball.kind === 'tir') goalFlash(748, 230);
      }
      for (const [id, to] of st.moves || []) await dragToken(id, to);
      await wait(350);
    }

    // Cinéma
    hint.textContent = 'Mode cinéma : l’exercice rejoué en 3D, la consigne en sous-titre.';
    await tapAt(952, 586, 520);
    cinemaRect.setAttribute('fill', '#dca8ef');
    finger.setAttribute('opacity', 0);
    screen.classList.add('is-cinema');
    await wait(400);
    clearArrows();
    const start = stepState(0);
    await tween(700, (u) => {
      for (const p of PLAYERS) {
        const cur = tokens[p.id].p;
        setToken(p.id, [cur[0] + (start.state[p.id][0] - cur[0]) * u, cur[1] + (start.state[p.id][1] - cur[1]) * u]);
      }
      const t = [start.state.b1[0] + ballOffset[0], start.state.b1[1] + ballOffset[1]];
      placeBall([ball.p[0] + (t[0] - ball.p[0]) * u, ball.p[1] + (t[1] - ball.p[1]) * u]);
    });
    ballHolder = 'b1';
    sub.classList.add('is-on');
    sub.textContent = STEPS[0].text;
    activeChip(0);
    await wait(1600);
    for (let k = 1; k < STEPS.length; k++) {
      if (gen !== generation) return;
      await playStep(k);
    }
    await wait(600);
    sub.classList.remove('is-on');
    screen.classList.remove('is-cinema');
    cinemaRect.setAttribute('fill', '#f1dcf7');
    await wait(1400);
  }

  // Image fixe (mouvement réduit) : exercice terminé, étape 3 affichée
  function staticFrame() {
    reset();
    const z = drawZone();
    z.r.setAttribute('width', 456);
    z.r.setAttribute('height', 380);
    z.label.setAttribute('opacity', 1);
    for (const p of [[284, 40], [740, 40], [740, 420], [284, 420]]) makePlot(p).setAttribute('transform', `translate(${p[0]} ${p[1]})`);
    makeMiniGoal(284, 230, -1).setAttribute('transform', 'translate(284 230)');
    makeMiniGoal(740, 230, 1).setAttribute('transform', 'translate(740 230)');
    const s = stepState(2);
    PLAYERS.forEach((p) => { makeToken(p); setToken(p.id, s.state[p.id], 1); });
    makeBall(ballPointOf(s));
    placeBall(ballPointOf(s), 1);
    ['1', '2'].forEach(addChip);
    const a = stepState(1);
    makeArrow('passe', ballPointOf(a), ballPointOf(s)).set(1);
    makeArrow('course', a.state.b4, s.state.b4, 'bleu').set(1);
    hint.textContent = 'Glissez un ballon sur un joueur pour une passe. Les flèches se tracent seules.';
  }

  if (reduced) {
    staticFrame();
    return;
  }

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) { waiters.forEach((r) => r()); waiters = []; }
  }, { threshold: 0.25 });
  io.observe(root);

  (async () => {
    for (;;) {
      generation += 1;
      try { await scenario(generation); } catch (e) { console.error(e); await sleep(2000); }
    }
  })();
}

function drawToolIcon(name, g) {
  const white = '#fff';
  switch (name) {
    case 'Raccourcis':
      el('path', { d: 'M0,-17 L4.5,-4.5 L17,0 L4.5,4.5 L0,17 L-4.5,4.5 L-17,0 L-4.5,-4.5 z', fill: '#ffd91a' }, g);
      el('path', { d: 'M12,-16 L13.5,-12.5 L17,-11 L13.5,-9.5 L12,-6 L10.5,-9.5 L7,-11 L10.5,-12.5 z', fill: '#fff6b0' }, g);
      break;
    case 'Joueur':
      el('circle', { r: 15, fill: '#e62626', stroke: white, 'stroke-width': 3 }, g);
      break;
    case 'Gardien':
      el('circle', { r: 15, fill: '#b8f226', stroke: white, 'stroke-width': 3 }, g);
      el('text', { y: 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: '#0b0f0c' }, g).textContent = 'G';
      break;
    case 'Ballon':
      el('circle', { r: 14, fill: white, stroke: '#111', 'stroke-width': 2 }, g);
      el('path', { d: 'M0,-6 L5.7,-1.9 L3.5,4.9 L-3.5,4.9 L-5.7,-1.9 z', fill: '#111' }, g);
      break;
    case 'Plot':
      el('path', { d: 'M0,-15 L14,11 L-14,11 z', fill: '#ff800d', stroke: white, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
      break;
    case 'Coupelle':
      el('ellipse', { rx: 15, ry: 9, fill: '#ff800d', stroke: white, 'stroke-width': 2.5 }, g);
      el('ellipse', { rx: 5, ry: 3, fill: '#2f9e48' }, g);
      break;
    case 'Piquet':
      el('rect', { x: -3.5, y: -17, width: 7, height: 34, rx: 3, fill: '#ffd91a', stroke: white, 'stroke-width': 2 }, g);
      break;
    case 'Mini-but':
      el('path', { d: 'M-15,10 L-15,-8 L15,-8 L15,10', fill: 'none', stroke: white, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, g);
      el('path', { d: 'M-9,-8 v16 M-3,-8 v16 M3,-8 v16 M9,-8 v16', stroke: 'rgba(255,255,255,0.6)', 'stroke-width': 1.4 }, g);
      break;
    case 'Zone':
      el('rect', { x: -15, y: -13, width: 30, height: 26, rx: 2, fill: 'rgba(255,255,255,0.2)', stroke: white, 'stroke-width': 2.5, 'stroke-dasharray': '5 3' }, g);
      break;
    default:
      break;
  }
}
