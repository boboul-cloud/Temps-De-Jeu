// Atelier — dessin du terrain vu de dessus (port d'AtelierRenderer et d'AtelierDiagram,
// AtelierCanvas.swift) : terrain, matériel, joueurs, ballons, flèches, sur un canvas 2D.
//
// Contrat (utilisé aussi par la bibliothèque, les séances et les fiches PDF) :
//   diagrammeHTML(tactique, { etape, toutesFleches, rotation, classe, cle }) → élément <canvas> à insérer
//   dessinerDiagramme(canvas, tactique, { etape, toutesFleches, rotation, largeur, hauteur, echelle })
import { h, definirMontage } from '../../ui.js';
import * as M from '../../model.js';
import {
  Vue, LARGEUR_TERRAIN as W, LONGUEUR_TERRAIN as L, tailleMateriel, metresZone, poigneeZone, TAILLE_ZONE_DEFAUT,
  cadrageDe, ballonDe,
} from './editeur-modele.js';

export const HERBE_FONCEE = 'rgb(41,133,61)';   // (0.16, 0.52, 0.24)
export const HERBE_CLAIRE = 'rgb(48,148,69)';   // (0.19, 0.58, 0.27)
const LIGNES = 'rgba(255,255,255,0.85)';
const POLICE_RONDE = 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';

/** Couleur d'accent (sélection) : la teinte de l'interface */
let accent = '#007AFF';
export function majAccent(element) {
  try {
    const v = getComputedStyle(element).getPropertyValue('--teinte').trim();
    if (v) accent = v;
  } catch { /* hors navigateur */ }
}

const couleurCss = (id) => M.couleurAtelier(id)?.css ?? 'rgb(247,247,247)';
const texteSur = (id) => (M.couleurAtelierClaire(id) ? '#000' : '#fff');

function ellipse(ctx, x, y, l, h) {
  ctx.beginPath();
  ctx.ellipse(x + l / 2, y + h / 2, Math.abs(l / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
}

// MARK: - Terrain

export function dessinerTerrain(ctx, vue, { grille = false } = {}) {
  const poly = (pts, fermer = false) => {
    pts.forEach(([mx, my], i) => {
      const [x, y] = vue.ecranMetres(mx, my);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (fermer) ctx.closePath();
  };
  const arc = (cx, cy, r, a0, a1) => {
    const n = 40;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    poly(pts);
  };

  // Herbe (au-delà des lignes) puis bandes de tonte
  ctx.fillStyle = HERBE_FONCEE;
  ctx.fillRect(0, 0, vue.largeur, vue.hauteur);
  const bandes = 18;
  ctx.fillStyle = HERBE_CLAIRE;
  for (let i = 0; i < bandes; i += 2) {
    const y0 = L * i / bandes; const y1 = L * (i + 1) / bandes;
    ctx.beginPath();
    poly([[-4, y0], [W + 4, y0], [W + 4, y1], [-4, y1]], true);
    ctx.fill();
  }

  if (grille) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 5) poly([[x, 0], [x, L]]);
    for (let y = 0; y <= L; y += 5) poly([[0, y], [W, y]]);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  const lw = Math.max(1.2, Math.min(2.2, vue.points(0.12)));
  ctx.beginPath();
  poly([[0, 0], [W, 0], [W, L], [0, L]], true);
  poly([[0, L / 2], [W, L / 2]]);
  arc(W / 2, L / 2, 9.15, 0, 360);
  for (const [butY, sens] of [[0, 1], [L, -1]]) {
    // Surface de réparation, surface de but, arc et but
    poly([[13.84, butY], [13.84, butY + sens * 16.5], [54.16, butY + sens * 16.5], [54.16, butY]]);
    poly([[24.84, butY], [24.84, butY + sens * 5.5], [43.16, butY + sens * 5.5], [43.16, butY]]);
    const pointY = butY + sens * 11;
    const debut = sens > 0 ? 37 : 217;
    arc(W / 2, pointY, 9.15, debut, debut + 106);
    poly([[30.34, butY], [30.34, butY - sens * 2], [37.66, butY - sens * 2], [37.66, butY]]);
  }
  for (const [cx, cy, a0] of [[0, 0, 0], [W, 0, 90], [W, L, 180], [0, L, 270]]) arc(cx, cy, 1, a0, a0 + 90);
  ctx.strokeStyle = LIGNES;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.fillStyle = LIGNES;
  for (const [sx, sy] of [[W / 2, L / 2], [W / 2, 11], [W / 2, L - 11]]) {
    const [x, y] = vue.ecranMetres(sx, sy);
    ellipse(ctx, x - lw * 1.4, y - lw * 1.4, lw * 2.8, lw * 2.8);
    ctx.fill();
  }
}

// MARK: - Matériel

/** Dessine un objet ; `selectionne` ajoute l'anneau (ou la poignée d'une zone) */
export function dessinerMateriel(ctx, vue, prop, { selectionne = false } = {}) {
  const couleur = couleurCss(M.couleurMateriel(prop));
  const centre = vue.ecran(prop.pos);

  if (prop.type === 'zone') {
    const taille = prop.taille ?? TAILLE_ZONE_DEFAUT;
    const r = vue.rect(prop.pos, taille);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = couleur;
    ctx.fillRect(r.x, r.y, r.l, r.h);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(r.x, r.y, r.l, r.h);
    ctx.restore();
    if (selectionne) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x - 3, r.y - 3, r.l + 6, r.h + 6);
      const [px, py] = poigneeZone(prop, vue);
      ellipse(ctx, px - 11, py - 11, 22, 22);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Dimensions dans le coin haut-gauche (à l'écart des joueurs placés au milieu des côtés)
    if (r.l > 50 && r.h > 24) {
      ctx.font = `bold 10px ${POLICE_RONDE}`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(metresZone(taille), r.x + 12, r.y + 7);
    }
    return;
  }

  const [w, h] = tailleMateriel(prop.type, vue);
  const ombre = 'rgba(0,0,0,0.25)';
  ctx.save();
  ctx.translate(centre[0], centre[1]);
  ctx.rotate(vue.angle(prop.rotation ?? 0) * Math.PI / 180);
  ctx.setLineDash([]);
  switch (prop.type) {
    case 'plot': {
      const tri = (dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(dx, -h * 0.55 + dy);
        ctx.lineTo(w * 0.5 + dx, h * 0.42 + dy);
        ctx.lineTo(-w * 0.5 + dx, h * 0.42 + dy);
        ctx.closePath();
      };
      tri(1, 1.5); ctx.fillStyle = ombre; ctx.fill();
      tri(0, 0); ctx.fillStyle = couleur; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
      break;
    }
    case 'coupelle':
      ellipse(ctx, -w / 2 + 1, -h / 2 + 1.2, w, h); ctx.fillStyle = ombre; ctx.fill();
      ellipse(ctx, -w / 2, -h / 2, w, h); ctx.fillStyle = couleur; ctx.fill();
      ellipse(ctx, -w / 2 + w * 0.32, -h / 2 + h * 0.32, w * 0.36, h * 0.36); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      break;
    case 'piquet':
      ellipse(ctx, -w / 2 + 1.5, -h / 2 + 2, w, h); ctx.fillStyle = ombre; ctx.fill();
      ellipse(ctx, -w / 2, -h / 2, w, h); ctx.fillStyle = couleur; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      ellipse(ctx, -w / 2 + w * 0.3, -h / 2 + h * 0.3, w * 0.4, h * 0.4); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
      break;
    case 'mannequin': {
      const corps = (dx, dy) => { ctx.beginPath(); ctx.roundRect(-w / 2 + dx, -h / 2 + dy, w, h, h / 2); };
      corps(1, 1.5); ctx.fillStyle = ombre; ctx.fill();
      corps(0, 0); ctx.fillStyle = couleur; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ellipse(ctx, -h * 0.3, -h * 0.3, h * 0.6, h * 0.6); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      break;
    }
    case 'mini-but':
    case 'but': {
      // Barre en bas (ouverture vers le bas quand rotation = 0), filet vers le haut
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      const pas = Math.max(4, w / 8);
      for (let x = -w / 2; x <= w / 2 + 1e-6; x += pas) { ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); }
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
      break;
    }
    case 'cerceau':
      ellipse(ctx, -w / 2 + 1, -h / 2 + 1.2, w, h); ctx.strokeStyle = ombre; ctx.lineWidth = 3; ctx.stroke();
      ellipse(ctx, -w / 2, -h / 2, w, h); ctx.strokeStyle = couleur; ctx.lineWidth = Math.max(2.5, w * 0.1); ctx.stroke();
      break;
    case 'echelle': {
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2);
      ctx.moveTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2);
      const barreaux = 9;
      for (let i = 0; i < barreaux; i++) {
        const y = -h / 2 + h * i / (barreaux - 1);
        ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y);
      }
      ctx.strokeStyle = couleur; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
      break;
    }
    case 'haie': {
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(-w / 2 + 1, 1.5); ctx.lineTo(w / 2 + 1, 1.5);
      ctx.strokeStyle = ombre; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
      ctx.strokeStyle = couleur; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath();
      for (const x of [-w / 2, w / 2]) { ctx.moveTo(x, -Math.max(4, h)); ctx.lineTo(x, Math.max(4, h)); }
      ctx.lineCap = 'butt'; ctx.lineWidth = 1.6; ctx.stroke();
      break;
    }
    case 'ballon':
      dessinerGlypheBallon(ctx, [0, 0], w);
      break;
    default:
      break;
  }
  if (selectionne) {
    const r = Math.max(w, h) / 2 + 6;
    ellipse(ctx, -r, -r, r * 2, r * 2);
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.stroke();
  }
  ctx.restore();
}

// MARK: - Joueurs et ballon

export function dessinerJoueur(ctx, vue, acteur, point, { selectionne = false, fantome = false, enEvidence = false } = {}) {
  const [cx, cy] = vue.ecran(point);
  const d = vue.diametre;
  const x = cx - d / 2; const y = cy - d / 2;
  const chasuble = M.chasubleDe(acteur);
  const couleur = couleurCss(chasuble);
  ctx.save();
  ctx.setLineDash([]);
  if (fantome) {
    const i = d * 0.12;
    ellipse(ctx, x + i, y + i, d - 2 * i, d - 2 * i);
    ctx.globalAlpha = 0.32; ctx.fillStyle = couleur; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke();
    ctx.restore();
    return;
  }
  if (enEvidence) {
    ellipse(ctx, x - 5, y - 5, d + 10, d + 10);
    ctx.strokeStyle = 'rgb(255,204,0)'; ctx.lineWidth = 3; ctx.stroke();
  }
  ellipse(ctx, x + 1.2, y + 2, d, d); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  ellipse(ctx, x, y, d, d); ctx.fillStyle = couleur; ctx.fill();
  ctx.strokeStyle = M.couleurAtelierClaire(chasuble) ? 'rgba(0,0,0,0.55)' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
  if (M.estGardien(acteur)) {
    ellipse(ctx, x + 3.5, y + 3.5, d - 7, d - 7);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = texteSur(chasuble); ctx.lineWidth = 1.2; ctx.setLineDash([2.5, 2]); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
  const libelle = M.estGardien(acteur) && !acteur.numero ? 'G' : (acteur.numero ?? '');
  if (libelle) {
    ctx.font = `800 ${d * ([...libelle].length > 2 ? 0.32 : 0.44)}px ${POLICE_RONDE}`;
    ctx.fillStyle = texteSur(chasuble);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(libelle, cx, cy + d * 0.02);
  }
  if (selectionne) {
    ellipse(ctx, x - 4, y - 4, d + 8, d + 8);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
}

/** Position écran d'un ballon : au pied du porteur, sinon à sa place */
export function pointEcranBallon(frame, vue, id = M.BALLON_PRINCIPAL) {
  const b = ballonDe(frame, id);
  if (!b) return [0, 0];
  if (b.porteur != null && frame.positions[b.porteur]) {
    const [x, y] = vue.ecran(frame.positions[b.porteur]);
    const d = vue.diametre;
    return [x + d * 0.45, y + d * 0.38];
  }
  return vue.ecran(b.point);
}

export function dessinerBallon(ctx, point, { selectionne = false } = {}) {
  dessinerGlypheBallon(ctx, point, 17);
  if (selectionne) {
    ellipse(ctx, point[0] - 14, point[1] - 14, 28, 28);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.stroke();
  }
}

// Motif du ballon (SF Symbol « soccerball »), dessiné dans un carré de 24
const MOTIF_PENTAGONE = typeof Path2D !== 'undefined' ? new Path2D('M12 7.2l3.3 2.4-1.3 3.9h-4l-1.3-3.9z') : null;
const MOTIF_COUTURES = typeof Path2D !== 'undefined' ? new Path2D('M12 2.5v4.7M15.3 9.6l4.5-1.5M14 13.5l2.8 3.8M10 13.5l-2.8 3.8M8.7 9.6 4.2 8.1') : null;

export function dessinerGlypheBallon(ctx, [x, y], d) {
  ctx.save();
  ctx.setLineDash([]);
  ellipse(ctx, x - d / 2 + 1, y - d / 2 + 1.5, d, d); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  ellipse(ctx, x - d / 2, y - d / 2, d, d); ctx.fillStyle = '#fff'; ctx.fill();
  const s = d / 24;
  ctx.translate(x - d / 2, y - d / 2);
  ctx.scale(s, s);
  ctx.beginPath(); ctx.arc(12, 12, 9.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  if (MOTIF_PENTAGONE) {
    ctx.fillStyle = '#000'; ctx.fill(MOTIF_PENTAGONE);
    ctx.lineCap = 'round'; ctx.stroke(MOTIF_COUTURES);
  }
  ctx.restore();
}

// MARK: - Flèches

export function couleurFleche(f) {
  switch (f.type) {
    case 'passe': return [255, 219, 26];
    case 'conduite': return [255, 140, 26];
    case 'tir': return [255, 64, 64];
    default: return [255, 255, 255];
  }
}

export function dessinerFleche(ctx, vue, f, { rogneDebut = 0, rogneFin = 0, opacite = 1 } = {}) {
  let a = vue.ecran(f.de); let b = vue.ecran(f.a);
  const longueur = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!(longueur > rogneDebut + rogneFin + 6)) return;
  const ux = (b[0] - a[0]) / longueur; const uy = (b[1] - a[1]) / longueur;
  a = [a[0] + ux * rogneDebut, a[1] + uy * rogneDebut];
  b = [b[0] - ux * rogneFin, b[1] - uy * rogneFin];
  const [r, g, bl] = couleurFleche(f);
  const couleur = `rgba(${r},${g},${bl},${opacite})`;
  let tangente = [ux, uy];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const trace = () => {
    ctx.beginPath();
    if (f.type === 'conduite') {
      const n = Math.max(12, Math.trunc(len / 3));
      const vagues = Math.max(2, Math.trunc(len / 16));
      ctx.moveTo(a[0], a[1]);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const amp = 4 * Math.sin(t * Math.PI);   // s'aplatit aux extrémités
        const off = Math.sin(t * vagues * 2 * Math.PI) * amp;
        ctx.lineTo(a[0] + (b[0] - a[0]) * t - uy * off, a[1] + (b[1] - a[1]) * t + ux * off);
      }
    } else if (f.type === 'passe' && f.aerien === true) {
      const bombe = Math.min(60, len * 0.25);
      const c = [(a[0] + b[0]) / 2 + uy * bombe, (a[1] + b[1]) / 2 - ux * bombe];
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
      const tx = b[0] - c[0]; const ty = b[1] - c[1];
      const tl = Math.max(0.001, Math.hypot(tx, ty));
      tangente = [tx / tl, ty / tl];
    } else {
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
  };
  const epaisseur = f.type === 'tir' ? 3.2 : 2.4;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(f.type === 'course' ? [7, 5] : []);
  trace();
  ctx.strokeStyle = `rgba(0,0,0,${0.3 * opacite})`;
  ctx.lineWidth = epaisseur + 2;
  ctx.stroke();
  ctx.strokeStyle = couleur;
  ctx.lineWidth = epaisseur;
  ctx.stroke();
  const tete = f.type === 'tir' ? 12 : 10;
  const [tx, ty] = tangente;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - tx * tete - ty * tete * 0.55, b[1] - ty * tete + tx * tete * 0.55);
  ctx.lineTo(b[0] - tx * tete + ty * tete * 0.55, b[1] - ty * tete - tx * tete * 0.55);
  ctx.closePath();
  ctx.fillStyle = couleur;
  ctx.fill();
  ctx.restore();
}

// MARK: - Schéma statique (vignettes, fiches PDF) — AtelierDiagram

/**
 * Dessine le schéma d'un exercice dans un contexte (taille largeur × hauteur, en points) :
 * mise en place, ou une étape avec ses flèches, ou toutes les flèches (fiche papier).
 */
export function dessinerSchema(ctx, largeur, hauteur, t, { etape = 0, toutesFleches = false, rotation = true } = {}) {
  const vue = new Vue(cadrageDe(t), largeur, hauteur, { marge: 2, rotation });
  dessinerTerrain(ctx, vue);
  for (const m of t.materiel ?? []) if (m.type === 'zone') dessinerMateriel(ctx, vue, m);
  for (const m of t.materiel ?? []) if (m.type !== 'zone') dessinerMateriel(ctx, vue, m);
  const frames = M.resolvedFrames(t);
  if (!frames.length) return;
  const index = Math.min(Math.max(0, etape), frames.length - 1);
  const frame = toutesFleches ? frames[0] : frames[index];
  const rogne = vue.diametre * 0.5;
  if (toutesFleches) {
    for (let i = 1; i < Math.max(1, frames.length); i++) {
      for (const f of M.flechesEtape(t, i, frames)) dessinerFleche(ctx, vue, f, { rogneDebut: rogne, rogneFin: rogne });
    }
  } else if (index > 0) {
    for (const f of M.flechesEtape(t, index, frames)) dessinerFleche(ctx, vue, f, { rogneDebut: rogne, rogneFin: rogne });
  }
  for (const a of t.acteurs) {
    const p = frame.positions[a.id];
    if (p) dessinerJoueur(ctx, vue, a, p);
  }
  for (const id of M.idsBallons(t.etapes)) dessinerBallon(ctx, pointEcranBallon(frame, vue, id));
}

/** Dessine le schéma dans un canvas (taille en points CSS × échelle) */
export function dessinerDiagramme(canvas, t, options = {}) {
  const echelle = options.echelle ?? (typeof devicePixelRatio !== 'undefined' ? Math.min(3, devicePixelRatio || 1) : 1);
  const largeur = options.largeur ?? (canvas.clientWidth || canvas.width / echelle);
  const hauteur = options.hauteur ?? (canvas.clientHeight || canvas.height / echelle);
  if (!largeur || !hauteur) return;
  const pw = Math.max(1, Math.round(largeur * echelle)); const ph = Math.max(1, Math.round(hauteur * echelle));
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  ctx.clearRect(0, 0, largeur, hauteur);
  dessinerSchema(ctx, largeur, hauteur, t, options);
}

// Registre des schémas affichés : clé → { tactique, options } ; tailles en pixels déjà dessinées
// (reprises dans le HTML : sinon la mise à jour du DOM retirerait width/height et viderait le canvas)
const schemas = new Map();
const pixels = new Map();
const echelleEcran = () => (typeof devicePixelRatio !== 'undefined' ? Math.min(3, devicePixelRatio || 1) : 1);

function empreinte(texte) {
  let hash = 5381;
  for (let i = 0; i < texte.length; i++) hash = ((hash << 5) + hash + texte.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

/** Schéma à insérer dans une page (canvas redessiné à chaque changement de taille ou de contenu) */
export function diagrammeHTML(tactique, { etape = 0, toutesFleches = false, rotation = true, classe = '', cle = '' } = {}) {
  const options = { etape, toutesFleches, rotation };
  const marque = empreinte(JSON.stringify([tactique.acteurs, tactique.materiel, tactique.etapes, tactique.cadrage ?? null, options]));
  const id = cle || `diag-${tactique.id}-${etape}-${toutesFleches ? 1 : 0}-${rotation ? 1 : 0}`;
  schemas.set(id, { tactique, options });
  const px = pixels.get(id);
  return `<canvas class="diagramme${classe ? ` ${h(classe)}` : ''}" data-monter="atelier.diagramme" data-key="${h(id)}"
    data-diagramme="${h(id)}" data-empreinte="${marque}"${px ? ` width="${px[0]}" height="${px[1]}"` : ''} role="img" aria-label="Schéma : ${h(tactique.titre ?? '')}"></canvas>`;
}

definirMontage('atelier.diagramme', (canvas) => {
  let derniere = '';
  let attendu = null;
  const dessiner = () => {
    const s = schemas.get(canvas.dataset.diagramme);
    if (!s || !canvas.isConnected || !canvas.clientWidth || !canvas.clientHeight) return;
    const marque = `${canvas.dataset.empreinte}|${canvas.clientWidth}x${canvas.clientHeight}|${echelleEcran()}`;
    if (marque === derniere && attendu && canvas.width === attendu[0] && canvas.height === attendu[1]) return;
    derniere = marque;
    dessinerDiagramme(canvas, s.tactique, s.options);
    attendu = [canvas.width, canvas.height];
    pixels.set(canvas.dataset.diagramme, attendu);
  };
  const ro = new ResizeObserver(() => dessiner());
  ro.observe(canvas);
  // Contenu changé, ou canvas vidé (taille modifiée) : on redessine
  const mo = new MutationObserver(() => dessiner());
  mo.observe(canvas, { attributes: true, attributeFilter: ['data-empreinte', 'data-diagramme', 'width', 'height'] });
  requestAnimationFrame(dessiner);
  return () => { ro.disconnect(); mo.disconnect(); };
});

// MARK: - Pictogrammes des outils (AtelierToolGlyph)

/** Dessine l'icône d'un outil, comme sur le terrain, dans un canvas de 50 × 40 points */
export function dessinerGlypheOutil(canvas, outil, bib, propColor) {
  const echelle = echelleEcran();
  const largeur = 50; const hauteur = 40;
  if (canvas.width !== largeur * echelle) canvas.width = largeur * echelle;
  if (canvas.height !== hauteur * echelle) canvas.height = hauteur * echelle;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  ctx.clearRect(0, 0, largeur, hauteur);
  const centre = [0.5, 0.5];
  const cadrage = { x: 0.5 - 2 / W, y: 0.5 - 2 / L, largeur: 4 / W, longueur: 4 / L };
  const vue = new Vue(cadrage, largeur, hauteur, { marge: 0, rotation: false });
  const c = vue.ecran(centre);
  if (outil === 'joueur' || outil === 'gardien') {
    const gardien = outil === 'gardien';
    const acteur = { id: 'x', camp: 'equipe', numero: gardien ? 'G' : '', chasuble: gardien ? 'vert' : bib };
    if (gardien) acteur.poste = 'Gardien';
    dessinerJoueur(ctx, vue, acteur, centre);
  } else if (outil === 'ballon') {
    dessinerGlypheBallon(ctx, c, 20);
  } else if (outil === 'ligne') {
    for (const dx of [-14, 0, 14]) dessinerMateriel(ctx, vue, { type: 'plot', pos: vue.terrain([c[0] + dx, c[1]]), couleur: propColor });
  } else if (outil === 'prop:zone') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(c[0] - 16, c[1] - 11, 32, 22);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.strokeRect(c[0] - 16, c[1] - 11, 32, 22);
    ctx.setLineDash([]);
  } else if (outil?.startsWith('prop:')) {
    const type = outil.slice(5);
    const prop = { type, pos: centre };
    if (type === 'echelle') prop.rotation = 90;
    if (M.materielAvecCouleur(type)) prop.couleur = propColor;
    if (type === 'echelle' || type === 'but') {
      ctx.translate(c[0], c[1]); ctx.scale(0.8, 0.8); ctx.translate(-c[0], -c[1]);
    }
    dessinerMateriel(ctx, vue, prop);
  }
}

/** Pictogramme d'outil à insérer (canvas monté) */
export function glypheOutilHTML(outil, bib, propColor) {
  const e = echelleEcran();
  return `<canvas class="ed-glyphe" width="${50 * e}" height="${40 * e}" data-monter="atelier.glyphe" data-key="glyphe-${h(outil)}-${h(bib)}-${h(propColor)}"
    data-outil="${h(outil)}" data-bib="${h(bib)}" data-prop="${h(propColor)}" aria-hidden="true"></canvas>`;
}

definirMontage('atelier.glyphe', (canvas) => {
  const dessiner = () => dessinerGlypheOutil(canvas, canvas.dataset.outil, canvas.dataset.bib, canvas.dataset.prop);
  dessiner();
  const mo = new MutationObserver(() => dessiner());
  mo.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
  return () => mo.disconnect();
});
