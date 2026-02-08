//
//  TeamManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import Foundation

/// Gestionnaire de l'effectif de mon équipe
class TeamManager {
    static let shared = TeamManager()

    private let playersKey = "teamPlayers"

    private init() {}

    func savePlayers(_ players: [Player]) {
        do {
            let data = try JSONEncoder().encode(players)
            UserDefaults.standard.set(data, forKey: playersKey)
        } catch {
            print("Erreur sauvegarde joueurs: \(error)")
        }
    }

    func loadPlayers() -> [Player] {
        guard let data = UserDefaults.standard.data(forKey: playersKey) else { return [] }
        do {
            return try JSONDecoder().decode([Player].self, from: data)
        } catch {
            print("Erreur chargement joueurs: \(error)")
            return []
        }
    }
}
