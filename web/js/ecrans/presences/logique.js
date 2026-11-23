// Présences — logique pure (sans interface), portée de TrainingAttendanceView.swift,
// AvailabilityPollView.swift et TrainingManager.swift. Testée par tests/presences.test.mjs.
import * as M from '../../model.js';

/** Couleur d'un taux de présence : ≥ 75 % vert, ≥ 50 % orange, sinon rouge */
export const couleurTaux = (taux) => (taux >= 75 ? 'green' : taux >= 50 ? 'orange' : 'red');

/** Taux d'un entraînement (presentCount / totalCount × 100) */
export const tauxSeance = (s) => (s.attendances.length > 0 ? (M.presentCount(s) / s.attendances.length) * 100 : 0);

/** Pourcentage tronqué, comme Int(rate) : « 87% » */
export const pourcentEntier = (taux) => `${Math.trunc(taux)}%`;

/** Joueurs triés par nom (lastName.localizedCompare) */
export const triParNom = (liste) => [...liste].sort((a, b) => M.comparer(a.lastName, b.lastName));

/** Recherche (fullName.localizedCaseInsensitiveContains) */
export function correspond(joueur, recherche) {
  if (!recherche) return true;
  const norm = (t) => t.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return norm(M.fullName(joueur)).includes(norm(recherche));
}

/**
 * Joueurs des autres catégories, absents de la catégorie active (loadGuestPlayers) :
 * [{ player, categoryName, categoryColorIndex }], triés par catégorie puis par nom.
 */
export function joueursInvites({ profils, profilActifId, tousLesJoueurs, joueursLocaux }) {
  const actif = profils.find((p) => p.id === profilActifId);
  if (!profilActifId || !actif) return [];
  const locaux = new Set(joueursLocaux.map((j) => j.id));
  const deActif = new Set(actif.playerIds);
  const invites = [];
  for (const profil of profils) {
    if (profil.id === profilActifId) continue;
    for (const id of profil.playerIds) {
      if (locaux.has(id) || deActif.has(id)) continue;
      const player = tousLesJoueurs.find((j) => j.id === id);
      if (!player || invites.some((g) => g.player.id === id)) continue;
      invites.push({ player, categoryName: profil.name, categoryColorIndex: profil.colorIndex });
    }
  }
  return invites.sort((a, b) => M.comparer(a.categoryName, b.categoryName) || M.comparer(a.player.lastName, b.player.lastName));
}

/** Invités groupés par catégorie, catégories triées : [{ nom, colorIndex, invites }] */
export function invitesParCategorie(invites) {
  const groupes = new Map();
  for (const g of invites) {
    if (!groupes.has(g.categoryName)) groupes.set(g.categoryName, []);
    groupes.get(g.categoryName).push(g);
  }
  return [...groupes.keys()].sort(M.comparer).map((nom) => ({ nom, colorIndex: groupes.get(nom)[0].categoryColorIndex, invites: groupes.get(nom) }));
}

/** Présences d'un entraînement : joueurs de la catégorie (triés) + invités présents */
export function construirePresences(joueursTries, presents, invites, invitesPresents) {
  const liste = joueursTries.map((j) => M.presenceDe(j, presents.has(j.id)));
  for (const g of invites) if (invitesPresents.has(g.player.id)) liste.push(M.presenceDe(g.player, true));
  return liste;
}

/**
 * Statistiques de TrainingStatsView : séances de la catégorie active sur la période, plus les
 * séances des autres catégories où ses joueurs ont participé.
 * → { playerStats, totalSessionCount, guestInfo: { [playerId]: { name, colorIndex } } }
 */
export function statistiques({ seances, debut, fin, profils, profilActifId, seancesDe, tousLesJoueurs }) {
  const filtrees = M.filterSessions(seances, debut, fin);
  const locales = M.calculatePlayerStats(filtrees);
  const actif = profils.find((p) => p.id === profilActifId);
  let playerStats = locales;
  let totalSessionCount = filtrees.length;

  if (profilActifId && actif) {
    const idsActifs = new Set(actif.playerIds);
    const ids = new Set(filtrees.map((s) => s.id));
    const externes = [];
    for (const profil of profils) {
      if (profil.id === profilActifId) continue;
      for (const s of M.filterSessions(seancesDe(profil.id), debut, fin)) {
        if (s.attendances.some((a) => idsActifs.has(a.id))) ids.add(s.id);
        for (const a of s.attendances) if (idsActifs.has(a.id)) externes.push(a);
      }
    }
    totalSessionCount = ids.size;
    if (idsActifs.size > 0 && externes.length) {
      const fusion = new Map(locales.map((st) => [st.playerId, { ...st }]));
      for (const a of externes) {
        const d = fusion.get(a.id);
        if (d) { d.totalSessions += 1; if (a.isPresent) d.presentSessions += 1; }
        else fusion.set(a.id, { playerId: a.id, firstName: a.firstName, lastName: a.lastName, totalSessions: 1, presentSessions: a.isPresent ? 1 : 0 });
      }
      playerStats = [...fusion.values()].sort((a, b) => M.comparer(a.lastName, b.lastName));
    }
  }

  // Catégorie d'origine des joueurs invités (guestCategoryInfo)
  const guestInfo = {};
  if (profilActifId && actif) {
    const cle = (p) => `${p.firstName.toLowerCase()}_${p.lastName.toLowerCase()}`;
    const nomsActifs = new Set(actif.playerIds.map((id) => tousLesJoueurs.find((j) => j.id === id)).filter(Boolean).map(cle));
    for (const st of playerStats) {
      if (actif.playerIds.includes(st.playerId)) continue;
      if (nomsActifs.has(cle(st))) continue;
      const origine = profils.find((p) => p.id !== profilActifId && p.playerIds.includes(st.playerId));
      if (origine) { guestInfo[st.playerId] = { name: origine.name, colorIndex: origine.colorIndex }; continue; }
      for (const p of profils) {
        if (p.id === profilActifId) continue;
        const trouve = p.playerIds.some((id) => { const j = tousLesJoueurs.find((x) => x.id === id); return j && cle(j) === cle(st); });
        if (trouve) { guestInfo[st.playerId] = { name: p.name, colorIndex: p.colorIndex }; break; }
      }
    }
  }
  return { playerStats, totalSessionCount, guestInfo };
}

/** Présence moyenne du résumé : total des présences / total possible */
export function presenceMoyenne(playerStats) {
  const presents = playerStats.reduce((t, s) => t + s.presentSessions, 0);
  const possibles = playerStats.reduce((t, s) => t + s.totalSessions, 0);
  return possibles === 0 ? 0 : (presents / possibles) * 100;
}

/** Noms de catégorie des joueurs invités dans des séances (buildGuestCategoryNames) */
export function nomsCategoriesInvites(seances, profils, profilActifId) {
  const actif = profils.find((p) => p.id === profilActifId);
  if (!profilActifId || !actif) return {};
  const res = {};
  for (const id of new Set(seances.flatMap((s) => s.attendances.map((a) => a.id)))) {
    if (actif.playerIds.includes(id)) continue;
    const origine = profils.find((p) => p.id !== profilActifId && p.playerIds.includes(id));
    if (origine) res[id] = origine.name;
  }
  return res;
}

/** Import : fusion (ajoute les nouveaux) ou remplacement (performImport) */
export function importerSeances(existantes, importees, mode) {
  if (mode === 'replace') return [...importees];
  const ids = new Set(existantes.map((s) => s.id));
  return [...existantes, ...importees.filter((s) => !ids.has(s.id))];
}

/** Message de réussite de l'import */
export function messageImport(mode, nbImportees, total) {
  return mode === 'replace'
    ? `${nbImportees} entraînements importés (remplacement).`
    : `Entraînements mis à jour. ${total} entraînements au total.`;
}

/** Plage de dates des noms de fichiers : « 2026-10-23_2026-11-23 » */
export const plageDates = (debut, fin) => `${M.formatDateMotif(debut, 'yyyy-MM-dd')}_${M.formatDateMotif(fin, 'yyyy-MM-dd')}`;

/** N° du coach : premier encadrant de la catégorie au rôle « Coach » avec un numéro */
export function telephoneCoach(roles, encadrants) {
  const role = roles.find((r) => r.name === 'Coach');
  if (!role) return '';
  return encadrants.find((s) => s.roleId === role.id && s.phone.trim() !== '')?.phone ?? '';
}

/** Joueurs ayant un numéro de téléphone */
export const joueursAvecTelephone = (joueurs) => joueurs.filter((j) => (j.phoneNumber ?? '').trim() !== '');

/** Résumé du sondage : { presents, absents, incertains, enAttente } */
export function resumeSondage(seance, joueurs) {
  const r = seance.availabilityResponses;
  return {
    presents: r.filter((x) => x.status === 1).length,
    absents: r.filter((x) => x.status === 0).length,
    incertains: r.filter((x) => x.status === 2).length,
    enAttente: joueurs.length - r.length,
  };
}

/** Réponses triées par nom du joueur */
export const reponsesTriees = (seance) => [...seance.availabilityResponses].sort((a, b) => M.comparer(a.playerName, b.playerName));

/** Date relative courte (RelativeDateTimeFormatter, .short) : « il y a 3 h » */
export function dateRelative(isoTexte, maintenant = new Date()) {
  const ecart = (M.dateDe(isoTexte).getTime() - maintenant.getTime()) / 1000;
  const f = new Intl.RelativeTimeFormat('fr-FR', { style: 'short', numeric: 'always' });
  const abs = Math.abs(ecart);
  const unites = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unite, s] of unites) {
    if (abs >= s) return f.format(Math.trunc(ecart / s), unite);
  }
  return f.format(Math.trunc(ecart), 'second');
}

/** Lien SMS vers plusieurs numéros (iPhone : sms:/open?addresses=…) */
export function lienSMSGroupe(numeros, corps, ios) {
  const liste = numeros.filter(Boolean).map((n) => n.replace(/[^\d+]/g, ''));
  const texte = corps ? encodeURIComponent(corps) : '';
  if (ios && liste.length > 1) return `sms:/open?addresses=${liste.join(',')}${texte ? `&body=${texte}` : ''}`;
  return `sms:${liste.join(',')}${texte ? `${ios ? '&' : '?'}body=${texte}` : ''}`;
}
