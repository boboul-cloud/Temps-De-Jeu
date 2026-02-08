//
//  StoppageType.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI
import Combine

/// Types d'arrêts de jeu possibles pendant un match
enum StoppageType: String, Codable, CaseIterable, Identifiable {
    case touche = "Touche"
    case sixMetres = "6 Mètres"
    case corner = "Corner"
    case coupFranc = "Coup Franc"
    case penalty = "Penalty"
    case remplacement = "Remplacement"
    case blessure = "Blessure / Soins"
    case varCheck = "VAR"
    case but = "But / Célébration"
    case antiJeu = "Anti-jeu"
    case autreArret = "Autre"

    var id: String { rawValue }

    /// Icône SF Symbols pour chaque type
    var icon: String {
        switch self {
        case .touche: return "arrow.left.and.right"
        case .sixMetres: return "sportscourt"
        case .corner: return "flag.fill"
        case .coupFranc: return "exclamationmark.triangle.fill"
        case .penalty: return "target"
        case .remplacement: return "arrow.left.arrow.right"
        case .blessure: return "cross.case.fill"
        case .varCheck: return "tv.fill"
        case .but: return "soccerball"
        case .antiJeu: return "hand.raised.fill"
        case .autreArret: return "ellipsis.circle.fill"
        }
    }

    /// Couleur associée à chaque type d'arrêt
    var color: Color {
        switch self {
        case .touche: return .blue
        case .sixMetres: return .cyan
        case .corner: return .orange
        case .coupFranc: return .yellow
        case .penalty: return .red
        case .remplacement: return .purple
        case .blessure: return .pink
        case .varCheck: return .indigo
        case .but: return .green
        case .antiJeu: return .gray
        case .autreArret: return .secondary
        }
    }

    /// Indique si ce type d'arrêt compte pour le temps additionnel
    /// Seuls blessures, VAR et anti-jeu comptent.
    /// Les remplacements ont un forfait fixe de 30s (géré séparément).
    var countsForAddedTime: Bool {
        switch self {
        case .blessure, .varCheck, .antiJeu: return true
        default: return false
        }
    }

    /// Indique si ce type d'arrêt permet de spécifier l'équipe bénéficiaire
    var requiresTeamSelection: Bool {
        switch self {
        case .touche, .sixMetres, .corner, .coupFranc, .penalty, .but, .antiJeu:
            return true
        case .remplacement, .blessure, .varCheck, .autreArret:
            return false
        }
    }

    /// Types d'arrêts pouvant être chaînés depuis cet arrêt (sans reprendre le jeu)
    /// Ex: un coup franc peut mener à une touche, un penalty, une blessure ou un remplacement
    var chainableTypes: [StoppageType] {
        switch self {
        case .coupFranc:
            return [.touche, .penalty, .but, .blessure, .remplacement]
        case .penalty:
            return [.but, .blessure, .remplacement]
        default:
            return []
        }
    }
}
