//
//  TrainingManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 10/02/2026.
//

import Foundation

/// Gestionnaire des entraînements et présences
@MainActor
class TrainingManager {
    static let shared = TrainingManager()
    
    /// Clé de stockage préfixée par le profil actif
    private var sessionsKey: String {
        "\(ProfileManager.currentStoragePrefix)trainingSessions"
    }
    
    private init() {}
    
    // MARK: - Sessions CRUD
    
    func saveSessions(_ sessions: [TrainingSession]) {
        do {
            let data = try JSONEncoder().encode(sessions)
            UserDefaults.standard.set(data, forKey: sessionsKey)
        } catch {
            print("Erreur sauvegarde entraînements: \(error)")
        }
    }
    
    func loadSessions() -> [TrainingSession] {
        guard let data = UserDefaults.standard.data(forKey: sessionsKey) else { return [] }
        do {
            return try JSONDecoder().decode([TrainingSession].self, from: data)
        } catch {
            print("Erreur chargement entraînements: \(error)")
            return []
        }
    }

    /// Charge les sessions d'un profil spécifique (pas forcément le profil actif)
    func loadSessions(forProfileId profileId: UUID) -> [TrainingSession] {
        let key = "profile_\(profileId.uuidString)_trainingSessions"
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        do {
            return try JSONDecoder().decode([TrainingSession].self, from: data)
        } catch {
            print("Erreur chargement entraînements profil \(profileId): \(error)")
            return []
        }
    }
    
    func addSession(_ session: TrainingSession) {
        var sessions = loadSessions()
        sessions.append(session)
        saveSessions(sessions)
    }
    
    func updateSession(_ session: TrainingSession) {
        var sessions = loadSessions()
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
            saveSessions(sessions)
        }
    }
    
    func deleteSession(_ session: TrainingSession) {
        var sessions = loadSessions()
        sessions.removeAll { $0.id == session.id }
        saveSessions(sessions)
    }
    
    // MARK: - Statistiques
    
    /// Calcule les statistiques de présence pour chaque joueur sur une période
    func calculatePlayerStats(sessions: [TrainingSession]) -> [PlayerAttendanceStats] {
        // Regrouper toutes les présences par joueur
        var playerData: [UUID: (firstName: String, lastName: String, total: Int, present: Int)] = [:]
        
        for session in sessions {
            for attendance in session.attendances {
                if var data = playerData[attendance.id] {
                    data.total += 1
                    if attendance.isPresent {
                        data.present += 1
                    }
                    playerData[attendance.id] = data
                } else {
                    playerData[attendance.id] = (
                        firstName: attendance.firstName,
                        lastName: attendance.lastName,
                        total: 1,
                        present: attendance.isPresent ? 1 : 0
                    )
                }
            }
        }
        
        return playerData.map { (playerId, data) in
            PlayerAttendanceStats(
                playerId: playerId,
                firstName: data.firstName,
                lastName: data.lastName,
                totalSessions: data.total,
                presentSessions: data.present
            )
        }.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
    }
    
    /// Filtre les sessions par période
    func filterSessions(_ sessions: [TrainingSession], from startDate: Date, to endDate: Date) -> [TrainingSession] {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: startDate)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: endDate)) ?? endDate
        
        return sessions.filter { session in
            session.date >= startOfDay && session.date < endOfDay
        }.sorted { $0.date > $1.date }
    }
}
