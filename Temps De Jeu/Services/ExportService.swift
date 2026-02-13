//
//  ExportService.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import UIKit
import PDFKit

/// Service d'export PDF et JSON
class ExportService {
    static let shared = ExportService()
    private init() {}

    // MARK: - Date Formatter

    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .long
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }

    private var shortDateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }

    // MARK: - Export Joueurs JSON

    func exportPlayersJSON(_ players: [Player]) -> Data? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(players)
    }

    // MARK: - Import Joueurs JSON

    func importPlayersJSON(from data: Data) -> [Player]? {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode([Player].self, from: data)
    }

    // MARK: - Export / Import Composition (Roster) — Système cascade A → B → C → D

    /// Exporte la composition : joueurs sélectionnés + joueurs restants pour l'équipe suivante
    /// - Parameters:
    ///   - allPlayers: tous les joueurs de l'effectif global
    ///   - selectedPlayerIds: IDs des joueurs sélectionnés pour ce match
    ///   - teamName: nom de l'équipe qui exporte
    ///   - competition: nom de la compétition
    ///   - matchDate: date du match
    ///   - previousUnavailableIds: IDs des joueurs déjà pris par les équipes supérieures (cascade)
    ///   - previousChain: noms des équipes ayant déjà sélectionné
    ///   - excludePhotos: exclure les photos des joueurs (pour liens iMessage)
    func exportRoster(
        allPlayers: [Player],
        selectedPlayerIds: Set<UUID>,
        teamName: String,
        competition: String,
        matchDate: Date,
        previousUnavailableIds: [UUID] = [],
        previousChain: [String] = [],
        excludePhotos: Bool = false
    ) -> Data? {
        // Fonction pour retirer les photos si nécessaire
        let stripPhoto: (Player) -> Player = { player in
            guard excludePhotos else { return player }
            return Player(
                id: player.id,
                firstName: player.firstName,
                lastName: player.lastName,
                position: player.position,
                availability: player.availability,
                photoData: nil
            )
        }
        
        let selectedPlayers = allPlayers.filter { selectedPlayerIds.contains($0.id) }.map(stripPhoto)
        let availablePlayers = allPlayers.filter { !selectedPlayerIds.contains($0.id) && !previousUnavailableIds.contains($0.id) }.map(stripPhoto)

        // Cumuler les indisponibles : anciens + nouveaux sélectionnés
        var allUnavailable = previousUnavailableIds
        allUnavailable.append(contentsOf: selectedPlayerIds)

        var chain = previousChain
        if !teamName.isEmpty {
            chain.append(teamName)
        }

        let export = RosterExport(
            teamName: teamName,
            competition: competition,
            matchDate: matchDate,
            selectedPlayers: selectedPlayers,
            availablePlayers: availablePlayers,
            unavailablePlayerIds: allUnavailable,
            selectionChain: chain
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(export)
    }

    /// Importe un fichier de composition (RosterExport)
    func importRosterExport(from data: Data) -> RosterExport? {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(RosterExport.self, from: data)
    }

    /// Détecte le type de fichier JSON importé (joueurs simples ou export roster)
    enum ImportedFileType {
        case players([Player])
        case rosterExport(RosterExport)
        case unknown
    }

    func detectImportType(from data: Data) -> ImportedFileType {
        // Essayer d'abord un RosterExport
        if let rosterExport = importRosterExport(from: data) {
            return .rosterExport(rosterExport)
        }
        // Sinon essayer une liste de joueurs
        if let players = importPlayersJSON(from: data) {
            return .players(players)
        }
        return .unknown
    }

    // MARK: - Export fichier .tdj (Temps De Jeu)

    /// Crée un fichier .tdj prêt à partager via AirDrop, iMessage, Mail, etc.
    /// Quand le destinataire tape dessus, l'app s'ouvre et importe automatiquement.
    func createRosterFile(
        allPlayers: [Player],
        selectedPlayerIds: Set<UUID>,
        teamName: String,
        competition: String,
        matchDate: Date,
        previousUnavailableIds: [UUID] = [],
        previousChain: [String] = []
    ) -> URL? {
        guard let data = exportRoster(
            allPlayers: allPlayers,
            selectedPlayerIds: selectedPlayerIds,
            teamName: teamName,
            competition: competition,
            matchDate: matchDate,
            previousUnavailableIds: previousUnavailableIds,
            previousChain: previousChain
        ) else { return nil }

        let cleanTeam = teamName
            .replacingOccurrences(of: " ", with: "_")
            .replacingOccurrences(of: "/", with: "-")

        let dateStr: String = {
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            return f.string(from: matchDate)
        }()

        let fileName = "Joueurs_dispo_\(cleanTeam)_\(dateStr).tdj"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try data.write(to: tempURL)
            return tempURL
        } catch {
            print("Erreur création fichier .tdj: \(error)")
            return nil
        }
    }

    // MARK: - Export Composition PDF (Roster)

    /// Génère un PDF de la composition du match (liste des joueurs sélectionnés)
    func generateRosterPDF(
        roster: [MatchPlayer],
        teamName: String,
        competition: String,
        matchDate: Date,
        opponent: String = ""
    ) -> Data {
        let pageWidth: CGFloat = 595.0   // A4
        let pageHeight: CGFloat = 842.0
        let margin: CGFloat = 40.0
        let contentWidth = pageWidth - 2 * margin

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))

        return renderer.pdfData { context in
            var currentY: CGFloat = 0

            func beginNewPage() {
                context.beginPage()
                currentY = margin
            }

            func ensureSpace(_ height: CGFloat) {
                if currentY + height > pageHeight - margin {
                    beginNewPage()
                }
            }

            // Page 1
            beginNewPage()

            // Styles
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 24, weight: .bold),
                .foregroundColor: UIColor.black
            ]
            let subtitleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 16, weight: .medium),
                .foregroundColor: UIColor.darkGray
            ]
            let dateAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12),
                .foregroundColor: UIColor.gray
            ]
            let sectionAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
                .foregroundColor: UIColor.systemGreen
            ]
            let playerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 13),
                .foregroundColor: UIColor.black
            ]
            let numberAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 13, weight: .bold),
                .foregroundColor: UIColor.systemGreen
            ]
            let positionAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 11),
                .foregroundColor: UIColor.gray
            ]

            // Titre
            let title = "Composition - \(teamName.isEmpty ? "Mon équipe" : teamName)"
            title.draw(at: CGPoint(x: margin, y: currentY), withAttributes: titleAttrs)
            currentY += 35

            // Adversaire si renseigné
            if !opponent.isEmpty {
                let vs = "vs \(opponent)"
                vs.draw(at: CGPoint(x: margin, y: currentY), withAttributes: subtitleAttrs)
                currentY += 25
            }

            // Compétition
            if !competition.isEmpty {
                competition.draw(at: CGPoint(x: margin, y: currentY), withAttributes: subtitleAttrs)
                currentY += 25
            }

            // Date
            let dateStr = dateFormatter.string(from: matchDate)
            dateStr.draw(at: CGPoint(x: margin, y: currentY), withAttributes: dateAttrs)
            currentY += 30

            // Ligne séparatrice
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 20

            // Séparer titulaires et remplaçants
            let titulaires = roster.filter { $0.status == .titulaire }
                .sorted { $0.shirtNumber < $1.shirtNumber }
            let remplacants = roster.filter { $0.status == .remplacant }
                .sorted { $0.shirtNumber < $1.shirtNumber }

            // TITULAIRES
            if !titulaires.isEmpty {
                ensureSpace(30)
                "TITULAIRES (\(titulaires.count))".draw(at: CGPoint(x: margin, y: currentY), withAttributes: sectionAttrs)
                currentY += 25

                for player in titulaires {
                    ensureSpace(25)
                    
                    // Numéro
                    let numStr = "#\(player.shirtNumber)"
                    numStr.draw(at: CGPoint(x: margin, y: currentY), withAttributes: numberAttrs)
                    
                    // Nom
                    let name = player.displayName.isEmpty ? "Joueur" : player.displayName
                    name.draw(at: CGPoint(x: margin + 45, y: currentY), withAttributes: playerAttrs)
                    
                    // Position
                    let pos = player.position.shortName
                    pos.draw(at: CGPoint(x: pageWidth - margin - 40, y: currentY), withAttributes: positionAttrs)
                    
                    currentY += 22
                }
                currentY += 15
            }

            // Styles orange pour remplaçants
            let subSectionAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
                .foregroundColor: UIColor.systemOrange
            ]
            let subNumberAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 13, weight: .bold),
                .foregroundColor: UIColor.systemOrange
            ]

            // REMPLAÇANTS
            if !remplacants.isEmpty {
                ensureSpace(30)
                "REMPLAÇANTS (\(remplacants.count))".draw(at: CGPoint(x: margin, y: currentY), withAttributes: subSectionAttrs)
                currentY += 25

                for player in remplacants {
                    ensureSpace(25)
                    
                    // Numéro
                    let numStr = "#\(player.shirtNumber)"
                    numStr.draw(at: CGPoint(x: margin, y: currentY), withAttributes: subNumberAttrs)
                    
                    // Nom
                    let name = player.displayName.isEmpty ? "Joueur" : player.displayName
                    name.draw(at: CGPoint(x: margin + 45, y: currentY), withAttributes: playerAttrs)
                    
                    // Position
                    let pos = player.position.shortName
                    pos.draw(at: CGPoint(x: pageWidth - margin - 40, y: currentY), withAttributes: positionAttrs)
                    
                    currentY += 22
                }
            }

            // Résumé en bas
            currentY += 30
            ensureSpace(40)
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15

            let summaryAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 11),
                .foregroundColor: UIColor.darkGray
            ]
            let summary = "Total: \(roster.count) joueurs · \(titulaires.count) titulaires · \(remplacants.count) remplaçants"
            summary.draw(at: CGPoint(x: margin, y: currentY), withAttributes: summaryAttrs)
        }
    }

    // MARK: - Export Joueurs PDF

    func generatePlayersPDF(players: [Player], allCards: [CardEvent], matches: [Match] = []) -> Data {
        let pageWidth: CGFloat = 595.0   // A4
        let pageHeight: CGFloat = 842.0
        let margin: CGFloat = 40.0
        let contentWidth = pageWidth - 2 * margin

        // Pré-calculer les stats de temps de jeu par joueur (matchs terminés uniquement)
        struct PlayerStats {
            var totalTime: TimeInterval = 0
            var matchCount: Int = 0
            var averageTime: TimeInterval { matchCount > 0 ? totalTime / Double(matchCount) : 0 }
        }
        var statsById: [UUID: PlayerStats] = [:]
        let finishedMatches = matches.filter { $0.isFinished }
        for match in finishedMatches {
            let playingTimes = match.playerPlayingTimes()
            for pt in playingTimes {
                guard pt.totalTime > 0 else { continue }
                var s = statsById[pt.playerId] ?? PlayerStats()
                s.totalTime += pt.totalTime
                s.matchCount += 1
                statsById[pt.playerId] = s
            }
        }

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))

        return renderer.pdfData { context in
            var currentY: CGFloat = 0

            func ensureSpace(_ height: CGFloat) {
                if currentY + height > pageHeight - margin {
                    context.beginPage()
                    currentY = margin
                }
            }

            func beginNewPage() {
                context.beginPage()
                currentY = margin
            }

            // Page 1
            beginNewPage()

            // Titre
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 24, weight: .bold),
                .foregroundColor: UIColor.black
            ]
            let title = "Effectif - Temps De Jeu"
            title.draw(at: CGPoint(x: margin, y: currentY), withAttributes: titleAttrs)
            currentY += 40

            // Date
            let dateAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12),
                .foregroundColor: UIColor.gray
            ]
            let dateStr = "Exporté le \(dateFormatter.string(from: Date()))"
            dateStr.draw(at: CGPoint(x: margin, y: currentY), withAttributes: dateAttrs)
            currentY += 30

            // Résumé
            let summaryAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14),
                .foregroundColor: UIColor.darkGray
            ]
            let gardiens = players.filter { $0.position == .gardien }.count
            let defenseurs = players.filter { $0.position == .defenseur }.count
            let milieux = players.filter { $0.position == .milieu }.count
            let attaquants = players.filter { $0.position == .attaquant }.count
            let summary = "\(players.count) joueurs : \(gardiens) G · \(defenseurs) DEF · \(milieux) MIL · \(attaquants) ATT"
            summary.draw(at: CGPoint(x: margin, y: currentY), withAttributes: summaryAttrs)
            currentY += 20

            if !finishedMatches.isEmpty {
                "\(finishedMatches.count) match\(finishedMatches.count > 1 ? "s" : "") joué\(finishedMatches.count > 1 ? "s" : "")".draw(at: CGPoint(x: margin, y: currentY), withAttributes: summaryAttrs)
                currentY += 20
            }
            currentY += 10

            // Ligne séparatrice
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15

            // En-têtes colonnes
            let colHeaderAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                .foregroundColor: UIColor.gray
            ]
            if !finishedMatches.isEmpty {
                "Matchs".draw(at: CGPoint(x: margin + 200, y: currentY), withAttributes: colHeaderAttrs)
                "Tps cumulé".draw(at: CGPoint(x: margin + 260, y: currentY), withAttributes: colHeaderAttrs)
                "Moy/match".draw(at: CGPoint(x: margin + 340, y: currentY), withAttributes: colHeaderAttrs)
            }
            "Cartons".draw(at: CGPoint(x: pageWidth - margin - 80, y: currentY), withAttributes: colHeaderAttrs)
            currentY += 16

            // Tableau joueurs par position
            let positions: [(String, PlayerPosition)] = [
                ("Gardiens", .gardien),
                ("Défenseurs", .defenseur),
                ("Milieux", .milieu),
                ("Attaquants", .attaquant)
            ]

            let headerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
                .foregroundColor: UIColor.systemGreen
            ]
            let rowAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12),
                .foregroundColor: UIColor.black
            ]
            let statsAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10),
                .foregroundColor: UIColor.darkGray
            ]
            let cardAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10),
                .foregroundColor: UIColor.red
            ]

            for (sectionName, position) in positions {
                let sectionPlayers = players.filter { $0.position == position }
                    .sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
                guard !sectionPlayers.isEmpty else { continue }

                ensureSpace(40)

                // En-tête section
                sectionName.draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                for player in sectionPlayers {
                    ensureSpace(22)

                    let name = player.fullName.isEmpty ? "Joueur" : player.fullName
                    name.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: rowAttrs)

                    // Temps de jeu cumulé, nb matchs, moyenne
                    if let ps = statsById[player.id] {
                        "\(ps.matchCount)".draw(at: CGPoint(x: margin + 210, y: currentY + 1), withAttributes: statsAttrs)
                        TimeFormatters.formatTime(ps.totalTime).draw(at: CGPoint(x: margin + 270, y: currentY + 1), withAttributes: statsAttrs)
                        TimeFormatters.formatTime(ps.averageTime).draw(at: CGPoint(x: margin + 350, y: currentY + 1), withAttributes: statsAttrs)
                    } else if !finishedMatches.isEmpty {
                        "0".draw(at: CGPoint(x: margin + 210, y: currentY + 1), withAttributes: statsAttrs)
                        "00:00".draw(at: CGPoint(x: margin + 270, y: currentY + 1), withAttributes: statsAttrs)
                        "00:00".draw(at: CGPoint(x: margin + 350, y: currentY + 1), withAttributes: statsAttrs)
                    }

                    // Cartons du joueur
                    let playerCards = allCards.filter { $0.playerId == player.id }
                    if !playerCards.isEmpty {
                        let y = playerCards.filter { $0.type == .yellow }.count
                        let sy = playerCards.filter { $0.type == .secondYellow }.count
                        let r = playerCards.filter { $0.type == .red }.count
                        let w = playerCards.filter { $0.type == .white }.count
                        var parts: [String] = []
                        if y > 0 { parts.append("\(y) J") }
                        if sy > 0 { parts.append("\(sy) 2J") }
                        if r > 0 { parts.append("\(r) R") }
                        if w > 0 { parts.append("\(w) B") }
                        let cardStr = parts.joined(separator: " · ")
                        cardStr.draw(at: CGPoint(x: pageWidth - margin - 80, y: currentY + 1), withAttributes: cardAttrs)
                    }

                    currentY += 20
                }
                currentY += 10
            }
        }
    }

    // MARK: - Export Match PDF (Rapport)

    func generateMatchPDF(match: Match) -> Data {
        let pageWidth: CGFloat = 595.0
        let pageHeight: CGFloat = 842.0
        let margin: CGFloat = 40.0
        let contentWidth = pageWidth - 2 * margin

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))

        return renderer.pdfData { context in
            var currentY: CGFloat = 0

            func ensureSpace(_ height: CGFloat) {
                if currentY + height > pageHeight - margin {
                    context.beginPage()
                    currentY = margin
                }
            }

            func beginNewPage() {
                context.beginPage()
                currentY = margin
            }

            // Page 1
            beginNewPage()

            // --- HEADER ---
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 22, weight: .bold),
                .foregroundColor: UIColor.black
            ]
            let subtitleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14),
                .foregroundColor: UIColor.gray
            ]
            let headerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
                .foregroundColor: UIColor.systemGreen
            ]
            let bodyAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12),
                .foregroundColor: UIColor.black
            ]
            let bodyBoldAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12, weight: .semibold),
                .foregroundColor: UIColor.black
            ]
            let smallAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10),
                .foregroundColor: UIColor.darkGray
            ]

            // Titre
            let home = match.homeTeam.isEmpty ? "Domicile" : match.homeTeam
            let away = match.awayTeam.isEmpty ? "Extérieur" : match.awayTeam
            let homeSuffix = match.isMyTeamHome ? " *" : ""
            let awaySuffix = match.isMyTeamHome ? "" : " *"
            let matchTitle = "\(home)\(homeSuffix)  \(match.homeScore) - \(match.awayScore)  \(away)\(awaySuffix)"
            matchTitle.draw(at: CGPoint(x: margin, y: currentY), withAttributes: titleAttrs)
            currentY += 30

            // Compétition + date
            var sub = "* Mon équipe \(match.isMyTeamHome ? "(domicile)" : "(extérieur)") · " + dateFormatter.string(from: match.date)
            if !match.competition.isEmpty {
                sub = "\(match.competition) · \(sub)"
            }
            sub.draw(at: CGPoint(x: margin, y: currentY), withAttributes: subtitleAttrs)
            currentY += 25

            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 20

            // --- RÉSUMÉ TEMPS ---
            "Résumé des temps".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
            currentY += 22

            let rows: [(String, String)] = [
                ("Durée totale", TimeFormatters.formatTime(match.totalMatchDuration)),
                ("Temps effectif", TimeFormatters.formatTime(match.totalEffectivePlayTime)),
                ("Temps d'arrêts", TimeFormatters.formatTime(match.totalStoppageTime)),
                ("Ratio effectif", "\(Int(match.effectivePercentage))%"),
                ("Nombre d'arrêts", "\(match.stoppages.count)")
            ]

            for (label, value) in rows {
                ensureSpace(20)
                label.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                value.draw(at: CGPoint(x: pageWidth - margin - 80, y: currentY), withAttributes: bodyBoldAttrs)
                currentY += 18
            }
            currentY += 10

            // --- PAR PÉRIODE ---
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15

            "Détail par période".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
            currentY += 22

            for period in MatchPeriod.allCases {
                guard let duration = match.periodDurations[period.rawValue] else { continue }
                ensureSpace(50)

                let effective = match.effectivePlayTime(for: period)
                let stoppages = match.totalStoppageTime(for: period)
                let addedTime = match.suggestedAddedTime(for: period)

                "\(period.rawValue)".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyBoldAttrs)
                currentY += 18
                "  Durée: \(TimeFormatters.formatTime(duration)) · Effectif: \(TimeFormatters.formatTime(effective)) · Arrêts: \(TimeFormatters.formatTime(stoppages)) · T.A. suggéré: +\(Int(ceil(addedTime / 60)))'".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: smallAttrs)
                currentY += 20
            }
            currentY += 10

            // --- PAR TYPE D'ARRÊT ---
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15

            "Arrêts par type".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
            currentY += 22

            let homeLabel = match.homeTeam.isEmpty ? "DOM" : match.homeTeam
            let awayLabel = match.awayTeam.isEmpty ? "EXT" : match.awayTeam

            for type in StoppageType.allCases {
                let count = match.stoppageCount(for: type)
                guard count > 0 else { continue }
                ensureSpace(20)
                let totalTime = match.totalTime(for: type)
                let homeCount = match.stoppageCount(for: type, team: .home)
                let awayCount = match.stoppageCount(for: type, team: .away)
                var teamDetail = ""
                if homeCount > 0 || awayCount > 0 {
                    var parts: [String] = []
                    if homeCount > 0 { parts.append("\(homeLabel): \(homeCount)") }
                    if awayCount > 0 { parts.append("\(awayLabel): \(awayCount)") }
                    teamDetail = " (\(parts.joined(separator: " / ")))"
                }
                let line = "\(type.rawValue) : \(count)x · \(TimeFormatters.formatShort(totalTime))\(teamDetail)"
                line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                currentY += 18
            }
            currentY += 10

            // --- BUTS ---
            if !match.goals.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Buts".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                for goal in match.goals {
                    ensureSpace(20)
                    let side = goal.isHome ? home : away
                    let scorer = goal.playerName.isEmpty ? "" : " (\(goal.playerName))"
                    let line = "\(Int(goal.minute / 60))' \(goal.period.shortName) - \(side)\(scorer)"
                    line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                    currentY += 18
                }
                currentY += 10
            }

            // --- CARTONS ---
            if !match.cards.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Cartons".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                for card in match.cards {
                    ensureSpace(20)
                    let line = "\(Int(card.minute / 60))' \(card.period.shortName) - \(card.type.rawValue) · \(card.playerName)"
                    line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                    currentY += 18
                }
                currentY += 10
            }

            // --- REMPLACEMENTS ---
            if !match.substitutions.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Remplacements".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                for sub in match.substitutions {
                    ensureSpace(20)
                    let line = "\(Int(sub.minute / 60))' \(sub.period.shortName) - \(sub.playerOut) ⇄ \(sub.playerIn)"
                    line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                    currentY += 18
                }
                currentY += 10
            }

            // --- FAUTES ---
            if !match.fouls.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Fautes (\(match.fouls.count))".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                // Regrouper par joueur
                let foulsByPlayer = Dictionary(grouping: match.fouls, by: { $0.playerName })
                for (playerName, fouls) in foulsByPlayer.sorted(by: { $0.value.count > $1.value.count }) {
                    ensureSpace(20)
                    let line = "\(playerName) : \(fouls.count) faute\(fouls.count > 1 ? "s" : "")"
                    line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                    currentY += 18
                }
                currentY += 10
            }

            // --- COMPOSITION ---
            if !match.matchRoster.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Composition".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                let tit = match.matchRoster.filter { $0.status == .titulaire }.sorted { $0.shirtNumber < $1.shirtNumber }
                let remp = match.matchRoster.filter { $0.status == .remplacant }.sorted { $0.shirtNumber < $1.shirtNumber }

                if !tit.isEmpty {
                    "Titulaires :".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyBoldAttrs)
                    currentY += 18
                    for mp in tit {
                        ensureSpace(20)
                        "#\(mp.shirtNumber) \(mp.fullName) (\(mp.position.shortName))".draw(at: CGPoint(x: margin + 20, y: currentY), withAttributes: bodyAttrs)
                        currentY += 16
                    }
                    currentY += 5
                }

                if !remp.isEmpty {
                    ensureSpace(20)
                    "Remplaçants :".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyBoldAttrs)
                    currentY += 18
                    for mp in remp {
                        ensureSpace(20)
                        "#\(mp.shirtNumber) \(mp.fullName) (\(mp.position.shortName))".draw(at: CGPoint(x: margin + 20, y: currentY), withAttributes: bodyAttrs)
                        currentY += 16
                    }
                }
                currentY += 10
            }

            // --- TIMELINE ---
            if !match.stoppages.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Chronologie des arrêts".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                for (index, stoppage) in match.stoppages.enumerated() {
                    ensureSpace(20)
                    let minute = TimeFormatters.formatMatchMinute(stoppage.startTime, regulation: stoppage.period.regulationDuration)
                    let dur = TimeFormatters.formatShort(stoppage.duration)
                    var teamLabel = ""
                    if let team = stoppage.beneficiaryTeam {
                        teamLabel = " (\(team == .home ? (match.homeTeam.isEmpty ? "DOM" : match.homeTeam) : (match.awayTeam.isEmpty ? "EXT" : match.awayTeam)))"
                    }
                    let line = "\(index + 1). \(minute) \(stoppage.period.shortName) · \(stoppage.type.rawValue)\(teamLabel) · \(dur)"
                    line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: smallAttrs)
                    currentY += 16
                }
            }

            // --- TEMPS DE JEU PAR JOUEUR ---
            let playingTimes = match.playerPlayingTimes()
            if !playingTimes.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Temps de jeu par joueur".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                // En-têtes colonnes
                let colHeaderAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
                    .foregroundColor: UIColor.gray
                ]
                "Joueur".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: colHeaderAttrs)
                "Pos.".draw(at: CGPoint(x: margin + 220, y: currentY), withAttributes: colHeaderAttrs)
                "Total".draw(at: CGPoint(x: margin + 280, y: currentY), withAttributes: colHeaderAttrs)
                "Effectif".draw(at: CGPoint(x: margin + 350, y: currentY), withAttributes: colHeaderAttrs)
                currentY += 16

                for pt in playingTimes {
                    ensureSpace(18)
                    let statusMark = pt.isTitulaire ? "TIT" : "RMP"
                    let name = "#\(pt.shirtNumber) \(pt.playerName)"
                    name.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                    "\(pt.position.shortName) \(statusMark)".draw(at: CGPoint(x: margin + 220, y: currentY), withAttributes: smallAttrs)
                    TimeFormatters.formatTime(pt.totalTime).draw(at: CGPoint(x: margin + 280, y: currentY), withAttributes: bodyBoldAttrs)
                    TimeFormatters.formatTime(pt.effectiveTime).draw(at: CGPoint(x: margin + 350, y: currentY), withAttributes: bodyAttrs)
                    currentY += 16
                }
                currentY += 10
            }

            // Pied de page
            ensureSpace(40)
            currentY += 20
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 10
            let footer = "Temps De Jeu · \(dateFormatter.string(from: Date()))"
            let footerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 9),
                .foregroundColor: UIColor.lightGray
            ]
            footer.draw(at: CGPoint(x: margin, y: currentY), withAttributes: footerAttrs)
        }
    }

    // MARK: - Export Stats Globales PDF

    func generateStatsPDF(matches: [Match], players: [Player]) -> Data {
        let pageWidth: CGFloat = 595.0
        let pageHeight: CGFloat = 842.0
        let margin: CGFloat = 40.0
        let contentWidth = pageWidth - 2 * margin

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))

        return renderer.pdfData { context in
            var currentY: CGFloat = 0

            func ensureSpace(_ height: CGFloat) {
                if currentY + height > pageHeight - margin {
                    context.beginPage()
                    currentY = margin
                }
            }

            func beginNewPage() {
                context.beginPage()
                currentY = margin
            }

            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 22, weight: .bold),
                .foregroundColor: UIColor.black
            ]
            let headerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
                .foregroundColor: UIColor.systemGreen
            ]
            let bodyAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12),
                .foregroundColor: UIColor.black
            ]
            let bodyBoldAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12, weight: .semibold),
                .foregroundColor: UIColor.black
            ]
            let subtitleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14),
                .foregroundColor: UIColor.gray
            ]
            let smallAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10),
                .foregroundColor: UIColor.darkGray
            ]

            // Page 1
            beginNewPage()

            "Statistiques globales".draw(at: CGPoint(x: margin, y: currentY), withAttributes: titleAttrs)
            currentY += 30

            "Temps De Jeu · \(dateFormatter.string(from: Date()))".draw(at: CGPoint(x: margin, y: currentY), withAttributes: subtitleAttrs)
            currentY += 25

            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 20

            // Vue d'ensemble
            "Vue d'ensemble".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
            currentY += 22

            let finishedMatches = matches.filter { $0.isFinished }
            let totalDuration = finishedMatches.reduce(0.0) { $0 + $1.totalMatchDuration }
            let totalEffective = finishedMatches.reduce(0.0) { $0 + $1.totalEffectivePlayTime }
            let avgEffective = finishedMatches.isEmpty ? 0 : totalEffective / Double(finishedMatches.count)
            let avgPercentage = finishedMatches.isEmpty ? 0 : finishedMatches.reduce(0.0) { $0 + $1.effectivePercentage } / Double(finishedMatches.count)
            let totalStoppages = finishedMatches.reduce(0) { $0 + $1.stoppages.count }

            let overviewRows: [(String, String)] = [
                ("Matchs joués", "\(finishedMatches.count)"),
                ("Durée totale cumulée", TimeFormatters.formatTime(totalDuration)),
                ("Temps effectif cumulé", TimeFormatters.formatTime(totalEffective)),
                ("Temps effectif moyen/match", TimeFormatters.formatTime(avgEffective)),
                ("Ratio effectif moyen", "\(Int(avgPercentage))%"),
                ("Nombre total d'arrêts", "\(totalStoppages)"),
                ("Joueurs dans l'effectif", "\(players.count)")
            ]

            for (label, value) in overviewRows {
                ensureSpace(20)
                label.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                value.draw(at: CGPoint(x: pageWidth - margin - 100, y: currentY), withAttributes: bodyBoldAttrs)
                currentY += 18
            }
            currentY += 15

            // Répartition des arrêts
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15
            "Répartition globale des arrêts".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
            currentY += 22

            for type in StoppageType.allCases {
                let count = finishedMatches.reduce(0) { $0 + $1.stoppageCount(for: type) }
                guard count > 0 else { continue }
                let totalTime = finishedMatches.reduce(0.0) { $0 + $1.totalTime(for: type) }
                ensureSpace(20)
                "\(type.rawValue) : \(count)x · \(TimeFormatters.formatShort(totalTime))".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                currentY += 18
            }
            currentY += 15

            // Cartons
            let allCards = finishedMatches.flatMap { $0.cards }
            if !allCards.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Cartons".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                let yc = allCards.filter { $0.type == .yellow }.count
                let syc = allCards.filter { $0.type == .secondYellow }.count
                let rc = allCards.filter { $0.type == .red }.count
                let wc = allCards.filter { $0.type == .white }.count
                "Jaunes: \(yc) · 2èmes jaunes: \(syc) · Rouges: \(rc) · Blancs: \(wc)".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyBoldAttrs)
                currentY += 22

                // Top joueurs sanctionnés
                let playerCards = Dictionary(grouping: allCards.filter { $0.playerId != nil }, by: { $0.playerId! })
                let ranking = playerCards.sorted { $0.value.count > $1.value.count }.prefix(10)
                if !ranking.isEmpty {
                    "Top joueurs sanctionnés :".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyBoldAttrs)
                    currentY += 18
                    for (_, cards) in ranking {
                        ensureSpace(20)
                        let name = cards.first?.playerName ?? "?"
                        let y = cards.filter { $0.type == .yellow }.count
                        let sy = cards.filter { $0.type == .secondYellow }.count
                        let r = cards.filter { $0.type == .red }.count
                        let w = cards.filter { $0.type == .white }.count
                        var parts: [String] = []
                        if y > 0 { parts.append("\(y)J") }
                        if sy > 0 { parts.append("\(sy)×2J") }
                        if r > 0 { parts.append("\(r)R") }
                        if w > 0 { parts.append("\(w)B") }
                        "  \(name) : \(parts.joined(separator: " · "))".draw(at: CGPoint(x: margin + 20, y: currentY), withAttributes: bodyAttrs)
                        currentY += 16
                    }
                }
                currentY += 10
            }

            // Buts & Buteurs
            let myGoals = finishedMatches.flatMap { match in
                match.goals.filter { $0.isHome == match.isMyTeamHome && !$0.playerName.isEmpty }
            }
            if !myGoals.isEmpty {
                ensureSpace(60)
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Buteurs".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                let totalMyGoals = finishedMatches.reduce(0) { $0 + ($1.isMyTeamHome ? $1.homeScore : $1.awayScore) }
                let totalOppGoals = finishedMatches.reduce(0) { $0 + ($1.isMyTeamHome ? $1.awayScore : $1.homeScore) }
                "Mon \u{00e9}quipe: \(totalMyGoals) buts · Adversaires: \(totalOppGoals) buts".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyBoldAttrs)
                currentY += 22

                let scorers = Dictionary(grouping: myGoals, by: { $0.playerName })
                    .map { (name: $0.key, count: $0.value.count) }
                    .sorted { $0.count > $1.count }

                "Top buteurs :".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyBoldAttrs)
                currentY += 18
                for scorer in scorers.prefix(10) {
                    ensureSpace(20)
                    "  \(scorer.name) : \(scorer.count) but\(scorer.count > 1 ? "s" : "")".draw(at: CGPoint(x: margin + 20, y: currentY), withAttributes: bodyAttrs)
                    currentY += 16
                }
                currentY += 10
            }

            // Historique matchs
            if !finishedMatches.isEmpty {
                drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
                currentY += 15
                "Historique des matchs".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
                currentY += 22

                for match in finishedMatches {
                    ensureSpace(35)
                    let h = match.homeTeam.isEmpty ? "Dom." : match.homeTeam
                    let a = match.awayTeam.isEmpty ? "Ext." : match.awayTeam
                    let myMarker = match.isMyTeamHome ? "*" : ""
                    let oppMarker = match.isMyTeamHome ? "" : "*"
                    let line = "\(h)\(myMarker) \(match.homeScore)-\(match.awayScore) \(a)\(oppMarker)"
                    line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyBoldAttrs)
                    currentY += 16
                    let detail = "\(shortDateFormatter.string(from: match.date)) · Effectif: \(TimeFormatters.formatTime(match.totalEffectivePlayTime)) (\(Int(match.effectivePercentage))%) · \(match.stoppages.count) arrêts"
                    detail.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: smallAttrs)
                    currentY += 18
                }
            }

            // Footer
            ensureSpace(40)
            currentY += 20
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 10
            let footer = "Temps De Jeu · \(dateFormatter.string(from: Date()))"
            let footerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 9),
                .foregroundColor: UIColor.lightGray
            ]
            footer.draw(at: CGPoint(x: margin, y: currentY), withAttributes: footerAttrs)
        }
    }

    // MARK: - Export Présences Entraînements JSON

    func exportTrainingAttendanceJSON(
        sessions: [TrainingSession],
        playerStats: [PlayerAttendanceStats],
        startDate: Date,
        endDate: Date
    ) -> Data? {
        let export = TrainingAttendanceExport(
            startDate: startDate,
            endDate: endDate,
            sessions: sessions,
            playerStats: playerStats
        )
        
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(export)
    }

    // MARK: - Export Présences Entraînements PDF

    func generateTrainingAttendancePDF(
        sessions: [TrainingSession],
        playerStats: [PlayerAttendanceStats],
        startDate: Date,
        endDate: Date
    ) -> Data {
        let pageWidth: CGFloat = 595.0   // A4
        let pageHeight: CGFloat = 842.0
        let margin: CGFloat = 40.0
        let contentWidth = pageWidth - 2 * margin

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))

        return renderer.pdfData { context in
            var currentY: CGFloat = 0
            var pageNumber = 1

            func startNewPage() {
                context.beginPage()
                currentY = margin
                pageNumber += 1
            }

            func ensureSpace(_ needed: CGFloat) {
                if currentY + needed > pageHeight - margin {
                    startNewPage()
                }
            }

            // Première page
            context.beginPage()
            currentY = margin

            // Titre
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 24),
                .foregroundColor: UIColor.black
            ]
            let title = "Présences aux entraînements"
            title.draw(at: CGPoint(x: margin, y: currentY), withAttributes: titleAttrs)
            currentY += 35

            // Période
            let subtitleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14),
                .foregroundColor: UIColor.darkGray
            ]
            let period = "Du \(shortDateFormatter.string(from: startDate)) au \(shortDateFormatter.string(from: endDate))"
            period.draw(at: CGPoint(x: margin, y: currentY), withAttributes: subtitleAttrs)
            currentY += 25

            // Résumé
            let summaryAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12),
                .foregroundColor: UIColor.black
            ]
            let totalSessions = sessions.count
            let totalPresences = sessions.reduce(0) { $0 + $1.presentCount }
            let totalPossible = sessions.reduce(0) { $0 + $1.totalCount }
            let avgRate = totalPossible > 0 ? Double(totalPresences) / Double(totalPossible) * 100 : 0

            let summary = "\(totalSessions) entraînements · Présence moyenne: \(Int(avgRate))%"
            summary.draw(at: CGPoint(x: margin, y: currentY), withAttributes: summaryAttrs)
            currentY += 30

            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15

            // Statistiques par joueur
            let headerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 16),
                .foregroundColor: UIColor.black
            ]
            "Statistiques par joueur".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
            currentY += 25

            let bodyAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 11),
                .foregroundColor: UIColor.black
            ]
            let bodyBoldAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 11),
                .foregroundColor: UIColor.black
            ]

            // En-tête du tableau
            ensureSpace(20)
            let colWidths: [CGFloat] = [contentWidth * 0.5, contentWidth * 0.25, contentWidth * 0.25]
            var x = margin
            "Joueur".draw(at: CGPoint(x: x, y: currentY), withAttributes: bodyBoldAttrs)
            x += colWidths[0]
            "Présences".draw(at: CGPoint(x: x, y: currentY), withAttributes: bodyBoldAttrs)
            x += colWidths[1]
            "Taux".draw(at: CGPoint(x: x, y: currentY), withAttributes: bodyBoldAttrs)
            currentY += 18

            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 8

            // Données des joueurs
            for stat in playerStats.sorted(by: { $0.attendanceRate > $1.attendanceRate }) {
                ensureSpace(18)
                x = margin
                stat.fullName.draw(at: CGPoint(x: x, y: currentY), withAttributes: bodyAttrs)
                x += colWidths[0]
                "\(stat.presentSessions)/\(stat.totalSessions)".draw(at: CGPoint(x: x, y: currentY), withAttributes: bodyAttrs)
                x += colWidths[1]
                
                let rateColor: UIColor = stat.attendanceRate >= 75 ? .systemGreen : stat.attendanceRate >= 50 ? .systemOrange : .systemRed
                let rateAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.boldSystemFont(ofSize: 11),
                    .foregroundColor: rateColor
                ]
                "\(Int(stat.attendanceRate))%".draw(at: CGPoint(x: x, y: currentY), withAttributes: rateAttrs)
                currentY += 16
            }

            currentY += 20
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15

            // Détail par entraînement
            ensureSpace(30)
            "Détail par entraînement".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
            currentY += 25

            let smallAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10),
                .foregroundColor: UIColor.darkGray
            ]

            for session in sessions.sorted(by: { $0.date > $1.date }) {
                ensureSpace(50)
                
                // Date de l'entraînement
                let dateStr = dateFormatter.string(from: session.date)
                dateStr.draw(at: CGPoint(x: margin, y: currentY), withAttributes: bodyBoldAttrs)
                currentY += 16
                
                // Résumé
                let sessionRate = session.totalCount > 0 ? Double(session.presentCount) / Double(session.totalCount) * 100 : 0
                let sessionSummary = "Présents: \(session.presentCount)/\(session.totalCount) (\(Int(sessionRate))%)"
                sessionSummary.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: smallAttrs)
                currentY += 14
                
                // Notes
                if !session.notes.isEmpty {
                    "Note: \(session.notes)".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: smallAttrs)
                    currentY += 14
                }
                
                // Liste des présents
                let presentNames = session.attendances.filter { $0.isPresent }.map { $0.fullName }.joined(separator: ", ")
                if !presentNames.isEmpty {
                    let maxWidth = contentWidth - 20
                    let presentText = "Présents: \(presentNames)"
                    let presentAttrStr = NSAttributedString(string: presentText, attributes: smallAttrs)
                    let textRect = CGRect(x: margin + 10, y: currentY, width: maxWidth, height: 100)
                    presentAttrStr.draw(with: textRect, options: .usesLineFragmentOrigin, context: nil)
                    let textHeight = presentAttrStr.boundingRect(with: CGSize(width: maxWidth, height: CGFloat.greatestFiniteMagnitude), options: .usesLineFragmentOrigin, context: nil).height
                    currentY += textHeight + 10
                }
                
                currentY += 8
            }

            // Footer
            ensureSpace(40)
            currentY += 20
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 10
            let footer = "Temps De Jeu · \(dateFormatter.string(from: Date()))"
            let footerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 9),
                .foregroundColor: UIColor.lightGray
            ]
            footer.draw(at: CGPoint(x: margin, y: currentY), withAttributes: footerAttrs)
        }
    }

    // MARK: - Export Session Individuelle PDF

    /// Génère un PDF de la feuille de présence d'un entraînement
    func generateTrainingSessionPDF(session: TrainingSession) -> Data {
        let pageWidth: CGFloat = 595.0   // A4
        let pageHeight: CGFloat = 842.0
        let margin: CGFloat = 40.0
        let contentWidth = pageWidth - 2 * margin

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))

        return renderer.pdfData { context in
            var currentY: CGFloat = 0

            func ensureSpace(_ needed: CGFloat) {
                if currentY + needed > pageHeight - margin {
                    context.beginPage()
                    currentY = margin
                }
            }

            // Première page
            context.beginPage()
            currentY = margin

            // Titre
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 24),
                .foregroundColor: UIColor.black
            ]
            "Feuille de présence".draw(at: CGPoint(x: margin, y: currentY), withAttributes: titleAttrs)
            currentY += 35

            // Date de l'entraînement
            let subtitleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 16),
                .foregroundColor: UIColor.darkGray
            ]
            let dateStr = dateFormatter.string(from: session.date)
            dateStr.draw(at: CGPoint(x: margin, y: currentY), withAttributes: subtitleAttrs)
            currentY += 30

            // Notes si présentes
            if !session.notes.isEmpty {
                let notesAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.italicSystemFont(ofSize: 12),
                    .foregroundColor: UIColor.darkGray
                ]
                "Note: \(session.notes)".draw(at: CGPoint(x: margin, y: currentY), withAttributes: notesAttrs)
                currentY += 25
            }

            // Résumé
            let summaryAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 14),
                .foregroundColor: UIColor.black
            ]
            let rate = session.totalCount > 0 ? Double(session.presentCount) / Double(session.totalCount) * 100 : 0
            let summary = "Présents: \(session.presentCount)/\(session.totalCount) (\(Int(rate))%)"
            summary.draw(at: CGPoint(x: margin, y: currentY), withAttributes: summaryAttrs)
            currentY += 30

            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15

            // Liste des présents
            let headerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 16),
                .foregroundColor: UIColor(red: 0, green: 0.6, blue: 0, alpha: 1)
            ]
            "Joueurs présents".draw(at: CGPoint(x: margin, y: currentY), withAttributes: headerAttrs)
            currentY += 25

            let bodyAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12),
                .foregroundColor: UIColor.black
            ]

            let presentPlayers = session.attendances.filter { $0.isPresent }.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
            
            for (index, attendance) in presentPlayers.enumerated() {
                ensureSpace(20)
                let line = "\(index + 1). \(attendance.fullName)"
                line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                currentY += 18
            }

            if presentPlayers.isEmpty {
                "Aucun joueur présent".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                currentY += 18
            }

            currentY += 15
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 15

            // Liste des absents
            let absentHeaderAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 16),
                .foregroundColor: UIColor.systemRed
            ]
            "Joueurs absents".draw(at: CGPoint(x: margin, y: currentY), withAttributes: absentHeaderAttrs)
            currentY += 25

            let absentPlayers = session.attendances.filter { !$0.isPresent }.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }

            for (index, attendance) in absentPlayers.enumerated() {
                ensureSpace(20)
                let line = "\(index + 1). \(attendance.fullName)"
                line.draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                currentY += 18
            }

            if absentPlayers.isEmpty {
                "Aucun joueur absent".draw(at: CGPoint(x: margin + 10, y: currentY), withAttributes: bodyAttrs)
                currentY += 18
            }

            // Footer
            ensureSpace(40)
            currentY += 30
            drawLine(context: context.cgContext, y: currentY, margin: margin, width: contentWidth)
            currentY += 10
            let footer = "Temps De Jeu · \(dateFormatter.string(from: Date()))"
            let footerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 9),
                .foregroundColor: UIColor.lightGray
            ]
            footer.draw(at: CGPoint(x: margin, y: currentY), withAttributes: footerAttrs)
        }
    }

    // MARK: - Helpers

    private func drawLine(context: CGContext, y: CGFloat, margin: CGFloat, width: CGFloat) {
        context.setStrokeColor(UIColor.lightGray.cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: margin, y: y))
        context.addLine(to: CGPoint(x: margin + width, y: y))
        context.strokePath()
    }
}
