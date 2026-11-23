// Match en cours : port fidèle de MatchViewModel.swift (chronomètre, arrêts, temps additionnel,
// possession, passes, buts, cartons, expulsions temporaires du carton blanc, fautes, passes
// décisives, remplacements, temps de jeu en direct, brouillon de préparation).
//
// Différences voulues avec l'iPhone :
// - le chronomètre se calcule à partir d'horodatages (Date.now) : il reste juste quand l'onglet
//   passe en arrière-plan ;
// - l'état du match en cours est enregistré en continu (clé « matchEnCours ») et repris au
//   rechargement de la page (un navigateur de téléphone peut recharger un onglet).
// Aucune dépendance à l'interface : testable avec Node.
import * as M from '../../model.js';
import { store } from '../../store.js';

/** États du chronomètre (TimerState) */
export const ETATS = { idle: 'idle', running: 'running', stopped: 'stopped', periodEnded: 'periodEnded', matchEnded: 'matchEnded' };

const CLE_EN_COURS = 'matchEnCours';

/** MatchSetupDraft lu de façon tolérante */
export function lireBrouillon(o) {
  if (!o || typeof o !== 'object' || !o.match) return null;
  return {
    match: M.lireMatch(o.match),
    matchRoster: (Array.isArray(o.matchRoster) ? o.matchRoster : []).map(M.lireMatchPlayer),
    unavailablePlayerIds: (Array.isArray(o.unavailablePlayerIds) ? o.unavailablePlayerIds : []).map((x) => String(x).toUpperCase()),
    importChain: (Array.isArray(o.importChain) ? o.importChain : []).map(String),
  };
}

/** Le joueur correspond-il (par identifiant, sinon par nom affiché) ? */
const correspond = (mp, playerId, playerName) => (playerId ? mp.id === playerId : M.matchPlayerDisplayName(mp) === playerName);

export class MatchViewModel {
  /**
   * options : { horloge: () => ms, persistance: true | false, chargerBrouillon: true | false }
   */
  constructor({ horloge = () => Date.now(), persistance = true, chargerBrouillon = true } = {}) {
    this.horloge = horloge;
    this.persistance = persistance;
    this.match = M.nouveauMatch();
    this.timerState = { type: ETATS.idle };
    this.currentPeriod = '1ère Mi-Temps';
    this.elapsedTime = 0;
    this.stoppageElapsed = 0;
    this.currentStoppageType = null;
    this.matchRoster = [];
    this.activeTempExpulsions = [];
    this.showTempExpulsionEndAlert = false;
    this.endedTempExpulsionPlayerName = '';
    this.currentPossession = null;
    /** Le match est affiché (showMatch de ContentView) */
    this.afficherMatch = false;
    /** Le récapitulatif d'après-match est affiché */
    this.afficherRecap = false;

    this.tempExpulsionPeriodStartEffective = {};
    this.periodStartDate = null;
    this.stoppageStartDate = null;
    this.accumulatedTime = 0;
    this.accumulatedStoppageTime = 0;
    this.possessionStartDate = null;
    this.accumulatedPossessionTime = 0;
    this.minuterie = null;
    /** Appelé à chaque tic du chronomètre (l'écran redessine) */
    this.surTic = null;
    /** Appelé quand une expulsion temporaire se termine */
    this.surFinExpulsion = null;

    if (!this.restaurer() && chargerBrouillon) {
      const brouillon = MatchViewModel.loadDraft();
      if (brouillon) {
        this.match = brouillon.match;
        this.matchRoster = brouillon.matchRoster;
      }
    }
  }

  // MARK: - Valeurs calculées

  get maintenant() { return this.horloge(); }

  /** Temps effectif de jeu dans la période courante */
  get currentEffectiveTime() {
    return Math.max(0, this.elapsedTime - (M.totalStoppageTime(this.match, this.currentPeriod) + this.stoppageElapsed));
  }

  /** Temps additionnel : blessures, VAR, hors-jeu (y compris l'arrêt en cours) + 30 s par remplacement */
  get currentAddedTime() {
    const finis = this.match.stoppages
      .filter((s) => s.period === this.currentPeriod && M.arret(s.type).compte)
      .reduce((t, s) => t + M.dureeArret(s), 0);
    const enCours = this.currentStoppageType && M.arret(this.currentStoppageType).compte ? this.stoppageElapsed : 0;
    const remplacements = this.match.stoppages.filter((s) => s.period === this.currentPeriod && s.type === 'Remplacement').length;
    return finis + enCours + remplacements * 30;
  }

  get currentTotalStoppageTime() {
    return M.totalStoppageTime(this.match, this.currentPeriod) + this.stoppageElapsed;
  }

  get isOverRegulationTime() { return this.elapsedTime > M.dureeReglementaire(this.currentPeriod); }

  get overtimeMinutes() {
    if (!this.isOverRegulationTime) return 0;
    return Math.ceil((this.elapsedTime - M.dureeReglementaire(this.currentPeriod)) / 60);
  }

  get isPlaying() { return this.timerState.type === ETATS.running; }
  get isStopped() { return this.timerState.type === ETATS.stopped; }
  get currentBeneficiaryTeam() { return this.isStopped ? (this.timerState.beneficiary ?? null) : null; }

  get nextPeriod() {
    switch (this.currentPeriod) {
      case '1ère Mi-Temps': return '2ème Mi-Temps';
      case '2ème Mi-Temps': return 'Prolongation 1';
      default: return 'Prolongation 2';
    }
  }

  get isLastPeriod() { return this.currentPeriod === 'Prolongation 2'; }

  // MARK: - Possession

  get currentHomePossessionTime() {
    if (this.currentPossession === 'home' && this.possessionStartDate != null) {
      return this.accumulatedPossessionTime + (this.maintenant - this.possessionStartDate) / 1000;
    }
    return this.match.homePossessionTime;
  }

  get currentAwayPossessionTime() {
    if (this.currentPossession === 'away' && this.possessionStartDate != null) {
      return this.accumulatedPossessionTime + (this.maintenant - this.possessionStartDate) / 1000;
    }
    return this.match.awayPossessionTime;
  }

  get homePossessionPercentage() {
    const total = this.currentHomePossessionTime + this.currentAwayPossessionTime;
    return total > 0 ? (this.currentHomePossessionTime / total) * 100 : 50;
  }

  get awayPossessionPercentage() { return 100 - this.homePossessionPercentage; }

  selectPossession(equipe) {
    if (!this.isPlaying) return;
    this.flushPossession();
    if (this.currentPossession === equipe) {
      this.currentPossession = null;
      this.possessionStartDate = null;
      this.accumulatedPossessionTime = 0;
      this.changer();
      return;
    }
    this.currentPossession = equipe;
    this.accumulatedPossessionTime = equipe === 'home' ? this.match.homePossessionTime : this.match.awayPossessionTime;
    this.possessionStartDate = this.maintenant;
    this.changer();
  }

  flushPossession() {
    if (!this.currentPossession || this.possessionStartDate == null) return;
    const ecoule = this.accumulatedPossessionTime + (this.maintenant - this.possessionStartDate) / 1000;
    if (this.currentPossession === 'home') this.match.homePossessionTime = ecoule;
    else this.match.awayPossessionTime = ecoule;
  }

  pausePossession() {
    this.flushPossession();
    this.possessionStartDate = null;
    this.accumulatedPossessionTime = 0;
  }

  resumePossession() {
    if (!this.currentPossession) return;
    this.accumulatedPossessionTime = this.currentPossession === 'home' ? this.match.homePossessionTime : this.match.awayPossessionTime;
    this.possessionStartDate = this.maintenant;
  }

  // MARK: - Passes

  addPass(equipe) {
    if (equipe === 'home') this.match.homePasses += 1; else this.match.awayPasses += 1;
    this.changer();
  }

  removePass(equipe) {
    if (equipe === 'home') this.match.homePasses = Math.max(0, this.match.homePasses - 1);
    else this.match.awayPasses = Math.max(0, this.match.awayPasses - 1);
    this.changer();
  }

  // MARK: - Actions du match

  /** Démarrer le match ou lancer la période suivante */
  startMatch() {
    if (this.timerState.type !== ETATS.idle && this.timerState.type !== ETATS.periodEnded) return;
    if (this.timerState.type === ETATS.periodEnded) this.advancePeriod();
    this.timerState = { type: ETATS.running };
    this.periodStartDate = this.maintenant;
    this.accumulatedTime = 0;
    this.elapsedTime = 0;
    this.stoppageElapsed = 0;
    this.resumeTempExpulsions();
    this.resumePossession();
    this.startTimer();
    this.changer();
  }

  /** Arrêter le jeu */
  stopPlay(type, beneficiary = null) {
    if (!this.isPlaying) return;
    this.tick(false);
    this.currentStoppageType = type;
    this.timerState = { type: ETATS.stopped, stoppageType: type, beneficiary };
    this.match.stoppages.push(M.lireStoppage({
      id: M.uuid(), type, period: this.currentPeriod, startTime: this.elapsedTime, timestamp: M.iso(), beneficiaryTeam: beneficiary ?? undefined,
    }));
    this.stoppageStartDate = this.maintenant;
    this.accumulatedStoppageTime = 0;
    this.stoppageElapsed = 0;
    this.pausePossession();
    this.changer();
  }

  fermerArretEnCours() {
    const dernier = this.match.stoppages[this.match.stoppages.length - 1];
    if (dernier && dernier.endTime == null) dernier.endTime = this.elapsedTime;
  }

  /** Enchaîner un nouvel arrêt depuis l'arrêt en cours, sans reprendre le jeu */
  chainStoppage(type, beneficiary = null) {
    if (!this.isStopped) return;
    this.tick(false);
    this.fermerArretEnCours();
    this.currentStoppageType = type;
    this.timerState = { type: ETATS.stopped, stoppageType: type, beneficiary };
    this.match.stoppages.push(M.lireStoppage({
      id: M.uuid(), type, period: this.currentPeriod, startTime: this.elapsedTime, timestamp: M.iso(), beneficiaryTeam: beneficiary ?? undefined,
    }));
    this.stoppageStartDate = this.maintenant;
    this.accumulatedStoppageTime = 0;
    this.stoppageElapsed = 0;
    this.changer();
  }

  /** Reprendre le jeu */
  resumePlay() {
    if (!this.isStopped) return;
    this.tick(false);
    this.fermerArretEnCours();
    this.timerState = { type: ETATS.running };
    this.currentStoppageType = null;
    this.stoppageElapsed = 0;
    this.stoppageStartDate = null;
    this.resumePossession();
    this.changer();
  }

  /** Terminer la période en cours */
  endPeriod() {
    this.tick(false);
    if (this.isStopped) this.resumePlay();
    this.match.periodDurations[this.currentPeriod] = this.elapsedTime;
    this.pauseTempExpulsions();
    this.pausePossession();
    this.timerState = { type: ETATS.periodEnded };
    this.stopTimer();
    this.changer();
  }

  /** Terminer le match */
  endMatch() {
    if (this.isPlaying || this.isStopped) this.endPeriod();
    this.match.isFinished = true;
    this.timerState = { type: ETATS.matchEnded };
    this.stopTimer();
    this.changer();
  }

  advancePeriod() {
    switch (this.currentPeriod) {
      case '1ère Mi-Temps': this.currentPeriod = '2ème Mi-Temps'; break;
      case '2ème Mi-Temps': this.currentPeriod = 'Prolongation 1'; break;
      case 'Prolongation 1': this.currentPeriod = 'Prolongation 2'; break;
      default: break;
    }
  }

  /** Réinitialiser pour un nouveau match */
  resetMatch() {
    this.stopTimer();
    this.match = M.nouveauMatch();
    this.timerState = { type: ETATS.idle };
    this.currentPeriod = '1ère Mi-Temps';
    this.elapsedTime = 0;
    this.stoppageElapsed = 0;
    this.currentStoppageType = null;
    this.periodStartDate = null;
    this.stoppageStartDate = null;
    this.accumulatedTime = 0;
    this.accumulatedStoppageTime = 0;
    this.matchRoster = [];
    this.activeTempExpulsions = [];
    this.tempExpulsionPeriodStartEffective = {};
    this.currentPossession = null;
    this.possessionStartDate = null;
    this.accumulatedPossessionTime = 0;
    this.afficherMatch = false;
    this.afficherRecap = false;
    this.clearDraft();
    if (this.persistance) store.effacer(CLE_EN_COURS);
  }

  // MARK: - Brouillon de préparation (MatchSetupDraft)

  saveDraft(unavailablePlayerIds = [], importChain = []) {
    if (!this.persistance) return;
    store.enregistrerBrouillon({
      match: this.match,
      matchRoster: this.matchRoster,
      unavailablePlayerIds: [...unavailablePlayerIds],
      importChain: [...importChain],
    });
  }

  static loadDraft(profilId = store.profilActifId) {
    return lireBrouillon(store.brouillon(profilId));
  }

  clearDraft() {
    if (this.persistance) store.effacerBrouillon();
  }

  /**
   * Joueurs sélectionnés dans la composition (brouillon) d'une autre catégorie :
   * { idLocal: nomDeLaCatégorie }, par identifiant puis par prénom + nom.
   */
  static playerIdsSelectedInOtherCategories(localPlayers) {
    const actif = store.profilActifId;
    if (!actif) return {};
    const norm = (prenom, nom) => `${prenom.trim().toLowerCase()}_${nom.trim().toLowerCase()}`;
    const parNom = {};
    for (const p of localPlayers) {
      const k = norm(p.firstName, p.lastName);
      if (k !== '' && k !== '_') parNom[k] = p.id;
    }
    const res = {};
    for (const profil of store.profils) {
      if (profil.id === actif) continue;
      const brouillon = lireBrouillon(store.brouillon(profil.id));
      if (!brouillon || !brouillon.matchRoster.length) continue;
      for (const mp of brouillon.matchRoster) {
        if (localPlayers.some((p) => p.id === mp.id)) { res[mp.id] = profil.name; continue; }
        const local = parNom[norm(mp.firstName, mp.lastName)];
        if (local) res[local] = profil.name;
      }
    }
    return res;
  }

  // MARK: - Chronomètre

  startTimer() {
    this.stopTimer();
    this.periodStartDate = this.maintenant;
    this.accumulatedTime = this.elapsedTime;
    this.lancerMinuterie();
  }

  /** Relance la minuterie sans toucher aux horodatages (reprise après rechargement) */
  lancerMinuterie() {
    if (this.minuterie || typeof setInterval !== 'function' || !this.persistance) return;
    this.minuterie = setInterval(() => this.tick(), 100);
  }

  stopTimer() {
    if (this.minuterie) clearInterval(this.minuterie);
    this.minuterie = null;
  }

  /** Met à jour les temps à partir des horodatages ; `notifier` : prévenir l'écran */
  tick(notifier = true) {
    if (this.periodStartDate == null) return;
    const actifs = this.timerState.type === ETATS.running || this.timerState.type === ETATS.stopped;
    if (!actifs) return;
    this.elapsedTime = this.accumulatedTime + (this.maintenant - this.periodStartDate) / 1000;
    if (this.stoppageStartDate != null) {
      this.stoppageElapsed = this.accumulatedStoppageTime + (this.maintenant - this.stoppageStartDate) / 1000;
    }
    if (this.currentPossession && this.isPlaying) this.flushPossession();
    this.checkTempExpulsions();
    if (notifier) this.surTic?.();
  }

  // MARK: - Arrêts

  deleteStoppage(id) {
    this.match.stoppages = this.match.stoppages.filter((s) => s.id !== id);
    this.changer();
  }

  // MARK: - Score

  addGoal(isHome, playerName = '') {
    this.tick(false);
    if (isHome) this.match.homeScore += 1; else this.match.awayScore += 1;
    this.match.goals.push(M.lireGoal({ id: M.uuid(), isHome, minute: this.elapsedTime, period: this.currentPeriod, playerName, timestamp: M.iso() }));
    this.changer();
  }

  removeGoal(id) {
    const but = this.match.goals.find((g) => g.id === id);
    if (!but) return;
    if (but.isHome) this.match.homeScore = Math.max(0, this.match.homeScore - 1);
    else this.match.awayScore = Math.max(0, this.match.awayScore - 1);
    this.match.goals = this.match.goals.filter((g) => g.id !== id);
    this.changer();
  }

  /** Bouton « − » de la feuille du score : le score baisse, les buts restent (comme l'app) */
  retirerScore(isHome) {
    if (isHome) this.match.homeScore = Math.max(0, this.match.homeScore - 1);
    else this.match.awayScore = Math.max(0, this.match.awayScore - 1);
    this.changer();
  }

  // MARK: - Cartons

  addCard(type, playerName, playerId = null) {
    this.tick(false);
    const libelle = [this.match.homeTeam, this.match.awayTeam].filter((x) => x !== '').join(' - ');
    const carton = M.lireCarton({
      id: M.uuid(), type, playerName, playerId: playerId ?? undefined, minute: this.elapsedTime, period: this.currentPeriod,
      timestamp: M.iso(), matchId: this.match.id, matchLabel: libelle === '' ? undefined : libelle, matchDate: this.match.date,
    });
    this.match.cards.push(carton);
    if (type === 'Rouge' || type === '2ème Jaune') {
      this.cancelTempExpulsion(playerId, playerName);
      this.expelPlayer(playerId, playerName);
    }
    if (type === 'Blanc') this.tempExpelPlayer(playerId, playerName, carton.id);
    this.changer();
  }

  supprimerCarton(id) {
    this.match.cards = this.match.cards.filter((c) => c.id !== id);
    this.changer();
  }

  expelPlayer(playerId, playerName) {
    const mp = this.matchRoster.find((p) => correspond(p, playerId, playerName));
    if (mp) { mp.status = 'Expulsé'; this.match.matchRoster = this.matchRoster; }
  }

  cancelTempExpulsion(playerId, playerName) {
    const i = this.activeTempExpulsions.findIndex((e) => (playerId && e.playerId ? e.playerId === playerId : e.playerName === playerName));
    if (i < 0) return;
    const exp = this.activeTempExpulsions[i];
    exp.isCompleted = true;
    const dansMatch = this.match.tempExpulsions.find((e) => e.id === exp.id);
    if (dansMatch) dansMatch.isCompleted = true;
    delete this.tempExpulsionPeriodStartEffective[exp.id];
    this.activeTempExpulsions.splice(i, 1);
  }

  /** Carton blanc : 10 minutes de temps écoulé (arrêts compris) */
  tempExpelPlayer(playerId, playerName, cardEventId) {
    const mp = this.matchRoster.find((p) => correspond(p, playerId, playerName));
    if (mp) { mp.status = 'Expulsé temp.'; this.match.matchRoster = this.matchRoster; }
    const exp = M.lireExclusionTemporaire({
      id: M.uuid(), playerId: playerId ?? undefined, playerName, cardEventId, totalDuration: 600, elapsedAtPause: 0,
      isCompleted: false, startPeriod: this.currentPeriod, startMinute: this.elapsedTime,
    });
    this.activeTempExpulsions.push(exp);
    this.match.tempExpulsions.push({ ...exp });
    this.tempExpulsionPeriodStartEffective[exp.id] = this.elapsedTime;
  }

  remainingTempExpulsionTime(exp) {
    if (exp.isCompleted) return 0;
    const debut = this.tempExpulsionPeriodStartEffective[exp.id] ?? this.elapsedTime;
    const purge = exp.elapsedAtPause + Math.max(0, this.elapsedTime - debut);
    return Math.max(0, exp.totalDuration - purge);
  }

  checkTempExpulsions() {
    for (let i = this.activeTempExpulsions.length - 1; i >= 0; i--) {
      const e = this.activeTempExpulsions[i];
      if (this.remainingTempExpulsionTime(e) <= 0 && !e.isCompleted) this.completeTempExpulsion(i);
    }
  }

  completeTempExpulsion(i) {
    const exp = this.activeTempExpulsions[i];
    exp.isCompleted = true;
    const dansMatch = this.match.tempExpulsions.find((e) => e.id === exp.id);
    if (dansMatch) dansMatch.isCompleted = true;
    const mp = this.matchRoster.find((p) => correspond(p, exp.playerId, exp.playerName));
    if (mp && mp.status === 'Expulsé temp.') { mp.status = 'Titulaire'; this.match.matchRoster = this.matchRoster; }
    this.endedTempExpulsionPlayerName = exp.playerName;
    this.showTempExpulsionEndAlert = true;
    this.activeTempExpulsions.splice(i, 1);
    this.changer();
    this.surFinExpulsion?.(exp.playerName);
  }

  pauseTempExpulsions() {
    for (const e of this.activeTempExpulsions) {
      if (e.isCompleted) continue;
      const debut = this.tempExpulsionPeriodStartEffective[e.id] ?? 0;
      e.elapsedAtPause += Math.max(0, this.elapsedTime - debut);
      const dansMatch = this.match.tempExpulsions.find((x) => x.id === e.id);
      if (dansMatch) dansMatch.elapsedAtPause = e.elapsedAtPause;
    }
    this.tempExpulsionPeriodStartEffective = {};
  }

  resumeTempExpulsions() {
    for (const e of this.activeTempExpulsions) if (!e.isCompleted) this.tempExpulsionPeriodStartEffective[e.id] = 0;
  }

  // MARK: - Fautes et passes décisives

  addFoul(playerName, playerId = null) {
    this.tick(false);
    this.match.fouls.push(M.lireFaute({ id: M.uuid(), playerName, playerId: playerId ?? undefined, minute: this.elapsedTime, period: this.currentPeriod, timestamp: M.iso() }));
    this.changer();
  }

  removeFoul(id) { this.match.fouls = this.match.fouls.filter((f) => f.id !== id); this.changer(); }

  foulCount(playerId) { return this.match.fouls.filter((f) => f.playerId === playerId).length; }

  addAssist(playerName, playerId = null) {
    this.tick(false);
    this.match.assists.push(M.lirePasse({ id: M.uuid(), playerName, playerId: playerId ?? undefined, minute: this.elapsedTime, period: this.currentPeriod, timestamp: M.iso() }));
    this.changer();
  }

  removeAssist(id) { this.match.assists = this.match.assists.filter((a) => a.id !== id); this.changer(); }

  assistCount(playerId) { return this.match.assists.filter((a) => a.playerId === playerId).length; }

  // MARK: - Remplacements

  addSubstitution(playerOut, playerIn, playerOutId = null, playerInId = null) {
    this.tick(false);
    this.match.substitutions.push(M.lireRemplacement({
      id: M.uuid(), playerOut, playerIn, playerOutId: playerOutId ?? undefined, playerInId: playerInId ?? undefined,
      minute: this.elapsedTime, period: this.currentPeriod, timestamp: M.iso(),
    }));
    const sortant = playerOutId ? this.matchRoster.find((p) => p.id === playerOutId) : null;
    if (sortant) sortant.status = 'Remplaçant';
    const entrant = playerInId ? this.matchRoster.find((p) => p.id === playerInId) : null;
    if (entrant) entrant.status = 'Titulaire';
    this.match.matchRoster = this.matchRoster;
    this.changer();
  }

  // MARK: - Composition

  loadMatchRoster() { this.matchRoster = this.match.matchRoster; }

  setMatchRoster(roster) {
    this.matchRoster = roster;
    this.match.matchRoster = roster;
  }

  /** Positions de placement : { idJoueur: { x, y } } (0…1) et nom de la formation */
  saveFormationPositions(positions, formation) {
    for (const mp of this.matchRoster) {
      const p = positions?.[mp.id];
      if (p) { mp.formationX = p.x; mp.formationY = p.y; } else { delete mp.formationX; delete mp.formationY; }
    }
    this.match.matchRoster = this.matchRoster;
    this.match.selectedFormation = formation ?? undefined;
  }

  clearMatchRoster() {
    this.matchRoster = [];
    this.match.matchRoster = [];
  }

  get titulaires() { return this.matchRoster.filter((p) => p.status === 'Titulaire'); }
  get remplacants() { return this.matchRoster.filter((p) => p.status === 'Remplaçant'); }
  get expulses() { return this.matchRoster.filter((p) => p.status === 'Expulsé'); }

  /** Joueurs sélectionnables (cartons, fautes…) : tous sauf les expulsés définitifs, par numéro */
  get allMatchPlayers() {
    return this.matchRoster.filter((p) => p.status !== 'Expulsé').sort((a, b) => a.shirtNumber - b.shirtNumber);
  }

  // MARK: - Temps de jeu en direct (équité)

  surTerrainEnFinDe(playerId, periode, jouees, auDepart) {
    let surTerrain = periode === jouees[0]
      ? (auDepart.get(playerId) ?? false)
      : this.surTerrainEnFinDe(playerId, M.periodePrecedente(periode), jouees, auDepart);
    for (const s of this.match.substitutions.filter((x) => x.period === periode).sort((a, b) => a.minute - b.minute)) {
      if (s.playerOutId === playerId) surTerrain = false;
      if (s.playerInId === playerId) surTerrain = true;
    }
    return surTerrain;
  }

  calcTimeInPeriod(playerId, periode, duree, finies, auDepart, auDebutForce = null) {
    let auDebut;
    if (auDebutForce != null) auDebut = auDebutForce;
    else if (periode === M.PERIODES.find((p) => finies.includes(p) || p === this.currentPeriod)) auDebut = auDepart.get(playerId) ?? false;
    else auDebut = this.surTerrainEnFinDe(playerId, M.periodePrecedente(periode), finies, auDepart);
    const evenements = [
      ...this.match.substitutions.filter((s) => s.period === periode && s.playerOutId === playerId).map((s) => ({ minute: s.minute, entre: false })),
      ...this.match.substitutions.filter((s) => s.period === periode && s.playerInId === playerId).map((s) => ({ minute: s.minute, entre: true })),
    ].sort((a, b) => a.minute - b.minute);
    let surTerrain = auDebut;
    let dernier = 0;
    let temps = 0;
    for (const e of evenements) {
      if (surTerrain) temps += e.minute - dernier;
      surTerrain = e.entre;
      dernier = e.minute;
    }
    if (surTerrain) temps += duree - dernier;
    return [temps, surTerrain];
  }

  /** [{ id, playerName, shirtNumber, position, totalTime, isOnField, isTitulaire }], du moins joué au plus joué */
  livePlayerPlayingTimes() {
    if (!this.matchRoster.length) return [];
    const finies = M.PERIODES.filter((p) => this.match.periodDurations[p] != null);
    const auDepart = new Map(this.matchRoster.map((mp) => [mp.id, M.wasInitiallyOnField(this.match, mp.id)]));
    const enCours = ![ETATS.idle, ETATS.matchEnded, ETATS.periodEnded].includes(this.timerState.type);
    const res = this.matchRoster.map((mp) => {
      let total = 0;
      let surTerrain = false;
      for (const periode of finies) {
        const [t, fin] = this.calcTimeInPeriod(mp.id, periode, this.match.periodDurations[periode] ?? 0, finies, auDepart);
        total += t;
        surTerrain = fin;
      }
      if (enCours && !finies.includes(this.currentPeriod)) {
        const auDebut = finies.length === 0 ? (auDepart.get(mp.id) ?? false) : surTerrain;
        const [t, maintenant] = this.calcTimeInPeriod(mp.id, this.currentPeriod, this.elapsedTime, finies, auDepart, auDebut);
        total += t;
        surTerrain = maintenant;
      }
      return {
        id: mp.id,
        playerName: M.fullName(mp) === '' ? `Joueur #${mp.shirtNumber}` : M.fullName(mp),
        shirtNumber: mp.shirtNumber,
        position: mp.position,
        totalTime: total,
        isOnField: surTerrain,
        isTitulaire: auDepart.get(mp.id) ?? false,
      };
    });
    return res.sort((a, b) => a.totalTime - b.totalTime);
  }

  get playingTimeGap() {
    const t = this.livePlayerPlayingTimes();
    if (!t.length) return 0;
    return t[t.length - 1].totalTime - t[0].totalTime;
  }

  // MARK: - Sauvegarde continue du match en cours (web)

  /** Après chaque changement : enregistre l'état si un match est en cours */
  changer() {
    this.enregistrerEtat();
  }

  enregistrerEtat() {
    if (!this.persistance) return;
    const enCours = this.afficherMatch || this.afficherRecap || this.timerState.type !== ETATS.idle;
    if (!enCours) { store.effacer(CLE_EN_COURS); return; }
    store.ecrire(CLE_EN_COURS, {
      version: 1,
      profilId: store.profilActifId,
      afficherMatch: this.afficherMatch,
      afficherRecap: this.afficherRecap,
      match: this.match,
      matchRoster: this.matchRoster,
      timerState: this.timerState,
      currentPeriod: this.currentPeriod,
      currentStoppageType: this.currentStoppageType,
      elapsedTime: this.elapsedTime,
      stoppageElapsed: this.stoppageElapsed,
      periodStartDate: this.periodStartDate,
      accumulatedTime: this.accumulatedTime,
      stoppageStartDate: this.stoppageStartDate,
      accumulatedStoppageTime: this.accumulatedStoppageTime,
      possessionStartDate: this.possessionStartDate,
      accumulatedPossessionTime: this.accumulatedPossessionTime,
      currentPossession: this.currentPossession,
      activeTempExpulsions: this.activeTempExpulsions,
      tempExpulsionPeriodStartEffective: this.tempExpulsionPeriodStartEffective,
    });
  }

  /** Reprend un match en cours enregistré ; renvoie true si un match a été repris */
  restaurer() {
    if (!this.persistance) return false;
    const e = store.lire(CLE_EN_COURS);
    if (!e || e.version !== 1 || !e.match) return false;
    this.match = M.lireMatch(e.match);
    this.matchRoster = (e.matchRoster ?? []).map(M.lireMatchPlayer);
    this.match.matchRoster = this.matchRoster;
    const types = Object.values(ETATS);
    this.timerState = e.timerState && types.includes(e.timerState.type) ? { ...e.timerState } : { type: ETATS.idle };
    this.currentPeriod = M.PERIODES.includes(e.currentPeriod) ? e.currentPeriod : '1ère Mi-Temps';
    this.currentStoppageType = e.currentStoppageType ?? null;
    this.elapsedTime = Number(e.elapsedTime) || 0;
    this.stoppageElapsed = Number(e.stoppageElapsed) || 0;
    this.periodStartDate = e.periodStartDate ?? null;
    this.accumulatedTime = Number(e.accumulatedTime) || 0;
    this.stoppageStartDate = e.stoppageStartDate ?? null;
    this.accumulatedStoppageTime = Number(e.accumulatedStoppageTime) || 0;
    this.possessionStartDate = e.possessionStartDate ?? null;
    this.accumulatedPossessionTime = Number(e.accumulatedPossessionTime) || 0;
    this.currentPossession = e.currentPossession ?? null;
    this.activeTempExpulsions = (e.activeTempExpulsions ?? []).map(M.lireExclusionTemporaire);
    this.tempExpulsionPeriodStartEffective = { ...(e.tempExpulsionPeriodStartEffective ?? {}) };
    this.afficherMatch = Boolean(e.afficherMatch);
    this.afficherRecap = Boolean(e.afficherRecap);
    if (this.isPlaying || this.isStopped) {
      this.tick(false);
      this.lancerMinuterie();
    }
    return true;
  }
}

/** Le match de l'app (un seul à la fois, comme le MatchViewModel de ContentView) */
export const vm = new MatchViewModel();
