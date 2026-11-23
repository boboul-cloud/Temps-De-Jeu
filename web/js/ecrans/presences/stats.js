// Statistiques de présence (TrainingStatsView) et export / import des présences
// (TrainingExportView) : période, résumé, détail par joueur, PDF, JSON, import fusion / remplacement.
import * as M from '../../model.js';
import { store } from '../../store.js';
import {
  definirPage, action, section, ligne, champ, boutonBarre, segmente, icone, h,
  alerte, choix, partager, apercuPDF, choisirFichier, valeurDate, dateDepuisChamp,
} from '../../ui.js';
import {
  statistiques, presenceMoyenne, couleurTaux, pourcentEntier, nomsCategoriesInvites, importerSeances,
  messageImport, plageDates,
} from './logique.js';
import { presencesPDF, nomFichierPDF } from '../../rapports/entrainements.js';

/** Un mois avant aujourd'hui (Calendar.date(byAdding: .month, value: -1)) */
function ilYaUnMois() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return M.iso(d);
}

function periode(p, actionDu, actionAu) {
  return [
    champ({ libelle: 'Du', type: 'date', valeur: valeurDate(p.debut), change: actionDu, cle: `${actionDu}-champ` }),
    champ({ libelle: 'Au', type: 'date', valeur: valeurDate(p.fin), change: actionAu, cle: `${actionAu}-champ` }),
  ];
}

// MARK: - Statistiques

let stats = null;

definirPage('presences.stats', (p) => {
  if (!p.init) Object.assign(p, { init: true, debut: ilYaUnMois(), fin: M.iso() });
  stats = p;
  const r = statistiques({
    seances: store.seances(), debut: p.debut, fin: p.fin, profils: store.profils, profilActifId: store.profilActifId,
    seancesDe: (id) => store.seances(id), tousLesJoueurs: store.tousLesJoueurs(),
  });
  const moyenne = presenceMoyenne(r.playerStats);
  const lignes = r.playerStats.length === 0
    ? [ligne({ titre: 'Aucune donnée pour cette période', classe: 'secondaire' })]
    : r.playerStats.map((st) => {
      const info = r.guestInfo[st.playerId];
      const taux = M.tauxPresence(st);
      return ligne({
        cle: `st-${st.playerId}`,
        contenu: `<span class="ligne-titre ligne-flex">${h(M.fullName(st))}${info ? `<span class="etiquette-categorie" style="--c:${M.couleur(M.couleurProfil(info.colorIndex))}">${h(info.name)}</span>` : ''}</span>
          <span class="ligne-sous-titre">${st.presentSessions}/${st.totalSessions} entraînements</span>`,
        droite: `<span class="taux-joueur" style="color:${M.couleur(couleurTaux(taux))}">${pourcentEntier(taux)}</span>`,
      });
    });
  return {
    titre: 'Statistiques',
    gauche: '',
    droite: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer', gras: true }),
    contenu: `<div class="colonne">
      ${section({ entete: 'Période', lignes: periode(p, 'presences.statsDu', 'presences.statsAu') })}
      ${section({
        entete: 'Résumé',
        lignes: [`<div class="ligne resume-stats">
          <div><span class="grand-nombre">${r.totalSessionCount}</span><span class="ligne-sous-titre">Entraînements</span></div>
          <div class="a-droite"><span class="grand-nombre" style="color:${M.couleur(couleurTaux(moyenne))}">${pourcentEntier(moyenne)}</span><span class="ligne-sous-titre">Présence moyenne</span></div>
        </div>`],
      })}
      ${section({ entete: 'Par joueur', lignes })}
    </div>`,
  };
});

action('presences.statsDu', (el) => { if (stats && el.value) stats.debut = dateDepuisChamp(el.value, stats.debut); });
action('presences.statsAu', (el) => { if (stats && el.value) stats.fin = dateDepuisChamp(el.value, stats.fin); });

// MARK: - Export / Import

let exp = null;

definirPage('presences.export', (p) => {
  if (!p.init) Object.assign(p, { init: true, debut: ilYaUnMois(), fin: M.iso(), format: 'pdf' });
  exp = p;
  const n = M.filterSessions(store.seances(), p.debut, p.fin).length;
  return {
    titre: 'Export / Import',
    gauche: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }),
    contenu: `<div class="colonne">
      ${section({ entete: 'Export - Période', lignes: periode(p, 'presences.exportDu', 'presences.exportAu') })}
      ${section({ entete: 'Format', lignes: [`<div class="ligne">${segmente({ valeur: p.format, options: [['pdf', 'PDF'], ['json', 'JSON']], action: 'presences.format', classe: 'segmente-plein' })}</div>`] })}
      ${section({ lignes: [ligne({ titre: `${n} entraînements sélectionnés`, classe: 'secondaire' })] })}
      ${section({
        lignes: [`<button type="button" class="ligne tactile teinte centre-ligne" data-action="presences.exporter" ${n === 0 ? 'disabled' : ''}>
          ${icone('square.and.arrow.up')}<span>Exporter</span></button>`],
      })}
      ${section({
        entete: 'Import',
        lignes: [ligne({
          icone: 'square.and.arrow.down', couleurIcone: 'green', action: 'presences.importer', classe: 'avec-icone',
          contenu: '<span class="ligne-titre petit-titre">Importer des entraînements (JSON)</span><span class="ligne-sous-titre">Depuis un fichier exporté</span>',
        })],
      })}
    </div>`,
  };
});

action('presences.exportDu', (el) => { if (exp && el.value) exp.debut = dateDepuisChamp(el.value, exp.debut); });
action('presences.exportAu', (el) => { if (exp && el.value) exp.fin = dateDepuisChamp(el.value, exp.fin); });
action('presences.format', (el) => { if (exp) exp.format = el.dataset.valeur; });

action('presences.exporter', () => {
  if (!exp) return;
  const sessions = M.filterSessions(store.seances(), exp.debut, exp.fin);
  if (!sessions.length) return;
  const playerStats = M.calculatePlayerStats(sessions);
  const plage = plageDates(exp.debut, exp.fin);
  if (exp.format === 'pdf') {
    const octets = presencesPDF({
      sessions, playerStats, startDate: exp.debut, endDate: exp.fin,
      guestCategoryNames: nomsCategoriesInvites(sessions, store.profils, store.profilActifId),
    });
    const titre = `Presences_entrainements_${plage}`;
    apercuPDF(octets, nomFichierPDF(titre), titre);
  } else {
    const texte = M.ecrirePresencesJSON(sessions, playerStats, exp.debut, exp.fin);
    partager({ titre: 'Présences', fichiers: [{ nom: `Presences_entrainements_${plage}.json`, contenu: texte, type: 'application/json' }] });
    return false;
  }
});

action('presences.importer', async () => {
  const [f] = await choisirFichier({ accept: '.json,application/json' });
  if (!f) return;
  let texte;
  try { texte = await f.text(); } catch (e) {
    alerte('Erreur', `Impossible de lire le fichier : ${e?.message ?? ''}`);
    return;
  }
  const importe = M.lirePresencesJSON(M.lireJSON(texte));
  if (!importe) { alerte('Erreur', "Le fichier n'est pas un export d'entraînements valide."); return; }
  proposerImport(importe);
  return false;
});

/** Confirmation « Fusionner / Remplacer » puis import (aussi pour un fichier ouvert ou déposé) */
export function proposerImport(importe) {
  const seances = importe.sessions;
  if (!seances.length) { alerte('Fichier vide', 'Aucun entraînement trouvé dans ce fichier.'); return; }
  const faire = (mode) => {
    const liste = importerSeances(store.seances(), seances, mode);
    store.enregistrerSeances(liste);
    alerte('Import réussi', messageImport(mode, seances.length, liste.length));
  };
  choix({
    titre: `Importer ${seances.length} entraînements`,
    message: 'Comment souhaitez-vous importer les entraînements ?',
    actions: [
      { libelle: 'Fusionner (ajouter les nouveaux)', faire: () => faire('merge') },
      { libelle: 'Remplacer tous les entraînements', faire: () => faire('replace') },
    ],
  });
}

