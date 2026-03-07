//
//  WidgetDataBridge.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/03/2026.
//

import Foundation
import WidgetKit

/// Identifiant du groupe d'app pour partager les données avec le widget
let appGroupIdentifier = "group.tempsdejeu.shared"

/// Info simplifiée d'un profil pour le widget
struct WidgetProfileInfo: Codable {
    var id: String    // UUID string
    var name: String
    var colorIndex: Int
}

/// Données simplifiées partagées avec le widget
struct WidgetData: Codable {
    var teamName: String
    var seasonCategory: String?
    var nextMatchDate: Date?
    var nextMatchOpponent: String?
    var nextMatchCompetition: String?
    var nextMatchIsHome: Bool?
    var nextTrainingDate: Date?
    var nextTrainingResponseCount: Int?
    var nextTrainingPlayerCount: Int?
    var matchesPlayed: Int
    var lastUpdated: Date

    static let storageKey = "widgetData"
    static let empty = WidgetData(
        teamName: "Temps De Jeu",
        matchesPlayed: 0,
        lastUpdated: Date()
    )
}

/// Pont de données entre l'app principale et le widget
/// Écrit les données simplifiées dans le UserDefaults partagé (App Group)
@MainActor
class WidgetDataBridge {
    static let shared = WidgetDataBridge()

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupIdentifier) ?? UserDefaults.standard
    }

    private init() {}

    /// Met à jour les données du widget et force un rafraîchissement
    func updateWidgetData() {
        // Écrire la liste des profils disponibles
        writeProfilesList()
        // Écrire les données du profil actif (clé par défaut)
        let data = buildWidgetData(forProfileId: ProfileManager.shared.activeProfileId)
        writeToSharedContainer(data, key: WidgetData.storageKey)
        // Écrire aussi les données de chaque profil individuellement
        for profile in ProfileManager.shared.profiles {
            let profileData = buildWidgetData(forProfileId: profile.id)
            writeToSharedContainer(profileData, key: "widgetData_\(profile.id.uuidString)")
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Écrit la liste des profils dans l'App Group
    private func writeProfilesList() {
        let profiles = ProfileManager.shared.profiles.map {
            WidgetProfileInfo(id: $0.id.uuidString, name: $0.name, colorIndex: $0.colorIndex)
        }
        guard let defaults = sharedDefaults else { return }
        if let data = try? JSONEncoder().encode(profiles) {
            defaults.set(data, forKey: "widgetProfiles")
        }
        // Sauvegarder l'ID du profil actif
        if let activeId = ProfileManager.shared.activeProfileId {
            defaults.set(activeId.uuidString, forKey: "widgetActiveProfileId")
        }
    }

    /// Construit les données widget pour un profil donné
    private func buildWidgetData(forProfileId profileId: UUID?) -> WidgetData {
        let profile = ProfileManager.shared.profiles.first(where: { $0.id == profileId })
        let profileName = profile?.name ?? "Mon équipe"

        // Charger la saison du profil
        let prefix = profileId.map { "profile_\($0.uuidString)_" } ?? ""
        let seasonCategory: String? = {
            guard let data = UserDefaults.standard.data(forKey: "\(prefix)currentSeason") else { return nil }
            // Décoder juste la catégorie depuis la saison
            struct SeasonCategoryOnly: Codable { var category: String? }
            return (try? JSONDecoder().decode(SeasonCategoryOnly.self, from: data))?.category
        }()

        // Prochain match : matchs non terminés, triés par date future
        let allMatches: [Match]
        if let pid = profileId {
            allMatches = DataManager.shared.loadMatches(forProfileId: pid)
        } else {
            allMatches = DataManager.shared.loadMatches()
        }
        let now = Date()
        let startOfDay = Calendar.current.startOfDay(for: now)
        var nextMatch = allMatches
            .filter { !$0.isFinished && $0.date >= startOfDay }
            .sorted { $0.date < $1.date }
            .first

        // Vérifier aussi le brouillon de match en cours de configuration
        // Charger le brouillon du profil demandé (pas forcément le profil actif)
        if let pid = profileId {
            let draftKey = "profile_\(pid.uuidString)_matchSetupDraft"
            if let draftData = UserDefaults.standard.data(forKey: draftKey),
               let draft = try? JSONDecoder().decode(MatchSetupDraft.self, from: draftData) {
                let draftMatch = draft.match
                let hasOpponent = draftMatch.isMyTeamHome
                    ? !draftMatch.awayTeam.trimmingCharacters(in: .whitespaces).isEmpty
                    : !draftMatch.homeTeam.trimmingCharacters(in: .whitespaces).isEmpty
                if hasOpponent && !draftMatch.isFinished && draftMatch.date >= startOfDay {
                    if nextMatch == nil || draftMatch.date < nextMatch!.date {
                        nextMatch = draftMatch
                    }
                }
            }
        }

        let matchesPlayed = allMatches.filter { $0.isFinished }.count

        // Prochain entraînement
        let sessions: [TrainingSession]
        if let pid = profileId {
            sessions = TrainingManager.shared.loadSessions(forProfileId: pid)
        } else {
            sessions = TrainingManager.shared.loadSessions()
        }
        let nextTraining = sessions
            .filter { $0.date >= startOfDay }
            .sorted { $0.date < $1.date }
            .first

        // Nombre de joueurs réel du profil (pas seulement ceux dans la session)
        let playerCount: Int
        if let pid = profileId,
           let prof = ProfileManager.shared.profiles.first(where: { $0.id == pid }) {
            playerCount = prof.playerIds.count
        } else {
            playerCount = TeamManager.shared.loadPlayers().count
        }

        return WidgetData(
            teamName: profileName,
            seasonCategory: seasonCategory,
            nextMatchDate: nextMatch?.date,
            nextMatchOpponent: nextMatch.map { $0.isMyTeamHome ? $0.awayTeam : $0.homeTeam },
            nextMatchCompetition: nextMatch?.competition,
            nextMatchIsHome: nextMatch?.isMyTeamHome,
            nextTrainingDate: nextTraining?.date,
            nextTrainingResponseCount: nextTraining?.availabilityResponses.count,
            nextTrainingPlayerCount: nextTraining != nil ? playerCount : nil,
            matchesPlayed: matchesPlayed,
            lastUpdated: Date()
        )
    }

    /// Écrit les données dans le conteneur partagé
    private func writeToSharedContainer(_ widgetData: WidgetData, key: String = WidgetData.storageKey) {
        guard let defaults = sharedDefaults else {
            print("[Widget] Impossible d'accéder au conteneur partagé App Group")
            return
        }

        do {
            let data = try JSONEncoder().encode(widgetData)
            defaults.set(data, forKey: key)
        } catch {
            print("[Widget] Erreur encodage: \(error)")
        }
    }

    /// Lit les données du widget depuis le conteneur partagé (utilisé par le widget)
    static func readWidgetData() -> WidgetData {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier),
              let data = defaults.data(forKey: WidgetData.storageKey),
              let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data)
        else {
            return .empty
        }
        return widgetData
    }
}
