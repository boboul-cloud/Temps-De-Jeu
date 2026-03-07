//
//  WidgetDataReader.swift
//  TempsDeJeuWidget
//
//  Created by Robert Oulhen on 06/03/2026.
//

import Foundation
import AppIntents

/// Identifiant du groupe d'app partagé
let widgetAppGroupIdentifier = "group.tempsdejeu.shared"

/// Info simplifiée d'un profil depuis l'app principale
struct WidgetProfileInfo: Codable {
    var id: String    // UUID string
    var name: String
    var colorIndex: Int
}

/// Données simplifiées reçues de l'app principale
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

/// Lit la liste des profils disponibles depuis l'App Group
func readWidgetProfiles() -> [WidgetProfileInfo] {
    guard let defaults = UserDefaults(suiteName: widgetAppGroupIdentifier),
          let data = defaults.data(forKey: "widgetProfiles"),
          let profiles = try? JSONDecoder().decode([WidgetProfileInfo].self, from: data)
    else { return [] }
    return profiles
}

/// Lit les données du widget pour un profil donné
func readWidgetData(forProfileId profileId: String? = nil) -> WidgetData {
    guard let defaults = UserDefaults(suiteName: widgetAppGroupIdentifier) else {
        return .empty
    }

    // Si un profil est spécifié, lire ses données dédiées
    let key: String
    if let pid = profileId, !pid.isEmpty {
        key = "widgetData_\(pid)"
    } else {
        key = WidgetData.storageKey
    }

    guard let data = defaults.data(forKey: key),
          let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data)
    else {
        return .empty
    }
    return widgetData
}

// MARK: - AppIntent pour la sélection de profil

/// Entité représentant un profil d'équipe dans le widget
struct TeamProfileEntity: AppEntity {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Catégorie")
    static var defaultQuery = TeamProfileQuery()

    var id: String
    var name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

/// Query pour fournir les profils disponibles
struct TeamProfileQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [TeamProfileEntity] {
        let profiles = readWidgetProfiles()
        return identifiers.compactMap { id in
            guard let profile = profiles.first(where: { $0.id == id }) else { return nil }
            return TeamProfileEntity(id: profile.id, name: profile.name)
        }
    }

    func suggestedEntities() async throws -> [TeamProfileEntity] {
        readWidgetProfiles().map {
            TeamProfileEntity(id: $0.id, name: $0.name)
        }
    }

    func defaultResult() async -> TeamProfileEntity? {
        guard let defaults = UserDefaults(suiteName: widgetAppGroupIdentifier),
              let activeId = defaults.string(forKey: "widgetActiveProfileId"),
              let profiles = try? JSONDecoder().decode([WidgetProfileInfo].self, from: defaults.data(forKey: "widgetProfiles") ?? Data())
        else { return nil }
        guard let active = profiles.first(where: { $0.id == activeId }) else {
            return profiles.first.map { TeamProfileEntity(id: $0.id, name: $0.name) }
        }
        return TeamProfileEntity(id: active.id, name: active.name)
    }
}

/// Intent de configuration du widget
struct SelectProfileIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choisir la catégorie"
    static var description = IntentDescription("Sélectionnez la catégorie d'équipe à afficher.")

    @Parameter(title: "Catégorie")
    var profile: TeamProfileEntity?
}
