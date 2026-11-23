// Préparation du match (MatchSetupView.swift) : informations, maillots, arbitres, composition
// (MatchRosterView.swift), placement, partage de la composition (PDF, fichier .tdj, lien) et
// import d'une composition d'une catégorie supérieure (cascade A → B → C).
// Tout est gratuit : pas de bannière « Version gratuite » ni de limite de matchs.
import * as M from '../../model.js';
import { store } from '../../store.js';
import {
  definirPage, action, ouvrirFeuille, fermerFeuille, alerte, confirmer, choix, h, icone, segmente, boutonBarre,
  bouton, partager, apercuPDF, choisirFichier, valeurDateHeure, dateDepuisChamp, pageExiste, rafraichir, etat,
} from '../../ui.js';
import { vm, MatchViewModel } from './vm.js';
import { avatarJoueur, COULEUR_POSTE, maillotIcone } from './commun.js';
import { genererPDFComposition, titreComposition } from '../../rapports/composition.js';

/** État de la préparation propre à l'écran (unavailablePlayerIds, importChain, targetTeamCode) */
export const prep = { unavailablePlayerIds: new Set(), importChain: [], targetTeamCode: '' };

export function chargerPrep() {
  const d = MatchViewModel.loadDraft();
  prep.unavailablePlayerIds = new Set(d?.unavailablePlayerIds ?? []);
  prep.importChain = d?.importChain ?? [];
}

export function viderPrep() {
  prep.unavailablePlayerIds = new Set();
  prep.importChain = [];
}

/** Sauvegarde le brouillon (infos du match + composition + imports) */
export function saveDraftState() {
  vm.saveDraft([...prep.unavailablePlayerIds], prep.importChain);
}

const couleurDispo = (d) => M.couleur(M.DISPO_COULEUR[d] ?? 'green');
const parNom = (a, b) => M.comparer(a.lastName, b.lastName);
const nomMonEquipe = () => (M.myTeamName(vm.match) === '' ? 'Mon équipe' : M.myTeamName(vm.match));

// MARK: - Écran

function champTexte(placeholder, champ, ic) {
  return `<label class="m-champ" data-key="champ-${champ}">${icone(ic)}
    <input type="text" value="${h(vm.match[champ])}" placeholder="${h(placeholder)}" data-input="match.prep.champ" data-champ="${champ}" autocomplete="off" aria-label="${h(placeholder)}">
  </label>`;
}

function choixMaillot(cote) {
  const valeur = cote === 'home' ? vm.match.homeJerseyColor : vm.match.awayJerseyColor;
  const nom = cote === 'home' ? (vm.match.homeTeam || 'Domicile') : (vm.match.awayTeam || 'Extérieur');
  const m = M.maillot(valeur);
  return `<div class="m-maillot-col">
    <span class="m-maillot-nom">${h(nom)}</span>
    <button type="button" class="m-maillot-bouton" style="--c:${m.css}" data-action="match.prep.maillot" data-cote="${cote}">
      ${maillotIcone(valeur, 20)}<b>${h(valeur)}</b><span class="secondaire">${icone('chevron.down')}</span>
    </button>
  </div>`;
}

function puces(joueurs, couleur) {
  if (!joueurs.length) return '';
  return `<div class="m-puces">${[...joueurs].sort((a, b) => a.shirtNumber - b.shirtNumber).map((mp) => `
    <span class="m-puce" style="--c:${M.couleur(couleur)}">${mp.isCaptain ? `<span class="m-etoile">${icone('star.fill')}</span>` : ''}#${mp.shirtNumber} ${h(M.matchPlayerDisplayName(mp))}</span>`).join('')}</div>`;
}

function resumeComposition(tous) {
  const tit = vm.titulaires;
  const remp = vm.remplacants;
  const indispo = tous.filter((p) => p.availability !== 'Disponible').sort(parNom);
  return `<div class="m-bloc">
    <div class="m-compteurs">
      <div><b style="color:var(--vert)">${tit.length}</b><span>Titulaires</span></div>
      <div><b style="color:var(--orange)">${remp.length}</b><span>Remplaçants</span></div>
    </div>
    ${puces(tit, 'green')}
    ${puces(remp, 'orange')}
    ${indispo.length ? `<div class="m-indispo">
      <span class="m-indispo-titre">${icone('person.slash.fill')} Indisponibles (${indispo.length})</span>
      <div class="m-puces">${indispo.map((p) => `<span class="m-puce m-puce-indispo" style="--c:${couleurDispo(p.availability)}">
        <span style="color:${couleurDispo(p.availability)}">${icone(M.DISPO_ICONE[p.availability])}</span>
        <s>${h(M.displayName(p))}</s><small style="color:${couleurDispo(p.availability)}">(${h(p.availability)})</small></span>`).join('')}</div>
    </div>` : ''}
    <div class="m-actions-compo">
      <button type="button" class="m-lien" style="color:var(--bleu)" data-action="match.prep.composer">${icone('pencil')}<b>Modifier</b></button>
      <button type="button" class="m-lien" style="color:var(--vert)" data-action="match.prep.placement">${icone('sportscourt.fill')}<b>Placement</b></button>
      <button type="button" class="m-lien" style="color:var(--rouge)" data-action="match.prep.supprimerCompo">${icone('trash')}<b>Supprimer</b></button>
    </div>
    <div class="m-separateur"></div>
    <div class="m-partage">
      <span class="m-petit secondaire">Partager la composition</span>
      <label class="m-code">${icone('qrcode')}<span>Code catégorie dest.</span>
        <input type="text" value="${h(prep.targetTeamCode)}" placeholder="Ex: A3K9F2" maxlength="6" autocapitalize="characters"
          data-input="match.prep.code" data-key="code-dest" autocomplete="off" aria-label="Code catégorie destinataire">
      </label>
      <div class="m-boutons-partage">
        <button type="button" class="m-pastille-bouton" style="--c:var(--rouge)" data-action="match.prep.pdf">${icone('doc.richtext')}PDF</button>
        <button type="button" class="m-pastille-bouton" style="--c:var(--vert)" data-action="match.prep.fichier">${icone('doc.fill')}Fichier</button>
        <button type="button" class="m-pastille-bouton" style="--c:var(--bleu)" data-action="match.prep.lien">${icone('link')}Lien</button>
      </div>
    </div>
  </div>`;
}

export function rendrePreparation() {
  const tous = store.joueurs();
  const domicile = vm.match.isMyTeamHome;
  const n = prep.unavailablePlayerIds.size;
  return {
    titre: '',
    barre: false,
    classe: 'm-prep',
    contenu: `<div class="colonne m-prep-colonne">
      <div class="m-logo">
        <span class="m-logo-icone">${icone('sportscourt.fill')}</span>
        <h1>Temps De Jeu</h1>
        <p>Gestion du temps effectif</p>
      </div>

      <section class="m-carte">
        <div class="m-entete">${icone('info.circle')}<span>Informations du match</span></div>
        <div class="m-groupe">
          <span class="m-sous">Mon équipe joue</span>
          ${segmente({
            valeur: String(domicile), action: 'match.prep.domicile',
            options: [['true', `${icone('house.fill')} À domicile`], ['false', `${icone('airplane')} À l'extérieur`]],
          })}
        </div>
        ${champTexte(domicile ? 'Mon équipe (domicile)' : 'Équipe domicile', 'homeTeam', domicile ? 'star.fill' : 'house.fill')}
        ${champTexte(domicile ? 'Adversaire (extérieur)' : 'Mon équipe (extérieur)', 'awayTeam', domicile ? 'airplane' : 'star.fill')}
        ${champTexte('Compétition', 'competition', 'trophy.fill')}
        <label class="m-date" data-key="date-match"><span style="color:var(--vert)">${icone('calendar')}</span>
          <input type="datetime-local" value="${valeurDateHeure(vm.match.date)}" data-change="match.prep.date" aria-label="Date du match">
        </label>
        <div class="m-groupe">
          <span class="m-sous">Couleurs de maillot</span>
          <div class="m-maillots">${choixMaillot('home')}${choixMaillot('away')}</div>
        </div>
        <div class="m-groupe">
          <span class="m-sous">Arbitres</span>
          ${champTexte('Arbitre central', 'refereeCentre', 'person.fill')}
          ${champTexte('Arbitre assistant 1', 'refereeAssistant1', 'flag.fill')}
          ${champTexte('Arbitre assistant 2', 'refereeAssistant2', 'flag.fill')}
        </div>
      </section>

      <section class="m-carte">
        <div class="m-entete">${icone('person.3.fill')}<span>Composition</span></div>
        ${vm.matchRoster.length === 0 ? `
          <button type="button" class="m-bloc m-bouton-ligne" data-action="match.prep.composer">
            <span class="m-bouton-ligne-icone">${icone('person.badge.plus')}</span>
            <span class="m-bouton-ligne-textes"><b>Composer l'équipe</b><small>Sélectionner les joueurs pour ce match</small></span>
            <span class="secondaire">${icone('chevron.right')}</span>
          </button>` : resumeComposition(tous)}
        <button type="button" class="m-bloc m-bouton-ligne m-import" data-action="match.prep.importer">
          <span style="color:var(--vert)">${icone('square.and.arrow.down')}</span>
          <span class="m-bouton-ligne-textes"><b>Importer joueurs disponibles</b><small>Depuis l'export d'une catégorie supérieure</small></span>
          <span class="secondaire">${icone('chevron.right')}</span>
        </button>
        ${n ? `<div class="m-info-indispo">
          <span style="color:var(--orange)">${icone('info.circle.fill')}</span>
          <span class="m-bouton-ligne-textes"><b>${n} joueur${n > 1 ? 's' : ''} indisponible${n > 1 ? 's' : ''}</b>
            ${prep.importChain.length ? `<small>Déjà sélectionné${n > 1 ? 's' : ''} par : ${h(prep.importChain.join(', '))}</small>` : ''}</span>
          <button type="button" class="secondaire" data-action="match.prep.effacerIndispo" aria-label="Effacer">${icone('xmark.circle.fill')}</button>
        </div>` : ''}
      </section>

      <button type="button" class="m-demarrer" data-action="match.demarrer">${icone('play.fill')}<span>Démarrer le match</span></button>
    </div>`,
  };
}

// MARK: - Actions de l'écran

action('match.prep.champ', (el) => {
  vm.match[el.dataset.champ] = el.value;
  saveDraftState();
});
action('match.prep.domicile', (el) => {
  vm.match.isMyTeamHome = el.dataset.valeur === 'true';
  saveDraftState();
});
action('match.prep.date', (el) => {
  vm.match.date = dateDepuisChamp(el.value, vm.match.date);
  saveDraftState();
});
action('match.prep.code', (el) => {
  const propre = el.value.toUpperCase().slice(0, 6);
  if (el.value !== propre) el.value = propre;
  prep.targetTeamCode = propre;
  return false;
});
action('match.prep.maillot', (el) => {
  const cote = el.dataset.cote;
  ouvrirFeuille('match.maillot', { cote, libelle: cote === 'home' ? 'DOM' : 'EXT' });
});
action('match.prep.composer', () => {
  const tous = store.joueurs();
  ouvrirFeuille('match.composition', {
    allPlayers: tous,
    selection: new Map(vm.matchRoster.map((mp) => [mp.id, { ...mp }])),
    unavailable: new Set(prep.unavailablePlayerIds),
    autres: MatchViewModel.playerIdsSelectedInOtherCategories(tous),
    recherche: '',
    edition: null,
  });
});
action('match.prep.placement', () => {
  if (!pageExiste('placement')) {
    alerte('Placement', "Le placement des joueurs n'est pas encore disponible dans cette version.");
    return;
  }
  const m = vm.match;
  ouvrirFeuille('placement', {
    roster: vm.matchRoster.map((mp) => ({ ...mp })),
    jerseyColor: m.isMyTeamHome ? m.homeJerseyColor : m.awayJerseyColor,
    opponentJerseyColor: m.isMyTeamHome ? m.awayJerseyColor : m.homeJerseyColor,
    savedFormation: m.selectedFormation ?? null,
    surEnregistrer: (positions, formationName) => {
      vm.saveFormationPositions(positions ?? {}, formationName ?? null);
      saveDraftState();
      rafraichir();
    },
  }, { plein: true });
});
action('match.prep.supprimerCompo', () => {
  confirmer({
    titre: 'Supprimer la composition',
    message: 'Voulez-vous vraiment supprimer la composition actuelle ? Cette action est irréversible.',
    faire: () => { vm.clearMatchRoster(); saveDraftState(); },
  });
});
action('match.prep.effacerIndispo', () => {
  prep.unavailablePlayerIds = new Set();
  prep.importChain = [];
  saveDraftState();
});

// MARK: - Partage de la composition

function exportComposition(excludePhotos) {
  const code = prep.targetTeamCode.trim();
  return M.composerExportComposition({
    allPlayers: store.joueurs(),
    selectedPlayerIds: vm.matchRoster.map((mp) => mp.id),
    teamName: nomMonEquipe(),
    competition: vm.match.competition,
    matchDate: vm.match.date,
    previousUnavailableIds: [...prep.unavailablePlayerIds],
    previousChain: prep.importChain,
    excludePhotos,
    targetTeamCode: code === '' ? undefined : code,
  });
}

action('match.prep.pdf', () => {
  const equipe = nomMonEquipe();
  const octets = genererPDFComposition({
    roster: vm.matchRoster,
    teamName: equipe,
    competition: vm.match.competition,
    matchDate: vm.match.date,
    opponent: M.opponentName(vm.match),
  });
  const titre = titreComposition(equipe, vm.match.date);
  apercuPDF(octets, `${titre}.pdf`, titre);
});

action('match.prep.fichier', () => {
  const roster = exportComposition(false);
  partager({
    fichiers: [{ nom: M.nomFichierComposition(nomMonEquipe(), vm.match.date), contenu: M.ecrireComposition(roster), type: 'application/json' }],
  });
  return false;
});

action('match.prep.lien', async () => {
  const roster = exportComposition(true);
  const choisis = new Set(vm.matchRoster.map((mp) => mp.id));
  const disponibles = store.joueurs().filter((p) => !choisis.has(p.id) && !prep.unavailablePlayerIds.has(p.id) && p.availability === 'Disponible').length;
  let lien;
  try { lien = await M.lienComposition(roster); } catch { alerte('Erreur', 'Impossible de créer le lien.'); return; }
  // Message de createShareMessage ; le lien ouvre la version web (l'app iPhone lit le fichier .tdj)
  const message = `⚽️ Joueurs disponibles - ${nomMonEquipe()}\n📅 ${M.formatDate(vm.match.date, 'long')}\n👥 ${disponibles} joueurs disponibles\n\nTouche le lien pour importer:\n${lien}`;
  partager({ texte: message });
});

// MARK: - Import d'une composition (cascade)

action('match.prep.importer', async () => {
  const [f] = await choisirFichier({ accept: '.tdj,.json,application/json' });
  if (!f) return;
  let texte;
  try { texte = await f.text(); } catch (e) { alerte('Erreur', `Impossible de lire le fichier : ${e.message}`); return; }
  const o = M.lireJSON(texte);
  const roster = M.lireComposition(o);
  if (roster) { processRosterImport(roster); rafraichir(); return; }
  if (M.lireJoueursJSON(o)?.players) {
    alerte('Format non reconnu', "Ce fichier contient une liste de joueurs simple. Utilisez l'import classique dans Export/Import.");
    return;
  }
  alerte('Erreur', "Le fichier n'est pas un export de composition valide.");
});

/**
 * Traite une composition reçue (fichier, lien, import) : correspondance par prénom + nom,
 * joueurs pris par les catégories supérieures marqués indisponibles, disponibilités mises à jour.
 */
export function processRosterImport(r) {
  if (r.targetTeamCode) {
    const cible = store.profils.find((p) => p.teamCode.toUpperCase() === r.targetTeamCode.toUpperCase());
    if (cible && cible.id !== store.profilActifId) store.basculerProfil(cible.id);
  }
  const tous = store.joueurs();
  const norm = (p) => `${p.firstName.trim().toLowerCase()}_${p.lastName.trim().toLowerCase()}`;
  const locaux = new Map(tous.map((p) => [norm(p), p]));
  const importes = new Map();
  for (const p of r.selectedPlayers) importes.set(p.id, p);
  for (const p of r.unavailablePlayers ?? []) importes.set(p.id, p);
  const versLocal = new Map();
  for (const [id, p] of importes) { const local = locaux.get(norm(p)); if (local) versLocal.set(id, local.id); }
  prep.unavailablePlayerIds = new Set(r.unavailablePlayerIds.map((id) => {
    if (versLocal.has(id)) return versLocal.get(id);
    if (tous.some((p) => p.id === id)) return id;
    return null;
  }).filter(Boolean));
  prep.importChain = [...r.selectionChain];

  let changes = false;
  for (const imp of r.unavailablePlayers ?? []) {
    const local = locaux.get(norm(imp));
    const j = local ? tous.find((p) => p.id === local.id) : null;
    if (j && j.availability !== imp.availability) { j.availability = imp.availability; changes = true; }
  }
  if (changes) store.enregistrerJoueurs(tous);

  const n = prep.unavailablePlayerIds.size;
  const cascade = r.selectionChain.length ? `\nCascade : ${r.selectionChain.join(' → ')}` : '';
  const categorie = store.profilActif()?.name ?? 'cette catégorie';
  alerte('Composition importée', `${n} joueur${n > 1 ? 's' : ''} marqué${n > 1 ? 's' : ''} indisponible${n > 1 ? 's' : ''} dans ${categorie}.${cascade}`);
  saveDraftState();
}

// MARK: - Choix du maillot (JerseyColorPickerSheet)

definirPage('match.maillot', (p) => {
  const champ = p.cote === 'home' ? 'homeJerseyColor' : 'awayJerseyColor';
  const actuel = vm.match[champ];
  return {
    titre: `Maillot ${p.libelle}`,
    gauche: '',
    droite: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }),
    contenu: `<div class="m-grille-maillots">${M.MAILLOTS.map((m) => {
      const choisi = m.id === actuel;
      return `<button type="button" class="m-case-maillot${choisi ? ' choisi' : ''}" style="--c:${m.css}" data-action="match.maillot.choisir" data-valeur="${h(m.id)}" data-champ="${champ}">
        <span class="m-case-maillot-icone">${maillotIcone(m.id, 36)}${choisi ? `<span class="m-coche">${icone('checkmark.circle.fill')}</span>` : ''}</span>
        <span>${h(m.id)}</span>
      </button>`;
    }).join('')}</div>`,
  };
});
action('match.maillot.choisir', (el) => {
  vm.match[el.dataset.champ] = el.dataset.valeur;
  saveDraftState();
  fermerFeuille('match.maillot');
});

// MARK: - Composition (MatchRosterView)

function rosterParams() {
  const f = etat.feuilles[etat.feuilles.length - 1];
  return f?.page === 'match.composition' ? f.params : null;
}

const disponiblesRoster = (p) => p.allPlayers.filter((j) => !p.unavailable.has(j.id) && !(j.id in p.autres) && j.availability === 'Disponible');
const nbTitulaires = (p) => [...p.selection.values()].filter((mp) => mp.status === 'Titulaire').length;

function ligneSelection(p, joueur) {
  const mp = p.selection.get(joueur.id);
  const choisi = Boolean(mp);
  const couleurPoste = M.couleur(COULEUR_POSTE[joueur.position]);
  const statut = mp ? `<button type="button" class="m-statut" style="--c:${mp.status === 'Titulaire' ? 'var(--vert)' : 'var(--orange)'}"
      data-action="match.compo.statut" data-id="${joueur.id}">${mp.isCaptain ? `<span class="m-etoile">${icone('star.fill')}</span>` : ''}${h(mp.status)}</button>` : '';
  const edition = choisi && p.edition === joueur.id ? `<div class="m-numero">
      <span class="secondaire">N° maillot pour ce match :</span>
      <input type="text" inputmode="numeric" value="${h(p.numero)}" data-input="match.compo.numeroTexte" data-entree="match.compo.numeroOk" data-id="${joueur.id}" data-autofocus data-key="num-${joueur.id}" aria-label="Numéro">
      <button type="button" class="m-lien" style="color:var(--teinte)" data-action="match.compo.numeroOk" data-id="${joueur.id}"><b>OK</b></button>
    </div>` : '';
  return `<div class="m-ligne-joueur${choisi ? ' choisi' : ''}" data-key="sel-${joueur.id}">
    <div class="m-ligne-joueur-haut">
      <button type="button" class="m-case" data-action="match.compo.basculer" data-id="${joueur.id}" aria-label="${choisi ? 'Retirer' : 'Sélectionner'}"
        style="color:${choisi ? 'var(--vert)' : 'var(--gris)'}">${icone(choisi ? 'checkmark.circle.fill' : 'circle')}</button>
      <button type="button" class="m-avatar-bouton" data-action="match.compo.editerNumero" data-id="${joueur.id}" aria-label="Numéro de maillot">
        ${avatarJoueur(joueur, 40)}${mp ? `<span class="m-badge-numero" style="background:${couleurPoste}">${mp.shirtNumber}</span>` : ''}
      </button>
      <span class="m-ligne-joueur-textes"><b>${h(M.fullName(joueur) || 'Joueur')}</b><small>${h(joueur.position)}</small></span>
      ${statut}
    </div>
    ${edition}
  </div>`;
}

function ligneIndispo(joueur, droite, gauche = '') {
  return `<div class="m-ligne-joueur grise" data-key="ind-${joueur.id}"><div class="m-ligne-joueur-haut">
    ${gauche}<span class="m-attenue">${avatarJoueur(joueur, 36, false)}</span>
    <span class="m-ligne-joueur-textes"><s>${h(M.fullName(joueur) || 'Joueur')}</s><small>${h(joueur.position)}</small></span>
    ${droite}
  </div></div>`;
}

definirPage('match.composition', (p) => {
  const dispo = disponiblesRoster(p);
  const q = p.recherche.trim().toLocaleLowerCase('fr');
  const filtres = [...dispo].sort(parNom).filter((j) => q === '' || M.fullName(j).toLocaleLowerCase('fr').includes(q));
  const autres = p.allPlayers.filter((j) => j.id in p.autres && !p.unavailable.has(j.id)).sort(parNom);
  const indispos = p.allPlayers.filter((j) => p.unavailable.has(j.id)).sort(parNom);
  const absents = p.allPlayers.filter((j) => j.availability !== 'Disponible' && !p.unavailable.has(j.id) && !(j.id in p.autres)).sort(parNom);
  const sel = p.selection.size;
  const tit = nbTitulaires(p);
  const enTete = `<div class="m-resume-selection">
    <div><b style="color:var(--bleu)">${sel}</b><span>Sélectionnés</span></div>
    <div><b style="color:var(--vert)">${tit}</b><span>Titulaires</span></div>
    <div><b style="color:var(--orange)">${sel - tit}</b><span>Remplaçants</span></div>
  </div>`;
  if (!p.allPlayers.length) {
    return {
      titre: 'Composition',
      gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
      droite: boutonBarre({ libelle: 'Valider', action: 'match.compo.valider', gras: true, desactive: true }),
      classe: 'sans-marge',
      contenu: `${enTete}<div class="vide"><span class="vide-icone">${icone('person.3.fill')}</span>
        <p class="vide-titre secondaire" style="font-size:17px">Aucun joueur dans l'effectif</p>
        <p class="vide-message">Ajoutez des joueurs dans l'onglet<br>"Joueurs" avant de composer le match.</p></div>`,
    };
  }
  const badge = (texte, couleur) => `<span class="pastille" style="--c:${couleur}">${h(texte)}</span>`;
  return {
    titre: 'Composition',
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Valider', action: 'match.compo.valider', gras: true, desactive: sel === 0 }),
    classe: 'sans-marge',
    contenu: `${enTete}<div class="m-compo-liste">
      <div class="recherche">${icone('magnifyingglass')}<input type="search" placeholder="Rechercher un joueur" value="${h(p.recherche)}" data-input="match.compo.recherche" data-key="compo-recherche" aria-label="Rechercher un joueur"></div>
      <div class="boutons m-selection-rapide">
        <button type="button" class="bouton petit teinte" style="--bouton:var(--bleu)" data-action="match.compo.tout">Tout sélect.</button>
        <button type="button" class="bouton petit teinte" style="--bouton:var(--rouge)" data-action="match.compo.rien">Tout désélect.</button>
      </div>
      <section class="section">
        ${p.unavailable.size || Object.keys(p.autres).length ? `<h2 class="section-entete">Joueurs disponibles (${dispo.length})</h2>` : ''}
        <div class="section-corps">${filtres.map((j) => ligneSelection(p, j)).join('')}</div>
      </section>
      ${autres.length ? `<section class="section">
        <h2 class="section-entete"><span style="color:var(--indigo)">${icone('person.2.slash.fill')}</span>Sélectionnés dans une autre catégorie (${autres.length})</h2>
        <div class="section-corps">${autres.map((j) => ligneIndispo(j, badge(p.autres[j.id] ?? 'Autre catégorie', 'var(--indigo)'),
          `<span class="m-icone-etat" style="color:color-mix(in srgb, var(--indigo) 60%, transparent)">${icone('person.crop.circle.badge.exclamationmark.fill')}</span>`)).join('')}</div>
      </section>` : ''}
      ${indispos.length ? `<section class="section">
        <h2 class="section-entete">Indisponibles — catégorie supérieure (${indispos.length})</h2>
        <div class="section-corps">${indispos.map((j) => ligneIndispo(j,
          j.availability !== 'Disponible' ? badge(j.availability, couleurDispo(j.availability)) : badge('Indisponible', 'var(--rouge)'),
          `<span class="m-icone-etat" style="color:color-mix(in srgb, ${j.availability !== 'Disponible' ? couleurDispo(j.availability) : 'var(--rouge)'} 50%, transparent)">${icone('xmark.circle.fill')}</span>`)).join('')}</div>
      </section>` : ''}
      ${absents.length ? `<section class="section">
        <h2 class="section-entete"><span style="color:var(--orange)">${icone('person.slash.fill')}</span>Blessés / Absents / Suspendus (${absents.length})</h2>
        <div class="section-corps">${absents.map((j) => ligneIndispo(j, badge(j.availability, couleurDispo(j.availability)))).join('')}</div>
      </section>` : ''}
    </div>`,
  };
});

action('match.compo.recherche', (el) => { const p = rosterParams(); if (p) p.recherche = el.value; });

function renumeroter(p) {
  const tries = [...p.selection.values()].sort((a, b) => a.shirtNumber - b.shirtNumber);
  tries.forEach((mp, i) => { mp.shirtNumber = i + 1; });
}

action('match.compo.basculer', (el) => {
  const p = rosterParams();
  if (!p) return;
  const id = el.dataset.id;
  if (p.selection.has(id)) {
    p.selection.delete(id);
    if (p.edition === id) p.edition = null;
    renumeroter(p);
  } else {
    const joueur = p.allPlayers.find((j) => j.id === id);
    const suivant = Math.max(0, ...[...p.selection.values()].map((mp) => mp.shirtNumber)) + 1;
    p.selection.set(id, M.matchPlayerDe(joueur, nbTitulaires(p) < 11 ? 'Titulaire' : 'Remplaçant', suivant));
  }
});

action('match.compo.tout', () => {
  const p = rosterParams();
  if (!p) return;
  let suivant = 1;
  for (const mp of p.selection.values()) if (mp.shirtNumber >= suivant) suivant = mp.shirtNumber + 1;
  for (const j of disponiblesRoster(p)) {
    if (p.selection.has(j.id)) continue;
    p.selection.set(j.id, M.matchPlayerDe(j, nbTitulaires(p) < 11 ? 'Titulaire' : 'Remplaçant', suivant));
    suivant += 1;
  }
});

action('match.compo.rien', () => { const p = rosterParams(); if (p) { p.selection.clear(); p.edition = null; } });

action('match.compo.editerNumero', (el) => {
  const p = rosterParams();
  const mp = p?.selection.get(el.dataset.id);
  if (!mp) return;
  p.numero = String(mp.shirtNumber);
  p.edition = p.edition === el.dataset.id ? null : el.dataset.id;
});
action('match.compo.numeroTexte', (el) => { const p = rosterParams(); if (p) p.numero = el.value; return false; });
action('match.compo.numeroOk', (el) => {
  const p = rosterParams();
  const mp = p?.selection.get(el.dataset.id);
  if (!mp) return;
  const n = Number.parseInt(p.numero, 10);
  if (Number.isInteger(n) && /^\s*-?\d+\s*$/.test(p.numero)) mp.shirtNumber = n;
  p.edition = null;
});

action('match.compo.statut', (el) => {
  const p = rosterParams();
  const mp = p?.selection.get(el.dataset.id);
  if (!mp) return;
  const coche = (s) => (mp.status === s ? '✓ ' : '');
  choix({
    actions: [
      { libelle: `${coche('Titulaire')}Titulaire`, faire: () => { mp.status = 'Titulaire'; rafraichir(); } },
      { libelle: `${coche('Remplaçant')}Remplaçant`, faire: () => { mp.status = 'Remplaçant'; rafraichir(); } },
      {
        libelle: mp.isCaptain ? 'Retirer capitaine' : 'Désigner capitaine',
        icone: 'star.fill',
        faire: () => {
          const etait = mp.isCaptain;
          for (const x of p.selection.values()) x.isCaptain = false;
          if (!etait) mp.isCaptain = true;
          rafraichir();
        },
      },
    ],
  });
});

action('match.compo.valider', () => {
  const p = rosterParams();
  if (!p || !p.selection.size) return;
  vm.setMatchRoster([...p.selection.values()]);
  saveDraftState();
  fermerFeuille('match.composition');
});
