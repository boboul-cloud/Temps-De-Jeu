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
    var startDate: Date
    var endDate: Date?          // nil = saison en cours
    var isClosed: Bool

    init(id: UUID = UUID(), clubName: String, startDate: Date = Date(), endDate: Date? = nil, isClosed: Bool = false) {
        self.id = id
        self.clubName = clubName
        self.startDate = startDate
        self.endDate = endDate
        self.isClosed = isClosed
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
