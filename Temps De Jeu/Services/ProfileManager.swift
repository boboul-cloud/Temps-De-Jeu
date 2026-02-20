//
//  ProfileManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 15/02/2026.
//

import Foundation
import Combine
import SwiftUI

/// Gestionnaire des profils d'équipe
/// Chaque profil isole ses matchs, entraînements et saison
/// tout en partageant la base globale de joueurs (TeamManager)
@MainActor
class ProfileManager: ObservableObject {
    static let shared = ProfileManager()

    private let profilesKey = "teamProfiles"
    private let activeProfileIdKey = "activeProfileId"
    private let migrationDoneKey = "profileMigrationDone"

    @Published var profiles: [TeamProfile] = []
    @Published var activeProfileId: UUID?

    /// Profil actif courant
    var activeProfile: TeamProfile? {
        profiles.first(where: { $0.id == activeProfileId })
    }

    /// Préfixe de stockage pour le profil actif
    /// Utilisé par DataManager, SeasonManager, TrainingManager pour isoler les données
    var storagePrefix: String {
        Self.currentStoragePrefix
    }

    /// Préfixe statique — lit directement depuis UserDefaults sans passer par .shared
    /// Évite les deadlocks d'initialisation circulaire entre singletons
    static var currentStoragePrefix: String {
        guard let str = UserDefaults.standard.string(forKey: "activeProfileId"),
              let id = UUID(uuidString: str) else { return "" }
        return "profile_\(id.uuidString)_"
    }

    /// Couleur SwiftUI du profil actif
    var activeProfileColor: Color {
        guard let profile = activeProfile else { return .green }
        return Self.color(for: profile.colorIndex)
    }

    private init() {
        profiles = loadProfiles()
        activeProfileId = loadActiveProfileId()
        migrateIfNeeded()
    }

    // MARK: - Couleurs

    static func color(for index: Int) -> Color {
        switch index {
        case 0: return .green
        case 1: return .blue
        case 2: return .orange
        case 3: return .red
        case 4: return .purple
        case 5: return .pink
        case 6: return .yellow
        case 7: return .cyan
        default: return .green
        }
    }

    // MARK: - CRUD Profils

    /// Crée un nouveau profil
    func createProfile(name: String, colorIndex: Int = 0, playerIds: Set<UUID> = [], teamCode: String = "") -> TeamProfile {
        let profile = TeamProfile(name: name, colorIndex: colorIndex, playerIds: playerIds, teamCode: teamCode)
        profiles.append(profile)
        saveProfiles()

        // Si c'est le premier profil, l'activer automatiquement
        if profiles.count == 1 {
            switchToProfile(profile.id)
        }

        return profile
    }

    /// Met à jour un profil
    func updateProfile(_ profile: TeamProfile) {
        if let idx = profiles.firstIndex(where: { $0.id == profile.id }) {
            profiles[idx] = profile
            saveProfiles()
        }
    }

    /// Supprime un profil et ses données associées
    func deleteProfile(_ profileId: UUID) {
        // Supprimer les données stockées pour ce profil
        let prefix = "profile_\(profileId.uuidString)_"
        let keysToRemove = [
            "\(prefix)savedMatches",
            "\(prefix)trainingSessions",
            "\(prefix)currentSeason",
            "\(prefix)seasonArchives",
            "\(prefix)matchSetupDraft"
        ]
        for key in keysToRemove {
            UserDefaults.standard.removeObject(forKey: key)
        }

        profiles.removeAll { $0.id == profileId }
        saveProfiles()

        // Si le profil supprimé était actif, basculer sur le premier disponible
        if activeProfileId == profileId {
            activeProfileId = profiles.first?.id
            saveActiveProfileId()
            notifyProfileChange()
        }
    }

    /// Change le profil actif
    func switchToProfile(_ profileId: UUID) {
        guard profiles.contains(where: { $0.id == profileId }) else { return }
        activeProfileId = profileId
        saveActiveProfileId()
        notifyProfileChange()
    }

    /// Ajoute un joueur au profil actif
    func addPlayerToActiveProfile(_ playerId: UUID) {
        guard var profile = activeProfile else { return }
        profile.playerIds.insert(playerId)
        updateProfile(profile)
    }

    /// Retire un joueur du profil actif (ne supprime pas le joueur globalement)
    func removePlayerFromActiveProfile(_ playerId: UUID) {
        guard var profile = activeProfile else { return }
        profile.playerIds.remove(playerId)
        updateProfile(profile)
    }

    /// Ajoute un joueur à un profil spécifique
    func addPlayer(_ playerId: UUID, toProfile profileId: UUID) {
        if let idx = profiles.firstIndex(where: { $0.id == profileId }) {
            profiles[idx].playerIds.insert(playerId)
            saveProfiles()
        }
    }

    // MARK: - Migration

    /// Migre les données existantes vers un profil par défaut (premier lancement avec profils)
    private func migrateIfNeeded() {
        guard !UserDefaults.standard.bool(forKey: migrationDoneKey) else { return }

        // Vérifier s'il y a des données existantes
        let hasPlayers = UserDefaults.standard.data(forKey: "teamPlayers") != nil
        let hasMatches = UserDefaults.standard.data(forKey: "savedMatches") != nil
        let hasSessions = UserDefaults.standard.data(forKey: "trainingSessions") != nil
        let hasSeason = UserDefaults.standard.data(forKey: "currentSeason") != nil

        if hasPlayers || hasMatches || hasSessions || hasSeason {
            // Créer un profil par défaut avec les données existantes
            let existingPlayerIds: Set<UUID>
            if let data = UserDefaults.standard.data(forKey: "teamPlayers"),
               let players = try? JSONDecoder().decode([Player].self, from: data) {
                existingPlayerIds = Set(players.map { $0.id })
            } else {
                existingPlayerIds = []
            }

            // Déterminer le nom du profil depuis la saison existante
            var profileName = "Ma catégorie"
            if let seasonData = UserDefaults.standard.data(forKey: "currentSeason"),
               let season = try? JSONDecoder().decode(Season.self, from: seasonData) {
                if !season.category.isEmpty {
                    profileName = season.category
                }
            }

            let profile = TeamProfile(name: profileName, colorIndex: 0, playerIds: existingPlayerIds)
            profiles = [profile]
            activeProfileId = profile.id
            saveProfiles()
            saveActiveProfileId()

            // Copier les données existantes vers les clés préfixées
            let prefix = "profile_\(profile.id.uuidString)_"
            let keysToCopy = ["savedMatches", "trainingSessions", "currentSeason", "seasonArchives", "matchSetupDraft"]
            for key in keysToCopy {
                if let data = UserDefaults.standard.data(forKey: key) {
                    UserDefaults.standard.set(data, forKey: "\(prefix)\(key)")
                }
            }

            // Supprimer les anciennes clés (sauf teamPlayers qui est global)
            for key in keysToCopy {
                UserDefaults.standard.removeObject(forKey: key)
            }

            // Ne PAS appeler notifyProfileChange() ici :
            // SeasonManager n'est pas encore initialisé et y accéder
            // provoquerait un deadlock circulaire.
            // SeasonManager.init() lira les bonnes clés grâce à currentStoragePrefix.
        }

        UserDefaults.standard.set(true, forKey: migrationDoneKey)
    }

    // MARK: - Notification de changement

    /// Notifie les managers qu'il faut recharger les données du nouveau profil
    private func notifyProfileChange() {
        // SeasonManager doit recharger la saison du profil actif
        SeasonManager.shared.reloadForCurrentProfile()
    }

    // MARK: - Persistance

    private func loadProfiles() -> [TeamProfile] {
        guard let data = UserDefaults.standard.data(forKey: profilesKey) else { return [] }
        return (try? JSONDecoder().decode([TeamProfile].self, from: data)) ?? []
    }

    private func loadActiveProfileId() -> UUID? {
        guard let str = UserDefaults.standard.string(forKey: activeProfileIdKey) else { return nil }
        return UUID(uuidString: str)
    }

    private func saveProfiles() {
        if let data = try? JSONEncoder().encode(profiles) {
            UserDefaults.standard.set(data, forKey: profilesKey)
        }
    }

    private func saveActiveProfileId() {
        UserDefaults.standard.set(activeProfileId?.uuidString, forKey: activeProfileIdKey)
    }
}
