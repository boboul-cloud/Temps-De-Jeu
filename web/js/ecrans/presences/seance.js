// Nouvel entraînement (NewTrainingSessionView) et fiche d'un entraînement
// (TrainingSessionDetailView) : date et heure, notes, lieu, pointage des présents,
// joueurs invités des autres catégories, feuille de présence PDF, sondage, suppression.
import * as M from '../../model.js';
import { store } from '../../store.js';
import {
  definirPage, action, section, ligne, champ, boutonBarre, avatar, initiales, pastille, icone, h,
  ouvrirFeuille, fermerFeuille, choix, apercuPDF, valeurDate, dateDepuisChamp,
} from '../../ui.js';
import {
  joueursInvites, invitesParCategorie, construirePresences, triParNom, correspond,
} from './logique.js';
import { feuillePresencePDF } from '../../rapports/entrainements.js';

/** Formulaire ouvert (un seul à la fois : nouvel entraînement ou fiche) */
const courant = { nouvelle: null, detail: null };
export const formulaireDetail = () => courant.detail;

function invitesDe(joueurs) {
  return joueursInvites({
    profils: store.profils, profilActifId: store.profilActifId, tousLesJoueurs: store.tousLesJoueurs(), joueursLocaux: joueurs,
  });
}

/** Ouvre la feuille « Nouvel entraînement » */
export function ouvrirNouvelle() {
  ouvrirFeuille('presences.nouvelle', {});
}

/** Ouvre la fiche d'un entraînement */
export function ouvrirSeance(seanceId) {
  ouvrirFeuille('presences.seance', { seanceId });
}

// MARK: - Rendu commun

/** Ligne de pointage d'un joueur (PlayerAttendanceRow) */
function lignePresence(joueur, present, actionNom, cle) {
  const visuel = joueur.photoData
    ? avatar({ photo: joueur.photoData, taille: 36 })
    : avatar({ initiales: initiales(joueur.firstName, joueur.lastName), couleur: 'gray', taille: 36 });
  return ligne({
    avatar: visuel,
    contenu: `<span class="ligne-titre">${h(M.fullName(joueur))}</span><span class="ligne-sous-titre">${h(joueur.position)}</span>`,
    droite: `<span class="coche-presence${present ? ' present' : ''}">${icone(present ? 'checkmark.circle.fill' : 'circle')}</span>`,
    action: actionNom, data: { id: joueur.id }, cle,
    classe: 'ligne-presence',
  });
}

function sectionsCommunes(p, joueurs, invites) {
  const filtres = joueurs.filter((j) => correspond(j, p.recherche));
  const tous = p.presents.size === joueurs.length;
  const invitesFiltres = invites.filter((g) => correspond(g.player, p.recherche));
  const corpsInvites = !p.invitesOuverts ? '' : (invitesFiltres.length === 0
    ? `<div class="ligne"><span class="ligne-sous-titre">Aucun joueur disponible dans les autres catégories</span></div>`
    : invitesParCategorie(invitesFiltres).map((groupe) => `
        <div class="ligne categorie-invites" style="--c:${M.couleur(M.couleurProfil(groupe.colorIndex))}" data-key="cat-${h(groupe.nom)}">
          <span class="point-categorie"></span><span>${h(groupe.nom)}</span>
        </div>
        ${groupe.invites.map((g) => lignePresence(g.player, p.invitesPresents.has(g.player.id), 'presences.basculerInvite', `inv-${g.player.id}`)).join('')}`).join(''));

  return [
    section({
      entete: 'Joueurs',
      lignes: [`<div class="ligne ligne-presents">
        <span class="ligne-titre gras">Présents</span>
        <span class="ligne-valeur">${p.presents.size}/${joueurs.length}</span>
        <button type="button" class="bouton texte petit-lien" data-action="presences.toutSelectionner">${tous ? 'Tout désélectionner' : 'Tout sélectionner'}</button>
      </div>`],
    }),
    section({
      lignes: joueurs.length === 0 && p.mode === 'nouvelle'
        ? [ligne({ titre: "Aucun joueur dans l'effectif", classe: 'secondaire' })]
        : filtres.map((j) => lignePresence(j, p.presents.has(j.id), 'presences.basculer', `j-${j.id}`)),
    }),
    section({
      lignes: [
        `<button type="button" class="ligne tactile disclosure${p.invitesOuverts ? ' ouvert' : ''}" data-action="presences.invites" data-key="disclosure-invites">
          <span class="ligne-icone" style="color:var(--orange)">${icone('person.2.badge.plus')}</span>
          <span class="ligne-textes"><span class="ligne-titre petit-titre">Joueurs d'autres catégories</span></span>
          ${p.invitesPresents.size ? pastille(String(p.invitesPresents.size), 'orange') : ''}
          <span class="chevron-disclosure">${icone('chevron.right')}</span>
        </button>`,
        corpsInvites,
      ],
    }),
  ].join('');
}

function champsDate(p) {
  const d = M.dateDe(p.date);
  const heure = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return [
    section({
      entete: "Date et heure de l'entraînement",
      lignes: [
        champ({ libelle: 'Date', type: 'date', valeur: valeurDate(p.date), change: 'presences.date', cle: 'champ-date' }),
        champ({ libelle: 'Heure', type: 'time', valeur: heure, change: 'presences.heure', cle: 'champ-heure' }),
      ],
    }),
    section({ entete: 'Notes (optionnel)', lignes: [champ({ valeur: p.notes, placeholder: 'Ex: Travail tactique, préparation match...', input: 'presences.notes', cle: 'champ-notes' })] }),
    section({ entete: 'Lieu (optionnel)', lignes: [champ({ valeur: p.location, placeholder: 'Ex: Stade municipal, Gymnase...', input: 'presences.lieu', cle: 'champ-lieu' })] }),
  ].join('');
}

const recherche = (p) => `<label class="recherche" data-key="recherche-presences">${icone('magnifyingglass')}
  <input type="search" value="${h(p.recherche)}" placeholder="Rechercher un joueur" data-input="presences.recherche" aria-label="Rechercher un joueur" autocomplete="off"></label>`;

// MARK: - Nouvel entraînement

definirPage('presences.nouvelle', (p) => {
  const joueurs = triParNom(store.joueurs());
  if (!p.init) {
    Object.assign(p, {
      init: true, mode: 'nouvelle', date: M.iso(), notes: '', location: '', presents: new Set(), invitesPresents: new Set(),
      recherche: '', invitesOuverts: false, invites: invitesDe(joueurs),
    });
  }
  courant.nouvelle = p;
  return {
    titre: 'Nouvel entraînement',
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Créer', action: 'presences.creer', gras: true, desactive: joueurs.length === 0 }),
    contenu: `<div class="colonne">${recherche(p)}${champsDate(p)}${sectionsCommunes(p, joueurs, p.invites)}</div>`,
  };
});

action('presences.creer', () => {
  const p = courant.nouvelle;
  if (!p) return;
  const joueurs = triParNom(store.joueurs());
  const seance = M.nouvelleSeance({
    date: p.date, notes: p.notes, location: p.location,
    attendances: construirePresences(joueurs, p.presents, p.invites, p.invitesPresents),
  });
  store.ajouterSeance(seance);
  fermerFeuille('presences.nouvelle');
});

// MARK: - Fiche d'un entraînement

definirPage('presences.seance', (p) => {
  const joueurs = triParNom(store.joueurs());
  const actuelle = store.seances().find((s) => s.id === p.seanceId);
  if (!p.init) {
    const s = actuelle ?? M.nouvelleSeance();
    const invites = invitesDe(joueurs);
    const idsInvites = new Set(invites.map((g) => g.player.id));
    Object.assign(p, {
      init: true, mode: 'detail', origine: s, date: s.date, notes: s.notes, location: s.location,
      presents: new Set(s.attendances.filter((a) => a.isPresent).map((a) => a.id)),
      invitesPresents: new Set(s.attendances.filter((a) => a.isPresent && idsInvites.has(a.id)).map((a) => a.id)),
      recherche: '', invitesOuverts: false, invites,
    });
  }
  courant.detail = p;
  const reponses = (actuelle ?? p.origine).availabilityResponses.length;
  const actions = section({
    lignes: [
      ligne({ titre: 'Exporter la feuille de présence', icone: 'square.and.arrow.up', action: 'presences.feuillePDF', teinte: true, classe: 'avec-icone' }),
      ligne({
        icone: 'paperplane.fill', couleurIcone: 'orange', action: 'presences.sondage', classe: 'avec-icone',
        contenu: '<span class="ligne-titre">Sondage disponibilité</span><span class="ligne-sous-titre">Demandez aux joueurs leur dispo</span>',
        droite: reponses ? pastille(String(reponses), 'orange') : '',
      }),
      ligne({ titre: 'Supprimer cet entraînement', icone: 'trash', action: 'presences.supprimerFiche', detruire: true, classe: 'avec-icone icone-rouge' }),
    ],
  });
  return {
    titre: 'Modifier',
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Enregistrer', action: 'presences.enregistrer', gras: true }),
    contenu: `<div class="colonne">${recherche(p)}${champsDate(p)}${actions}${sectionsCommunes(p, joueurs, p.invites)}</div>`,
  };
});

/** Entraînement tel qu'affiché dans la fiche (pour l'enregistrer ou l'exporter) */
function seanceDuFormulaire(p) {
  const joueurs = triParNom(store.joueurs());
  const base = store.seances().find((s) => s.id === p.seanceId) ?? p.origine;
  return {
    ...base, date: p.date, notes: p.notes, location: p.location,
    attendances: construirePresences(joueurs, p.presents, p.invites, p.invitesPresents),
  };
}

action('presences.enregistrer', () => {
  const p = courant.detail;
  if (!p) return;
  store.majSeance(seanceDuFormulaire(p));
  fermerFeuille('presences.seance');
});

action('presences.feuillePDF', () => {
  const p = courant.detail;
  if (!p) return;
  const noms = Object.fromEntries(p.invites.map((g) => [g.player.id, g.categoryName]));
  const octets = feuillePresencePDF(seanceDuFormulaire(p), noms);
  const titre = `Entrainement ${M.formatDateMotif(p.date, 'yyyy-MM-dd')}`;
  apercuPDF(octets, `${titre.replaceAll(' ', '_')}.pdf`, titre);
});

action('presences.sondage', () => {
  const p = courant.detail;
  if (p) ouvrirFeuille('presences.sondage', { seanceId: p.seanceId });
});

action('presences.supprimerFiche', () => {
  const p = courant.detail;
  if (!p) return;
  choix({
    titre: 'Supprimer cet entraînement ?',
    message: `${M.formatDateHeure(p.origine.date, 'full')}. Les présences pointées et les réponses au sondage seront perdues.`,
    actions: [{
      libelle: 'Supprimer', role: 'detruire',
      faire: () => { store.supprimerSeance(p.seanceId); fermerFeuille('presences.seance'); },
    }],
  });
});

// MARK: - Actions communes aux deux formulaires

const formulaire = (el) => (el.closest('.feuille')?.querySelector('[data-action="presences.creer"]') ? courant.nouvelle : courant.detail);

action('presences.date', (el) => { const p = formulaire(el); if (p && el.value) p.date = dateDepuisChamp(el.value, p.date); });
action('presences.heure', (el) => {
  const p = formulaire(el);
  if (!p || !el.value) return;
  const [hh, mm] = el.value.split(':').map(Number);
  const d = M.dateDe(p.date);
  d.setHours(hh, mm, 0, 0);
  p.date = M.iso(d);
});
action('presences.notes', (el) => { const p = formulaire(el); if (p) p.notes = el.value; return false; });
action('presences.lieu', (el) => { const p = formulaire(el); if (p) p.location = el.value; return false; });
action('presences.recherche', (el) => { const p = formulaire(el); if (p) p.recherche = el.value; });
action('presences.basculer', (el) => {
  const p = formulaire(el);
  if (!p) return;
  const id = el.dataset.id;
  if (p.presents.has(id)) p.presents.delete(id); else p.presents.add(id);
});
action('presences.basculerInvite', (el) => {
  const p = formulaire(el);
  if (!p) return;
  const id = el.dataset.id;
  if (p.invitesPresents.has(id)) p.invitesPresents.delete(id); else p.invitesPresents.add(id);
});
action('presences.toutSelectionner', (el) => {
  const p = formulaire(el);
  if (!p) return;
  const joueurs = store.joueurs();
  if (p.presents.size === joueurs.length) p.presents.clear();
  else p.presents = new Set(joueurs.map((j) => j.id));
});
action('presences.invites', (el) => { const p = formulaire(el); if (p) p.invitesOuverts = !p.invitesOuverts; });

/** Le sondage a appliqué ses réponses : la fiche ouverte reprend les présences (onUpdate) */
export function presencesMisesAJour(seance) {
  const p = courant.detail;
  if (!p || p.seanceId !== seance.id) return;
  const idsInvites = new Set(p.invites.map((g) => g.player.id));
  p.presents = new Set(seance.attendances.filter((a) => a.isPresent).map((a) => a.id));
  p.invitesPresents = new Set(seance.attendances.filter((a) => a.isPresent && idsInvites.has(a.id)).map((a) => a.id));
}
