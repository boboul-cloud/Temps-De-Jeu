//
//  TeamManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import Foundation

/// Gestionnaire de l'effectif global — partagé entre tous les profils d'équipe
/// Les joueurs sont stockés globalement, chaque profil référence ses joueurs par ID
@MainActor
class TeamManager {
    static let shared = TeamManager()

    private let playersKey = "teamPlayers"

    private init() {}

    // MARK: - Chargement

    /// Charge tous les joueurs (base globale)
    func loadAllPlayers() -> [Player] {
        guard let data = UserDefaults.standard.data(forKey: playersKey) else { return [] }
        do {
            return try JSONDecoder().decode([Player].self, from: data)
        } catch {
            print("Erreur chargement joueurs: \(error)")
            return []
        }
    }

    /// Charge les joueurs du profil actif (filtrés par le profil)
    /// Si aucun profil n'est actif, retourne tous les joueurs
    func loadPlayers() -> [Player] {
        let all = loadAllPlayers()
        guard let profile = ProfileManager.shared.activeProfile else { return all }
        return all.filter { profile.playerIds.contains($0.id) }
    }

    // MARK: - Sauvegarde

    /// Sauvegarde les joueurs dans la base globale
    /// Si un profil est actif, met à jour les joueurs du profil (merge intelligent) :
    /// - Les joueurs modifiés sont mis à jour
    /// - Les nouveaux joueurs sont ajoutés globalement ET au profil actif
    /// - Les joueurs retirés de la liste sont retirés du profil (mais restent dans la base globale)
    func savePlayers(_ players: [Player]) {
        guard let profile = ProfileManager.shared.activeProfile else {
            // Pas de profil : sauvegarde directe (compatibilité)
            saveToStorage(players)
            return
        }

        var allPlayers = loadAllPlayers()
        let submittedIds = Set(players.map { $0.id })

        // Mettre à jour ou ajouter les joueurs soumis
        for player in players {
            if let idx = allPlayers.firstIndex(where: { $0.id == player.id }) {
                allPlayers[idx] = player
            } else {
                allPlayers.append(player)
            }
        }

        // Mettre à jour l'assignation du profil
        var updatedProfile = profile
        updatedProfile.playerIds = submittedIds
        ProfileManager.shared.updateProfile(updatedProfile)

        saveToStorage(allPlayers)
    }

    /// Supprime définitivement un joueur de la base globale et de tous les profils
    func deletePlayerGlobally(_ playerId: UUID) {
        var allPlayers = loadAllPlayers()
        allPlayers.removeAll { $0.id == playerId }
        saveToStorage(allPlayers)

        // Retirer de tous les profils
        for var profile in ProfileManager.shared.profiles {
            if profile.playerIds.contains(playerId) {
                profile.playerIds.remove(playerId)
                ProfileManager.shared.updateProfile(profile)
            }
        }
    }

    // MARK: - Stockage interne

    /// Sauvegarde les joueurs dans le stockage global SANS modifier aucun profil
    /// À utiliser quand le code appelant gère lui-même le profil (ex: import inter-catégories)
    func saveToGlobalStorage(_ players: [Player]) {
        do {
            let data = try JSONEncoder().encode(players)
            UserDefaults.standard.set(data, forKey: playersKey)
        } catch {
            print("Erreur sauvegarde joueurs: \(error)")
        }
    }

    private func saveToStorage(_ players: [Player]) {
        do {
            let data = try JSONEncoder().encode(players)
            UserDefaults.standard.set(data, forKey: playersKey)
        } catch {
            print("Erreur sauvegarde joueurs: \(error)")
        }
    }
}
