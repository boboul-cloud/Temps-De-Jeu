//
//  TrainingPlanModels.swift
//  Temps De Jeu
//
//  Atelier : séance d'entraînement = enchaînement d'exercices minutés,
//  matériel total, équipes (chasubles) faites avec les joueurs présents.
//

import Foundation

struct TrainingPlan: Codable, Identifiable, Hashable {
    struct Item: Codable, Identifiable, Hashable {
        var id: UUID = UUID()
        var tacticId: UUID
        var minutes: Int
        var note: String = ""

        private enum CodingKeys: String, CodingKey {
            case id, tacticId = "exercice", minutes, note
        }

        init(tacticId: UUID, minutes: Int, note: String = "") {
            self.tacticId = tacticId
            self.minutes = minutes
            self.note = note
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = (try? c.decode(UUID.self, forKey: .id)) ?? UUID()
            tacticId = try c.decode(UUID.self, forKey: .tacticId)
            minutes = (try? c.decode(Int.self, forKey: .minutes)) ?? 15
            note = (try? c.decode(String.self, forKey: .note)) ?? ""
        }
    }

    /// Une équipe de la séance : couleur de chasuble et joueurs
    struct Team: Codable, Hashable, Identifiable {
        var color: AtelierColor
        var players: [String]
        var id: String { color.rawValue }
    }

    var id: UUID = UUID()
    var title: String
    var date: Date?
    /// Thème, remarques
    var notes: String = ""
    var items: [Item] = []
    /// Ateliers montés en même temps : le matériel s'additionne
    var simultaneous: Bool = false
    var teams: [Team] = []
    var createdAt: Date = Date()

    private enum CodingKeys: String, CodingKey {
        case id, title = "titre", date, notes, items = "exercices", simultaneous = "simultane", teams = "equipes"
        case createdAt = "creeLe"
    }

    init(title: String, date: Date? = nil) {
        self.title = title
        self.date = date
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(UUID.self, forKey: .id)) ?? UUID()
        title = (try? c.decode(String.self, forKey: .title)) ?? "Séance"
        date = try? c.decodeIfPresent(Date.self, forKey: .date)
        notes = (try? c.decode(String.self, forKey: .notes)) ?? ""
        items = (try? c.decode([Item].self, forKey: .items)) ?? []
        simultaneous = (try? c.decode(Bool.self, forKey: .simultaneous)) ?? false
        teams = (try? c.decode([Team].self, forKey: .teams)) ?? []
        createdAt = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
    }

    var totalMinutes: Int { items.reduce(0) { $0 + $1.minutes } }

    /// Matériel de la séance : le plus gourmand des exercices, ou la somme si montés en même temps
    func equipment(_ plays: [TacticPlay]) -> [EquipmentLine] {
        EquipmentLine.combine(plays.map(\.equipmentLines), simultaneous: simultaneous)
    }

    /// Couleurs des équipes dans les exercices : celles portées par au moins 3 joueurs
    /// (2 jokers ne font pas une équipe), sinon les 2 plus portées
    static func bibColors(_ plays: [TacticPlay]) -> [AtelierColor] {
        var best: [AtelierColor: Int] = [:]
        for play in plays {
            var counts: [AtelierColor: Int] = [:]
            for actor in play.actors where !actor.isGoalkeeper { counts[actor.bibColor, default: 0] += 1 }
            for (color, n) in counts { best[color] = max(best[color] ?? 0, n) }
        }
        let ranked = best.sorted { $0.value == $1.value
            ? (AtelierColor.allCases.firstIndex(of: $0.key) ?? 0) < (AtelierColor.allCases.firstIndex(of: $1.key) ?? 0)
            : $0.value > $1.value }
        let teams = ranked.filter { $0.value >= 3 }.map(\.key)
        return teams.count >= 2 ? teams : Array(ranked.prefix(2).map(\.key))
    }
}

// MARK: - Composition des équipes

enum TeamBuilder {
    struct Candidate: Hashable {
        var name: String
        var position: PlayerPosition
    }

    /// Répartit les joueurs en équipes équilibrées : un gardien par équipe d'abord,
    /// puis les défenseurs, les milieux et les attaquants à tour de rôle.
    static func make(_ players: [Candidate], colors: [AtelierColor]) -> [TrainingPlan.Team] {
        guard !colors.isEmpty else { return [] }
        var teams = colors.map { TrainingPlan.Team(color: $0, players: []) }
        let order: [PlayerPosition] = [.gardien, .defenseur, .milieu, .attaquant]
        for position in order {
            for player in players.filter({ $0.position == position }).shuffled() {
                // L'équipe la moins nombreuse reçoit le joueur (à égalité : la première)
                let target = teams.indices.min { a, b in
                    let ca = teams[a].players.count, cb = teams[b].players.count
                    return ca == cb ? a < b : ca < cb
                } ?? 0
                teams[target].players.append(player.name)
            }
            // Après chaque poste, on fait tourner l'ordre pour ne pas toujours favoriser la première équipe
            teams.rotate()
        }
        return colors.compactMap { color in teams.first { $0.color == color } }
    }

    static func shareText(_ teams: [TrainingPlan.Team], title: String) -> String {
        var lines = ["⚽️ \(title) — les équipes"]
        for team in teams {
            lines.append("")
            lines.append("Chasubles \(team.color.adjective(feminine: true, plural: true)) (\(team.players.count)) :")
            lines.append(team.players.joined(separator: ", "))
        }
        return lines.joined(separator: "\n")
    }
}

private extension Array {
    mutating func rotate() {
        guard count > 1 else { return }
        append(removeFirst())
    }
}
