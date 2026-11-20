//
//  AtelierEditorModel.swift
//  Temps De Jeu
//
//  Atelier : état de l'éditeur d'exercice (outil, sélection, vignette,
//  évolution, annuler / rétablir) et toutes les modifications du terrain.
//
//  Principe des vignettes : la vignette 0 (« Départ ») est la mise en place,
//  elle contient la position de chaque joueur. Une vignette suivante ne garde
//  que ce qui change : un joueur que l'on n'a pas bougé suit la vignette d'avant.
//

import SwiftUI
import Combine

/// Outil choisi dans le tiroir (reste actif : on peut poser plusieurs objets d'affilée)
enum AtelierTool: Equatable {
    case player
    case goalkeeper
    case ball
    case prop(TacticPropKind)
    /// Glisser sur le terrain : une ligne de plots
    case line
}

enum AtelierSelection: Equatable {
    case actor(String)
    case prop(Int)
    case ball
}

@MainActor
final class AtelierEditorModel: ObservableObject {
    @Published private(set) var play: TacticPlay
    /// nil = exercice de base, sinon index de l'évolution affichée
    @Published private(set) var evolution: Int?
    @Published var vignette = 0
    @Published var tool: AtelierTool?
    @Published var selection: AtelierSelection?
    /// Couleur courante des chasubles / du matériel (outil et objet sélectionné)
    @Published var bibColor: AtelierColor = .rouge
    @Published var propColor: AtelierColor = .orange
    @Published var showGrid = false
    @Published private(set) var canUndo = false
    @Published private(set) var canRedo = false
    @Published private(set) var isDirty = false

    private var undoStack: [(TacticPlay, Int?, Int)] = []
    private var redoStack: [(TacticPlay, Int?, Int)] = []

    init(play: TacticPlay, startVignette: Int = 0) {
        var copy = play
        if copy.steps.isEmpty {
            copy.steps = [TacticStep(title: "Mise en place", text: "", positions: [:])]
        }
        // Exercice venu d'ailleurs (bibliothèque, Placement, fichier) : cadré sur son contenu
        if copy.framing == nil {
            let points = AtelierDiagram.contentPoints(copy)
            copy.framing = points.isEmpty ? .center : TacticFraming.fitting(points, marginMeters: 4, minMeters: 14)
        }
        // Date fixée une fois pour toutes : les enregistrements successifs gardent la même
        if copy.createdAt == nil { copy.createdAt = Date() }
        self.play = copy
        vignette = min(max(0, startVignette), max(0, copy.content.steps.count - 1))
        if let first = copy.actors.first(where: { !$0.isGoalkeeper }) { bibColor = first.bibColor }
    }

    static func newExercise() -> TacticPlay {
        let date = Date().formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "fr_FR")))
        return TacticPlay(title: "Exercice du \(date)", category: .perso, objective: "", actors: [],
                          steps: [TacticStep(title: "Mise en place", text: "", positions: [:])],
                          framing: .center, isUserCreated: true, createdAt: Date())
    }

    // MARK: - Contenu courant (base ou évolution)

    var content: TacticContent {
        if let evolution, let evo = play.evolutions?[safe: evolution] { return evo.content }
        return play.content
    }

    /// Exercice tel qu'affiché (base ou évolution), pour le dessin et la lecture
    var current: TacticPlay { play.variant(evolution) }

    var frames: [TacticFrame] { current.resolvedFrames() }

    var framing: TacticFraming { play.framing ?? .center }

    var stepCount: Int { content.steps.count }

    var currentFrame: TacticFrame? {
        let f = frames
        return f[safe: min(vignette, f.count - 1)]
    }

    var hasBall: Bool { current.hasBall }

    // MARK: - Annuler / rétablir

    /// À appeler avant chaque modification (une seule fois par geste)
    func checkpoint() {
        undoStack.append((play, evolution, vignette))
        if undoStack.count > 150 { undoStack.removeFirst() }
        redoStack.removeAll()
        canUndo = true
        canRedo = false
        isDirty = true
    }

    func undo() {
        guard let last = undoStack.popLast() else { return }
        redoStack.append((play, evolution, vignette))
        restore(last)
    }

    func redo() {
        guard let next = redoStack.popLast() else { return }
        undoStack.append((play, evolution, vignette))
        restore(next)
    }

    private func restore(_ state: (TacticPlay, Int?, Int)) {
        play = state.0
        evolution = state.1
        vignette = min(state.2, max(0, content.steps.count - 1))
        selection = nil
        canUndo = !undoStack.isEmpty
        canRedo = !redoStack.isEmpty
        isDirty = true
    }

    private func mutate(_ change: (inout TacticContent) -> Void) {
        if let evolution, var evo = play.evolutions?[safe: evolution] {
            var c = evo.content
            change(&c)
            evo.content = c
            play.evolutions?[evolution] = evo
        } else {
            var c = play.content
            change(&c)
            play.content = c
        }
        isDirty = true
    }

    func updateInfo(_ change: (inout TacticPlay) -> Void) {
        checkpoint()
        change(&play)
    }

    // MARK: - Cadrage

    func setFraming(_ framing: TacticFraming) {
        checkpoint()
        play.framing = framing
    }

    func fitFraming() {
        let points = AtelierDiagram.contentPoints(current)
        setFraming(points.isEmpty ? .center : TacticFraming.fitting(points, marginMeters: 4, minMeters: 14))
    }

    // MARK: - Ajouts

    private func nextLabel(for color: AtelierColor) -> String {
        let used = Set(content.actors.filter { $0.bibColor == color }.map(\.label))
        var n = 1
        while used.contains("\(n)") { n += 1 }
        return "\(n)"
    }

    private func team(for color: AtelierColor) -> TacticTeam {
        // Le camp sert à l'orientation du ballon et aux couleurs par défaut en 3D
        switch color {
        case .bleu: return .equipe
        case .jaune, .orange: return .joker
        default: return .adversaire
        }
    }

    @discardableResult
    func addPlayer(at point: TacticPoint, color: AtelierColor? = nil, goalkeeper: Bool = false,
                   label: String? = nil, recordUndo: Bool = true) -> String {
        if recordUndo { checkpoint() }
        let color = color ?? (goalkeeper ? .vert : bibColor)
        let id = "j-" + UUID().uuidString.prefix(8).lowercased()
        let actor = TacticActor(id: id, team: team(for: color), label: label ?? (goalkeeper ? "G" : nextLabel(for: color)),
                                position: goalkeeper ? .gardien : nil, bib: color.rawValue)
        mutate { c in
            c.actors.append(actor)
            c.steps[0].positions[id] = point.clamped
        }
        return id
    }

    @discardableResult
    func addProp(_ kind: TacticPropKind, at point: TacticPoint, color: AtelierColor? = nil,
                 size: TacticPoint? = nil, rotation: Double? = nil, recordUndo: Bool = true) -> Int {
        if recordUndo { checkpoint() }
        var prop = TacticProp(kind: kind, position: point.clamped)
        if kind.hasColor { prop.color = (color ?? propColor).rawValue }
        if kind == .zone {
            prop.color = (color ?? .blanc).rawValue
            prop.size = size ?? TacticPoint(x: 20 / AtelierViewport.pitchWidth, y: 15 / AtelierViewport.pitchLength)
        }
        if let rotation { prop.rotation = rotation }
        var index = 0
        mutate { c in
            c.props.append(prop)
            index = c.props.count - 1
        }
        return index
    }

    /// Ligne de plots entre deux points (un plot tous les ~3 m)
    func addLine(from a: TacticPoint, to b: TacticPoint) {
        let meters = hypot((b.x - a.x) * AtelierViewport.pitchWidth, (b.y - a.y) * AtelierViewport.pitchLength)
        let count = max(2, min(20, Int((meters / 3).rounded()) + 1))
        checkpoint()
        for i in 0..<count {
            let t = Double(i) / Double(count - 1)
            addProp(.plot, at: a.interpolated(to: b, t: t), recordUndo: false)
        }
    }

    /// Pose le ballon : au pied d'un joueur ou libre (toujours sur la mise en place)
    func placeBall(at point: TacticPoint, holder: String?) {
        checkpoint()
        mutate { c in
            if let holder {
                c.steps[0].ballHolder = holder
                c.steps[0].ball = nil
            } else {
                c.steps[0].ballHolder = nil
                c.steps[0].ball = point.clamped
            }
        }
        selection = .ball
    }

    /// Ballon au pied d'un joueur sur la mise en place, sans point d'annulation (raccourcis)
    func placeBallSilently(holder: String) {
        mutate { c in
            c.steps[0].ballHolder = holder
            c.steps[0].ball = nil
        }
    }

    func removeBall() {
        checkpoint()
        mutate { c in
            for i in c.steps.indices {
                c.steps[i].ballHolder = nil
                c.steps[i].ball = nil
                c.steps[i].ballAction = nil
                c.steps[i].aerial = nil
            }
        }
        selection = nil
    }

    // MARK: - Déplacements

    /// Déplace un joueur dans la vignette affichée
    func moveActor(_ id: String, to point: TacticPoint) {
        let p = point.clamped
        let k = vignette
        let previous = k > 0 ? frames[safe: k - 1]?.positions[id] : nil
        mutate { c in
            guard c.steps.indices.contains(k) else { return }
            if let previous, previous.distance(to: p) < 0.006 {
                // Revenu à sa place : il ne bouge pas dans cette vignette
                c.steps[k].positions[id] = nil
            } else {
                c.steps[k].positions[id] = p
            }
        }
    }

    /// Le joueur ne bouge pas dans cette vignette (retire son déplacement)
    func resetActorMove(_ id: String) {
        guard vignette > 0 else { return }
        checkpoint()
        let k = vignette
        mutate { c in c.steps[k].positions[id] = nil }
    }

    func actorMoved(_ id: String) -> Bool {
        vignette > 0 && content.steps[safe: vignette]?.positions[id] != nil
    }

    func moveProp(_ index: Int, to point: TacticPoint) {
        mutate { c in
            guard c.props.indices.contains(index) else { return }
            c.props[index].position = point.clamped
        }
    }

    func resizeZone(_ index: Int, corner point: TacticPoint) {
        mutate { c in
            guard c.props.indices.contains(index) else { return }
            let center = c.props[index].position
            let minW = 3 / AtelierViewport.pitchWidth, minH = 3 / AtelierViewport.pitchLength
            let w = max(minW, abs(point.x - center.x) * 2)
            let h = max(minH, abs(point.y - center.y) * 2)
            c.props[index].size = TacticPoint(x: min(1, w), y: min(1, h))
        }
    }

    /// Ballon lâché dans la vignette affichée : sur un joueur (passe) ou libre (tir près d'un but)
    func dropBall(at point: TacticPoint, onto holder: String?) {
        let k = vignette
        let previous = k > 0 ? frames[safe: k - 1] : nil
        mutate { c in
            guard c.steps.indices.contains(k) else { return }
            if let holder {
                if k > 0, previous?.ballHolder == holder {
                    // Rendu au même joueur : pas d'action de ballon dans cette vignette
                    c.steps[k].ballHolder = nil
                    c.steps[k].ball = nil
                    c.steps[k].ballAction = nil
                    c.steps[k].aerial = nil
                } else {
                    c.steps[k].ballHolder = holder
                    c.steps[k].ball = nil
                    if c.steps[k].ballAction == .tir { c.steps[k].ballAction = nil }
                }
            } else {
                c.steps[k].ballHolder = nil
                c.steps[k].ball = point.clamped
                let inGoalMouth = abs(point.x - 0.5) < 0.07 && (point.y < 0.02 || point.y > 0.98)
                if inGoalMouth { c.steps[k].ballAction = .tir; c.steps[k].aerial = nil }
            }
        }
    }

    /// Le ballon a-t-il changé de place dans cette vignette (hors conduite) ?
    var ballMovedInVignette: Bool {
        guard vignette > 0, let step = content.steps[safe: vignette] else { return false }
        return step.ballHolder != nil || step.ball != nil
    }

    enum BallKind: String, CaseIterable, Identifiable {
        case passe = "Passe", centre = "Centre", tir = "Tir"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .passe: return "arrow.right"
            case .centre: return "arrow.up.forward"
            case .tir: return "scope"
            }
        }
    }

    var ballKind: BallKind {
        guard let step = content.steps[safe: vignette] else { return .passe }
        if step.ballAction == .tir { return .tir }
        if step.aerial == true || step.ballAction == .centre { return .centre }
        return .passe
    }

    func setBallKind(_ kind: BallKind) {
        checkpoint()
        let k = vignette
        mutate { c in
            guard c.steps.indices.contains(k) else { return }
            switch kind {
            case .passe: c.steps[k].ballAction = nil; c.steps[k].aerial = nil
            case .centre: c.steps[k].ballAction = .centre; c.steps[k].aerial = true
            case .tir: c.steps[k].ballAction = .tir; c.steps[k].aerial = nil
            }
        }
    }

    func giveBall(to id: String) {
        checkpoint()
        if vignette == 0 {
            mutate { c in
                c.steps[0].ballHolder = id
                c.steps[0].ball = nil
            }
        } else {
            dropBall(at: frames[safe: vignette]?.positions[id] ?? TacticPoint(x: 0.5, y: 0.5), onto: id)
        }
    }

    // MARK: - Réglages de l'objet sélectionné

    func setColor(_ color: AtelierColor) {
        switch selection {
        case .actor(let id):
            bibColor = color
            checkpoint()
            mutate { c in
                guard let i = c.actors.firstIndex(where: { $0.id == id }) else { return }
                c.actors[i].bib = color.rawValue
                if !c.actors[i].isGoalkeeper { c.actors[i].team = self.team(for: color) }
            }
        case .prop(let index):
            checkpoint()
            mutate { c in
                guard c.props.indices.contains(index) else { return }
                c.props[index].color = color.rawValue
            }
            if content.props[safe: index]?.kind != .zone { propColor = color }
        default:
            if tool == .player { bibColor = color } else { propColor = color }
        }
    }

    func setLabel(_ id: String, _ label: String) {
        checkpoint()
        let trimmed = String(label.trimmingCharacters(in: .whitespaces).prefix(3))
        mutate { c in
            guard let i = c.actors.firstIndex(where: { $0.id == id }) else { return }
            c.actors[i].label = trimmed
        }
    }

    func toggleGoalkeeper(_ id: String) {
        checkpoint()
        mutate { c in
            guard let i = c.actors.firstIndex(where: { $0.id == id }) else { return }
            c.actors[i].position = c.actors[i].isGoalkeeper ? nil : .gardien
        }
    }

    func rotateSelected(by degrees: Double) {
        guard case .prop(let index) = selection else { return }
        checkpoint()
        mutate { c in
            guard c.props.indices.contains(index) else { return }
            var angle = (c.props[index].rotation ?? 0) + degrees
            angle = angle.truncatingRemainder(dividingBy: 360)
            if angle < 0 { angle += 360 }
            c.props[index].rotation = angle
        }
    }

    func duplicateSelected() {
        let offset = TacticPoint(x: 2.5 / AtelierViewport.pitchWidth, y: 2.5 / AtelierViewport.pitchLength)
        switch selection {
        case .actor(let id):
            guard let actor = content.actors.first(where: { $0.id == id }),
                  let p = frames.first?.positions[id] else { return }
            let newId = addPlayer(at: TacticPoint(x: p.x + offset.x, y: p.y + offset.y), color: actor.bibColor,
                                  goalkeeper: actor.isGoalkeeper)
            selection = .actor(newId)
        case .prop(let index):
            guard let prop = content.props[safe: index] else { return }
            let newIndex = addProp(prop.kind, at: TacticPoint(x: prop.position.x + offset.x, y: prop.position.y + offset.y),
                                   color: prop.atelierColor, size: prop.size, rotation: prop.rotation)
            selection = .prop(newIndex)
        default:
            break
        }
    }

    func deleteSelected() {
        switch selection {
        case .actor(let id): deleteActor(id)
        case .prop(let index):
            checkpoint()
            mutate { c in
                guard c.props.indices.contains(index) else { return }
                c.props.remove(at: index)
            }
        case .ball: removeBall()
        case nil: break
        }
        selection = nil
    }

    private func deleteActor(_ id: String) {
        checkpoint()
        let resolved = frames
        mutate { c in
            c.actors.removeAll { $0.id == id }
            for i in c.steps.indices {
                c.steps[i].positions[id] = nil
                c.steps[i].highlight?.removeAll { $0 == id }
                if c.steps[i].ballHolder == id {
                    c.steps[i].ballHolder = nil
                    c.steps[i].ball = resolved[safe: i]?.ball
                }
            }
        }
    }

    func clearAll() {
        checkpoint()
        mutate { c in
            c.actors = []
            c.props = []
            c.steps = [TacticStep(title: "Mise en place", text: "", positions: [:])]
        }
        vignette = 0
        selection = nil
    }

    // MARK: - Vignettes

    func addVignette() {
        checkpoint()
        mutate { c in
            c.steps.append(TacticStep(title: "", text: "", positions: [:]))
        }
        vignette = content.steps.count - 1
        selection = nil
    }

    func deleteVignette(_ index: Int) {
        guard index > 0 else { return }
        checkpoint()
        mutate { c in
            guard c.steps.indices.contains(index) else { return }
            c.steps.remove(at: index)
        }
        vignette = min(vignette, content.steps.count - 1)
        selection = nil
    }

    func updateStep(_ index: Int, title: String? = nil, text: String? = nil, duration: Double? = nil) {
        checkpoint()
        mutate { c in
            guard c.steps.indices.contains(index) else { return }
            if let title { c.steps[index].title = title }
            if let text { c.steps[index].text = text }
            if let duration { c.steps[index].duration = duration }
        }
    }

    // MARK: - Évolutions

    func selectEvolution(_ index: Int?) {
        evolution = index
        vignette = 0
        selection = nil
    }

    /// Nouvelle évolution : copie de ce qui est affiché, à modifier ensuite
    func addEvolution() {
        checkpoint()
        let number = (play.evolutions?.count ?? 0) + 1
        let evo = TacticEvolution(title: "Évolution \(number)", text: "", content: content)
        if play.evolutions == nil { play.evolutions = [] }
        play.evolutions?.append(evo)
        selectEvolution((play.evolutions?.count ?? 1) - 1)
    }

    func renameEvolution(_ index: Int, title: String, text: String) {
        checkpoint()
        guard play.evolutions?.indices.contains(index) == true else { return }
        let t = title.trimmingCharacters(in: .whitespaces)
        play.evolutions?[index].title = t.isEmpty ? "Évolution \(index + 1)" : t
        play.evolutions?[index].text = text
    }

    func deleteEvolution(_ index: Int) {
        checkpoint()
        guard play.evolutions?.indices.contains(index) == true else { return }
        play.evolutions?.remove(at: index)
        if play.evolutions?.isEmpty == true { play.evolutions = nil }
        selectEvolution(nil)
    }

    // MARK: - Raccourcis

    /// Applique un raccourci centré sur le cadrage
    func apply(_ shortcut: AtelierShortcut) {
        checkpoint()
        shortcut.apply(to: self, center: framing.center)
        // Le terrain se recadre sur l'exercice (même annulation que le raccourci)
        let points = AtelierDiagram.contentPoints(current)
        if !points.isEmpty { play.framing = TacticFraming.fitting(points, marginMeters: 4, minMeters: 14) }
        isDirty = true
    }

    // MARK: - Enregistrement

    /// Exercice prêt à enregistrer (effectif calculé, étapes nommées)
    func finalized() -> TacticPlay {
        var result = play
        result.isUserCreated = true
        if result.createdAt == nil { result.createdAt = Date() }
        if result.category == .autre { result.category = .perso }
        if result.steps.first?.title.isEmpty ?? false { result.steps[0].title = "Mise en place" }
        result.headcount = AtelierEditorModel.headcount(result.actors)
        return result
    }

    var isEmpty: Bool {
        play.actors.isEmpty && play.props.isEmpty && play.evolutionList.isEmpty
    }

    /// « 4 rouges · 2 bleus · 1 gardien »
    static func headcount(_ actors: [TacticActor]) -> String? {
        guard !actors.isEmpty else { return nil }
        var parts: [String] = []
        for color in AtelierColor.allCases {
            let n = actors.filter { !$0.isGoalkeeper && $0.bibColor == color }.count
            if n > 0 { parts.append("\(n) \(color.adjective(feminine: false, plural: n > 1))") }
        }
        let keepers = actors.filter(\.isGoalkeeper).count
        if keepers > 0 { parts.append("\(keepers) gardien\(keepers > 1 ? "s" : "")") }
        return parts.joined(separator: " · ")
    }
}

extension TacticPoint {
    /// Reste sur le terrain (avec 3 m de marge autour des lignes)
    var clamped: TacticPoint {
        TacticPoint(x: min(1.04, max(-0.04, x)), y: min(1.03, max(-0.03, y)))
    }
}
