// Onglet « Présences » (TrainingAttendanceView) : liste des entraînements, du plus récent au
// plus ancien ; bouton « Atelier » (bibliothèque d'exercices) ; menu Nouvel entraînement,
// Statistiques, Exporter — et, sur le web, « Coller une réponse reçue ».
import * as M from '../model.js';
import { store } from '../store.js';
import {
  definirPage, action, section, boutonBarre, icone, h, choix, ouvrirFeuille, alerte, pageExiste, rafraichir,
} from '../ui.js';
import { surReception } from '../entrees.js';
import { couleurTaux, tauxSeance, pourcentEntier } from './presences/logique.js';
import { ouvrirNouvelle, ouvrirSeance } from './presences/seance.js';
import { proposerImport } from './presences/stats.js';
import { collerReponse } from './presences/sondage.js';

/** Ligne d'un entraînement (TrainingSessionRow) + bouton de suppression (glisser sur iPhone) */
function ligneSeance(s) {
  const total = s.attendances.length;
  const taux = tauxSeance(s);
  const reponses = s.availabilityResponses;
  const presentsR = reponses.filter((r) => r.status === 1).length;
  return `<div class="ligne ligne-seance" data-key="seance-${h(s.id)}">
    <button type="button" class="seance-principale" data-action="presences.ouvrir" data-id="${h(s.id)}">
      <span class="ligne-textes">
        <span class="seance-date">${h(M.formatDateHeure(s.date, 'full'))}</span>
        <span class="seance-compteurs">
          <span class="secondaire">${icone('person.fill.checkmark')} ${M.presentCount(s)}/${total}</span>
          ${total > 0 ? `<span style="color:${M.couleur(couleurTaux(taux))}">${pourcentEntier(taux)}</span>` : ''}
        </span>
        ${s.notes ? `<span class="seance-notes">${h(s.notes)}</span>` : ''}
        ${s.location ? `<span class="seance-lieu">${icone('mappin.circle.fill')}<span>${h(s.location)}</span></span>` : ''}
        ${reponses.length ? `<span class="seance-reponses">${icone('paperplane.fill')} ${presentsR}/${reponses.length} réponses</span>` : ''}
      </span>
      <span class="ligne-chevron">${icone('chevron.right')}</span>
    </button>
    <button type="button" class="bouton-icone seance-supprimer" data-action="presences.supprimer" data-id="${h(s.id)}" aria-label="Supprimer" title="Supprimer">${icone('trash')}</button>
  </div>`;
}

definirPage('presences.racine', () => {
  const seances = store.seances().sort((a, b) => M.dateDe(b.date) - M.dateDe(a.date));
  const contenu = seances.length === 0
    ? `<div class="presences-vide">
        <span class="presences-vide-icone">${icone('figure.run.circle.fill')}</span>
        <p class="presences-vide-titre">Aucun entraînement</p>
        <p class="presences-vide-message">Créez un entraînement pour<br>pointer les présences de vos joueurs.</p>
        <button type="button" class="bouton plein" style="--bouton:var(--orange)" data-action="presences.nouvelle">${icone('plus')}<span>Nouvel entraînement</span></button>
      </div>`
    : `<div class="colonne">${section({ lignes: seances.map(ligneSeance) })}</div>`;
  return {
    titre: 'Entraînements',
    grandTitre: true,
    gauche: boutonBarre({ libelle: 'Atelier', icone: 'square.and.pencil', action: 'presences.atelier', gras: true }),
    droite: boutonBarre({ icone: 'ellipsis.circle.fill', titre: "Entraînements : plus d'actions", action: 'presences.menu' }),
    contenu,
  };
});

action('presences.atelier', () => {
  if (pageExiste('atelier.accueil')) ouvrirFeuille('atelier.accueil', {}, { plein: true });
  else alerte('Atelier', "L'Atelier n'est pas encore disponible dans cette version.");
});

action('presences.menu', () => {
  const avecSeances = store.seances().length > 0;
  choix({
    actions: [
      { libelle: 'Nouvel entraînement', icone: 'plus', faire: ouvrirNouvelle },
      ...(avecSeances ? [
        { libelle: 'Statistiques', icone: 'chart.bar.fill', faire: () => ouvrirFeuille('presences.stats', {}) },
        { libelle: 'Exporter', icone: 'square.and.arrow.up', faire: () => ouvrirFeuille('presences.export', {}) },
      ] : []),
      { libelle: 'Coller une réponse reçue', icone: 'arrow.up.doc.on.clipboard', faire: collerReponse },
    ],
  });
});

action('presences.nouvelle', () => ouvrirNouvelle());
action('presences.ouvrir', (el) => ouvrirSeance(el.dataset.id));

action('presences.supprimer', (el) => {
  const id = el.dataset.id;
  choix({
    titre: 'Supprimer cet entraînement ?',
    message: 'Les présences pointées et les réponses au sondage seront perdues.',
    actions: [{ libelle: 'Supprimer', role: 'detruire', faire: () => store.supprimerSeance(id) }],
  });
});

// Fichier d'entraînements ouvert ou déposé : même import que dans Exporter ▸ Import
surReception('entrainements', (exp) => proposerImport(exp));
// Réponse au sondage reçue : la liste et le sondage ouvert se mettent à jour
surReception('reponse', () => rafraichir());
