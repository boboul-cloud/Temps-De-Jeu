//
//  PlayingTimeFairnessView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/03/2026.
//

import SwiftUI

/// Vue intégrée au match en direct montrant l'équité du temps de jeu
/// Affiche un indicateur compact (barre de progression) et un détail déplié par joueur
struct PlayingTimeFairnessView: View {
    @ObservedObject var viewModel: MatchViewModel
    @State private var isExpanded = false

    private var liveTimes: [MatchViewModel.LivePlayingTime] {
        viewModel.livePlayerPlayingTimes()
    }

    private var maxTime: TimeInterval {
        liveTimes.last?.totalTime ?? 1
    }

    private var minTime: TimeInterval {
        liveTimes.first?.totalTime ?? 0
    }

    private var gap: TimeInterval {
        maxTime - minTime
    }

    /// Joueurs qui n'ont pas encore joué
    private var notPlayedYet: [MatchViewModel.LivePlayingTime] {
        liveTimes.filter { $0.totalTime < 1 && !$0.isOnField }
    }

    /// Couleur d'alerte selon l'écart
    private var fairnessColor: Color {
        if gap < 300 { return .green }       // < 5 min d'écart
        if gap < 600 { return .orange }      // < 10 min
        return .red                           // > 10 min
    }

    var body: some View {
        if liveTimes.isEmpty { EmptyView() }
        else {
            VStack(spacing: 0) {
                // Barre compacte toujours visible
                compactBar
                    .onTapGesture {
                        withAnimation(.spring(response: 0.3)) {
                            isExpanded.toggle()
                        }
                    }

                // Détail par joueur (déplié)
                if isExpanded {
                    expandedDetail
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .background(Color(.systemGray6).opacity(0.95))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(fairnessColor.opacity(0.4), lineWidth: 1)
            )
        }
    }

    // MARK: - Compact bar

    private var compactBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "chart.bar.fill")
                .font(.caption)
                .foregroundStyle(fairnessColor)

            // Mini barres superposées
            miniBarChart
                .frame(height: 16)

            // Indicateur d'écart
            VStack(alignment: .trailing, spacing: 0) {
                Text("Δ \(formatShort(gap))")
                    .font(.system(.caption, design: .monospaced).bold())
                    .foregroundStyle(fairnessColor)
                if !notPlayedYet.isEmpty {
                    Text("\(notPlayedYet.count) pas joué")
                        .font(.system(size: 9))
                        .foregroundStyle(.red)
                }
            }

            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var miniBarChart: some View {
        GeometryReader { geo in
            let safeMax = max(maxTime, 1)
            HStack(spacing: 1) {
                ForEach(liveTimes) { player in
                    let ratio = player.totalTime / safeMax
                    RoundedRectangle(cornerRadius: 2)
                        .fill(barColor(for: player))
                        .frame(width: max(2, geo.size.width / CGFloat(liveTimes.count) - 1),
                               height: max(2, geo.size.height * CGFloat(ratio)))
                        .frame(maxHeight: .infinity, alignment: .bottom)
                }
            }
        }
    }

    // MARK: - Expanded detail

    private var expandedDetail: some View {
        VStack(spacing: 4) {
            Divider()
                .padding(.horizontal, 8)

            ForEach(liveTimes) { player in
                playerRow(player)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
        }
    }

    private func playerRow(_ player: MatchViewModel.LivePlayingTime) -> some View {
        HStack(spacing: 8) {
            // Numéro
            Text("#\(player.shirtNumber)")
                .font(.system(.caption2, design: .monospaced).bold())
                .frame(width: 28, alignment: .trailing)
                .foregroundStyle(.secondary)

            // Indicateur sur terrain / banc
            Circle()
                .fill(player.isOnField ? Color.green : Color.gray.opacity(0.4))
                .frame(width: 8, height: 8)

            // Nom
            Text(player.playerName)
                .font(.caption)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Barre de progression
            let safeMax = max(maxTime, 1)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.gray.opacity(0.2))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(barColor(for: player))
                        .frame(width: geo.size.width * CGFloat(player.totalTime / safeMax))
                }
            }
            .frame(width: 60, height: 10)

            // Temps
            Text(formatShort(player.totalTime))
                .font(.system(.caption2, design: .monospaced))
                .frame(width: 40, alignment: .trailing)
        }
        .padding(.vertical, 2)
    }

    // MARK: - Helpers

    private func barColor(for player: MatchViewModel.LivePlayingTime) -> Color {
        if player.totalTime < 1 && !player.isOnField { return .red.opacity(0.7) }
        if player.isOnField { return .green }
        return .blue.opacity(0.6)
    }

    private func formatShort(_ time: TimeInterval) -> String {
        let m = Int(time) / 60
        let s = Int(time) % 60
        return String(format: "%d:%02d", m, s)
    }
}
