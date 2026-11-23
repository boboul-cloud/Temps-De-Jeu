// Terrain 3D (Three.js) : port de Pitch3DController.swift.
// Joueurs, ballons, matériel, flèches au sol, tracés, halos, caméras prédéfinies
// (Coach, Tribune, Dessus, Immersion), animation des étapes et déplacement au doigt
// (vue Placement). Repère de l'app : x = largeur (0 → 1), y = longueur (0 = but attaqué).
// Les points sont des tableaux [x, y] (format des fichiers .tdjt, voir model.js).
import * as THREE from '../../../vendor/three.module.min.js';
import { COULEURS_ATELIER, MAILLOTS, couleurMateriel, decalageBallon } from '../../model.js';

// MARK: - Géométrie du terrain (mètres)

export const LARGEUR = 68;
export const LONGUEUR = 105;
const MARGE = 5;
const RAYON_BALLON = 0.11;

const monde = (p, y = 0) => new THREE.Vector3(p[0] * LARGEUR - LARGEUR / 2, y, p[1] * LONGUEUR - LONGUEUR / 2);
const sol = (p) => new THREE.Vector2(p[0] * LARGEUR - LARGEUR / 2, p[1] * LONGUEUR - LONGUEUR / 2);
const normalise = (x, z) => [(x + LARGEUR / 2) / LARGEUR, (z + LONGUEUR / 2) / LONGUEUR];
const borne = (v, a, b) => Math.min(b, Math.max(a, v));
const lisse = (t) => t * t * (3 - 2 * t);

// MARK: - Caméras

export const CAMERAS = [
  { id: 'coach', nom: 'Coach', icone: 'person.fill.viewfinder' },
  { id: 'tribune', nom: 'Tribune', icone: 'sportscourt' },
  { id: 'dessus', nom: 'Dessus', icone: 'square.grid.3x3' },
  { id: 'immersion', nom: 'Immersion', icone: 'eye' },
];

// MARK: - Couleurs

const rgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const css = (c) => new THREE.Color().setStyle(c, THREE.SRGBColorSpace);

/** Couleur d'un maillot : id JerseyColor (« Bleu »), couleur CSS, ou valeur par défaut */
function couleurMaillot(valeur, defaut) {
  const m = MAILLOTS.find((x) => x.id === valeur);
  if (m) return { fond: m.css, texte: m.texte };
  if (typeof valeur === 'string' && valeur) return { fond: valeur, texte: luminosite(css(valeur)) > 0.62 ? '#000000' : '#FFFFFF' };
  return defaut;
}

/** Palette (Pitch3DPalette) : { equipe, adversaire, joker } — ids JerseyColor ou couleurs CSS */
export function paletteDe(p = {}) {
  return {
    equipe: couleurMaillot(p.equipe ?? p.team, { fond: '#007AFF', texte: '#FFFFFF' }),
    adversaire: couleurMaillot(p.adversaire ?? p.opponent, { fond: '#FF3B30', texte: '#FFFFFF' }),
    joker: couleurMaillot(p.joker, { fond: '#FFCC00', texte: '#000000' }),
  };
}

const luminosite = (c) => {
  const s = c.clone().convertLinearToSRGB();
  return 0.299 * s.r + 0.587 * s.g + 0.114 * s.b;
};
const ecart = (a, b) => {
  const x = a.clone().convertLinearToSRGB(); const y = b.clone().convertLinearToSRGB();
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
};

/** Couleurs du gardien : la première assez différente des deux maillots */
function couleursGardien(aEviter) {
  const candidats = [
    { fond: 'rgb(184,242,38)', texte: '#000000' },
    { fond: 'rgb(255,115,0)', texte: '#FFFFFF' },
    { fond: 'rgb(217,26,191)', texte: '#FFFFFF' },
    { fond: 'rgb(26,217,217)', texte: '#000000' },
  ];
  for (const c of candidats) if (aEviter.every((x) => ecart(css(c.fond), css(x)) > 0.45)) return c;
  return candidats[0];
}

const couleurChasuble = (id) => {
  const c = COULEURS_ATELIER.find((x) => x.id === id);
  return c ? { fond: c.css, texte: ['jaune', 'blanc', 'rose'].includes(id) ? '#000000' : '#FFFFFF' } : null;
};

// MARK: - Textures

function toile(l, h) {
  const c = document.createElement('canvas');
  c.width = l; c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pelouse rayée + tracés réglementaires (TextureFactory.pitch) */
function texturePelouse(ppm) {
  const W = LARGEUR; const L = LONGUEUR; const m = MARGE;
  const [c, g] = toile(Math.round((W + 2 * m) * ppm), Math.round((L + 2 * m) * ppm));
  const px = (x) => (x + m) * ppm;
  const py = (y) => (y + m) * ppm;
  g.fillStyle = 'rgb(46,128,51)';
  g.fillRect(0, 0, c.width, c.height);
  const bandes = 18;
  const hb = L / bandes;
  g.fillStyle = 'rgb(56,145,61)';
  for (let i = 0; i < bandes; i += 2) g.fillRect(0, py(i * hb), c.width, hb * ppm);
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 0.13 * ppm;
  g.strokeRect(px(0), py(0), W * ppm, L * ppm);
  g.beginPath(); g.moveTo(px(0), py(L / 2)); g.lineTo(px(W), py(L / 2)); g.stroke();
  g.beginPath(); g.arc(px(W / 2), py(L / 2), 9.15 * ppm, 0, Math.PI * 2); g.stroke();
  const point = (x, y) => { g.beginPath(); g.arc(px(x), py(y), 0.22 * ppm, 0, Math.PI * 2); g.fill(); };
  point(W / 2, L / 2);
  for (const haut of [true, false]) {
    const ligne = haut ? 0 : L;
    const signe = haut ? 1 : -1;
    const bw = 40.32; const bd = 16.5; const gw = 18.32; const gd = 5.5;
    g.strokeRect(px((W - bw) / 2), py(haut ? ligne : ligne - bd), bw * ppm, bd * ppm);
    g.strokeRect(px((W - gw) / 2), py(haut ? ligne : ligne - gd), gw * ppm, gd * ppm);
    const ys = ligne + signe * 11;
    point(W / 2, ys);
    const a0 = haut ? 0.6435 : Math.PI + 0.6435;
    const a1 = haut ? Math.PI - 0.6435 : 2 * Math.PI - 0.6435;
    g.beginPath(); g.arc(px(W / 2), py(ys), 9.15 * ppm, a0, a1); g.stroke();
  }
  for (const [x, y, a] of [[0, 0, 0], [W, 0, Math.PI / 2], [W, L, Math.PI], [0, L, 1.5 * Math.PI]]) {
    g.beginPath(); g.arc(px(x), py(y), ppm, a, a + Math.PI / 2); g.stroke();
  }
  return texture(c);
}

/** Ciel en dégradé (projection équirectangulaire) */
function textureCiel() {
  const [c, g] = toile(8, 256);
  const d = g.createLinearGradient(0, 0, 0, 256);
  d.addColorStop(0, 'rgb(92,148,224)');
  d.addColorStop(0.35, 'rgb(158,199,240)');
  d.addColorStop(0.5, 'rgb(214,230,242)');
  d.addColorStop(0.52, 'rgb(51,82,51)');
  d.addColorStop(1, 'rgb(51,82,51)');
  g.fillStyle = d;
  g.fillRect(0, 0, 8, 256);
  const t = texture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/** Maille de filet */
function textureFilet() {
  const [c, g] = toile(32, 32);
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 30, 30);
  const t = texture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Ballon blanc à taches noires */
function textureBallon() {
  const [c, g] = toile(256, 128);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgb(26,26,26)';
  const taches = [[0, 0.5], [0.25, 0.5], [0.5, 0.5], [0.75, 0.5], [0.125, 0.2], [0.375, 0.2], [0.625, 0.2], [0.875, 0.2],
    [0.125, 0.8], [0.375, 0.8], [0.625, 0.8], [0.875, 0.8]];
  for (const [u, v] of taches) {
    for (const dx of [-256, 0, 256]) {
      g.beginPath();
      g.ellipse(u * 256 + dx, v * 128, 13, 13 * 0.8, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillRect(0, 0, 256, 6);
  g.fillRect(0, 122, 256, 6);
  return texture(c);
}

/** Pastille numéro (+ nom) au-dessus du joueur */
function textureEtiquette(numero, nom, fond, texteCouleur) {
  const badge = 200;
  const avecNom = Boolean(nom);
  const [c, g] = toile(avecNom ? 320 : 220, avecNom ? 300 : 220);
  const cx = c.width / 2;
  const cy = 10 + badge / 2;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowOffsetY = 4;
  g.shadowBlur = 8;
  g.fillStyle = fond;
  g.beginPath(); g.arc(cx, cy, badge / 2, 0, Math.PI * 2); g.fill();
  g.restore();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 12;
  g.beginPath(); g.arc(cx, cy, badge / 2 - 6, 0, Math.PI * 2); g.stroke();
  const n = String(numero ?? '');
  g.fillStyle = texteCouleur;
  g.font = `900 ${[...n].length > 2 ? 70 : 104}px ui-rounded, "SF Pro Rounded", -apple-system, "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(n, cx, cy + 4);
  if (avecNom) {
    g.font = '700 44px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
    let affiche = nom;
    while (g.measureText(affiche).width > c.width - 40 && affiche.length > 3) affiche = `${affiche.slice(0, -2)}…`;
    const lt = g.measureText(affiche).width;
    const hp = 54;
    const x0 = cx - lt / 2 - 16;
    const y0 = 10 + badge + 14;
    g.fillStyle = 'rgba(0,0,0,0.62)';
    g.beginPath();
    g.roundRect(x0, y0, lt + 32, hp, hp / 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillText(affiche, cx, y0 + hp / 2 + 2);
  }
  return { texture: texture(c), rapport: c.height / c.width };
}

// MARK: - Matériaux

const lambert = (couleur, opts = {}) => new THREE.MeshLambertMaterial({ color: couleur instanceof THREE.Color ? couleur : css(couleur), ...opts });
const constant = (couleur, opacite = 1) => new THREE.MeshBasicMaterial({
  color: couleur instanceof THREE.Color ? couleur : css(couleur), transparent: opacite < 1, opacity: opacite, side: THREE.DoubleSide,
});

// MARK: - Flèches au sol (ArrowBuilder)

export function couleurFleche(f) {
  switch (f.type) {
    case 'course': return f.camp === 'adversaire' ? 'rgb(255,140,140)' : f.camp === 'joker' ? 'rgb(140,217,255)' : '#ffffff';
    case 'passe': return 'rgb(255,219,26)';
    case 'conduite': return 'rgb(255,140,26)';
    default: return 'rgb(255,56,56)';
  }
}

function longueurPolyligne(pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += pts[i].distanceTo(pts[i - 1]);
  return t;
}

function pointSur(pts, d) {
  if (pts.length < 2) return (pts[0] ?? new THREE.Vector2()).clone();
  let reste = d;
  for (let i = 1; i < pts.length; i++) {
    const s = pts[i].distanceTo(pts[i - 1]);
    if (reste <= s && s > 0) return pts[i - 1].clone().lerp(pts[i], reste / s);
    reste -= s;
  }
  return pts[pts.length - 1].clone();
}

function sousPolyligne(pts, s0, s1) {
  if (s1 <= s0 || pts.length < 2) return [];
  const res = [pointSur(pts, s0)];
  let cumul = 0;
  for (let i = 1; i < pts.length; i++) {
    cumul += pts[i].distanceTo(pts[i - 1]);
    if (cumul > s0 && cumul < s1) res.push(pts[i].clone());
  }
  res.push(pointSur(pts, s1));
  return res;
}

function ajouterRuban(pts, largeur, y, positions, indices) {
  if (pts.length < 2) return;
  const depart = positions.length / 3;
  const n = pts.length;
  for (let k = 0; k < n; k++) {
    const prec = pts[Math.max(0, k - 1)];
    const suiv = pts[Math.min(n - 1, k + 1)];
    const t = suiv.clone().sub(prec);
    if (t.length() > 0.0001) t.normalize(); else t.set(1, 0);
    const nx = -t.y * (largeur / 2); const ny = t.x * (largeur / 2);
    positions.push(pts[k].x + nx, y, pts[k].y + ny, pts[k].x - nx, y, pts[k].y - ny);
  }
  for (let k = 0; k < n - 1; k++) {
    const i = depart + k * 2;
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
}

function geometrie(positions, indices) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  return g;
}

/** Polyligne avec pointe de flèche (ArrowBuilder.polylineNode) */
function polyligneFlechee(pts, couleur, largeur, pointilles = false) {
  const groupe = new THREE.Group();
  if (pts.length < 2) return groupe;
  const tete = largeur * 3.2;
  const lt = largeur * 3.4;
  const total = longueurPolyligne(pts);
  if (total <= 0.1) return groupe;
  const finCorps = Math.max(0, total - tete * 0.7);
  const positions = [];
  const indices = [];
  const y = 0.06;
  if (pointilles) {
    const trait = largeur * 3.2; const espace = largeur * 2.2;
    for (let s = 0; s < finCorps; s += trait + espace) ajouterRuban(sousPolyligne(pts, s, Math.min(s + trait, finCorps)), largeur, y, positions, indices);
  } else {
    ajouterRuban(sousPolyligne(pts, 0, finCorps), largeur, y, positions, indices);
  }
  const bout = pts[pts.length - 1];
  const avant = pointSur(pts, Math.max(0, total - tete));
  const dir = bout.clone().sub(avant);
  if (dir.length() > 0.0001) dir.normalize(); else dir.set(0, -1);
  const nrm = new THREE.Vector2(-dir.y, dir.x);
  const base = bout.clone().addScaledVector(dir, -tete);
  const d = positions.length / 3;
  for (const p of [bout, base.clone().addScaledVector(nrm, lt / 2), base.clone().addScaledVector(nrm, -lt / 2)]) positions.push(p.x, y + 0.005, p.y);
  indices.push(d, d + 1, d + 2);
  const mat = new THREE.MeshBasicMaterial({ color: css(couleur), transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometrie(positions, indices), mat);
  mesh.renderOrder = 10;
  groupe.add(mesh);
  return groupe;
}

function vague(a, b, amplitude, longueurOnde) {
  const len = a.distanceTo(b);
  if (len <= 0.01) return [a, b];
  const dir = b.clone().sub(a).divideScalar(len);
  const nrm = new THREE.Vector2(-dir.y, dir.x);
  const n = Math.max(10, Math.trunc(len / (longueurOnde / 10)));
  const calme = Math.min(len * 0.3, longueurOnde);
  const res = [];
  for (let i = 0; i <= n; i++) {
    const d = (len * i) / n;
    const fondu = borne((len - d) / calme, 0, 1);
    const dec = Math.sin((d / longueurOnde) * 2 * Math.PI) * amplitude * fondu;
    res.push(a.clone().addScaledVector(dir, d).addScaledVector(nrm, dec));
  }
  return res;
}

function courbe(a, b, bombe) {
  const mil = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  const ctrl = mil.addScaledVector(new THREE.Vector2(-dir.y, dir.x), bombe);
  const res = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24; const u = 1 - t;
    res.push(new THREE.Vector2(u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y));
  }
  return res;
}

/** Flèche au sol pour { type, de, a, aerien, camp } (ArrowBuilder.node) */
function noeudFleche(f, echelle) {
  let a = sol(f.de); let b = sol(f.a);
  const len = a.distanceTo(b);
  const groupe = new THREE.Group();
  if (len <= 0.6) return groupe;
  const dir = b.clone().sub(a).divideScalar(len);
  const course = f.type === 'course' || f.type === 'conduite';
  const debut = (course ? 0.75 : 0.4) * echelle;
  const fin = f.type === 'tir' ? 0 : (course ? 0.95 : 0.6) * echelle;
  if (len > debut + fin + 1.5) {
    a = a.clone().addScaledVector(dir, debut);
    b = b.clone().addScaledVector(dir, -fin);
  }
  const largeur = (f.type === 'tir' ? 0.42 : 0.3) * Math.max(1, echelle * 0.8);
  let pts;
  if (f.type === 'conduite') pts = vague(a, b, largeur * 1.1, largeur * 7);
  else if (f.type === 'passe' && f.aerien) pts = courbe(a, b, a.distanceTo(b) * 0.12);
  else pts = [a, b];
  groupe.add(polyligneFlechee(pts, couleurFleche(f), largeur, f.type === 'course'));
  return groupe;
}

// MARK: - Scène

export class Terrain3D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ editable?: boolean }} options
   */
  constructor(canvas, { editable = false } = {}) {
    this.canvas = canvas;
    this.editable = editable;
    this.cameraPreset = 'coach';
    this.isAnimating = false;
    this.onActorMoved = null;
    this.onBallMoved = null;
    this.onBallDropped = null;
    this.onCamera = null;

    this.acteurs = new Map();      // id → { root, body, halo, acteur, cle }
    this.listeActeurs = [];
    this.materiel = [];
    this.cleMateriel = '';
    this.palette = paletteDe();
    this.cleDePalette = '';
    this.frame = null;
    this.ballonVisible = true;
    this.surbrillance = new Set();
    this.focusMin = [0, 0];
    this.focusMax = [1, 1];
    this.playerScale = 1.6;
    this.dernieresFleches = [];
    this.fondus = [];               // { objets, de, a, duree, t, fin }
    this.anim = null;
    this.transitionCamera = null;
    this.autresBallons = new Map();
    this.ressources = new Set();

    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.3, 900);
    this.camera.position.set(0, 70, 95);
    this.cible = new THREE.Vector3();
    this.haut = new THREE.Vector3(0, 1, 0);

    this.construireScene();
    this.racineMateriel = new THREE.Group();
    this.racineFleches = new THREE.Group();
    this.racineTraces = new THREE.Group();
    this.racineActeurs = new THREE.Group();
    this.scene.add(this.racineMateriel, this.racineFleches, this.racineTraces, this.racineActeurs);
    this.construireBallon();
    this.appliquerEchelle();

    this.tailleConnue = null;
    this.observateur = new ResizeObserver(() => this.redimensionner());
    this.observateur.observe(canvas);
    this.brancherGestes();
    this.boucle = this.boucle.bind(this);
    this.temps = 0;
    this.enMarche = false;
    this.redimensionner();
    this.demarrer();
  }

  // MARK: Configuration publique

  /** Joueurs, matériel et couleurs (Pitch3DController.configure) */
  configure(acteurs, materiel, palette) {
    const pal = paletteDe(palette);
    const clePalette = JSON.stringify(pal);
    const paletteChangee = clePalette !== this.cleDePalette;
    this.palette = pal;
    this.cleDePalette = clePalette;

    const cleMat = JSON.stringify(materiel ?? []);
    if (cleMat !== this.cleMateriel) {
      this.cleMateriel = cleMat;
      this.materiel = materiel ?? [];
      this.reconstruireMateriel();
    }

    const ids = new Set(acteurs.map((a) => a.id));
    for (const [id, n] of this.acteurs) {
      if (!ids.has(id)) { this.racineActeurs.remove(n.root); this.liberer(n.root); this.acteurs.delete(id); }
    }
    for (const a of acteurs) {
      const cle = JSON.stringify(a);
      const existant = this.acteurs.get(a.id);
      if (existant && existant.cle === cle && !paletteChangee) continue;
      const position = existant?.root.position.clone();
      const visible = existant?.root.visible;
      if (existant) { this.racineActeurs.remove(existant.root); this.liberer(existant.root); }
      const n = this.noeudActeur(a);
      n.cle = cle;
      if (position) { n.root.position.copy(position); n.root.visible = visible; }
      this.acteurs.set(a.id, n);
      this.racineActeurs.add(n.root);
    }
    this.listeActeurs = acteurs;
    this.appliquerEchelle();
    this.setHighlights(this.surbrillance);
  }

  /** Zone à cadrer (coordonnées normalisées) */
  setFocus(lo, hi) {
    const padX = 0.06; const padY = 0.05;
    this.focusMin = [Math.max(0, lo[0] - padX), Math.max(0, lo[1] - padY)];
    this.focusMax = [Math.min(1, hi[0] + padX), Math.min(1, hi[1] + padY)];
    const etendue = Math.max((this.focusMax[0] - this.focusMin[0]) * LARGEUR, (this.focusMax[1] - this.focusMin[1]) * LONGUEUR);
    this.playerScale = Math.min(2.4, Math.max(1.15, 0.8 + etendue / 60));
    this.appliquerEchelle();
    if (this.dernieresFleches.length) this.showArrows(this.dernieresFleches, false);
  }

  setBallVisible(visible) {
    this.ballonVisible = visible;
    this.ballon.visible = visible;
  }

  get ballScale() { return Math.max(3, this.playerScale * 2.4) * (this.editable ? 1.25 : 1); }

  positionBallon(p) { return monde(p, RAYON_BALLON * this.ballScale); }

  /** Place instantanément tous les éléments (setFrame) */
  setFrame(frame) {
    this.anim = null;
    this.isAnimating = false;
    this.frame = structuredClone(frame);
    for (const [id, n] of this.acteurs) {
      if (this.glisse?.type === 'acteur' && this.glisse.id === id) continue;
      const p = frame.positions[id];
      if (p) { n.root.visible = true; n.root.position.copy(monde(p)); n.body.position.set(0, 0, 0); }
      else n.root.visible = false;
    }
    if (this.glisse?.type !== 'ballon') this.ballon.position.copy(this.positionBallon(frame.ballon));
    const autres = frame.autres ?? {};
    for (const [id, n] of this.autresBallons) if (!autres[id]) n.visible = false;
    for (const [id, b] of Object.entries(autres)) {
      const n = this.autreBallon(id);
      n.visible = true;
      n.position.copy(this.positionBallon(b.point));
    }
  }

  autreBallon(id) {
    if (this.autresBallons.has(id)) return this.autresBallons.get(id);
    const n = this.ballon.clone();
    n.visible = true;
    this.scene.add(n);
    this.autresBallons.set(id, n);
    return n;
  }

  /** Anime le passage à un nouvel état ; `fin` est appelée à l'arrivée */
  animate(frame, { aerien = false, autresAeriens = new Set(), duree = 2, fin = null } = {}) {
    const depart = this.frame;
    if (!depart || duree <= 0.05) { this.setFrame(frame); fin?.(); return; }
    const mouvements = [];
    for (const [id, n] of this.acteurs) {
      const p = frame.positions[id];
      if (!p) { n.root.visible = false; continue; }
      const e = monde(p);
      const s = !n.root.visible || !depart.positions[id] ? e.clone() : new THREE.Vector3(n.root.position.x, 0, n.root.position.z);
      n.root.visible = true;
      const d = s.distanceTo(e);
      mouvements.push({ root: n.root, body: n.body, s, e, foulees: d > 1 ? Math.max(2, d / 2.2) : 0 });
    }
    const rayon = RAYON_BALLON * this.ballScale;
    const mouvementBallon = (noeud, point, enLair, apparait) => {
      const e = this.positionBallon(point);
      const s = apparait ? e.clone() : noeud.position.clone();
      s.y = rayon;
      const d = s.distanceTo(e);
      const h = enLair ? Math.min(10, Math.max(2.5, d * 0.2)) : 0;
      const horiz = new THREE.Vector3(e.x - s.x, 0, e.z - s.z);
      const lh = horiz.length();
      const axe = lh > 0.001 ? new THREE.Vector3(0, 1, 0).cross(horiz).normalize() : new THREE.Vector3(1, 0, 0);
      return { noeud, s, e, h, rayon, q0: noeud.quaternion.clone(), axe, lh };
    };
    const ballons = [mouvementBallon(this.ballon, frame.ballon, aerien, false)];
    const autres = frame.autres ?? {};
    for (const [id, n] of this.autresBallons) if (!autres[id]) n.visible = false;
    for (const [id, b] of Object.entries(autres)) {
      const n = this.autreBallon(id);
      const apparait = !n.visible || !depart.autres?.[id];
      n.visible = true;
      ballons.push(mouvementBallon(n, b.point, autresAeriens.has(id), apparait));
    }
    this.frame = structuredClone(frame);
    this.isAnimating = true;
    this.anim = { t: 0, duree, mouvements, ballons, fin };
  }

  avancerAnimation(dt) {
    const a = this.anim;
    if (!a) return;
    a.t += dt;
    const t = borne(a.t / a.duree, 0, 1);
    const e = lisse(t);
    for (const m of a.mouvements) {
      m.root.position.lerpVectors(m.s, m.e, e);
      m.body.position.set(0, m.foulees > 0 ? Math.abs(Math.sin(t * Math.PI * m.foulees)) * 0.09 * Math.sin(t * Math.PI) : 0, 0);
    }
    for (const b of a.ballons) {
      b.noeud.position.lerpVectors(b.s, b.e, e);
      b.noeud.position.y = b.rayon + b.h * 4 * e * (1 - e);
      if (b.lh > 0.001) {
        const q = new THREE.Quaternion().setFromAxisAngle(b.axe, (b.lh * e) / b.rayon);
        b.noeud.quaternion.copy(q.multiply(b.q0));
      }
    }
    if (t >= 1) {
      this.anim = null;
      this.isAnimating = false;
      a.fin?.();
    }
  }

  /** Flèches au sol (fondu si animé) */
  showArrows(fleches, anime = false) {
    this.dernieresFleches = fleches;
    for (const enfant of [...this.racineFleches.children]) {
      if (anime) this.fondre(enfant, 1, 0, 0.2, true);
      else { this.racineFleches.remove(enfant); this.liberer(enfant); }
    }
    for (const f of fleches) {
      const n = noeudFleche(f, this.playerScale);
      if (anime) { this.opacite(n, 0); this.fondre(n, 0, 1, 0.35, false); }
      this.racineFleches.add(n);
    }
  }

  /** Tracés libres de la vue Placement (polylignes jaunes) */
  showDrawings(lignes) {
    for (const enfant of [...this.racineTraces.children]) { this.racineTraces.remove(enfant); this.liberer(enfant); }
    for (const l of lignes) {
      if (l.length < 2) continue;
      this.racineTraces.add(polyligneFlechee(l.map(sol), 'rgb(255,217,26)', 0.3 * Math.max(1, this.playerScale * 0.8)));
    }
  }

  /** Halo pulsé autour des joueurs mis en évidence */
  setHighlights(ids) {
    this.surbrillance = new Set(ids);
    for (const [id, n] of this.acteurs) {
      const actif = this.surbrillance.has(id);
      if (actif && !n.halo.visible) { n.halo.visible = true; n.halo.userData.debut = this.temps; }
      else if (!actif) n.halo.visible = false;
    }
  }

  opacite(objet, valeur) {
    objet.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = valeur; } });
  }

  fondre(objet, de, a, duree, retirer) {
    this.fondus.push({ objet, de, a, duree, t: 0, retirer });
  }

  avancerFondus(dt) {
    this.fondus = this.fondus.filter((f) => {
      f.t += dt;
      const u = borne(f.t / f.duree, 0, 1);
      this.opacite(f.objet, f.de + (f.a - f.de) * u);
      if (u < 1) return true;
      if (f.retirer) { f.objet.parent?.remove(f.objet); this.liberer(f.objet); }
      return false;
    });
  }

  // MARK: Caméra

  /** Point de vue prédéfini (applyCamera), avec transition de 0,8 s si animé */
  applyCamera(preset, anime = false) {
    this.cameraPreset = preset;
    const lo = monde(this.focusMin);
    const hi = monde(this.focusMax);
    const centre = lo.clone().add(hi).multiplyScalar(0.5);
    const spanX = Math.max(12, hi.x - lo.x);
    const spanZ = Math.max(12, hi.z - lo.z);
    const l = this.canvas.clientWidth; const h = this.canvas.clientHeight;
    const aspect = l > 1 && h > 1 ? l / h : 0.75;
    const tanV = Math.tan((40 * Math.PI) / 360);
    const tanH = tanV * aspect;
    const distance = (horizontal, vertical) => Math.max(horizontal / (2 * tanH), vertical / (2 * tanV)) * 1.05;
    const figure = 2.2 * this.playerScale;
    let position;
    let cible = centre.clone();
    let haut = new THREE.Vector3(0, 1, 0);
    switch (preset) {
      case 'tribune': {
        const el = (28 * Math.PI) / 180;
        const d = distance(spanZ, spanX * Math.sin(el) + figure);
        position = centre.clone().add(new THREE.Vector3(d * Math.cos(el), d * Math.sin(el), 0));
        break;
      }
      case 'dessus': {
        const d = distance(spanX, spanZ);
        position = centre.clone().add(new THREE.Vector3(0, d, 0.01));
        haut = new THREE.Vector3(0, 0, -1);
        break;
      }
      case 'immersion':
        position = new THREE.Vector3(centre.x, 2.2 * this.playerScale + 1.5, hi.z + 6);
        cible = new THREE.Vector3(centre.x, 1, centre.z - spanZ * 0.2);
        break;
      default: {
        const el = (40 * Math.PI) / 180;
        const d = distance(spanX, spanZ * Math.sin(el) + figure) * 1.12;
        cible = centre.clone().add(new THREE.Vector3(0, 0, spanZ * 0.07));
        position = cible.clone().add(new THREE.Vector3(0, d * Math.sin(el), d * Math.cos(el)));
      }
    }
    if (anime) {
      this.transitionCamera = {
        t: 0, duree: 0.8,
        p0: this.camera.position.clone(), c0: this.cible.clone(), h0: this.haut.clone(),
        p1: position, c1: cible, h1: haut,
      };
    } else {
      this.transitionCamera = null;
      this.camera.position.copy(position);
      this.cible.copy(cible);
      this.haut.copy(haut);
      this.viser();
    }
    this.onCamera?.(preset);
  }

  viser() {
    this.camera.up.copy(this.haut);
    this.camera.lookAt(this.cible);
  }

  avancerCamera(dt) {
    const tr = this.transitionCamera;
    if (!tr) return;
    tr.t += dt;
    const u = borne(tr.t / tr.duree, 0, 1);
    const e = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
    this.camera.position.lerpVectors(tr.p0, tr.p1, e);
    this.cible.lerpVectors(tr.c0, tr.c1, e);
    this.haut.lerpVectors(tr.h0, tr.h1, e).normalize();
    this.viser();
    if (u >= 1) this.transitionCamera = null;
  }

  // MARK: Construction de la scène

  garder(r) { this.ressources.add(r); return r; }

  construireScene() {
    const s = this.scene;
    s.background = this.garder(textureCiel());
    s.fog = new THREE.Fog(rgb(0.78, 0.86, 0.93), 170, 460);

    const exterieur = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), lambert(rgb(0.16, 0.36, 0.17)));
    exterieur.rotation.x = -Math.PI / 2;
    exterieur.position.y = -0.03;
    exterieur.receiveShadow = true;
    s.add(exterieur);

    const tex = this.garder(texturePelouse(20));
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const pelouse = new THREE.Mesh(new THREE.PlaneGeometry(LARGEUR + 2 * MARGE, LONGUEUR + 2 * MARGE), new THREE.MeshLambertMaterial({ map: tex }));
    pelouse.rotation.x = -Math.PI / 2;
    pelouse.receiveShadow = true;
    s.add(pelouse);

    this.texFilet = this.garder(textureFilet());
    s.add(this.but(-LONGUEUR / 2, -1), this.but(LONGUEUR / 2, 1), this.stade());

    s.add(new THREE.AmbientLight(0xffffff, 0.48 * Math.PI));
    const soleil = new THREE.DirectionalLight(0xffffff, 0.95 * Math.PI);
    soleil.position.set(30.4, 81.3, 49.7);
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(2048, 2048);
    const sc = soleil.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 260;
    soleil.shadow.bias = -0.0006;
    soleil.shadow.radius = 2.5;
    s.add(soleil, soleil.target);
    this.texBallon = this.garder(textureBallon());
  }

  /** Filet : fond + toit + côtés (netBox) */
  filet(largeur, hauteur, profondeur, sortie) {
    const g = new THREE.Group();
    const plan = (l, h) => {
      const t = this.texFilet.clone();
      t.needsUpdate = true;
      t.repeat.set(l / 0.25, h / 0.25);
      this.garder(t);
      return new THREE.Mesh(new THREE.PlaneGeometry(l, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    };
    const fond = plan(largeur, hauteur);
    fond.position.set(0, hauteur / 2, sortie * profondeur);
    const toit = plan(largeur, profondeur);
    toit.rotation.x = -Math.PI / 2;
    toit.position.set(0, hauteur, (sortie * profondeur) / 2);
    g.add(fond, toit);
    for (const x of [-largeur / 2, largeur / 2]) {
      const cote = plan(profondeur, hauteur);
      cote.rotation.y = Math.PI / 2;
      cote.position.set(x, hauteur / 2, (sortie * profondeur) / 2);
      g.add(cote);
    }
    return g;
  }

  but(ligneZ, sortie) {
    const g = new THREE.Group();
    const blanc = lambert(rgb(0.98, 0.98, 0.98));
    const l = 7.32; const h = 2.44; const r = 0.07;
    for (const x of [-l / 2, l / 2]) {
      const poteau = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), blanc);
      poteau.position.set(x, h / 2, 0);
      poteau.castShadow = true;
      g.add(poteau);
    }
    const barre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l + 2 * r, 12), blanc);
    barre.rotation.z = Math.PI / 2;
    barre.position.y = h;
    barre.castShadow = true;
    g.add(barre, this.filet(l, h, 2.0, sortie));
    g.position.z = ligneZ;
    return g;
  }

  stade() {
    const g = new THREE.Group();
    const tribune = rgb(0.33, 0.36, 0.43);
    const sieges = rgb(0.18, 0.32, 0.58);
    const panneau = lambert(rgb(0.08, 0.16, 0.36));
    const dW = LARGEUR / 2; const dL = LONGUEUR / 2;
    const boite = (l, h, p, x, y, z, mat) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(l, h, p), mat);
      b.position.set(x, y, z);
      g.add(b);
    };
    const ecart = 4;
    boite(0.15, 0.9, LONGUEUR + 2 * ecart, -dW - ecart, 0.45, 0, panneau);
    boite(0.15, 0.9, LONGUEUR + 2 * ecart, dW + ecart, 0.45, 0, panneau);
    boite(LARGEUR + 2 * ecart, 0.9, 0.15, 0, 0.45, -dL - ecart, panneau);
    boite(LARGEUR + 2 * ecart, 0.9, 0.15, 0, 0.45, dL + ecart, panneau);
    for (let rang = 0; rang < 4; rang++) {
      const h = 1.6 + rang * 1.6;
      const dec = 9 + rang * 3;
      const mat = lambert(rang % 2 === 0 ? tribune : sieges);
      for (const signe of [-1, 1]) {
        boite(3, h, LONGUEUR + 2 * dec, signe * (dW + dec), h / 2, 0, mat);
        boite(LARGEUR + 2 * dec + 3, h, 3, 0, h / 2, signe * (dL + dec), mat);
      }
    }
    return g;
  }

  construireBallon() {
    const b = new THREE.Mesh(new THREE.SphereGeometry(RAYON_BALLON, 32, 20), new THREE.MeshPhongMaterial({ map: this.texBallon, specular: rgb(0.6, 0.6, 0.6), shininess: 30 }));
    b.castShadow = true;
    this.ballon = b;
    this.scene.add(b);
  }

  appliquerEchelle() {
    const s = this.playerScale;
    for (const n of this.acteurs.values()) n.root.scale.setScalar(s);
    const bs = this.ballScale;
    this.ballon.scale.setScalar(bs);
    for (const n of this.autresBallons.values()) n.scale.setScalar(bs);
    if (this.frame && !this.isAnimating) {
      this.ballon.position.copy(this.positionBallon(this.frame.ballon));
      for (const [id, b] of Object.entries(this.frame.autres ?? {})) this.autresBallons.get(id)?.position.copy(this.positionBallon(b.point));
    }
    const ps = Math.max(1, s * 0.85);
    for (const enfant of this.racineMateriel.children) if (enfant.userData.petit) enfant.scale.setScalar(ps);
  }

  // MARK: Joueurs

  maillot(a) {
    const bib = couleurChasuble(a.bib);
    if (bib) return bib;
    if (a.isGoalkeeper) return couleursGardien([this.palette.equipe.fond, this.palette.adversaire.fond]);
    if (a.team === 'adversaire') return this.palette.adversaire;
    if (a.team === 'joker') return this.palette.joker;
    return this.palette.equipe;
  }

  /** a = { id, team, label, name, isGoalkeeper, bib } (Pitch3DActor) */
  noeudActeur(a) {
    const c = this.maillot(a);
    const fond = css(c.fond);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const anneau = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.02, 32), constant(fond, 0.6));
    anneau.position.y = 0.015;
    root.add(anneau);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 10, 48), new THREE.MeshBasicMaterial({ color: rgb(1, 0.9, 0.2), transparent: true, opacity: 0.9 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.06;
    halo.visible = false;
    root.add(halo);

    const clair = luminosite(fond) > 0.75;
    const short = clair ? rgb(0.1, 0.14, 0.3) : rgb(0.97, 0.97, 0.97);
    const matMaillot = lambert(fond);
    for (const dx of [-0.11, 0.11]) {
      const jambe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.78, 12), matMaillot);
      jambe.position.set(dx, 0.39, 0);
      jambe.castShadow = true;
      body.add(jambe);
    }
    const shortM = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 18), lambert(short));
    shortM.position.y = 0.88;
    const buste = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.32, 6, 16), matMaillot);
    buste.position.y = 1.33;
    const tete = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), lambert(rgb(0.78, 0.6, 0.47)));
    tete.position.y = 1.93;
    for (const m of [shortM, buste, tete]) { m.castShadow = true; body.add(m); }

    const { texture: tex, rapport } = textureEtiquette(a.label, a.name, c.fond, c.texte);
    const largeur = a.name ? 1.9 : 1.25;
    const etiquette = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
    etiquette.scale.set(largeur, largeur * rapport, 1);
    etiquette.position.y = 2.25 + (largeur * rapport) / 2;
    etiquette.renderOrder = 100;
    body.add(etiquette);

    root.scale.setScalar(this.playerScale);
    root.visible = false;
    return { root, body, halo, acteur: a };
  }

  // MARK: Matériel

  reconstruireMateriel() {
    for (const enfant of [...this.racineMateriel.children]) { this.racineMateriel.remove(enfant); this.liberer(enfant); }
    for (const p of this.materiel) {
      const couleur = css(COULEURS_ATELIER.find((x) => x.id === couleurMateriel(p))?.css ?? '#ffffff');
      const angle = -((p.rotation ?? 0) * Math.PI) / 180;
      let n = new THREE.Group();
      let petit = false;
      const ajouter = (geo, mat, y, rot) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.y = y;
        if (rot) m.rotation.z = rot;
        m.castShadow = true;
        n.add(m);
        return m;
      };
      switch (p.type) {
        case 'plot': ajouter(new THREE.CylinderGeometry(0.035, 0.17, 0.3, 18), lambert(couleur), 0.15); petit = true; break;
        case 'coupelle': ajouter(new THREE.CylinderGeometry(0.07, 0.2, 0.07, 20), lambert(couleur), 0.035); petit = true; break;
        case 'piquet': ajouter(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 10), lambert(couleur), 0.8); petit = true; break;
        case 'mannequin': {
          const m = ajouter(new THREE.CapsuleGeometry(0.28, 1.9 - 0.56, 6, 16), lambert(couleur), 0.95);
          m.scale.set(1, 1, 0.45);
          n.rotation.y = angle;
          break;
        }
        case 'mini-but': n = this.miniBut(); n.rotation.y = angle; break;
        case 'but': n = this.miniBut(5, 2, 1.5); n.rotation.y = angle; break;
        case 'cerceau': {
          const t = ajouter(new THREE.TorusGeometry(0.4, 0.025, 8, 40), lambert(couleur), 0.03);
          t.rotation.x = Math.PI / 2;
          petit = true;
          break;
        }
        case 'echelle': n = this.echelle(couleur); n.rotation.y = angle; break;
        case 'haie': n = this.haie(couleur); n.rotation.y = angle; petit = true; break;
        case 'ballon': ajouter(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshLambertMaterial({ map: this.texBallon }), 0.11); petit = true; break;
        case 'zone': n = this.zone(p.taille ?? [0.2, 0.15], couleur); break;
        default: ajouter(new THREE.CylinderGeometry(0.035, 0.17, 0.3, 18), lambert(couleur), 0.15); petit = true;
      }
      const w = monde(p.pos);
      n.position.x = w.x;
      n.position.z = w.z;
      n.userData.petit = petit;
      this.racineMateriel.add(n);
    }
    this.appliquerEchelle();
  }

  miniBut(largeur = 2, hauteur = 1, profondeur = 0.8) {
    const g = new THREE.Group();
    const blanc = lambert('#ffffff');
    for (const x of [-largeur / 2, largeur / 2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, hauteur, 10), blanc);
      p.position.set(x, hauteur / 2, 0);
      p.castShadow = true;
      g.add(p);
    }
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, largeur, 10), blanc);
    b.rotation.z = Math.PI / 2;
    b.position.y = hauteur;
    g.add(b, this.filet(largeur, hauteur, profondeur, -1));
    return g;
  }

  echelle(couleur) {
    const g = new THREE.Group();
    const mat = lambert(couleur);
    const longueur = 4; const largeur = 0.5;
    for (const x of [-largeur / 2, largeur / 2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, longueur), mat);
      rail.position.set(x, 0.012, 0);
      g.add(rail);
    }
    for (let i = 0; i < 9; i++) {
      const barreau = new THREE.Mesh(new THREE.BoxGeometry(largeur, 0.015, 0.035), mat);
      barreau.position.set(0, 0.01, -longueur / 2 + (longueur * i) / 8);
      g.add(barreau);
    }
    return g;
  }

  haie(couleur) {
    const g = new THREE.Group();
    const mat = lambert(couleur);
    const l = 1; const h = 0.3;
    const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, l, 10), mat);
    barre.rotation.z = Math.PI / 2;
    barre.position.y = h;
    barre.castShadow = true;
    g.add(barre);
    for (const x of [-l / 2, l / 2]) {
      const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 8), mat);
      pied.position.set(x, h / 2, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.3), mat);
      base.position.set(x, 0.01, 0);
      g.add(pied, base);
    }
    return g;
  }

  zone(taille, couleur) {
    const l = taille[0] * LARGEUR; const h = taille[1] * LONGUEUR;
    const g = new THREE.Group();
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(l, h), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    fond.rotation.x = -Math.PI / 2;
    fond.position.y = 0.025;
    const coins = [[-l / 2, -h / 2], [l / 2, -h / 2], [l / 2, h / 2], [-l / 2, h / 2], [-l / 2, -h / 2]].map(([x, z]) => new THREE.Vector2(x, z));
    const positions = []; const indices = [];
    ajouterRuban(coins, 0.14, 0.035, positions, indices);
    const bord = new THREE.Mesh(geometrie(positions, indices), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    g.add(fond, bord);
    return g;
  }

  // MARK: Boucle de rendu

  boucle(maintenant) {
    if (!this.enMarche) return;
    const dt = Math.min(0.05, (maintenant - (this.dernier ?? maintenant)) / 1000);
    this.dernier = maintenant;
    this.temps += dt;
    this.avancerAnimation(dt);
    this.avancerFondus(dt);
    this.avancerCamera(dt);
    this.avancerOrbite(dt);
    for (const n of this.acteurs.values()) {
      if (!n.halo.visible) continue;
      const cycle = ((this.temps - (n.halo.userData.debut ?? 0)) % 1.4) / 0.7;
      const u = cycle < 1 ? cycle : 2 - cycle;
      n.halo.scale.setScalar(1 + 0.35 * u);
      n.halo.material.opacity = 0.9 - 0.65 * u;
    }
    if (!document.hidden) this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.boucle);
  }

  demarrer() {
    if (this.enMarche) return;
    this.enMarche = true;
    this.dernier = undefined;
    this.raf = requestAnimationFrame(this.boucle);
  }

  arreter() {
    this.enMarche = false;
    cancelAnimationFrame(this.raf);
  }

  redimensionner() {
    const l = this.canvas.clientWidth; const h = this.canvas.clientHeight;
    if (!l || !h) return;
    this.renderer.setSize(l, h, false);
    this.camera.aspect = l / h;
    this.camera.updateProjectionMatrix();
    const ancien = this.tailleConnue;
    this.tailleConnue = { l, h };
    const aspectAncien = ancien ? ancien.l / ancien.h : 0;
    if (!ancien || Math.abs(aspectAncien - l / h) > 0.15) this.applyCamera(this.cameraPreset, false);
  }

  // MARK: Gestes : caméra en orbite, déplacement au doigt (Placement)

  brancherGestes() {
    const c = this.canvas;
    const pointeurs = new Map();
    let pincement = null;
    this.vitesseOrbite = { az: 0, el: 0 };
    const bas = (e) => {
      try { c.setPointerCapture?.(e.pointerId); } catch { /* pointeur simulé */ }
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointeurs.size === 2) {
        const [a, b] = [...pointeurs.values()];
        pincement = Math.hypot(a.x - b.x, a.y - b.y);
        this.glisse = null;
        return;
      }
      const r = c.getBoundingClientRect();
      const cible = this.editable && !this.isAnimating ? this.cibleTouchee(e.clientX - r.left, e.clientY - r.top) : null;
      this.glisse = cible;
      this.transitionCamera = null;
      e.preventDefault();
    };
    const deplace = (e) => {
      if (!pointeurs.has(e.pointerId)) return;
      const avant = pointeurs.get(e.pointerId);
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointeurs.size === 2 && pincement) {
        const [a, b] = [...pointeurs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomer(pincement / Math.max(1, d));
        pincement = d;
        return;
      }
      if (this.glisse) { this.glisser(e); return; }
      this.orbiter((e.clientX - avant.x) * -0.006, (e.clientY - avant.y) * -0.005);
    };
    const haut = (e) => {
      pointeurs.delete(e.pointerId);
      if (pointeurs.size < 2) pincement = null;
      if (this.glisse && pointeurs.size === 0) this.lacher();
    };
    c.addEventListener('pointerdown', bas);
    c.addEventListener('pointermove', deplace);
    c.addEventListener('pointerup', haut);
    c.addEventListener('pointercancel', haut);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomer(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    c.style.touchAction = 'none';
  }

  orbiter(dAz, dEl) {
    const off = this.camera.position.clone().sub(this.cible);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dAz;
    sph.phi = borne(sph.phi + dEl, (1 * Math.PI) / 180, (87 * Math.PI) / 180);
    this.camera.position.copy(new THREE.Vector3().setFromSpherical(sph).add(this.cible));
    this.haut.set(0, 1, 0);
    this.viser();
  }

  avancerOrbite() {}

  zoomer(facteur) {
    const off = this.camera.position.clone().sub(this.cible);
    const l = borne(off.length() * facteur, 4, 400);
    this.camera.position.copy(this.cible.clone().add(off.setLength(l)));
    this.viser();
  }

  /** Projette un point du monde à l'écran (px CSS) */
  projeter(v) {
    const p = v.clone().project(this.camera);
    if (p.z < -1 || p.z > 1) return null;
    return { x: (p.x + 1) / 2 * this.canvas.clientWidth, y: (1 - p.y) / 2 * this.canvas.clientHeight };
  }

  /** Sélection tolérante : l'élément le plus proche du doigt (hitTarget) */
  cibleTouchee(x, y) {
    const dist = (v) => { const p = this.projeter(v); return p ? Math.hypot(p.x - x, p.y - y) : Infinity; };
    let meilleur = null;
    for (const [id, n] of this.acteurs) {
      if (!n.root.visible) continue;
      const base = n.root.position;
      const h = this.playerScale;
      const d = Math.min(...[0.5, 1.3, 2.4].map((k) => dist(base.clone().add(new THREE.Vector3(0, h * k, 0)))));
      if (d < 44 && d < (meilleur?.d ?? Infinity)) meilleur = { type: 'acteur', id, d };
    }
    if (this.ballonVisible && this.ballon.visible) {
      const d = dist(this.ballon.position);
      if (this.frame?.porteur) {
        if (d < 20 && d < (meilleur?.d ?? Infinity)) meilleur = { type: 'ballon', d };
      } else if (d - 10 < 42 && d - 10 < (meilleur?.d ?? Infinity)) meilleur = { type: 'ballon', d: d - 10 };
    }
    return meilleur;
  }

  pointAuSol(e) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
  }

  glisser(e) {
    const hit = this.pointAuSol(e);
    if (!hit || !this.frame) return;
    let p = normalise(hit.x, hit.z);
    p = [borne(p[0], 0.02, 0.98), borne(p[1], 0.02, 0.98)];
    if (this.glisse.type === 'acteur') {
      const n = this.acteurs.get(this.glisse.id);
      if (!n) return;
      n.root.position.copy(monde(p));
      n.root.scale.setScalar(this.playerScale * 1.12);
      this.frame.positions[this.glisse.id] = p;
      this.onActorMoved?.(this.glisse.id, p);
    } else {
      this.ballon.position.copy(this.positionBallon(p));
      this.frame.ballon = p;
      this.onBallMoved?.(p);
    }
  }

  lacher() {
    const g = this.glisse;
    this.glisse = null;
    if (g?.type === 'acteur') this.acteurs.get(g.id)?.root.scale.setScalar(this.playerScale);
    if (g?.type === 'ballon' && this.frame) this.onBallDropped?.(this.frame.ballon);
  }

  // MARK: Libération (contexte WebGL rendu au navigateur)

  liberer(objet) {
    objet.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) {
        if (m.map && !this.ressources.has(m.map)) m.map.dispose();
        m.dispose();
      }
    });
  }

  detruire() {
    this.arreter();
    this.observateur.disconnect();
    this.liberer(this.scene);
    for (const r of this.ressources) r.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.acteurs.clear();
  }
}

/** Ballon aux pieds d'un joueur (pour les écrans 2D) */
export const ballonAuxPieds = (p, camp) => {
  const [dx, dy] = decalageBallon(camp);
  return [p[0] + dx, p[1] + dy];
};
