//
//  NextEventWidget.swift
//  TempsDeJeuWidget
//
//  Created by Robert Oulhen on 06/03/2026.
//

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Timeline Entry

struct NextEventEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

// MARK: - Timeline Provider (avec Intent)

struct NextEventProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> NextEventEntry {
        NextEventEntry(date: Date(), data: .empty)
    }

    func snapshot(for configuration: SelectProfileIntent, in context: Context) async -> NextEventEntry {
        let profileId = configuration.profile?.id
        let data = readWidgetData(forProfileId: profileId)
        return NextEventEntry(date: Date(), data: data)
    }

    func timeline(for configuration: SelectProfileIntent, in context: Context) async -> Timeline<NextEventEntry> {
        let profileId = configuration.profile?.id
        let data = readWidgetData(forProfileId: profileId)
        let entry = NextEventEntry(date: Date(), data: data)

        // Rafraîchir toutes les 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
}

// MARK: - Widget Definition

struct NextEventWidget: Widget {
    let kind: String = "NextEventWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectProfileIntent.self, provider: NextEventProvider()) { entry in
            NextEventWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Prochain événement")
        .description("Affiche le prochain match ou entraînement pour une catégorie.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

// MARK: - Widget Views

struct NextEventWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: NextEventEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            MediumWidgetView(data: entry.data)
        case .accessoryRectangular:
            RectangularWidgetView(data: entry.data)
        default:
            SmallWidgetView(data: entry.data)
        }
    }
}

// MARK: - Small Widget

struct SmallWidgetView: View {
    let data: WidgetData

    private var hasMatch: Bool { data.nextMatchDate != nil }
    private var hasTraining: Bool { data.nextTrainingDate != nil }

    /// Quel événement est le plus proche ?
    private var showMatch: Bool {
        guard let matchDate = data.nextMatchDate else { return false }
        guard let trainingDate = data.nextTrainingDate else { return true }
        return matchDate <= trainingDate
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header
            HStack(spacing: 4) {
                Text("⚽")
                    .font(.caption)
                Text(data.teamName)
                    .font(.caption.bold())
                    .lineLimit(1)
            }
            .foregroundStyle(.secondary)

            Spacer(minLength: 0)

            if showMatch, let matchDate = data.nextMatchDate {
                // Prochain match
                Text("🏟️ Match")
                    .font(.caption2)
                    .foregroundStyle(.orange)

                Text(data.nextMatchOpponent ?? "Adversaire")
                    .font(.headline.bold())
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Image(systemName: (data.nextMatchIsHome ?? true) ? "house.fill" : "airplane")
                        .font(.system(size: 9))
                    Text(relativeDate(matchDate))
                        .font(.caption2)
                }
                .foregroundStyle(.secondary)

            } else if let trainingDate = data.nextTrainingDate {
                // Prochain entraînement
                Text("🏃 Entraînement")
                    .font(.caption2)
                    .foregroundStyle(.green)

                Text(shortDate(trainingDate))
                    .font(.headline.bold())
                    .lineLimit(1)

                Text(relativeDate(trainingDate))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                // Aucun événement
                Text("Aucun événement")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text("\(data.matchesPlayed)")
                    .font(.title.bold())
                Text("matchs joués")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Medium Widget

struct MediumWidgetView: View {
    let data: WidgetData

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header catégorie
            HStack(spacing: 4) {
                Text("⚽")
                    .font(.caption)
                Text(data.teamName)
                    .font(.caption.bold())
                    .lineLimit(1)
            }
            .foregroundStyle(.secondary)

        HStack(spacing: 16) {
            // Colonne match
            VStack(alignment: .leading, spacing: 6) {
                Label("Match", systemImage: "sportscourt.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.orange)

                if let matchDate = data.nextMatchDate {
                    Text(data.nextMatchOpponent ?? "Adversaire")
                        .font(.subheadline.bold())
                        .lineLimit(1)

                    if let competition = data.nextMatchCompetition, !competition.isEmpty {
                        Text(competition)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    HStack(spacing: 4) {
                        Image(systemName: (data.nextMatchIsHome ?? true) ? "house.fill" : "airplane")
                            .font(.system(size: 9))
                        Text(shortDate(matchDate))
                            .font(.caption2)
                    }
                    .foregroundStyle(.secondary)

                    Text(relativeDate(matchDate))
                        .font(.caption2.bold())
                        .foregroundStyle(.orange)
                } else {
                    Text("Aucun")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider()

            // Colonne entraînement
            VStack(alignment: .leading, spacing: 6) {
                Label("Entraînement", systemImage: "figure.run")
                    .font(.caption.bold())
                    .foregroundStyle(.green)

                if let trainingDate = data.nextTrainingDate {
                    Text(shortDate(trainingDate))
                        .font(.subheadline.bold())

                    if let responses = data.nextTrainingResponseCount,
                       let total = data.nextTrainingPlayerCount, total > 0 {
                        Text("📋 \(responses)/\(total) réponses")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Text(relativeDate(trainingDate))
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                } else {
                    Text("Aucun")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        } // fin VStack
    }
}

// MARK: - Lock Screen (Rectangular)

struct RectangularWidgetView: View {
    let data: WidgetData

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("⚽ \(data.teamName)")
                .font(.caption2.bold())
                .lineLimit(1)
                .foregroundStyle(.secondary)

            // Quel est le prochain ?
            if let matchDate = data.nextMatchDate,
               (data.nextTrainingDate == nil || matchDate <= data.nextTrainingDate!) {
                HStack(spacing: 4) {
                    Image(systemName: "sportscourt.fill")
                        .font(.caption2)
                    Text(data.nextMatchOpponent ?? "Match")
                        .font(.caption.bold())
                        .lineLimit(1)
                }
                Text(shortDate(matchDate))
                    .font(.caption2)
            } else if let trainingDate = data.nextTrainingDate {
                HStack(spacing: 4) {
                    Image(systemName: "figure.run")
                        .font(.caption2)
                    Text("Entraînement")
                        .font(.caption.bold())
                }
                Text(shortDate(trainingDate))
                    .font(.caption2)
            } else {
                Text("Aucun événement")
                    .font(.caption2)
            }
        }
    }
}

// MARK: - Helpers

private func relativeDate(_ date: Date) -> String {
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = Locale(identifier: "fr_FR")
    formatter.unitsStyle = .short
    return formatter.localizedString(for: date, relativeTo: Date())
}

private func shortDate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_FR")

    if Calendar.current.isDateInToday(date) {
        formatter.dateFormat = "'Aujourd''hui' HH:mm"
    } else if Calendar.current.isDateInTomorrow(date) {
        formatter.dateFormat = "'Demain' HH:mm"
    } else {
        formatter.dateFormat = "EEE d MMM HH:mm"
    }

    return formatter.string(from: date)
}

// MARK: - Preview

#Preview("Small", as: .systemSmall) {
    NextEventWidget()
} timeline: {
    NextEventEntry(date: .now, data: WidgetData(
        teamName: "U13 Masculin",
        seasonCategory: "U13",
        nextMatchDate: Date().addingTimeInterval(86400 * 2),
        nextMatchOpponent: "FC Villepinte",
        nextMatchCompetition: "Championnat",
        nextMatchIsHome: true,
        nextTrainingDate: Date().addingTimeInterval(86400),
        matchesPlayed: 12,
        lastUpdated: Date()
    ))
}

#Preview("Medium", as: .systemMedium) {
    NextEventWidget()
} timeline: {
    NextEventEntry(date: .now, data: WidgetData(
        teamName: "U13 Masculin",
        seasonCategory: "U13",
        nextMatchDate: Date().addingTimeInterval(86400 * 2),
        nextMatchOpponent: "FC Villepinte",
        nextMatchCompetition: "Championnat",
        nextMatchIsHome: true,
        nextTrainingDate: Date().addingTimeInterval(86400),
        nextTrainingResponseCount: 8,
        nextTrainingPlayerCount: 22,
        matchesPlayed: 12,
        lastUpdated: Date()
    ))
}
