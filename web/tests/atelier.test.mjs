// Tests de la zone Atelier : construction de séquences (SequenceBuilder), formations
// (FormationView / FormationLayout), lecteur (textes, vitesses, joueurs du match), bibliothèque.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  joueurLePlusProche, cibleBut, estDansLeBut, ballonAuxPieds, photographierEtape, transition, METRE, points,
} from '../js/ecrans/atelier/sequences.js';
import {
  appliquerFormation, repartirSurLigne, emplacementsFormation, libelleVitesse, titreEtape, texteEtape, tempsArret,
  joueursDuMatch, acteurs3D, zoneUtile, correspond, resumeCarte, resumeSeance, nomFichierTactiques, nouvelExercice,
  exerciceDeSequence, titreSequenceParDefaut, sansAccents,
} from '../js/ecrans/atelier/logique.js';
import { lireFichierTactiques, lireTactique, uuidStable } from '../js/model.js';
import { readFileSync } from 'node:fs';

const acteurs = [
  { id: 'a', camp: 'equipe', numero: '6' },
  { id: 'b', camp: 'equipe', numero: '10' },
  { id: 'x', camp: 'adversaire', numero: '2' },
];

test('aimant du ballon : joueur le plus proche à moins de 3,5 m (3D) ou 38 pt (2D)', () => {
  const pos = { a: [0.5, 0.5], b: [0.6, 0.5] };
  assert.equal(joueurLePlusProche([0.52, 0.5], pos, METRE), 'a');          // 1,36 m
  assert.equal(joueurLePlusProche([0.55, 0.6], pos, METRE), null);         // trop loin des deux
  assert.equal(joueurLePlusProche([0.58, 0.5], pos, METRE), 'b');
  assert.equal(joueurLePlusProche([0.54, 0.5], pos, points(400, 600)), 'a'); // 16 pt
});

test('ballon lâché près du but : au fond des filets', () => {
  assert.deepEqual(cibleBut([0.52, 0.05]), [0.52, 0.004]);
  assert.deepEqual(cibleBut([0.6, 0.95]), [0.53, 0.996]);
  assert.equal(cibleBut([0.7, 0.05]), null);
  assert.equal(cibleBut([0.5, 0.5]), null);
  assert.ok(estDansLeBut([0.5, 0.004]));
  assert.ok(!estDansLeBut([0.5, 0.02]));
});

test('ballon aux pieds : décalage selon le camp', () => {
  assert.deepEqual(ballonAuxPieds([0.5, 0.5], 'equipe').map((v) => +v.toFixed(3)), [0.516, 0.494]);
  assert.deepEqual(ballonAuxPieds([0.5, 0.5], 'adversaire').map((v) => +v.toFixed(3)), [0.484, 0.506]);
});

test('photographie d\'une étape (makeStep)', () => {
  const pos = { a: [0.5, 0.5], b: [0.6, 0.4] };
  assert.deepEqual(photographierEtape(pos, 'a', [0.51, 0.49], false), { titre: '', texte: '', duree: 2, positions: pos, porteur: 'a' });
  const tir = photographierEtape(pos, null, [0.5, 0.004], true);
  assert.equal(tir.action, 'tir');
  assert.equal(tir.aerien, true);
  assert.equal(tir.porteur, undefined);
});

test('transition : passe, conduite, tir, récupération, courses', () => {
  const e0 = { titre: '', texte: '', positions: { a: [0.5, 0.6], b: [0.6, 0.4], x: [0.55, 0.5] }, porteur: 'a' };
  const passe = transition(e0, { titre: '', texte: '', positions: { ...e0.positions }, porteur: 'b' }, acteurs);
  assert.equal(passe.resume, 'Passe n°6 → n°10');
  assert.equal(passe.duree, 1.6);
  assert.ok(passe.actionBallon);
  assert.equal(passe.fleches.length, 1);
  assert.equal(passe.fleches[0].type, 'passe');

  const aerien = transition(e0, { titre: '', texte: '', positions: { ...e0.positions }, porteur: 'b', aerien: true }, acteurs);
  assert.equal(aerien.resume, 'Ballon aérien n°6 → n°10');
  assert.equal(aerien.duree, 2);

  const conduite = transition(e0, { titre: '', texte: '', positions: { ...e0.positions, a: [0.5, 0.45] }, porteur: 'a' }, acteurs);
  assert.equal(conduite.resume, 'Conduite n°6');
  assert.equal(conduite.duree, 2.2);

  const recup = transition(e0, { titre: '', texte: '', positions: { ...e0.positions }, porteur: 'x' }, acteurs);
  assert.equal(recup.resume, 'Ballon récupéré par adv. n°2');

  const tir = transition({ ...e0, positions: { ...e0.positions, a: [0.5, 0.1] } }, { titre: '', texte: '', positions: { ...e0.positions, a: [0.5, 0.1] }, ballon: [0.5, 0.004], action: 'tir' }, acteurs);
  assert.equal(tir.resume, 'Tir n°6');
  assert.equal(tir.duree, 1.4);

  const courses = transition(e0, { titre: '', texte: '', positions: { ...e0.positions, b: [0.6, 0.3], x: [0.5, 0.45] }, porteur: 'a' }, acteurs);
  assert.equal(courses.resume, '2 courses');
  const rien = transition(e0, { ...e0 }, acteurs);
  assert.equal(rien.resume, 'Aucun mouvement');
  assert.equal(rien.duree, 1.5);
});

test('formations : à 11, adaptées à 8, et automatique par poste', () => {
  const joueur = (id, position) => ({ id, position, shirtNumber: id.length, status: 'Titulaire' });
  const onze = [joueur('g', 'Gardien'), ...['d1', 'd2', 'd3', 'd4'].map((i) => joueur(i, 'Défenseur')),
    ...['m1', 'm2', 'm3', 'm4'].map((i) => joueur(i, 'Milieu')), joueur('a1', 'Attaquant'), joueur('a2', 'Attaquant')];
  const r = appliquerFormation('f442', onze);
  assert.equal(r.nom, '4-4-2');
  assert.deepEqual(r.positions.g, { x: 0.5, y: 0.9 });
  assert.deepEqual(r.positions.a1, { x: 0.12, y: 0.15000000000000002 });
  const huit = onze.slice(0, 8);
  assert.equal(appliquerFormation('f442', huit).nom, '3-3-1');
  assert.equal(appliquerFormation('f4231', huit).nom, '3-1-2-1');  // plus fort reste : 2,8 1,4 2,1 0,7
  const auto = appliquerFormation('auto', huit);
  assert.equal(auto.nom, 'Auto');
  assert.equal(auto.positions.d1.y, 0.72);
  assert.equal(auto.positions.m1.y, 0.45);
  assert.equal(appliquerFormation('f442', []), null);
  assert.deepEqual(repartirSurLigne(1, 0.4), [{ x: 0.5, y: 0.4 }]);
  assert.equal(emplacementsFormation([1, 4, 4, 2]).length, 4);
});

test('lecteur : vitesses, titres et textes des étapes, temps d\'arrêt', () => {
  assert.equal(libelleVitesse(1), '1×');
  assert.equal(libelleVitesse(0.5), '0,5×');
  assert.equal(libelleVitesse(0.75), '0,75×');
  assert.equal(libelleVitesse(1.5), '1,5×');
  const t = { titre: 'Rondo', objectif: 'Conserver', etapes: [{ titre: '', texte: '' }, { titre: '', texte: '' }, { titre: 'Passe', texte: 'Vite' }] };
  assert.equal(titreEtape(t, 0), 'Mise en place');
  assert.equal(titreEtape(t, 1), 'Étape 2');
  assert.equal(titreEtape(t, 2), 'Passe');
  assert.equal(texteEtape(t, 0), 'Conserver');
  assert.equal(texteEtape({ ...t, objectif: '' }, 0), 'Appuyez sur lecture pour démarrer la démonstration.');
  assert.equal(texteEtape(t, 1), '');
  assert.equal(tempsArret('', 1), 1);
  assert.equal(tempsArret('x'.repeat(450), 2), 2.25);
});

test('lecteur : mes joueurs remplacent ceux de l\'exercice (par poste)', () => {
  const t = { acteurs: [
    { id: 'g', camp: 'equipe', numero: '1', poste: 'Gardien' }, { id: 'm', camp: 'equipe', numero: '8', poste: 'Milieu' },
    { id: 'z', camp: 'equipe', numero: '9' }, { id: 'o', camp: 'adversaire', numero: '4' },
  ] };
  const roster = [
    { shirtNumber: 16, firstName: 'Tom', lastName: 'Lefebvre', position: 'Gardien', status: 'Titulaire' },
    { shirtNumber: 5, firstName: 'Enzo', lastName: 'Robert', position: 'Milieu', status: 'Titulaire' },
    { shirtNumber: 9, firstName: 'Jules', lastName: 'Dubois', position: 'Attaquant', status: 'Titulaire' },
    { shirtNumber: 12, firstName: 'Noah', lastName: 'Michel', position: 'Attaquant', status: 'Remplaçant' },
  ];
  const r = joueursDuMatch(t, roster);
  assert.deepEqual(r.g, { label: '16', name: 'T. Lefebvre' });
  assert.deepEqual(r.m, { label: '5', name: 'E. Robert' });
  assert.deepEqual(r.z, { label: '9', name: 'J. Dubois' });
  assert.equal(r.o, undefined);
  const a = acteurs3D(t, { remplacements: r, nomsVisibles: true });
  assert.equal(a[0].label, '16');
  assert.equal(a[0].isGoalkeeper, true);
  assert.equal(a[3].name, null);
});

test('zone utile de la caméra (focusBounds)', () => {
  const z = zoneUtile({ etapes: [{ positions: { a: [0.2, 0.3] }, ballon: [0.5, 0.6] }], materiel: [{ type: 'zone', pos: [0.4, 0.4], taille: [0.2, 0.2] }] });
  assert.deepEqual(z, { min: [0.2, 0.3], max: [0.5, 0.6] });
  assert.deepEqual(zoneUtile({ etapes: [], materiel: [] }), { min: [0, 0], max: [1, 1] });
});

test('bibliothèque : recherche sans accents, résumés, nom de fichier', () => {
  const biblio = lireFichierTactiques(readFileSync(new URL('../data/exercices.json', import.meta.url), 'utf8'));
  assert.ok(biblio.length >= 12);
  const rondo = biblio.find((t) => t.titre === 'Rondo 4 contre 2');
  assert.equal(rondo.id, uuidStable('biblio-rondo-4c2'));
  assert.ok(correspond(rondo, 'rondo'));
  assert.ok(correspond(rondo, 'CONSERVATION'));
  assert.ok(correspond(rondo, '4 c 2'));
  assert.ok(!correspond(rondo, 'pressing haut'));
  assert.equal(sansAccents('Défense'), 'defense');
  assert.match(resumeCarte(rondo), /^\d+ joueurs · \d+ étapes$/);
  assert.equal(resumeSeance({ date: '2026-11-23T18:00:00Z', exercices: [{ minutes: 15 }, { minutes: 20 }] }), 'lun. 23 nov. · 2 exercices · 35 min');
  assert.equal(resumeSeance({ exercices: [] }), '0 exercice · 0 min');
  assert.equal(nomFichierTactiques([rondo]), 'Rondo 4 contre 2.tdjt');
  assert.equal(nomFichierTactiques([rondo, rondo]), 'Tactiques Temps De Jeu.tdjt');
  assert.equal(nomFichierTactiques([{ titre: 'A/B: C?' }]), 'A-B- C-.tdjt');
  const n = nouvelExercice(new Date(2026, 10, 23));
  assert.equal(n.titre, 'Exercice du 23 nov.');
  assert.equal(n.etapes[0].titre, 'Mise en place');
  assert.equal(lireTactique(n).categorie, 'perso');
});

test('séquence du placement → exercice enregistrable', () => {
  const etapes = [
    { titre: 'Mise en place', texte: '', duree: 1.5, positions: { a: [0.5, 0.6], x: [0.5, 0.5] }, porteur: 'a' },
    { titre: 'Course n°6', texte: '', duree: 2, positions: { a: [0.5, 0.5], x: [0.5, 0.5] }, porteur: 'a' },
  ];
  const t = exerciceDeSequence({ id: 'ID', titre: 'Ma séquence', acteurs: [...acteurs], etapes, modeEntrainement: false, formation: '4-4-2' });
  assert.equal(t.effectif, '1 c 1');
  assert.equal(t.acteurs.length, 2);
  assert.equal(t.objectif, 'Séquence créée depuis le placement (4-4-2).');
  assert.equal(t.source, 'Placement Temps De Jeu');
  assert.equal(t.categorie, 'perso');
  assert.equal(lireTactique(t).etapes.length, 2);
  assert.match(titreSequenceParDefaut({ formation: '4-4-2', date: new Date(2026, 10, 23, 18, 5) }), /^Séquence 4-4-2 – 23 nov\. 2026 à 18:05$/);
  assert.match(titreSequenceParDefaut({ modeEntrainement: true, date: new Date(2026, 10, 23, 18, 5) }), /^Séance du 23 nov\. 2026/);
});
