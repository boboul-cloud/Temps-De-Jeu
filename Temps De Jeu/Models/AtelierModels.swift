//
//  AtelierModels.swift
//  Temps De Jeu
//
//  Atelier d'exercices : couleurs de chasubles et de matériel, noms du
//  matériel (accordés), évolutions d'un exercice, cadrage du terrain et
//  liste du matériel à prévoir.
//

import SwiftUI
import UIKit

// MARK: - Couleurs (chasubles et matériel)

enum AtelierColor: String, CaseIterable, Identifiable, Codable {
    case rouge, bleu, jaune, orange, vert, rose, blanc, violet

    var id: String { rawValue }

    var uiColor: UIColor {
        switch self {
        case .rouge: return UIColor(red: 0.9, green: 0.15, blue: 0.15, alpha: 1)
        case .bleu: return UIColor(red: 0.15, green: 0.45, blue: 0.95, alpha: 1)
        case .jaune: return UIColor(red: 1.0, green: 0.85, blue: 0.1, alpha: 1)
        case .orange: return UIColor(red: 1.0, green: 0.5, blue: 0.05, alpha: 1)
        case .vert: return UIColor(red: 0.2, green: 0.8, blue: 0.3, alpha: 1)
        case .rose: return UIColor(red: 1.0, green: 0.35, blue: 0.7, alpha: 1)
        case .blanc: return UIColor(white: 0.97, alpha: 1)
        case .violet: return UIColor(red: 0.6, green: 0.3, blue: 0.9, alpha: 1)
        }
    }

    var color: Color { Color(uiColor: uiColor) }

    /// Texte lisible sur cette couleur
    var textColor: Color { isLight ? .black : .white }
    var textUIColor: UIColor { isLight ? .black : .white }
    var isLight: Bool { [.jaune, .blanc, .rose].contains(self) }

    var displayName: String { rawValue.capitalized }

    /// Adjectif accordé : « plots jaunes », « coupelles blanches »
    func adjective(feminine: Bool, plural: Bool) -> String {
        let base: (m: String, f: String)
        switch self {
        case .rouge: base = ("rouge", "rouge")
        case .bleu: base = ("bleu", "bleue")
        case .jaune: base = ("jaune", "jaune")
        case .orange: return "orange"    // invariable
        case .vert: base = ("vert", "verte")
        case .rose: base = ("rose", "rose")
        case .blanc: base = ("blanc", "blanche")
        case .violet: base = ("violet", "violette")
        }
        let word = feminine ? base.f : base.m
        return plural ? word + "s" : word
    }

    /// Couleur lue dans un fichier (accepte aussi les anciennes valeurs libres)
    init?(name: String?) {
        guard let name = name?.lowercased().trimmingCharacters(in: .whitespaces), !name.isEmpty else { return nil }
        self.init(rawValue: name)
    }

    /// Couleur par défaut d'un camp (exercices sans chasuble choisie)
    static func `default`(for team: TacticTeam) -> AtelierColor {
        switch team {
        case .equipe: return .bleu
        case .adversaire: return .rouge
        case .joker: return .jaune
        }
    }
}

// MARK: - Matériel : noms, tailles, réglages

extension TacticPropKind {
    var displayName: String {
        switch self {
        case .plot: return "Plot"
        case .coupelle: return "Coupelle"
        case .piquet: return "Piquet"
        case .mannequin: return "Mannequin"
        case .miniBut: return "Mini-but"
        case .but: return "But"
        case .cerceau: return "Cerceau"
        case .echelle: return "Échelle"
        case .haie: return "Haie"
        case .ballon: return "Ballon"
        case .zone: return "Zone"
        }
    }

    private var nouns: (singular: String, plural: String) {
        switch self {
        case .plot: return ("plot", "plots")
        case .coupelle: return ("coupelle", "coupelles")
        case .piquet: return ("piquet", "piquets")
        case .mannequin: return ("mannequin", "mannequins")
        case .miniBut: return ("mini-but", "mini-buts")
        case .but: return ("but", "buts")
        case .cerceau: return ("cerceau", "cerceaux")
        case .echelle: return ("échelle de rythme", "échelles de rythme")
        case .haie: return ("haie", "haies")
        case .ballon: return ("ballon", "ballons")
        case .zone: return ("zone", "zones")
        }
    }

    var isFeminine: Bool { [.coupelle, .echelle, .haie, .zone].contains(self) }

    /// « 3 plots », « 1 échelle de rythme »
    func counted(_ count: Int) -> String {
        "\(count) \(count > 1 ? nouns.plural : nouns.singular)"
    }

    /// « 12 plots jaunes », « 4 coupelles blanches »
    func counted(_ count: Int, color: AtelierColor?) -> String {
        guard let color, hasColor else { return counted(count) }
        let noun = count > 1 ? nouns.plural : nouns.singular
        // « échelles de rythme jaunes » : l'adjectif suit le premier mot
        let parts = noun.split(separator: " ", maxSplits: 1).map(String.init)
        let adjective = color.adjective(feminine: isFeminine, plural: count > 1)
        if parts.count == 2 { return "\(count) \(parts[0]) \(adjective) \(parts[1])" }
        return "\(count) \(noun) \(adjective)"
    }

    /// Le matériel a-t-il une couleur réglable ?
    var hasColor: Bool { ![.miniBut, .but, .ballon].contains(self) }

    /// Peut-on le faire pivoter ?
    var isRotatable: Bool { [.mannequin, .miniBut, .but, .echelle, .haie].contains(self) }

    var defaultColor: AtelierColor {
        switch self {
        case .plot: return .orange
        case .coupelle: return .jaune
        case .piquet: return .jaune
        case .mannequin: return .jaune
        case .cerceau: return .rouge
        case .echelle: return .jaune
        case .haie: return .rouge
        case .zone: return .blanc
        case .miniBut, .but, .ballon: return .blanc
        }
    }

    /// Ordre d'affichage dans le tiroir et dans la liste du matériel
    static let atelierOrder: [TacticPropKind] = [
        .plot, .coupelle, .piquet, .mannequin, .miniBut, .but, .cerceau, .echelle, .haie, .ballon, .zone
    ]
}

extension TacticProp {
    var atelierColor: AtelierColor {
        AtelierColor(name: color) ?? kind.defaultColor
    }
}

extension TacticActor {
    /// Couleur de la chasuble (choisie, sinon celle du camp)
    var bibColor: AtelierColor {
        AtelierColor(name: bib) ?? AtelierColor.default(for: team)
    }
}

// MARK: - Cadrage

/// Partie du terrain affichée (coordonnées normalisées, comme les positions)
struct TacticFraming: Codable, Hashable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double

    private enum CodingKeys: String, CodingKey {
        case x, y
        case width = "largeur"
        case height = "longueur"
    }

    static let full = TacticFraming(x: 0, y: 0, width: 1, height: 1)
    /// Moitié de terrain côté but attaqué (y = 0)
    static let attackingHalf = TacticFraming(x: 0, y: 0, width: 1, height: 0.5)
    /// Moitié de terrain côté « mon but »
    static let defendingHalf = TacticFraming(x: 0, y: 0.5, width: 1, height: 0.5)
    /// Zone centrale d'environ 40 × 40 m
    static let center = TacticFraming(x: 0.5 - 20.0 / 68, y: 0.5 - 20.0 / 105, width: 40.0 / 68, height: 40.0 / 105)

    var center: TacticPoint { TacticPoint(x: x + width / 2, y: y + height / 2) }

    /// Cadrage ajusté autour de points (avec une marge en mètres)
    static func fitting(_ points: [TacticPoint], marginMeters: Double = 6, minMeters: Double = 24) -> TacticFraming {
        guard let first = points.first else { return .center }
        var lo = first, hi = first
        for p in points {
            lo.x = min(lo.x, p.x); lo.y = min(lo.y, p.y)
            hi.x = max(hi.x, p.x); hi.y = max(hi.y, p.y)
        }
        let mx = marginMeters / 68, my = marginMeters / 105
        var w = max(hi.x - lo.x + 2 * mx, minMeters / 68)
        var h = max(hi.y - lo.y + 2 * my, minMeters / 105)
        w = min(w, 1); h = min(h, 1)
        let cx = (lo.x + hi.x) / 2, cy = (lo.y + hi.y) / 2
        let x = min(max(0, cx - w / 2), 1 - w)
        let y = min(max(0, cy - h / 2), 1 - h)
        return TacticFraming(x: x, y: y, width: w, height: h)
    }
}

// MARK: - Contenu d'un exercice (base ou évolution)

/// Ce que l'on dessine sur le terrain : joueurs, matériel, étapes
struct TacticContent: Hashable {
    var actors: [TacticActor]
    var props: [TacticProp]
    var steps: [TacticStep]
}

/// Évolution (variante) d'un exercice : même idée, consigne différente
struct TacticEvolution: Codable, Hashable, Identifiable {
    var id: UUID
    var title: String
    /// Ce qui change (« 2 touches maximum », « un défenseur en plus »…)
    var text: String
    var actors: [TacticActor]
    var props: [TacticProp]
    var steps: [TacticStep]

    private enum CodingKeys: String, CodingKey {
        case id
        case title = "titre"
        case text = "texte"
        case actors = "acteurs"
        case props = "materiel"
        case steps = "etapes"
    }

    init(id: UUID = UUID(), title: String, text: String = "", content: TacticContent) {
        self.id = id
        self.title = title
        self.text = text
        self.actors = content.actors
        self.props = content.props
        self.steps = content.steps
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(UUID.self, forKey: .id)) ?? UUID()
        title = (try? c.decode(String.self, forKey: .title)) ?? "Évolution"
        text = (try? c.decode(String.self, forKey: .text)) ?? ""
        actors = (try? c.decode([TacticActor].self, forKey: .actors)) ?? []
        props = (try? c.decode([TacticProp].self, forKey: .props)) ?? []
        steps = (try? c.decode([TacticStep].self, forKey: .steps)) ?? []
    }

    var content: TacticContent {
        get { TacticContent(actors: actors, props: props, steps: steps) }
        set { actors = newValue.actors; props = newValue.props; steps = newValue.steps }
    }
}

extension TacticPlay {
    var content: TacticContent {
        get { TacticContent(actors: actors, props: props, steps: steps) }
        set { actors = newValue.actors; props = newValue.props; steps = newValue.steps }
    }

    var evolutionList: [TacticEvolution] { evolutions ?? [] }

    /// L'exercice tel qu'il se joue pour une évolution (nil = exercice de base)
    func variant(_ index: Int?) -> TacticPlay {
        guard let index, let evolution = evolutions?[safe: index] else { return self }
        var copy = self
        copy.content = evolution.content
        copy.title = "\(title) · \(evolution.title)"
        if !evolution.text.isEmpty {
            copy.objective = objective.isEmpty ? evolution.text : "\(objective)\n\(evolution.title) : \(evolution.text)"
        }
        copy.evolutions = nil
        return copy
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Matériel à prévoir

/// Une ligne de la liste du matériel (« 12 plots jaunes », « 6 chasubles rouges »)
struct EquipmentLine: Hashable, Identifiable {
    enum Item: Hashable {
        case prop(TacticPropKind)
        case bib
    }

    var item: Item
    var color: AtelierColor?
    var count: Int

    var id: String { "\(item)-\(color?.rawValue ?? "")" }

    var text: String {
        switch item {
        case .prop(let kind):
            return kind.counted(count, color: color)
        case .bib:
            let noun = count > 1 ? "chasubles" : "chasuble"
            guard let color else { return "\(count) \(noun)" }
            return "\(count) \(noun) \(color.adjective(feminine: true, plural: count > 1))"
        }
    }

    var sortKey: Int {
        switch item {
        case .bib: return -1
        case .prop(let kind): return TacticPropKind.atelierOrder.firstIndex(of: kind) ?? 99
        }
    }
}

extension TacticContent {
    /// Matériel nécessaire pour monter ce contenu
    func equipment() -> [EquipmentLine] {
        var counts: [EquipmentLine.Item: [AtelierColor?: Int]] = [:]
        for prop in props where prop.kind != .zone {
            let color: AtelierColor? = prop.kind.hasColor ? prop.atelierColor : nil
            counts[.prop(prop.kind), default: [:]][color, default: 0] += 1
        }
        // Chasubles : tous les joueurs de champ (le gardien garde son maillot)
        for actor in actors where !actor.isGoalkeeper {
            counts[.bib, default: [:]][actor.bibColor, default: 0] += 1
        }
        // Ballons : un par ballon de jeu, ou le nombre de ballons posés s'il est plus grand
        let inPlay = TacticPlay.ballIds(in: steps).count
        let laid = counts[.prop(.ballon)]?[nil] ?? 0
        if inPlay > laid {
            counts[.prop(.ballon), default: [:]][nil] = inPlay
        }
        return EquipmentLine.sorted(counts)
    }
}

extension EquipmentLine {
    static func sorted(_ counts: [Item: [AtelierColor?: Int]]) -> [EquipmentLine] {
        var lines: [EquipmentLine] = []
        for (item, byColor) in counts {
            for (color, count) in byColor where count > 0 {
                lines.append(EquipmentLine(item: item, color: color, count: count))
            }
        }
        return lines.sorted {
            if $0.sortKey != $1.sortKey { return $0.sortKey < $1.sortKey }
            return (AtelierColor.allCases.firstIndex(of: $0.color ?? .blanc) ?? 0)
                < (AtelierColor.allCases.firstIndex(of: $1.color ?? .blanc) ?? 0)
        }
    }

    /// Combine plusieurs listes : maximum (exercices montés l'un après l'autre)
    /// ou somme (ateliers montés en même temps)
    static func combine(_ lists: [[EquipmentLine]], simultaneous: Bool) -> [EquipmentLine] {
        var counts: [Item: [AtelierColor?: Int]] = [:]
        for list in lists {
            for line in list {
                let current = counts[line.item]?[line.color] ?? 0
                counts[line.item, default: [:]][line.color] = simultaneous ? current + line.count : max(current, line.count)
            }
        }
        return sorted(counts)
    }
}

extension TacticPlay {
    /// Matériel de l'exercice, évolutions comprises (le plus gourmand l'emporte)
    var equipmentLines: [EquipmentLine] {
        let lists = [content.equipment()] + evolutionList.map { $0.content.equipment() }
        return EquipmentLine.combine(lists, simultaneous: false)
    }
}
