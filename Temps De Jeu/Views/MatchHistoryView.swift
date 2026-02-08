//
//  MatchHistoryView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

/// Vue de l'historique des matchs enregistrés
struct MatchHistoryView: View {
    @State private var matches: [Match] = []
    @State private var searchText = ""
    @State private var selectedMatch: Match?
    @State private var showDeleteConfirmation = false
    @State private var matchToDelete: Match?

    var filteredMatches: [Match] {
        if searchText.isEmpty { return matches }
        return matches.filter {
            $0.homeTeam.localizedCaseInsensitiveContains(searchText) ||
            $0.awayTeam.localizedCaseInsensitiveContains(searchText) ||
            $0.competition.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if matches.isEmpty {
                    emptyState
                } else {
                    matchList
                }
            }
            .navigationTitle("Historique")
            .searchable(text: $searchText, prompt: "Rechercher un match")
            .onAppear {
                matches = DataManager.shared.loadMatches()
            }
            .sheet(item: $selectedMatch) { match in
                MatchReportView(match: match)
            }
            .alert("Supprimer ce match ?", isPresented: $showDeleteConfirmation) {
                Button("Supprimer", role: .destructive) {
                    if let match = matchToDelete {
                        DataManager.shared.deleteMatch(match)
                        matches = DataManager.shared.loadMatches()
                    }
                }
                Button("Annuler", role: .cancel) {}
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("Aucun match enregistré")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Vos matchs terminés apparaîtront ici")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
        }
    }

    private var matchList: some View {
        List {
            ForEach(filteredMatches) { match in
                MatchHistoryRow(match: match)
                    .onTapGesture {
                        selectedMatch = match
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            matchToDelete = match
                            showDeleteConfirmation = true
                        } label: {
                            Label("Supprimer", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Ligne d'historique

struct MatchHistoryRow: View {
    let match: Match

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Équipes + Score
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(match.homeTeam.isEmpty ? "Domicile" : match.homeTeam)
                        .font(.headline)
                    if match.isMyTeamHome {
                        Text("Mon équipe")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.blue)
                    }
                }
                Spacer()
                Text("\(match.homeScore) - \(match.awayScore)")
                    .font(.system(.title3, design: .rounded).bold())
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(match.awayTeam.isEmpty ? "Extérieur" : match.awayTeam)
                        .font(.headline)
                    if !match.isMyTeamHome {
                        Text("Mon équipe")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.blue)
                    }
                }
            }

            // Infos
            HStack {
                if !match.competition.isEmpty {
                    Label(match.competition, systemImage: "trophy.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(match.date, style: .date)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Stats résumées
            HStack(spacing: 16) {
                StatMini(label: "Effectif", value: TimeFormatters.formatTime(match.totalEffectivePlayTime), color: .green)
                StatMini(label: "Arrêts", value: TimeFormatters.formatTime(match.totalStoppageTime), color: .red)
                StatMini(label: "Ratio", value: "\(Int(match.effectivePercentage))%", color: .blue)
                StatMini(label: "Événements", value: "\(match.stoppages.count)", color: .orange)
            }
        }
        .padding(.vertical, 4)
    }
}

struct StatMini: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(.caption, design: .monospaced))
                .bold()
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(.tertiary)
        }
    }
}

// MARK: - Rapport de match détaillé

struct MatchReportView: View {
    let match: Match
    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false
    @State private var shareItems: [Any] = []
    @State private var showPDFPreview = false
    @State private var pdfData: Data?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(match.homeTeam.isEmpty ? "Domicile" : match.homeTeam)
                                    .font(.title2.bold())
                                if match.isMyTeamHome {
                                    Text("Mon équipe")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(.blue)
                                }
                            }
                            Spacer()
                            Text("\(match.homeScore) - \(match.awayScore)")
                                .font(.system(.largeTitle, design: .rounded).bold())
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(match.awayTeam.isEmpty ? "Extérieur" : match.awayTeam)
                                    .font(.title2.bold())
                                if !match.isMyTeamHome {
                                    Text("Mon équipe")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(.blue)
                                }
                            }
                        }
                        if !match.competition.isEmpty {
                            Text(match.competition)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Text(match.date, style: .date)
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .padding()

                    // Vue globale
                    VStack(spacing: 12) {
                        SectionHeader(title: "Résumé", icon: "chart.pie.fill")

                        let effectiveRatio = match.totalMatchDuration > 0
                            ? match.totalEffectivePlayTime / match.totalMatchDuration
                            : 0

                        ZStack {
                            Circle()
                                .stroke(Color.red.opacity(0.2), lineWidth: 16)
                            Circle()
                                .trim(from: 0, to: CGFloat(effectiveRatio))
                                .stroke(Color.green, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                            VStack {
                                Text("\(Int(match.effectivePercentage))%")
                                    .font(.system(size: 28, weight: .bold, design: .rounded))
                                    .foregroundStyle(.green)
                                Text("Effectif")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(width: 120, height: 120)

                        HStack(spacing: 20) {
                            StatBox(title: "Durée totale", value: TimeFormatters.formatTime(match.totalMatchDuration), color: .blue)
                            StatBox(title: "Jeu effectif", value: TimeFormatters.formatTime(match.totalEffectivePlayTime), color: .green)
                            StatBox(title: "Arrêts", value: TimeFormatters.formatTime(match.totalStoppageTime), color: .red)
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)

                    // Détail par type
                    VStack(spacing: 12) {
                        SectionHeader(title: "Par type d'arrêt", icon: "list.bullet.rectangle.fill")

                        let usedTypes = StoppageType.allCases.filter { match.stoppageCount(for: $0) > 0 }
                        let homeLabel = match.homeTeam.isEmpty ? "DOM" : match.homeTeam
                        let awayLabel = match.awayTeam.isEmpty ? "EXT" : match.awayTeam

                        ForEach(usedTypes) { type in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Image(systemName: type.icon)
                                        .foregroundStyle(type.color)
                                        .frame(width: 24)
                                    Text(type.rawValue)
                                        .font(.subheadline)
                                    Spacer()
                                    Text("\(match.stoppageCount(for: type))x")
                                        .font(.caption.bold())
                                        .foregroundStyle(.secondary)
                                    Text(TimeFormatters.formatShort(match.totalTime(for: type)))
                                        .font(.subheadline.bold())
                                        .foregroundStyle(type.color)
                                        .frame(width: 60, alignment: .trailing)
                                }

                                let homeCount = match.stoppageCount(for: type, team: .home)
                                let awayCount = match.stoppageCount(for: type, team: .away)
                                if homeCount > 0 || awayCount > 0 {
                                    HStack(spacing: 8) {
                                        Spacer().frame(width: 24)
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
                            }
                            .padding(.vertical, 2)
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)

                    // Détail par période
                    VStack(spacing: 12) {
                        SectionHeader(title: "Par période", icon: "clock.fill")

                        ForEach(MatchPeriod.allCases) { period in
                            if let duration = match.periodDurations[period.rawValue] {
                                let effective = match.effectivePlayTime(for: period)
                                let stoppages = match.totalStoppageTime(for: period)

                                HStack {
                                    Text(period.shortName)
                                        .font(.caption.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.green)
                                        .foregroundColor(.white)
                                        .cornerRadius(6)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Effectif: \(TimeFormatters.formatTime(effective))")
                                            .font(.subheadline)
                                        Text("Arrêts: \(TimeFormatters.formatTime(stoppages))")
                                            .font(.caption)
                                            .foregroundStyle(.red)
                                    }

                                    Spacer()

                                    Text(TimeFormatters.formatTime(duration))
                                        .font(.system(.caption, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)

                    // Buts
                    if !match.goals.isEmpty {
                        VStack(spacing: 12) {
                            SectionHeader(title: "Buts (\(match.homeScore) - \(match.awayScore))", icon: "soccerball")

                            ForEach(match.goals) { goal in
                                HStack(spacing: 10) {
                                    Text("\(Int(goal.minute / 60))'")
                                        .font(.system(.caption, design: .monospaced).bold())
                                        .foregroundStyle(.secondary)
                                        .frame(width: 35, alignment: .trailing)

                                    Image(systemName: "soccerball")
                                        .font(.caption)
                                        .foregroundStyle(goal.isHome == match.isMyTeamHome ? .green : .red)

                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(goal.isHome
                                             ? (match.homeTeam.isEmpty ? "Domicile" : match.homeTeam)
                                             : (match.awayTeam.isEmpty ? "Extérieur" : match.awayTeam))
                                            .font(.subheadline.bold())
                                            .foregroundStyle(goal.isHome == match.isMyTeamHome ? .primary : .secondary)
                                        if !goal.playerName.isEmpty {
                                            Text(goal.playerName)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }

                                    Spacer()

                                    Text(goal.period.shortName)
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.green.opacity(0.15))
                                        .cornerRadius(4)
                                }
                            }

                            // Résumé buteurs mon équipe
                            let myGoals = match.goals.filter { $0.isHome == match.isMyTeamHome && !$0.playerName.isEmpty }
                            if !myGoals.isEmpty {
                                let scorers = Dictionary(grouping: myGoals, by: { $0.playerName })
                                    .map { (name: $0.key, count: $0.value.count) }
                                    .sorted { $0.count > $1.count }
                                Divider()
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Buteurs mon équipe")
                                        .font(.caption.bold())
                                        .foregroundStyle(.secondary)
                                    ForEach(scorers, id: \.name) { scorer in
                                        HStack {
                                            Text(scorer.name)
                                                .font(.subheadline)
                                            Spacer()
                                            Text("\(scorer.count) but\(scorer.count > 1 ? "s" : "")")
                                                .font(.caption.bold())
                                                .foregroundStyle(.green)
                                        }
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(16)
                    }

                    // Temps de jeu par joueur
                    let playingTimes = match.playerPlayingTimes()
                    if !playingTimes.isEmpty {
                        VStack(spacing: 12) {
                            SectionHeader(title: "Temps de jeu", icon: "person.crop.circle.badge.clock")

                            ForEach(playingTimes, id: \.playerId) { pt in
                                HStack(spacing: 10) {
                                    Text("#\(pt.shirtNumber)")
                                        .font(.system(.caption, design: .rounded).bold())
                                        .foregroundColor(.white)
                                        .frame(width: 30, height: 30)
                                        .background(positionColor(pt.position))
                                        .clipShape(Circle())

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(pt.playerName)
                                            .font(.subheadline.bold())
                                        HStack(spacing: 4) {
                                            Text(pt.position.shortName)
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                            if pt.isTitulaire {
                                                Text("TIT")
                                                    .font(.system(size: 8, weight: .bold))
                                                    .padding(.horizontal, 4)
                                                    .padding(.vertical, 1)
                                                    .background(Color.green.opacity(0.2))
                                                    .foregroundStyle(.green)
                                                    .cornerRadius(3)
                                            }
                                        }
                                    }

                                    Spacer()

                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text(TimeFormatters.formatTime(pt.totalTime))
                                            .font(.system(.subheadline, design: .monospaced).bold())
                                            .foregroundStyle(.primary)
                                        Text("eff. \(TimeFormatters.formatTime(pt.effectiveTime))")
                                            .font(.system(.caption2, design: .monospaced))
                                            .foregroundStyle(.green)
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(16)
                    }
                }
                .padding()
            }
            .navigationTitle("Rapport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        let data = ExportService.shared.generateMatchPDF(match: match)
                        pdfData = data
                        showPDFPreview = true
                    } label: {
                        Image(systemName: "doc.richtext")
                    }
                }
                ToolbarItem(placement: .principal) {
                    Button {
                        let data = ExportService.shared.generateMatchPDF(match: match)
                        let home = match.homeTeam.isEmpty ? "match" : match.homeTeam
                        let away = match.awayTeam.isEmpty ? "" : "_vs_\(match.awayTeam)"
                        let cleanName = "\(home)\(away)".replacingOccurrences(of: " ", with: "_")
                        let f = DateFormatter()
                        f.dateFormat = "yyyy-MM-dd"
                        let fileName = "rapport_\(cleanName)_\(f.string(from: Date())).pdf"
                        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                        try? data.write(to: tempURL)
                        shareItems = [tempURL]
                        showShareSheet = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
            .sheet(isPresented: $showShareSheet) {
                ActivityView(activityItems: shareItems)
            }
            .sheet(isPresented: $showPDFPreview) {
                if let data = pdfData {
                    let home = match.homeTeam.isEmpty ? "Match" : match.homeTeam
                    let away = match.awayTeam.isEmpty ? "" : " vs \(match.awayTeam)"
                    PDFPreviewView(pdfData: data, title: "Rapport \(home)\(away)")
                }
            }
        }
    }

    private func positionColor(_ position: PlayerPosition) -> Color {
        switch position {
        case .gardien: return .orange
        case .defenseur: return .blue
        case .milieu: return .green
        case .attaquant: return .red
        }
    }
}

#Preview {
    MatchHistoryView()
}
