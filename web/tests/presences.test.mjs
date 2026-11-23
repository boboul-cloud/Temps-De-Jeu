// Tests de la zone Présences : invités, statistiques, import, sondage, JSON et PDF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import * as L from '../js/ecrans/presences/logique.js';
import { presencesPDF, feuillePresencePDF, nomFichierPDF } from '../js/rapports/entrainements.js';

const joueur = (firstName, lastName, position = 'Milieu', extra = {}) => M.nouveauJoueur({ firstName, lastName, position, ...extra });
const a = joueur('Hugo', 'Bernard', 'Défenseur', { phoneNumber: '06 11 22 33 44' });
const b = joueur('Léo', 'Thomas');
const c = joueur('Zoé', 'Arnaud', 'Gardien');
const invite = joueur('Paul', 'Durand', 'Attaquant');
const autre = joueur('Inès', 'Blanc');

const u13 = M.lireProfil({ id: M.uuid(), name: 'U13', colorIndex: 1, playerIds: [a.id, b.id, c.id] });
const u15 = M.lireProfil({ id: M.uuid(), name: 'U15', colorIndex: 2, playerIds: [invite.id, a.id] });
const seniors = M.lireProfil({ id: M.uuid(), name: 'Seniors', colorIndex: 3, playerIds: [autre.id, invite.id] });
const tous = [a, b, c, invite, autre];

const jour = (decalage, h = 18) => { const d = new Date(); d.setDate(d.getDate() + decalage); d.setHours(h, 0, 0, 0); return M.iso(d); };

test('joueurs invités : autres catégories, sans doublon, triés par catégorie puis nom', () => {
  const invites = L.joueursInvites({ profils: [u13, u15, seniors], profilActifId: u13.id, tousLesJoueurs: tous, joueursLocaux: [a, b, c] });
  assert.deepEqual(invites.map((g) => [g.categoryName, g.player.lastName]), [['Seniors', 'Blanc'], ['U15', 'Durand']]);
  assert.equal(L.invitesParCategorie(invites).map((g) => g.nom).join(','), 'Seniors,U15');
  assert.deepEqual(L.joueursInvites({ profils: [u13], profilActifId: null, tousLesJoueurs: tous, joueursLocaux: [] }), []);
});

test('présences construites : joueurs de la catégorie + invités présents', () => {
  const invites = L.joueursInvites({ profils: [u13, u15], profilActifId: u13.id, tousLesJoueurs: tous, joueursLocaux: [a, b, c] });
  const liste = L.construirePresences(L.triParNom([a, b, c]), new Set([a.id]), invites, new Set([invite.id]));
  assert.deepEqual(liste.map((x) => [x.lastName, x.isPresent]), [['Arnaud', false], ['Bernard', true], ['Thomas', false], ['Durand', true]]);
});

test('statistiques : fusion des séances des autres catégories, total, invités, moyenne', () => {
  const s1 = M.nouvelleSeance({ date: jour(-3), attendances: [M.presenceDe(a, true), M.presenceDe(b, false), M.presenceDe(c, true), M.presenceDe(autre, true)] });
  const s2 = M.nouvelleSeance({ date: jour(-1), attendances: [M.presenceDe(a, true), M.presenceDe(b, true), M.presenceDe(c, true)] });
  const vieille = M.nouvelleSeance({ date: jour(-90), attendances: [M.presenceDe(a, false)] });
  const ext = M.nouvelleSeance({ date: jour(-2), attendances: [M.presenceDe(a, false), M.presenceDe(invite, true)] });
  const r = L.statistiques({
    seances: [s1, s2, vieille], debut: jour(-30), fin: jour(0), profils: [u13, u15, seniors], profilActifId: u13.id,
    seancesDe: (id) => (id === u15.id ? [ext] : []), tousLesJoueurs: tous,
  });
  assert.equal(r.totalSessionCount, 3);
  const parNom = Object.fromEntries(r.playerStats.map((s) => [s.lastName, `${s.presentSessions}/${s.totalSessions}`]));
  assert.deepEqual(parNom, { Arnaud: '2/2', Bernard: '2/3', Blanc: '1/1', Thomas: '1/2' });
  assert.deepEqual(r.playerStats.map((s) => s.lastName), ['Arnaud', 'Bernard', 'Blanc', 'Thomas']);
  assert.deepEqual(r.guestInfo[autre.id], { name: 'Seniors', colorIndex: 3 });
  assert.equal(r.guestInfo[a.id], undefined);
  assert.equal(Math.trunc(L.presenceMoyenne(r.playerStats)), 75);
  assert.equal(L.couleurTaux(75), 'green');
  assert.equal(L.couleurTaux(74.9), 'orange');
  assert.equal(L.couleurTaux(49), 'red');
  assert.equal(L.pourcentEntier(66.67), '66%');
});

test('noms de catégorie des invités pour les exports', () => {
  const s = M.nouvelleSeance({ attendances: [M.presenceDe(a, true), M.presenceDe(autre, true)] });
  assert.deepEqual(L.nomsCategoriesInvites([s], [u13, u15, seniors], u13.id), { [autre.id]: 'Seniors' });
});

test('import : fusion sans doublon ou remplacement, messages', () => {
  const s1 = M.nouvelleSeance(); const s2 = M.nouvelleSeance(); const s3 = M.nouvelleSeance();
  assert.deepEqual(L.importerSeances([s1, s2], [s2, s3], 'merge').map((s) => s.id), [s1.id, s2.id, s3.id]);
  assert.deepEqual(L.importerSeances([s1, s2], [s3], 'replace').map((s) => s.id), [s3.id]);
  assert.equal(L.messageImport('replace', 4, 4), '4 entraînements importés (remplacement).');
  assert.equal(L.messageImport('merge', 2, 7), 'Entraînements mis à jour. 7 entraînements au total.');
});

test('export JSON relu à l\'identique (format TrainingAttendanceExport)', () => {
  const s = M.nouvelleSeance({ date: jour(-1), notes: 'Jeu réduit', location: 'Stade', attendances: [M.presenceDe(a, true), M.presenceDe(b, false)] });
  s.availabilityResponses = [M.lireReponse({ id: a.id, playerName: 'Hugo Bernard', status: 1, comment: 'ok', respondedAt: jour(-2) })];
  const stats = M.calculatePlayerStats([s]);
  const texte = M.ecrirePresencesJSON([s], stats, jour(-30), jour(0));
  const o = JSON.parse(texte);
  assert.deepEqual(Object.keys(o).sort(), ['endDate', 'exportDate', 'playerStats', 'sessions', 'startDate']);
  assert.match(o.startDate, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.deepEqual(Object.keys(o.playerStats[0]).sort(), ['firstName', 'lastName', 'playerId', 'presentSessions', 'totalSessions']);
  assert.deepEqual(Object.keys(o.sessions[0]).sort(), ['attendances', 'availabilityResponses', 'date', 'id', 'location', 'notes']);
  const relu = M.lirePresencesJSON(o);
  assert.deepEqual(relu.sessions, [s]);
  assert.deepEqual(relu.playerStats, stats);
});

test('sondage : téléphone du coach, résumé, tri, joueurs avec numéro, lien SMS', () => {
  const roles = M.rolesParDefaut();
  const enc = [
    M.lireEncadrant({ roleId: roles[1].id, phone: '0600000009' }),
    M.lireEncadrant({ roleId: roles[0].id, phone: '  ' }),
    M.lireEncadrant({ roleId: roles[0].id, phone: '0600000001' }),
  ];
  assert.equal(L.telephoneCoach(roles, enc), '0600000001');
  assert.equal(L.telephoneCoach(roles, []), '');
  const s = M.nouvelleSeance();
  s.availabilityResponses = [
    M.lireReponse({ id: b.id, playerName: 'Léo Thomas', status: 0 }),
    M.lireReponse({ id: a.id, playerName: 'Hugo Bernard', status: 1 }),
  ];
  assert.deepEqual(L.resumeSondage(s, [a, b, c]), { presents: 1, absents: 1, incertains: 0, enAttente: 1 });
  assert.deepEqual(L.reponsesTriees(s).map((r) => r.playerName), ['Hugo Bernard', 'Léo Thomas']);
  assert.deepEqual(L.joueursAvecTelephone([a, b, joueur('X', 'Y', 'Milieu', { phoneNumber: ' ' })]).map((j) => j.id), [a.id]);
  assert.equal(L.lienSMSGroupe(['06 11 22 33 44', '0700000000'], 'Salut', true), 'sms:/open?addresses=0611223344,0700000000&body=Salut');
  assert.equal(L.lienSMSGroupe(['0611223344'], 'a b', true), 'sms:0611223344&body=a%20b');
  assert.equal(L.lienSMSGroupe(['0611223344', '0700000000'], 'x', false), 'sms:0611223344,0700000000?body=x');
});

test('réponses appliquées aux présences (y compris joueur ajouté après la séance)', () => {
  const s = M.nouvelleSeance({ attendances: [M.presenceDe(a, false), M.presenceDe(b, true)] });
  s.availabilityResponses = [
    M.lireReponse({ id: a.id, playerName: 'Hugo Bernard', status: 1 }),
    M.lireReponse({ id: b.id, playerName: 'Léo Thomas', status: 2 }),
    M.lireReponse({ id: c.id, playerName: 'Zoé Arnaud', status: 1 }),
    M.lireReponse({ id: M.uuid(), playerName: 'Jean De La Tour', status: 0 }),
  ];
  M.applyResponsesToAttendance(s, tous);
  assert.deepEqual(s.attendances.map((x) => [x.firstName, x.lastName, x.isPresent]), [
    ['Hugo', 'Bernard', true], ['Léo', 'Thomas', false], ['Zoé', 'Arnaud', true], ['Jean', 'De La Tour', false],
  ]);
});

test('lien de sondage : décompressé, il donne le format attendu par dispo.html', async () => {
  const s = M.nouvelleSeance({ date: '2026-11-25T17:00:00Z' });
  const url = await M.lienSondage({ teamName: 'U13', sessionId: s.id, sessionDate: s.date, players: [a, b], coachPhone: ' 0600000001 ' });
  assert.ok(url.startsWith(`${M.SITE}/dispo.html?z=`));
  const z = url.split('?z=')[1];
  let b64 = z.replace(/-/g, '+').replace(/_/g, '/');
  b64 += '='.repeat((4 - (b64.length % 4)) % 4);
  const octets = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const o = JSON.parse(new TextDecoder().decode(await M.decompresser(octets)));
  assert.equal(o.t, 'U13');
  assert.equal(o.s, s.id.slice(0, 8));
  assert.equal(o.c, '0600000001');
  assert.deepEqual(o.p, [[a.id.slice(0, 8), 'Hugo Bernard'], [b.id.slice(0, 8), 'Léo Thomas']]);
  const msg = M.messageSondageIndividuel({ teamName: 'U13', sessionDate: s.date, location: 'Stade', playerFirstName: 'Hugo', url });
  assert.match(msg, /^⚽ Bonjour Hugo !\n📅 Entraînement U13 — \d+ novembre 2026\n📍 Stade\n\n\nTouche le lien/);
});

test('date relative courte', () => {
  const maintenant = new Date('2026-11-23T12:00:00Z');
  const rel = (d) => L.dateRelative(d, maintenant).replace(/[\u00a0\u202f]/g, ' ');
  assert.equal(rel('2026-11-23T09:00:00Z'), 'il y a 3 h');
  assert.equal(rel('2026-11-21T12:00:00Z'), 'il y a 2 j');
  assert.equal(rel('2026-11-23T11:59:30Z'), 'il y a 30 s');
});

test('PDF : présences sur une période et feuille de présence', () => {
  const s = M.nouvelleSeance({ date: '2026-11-20T17:00:00Z', notes: 'Rondos', location: 'Stade (terrain 2)', attendances: [M.presenceDe(a, true), M.presenceDe(b, false), M.presenceDe(autre, true)] });
  const stats = M.calculatePlayerStats([s]);
  // Les espaces peuvent être écrites en espace insécable (\240) par pdf.js : on les ramène à « »
  const decoder = { decode: (o) => new TextDecoder('latin1').decode(o).replaceAll('\\240', ' ') };
  const p1 = decoder.decode(presencesPDF({ sessions: [s], playerStats: stats, startDate: '2026-10-20T10:00:00Z', endDate: '2026-11-20T10:00:00Z', guestCategoryNames: { [autre.id]: 'Seniors' } }));
  assert.ok(p1.startsWith('%PDF-1.4'));
  assert.ok(p1.trimEnd().endsWith('%%EOF'));
  for (const t of ['(Pr\\351sences aux entra\\356nements)', '(Statistiques par joueur)', '(D\\351tail par entra\\356nement)', '(In\\350s Blanc \\(Seniors\\))', '(Taux)']) {
    assert.ok(p1.includes(t), `manque ${t}`);
  }
  const p2 = decoder.decode(feuillePresencePDF(s, {}));
  for (const t of ['(Feuille de pr\\351sence)', '(Joueurs pr\\351sents)', '(Joueurs absents)', '(1. L\\351o Thomas)', '(Note: Rondos)', '(Stade \\(terrain 2\\))']) {
    assert.ok(p2.includes(t), `manque ${t}`);
  }
  assert.equal(nomFichierPDF('Entrainement 2026-11-20'), 'Entrainement_2026-11-20.pdf');
  assert.equal(L.plageDates('2026-10-20T10:00:00Z', '2026-11-20T10:00:00Z'), '2026-10-20_2026-11-20');
});
