// Tests de la logique de l'Atelier (éditeur, raccourcis, cadrage, matériel, lecture).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import {
  Vue, ModeleEditeur, RACCOURCIS, tousLesRaccourcis, appliquerRaccourci, repartir, effectif, nouvelExercice,
  minutesParDefaut, positionLecture, adoucir, pointsContenu, metresZone, borner, ballonDe, centreCadrage, memeCadrage,
} from '../js/ecrans/atelier/editeur-modele.js';

const proche = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const exerciceVide = () => M.lireTactique({ id: M.uuid(), titre: 'Test', categorie: 'perso', acteurs: [], etapes: [] });

test('fenêtre d’affichage : aller-retour écran ↔ terrain, pivot si plus grand', () => {
  const portrait = new Vue(M.CADRAGES.complet, 390, 600);
  assert.equal(portrait.tourne, false);
  const p = [0.3, 0.7];
  const s = portrait.ecran(p);
  const q = portrait.terrain(s);
  proche(q[0], p[0]); proche(q[1], p[1]);
  // Terrain entier dans un écran large : pivoté (but attaqué à droite)
  const large = new Vue(M.CADRAGES.complet, 1000, 400);
  assert.equal(large.tourne, true);
  const s2 = large.ecran([0.5, 0]);
  const s3 = large.ecran([0.5, 1]);
  assert.ok(s2[0] > s3[0], 'le but attaqué (y = 0) est à droite');
  const q2 = large.terrain(large.ecran(p));
  proche(q2[0], p[0]); proche(q2[1], p[1]);
  // Sans rotation permise
  assert.equal(new Vue(M.CADRAGES.complet, 1000, 400, { rotation: false }).tourne, false);
  // Diamètre d'un joueur borné entre 26 et 40 points
  assert.ok(portrait.diametre >= 26 && portrait.diametre <= 40);
});

test('nouvel exercice et ouverture d’un exercice vide', () => {
  const t = nouvelExercice();
  assert.match(t.titre, /^Exercice du \d+ /);
  assert.equal(t.categorie, 'perso');
  assert.equal(t.etapes.length, 1);
  assert.equal(t.etapes[0].titre, 'Mise en place');
  const m = new ModeleEditeur(exerciceVide());
  assert.equal(m.play.etapes.length, 1);
  assert.deepEqual(m.play.cadrage, M.CADRAGES.centre);
  assert.ok(m.play.creeLe);
  assert.equal(m.estVide, true);
});

test('joueurs : numéros par couleur, gardien, camp', () => {
  const m = new ModeleEditeur(exerciceVide());
  const a = m.ajouterJoueur([0.5, 0.5]);
  const b = m.ajouterJoueur([0.4, 0.5]);
  m.bibColor = 'bleu';
  const c = m.ajouterJoueur([0.6, 0.5]);
  const g = m.ajouterJoueur([0.5, 0.95], { gardien: true });
  const acteur = (id) => m.play.acteurs.find((x) => x.id === id);
  assert.equal(acteur(a).numero, '1');
  assert.equal(acteur(b).numero, '2');
  assert.equal(acteur(c).numero, '1');
  assert.equal(acteur(c).camp, 'equipe');
  assert.equal(acteur(a).camp, 'adversaire');
  assert.equal(acteur(g).numero, 'G');
  assert.equal(acteur(g).chasuble, 'vert');
  assert.equal(acteur(g).poste, 'Gardien');
  assert.match(a, /^j-[0-9a-f]{8}$/);
  assert.deepEqual(m.play.etapes[0].positions[a], [0.5, 0.5]);
  assert.equal(effectif(m.play.acteurs), '2 rouges · 1 bleu · 1 gardien');
  // Hors du terrain : bornée à 3 m des lignes
  assert.deepEqual(borner([2, -1]), [1.04, -0.03]);
});

test('matériel : couleur, zone par défaut, ligne de plots', () => {
  const m = new ModeleEditeur(exerciceVide());
  const i = m.ajouterMateriel('plot', [0.5, 0.5]);
  assert.equal(m.play.materiel[i].couleur, 'orange');
  const j = m.ajouterMateriel('mini-but', [0.5, 0.2]);
  assert.equal(m.play.materiel[j].couleur, undefined);
  const z = m.ajouterMateriel('zone', [0.5, 0.5]);
  assert.equal(m.play.materiel[z].couleur, 'blanc');
  assert.equal(metresZone(m.play.materiel[z].taille), '20 × 15 m');
  const avant = m.play.materiel.length;
  m.ajouterLigne([0.5 - 15 / 68, 0.5], [0.5 + 15 / 68, 0.5]);   // 30 m → un plot tous les 3 m
  assert.equal(m.play.materiel.length - avant, 11);
  // Tourner un mannequin, puis le dupliquer
  const k = m.ajouterMateriel('mannequin', [0.3, 0.3]);
  m.selection = { type: 'prop', index: k };
  m.tournerSelection(45); m.tournerSelection(-90);
  assert.equal(m.play.materiel[k].rotation, 315);
  m.dupliquerSelection();
  const copie = m.play.materiel[m.play.materiel.length - 1];
  assert.equal(copie.type, 'mannequin');
  assert.equal(copie.rotation, 315);
  assert.equal(m.selection.index, m.play.materiel.length - 1);
});

test('ballons : premier, deuxième, joueur qui en a déjà un, passe, tir, promotion', () => {
  const m = new ModeleEditeur(exerciceVide());
  const a = m.ajouterJoueur([0.5, 0.6]);
  const b = m.ajouterJoueur([0.5, 0.3]);
  assert.equal(m.ajouterBallon([0, 0], a), 'ballon');
  assert.equal(m.play.etapes[0].porteur, a);
  assert.equal(m.ajouterBallon([0, 0], a), 'ballon', 'le joueur a déjà un ballon : il est choisi');
  assert.equal(m.ajouterBallon([0.2, 0.2], null), 'ballon-2');
  assert.deepEqual(m.play.etapes[0].autresBallons['ballon-2'], { position: [0.2, 0.2] });

  // Étape 1 : passe de a vers b
  m.ajouterVignette();
  assert.equal(m.vignette, 1);
  m.lacherBallon('ballon', [0.5, 0.3], b);
  assert.equal(m.play.etapes[1].porteur, b);
  assert.equal(m.ballonBougeDansVignette('ballon'), true);
  const fleches = M.flechesEtape(m.courant, 1);
  assert.ok(fleches.some((f) => f.type === 'passe'));
  m.setSorteBallon('ballon', 'centre');
  assert.equal(m.play.etapes[1].action, 'centre');
  assert.equal(m.play.etapes[1].aerien, true);
  assert.equal(m.sorteBallon('ballon'), 'centre');
  // Rendu au même joueur qu'avant : plus d'action dans cette vignette
  m.lacherBallon('ballon', [0.5, 0.6], a);
  assert.equal(m.play.etapes[1].porteur, undefined);
  // Tir dans le but (y ≈ 0)
  m.lacherBallon('ballon', [0.5, 0.01], null);
  assert.equal(m.play.etapes[1].action, 'tir');
  assert.deepEqual(m.play.etapes[1].ballon, [0.5, 0.01]);
  // Le premier ballon enlevé : le deuxième prend sa place
  m.enleverBallon('ballon');
  assert.deepEqual(m.idsBallons, ['ballon']);
  assert.deepEqual(m.play.etapes[0].ballon, [0.2, 0.2]);
  assert.equal(m.play.etapes[0].autresBallons, undefined);
});

test('déplacements dans une vignette, annuler / rétablir', () => {
  const m = new ModeleEditeur(exerciceVide());
  const a = m.ajouterJoueur([0.5, 0.5]);
  m.ajouterVignette();
  m.checkpoint();
  m.deplacerJoueur(a, [0.5, 0.4]);
  assert.deepEqual(m.play.etapes[1].positions[a], [0.5, 0.4]);
  assert.equal(m.joueurDeplace(a), true);
  // Revenu à sa place : il ne bouge plus dans cette vignette
  m.deplacerJoueur(a, [0.501, 0.5]);
  assert.equal(m.play.etapes[1].positions[a], undefined);
  m.deplacerJoueur(a, [0.5, 0.4]);
  const fleches = M.flechesEtape(m.courant, 1);
  assert.equal(fleches.length, 1);
  assert.equal(fleches[0].type, 'course');
  m.annulerDeplacement(a);
  assert.equal(m.joueurDeplace(a), false);
  m.annuler();
  assert.equal(m.joueurDeplace(a), true);
  m.retablir();
  assert.equal(m.joueurDeplace(a), false);
  assert.equal(m.peutAnnuler, true);
  // Supprimer l'étape
  m.supprimerVignette(1);
  assert.equal(m.play.etapes.length, 1);
  assert.equal(m.vignette, 0);
});

test('joueur supprimé : son ballon reste où il était', () => {
  const m = new ModeleEditeur(exerciceVide());
  const a = m.ajouterJoueur([0.4, 0.6]);
  m.ajouterBallon([0, 0], a);
  m.selection = { type: 'actor', id: a };
  m.supprimerSelection();
  assert.equal(m.play.acteurs.length, 0);
  assert.equal(m.play.etapes[0].porteur, undefined);
  assert.ok(m.play.etapes[0].ballon, 'ballon libre à sa place');
  proche(m.play.etapes[0].ballon[0], 0.4 + M.decalageBallon('adversaire')[0]);
});

test('évolutions : copie du contenu, variante, suppression', () => {
  const m = new ModeleEditeur(exerciceVide());
  m.ajouterJoueur([0.5, 0.5]);
  m.ajouterEvolution();
  assert.equal(m.evolution, 0);
  assert.equal(m.play.evolutions[0].titre, 'Évolution 1');
  m.ajouterJoueur([0.4, 0.4]);
  assert.equal(m.play.acteurs.length, 1, 'la base ne change pas');
  assert.equal(m.play.evolutions[0].acteurs.length, 2);
  assert.equal(m.courant.titre, 'Test · Évolution 1');
  m.renommerEvolution(0, '  ', 'Un défenseur en plus');
  assert.equal(m.play.evolutions[0].titre, 'Évolution 1');
  m.renommerEvolution(0, '2 touches', 'Deux touches maximum');
  const fin = m.finalise();
  assert.equal(M.variante(fin, 0).objectif, 'Deux touches maximum');
  assert.equal(M.variante({ ...fin, objectif: 'Conserver' }, 0).objectif, 'Conserver\n2 touches : Deux touches maximum');
  m.supprimerEvolution(0);
  assert.equal(m.play.evolutions, undefined);
  assert.equal(m.evolution, null);
});

test('raccourcis : rondo 4 contre 2, jeu avec jokers, parcours', () => {
  assert.equal(tousLesRaccourcis().length, 18);
  assert.deepEqual(RACCOURCIS.jeux.map((r) => r.titre).slice(0, 5),
    ['Rondo 4 contre 2', 'Rondo 5 contre 2', 'Jeu 3 contre 3', 'Jeu 4 contre 4', '4 contre 4 + 2 jokers']);
  const m = new ModeleEditeur(exerciceVide());
  m.appliquer(RACCOURCIS.jeux[0]);
  assert.equal(m.play.acteurs.length, 6);
  assert.equal(m.play.materiel.length, 5);   // zone + 4 plots
  assert.ok(m.play.etapes[0].porteur, 'le ballon est au pied du premier joueur');
  assert.equal(effectif(m.finalise().acteurs), '4 rouges · 2 bleus');
  assert.deepEqual(M.materielExercice(m.finalise()).map((l) => l.texte),
    ['4 chasubles rouges', '2 chasubles bleues', '4 plots orange', '1 ballon']);
  // Recadré sur l'exercice
  assert.ok(m.play.cadrage.largeur < 0.6);
  m.annuler();
  assert.equal(m.play.acteurs.length, 0, 'un seul « annuler » défait le raccourci');

  const j = new ModeleEditeur(exerciceVide());
  j.appliquer(RACCOURCIS.jeux.find((r) => r.id === 'jeu-4-2'));
  assert.equal(j.play.acteurs.length, 10);
  assert.equal(j.play.materiel.filter((x) => x.type === 'mini-but').length, 2);
  assert.equal(j.play.acteurs.filter((x) => x.chasuble === 'jaune').length, 2);

  const s = new ModeleEditeur(exerciceVide());
  s.appliquer(RACCOURCIS.parcours[0]);
  assert.equal(s.play.materiel.filter((x) => x.type === 'piquet').length, 6);
  assert.equal(repartir(8, 30, 16).length, 8);
  assert.deepEqual(repartir(1, 10, 4), [[0, 2]]);
});

test('aperçu animé : étapes, pauses, fin', () => {
  const t = M.lireTactique({ id: M.uuid(), titre: 'x', acteurs: [], etapes: [{ titre: '', positions: {} }, { titre: '', positions: {}, duree: 1 }, { titre: '', positions: {} }] });
  assert.deepEqual(positionLecture(t, 0.2), [0, 1]);
  const [e, p] = positionLecture(t, 0.9);
  assert.equal(e, 1); proche(p, 0.5);
  assert.deepEqual(positionLecture(t, 1.6), [1, 1]);   // pause après l'étape
  assert.equal(positionLecture(t, 2.0 + 2.0 + 0.6 + 0.1), null);
  proche(adoucir(0.5), 0.5); proche(adoucir(1), 1);
});

test('divers : minutes par défaut, points du contenu, cadrages', () => {
  assert.equal(minutesParDefaut({ duree: '12 min' }), 12);
  assert.equal(minutesParDefaut({ duree: '120 min' }), 90);
  assert.equal(minutesParDefaut({}), 15);
  const t = M.lireTactique({ id: M.uuid(), titre: 'x', acteurs: [], materiel: [{ type: 'zone', pos: [0.5, 0.5], taille: [0.2, 0.1] }], etapes: [{ titre: '', positions: { a: [0.1, 0.2] } }] });
  assert.equal(pointsContenu(t).length, 3);
  assert.deepEqual(centreCadrage({ x: 0, y: 0.5, largeur: 1, longueur: 0.5 }), [0.5, 0.75]);
  assert.ok(memeCadrage(M.CADRAGES.centre, { ...M.CADRAGES.centre }));
  assert.equal(ballonDe(M.resolvedFrames(t)[0], 'ballon-3'), null);
});

test('enregistrement : effectif calculé, catégorie, format de fichier relu à l’identique', () => {
  const m = new ModeleEditeur(M.lireTactique({ id: M.uuid(), titre: 'Mon jeu', categorie: 'autre', acteurs: [], etapes: [{ titre: '', positions: {} }] }));
  m.appliquer(RACCOURCIS.jeux[2]);
  m.ajouterVignette();
  const fin = m.finalise();
  assert.equal(fin.categorie, 'perso');
  assert.equal(fin.etapes[0].titre, 'Mise en place');
  assert.equal(fin.perso, true);
  assert.equal(fin.effectif, '3 rouges · 3 bleus');
  const relu = M.lireFichierTactiques(M.ecrireFichierTactiques([fin]))[0];
  assert.deepEqual(M.ecrireTactique(relu), JSON.parse(JSON.stringify(M.ecrireTactique(fin))));
  // Composition d'équipes avec les couleurs de la séance
  assert.deepEqual(M.couleursEquipes([fin]), ['rouge', 'bleu']);
});

test('appliquerRaccourci directement (sans point d’annulation)', () => {
  const m = new ModeleEditeur(exerciceVide());
  appliquerRaccourci(RACCOURCIS.carres[0], m, [0.5, 0.5]);
  assert.equal(m.play.materiel.length, 5);
  assert.equal(m.peutAnnuler, false);
});
