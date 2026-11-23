// Onglet « Encadrement » (StaffManagementView.swift) : encadrants de la catégorie active par rôle,
// fiche encadrant (StaffEditView), rôles (StaffRoleManagerView), export JSON / PDF et import JSON.
// Le balayage (Appeler, Supprimer) devient le bouton « ⋯ » de chaque ligne.
import * as M from '../model.js';
import { store } from '../store.js';
import {
  definirPage, action, ouvrirFeuille, fermerFeuille, pageCourante, section, ligne, selecteur, bouton, boutonBarre,
  vide, choix, confirmer, alerte, partager, choisirFichier, apercuPDF, ouvrirLien, h, icone,
} from '../ui.js';
import { encadrantsParRole, iconeRole, importerEncadrement, nomFichierEncadrement } from './effectif/logique.js';
import {
  avatarEncadrant, badgesStats, recherche, valeurRecherche, boutonAppel, boutonMenu, sectionPhoto, champBrut, etiquette,
} from './effectif/commun.js';
import { genererPDFEncadrement } from '../rapports/encadrement.js';

const etat = { recherche: '' };
const couleurActive = () => store.couleurActive();

/** Ligne d'un encadrant (StaffRow) */
function ligneEncadrant(s) {
  return `<div class="ligne tactile eff-ligne eff-avec-avatar" role="button" tabindex="0" data-action="encadrement.modifier" data-id="${h(s.id)}" data-key="e-${h(s.id)}">
    ${avatarEncadrant(s, 44)}
    <span class="ligne-textes">
      <span class="ligne-titre gras eff-nom">${h(M.nomEncadrant(s))}</span>
      <span class="ligne-sous-titre">${h(store.nomRole(s.roleId))}</span>
      ${s.phone ? `<span class="eff-tel">${icone('phone.fill')}${h(s.phone)}</span>` : ''}
    </span>
    ${s.profileIds.length > 1 ? etiquette(`${s.profileIds.length} cat.`, 'orange') : ''}
    ${s.phone ? boutonAppel(s.phone, { grand: true }) : ''}
    ${boutonMenu('encadrement.menu', { id: s.id })}
  </div>`;
}

definirPage('encadrement.racine', () => {
  const encadrants = store.encadrants();
  const roles = store.roles();
  const barreRecherche = recherche({ valeur: etat.recherche, action: 'encadrement.recherche', placeholder: 'Rechercher un encadrant', cle: 'enc-recherche' });
  let contenu;
  if (!encadrants.length) {
    contenu = `${barreRecherche}<div class="eff-vide">${vide({
      icone: 'person.badge.shield.checkmark.fill',
      titre: 'Aucun encadrant',
      message: 'Ajoutez les coaches, arbitres,\ndélégués et autres encadrants\nde vos équipes.',
      bouton: bouton({ libelle: 'Ajouter un encadrant', icone: 'plus', action: 'encadrement.ajouter', couleur: couleurActive() }),
    })}</div>`;
  } else {
    contenu = `${barreRecherche}
      ${badgesStats([
        { libelle: 'Encadrants', valeur: encadrants.length, couleur: couleurActive() },
        { libelle: 'Rôles', valeur: new Set(encadrants.map((s) => s.roleId)).size, couleur: 'orange' },
      ])}
      ${encadrantsParRole(encadrants, roles, etat.recherche).map((g) => section({
        cle: `r-${g.role.id}`,
        entete: `<span style="color:${M.couleur(couleurActive())}">${icone(iconeRole(g.role.name))}</span>${h(g.role.name)} (${g.membres.length})`,
        lignes: g.membres.map(ligneEncadrant),
      })).join('')}`;
  }
  return {
    titre: 'Encadrement',
    grandTitre: true,
    droite: boutonBarre({ icone: 'plus.circle.fill', titre: 'Encadrement', action: 'encadrement.menuPrincipal' }),
    contenu: `<div class="colonne">${contenu}</div>`,
  };
});

action('encadrement.recherche', (el) => { etat.recherche = valeurRecherche(el); });

action('encadrement.menuPrincipal', () => {
  const vides = store.encadrants().length === 0;
  choix({
    actions: [
      { libelle: 'Ajouter un encadrant', icone: 'person.badge.plus', faire: ouvrirAjout },
      { libelle: 'Gérer les rôles', icone: 'tag', faire: () => ouvrirFeuille('encadrement.roles', { nouveau: '' }) },
      ...(vides ? [] : [
        { libelle: 'Exporter (JSON)', icone: 'doc.text', faire: exporterJSON },
        { libelle: 'Exporter (PDF)', icone: 'doc.richtext', faire: apercuPDFEncadrement },
      ]),
      { libelle: 'Importer (JSON)', icone: 'square.and.arrow.down', faire: importerJSON },
    ],
  });
});

action('encadrement.menu', (el) => {
  const s = store.tousLesEncadrants().find((x) => x.id === el.dataset.id);
  if (!s) return;
  const tel = s.phone.replace(/\s/g, '');
  choix({
    titre: M.nomEncadrant(s),
    actions: [
      ...(tel ? [{ libelle: 'Appeler', icone: 'phone.fill', faire: () => ouvrirLien(`tel:${tel}`) }] : []),
      { libelle: 'Supprimer', role: 'detruire', icone: 'trash', faire: () => store.supprimerEncadrant(s.id) },
    ],
  });
});

// MARK: - Export / import

function exporterJSON() {
  const texte = M.ecrireEncadrementJSON(store.encadrants(), store.roles(), store.profilActif());
  const nom = nomFichierEncadrement(store.profilActif()?.name ?? 'tous');
  partager({ fichiers: [{ nom, contenu: texte, type: 'application/json' }] });
}

function apercuPDFEncadrement() {
  const octets = genererPDFEncadrement(store.encadrants(), store.roles(), store.profilActif(), store.profils);
  apercuPDF(octets, 'Encadrement.pdf', 'Encadrement');
}

async function importerJSON() {
  const [f] = await choisirFichier({ accept: '.json,application/json' });
  if (!f) return;
  let resultat = null;
  try {
    resultat = M.lireEncadrementJSON(JSON.parse(await f.text()));
  } catch {
    resultat = null;
  }
  if (!resultat) {
    alerte('Erreur', "Le fichier n'est pas un export d'encadrement valide.");
    return;
  }
  const n = resultat.staffMembers.length;
  const r = resultat.staffRoles.length;
  const roles = r === 0 ? '' : ` et ${r} rôle${M.pluriel(r)}`;
  choix({
    titre: `Importer ${n} encadrant${M.pluriel(n)}`,
    message: `${n} encadrant${M.pluriel(n)}${roles} trouvé${M.pluriel(n)} dans le fichier.`,
    actions: [
      { libelle: 'Fusionner (ajouter les nouveaux)', faire: () => appliquerImport('fusion', resultat) },
      { libelle: "Remplacer tout l'encadrement", faire: () => appliquerImport('remplacement', resultat) },
    ],
  });
}

function appliquerImport(mode, resultat) {
  const { encadrants, roles } = importerEncadrement({
    mode,
    tousLesEncadrants: store.tousLesEncadrants(),
    roles: store.roles(),
    importes: resultat.staffMembers,
    rolesImportes: resultat.staffRoles,
    actifId: store.profilActifId,
  });
  store.enregistrerRoles(roles);
  store.enregistrerTousEncadrants(encadrants);
  const n = resultat.staffMembers.length;
  const total = store.encadrants().length;
  alerte('Import réussi', mode === 'remplacement'
    ? `${n} encadrant${M.pluriel(n)} importé${M.pluriel(n)} (remplacement).`
    : `Encadrement mis à jour. ${total} encadrant${M.pluriel(total)} au total.`);
}

// MARK: - Fiche encadrant (StaffEditView)

function ouvrirAjout() {
  const roles = store.roles();
  ouvrirFeuille('encadrement.edition', {
    id: null,
    brouillon: {
      firstName: '', lastName: '', roleId: roles[0]?.id ?? M.uuid(), phone: '', email: '', photoData: undefined,
      profileIds: store.profilActifId ? [store.profilActifId] : [],
    },
  });
}
action('encadrement.ajouter', () => ouvrirAjout());

action('encadrement.modifier', (el) => {
  const s = store.tousLesEncadrants().find((x) => x.id === el.dataset.id);
  if (!s) return;
  ouvrirFeuille('encadrement.edition', {
    id: s.id,
    brouillon: { firstName: s.firstName, lastName: s.lastName, roleId: s.roleId, phone: s.phone, email: s.email, photoData: s.photoData, profileIds: [...s.profileIds] },
  });
});

definirPage('encadrement.edition', (p) => {
  const b = p.brouillon;
  const roles = store.roles();
  const edition = p.id != null;
  const ligneContact = (ic, coul, champ, placeholder, type, attrs) => `<div class="ligne ligne-champ eff-contact" data-key="ee-${champ}">
    <span class="eff-contact-icone" style="color:${M.couleur(coul)}">${icone(ic)}</span>
    <input class="champ" type="${type}" value="${h(b[champ])}" placeholder="${h(placeholder)}" data-input="encadrement.champ" data-champ="${champ}" aria-label="${h(placeholder)}" autocomplete="off" ${attrs}>
  </div>`;
  return {
    titre: edition ? 'Modifier' : 'Nouvel encadrant',
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Enregistrer', action: 'encadrement.enregistrer', gras: true, desactive: b.firstName === '' && b.lastName === '' }),
    contenu: `<div class="colonne">
      ${sectionPhoto(b.photoData)}
      ${section({
        entete: 'Identité',
        lignes: [
          champBrut({ valeur: b.firstName, placeholder: 'Prénom', input: 'encadrement.champ', attrs: 'data-champ="firstName" autocomplete="off" autocapitalize="words"', cle: 'ee-prenom' }),
          champBrut({ valeur: b.lastName, placeholder: 'Nom', input: 'encadrement.champ', attrs: 'data-champ="lastName" autocomplete="off" autocapitalize="words"', cle: 'ee-nom' }),
        ],
      })}
      ${section({
        entete: 'Rôle',
        lignes: [selecteur({
          titre: 'Rôle',
          valeur: b.roleId,
          options: [...(roles.some((r) => r.id === b.roleId) ? [] : [[b.roleId, 'Autre']]), ...roles.map((r) => [r.id, r.name])],
          action: 'encadrement.role',
        })],
      })}
      ${section({
        entete: 'Contact',
        lignes: [
          ligneContact('phone.fill', 'green', 'phone', 'Téléphone', 'tel', 'inputmode="tel"'),
          ligneContact('envelope.fill', 'blue', 'email', 'Email', 'email', 'inputmode="email" autocapitalize="none" spellcheck="false"'),
        ],
      })}
      ${store.profils.length > 1 ? section({
        entete: 'Catégories',
        lignes: store.profils.map((pr) => {
          const choisi = b.profileIds.includes(pr.id);
          const col = M.couleur(M.couleurProfil(pr.colorIndex));
          return `<button type="button" class="ligne tactile" data-action="encadrement.categorie" data-id="${h(pr.id)}" aria-pressed="${choisi}" data-key="ec-${h(pr.id)}">
            <span class="eff-point-cat" style="background:${col}"></span>
            <span class="ligne-textes"><span class="ligne-titre">${h(pr.name)}</span></span>
            <span class="eff-coche-affect" style="color:${choisi ? col : 'var(--texte-2)'}">${icone(choisi ? 'checkmark.circle.fill' : 'circle')}</span>
          </button>`;
        }),
        pied: 'Sélectionnez les équipes encadrées par cette personne.',
      }) : ''}
      ${edition ? section({ lignes: [ligne({ titre: "Supprimer l'encadrant", icone: 'trash', couleurIcone: 'red', detruire: true, action: 'encadrement.supprimer', classe: 'avec-icone' })] }) : ''}
    </div>`,
  };
});

action('encadrement.champ', (el) => { pageCourante().params.brouillon[el.dataset.champ] = el.value; });
action('encadrement.role', (el) => { pageCourante().params.brouillon.roleId = el.value; });
action('encadrement.categorie', (el) => {
  const b = pageCourante().params.brouillon;
  const id = el.dataset.id;
  b.profileIds = b.profileIds.includes(id) ? b.profileIds.filter((x) => x !== id) : [...b.profileIds, id];
});

action('encadrement.enregistrer', () => {
  const p = pageCourante().params;
  const b = p.brouillon;
  if (b.firstName === '' && b.lastName === '') return false;
  const ids = [...b.profileIds];
  // Nouvel encadrant : toujours rattaché à la catégorie active
  if (p.id == null && store.profilActifId && !ids.includes(store.profilActifId)) ids.push(store.profilActifId);
  const membre = M.lireEncadrant({
    id: p.id ?? M.uuid(), firstName: b.firstName, lastName: b.lastName, roleId: b.roleId,
    phone: b.phone, email: b.email, photoData: b.photoData, profileIds: ids,
  });
  fermerFeuille();
  store.enregistrerEncadrant(membre);
});

action('encadrement.supprimer', () => {
  const p = pageCourante().params;
  confirmer({
    titre: 'Supprimer cet encadrant ?',
    faire: () => { fermerFeuille(); store.supprimerEncadrant(p.id); },
  });
});

// MARK: - Rôles d'encadrement (StaffRoleManagerView)

definirPage('encadrement.roles', (p) => {
  const roles = store.roles();
  const nouveauVide = p.nouveau.trim() === '';
  return {
    titre: "Rôles d'encadrement",
    gauche: '',
    sansFermer: true,
    droite: boutonBarre({ libelle: 'Terminé', action: 'nav.fermer', gras: true }),
    contenu: `<div class="colonne">
      ${section({
        entete: 'Rôles prédéfinis',
        lignes: roles.filter((r) => !r.isCustom).map((r) => ligne({
          titre: r.name, icone: 'tag.fill', couleurIcone: 'blue', valeur: 'Prédéfini', classe: 'avec-icone eff-role', cle: `rp-${r.id}`,
        })),
      })}
      ${section({
        entete: 'Rôles personnalisés',
        lignes: [
          ...roles.filter((r) => r.isCustom).map((r) => `<div class="ligne avec-icone" data-key="rc-${h(r.id)}">
            <span class="ligne-icone" style="color:${M.couleur('orange')}">${icone('tag.fill')}</span>
            <span class="ligne-textes"><span class="ligne-titre">${h(r.name)}</span></span>
            <button type="button" class="eff-poubelle" data-action="encadrement.supprimerRole" data-id="${h(r.id)}" aria-label="Supprimer ${h(r.name)}" title="Supprimer">${icone('trash')}</button>
          </div>`),
          `<div class="ligne ligne-champ" data-key="role-nouveau">
            <input class="champ" type="text" value="${h(p.nouveau)}" placeholder="Nouveau rôle…" data-input="encadrement.nouveauRole" data-entree="encadrement.ajouterRole" aria-label="Nouveau rôle" autocomplete="off">
            <button type="button" class="eff-ajout-role" data-action="encadrement.ajouterRole" ${nouveauVide ? 'disabled' : ''} aria-label="Ajouter le rôle" title="Ajouter">${icone('plus.circle.fill')}</button>
          </div>`,
        ],
        pied: 'Créez des rôles supplémentaires adaptés à votre organisation.',
      })}
    </div>`,
  };
});

action('encadrement.nouveauRole', (el) => { pageCourante().params.nouveau = el.value; });
action('encadrement.ajouterRole', () => {
  const p = pageCourante().params;
  const nom = p.nouveau.trim();
  if (nom === '') return false;
  store.ajouterRole(nom);
  p.nouveau = '';
  // Le champ garde le focus : on le vide à la main
  const champ = document.querySelector('[data-input="encadrement.nouveauRole"]');
  if (champ) champ.value = '';
});
action('encadrement.supprimerRole', (el) => {
  const id = el.dataset.id;
  confirmer({
    titre: 'Supprimer ce rôle ?',
    message: 'Les encadrants associés à ce rôle ne seront pas supprimés mais apparaîtront dans la section « Autre ».',
    faire: () => store.supprimerRole(id),
  });
});
