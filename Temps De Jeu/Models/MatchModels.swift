//
//  MatchModels.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import Foundation
import SwiftUI

/// Représente une période de jeu (mi-temps)
enum MatchPeriod: String, Codable, CaseIterable, Identifiable {
    case firstHalf = "1ère Mi-Temps"
    case secondHalf = "2ème Mi-Temps"
    case extraFirstHalf = "Prolongation 1"
    case extraSecondHalf = "Prolongation 2"

    var id: String { rawValue }

    /// Durée réglementaire en secondes
    var regulationDuration: TimeInterval {
        switch self {
        case .firstHalf, .secondHalf: return 45 * 60
        case .extraFirstHalf, .extraSecondHalf: return 15 * 60
        }
    }

    var shortName: String {
        switch self {
        case .firstHalf: return "MT1"
        case .secondHalf: return "MT2"
        case .extraFirstHalf: return "PR1"
        case .extraSecondHalf: return "PR2"
        }
    }
}

/// Équipe bénéficiaire d'une action
enum BeneficiaryTeam: String, Codable {
    case home = "home"
    case away = "away"
}

/// Un arrêt de jeu individuel
struct Stoppage: Identifiable, Codable {
    let id: UUID
    let type: StoppageType
    let period: MatchPeriod
    let startTime: TimeInterval      // Temps match quand l'arrêt commence
    let endTime: TimeInterval?       // Temps match quand le jeu reprend (nil si en cours)
    let timestamp: Date              // Heure réelle
    let beneficiaryTeam: BeneficiaryTeam?  // Équipe qui bénéficie de l'action

    init(id: UUID = UUID(), type: StoppageType, period: MatchPeriod, startTime: TimeInterval, endTime: TimeInterval? = nil, timestamp: Date = Date(), beneficiaryTeam: BeneficiaryTeam? = nil) {
        self.id = id
        self.type = type
        self.period = period
        self.startTime = startTime
        self.endTime = endTime
        self.timestamp = timestamp
        self.beneficiaryTeam = beneficiaryTeam
    }

    // Backward compatibility
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        type = try container.decode(StoppageType.self, forKey: .type)
        period = try container.decode(MatchPeriod.self, forKey: .period)
        startTime = try container.decode(TimeInterval.self, forKey: .startTime)
        endTime = try container.decodeIfPresent(TimeInterval.self, forKey: .endTime)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        beneficiaryTeam = try container.decodeIfPresent(BeneficiaryTeam.self, forKey: .beneficiaryTeam)
    }

    /// Durée de l'arrêt en secondes
    var duration: TimeInterval {
        guard let endTime = endTime else { return 0 }
        return endTime - startTime
    }
}

/// Couleur de maillot
enum JerseyColor: String, Codable, CaseIterable, Identifiable {
    case white = "Blanc"
    case black = "Noir"
    case red = "Rouge"
    case blue = "Bleu"
    case darkBlue = "Marine"
    case green = "Vert"
    case darkGreen = "Vert foncé"
    case yellow = "Jaune"
    case orange = "Orange"
    case purple = "Violet"
    case pink = "Rose"
    case cyan = "Cyan"
    case gray = "Gris"
    case maroon = "Bordeaux"
    case skyBlue = "Bleu ciel"

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .white: return Color.white
        case .black: return Color.black
        case .red: return Color.red
        case .blue: return Color.blue
        case .darkBlue: return Color(red: 0.0, green: 0.0, blue: 0.55)
        case .green: return Color.green
        case .darkGreen: return Color(red: 0.0, green: 0.4, blue: 0.0)
        case .yellow: return Color.yellow
        case .orange: return Color.orange
        case .purple: return Color.purple
        case .pink: return Color.pink
        case .cyan: return Color.cyan
        case .gray: return Color.gray
        case .maroon: return Color(red: 0.5, green: 0.0, blue: 0.0)
        case .skyBlue: return Color(red: 0.4, green: 0.7, blue: 1.0)
        }
    }

    /// Couleur du texte adaptée au fond du maillot
    var textColor: Color {
        switch self {
        case .white, .yellow, .cyan, .skyBlue, .pink:
            return .black
        default:
            return .white
        }
    }
}

/// Un match complet
struct Match: Identifiable, Codable {
    let id: UUID
    var homeTeam: String
    var awayTeam: String
    var competition: String
    var date: Date
    var isMyTeamHome: Bool             // true = mon équipe joue à domicile
    var stoppages: [Stoppage]
    var periodDurations: [String: TimeInterval]  // Durée totale de chaque période
    var isFinished: Bool
    var notes: String
    var homeScore: Int
    var awayScore: Int
    var goals: [GoalEvent]
    var cards: [CardEvent]
    var substitutions: [SubstitutionEvent]
    var fouls: [FoulEvent]
    var assists: [AssistEvent]
    var matchRoster: [MatchPlayer]
    var tempExpulsions: [TempExpulsion]
    var homeJerseyColor: JerseyColor
    var awayJerseyColor: JerseyColor
    var homePossessionTime: TimeInterval
    var awayPossessionTime: TimeInterval
    var homePasses: Int
    var awayPasses: Int
    var refereeCentre: String
    var refereeAssistant1: String
    var refereeAssistant2: String
    var selectedFormation: String?  // Formation choisie (ex: "4-4-2")

    init(
        id: UUID = UUID(),
        homeTeam: String = "",
        awayTeam: String = "",
        competition: String = "",
        date: Date = Date(),
        isMyTeamHome: Bool = true,
        stoppages: [Stoppage] = [],
        periodDurations: [String: TimeInterval] = [:],
        isFinished: Bool = false,
        notes: String = "",
        homeScore: Int = 0,
        awayScore: Int = 0,
        goals: [GoalEvent] = [],
        cards: [CardEvent] = [],
        substitutions: [SubstitutionEvent] = [],
        fouls: [FoulEvent] = [],
        assists: [AssistEvent] = [],
        matchRoster: [MatchPlayer] = [],
        tempExpulsions: [TempExpulsion] = [],
        homeJerseyColor: JerseyColor = .white,
        awayJerseyColor: JerseyColor = .blue,
        homePossessionTime: TimeInterval = 0,
        awayPossessionTime: TimeInterval = 0,
        homePasses: Int = 0,
        awayPasses: Int = 0,
        refereeCentre: String = "",
        refereeAssistant1: String = "",
        refereeAssistant2: String = "",
        selectedFormation: String? = nil
    ) {
        self.id = id
        self.homeTeam = homeTeam
        self.awayTeam = awayTeam
        self.competition = competition
        self.date = date
        self.isMyTeamHome = isMyTeamHome
        self.stoppages = stoppages
        self.periodDurations = periodDurations
        self.isFinished = isFinished
        self.notes = notes
        self.homeScore = homeScore
        self.awayScore = awayScore
        self.goals = goals
        self.cards = cards
        self.substitutions = substitutions
        self.fouls = fouls
        self.assists = assists
        self.matchRoster = matchRoster
        self.tempExpulsions = tempExpulsions
        self.homeJerseyColor = homeJerseyColor
        self.awayJerseyColor = awayJerseyColor
        self.homePossessionTime = homePossessionTime
        self.awayPossessionTime = awayPossessionTime
        self.homePasses = homePasses
        self.awayPasses = awayPasses
        self.refereeCentre = refereeCentre
        self.refereeAssistant1 = refereeAssistant1
        self.refereeAssistant2 = refereeAssistant2
        self.selectedFormation = selectedFormation
    }

    // Backward compatibility: old saved matches don't have matchRoster
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        homeTeam = try container.decode(String.self, forKey: .homeTeam)
        awayTeam = try container.decode(String.self, forKey: .awayTeam)
        competition = try container.decode(String.self, forKey: .competition)
        date = try container.decode(Date.self, forKey: .date)
        stoppages = try container.decode([Stoppage].self, forKey: .stoppages)
        periodDurations = try container.decode([String: TimeInterval].self, forKey: .periodDurations)
        isFinished = try container.decode(Bool.self, forKey: .isFinished)
        notes = try container.decode(String.self, forKey: .notes)
        homeScore = try container.decodeIfPresent(Int.self, forKey: .homeScore) ?? 0
        awayScore = try container.decodeIfPresent(Int.self, forKey: .awayScore) ?? 0
        goals = try container.decodeIfPresent([GoalEvent].self, forKey: .goals) ?? []
        cards = try container.decodeIfPresent([CardEvent].self, forKey: .cards) ?? []
        substitutions = try container.decodeIfPresent([SubstitutionEvent].self, forKey: .substitutions) ?? []
        fouls = try container.decodeIfPresent([FoulEvent].self, forKey: .fouls) ?? []
        assists = try container.decodeIfPresent([AssistEvent].self, forKey: .assists) ?? []
        matchRoster = try container.decodeIfPresent([MatchPlayer].self, forKey: .matchRoster) ?? []
        tempExpulsions = try container.decodeIfPresent([TempExpulsion].self, forKey: .tempExpulsions) ?? []
        isMyTeamHome = try container.decodeIfPresent(Bool.self, forKey: .isMyTeamHome) ?? true
        homeJerseyColor = try container.decodeIfPresent(JerseyColor.self, forKey: .homeJerseyColor) ?? .white
        awayJerseyColor = try container.decodeIfPresent(JerseyColor.self, forKey: .awayJerseyColor) ?? .blue
        homePossessionTime = try container.decodeIfPresent(TimeInterval.self, forKey: .homePossessionTime) ?? 0
        awayPossessionTime = try container.decodeIfPresent(TimeInterval.self, forKey: .awayPossessionTime) ?? 0
        homePasses = try container.decodeIfPresent(Int.self, forKey: .homePasses) ?? 0
        awayPasses = try container.decodeIfPresent(Int.self, forKey: .awayPasses) ?? 0
        refereeCentre = try container.decodeIfPresent(String.self, forKey: .refereeCentre) ?? ""
        refereeAssistant1 = try container.decodeIfPresent(String.self, forKey: .refereeAssistant1) ?? ""
        refereeAssistant2 = try container.decodeIfPresent(String.self, forKey: .refereeAssistant2) ?? ""
        selectedFormation = try container.decodeIfPresent(String.self, forKey: .selectedFormation)
    }

    // MARK: - Mon équipe

    /// Nom de mon équipe
    var myTeamName: String {
        isMyTeamHome ? homeTeam : awayTeam
    }

    /// Nom de l'adversaire
    var opponentName: String {
        isMyTeamHome ? awayTeam : homeTeam
    }

    /// Score de mon équipe
    var myScore: Int {
        isMyTeamHome ? homeScore : awayScore
    }

    /// Score de l'adversaire
    var opponentScore: Int {
        isMyTeamHome ? awayScore : homeScore
    }

    // MARK: - Statistiques calculées

    /// Temps total d'arrêts pour une période
    func totalStoppageTime(for period: MatchPeriod) -> TimeInterval {
        stoppages
            .filter { $0.period == period }
            .reduce(0) { $0 + $1.duration }
    }

    /// Temps total d'arrêts pour tout le match
    var totalStoppageTime: TimeInterval {
        stoppages.reduce(0) { $0 + $1.duration }
    }

    /// Temps effectif de jeu pour une période
    func effectivePlayTime(for period: MatchPeriod) -> TimeInterval {
        let totalPeriod = periodDurations[period.rawValue] ?? 0
        return totalPeriod - totalStoppageTime(for: period)
    }

    /// Temps effectif total
    var totalEffectivePlayTime: TimeInterval {
        let totalTime = periodDurations.values.reduce(0, +)
        return totalTime - totalStoppageTime
    }

    /// Durée totale du match
    var totalMatchDuration: TimeInterval {
        periodDurations.values.reduce(0, +)
    }

    /// Pourcentage de temps effectif
    var effectivePercentage: Double {
        guard totalMatchDuration > 0 else { return 0 }
        return (totalEffectivePlayTime / totalMatchDuration) * 100
    }

    /// Nombre d'arrêts par type
    func stoppageCount(for type: StoppageType) -> Int {
        stoppages.filter { $0.type == type }.count
    }

    /// Nombre d'arrêts par type et par équipe
    func stoppageCount(for type: StoppageType, team: BeneficiaryTeam) -> Int {
        stoppages.filter { $0.type == type && $0.beneficiaryTeam == team }.count
    }

    /// Temps total d'arrêt par type
    func totalTime(for type: StoppageType) -> TimeInterval {
        stoppages
            .filter { $0.type == type }
            .reduce(0) { $0 + $1.duration }
    }

    /// Temps total d'arrêt par type et par équipe
    func totalTime(for type: StoppageType, team: BeneficiaryTeam) -> TimeInterval {
        stoppages
            .filter { $0.type == type && $0.beneficiaryTeam == team }
            .reduce(0) { $0 + $1.duration }
    }

    /// Temps additionnel suggéré pour une période
    /// Seuls blessures, VAR et anti-jeu comptent + 30s forfait par remplacement
    func suggestedAddedTime(for period: MatchPeriod) -> TimeInterval {
        // Temps des arrêts qui comptent (blessure, VAR, anti-jeu)
        let countedStoppageTime = stoppages
            .filter { $0.period == period && $0.type.countsForAddedTime }
            .reduce(0) { $0 + $1.duration }
        // Forfait 30s par remplacement
        let replacementCount = stoppages.filter { $0.period == period && $0.type == .remplacement }.count
        let replacementForfait = Double(replacementCount) * 30
        return countedStoppageTime + replacementForfait
    }

    // MARK: - Temps de jeu par joueur

    /// Structure de résultat pour le temps de jeu d'un joueur
    struct PlayerPlayingTime {
        let playerId: UUID
        let playerName: String
        let shirtNumber: Int
        let position: PlayerPosition
        let totalTime: TimeInterval        // Temps total sur le terrain
        let effectiveTime: TimeInterval     // Temps effectif (hors arrêts proportionnel)
        let isTitulaire: Bool              // Était titulaire au début du match
    }

    /// Détermine si un joueur était initialement sur le terrain au début du match.
    /// On ne peut PAS se fier à `mp.status` car celui-ci est modifié par les remplacements
    /// (le sortant passe en `.remplacant`, l'entrant passe en `.titulaire`) et les expulsions.
    /// On reconstitue donc le statut initial en analysant les événements de substitution.
    func wasInitiallyOnField(playerId: UUID) -> Bool {
        guard let mp = matchRoster.first(where: { $0.id == playerId }) else { return false }

        // Collecter toutes les substitutions impliquant ce joueur, triées chronologiquement
        let playerSubs = substitutions
            .filter { $0.playerOutId == playerId || $0.playerInId == playerId }
            .sorted {
                let periodOrder0 = MatchPeriod.allCases.firstIndex(of: $0.period) ?? 0
                let periodOrder1 = MatchPeriod.allCases.firstIndex(of: $1.period) ?? 0
                if periodOrder0 != periodOrder1 { return periodOrder0 < periodOrder1 }
                return $0.minute < $1.minute
            }

        if playerSubs.isEmpty {
            // Aucune substitution pour ce joueur :
            // Si statut = titulaire → était sur le terrain
            // Si statut = expulse ou tempExpulse → était sur le terrain (expulsé sans avoir été remplacé)
            // Si statut = remplacant → n'a jamais joué
            return mp.status == .titulaire || mp.status == .expulse || mp.status == .tempExpulse
        }

        // Le premier événement de substitution nous dit si le joueur était sur le terrain :
        // - S'il sort en premier (playerOutId) → il était sur le terrain au départ
        // - S'il entre en premier (playerInId) → il n'était pas sur le terrain au départ
        let firstSub = playerSubs.first!
        return firstSub.playerOutId == playerId
    }

    /// Calcule le temps de jeu de chaque joueur du roster
    func playerPlayingTimes() -> [PlayerPlayingTime] {
        guard !matchRoster.isEmpty else { return [] }

        // Durée totale de chaque période jouée
        let playedPeriods = MatchPeriod.allCases.filter { periodDurations[$0.rawValue] != nil }

        // Précalculer le statut initial de chaque joueur
        var initiallyOnField: [UUID: Bool] = [:]
        for mp in matchRoster {
            initiallyOnField[mp.id] = wasInitiallyOnField(playerId: mp.id)
        }

        var results: [PlayerPlayingTime] = []

        for mp in matchRoster {
            var totalOnField: TimeInterval = 0

            for period in playedPeriods {
                let periodDuration = periodDurations[period.rawValue] ?? 0

                // Trouver les substitutions qui concernent ce joueur dans cette période
                let subsOut = substitutions.filter { $0.period == period && $0.playerOutId == mp.id }
                let subsIn = substitutions.filter { $0.period == period && $0.playerInId == mp.id }

                // Déterminer si le joueur était sur le terrain au début de cette période
                var wasOnFieldAtStart: Bool
                if period == playedPeriods.first {
                    // Première période : utiliser le statut initial reconstitué
                    wasOnFieldAtStart = initiallyOnField[mp.id] ?? false
                } else {
                    // Périodes suivantes : le joueur est sur le terrain s'il y était à la fin de la période précédente
                    wasOnFieldAtStart = wasPlayerOnFieldAtEndOf(playerId: mp.id, period: previousPeriod(period), playedPeriods: playedPeriods, initiallyOnField: initiallyOnField)
                }

                // Calculer le temps sur le terrain pour cette période
                // Collecter les événements d'entrée/sortie triés par minute
                struct FieldEvent: Comparable {
                    let minute: TimeInterval
                    let isEntering: Bool
                    static func < (lhs: FieldEvent, rhs: FieldEvent) -> Bool {
                        lhs.minute < rhs.minute
                    }
                }

                var events: [FieldEvent] = []
                for s in subsOut {
                    events.append(FieldEvent(minute: s.minute, isEntering: false))
                }
                for s in subsIn {
                    events.append(FieldEvent(minute: s.minute, isEntering: true))
                }
                events.sort()

                // Parcourir les événements pour calculer le temps sur le terrain
                var onField = wasOnFieldAtStart
                var lastChangeMinute: TimeInterval = 0

                for event in events {
                    if onField {
                        totalOnField += event.minute - lastChangeMinute
                    }
                    onField = event.isEntering
                    lastChangeMinute = event.minute
                }

                // Temps restant jusqu'à la fin de la période
                if onField {
                    totalOnField += periodDuration - lastChangeMinute
                }
            }

            // Temps effectif proportionnel
            let effectiveRatio = totalMatchDuration > 0 ? totalEffectivePlayTime / totalMatchDuration : 1.0
            let effectiveTime = totalOnField * effectiveRatio

            let wasInitialTitulaire = initiallyOnField[mp.id] ?? false
            results.append(PlayerPlayingTime(
                playerId: mp.id,
                playerName: mp.fullName.isEmpty ? "Joueur #\(mp.shirtNumber)" : mp.fullName,
                shirtNumber: mp.shirtNumber,
                position: mp.position,
                totalTime: totalOnField,
                effectiveTime: effectiveTime,
                isTitulaire: wasInitialTitulaire
            ))
        }

        return results.sorted { $0.totalTime > $1.totalTime }
    }

    /// Vérifie si un joueur était sur le terrain à la fin d'une période donnée
    func wasPlayerOnFieldAtEndOf(playerId: UUID, period: MatchPeriod, playedPeriods: [MatchPeriod], initiallyOnField: [UUID: Bool]) -> Bool {
        // Déterminer le statut au début de cette période
        var onField: Bool
        if period == playedPeriods.first {
            onField = initiallyOnField[playerId] ?? false
        } else {
            onField = wasPlayerOnFieldAtEndOf(playerId: playerId, period: previousPeriod(period), playedPeriods: playedPeriods, initiallyOnField: initiallyOnField)
        }

        // Appliquer les substitutions de cette période
        let periodSubs = substitutions.filter { $0.period == period }
        for sub in periodSubs.sorted(by: { $0.minute < $1.minute }) {
            if sub.playerOutId == playerId { onField = false }
            if sub.playerInId == playerId { onField = true }
        }

        return onField
    }

    /// Période précédente
    func previousPeriod(_ period: MatchPeriod) -> MatchPeriod {
        switch period {
        case .firstHalf: return .firstHalf
        case .secondHalf: return .firstHalf
        case .extraFirstHalf: return .secondHalf
        case .extraSecondHalf: return .extraFirstHalf
        }
    }
}
