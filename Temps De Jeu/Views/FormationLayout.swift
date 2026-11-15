//
//  FormationLayout.swift
//  Temps De Jeu
//
//  Adapte une formation prédéfinie au nombre de joueurs sur le terrain
//  (football à 11, à 8, à 5…) : 4-4-2 avec 8 joueurs → 3-3-1.
//

import Foundation

enum FormationLayout {

    /// Lignes de la formation (gardien compris) adaptées à `playerCount` joueurs.
    /// Les joueurs de champ sont répartis au prorata des lignes d'origine
    /// (méthode du plus fort reste) ; les lignes vides disparaissent.
    static func adapt(lines: [Int], to playerCount: Int) -> [Int] {
        let total = lines.reduce(0, +)
        guard playerCount > 0, total > 0 else { return [] }
        guard playerCount < total else { return lines }
        guard playerCount > 1, lines.count > 1 else { return [1] }

        let outfield = Array(lines.dropFirst())
        let outfieldTotal = outfield.reduce(0, +)
        let target = playerCount - 1   // un gardien
        guard outfieldTotal > 0 else { return [1] }

        let exact = outfield.map { Double($0) * Double(target) / Double(outfieldTotal) }
        var counts = exact.map { Int($0.rounded(.down)) }
        var remaining = target - counts.reduce(0, +)
        let order = exact.indices.sorted { a, b in
            let ra = exact[a] - exact[a].rounded(.down)
            let rb = exact[b] - exact[b].rounded(.down)
            return ra != rb ? ra > rb : a < b
        }
        for index in order where remaining > 0 {
            counts[index] += 1
            remaining -= 1
        }
        return [1] + counts.filter { $0 > 0 }
    }

    /// Nom de la formation (sans le gardien) : [1, 3, 3, 1] → « 3-3-1 »
    static func name(of lines: [Int]) -> String {
        lines.dropFirst().map(String.init).joined(separator: "-")
    }
}
