//
//  StatisticsView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

/// Vue détaillée des statistiques du match en cours
struct StatisticsView: View {
    @ObservedObject var viewModel: MatchViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Résumé global
                    globalSummaryCard

                    // Répartition par type d'arrêt
                    stoppageBreakdownCard

                    // Détail par période
                    periodBreakdownCard

                    // Liste des événements
                    eventListCard
                }
                .padding()
            }
            .navigationTitle("Statistiques")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }

    // MARK: - Résumé global

    private var globalSummaryCard: some View {
        VStack(spacing: 16) {
            SectionHeader(title: "Résumé du match", icon: "chart.pie.fill")

            // Jauge temps effectif
            let effectiveRatio = viewModel.elapsedTime > 0
                ? viewModel.currentEffectiveTime / viewModel.elapsedTime
                : 1.0

            ZStack {
                Circle()
                    .stroke(Color.red.opacity(0.2), lineWidth: 20)
                Circle()
                    .trim(from: 0, to: CGFloat(effectiveRatio))
                    .stroke(Color.green, style: StrokeStyle(lineWidth: 20, lineCap: .round))
                    .rotationEffect(.degrees(-90))

                VStack {
                    Text("\(Int(effectiveRatio * 100))%")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.green)
                    Text("Temps effectif")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 160, height: 160)
            .padding(.vertical, 8)

            HStack(spacing: 20) {
                StatBox(
                    title: "Temps total",
                    value: TimeFormatters.formatTime(viewModel.elapsedTime),
                    color: .blue
                )
                StatBox(
                    title: "Jeu effectif",
                    value: TimeFormatters.formatTime(viewModel.currentEffectiveTime),
                    color: .green
                )
                StatBox(
                    title: "Arrêts",
                    value: TimeFormatters.formatTime(viewModel.currentAddedTime),
                    color: .red
                )
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }

    // MARK: - Répartition par type

    private var stoppageBreakdownCard: some View {
        VStack(spacing: 12) {
            SectionHeader(title: "Répartition des arrêts", icon: "chart.bar.fill")

            let allTypes = StoppageType.allCases.filter { type in
                viewModel.match.stoppages.contains { $0.type == type }
            }

            if allTypes.isEmpty {
                Text("Aucun arrêt enregistré")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding()
            } else {
                let homeLabel = viewModel.match.homeTeam.isEmpty ? "DOM" : viewModel.match.homeTeam
                let awayLabel = viewModel.match.awayTeam.isEmpty ? "EXT" : viewModel.match.awayTeam

                ForEach(allTypes) { type in
                    let count = viewModel.match.stoppageCount(for: type)
                    let totalTime = viewModel.match.totalTime(for: type)
                    let maxTime = StoppageType.allCases.map { viewModel.match.totalTime(for: $0) }.max() ?? 1
                    let homeCount = viewModel.match.stoppageCount(for: type, team: .home)
                    let awayCount = viewModel.match.stoppageCount(for: type, team: .away)

                    HStack(spacing: 12) {
                        Image(systemName: type.icon)
                            .foregroundStyle(type.color)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(type.rawValue)
                                    .font(.subheadline.bold())
                                Spacer()
                                Text("\(count)x")
                                    .font(.caption.bold())
                                    .foregroundStyle(.secondary)
                                Text(TimeFormatters.formatShort(totalTime))
                                    .font(.subheadline.bold())
                                    .foregroundStyle(type.color)
                            }

                            if homeCount > 0 || awayCount > 0 {
                                HStack(spacing: 8) {
                                    if homeCount > 0 {
                                        HStack(spacing: 3) {
                                            Text(homeLabel)
                                                .font(.system(size: 9, weight: .bold))
                                            Text("\(homeCount)")
                                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                        }
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.blue.opacity(0.15))
                                        .cornerRadius(4)
                                    }
                                    if awayCount > 0 {
                                        HStack(spacing: 3) {
                                            Text(awayLabel)
                                                .font(.system(size: 9, weight: .bold))
                                            Text("\(awayCount)")
                                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                        }
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.orange.opacity(0.15))
                                        .cornerRadius(4)
                                    }
                                    Spacer()
                                }
                            }

                            GeometryReader { geo in
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(type.color.opacity(0.3))
                                    .frame(width: geo.size.width * (maxTime > 0 ? totalTime / maxTime : 0), height: 6)
                            }
                            .frame(height: 6)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }

    // MARK: - Par période

    private var periodBreakdownCard: some View {
        VStack(spacing: 12) {
            SectionHeader(title: "Par période", icon: "clock.fill")

            let activePeriods = MatchPeriod.allCases.filter { period in
                viewModel.match.periodDurations[period.rawValue] != nil || period == viewModel.currentPeriod
            }

            ForEach(activePeriods) { period in
                let duration = period == viewModel.currentPeriod ? viewModel.elapsedTime : (viewModel.match.periodDurations[period.rawValue] ?? 0)
                let stoppageTime = viewModel.match.totalStoppageTime(for: period) + (period == viewModel.currentPeriod ? viewModel.stoppageElapsed : 0)
                let effectiveTime = duration - stoppageTime
                let stoppageCount = viewModel.match.stoppages.filter { $0.period == period }.count

                HStack {
                    Text(period.shortName)
                        .font(.headline)
                        .frame(width: 40)
                        .foregroundStyle(.white)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 4)
                        .background(Color.green)
                        .cornerRadius(8)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Effectif: \(TimeFormatters.formatTime(effectiveTime))")
                            .font(.subheadline)
                        Text("\(stoppageCount) arrêts · \(TimeFormatters.formatShort(stoppageTime)) perdues")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Text(TimeFormatters.formatTime(duration))
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }

    // MARK: - Liste d'événements

    private var eventListCard: some View {
        VStack(spacing: 12) {
            SectionHeader(title: "Événements (\(viewModel.match.stoppages.count))", icon: "list.bullet")

            if viewModel.match.stoppages.isEmpty {
                Text("Aucun événement")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding()
            } else {
                ForEach(viewModel.match.stoppages.reversed()) { stoppage in
                    HStack(spacing: 12) {
                        Image(systemName: stoppage.type.icon)
                            .foregroundStyle(stoppage.type.color)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Text(stoppage.type.rawValue)
                                    .font(.subheadline.bold())
                                if let team = stoppage.beneficiaryTeam {
                                    Text(team == .home
                                         ? (viewModel.match.homeTeam.isEmpty ? "DOM" : viewModel.match.homeTeam)
                                         : (viewModel.match.awayTeam.isEmpty ? "EXT" : viewModel.match.awayTeam))
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(team == .home ? Color.blue.opacity(0.2) : Color.orange.opacity(0.2))
                                        .cornerRadius(4)
                                }
                            }
                            Text("\(stoppage.period.shortName) · \(TimeFormatters.formatMatchMinute(stoppage.startTime, regulation: stoppage.period.regulationDuration))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Text(TimeFormatters.formatShort(stoppage.duration))
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundStyle(stoppage.duration > 60 ? .red : .primary)
                    }
                    .padding(.vertical, 4)

                    if stoppage.id != viewModel.match.stoppages.first?.id {
                        Divider()
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

// MARK: - Composants

struct StatBox: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(.headline, design: .monospaced))
                .foregroundStyle(color)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(color.opacity(0.1))
        .cornerRadius(10)
    }
}

#Preview {
    StatisticsView(viewModel: MatchViewModel())
}
