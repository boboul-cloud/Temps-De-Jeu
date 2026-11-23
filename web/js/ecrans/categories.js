// Onglet « Catégories » (ProfileManagementView.swift) : liste des catégories, création
// (NewProfileSheet), modification (EditProfileSheet), affectation des joueurs (PlayerAssignmentSheet).
// La suppression par balayage devient un bouton dans la fiche de modification.
import * as M from '../model.js';
import { store } from '../store.js';
import {
  definirPage, action, ouvrirFeuille, fermerFeuille, pageCourante, section, ligne, selecteur, boutonBarre,
  confirmer, alerte, copier, h, icone,
} from '../ui.js';
import { joueursFiltres, preparerAffectation, joueursDuGroupe } from './effectif/logique.js';
import { choixCouleur, recherche, valeurRecherche, champBrut } from './effectif/commun.js';

const c = (nom) => M.couleur(nom);
const couleurIndex = (i) => c(M.couleurProfil(i));

/** Ligne d'une catégorie (ProfileRow) */
function ligneCategorie(p, actif) {
  return `<div class="ligne tactile eff-ligne eff-avec-avatar eff-profil${actif ? ' actif' : ''}" role="button" tabindex="0" style="--c:${couleurIndex(p.colorIndex)}"
    data-action="categories.choisir" data-id="${h(p.id)}" data-key="p-${h(p.id)}">
    <span class="eff-rond-profil">${h(([...p.name][0] ?? '').toUpperCase())}</span>
    <span class="ligne-textes"><span class="ligne-titre gras">${h(p.name)}</span>
      <span class="eff-sous">${p.playerIds.length} joueurs${p.teamCode ? `<b class="eff-code-mini">Code: ${h(p.teamCode)}</b>` : ''}</span></span>
    ${actif ? `<span class="eff-coche">${icone('checkmark.circle.fill')}</span>` : ''}
    <button type="button" class="eff-crayon" data-action="categories.modifier" data-id="${h(p.id)}" aria-label="Modifier ${h(p.name)}" title="Modifier">${icone('pencil.circle')}</button>
  </div>`;
}

definirPage('categories.racine', () => {
  const profils = store.profils;
  const actif = store.profilActif();
  const liste = profils.length === 0
    ? section({
      lignes: `<div class="eff-vide-section">
        <span class="eff-vide-icone">${icone('person.2.badge.gearshape')}</span>
        <b>Aucune catégorie</b>
        <span>Créez un profil pour chaque catégorie que vous gérez.</span>
      </div>`,
      classe: 'eff-section-transparente',
    })
    : section({
      entete: `Mes catégories (${profils.length})`,
      lignes: profils.map((p) => ligneCategorie(p, p.id === store.profilActifId)),
      pied: 'Touchez un profil pour le sélectionner. Chaque profil a ses propres matchs, entraînements et saison.',
    });
  return {
    titre: 'Catégories',
    grandTitre: true,
    contenu: `<div class="colonne">
      ${liste}
      ${section({
        lignes: [ligne({
          contenu: '<span class="ligne-titre gras eff-petit-titre">Nouvelle catégorie</span>',
          icone: 'plus.circle.fill', couleurIcone: 'green', action: 'categories.nouvelle', classe: 'avec-icone', teinte: true,
        })],
      })}
      ${actif ? section({
        entete: 'Joueurs de la catégorie active',
        lignes: [ligne({
          contenu: `<span class="ligne-titre eff-petit-titre">Gérer les joueurs de ${h(actif.name)}</span><span class="ligne-sous-titre">${actif.playerIds.length} joueurs assignés</span>`,
          icone: 'person.badge.plus', couleurIcone: M.couleurProfil(actif.colorIndex), action: 'categories.affecter', classe: 'avec-icone', teinte: true,
        })],
        pied: 'Ajoutez ou retirez des joueurs de la base globale pour cette catégorie.',
      }) : ''}
    </div>`,
  };
});

action('categories.choisir', (el) => store.basculerProfil(el.dataset.id));

// MARK: - Code catégorie

const champCode = (valeur, input, cle) => champBrut({
  valeur, placeholder: 'Ex: A3K9F2', input, classe: 'eff-code-champ', cle,
  attrs: 'autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="12"', libelle: 'Code catégorie',
});

function codeCopiable(code, index) {
  return `<span class="eff-code" style="color:${couleurIndex(index)}">${h(code)}</span>
    <button type="button" class="eff-copier" data-action="categories.copierCode" aria-label="Copier le code" title="Copier">${icone('doc.on.doc')}</button>`;
}

action('categories.copierCode', async () => {
  const code = pageCourante().params.brouillon.teamCode;
  await copier(code);
  alerte('Code copié !', `Le code ${code} a été copié dans le presse-papier.`);
  return false;
});
action('categories.generer', () => { pageCourante().params.brouillon.teamCode = M.genererCode(); });
action('categories.champ', (el) => { pageCourante().params.brouillon[el.dataset.champ ?? 'name'] = el.value; });
action('categories.code', (el) => { pageCourante().params.brouillon.teamCode = el.value; });
action('categories.couleur', (el) => { pageCourante().params.brouillon.colorIndex = Number(el.dataset.index); });
action('categories.copie', (el) => { pageCourante().params.brouillon.copie = el.value; });

const champNom = (valeur, placeholder, cle) => champBrut({
  valeur, placeholder, input: 'categories.champ', cle, attrs: 'data-champ="name" autocomplete="off"',
});

// MARK: - Nouvelle catégorie (NewProfileSheet)

action('categories.nouvelle', () => {
  ouvrirFeuille('categories.nouvelle', { brouillon: { name: '', colorIndex: 0, teamCode: '', copie: '' } });
});

definirPage('categories.nouvelle', (p) => {
  const b = p.brouillon;
  const nomVide = b.name.trim() === '';
  return {
    titre: 'Nouvelle catégorie',
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Créer', action: 'categories.creer', gras: true, desactive: nomVide }),
    contenu: `<div class="colonne">
      ${section({
        entete: 'Nouvelle catégorie',
        lignes: [champNom(b.name, 'Nom de la catégorie (ex: U13, Seniors)', 'cn-nom'), choixCouleur(b.colorIndex, 'categories.couleur')],
      })}
      ${section({
        entete: 'Code catégorie',
        lignes: [
          `<div class="ligne eff-colonne">
            <span class="ligne-sous-titre">Êtes-vous l'entraîneur principal de cette catégorie ?</span>
            <button type="button" class="eff-lien" data-action="categories.generer">${icone('wand.and.stars')}<span>Générer un code</span></button>
            ${b.teamCode ? `<span class="eff-code-ligne">${codeCopiable(b.teamCode, b.colorIndex)}</span>` : ''}
          </div>`,
          `<div class="ligne eff-colonne eff-sans-bas"><span class="ligne-sous-titre">Ou saisir le code de l'entraîneur principal :</span></div>`,
          champCode(b.teamCode, 'categories.code', 'cn-code'),
        ],
        pied: "L'entraîneur principal génère un code unique et le communique aux adjoints. Les adjoints saisissent ce même code pour que les échanges de composition fonctionnent automatiquement.",
      })}
      ${store.profils.length ? section({
        entete: 'Joueurs',
        lignes: [selecteur({
          titre: 'Copier les joueurs de',
          valeur: b.copie,
          options: [['', 'Aucun'], ...store.profils.map((x) => [x.id, `${x.name} (${x.playerIds.length} joueurs)`])],
          action: 'categories.copie',
        })],
        pied: "Les joueurs copiés sont partagés — les modifications s'appliquent à toutes les catégories.",
      }) : ''}
    </div>`,
  };
});

action('categories.creer', () => {
  const b = pageCourante().params.brouillon;
  if (b.name.trim() === '') return false;
  const source = store.profils.find((x) => x.id === b.copie);
  const profil = store.creerProfil(b.name.trim(), b.colorIndex, source ? [...source.playerIds] : [], b.teamCode.trim().toUpperCase());
  store.basculerProfil(profil.id);
  fermerFeuille();
});

// MARK: - Modifier une catégorie (EditProfileSheet)

action('categories.modifier', (el) => {
  const p = store.profils.find((x) => x.id === el.dataset.id);
  if (!p) return;
  ouvrirFeuille('categories.edition', { id: p.id, brouillon: { name: p.name, colorIndex: p.colorIndex, teamCode: p.teamCode } });
});

definirPage('categories.edition', (p) => {
  const b = p.brouillon;
  const nomVide = b.name.trim() === '';
  return {
    titre: 'Modifier la catégorie',
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Enregistrer', action: 'categories.enregistrer', gras: true, desactive: nomVide }),
    contenu: `<div class="colonne">
      ${section({ lignes: [champNom(b.name, 'Nom', 'ce-nom'), choixCouleur(b.colorIndex, 'categories.couleur')] })}
      ${section({
        entete: 'Code catégorie',
        lignes: [
          b.teamCode
            ? `<div class="ligne"><span class="ligne-textes"><span class="ligne-titre">Code actuel</span></span>${codeCopiable(b.teamCode, b.colorIndex)}</div>`
            : '<div class="ligne"><span class="ligne-titre secondaire">Aucun code défini</span></div>',
          `<button type="button" class="ligne tactile teinte" data-action="categories.generer"><span class="ligne-icone">${icone('wand.and.stars')}</span><span class="ligne-textes"><span class="ligne-titre">Générer un nouveau code</span></span></button>`,
          `<div class="ligne eff-colonne eff-sans-bas"><span class="ligne-sous-titre">Ou saisir le code de l'entraîneur principal :</span></div>`,
          champCode(b.teamCode, 'categories.code', 'ce-code'),
        ],
        pied: "L'entraîneur principal génère un code et le communique aux adjoints. Les adjoints saisissent ce même code pour que les imports arrivent automatiquement sur la bonne catégorie.",
      })}
      ${store.profils.length > 1 ? section({
        lignes: [ligne({ titre: 'Supprimer la catégorie', icone: 'trash', couleurIcone: 'red', detruire: true, action: 'categories.supprimer', classe: 'avec-icone' })],
      }) : ''}
    </div>`,
  };
});

action('categories.enregistrer', () => {
  const p = pageCourante().params;
  const b = p.brouillon;
  const profil = store.profils.find((x) => x.id === p.id);
  if (!profil || b.name.trim() === '') return false;
  fermerFeuille();
  store.majProfil({ ...profil, name: b.name.trim(), colorIndex: b.colorIndex, teamCode: b.teamCode.trim().toUpperCase() });
});

action('categories.supprimer', () => {
  const p = pageCourante().params;
  confirmer({
    titre: 'Supprimer cette catégorie ?',
    message: 'Les matchs, entraînements et saison de cette catégorie seront supprimés. Les joueurs restent dans la base globale.',
    faire: () => { fermerFeuille(); store.supprimerProfil(p.id); },
  });
});

// MARK: - Joueurs de la catégorie (PlayerAssignmentSheet)

action('categories.affecter', () => {
  const profil = store.profilActif();
  if (!profil) return;
  const tous = store.tousLesJoueurs();
  // Couleurs et groupes figés à l'ouverture, comme l'app
  const { infos, ordre } = preparerAffectation(profil, tous, store.profils);
  ouvrirFeuille('categories.affectation', {
    profilId: profil.id, tous, infos, ordre, profils: store.profils.map((x) => ({ ...x })), assignes: new Set(profil.playerIds), recherche: '',
  });
});

function ligneAffectation(joueur, p, profil) {
  const choisi = p.assignes.has(joueur.id);
  const info = p.infos[joueur.id];
  const couleurNom = info ? c(info.couleur) : 'var(--texte)';
  const badge = info?.autre ?? false;
  const couleurCoche = choisi ? (badge ? couleurNom : couleurIndex(profil.colorIndex)) : 'var(--texte-2)';
  return `<button type="button" class="ligne tactile eff-ligne" data-action="categories.basculer" data-id="${h(joueur.id)}" data-key="a-${h(joueur.id)}" aria-pressed="${choisi}">
    <span class="eff-coche-affect" style="color:${couleurCoche}">${icone(choisi ? 'checkmark.circle.fill' : 'circle')}</span>
    <span class="ligne-textes"><span class="ligne-titre eff-petit-titre" style="color:${couleurNom}">${h(M.fullName(joueur))}</span><span class="ligne-sous-titre">${h(joueur.position)}</span></span>
    ${badge ? `<span class="eff-point-cat" style="background:${couleurNom}"></span>` : ''}
  </button>`;
}

definirPage('categories.affectation', (p) => {
  const profil = p.profils.find((x) => x.id === p.profilId) ?? store.profilActif();
  const filtres = joueursFiltres(p.tous, p.recherche);
  const groupes = p.ordre.map((g) => {
    const joueurs = joueursDuGroupe(g, filtres, p.infos, p.profils);
    if (!joueurs.length) return '';
    return section({
      cle: `g-${g.id}`,
      entete: `${g.colorIndex >= 0 ? `<span class="eff-point-cat" style="background:${couleurIndex(g.colorIndex)}"></span>` : ''}${h(g.name)} (${joueurs.length})`,
      lignes: joueurs.map((j) => ligneAffectation(j, p, profil)),
    });
  }).join('');
  return {
    titre: `Joueurs — ${profil?.name ?? ''}`,
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Enregistrer', action: 'categories.affectationEnregistrer', gras: true }),
    contenu: `<div class="colonne">
      ${recherche({ valeur: p.recherche, action: 'categories.rechercheAffect', placeholder: 'Rechercher', cle: 'affect-recherche' })}
      ${section({ lignes: [ligne({ titre: 'Joueurs assignés', valeur: `${p.assignes.size} / ${p.tous.length}` })] })}
      ${groupes}
    </div>`,
    pied: `<div class="eff-barre-bas">
      <button type="button" class="bouton texte petit" data-action="categories.toutSelectionner">Tout sélectionner</button>
      <button type="button" class="bouton texte petit" data-action="categories.toutDeselectionner">Tout désélectionner</button>
    </div>`,
  };
});

action('categories.rechercheAffect', (el) => { pageCourante().params.recherche = valeurRecherche(el); });
action('categories.basculer', (el) => {
  const s = pageCourante().params.assignes;
  if (s.has(el.dataset.id)) s.delete(el.dataset.id); else s.add(el.dataset.id);
});
action('categories.toutSelectionner', () => {
  const p = pageCourante().params;
  p.assignes = new Set(p.tous.map((j) => j.id));
});
action('categories.toutDeselectionner', () => { pageCourante().params.assignes = new Set(); });
action('categories.affectationEnregistrer', () => {
  const p = pageCourante().params;
  const profil = store.profils.find((x) => x.id === p.profilId);
  fermerFeuille();
  if (profil) store.majProfil({ ...profil, playerIds: [...p.assignes] });
});
