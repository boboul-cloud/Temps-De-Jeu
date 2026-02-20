//
//  SeasonModels.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 13/02/2026.
//

import Foundation

/// Représente une saison sportive
struct Season: Identifiable, Codable {
    let id: UUID
    var clubName: String
    var category: String        // Catégorie d'âge (ex: "U13", "U15", "Seniors")
    var startDate: Date
    var endDate: Date?          // nil = saison en cours
    var isClosed: Bool

    init(id: UUID = UUID(), clubName: String, category: String = "", startDate: Date = Date(), endDate: Date? = nil, isClosed: Bool = false) {
        self.id = id
        self.clubName = clubName
        self.category = category
        self.startDate = startDate
        self.endDate = endDate
        self.isClosed = isClosed
    }

    // Backward compatibility: category optionnel (ancien format)
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        clubName = try container.decode(String.self, forKey: .clubName)
        category = try container.decodeIfPresent(String.self, forKey: .category) ?? ""
        startDate = try container.decode(Date.self, forKey: .startDate)
        endDate = try container.decodeIfPresent(Date.self, forKey: .endDate)
        isClosed = try container.decode(Bool.self, forKey: .isClosed)
    }

    /// Label de la saison (ex: "2025-2026")
    var label: String {
        let cal = Calendar.current
        let startYear = cal.component(.year, from: startDate)
        if let endDate = endDate {
            let endYear = cal.component(.year, from: endDate)
            return startYear == endYear ? "\(startYear)" : "\(startYear)-\(endYear)"
        }
        // Saison en cours : estimer la fin
        let month = cal.component(.month, from: startDate)
        if month >= 7 {
            return "\(startYear)-\(startYear + 1)"
        } else {
            return "\(startYear - 1)-\(startYear)"
        }
    }
}

/// Archive d'une saison clôturée (statistiques sauvegardées)
struct SeasonArchive: Identifiable, Codable {
    let id: UUID           // Même id que la Season
    let season: Season
    let matches: [Match]
    let trainingSessions: [TrainingSession]
    let players: [Player]  // Snapshot de l'effectif à la clôture
}
