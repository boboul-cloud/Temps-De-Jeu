//
//  PlayerModels.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import Foundation

/// Position d'un joueur
enum PlayerPosition: String, Codable, CaseIterable, Identifiable {
    case gardien = "Gardien"
    case defenseur = "Défenseur"
    case milieu = "Milieu"
    case attaquant = "Attaquant"

    var id: String { rawValue }

    var shortName: String {
        switch self {
        case .gardien: return "G"
        case .defenseur: return "DEF"
        case .milieu: return "MIL"
        case .attaquant: return "ATT"
        }
    }
}

/// Disponibilité d'un joueur (persistant)
enum PlayerAvailability: String, Codable, CaseIterable, Identifiable {
    case disponible = "Disponible"
    case blesse = "Blessé"
    case absent = "Absent"
    case suspendu = "Suspendu"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .disponible: return "checkmark.circle.fill"
        case .blesse: return "cross.case.fill"
        case .absent: return "person.slash.fill"
        case .suspendu: return "exclamationmark.shield.fill"
        }
    }

    var color: String {
        switch self {
        case .disponible: return "green"
        case .blesse: return "red"
        case .absent: return "orange"
        case .suspendu: return "purple"
        }
    }
}

/// Statut d'un joueur pour un match
enum PlayerStatus: String, Codable, CaseIterable {
    case titulaire = "Titulaire"
    case remplacant = "Remplaçant"
    case expulse = "Expulsé"
    case tempExpulse = "Expulsé temp."
}

/// Un joueur de l'effectif (persistant dans l'app)
struct Player: Identifiable, Codable, Hashable {
    let id: UUID
    var firstName: String
    var lastName: String
    var position: PlayerPosition
    var availability: PlayerAvailability
    var photoData: Data?  // Photo du joueur (JPEG compressée)

    init(
        id: UUID = UUID(),
        firstName: String = "",
        lastName: String = "",
        position: PlayerPosition = .milieu,
        availability: PlayerAvailability = .disponible,
        photoData: Data? = nil
    ) {
        self.id = id
        self.firstName = firstName
        self.lastName = lastName
        self.position = position
        self.availability = availability
        self.photoData = photoData
    }

    // Backward compat: ignore defaultNumber if present in saved data
    // + availability optionnel (ancien format sans ce champ)
    // + photoData optionnel (nouveau champ)
    enum CodingKeys: String, CodingKey {
        case id, firstName, lastName, position, availability, photoData
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        firstName = try container.decode(String.self, forKey: .firstName)
        lastName = try container.decode(String.self, forKey: .lastName)
        position = try container.decode(PlayerPosition.self, forKey: .position)
        availability = try container.decodeIfPresent(PlayerAvailability.self, forKey: .availability) ?? .disponible
        photoData = try container.decodeIfPresent(Data.self, forKey: .photoData)
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

/// Sélection d'un joueur pour un match donné
struct MatchPlayer: Identifiable, Codable, Hashable {
    let id: UUID           // Référence au Player.id
    var shirtNumber: Int   // Numéro de maillot pour ce match
    var firstName: String
    var lastName: String
    var position: PlayerPosition
    var status: PlayerStatus

    init(from player: Player, status: PlayerStatus = .remplacant, shirtNumber: Int = 0) {
        self.id = player.id
        self.shirtNumber = shirtNumber
        self.firstName = player.firstName
        self.lastName = player.lastName
        self.position = player.position
        self.status = status
    }

    init(id: UUID = UUID(), shirtNumber: Int = 0, firstName: String = "", lastName: String = "", position: PlayerPosition = .milieu, status: PlayerStatus = .remplacant) {
        self.id = id
        self.shirtNumber = shirtNumber
        self.firstName = firstName
        self.lastName = lastName
        self.position = position
        self.status = status
    }

    var displayName: String {
        if firstName.isEmpty && lastName.isEmpty {
            return "Joueur #\(shirtNumber)"
        }
        let first = firstName.prefix(1)
        return lastName.isEmpty ? firstName : "\(first). \(lastName)"
    }

    var fullName: String {
        "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    }
}

/// Type de carton
enum CardType: String, Codable {
    case yellow = "Jaune"
    case red = "Rouge"
    case secondYellow = "2ème Jaune"
    case white = "Blanc"
}

/// Expulsion temporaire (carton blanc — 10 minutes)
struct TempExpulsion: Identifiable, Codable {
    let id: UUID
    let playerId: UUID?
    let playerName: String
    let cardEventId: UUID           // Référence au CardEvent
    let totalDuration: TimeInterval // 10 min = 600s
    var elapsedAtPause: TimeInterval // Temps déjà purgé au moment d'une pause (mi-temps)
    var isCompleted: Bool
    var startPeriod: MatchPeriod
    var startMinute: TimeInterval   // Minute match au début de l'expulsion

    init(id: UUID = UUID(), playerId: UUID?, playerName: String, cardEventId: UUID, totalDuration: TimeInterval = 600, elapsedAtPause: TimeInterval = 0, isCompleted: Bool = false, startPeriod: MatchPeriod, startMinute: TimeInterval) {
        self.id = id
        self.playerId = playerId
        self.playerName = playerName
        self.cardEventId = cardEventId
        self.totalDuration = totalDuration
        self.elapsedAtPause = elapsedAtPause
        self.isCompleted = isCompleted
        self.startPeriod = startPeriod
        self.startMinute = startMinute
    }
}

/// Export de composition pour système cascade entre équipes A → B → C → D
/// Contient les joueurs sélectionnés, les joueurs restants (disponibles),
/// et l'historique cumulé des joueurs déjà pris par les équipes supérieures.
struct RosterExport: Codable, Equatable {
    /// Nom de l'équipe qui exporte (ex: "Équipe A")
    var teamName: String
    /// Compétition / match concerné
    var competition: String
    /// Date du match
    var matchDate: Date
    /// Joueurs sélectionnés pour cette équipe (info / référence)
    var selectedPlayers: [Player]
    /// Joueurs restants, disponibles pour l'équipe suivante
    var availablePlayers: [Player]
    /// IDs cumulés de tous les joueurs indisponibles (pris par les équipes supérieures)
    /// Effet boule de neige : A exporte ses sélectionnés → B les reçoit indisponibles,
    /// puis B ajoute ses propres sélectionnés et exporte vers C, etc.
    var unavailablePlayerIds: [UUID]
    /// Noms des équipes qui ont déjà sélectionné (pour info)
    var selectionChain: [String]
    /// Version du format
    var formatVersion: Int = 1
}

/// Événement but
struct GoalEvent: Identifiable, Codable {
    let id: UUID
    var isHome: Bool
    var minute: TimeInterval
    var period: MatchPeriod
    var playerName: String
    var timestamp: Date

    init(id: UUID = UUID(), isHome: Bool, minute: TimeInterval, period: MatchPeriod, playerName: String = "", timestamp: Date = Date()) {
        self.id = id
        self.isHome = isHome
        self.minute = minute
        self.period = period
        self.playerName = playerName
        self.timestamp = timestamp
    }
}

/// Événement carton
struct CardEvent: Identifiable, Codable {
    let id: UUID
    var type: CardType
    var playerName: String
    var playerId: UUID?       // Référence au Player.id (optionnel pour compat)
    var minute: TimeInterval
    var period: MatchPeriod
    var timestamp: Date
    var matchId: UUID?        // Référence au Match.id
    var matchLabel: String?   // Ex: "PSG - OM" pour affichage
    var matchDate: Date?      // Date du match
    var isServed: Bool        // Carton purgé (supprimé de la section cartons mais conservé dans stats/rapports)

    init(id: UUID = UUID(), type: CardType, playerName: String, playerId: UUID? = nil, minute: TimeInterval, period: MatchPeriod, timestamp: Date = Date(), matchId: UUID? = nil, matchLabel: String? = nil, matchDate: Date? = nil, isServed: Bool = false) {
        self.id = id
        self.type = type
        self.playerName = playerName
        self.playerId = playerId
        self.minute = minute
        self.period = period
        self.timestamp = timestamp
        self.matchId = matchId
        self.matchLabel = matchLabel
        self.matchDate = matchDate
        self.isServed = isServed
    }

    // Backward compatibility: isServed optionnel (ancien format)
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        type = try container.decode(CardType.self, forKey: .type)
        playerName = try container.decode(String.self, forKey: .playerName)
        playerId = try container.decodeIfPresent(UUID.self, forKey: .playerId)
        minute = try container.decode(TimeInterval.self, forKey: .minute)
        period = try container.decode(MatchPeriod.self, forKey: .period)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        matchId = try container.decodeIfPresent(UUID.self, forKey: .matchId)
        matchLabel = try container.decodeIfPresent(String.self, forKey: .matchLabel)
        matchDate = try container.decodeIfPresent(Date.self, forKey: .matchDate)
        isServed = try container.decodeIfPresent(Bool.self, forKey: .isServed) ?? false
    }
}

/// Événement faute
struct FoulEvent: Identifiable, Codable {
    let id: UUID
    var playerName: String
    var playerId: UUID?
    var minute: TimeInterval
    var period: MatchPeriod
    var timestamp: Date

    init(id: UUID = UUID(), playerName: String, playerId: UUID? = nil, minute: TimeInterval, period: MatchPeriod, timestamp: Date = Date()) {
        self.id = id
        self.playerName = playerName
        self.playerId = playerId
        self.minute = minute
        self.period = period
        self.timestamp = timestamp
    }
}

/// Événement remplacement
struct SubstitutionEvent: Identifiable, Codable {
    let id: UUID
    var playerOut: String
    var playerIn: String
    var playerOutId: UUID?
    var playerInId: UUID?
    var minute: TimeInterval
    var period: MatchPeriod
    var timestamp: Date

    init(id: UUID = UUID(), playerOut: String, playerIn: String, playerOutId: UUID? = nil, playerInId: UUID? = nil, minute: TimeInterval, period: MatchPeriod, timestamp: Date = Date()) {
        self.id = id
        self.playerOut = playerOut
        self.playerIn = playerIn
        self.playerOutId = playerOutId
        self.playerInId = playerInId
        self.minute = minute
        self.period = period
        self.timestamp = timestamp
    }

    // Backward compat
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        playerOut = try container.decode(String.self, forKey: .playerOut)
        playerIn = try container.decode(String.self, forKey: .playerIn)
        playerOutId = try container.decodeIfPresent(UUID.self, forKey: .playerOutId)
        playerInId = try container.decodeIfPresent(UUID.self, forKey: .playerInId)
        minute = try container.decode(TimeInterval.self, forKey: .minute)
        period = try container.decode(MatchPeriod.self, forKey: .period)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
    }
}
