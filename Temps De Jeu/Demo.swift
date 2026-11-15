//
//  Demo.swift
//  Temps De Jeu
//
//  Arguments de lancement utilisés uniquement par le test des captures App Store
//  (TempsDeJeuUITests/CaptureTests.swift, lancé par tools/captures.sh).
//  Tout ce qui les lit est compilé en Debug seulement : l'archive n'en voit rien.
//
//      -demo match | placement3d | tactique | bibliotheque | joueurs
//
//  Les données de démonstration (catégorie U13 fictive, effectif aux noms
//  inventés) sont écrites dans le simulateur créé pour les captures, puis
//  supprimé avec lui.
//

#if DEBUG
import SwiftUI

enum Demo {
    /// Écran sur lequel l'app s'ouvre
    static let screen = UserDefaults.standard.string(forKey: "demo")

    static var isActive: Bool { screen != nil }

    static let homeTeam = "FC Rivière"
    static let awayTeam = "AS Plateau"
    static let tacticId = "biblio-chevauchement-centre"
    static let tacticStep = 3

    // MARK: Effectif (prénoms et noms inventés)

    private static let squad: [(number: Int, first: String, last: String, position: PlayerPosition, starter: Bool)] = [
        (1, "Hugo", "Garnier", .gardien, true),
        (2, "Léo", "Marchal", .defenseur, true),
        (4, "Nina", "Roussel", .defenseur, true),
        (5, "Sacha", "Lemaire", .defenseur, true),
        (3, "Théo", "Vasseur", .defenseur, true),
        (6, "Inès", "Barbier", .milieu, true),
        (8, "Adam", "Colin", .milieu, true),
        (10, "Lina", "Perrot", .milieu, true),
        (7, "Noah", "Fabre", .attaquant, true),
        (9, "Yanis", "Brunet", .attaquant, true),
        (11, "Jade", "Morel", .attaquant, true),
        (12, "Malo", "Renaud", .defenseur, false),
        (14, "Zoé", "Carré", .milieu, false),
        (15, "Tiago", "Leclerc", .attaquant, false),
        (16, "Rose", "Masson", .gardien, false),
        (13, "Gabin", "Arnaud", .milieu, false),
    ]

    static var players: [Player] {
        squad.map {
            Player(id: UUID.stable(from: "demo-\($0.number)"), firstName: $0.first, lastName: $0.last,
                   position: $0.position, availability: .disponible)
        }
    }

    static var matchRoster: [MatchPlayer] {
        squad.map { entry in
            let player = Player(id: UUID.stable(from: "demo-\(entry.number)"), firstName: entry.first,
                                lastName: entry.last, position: entry.position)
            return MatchPlayer(from: player, status: entry.starter ? .titulaire : .remplacant,
                               shirtNumber: entry.number, isCaptain: entry.number == 10)
        }
    }

    // MARK: Données

    /// Crée la catégorie et son effectif au premier lancement de démonstration
    @MainActor
    static func seedIfNeeded() {
        guard isActive else { return }
        let profiles = ProfileManager.shared
        guard profiles.profiles.isEmpty else { return }
        _ = profiles.createProfile(name: "U13", colorIndex: 0)
        TeamManager.shared.savePlayers(players)
    }

    /// Match en cours : 2e mi-temps non commencée, 1re à la 27e minute, 2-1
    @MainActor
    static func prepareLiveMatch(_ viewModel: MatchViewModel) {
        viewModel.match.homeTeam = homeTeam
        viewModel.match.awayTeam = awayTeam
        viewModel.match.competition = "Championnat U13 – Poule A"
        viewModel.match.isMyTeamHome = true
        viewModel.match.homeJerseyColor = .blue
        viewModel.match.awayJerseyColor = .red
        viewModel.setMatchRoster(matchRoster)
        viewModel.startMatch()
        viewModel.demoAdvance(by: 27 * 60 + 14)
        viewModel.match.stoppages = [
            Stoppage(type: .touche, period: .firstHalf, startTime: 185, endTime: 201, beneficiaryTeam: .home),
            Stoppage(type: .corner, period: .firstHalf, startTime: 412, endTime: 446, beneficiaryTeam: .home),
            Stoppage(type: .coupFranc, period: .firstHalf, startTime: 780, endTime: 812, beneficiaryTeam: .away),
            Stoppage(type: .but, period: .firstHalf, startTime: 905, endTime: 961, beneficiaryTeam: .home),
            Stoppage(type: .touche, period: .firstHalf, startTime: 1210, endTime: 1228, beneficiaryTeam: .away),
            Stoppage(type: .but, period: .firstHalf, startTime: 1402, endTime: 1455, beneficiaryTeam: .away),
            Stoppage(type: .but, period: .firstHalf, startTime: 1530, endTime: 1590, beneficiaryTeam: .home),
        ]
        viewModel.match.goals = [
            GoalEvent(isHome: true, minute: 905, period: .firstHalf, playerName: "Y. Brunet"),
            GoalEvent(isHome: false, minute: 1402, period: .firstHalf, playerName: ""),
            GoalEvent(isHome: true, minute: 1530, period: .firstHalf, playerName: "L. Perrot"),
        ]
        viewModel.match.homeScore = 2
        viewModel.match.awayScore = 1
        viewModel.match.homePasses = 64
        viewModel.match.awayPasses = 41
    }
}
#endif
