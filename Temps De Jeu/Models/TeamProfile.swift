//
//  TeamProfile.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 15/02/2026.
//

import Foundation

/// Profil d'équipe — chaque profil a ses propres matchs, entraînements et saison
/// mais partage la base globale de joueurs
struct TeamProfile: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String            // Ex: "U13", "U15 Féminine", "Seniors"
    var colorIndex: Int         // Index couleur pour l'affichage (0-7)
    var playerIds: Set<UUID>    // Joueurs assignés à ce profil (refs vers Player.id)
    var teamCode: String        // Code unique partageable (ex: "A3K9F2") pour identifier l'équipe entre appareils

    init(id: UUID = UUID(), name: String, colorIndex: Int = 0, playerIds: Set<UUID> = [], teamCode: String = "") {
        self.id = id
        self.name = name
        self.colorIndex = colorIndex
        self.playerIds = playerIds
        self.teamCode = teamCode
    }

    // Backward compat: teamCode optionnel dans les données sauvegardées
    enum CodingKeys: String, CodingKey {
        case id, name, colorIndex, playerIds, teamCode
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        colorIndex = try container.decode(Int.self, forKey: .colorIndex)
        playerIds = try container.decode(Set<UUID>.self, forKey: .playerIds)
        teamCode = try container.decodeIfPresent(String.self, forKey: .teamCode) ?? ""
    }

    /// Génère un code court de 6 caractères alphanumériques majuscules
    static func generateCode() -> String {
        let chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // sans I/O/0/1 pour éviter la confusion
        return String((0..<6).map { _ in chars.randomElement()! })
    }

    /// Couleurs disponibles pour les profils
    static let availableColors: [(name: String, index: Int)] = [
        ("Vert", 0),
        ("Bleu", 1),
        ("Orange", 2),
        ("Rouge", 3),
        ("Violet", 4),
        ("Rose", 5),
        ("Jaune", 6),
        ("Cyan", 7)
    ]
}
