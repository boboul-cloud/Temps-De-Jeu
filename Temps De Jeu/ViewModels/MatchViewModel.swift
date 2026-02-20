//
//  MatchViewModel.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI
import Combine

/// État du chronomètre
enum TimerState: Equatable {
    case idle           // Match pas encore démarré
    case running        // Jeu en cours
    case stopped(StoppageType, BeneficiaryTeam?)  // Arrêt de jeu en cours
    case periodEnded    // Période terminée
    case matchEnded     // Match terminé
}

/// Brouillon de configuration de match, sauvegardé entre les lancements de l'app
struct MatchSetupDraft: Codable {
    var match: Match
    var matchRoster: [MatchPlayer]
    var unavailablePlayerIds: [UUID]
    var importChain: [String]
}

@MainActor
class MatchViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var match: Match
    @Published var timerState: TimerState = .idle
    @Published var currentPeriod: MatchPeriod = .firstHalf
    @Published var elapsedTime: TimeInterval = 0          // Temps total écoulé dans la période
    @Published var stoppageElapsed: TimeInterval = 0      // Temps de l'arrêt en cours
    @Published var currentStoppageType: StoppageType?
    @Published var showStoppageSelector = false
    @Published var matchRoster: [MatchPlayer] = []  // Effectif sélectionné pour ce match
    @Published var activeTempExpulsions: [TempExpulsion] = []  // Expulsions temporaires en cours
    @Published var showTempExpulsionEndAlert = false
    @Published var endedTempExpulsionPlayerName: String = ""

    // Temps effectif de jeu au début de chaque expulsion temporaire dans la période courante
    // Clé = TempExpulsion.id, Valeur = effectiveTime au moment du début dans cette période
    private var tempExpulsionPeriodStartEffective: [UUID: TimeInterval] = [:]

    // MARK: - Private Properties

    private var timer: Timer?
    private var periodStartDate: Date?
    private var stoppageStartDate: Date?
    private var accumulatedTime: TimeInterval = 0         // Temps accumulé avant pause
    private var accumulatedStoppageTime: TimeInterval = 0

    private static var draftKey: String {
        "\(ProfileManager.currentStoragePrefix)matchSetupDraft"
    }

    // MARK: - Init

    init(match: Match = Match()) {
        // Essayer de restaurer un brouillon sauvegardé
        if let draft = Self.loadDraft() {
            self.match = draft.match
            self.matchRoster = draft.matchRoster
        } else {
            self.match = match
        }
    }

    // MARK: - Computed Properties

    /// Temps effectif de jeu dans la période courante
    var currentEffectiveTime: TimeInterval {
        let totalStoppages = match.totalStoppageTime(for: currentPeriod) + stoppageElapsed
        return max(0, elapsedTime - totalStoppages)
    }

    /// Temps additionnel accumulé dans la période courante
    /// Seuls blessures, VAR, anti-jeu + 30s forfait par remplacement
    var currentAddedTime: TimeInterval {
        // Arrêts qui comptent (blessure, VAR, anti-jeu)
        let countedFinished = match.stoppages
            .filter { $0.period == currentPeriod && $0.type.countsForAddedTime }
            .reduce(0) { $0 + $1.duration }
        // L'arrêt en cours s'il compte
        let currentCounts: TimeInterval
        if let type = currentStoppageType, type.countsForAddedTime {
            currentCounts = stoppageElapsed
        } else {
            currentCounts = 0
        }
        // Forfait 30s par remplacement
        let replacementCount = match.stoppages.filter { $0.period == currentPeriod && $0.type == .remplacement }.count
        let replacementForfait = Double(replacementCount) * 30
        return countedFinished + currentCounts + replacementForfait
    }

    /// Temps total d'arrêts (tous types) pour statistiques
    var currentTotalStoppageTime: TimeInterval {
        match.totalStoppageTime(for: currentPeriod) + stoppageElapsed
    }

    /// Temps réglementaire dépassé
    var isOverRegulationTime: Bool {
        elapsedTime > currentPeriod.regulationDuration
    }

    /// Minutes supplémentaires au-delà du temps réglementaire
    var overtimeMinutes: Int {
        guard isOverRegulationTime else { return 0 }
        return Int(ceil((elapsedTime - currentPeriod.regulationDuration) / 60))
    }

    /// Vérifie si le jeu est en cours
    var isPlaying: Bool {
        timerState == .running
    }

    /// Vérifie si le jeu est en arrêt
    var isStopped: Bool {
        if case .stopped = timerState { return true }
        return false
    }

    /// Équipe bénéficiaire de l'arrêt en cours
    var currentBeneficiaryTeam: BeneficiaryTeam? {
        if case .stopped(_, let team) = timerState { return team }
        return nil
    }

    /// Prochaine période
    var nextPeriod: MatchPeriod {
        switch currentPeriod {
        case .firstHalf: return .secondHalf
        case .secondHalf: return .extraFirstHalf
        case .extraFirstHalf: return .extraSecondHalf
        case .extraSecondHalf: return .extraSecondHalf
        }
    }

    /// Vrai si c'est la dernière période possible
    var isLastPeriod: Bool {
        currentPeriod == .extraSecondHalf
    }

    // MARK: - Actions du match

    /// Démarrer le match ou reprendre la période
    func startMatch() {
        guard timerState == .idle || timerState == .periodEnded else { return }

        if timerState == .periodEnded {
            // Nouvelle période
            advancePeriod()
        }

        timerState = .running
        periodStartDate = Date()
        accumulatedTime = 0
        elapsedTime = 0
        stoppageElapsed = 0

        // Reprendre les expulsions temporaires en cours (après mi-temps)
        resumeTempExpulsions()

        startTimer()
    }

    /// Arrêter le jeu (temps mort)
    func stopPlay(type: StoppageType, beneficiary: BeneficiaryTeam? = nil) {
        guard timerState == .running else { return }

        currentStoppageType = type
        timerState = .stopped(type, beneficiary)

        // Créer un nouvel arrêt
        let stoppage = Stoppage(
            type: type,
            period: currentPeriod,
            startTime: elapsedTime,
            beneficiaryTeam: beneficiary
        )
        match.stoppages.append(stoppage)

        stoppageStartDate = Date()
        accumulatedStoppageTime = 0
        stoppageElapsed = 0

        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
        impactFeedback.impactOccurred()
    }

    /// Chaîner un nouvel arrêt depuis l'arrêt en cours (sans reprendre le jeu)
    /// Ferme l'arrêt courant et en ouvre immédiatement un nouveau
    func chainStoppage(type: StoppageType, beneficiary: BeneficiaryTeam? = nil) {
        guard case .stopped = timerState else { return }

        // Fermer l'arrêt en cours
        if var lastStoppage = match.stoppages.last, lastStoppage.endTime == nil {
            lastStoppage = Stoppage(
                id: lastStoppage.id,
                type: lastStoppage.type,
                period: lastStoppage.period,
                startTime: lastStoppage.startTime,
                endTime: elapsedTime,
                timestamp: lastStoppage.timestamp,
                beneficiaryTeam: lastStoppage.beneficiaryTeam
            )
            match.stoppages[match.stoppages.count - 1] = lastStoppage
        }

        // Ouvrir immédiatement le nouvel arrêt
        currentStoppageType = type
        timerState = .stopped(type, beneficiary)

        let stoppage = Stoppage(
            type: type,
            period: currentPeriod,
            startTime: elapsedTime,
            beneficiaryTeam: beneficiary
        )
        match.stoppages.append(stoppage)

        stoppageStartDate = Date()
        accumulatedStoppageTime = 0
        stoppageElapsed = 0

        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
        impactFeedback.impactOccurred()
    }

    /// Reprendre le jeu
    func resumePlay() {
        guard case .stopped = timerState else { return }

        // Fermer l'arrêt en cours
        if var lastStoppage = match.stoppages.last, lastStoppage.endTime == nil {
            lastStoppage = Stoppage(
                id: lastStoppage.id,
                type: lastStoppage.type,
                period: lastStoppage.period,
                startTime: lastStoppage.startTime,
                endTime: elapsedTime,
                timestamp: lastStoppage.timestamp,
                beneficiaryTeam: lastStoppage.beneficiaryTeam
            )
            match.stoppages[match.stoppages.count - 1] = lastStoppage
        }

        timerState = .running
        currentStoppageType = nil
        stoppageElapsed = 0
        stoppageStartDate = nil

        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.impactOccurred()
    }

    /// Terminer la période en cours
    func endPeriod() {
        // Si un arrêt est en cours, le fermer
        if case .stopped = timerState {
            resumePlay()
        }

        // Sauvegarder la durée de la période
        match.periodDurations[currentPeriod.rawValue] = elapsedTime

        // Geler les expulsions temporaires en cours (pause mi-temps)
        pauseTempExpulsions()

        timerState = .periodEnded
        stopTimer()

        // Haptic feedback
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.notificationOccurred(.success)
    }

    /// Terminer le match
    func endMatch() {
        if timerState == .running || isStopped {
            endPeriod()
        }
        match.isFinished = true
        timerState = .matchEnded
        stopTimer()
    }

    /// Passer à la période suivante
    private func advancePeriod() {
        switch currentPeriod {
        case .firstHalf: currentPeriod = .secondHalf
        case .secondHalf: currentPeriod = .extraFirstHalf
        case .extraFirstHalf: currentPeriod = .extraSecondHalf
        case .extraSecondHalf: break
        }
    }

    /// Réinitialiser pour un nouveau match
    func resetMatch() {
        stopTimer()
        match = Match()
        timerState = .idle
        currentPeriod = .firstHalf
        elapsedTime = 0
        stoppageElapsed = 0
        currentStoppageType = nil
        periodStartDate = nil
        stoppageStartDate = nil
        accumulatedTime = 0
        accumulatedStoppageTime = 0
        matchRoster = []
        activeTempExpulsions = []
        tempExpulsionPeriodStartEffective = [:]
        clearDraft()
    }

    // MARK: - Persistance du brouillon

    /// Sauvegarder le brouillon de configuration (infos match + composition)
    func saveDraft(unavailablePlayerIds: Set<UUID> = [], importChain: [String] = []) {
        let draft = MatchSetupDraft(
            match: match,
            matchRoster: matchRoster,
            unavailablePlayerIds: Array(unavailablePlayerIds),
            importChain: importChain
        )
        do {
            let data = try JSONEncoder().encode(draft)
            UserDefaults.standard.set(data, forKey: Self.draftKey)
        } catch {
            print("Erreur sauvegarde brouillon: \(error)")
        }
    }

    /// Charger le brouillon sauvegardé
    static func loadDraft() -> MatchSetupDraft? {
        guard let data = UserDefaults.standard.data(forKey: draftKey) else { return nil }
        do {
            return try JSONDecoder().decode(MatchSetupDraft.self, from: data)
        } catch {
            print("Erreur chargement brouillon: \(error)")
            return nil
        }
    }

    /// Supprimer le brouillon
    func clearDraft() {
        UserDefaults.standard.removeObject(forKey: Self.draftKey)
    }

    /// Retourne les IDs des joueurs sélectionnés dans les rosters des autres catégories (pas le profil actif)
    /// Le dictionnaire associe chaque Player.id LOCAL au nom de la catégorie où il est sélectionné.
    /// Matching par UUID direct ET par nom (prénom+nom normalisé) pour couvrir les cas
    /// où le même joueur a été créé séparément dans chaque catégorie.
    static func playerIdsSelectedInOtherCategories(localPlayers: [Player]) -> [UUID: String] {
        let profiles = ProfileManager.shared.profiles
        guard let activeId = ProfileManager.shared.activeProfileId else {
            print("🔍 [CrossCategory] Pas de profil actif")
            return [:]
        }

        print("🔍 [CrossCategory] Profil actif: \(profiles.first(where: { $0.id == activeId })?.name ?? "?") — \(profiles.count) profils au total — \(localPlayers.count) joueurs locaux")

        // Index local : nom normalisé → Player.id
        let normalize: (String, String) -> String = { first, last in
            let f = first.trimmingCharacters(in: .whitespaces).lowercased()
            let l = last.trimmingCharacters(in: .whitespaces).lowercased()
            return "\(f)_\(l)"
        }
        var localByName: [String: UUID] = [:]
        for p in localPlayers {
            let key = normalize(p.firstName, p.lastName)
            if !key.isEmpty && key != "_" {
                localByName[key] = p.id
            }
        }

        var result: [UUID: String] = [:]

        for profile in profiles where profile.id != activeId {
            let key = "profile_\(profile.id.uuidString)_matchSetupDraft"
            let data = UserDefaults.standard.data(forKey: key)
            print("🔍 [CrossCategory] Profil '\(profile.name)' — clé: \(key) — data: \(data != nil ? "\(data!.count) bytes" : "nil")")

            guard let data = data else { continue }

            do {
                let draft = try JSONDecoder().decode(MatchSetupDraft.self, from: data)
                print("🔍 [CrossCategory]   → roster: \(draft.matchRoster.count) joueurs: \(draft.matchRoster.map { "\($0.firstName) \($0.lastName)" })")

                guard !draft.matchRoster.isEmpty else { continue }

                for mp in draft.matchRoster {
                    // 1) Matching par UUID direct
                    if localPlayers.contains(where: { $0.id == mp.id }) {
                        result[mp.id] = profile.name
                        print("🔍 [CrossCategory]   ✅ UUID match: \(mp.firstName) \(mp.lastName) → \(profile.name)")
                        continue
                    }
                    // 2) Matching par nom (prénom + nom)
                    let nameKey = normalize(mp.firstName, mp.lastName)
                    if let localId = localByName[nameKey] {
                        result[localId] = profile.name
                        print("🔍 [CrossCategory]   ✅ NAME match: \(mp.firstName) \(mp.lastName) → \(profile.name)")
                    } else {
                        print("🔍 [CrossCategory]   ❌ Pas de match pour \(mp.firstName) \(mp.lastName)")
                    }
                }
            } catch {
                print("🔍 [CrossCategory]   ⚠️ Erreur décodage: \(error)")
            }
        }

        print("🔍 [CrossCategory] Résultat: \(result.count) joueurs bloqués")
        return result
    }

    // MARK: - Timer

    private func startTimer() {
        stopTimer()
        periodStartDate = Date()
        accumulatedTime = elapsedTime
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] timer in
            guard let self else {
                timer.invalidate()
                return
            }
            Task { @MainActor in
                self.tick()
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        guard let periodStart = periodStartDate else { return }

        // Mettre à jour le temps total écoulé
        elapsedTime = accumulatedTime + Date().timeIntervalSince(periodStart)

        // Si arrêt en cours, mettre à jour le temps d'arrêt
        if let stoppageStart = stoppageStartDate {
            stoppageElapsed = accumulatedStoppageTime + Date().timeIntervalSince(stoppageStart)
        }

        // Vérifier les expulsions temporaires
        checkTempExpulsions()
    }

    // MARK: - Suppression d'arrêt

    func deleteStoppage(_ stoppage: Stoppage) {
        match.stoppages.removeAll { $0.id == stoppage.id }
    }

    // MARK: - Score

    func addGoal(isHome: Bool, playerName: String = "") {
        if isHome {
            match.homeScore += 1
        } else {
            match.awayScore += 1
        }
        let goal = GoalEvent(
            isHome: isHome,
            minute: elapsedTime,
            period: currentPeriod,
            playerName: playerName
        )
        match.goals.append(goal)
    }

    func removeGoal(_ goal: GoalEvent) {
        if goal.isHome {
            match.homeScore = max(0, match.homeScore - 1)
        } else {
            match.awayScore = max(0, match.awayScore - 1)
        }
        match.goals.removeAll { $0.id == goal.id }
    }

    // MARK: - Cartons

    func addCard(type: CardType, playerName: String, playerId: UUID? = nil) {
        let matchLabel = [match.homeTeam, match.awayTeam].filter { !$0.isEmpty }.joined(separator: " - ")
        let card = CardEvent(
            type: type,
            playerName: playerName,
            playerId: playerId,
            minute: elapsedTime,
            period: currentPeriod,
            matchId: match.id,
            matchLabel: matchLabel.isEmpty ? nil : matchLabel,
            matchDate: match.date
        )
        match.cards.append(card)

        // Expulsion automatique : carton rouge ou 2ème jaune
        if type == .red || type == .secondYellow {
            // Si le joueur est sous expulsion temporaire (carton blanc), annuler le compte à rebours
            cancelTempExpulsion(playerId: playerId, playerName: playerName)
            expelPlayer(playerId: playerId, playerName: playerName)
        }

        // Expulsion temporaire : carton blanc (10 minutes)
        if type == .white {
            tempExpelPlayer(playerId: playerId, playerName: playerName, cardEventId: card.id)
        }
    }

    /// Expulse un joueur du roster (le passe en statut .expulse)
    private func expelPlayer(playerId: UUID?, playerName: String) {
        // Chercher le joueur dans le roster par ID ou par nom
        if let idx = matchRoster.firstIndex(where: { player in
            if let pid = playerId { return player.id == pid }
            return player.displayName == playerName
        }) {
            matchRoster[idx].status = .expulse
            match.matchRoster = matchRoster
        }
    }

    /// Annule l'expulsion temporaire d'un joueur (si en cours) — appelé quand le joueur reçoit un rouge ou 2ème jaune
    private func cancelTempExpulsion(playerId: UUID?, playerName: String) {
        // Trouver l'expulsion temporaire active pour ce joueur
        if let idx = activeTempExpulsions.firstIndex(where: { expulsion in
            if let pid = playerId, let eid = expulsion.playerId { return pid == eid }
            return expulsion.playerName == playerName
        }) {
            // Marquer comme terminée
            activeTempExpulsions[idx].isCompleted = true
            let expulsion = activeTempExpulsions[idx]

            // Mettre à jour dans match.tempExpulsions
            if let matchIdx = match.tempExpulsions.firstIndex(where: { $0.id == expulsion.id }) {
                match.tempExpulsions[matchIdx].isCompleted = true
            }

            // Nettoyer les références
            tempExpulsionPeriodStartEffective.removeValue(forKey: expulsion.id)

            // Retirer de la liste active
            activeTempExpulsions.remove(at: idx)
        }
    }

    /// Expulsion temporaire (carton blanc) — 10 minutes de temps écoulé (arrêts inclus)
    private func tempExpelPlayer(playerId: UUID?, playerName: String, cardEventId: UUID) {
        // Passer le joueur en statut tempExpulse
        if let idx = matchRoster.firstIndex(where: { player in
            if let pid = playerId { return player.id == pid }
            return player.displayName == playerName
        }) {
            matchRoster[idx].status = .tempExpulse
            match.matchRoster = matchRoster
        }

        // Créer le suivi de l'expulsion temporaire
        let expulsion = TempExpulsion(
            playerId: playerId,
            playerName: playerName,
            cardEventId: cardEventId,
            startPeriod: currentPeriod,
            startMinute: elapsedTime
        )
        activeTempExpulsions.append(expulsion)
        match.tempExpulsions.append(expulsion)

        // Enregistrer le temps écoulé de départ pour cette période
        tempExpulsionPeriodStartEffective[expulsion.id] = elapsedTime
    }

    /// Calcule le temps restant pour une expulsion temporaire
    func remainingTempExpulsionTime(for expulsion: TempExpulsion) -> TimeInterval {
        guard !expulsion.isCompleted else { return 0 }
        // Temps écoulé purgé dans cette période depuis le début/reprise (arrêts inclus)
        let startElapsed = tempExpulsionPeriodStartEffective[expulsion.id] ?? elapsedTime
        let purgedThisPeriod = max(0, elapsedTime - startElapsed)
        let totalPurged = expulsion.elapsedAtPause + purgedThisPeriod
        return max(0, expulsion.totalDuration - totalPurged)
    }

    /// Vérifie les expulsions temporaires terminées (appelé dans tick)
    private func checkTempExpulsions() {
        for i in activeTempExpulsions.indices.reversed() {
            let remaining = remainingTempExpulsionTime(for: activeTempExpulsions[i])
            if remaining <= 0 && !activeTempExpulsions[i].isCompleted {
                completeTempExpulsion(at: i)
            }
        }
    }

    /// Termine une expulsion temporaire et réintègre le joueur
    private func completeTempExpulsion(at index: Int) {
        activeTempExpulsions[index].isCompleted = true
        let expulsion = activeTempExpulsions[index]

        // Mettre à jour dans match.tempExpulsions
        if let matchIdx = match.tempExpulsions.firstIndex(where: { $0.id == expulsion.id }) {
            match.tempExpulsions[matchIdx].isCompleted = true
        }

        // Réintégrer le joueur dans le roster (retour en titulaire)
        if let rosterIdx = matchRoster.firstIndex(where: { player in
            if let pid = expulsion.playerId { return player.id == pid }
            return player.displayName == expulsion.playerName
        }) {
            if matchRoster[rosterIdx].status == .tempExpulse {
                matchRoster[rosterIdx].status = .titulaire
                match.matchRoster = matchRoster
            }
        }

        // Alerte
        endedTempExpulsionPlayerName = expulsion.playerName
        showTempExpulsionEndAlert = true

        // Retirer de la liste active
        activeTempExpulsions.remove(at: index)

        // Haptic
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.warning)
    }

    /// Pause les expulsions temporaires à la fin d'une période (sauvegarde le temps purgé)
    private func pauseTempExpulsions() {
        for i in activeTempExpulsions.indices {
            guard !activeTempExpulsions[i].isCompleted else { continue }
            let startElapsed = tempExpulsionPeriodStartEffective[activeTempExpulsions[i].id] ?? 0
            let purgedThisPeriod = max(0, elapsedTime - startElapsed)
            activeTempExpulsions[i].elapsedAtPause += purgedThisPeriod

            // Mettre à jour dans match.tempExpulsions aussi
            if let matchIdx = match.tempExpulsions.firstIndex(where: { $0.id == activeTempExpulsions[i].id }) {
                match.tempExpulsions[matchIdx].elapsedAtPause = activeTempExpulsions[i].elapsedAtPause
            }
        }
        // Reset les références de départ pour la prochaine période
        tempExpulsionPeriodStartEffective.removeAll()
    }

    /// Reprend les expulsions temporaires au début d'une nouvelle période
    private func resumeTempExpulsions() {
        // Le temps effectif repart à 0 en début de période
        for expulsion in activeTempExpulsions where !expulsion.isCompleted {
            tempExpulsionPeriodStartEffective[expulsion.id] = 0
        }
    }

    // MARK: - Fautes

    func addFoul(playerName: String, playerId: UUID? = nil) {
        let foul = FoulEvent(
            playerName: playerName,
            playerId: playerId,
            minute: elapsedTime,
            period: currentPeriod
        )
        match.fouls.append(foul)

        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.impactOccurred()
    }

    func removeFoul(_ foul: FoulEvent) {
        match.fouls.removeAll { $0.id == foul.id }
    }

    /// Nombre de fautes pour un joueur donné
    func foulCount(for playerId: UUID) -> Int {
        match.fouls.filter { $0.playerId == playerId }.count
    }

    // MARK: - Remplacements

    func addSubstitution(playerOut: String, playerIn: String, playerOutId: UUID? = nil, playerInId: UUID? = nil) {
        let sub = SubstitutionEvent(
            playerOut: playerOut,
            playerIn: playerIn,
            playerOutId: playerOutId,
            playerInId: playerInId,
            minute: elapsedTime,
            period: currentPeriod
        )
        match.substitutions.append(sub)

        // Mettre à jour les statuts dans le roster :
        // le sortant devient remplaçant, l'entrant devient titulaire
        if let outId = playerOutId,
           let outIndex = matchRoster.firstIndex(where: { $0.id == outId }) {
            matchRoster[outIndex].status = .remplacant
        }
        if let inId = playerInId,
           let inIndex = matchRoster.firstIndex(where: { $0.id == inId }) {
            matchRoster[inIndex].status = .titulaire
        }
        // Synchroniser avec le match
        match.matchRoster = matchRoster
    }

    // MARK: - Roster

    /// Charger le roster du match (depuis match.matchRoster)
    func loadMatchRoster() {
        matchRoster = match.matchRoster
    }

    /// Mettre à jour le roster du match
    func setMatchRoster(_ roster: [MatchPlayer]) {
        matchRoster = roster
        match.matchRoster = roster
        saveDraft()
    }

    /// Supprimer la composition (réinitialiser le roster)
    func clearMatchRoster() {
        matchRoster = []
        match.matchRoster = []
        saveDraft()
    }

    var titulaires: [MatchPlayer] {
        matchRoster.filter { $0.status == .titulaire }
    }

    var remplacants: [MatchPlayer] {
        matchRoster.filter { $0.status == .remplacant }
    }

    var expulses: [MatchPlayer] {
        matchRoster.filter { $0.status == .expulse }
    }

    /// Tous les joueurs du match (pour sélection carton) — exclut uniquement les expulsés définitifs
    /// Les joueurs sous carton blanc (expulsion temporaire) restent sélectionnables
    var allMatchPlayers: [MatchPlayer] {
        matchRoster.filter { $0.status != .expulse }.sorted { $0.shirtNumber < $1.shirtNumber }
    }
}
