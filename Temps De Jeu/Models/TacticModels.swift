//
//  TacticModels.swift
//  Temps De Jeu
//
//  Format des fichiers tactiques (.tdjt) : séquences d'entraînement
//  animées pas à pas, en 2D comme en 3D.
//
//  Repère : coordonnées normalisées 0…1, identiques à la vue Placement.
//    x = largeur du terrain (0 = touche gauche, 1 = touche droite)
//    y = longueur (0 = but attaqué par « mon équipe », 1 = mon but)
//

import Foundation

// MARK: - Point normalisé

struct TacticPoint: Hashable {
    var x: Double
    var y: Double

    init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }

    func distance(to other: TacticPoint) -> Double {
        let dx = x - other.x
        let dy = y - other.y
        return (dx * dx + dy * dy).squareRoot()
    }

    func interpolated(to other: TacticPoint, t: Double) -> TacticPoint {
        TacticPoint(x: x + (other.x - x) * t, y: y + (other.y - y) * t)
    }
}

extension TacticPoint: Codable {
    private enum CodingKeys: String, CodingKey { case x, y }

    /// Encodé en tableau `[x, y]` (fichiers compacts) ; accepte aussi `{"x":…, "y":…}`.
    init(from decoder: Decoder) throws {
        if var array = try? decoder.unkeyedContainer() {
            x = try array.decode(Double.self)
            y = try array.decode(Double.self)
        } else {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            x = try c.decode(Double.self, forKey: .x)
            y = try c.decode(Double.self, forKey: .y)
        }
    }

    func encode(to encoder: Encoder) throws {
        var array = encoder.unkeyedContainer()
        try array.encode((x * 1000).rounded() / 1000)
        try array.encode((y * 1000).rounded() / 1000)
    }
}

// MARK: - Camp d'un acteur

enum TacticTeam: String, Codable, CaseIterable {
    case equipe       // Mon équipe (attaque vers y = 0)
    case adversaire   // Équipe adverse
    case joker        // Joueur neutre / appui

    var displayName: String {
        switch self {
        case .equipe: return "Mon équipe"
        case .adversaire: return "Adversaires"
        case .joker: return "Jokers"
        }
    }
}

// MARK: - Acteur (joueur)

struct TacticActor: Codable, Identifiable, Hashable {
    var id: String
    var team: TacticTeam
    var label: String          // Numéro ou lettre affichée sur le maillot
    var name: String?          // Ex : « Latéral droit »
    var position: PlayerPosition?
    /// Couleur de chasuble choisie dans l'Atelier (`BibColor.rawValue`).
    /// Absente : couleur du camp (mon équipe / adversaires / jokers).
    var bib: String?

    var isGoalkeeper: Bool { position == .gardien }

    private enum CodingKeys: String, CodingKey {
        case id
        case team = "camp"
        case label = "numero"
        case name = "nom"
        case position = "poste"
        case bib = "chasuble"
    }

    init(id: String, team: TacticTeam, label: String, name: String? = nil, position: PlayerPosition? = nil,
         bib: String? = nil) {
        self.id = id
        self.team = team
        self.label = label
        self.name = name
        self.position = position
        self.bib = bib
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        team = (try? c.decode(TacticTeam.self, forKey: .team)) ?? .equipe
        label = (try? c.decode(String.self, forKey: .label))
            ?? (try? c.decode(Int.self, forKey: .label)).map(String.init)
            ?? ""
        name = try c.decodeIfPresent(String.self, forKey: .name)
        position = try? c.decodeIfPresent(PlayerPosition.self, forKey: .position)
        bib = try? c.decodeIfPresent(String.self, forKey: .bib)
    }
}

// MARK: - Matériel (plots, mini-buts, zones…)

enum TacticPropKind: String, Codable, CaseIterable {
    case plot
    case miniBut = "mini-but"
    case mannequin
    case zone
    case piquet
    case coupelle
    case but
    case cerceau
    case echelle
    case haie
    case ballon

    /// Un type inconnu (fichier d'une version plus récente) devient un plot
    init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = TacticPropKind(rawValue: raw.lowercased()) ?? .plot
    }
}

struct TacticProp: Codable, Hashable {
    var kind: TacticPropKind
    var position: TacticPoint     // Centre
    var size: TacticPoint?        // Largeur / longueur normalisées (zones)
    var color: String?            // jaune, orange, rouge, bleu, blanc, vert
    var rotation: Double?         // Degrés (mini-buts)

    private enum CodingKeys: String, CodingKey {
        case kind = "type"
        case position = "pos"
        case size = "taille"
        case color = "couleur"
        case rotation
    }

    init(kind: TacticPropKind, position: TacticPoint, size: TacticPoint? = nil, color: String? = nil, rotation: Double? = nil) {
        self.kind = kind
        self.position = position
        self.size = size
        self.color = color
        self.rotation = rotation
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = (try? c.decode(TacticPropKind.self, forKey: .kind)) ?? .plot
        position = try c.decode(TacticPoint.self, forKey: .position)
        size = try? c.decodeIfPresent(TacticPoint.self, forKey: .size)
        color = try? c.decodeIfPresent(String.self, forKey: .color)
        rotation = try? c.decodeIfPresent(Double.self, forKey: .rotation)
    }
}

// MARK: - Flèches

enum TacticArrowKind: String, Codable, CaseIterable {
    case course      // Déplacement sans ballon (pointillés)
    case passe       // Passe (trait plein)
    case conduite    // Conduite de balle (ondulée)
    case tir         // Frappe

    var displayName: String {
        switch self {
        case .course: return "Course"
        case .passe: return "Passe"
        case .conduite: return "Conduite"
        case .tir: return "Tir"
        }
    }
}

struct TacticArrow: Codable, Hashable {
    var kind: TacticArrowKind
    var from: TacticPoint
    var to: TacticPoint
    /// Ballon en l'air (tracé courbe)
    var aerial: Bool? = nil
    /// Camp du joueur qui court (calculé, non enregistré) — sert à la couleur
    var team: TacticTeam? = nil

    private enum CodingKeys: String, CodingKey {
        case kind = "type"
        case from = "de"
        case to = "a"
        case aerial = "aerien"
    }
}

/// Action du ballon pendant une étape (sinon déduite automatiquement)
enum TacticBallAction: String, Codable {
    case passe, conduite, tir, centre
}

// MARK: - Étape

struct TacticStep: Codable, Hashable {
    var title: String
    var text: String
    /// Durée de l'animation de transition vers cette étape (secondes)
    var duration: Double?
    /// Positions en fin d'étape. Les acteurs absents ne bougent pas.
    var positions: [String: TacticPoint]
    /// Joueur qui a le ballon en fin d'étape (le ballon suit ce joueur)
    var ballHolder: String?
    /// Ballon libre en fin d'étape (ignoré si `ballHolder` est renseigné)
    var ball: TacticPoint?
    var ballAction: TacticBallAction?
    /// Ballon aérien (centre, transversale, dégagement)
    var aerial: Bool?
    /// Flèches supplémentaires (s'ajoutent aux flèches calculées)
    var arrows: [TacticArrow]?
    /// Acteurs mis en évidence pendant l'étape
    var highlight: [String]?
    /// Ballons en plus du premier (Atelier), par identifiant : « ballon-2 », « ballon-3 »…
    /// Même principe que le premier : seul ce qui change dans l'étape est noté.
    var otherBalls: [String: TacticBallState]?

    private enum CodingKeys: String, CodingKey {
        case title = "titre"
        case text = "texte"
        case duration = "duree"
        case positions
        case ballHolder = "porteur"
        case ball = "ballon"
        case ballAction = "action"
        case aerial = "aerien"
        case arrows = "fleches"
        case highlight = "focus"
        case otherBalls = "autresBallons"
    }

    init(title: String, text: String, duration: Double? = nil, positions: [String: TacticPoint],
         ballHolder: String? = nil, ball: TacticPoint? = nil, ballAction: TacticBallAction? = nil,
         aerial: Bool? = nil, arrows: [TacticArrow]? = nil, highlight: [String]? = nil) {
        self.title = title
        self.text = text
        self.duration = duration
        self.positions = positions
        self.ballHolder = ballHolder
        self.ball = ball
        self.ballAction = ballAction
        self.aerial = aerial
        self.arrows = arrows
        self.highlight = highlight
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        text = (try? c.decode(String.self, forKey: .text)) ?? ""
        duration = try c.decodeIfPresent(Double.self, forKey: .duration)
        positions = (try? c.decode([String: TacticPoint].self, forKey: .positions)) ?? [:]
        ballHolder = try c.decodeIfPresent(String.self, forKey: .ballHolder)
        ball = try c.decodeIfPresent(TacticPoint.self, forKey: .ball)
        ballAction = try? c.decodeIfPresent(TacticBallAction.self, forKey: .ballAction)
        aerial = try c.decodeIfPresent(Bool.self, forKey: .aerial)
        arrows = try c.decodeIfPresent([TacticArrow].self, forKey: .arrows)
        highlight = try c.decodeIfPresent([String].self, forKey: .highlight)
        otherBalls = try? c.decodeIfPresent([String: TacticBallState].self, forKey: .otherBalls)
    }

    static let defaultDuration: Double = 2.0

    /// Ce que fait le ballon `id` dans cette étape (nil : il ne change pas de place)
    func ballState(_ id: String) -> TacticBallState? {
        guard id == TacticPlay.mainBall else { return otherBalls?[id] }
        guard ballHolder != nil || ball != nil else { return nil }
        return TacticBallState(holder: ballHolder, position: ball, action: ballAction, aerial: aerial)
    }

    mutating func setBallState(_ id: String, _ state: TacticBallState?) {
        let state = state?.isEmpty == true ? nil : state
        if id == TacticPlay.mainBall {
            ballHolder = state?.holder
            ball = state?.holder == nil ? state?.position : nil
            ballAction = state?.action
            aerial = state?.aerial
        } else {
            var balls = otherBalls ?? [:]
            balls[id] = state
            otherBalls = balls.isEmpty ? nil : balls
        }
    }
}

/// Un ballon dans une étape : au pied d'un joueur, ou libre à une position
struct TacticBallState: Codable, Hashable {
    var holder: String?
    var position: TacticPoint?
    var action: TacticBallAction?
    var aerial: Bool?

    private enum CodingKeys: String, CodingKey {
        case holder = "porteur"
        case position
        case action
        case aerial = "aerien"
    }

    init(holder: String? = nil, position: TacticPoint? = nil, action: TacticBallAction? = nil, aerial: Bool? = nil) {
        self.holder = holder
        self.position = position
        self.action = action
        self.aerial = aerial
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        holder = try? c.decodeIfPresent(String.self, forKey: .holder)
        position = try? c.decodeIfPresent(TacticPoint.self, forKey: .position)
        action = try? c.decodeIfPresent(TacticBallAction.self, forKey: .action)
        aerial = try? c.decodeIfPresent(Bool.self, forKey: .aerial)
    }

    var isEmpty: Bool { holder == nil && position == nil }
    var isAerial: Bool { aerial ?? (action == .centre) }
}

// MARK: - Catégorie

enum TacticCategory: String, Codable, CaseIterable, Identifiable {
    case conservation
    case construction
    case attaque
    case finition
    case pressing
    case defense
    case transition
    case cpa
    case perso
    case autre

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .conservation: return "Conservation & rondos"
        case .construction: return "Construction du jeu"
        case .attaque: return "Animation offensive"
        case .finition: return "Finition"
        case .pressing: return "Pressing"
        case .defense: return "Organisation défensive"
        case .transition: return "Transitions"
        case .cpa: return "Coups de pied arrêtés"
        case .perso: return "Mes séquences"
        case .autre: return "Autres"
        }
    }

    var icon: String {
        switch self {
        case .conservation: return "circle.hexagongrid.fill"
        case .construction: return "arrow.up.forward.circle.fill"
        case .attaque: return "bolt.circle.fill"
        case .finition: return "scope"
        case .pressing: return "flame.fill"
        case .defense: return "shield.lefthalf.filled"
        case .transition: return "arrow.triangle.2.circlepath"
        case .cpa: return "flag.fill"
        case .perso: return "person.crop.square.filled.and.at.rectangle"
        case .autre: return "square.grid.2x2.fill"
        }
    }

    init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = TacticCategory(rawValue: raw.lowercased()) ?? .autre
    }
}

// MARK: - Tactique complète

struct TacticPlay: Codable, Identifiable, Hashable {
    var id: UUID
    var title: String
    var category: TacticCategory
    var level: String?
    var duration: String?
    var headcount: String?
    var objective: String
    var instructions: [String]
    var source: String?
    var actors: [TacticActor]
    var props: [TacticProp]
    var steps: [TacticStep]
    /// Variantes de l'exercice (même terrain, consignes différentes) — Atelier
    var evolutions: [TacticEvolution]?
    /// Partie du terrain affichée dans l'Atelier
    var framing: TacticFraming?
    /// Tactique créée ou importée par l'utilisateur (modifiable / supprimable)
    var isUserCreated: Bool
    var createdAt: Date?

    private enum CodingKeys: String, CodingKey {
        case id
        case title = "titre"
        case category = "categorie"
        case level = "niveau"
        case duration = "duree"
        case headcount = "effectif"
        case objective = "objectif"
        case instructions = "consignes"
        case source
        case actors = "acteurs"
        case props = "materiel"
        case steps = "etapes"
        case evolutions
        case framing = "cadrage"
        case isUserCreated = "perso"
        case createdAt = "creeLe"
    }

    init(id: UUID = UUID(), title: String, category: TacticCategory, level: String? = nil,
         duration: String? = nil, headcount: String? = nil, objective: String = "",
         instructions: [String] = [], source: String? = nil, actors: [TacticActor],
         props: [TacticProp] = [], steps: [TacticStep], evolutions: [TacticEvolution]? = nil,
         framing: TacticFraming? = nil, isUserCreated: Bool = false, createdAt: Date? = nil) {
        self.id = id
        self.title = title
        self.category = category
        self.level = level
        self.duration = duration
        self.headcount = headcount
        self.objective = objective
        self.instructions = instructions
        self.source = source
        self.actors = actors
        self.props = props
        self.steps = steps
        self.evolutions = evolutions
        self.framing = framing
        self.isUserCreated = isUserCreated
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Un id texte non-UUID (fichier écrit à la main) est converti de façon stable
        if let uuid = try? c.decode(UUID.self, forKey: .id) {
            id = uuid
        } else if let raw = try? c.decode(String.self, forKey: .id) {
            id = UUID.stable(from: raw)
        } else {
            id = UUID()
        }
        title = (try? c.decode(String.self, forKey: .title)) ?? "Tactique"
        category = (try? c.decode(TacticCategory.self, forKey: .category)) ?? .autre
        level = try c.decodeIfPresent(String.self, forKey: .level)
        duration = try c.decodeIfPresent(String.self, forKey: .duration)
        headcount = try c.decodeIfPresent(String.self, forKey: .headcount)
        objective = (try? c.decode(String.self, forKey: .objective)) ?? ""
        instructions = (try? c.decode([String].self, forKey: .instructions)) ?? []
        source = try c.decodeIfPresent(String.self, forKey: .source)
        actors = try c.decode([TacticActor].self, forKey: .actors)
        props = (try? c.decode([TacticProp].self, forKey: .props)) ?? []
        steps = try c.decode([TacticStep].self, forKey: .steps)
        evolutions = try? c.decodeIfPresent([TacticEvolution].self, forKey: .evolutions)
        framing = try? c.decodeIfPresent(TacticFraming.self, forKey: .framing)
        isUserCreated = (try? c.decode(Bool.self, forKey: .isUserCreated)) ?? false
        createdAt = try? c.decodeIfPresent(Date.self, forKey: .createdAt)
    }

    var summary: String {
        var parts: [String] = []
        if let headcount, !headcount.isEmpty { parts.append(headcount) }
        parts.append("\(steps.count) étape\(steps.count > 1 ? "s" : "")")
        if let duration, !duration.isEmpty { parts.append(duration) }
        return parts.joined(separator: " · ")
    }

    func actor(_ id: String) -> TacticActor? {
        actors.first { $0.id == id }
    }

    /// La tactique utilise-t-elle un ballon ? (le premier ; les autres : `ballIds`)
    var hasBall: Bool {
        steps.contains { $0.ballHolder != nil || $0.ball != nil }
    }

    /// Identifiant du premier ballon (champs `porteur` / `ballon` des étapes)
    static let mainBall = "ballon"

    /// Numéro d'un ballon : 1 pour le premier, 2 pour « ballon-2 »…
    static func ballNumber(_ id: String) -> Int {
        id == mainBall ? 1 : Int(id.split(separator: "-").last ?? "") ?? 99
    }

    /// Tous les ballons de l'exercice, le premier d'abord
    var ballIds: [String] { Self.ballIds(in: steps) }

    static func ballIds(in steps: [TacticStep]) -> [String] {
        var others = Set<String>()
        for step in steps {
            if let keys = step.otherBalls?.keys { others.formUnion(keys) }
        }
        let main = steps.contains { $0.ballHolder != nil || $0.ball != nil }
        return (main ? [mainBall] : []) + others.sorted { ballNumber($0) < ballNumber($1) }
    }

    /// Résumé du matériel (« 8 plots · 2 mini-buts »)
    var equipmentSummary: String? {
        guard !props.isEmpty else { return nil }
        return TacticPropKind.allCases.compactMap { kind in
            let count = props.filter { $0.kind == kind }.count
            guard count > 0 else { return nil }
            return kind.counted(count)
        }.joined(separator: " · ")
    }
}

// MARK: - États résolus (pour l'animation)

/// État complet du terrain à la fin d'une étape
struct TacticFrame: Equatable {
    var positions: [String: TacticPoint]
    var ballHolder: String?
    var ball: TacticPoint
    /// Autres ballons (Atelier), par identifiant
    var otherBalls: [String: TacticFrameBall] = [:]

    /// Le ballon `id` : le premier existe toujours, les autres une fois posés
    func ball(_ id: String) -> TacticFrameBall? {
        id == TacticPlay.mainBall ? TacticFrameBall(holder: ballHolder, point: ball) : otherBalls[id]
    }

    /// Ce joueur a-t-il un des ballons `ids` au pied ?
    func holdsBall(_ actorId: String, among ids: [String]) -> Bool {
        ids.contains { ball($0)?.holder == actorId }
    }
}

struct TacticFrameBall: Equatable {
    var holder: String?
    var point: TacticPoint
}

extension TacticPlay {
    /// Décalage du ballon par rapport au porteur : pied droit, légèrement vers le but attaqué
    /// (≈ 1,1 m sur le côté, 0,6 m devant) pour rester visible depuis la caméra.
    static func ballOffset(for team: TacticTeam?) -> (dx: Double, dy: Double) {
        switch team {
        case .adversaire: return (-0.016, 0.006)
        case .joker: return (0.016, 0)
        default: return (0.016, -0.006)
        }
    }

    /// Calcule l'état complet de chaque étape (positions héritées des étapes précédentes)
    func resolvedFrames() -> [TacticFrame] {
        var positions: [String: TacticPoint] = [:]
        var main = TacticFrameBall(holder: nil, point: TacticPoint(x: 0.5, y: 0.5))
        var others: [String: TacticFrameBall] = [:]
        var frames: [TacticFrame] = []

        /// Applique ce que l'étape dit d'un ballon, puis le recolle au pied de son porteur
        func advance(_ ball: inout TacticFrameBall, _ state: TacticBallState?) {
            if let state {
                if let h = state.holder, positions[h] != nil {
                    ball.holder = h
                } else if var b = state.position {
                    ball.holder = nil
                    // Un tir cadré finit au fond des filets (≈ 1,2 m derrière la ligne)
                    if state.action == .tir, abs(b.x - 0.5) < 0.05 {
                        if b.y <= 0.012 { b.y = -0.011 } else if b.y >= 0.988 { b.y = 1.011 }
                    }
                    ball.point = b
                }
            }
            if let h = ball.holder, let p = positions[h] {
                let offset = Self.ballOffset(for: actor(h)?.team)
                ball.point = TacticPoint(x: p.x + offset.dx, y: p.y + offset.dy)
            }
        }

        for step in steps {
            for (key, value) in step.positions { positions[key] = value }
            advance(&main, step.ballState(Self.mainBall))
            var ids = Set(others.keys)
            if let keys = step.otherBalls?.keys { ids.formUnion(keys) }
            for id in ids {
                var ball = others[id] ?? TacticFrameBall(holder: nil, point: TacticPoint(x: 0.5, y: 0.5))
                advance(&ball, step.otherBalls?[id])
                others[id] = ball
            }
            frames.append(TacticFrame(positions: positions, ballHolder: main.holder, ball: main.point, otherBalls: others))
        }
        return frames
    }

    /// Le ballon passe-t-il en l'air pendant cette étape ?
    func isAerial(step index: Int, ball id: String = TacticPlay.mainBall) -> Bool {
        guard steps.indices.contains(index) else { return false }
        let step = steps[index]
        if id == Self.mainBall { return step.aerial ?? (step.ballAction == .centre) }
        return step.otherBalls?[id]?.isAerial ?? false
    }

    /// Ballons qui passent en l'air pendant cette étape
    func aerialBalls(step index: Int) -> Set<String> {
        Set(ballIds.filter { isAerial(step: index, ball: $0) })
    }

    /// Flèches décrivant le mouvement qui mène à l'étape `index`
    func arrows(forStep index: Int, frames: [TacticFrame]) -> [TacticArrow] {
        guard steps.indices.contains(index), frames.indices.contains(index) else { return [] }
        let extra = steps[index].arrows ?? []
        guard index > 0 else { return extra }

        let before = frames[index - 1]
        let after = frames[index]
        var result: [TacticArrow] = []
        let threshold = 0.012   // ≈ 1 m

        let balls = ballIds
        for actor in actors {
            guard let p0 = before.positions[actor.id], let p1 = after.positions[actor.id],
                  p0.distance(to: p1) > threshold else { continue }
            let dribbling = balls.contains { id in
                before.ball(id)?.holder == actor.id && after.ball(id)?.holder == actor.id
            }
            result.append(TacticArrow(kind: dribbling ? .conduite : .course, from: p0, to: p1, team: actor.team))
        }

        for id in balls {
            guard let b0 = before.ball(id), let b1 = after.ball(id) else { continue }
            let carried = b0.holder != nil && b0.holder == b1.holder
            guard !carried, b0.point.distance(to: b1.point) > threshold else { continue }
            let action = id == Self.mainBall ? steps[index].ballAction : steps[index].otherBalls?[id]?.action
            let kind: TacticArrowKind
            switch action {
            case .tir: kind = .tir
            case .conduite: kind = .conduite
            default: kind = .passe
            }
            result.append(TacticArrow(kind: kind, from: b0.point, to: b1.point, aerial: isAerial(step: index, ball: id)))
        }
        return result + extra
    }

    /// Zone utile (toutes positions + matériel), pour cadrer la caméra
    func focusBounds() -> (min: TacticPoint, max: TacticPoint) {
        var points: [TacticPoint] = []
        for step in steps {
            points.append(contentsOf: step.positions.values)
            if let b = step.ball { points.append(b) }
            points.append(contentsOf: (step.otherBalls ?? [:]).values.compactMap(\.position))
        }
        for prop in props {
            let w = (prop.size?.x ?? 0) / 2
            let h = (prop.size?.y ?? 0) / 2
            points.append(TacticPoint(x: prop.position.x - w, y: prop.position.y - h))
            points.append(TacticPoint(x: prop.position.x + w, y: prop.position.y + h))
        }
        guard let first = points.first else {
            return (TacticPoint(x: 0, y: 0), TacticPoint(x: 1, y: 1))
        }
        var lo = first, hi = first
        for p in points {
            lo.x = min(lo.x, p.x); lo.y = min(lo.y, p.y)
            hi.x = max(hi.x, p.x); hi.y = max(hi.y, p.y)
        }
        return (lo, hi)
    }
}

// MARK: - Fichier .tdjt

struct TacticFile: Codable {
    var format: String
    var version: Int
    var tactics: [TacticPlay]

    static let formatIdentifier = "tempsdejeu.tactique"

    private enum CodingKeys: String, CodingKey {
        case format, version
        case tactics = "tactiques"
    }

    init(tactics: [TacticPlay]) {
        self.format = Self.formatIdentifier
        self.version = 1
        self.tactics = tactics
    }

    /// Décode un fichier `.tdjt` : conteneur `{tactiques: […]}`, tactique seule ou tableau.
    static func decode(from data: Data) throws -> [TacticPlay] {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let file = try? decoder.decode(TacticFile.self, from: data) {
            return file.tactics
        }
        if let single = try? decoder.decode(TacticPlay.self, from: data) {
            return [single]
        }
        return try decoder.decode([TacticPlay].self, from: data)
    }

    static func encode(_ tactics: [TacticPlay]) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(TacticFile(tactics: tactics))
    }
}

// MARK: - UUID stable

extension UUID {
    /// UUID déterministe dérivé d'un texte (FNV-1a 128 bits simplifié)
    static func stable(from text: String) -> UUID {
        var h1: UInt64 = 0xcbf29ce484222325
        var h2: UInt64 = 0x84222325cbf29ce4
        for byte in text.utf8 {
            h1 = (h1 ^ UInt64(byte)) &* 0x100000001b3
            h2 = (h2 ^ UInt64(byte)) &* 0x100000001b3 &+ 0x9e3779b97f4a7c15
        }
        var bytes = [UInt8](repeating: 0, count: 16)
        for i in 0..<8 {
            bytes[i] = UInt8((h1 >> (UInt64(i) * 8)) & 0xff)
            bytes[i + 8] = UInt8((h2 >> (UInt64(i) * 8)) & 0xff)
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x50   // version 5-like
        bytes[8] = (bytes[8] & 0x3f) | 0x80   // variant RFC 4122
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }
}
