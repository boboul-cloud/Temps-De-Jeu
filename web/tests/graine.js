// Données de démonstration pour les essais dans le navigateur (non publiées : dossier tests/).
// Dans la console ou le banc d'essai : await (await import('/tests/graine.js')).semer()
import * as M from '../js/model.js';
import { store } from '../js/store.js';

const JOUEURS = [
  ['Lucas', 'Martin', 'Gardien', '0601020304'],
  ['Hugo', 'Bernard', 'Défenseur', '0611223344'],
  ['Léo', 'Thomas', 'Défenseur', ''],
  ['Nathan', 'Petit', 'Défenseur', '0622334455'],
  ['Enzo', 'Robert', 'Milieu', '0633445566'],
  ['Louis', 'Richard', 'Milieu', ''],
  ['Gabriel', 'Durand', 'Milieu', '0644556677'],
  ['Jules', 'Dubois', 'Attaquant', ''],
  ['Arthur', 'Moreau', 'Attaquant', '0655667788'],
  ['Raphaël', 'Laurent', 'Milieu', ''],
  ['Adam', 'Simon', 'Défenseur', ''],
  ['Noah', 'Michel', 'Attaquant', '0666778899'],
  ['Tom', 'Lefebvre', 'Gardien', ''],
  ['Sacha', 'Leroy', 'Milieu', ''],
];

const jour = (decalageJours, heure = 10, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  d.setHours(heure, minute, 0, 0);
  return M.iso(d);
};

function match({ date, adversaire, domicile, scoreMoi, scoreAdv, joueurs, titulaires, remplacements, cartons, buteurs }) {
  const roster = joueurs.map((p, i) => ({
    ...M.matchPlayerDe(p, titulaires.includes(i) ? 'Titulaire' : 'Remplaçant', i + 1, i === 4),
  }));
  const m = M.nouveauMatch({
    homeTeam: domicile ? 'FC Exemple U13' : adversaire,
    awayTeam: domicile ? adversaire : 'FC Exemple U13',
    competition: 'Championnat U13 — Phase 1',
    date,
    isMyTeamHome: domicile,
    isFinished: true,
    periodDurations: { '1ère Mi-Temps': 30 * 60 + 74, '2ème Mi-Temps': 30 * 60 + 112 },
    homeScore: domicile ? scoreMoi : scoreAdv,
    awayScore: domicile ? scoreAdv : scoreMoi,
    homeJerseyColor: domicile ? 'Bleu' : 'Rouge',
    awayJerseyColor: domicile ? 'Rouge' : 'Bleu',
    homePossessionTime: 1690, awayPossessionTime: 1320, homePasses: 142, awayPasses: 118,
    refereeCentre: 'M. Garnier',
    selectedFormation: '3-3-1',
    notes: 'Bon match, belle réaction en deuxième mi-temps.',
  });
  m.matchRoster = roster;
  const ts = (min) => M.iso(new Date(M.dateDe(date).getTime() + min * 60000));
  const arret = (type, period, start, duree, equipe) => M.lireStoppage({
    id: M.uuid(), type, period, startTime: start, endTime: start + duree, timestamp: ts(start / 60), beneficiaryTeam: equipe,
  });
  m.stoppages = [
    arret('Touche', '1ère Mi-Temps', 120, 14, 'home'), arret('Corner', '1ère Mi-Temps', 410, 32, 'away'),
    arret('Coup Franc', '1ère Mi-Temps', 900, 41, 'home'), arret('Blessure / Soins', '1ère Mi-Temps', 1300, 74, undefined),
    arret('But / Célébration', '1ère Mi-Temps', 1500, 55, 'home'), arret('Remplacement', '2ème Mi-Temps', 600, 28, undefined),
    arret('Touche', '2ème Mi-Temps', 700, 12, 'away'), arret('6 Mètres', '2ème Mi-Temps', 1100, 25, 'home'),
    arret('Hors-jeu', '2ème Mi-Temps', 1400, 20, 'away'), arret('Remplacement', '2ème Mi-Temps', 1450, 30, undefined),
  ];
  m.substitutions = remplacements.map(([sortant, entrant, periode, minute]) => M.lireRemplacement({
    id: M.uuid(), playerOut: M.fullName(joueurs[sortant]), playerIn: M.fullName(joueurs[entrant]),
    playerOutId: joueurs[sortant].id, playerInId: joueurs[entrant].id, minute, period: periode, timestamp: ts(minute / 60),
  }));
  for (const [s, e] of remplacements) { roster[s].status = 'Remplaçant'; roster[e].status = 'Titulaire'; }
  m.goals = buteurs.map(([i, periode, minute, moi]) => M.lireGoal({
    id: M.uuid(), isHome: domicile ? moi : !moi, minute, period: periode, playerName: i == null ? '' : M.fullName(joueurs[i]), timestamp: ts(minute / 60),
  }));
  m.cards = cartons.map(([i, type, periode, minute]) => M.lireCarton({
    id: M.uuid(), type, playerName: M.fullName(joueurs[i]), playerId: joueurs[i].id, minute, period: periode, timestamp: ts(minute / 60),
    matchId: m.id, matchLabel: `${m.homeTeam} - ${m.awayTeam}`, matchDate: date,
  }));
  m.fouls = [M.lireFaute({ id: M.uuid(), playerName: M.fullName(joueurs[3]), playerId: joueurs[3].id, minute: 800, period: '1ère Mi-Temps', timestamp: ts(13) })];
  m.assists = [M.lirePasse({ id: M.uuid(), playerName: M.fullName(joueurs[5]), playerId: joueurs[5].id, minute: 1490, period: '1ère Mi-Temps', timestamp: ts(25) })];
  return m;
}

/** Remplace les données du navigateur par un jeu de démonstration (catégorie U13) */
export function semer({ deuxCategories = true } = {}) {
  const s = store.stockage;
  const cles = [];
  for (let i = 0; i < s.length; i++) cles.push(s.key(i));
  for (const k of cles) if (k?.startsWith('tdj.')) s.removeItem(k);
  store.cache.clear();
  store.profils = [];
  store.profilActifId = null;
  store.initialiserRoles();

  const joueurs = JOUEURS.map(([firstName, lastName, position, tel], i) => M.nouveauJoueur({
    firstName, lastName, position, phoneNumber: tel || undefined,
    availability: i === 10 ? 'Blessé' : i === 13 ? 'Suspendu' : 'Disponible',
  }));
  const u13 = store.creerProfil('U13', 1, joueurs.map((j) => j.id), 'A3K9F2');
  store.enregistrerJoueursGlobal(joueurs);
  if (deuxCategories) store.creerProfil('U15', 2, joueurs.slice(0, 4).map((j) => j.id), 'Q7RT2B');
  store.basculerProfil(u13.id);

  const roles = store.roles();
  store.enregistrerTousEncadrants([
    M.lireEncadrant({ id: M.uuid(), firstName: 'Robert', lastName: 'Exemple', roleId: roles[0].id, phone: '0600000001', email: 'coach@exemple.fr', profileIds: [u13.id] }),
    M.lireEncadrant({ id: M.uuid(), firstName: 'Claire', lastName: 'Dupont', roleId: roles[1].id, phone: '0600000002', email: '', profileIds: [u13.id] }),
  ]);
  store.creerSaison('FC Exemple', 'U13', new Date(new Date().getFullYear(), 8, 1));

  const sel = joueurs.slice(0, 12);
  store.enregistrerMatchs([
    match({
      date: jour(-3, 10, 30), adversaire: 'AS Voisins', domicile: true, scoreMoi: 3, scoreAdv: 1, joueurs: sel,
      titulaires: [0, 1, 2, 3, 4, 5, 6, 7],
      remplacements: [[7, 8, '2ème Mi-Temps', 600], [2, 9, '2ème Mi-Temps', 900], [5, 11, '2ème Mi-Temps', 1450]],
      cartons: [[3, 'Jaune', '1ère Mi-Temps', 820], [6, 'Blanc', '2ème Mi-Temps', 1200]],
      buteurs: [[7, '1ère Mi-Temps', 1490, true], [8, '2ème Mi-Temps', 840, true], [null, '2ème Mi-Temps', 1000, false], [4, '2ème Mi-Temps', 1700, true]],
    }),
    match({
      date: jour(-10, 14, 0), adversaire: 'US Rivière', domicile: false, scoreMoi: 1, scoreAdv: 2, joueurs: sel,
      titulaires: [0, 1, 2, 3, 4, 5, 6, 8],
      remplacements: [[8, 7, '1ère Mi-Temps', 1200], [1, 10, '2ème Mi-Temps', 300]],
      cartons: [[1, 'Jaune', '1ère Mi-Temps', 500], [1, '2ème Jaune', '2ème Mi-Temps', 200]],
      buteurs: [[null, '1ère Mi-Temps', 400, false], [7, '2ème Mi-Temps', 1300, true], [null, '2ème Mi-Temps', 1750, false]],
    }),
  ]);

  const seance = (decalage, presents, lieu = 'Stade municipal') => M.nouvelleSeance({
    date: jour(decalage, 18, 0), location: lieu, notes: '',
    attendances: joueurs.map((j, i) => M.presenceDe(j, presents.includes(i))),
  });
  const prochaine = seance(2, [], 'Stade municipal — terrain 2');
  prochaine.availabilityResponses = [
    M.lireReponse({ id: joueurs[1].id, playerName: M.fullName(joueurs[1]), status: 1, comment: '', respondedAt: jour(0, 9) }),
    M.lireReponse({ id: joueurs[4].id, playerName: M.fullName(joueurs[4]), status: 0, comment: 'Malade', respondedAt: jour(0, 9, 30) }),
    M.lireReponse({ id: joueurs[7].id, playerName: M.fullName(joueurs[7]), status: 2, comment: '', respondedAt: jour(0, 10) }),
  ];
  store.enregistrerSeances([
    seance(-8, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]),
    seance(-5, [0, 1, 3, 4, 5, 6, 7, 9, 11, 12]),
    seance(-1, [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    prochaine,
  ]);

  const rondo = M.uuidStable('biblio-rondo-4c2');
  store.enregistrerPlan(M.lirePlan({
    id: M.uuid(), titre: 'Séance du mardi', date: jour(2, 18), notes: "Jeu vers l'avant",
    exercices: [{ id: M.uuid(), exercice: rondo, minutes: 15, note: '' }], simultane: false, equipes: [], creeLe: M.iso(),
  }));
  store.notifier();
  return { joueurs: joueurs.length, matchs: store.matchs().length, seances: store.seances().length };
}
