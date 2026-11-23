// Logique pure des écrans Joueurs, Catégories, Encadrement, Cartons et Saisons
// (sans DOM : testée par tests/effectif.test.mjs). Port fidèle des calculs des vues Swift.
import * as M from '../../model.js';

/** localizedCaseInsensitiveContains */
export const contient = (texte, recherche) =>
  String(texte ?? '').toLocaleLowerCase('fr').includes(String(recherche ?? '').toLocaleLowerCase('fr'));

/** Couleur d'un poste (PlayerAvatar.positionColor) */
export const COULEUR_POSTE = { Gardien: 'orange', Défenseur: 'blue', Milieu: 'green', Attaquant: 'red' };
export const couleurPoste = (poste) => COULEUR_POSTE[poste] ?? 'green';

/** Couleur d'un carton (Color.cardYellow…) */
export const COULEUR_CARTON = { Jaune: 'cardYellow', '2ème Jaune': 'cardOrange', Rouge: 'cardRed', Blanc: 'cardWhite' };

/** Couleur d'une disponibilité (UnavailablePlayerRow.availabilityColor) */
export const couleurDispo = (d) => M.DISPO_COULEUR[d] ?? 'green';

// MARK: - Mes joueurs (TeamManagementView)

/** Joueurs triés par nom, filtrés par la recherche (filteredPlayers) */
export function joueursFiltres(joueurs, recherche = '') {
  const tries = [...joueurs].sort((a, b) => M.comparer(a.lastName, b.lastName));
  if (recherche === '') return tries;
  return tries.filter((p) => contient(M.fullName(p), recherche));
}

/** Regroupement de la liste : disponibles par poste, puis indisponibles */
export function regrouperJoueurs(joueurs, recherche = '') {
  const f = joueursFiltres(joueurs, recherche);
  const dispo = (poste) => f.filter((p) => p.position === poste && p.availability === 'Disponible');
  return {
    gardiens: dispo('Gardien'),
    defenseurs: dispo('Défenseur'),
    milieux: dispo('Milieu'),
    attaquants: dispo('Attaquant'),
    indisponibles: f.filter((p) => p.availability !== 'Disponible'),
  };
}

/**
 * Catégorie d'origine affectée aux joueurs qui n'en ont pas (migrateHomeCategoryIfNeeded) :
 * la première catégorie (dans l'ordre) qui contient le joueur. Renvoie { joueurs, modifie }.
 */
export function migrerCategorieOrigine(joueurs, profils) {
  let modifie = false;
  const res = joueurs.map((p) => {
    if (p.homeCategoryId) return p;
    const origine = profils.find((x) => x.playerIds.includes(p.id));
    if (!origine) return p;
    modifie = true;
    return { ...p, homeCategoryId: origine.id };
  });
  return { joueurs: res, modifie };
}

/** Catégorie d'origine affichée à côté du poste si elle diffère de la catégorie active (computeOtherCategories) */
export function categoriesOrigine(joueurs, profils, actifId) {
  const res = new Map();
  if (!actifId) return res;
  for (const p of joueurs) {
    const origineId = p.homeCategoryId ?? profils.find((x) => x.playerIds.includes(p.id))?.id;
    if (!origineId || origineId === actifId) continue;
    const origine = profils.find((x) => x.id === origineId);
    if (origine) res.set(p.id, [{ name: origine.name, colorIndex: origine.colorIndex }]);
  }
  return res;
}

/** Cartons non purgés d'un joueur (cardsForPlayer) */
export const cartonsActifsJoueur = (cartons, joueurId) => cartons.filter((c) => c.playerId === joueurId && !c.isServed);

/** Comptes par type : { jaune, deuxiemeJaune, rouge, blanc, total } */
export function compterCartons(cartons) {
  const n = (type) => cartons.filter((c) => c.type === type).length;
  const r = { jaune: n('Jaune'), deuxiemeJaune: n('2ème Jaune'), rouge: n('Rouge'), blanc: n('Blanc') };
  r.total = r.jaune + r.deuxiemeJaune + r.rouge + r.blanc;
  return r;
}

// MARK: - Catégories (ProfileManagementView)

/**
 * Données figées à l'ouverture de l'affectation des joueurs (PlayerAssignmentSheet.init) :
 * couleur et catégorie d'origine de chaque joueur, ordre des groupes.
 */
export function preparerAffectation(profil, tousLesJoueurs, profils) {
  const infos = {};
  for (const p of tousLesJoueurs) {
    const origine = (p.homeCategoryId && profils.find((x) => x.id === p.homeCategoryId))
      || profils.find((x) => x.playerIds.includes(p.id));
    if (origine) {
      infos[p.id] = { couleur: M.couleurProfil(origine.colorIndex), autre: origine.id !== profil.id, nomCategorie: origine.name, indexCouleur: origine.colorIndex };
    }
  }
  const ordre = [{ id: profil.id, name: profil.name, colorIndex: profil.colorIndex }];
  for (const p of profils) if (p.id !== profil.id) ordre.push({ id: p.id, name: p.name, colorIndex: p.colorIndex });
  ordre.push({ id: 'sans-categorie', name: 'Sans catégorie', colorIndex: -1 });
  return { infos, ordre };
}

/** Joueurs d'un groupe de l'affectation (playersForCategory) — comparaison par nom de catégorie, comme l'app */
export function joueursDuGroupe(groupe, joueursFiltresListe, infos, profils) {
  const sansCategorie = !profils.some((p) => p.id === groupe.id);
  return joueursFiltresListe.filter((p) => {
    const nom = infos[p.id]?.nomCategorie;
    if (sansCategorie) return nom == null;
    return nom != null && nom === groupe.name;
  });
}

// MARK: - Encadrement (StaffManagementView)

/** Encadrants triés par nom et filtrés (filteredStaff) */
export function encadrantsFiltres(encadrants, recherche = '') {
  const tries = [...encadrants].sort((a, b) => M.comparer(a.lastName, b.lastName));
  if (recherche === '') return tries;
  return tries.filter((s) => contient(M.nomEncadrant(s), recherche));
}

/** Encadrants groupés par rôle, dans l'ordre des rôles, puis « Autre » (staffByRole) */
export function encadrantsParRole(encadrants, roles, recherche = '') {
  const f = encadrantsFiltres(encadrants, recherche);
  const groupes = [];
  for (const role of roles) {
    const membres = f.filter((s) => s.roleId === role.id);
    if (membres.length) groupes.push({ role, membres });
  }
  const connus = new Set(roles.map((r) => r.id));
  const orphelins = f.filter((s) => !connus.has(s.roleId));
  if (orphelins.length) groupes.push({ role: { id: 'autre', name: 'Autre', isCustom: false }, membres: orphelins });
  return groupes;
}

/** Pictogramme selon le nom du rôle (iconForRole) */
export function iconeRole(nom) {
  const n = nom.toLowerCase();
  if (n.includes('coach') || n.includes('entraîneur')) return 'sportscourt.fill';
  if (n.includes('arbitre')) return 'flag.fill';
  if (n.includes('délégué')) return 'person.text.rectangle';
  if (n.includes('préparateur')) return 'figure.run';
  if (n.includes('gardien')) return 'hand.raised.fill';
  if (n.includes('intendant')) return 'shippingbox.fill';
  if (n.includes('médical') || n.includes('kiné') || n.includes('soigneur')) return 'cross.case.fill';
  return 'person.fill';
}

/**
 * Import d'un fichier d'encadrement (performStaffImport).
 * mode : 'fusion' | 'remplacement'. Renvoie { encadrants, roles }.
 */
export function importerEncadrement({ mode, tousLesEncadrants, roles, importes, rolesImportes, actifId, nouvelId = M.uuid }) {
  const rolesActuels = [...roles];
  const idsExistants = new Set(rolesActuels.map((r) => r.id));
  const correspondance = new Map();
  for (const r of rolesImportes) {
    if (idsExistants.has(r.id)) correspondance.set(r.id, r.id);
    else {
      const meme = rolesActuels.find((x) => x.name.toLowerCase() === r.name.toLowerCase());
      if (meme) correspondance.set(r.id, meme.id);
      else { rolesActuels.push(r); correspondance.set(r.id, r.id); }
    }
  }
  const nouveau = (s) => ({
    id: nouvelId(), firstName: s.firstName, lastName: s.lastName, roleId: correspondance.get(s.roleId) ?? s.roleId,
    phone: s.phone, email: s.email, photoData: s.photoData, profileIds: actifId ? [actifId] : [...s.profileIds],
  });
  let tous = tousLesEncadrants.map((s) => ({ ...s, profileIds: [...s.profileIds] }));
  if (mode === 'remplacement') {
    tous = tous.map((s) => (actifId && s.profileIds.includes(actifId) ? { ...s, profileIds: s.profileIds.filter((x) => x !== actifId) } : s));
    tous = tous.filter((s) => s.profileIds.length > 0);
    for (const s of importes) tous.push(nouveau(s));
  } else {
    for (const s of importes) {
      const nom = M.nomEncadrant(s).toLowerCase();
      const existant = tous.find((x) => M.nomEncadrant(x).toLowerCase() === nom);
      if (existant) {
        if (existant.phone === '' && s.phone !== '') existant.phone = s.phone;
        if (existant.email === '' && s.email !== '') existant.email = s.email;
        if (existant.photoData == null && s.photoData) existant.photoData = s.photoData;
        if (actifId && !existant.profileIds.includes(actifId)) existant.profileIds.push(actifId);
      } else {
        tous.push(nouveau(s));
      }
    }
  }
  return { encadrants: tous, roles: rolesActuels };
}

/** Nom du fichier d'export : « encadrement_U13_2026-11-23.json » */
export function nomFichierEncadrement(nomCategorie, date = new Date()) {
  const cat = (nomCategorie ?? 'tous').replaceAll(' ', '_').replaceAll('/', '-');
  return `encadrement_${cat}_${M.formatDateMotif(date, 'yyyy-MM-dd')}.json`;
}

// MARK: - Cartons (CardsManagementView)

/** Cartons de tous les matchs, complétés du match et de l'adversaire (loadCards) */
export function enrichirCartons(matchs) {
  return matchs.flatMap((m) => {
    const adversaire = M.opponentName(m) === '' ? null : M.opponentName(m);
    return m.cards.map((c) => {
      const carte = { ...c };
      if (carte.matchId == null) carte.matchId = m.id;
      if (carte.matchDate == null) carte.matchDate = m.date;
      if (carte.matchLabel == null) {
        const libelle = [m.homeTeam, m.awayTeam].filter((x) => x !== '').join(' - ');
        carte.matchLabel = libelle === '' ? undefined : libelle;
      }
      return { carte, adversaire };
    });
  });
}

export const FILTRES_CARTONS = [['tous', 'Tous'], ['jaunes', 'Jaunes'], ['rouges', 'Rouges'], ['blancs', 'Blancs']];

/** Cartons en cours, filtrés, du plus récent au plus ancien (filteredCards) */
export function cartonsFiltres(enrichis, filtre = 'tous', recherche = '') {
  let l = enrichis.filter((e) => !e.carte.isServed);
  if (filtre === 'jaunes') l = l.filter((e) => e.carte.type === 'Jaune' || e.carte.type === '2ème Jaune');
  else if (filtre === 'rouges') l = l.filter((e) => e.carte.type === 'Rouge' || e.carte.type === '2ème Jaune');
  else if (filtre === 'blancs') l = l.filter((e) => e.carte.type === 'Blanc');
  const quand = (e) => M.dateDe(e.carte.matchDate ?? e.carte.timestamp).getTime();
  l = [...l].sort((a, b) => quand(b) - quand(a));
  if (recherche !== '') {
    l = l.filter((e) => contient(e.carte.playerName, recherche) || contient(e.carte.matchLabel ?? '', recherche)
      || contient(e.adversaire ?? '', recherche));
  }
  return l;
}

/** Joueurs ayant au moins un carton en cours, du plus sanctionné au moins sanctionné (playersWithCards) */
export function joueursSanctionnes(joueurs, enrichis) {
  const actifs = enrichis.filter((e) => !e.carte.isServed).map((e) => e.carte);
  return joueurs.map((p) => {
    const c = actifs.filter((x) => x.playerId === p.id);
    if (!c.length) return null;
    return { joueur: p, ...compterCartons(c) };
  }).filter(Boolean).sort((a, b) => b.total - a.total);
}

/** « MT1 12' » (CardHistoryRow) */
export const momentCarton = (c) => `${M.PERIODE_COURTE[c.period]} ${Math.trunc(c.minute / 60)}'`;

// MARK: - Saisons (SeasonManagementView, ArchiveDetailView)

/** Résumé de la saison en cours : matchs terminés, entraînements, cartons (tous, purgés compris) */
export function resumeSaison(matchs, seances) {
  return {
    matchs: matchs.filter((m) => m.isFinished).length,
    entrainements: seances.length,
    cartons: matchs.reduce((t, m) => t + m.cards.length, 0),
  };
}

/** Statistiques et bilan d'une archive */
export function bilanArchive(archive) {
  const termines = archive.matches.filter((m) => m.isFinished);
  const cartons = archive.matches.flatMap((m) => m.cards);
  const jaunes = cartons.filter((c) => c.type === 'Jaune').length;
  const rouges = cartons.filter((c) => c.type === 'Rouge' || c.type === '2ème Jaune').length;
  const pour = termines.reduce((t, m) => t + M.myScore(m), 0);
  const contre = termines.reduce((t, m) => t + M.opponentScore(m), 0);
  return {
    termines,
    jaunes,
    rouges,
    victoires: termines.filter((m) => M.myScore(m) > M.opponentScore(m)).length,
    nuls: termines.filter((m) => M.myScore(m) === M.opponentScore(m)).length,
    defaites: termines.filter((m) => M.myScore(m) < M.opponentScore(m)).length,
    butsPour: pour,
    butsContre: contre,
    difference: `${pour - contre > 0 ? '+' : ''}${pour - contre}`,
  };
}

/** Résultat d'un match : « V », « N » ou « D » */
export const resultat = (m) => (M.myScore(m) > M.opponentScore(m) ? 'V' : M.myScore(m) === M.opponentScore(m) ? 'N' : 'D');
export const COULEUR_RESULTAT = { V: 'green', N: 'orange', D: 'red' };

/** Effectif d'une archive par poste, chaque poste trié par nom */
export function effectifParPoste(joueurs) {
  return M.POSTES.flatMap((poste) => joueurs.filter((p) => p.position === poste)
    .sort((a, b) => M.comparer(a.lastName, b.lastName)));
}
