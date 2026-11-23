// Page « Export / Import » (ExportImportView.swift), ouverte depuis Réglages et Exports :
// joueurs (JSON, PDF, Multigroop), matchs (.tdjm), sauvegarde complète (.tdjb, même fichier que
// l'app iPhone), rapport statistiques et rapports de match de la saison en cours.
// Plus la restauration d'une sauvegarde ouverte de l'extérieur (OpenedBackupHandler.swift).
import { store } from '../../store.js';
import * as M from '../../model.js';
import {
  definirPage, action, section, ligne, h, icone, alerte, choix, partager, apercuPDF, choisirFichier,
  etat as etatUI, rafraichir,
} from '../../ui.js';
import { surReception, proposerImportMatchs } from '../../entrees.js';
import { genererPDFJoueurs } from '../../rapports/joueurs.js';
import { genererPDFMatch, titreRapport, nomFichierRapport } from '../../rapports/match.js';
import { genererPDFStats } from '../../rapports/stats.js';
import {
  nomFichierJoueurs, nomFichierMatchs, nomFichierSauvegarde, nomFichierMultigroop, nomFichierPDF,
  matchsTerminesDeLaSaison, texteMultigroop, lireMultigroop, messageImportJoueurs, importerJoueurs,
  importerMultigroop, messageRestauration,
} from './imports.js';

/** Ligne d'action : titre (subheadline) + sous-titre (caption), pictogramme coloré */
const ligneAction = (titre, sousTitre, ic, couleur, act, desactive = false) => ligne({
  contenu: `<span class="ligne-titre">${h(titre)}</span><span class="ligne-sous-titre">${h(sousTitre)}</span>`,
  icone: ic, couleurIcone: couleur, action: act, desactive, classe: 'avec-icone exp-ligne teinte',
});

const typeJSON = 'application/json';

definirPage('export.import', (params) => {
  const joueurs = store.joueurs();
  const matchs = store.matchs();
  const termines = matchs.filter((m) => m.isFinished);
  const saisonTermines = matchsTerminesDeLaSaison(matchs, store.saison());
  const profil = store.profilActif();
  const titre = profil ? `Export — ${profil.name}` : (params.titre ?? 'Export / Import');

  const sections = [
    section({
      entete: `Joueurs (${joueurs.length})`,
      lignes: [
        ligneAction('Exporter les joueurs (JSON)', "Format réimportable dans l'app", 'doc.text', 'blue', 'export.joueursJSON'),
        ligneAction('Exporter les joueurs (PDF)', "Fiche récapitulative de l'effectif", 'doc.richtext', 'red', 'export.joueursPDF', !joueurs.length),
        ligneAction('Exporter pour Multigroop', "Liste des joueurs avec catégorie pour l'app Multigroop", 'person.3.fill', 'brown', 'export.multigroop', !joueurs.length),
      ],
    }),
    section({
      entete: 'Import Joueurs',
      lignes: [
        ligneAction('Importer des joueurs (JSON)', 'Depuis un fichier exporté', 'square.and.arrow.down', 'green', 'export.importerJoueurs'),
        ligneAction('Importer depuis Multigroop', "Fichier texte exporté par l'app Multigroop", 'person.3.fill', 'brown', 'export.importerMultigroop'),
      ],
    }),
    section({
      entete: `Matchs ${termines.length > 0 ? `(${termines.length})` : ''}`,
      lignes: [ligneAction('Exporter les matchs (JSON)', 'Réimportable — inclut cartons et compositions', 'doc.text', 'blue', 'export.matchsJSON', !termines.length)],
    }),
    section({
      entete: 'Import Matchs',
      lignes: [ligneAction('Importer des matchs (JSON)', "Fusionner les matchs d'un autre appareil", 'square.and.arrow.down', 'orange', 'export.importerMatchs')],
    }),
    section({
      entete: 'Sauvegarde complète',
      lignes: [
        ligneAction('Exporter la sauvegarde complète', 'Toutes les catégories, joueurs, matchs, entraînements, staff…', 'arrow.up.doc.on.clipboard', 'indigo', 'export.sauvegarde'),
        ligneAction('Restaurer une sauvegarde complète', "Remplace toutes les données de l'app", 'arrow.down.doc.fill', 'indigo', 'export.restaurer'),
      ],
      pied: "La sauvegarde inclut tous les profils, joueurs, matchs, entraînements, saisons et encadrants. Idéal pour transférer vers un nouvel appareil. Le fichier .tdjb est le même que celui de l'app iPhone et iPad.",
    }),
    section({
      entete: `Statistiques (${termines.length} matchs)`,
      lignes: [ligneAction('Rapport statistiques (PDF)', "Vue d'ensemble de tous les matchs", 'chart.bar.doc.horizontal', 'purple', 'export.statsPDF', !matchs.length)],
    }),
  ];

  if (saisonTermines.length) {
    sections.push(section({
      entete: `Rapport de match (PDF) — Saison en cours (${saisonTermines.length} matchs)`,
      lignes: saisonTermines.map((m) => `<div class="ligne exp-match" data-key="exp-${h(m.id)}">
        <button type="button" class="exp-match-textes" data-action="export.voirMatch" data-id="${h(m.id)}">
          <b>${h(m.homeTeam === '' ? 'Domicile' : m.homeTeam)} ${m.homeScore}-${m.awayScore} ${h(m.awayTeam === '' ? 'Extérieur' : m.awayTeam)}</b>
          <small>${h(M.formatDate(m.date, 'long'))}</small>
        </button>
        <button type="button" class="exp-match-bouton" style="color:var(--bleu)" data-action="export.partagerMatch" data-id="${h(m.id)}" aria-label="Partager le rapport" title="Partager le rapport">${icone('square.and.arrow.up')}</button>
        <button type="button" class="exp-match-bouton" style="color:var(--orange)" data-action="export.voirMatch" data-id="${h(m.id)}" aria-label="Voir le rapport PDF" title="Voir le rapport PDF">${icone('doc.richtext')}</button>
      </div>`),
    }));
  }

  return { titre, grandTitre: true, contenu: `<div class="colonne">${sections.join('')}</div>` };
});

// MARK: - Exports

const partagerFichier = (nom, contenu, type) => partager({ fichiers: [{ nom, contenu, type }] });

action('export.joueursJSON', () => {
  const profil = store.profilActif();
  partagerFichier(nomFichierJoueurs(profil), M.ecrireJoueursJSON(store.joueurs(), profil), typeJSON);
  return false;
});

action('export.multigroop', () => {
  const texte = texteMultigroop(store.joueurs(), store.profils);
  if (texte === '') { alerte('Aucun joueur', 'Aucun joueur à exporter.'); return false; }
  partagerFichier(nomFichierMultigroop(), texte, 'text/plain');
  return false;
});

action('export.joueursPDF', () => {
  const cartons = store.matchs().flatMap((m) => m.cards);
  apercuPDF(genererPDFJoueurs({ players: store.joueurs(), allCards: cartons }), nomFichierPDF('Effectif'), 'Effectif');
  return false;
});

action('export.statsPDF', () => {
  apercuPDF(genererPDFStats({ matches: store.matchs(), players: store.joueurs() }), nomFichierPDF('Rapport Statistiques'), 'Rapport Statistiques');
  return false;
});

action('export.matchsJSON', () => {
  const profil = store.profilActif();
  partagerFichier(nomFichierMatchs(profil), M.ecrireMatchsJSON(store.matchs().filter((m) => m.isFinished), profil), typeJSON);
  return false;
});

action('export.voirMatch', (el) => {
  const m = store.matchs().find((x) => x.id === el.dataset.id);
  if (m) apercuPDF(genererPDFMatch(m), nomFichierPDF(titreRapport(m)), titreRapport(m));
  return false;
});

action('export.partagerMatch', (el) => {
  const m = store.matchs().find((x) => x.id === el.dataset.id);
  if (m) partagerFichier(nomFichierRapport(m), genererPDFMatch(m), 'application/pdf');
  return false;
});

action('export.sauvegarde', () => {
  partagerFichier(nomFichierSauvegarde(), store.exporterSauvegarde(), typeJSON);
  return false;
});

// MARK: - Imports

async function lireFichier(accept) {
  const [f] = await choisirFichier({ accept });
  if (!f) return null;
  try {
    return await f.text();
  } catch (e) {
    alerte('Erreur', `Impossible de lire le fichier : ${e.message}`);
    return null;
  }
}

action('export.importerJoueurs', async () => {
  const texte = await lireFichier('.json,application/json');
  if (texte == null) return;
  const r = M.lireJoueursJSON(M.lireJSON(texte));
  if (!r) { alerte('Erreur', "Le fichier n'est pas un export de joueurs valide."); return; }
  choix({
    titre: `Importer ${r.players.length} joueurs`,
    message: messageImportJoueurs(store, r),
    actions: [
      { libelle: 'Fusionner (ajouter les nouveaux)', faire: () => { const res = importerJoueurs(store, r, 'merge'); alerte(res.titre, res.message); } },
      { libelle: "Remplacer tout l'effectif", faire: () => { const res = importerJoueurs(store, r, 'replace'); alerte(res.titre, res.message); } },
    ],
  });
});

action('export.importerMultigroop', async () => {
  const texte = await lireFichier('.txt,.csv,text/plain');
  if (texte == null) return;
  const joueurs = lireMultigroop(texte);
  if (!joueurs.length) { alerte('Aucun joueur', 'Aucun joueur trouvé dans le fichier.'); return; }
  choix({
    titre: `Importer ${joueurs.length} joueurs depuis Multigroop`,
    message: 'Les joueurs seront importés dans la catégorie active.',
    actions: [
      { libelle: 'Fusionner (ajouter les nouveaux)', faire: () => { const res = importerMultigroop(store, joueurs, 'merge'); alerte(res.titre, res.message); } },
      { libelle: "Remplacer tout l'effectif", faire: () => { const res = importerMultigroop(store, joueurs, 'replace'); alerte(res.titre, res.message); } },
    ],
  });
});

action('export.importerMatchs', async () => {
  const texte = await lireFichier('.tdjm,.json,application/json');
  if (texte == null) return;
  const r = M.lireMatchsJSON(M.lireJSON(texte));
  if (!r) { alerte('Erreur', "Le fichier n'est pas un export de matchs valide."); return; }
  proposerImportMatchs(r);
});

/** Demande confirmation puis restaure (ExportImportView et OpenedBackupHandler) */
function proposerRestauration(resultat, { depuisExterieur = false } = {}) {
  choix({
    titre: 'Restaurer la sauvegarde complète ?',
    message: messageRestauration(resultat),
    actions: [{
      libelle: 'Restaurer (remplacer toutes les données)',
      role: 'detruire',
      faire: () => {
        store.appliquerSauvegarde(resultat.backup);
        if (depuisExterieur) {
          // Comme dataRefreshID côté iPhone : les onglets repartent de leur racine
          etatUI.piles = {};
          etatUI.feuilles = [];
        }
        alerte('Restauration réussie', `${M.resumeSauvegarde(resultat)} restaurés.`);
        rafraichir();
      },
    }],
  });
}

action('export.restaurer', async () => {
  const texte = await lireFichier('.tdjb,.json,application/json');
  if (texte == null) return;
  const r = M.lireSauvegarde(M.lireJSON(texte));
  if (!r) { alerte('Erreur', "Le fichier n'est pas une sauvegarde complète valide."); return; }
  proposerRestauration(r);
});

// Sauvegarde ouverte de l'extérieur (fichier déposé, « Ouvrir un fichier », app installée)
surReception('sauvegarde', (resultat) => proposerRestauration(resultat, { depuisExterieur: true }));
