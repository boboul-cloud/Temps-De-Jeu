// Atelier — logique pure de l'éditeur (port d'AtelierEditorModel.swift, AtelierShortcuts.swift,
// AtelierViewport et AtelierPlayback). Aucune dépendance au DOM : testable sous Node.
//
// Principe des vignettes : la vignette 0 (« Départ ») est la mise en place, elle contient la
// position de chaque joueur. Une vignette suivante ne garde que ce qui change : un joueur que
// l'on n'a pas bougé suit la vignette d'avant.
//
// Les exercices restent au format fichier (.tdjt) : clés françaises, points [x, y] normalisés
// (x = largeur, 0 = touche gauche ; y = longueur, 0 = but attaqué).
import * as M from '../../model.js';

export const LARGEUR_TERRAIN = 68;   // mètres (x)
export const LONGUEUR_TERRAIN = 105; // mètres (y)

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const interpoler = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Reste sur le terrain (avec 3 m de marge autour des lignes) — TacticPoint.clamped */
export const borner = (p) => [Math.min(1.04, Math.max(-0.04, p[0])), Math.min(1.03, Math.max(-0.03, p[1]))];

/** Arrondi « au plus proche, loin de zéro » (Double.rounded()) */
const arrondi = (v) => Math.sign(v) * Math.round(Math.abs(v));

// MARK: - Fenêtre d'affichage (AtelierViewport)

/**
 * Relie les coordonnées du terrain (normalisées 0…1) aux points écran.
 * Portrait : but attaqué en haut. Pivoté : but attaqué à droite.
 */
export class Vue {
  constructor(cadrage, largeur, hauteur, { marge = 6, rotation = true } = {}) {
    this.largeur = largeur;
    this.hauteur = hauteur;
    const bord = 2;
    this.fx = cadrage.x * LARGEUR_TERRAIN - bord;
    this.fy = cadrage.y * LONGUEUR_TERRAIN - bord;
    this.fw = cadrage.largeur * LARGEUR_TERRAIN + 2 * bord;
    this.fh = cadrage.longueur * LONGUEUR_TERRAIN + 2 * bord;
    const w = Math.max(1, largeur - 2 * marge);
    const h = Math.max(1, hauteur - 2 * marge);
    const portrait = Math.min(w / this.fw, h / this.fh);
    const tourne = Math.min(w / this.fh, h / this.fw);
    this.tourne = rotation && tourne > portrait * 1.08;
    this.echelle = this.tourne ? tourne : portrait;
    const lc = (this.tourne ? this.fh : this.fw) * this.echelle;
    const hc = (this.tourne ? this.fw : this.fh) * this.echelle;
    this.ox = (largeur - lc) / 2;
    this.oy = (hauteur - hc) / 2;
  }

  /** Mètres → écran */
  ecranMetres(mx, my) {
    if (this.tourne) return [this.ox + (this.fy + this.fh - my) * this.echelle, this.oy + (mx - this.fx) * this.echelle];
    return [this.ox + (mx - this.fx) * this.echelle, this.oy + (my - this.fy) * this.echelle];
  }

  /** Point normalisé → écran */
  ecran(p) { return this.ecranMetres(p[0] * LARGEUR_TERRAIN, p[1] * LONGUEUR_TERRAIN); }

  /** Écran → point normalisé */
  terrain([sx, sy]) {
    let mx; let my;
    if (this.tourne) {
      my = this.fy + this.fh - (sx - this.ox) / this.echelle;
      mx = this.fx + (sy - this.oy) / this.echelle;
    } else {
      mx = this.fx + (sx - this.ox) / this.echelle;
      my = this.fy + (sy - this.oy) / this.echelle;
    }
    return [mx / LARGEUR_TERRAIN, my / LONGUEUR_TERRAIN];
  }

  /** Angle écran (degrés, sens horaire) d'un objet tourné de `degres` sur le terrain */
  angle(degres) { return degres + (this.tourne ? 90 : 0); }

  points(metres) { return metres * this.echelle; }

  /** Taille d'un joueur à l'écran */
  get diametre() { return Math.min(40, Math.max(26, this.points(1.9))); }

  distanceEcran(a, b) {
    const p = this.ecran(a); const q = this.ecran(b);
    return Math.hypot(p[0] - q[0], p[1] - q[1]);
  }

  /** Rectangle écran couvrant une zone (centre + taille normalisés) : { x, y, l, h } */
  rect(centre, taille) {
    const a = this.ecran([centre[0] - taille[0] / 2, centre[1] - taille[1] / 2]);
    const b = this.ecran([centre[0] + taille[0] / 2, centre[1] + taille[1] / 2]);
    return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), l: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) };
  }
}

/** Taille écran (largeur, profondeur) d'un objet, avec un minimum pour rester visible et touchable */
export function tailleMateriel(type, vue) {
  const m = (metres, minimum) => Math.max(minimum, vue.points(metres));
  switch (type) {
    case 'plot': return [m(0.5, 15), m(0.5, 15)];
    case 'coupelle': return [m(0.45, 14), m(0.45, 14)];
    case 'piquet': return [m(0.25, 11), m(0.25, 11)];
    case 'mannequin': return [m(0.7, 24), m(0.35, 12)];
    case 'mini-but': return [m(2, 26), m(0.8, 10)];
    case 'but': return [m(5, 36), m(1.5, 13)];
    case 'cerceau': return [m(0.8, 20), m(0.8, 20)];
    case 'echelle': return [m(0.5, 10), m(4, 44)];
    case 'haie': return [m(1, 22), m(0.3, 8)];
    case 'ballon': return [m(0.22, 13), m(0.22, 13)];
    default: return [0, 0];
  }
}

export const TAILLE_ZONE_DEFAUT = [0.2, 0.15];

/** « 20 × 15 m » */
export function metresZone(taille) {
  return `${arrondi(taille[0] * LARGEUR_TERRAIN)} × ${arrondi(taille[1] * LONGUEUR_TERRAIN)} m`;
}

/** Poignée d'agrandissement d'une zone (coin bas-droit à l'écran) */
export function poigneeZone(prop, vue) {
  const r = vue.rect(prop.pos, prop.taille ?? TAILLE_ZONE_DEFAUT);
  return [r.x + r.l, r.y + r.h];
}

/** Points utiles d'un exercice (positions, ballons libres, matériel) — AtelierDiagram.contentPoints */
export function pointsContenu(t) {
  const points = [];
  for (const e of t.etapes ?? []) {
    points.push(...Object.values(e.positions ?? {}));
    if (e.ballon) points.push(e.ballon);
    for (const b of Object.values(e.autresBallons ?? {})) if (b.position) points.push(b.position);
  }
  for (const m of t.materiel ?? []) {
    const w = (m.taille?.[0] ?? 0) / 2; const h = (m.taille?.[1] ?? 0) / 2;
    points.push([m.pos[0] - w, m.pos[1] - h], [m.pos[0] + w, m.pos[1] + h]);
  }
  return points;
}

/** Cadrage d'un schéma : celui de l'exercice, sinon ajusté à son contenu */
export const cadrageDe = (t) => t.cadrage ?? M.cadrageAutour(pointsContenu(t));

/** Centre d'un cadrage */
export const centreCadrage = (c) => [c.x + c.largeur / 2, c.y + c.longueur / 2];

export const memeCadrage = (a, b) => a && b && ['x', 'y', 'largeur', 'longueur'].every((k) => Math.abs(a[k] - b[k]) < 1e-9);

// MARK: - Ballons dans un état résolu

/** Le ballon `id` d'un état résolu : { porteur, point } (le premier existe toujours) */
export function ballonDe(frame, id) {
  if (!frame) return null;
  if (id === M.BALLON_PRINCIPAL) return { porteur: frame.porteur, point: frame.ballon };
  return frame.autres?.[id] ?? null;
}

/** La tactique utilise-t-elle un ballon ? (le premier) */
export const aUnBallon = (t) => t.etapes.some((e) => e.porteur != null || e.ballon != null);

/** État d'un ballon dans une étape (copie) : { holder, position, action, aerial } */
function lireEtat(etape, id) {
  if (!etape) return null;
  if (id === M.BALLON_PRINCIPAL) {
    if (etape.porteur == null && etape.ballon == null) return null;
    return { holder: etape.porteur ?? null, position: etape.ballon ? [...etape.ballon] : null, action: etape.action ?? null, aerial: etape.aerien ?? null };
  }
  const b = etape.autresBallons?.[id];
  if (!b) return null;
  return { holder: b.porteur ?? null, position: b.position ? [...b.position] : null, action: b.action ?? null, aerial: b.aerien ?? null };
}

/** Écrit l'état d'un ballon dans une étape (TacticStep.setBallState) ; null ou vide = efface */
function ecrireEtat(etape, id, etat) {
  const vide = !etat || (etat.holder == null && etat.position == null);
  const e = vide ? null : etat;
  if (id === M.BALLON_PRINCIPAL) {
    delete etape.porteur; delete etape.ballon; delete etape.action; delete etape.aerien;
    if (!e) return;
    if (e.holder != null) etape.porteur = e.holder;
    else if (e.position) etape.ballon = [...e.position];
    if (e.action != null) etape.action = e.action;
    if (e.aerial != null) etape.aerien = e.aerial;
    return;
  }
  const balles = { ...(etape.autresBallons ?? {}) };
  if (e) {
    const b = {};
    if (e.holder != null) b.porteur = e.holder;
    if (e.position) b.position = [...e.position];
    if (e.action != null) b.action = e.action;
    if (e.aerial != null) b.aerien = e.aerial;
    balles[id] = b;
  } else {
    delete balles[id];
  }
  if (Object.keys(balles).length) etape.autresBallons = balles;
  else delete etape.autresBallons;
}

// MARK: - Effectif

/** « 4 rouges · 2 bleus · 1 gardien » (AtelierEditorModel.headcount) */
export function effectif(acteurs) {
  if (!acteurs?.length) return null;
  const parts = [];
  for (const c of M.IDS_COULEURS_ATELIER) {
    const n = acteurs.filter((a) => !M.estGardien(a) && M.chasubleDe(a) === c).length;
    if (n > 0) parts.push(`${n} ${M.adjectifCouleur(c, false, n > 1)}`);
  }
  const gardiens = acteurs.filter(M.estGardien).length;
  if (gardiens > 0) parts.push(`${gardiens} gardien${gardiens > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

const dateCourte = (d = new Date()) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);

/** Nouvel exercice vide (AtelierEditorModel.newExercise) */
export function nouvelExercice() {
  return M.lireTactique({
    id: M.uuid(), titre: `Exercice du ${dateCourte()}`, categorie: 'perso', objectif: '', acteurs: [],
    etapes: [{ titre: 'Mise en place', texte: '', positions: {} }],
    cadrage: { ...M.CADRAGES.centre }, perso: true, creeLe: M.iso(),
  });
}

/** Minutes proposées pour un exercice ajouté à une séance (AtelierPlanView.defaultMinutes) */
export function minutesParDefaut(t) {
  const chiffres = (t.duree ?? '').match(/^\d+/)?.[0];
  const v = chiffres ? Number(chiffres) : 0;
  return v > 0 ? Math.min(90, v) : 15;
}

// MARK: - Outils et sélection

/** Outils du tiroir (AtelierToolItem.all) : outil = 'joueur' | 'gardien' | 'ballon' | 'ligne' | 'prop:<type>' */
export const OUTILS = [
  { id: 'joueur', titre: 'Joueur', outil: 'joueur' },
  { id: 'gardien', titre: 'Gardien', outil: 'gardien' },
  { id: 'ballon', titre: 'Ballon', outil: 'ballon' },
  { id: 'plot', titre: 'Plot', outil: 'prop:plot' },
  { id: 'coupelle', titre: 'Coupelle', outil: 'prop:coupelle' },
  { id: 'piquet', titre: 'Piquet', outil: 'prop:piquet' },
  { id: 'mannequin', titre: 'Mannequin', outil: 'prop:mannequin' },
  { id: 'mini-but', titre: 'Mini-but', outil: 'prop:mini-but' },
  { id: 'but', titre: 'But', outil: 'prop:but' },
  { id: 'zone', titre: 'Zone', outil: 'prop:zone' },
  { id: 'ligne', titre: 'Ligne de plots', outil: 'ligne' },
  { id: 'cerceau', titre: 'Cerceau', outil: 'prop:cerceau' },
  { id: 'echelle', titre: 'Échelle', outil: 'prop:echelle' },
  { id: 'haie', titre: 'Haie', outil: 'prop:haie' },
  { id: 'ballons', titre: 'Ballon posé', outil: 'prop:ballon' },
];

export const typeOutil = (outil) => (outil?.startsWith('prop:') ? outil.slice(5) : null);

/** Types de ballon d'une étape (BallKind) */
export const SORTES_BALLON = [
  { id: 'passe', titre: 'Passe', icone: 'arrow.right' },
  { id: 'centre', titre: 'Centre', icone: 'arrow.up.forward' },
  { id: 'tir', titre: 'Tir', icone: 'scope' },
];

const memeSelection = (a, b) => a && b && a.type === b.type && a.id === b.id && a.index === b.index;
export { memeSelection };

// MARK: - Le modèle de l'éditeur (AtelierEditorModel)

export class ModeleEditeur {
  constructor(tactique, vignetteDepart = 0) {
    const copie = clone(tactique);
    if (!copie.etapes?.length) copie.etapes = [{ titre: 'Mise en place', texte: '', positions: {} }];
    copie.acteurs ??= [];
    copie.materiel ??= [];
    // Exercice venu d'ailleurs (bibliothèque, Placement, fichier) : cadré sur son contenu
    if (!copie.cadrage) {
      const points = pointsContenu(copie);
      copie.cadrage = points.length ? M.cadrageAutour(points, 4, 14) : { ...M.CADRAGES.centre };
    }
    // Date fixée une fois pour toutes : les enregistrements successifs gardent la même
    copie.creeLe ??= M.iso();
    this.play = copie;
    /** null = exercice de base, sinon index de l'évolution affichée */
    this.evolution = null;
    this.vignette = Math.min(Math.max(0, vignetteDepart), Math.max(0, copie.etapes.length - 1));
    this.outil = null;
    this.selection = null;
    this.bibColor = 'rouge';
    this.propColor = 'orange';
    this.grille = false;
    this.pileAnnuler = [];
    this.pileRetablir = [];
    this.modifie = false;
    this.version = 0;
    this.cache = null;
    const premier = copie.acteurs.find((a) => !M.estGardien(a));
    if (premier) this.bibColor = M.chasubleDe(premier);
  }

  get peutAnnuler() { return this.pileAnnuler.length > 0; }
  get peutRetablir() { return this.pileRetablir.length > 0; }

  // MARK: Contenu courant (base ou évolution)

  /** { acteurs, materiel, etapes } de la version affichée (objet vivant, modifiable) */
  get contenu() {
    if (this.evolution != null && this.play.evolutions?.[this.evolution]) return this.play.evolutions[this.evolution];
    return this.play;
  }

  /** Exercice tel qu'affiché (base ou évolution), pour le dessin et la lecture */
  get courant() { return this.calculs().courant; }

  get frames() { return this.calculs().frames; }

  calculs() {
    if (this.cache?.version !== this.version) {
      const courant = M.variante(this.play, this.evolution);
      this.cache = { version: this.version, courant, frames: M.resolvedFrames(courant) };
    }
    return this.cache;
  }

  get cadrage() { return this.play.cadrage ?? M.CADRAGES.centre; }

  get nombreEtapes() { return this.contenu.etapes.length; }

  get frameCourante() {
    const f = this.frames;
    return f[Math.min(this.vignette, f.length - 1)] ?? null;
  }

  get aUnBallon() { return aUnBallon(this.courant); }

  /** Ballons de jeu de la version affichée, le premier d'abord */
  get idsBallons() { return M.idsBallons(this.contenu.etapes); }

  /** Signale un changement du contenu (recalcul des états résolus) */
  touche() { this.version += 1; this.modifie = true; }

  // MARK: Annuler / rétablir

  /** À appeler avant chaque modification (une seule fois par geste) */
  checkpoint() {
    this.pileAnnuler.push({ play: clone(this.play), evolution: this.evolution, vignette: this.vignette });
    if (this.pileAnnuler.length > 150) this.pileAnnuler.shift();
    this.pileRetablir = [];
    this.modifie = true;
  }

  annuler() {
    const dernier = this.pileAnnuler.pop();
    if (!dernier) return;
    this.pileRetablir.push({ play: clone(this.play), evolution: this.evolution, vignette: this.vignette });
    this.restaurer(dernier);
  }

  retablir() {
    const suivant = this.pileRetablir.pop();
    if (!suivant) return;
    this.pileAnnuler.push({ play: clone(this.play), evolution: this.evolution, vignette: this.vignette });
    this.restaurer(suivant);
  }

  restaurer(etat) {
    this.play = etat.play;
    this.evolution = etat.evolution;
    this.touche();
    this.vignette = Math.min(etat.vignette, Math.max(0, this.contenu.etapes.length - 1));
    this.selection = null;
  }

  /** Modifie la version affichée */
  modifier(changement) {
    changement(this.contenu);
    this.touche();
  }

  majInfos(changement) {
    this.checkpoint();
    changement(this.play);
    this.touche();
  }

  // MARK: Cadrage

  setCadrage(cadrage) {
    this.checkpoint();
    this.play.cadrage = { ...cadrage };
    this.touche();
  }

  ajusterCadrage() {
    const points = pointsContenu(this.courant);
    this.setCadrage(points.length ? M.cadrageAutour(points, 4, 14) : M.CADRAGES.centre);
  }

  // MARK: Ajouts

  prochainNumero(couleur) {
    const pris = new Set(this.contenu.acteurs.filter((a) => M.chasubleDe(a) === couleur).map((a) => a.numero));
    let n = 1;
    while (pris.has(String(n))) n += 1;
    return String(n);
  }

  /** Le camp sert à l'orientation du ballon et aux couleurs par défaut en 3D */
  static campDe(couleur) {
    if (couleur === 'bleu') return 'equipe';
    if (couleur === 'jaune' || couleur === 'orange') return 'joker';
    return 'adversaire';
  }

  ajouterJoueur(point, { couleur = null, gardien = false, numero = null, annulable = true } = {}) {
    if (annulable) this.checkpoint();
    const c = couleur ?? (gardien ? 'vert' : this.bibColor);
    const id = `j-${M.uuid().slice(0, 8).toLowerCase()}`;
    const acteur = { id, camp: ModeleEditeur.campDe(c), numero: numero ?? (gardien ? 'G' : this.prochainNumero(c)), chasuble: c };
    if (gardien) acteur.poste = 'Gardien';
    this.modifier((contenu) => {
      contenu.acteurs.push(acteur);
      contenu.etapes[0].positions[id] = borner(point);
    });
    return id;
  }

  ajouterMateriel(type, point, { couleur = null, taille = null, rotation = null, annulable = true } = {}) {
    if (annulable) this.checkpoint();
    const prop = { type, pos: borner(point) };
    if (M.materielAvecCouleur(type)) prop.couleur = couleur ?? this.propColor;
    if (type === 'zone') {
      prop.couleur = couleur ?? 'blanc';
      prop.taille = taille ? [...taille] : [20 / LARGEUR_TERRAIN, 15 / LONGUEUR_TERRAIN];
    }
    if (rotation != null) prop.rotation = rotation;
    let index = 0;
    this.modifier((contenu) => {
      contenu.materiel.push(prop);
      index = contenu.materiel.length - 1;
    });
    return index;
  }

  /** Nombre de plots d'une ligne entre deux points (un plot tous les ~3 m) */
  static plotsLigne(a, b) {
    const metres = Math.hypot((b[0] - a[0]) * LARGEUR_TERRAIN, (b[1] - a[1]) * LONGUEUR_TERRAIN);
    return { metres, nombre: Math.max(2, Math.min(20, arrondi(metres / 3) + 1)) };
  }

  /** Ligne de plots entre deux points */
  ajouterLigne(a, b) {
    const { nombre } = ModeleEditeur.plotsLigne(a, b);
    this.checkpoint();
    for (let i = 0; i < nombre; i++) this.ajouterMateriel('plot', interpoler(a, b, i / (nombre - 1)), { annulable: false });
  }

  /**
   * Ajoute un ballon de jeu sur la mise en place, au pied d'un joueur ou libre.
   * Le premier posé est le ballon principal, les suivants « ballon-2 », « ballon-3 »…
   * Un joueur qui a déjà un ballon au pied n'en reçoit pas un second : son ballon est choisi.
   */
  ajouterBallon(point, porteur) {
    const depart = this.frames[0];
    if (porteur && depart) {
      const existant = this.idsBallons.find((id) => ballonDe(depart, id)?.porteur === porteur);
      if (existant) { this.selection = { type: 'ball', id: existant }; return existant; }
    }
    this.checkpoint();
    const id = this.prochainBallon();
    const etat = porteur ? { holder: porteur } : { position: borner(point) };
    this.modifier((contenu) => ecrireEtat(contenu.etapes[0], id, etat));
    this.selection = { type: 'ball', id };
    return id;
  }

  prochainBallon() {
    const ids = this.idsBallons;
    if (!ids.includes(M.BALLON_PRINCIPAL)) return M.BALLON_PRINCIPAL;
    return `ballon-${Math.max(1, ...ids.map(M.numeroBallon)) + 1}`;
  }

  /** Ballon au pied d'un joueur sur la mise en place, sans point d'annulation (raccourcis) */
  placerBallonSansAnnuler(porteur) {
    this.modifier((contenu) => {
      contenu.etapes[0].porteur = porteur;
      delete contenu.etapes[0].ballon;
    });
  }

  /** Enlève un ballon de toutes les étapes ; si c'est le premier, le suivant prend sa place */
  enleverBallon(id) {
    this.checkpoint();
    const promu = id === M.BALLON_PRINCIPAL ? this.idsBallons[1] ?? null : null;
    this.modifier((contenu) => {
      for (const e of contenu.etapes) {
        if (promu) {
          ecrireEtat(e, M.BALLON_PRINCIPAL, lireEtat(e, promu));
          ecrireEtat(e, promu, null);
        } else {
          ecrireEtat(e, id, null);
        }
      }
    });
    this.selection = null;
  }

  // MARK: Déplacements

  /** Déplace un joueur dans la vignette affichée */
  deplacerJoueur(id, point) {
    const p = borner(point);
    const k = this.vignette;
    const avant = k > 0 ? this.frames[k - 1]?.positions[id] : null;
    this.modifier((contenu) => {
      const e = contenu.etapes[k];
      if (!e) return;
      // Revenu à sa place : il ne bouge pas dans cette vignette
      if (avant && distance(avant, p) < 0.006) delete e.positions[id];
      else e.positions[id] = p;
    });
  }

  /** Le joueur ne bouge pas dans cette vignette (retire son déplacement) */
  annulerDeplacement(id) {
    if (this.vignette <= 0) return;
    this.checkpoint();
    const k = this.vignette;
    this.modifier((contenu) => { delete contenu.etapes[k].positions[id]; });
  }

  joueurDeplace(id) {
    return this.vignette > 0 && this.contenu.etapes[this.vignette]?.positions[id] != null;
  }

  deplacerMateriel(index, point) {
    this.modifier((contenu) => {
      if (contenu.materiel[index]) contenu.materiel[index].pos = borner(point);
    });
  }

  redimensionnerZone(index, coin) {
    this.modifier((contenu) => {
      const m = contenu.materiel[index];
      if (!m) return;
      const minW = 3 / LARGEUR_TERRAIN; const minH = 3 / LONGUEUR_TERRAIN;
      const w = Math.max(minW, Math.abs(coin[0] - m.pos[0]) * 2);
      const h = Math.max(minH, Math.abs(coin[1] - m.pos[1]) * 2);
      m.taille = [Math.min(1, w), Math.min(1, h)];
    });
  }

  /** Ballon lâché dans la vignette affichée : sur un joueur (passe) ou libre (tir près d'un but) */
  lacherBallon(id, point, porteur) {
    const k = this.vignette;
    const avant = k > 0 ? ballonDe(this.frames[k - 1], id) : null;
    this.modifier((contenu) => {
      const e = contenu.etapes[k];
      if (!e) return;
      const etat = lireEtat(e, id) ?? { holder: null, position: null, action: null, aerial: null };
      if (porteur) {
        if (k > 0 && avant?.porteur === porteur) {
          // Rendu au même joueur : pas d'action de ballon dans cette vignette
          ecrireEtat(e, id, null);
          return;
        }
        etat.holder = porteur;
        etat.position = null;
        if (etat.action === 'tir') etat.action = null;
      } else {
        etat.holder = null;
        etat.position = borner(point);
        const devantLeBut = Math.abs(point[0] - 0.5) < 0.07 && (point[1] < 0.02 || point[1] > 0.98);
        if (devantLeBut) { etat.action = 'tir'; etat.aerial = null; }
      }
      ecrireEtat(e, id, etat);
    });
  }

  /** Ce ballon a-t-il changé de place dans cette vignette (hors conduite) ? */
  ballonBougeDansVignette(id) {
    if (this.vignette <= 0) return false;
    return lireEtat(this.contenu.etapes[this.vignette], id) != null;
  }

  sorteBallon(id) {
    const etat = lireEtat(this.contenu.etapes[this.vignette], id);
    if (!etat) return 'passe';
    if (etat.action === 'tir') return 'tir';
    if (etat.aerial === true || etat.action === 'centre') return 'centre';
    return 'passe';
  }

  setSorteBallon(id, sorte) {
    this.checkpoint();
    const k = this.vignette;
    this.modifier((contenu) => {
      const e = contenu.etapes[k];
      const etat = lireEtat(e, id);
      if (!e || !etat) return;
      if (sorte === 'passe') { etat.action = null; etat.aerial = null; }
      if (sorte === 'centre') { etat.action = 'centre'; etat.aerial = true; }
      if (sorte === 'tir') { etat.action = 'tir'; etat.aerial = null; }
      ecrireEtat(e, id, etat);
    });
  }

  /**
   * Bouton « Ballon » d'un joueur. Mise en place : il reçoit un ballon (s'il n'en a pas).
   * Étape suivante : le ballon le plus proche lui est passé.
   */
  donnerBallon(id) {
    if (this.vignette === 0) {
      this.ajouterBallon(this.frames[0]?.positions[id] ?? [0.5, 0.5], id);
      return;
    }
    const frame = this.frameCourante;
    const cible = frame?.positions[id];
    if (!cible) return;
    let plusProche = null; let meilleure = Infinity;
    for (const b of this.idsBallons) {
      const ballon = ballonDe(frame, b);
      if (!ballon || ballon.porteur === id) continue;
      const d = distance(ballon.point, cible);
      if (d < meilleure) { meilleure = d; plusProche = b; }
    }
    if (!plusProche) return;
    this.checkpoint();
    this.lacherBallon(plusProche, cible, id);
    this.selection = { type: 'ball', id: plusProche };
  }

  // MARK: Réglages de l'objet sélectionné

  setCouleur(couleur) {
    const s = this.selection;
    if (s?.type === 'actor') {
      this.bibColor = couleur;
      this.checkpoint();
      this.modifier((contenu) => {
        const a = contenu.acteurs.find((x) => x.id === s.id);
        if (!a) return;
        a.chasuble = couleur;
        if (!M.estGardien(a)) a.camp = ModeleEditeur.campDe(couleur);
      });
    } else if (s?.type === 'prop') {
      this.checkpoint();
      this.modifier((contenu) => { if (contenu.materiel[s.index]) contenu.materiel[s.index].couleur = couleur; });
      if (this.contenu.materiel[s.index]?.type !== 'zone') this.propColor = couleur;
    } else if (this.outil === 'joueur') {
      this.bibColor = couleur;
    } else {
      this.propColor = couleur;
    }
  }

  setNumero(id, numero) {
    this.checkpoint();
    const t = [...numero.trim()].slice(0, 3).join('');
    this.modifier((contenu) => { const a = contenu.acteurs.find((x) => x.id === id); if (a) a.numero = t; });
  }

  basculerGardien(id) {
    this.checkpoint();
    this.modifier((contenu) => {
      const a = contenu.acteurs.find((x) => x.id === id);
      if (!a) return;
      if (M.estGardien(a)) delete a.poste; else a.poste = 'Gardien';
    });
  }

  tournerSelection(degres) {
    const s = this.selection;
    if (s?.type !== 'prop') return;
    this.checkpoint();
    this.modifier((contenu) => {
      const m = contenu.materiel[s.index];
      if (!m) return;
      let angle = ((m.rotation ?? 0) + degres) % 360;
      if (angle < 0) angle += 360;
      m.rotation = angle;
    });
  }

  dupliquerSelection() {
    const decalage = [2.5 / LARGEUR_TERRAIN, 2.5 / LONGUEUR_TERRAIN];
    const s = this.selection;
    if (s?.type === 'actor') {
      const a = this.contenu.acteurs.find((x) => x.id === s.id);
      const p = this.frames[0]?.positions[s.id];
      if (!a || !p) return;
      const id = this.ajouterJoueur([p[0] + decalage[0], p[1] + decalage[1]], { couleur: M.chasubleDe(a), gardien: M.estGardien(a) });
      this.selection = { type: 'actor', id };
    } else if (s?.type === 'prop') {
      const m = this.contenu.materiel[s.index];
      if (!m) return;
      const index = this.ajouterMateriel(m.type, [m.pos[0] + decalage[0], m.pos[1] + decalage[1]], {
        couleur: M.couleurMateriel(m), taille: m.taille ?? null, rotation: m.rotation ?? null,
      });
      this.selection = { type: 'prop', index };
    }
  }

  supprimerSelection() {
    const s = this.selection;
    if (s?.type === 'actor') this.supprimerJoueur(s.id);
    else if (s?.type === 'prop') {
      this.checkpoint();
      this.modifier((contenu) => { if (contenu.materiel[s.index]) contenu.materiel.splice(s.index, 1); });
    } else if (s?.type === 'ball') this.enleverBallon(s.id);
    this.selection = null;
  }

  supprimerJoueur(id) {
    this.checkpoint();
    const resolus = this.frames;
    const balles = this.idsBallons;
    this.modifier((contenu) => {
      contenu.acteurs = contenu.acteurs.filter((a) => a.id !== id);
      contenu.etapes.forEach((e, i) => {
        delete e.positions[id];
        if (e.focus) e.focus = e.focus.filter((x) => x !== id);
        // Ses ballons restent là où il les avait
        for (const b of balles) {
          const etat = lireEtat(e, b);
          if (!etat || etat.holder !== id) continue;
          etat.holder = null;
          etat.position = ballonDe(resolus[i], b)?.point ?? null;
          ecrireEtat(e, b, etat);
        }
      });
    });
  }

  toutEnlever() {
    this.checkpoint();
    this.modifier((contenu) => {
      contenu.acteurs = [];
      contenu.materiel = [];
      contenu.etapes = [{ titre: 'Mise en place', texte: '', positions: {} }];
    });
    this.vignette = 0;
    this.selection = null;
  }

  // MARK: Vignettes

  ajouterVignette() {
    this.checkpoint();
    this.modifier((contenu) => contenu.etapes.push({ titre: '', texte: '', positions: {} }));
    this.vignette = this.contenu.etapes.length - 1;
    this.selection = null;
  }

  supprimerVignette(index) {
    if (index <= 0) return;
    this.checkpoint();
    this.modifier((contenu) => { if (contenu.etapes[index]) contenu.etapes.splice(index, 1); });
    this.vignette = Math.min(this.vignette, this.contenu.etapes.length - 1);
    this.selection = null;
  }

  majEtape(index, { titre, texte, duree } = {}) {
    this.checkpoint();
    this.modifier((contenu) => {
      const e = contenu.etapes[index];
      if (!e) return;
      if (titre != null) e.titre = titre;
      if (texte != null) e.texte = texte;
      if (duree != null) e.duree = duree;
    });
  }

  // MARK: Évolutions

  choisirEvolution(index) {
    this.evolution = index;
    this.vignette = 0;
    this.selection = null;
    this.version += 1;
  }

  /** Nouvelle évolution : copie de ce qui est affiché, à modifier ensuite */
  ajouterEvolution() {
    this.checkpoint();
    const numero = (this.play.evolutions?.length ?? 0) + 1;
    const c = this.contenu;
    const evo = { id: M.uuid(), titre: `Évolution ${numero}`, texte: '', acteurs: clone(c.acteurs), materiel: clone(c.materiel), etapes: clone(c.etapes) };
    this.play.evolutions ??= [];
    this.play.evolutions.push(evo);
    this.touche();
    this.choisirEvolution(this.play.evolutions.length - 1);
  }

  renommerEvolution(index, titre, texte) {
    this.checkpoint();
    const evo = this.play.evolutions?.[index];
    if (!evo) return;
    const t = titre.trim();
    evo.titre = t === '' ? `Évolution ${index + 1}` : t;
    evo.texte = texte;
    this.touche();
  }

  supprimerEvolution(index) {
    this.checkpoint();
    if (!this.play.evolutions?.[index]) return;
    this.play.evolutions.splice(index, 1);
    if (!this.play.evolutions.length) delete this.play.evolutions;
    this.touche();
    this.choisirEvolution(null);
  }

  // MARK: Raccourcis

  /** Applique un raccourci centré sur le cadrage, puis recadre sur l'exercice */
  appliquer(raccourci) {
    this.checkpoint();
    appliquerRaccourci(raccourci, this, centreCadrage(this.cadrage));
    const points = pointsContenu(this.courant);
    if (points.length) this.play.cadrage = M.cadrageAutour(points, 4, 14);
    this.touche();
  }

  // MARK: Enregistrement

  /** Exercice prêt à enregistrer (effectif calculé, étapes nommées) */
  finalise() {
    const r = clone(this.play);
    r.perso = true;
    r.creeLe ??= M.iso();
    if (r.categorie === 'autre') r.categorie = 'perso';
    if (r.etapes[0] && r.etapes[0].titre === '') r.etapes[0].titre = 'Mise en place';
    const e = effectif(r.acteurs);
    if (e) r.effectif = e; else delete r.effectif;
    return r;
  }

  get estVide() {
    return !this.play.acteurs.length && !this.play.materiel.length && !(this.play.evolutions?.length);
  }

  /** Empreinte du contenu (pour savoir s'il a changé depuis le dernier enregistrement) */
  empreinte() { return JSON.stringify(M.ecrireTactique(this.play)); }
}

// MARK: - Raccourcis (AtelierShortcuts.swift)

const CARRES = [[10, 10], [15, 15], [20, 20], [30, 20], [40, 30]];

export const RACCOURCIS = {
  carres: CARRES.map(([w, l]) => ({ id: `carre-${w}-${l}`, sorte: 'carre', w, l, titre: `Carré ${w} × ${l} m`, icone: 'square.dashed' })),
  jeux: [
    { sorte: 'rondo', dehors: 4, dedans: 2 }, { sorte: 'rondo', dehors: 5, dedans: 2 },
    { sorte: 'jeu', n: 3, jokers: 0 }, { sorte: 'jeu', n: 4, jokers: 0 }, { sorte: 'jeu', n: 4, jokers: 2 },
    { sorte: 'jeu', n: 5, jokers: 0 }, { sorte: 'jeu', n: 6, jokers: 0 }, { sorte: 'jeu', n: 8, jokers: 0 },
  ].map((r) => (r.sorte === 'rondo'
    ? { ...r, id: `rondo-${r.dehors}-${r.dedans}`, titre: `Rondo ${r.dehors} contre ${r.dedans}`, icone: 'circle.hexagongrid' }
    : { ...r, id: `jeu-${r.n}-${r.jokers}`, titre: r.jokers > 0 ? `${r.n} contre ${r.n} + ${r.jokers} jokers` : `Jeu ${r.n} contre ${r.n}`, icone: 'person.3.sequence' })),
  parcours: [
    { id: 'slalom-6', sorte: 'slalom', piquets: 6, titre: 'Slalom (6 piquets)', icone: 'point.topleft.down.to.point.bottomright.curvepath' },
    { id: 'ligne-6', sorte: 'ligne', nombre: 6, titre: 'Ligne de 6 plots', icone: 'ellipsis' },
    { id: 'echelle-haies', sorte: 'echelleHaies', titre: 'Échelle + 3 haies', icone: 'figure.run' },
    { id: 'cerceaux-6', sorte: 'cerceaux', nombre: 6, titre: '6 cerceaux en zigzag', icone: 'circle.circle' },
    { id: 'mini-buts', sorte: 'miniButs', titre: '2 mini-buts face à face', icone: 'sportscourt' },
  ],
};

export const tousLesRaccourcis = () => [...RACCOURCIS.carres, ...RACCOURCIS.jeux, ...RACCOURCIS.parcours];

/** Répartit n joueurs sur quelques lignes (mètres : dx, profondeur depuis la ligne médiane) */
export function repartir(n, largeur, profondeur) {
  if (n <= 0) return [];
  const lignes = { 1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [3, 4] }[n] ?? [3, 3, n - 6];
  const res = [];
  lignes.forEach((nombre, r) => {
    const dy = lignes.length === 1 ? profondeur / 2 : profondeur * r / (lignes.length - 1);
    for (let i = 0; i < nombre; i++) {
      const dx = nombre === 1 ? 0 : -largeur / 2 + largeur * i / (nombre - 1);
      res.push([dx, dy]);
    }
  });
  return res;
}

/** Construit le raccourci autour de `centre` (en mètres), sans point d'annulation */
export function appliquerRaccourci(r, modele, centre) {
  const a = (dx, dy) => [centre[0] + dx / LARGEUR_TERRAIN, centre[1] + dy / LONGUEUR_TERRAIN];
  const taille = (w, l) => [w / LARGEUR_TERRAIN, l / LONGUEUR_TERRAIN];
  const sans = { annulable: false };
  const coins = (w, l) => {
    modele.ajouterMateriel('zone', a(0, 0), { couleur: 'blanc', taille: taille(w, l), ...sans });
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) modele.ajouterMateriel('plot', a(sx * w / 2, sy * l / 2), sans);
  };
  const equipeA = modele.bibColor;
  const equipeB = ['bleu', 'rouge', 'vert'].find((c) => c !== equipeA) ?? 'bleu';
  const couleurJoker = ['jaune', 'orange'].find((c) => c !== equipeA && c !== equipeB) ?? 'jaune';
  const accrocherBallon = (id) => { if (id && !modele.aUnBallon) modele.placerBallonSansAnnuler(id); };

  switch (r.sorte) {
    case 'carre':
      coins(r.w, r.l);
      break;
    case 'rondo': {
      const cote = r.dehors <= 4 ? 10 : 12;
      coins(cote, cote);
      let premier = null;
      for (let i = 0; i < r.dehors; i++) {
        // Joueurs répartis sur le pourtour, en commençant en bas
        const angle = Math.PI / 2 + 2 * Math.PI * i / r.dehors;
        const rayon = cote / 2;
        const dx = Math.max(-rayon, Math.min(rayon, Math.cos(angle) * rayon * 1.45));
        const dy = Math.max(-rayon, Math.min(rayon, Math.sin(angle) * rayon * 1.45));
        const id = modele.ajouterJoueur(a(dx, dy), { couleur: equipeA, ...sans });
        premier ??= id;
      }
      for (let i = 0; i < r.dedans; i++) {
        const dx = r.dedans === 1 ? 0 : (i - (r.dedans - 1) / 2) * 3;
        modele.ajouterJoueur(a(dx, -0.5), { couleur: equipeB, ...sans });
      }
      accrocherBallon(premier);
      break;
    }
    case 'jeu': {
      const [w, l] = r.n <= 3 ? [20, 25] : r.n === 4 ? [25, 30] : r.n === 5 ? [30, 35] : r.n === 6 ? [30, 40] : [40, 50];
      coins(w, l);
      modele.ajouterMateriel('mini-but', a(0, -l / 2 - 0.5), { rotation: 0, ...sans });
      modele.ajouterMateriel('mini-but', a(0, l / 2 + 0.5), { rotation: 180, ...sans });
      let premier = null;
      for (const [couleur, signe] of [[equipeA, 1], [equipeB, -1]]) {
        repartir(r.n, w * 0.75, l * 0.32).forEach(([dx, dy], i) => {
          // Équipe A en bas (attaque vers le haut), équipe B en haut
          const id = modele.ajouterJoueur(a(dx * signe, signe * (l * 0.08 + dy)), { couleur, ...sans });
          if (couleur === equipeA && i === 0) premier = id;
        });
      }
      for (let j = 0; j < r.jokers; j++) {
        const dx = (j % 2 === 0 ? -1 : 1) * (w / 2 + 1.5);
        modele.ajouterJoueur(a(dx, 0), { couleur: couleurJoker, ...sans });
      }
      accrocherBallon(premier);
      break;
    }
    case 'slalom': {
      const ecart = 2;
      const total = (r.piquets - 1) * ecart;
      modele.ajouterMateriel('plot', a(0, total / 2 + 3), sans);
      for (let i = 0; i < r.piquets; i++) modele.ajouterMateriel('piquet', a(0, total / 2 - i * ecart), sans);
      break;
    }
    case 'ligne': {
      const ecart = 3;
      const total = (r.nombre - 1) * ecart;
      for (let i = 0; i < r.nombre; i++) modele.ajouterMateriel('plot', a(-total / 2 + i * ecart, 0), sans);
      break;
    }
    case 'echelleHaies':
      modele.ajouterMateriel('plot', a(0, 6), sans);
      modele.ajouterMateriel('echelle', a(0, 2), sans);
      for (let i = 0; i < 3; i++) modele.ajouterMateriel('haie', a(0, -1.5 - i * 1.5), sans);
      break;
    case 'miniButs':
      modele.ajouterMateriel('mini-but', a(0, -10), { rotation: 0, ...sans });
      modele.ajouterMateriel('mini-but', a(0, 10), { rotation: 180, ...sans });
      break;
    case 'cerceaux':
      for (let i = 0; i < r.nombre; i++) modele.ajouterMateriel('cerceau', a(i % 2 === 0 ? -0.6 : 0.6, 4 - i * 1.1), sans);
      break;
    default:
      break;
  }
}

// MARK: - Aperçu animé (AtelierPlayback)

export const PAUSE_DEPART = 0.4;
export const PAUSE_ETAPE = 0.6;

/** Étape en cours et avancement (0…1) à `ecoule` secondes ; null quand l'aperçu est fini */
export function positionLecture(t, ecoule) {
  const durees = t.etapes.map((e) => e.duree ?? 2.0);
  let e = ecoule - PAUSE_DEPART;
  if (e < 0) return [0, 1];
  for (let i = 1; i < Math.max(1, durees.length); i++) {
    const d = Math.max(0.3, durees[i]);
    if (e < d) return [i, e / d];
    e -= d;
    if (e < PAUSE_ETAPE) return [i, 1];
    e -= PAUSE_ETAPE;
  }
  return null;
}

export const adoucir = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
