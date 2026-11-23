// Outils communs aux rapports PDF de la zone Historique (ExportService.swift) :
// couleurs UIKit, styles de texte, filet de séparation (drawLine), dates françaises.
import { formatDate } from '../model.js';

/** Couleurs UIKit utilisées par les rapports natifs */
export const UI = {
  black: [0, 0, 0],
  white: [1, 1, 1],
  gray: [0.5, 0.5, 0.5],               // UIColor.gray
  darkGray: [1 / 3, 1 / 3, 1 / 3],     // UIColor.darkGray
  lightGray: [2 / 3, 2 / 3, 2 / 3],    // UIColor.lightGray
  red: [1, 0, 0],                       // UIColor.red
  systemGreen: [0.204, 0.78, 0.349],
  systemBlue: [0, 0.478, 1],
  systemOrange: [1, 0.584, 0],
};

/** Styles (taille, graisse, couleur) des attributs NSAttributedString natifs */
export const styles = {
  titre24: { taille: 24, gras: true, couleur: UI.black },
  titre22: { taille: 22, gras: true, couleur: UI.black },
  sousTitre: { taille: 14, couleur: UI.gray },
  entete: { taille: 14, gras: true, couleur: UI.systemGreen },
  corps: { taille: 12, couleur: UI.black },
  corpsGras: { taille: 12, gras: true, couleur: UI.black },
  petit: { taille: 10, couleur: UI.darkGray },
  date: { taille: 12, couleur: UI.gray },
  resume: { taille: 14, couleur: UI.darkGray },
  pied: { taille: 9, couleur: UI.lightGray },
};

/** Filet gris clair sur toute la largeur utile (ExportService.drawLine) */
export function filet(doc, y, marge, largeur) {
  doc.ligne(marge, y, marge + largeur, y, { couleur: UI.lightGray, epaisseur: 0.5 });
}

/** dateFormatter (.long, fr_FR) : « 23 novembre 2026 » */
export const dateLongue = (valeur) => formatDate(valeur, 'long');
/** shortDateFormatter (.medium, fr_FR) : « 23 nov. 2026 » */
export const dateMoyenne = (valeur) => formatDate(valeur, 'medium');

/** Dictionary(grouping:by:) trié par effectif décroissant (à égalité : ordre d'apparition) */
export function grouperParNombre(elements, cle) {
  const groupes = new Map();
  for (const e of elements) {
    const k = cle(e);
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k).push(e);
  }
  return [...groupes.entries()]
    .map(([nom, liste], rang) => ({ nom, liste, rang }))
    .sort((a, b) => (b.liste.length - a.liste.length) || (a.rang - b.rang));
}
