//
//  PostMatchRecapView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/03/2026.
//

import SwiftUI

/// Récapitulatif automatique post-match — affiché après "Terminer le match"
/// Génère un résumé partageable (texte) avec score, buteurs, passeurs, temps effectif, cartons
struct PostMatchRecapView: View {
    let match: Match
    let onDismiss: () -> Void

    @State private var showCopiedToast = false
    @State private var showShareSheet = false

    private var recapText: String {
        buildRecapText()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Score
                    scoreCard

                    // Résumé temps
                    timeCard

                    // Buteurs
                    if !myGoals.isEmpty {
                        scorersCard
                    }

                    // Passes décisives
                    if !myAssists.isEmpty {
                        assistsCard
                    }

                    // Cartons
                    if !match.cards.isEmpty {
                        cardsCard
                    }

                    // Temps de jeu joueurs (top 5 + bottom 5)
                    if !match.playerPlayingTimes().isEmpty {
                        playingTimeCard
                    }

                    // Boutons de partage
                    shareButtons
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Résumé du match")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") {
                        onDismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .overlay {
                if showCopiedToast {
                    copiedToast
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .sheet(isPresented: $showShareSheet) {
                PostMatchActivityVC(activityItems: [recapText])
                    .presentationDetents([.medium, .large])
            }
        }
    }

    // MARK: - Score

    private var scoreCard: some View {
        VStack(spacing: 8) {
            // Résultat
            let result = matchResult
            Text(result.emoji)
                .font(.system(size: 48))

            HStack(spacing: 16) {
                VStack(spacing: 4) {
                    Text(match.homeTeam.isEmpty ? "Domicile" : match.homeTeam)
                        .font(.subheadline)
                        .foregroundStyle(match.isMyTeamHome ? .primary : .secondary)
                    if match.isMyTeamHome {
                        Text("Mon équipe")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .trailing)

                Text("\(match.homeScore) - \(match.awayScore)")
                    .font(.system(size: 36, weight: .bold, design: .rounded))

                VStack(spacing: 4) {
                    Text(match.awayTeam.isEmpty ? "Extérieur" : match.awayTeam)
                        .font(.subheadline)
                        .foregroundStyle(!match.isMyTeamHome ? .primary : .secondary)
                    if !match.isMyTeamHome {
                        Text("Mon équipe")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Text(result.label)
                .font(.headline)
                .foregroundStyle(result.color)
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
    }

    // MARK: - Time

    private var timeCard: some View {
        VStack(spacing: 8) {
            Label("Temps de jeu", systemImage: "timer")
                .font(.subheadline.bold())
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 24) {
                statItem(label: "Durée totale", value: formatTime(match.totalMatchDuration))
                statItem(label: "Temps effectif", value: formatTime(match.totalEffectivePlayTime))
                statItem(label: "Ratio", value: "\(Int(match.effectivePercentage))%")
            }

            HStack(spacing: 24) {
                statItem(label: "Arrêts", value: "\(match.stoppages.count)")
                statItem(label: "Remplacements", value: "\(match.substitutions.count)")
                statItem(label: "Fautes", value: "\(match.fouls.count)")
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
    }

    // MARK: - Scorers

    private var myGoals: [GoalEvent] {
        match.goals.filter { $0.isHome == match.isMyTeamHome && !$0.playerName.isEmpty }
    }

    private var scorersCard: some View {
        VStack(spacing: 8) {
            Label("Buteurs (\(myGoals.count))", systemImage: "soccerball")
                .font(.subheadline.bold())
                .frame(maxWidth: .infinity, alignment: .leading)

            let grouped = Dictionary(grouping: myGoals, by: { $0.playerName })
            let sorted = grouped.sorted { $0.value.count > $1.value.count }

            ForEach(sorted, id: \.key) { name, goals in
                HStack {
                    Text("⚽ \(name)")
                        .font(.callout)
                    Spacer()
                    let minutes = goals.map { "\(Int($0.minute / 60))'" }.joined(separator: ", ")
                    Text(minutes)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if goals.count > 1 {
                        Text("×\(goals.count)")
                            .font(.caption.bold())
                    }
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
    }

    // MARK: - Assists

    private var myAssists: [AssistEvent] {
        match.assists
    }

    private var assistsCard: some View {
        VStack(spacing: 8) {
            Label("Passes décisives (\(myAssists.count))", systemImage: "hand.point.up.fill")
                .font(.subheadline.bold())
                .frame(maxWidth: .infinity, alignment: .leading)

            let grouped = Dictionary(grouping: myAssists, by: { $0.playerName })
            let sorted = grouped.sorted { $0.value.count > $1.value.count }

            ForEach(sorted, id: \.key) { name, assists in
                HStack {
                    Text("🅰️ \(name)")
                        .font(.callout)
                    Spacer()
                    let minutes = assists.map { "\(Int($0.minute / 60))'" }.joined(separator: ", ")
                    Text(minutes)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if assists.count > 1 {
                        Text("×\(assists.count)")
                            .font(.caption.bold())
                    }
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
    }

    // MARK: - Cards

    private var cardsCard: some View {
        VStack(spacing: 8) {
            Label("Cartons (\(match.cards.count))", systemImage: "rectangle.portrait.fill")
                .font(.subheadline.bold())
                .frame(maxWidth: .infinity, alignment: .leading)

            ForEach(match.cards) { card in
                HStack {
                    cardIcon(card.type)
                    Text(card.playerName)
                        .font(.callout)
                    Spacer()
                    Text("\(Int(card.minute / 60))'")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
    }

    // MARK: - Playing time

    private var playingTimeCard: some View {
        VStack(spacing: 8) {
            Label("Temps de jeu", systemImage: "clock.fill")
                .font(.subheadline.bold())
                .frame(maxWidth: .infinity, alignment: .leading)

            let times = match.playerPlayingTimes()
            let maxTime = times.first?.totalTime ?? 1

            ForEach(times.prefix(14), id: \.playerId) { pt in
                HStack(spacing: 8) {
                    Text("#\(pt.shirtNumber)")
                        .font(.system(.caption2, design: .monospaced))
                        .frame(width: 24, alignment: .trailing)
                        .foregroundStyle(.secondary)

                    Text(pt.playerName)
                        .font(.caption)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color.gray.opacity(0.2))
                            RoundedRectangle(cornerRadius: 3)
                                .fill(pt.isTitulaire ? Color.green.opacity(0.7) : Color.blue.opacity(0.7))
                                .frame(width: geo.size.width * CGFloat(pt.totalTime / maxTime))
                        }
                    }
                    .frame(width: 80, height: 10)

                    Text(formatTime(pt.totalTime))
                        .font(.system(.caption2, design: .monospaced))
                        .frame(width: 46, alignment: .trailing)
                }
            }

            if times.count > 14 {
                Text("+ \(times.count - 14) autres joueurs")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(16)
    }

    // MARK: - Share

    private var shareButtons: some View {
        VStack(spacing: 12) {
            Button {
                showShareSheet = true
            } label: {
                Label("Partager le résumé", systemImage: "square.and.arrow.up")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.orange)
                    .foregroundStyle(.white)
                    .cornerRadius(14)
            }

            Button {
                UIPasteboard.general.string = recapText
                withAnimation { showCopiedToast = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    withAnimation { showCopiedToast = false }
                }
            } label: {
                Label("Copier le texte", systemImage: "doc.on.doc")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color(.systemGray5))
                    .foregroundStyle(.primary)
                    .cornerRadius(12)
            }
        }
    }

    private var copiedToast: some View {
        Text("📋 Copié !")
            .font(.subheadline.bold())
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
    }

    // MARK: - Build text recap

    private func buildRecapText() -> String {
        var lines: [String] = []

        let result = matchResult
        let home = match.homeTeam.isEmpty ? "Domicile" : match.homeTeam
        let away = match.awayTeam.isEmpty ? "Extérieur" : match.awayTeam

        lines.append("\(result.emoji) \(home) \(match.homeScore) - \(match.awayScore) \(away)")
        lines.append("")

        // Date
        let df = DateFormatter()
        df.dateStyle = .long
        df.locale = Locale(identifier: "fr_FR")
        lines.append("📅 \(df.string(from: match.date))")

        // Temps
        lines.append("⏱ Temps effectif : \(formatTime(match.totalEffectivePlayTime)) / \(formatTime(match.totalMatchDuration)) (\(Int(match.effectivePercentage))%)")
        lines.append("🛑 \(match.stoppages.count) arrêts · 🔄 \(match.substitutions.count) remplacements")

        // Buteurs
        if !myGoals.isEmpty {
            lines.append("")
            let grouped = Dictionary(grouping: myGoals, by: { $0.playerName })
            let sorted = grouped.sorted { $0.value.count > $1.value.count }
            for (name, goals) in sorted {
                let minutes = goals.map { "\(Int($0.minute / 60))'" }.joined(separator: ", ")
                lines.append("⚽ \(name) (\(minutes))")
            }
        }

        // Passes décisives
        if !myAssists.isEmpty {
            lines.append("")
            let grouped = Dictionary(grouping: myAssists, by: { $0.playerName })
            let sorted = grouped.sorted { $0.value.count > $1.value.count }
            for (name, assists) in sorted {
                let minutes = assists.map { "\(Int($0.minute / 60))'" }.joined(separator: ", ")
                lines.append("🅰️ \(name) (\(minutes))")
            }
        }

        // Cartons
        if !match.cards.isEmpty {
            lines.append("")
            for card in match.cards {
                let emoji: String
                switch card.type {
                case .yellow: emoji = "🟨"
                case .secondYellow: emoji = "🟨🟨"
                case .red: emoji = "🟥"
                case .white: emoji = "⬜"
                }
                lines.append("\(emoji) \(card.playerName) (\(Int(card.minute / 60))')")
            }
        }

        lines.append("")
        lines.append("— Temps De Jeu ⚽")

        return lines.joined(separator: "\n")
    }

    // MARK: - Helpers

    private struct MatchResult {
        let emoji: String
        let label: String
        let color: Color
    }

    private var matchResult: MatchResult {
        let myScore = match.isMyTeamHome ? match.homeScore : match.awayScore
        let oppScore = match.isMyTeamHome ? match.awayScore : match.homeScore
        if myScore > oppScore {
            return MatchResult(emoji: "🏆", label: "Victoire", color: .green)
        } else if myScore < oppScore {
            return MatchResult(emoji: "😔", label: "Défaite", color: .red)
        } else {
            return MatchResult(emoji: "🤝", label: "Match nul", color: .orange)
        }
    }

    private func formatTime(_ time: TimeInterval) -> String {
        let m = Int(time) / 60
        let s = Int(time) % 60
        return String(format: "%d:%02d", m, s)
    }

    private func statItem(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.callout.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func cardIcon(_ type: CardType) -> some View {
        switch type {
        case .yellow:
            RoundedRectangle(cornerRadius: 2)
                .fill(.yellow)
                .frame(width: 12, height: 16)
        case .secondYellow:
            ZStack {
                RoundedRectangle(cornerRadius: 2)
                    .fill(.yellow)
                    .frame(width: 12, height: 16)
                    .offset(x: -2)
                RoundedRectangle(cornerRadius: 2)
                    .fill(.red)
                    .frame(width: 12, height: 16)
                    .offset(x: 2)
            }
            .frame(width: 18)
        case .red:
            RoundedRectangle(cornerRadius: 2)
                .fill(.red)
                .frame(width: 12, height: 16)
        case .white:
            RoundedRectangle(cornerRadius: 2)
                .fill(.white)
                .frame(width: 12, height: 16)
                .overlay(
                    RoundedRectangle(cornerRadius: 2)
                        .stroke(.gray, lineWidth: 0.5)
                )
        }
    }
}

// MARK: - UIActivityViewController for post-match share

private struct PostMatchActivityVC: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
