// Tests de la zone Effectif : Joueurs, Catégories, Encadrement, Cartons, Saisons (logique pure + PDF).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import * as L from '../js/ecrans/effectif/logique.js';
import { genererPDFEncadrement } from '../js/rapports/encadrement.js';

const j = (prenom, nom, poste, dispo = 'Disponible', extra = {}) =>
  M.nouveauJoueur({ firstName: prenom, lastName: nom, position: poste, availability: dispo, ...extra });

test('regroupement par poste : disponibles triés par nom, indisponibles à part, recherche', () => {
  const joueurs = [
    j('Hugo', 'Bernard', 'Défenseur'), j('Lucas', 'Martin', 'Gardien'), j('Léo', 'Thomas', 'Défenseur', 'Blessé'),
    j('Enzo', 'Robert', 'Milieu'), j('Jules', 'Dubois', 'Attaquant'), j('Adam', 'Arnaud', 'Défenseur'),
  ];
  const g = L.regrouperJoueurs(joueurs);
  assert.deepEqual(g.defenseurs.map((p) => p.lastName), ['Arnaud', 'Bernard']);
  assert.equal(g.gardiens.length, 1);
  assert.deepEqual(g.indisponibles.map((p) => p.lastName), ['Thomas']);
  const r = L.regrouperJoueurs(joueurs, 'HUGO');
  assert.equal(r.defenseurs.length, 1);
  assert.equal(r.milieux.length, 0);
});

test("catégorie d'origine : migration puis badge si elle diffère de la catégorie active", () => {
  const a = j('A', 'Un', 'Milieu');
  const b = j('B', 'Deux', 'Milieu');
  const u13 = M.lireProfil({ id: M.uuid(), name: 'U13', colorIndex: 1, playerIds: [a.id, b.id] });
  const u15 = M.lireProfil({ id: M.uuid(), name: 'U15', colorIndex: 2, playerIds: [b.id] });
  const { joueurs, modifie } = L.migrerCategorieOrigine([a, b], [u13, u15]);
  assert.ok(modifie);
  assert.equal(joueurs[1].homeCategoryId, u13.id);
  const vuDepuisU15 = L.categoriesOrigine(joueurs, [u13, u15], u15.id);
  assert.deepEqual(vuDepuisU15.get(b.id), [{ name: 'U13', colorIndex: 1 }]);
  assert.equal(L.categoriesOrigine(joueurs, [u13, u15], u13.id).size, 0);
  assert.equal(L.migrerCategorieOrigine(joueurs, [u13, u15]).modifie, false);
});

test('cartons : comptes par type, purgés exclus, filtres et tri', () => {
  const p = j('Nathan', 'Petit', 'Défenseur');
  const m1 = M.nouveauMatch({ homeTeam: 'FC A', awayTeam: 'AS B', isMyTeamHome: true, date: '2026-11-01T10:00:00Z' });
  const m2 = M.nouveauMatch({ homeTeam: 'US C', awayTeam: 'FC A', isMyTeamHome: false, date: '2026-11-08T10:00:00Z' });
  const carton = (type, period, minute, extra = {}) => M.lireCarton({ id: M.uuid(), type, playerName: 'Nathan Petit', playerId: p.id, minute, period, timestamp: '2026-11-01T10:20:00Z', ...extra });
  m1.cards = [carton('Jaune', '1ère Mi-Temps', 820), carton('Rouge', '2ème Mi-Temps', 300, { isServed: true })];
  m2.cards = [carton('2ème Jaune', '2ème Mi-Temps', 125), carton('Blanc', '1ère Mi-Temps', 61)];
  const enrichis = L.enrichirCartons([m1, m2]);
  assert.equal(enrichis[0].carte.matchLabel, 'FC A - AS B');
  assert.equal(enrichis[2].adversaire, 'US C');
  assert.equal(enrichis[2].carte.matchDate, '2026-11-08T10:00:00Z');
  const tous = L.cartonsFiltres(enrichis);
  assert.equal(tous.length, 3);
  assert.equal(tous[0].carte.type, '2ème Jaune'); // match le plus récent d'abord
  assert.equal(L.cartonsFiltres(enrichis, 'jaunes').length, 2);
  assert.equal(L.cartonsFiltres(enrichis, 'rouges').length, 1); // la 2e jaune compte aussi en rouge
  assert.equal(L.cartonsFiltres(enrichis, 'blancs').length, 1);
  assert.equal(L.cartonsFiltres(enrichis, 'tous', 'us c').length, 2);
  const s = L.joueursSanctionnes([p], enrichis);
  assert.equal(s[0].total, 3);
  assert.equal(s[0].rouge, 0);
  assert.equal(L.momentCarton(m1.cards[0]), "MT1 13'");
  assert.deepEqual(L.compterCartons(L.cartonsActifsJoueur(m1.cards, p.id)), { jaune: 1, deuxiemeJaune: 0, rouge: 0, blanc: 0, total: 1 });
});

test('encadrement : groupes par rôle (ordre des rôles, puis « Autre »), pictogrammes', () => {
  const roles = M.rolesParDefaut();
  const s = (prenom, nom, roleId) => M.lireEncadrant({ id: M.uuid(), firstName: prenom, lastName: nom, roleId, phone: '', email: '', profileIds: [] });
  const groupes = L.encadrantsParRole([s('Zoé', 'Blanc', roles[1].id), s('Paul', 'Arnaud', roles[0].id), s('Inès', 'Durand', M.uuid())], roles);
  assert.deepEqual(groupes.map((g) => g.role.name), ['Coach', 'Coach adjoint', 'Autre']);
  assert.equal(L.iconeRole('Entraîneur des gardiens'), 'sportscourt.fill');
  assert.equal(L.iconeRole('Arbitre'), 'flag.fill');
  assert.equal(L.iconeRole('Responsable médical'), 'cross.case.fill');
  assert.equal(L.iconeRole('Trésorier'), 'person.fill');
  assert.equal(L.nomFichierEncadrement('U13 / Filles', new Date(2026, 10, 23)), 'encadrement_U13_-_Filles_2026-11-23.json');
});

test('import d\'encadrement : rôles fusionnés par nom, fusion et remplacement comme l\'app', () => {
  const roles = M.rolesParDefaut();
  const actif = M.uuid();
  const autre = M.uuid();
  const coachImporte = { id: M.uuid(), name: 'coach', isCustom: false };
  const tresorier = { id: M.uuid(), name: 'Trésorier', isCustom: true };
  const existant = M.lireEncadrant({ id: M.uuid(), firstName: 'Paul', lastName: 'Arnaud', roleId: roles[0].id, phone: '', email: '', profileIds: [autre] });
  const seulActif = M.lireEncadrant({ id: M.uuid(), firstName: 'Old', lastName: 'Staff', roleId: roles[0].id, phone: '', email: '', profileIds: [actif] });
  const importes = [
    M.lireEncadrant({ id: M.uuid(), firstName: 'Paul', lastName: 'Arnaud', roleId: coachImporte.id, phone: '0611', email: 'p@x.fr', profileIds: [] }),
    M.lireEncadrant({ id: M.uuid(), firstName: 'Nina', lastName: 'Roux', roleId: tresorier.id, phone: '', email: '', profileIds: [] }),
  ];
  const fusion = L.importerEncadrement({ mode: 'fusion', tousLesEncadrants: [existant, seulActif], roles, importes, rolesImportes: [coachImporte, tresorier], actifId: actif });
  assert.equal(fusion.roles.length, roles.length + 1);
  assert.equal(fusion.encadrants.length, 3);
  const paul = fusion.encadrants.find((x) => x.firstName === 'Paul');
  assert.equal(paul.phone, '0611');
  assert.deepEqual(paul.profileIds.sort(), [autre, actif].sort());
  const nina = fusion.encadrants.find((x) => x.firstName === 'Nina');
  assert.equal(nina.roleId, tresorier.id);
  assert.deepEqual(nina.profileIds, [actif]);

  const remp = L.importerEncadrement({ mode: 'remplacement', tousLesEncadrants: [existant, seulActif], roles, importes, rolesImportes: [coachImporte], actifId: actif });
  assert.ok(!remp.encadrants.some((x) => x.firstName === 'Old'), "l'encadrant seulement dans la catégorie active est retiré");
  assert.equal(remp.encadrants.length, 3);
  assert.equal(remp.encadrants.find((x) => x.firstName === 'Paul' && x.profileIds.includes(actif)).roleId, roles[0].id, 'rôle de même nom → rôle existant');
  // Données d'échange : le format de l'app iPhone est relu tel quel
  const fichier = JSON.parse(M.ecrireEncadrementJSON(fusion.encadrants, fusion.roles, { teamCode: 'A3K9F2', name: 'U13' }));
  assert.equal(fichier.teamCode, 'A3K9F2');
  assert.equal(M.lireEncadrementJSON(fichier).staffMembers.length, 3);
});

test("affectation des joueurs : groupes par catégorie d'origine, « Sans catégorie » en dernier", () => {
  const a = j('A', 'Alpha', 'Milieu'); const b = j('B', 'Bravo', 'Milieu'); const c = j('C', 'Charlie', 'Milieu');
  const u13 = M.lireProfil({ id: M.uuid(), name: 'U13', colorIndex: 1, playerIds: [a.id] });
  const u15 = M.lireProfil({ id: M.uuid(), name: 'U15', colorIndex: 2, playerIds: [b.id] });
  const { infos, ordre } = L.preparerAffectation(u15, [a, b, c], [u13, u15]);
  assert.deepEqual(ordre.map((g) => g.name), ['U15', 'U13', 'Sans catégorie']);
  assert.equal(infos[a.id].autre, true);
  assert.equal(infos[b.id].autre, false);
  const f = L.joueursFiltres([a, b, c]);
  assert.deepEqual(L.joueursDuGroupe(ordre[0], f, infos, [u13, u15]).map((p) => p.lastName), ['Bravo']);
  assert.deepEqual(L.joueursDuGroupe(ordre[2], f, infos, [u13, u15]).map((p) => p.lastName), ['Charlie']);
});

test('saisons : résumé, bilan d\'une archive et effectif par poste', () => {
  const m = (moi, adv, fini = true, cartons = []) => {
    const x = M.nouveauMatch({ isMyTeamHome: true, homeScore: moi, awayScore: adv, isFinished: fini });
    x.cards = cartons.map((type) => M.lireCarton({ id: M.uuid(), type, playerName: 'X', minute: 60, period: '1ère Mi-Temps' }));
    return x;
  };
  const matchs = [m(3, 1, true, ['Jaune', 'Rouge']), m(1, 1), m(0, 2, true, ['2ème Jaune', 'Blanc']), m(5, 0, false)];
  assert.deepEqual(L.resumeSaison(matchs, [M.nouvelleSeance(), M.nouvelleSeance()]), { matchs: 3, entrainements: 2, cartons: 4 });
  const b = L.bilanArchive({ matches: matchs, trainingSessions: [], players: [] });
  assert.equal(b.victoires, 1); assert.equal(b.nuls, 1); assert.equal(b.defaites, 1);
  assert.equal(b.butsPour, 4); assert.equal(b.butsContre, 4); assert.equal(b.difference, '0');
  assert.equal(b.jaunes, 1); assert.equal(b.rouges, 2);
  assert.equal(L.bilanArchive({ matches: [m(2, 0)], trainingSessions: [], players: [] }).difference, '+2');
  assert.equal(L.resultat(matchs[2]), 'D');
  const ordre = L.effectifParPoste([j('Z', 'Zed', 'Attaquant'), j('Y', 'Bob', 'Gardien'), j('X', 'Abel', 'Attaquant')]);
  assert.deepEqual(ordre.map((p) => p.lastName), ['Bob', 'Abel', 'Zed']);
});

test("PDF de l'encadrement : structure, titre, groupes et pied de page", () => {
  const roles = M.rolesParDefaut();
  const u13 = M.lireProfil({ id: M.uuid(), name: 'U13', colorIndex: 1 });
  const u15 = M.lireProfil({ id: M.uuid(), name: 'U15', colorIndex: 2 });
  const membres = [
    M.lireEncadrant({ id: M.uuid(), firstName: 'Robert', lastName: 'Exemple', roleId: roles[0].id, phone: '06 00 00 00 01', email: 'coach@exemple.fr', profileIds: [u13.id, u15.id] }),
    M.lireEncadrant({ id: M.uuid(), firstName: 'Claire', lastName: 'Dupont', roleId: M.uuid(), phone: '', email: '', profileIds: [u13.id] }),
  ];
  const octets = genererPDFEncadrement(membres, roles, u13, [u13, u15], new Date(2026, 10, 23));
  // Les espaces peuvent être codées en espace insécable (\240) par pdf.js : on les ramène à des espaces
  const texte = new TextDecoder('latin1').decode(octets).replace(/\\240/g, ' ');
  assert.ok(texte.startsWith('%PDF-1.4'));
  assert.ok(texte.trimEnd().endsWith('%%EOF'));
  for (const attendu of ['(Encadrement - Temps De Jeu)', '(Cat\\351gorie : U13)', '(Export\\351 le 23 novembre 2026)',
    '(2 encadrants \\267 2 r\\364les)', '(Coach)', '(Autre)', '(T\\351l. 06 00 00 00 01   coach@exemple.fr)',
    '(Cat\\351gories : U13, U15)', '(Temps De Jeu \\267 23 novembre 2026)']) {
    assert.ok(texte.includes(attendu), `contient ${attendu}`);
  }
  assert.match(texte, /\/Count 1/);
});
