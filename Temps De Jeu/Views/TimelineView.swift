//
//  TimelineView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

/// Vue timeline des événements du match
struct TimelineView: View {
    @ObservedObject var viewModel: MatchViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedStoppage: Stoppage?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    if viewModel.match.stoppages.isEmpty {
                        emptyState
                    } else {
                        ForEach(viewModel.match.stoppages) { stoppage in
                            TimelineEventRow(
                                stoppage: stoppage,
                                regulation: stoppage.period.regulationDuration,
                                isLast: stoppage.id == viewModel.match.stoppages.last?.id,
                                homeTeam: viewModel.match.homeTeam,
                                awayTeam: viewModel.match.awayTeam
                            )
                            .onTapGesture {
                                selectedStoppage = stoppage
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Timeline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
            .sheet(item: $selectedStoppage) { stoppage in
                StoppageDetailSheet(stoppage: stoppage, onDelete: {
                    viewModel.deleteStoppage(stoppage)
                    selectedStoppage = nil
                }, homeTeam: viewModel.match.homeTeam, awayTeam: viewModel.match.awayTeam)
                .presentationDetents([.height(250)])
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "timeline.selection")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Aucun événement")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Les arrêts de jeu apparaîtront ici")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 60)
    }
}

struct TimelineEventRow: View {
    let stoppage: Stoppage
    let regulation: TimeInterval
    let isLast: Bool
    var homeTeam: String = ""
    var awayTeam: String = ""

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Marqueur de temps
            VStack {
                Text(TimeFormatters.formatMatchMinute(stoppage.startTime, regulation: regulation))
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .frame(width: 50)
            }

            // Ligne de timeline
            VStack(spacing: 0) {
                Circle()
                    .fill(stoppage.type.color)
                    .frame(width: 12, height: 12)

                if !isLast {
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 2, height: 50)
                }
            }

            // Détail
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: stoppage.type.icon)
                        .foregroundStyle(stoppage.type.color)
                    Text(stoppage.type.rawValue)
                        .font(.subheadline.bold())
                    if let team = stoppage.beneficiaryTeam {
                        Text(beneficiaryTeamName(team))
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(team == .home ? Color.blue.opacity(0.2) : Color.orange.opacity(0.2))
                            .cornerRadius(4)
                    }
                    Spacer()
                    Text(TimeFormatters.formatShort(stoppage.duration))
                        .font(.system(.caption, design: .monospaced))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(stoppage.type.color.opacity(0.15))
                        .cornerRadius(6)
                }

                Text(stoppage.period.rawValue)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, isLast ? 0 : 24)
        }
    }

    private func beneficiaryTeamName(_ team: BeneficiaryTeam) -> String {
        switch team {
        case .home: return homeTeam.isEmpty ? "DOM" : homeTeam
        case .away: return awayTeam.isEmpty ? "EXT" : awayTeam
        }
    }
}

struct StoppageDetailSheet: View {
    let stoppage: Stoppage
    let onDelete: () -> Void
    var homeTeam: String = ""
    var awayTeam: String = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 20) {
            HStack {
                Image(systemName: stoppage.type.icon)
                    .font(.title)
                    .foregroundStyle(stoppage.type.color)
                VStack(alignment: .leading) {
                    HStack(spacing: 6) {
                        Text(stoppage.type.rawValue)
                            .font(.headline)
                        if let team = stoppage.beneficiaryTeam {
                            Text(team == .home
                                 ? (homeTeam.isEmpty ? "DOM" : homeTeam)
                                 : (awayTeam.isEmpty ? "EXT" : awayTeam))
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(team == .home ? Color.blue.opacity(0.2) : Color.orange.opacity(0.2))
                                .cornerRadius(6)
                        }
                    }
                    Text(stoppage.period.rawValue)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }

            HStack(spacing: 24) {
                VStack {
                    Text("Début")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(TimeFormatters.formatTime(stoppage.startTime))
                        .font(.system(.headline, design: .monospaced))
                }
                if let end = stoppage.endTime {
                    VStack {
                        Text("Fin")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(TimeFormatters.formatTime(end))
                            .font(.system(.headline, design: .monospaced))
                    }
                }
                VStack {
                    Text("Durée")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(TimeFormatters.formatShort(stoppage.duration))
                        .font(.system(.headline, design: .monospaced))
                        .foregroundStyle(stoppage.type.color)
                }
            }

            Button(role: .destructive) {
                onDelete()
                dismiss()
            } label: {
                HStack {
                    Image(systemName: "trash")
                    Text("Supprimer cet arrêt")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.red.opacity(0.1))
                .cornerRadius(12)
            }
        }
        .padding()
    }
}

#Preview {
    TimelineView(viewModel: MatchViewModel())
}
