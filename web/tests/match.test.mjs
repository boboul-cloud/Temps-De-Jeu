// Tests de l'onglet Match : chronomètre (horloge simulée), arrêts et temps additionnel,
// expulsion temporaire du carton blanc, remplacements et temps de jeu en direct, possession,
// texte du récapitulatif, PDF de composition, joueurs pris dans d'autres catégories.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { store } from '../js/store.js';
import { MatchViewModel } from '../js/ecrans/match/vm.js';
import { texteRecap, resultatMatch } from '../js/ecrans/match/recap-texte.js';
import { genererPDFComposition, titreComposition } from '../js/rapports/composition.js';

function nouveau() {
  let t = 1_000_000;
  const vm = new MatchViewModel({ horloge: () => t, persistance: false, chargerBrouillon: false });
  const avancer = (s) => { t += s * 1000; vm.tick(false); };
  return { vm, avancer };
}

function effectif(vm, n = 3, titulaires = 2) {
  const joueurs = Array.from({ length: n }, (_, i) => M.nouveauJoueur({ firstName: `Prénom${i}`, lastName: `Nom${i}` }));
  vm.setMatchRoster(joueurs.map((j, i) => M.matchPlayerDe(j, i < titulaires ? 'Titulaire' : 'Remplaçant', i + 1)));
  return joueurs;
}

test('chronomètre, arrêts, temps effectif et temps additionnel', () => {
  const { vm, avancer } = nouveau();
  vm.startMatch();
  assert.equal(vm.timerState.type, 'running');
  avancer(60);
  assert.equal(vm.elapsedTime, 60);
  vm.stopPlay('Blessure / Soins');
  assert.equal(vm.isStopped, true);
  avancer(30);
  assert.equal(vm.stoppageElapsed, 30);
  assert.equal(vm.currentAddedTime, 30, "l'arrêt en cours (blessure) compte");
  assert.equal(vm.currentEffectiveTime, 60);
  vm.resumePlay();
  assert.equal(vm.match.stoppages[0].endTime, 90);
  assert.equal(vm.match.stoppages[0].startTime, 60);
  avancer(10);
  vm.stopPlay('Touche', 'home');
  avancer(5);
  vm.resumePlay();
  assert.equal(vm.currentAddedTime, 30, 'une touche ne compte pas');
  vm.stopPlay('Remplacement');
  avancer(20);
  vm.resumePlay();
  assert.equal(vm.currentAddedTime, 60, 'forfait de 30 s par remplacement');
  assert.equal(vm.currentTotalStoppageTime, 55);
  assert.equal(vm.match.stoppages[1].beneficiaryTeam, 'home');
});

test('enchaînement d\'arrêts (coup franc → penalty → but)', () => {
  const { vm, avancer } = nouveau();
  vm.startMatch();
  avancer(100);
  vm.stopPlay('Coup Franc', 'away');
  avancer(20);
  vm.chainStoppage('Penalty', 'away');
  assert.equal(vm.match.stoppages.length, 2);
  assert.equal(vm.match.stoppages[0].endTime, 120);
  assert.equal(vm.match.stoppages[1].endTime, undefined);
  assert.deepEqual(vm.timerState, { type: 'stopped', stoppageType: 'Penalty', beneficiary: 'away' });
  avancer(40);
  vm.chainStoppage('But / Célébration', 'away');
  vm.resumePlay();
  assert.equal(vm.match.stoppages[1].endTime, 160);
  assert.deepEqual(M.arret('Penalty').enchaine, ['But / Célébration', 'Blessure / Soins', 'Remplacement']);
});

test('fin de période, mi-temps et période suivante', () => {
  const { vm, avancer } = nouveau();
  vm.startMatch();
  avancer(2760);
  assert.equal(vm.isOverRegulationTime, true);
  assert.equal(vm.overtimeMinutes, 1);
  vm.endPeriod();
  assert.equal(vm.timerState.type, 'periodEnded');
  assert.equal(vm.match.periodDurations['1ère Mi-Temps'], 2760);
  assert.equal(vm.nextPeriod, '2ème Mi-Temps');
  vm.startMatch();
  assert.equal(vm.currentPeriod, '2ème Mi-Temps');
  assert.equal(vm.elapsedTime, 0);
  avancer(30);
  vm.endMatch();
  assert.equal(vm.match.isFinished, true);
  assert.equal(vm.match.periodDurations['2ème Mi-Temps'], 30);
  assert.equal(M.totalMatchDuration(vm.match), 2790);
});

test('carton blanc : 10 minutes de temps écoulé, gelées à la mi-temps', () => {
  const { vm, avancer } = nouveau();
  const j = effectif(vm, 3, 2);
  vm.startMatch();
  avancer(2400);
  vm.addCard('Blanc', 'P. Nom0', j[0].id);
  assert.equal(vm.matchRoster[0].status, 'Expulsé temp.');
  assert.equal(vm.activeTempExpulsions.length, 1);
  avancer(300);
  assert.equal(vm.remainingTempExpulsionTime(vm.activeTempExpulsions[0]), 300);
  vm.endPeriod();
  assert.equal(vm.activeTempExpulsions[0].elapsedAtPause, 300);
  avancer(900); // mi-temps : le temps ne s'écoule pas
  vm.startMatch();
  avancer(299);
  assert.equal(vm.remainingTempExpulsionTime(vm.activeTempExpulsions[0]), 1);
  let fin = null;
  vm.surFinExpulsion = (nom) => { fin = nom; };
  avancer(2);
  assert.equal(vm.activeTempExpulsions.length, 0);
  assert.equal(vm.matchRoster[0].status, 'Titulaire');
  assert.equal(fin, 'P. Nom0');
  assert.equal(vm.match.tempExpulsions[0].isCompleted, true);
});

test('carton rouge : annule le carton blanc en cours et expulse', () => {
  const { vm, avancer } = nouveau();
  const j = effectif(vm);
  vm.startMatch();
  avancer(60);
  vm.addCard('Blanc', 'P. Nom1', j[1].id);
  avancer(60);
  vm.addCard('Rouge', 'P. Nom1', j[1].id);
  assert.equal(vm.activeTempExpulsions.length, 0);
  assert.equal(vm.matchRoster[1].status, 'Expulsé');
  assert.equal(vm.allMatchPlayers.some((p) => p.id === j[1].id), false);
  assert.equal(vm.match.cards[1].matchId, vm.match.id);
  assert.equal(vm.match.cards[1].minute, 120);
});

test('remplacements et temps de jeu en direct', () => {
  const { vm, avancer } = nouveau();
  const j = effectif(vm, 3, 2);
  vm.startMatch();
  avancer(600);
  vm.addSubstitution('P. Nom0', 'P. Nom2', j[0].id, j[2].id);
  assert.equal(vm.matchRoster[0].status, 'Remplaçant');
  assert.equal(vm.matchRoster[2].status, 'Titulaire');
  avancer(600);
  const temps = vm.livePlayerPlayingTimes();
  const de = (id) => temps.find((t) => t.id === id);
  assert.equal(de(j[0].id).totalTime, 600);
  assert.equal(de(j[0].id).isOnField, false);
  assert.equal(de(j[1].id).totalTime, 1200);
  assert.equal(de(j[2].id).totalTime, 600);
  assert.equal(de(j[2].id).isTitulaire, false);
  assert.equal(vm.playingTimeGap, 600);
  // Après la mi-temps, le temps continue de s'additionner
  vm.endPeriod();
  vm.startMatch();
  avancer(300);
  assert.equal(vm.livePlayerPlayingTimes().find((t) => t.id === j[2].id).totalTime, 900);
  vm.endMatch();
  const final = M.playerPlayingTimes(vm.match);
  assert.equal(final.find((t) => t.playerId === j[1].id).totalTime, 1500);
});

test('possession et passes', () => {
  const { vm, avancer } = nouveau();
  vm.startMatch();
  vm.selectPossession('home');
  avancer(10);
  assert.equal(vm.currentHomePossessionTime, 10);
  vm.selectPossession('away');
  assert.equal(vm.match.homePossessionTime, 10);
  avancer(30);
  assert.equal(vm.currentAwayPossessionTime, 30);
  assert.equal(Math.round(vm.homePossessionPercentage), 25);
  vm.stopPlay('Touche', 'home');
  avancer(20);
  assert.equal(vm.currentAwayPossessionTime, 30, 'la possession est en pause pendant un arrêt');
  vm.resumePlay();
  avancer(5);
  assert.equal(vm.currentAwayPossessionTime, 35);
  vm.addPass('home'); vm.addPass('home'); vm.removePass('home'); vm.removePass('away');
  assert.equal(vm.match.homePasses, 1);
  assert.equal(vm.match.awayPasses, 0);
});

test('texte du récapitulatif (buildRecapText)', () => {
  const { vm, avancer } = nouveau();
  vm.match.homeTeam = 'FC Exemple';
  vm.match.awayTeam = 'AS Voisins';
  vm.match.date = '2026-11-21T10:30:00Z';
  vm.startMatch();
  avancer(125);
  vm.addGoal(true, 'Jules Dubois');
  avancer(600);
  vm.addGoal(true, 'Jules Dubois');
  vm.addGoal(false, '');
  vm.addAssist('Louis Richard');
  vm.addCard('Jaune', 'H. Bernard');
  vm.endMatch();
  assert.equal(resultatMatch(vm.match).label, 'Victoire');
  const t = texteRecap(vm.match);
  assert.match(t, /^🏆 FC Exemple 2 - 1 AS Voisins\n\n📅 21 novembre 2026\n/);
  assert.match(t, /⏱ Temps effectif : 12:05 \/ 12:05 \(100%\)/);
  assert.match(t, /⚽ Jules Dubois \(2', 12'\)/);
  assert.match(t, /🅰️ Louis Richard \(12'\)/);
  assert.match(t, /🟨 H\. Bernard \(12'\)/);
  assert.ok(t.endsWith('— Temps De Jeu ⚽'));
});

test('PDF de composition', () => {
  const joueurs = [M.nouveauJoueur({ firstName: 'Lucas', lastName: 'Martin', position: 'Gardien' }), M.nouveauJoueur({ firstName: 'Hugo', lastName: 'Bernard' }), M.nouveauJoueur({ firstName: 'Léo', lastName: 'Thomas' })];
  const roster = [M.matchPlayerDe(joueurs[0], 'Titulaire', 1, true), M.matchPlayerDe(joueurs[1], 'Titulaire', 2), M.matchPlayerDe(joueurs[2], 'Remplaçant', 3)];
  const octets = genererPDFComposition({ roster, teamName: 'FC Exemple U13', competition: 'Championnat', matchDate: '2026-11-21T10:30:00Z', opponent: 'AS Voisins' });
  // (les espaces peuvent être codées en espace insécable \240 par pdf.js)
  const texte = new TextDecoder('latin1').decode(octets).replace(/\\240/g, ' ');
  assert.ok(texte.startsWith('%PDF-1.4'));
  assert.ok(texte.trimEnd().endsWith('%%EOF'));
  // Chaînes PDF : parenthèses échappées, « Ç » en octal (\\307)
  assert.ok(texte.includes('(TITULAIRES \\(2\\)) Tj'));
  assert.ok(texte.includes('(REMPLA\\307ANTS \\(1\\)) Tj'));
  assert.ok(texte.includes('(L. Martin \\(C\\)) Tj'));
  assert.ok(texte.includes('(vs AS Voisins) Tj'));
  assert.equal(titreComposition('FC Exemple U13', '2026-11-21T10:30:00Z'), 'Composition_FC_Exemple_U13_2026-11-21');
});

test('composition partagée (cascade) et joueurs pris dans une autre catégorie', () => {
  const joueurs = [M.nouveauJoueur({ firstName: 'Lucas', lastName: 'Martin' }), M.nouveauJoueur({ firstName: 'Hugo', lastName: 'Bernard' }), M.nouveauJoueur({ firstName: 'Léo', lastName: 'Thomas' })];
  const r = M.composerExportComposition({
    allPlayers: joueurs, selectedPlayerIds: [joueurs[0].id], teamName: 'Équipe A', competition: 'Coupe',
    matchDate: '2026-11-21T10:30:00Z', previousUnavailableIds: [joueurs[2].id], previousChain: ['Équipe Z'], excludePhotos: true, targetTeamCode: 'Q7RT2B',
  });
  assert.deepEqual(r.availablePlayers.map((p) => p.firstName), ['Hugo']);
  assert.deepEqual(r.unavailablePlayerIds, [joueurs[2].id, joueurs[0].id]);
  assert.deepEqual(r.selectionChain, ['Équipe Z', 'Équipe A']);
  const relu = M.lireComposition(JSON.parse(M.ecrireComposition(r)));
  assert.equal(relu.targetTeamCode, 'Q7RT2B');
  assert.equal(relu.formatVersion, 1);

  // Brouillons de deux catégories : un joueur pris en U15 apparaît « dans une autre catégorie » en U13
  const u13 = store.creerProfil('U13', 1, joueurs.map((j) => j.id));
  const u15 = store.creerProfil('U15', 2, []);
  store.enregistrerJoueursGlobal(joueurs);
  const autre = M.nouveauJoueur({ firstName: 'Hugo', lastName: 'Bernard' }); // même nom, autre identifiant
  store.enregistrerBrouillon({ match: M.nouveauMatch(), matchRoster: [M.matchPlayerDe(autre, 'Titulaire', 1), M.matchPlayerDe(joueurs[2], 'Titulaire', 2)], unavailablePlayerIds: [], importChain: [] }, u15.id);
  store.basculerProfil(u13.id);
  const pris = MatchViewModel.playerIdsSelectedInOtherCategories(store.joueurs());
  assert.deepEqual(pris, { [joueurs[1].id]: 'U15', [joueurs[2].id]: 'U15' });
});
