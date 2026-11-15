//
//  SequenceBuilder.swift
//  Temps De Jeu
//
//  Construction d'une séquence pas à pas, du point de vue de l'entraîneur.
//  Une étape = une action de ballon (au plus) + autant de courses que voulu :
//    • déplacer un joueur sans ballon      → course
//    • déplacer le joueur qui a le ballon  → conduite (le ballon suit)
//    • lâcher le ballon sur un partenaire  → passe (le ballon se colle à ses pieds)
//    • lâcher le ballon sur un adversaire  → ballon récupéré
//    • lâcher le ballon dans le vide       → passe dans l'espace
//    • lâcher le ballon dans le but        → tir
//

import Foundation

enum SequenceBuilder {

    /// Échelle de mesure pour « coller » le ballon à un joueur
    struct Metric {
        let scaleX: Double
        let scaleY: Double
        let snap: Double

        /// Terrain 3D : en mètres, le ballon se colle à moins de 3,5 m
        static let meters = Metric(scaleX: 68, scaleY: 105, snap: 3.5)

        /// Terrain 2D : en points d'écran, le ballon se colle à moins de 38 pt
        static func points(width: Double, height: Double) -> Metric {
            Metric(scaleX: width, scaleY: height, snap: 38)
        }
    }

    // MARK: - Ballon

    static func nearestActor(to p: TacticPoint, in positions: [String: TacticPoint], metric: Metric) -> String? {
        var best: (id: String, distance: Double)?
        for (id, q) in positions {
            let dx = (q.x - p.x) * metric.scaleX
            let dy = (q.y - p.y) * metric.scaleY
            let d = (dx * dx + dy * dy).squareRoot()
            if d <= metric.snap, d < (best?.distance ?? .infinity) {
                best = (id, d)
            }
        }
        return best?.id
    }

    /// Point « dans le but » si le ballon est lâché près d'un des deux buts
    static func goalTarget(for p: TacticPoint) -> TacticPoint? {
        guard abs(p.x - 0.5) < 0.11 else { return nil }
        let x = min(max(p.x, 0.47), 0.53)
        if p.y < 0.075 { return TacticPoint(x: x, y: 0.004) }
        if p.y > 0.925 { return TacticPoint(x: x, y: 0.996) }
        return nil
    }

    static func isInGoal(_ p: TacticPoint) -> Bool {
        abs(p.x - 0.5) < 0.055 && (p.y <= 0.012 || p.y >= 0.988)
    }

    /// Position du ballon aux pieds d'un joueur
    static func ballAtFeet(of player: TacticPoint, team: TacticTeam?) -> TacticPoint {
        let offset = TacticPlay.ballOffset(for: team)
        return TacticPoint(x: player.x + offset.dx, y: player.y + offset.dy)
    }

    // MARK: - Étapes

    /// Photographie l'état du terrain
    static func makeStep(positions: [String: TacticPoint], holder: String?, ball: TacticPoint?, aerial: Bool) -> TacticStep {
        var step = TacticStep(title: "", text: "", duration: 2.0, positions: positions)
        if let holder, positions[holder] != nil {
            step.ballHolder = holder
        } else if let ball {
            step.ball = ball
            if isInGoal(ball) { step.ballAction = .tir }
        }
        if aerial { step.aerial = true }
        return step
    }

    /// Ce qui se passe entre deux étapes
    struct Transition {
        var arrows: [TacticArrow]
        var summary: String
        var duration: Double
        var hasBallAction: Bool
    }

    static func transition(from previous: TacticStep, to next: TacticStep, actors: [TacticActor]) -> Transition {
        let play = TacticPlay(title: "", category: .perso, actors: actors, steps: [previous, next])
        let frames = play.resolvedFrames()
        let arrows = play.arrows(forStep: 1, frames: frames)
        let before = frames[0]
        let after = frames[1]
        let threshold = 0.012

        func label(_ id: String) -> String {
            guard let actor = play.actor(id) else { return "?" }
            return actor.team == .adversaire ? "adv. n°\(actor.label)" : "n°\(actor.label)"
        }

        var runners = actors.compactMap { actor -> String? in
            guard let p0 = before.positions[actor.id], let p1 = after.positions[actor.id],
                  p0.distance(to: p1) > threshold else { return nil }
            return actor.id
        }

        let hasBall = [previous, next].contains { $0.ballHolder != nil || $0.ball != nil }
        let ballMoved = before.ball.distance(to: after.ball) > threshold
        let aerial = next.aerial == true
        var ballText: String?
        var duration = 2.0

        if hasBall {
            switch (before.ballHolder, after.ballHolder) {
            case let (from?, to?) where from != to:
                if play.actor(from)?.team == play.actor(to)?.team {
                    ballText = aerial ? "Ballon aérien \(label(from)) → \(label(to))" : "Passe \(label(from)) → \(label(to))"
                    duration = aerial ? 2.0 : 1.6
                } else {
                    ballText = "Ballon récupéré par \(label(to))"
                    duration = 1.6
                }
            case let (holder?, same?) where holder == same:
                if runners.contains(holder) {
                    ballText = "Conduite \(label(holder))"
                    runners.removeAll { $0 == holder }
                    duration = 2.2
                }
            case let (holder?, nil):
                if isInGoal(after.ball) {
                    ballText = "Tir \(label(holder))"
                    duration = 1.4
                } else if ballMoved {
                    ballText = aerial ? "Ballon aérien dans l'espace \(label(holder))" : "Passe dans l'espace \(label(holder))"
                    duration = 1.6
                }
            case let (nil, receiver?):
                if ballMoved {
                    ballText = "Ballon contrôlé par \(label(receiver))"
                    duration = 1.6
                }
            case (nil, nil):
                if ballMoved {
                    ballText = isInGoal(after.ball) ? "Tir" : "Ballon déplacé"
                    duration = 1.6
                }
            default:
                break
            }
        }

        var parts: [String] = []
        if let ballText { parts.append(ballText) }
        if !runners.isEmpty {
            parts.append(runners.count == 1 ? "Course \(label(runners[0]))" : "\(runners.count) courses")
        }
        return Transition(
            arrows: arrows,
            summary: parts.isEmpty ? "Aucun mouvement" : parts.joined(separator: " · "),
            duration: ballText == nil && runners.isEmpty ? 1.5 : duration,
            hasBallAction: ballText != nil
        )
    }
}
