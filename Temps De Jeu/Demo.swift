//
//  Demo.swift
//  Temps De Jeu
//
//  Arguments de lancement utilisés uniquement par le test des captures App Store
//  (TempsDeJeuUITests/CaptureTests.swift, lancé par tools/captures.sh).
//  Tout ce qui les lit est compilé en Debug seulement : l'archive n'en voit rien.
//
//      -demo match | placement3d | placement8 | sequence | tactique | bibliotheque | joueurs | seance
//            | atelier | atelier-accueil | atelier-cinema | atelier-seance
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

    // MARK: Atelier

    /// Exercice d'exemple : 4 contre 4 + 2 jokers, trois étapes et une évolution
    @MainActor
    static func atelierExercise() -> TacticPlay {
        let model = AtelierEditorModel(play: AtelierEditorModel.newExercise())
        model.bibColor = .rouge
        model.apply(.game(perSide: 4, jokers: 2))
        let ids = model.content.actors.map(\.id)
        func pos(_ id: String) -> TacticPoint { model.frames[model.vignette].positions[id] ?? TacticPoint(x: 0.5, y: 0.5) }
        func offset(_ p: TacticPoint, _ dx: Double, _ dy: Double) -> TacticPoint {
            TacticPoint(x: p.x + dx / 68, y: p.y + dy / 105)
        }
        // Repère en mètres depuis le centre du terrain de jeu (dy < 0 : vers le but attaqué)
        let center = model.framing.center
        func at(_ dx: Double, _ dy: Double) -> TacticPoint {
            TacticPoint(x: center.x + dx / 68, y: center.y + dy / 105)
        }
        // ids : 0-3 rouges (en bas), 4-7 bleus (en haut), 8-9 jokers
        // 1 : passe du 1 au 2, le 3 décroche, le bleu 1 sort
        model.addVignette()
        model.updateStep(1, title: "Passe et appel", text: "Le 1 joue sur le 2 pendant que le 3 attaque l'espace.")
        model.moveActor(ids[2], to: at(-5, 4))
        model.moveActor(ids[4], to: at(6, -6))
        model.dropBall(TacticPlay.mainBall, at: pos(ids[1]), onto: ids[1])
        // 2 : conduite du 2, le 3 continue sa course
        model.addVignette()
        model.updateStep(2, title: "Conduite", text: "Le 2 fixe le défenseur en conduisant, puis sert le 3.")
        model.moveActor(ids[1], to: at(7, -4))
        model.moveActor(ids[2], to: at(-4, -8))
        model.moveActor(ids[4], to: at(5, -8))
        // 3 : passe au 3 qui frappe dans le mini-but
        model.addVignette()
        model.updateStep(3, title: "Passe décisive", text: "Le 3 reçoit dans la course.")
        model.moveActor(ids[2], to: at(-1, -12))
        model.dropBall(TacticPlay.mainBall, at: pos(ids[2]), onto: ids[2])
        model.addVignette()
        model.updateStep(4, title: "Finition", text: "Le 3 frappe dans le mini-but.")
        let goal = model.content.props.first { $0.kind == .miniBut }?.position ?? TacticPoint(x: 0.5, y: 0.3)
        model.dropBall(TacticPlay.mainBall, at: goal, onto: nil)
        model.setBallKind(TacticPlay.mainBall, .tir)
        model.updateInfo {
            $0.title = "Jeu 4 contre 4 + 2 jokers"
            $0.objective = "Conserver puis attaquer vite le mini-but adverse."
            $0.instructions = ["Jouer en une ou deux touches", "Utiliser les jokers pour fixer"]
            $0.level = "U13"
            $0.duration = "20 min"
            $0.category = .conservation
        }
        model.addEvolution()
        model.renameEvolution(0, title: "2 touches maximum", text: "Chaque joueur a deux touches de balle au plus.")
        model.selectEvolution(nil)
        var play = model.finalized()
        play.id = UUID.stable(from: "demo-atelier")   // une seule copie, même après plusieurs lancements
        return play
    }

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

    /// Football à 8 (U11) : 8 titulaires, le reste sur le banc
    static var smallRoster: [MatchPlayer] {
        let starters: Set<Int> = [1, 2, 4, 5, 6, 8, 10, 9]
        return matchRoster.map { player in
            var copy = player
            copy.status = starters.contains(player.shirtNumber) ? .titulaire : .remplacant
            return copy
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
