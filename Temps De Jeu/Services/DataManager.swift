//
//  DataManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import Foundation
import Combine

/// Gestionnaire de persistance des matchs
@MainActor
class DataManager {
    static let shared = DataManager()

    /// Clé de stockage préfixée par le profil actif
    private var matchesKey: String {
        "\(ProfileManager.currentStoragePrefix)savedMatches"
    }

    private init() {}

    // MARK: - Sauvegarde / Chargement

    func saveMatch(_ match: Match) {
        var matches = loadMatches()
        // Remplacer si le match existe déjà
        if let index = matches.firstIndex(where: { $0.id == match.id }) {
            matches[index] = match
        } else {
            matches.insert(match, at: 0) // Plus récent en premier
        }
        save(matches)
    }

    func loadMatches() -> [Match] {
        guard let data = UserDefaults.standard.data(forKey: matchesKey) else {
            return []
        }
        do {
            return try JSONDecoder().decode([Match].self, from: data)
        } catch {
            print("Erreur chargement matchs: \(error)")
            return []
        }
    }
    
    // MARK: - Chargement/Sauvegarde pour un profil spécifique
    
    /// Charge les matchs d'un profil donné (sans switcher de profil)
    func loadMatches(forProfileId profileId: UUID) -> [Match] {
        let prefix = "profile_\(profileId.uuidString)_"
        let key = "\(prefix)savedMatches"
        guard let data = UserDefaults.standard.data(forKey: key) else {
            return []
        }
        do {
            return try JSONDecoder().decode([Match].self, from: data)
        } catch {
            print("Erreur chargement matchs profil \(profileId): \(error)")
            return []
        }
    }
    
    /// Sauvegarde un match dans un profil spécifique (sans switcher de profil)
    func saveMatch(_ match: Match, forProfileId profileId: UUID) {
        var matches = loadMatches(forProfileId: profileId)
        if let index = matches.firstIndex(where: { $0.id == match.id }) {
            matches[index] = match
        } else {
            matches.insert(match, at: 0)
        }
        let prefix = "profile_\(profileId.uuidString)_"
        let key = "\(prefix)savedMatches"
        do {
            let data = try JSONEncoder().encode(matches)
            UserDefaults.standard.set(data, forKey: key)
        } catch {
            print("Erreur sauvegarde match profil \(profileId): \(error)")
        }
    }

    func deleteMatch(_ match: Match) {
        var matches = loadMatches()
        matches.removeAll { $0.id == match.id }
        save(matches)
    }

    func deleteAllMatches() {
        save([])
    }

    /// Marque un carton comme purgé (conservé dans les stats et rapports)
    func deleteCard(cardId: UUID, fromMatchId matchId: UUID) {
        var matches = loadMatches()
        guard let idx = matches.firstIndex(where: { $0.id == matchId }) else { return }
        if let cardIdx = matches[idx].cards.firstIndex(where: { $0.id == cardId }) {
            matches[idx].cards[cardIdx].isServed = true
        }
        save(matches)
    }

    private func save(_ matches: [Match]) {
        do {
            let data = try JSONEncoder().encode(matches)
            UserDefaults.standard.set(data, forKey: matchesKey)
        } catch {
            print("Erreur sauvegarde: \(error)")
        }
    }
}
