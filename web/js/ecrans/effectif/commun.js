// Éléments partagés par les écrans Joueurs, Catégories, Encadrement, Cartons et Saisons :
// avatars (PlayerAvatar, StaffAvatar), badges (TeamStatBadge, CardBadge, CardStatBadge),
// barre de recherche (.searchable), section photo des fiches, sélecteur de couleur.
import * as M from '../../model.js';
import { h, icone, action, ouvrirLien, pageCourante, lirePhoto, choisirFichier, alerte, rafraichir } from '../../ui.js';
import { couleurPoste, COULEUR_CARTON, compterCartons } from './logique.js';

const c = (nom) => M.couleur(nom);

/** Avatar d'un joueur : photo, sinon initiale blanche sur la couleur du poste (PlayerAvatar) */
export function avatarJoueur(p, { taille = 40, couleurDuPoste = true, attenue = false } = {}) {
  const fond = couleurDuPoste ? c(couleurPoste(p.position)) : c('gray');
  const style = `width:${taille}px;height:${taille}px;font-size:${Math.round(taille * 0.45)}px;--av:${fond}`;
  const contenu = p.photoData
    ? `<img src="data:image/jpeg;base64,${p.photoData}" alt="">`
    : `<span>${h(([...(p.firstName ?? '')][0] ?? '').toUpperCase())}</span>`;
  return `<span class="eff-avatar${couleurDuPoste ? ' anneau' : ''}${attenue ? ' attenue' : ''}" style="${style}">${contenu}</span>`;
}

/** Avatar d'un encadrant : photo, sinon initiale blanche sur fond gris (StaffAvatar) */
export function avatarEncadrant(s, taille = 40) {
  const style = `width:${taille}px;height:${taille}px;font-size:${Math.round(taille * 0.45)}px;--av:${c('gray')}`;
  const contenu = s.photoData
    ? `<img src="data:image/jpeg;base64,${s.photoData}" alt="">`
    : `<span>${h(([...(s.firstName ?? '')][0] ?? '').toUpperCase())}</span>`;
  return `<span class="eff-avatar anneau-gris" style="${style}">${contenu}</span>`;
}

/** Ligne de badges de statistiques (TeamStatBadge) : [{ libelle, valeur, couleur }] */
export const badgesStats = (badges) => `<div class="eff-badges">${badges.map((b) => `
  <div class="eff-badge"><span class="eff-badge-valeur" style="color:${c(b.couleur)}">${h(b.valeur)}</span>
  <span class="eff-badge-libelle">${h(b.libelle)}</span></div>`).join('')}</div>`;

/** Petit carton (CardBadge) : rectangle coloré et « ×n » au-delà d'un */
export const badgeCarton = (n, couleur) =>
  `<span class="eff-carton-badge"><span class="eff-carton-mini" style="background:${c(couleur)}"></span>${n > 1 ? `<span>×${n}</span>` : ''}</span>`;

/** Badges de cartons d'un joueur, dans l'ordre jaune, 2e jaune, rouge, blanc */
export function badgesCartons(cartons) {
  const n = compterCartons(cartons);
  if (!n.total) return '';
  return `<span class="eff-cartons">${[
    n.jaune ? badgeCarton(n.jaune, 'cardYellow') : '',
    n.deuxiemeJaune ? badgeCarton(n.deuxiemeJaune, 'cardOrange') : '',
    n.rouge ? badgeCarton(n.rouge, 'cardRed') : '',
    n.blanc ? badgeCarton(n.blanc, 'cardWhite') : '',
  ].join('')}</span>`;
}

/** Statistique de cartons (CardStatBadge) */
export const statCarton = (libelle, n, couleur) => `<div class="eff-badge">
  <span class="eff-badge-valeur" style="color:${c(couleur)}"><span class="eff-carton-stat" style="background:${c(couleur)}"></span>${n}</span>
  <span class="eff-badge-libelle">${h(libelle)}</span></div>`;

/** Carton dessiné (CardHistoryRow, MatchCardRow) : la 2e jaune est mi-jaune, mi-rouge */
export const carteVisuelle = (type) => `<span class="eff-carton-grand" style="background:${c(COULEUR_CARTON[type] ?? 'cardYellow')}">${type === '2ème Jaune' ? `<span style="background:${c('cardRed')}"></span>` : ''}</span>`;

/** Pastille de texte (poste, disponibilité) : texte de couleur sur fond pâle */
export const etiquette = (texte, couleur) => `<span class="eff-etiquette" style="--c:${c(couleur)}">${h(texte)}</span>`;

/** Puce de catégorie d'origine */
export const puceCategorie = (cat) => `<span class="eff-puce-cat" style="--c:${c(M.couleurProfil(cat.colorIndex))}">${h(cat.name)}</span>`;

/** Barre de recherche (.searchable) */
export function recherche({ valeur, action: a, placeholder, cle }) {
  return `<label class="recherche eff-recherche" data-key="${h(cle)}">${icone('magnifyingglass')}
    <input type="search" value="${h(valeur)}" placeholder="${h(placeholder)}" data-input="${h(a)}" autocomplete="off" enterkeyhint="search" aria-label="${h(placeholder)}">
    ${valeur ? `<button type="button" class="eff-effacer" data-action="${h(a)}" data-effacer="1" aria-label="Effacer">${icone('xmark.circle.fill')}</button>` : ''}
  </label>`;
}

/** Lit la valeur d'une recherche (frappe ou bouton d'effacement) */
export const valeurRecherche = (el) => (el.dataset.effacer ? '' : el.value);

/** Bouton d'appel (tel:) */
export const boutonAppel = (tel, { grand = false } = {}) =>
  `<button type="button" class="eff-appel${grand ? ' grand' : ''}" data-action="effectif.appeler" data-tel="${h(tel)}" aria-label="Appeler ${h(tel)}" title="Appeler">${icone(grand ? 'phone.circle.fill' : 'phone.fill')}</button>`;
action('effectif.appeler', (el) => {
  ouvrirLien(`tel:${el.dataset.tel.replace(/\s/g, '')}`);
  return false;
});

/** Bouton « ⋯ » d'une ligne (remplace le balayage de l'iPhone) */
export const boutonMenu = (a, data = {}) => `<button type="button" class="eff-menu" data-action="${h(a)}"${Object.entries(data).map(([k, v]) => ` data-${k}="${h(v)}"`).join('')} aria-label="Actions" title="Actions">${icone('ellipsis.circle')}</button>`;

/** Section « Photo » d'une fiche (PhotosPicker) : grande photo ronde, Ajouter / Modifier, Supprimer */
export function sectionPhoto(photo) {
  return `<section class="section eff-photo-section">
    <h2 class="section-entete">Photo</h2>
    <div class="eff-photo">
      <span class="eff-photo-grande">${photo ? `<img src="data:image/jpeg;base64,${photo}" alt="">` : icone('person.circle.fill')}</span>
      <div class="eff-photo-boutons">
        <button type="button" class="bouton teinte petit" data-action="effectif.photo">${icone('photo')}<span>${photo ? 'Modifier' : 'Ajouter'}</span></button>
        ${photo ? `<button type="button" class="bouton detruire petit" data-action="effectif.photoSupprimer">${icone('trash')}<span>Supprimer</span></button>` : ''}
      </div>
    </div>
  </section>`;
}

// La fiche ouverte garde son brouillon dans params.brouillon (photoData compris)
action('effectif.photo', async () => {
  const p = pageCourante().params;
  const [f] = await choisirFichier({ accept: 'image/*' });
  if (!f || !p?.brouillon) return false;
  try {
    p.brouillon.photoData = await lirePhoto(f, 400, 0.7);
  } catch {
    alerte('Photo', 'Impossible de lire cette image.');
  }
  rafraichir();
  return false;
});
action('effectif.photoSupprimer', () => {
  const p = pageCourante().params;
  if (p?.brouillon) p.brouillon.photoData = undefined;
});

/** Sélecteur des 8 couleurs de catégorie */
export const choixCouleur = (index, a) => `<div class="ligne eff-couleurs-ligne"><span class="ligne-textes">
  <span class="ligne-sous-titre">Couleur</span>
  <span class="eff-couleurs" role="radiogroup" aria-label="Couleur">${M.COULEURS_PROFIL.map((col) => `
    <button type="button" role="radio" aria-checked="${col.index === index}" aria-label="${h(col.nom)}" title="${h(col.nom)}"
      class="eff-pastille-couleur${col.index === index ? ' actif' : ''}" style="background:${c(col.couleur)}" data-action="${h(a)}" data-index="${col.index}"></button>`).join('')}
  </span></span></div>`;

/** Champ de texte brut (pour les attributs que ui.champ ne propose pas) */
export function champBrut({ valeur = '', placeholder = '', input, type = 'text', classe = '', cle, attrs = '', libelle = '' }) {
  return `<div class="ligne ligne-champ"${cle ? ` data-key="${h(cle)}"` : ''}>
    <input class="champ ${h(classe)}" type="${h(type)}" value="${h(valeur)}" placeholder="${h(placeholder)}" data-input="${h(input)}" aria-label="${h(libelle || placeholder)}" ${attrs}>
  </div>`;
}

export { couleurPoste };
