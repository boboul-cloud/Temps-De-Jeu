//
//  TimeFormatters.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import Foundation

/// Utilitaires de formatage du temps
struct TimeFormatters {
    /// Format MM:SS
    static func formatTime(_ interval: TimeInterval) -> String {
        let totalSeconds = Int(max(0, interval))
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    /// Format MM:SS.d (avec dixièmes)
    static func formatTimePrecise(_ interval: TimeInterval) -> String {
        let totalSeconds = max(0, interval)
        let minutes = Int(totalSeconds) / 60
        let seconds = Int(totalSeconds) % 60
        let tenths = Int((totalSeconds.truncatingRemainder(dividingBy: 1)) * 10)
        return String(format: "%02d:%02d.%d", minutes, seconds, tenths)
    }

    /// Format court pour les durées (ex: "2'30")
    static func formatShort(_ interval: TimeInterval) -> String {
        let totalSeconds = Int(max(0, interval))
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        if minutes > 0 {
            return "\(minutes)'\(String(format: "%02d", seconds))"
        }
        return "\(seconds)s"
    }

    /// Format pour les minutes de match (ex: "45+3'")
    static func formatMatchMinute(_ interval: TimeInterval, regulation: TimeInterval) -> String {
        let minutes = Int(interval / 60)
        if interval > regulation {
            let regMinutes = Int(regulation / 60)
            let extraMinutes = minutes - regMinutes
            return "\(regMinutes)+\(extraMinutes)'"
        }
        return "\(minutes)'"
    }
}
