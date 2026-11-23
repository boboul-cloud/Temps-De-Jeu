// Onglet « Joueurs » (TeamManagementView.swift) : effectif de la catégorie active par poste,
// joueurs indisponibles, fiche joueur (PlayerEditView). Le balayage de l'iPhone (Blessé, Absent,
// Suspendu, Disponible, Supprimer) devient le bouton « ⋯ » de chaque ligne.
import * as M from '../model.js';
import { store } from '../store.js';
import {
  definirPage, action, ouvrirFeuille, fermerFeuille, pageCourante, section, ligne, selecteur, bouton,
  boutonBarre, vide, choix, confirmer, h, icone,
} from '../ui.js';
import {
  regrouperJoueurs, migrerCategorieOrigine, categoriesOrigine, cartonsActifsJoueur, couleurPoste, couleurDispo,
} from './effectif/logique.js';
import {
  avatarJoueur, badgesStats, badgesCartons, etiquette, puceCategorie, recherche, valeurRecherche, boutonAppel,
  boutonMenu, sectionPhoto, champBrut,
} from './effectif/commun.js';

const etat = { recherche: '' };

const POSTES_SECTIONS = [
  ['gardiens', 'Gardiens', 'hand.raised.fill', 'orange'],
  ['defenseurs', 'Défenseurs', 'shield.fill', 'blue'],
  ['milieux', 'Milieux', 'arrow.left.arrow.right', 'green'],
  ['attaquants', 'Attaquants', 'flame.fill', 'red'],
];

/** Données de l'écran (reloadData), avec la migration des catégories d'origine */
function charger() {
  let joueurs = store.joueurs();
  const migration = migrerCategorieOrigine(joueurs, store.profils);
  if (migration.modifie) {
    joueurs = migration.joueurs;
    store.enregistrerJoueurs(joueurs);
  }
  const cartons = store.matchs().flatMap((m) => m.cards);
  return { joueurs, cartons, autres: categoriesOrigine(joueurs, store.profils, store.profilActifId) };
}

function sousTitre(p, autres, attenue = false) {
  const cats = autres.get(p.id) ?? [];
  return `<span class="eff-sous${attenue ? ' attenue' : ''}">${h(p.position)}${cats.length ? `<span class="eff-point">•</span>${cats.map(puceCategorie).join('')}` : ''}</span>`;
}

/** Ligne d'un joueur disponible (PlayerRow) */
function ligneJoueur(p, cartons, autres) {
  return `<div class="ligne tactile eff-ligne eff-avec-avatar" role="button" tabindex="0" data-action="joueurs.modifier" data-id="${h(p.id)}" data-key="j-${h(p.id)}">
    ${avatarJoueur(p, { taille: 40 })}
    <span class="ligne-textes"><span class="ligne-titre gras eff-nom">${h(M.fullName(p) || 'Joueur')}</span>${sousTitre(p, autres)}</span>
    ${p.phoneNumber ? boutonAppel(p.phoneNumber) : ''}
    ${badgesCartons(cartonsActifsJoueur(cartons, p.id))}
    ${etiquette(M.POSTE_COURT[p.position], couleurPoste(p.position))}
    ${boutonMenu('joueurs.menu', { id: p.id })}
  </div>`;
}

/** Ligne d'un joueur indisponible (UnavailablePlayerRow) */
function ligneIndisponible(p, autres) {
  const col = couleurDispo(p.availability);
  return `<div class="ligne tactile eff-ligne eff-avec-avatar" role="button" tabindex="0" data-action="joueurs.modifier" data-id="${h(p.id)}" data-key="i-${h(p.id)}">
    <span class="eff-avatar-statut">${avatarJoueur(p, { taille: 40, couleurDuPoste: false, attenue: true })}
      <span class="eff-statut" style="background:${M.couleur(col)}">${icone(M.DISPO_ICONE[p.availability])}</span></span>
    <span class="ligne-textes"><span class="ligne-titre eff-nom barre">${h(M.fullName(p) || 'Joueur')}</span>${sousTitre(p, autres, true)}</span>
    ${etiquette(p.availability, col)}
    ${boutonMenu('joueurs.menu', { id: p.id })}
  </div>`;
}

definirPage('joueurs.racine', () => {
  const { joueurs, cartons, autres } = charger();
  const g = regrouperJoueurs(joueurs, etat.recherche);
  const barreRecherche = recherche({ valeur: etat.recherche, action: 'joueurs.recherche', placeholder: 'Rechercher un joueur', cle: 'joueurs-recherche' });
  let contenu;
  if (!joueurs.length) {
    contenu = `${barreRecherche}${vide({
      icone: 'person.3.fill',
      titre: 'Aucun joueur',
      message: 'Ajoutez votre effectif.\nVous pourrez les sélectionner\navant chaque match.',
      bouton: bouton({ libelle: 'Ajouter un joueur', icone: 'plus', action: 'joueurs.ajouter', couleur: 'green' }),
    })}`;
  } else {
    contenu = `${barreRecherche}
      ${badgesStats([
        { libelle: 'Effectif', valeur: joueurs.length, couleur: 'blue' },
        { libelle: 'Gardiens', valeur: g.gardiens.length, couleur: 'orange' },
        { libelle: 'Joueurs', valeur: g.defenseurs.length + g.milieux.length + g.attaquants.length, couleur: 'green' },
      ])}
      ${POSTES_SECTIONS.map(([cle, titre, ic, col]) => (g[cle].length ? section({
        cle: `s-${cle}`,
        entete: `<span style="color:${M.couleur(col)}">${icone(ic)}</span>${h(titre)} (${g[cle].length})`,
        lignes: g[cle].map((p) => ligneJoueur(p, cartons, autres)),
      }) : '')).join('')}
      ${g.indisponibles.length ? section({
        cle: 's-indispo',
        entete: `<span style="color:${M.couleur('red')}">${icone('person.slash.fill')}</span>Indisponibles (${g.indisponibles.length})`,
        lignes: g.indisponibles.map((p) => ligneIndisponible(p, autres)),
      }) : ''}`;
  }
  return {
    titre: 'Mes Joueurs',
    grandTitre: true,
    droite: boutonBarre({ icone: 'plus.circle.fill', titre: 'Ajouter un joueur', action: 'joueurs.ajouter' }),
    contenu: `<div class="colonne">${contenu}</div>`,
  };
});

action('joueurs.recherche', (el) => { etat.recherche = valeurRecherche(el); });

function enregistrer(joueurs) { store.enregistrerJoueurs(joueurs); }

function changerDispo(id, dispo) {
  enregistrer(store.joueurs().map((p) => (p.id === id ? { ...p, availability: dispo } : p)));
}

action('joueurs.menu', (el) => {
  const p = store.joueurs().find((x) => x.id === el.dataset.id);
  if (!p) return;
  const supprimer = { libelle: 'Supprimer', role: 'detruire', icone: 'trash', faire: () => store.supprimerJoueurPartout(p.id) };
  const actions = p.availability === 'Disponible'
    ? [
      { libelle: 'Blessé', icone: 'cross.case.fill', faire: () => changerDispo(p.id, 'Blessé') },
      { libelle: 'Absent', icone: 'person.slash.fill', faire: () => changerDispo(p.id, 'Absent') },
      { libelle: 'Suspendu', icone: 'exclamationmark.shield.fill', faire: () => changerDispo(p.id, 'Suspendu') },
      supprimer,
    ]
    : [{ libelle: 'Disponible', icone: 'checkmark.circle.fill', faire: () => changerDispo(p.id, 'Disponible') }, supprimer];
  choix({ titre: M.fullName(p) || 'Joueur', actions });
});

// MARK: - Fiche joueur (PlayerEditView)

action('joueurs.ajouter', () => {
  ouvrirFeuille('joueurs.edition', {
    id: null,
    brouillon: { firstName: '', lastName: '', phoneNumber: '', position: 'Milieu', availability: 'Disponible', photoData: undefined },
  });
});

action('joueurs.modifier', (el) => {
  const p = store.joueurs().find((x) => x.id === el.dataset.id);
  if (!p) return;
  ouvrirFeuille('joueurs.edition', {
    id: p.id,
    brouillon: {
      firstName: p.firstName, lastName: p.lastName, phoneNumber: p.phoneNumber ?? '', position: p.position,
      availability: p.availability, photoData: p.photoData, homeCategoryId: p.homeCategoryId,
    },
  });
});

definirPage('joueurs.edition', (p) => {
  const b = p.brouillon;
  const edition = p.id != null;
  return {
    titre: edition ? 'Modifier' : 'Nouveau joueur',
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Enregistrer', action: 'joueurs.enregistrer', gras: true, desactive: b.firstName === '' && b.lastName === '' }),
    contenu: `<div class="colonne">
      ${sectionPhoto(b.photoData)}
      ${section({
        entete: 'Identité',
        lignes: [
          champBrut({ valeur: b.firstName, placeholder: 'Prénom', input: 'joueurs.champ', attrs: 'data-champ="firstName" autocomplete="off" autocapitalize="words"', cle: 'je-prenom' }),
          champBrut({ valeur: b.lastName, placeholder: 'Nom', input: 'joueurs.champ', attrs: 'data-champ="lastName" autocomplete="off" autocapitalize="words"', cle: 'je-nom' }),
        ],
      })}
      ${section({
        entete: 'Contact',
        lignes: [champBrut({ valeur: b.phoneNumber, placeholder: 'N° Téléphone', type: 'tel', input: 'joueurs.champ', attrs: 'data-champ="phoneNumber" inputmode="tel" autocomplete="off"', cle: 'je-tel' })],
      })}
      ${section({
        entete: 'Position',
        lignes: [selecteur({ titre: 'Position', valeur: b.position, options: M.POSTES.map((x) => [x, x]), action: 'joueurs.choix', data: { champ: 'position' } })],
      })}
      ${section({
        entete: 'Disponibilité',
        lignes: [selecteur({ titre: 'Disponibilité', valeur: b.availability, options: M.DISPONIBILITES.map((x) => [x, x]), action: 'joueurs.choix', data: { champ: 'availability' } })],
      })}
      ${edition ? section({ lignes: [ligne({ titre: 'Supprimer le joueur', icone: 'trash', couleurIcone: 'red', detruire: true, action: 'joueurs.supprimer', classe: 'avec-icone' })] }) : ''}
    </div>`,
  };
});

action('joueurs.champ', (el) => {
  pageCourante().params.brouillon[el.dataset.champ] = el.value;
});
action('joueurs.choix', (el) => {
  pageCourante().params.brouillon[el.dataset.champ] = el.value;
});

action('joueurs.enregistrer', () => {
  const p = pageCourante().params;
  const b = p.brouillon;
  if (b.firstName === '' && b.lastName === '') return false;
  const joueur = M.lireJoueur({
    id: p.id ?? M.uuid(),
    firstName: b.firstName,
    lastName: b.lastName,
    position: b.position,
    availability: b.availability,
    photoData: b.photoData,
    phoneNumber: b.phoneNumber === '' ? undefined : b.phoneNumber,
    // Nouveau joueur : la catégorie active devient sa catégorie d'origine
    homeCategoryId: p.id == null ? (store.profilActifId ?? undefined) : b.homeCategoryId,
  });
  const joueurs = store.joueurs();
  if (p.id == null) joueurs.push(joueur);
  else {
    const i = joueurs.findIndex((x) => x.id === joueur.id);
    if (i >= 0) joueurs[i] = joueur;
  }
  fermerFeuille();
  enregistrer(joueurs);
  if (p.id == null) store.ajouterJoueurAuProfilActif(joueur.id);
});

action('joueurs.supprimer', () => {
  const p = pageCourante().params;
  confirmer({
    titre: 'Supprimer ce joueur ?',
    message: 'Il sera retiré de toutes les catégories.',
    faire: () => { fermerFeuille(); store.supprimerJoueurPartout(p.id); },
  });
});
