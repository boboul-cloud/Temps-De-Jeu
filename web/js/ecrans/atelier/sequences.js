// Construction d'une séquence pas à pas (SequenceBuilder.swift), du point de vue de l'entraîneur.
// Une étape = une action de ballon (au plus) + autant de courses que voulu :
//   • déplacer un joueur sans ballon      → course
//   • déplacer le joueur qui a le ballon  → conduite (le ballon suit)
//   • lâcher le ballon sur un partenaire  → passe (le ballon se colle à ses pieds)
//   • lâcher le ballon sur un adversaire  → ballon récupéré
//   • lâcher le ballon dans le vide       → passe dans l'espace
//   • lâcher le ballon dans le but        → tir
// Logique pure (sans interface) : testée par tests/atelier.test.mjs.
import { resolvedFrames, flechesEtape, decalageBallon } from '../../model.js';

/** Échelle pour « coller » le ballon : en mètres (3D) ou en points d'écran (2D) */
export const METRE = { echelleX: 68, echelleY: 105, aimant: 3.5 };
export const points = (largeur, hauteur) => ({ echelleX: largeur, echelleY: hauteur, aimant: 38 });

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Joueur le plus proche du point (dans la limite de l'aimant), ou null */
export function joueurLePlusProche(p, positions, metrique) {
  let meilleur = null;
  for (const [id, q] of Object.entries(positions)) {
    const d = Math.hypot((q[0] - p[0]) * metrique.echelleX, (q[1] - p[1]) * metrique.echelleY);
    if (d <= metrique.aimant && d < (meilleur?.d ?? Infinity)) meilleur = { id, d };
  }
  return meilleur?.id ?? null;
}

/** Point « dans le but » si le ballon est lâché près d'un des deux buts */
export function cibleBut(p) {
  if (Math.abs(p[0] - 0.5) >= 0.11) return null;
  const x = Math.min(Math.max(p[0], 0.47), 0.53);
  if (p[1] < 0.075) return [x, 0.004];
  if (p[1] > 0.925) return [x, 0.996];
  return null;
}

export const estDansLeBut = (p) => Math.abs(p[0] - 0.5) < 0.055 && (p[1] <= 0.012 || p[1] >= 0.988);

/** Position du ballon aux pieds d'un joueur */
export function ballonAuxPieds(p, camp) {
  const [dx, dy] = decalageBallon(camp);
  return [p[0] + dx, p[1] + dy];
}

/** Photographie l'état du terrain (makeStep) */
export function photographierEtape(positions, porteur, ballon, aerien) {
  const etape = { titre: '', texte: '', duree: 2.0, positions: { ...positions } };
  if (porteur != null && positions[porteur]) etape.porteur = porteur;
  else if (ballon) {
    etape.ballon = [...ballon];
    if (estDansLeBut(ballon)) etape.action = 'tir';
  }
  if (aerien) etape.aerien = true;
  return etape;
}

/**
 * Ce qui se passe entre deux étapes (transition) :
 * { fleches, resume, duree, actionBallon }
 */
export function transition(avant, apres, acteurs) {
  const t = { acteurs, materiel: [], etapes: [avant, apres] };
  const frames = resolvedFrames(t);
  const fleches = flechesEtape(t, 1, frames);
  const [f0, f1] = frames;
  const seuil = 0.012;
  const acteur = (id) => acteurs.find((a) => a.id === id);
  const etiquette = (id) => {
    const a = acteur(id);
    if (!a) return '?';
    return a.camp === 'adversaire' ? `adv. n°${a.numero}` : `n°${a.numero}`;
  };

  let coureurs = acteurs.filter((a) => {
    const p0 = f0.positions[a.id]; const p1 = f1.positions[a.id];
    return p0 && p1 && distance(p0, p1) > seuil;
  }).map((a) => a.id);

  const avecBallon = [avant, apres].some((e) => e.porteur != null || e.ballon != null);
  const ballonBouge = distance(f0.ballon, f1.ballon) > seuil;
  const enLair = apres.aerien === true;
  let texteBallon = null;
  let duree = 2.0;

  if (avecBallon) {
    const de = f0.porteur; const vers = f1.porteur;
    if (de != null && vers != null && de !== vers) {
      if (acteur(de)?.camp === acteur(vers)?.camp) {
        texteBallon = enLair ? `Ballon aérien ${etiquette(de)} → ${etiquette(vers)}` : `Passe ${etiquette(de)} → ${etiquette(vers)}`;
        duree = enLair ? 2.0 : 1.6;
      } else {
        texteBallon = `Ballon récupéré par ${etiquette(vers)}`;
        duree = 1.6;
      }
    } else if (de != null && vers != null && de === vers) {
      if (coureurs.includes(de)) {
        texteBallon = `Conduite ${etiquette(de)}`;
        coureurs = coureurs.filter((x) => x !== de);
        duree = 2.2;
      }
    } else if (de != null && vers == null) {
      if (estDansLeBut(f1.ballon)) {
        texteBallon = `Tir ${etiquette(de)}`;
        duree = 1.4;
      } else if (ballonBouge) {
        texteBallon = enLair ? `Ballon aérien dans l'espace ${etiquette(de)}` : `Passe dans l'espace ${etiquette(de)}`;
        duree = 1.6;
      }
    } else if (de == null && vers != null) {
      if (ballonBouge) { texteBallon = `Ballon contrôlé par ${etiquette(vers)}`; duree = 1.6; }
    } else if (ballonBouge) {
      texteBallon = estDansLeBut(f1.ballon) ? 'Tir' : 'Ballon déplacé';
      duree = 1.6;
    }
  }

  const parts = [];
  if (texteBallon) parts.push(texteBallon);
  if (coureurs.length) parts.push(coureurs.length === 1 ? `Course ${etiquette(coureurs[0])}` : `${coureurs.length} courses`);
  return {
    fleches,
    resume: parts.length ? parts.join(' · ') : 'Aucun mouvement',
    duree: texteBallon == null && !coureurs.length ? 1.5 : duree,
    actionBallon: texteBallon != null,
  };
}
