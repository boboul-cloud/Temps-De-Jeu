// Tests du cœur (model.js, store.js) : calculs portés de l'app native, textes, formats d'échange.
// cd web && node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../js/model.js';
import { Store } from '../js/store.js';

const ici = new URL('.', import.meta.url);

test('formats de temps (TimeFormatters)', () => {
  assert.equal(M.formatTime(0), '00:00');
  assert.equal(M.formatTime(2754.9), '45:54');
  assert.equal(M.formatTimePrecise(65.37), '01:05.3');
  assert.equal(M.formatShort(150), "2'30");
  assert.equal(M.formatShort(45), '45s');
  assert.equal(M.formatMatchMinute(46 * 60 + 10, 45 * 60), "45+1'");
  assert.equal(M.formatMatchMinute(12 * 60, 45 * 60), "12'");
});

test('dates et nombres en français', () => {
  const d = new Date(2026, 10, 23, 14, 5);
  assert.equal(M.formatDate(d, 'long'), '23 novembre 2026');
  assert.equal(M.formatDate(d, 'medium'), '23 nov. 2026');
  assert.equal(M.formatDate(d, 'full'), 'lundi 23 novembre 2026');
  assert.equal(M.formatHeure(d), '14:05');
  assert.equal(M.formatDateMotif(d, 'yyyy-MM-dd'), '2026-11-23');
  assert.equal(M.decimal(12.5, 1), '12,5');
  assert.equal(M.euros(4.99), '4,99 €');
  assert.match(M.iso(d), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(M.lireDate('2026-11-23T13:05:00.123Z'), '2026-11-23T13:05:00Z');
});

test('noms des joueurs', () => {
  assert.equal(M.displayName({ firstName: 'Jean', lastName: 'Dupont' }), 'J. Dupont');
  assert.equal(M.displayName({ firstName: 'Jean', lastName: '' }), 'Jean');
  assert.equal(M.displayName({ firstName: '', lastName: '' }), 'Joueur');
  assert.equal(M.matchPlayerDisplayName({ firstName: '', lastName: '', shirtNumber: 7 }), 'Joueur #7');
  assert.equal(M.fullName({ firstName: 'Jean', lastName: '' }), 'Jean');
});

test('temps de jeu par joueur (Match.playerPlayingTimes)', async () => {
  const { semer } = await import('./graine.js');
  const { store } = await import('../js/store.js');
  semer();
  const match = store.matchs()[0];
  const parNom = Object.fromEntries(M.playerPlayingTimes(match).map((p) => [p.playerName, p]));
  const p1 = 30 * 60 + 74; const p2 = 30 * 60 + 112;
  assert.equal(parNom['Lucas Martin'].totalTime, p1 + p2);
  assert.equal(parNom['Jules Dubois'].totalTime, p1 + 600);       // sorti à 10 min en 2e mi-temps
  assert.equal(parNom['Arthur Moreau'].totalTime, p2 - 600);      // entré à sa place
  assert.equal(parNom['Léo Thomas'].totalTime, p1 + 900);
  assert.equal(parNom['Raphaël Laurent'].totalTime, p2 - 900);
  assert.equal(parNom['Noah Michel'].totalTime, p2 - 1450);
  assert.equal(parNom['Adam Simon'].totalTime, 0);                 // resté sur le banc
  assert.equal(parNom['Jules Dubois'].isTitulaire, true);
  assert.equal(parNom['Arthur Moreau'].isTitulaire, false);
  const ratio = M.totalEffectivePlayTime(match) / M.totalMatchDuration(match);
  assert.ok(Math.abs(parNom['Lucas Martin'].effectiveTime - (p1 + p2) * ratio) < 1e-9);
  // Temps additionnel : blessure 74 s en 1re ; hors-jeu 20 s + 2 remplacements × 30 s en 2e
  assert.equal(M.suggestedAddedTime(match, '1ère Mi-Temps'), 74);
  assert.equal(M.suggestedAddedTime(match, '2ème Mi-Temps'), 80);
  assert.equal(M.stoppageCount(match, 'Touche'), 2);
  assert.equal(M.stoppageCount(match, 'Touche', 'home'), 1);
});

test('formation adaptée au nombre de joueurs (FormationLayout)', () => {
  assert.deepEqual(M.adapterFormation([1, 4, 4, 2], 8), [1, 3, 3, 1]);
  assert.deepEqual(M.adapterFormation([1, 4, 4, 2], 11), [1, 4, 4, 2]);
  assert.deepEqual(M.adapterFormation([1, 4, 3, 3], 5), [1, 2, 1, 1]);
  assert.equal(M.nomFormation([1, 3, 3, 1]), '3-3-1');
});

test('matériel accordé (AtelierModels)', () => {
  assert.equal(M.compterMateriel('plot', 1), '1 plot');
  assert.equal(M.compterMateriel('plot', 12, 'jaune'), '12 plots jaunes');
  assert.equal(M.compterMateriel('coupelle', 4, 'blanc'), '4 coupelles blanches');
  assert.equal(M.compterMateriel('mini-but', 2, 'rouge'), '2 mini-buts');
  assert.equal(M.compterMateriel('cerceau', 3, 'orange'), '3 cerceaux orange');
  assert.equal(M.adjectifCouleur('violet', true, true), 'violettes');
});

test('identifiants stables des exercices (UUID.stable, vérifiés avec Swift)', () => {
  assert.equal(M.uuidStable('biblio-rondo-4c2'), 'E17EC9E0-F8AB-5BA4-B275-AED9B962429D');
  assert.equal(M.uuidStable('biblio-contre-attaque-3c2'), '876B5421-D393-578C-91D9-48B013C155FC');
});

test('bibliothèque : lecture, matériel, flèches', () => {
  const biblio = M.lireFichierTactiques(fs.readFileSync(new URL('../data/exercices.json', ici), 'utf8'));
  assert.equal(biblio.length, 12);
  const rondo = biblio.find((t) => t.id === M.uuidStable('biblio-rondo-4c2'));
  assert.ok(rondo);
  assert.ok(M.materielExercice(rondo).some((l) => l.item === 'chasuble'));
  const frames = M.resolvedFrames(rondo);
  assert.equal(frames.length, rondo.etapes.length);
  assert.ok(M.flechesEtape(rondo, 1, frames).length > 0);
  // Écriture puis relecture : contenu identique
  const relu = M.lireFichierTactiques(M.ecrireFichierTactiques(biblio));
  assert.deepEqual(relu.map((t) => t.id), biblio.map((t) => t.id));
});

test('équipes équilibrées (TeamBuilder)', () => {
  const candidats = [
    ...['G1', 'G2'].map((name) => ({ name, position: 'Gardien' })),
    ...['D1', 'D2', 'D3', 'D4'].map((name) => ({ name, position: 'Défenseur' })),
    ...['M1', 'M2', 'M3', 'M4', 'M5'].map((name) => ({ name, position: 'Milieu' })),
    ...['A1', 'A2', 'A3'].map((name) => ({ name, position: 'Attaquant' })),
  ];
  const equipes = M.composerEquipes(candidats, ['rouge', 'bleu']);
  assert.deepEqual(equipes.map((e) => e.color), ['rouge', 'bleu']);
  assert.equal(equipes[0].players.length + equipes[1].players.length, 14);
  assert.ok(Math.abs(equipes[0].players.length - equipes[1].players.length) <= 1);
  assert.equal(equipes.filter((e) => e.players.some((n) => n.startsWith('G'))).length, 2);
  assert.match(M.texteEquipes(equipes, 'Séance'), /^⚽️ Séance — les équipes\n\nChasubles rouges \(7\) :/);
});

test('présences (TrainingManager)', () => {
  const s1 = M.nouvelleSeance({ attendances: [{ id: 'A', firstName: 'Léa', lastName: 'Zola', isPresent: true }, { id: 'B', firstName: 'Paul', lastName: 'Abel', isPresent: false }] });
  const s2 = M.nouvelleSeance({ attendances: [{ id: 'A', firstName: 'Léa', lastName: 'Zola', isPresent: true }] });
  const stats = M.calculatePlayerStats([s1, s2]);
  assert.deepEqual(stats.map((s) => s.lastName), ['Abel', 'Zola']);
  assert.equal(M.tauxPresence(stats[1]), 100);
  assert.equal(M.tauxPresence(stats[0]), 0);
  s2.availabilityResponses = [M.lireReponse({ id: 'C', playerName: 'Marc Leroy', status: 1 })];
  M.applyResponsesToAttendance(s2, []);
  assert.deepEqual(s2.attendances[1], { id: 'C', firstName: 'Marc', lastName: 'Leroy', isPresent: true });
});

test('sauvegarde complète : export puis import identiques', async () => {
  const { semer } = await import('./graine.js');
  const { store } = await import('../js/store.js');
  semer();
  const texte = store.exporterSauvegarde();
  const r = M.lireSauvegarde(JSON.parse(texte));
  assert.ok(r);
  assert.equal(M.resumeSauvegarde(r), '2 catégories, 14 joueurs, 2 matchs, 4 entraînements, 2 encadrants');
  const autre = new Store();
  autre.appliquerSauvegarde(r.backup);
  const a = JSON.parse(texte); const b = JSON.parse(autre.exporterSauvegarde());
  delete a.exportDate; delete b.exportDate;
  assert.deepEqual(b, a);
  // Clés obligatoires pour le décodage Swift
  for (const cle of ['version', 'exportDate', 'players', 'staffMembers', 'staffRoles', 'profilesData']) assert.ok(cle in JSON.parse(texte));
  const match = JSON.parse(texte).profilesData[0].matches[0];
  for (const cle of ['id', 'homeTeam', 'awayTeam', 'competition', 'date', 'stoppages', 'periodDurations', 'isFinished', 'notes']) assert.ok(cle in match, cle);
});

test('composition (cascade) et lien web', async () => {
  const joueurs = ['A', 'B', 'C', 'D'].map((n) => M.nouveauJoueur({ firstName: n, lastName: 'X', photoData: 'AAAA' }));
  const roster = M.composerExportComposition({
    allPlayers: joueurs, selectedPlayerIds: [joueurs[0].id], teamName: 'Équipe A', competition: 'Coupe',
    matchDate: new Date(2026, 10, 23), previousUnavailableIds: [joueurs[3].id], previousChain: [], excludePhotos: true,
  });
  assert.deepEqual(roster.availablePlayers.map((p) => p.firstName), ['B', 'C']);
  assert.deepEqual(roster.selectionChain, ['Équipe A']);
  assert.equal(roster.unavailablePlayerIds.length, 2);
  assert.equal(roster.availablePlayers[0].photoData, undefined);
  assert.equal(M.nomFichierComposition('Équipe A', new Date(2026, 10, 23)), 'Joueurs_dispo_Équipe_A_2026-11-23.tdj');
  const relu = await M.lireLienComposition(await M.lienComposition(roster));
  assert.deepEqual(relu.availablePlayers.map((p) => p.id), roster.availablePlayers.map((p) => p.id));
});

test('sondage de disponibilité : lien et réponse', async () => {
  const joueur = M.nouveauJoueur({ firstName: 'Hugo', lastName: 'Bernard' });
  const seanceId = M.uuid();
  const url = await M.lienSondage({ teamName: 'U13', sessionId: seanceId, sessionDate: new Date(2026, 10, 25, 18), players: [joueur] });
  assert.match(url, /^https:\/\/boboul-cloud\.github\.io\/Temps-De-Jeu\/dispo\.html\?z=[A-Za-z0-9_-]+$/);
  const message = M.messageSondage({ teamName: 'U13', sessionDate: new Date(2026, 10, 25), location: 'Stade', playerCount: 12, url });
  assert.match(message, /^⚽ Sondage disponibilité — U13\n📅 25 novembre 2026\n📍 Stade\n👥 12 joueurs convoqués\n\nTouche le lien pour répondre :\n/);
  const rep = { s: seanceId.slice(0, 8), i: joueur.id.slice(0, 8), n: 'Hugo Bernard', r: 2, c: '' };
  const b64 = btoa(JSON.stringify(rep)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.deepEqual(M.lireReponseSondage(`tempsdejeu://a/${b64}`), rep);
  assert.deepEqual(M.lireReponseSondage(`… https://boboul-cloud.github.io/Temps-De-Jeu/dispo.html?r=${b64}`), rep);
  assert.equal(M.lireReponseSondage('bonjour'), null);
});

test('catégories : données isolées, joueurs partagés', () => {
  const s = new Store();
  const a = s.creerProfil('U11');
  const b = s.creerProfil('U13', 1);
  assert.equal(s.profilActifId, a.id);
  const j = M.nouveauJoueur({ firstName: 'Zoé', lastName: 'Roux' });
  s.enregistrerJoueurs([j]);
  assert.deepEqual(s.profilActif().playerIds, [j.id]);
  s.enregistrerMatch(M.nouveauMatch({ homeTeam: 'X' }));
  s.basculerProfil(b.id);
  assert.equal(s.matchs().length, 0);
  assert.equal(s.joueurs().length, 0);
  assert.equal(s.tousLesJoueurs().length, 1);
  s.supprimerProfil(a.id);
  assert.equal(s.profils.length, 1);
  assert.equal(s.matchs(a.id).length, 0);
});

test('clôture de saison : archive et remise à zéro', () => {
  const s = new Store();
  s.creerProfil('U13');
  s.enregistrerJoueurs([M.nouveauJoueur({ firstName: 'A', availability: 'Suspendu' })]);
  s.creerSaison('FC', 'U13', new Date(2026, 8, 1));
  s.enregistrerMatch(M.nouveauMatch());
  s.ajouterSeance(M.nouvelleSeance());
  assert.equal(M.libelleSaison(s.saison()), '2026-2027');
  assert.ok(s.cloturerSaison());
  assert.equal(s.saison(), null);
  assert.equal(s.matchs().length, 0);
  assert.equal(s.seances().length, 0);
  assert.equal(s.joueurs()[0].availability, 'Disponible');
  const [archive] = s.archives();
  assert.equal(archive.matches.length, 1);
  assert.equal(archive.season.isClosed, true);
});
