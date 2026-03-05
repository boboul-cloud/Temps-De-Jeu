//
//  TrainingModels.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 10/02/2026.
//

import Foundation

/// Réponse de disponibilité d'un joueur (via sondage web)
enum AvailabilityStatus: Int, Codable, CaseIterable, Identifiable {
    case absent = 0
    case present = 1
    case incertain = 2
    
    var id: Int { rawValue }
    
    var label: String {
        switch self {
        case .absent: return "Absent"
        case .present: return "Présent"
        case .incertain: return "Incertain"
        }
    }
    
    var icon: String {
        switch self {
        case .absent: return "xmark.circle.fill"
        case .present: return "checkmark.circle.fill"
        case .incertain: return "questionmark.circle.fill"
        }
    }
    
    var color: String {
        switch self {
        case .absent: return "red"
        case .present: return "green"
        case .incertain: return "orange"
        }
    }
}

/// Réponse individuelle d'un joueur au sondage de disponibilité
struct AvailabilityResponse: Identifiable, Codable, Equatable {
    let id: UUID           // Référence au Player.id
    var playerName: String
    var status: AvailabilityStatus
    var comment: String
    var respondedAt: Date
    
    init(id: UUID, playerName: String, status: AvailabilityStatus, comment: String = "", respondedAt: Date = Date()) {
        self.id = id
        self.playerName = playerName
        self.status = status
        self.comment = comment
        self.respondedAt = respondedAt
    }
}

/// Un entraînement avec la liste des présences
struct TrainingSession: Identifiable, Codable, Equatable {
    let id: UUID
    var date: Date
    var notes: String
    var attendances: [PlayerAttendance]
    var availabilityResponses: [AvailabilityResponse]
    
    init(id: UUID = UUID(), date: Date = Date(), notes: String = "", attendances: [PlayerAttendance] = [], availabilityResponses: [AvailabilityResponse] = []) {
        self.id = id
        self.date = date
        self.notes = notes
        self.attendances = attendances
        self.availabilityResponses = availabilityResponses
    }
    
    // Backward compat: availabilityResponses optionnel
    enum CodingKeys: String, CodingKey {
        case id, date, notes, attendances, availabilityResponses
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        date = try container.decode(Date.self, forKey: .date)
        notes = try container.decode(String.self, forKey: .notes)
        attendances = try container.decode([PlayerAttendance].self, forKey: .attendances)
        availabilityResponses = try container.decodeIfPresent([AvailabilityResponse].self, forKey: .availabilityResponses) ?? []
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
