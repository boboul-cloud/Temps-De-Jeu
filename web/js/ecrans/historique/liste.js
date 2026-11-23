// Onglet « Historique des matchs » (MatchHistoryView.swift) : liste des matchs enregistrés
// de la catégorie active, recherche, ouverture du rapport, suppression.
// Web : pas de glissement pour supprimer → bouton « Modifier » puis corbeille sur chaque ligne.
import { store } from '../../store.js';
import * as M from '../../model.js';
import {
  definirPage, action, ouvrirFeuille, confirmer, boutonBarre, section, vide, icone, h,
} from '../../ui.js';

const etat = { recherche: '', edition: false };

/** Filtre de recherche (localizedCaseInsensitiveContains sur équipes et compétition) */
export function filtrerMatchs(matchs, recherche) {
  if (recherche === '') return matchs;
  const q = recherche.toLocaleLowerCase('fr');
  return matchs.filter((m) => [m.homeTeam, m.awayTeam, m.competition].some((t) => t.toLocaleLowerCase('fr').includes(q)));
}

/** StatMini : valeur en couleur, libellé en dessous */
const statMini = (libelle, valeur, couleur) =>
  `<span class="hist-statmini"><b style="color:${M.couleur(couleur)}">${h(valeur)}</b><small>${h(libelle)}</small></span>`;

/** Contenu d'une ligne d'historique (MatchHistoryRow) */
export function contenuLigneMatch(m) {
  const marque = '<span class="hist-mon-equipe">Mon équipe</span>';
  return `<span class="hist-equipes">
      <span class="hist-equipe"><b>${h(m.homeTeam === '' ? 'Domicile' : m.homeTeam)}</b>${m.isMyTeamHome ? marque : ''}</span>
      <span class="hist-score">${m.homeScore} - ${m.awayScore}</span>
      <span class="hist-equipe droite"><b>${h(m.awayTeam === '' ? 'Extérieur' : m.awayTeam)}</b>${m.isMyTeamHome ? '' : marque}</span>
    </span>
    <span class="hist-infos">
      ${m.competition !== '' ? `<span class="hist-competition">${icone('trophy.fill')}${h(m.competition)}</span>` : '<span></span>'}
      <span>${h(M.formatDate(m.date, 'long'))}</span>
    </span>
    <span class="hist-stats">
      ${statMini('Effectif', M.formatTime(M.totalEffectivePlayTime(m)), 'green')}
      ${statMini('Arrêts', M.formatTime(M.totalStoppageTime(m)), 'red')}
      ${statMini('Ratio', `${Math.trunc(M.effectivePercentage(m))}%`, 'blue')}
      ${statMini('Événements', `${m.stoppages.length}`, 'orange')}
    </span>`;
}

definirPage('historique.racine', () => {
  const matchs = store.matchs();
  if (!matchs.length) {
    etat.edition = false;
    return {
      titre: 'Historique des matchs',
      grandTitre: true,
      contenu: `<div class="hist-vide">${vide({ icone: 'clock.arrow.circlepath', titre: 'Aucun match enregistré', message: 'Vos matchs terminés apparaîtront ici' })}</div>`,
    };
  }
  const liste = filtrerMatchs(matchs, etat.recherche);
  const lignes = liste.map((m) => (etat.edition
    ? `<div class="ligne hist-ligne en-edition" data-key="hist-${h(m.id)}">
        <button type="button" class="hist-supprimer" data-action="historique.supprimer" data-id="${h(m.id)}" aria-label="Supprimer">${icone('minus.circle.fill')}</button>
        <span class="hist-contenu">${contenuLigneMatch(m)}</span>
      </div>`
    : `<button type="button" class="ligne tactile hist-ligne" data-action="historique.ouvrir" data-id="${h(m.id)}" data-key="hist-${h(m.id)}">
        <span class="hist-contenu">${contenuLigneMatch(m)}</span>
      </button>`));
  return {
    titre: 'Historique des matchs',
    grandTitre: true,
    droite: boutonBarre({ libelle: etat.edition ? 'OK' : 'Modifier', action: 'historique.edition', gras: etat.edition }),
    contenu: `<div class="colonne">
      <label class="recherche">${icone('magnifyingglass')}<input type="search" placeholder="Rechercher un match" value="${h(etat.recherche)}"
        data-input="historique.recherche" data-key="hist-recherche" aria-label="Rechercher un match" autocomplete="off"></label>
      ${liste.length ? section({ lignes }) : '<p class="vide-texte">Aucun résultat</p>'}
    </div>`,
  };
});

action('historique.recherche', (el) => { etat.recherche = el.value; });
action('historique.edition', () => { etat.edition = !etat.edition; });
action('historique.ouvrir', (el) => ouvrirFeuille('historique.rapport', { matchId: el.dataset.id }));
action('historique.supprimer', (el) => {
  const id = el.dataset.id;
  confirmer({ titre: 'Supprimer ce match ?', libelle: 'Supprimer', faire: () => store.supprimerMatch(id) });
});
