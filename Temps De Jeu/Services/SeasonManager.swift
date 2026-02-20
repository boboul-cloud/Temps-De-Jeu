//
//  SeasonManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 13/02/2026.
//

import Foundation
import Combine

/// Gestionnaire des saisons
@MainActor
class SeasonManager: ObservableObject {
    static let shared = SeasonManager()

    /// Clés de stockage préfixées par le profil actif
    /// Utilise la méthode statique pour éviter un deadlock d'initialisation circulaire
    private var currentSeasonKey: String {
        "\(ProfileManager.currentStoragePrefix)currentSeason"
    }
    private var archivesKey: String {
        "\(ProfileManager.currentStoragePrefix)seasonArchives"
    }

    @Published var currentSeason: Season?

    private init() {
        currentSeason = loadCurrentSeason()
    }

    /// Recharge la saison pour le profil actif (appelé lors du changement de profil)
    func reloadForCurrentProfile() {
        currentSeason = loadCurrentSeason()
    }

    // MARK: - Saison courante

    /// Crée une nouvelle saison
    func createSeason(clubName: String, category: String = "", startDate: Date) {
        let season = Season(clubName: clubName, category: category, startDate: startDate)
        currentSeason = season
        saveCurrentSeason(season)
    }

    /// Clôture la saison en cours : archive les données et remet à zéro
    func closeSeason() -> Bool {
        guard var season = currentSeason else { return false }

        // Marquer la saison comme clôturée
        season.endDate = Date()
        season.isClosed = true

        // Archiver les données actuelles
        let archive = SeasonArchive(
            id: season.id,
            season: season,
            matches: DataManager.shared.loadMatches(),
            trainingSessions: TrainingManager.shared.loadSessions(),
            players: TeamManager.shared.loadPlayers()
        )
        saveArchive(archive)

        // Effacer les données de la saison (matchs + entraînements + cartons purgés)
        DataManager.shared.deleteAllMatches()
        TrainingManager.shared.saveSessions([])

        // Remettre tous les joueurs disponibles (plus de suspensions)
        var players = TeamManager.shared.loadPlayers()
        for i in players.indices {
            if players[i].availability == .suspendu {
                players[i].availability = .disponible
            }
        }
        TeamManager.shared.savePlayers(players)

        // Supprimer la saison courante
        currentSeason = nil
        UserDefaults.standard.removeObject(forKey: currentSeasonKey)

        return true
    }

    // MARK: - Archives

    func loadArchives() -> [SeasonArchive] {
        guard let data = UserDefaults.standard.data(forKey: archivesKey) else { return [] }
        do {
            return try JSONDecoder().decode([SeasonArchive].self, from: data).sorted { $0.season.startDate > $1.season.startDate }
        } catch {
            print("Erreur chargement archives saisons: \(error)")
            return []
        }
    }

    func deleteArchive(_ archive: SeasonArchive) {
        var archives = loadArchives()
        archives.removeAll { $0.id == archive.id }
        saveArchives(archives)
    }

    // MARK: - Persistance

    private func loadCurrentSeason() -> Season? {
        guard let data = UserDefaults.standard.data(forKey: currentSeasonKey) else { return nil }
        return try? JSONDecoder().decode(Season.self, from: data)
    }

    private func saveCurrentSeason(_ season: Season) {
        if let data = try? JSONEncoder().encode(season) {
            UserDefaults.standard.set(data, forKey: currentSeasonKey)
        }
    }

    private func saveArchive(_ archive: SeasonArchive) {
        var archives = loadArchives()
        archives.append(archive)
        saveArchives(archives)
    }

    private func saveArchives(_ archives: [SeasonArchive]) {
        if let data = try? JSONEncoder().encode(archives) {
            UserDefaults.standard.set(data, forKey: archivesKey)
        }
    }
}
