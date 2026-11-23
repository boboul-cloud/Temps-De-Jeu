// Terrain 3D du site Temps De Jeu.
// Rejoue les exercices de la bibliothèque de l'app (Resources/TactiquesEntrainement.json,
// copié dans docs/assets/exercices.json) avec les mêmes règles que l'app :
// positions héritées d'une étape à l'autre, ballon collé au pied du porteur,
// flèches calculées (course, conduite, passe, tir) comme dans TacticModels.swift.
import * as THREE from './vendor/three.module.min.js';

// Repère de l'app : x = largeur (0 → 1), y = longueur (0 = but attaqué par « mon équipe »)
export const W = 68, L = 105, M = 5;

const CAMP = {
  equipe: { fill: '#2673f2', text: '#ffffff' },
  adversaire: { fill: '#e62626', text: '#ffffff' },
  joker: { fill: '#ffd91a', text: '#14181f' },
};
const GARDIEN = { fill: '#b8f226', text: '#0b0f0c' };
const PROP_COLORS = {
  jaune: '#ffd91a', orange: '#ff800d', rouge: '#e62626', bleu: '#2673f2',
  blanc: '#ffffff', vert: '#33cc4d', violet: '#994de6', rose: '#ff59b3',
};
const ARROW_COLORS = {
  passe: '#ffdb1a', conduite: '#ff8c1a', tir: '#ff3838',
  course: { equipe: '#ffffff', adversaire: '#ff8c8c', joker: '#8cd9ff' },
};

const BALL_R = 0.44;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ground = (p) => new THREE.Vector2(p[0] * W - W / 2, p[1] * L - L / 2);

function ballOffset(camp) {
  if (camp === 'adversaire') return [-0.016, 0.006];
  if (camp === 'joker') return [0.016, 0];
  return [0.016, -0.006];
}

export function isAerial(step) {
  if (!step) return false;
  return step.aerien ?? step.action === 'centre';
}

/** État complet de chaque étape (positions héritées, ballon recollé au porteur). */
export function resolveFrames(ex) {
  const camp = Object.fromEntries(ex.acteurs.map((a) => [a.id, a.camp]));
  let positions = {};
  let holder = null;
  let point = [0.5, 0.5];
  return ex.etapes.map((step) => {
    positions = { ...positions, ...(step.positions || {}) };
    if (step.porteur && positions[step.porteur]) {
      holder = step.porteur;
    } else if (step.ballon) {
      holder = null;
      const b = [...step.ballon];
      // Un tir cadré finit au fond des filets
      if (step.action === 'tir' && Math.abs(b[0] - 0.5) < 0.05) {
        if (b[1] <= 0.012) b[1] = -0.011;
        else if (b[1] >= 0.988) b[1] = 1.011;
      }
      point = b;
    }
    if (holder && positions[holder]) {
      const o = ballOffset(camp[holder]);
      point = [positions[holder][0] + o[0], positions[holder][1] + o[1]];
    }
    return { positions, holder, ball: point };
  });
}

/** Flèches décrivant le mouvement qui mène à l'étape i. */
export function arrowsFor(ex, frames, i) {
  if (i <= 0 || !frames[i]) return [];
  const before = frames[i - 1];
  const after = frames[i];
  const out = [];
  const threshold = 0.012; // ≈ 1 m
  for (const actor of ex.acteurs) {
    const p0 = before.positions[actor.id];
    const p1 = after.positions[actor.id];
    if (!p0 || !p1 || dist(p0, p1) <= threshold) continue;
    const dribbling = before.holder === actor.id && after.holder === actor.id;
    out.push({ kind: dribbling ? 'conduite' : 'course', from: p0, to: p1, team: actor.camp });
  }
  const carried = before.holder && before.holder === after.holder;
  if (!carried && dist(before.ball, after.ball) > threshold) {
    const action = ex.etapes[i].action;
    const kind = action === 'tir' ? 'tir' : action === 'conduite' ? 'conduite' : 'passe';
    out.push({ kind, from: before.ball, to: after.ball, aerial: isAerial(ex.etapes[i]) });
  }
  return out;
}

// ---------------------------------------------------------------- Textures

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function pitchTexture(pxPerM, anisotropy) {
  const [c, g] = canvas(Math.round((W + 2 * M) * pxPerM), Math.round((L + 2 * M) * pxPerM));
  const P = (m) => (m + M) * pxPerM;
  // Bandes de tonte (mêmes verts que l'app)
  const bands = 18;
  const bandH = (L + 2 * M) / bands;
  for (let k = 0; k < bands; k++) {
    g.fillStyle = k % 2 ? '#2f8434' : '#39933e';
    g.fillRect(0, k * bandH * pxPerM, c.width, bandH * pxPerM + 1);
  }
  // Grain de pelouse
  for (let k = 0; k < 9000; k++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.035)';
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2 + Math.random() * 3);
  }
  // Lignes
  g.strokeStyle = 'rgba(255,255,255,0.93)';
  g.fillStyle = 'rgba(255,255,255,0.93)';
  g.lineWidth = Math.max(2, 0.13 * pxPerM);
  const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(P(x1), P(y1)); g.lineTo(P(x2), P(y2)); g.stroke(); };
  const rect = (x, y, w, h) => g.strokeRect(P(x), P(y), w * pxPerM, h * pxPerM);
  const arc = (x, y, r, a0, a1) => { g.beginPath(); g.arc(P(x), P(y), r * pxPerM, a0, a1); g.stroke(); };
  const spot = (x, y) => { g.beginPath(); g.arc(P(x), P(y), 0.25 * pxPerM, 0, Math.PI * 2); g.fill(); };
  rect(0, 0, W, L);
  line(0, L / 2, W, L / 2);
  arc(W / 2, L / 2, 9.15, 0, Math.PI * 2);
  spot(W / 2, L / 2);
  const a = Math.acos(5.5 / 9.15);
  // But du haut (y = 0) et du bas (y = L)
  rect(W / 2 - 20.16, 0, 40.32, 16.5);
  rect(W / 2 - 9.16, 0, 18.32, 5.5);
  spot(W / 2, 11);
  arc(W / 2, 11, 9.15, Math.PI / 2 - a, Math.PI / 2 + a);
  rect(W / 2 - 20.16, L - 16.5, 40.32, 16.5);
  rect(W / 2 - 9.16, L - 5.5, 18.32, 5.5);
  spot(W / 2, L - 11);
  arc(W / 2, L - 11, 9.15, -Math.PI / 2 - a, -Math.PI / 2 + a);
  arc(0, 0, 1, 0, Math.PI / 2);
  arc(W, 0, 1, Math.PI / 2, Math.PI);
  arc(0, L, 1, -Math.PI / 2, 0);
  arc(W, L, 1, Math.PI, Math.PI * 1.5);
  // Assombrit légèrement les abords
  const v = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.3, c.width / 2, c.height / 2, c.height * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = v;
  g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

function radialTexture(inner, outer, size = 128) {
  const [c, g] = canvas(size, size);
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner);
  r.addColorStop(1, outer);
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ballTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#f7f7f2';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#16181c';
  const spots = [[20, 30], [84, 64], [148, 28], [212, 66], [52, 100], [116, 104], [180, 100], [244, 22], [0, 70], [148, 120]];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(x + Math.cos(ang) * 13, y + Math.sin(ang) * 13 * 0.9);
    }
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boardTexture() {
  const [c, g] = canvas(1024, 64);
  g.fillStyle = '#06140c';
  g.fillRect(0, 0, 1024, 64);
  g.font = '800 34px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  g.textBaseline = 'middle';
  const parts = [['TEMPS DE JEU', '#ffffff'], ['●', '#34c759'], ['ATELIER D’EXERCICES', '#34c759'], ['●', '#ffffff'], ['TACTIQUE 3D', '#ffffff'], ['●', '#34c759']];
  let x = 18;
  for (const [txt, col] of parts) {
    g.fillStyle = col;
    g.fillText(txt, x, 34);
    x += g.measureText(txt).width + 26;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = 1024 / Math.max(1024, x);
  return t;
}

const labelCache = new Map();
function labelMaterial(num, col) {
  const key = `${num}|${col.fill}`;
  if (labelCache.has(key)) return labelCache.get(key);
  const [c, g] = canvas(128, 128);
  g.beginPath();
  g.arc(64, 64, 54, 0, Math.PI * 2);
  g.fillStyle = col.fill;
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = col.text;
  g.font = `800 ${String(num).length > 1 ? 58 : 66}px -apple-system, "SF Pro Rounded", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(num), 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, transparent: true });
  labelCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------- Géométries partagées

let G = null;
function shared() {
  if (G) return G;
  G = {
    leg: new THREE.CylinderGeometry(0.085, 0.075, 0.8, 10),
    shorts: new THREE.CylinderGeometry(0.25, 0.27, 0.3, 14),
    torso: new THREE.CapsuleGeometry(0.27, 0.32, 6, 14),
    head: new THREE.SphereGeometry(0.17, 14, 10),
    ring: new THREE.CircleGeometry(0.62, 32),
    halo: new THREE.TorusGeometry(0.95, 0.07, 8, 48),
    blob: new THREE.PlaneGeometry(1.8, 1.8),
    ball: new THREE.SphereGeometry(BALL_R, 24, 16),
    cone: new THREE.ConeGeometry(0.28, 0.55, 16),
  };
  G.blobMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false });
  G.haloMat = new THREE.MeshBasicMaterial({ color: '#ffe633' });
  G.skin = new THREE.MeshLambertMaterial({ color: '#c79a78' });
  G.glow = radialTexture('rgba(255,250,225,1)', 'rgba(255,240,200,0)');
  return G;
}

const lambertCache = new Map();
function lambert(color) {
  if (!lambertCache.has(color)) lambertCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return lambertCache.get(color);
}

// ---------------------------------------------------------------- Flèches (rubans au sol)

function arrowMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uProgress: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      attribute float aS;
      varying float vS;
      void main() {
        vS = aS;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uProgress;
      uniform float uOpacity;
      varying float vS;
      void main() {
        if (vS > uProgress + 0.0001) discard;
        gl_FragColor = vec4(uColor, uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function wave(a, b, amplitude, wavelength) {
  const len = a.distanceTo(b);
  const dir = b.clone().sub(a).divideScalar(len);
  const n = new THREE.Vector2(-dir.y, dir.x);
  const count = Math.max(12, Math.round(len / (wavelength / 10)));
  const pts = [];
  for (let k = 0; k <= count; k++) {
    const s = (k / count) * len;
    const env = Math.min(1, s / wavelength, (len - s) / wavelength);
    const off = Math.sin((s / wavelength) * Math.PI * 2) * amplitude * Math.max(0, env);
    pts.push(a.clone().addScaledVector(dir, s).addScaledVector(n, off));
  }
  return pts;
}

function curve(a, b, bulge) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const d = b.clone().sub(a).normalize();
  const ctrl = mid.addScaledVector(new THREE.Vector2(-d.y, d.x), bulge);
  const pts = [];
  for (let k = 0; k <= 28; k++) {
    const t = k / 28;
    pts.push(new THREE.Vector2(
      (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * ctrl.x + t * t * b.x,
      (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * ctrl.y + t * t * b.y,
    ));
  }
  return pts;
}

function ribbonGeometry(points, width, dashed) {
  const cum = [0];
  for (let k = 1; k < points.length; k++) cum.push(cum[k - 1] + points[k].distanceTo(points[k - 1]));
  const total = cum[cum.length - 1];
  const head = width * 3.2;
  const headW = width * 3.4;
  const bodyEnd = Math.max(0, total - head * 0.7);
  const pos = [];
  const sAttr = [];
  const idx = [];
  const y = 0.07;

  const at = (s) => {
    for (let k = 1; k < points.length; k++) {
      if (s <= cum[k]) {
        const t = (s - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
        return points[k - 1].clone().lerp(points[k], t);
      }
    }
    return points[points.length - 1].clone();
  };
  const segment = (s0, s1) => {
    const samples = [{ p: at(s0), s: s0 }];
    for (let k = 1; k < points.length - 1; k++) if (cum[k] > s0 && cum[k] < s1) samples.push({ p: points[k].clone(), s: cum[k] });
    samples.push({ p: at(s1), s: s1 });
    const base = pos.length / 3;
    samples.forEach((smp, k) => {
      const prev = samples[Math.max(0, k - 1)].p;
      const next = samples[Math.min(samples.length - 1, k + 1)].p;
      const d = next.clone().sub(prev);
      if (d.lengthSq() < 1e-9) d.set(0, 1);
      d.normalize();
      const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(width / 2);
      pos.push(smp.p.x + n.x, y, smp.p.y + n.y, smp.p.x - n.x, y, smp.p.y - n.y);
      sAttr.push(smp.s / total, smp.s / total);
      if (k > 0) {
        const i0 = base + (k - 1) * 2;
        idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    });
  };
  if (dashed) {
    const dash = width * 3.2;
    const gap = width * 2.2;
    for (let s = 0; s < bodyEnd; s += dash + gap) segment(s, Math.min(s + dash, bodyEnd));
  } else if (bodyEnd > 0) {
    segment(0, bodyEnd);
  }
  // Pointe
  const tip = points[points.length - 1];
  const before = at(Math.max(0, total - head));
  const dir = tip.clone().sub(before);
  if (dir.lengthSq() < 1e-9) dir.set(0, -1);
  dir.normalize();
  const n = new THREE.Vector2(-dir.y, dir.x);
  const baseP = tip.clone().addScaledVector(dir, -head);
  const b0 = pos.length / 3;
  const sb = Math.max(0, (total - head) / total);
  pos.push(tip.x, y + 0.005, tip.y);
  pos.push(baseP.x + n.x * headW / 2, y + 0.005, baseP.y + n.y * headW / 2);
  pos.push(baseP.x - n.x * headW / 2, y + 0.005, baseP.y - n.y * headW / 2);
  sAttr.push(1, sb, sb);
  idx.push(b0, b0 + 1, b0 + 2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aS', new THREE.Float32BufferAttribute(sAttr, 1));
  geo.setIndex(idx);
  return geo;
}

function buildArrow(arrow, scale) {
  const a = ground(arrow.from);
  const b = ground(arrow.to);
  const len = a.distanceTo(b);
  if (len <= 0.6) return null;
  const dir = b.clone().sub(a).divideScalar(len);
  const isRun = arrow.kind === 'course' || arrow.kind === 'conduite';
  const startTrim = (isRun ? 0.75 : 0.4) * scale;
  const endTrim = arrow.kind === 'tir' ? 0 : (isRun ? 0.95 : 0.6) * scale;
  if (len > startTrim + endTrim + 1.5) {
    a.addScaledVector(dir, startTrim);
    b.addScaledVector(dir, -endTrim);
  }
  const width = (arrow.kind === 'tir' ? 0.42 : 0.3) * Math.max(1, scale * 0.8);
  let pts;
  if (arrow.kind === 'conduite') pts = wave(a, b, width * 1.1, width * 7);
  else if (arrow.kind === 'passe' && arrow.aerial) pts = curve(a, b, a.distanceTo(b) * 0.12);
  else pts = [a, b];
  const color = arrow.kind === 'course' ? (ARROW_COLORS.course[arrow.team] || '#ffffff') : ARROW_COLORS[arrow.kind];
  const mat = arrowMaterial(color);
  const mesh = new THREE.Mesh(ribbonGeometry(pts, width, arrow.kind === 'course'), mat);
  mesh.renderOrder = 10;
  return { mesh, mat, fading: false };
}

// ---------------------------------------------------------------- Scène

export class Terrain3D {
  constructor(canvasEl, opts = {}) {
    this.canvas = canvasEl;
    this.opts = { crowd: true, maxDpr: 2, interactive: false, small: false, ...opts };
    const r = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' });
    this.renderer = r;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxDpr));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    r.setClearColor('#040906');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#06100a', 160, 460);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1600);
    this.camPos = new THREE.Vector3(0, 70, 110);
    this.camTarget = new THREE.Vector3();
    this.camera.position.copy(this.camPos);

    this.scale = 1.55;
    this.speed = 1;
    this.playing = true;
    this.loop = true;
    this.holdFactor = 1;
    this.cameraMode = 'coach';
    this.scroll = 0;
    this.pointer = 0;
    this.user = { az: 0, el: 0 };
    this.time = 0;
    this.listeners = {};
    this.actors = [];
    this.arrows = [];
    this.props = [];
    this.focus = { center: new THREE.Vector3(), R: 30 };
    this.celebrate = -1;
    this.snap = true;

    shared();
    this.buildEnvironment();
    this.dynamic = new THREE.Group();
    this.scene.add(this.dynamic);
    this.buildBall();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvasEl);
    this.resize();
    if (this.opts.interactive) this.bindOrbit();
    this.loopFn = this.loopFn.bind(this);
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); return this; }
  emit(name, arg) { (this.listeners[name] || []).forEach((fn) => fn(arg)); }

  // ---------------- Décor
  buildEnvironment() {
    const s = this.scene;
    const small = this.opts.small;

    // Ciel de nuit
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color('#020604') }, horizon: { value: new THREE.Color('#0f2a1c') } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vP;
          void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.55)), 1.0);
          #include <colorspace_fragment>
          }`,
      }),
    );
    s.add(sky);

    // Étoiles
    const starCount = small ? 260 : 520;
    const starPos = new Float32Array(starCount * 3);
    for (let k = 0; k < starCount; k++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * 1.1;
      starPos.set([Math.cos(th) * Math.sin(ph) * 800, Math.cos(ph) * 800 + 40, Math.sin(th) * Math.sin(ph) * 800], k * 3);
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos, 3)),
      new THREE.PointsMaterial({ color: '#cfe8da', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false }),
    );
    s.add(stars);

    // Lumières
    s.add(new THREE.HemisphereLight('#d9ecff', '#14361d', 1.35));
    const sun = new THREE.DirectionalLight('#fff4dc', 1.7);
    sun.position.set(40, 90, 30);
    s.add(sun);
    const back = new THREE.DirectionalLight('#b8d4ff', 0.6);
    back.position.set(-50, 60, -60);
    s.add(back);

    // Sol hors terrain
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ color: '#143a1c' }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    s.add(outer);

    // Pelouse
    const tex = pitchTexture(small ? 11 : 17, this.renderer.capabilities.getMaxAnisotropy());
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * M, L + 2 * M), new THREE.MeshLambertMaterial({ map: tex }));
    pitch.rotation.x = -Math.PI / 2;
    s.add(pitch);

    // Buts
    s.add(this.makeGoal(-L / 2, 1));
    s.add(this.makeGoal(L / 2, -1));

    // Panneaux LED
    this.boardTex = boardTexture();
    const boardMat = new THREE.MeshBasicMaterial({ map: this.boardTex, toneMapped: false });
    const backMat = new THREE.MeshLambertMaterial({ color: '#0b0f0d' });
    const addBoard = (len, x, z, rotY) => {
      const g = new THREE.Group();
      const t = this.boardTex.clone();
      t.needsUpdate = true;
      t.repeat.x = (len / 16) * this.boardTex.repeat.x;
      const m = boardMat.clone();
      m.map = t;
      (this.boardTexs ||= []).push(t);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.95), m);
      face.position.y = 0.6;
      const box = new THREE.Mesh(new THREE.BoxGeometry(len, 1.05, 0.2), backMat);
      box.position.set(0, 0.55, -0.12);
      g.add(box, face);
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      s.add(g);
    };
    const bx = W / 2 + 4;
    const bz = L / 2 + 4.2;
    addBoard(L + 6, -bx, 0, Math.PI / 2);
    addBoard(L + 6, bx, 0, -Math.PI / 2);
    addBoard(W - 12, 0, -bz, 0);
    addBoard(W - 12, 0, bz, Math.PI);

    // Tribunes + public
    this.buildStands(small);

    // Pylônes d'éclairage
    const poleMat = new THREE.MeshLambertMaterial({ color: '#2a2f35' });
    const lampMat = new THREE.MeshBasicMaterial({ color: '#fffbea', toneMapped: false });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (W / 2 + M + 24);
        const z = sz * (L / 2 + M + 20);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 46, 8), poleMat);
        pole.position.set(x, 23, z);
        s.add(pole);
        const head = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 0.8), lampMat);
        head.position.set(x, 47, z);
        head.lookAt(0, 0, 0);
        s.add(head);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glow, color: '#fff4d6', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        glow.position.set(x, 47, z);
        glow.scale.set(46, 46, 1);
        s.add(glow);
        const halo = glow.clone();
        halo.material = glow.material.clone();
        halo.material.opacity = 0.25;
        halo.scale.set(130, 130, 1);
        s.add(halo);
      }
    }
  }

  makeGoal(z, dir) {
    const g = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: '#fbfbf8' });
    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.44, 10);
    for (const x of [-3.66, 3.66]) {
      const p = new THREE.Mesh(postGeo, white);
      p.position.set(x, 1.22, 0);
      g.add(p);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.46, 10), white);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 2.44, 0);
    g.add(bar);
    // Filet
    const depth = 2.2;
    const pts = [];
    const step = 0.36;
    for (let x = -3.66; x <= 3.67; x += step) {
      pts.push(x, 2.44, 0, x, 2.44, -depth * 0.55, x, 2.44, -depth * 0.55, x, 0, -depth);
    }
    for (let y = 0; y <= 2.45; y += step) {
      const zz = -depth + (y / 2.44) * depth * 0.45;
      pts.push(-3.66, y, zz, 3.66, y, zz, -3.66, y, 0, -3.66, y, zz, 3.66, y, 0, 3.66, y, zz);
    }
    for (let zz = 0; zz >= -depth; zz -= step) {
      pts.push(-3.66, 2.44, zz * 0.55, 3.66, 2.44, zz * 0.55);
    }
    const net = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.42 }),
    );
    g.add(net);
    g.position.z = z;
    if (dir < 0) g.rotation.y = Math.PI;
    return g;
  }

  buildStands(small) {
    const s = this.scene;
    const tiers = 11;
    const standMat = new THREE.MeshLambertMaterial({ color: '#262b33' });
    const seatMat = new THREE.MeshLambertMaterial({ color: '#173264' });
    const sides = [
      { len: L + 2 * M + 22, off: W / 2 + M + 7, axis: 'x' },
      { len: W + 2 * M + 22, off: L / 2 + M + 7, axis: 'z' },
    ];
    const spots = [];
    for (const side of sides) {
      for (const sign of [-1, 1]) {
        for (let k = 0; k < tiers; k++) {
          const h = 1.1 + k * 0.9;
          const d = side.off + k * 1.6;
          const box = new THREE.Mesh(new THREE.BoxGeometry(side.axis === 'x' ? 1.6 : side.len, h, side.axis === 'x' ? side.len : 1.6), k % 2 ? standMat : seatMat);
          if (side.axis === 'x') box.position.set(sign * d, h / 2, 0);
          else box.position.set(0, h / 2, sign * d);
          s.add(box);
          if (!this.opts.crowd) continue;
          const spacing = 0.78;
          const n = Math.floor(side.len / spacing);
          for (let j = 0; j < n; j++) {
            if (Math.random() < (small ? 0.55 : 0.3)) continue;
            const along = -side.len / 2 + (j + 0.5) * spacing + (Math.random() - 0.5) * 0.2;
            const x = side.axis === 'x' ? sign * d : along;
            const z = side.axis === 'x' ? along : sign * d;
            spots.push([x, h + 0.42, z]);
          }
        }
      }
    }
    // Toit léger au-dessus des tribunes latérales
    const roofMat = new THREE.MeshLambertMaterial({ color: '#1a1e24' });
    for (const sign of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, L + 2 * M + 22), roofMat);
      roof.position.set(sign * (W / 2 + M + 16), 17, 0);
      roof.rotation.z = sign * 0.12;
      s.add(roof);
    }
    if (!spots.length) return;
    const palette = ['#2673f2', '#e62626', '#f2f2f2', '#ffd91a', '#1d2a44', '#34c759', '#ff8c1a', '#8a93a3', '#3b4252'].map((c) => new THREE.Color(c));
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.72, 0.36), new THREE.MeshLambertMaterial(), spots.length);
    const m = new THREE.Matrix4();
    this.crowdBase = new Float32Array(spots.length * 3);
    this.crowdPhase = new Float32Array(spots.length);
    spots.forEach((p, k) => {
      m.makeTranslation(p[0], p[1], p[2]);
      crowd.setMatrixAt(k, m);
      crowd.setColorAt(k, palette[Math.floor(Math.random() * palette.length)].clone().multiplyScalar(0.45 + Math.random() * 0.25));
      this.crowdBase.set(p, k * 3);
      this.crowdPhase[k] = Math.random() * Math.PI * 2;
    });
    crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crowd = crowd;
    s.add(crowd);
  }

  buildBall() {
    const ball = new THREE.Mesh(G.ball, new THREE.MeshLambertMaterial({ map: ballTexture() }));
    ball.position.set(0, BALL_R, 0);
    const shadow = new THREE.Mesh(G.blob, G.blobMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(0.45);
    shadow.position.y = 0.012;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    this.ball = ball;
    this.ballShadow = shadow;
    this.ballRing = ring;
    this.scene.add(ball, shadow, ring);
  }

  // ---------------- Exercice
  load(ex) {
    for (const a of this.arrows) { a.mesh.geometry.dispose(); a.mat.dispose(); }
    this.arrows = [];
    this.dynamic.clear();
    this.ex = ex;
    this.frames = resolveFrames(ex);
    this.computeFocus();
    this.scale = clamp(0.95 + this.focus.R / 45, 1.1, 1.6);
    this.labelScale = clamp(this.focus.R / 24, 0.72, 1.15);
    this.actors = ex.acteurs.map((a) => this.makeActor(a));
    this.actors.forEach((a) => this.dynamic.add(a.root));
    for (const p of ex.materiel || []) {
      const obj = this.makeProp(p);
      if (obj) this.dynamic.add(obj);
    }
    this.user = { az: 0, el: 0 };
    this.snap = true;
    this.goTo(0);
  }

  makeActor(actor) {
    const gk = actor.poste === 'Gardien';
    const col = gk ? GARDIEN : CAMP[actor.camp] || CAMP.equipe;
    const fill = new THREE.Color(col.fill);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: fill, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const blob = new THREE.Mesh(G.blob, G.blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    const halo = new THREE.Mesh(G.halo, G.haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.09;
    halo.visible = false;
    root.add(blob, ring, halo);

    const lum = fill.r * 0.299 + fill.g * 0.587 + fill.b * 0.114;
    const shortsColor = lum > 0.6 ? '#1a2440' : '#f7f7f7';
    const legs = [-0.11, 0.11].map((dx) => {
      const hip = new THREE.Group();
      hip.position.set(dx, 0.8, 0);
      const leg = new THREE.Mesh(G.leg, lambert(col.fill));
      leg.position.y = -0.4;
      hip.add(leg);
      body.add(hip);
      return hip;
    });
    const shorts = new THREE.Mesh(G.shorts, lambert(shortsColor));
    shorts.position.y = 0.88;
    const torso = new THREE.Mesh(G.torso, lambert(col.fill));
    torso.position.y = 1.33;
    const head = new THREE.Mesh(G.head, G.skin);
    head.position.y = 1.93;
    body.add(shorts, torso, head);

    const label = new THREE.Sprite(labelMaterial(actor.numero ?? '', col));
    label.position.y = 2.75;
    const ls = 1.2 * (this.labelScale ?? 1);
    label.scale.set(ls, ls, 1);
    label.position.y = 2.45 + ls * 0.3;
    label.renderOrder = 100;
    root.add(label);

    root.scale.setScalar(this.scale);
    const facing = actor.camp === 'adversaire' ? 0 : Math.PI;
    body.rotation.y = facing;
    return { id: actor.id, actor, root, body, legs, halo, label, phase: Math.random() * 6, speed: 0, prev: new THREE.Vector3(), yaw: facing, facing };
  }

  makeProp(p) {
    const color = PROP_COLORS[p.couleur] || (p.type === 'mannequin' ? PROP_COLORS.jaune : PROP_COLORS.orange);
    const pos = ground(p.pos);
    if (p.type === 'zone') {
      const w = (p.taille?.[0] ?? 0.2) * W;
      const h = (p.taille?.[1] ?? 0.2) * L;
      const g = new THREE.Group();
      const fillM = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false }));
      fillM.rotation.x = -Math.PI / 2;
      fillM.position.y = 0.04;
      g.add(fillM);
      const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
      const t = 0.16;
      for (const [ew, eh, ex, ez] of [[w, t, 0, -h / 2], [w, t, 0, h / 2], [t, h, -w / 2, 0], [t, h, w / 2, 0]]) {
        const e = new THREE.Mesh(new THREE.PlaneGeometry(ew, eh), edgeMat);
        e.rotation.x = -Math.PI / 2;
        e.position.set(ex, 0.05, ez);
        g.add(e);
      }
      g.position.set(pos.x, 0, pos.y);
      return g;
    }
    if (p.type === 'plot') {
      const c = new THREE.Mesh(G.cone, lambert(color));
      c.position.set(pos.x, 0.27, pos.y);
      c.scale.setScalar(1.25);
      return c;
    }
    if (p.type === 'mannequin') {
      const g = new THREE.Group();
      const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 4, 12), lambert(color));
      bodyM.position.y = 1.0;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.1, 16), lambert('#2a2f35'));
      base.position.y = 0.05;
      g.add(bodyM, base);
      g.position.set(pos.x, 0, pos.y);
      g.scale.setScalar(1.2);
      return g;
    }
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 12), lambert(color));
    c.position.set(pos.x, 0.3, pos.y);
    return c;
  }

  computeFocus() {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    const add = (p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); };
    for (const st of this.ex.etapes) {
      Object.values(st.positions || {}).forEach(add);
      if (st.ballon) add(st.ballon);
    }
    for (const p of this.ex.materiel || []) {
      const w = (p.taille?.[0] ?? 0) / 2;
      const h = (p.taille?.[1] ?? 0) / 2;
      add([p.pos[0] - w, p.pos[1] - h]);
      add([p.pos[0] + w, p.pos[1] + h]);
    }
    const c = ground([(x0 + x1) / 2, (y0 + y1) / 2]);
    this.focus = { center: new THREE.Vector3(c.x, 0, c.y), R: Math.max(9, Math.hypot((x1 - x0) * W, (y1 - y0) * L) / 2) };
  }

  actorById(id) { return this.actors.find((a) => a.id === id); }

  setFocus(ids = []) {
    const set = new Set(ids || []);
    for (const a of this.actors) a.halo.visible = set.has(a.id);
  }

  holdTime(i) {
    const txt = this.ex.etapes[i]?.texte || '';
    return clamp(1.3 + txt.length / 65, 2.4, 5.2) * this.holdFactor;
  }

  fadeArrows() { for (const a of this.arrows) a.fading = true; }

  addArrows(list, progress = 0) {
    for (const arrow of list) {
      const a = buildArrow(arrow, this.scale);
      if (!a) continue;
      a.mat.uniforms.uProgress.value = progress;
      this.arrows.push(a);
      this.dynamic.add(a.mesh);
    }
  }

  goTo(i) {
    if (!this.ex) return;
    i = clamp(i, 0, this.frames.length - 1);
    this.fadeArrows();
    this.step = i;
    this.pose(this.frames[i], this.frames[i], 1, null);
    if (i > 0) this.addArrows(arrowsFor(this.ex, this.frames, i), 1);
    this.setFocus(this.ex.etapes[i].focus);
    this.phase = 'hold';
    this.phaseT = 0;
    this.emit('step', i);
  }

  startStep(i) {
    this.fadeArrows();
    this.step = i;
    this.phase = 'arrows';
    this.phaseT = 0;
    this.addArrows(arrowsFor(this.ex, this.frames, i), 0);
    this.setFocus(this.ex.etapes[i].focus);
    this.emit('step', i);
  }

  finishCurrent() {
    if (this.phase === 'arrows' || this.phase === 'move') {
      this.pose(this.frames[this.step - 1], this.frames[this.step], 1, this.ex.etapes[this.step]);
      for (const a of this.arrows) if (!a.fading) a.mat.uniforms.uProgress.value = 1;
      this.phase = 'hold';
      this.phaseT = 0;
    } else if (this.phase === 'rewind') {
      this.goTo(0);
    }
  }

  next() {
    if (!this.ex) return;
    this.finishCurrent();
    if (this.step < this.frames.length - 1) this.startStep(this.step + 1);
    else this.goTo(0);
  }

  prev() {
    if (!this.ex) return;
    this.goTo(this.step - 1);
  }

  play() { this.playing = true; }
  pause() { this.playing = false; }

  setCamera(mode) {
    this.cameraMode = mode;
    this.user = { az: 0, el: 0 };
    this.applyViewOffset();
  }

  // En mode cinéma, décale le cadrage pour laisser la place au texte de la page
  applyViewOffset() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.cameraMode !== 'cinema') {
      // Laisse la barre de lecture posée sur le bas du terrain
      if (this.opts.barShift && w > 760) this.camera.setViewOffset(w, h, 0, this.opts.barShift * h, w, h);
      else this.camera.clearViewOffset();
      return;
    }
    const aspect = w / h;
    const dx = aspect >= 1.2 ? -0.17 * w : aspect >= 1 ? -0.08 * w : 0;
    const dy = aspect < 1 ? -0.16 * h : -0.03 * h;
    this.camera.setViewOffset(w, h, dx, dy, w, h);
  }

  // Interpolation entre deux images de l'exercice
  pose(from, to, u, step) {
    const e = easeInOut(u);
    for (const a of this.actors) {
      const p0 = from.positions[a.id] || to.positions[a.id];
      const p1 = to.positions[a.id] || p0;
      if (!p0) { a.root.visible = false; continue; }
      a.root.visible = true;
      const g0 = ground(p0);
      const g1 = ground(p1);
      a.root.position.x = lerp(g0.x, g1.x, e);
      a.root.position.z = lerp(g0.y, g1.y, e);
    }
    const glue = (id) => {
      const h = this.actorById(id);
      const o = ballOffset(h?.actor.camp);
      return new THREE.Vector2(h.root.position.x + o[0] * W, h.root.position.z + o[1] * L);
    };
    let bp;
    let by = BALL_R;
    const carried = from.holder && from.holder === to.holder;
    if (carried || (!step && to.holder && u >= 1)) {
      bp = glue(to.holder);
    } else {
      const bu = step ? easeOut(Math.min(1, u / 0.85)) : e;
      const b0 = ground(from.ball);
      const b1 = to.holder ? glue(to.holder) : ground(to.ball);
      bp = b0.clone().lerp(b1, bu);
      const d = b0.distanceTo(b1);
      if (step && isAerial(step)) by += Math.sin(Math.PI * bu) * Math.min(9, d * 0.17);
      else if (step?.action === 'tir') by += Math.sin(Math.PI * Math.min(1, bu * 1.15)) * Math.min(1.4, d * 0.06);
    }
    this.placeBall(bp.x, by, bp.y);
  }

  placeBall(x, y, z) {
    const b = this.ball;
    const dx = x - b.position.x;
    const dz = z - b.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4 && d < 6) {
      const axis = new THREE.Vector3(dz, 0, -dx).normalize();
      b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, d / BALL_R));
    }
    b.position.set(x, y, z);
    this.ballShadow.position.set(x, 0.012, z);
    this.ballRing.position.set(x, 0.025, z);
    this.ballRing.material.opacity = Math.max(0, 0.45 - (y - BALL_R) * 0.08);
    this.ballShadow.scale.setScalar(0.45 * (1 + (y - BALL_R) * 0.08));
  }

  checkGoal() {
    const st = this.ex.etapes[this.step];
    const b = this.frames[this.step].ball;
    if (st?.action === 'tir' && (b[1] < 0 || b[1] > 1)) {
      this.celebrate = 0;
      this.emit('goal');
    }
  }

  updatePlayback(dt) {
    if (!this.ex) return;
    const last = this.frames.length - 1;
    this.phaseT += dt;
    if (this.phase === 'arrows') {
      const u = Math.min(1, this.phaseT / 0.65);
      for (const a of this.arrows) if (!a.fading) a.mat.uniforms.uProgress.value = easeOut(u);
      if (u >= 1) { this.phase = 'move'; this.phaseT = 0; }
    } else if (this.phase === 'move') {
      const st = this.ex.etapes[this.step];
      const u = Math.min(1, this.phaseT / (st.duree || 1.6));
      this.pose(this.frames[this.step - 1], this.frames[this.step], u, st);
      if (u >= 1) { this.phase = 'hold'; this.phaseT = 0; this.checkGoal(); }
    } else if (this.phase === 'hold') {
      if (this.playing && this.phaseT >= this.holdTime(this.step)) {
        if (this.step < last) this.startStep(this.step + 1);
        else if (this.loop) {
          this.phase = 'rewind';
          this.phaseT = 0;
          this.fadeArrows();
          this.setFocus([]);
          this.emit('rewind');
        } else {
          this.playing = false;
          this.emit('end');
        }
      }
    } else if (this.phase === 'rewind') {
      const u = Math.min(1, this.phaseT / 1.5);
      this.pose(this.frames[last], this.frames[0], u, null);
      if (u >= 1) {
        this.step = 0;
        this.phase = 'hold';
        this.phaseT = 0;
        this.setFocus(this.ex.etapes[0].focus);
        this.emit('step', 0);
      }
    }
  }

  updateActors(dt) {
    for (const a of this.actors) {
      const p = a.root.position;
      const dx = p.x - a.prev.x;
      const dz = p.z - a.prev.z;
      const v = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
      a.prev.copy(p);
      a.speed = lerp(a.speed, Math.min(v, 12), 1 - Math.exp(-dt * 10));
      const run = Math.min(1, a.speed / 3);
      a.phase += dt * (3 + a.speed * 1.5);
      const amp = Math.min(0.8, a.speed * 0.13);
      a.legs[0].rotation.x = Math.sin(a.phase) * amp;
      a.legs[1].rotation.x = -Math.sin(a.phase) * amp;
      a.body.position.y = Math.abs(Math.sin(a.phase)) * 0.08 * run;
      a.body.rotation.x = 0.12 * run;
      const target = a.speed > 0.6 ? Math.atan2(dx, dz) : a.facing;
      let diff = target - a.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.yaw += diff * (1 - Math.exp(-dt * 8));
      a.body.rotation.y = a.yaw;
      a.label.visible = this.camera.position.distanceTo(p) > 7;
      if (a.halo.visible) {
        const k = 1 + Math.sin(this.time * 5) * 0.08;
        a.halo.scale.set(k, k, k);
      }
    }
  }

  updateArrows(dt) {
    this.arrows = this.arrows.filter((a) => {
      if (!a.fading) return true;
      a.mat.uniforms.uOpacity.value -= dt * 3;
      if (a.mat.uniforms.uOpacity.value > 0) return true;
      this.dynamic.remove(a.mesh);
      a.mesh.geometry.dispose();
      a.mat.dispose();
      return false;
    });
  }

  updateCrowd() {
    if (!this.crowd || this.celebrate < 0) return;
    const t = this.celebrate;
    const env = t < 2.8 ? Math.sin((t / 2.8) * Math.PI) : 0;
    const m = new THREE.Matrix4();
    const n = this.crowdPhase.length;
    for (let k = 0; k < n; k++) {
      const jump = Math.max(0, Math.sin(t * 11 + this.crowdPhase[k])) * 0.55 * env;
      m.makeTranslation(this.crowdBase[k * 3], this.crowdBase[k * 3 + 1] + jump, this.crowdBase[k * 3 + 2]);
      this.crowd.setMatrixAt(k, m);
    }
    this.crowd.instanceMatrix.needsUpdate = true;
    if (t >= 2.8) this.celebrate = -1;
  }

  updateCamera(dt) {
    const c = this.focus.center;
    const R = this.focus.R;
    const aspect = this.camera.aspect || 1;
    const fit = aspect < 1.3 ? Math.min(2.3, 1.3 / aspect) : 1;
    const ballP = this.ball.position;
    const target = c.clone().lerp(new THREE.Vector3(ballP.x, 0, ballP.z), 0.18);
    let pos;
    const sph = new THREE.Spherical();
    if (this.cameraMode === 'cinema') {
      const tgt = c.clone().lerp(new THREE.Vector3(ballP.x, 0, ballP.z), 0.35);
      target.copy(tgt);
      // Caméra sur le côté : l'attaque file vers la droite de l'écran (le texte est à gauche)
      const portrait = aspect < 1;
      sph.radius = (0.85 * R + 34) * (portrait ? Math.min(1.9, 1.05 / aspect) : fit) * (1 + this.scroll * 0.25);
      sph.phi = clamp(1.0 - this.scroll * 0.78, 0.18, 1.4);
      sph.theta = (portrait ? 1.3 : 0.95) + Math.sin(this.time * 0.07) * (portrait ? 0.18 : 0.28) + this.pointer * 0.15;
      pos = new THREE.Vector3().setFromSpherical(sph).add(target);
    } else if (this.cameraMode === 'immersion') {
      target.set(ballP.x, 0.8, ballP.z - 16);
      pos = new THREE.Vector3(ballP.x + 2.5, 4.6, ballP.z + 13);
      const off = pos.clone().sub(target);
      sph.setFromVector3(off);
      sph.theta += this.user.az;
      sph.phi = clamp(sph.phi - this.user.el, 0.3, 1.5);
      pos = new THREE.Vector3().setFromSpherical(sph).add(target);
    } else {
      let off;
      if (this.cameraMode === 'tribune') off = new THREE.Vector3(-(0.95 * R + 17), 0.5 * R + 9, 0.12 * R);
      else if (this.cameraMode === 'dessus') off = new THREE.Vector3(0, 1.25 * R + 30, (1.25 * R + 30) * 0.07);
      else off = new THREE.Vector3(0, 0.55 * R + 9, 0.85 * R + 15);
      off.multiplyScalar(fit);
      sph.setFromVector3(off);
      sph.theta += this.user.az;
      sph.phi = clamp(sph.phi - this.user.el, 0.05, 1.45);
      pos = new THREE.Vector3().setFromSpherical(sph).add(target);
    }
    if (this.snap) {
      this.camPos.copy(pos);
      this.camTarget.copy(target);
      this.snap = false;
    } else {
      const k = 1 - Math.exp(-dt * (this.cameraMode === 'immersion' ? 3.5 : 2.2));
      this.camPos.lerp(pos, k);
      this.camTarget.lerp(target, k);
    }
    // Petite secousse de caméra sur un but
    const shake = this.celebrate >= 0 && this.celebrate < 0.5 ? (0.5 - this.celebrate) * 0.5 : 0;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * shake, this.camPos.y + (Math.random() - 0.5) * shake, this.camPos.z);
    this.camera.lookAt(this.camTarget);
  }

  update(dt) {
    this.time += dt;
    if (this.celebrate >= 0) this.celebrate += dt;
    this.updatePlayback(dt * this.speed);
    this.updateActors(dt);
    this.updateArrows(dt);
    this.updateCrowd();
    if (this.boardTexs) for (const t of this.boardTexs) t.offset.x = (t.offset.x + dt * 0.035) % 1;
    this.updateCamera(dt);
  }

  // ---------------- Boucle de rendu
  loopFn(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - (this.last ?? now)) / 1000);
    this.last = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loopFn);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = undefined;
    this.raf = requestAnimationFrame(this.loopFn);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  renderOnce() {
    this.update(0.016);
    this.snap = true;
    this.updateCamera(0.016);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyViewOffset();
    this.camera.updateProjectionMatrix();
    if (!this.running) this.renderer.render(this.scene, this.camera);
  }

  bindOrbit() {
    const el = this.canvas;
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, type: e.pointerType };
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('is-dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.user.az -= dx * 0.006;
      if (drag.type === 'mouse') this.user.el = clamp(this.user.el + dy * 0.004, -0.9, 0.9);
    });
    const end = () => { drag = null; el.classList.remove('is-dragging'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => { this.user = { az: 0, el: 0 }; });
  }
}
