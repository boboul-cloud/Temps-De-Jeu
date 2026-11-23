// Petits composants partagés par les écrans du match (équivalents de SectionHeader, StatBox,
// PlayerAvatar, couleurs de cartons et de postes de l'app native).
import * as M from '../../model.js';
import { h, icone } from '../../ui.js';

/** Couleur d'un poste (PlayerAvatar / MatchPlayerSelectionRow) */
export const COULEUR_POSTE = { Gardien: 'orange', Défenseur: 'blue', Milieu: 'green', Attaquant: 'red' };

/** Couleur d'un carton (Color.cardYellow…) */
export function couleurCarton(type) {
  switch (type) {
    case 'Rouge': return M.COULEURS.cardRed;
    case '2ème Jaune': return M.COULEURS.cardOrange;
    case 'Blanc': return M.COULEURS.cardWhite;
    default: return M.COULEURS.cardYellow;
  }
}

/** Petit carton dessiné ; deuxième jaune = moitié rouge */
export function carton(type, largeur = 10, hauteur = 14) {
  const fond = couleurCarton(type);
  const moitie = type === '2ème Jaune' ? `<span class="m-carton-moitie" style="background:${M.COULEURS.cardRed}"></span>` : '';
  return `<span class="m-carton${type === 'Blanc' ? ' blanc' : ''}" style="width:${largeur}px;height:${hauteur}px;background:${fond}">${moitie}</span>`;
}

/** En-tête de carte (SectionHeader) : pictogramme vert + titre */
export const enteteSection = (titre, ic) =>
  `<div class="m-entete">${icone(ic)}<span>${h(titre)}</span></div>`;

/** StatBox : valeur colorée + libellé, fond teinté */
export const statBox = (titre, valeur, c) =>
  `<div class="m-statbox" style="--c:${M.couleur(c)}"><span class="m-statbox-valeur">${h(valeur)}</span><span class="m-statbox-titre">${h(titre)}</span></div>`;

/** Avatar d'un joueur (PlayerAvatar) : photo, sinon initiale du prénom sur la couleur du poste */
export function avatarJoueur(joueur, taille = 36, couleurPoste = true) {
  const fond = couleurPoste ? M.couleur(COULEUR_POSTE[joueur.position] ?? 'gray') : 'var(--gris)';
  const style = `width:${taille}px;height:${taille}px;font-size:${Math.round(taille * 0.45)}px;background:${fond}`;
  const bord = couleurPoste ? ` style="box-shadow:0 0 0 2px color-mix(in srgb, ${fond} 30%, transparent)"` : '';
  if (joueur.photoData) {
    return `<span class="m-avatar"${bord}><img src="data:image/jpeg;base64,${joueur.photoData}" alt="" style="width:${taille}px;height:${taille}px"></span>`;
  }
  return `<span class="m-avatar"${bord}><span class="m-avatar-lettre" style="${style}">${h(([...(joueur.firstName ?? '')][0] ?? '').toUpperCase())}</span></span>`;
}

/** Maillot coloré (tshirt.fill) avec ombre si blanc */
export function maillotIcone(couleurId, taille = 18) {
  const m = M.maillot(couleurId);
  return `<span class="m-maillot${couleurId === 'Blanc' ? ' blanc' : ''}" style="color:${m.css};font-size:${taille}px">${icone('tshirt.fill')}</span>`;
}

/** « 4:05 » (String(format: "%d:%02d")) */
export function minSec(t) {
  const s = Math.trunc(Math.max(0, t));
  return `${Math.trunc(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Libellé d'équipe : nom, sinon « Domicile » / « Extérieur » (ou DOM / EXT en abrégé) */
export const nomEquipe = (m, cote, court = false) => {
  const nom = cote === 'home' ? m.homeTeam : m.awayTeam;
  if (nom !== '') return nom;
  if (court) return cote === 'home' ? 'DOM' : 'EXT';
  return cote === 'home' ? 'Domicile' : 'Extérieur';
};

/** Regroupe des événements par nom de joueur, du plus fréquent au moins fréquent */
export function grouperParNom(evenements) {
  const groupes = new Map();
  for (const e of evenements) {
    if (!groupes.has(e.playerName)) groupes.set(e.playerName, []);
    groupes.get(e.playerName).push(e);
  }
  return [...groupes.entries()].sort((a, b) => b[1].length - a[1].length);
}
