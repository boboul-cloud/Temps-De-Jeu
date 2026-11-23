// Données de Temps De Jeu (version web) : équivalent des gestionnaires Swift
// (ProfileManager, TeamManager, DataManager, TrainingManager, SeasonManager,
// StaffManager, TacticStore). Tout reste dans le navigateur (localStorage), sur l'appareil.
//
// Les clés reprennent celles de l'app native (UserDefaults), préfixées par « tdj. » :
//   teamPlayers, teamProfiles, activeProfileId, staffMembers, staffRoles,
//   profile_<UUID>_savedMatches, _trainingSessions, _currentSeason, _seasonArchives, _matchSetupDraft,
//   userTactics (mes-tactiques.tdjt), trainingPlans (mes-seances.json).
// Sans catégorie active, le préfixe est vide (comme ProfileManager.currentStoragePrefix).
import * as M from './model.js';

const PREFIXE = 'tdj.';

/** Stockage en mémoire si localStorage est indisponible (navigation privée, tests) */
class StockageMemoire {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

function stockageParDefaut() {
  try {
    const s = globalThis.localStorage;
    if (!s) return new StockageMemoire();
    const k = `${PREFIXE}__test`;
    s.setItem(k, '1'); s.removeItem(k);
    return s;
  } catch {
    return new StockageMemoire();
  }
}

const CLES_PROFIL = ['savedMatches', 'trainingSessions', 'currentSeason', 'seasonArchives', 'matchSetupDraft'];
const prefixeDe = (profilId) => (profilId ? `profile_${profilId}_` : '');

export class Store {
  constructor(stockage = stockageParDefaut()) {
    this.stockage = stockage;
    this.cache = new Map();
    this.ecouteurs = new Set();
    this.sauvegardeImpossible = false;
    /** Exercices livrés avec l'app (lecture seule), chargés par chargerBibliotheque() */
    this.bibliotheque = [];
    this.profils = (this.lire('teamProfiles') ?? []).map(M.lireProfil);
    const actif = this.stockage.getItem(`${PREFIXE}activeProfileId`);
    this.profilActifId = actif && this.profils.some((p) => p.id === actif) ? actif : (this.profils[0]?.id ?? null);
    this.initialiserRoles();
  }

  // MARK: - Lecture / écriture brutes

  lire(cle, defaut = null) {
    if (this.cache.has(cle)) return this.cache.get(cle);
    let valeur = defaut;
    try {
      const t = this.stockage.getItem(PREFIXE + cle);
      if (t != null) valeur = JSON.parse(t);
    } catch { valeur = defaut; }
    this.cache.set(cle, valeur);
    return valeur;
  }

  ecrire(cle, valeur) {
    this.cache.set(cle, valeur);
    try {
      if (valeur === undefined || valeur === null) this.stockage.removeItem(PREFIXE + cle);
      else this.stockage.setItem(PREFIXE + cle, JSON.stringify(M.propre(valeur)));
      this.sauvegardeImpossible = false;
    } catch {
      this.sauvegardeImpossible = true;   // quota dépassé (photos trop nombreuses ?)
    }
  }

  effacer(cle) { this.ecrire(cle, null); }

  // MARK: - Abonnement

  ecouter(fn) {
    this.ecouteurs.add(fn);
    return () => this.ecouteurs.delete(fn);
  }

  notifier() {
    for (const fn of this.ecouteurs) fn();
  }

  /** Applique une modification puis prévient l'interface */
  modifier(fn) {
    const r = fn(this);
    this.notifier();
    return r;
  }

  // MARK: - Catégories (ProfileManager)

  get prefixe() { return prefixeDe(this.profilActifId); }

  profilActif() { return this.profils.find((p) => p.id === this.profilActifId) ?? null; }

  /** Nom de couleur SwiftUI de la catégorie active (vert par défaut) */
  couleurActive() {
    const p = this.profilActif();
    return p ? M.couleurProfil(p.colorIndex) : 'green';
  }

  enregistrerProfils() {
    this.ecrire('teamProfiles', this.profils);
  }

  enregistrerProfilActif() {
    try {
      if (this.profilActifId) this.stockage.setItem(`${PREFIXE}activeProfileId`, this.profilActifId);
      else this.stockage.removeItem(`${PREFIXE}activeProfileId`);
    } catch { /* stockage indisponible */ }
  }

  creerProfil(name, colorIndex = 0, playerIds = [], teamCode = '') {
    const profil = M.lireProfil({ id: M.uuid(), name, colorIndex, playerIds, teamCode });
    this.profils.push(profil);
    this.enregistrerProfils();
    if (this.profils.length === 1) this.basculerProfil(profil.id);
    else this.notifier();
    return profil;
  }

  majProfil(profil) {
    const i = this.profils.findIndex((p) => p.id === profil.id);
    if (i < 0) return;
    this.profils[i] = profil;
    this.enregistrerProfils();
    this.notifier();
  }

  supprimerProfil(id) {
    for (const k of CLES_PROFIL) this.effacer(prefixeDe(id) + k);
    this.profils = this.profils.filter((p) => p.id !== id);
    this.enregistrerProfils();
    if (this.profilActifId === id) {
      this.profilActifId = this.profils[0]?.id ?? null;
      this.enregistrerProfilActif();
    }
    this.notifier();
  }

  basculerProfil(id) {
    if (!this.profils.some((p) => p.id === id)) return;
    this.profilActifId = id;
    this.enregistrerProfilActif();
    this.notifier();
  }

  ajouterJoueurAuProfilActif(joueurId) {
    const p = this.profilActif();
    if (!p || p.playerIds.includes(joueurId)) return;
    this.majProfil({ ...p, playerIds: [...p.playerIds, joueurId] });
  }

  retirerJoueurDuProfilActif(joueurId) {
    const p = this.profilActif();
    if (!p) return;
    this.majProfil({ ...p, playerIds: p.playerIds.filter((x) => x !== joueurId) });
  }

  ajouterJoueurAuProfil(joueurId, profilId) {
    const p = this.profils.find((x) => x.id === profilId);
    if (!p || p.playerIds.includes(joueurId)) return;
    this.majProfil({ ...p, playerIds: [...p.playerIds, joueurId] });
  }

  // MARK: - Joueurs (TeamManager) : base globale, chaque catégorie référence ses joueurs

  tousLesJoueurs() { return (this.lire('teamPlayers') ?? []).map(M.lireJoueur); }

  /** Joueurs de la catégorie active (tous s'il n'y a pas de catégorie) */
  joueurs() {
    const tous = this.tousLesJoueurs();
    const p = this.profilActif();
    if (!p) return tous;
    const ids = new Set(p.playerIds);
    return tous.filter((j) => ids.has(j.id));
  }

  /** Enregistrement « intelligent » (savePlayers) : met à jour, ajoute, et la catégorie active reçoit exactement cette liste */
  enregistrerJoueurs(liste) {
    const p = this.profilActif();
    if (!p) { this.ecrire('teamPlayers', liste); this.notifier(); return; }
    const tous = this.tousLesJoueurs();
    for (const j of liste) {
      const i = tous.findIndex((x) => x.id === j.id);
      if (i >= 0) tous[i] = j; else tous.push(j);
    }
    const i = this.profils.findIndex((x) => x.id === p.id);
    this.profils[i] = { ...p, playerIds: liste.map((j) => j.id) };
    this.enregistrerProfils();
    this.ecrire('teamPlayers', tous);
    this.notifier();
  }

  /** Enregistre la base globale sans toucher aux catégories (saveToGlobalStorage) */
  enregistrerJoueursGlobal(liste) {
    this.ecrire('teamPlayers', liste);
    this.notifier();
  }

  supprimerJoueurPartout(id) {
    this.ecrire('teamPlayers', this.tousLesJoueurs().filter((j) => j.id !== id));
    this.profils = this.profils.map((p) => (p.playerIds.includes(id) ? { ...p, playerIds: p.playerIds.filter((x) => x !== id) } : p));
    this.enregistrerProfils();
    this.notifier();
  }

  // MARK: - Matchs (DataManager) : par catégorie, le plus récent en premier

  matchs(profilId = this.profilActifId) {
    return (this.lire(`${prefixeDe(profilId)}savedMatches`) ?? []).map(M.lireMatch);
  }

  enregistrerMatchs(liste, profilId = this.profilActifId) {
    this.ecrire(`${prefixeDe(profilId)}savedMatches`, liste);
    this.notifier();
  }

  enregistrerMatch(match, profilId = this.profilActifId) {
    const liste = this.matchs(profilId);
    const i = liste.findIndex((m) => m.id === match.id);
    if (i >= 0) liste[i] = match; else liste.unshift(match);
    this.enregistrerMatchs(liste, profilId);
  }

  supprimerMatch(id) {
    this.enregistrerMatchs(this.matchs().filter((m) => m.id !== id));
  }

  supprimerTousLesMatchs() { this.enregistrerMatchs([]); }

  /** Carton purgé : retiré de la liste des cartons mais gardé dans les statistiques (deleteCard) */
  purgerCarton(cardId, matchId) {
    const liste = this.matchs();
    const m = liste.find((x) => x.id === matchId);
    const c = m?.cards.find((x) => x.id === cardId);
    if (!c) return;
    c.isServed = true;
    this.enregistrerMatchs(liste);
  }

  // MARK: - Entraînements (TrainingManager)

  seances(profilId = this.profilActifId) {
    return (this.lire(`${prefixeDe(profilId)}trainingSessions`) ?? []).map(M.lireSeance);
  }

  enregistrerSeances(liste, profilId = this.profilActifId) {
    this.ecrire(`${prefixeDe(profilId)}trainingSessions`, liste);
    this.notifier();
  }

  ajouterSeance(seance) { this.enregistrerSeances([...this.seances(), seance]); }

  majSeance(seance) {
    const liste = this.seances();
    const i = liste.findIndex((s) => s.id === seance.id);
    if (i < 0) return;
    liste[i] = seance;
    this.enregistrerSeances(liste);
  }

  supprimerSeance(id) { this.enregistrerSeances(this.seances().filter((s) => s.id !== id)); }

  /** Réponse au sondage : remplace celle du même joueur, ou s'ajoute (applyAvailabilityResponse) */
  appliquerReponse(reponse, seanceId, profilId = this.profilActifId) {
    const liste = this.seances(profilId);
    const s = liste.find((x) => x.id === seanceId);
    if (!s) return false;
    const i = s.availabilityResponses.findIndex((r) => r.id === reponse.id);
    if (i >= 0) s.availabilityResponses[i] = reponse; else s.availabilityResponses.push(reponse);
    this.enregistrerSeances(liste, profilId);
    return true;
  }

  /**
   * Réponse reçue d'un joueur (lien du sondage) : retrouve la séance (8 premiers caractères)
   * dans la catégorie active puis dans les autres, et le joueur. → { reponse, seance, profilId } | { erreur }
   */
  recevoirReponseSondage(r) {
    const court = r.s.toUpperCase();
    let seance = this.seances().find((s) => s.id.startsWith(court));
    let profilId = this.profilActifId;
    if (!seance) {
      for (const p of this.profils) {
        if (p.id === this.profilActifId) continue;
        const trouvee = this.seances(p.id).find((s) => s.id.startsWith(court));
        if (trouvee) { seance = trouvee; profilId = p.id; break; }
      }
    }
    if (!seance) return { erreur: "Session d'entraînement non trouvée." };
    let joueurId;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.i)) joueurId = r.i.toUpperCase();
    else joueurId = this.tousLesJoueurs().find((j) => j.id.startsWith(r.i.toUpperCase()))?.id;
    if (!joueurId) return { erreur: 'Joueur non trouvé.' };
    const reponse = M.lireReponse({ id: joueurId, playerName: r.n, status: r.r, comment: r.c, respondedAt: M.iso() });
    this.appliquerReponse(reponse, seance.id, profilId);
    return { reponse, seance: this.seances(profilId).find((s) => s.id === seance.id), profilId };
  }

  // MARK: - Saisons (SeasonManager)

  saison() {
    const s = this.lire(`${this.prefixe}currentSeason`);
    return s ? M.lireSaison(s) : null;
  }

  creerSaison(clubName, category, startDate) {
    const s = M.lireSaison({ id: M.uuid(), clubName, category, startDate: M.iso(startDate) });
    this.ecrire(`${this.prefixe}currentSeason`, s);
    this.notifier();
    return s;
  }

  /** Clôture : archive matchs, entraînements et effectif, puis remet la catégorie à zéro */
  cloturerSaison() {
    const s = this.saison();
    if (!s) return false;
    s.endDate = M.iso();
    s.isClosed = true;
    const archive = { id: s.id, season: s, matches: this.matchs(), trainingSessions: this.seances(), players: this.joueurs() };
    this.ecrire(`${this.prefixe}seasonArchives`, [...this.archivesBrutes(), archive]);
    this.ecrire(`${this.prefixe}savedMatches`, []);
    this.ecrire(`${this.prefixe}trainingSessions`, []);
    const joueurs = this.joueurs().map((j) => (j.availability === 'Suspendu' ? { ...j, availability: 'Disponible' } : j));
    this.enregistrerJoueurs(joueurs);
    this.effacer(`${this.prefixe}currentSeason`);
    this.notifier();
    return true;
  }

  archivesBrutes(profilId = this.profilActifId) {
    return (this.lire(`${prefixeDe(profilId)}seasonArchives`) ?? []).map(M.lireArchive);
  }

  /** Archives, la plus récente d'abord */
  archives(profilId = this.profilActifId) {
    return this.archivesBrutes(profilId).sort((a, b) => M.dateDe(b.season.startDate) - M.dateDe(a.season.startDate));
  }

  supprimerArchive(id) {
    this.ecrire(`${this.prefixe}seasonArchives`, this.archivesBrutes().filter((a) => a.id !== id));
    this.notifier();
  }

  // MARK: - Brouillon de préparation de match (matchSetupDraft)

  brouillon(profilId = this.profilActifId) { return this.lire(`${prefixeDe(profilId)}matchSetupDraft`); }

  enregistrerBrouillon(brouillon, profilId = this.profilActifId) {
    this.ecrire(`${prefixeDe(profilId)}matchSetupDraft`, brouillon);
  }

  effacerBrouillon(profilId = this.profilActifId) { this.effacer(`${prefixeDe(profilId)}matchSetupDraft`); }

  // MARK: - Encadrement (StaffManager) : global, chaque encadrant liste ses catégories

  initialiserRoles() {
    if (this.lire('staffRolesInitialized')) return;
    this.ecrire('staffRoles', M.rolesParDefaut());
    this.ecrire('staffRolesInitialized', true);
  }

  roles() {
    const r = this.lire('staffRoles');
    return Array.isArray(r) ? r.map(M.lireRole) : M.rolesParDefaut();
  }

  enregistrerRoles(roles) { this.ecrire('staffRoles', roles); this.notifier(); }

  ajouterRole(name) {
    const role = M.lireRole({ id: M.uuid(), name, isCustom: true });
    this.enregistrerRoles([...this.roles(), role]);
    return role;
  }

  /** Seuls les rôles personnalisés se suppriment */
  supprimerRole(id) { this.enregistrerRoles(this.roles().filter((r) => !(r.id === id && r.isCustom))); }

  nomRole(id) { return this.roles().find((r) => r.id === id)?.name ?? 'Inconnu'; }

  tousLesEncadrants() { return (this.lire('staffMembers') ?? []).map(M.lireEncadrant); }

  encadrants() {
    const p = this.profilActif();
    const tous = this.tousLesEncadrants();
    return p ? tous.filter((s) => s.profileIds.includes(p.id)) : tous;
  }

  encadrantsDe(profilId) { return this.tousLesEncadrants().filter((s) => s.profileIds.includes(profilId)); }

  enregistrerTousEncadrants(liste) { this.ecrire('staffMembers', liste); this.notifier(); }

  enregistrerEncadrant(e) {
    const tous = this.tousLesEncadrants();
    const i = tous.findIndex((x) => x.id === e.id);
    if (i >= 0) tous[i] = e; else tous.push(e);
    this.enregistrerTousEncadrants(tous);
  }

  supprimerEncadrant(id) { this.enregistrerTousEncadrants(this.tousLesEncadrants().filter((s) => s.id !== id)); }

  // MARK: - Exercices et séances (TacticStore)

  /** Charge la bibliothèque livrée avec l'app (data/exercices.json) */
  async chargerBibliotheque(source = 'data/exercices.json') {
    try {
      const texte = typeof source === 'string' && !source.trim().startsWith('{') ? await (await fetch(source)).text() : source;
      this.bibliotheque = M.lireFichierTactiques(texte).map((t) => ({ ...t, perso: false }));
    } catch {
      this.bibliotheque = [];
    }
    this.notifier();
  }

  tactiquesPerso() { return (this.lire('userTactics') ?? []).map(M.lireTactique); }

  toutesTactiques() { return [...this.tactiquesPerso(), ...this.bibliotheque]; }

  tactique(id) { return this.toutesTactiques().find((t) => t.id === id) ?? null; }

  /** Copie modifiable d'un exercice (bibliothèque ou perso) */
  dupliquer(t) {
    const copie = structuredClone(t);
    copie.id = M.uuid();
    copie.perso = true;
    copie.creeLe = M.iso();
    if (!t.perso) copie.source = t.source ?? 'Bibliothèque Temps De Jeu';
    else copie.titre = `${t.titre} (copie)`;
    return copie;
  }

  enregistrerTactique(t) {
    const copie = { ...t, perso: true, creeLe: t.creeLe ?? M.iso() };
    const liste = this.tactiquesPerso();
    const i = liste.findIndex((x) => x.id === copie.id);
    if (i >= 0) liste[i] = copie; else liste.unshift(copie);
    this.ecrire('userTactics', liste.map(M.ecrireTactique));
    this.notifier();
  }

  remplacerTactiquesPerso(liste) {
    this.ecrire('userTactics', liste.map((t) => M.ecrireTactique({ ...t, perso: true })));
    this.notifier();
  }

  supprimerTactique(id) {
    this.ecrire('userTactics', this.tactiquesPerso().filter((t) => t.id !== id).map(M.ecrireTactique));
    this.notifier();
  }

  /** Importe un fichier .tdjt ; renvoie le nombre d'exercices ajoutés */
  importerTactiques(texteOuObjet) {
    const importes = M.lireFichierTactiques(texteOuObjet);
    let n = 0;
    for (const t of importes) {
      if (!t.etapes.length || !t.acteurs.length) continue;
      if (this.bibliotheque.some((b) => b.id === t.id)) continue;
      this.enregistrerTactique(t);
      n += 1;
    }
    return n;
  }

  plans() { return (this.lire('trainingPlans') ?? []).map(M.lirePlan); }

  enregistrerPlan(plan) {
    const liste = this.plans();
    const i = liste.findIndex((p) => p.id === plan.id);
    if (i >= 0) liste[i] = plan; else liste.unshift(plan);
    this.ecrire('trainingPlans', liste);
    this.notifier();
  }

  supprimerPlan(id) { this.ecrire('trainingPlans', this.plans().filter((p) => p.id !== id)); this.notifier(); }

  remplacerPlans(liste) { this.ecrire('trainingPlans', liste); this.notifier(); }

  // MARK: - Sauvegarde complète (ExportService.exportFullBackup / applyFullBackup)

  exporterSauvegarde() {
    return M.ecrireSauvegarde({
      players: this.tousLesJoueurs(),
      staffMembers: this.tousLesEncadrants(),
      staffRoles: this.roles(),
      profiles: this.profils.map((profile) => ({
        profile,
        matches: this.matchs(profile.id),
        trainingSessions: this.seances(profile.id),
        currentSeason: (() => { const s = this.lire(`${prefixeDe(profile.id)}currentSeason`); return s ? M.lireSaison(s) : undefined; })(),
        seasonArchives: this.archivesBrutes(profile.id),
      })),
      tactics: this.tactiquesPerso(),
      trainingPlans: this.plans(),
    });
  }

  /** Remplace toutes les données par celles de la sauvegarde (après confirmation) */
  appliquerSauvegarde(backup) {
    this.ecrire('teamPlayers', backup.players);
    this.ecrire('staffMembers', backup.staffMembers);
    this.ecrire('staffRoles', backup.staffRoles);
    for (const p of this.profils) for (const k of CLES_PROFIL) this.effacer(prefixeDe(p.id) + k);
    for (const d of backup.profilesData) {
      const pre = prefixeDe(d.profile.id);
      this.ecrire(`${pre}savedMatches`, d.matches);
      this.ecrire(`${pre}trainingSessions`, d.trainingSessions);
      if (d.currentSeason) this.ecrire(`${pre}currentSeason`, d.currentSeason);
      if (d.seasonArchives.length) this.ecrire(`${pre}seasonArchives`, d.seasonArchives);
    }
    this.profils = backup.profilesData.map((d) => d.profile);
    this.enregistrerProfils();
    this.profilActifId = this.profils[0]?.id ?? null;
    this.enregistrerProfilActif();
    if (backup.tactics) this.ecrire('userTactics', backup.tactics.map((t) => M.ecrireTactique({ ...t, perso: true })));
    if (backup.trainingPlans) this.ecrire('trainingPlans', backup.trainingPlans);
    this.notifier();
  }
}

/** Le magasin partagé par tous les écrans */
export const store = new Store();
