//
//  TrainingModels.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 10/02/2026.
//

import Foundation

/// Un entraînement avec la liste des présences
struct TrainingSession: Identifiable, Codable, Equatable {
    let id: UUID
    var date: Date
    var notes: String
    var attendances: [PlayerAttendance]
    
    init(id: UUID = UUID(), date: Date = Date(), notes: String = "", attendances: [PlayerAttendance] = []) {
        self.id = id
        self.date = date
        self.notes = notes
        self.attendances = attendances
    }
    
    /// Nombre de joueurs présents
    var presentCount: Int {
        attendances.filter { $0.isPresent }.count
    }
    
    /// Nombre total de joueurs dans l'entraînement
    var totalCount: Int {
        attendances.count
    }
}

/// Présence d'un joueur à un entraînement
struct PlayerAttendance: Identifiable, Codable, Hashable {
    let id: UUID  // Référence au Player.id
    var firstName: String
    var lastName: String
    var isPresent: Bool
    
    init(from player: Player, isPresent: Bool = false) {
        self.id = player.id
        self.firstName = player.firstName
        self.lastName = player.lastName
        self.isPresent = isPresent
    }
    
    init(id: UUID, firstName: String, lastName: String, isPresent: Bool = false) {
        self.id = id
        self.firstName = firstName
        self.lastName = lastName
        self.isPresent = isPresent
    }
    
    var displayName: String {
        if firstName.isEmpty && lastName.isEmpty {
            return "Joueur"
        }
        let first = firstName.prefix(1)
        return lastName.isEmpty ? firstName : "\(first). \(lastName)"
    }
    
    var fullName: String {
        "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    }
}

/// Export des statistiques de présence aux entraînements
struct TrainingAttendanceExport: Codable, Equatable {
    var startDate: Date
    var endDate: Date
    var sessions: [TrainingSession]
    var playerStats: [PlayerAttendanceStats]
    var exportDate: Date
    
    init(startDate: Date, endDate: Date, sessions: [TrainingSession], playerStats: [PlayerAttendanceStats], exportDate: Date = Date()) {
        self.startDate = startDate
        self.endDate = endDate
        self.sessions = sessions
        self.playerStats = playerStats
        self.exportDate = exportDate
    }
}

/// Statistiques de présence d'un joueur
struct PlayerAttendanceStats: Codable, Identifiable, Equatable {
    let playerId: UUID
    var firstName: String
    var lastName: String
    var totalSessions: Int
    var presentSessions: Int
    
    var id: UUID { playerId }
    
    var attendanceRate: Double {
        guard totalSessions > 0 else { return 0 }
        return Double(presentSessions) / Double(totalSessions) * 100
    }
    
    var displayName: String {
        if firstName.isEmpty && lastName.isEmpty {
            return "Joueur"
        }
        let first = firstName.prefix(1)
        return lastName.isEmpty ? firstName : "\(first). \(lastName)"
    }
    
    var fullName: String {
        "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    }
}
