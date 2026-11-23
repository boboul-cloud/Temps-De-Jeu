// Tests de la zone Historique et exports : sauvegarde complète (aller-retour), rapports PDF
// (joueurs, match, statistiques), imports de joueurs et Multigroop, noms de fichiers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../js/model.js';
import { Store, store } from '../js/store.js';
import { semer } from './graine.js';
import { genererPDFJoueurs } from '../js/rapports/joueurs.js';
import { genererPDFMatch, titreRapport, nomFichierRapport } from '../js/rapports/match.js';
import { genererPDFStats } from '../js/rapports/stats.js';
import {
  lireMultigroop, texteMultigroop, importerJoueurs, importerMultigroop, messageImportJoueurs,
  matchsTerminesDeLaSaison, nomFichierJoueurs, nomFichierMatchs, nomFichierSauvegarde, nomFichierPDF,
  messageRestauration,
} from '../js/ecrans/historique/imports.js';

// Les espaces peuvent être écrites « \\240 » (espace insécable) par pdf.js : ramenées à « » pour comparer
const texteLatin = (octets) => Buffer.from(octets).toString('latin1').replace(/\\240/g, ' ');
const sansDate = (texte) => { const o = JSON.parse(texte); delete o.exportDate; return o; };

function graineComplete() {
  semer();
  // Une archive de saison dans U15, un exercice perso et une séance (déjà semée)
  const u13 = store.profilActifId;
  const u15 = store.profils.find((p) => p.name === 'U15').id;
  store.basculerProfil(u15);
  store.creerSaison('FC Exemple', 'U15', new Date(2025, 8, 1));
  store.cloturerSaison();
  store.basculerProfil(u13);
  const biblio = M.lireFichierTactiques(fs.readFileSync(new URL('../data/exercices.json', import.meta.url), 'utf8'));
  store.bibliotheque = biblio;
  const perso = store.dupliquer(biblio[0]);
  store.enregistrerTactique(perso);
  return { u13, u15 };
}

test('sauvegarde complète : export → import → export identique', () => {
  graineComplete();
  const texte1 = store.exporterSauvegarde();
  const lu = M.lireSauvegarde(JSON.parse(texte1));
  assert.ok(lu, 'la sauvegarde se relit');
  assert.equal(lu.profileCount, 2);
  assert.equal(lu.playerCount, 14);
  assert.equal(lu.totalMatches, 2);
  assert.equal(lu.totalTrainingSessions, 4);
  assert.equal(lu.staffCount, 2);
  assert.equal(lu.tacticCount, 1);
  assert.equal(M.resumeSauvegarde(lu), '2 catégories, 14 joueurs, 2 matchs, 4 entraînements, 2 encadrants, 1 séquence tactique');

  const autre = new Store();
  autre.appliquerSauvegarde(lu.backup);
  const texte2 = autre.exporterSauvegarde();
  assert.deepEqual(sansDate(texte2), sansDate(texte1));

  // Format de l'app native : clés attendues, dates ISO sans fractions, UUID majuscules
  const o = JSON.parse(texte1);
  assert.deepEqual(Object.keys(o).sort(), ['appVersion', 'exportDate', 'players', 'profilesData', 'staffMembers', 'staffRoles', 'tactics', 'trainingPlans', 'version']);
  assert.match(o.exportDate, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.ok(!/\.\d{3}Z"/.test(texte1), 'aucune date avec fractions de seconde');
  assert.match(o.players[0].id, /^[0-9A-F-]{36}$/);
  const u15 = o.profilesData.find((d) => d.profile.name === 'U15');
  assert.equal(u15.seasonArchives.length, 1);
  assert.equal(u15.currentSeason, undefined);
  assert.ok(Array.isArray(o.profilesData[0].profile.playerIds));
});

test('restauration : message de confirmation', () => {
  graineComplete();
  const lu = M.lireSauvegarde(JSON.parse(store.exporterSauvegarde()));
  const msg = messageRestauration(lu);
  assert.match(msg, /^Sauvegarde du \d{1,2} \S+ \d{4} à \d\d:\d\d\n2 catégories, 14 joueurs/);
  assert.ok(msg.endsWith("⚠️ Cette action remplacera toutes les données actuelles de l'application."));
});

test('rapport PDF de match : structure et contenu', () => {
  graineComplete();
  const m = store.matchs()[0];
  const octets = genererPDFMatch(m);
  const t = texteLatin(octets);
  assert.ok(t.startsWith('%PDF-1.4'));
  assert.ok(t.trimEnd().endsWith('%%EOF'));
  for (const morceau of ['(Composition)', '(Remplacements)', '(Buts)', '(Cartons)', '(Passes par \\351quipe)', 'Chronologie des arr',
    '(Temps de jeu par joueur)', '(Possession par \\351quipe)', 'Mon \\351quipe \\(domicile\\)', 'T.A. sugg\\351r\\351: +']) {
    assert.ok(t.includes(morceau), `contient ${morceau}`);
  }
  assert.ok(t.includes('<->'), 'remplacements avec <->');
  assert.match(t, /\/Count [1-9]/);
  assert.equal(titreRapport(m), 'FC Exemple U13 vs AS Voisins');
  assert.match(nomFichierRapport(m, new Date(2026, 10, 23)), /^rapport_FC_Exemple_U13_vs_AS_Voisins_2026-11-23\.pdf$/);
  assert.equal(nomFichierPDF(`Rapport ${titreRapport(m)}`), 'Rapport_FC_Exemple_U13_vs_AS_Voisins.pdf');
});

test('rapport PDF de match vide (sans effectif ni événements)', () => {
  const t = texteLatin(genererPDFMatch(M.nouveauMatch({ homeTeam: '', awayTeam: '' })));
  assert.ok(t.includes('Domicile'));
  assert.ok(t.includes('Ext\\351rieur'));
  assert.ok(!t.includes('(Composition)'));
});

test('fiche PDF de l’effectif', () => {
  graineComplete();
  const joueurs = store.joueurs();
  const cartons = store.matchs().flatMap((m) => m.cards);
  const sans = texteLatin(genererPDFJoueurs({ players: joueurs, allCards: cartons }));
  assert.ok(sans.includes('(Effectif - Temps De Jeu)'));
  assert.ok(sans.includes('14 joueurs : 2 G'));
  assert.ok(sans.includes('(Gardiens)') && sans.includes('(Attaquants)'));
  assert.ok(!sans.includes('Tps cumul'), 'pas de colonnes de temps sans matchs (comme Export / Import)');
  assert.ok(sans.includes('T\\351l. 0601020304'), 'téléphone');
  assert.ok(sans.includes('(1 J)') || sans.includes('1 J · 1 2J'), 'cartons');
  const avec = texteLatin(genererPDFJoueurs({ players: joueurs, allCards: cartons, matches: store.matchs() }));
  assert.ok(avec.includes('Tps cumul') && avec.includes('(2 matchs jou\\351s)'));
});

test('rapport PDF des statistiques globales', () => {
  graineComplete();
  const t = texteLatin(genererPDFStats({ matches: store.matchs(), players: store.joueurs() }));
  for (const morceau of ['(Statistiques globales)', "(Vue d'ensemble)", '(Matchs jou\\351s)', '(Top buteurs :)', '(Top passeurs :)',
    '(Historique des matchs)', 'Top joueurs sanctionn', 'Mon \\351quipe: 4 buts \\267 Adversaires: 3 buts']) {
    assert.ok(t.includes(morceau), `contient ${morceau}`);
  }
});

test('Multigroop : lecture des deux formats et export', () => {
  const lus = lireMultigroop('Jean Dupont;0601020304;U13\nMarie;Curie;0611111111\n\nSeul\nPaul Martin,0622222222,U15\r\n');
  assert.equal(lus.length, 3);
  assert.deepEqual(lus.map((j) => [j.firstName, j.lastName, j.phoneNumber]), [
    ['Jean', 'Dupont', '0601020304'], ['Marie', 'Curie', '0611111111'], ['Paul', 'Martin', '0622222222'],
  ]);
  const profils = [{ id: 'P1', name: 'U13' }];
  const texte = texteMultigroop([
    { firstName: 'Jean', lastName: 'Dupont', phoneNumber: '06', homeCategoryId: 'P1' },
    { firstName: '', lastName: '', homeCategoryId: 'P1' },
    { firstName: 'Léo', lastName: '' },
  ], profils);
  assert.equal(texte, 'Jean Dupont;06;U13\nLéo;;');
});

test('import de joueurs : fusion, remplacement, catégorie visée', () => {
  graineComplete();
  const avant = store.joueurs().length;
  const importes = [
    M.nouveauJoueur({ firstName: 'Lucas', lastName: 'MARTIN', position: 'Défenseur', availability: 'Blessé' }),
    M.nouveauJoueur({ firstName: 'Nouveau', lastName: 'Venu', position: 'Attaquant' }),
  ];
  assert.equal(messageImportJoueurs(store, { teamCode: 'A3K9F2' }), 'Ces joueurs seront importés dans la catégorie « U13 » (code A3K9F2).');
  assert.equal(messageImportJoueurs(store, { teamName: 'u15' }), 'Ces joueurs seront importés dans la catégorie « U15 ».');
  assert.equal(messageImportJoueurs(store, { teamName: 'Seniors' }), 'La catégorie « Seniors » sera créée automatiquement pour accueillir ces joueurs.');
  assert.equal(messageImportJoueurs(store, {}), 'Comment souhaitez-vous importer les joueurs ?');

  const r = importerJoueurs(store, { players: importes, teamCode: 'A3K9F2' }, 'merge');
  assert.equal(r.titre, 'Import réussi');
  assert.equal(r.message, `Effectif mis à jour dans U13. ${avant + 1} joueurs au total.`);
  const lucas = store.joueurs().find((j) => j.firstName === 'Lucas');
  assert.equal(lucas.position, 'Défenseur');
  assert.equal(lucas.availability, 'Blessé');
  const venu = store.joueurs().find((j) => j.lastName === 'Venu');
  assert.notEqual(venu.id, importes[1].id, 'nouvel identifiant');
  assert.equal(venu.homeCategoryId, store.profilActifId);

  const r2 = importerJoueurs(store, { players: importes, teamName: 'Seniors' }, 'replace');
  assert.equal(r2.message, '2 joueurs importés (remplacement) dans Seniors.');
  assert.equal(store.profilActif().name, 'Seniors');
  assert.equal(store.joueurs().length, 2);
  assert.equal(store.tousLesJoueurs().length, 14 + 1 + 2, 'la base globale garde les autres joueurs');
});

test('import Multigroop dans la catégorie active', () => {
  graineComplete();
  const avant = store.joueurs().length;
  const r = importerMultigroop(store, lireMultigroop('Lucas Martin;0700000000;U13\nZoé Nouvelle;0712345678;U13'), 'merge');
  assert.equal(r.message, `Effectif mis à jour depuis Multigroop dans U13. ${avant + 1} joueurs au total.`);
  assert.equal(store.joueurs().find((j) => j.firstName === 'Lucas').phoneNumber, '0700000000');
});

test('matchs de la saison, noms de fichiers', () => {
  const saison = { startDate: '2026-09-01T00:00:00Z' };
  const matchs = [
    M.nouveauMatch({ date: '2026-10-01T10:00:00Z', isFinished: true }),
    M.nouveauMatch({ date: '2026-05-01T10:00:00Z', isFinished: true }),
    M.nouveauMatch({ date: '2026-10-02T10:00:00Z', isFinished: false }),
  ];
  assert.equal(matchsTerminesDeLaSaison(matchs, saison).length, 1);
  assert.equal(matchsTerminesDeLaSaison(matchs, null).length, 2);
  const jour = new Date(2026, 10, 23);
  assert.equal(nomFichierJoueurs({ name: 'U15 / Féminines' }, jour), 'joueurs_U15_-_Féminines_2026-11-23.json');
  assert.equal(nomFichierJoueurs(null, jour), 'joueurs_tous_2026-11-23.json');
  assert.equal(nomFichierMatchs({ name: 'U13' }, jour), 'matchs_U13_2026-11-23.tdjm');
  assert.equal(nomFichierSauvegarde(jour), 'sauvegarde_temps_de_jeu_2026-11-23.tdjb');
});
