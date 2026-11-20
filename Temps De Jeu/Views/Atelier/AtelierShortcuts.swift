//
//  AtelierShortcuts.swift
//  Temps De Jeu
//
//  Atelier : raccourcis qui posent une organisation complète en un geste
//  (carré de plots, rondo, petit jeu avec mini-buts, slalom…).
//  Tout est construit en mètres autour du centre du cadrage.
//

import Foundation

enum AtelierShortcut: Hashable, Identifiable {
    case square(width: Double, length: Double)
    case rondo(outside: Int, inside: Int)
    case game(perSide: Int, jokers: Int)
    case slalom(poles: Int)
    case plotLine(count: Int)
    case ladderHurdles
    case facingGoals
    case hoops(count: Int)

    var id: String { title }

    var title: String {
        switch self {
        case .square(let w, let l): return "Carré \(Int(w)) × \(Int(l)) m"
        case .rondo(let o, let i): return "Rondo \(o) contre \(i)"
        case .game(let n, let j): return j > 0 ? "\(n) contre \(n) + \(j) jokers" : "Jeu \(n) contre \(n)"
        case .slalom(let n): return "Slalom (\(n) piquets)"
        case .plotLine(let n): return "Ligne de \(n) plots"
        case .ladderHurdles: return "Échelle + 3 haies"
        case .facingGoals: return "2 mini-buts face à face"
        case .hoops(let n): return "\(n) cerceaux en zigzag"
        }
    }

    var icon: String {
        switch self {
        case .square: return "square.dashed"
        case .rondo: return "circle.hexagongrid"
        case .game: return "person.3.sequence"
        case .slalom: return "point.topleft.down.to.point.bottomright.curvepath"
        case .plotLine: return "ellipsis"
        case .ladderHurdles: return "figure.run"
        case .facingGoals: return "sportscourt"
        case .hoops: return "circle.circle"
        }
    }

    static let squares: [AtelierShortcut] = [
        .square(width: 10, length: 10), .square(width: 15, length: 15), .square(width: 20, length: 20),
        .square(width: 30, length: 20), .square(width: 40, length: 30)
    ]
    static let games: [AtelierShortcut] = [
        .rondo(outside: 4, inside: 2), .rondo(outside: 5, inside: 2),
        .game(perSide: 3, jokers: 0), .game(perSide: 4, jokers: 0), .game(perSide: 4, jokers: 2),
        .game(perSide: 5, jokers: 0), .game(perSide: 6, jokers: 0), .game(perSide: 8, jokers: 0)
    ]
    static let courses: [AtelierShortcut] = [
        .slalom(poles: 6), .plotLine(count: 6), .ladderHurdles, .hoops(count: 6), .facingGoals
    ]

    // MARK: - Application

    @MainActor
    func apply(to model: AtelierEditorModel, center: TacticPoint) {
        /// Décalage en mètres depuis le centre (dx : largeur, dy : longueur)
        func at(_ dx: Double, _ dy: Double) -> TacticPoint {
            TacticPoint(x: center.x + dx / AtelierViewport.pitchWidth, y: center.y + dy / AtelierViewport.pitchLength)
        }
        func size(_ w: Double, _ l: Double) -> TacticPoint {
            TacticPoint(x: w / AtelierViewport.pitchWidth, y: l / AtelierViewport.pitchLength)
        }
        func corners(_ w: Double, _ l: Double) {
            model.addProp(.zone, at: at(0, 0), color: .blanc, size: size(w, l), recordUndo: false)
            for (sx, sy) in [(-1.0, -1.0), (1, -1), (1, 1), (-1, 1)] {
                model.addProp(.plot, at: at(sx * w / 2, sy * l / 2), recordUndo: false)
            }
        }
        let teamA = model.bibColor
        let teamB: AtelierColor = [AtelierColor.bleu, .rouge, .vert].first { $0 != teamA } ?? .bleu
        let jokerColor: AtelierColor = [AtelierColor.jaune, .orange].first { $0 != teamA && $0 != teamB } ?? .jaune

        switch self {
        case .square(let w, let l):
            corners(w, l)

        case .rondo(let outside, let inside):
            let side = outside <= 4 ? 10.0 : 12.0
            corners(side, side)
            var first: String?
            for i in 0..<outside {
                // Joueurs répartis sur le pourtour, en commençant en bas
                let angle = Double.pi / 2 + 2 * Double.pi * Double(i) / Double(outside)
                let r = side / 2
                let dx = max(-r, min(r, cos(angle) * r * 1.45))
                let dy = max(-r, min(r, sin(angle) * r * 1.45))
                let id = model.addPlayer(at: at(dx, dy), color: teamA, recordUndo: false)
                if first == nil { first = id }
            }
            for i in 0..<inside {
                let dx = inside == 1 ? 0 : (Double(i) - Double(inside - 1) / 2) * 3
                model.addPlayer(at: at(dx, -0.5), color: teamB, recordUndo: false)
            }
            if let first { attachBall(model, to: first) }

        case .game(let n, let jokers):
            let w: Double, l: Double
            switch n {
            case ...3: (w, l) = (20, 25)
            case 4: (w, l) = (25, 30)
            case 5: (w, l) = (30, 35)
            case 6: (w, l) = (30, 40)
            default: (w, l) = (40, 50)
            }
            corners(w, l)
            model.addProp(.miniBut, at: at(0, -l / 2 - 0.5), rotation: 0, recordUndo: false)
            model.addProp(.miniBut, at: at(0, l / 2 + 0.5), rotation: 180, recordUndo: false)
            var first: String?
            for (color, sign) in [(teamA, 1.0), (teamB, -1.0)] {
                for (i, p) in Self.spread(n, width: w * 0.75, depth: l * 0.32).enumerated() {
                    // Équipe A en bas (attaque vers le haut), équipe B en haut
                    let id = model.addPlayer(at: at(p.0 * sign, sign * (l * 0.08 + p.1)), color: color, recordUndo: false)
                    if color == teamA && i == 0 { first = id }
                }
            }
            for j in 0..<jokers {
                let dx = (j % 2 == 0 ? -1.0 : 1.0) * (w / 2 + 1.5)
                model.addPlayer(at: at(dx, 0), color: jokerColor, recordUndo: false)
            }
            if let first { attachBall(model, to: first) }

        case .slalom(let poles):
            let spacing = 2.0
            let total = Double(poles - 1) * spacing
            model.addProp(.plot, at: at(0, total / 2 + 3), recordUndo: false)
            for i in 0..<poles {
                model.addProp(.piquet, at: at(0, total / 2 - Double(i) * spacing), recordUndo: false)
            }

        case .plotLine(let count):
            let spacing = 3.0
            let total = Double(count - 1) * spacing
            for i in 0..<count {
                model.addProp(.plot, at: at(-total / 2 + Double(i) * spacing, 0), recordUndo: false)
            }

        case .ladderHurdles:
            model.addProp(.plot, at: at(0, 6), recordUndo: false)
            model.addProp(.echelle, at: at(0, 2), recordUndo: false)
            for i in 0..<3 {
                model.addProp(.haie, at: at(0, -1.5 - Double(i) * 1.5), recordUndo: false)
            }

        case .facingGoals:
            model.addProp(.miniBut, at: at(0, -10), rotation: 0, recordUndo: false)
            model.addProp(.miniBut, at: at(0, 10), rotation: 180, recordUndo: false)

        case .hoops(let count):
            for i in 0..<count {
                model.addProp(.cerceau, at: at(i % 2 == 0 ? -0.6 : 0.6, 4 - Double(i) * 1.1), recordUndo: false)
            }
        }
    }

    @MainActor
    private func attachBall(_ model: AtelierEditorModel, to id: String) {
        guard !model.hasBall else { return }
        model.placeBallSilently(holder: id)
    }

    /// Répartit n joueurs sur quelques lignes (mètres : dx, profondeur depuis la ligne médiane)
    static func spread(_ n: Int, width: Double, depth: Double) -> [(Double, Double)] {
        guard n > 0 else { return [] }
        let rows: [Int]
        switch n {
        case 1: rows = [1]
        case 2: rows = [2]
        case 3: rows = [2, 1]
        case 4: rows = [2, 2]
        case 5: rows = [2, 3]
        case 6: rows = [3, 3]
        case 7: rows = [3, 4]
        default: rows = [3, 3, n - 6]
        }
        var result: [(Double, Double)] = []
        for (r, count) in rows.enumerated() {
            let dy = rows.count == 1 ? depth / 2 : depth * Double(r) / Double(rows.count - 1)
            for i in 0..<count {
                let dx = count == 1 ? 0 : -width / 2 + width * Double(i) / Double(count - 1)
                result.append((dx, dy))
            }
        }
        return result
    }
}
