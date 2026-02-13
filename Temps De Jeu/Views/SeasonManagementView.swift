//
//  SeasonManagementView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 13/02/2026.
//

import SwiftUI

/// Vue de gestion des saisons
struct SeasonManagementView: View {
    @ObservedObject var seasonManager = SeasonManager.shared
    @Environment(\.dismiss) private var dismiss

    // Nouvelle saison
    @State private var showNewSeasonSheet = false
    @State private var newClubName = ""
    @State private var newStartDate = Date()

    // Clôture
    @State private var showCloseConfirmation = false
    @State private var showCloseSuccess = false

    // Archives
    @State private var archives: [SeasonArchive] = []
    @State private var selectedArchive: SeasonArchive?
    @State private var showDeleteArchiveConfirmation = false
    @State private var archiveToDelete: SeasonArchive?

    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .long
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }

    private var shortDateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }

    var body: some View {
        List {
            // MARK: - Saison en cours
            if let season = seasonManager.currentSeason {
                currentSeasonSection(season)
            } else {
                noSeasonSection
            }

            // MARK: - Archives
            archivesSection
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Saisons")
        .onAppear { archives = seasonManager.loadArchives() }
        .sheet(isPresented: $showNewSeasonSheet) {
            newSeasonSheet
        }
        .sheet(item: $selectedArchive) { archive in
            NavigationStack {
                ArchiveDetailView(archive: archive)
            }
        }
        .alert("Clôturer la saison ?", isPresented: $showCloseConfirmation) {
            Button("Clôturer", role: .destructive) {
                if seasonManager.closeSeason() {
                    archives = seasonManager.loadArchives()
                    showCloseSuccess = true
                }
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text("Les statistiques seront archivées. Les matchs, entraînements et cartons seront remis à zéro pour la prochaine saison. L'effectif est conservé.")
        }
        .alert("Saison clôturée ✓", isPresented: $showCloseSuccess) {
            Button("OK") {}
        } message: {
            Text("Les statistiques ont été archivées. Vous pouvez créer une nouvelle saison.")
        }
        .alert("Supprimer cette archive ?", isPresented: $showDeleteArchiveConfirmation) {
            Button("Supprimer", role: .destructive) {
                if let archive = archiveToDelete {
                    seasonManager.deleteArchive(archive)
                    archives = seasonManager.loadArchives()
                }
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text("Cette action est irréversible. Les statistiques de cette saison seront définitivement perdues.")
        }
    }

    // MARK: - Saison en cours

    private func currentSeasonSection(_ season: Season) -> some View {
        Section {
            // Info saison
            HStack(spacing: 14) {
                Image(systemName: "sportscourt.fill")
                    .font(.title2)
                    .foregroundStyle(.green)
                    .frame(width: 40)

                VStack(alignment: .leading, spacing: 4) {
                    Text(season.clubName)
                        .font(.headline)
                    Text("Saison \(season.label)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("Depuis le \(dateFormatter.string(from: season.startDate))")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.vertical, 4)

            // Résumé rapide
            let matches = DataManager.shared.loadMatches()
            let finished = matches.filter { $0.isFinished }
            let sessions = TrainingManager.shared.loadSessions()

            HStack(spacing: 20) {
                VStack {
                    Text("\(finished.count)")
                        .font(.title2.bold())
                        .foregroundStyle(.blue)
                    Text("Matchs")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)

                VStack {
                    Text("\(sessions.count)")
                        .font(.title2.bold())
                        .foregroundStyle(.orange)
                    Text("Entraînements")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)

                let allCards = matches.flatMap { $0.cards }
                VStack {
                    Text("\(allCards.count)")
                        .font(.title2.bold())
                        .foregroundStyle(.red)
                    Text("Cartons")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.vertical, 8)

            // Bouton clôturer
            Button {
                showCloseConfirmation = true
            } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Clôturer la saison")
                            .font(.subheadline.bold())
                        Text("Archiver les stats et repartir à zéro")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "flag.checkered")
                        .foregroundStyle(.red)
                }
            }
        } header: {
            Text("Saison en cours")
        }
    }

    // MARK: - Pas de saison

    private var noSeasonSection: some View {
        Section {
            VStack(spacing: 16) {
                Image(systemName: "calendar.badge.plus")
                    .font(.system(size: 44))
                    .foregroundStyle(.green)

                Text("Aucune saison active")
                    .font(.headline)

                Text("Créez une saison pour organiser vos statistiques par année sportive.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                Button {
                    // Pré-remplir le club si on a une archive
                    if let lastClub = archives.first?.season.clubName, newClubName.isEmpty {
                        newClubName = lastClub
                    }
                    showNewSeasonSheet = true
                } label: {
                    Label("Nouvelle saison", systemImage: "plus.circle.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(.green)
                        .foregroundStyle(.white)
                        .cornerRadius(12)
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
        } header: {
            Text("Saison")
        }
    }

    // MARK: - Archives section

    private var archivesSection: some View {
        Section {
            if archives.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "archivebox")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                        Text("Aucune saison archivée")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 12)
                    Spacer()
                }
            } else {
                ForEach(archives) { archive in
                    Button {
                        selectedArchive = archive
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "archivebox.fill")
                                .foregroundStyle(.purple)
                                .frame(width: 30)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(archive.season.clubName) — \(archive.season.label)")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.primary)

                                let matchCount = archive.matches.filter { $0.isFinished }.count
                                let sessionCount = archive.trainingSessions.count
                                Text("\(matchCount) matchs · \(sessionCount) entraînements")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            archiveToDelete = archive
                            showDeleteArchiveConfirmation = true
                        } label: {
                            Label("Supprimer", systemImage: "trash")
                        }
                    }
                }
            }
        } header: {
            Text("Archives (\(archives.count))")
        }
    }

    // MARK: - New Season Sheet

    private var newSeasonSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nom du club", text: $newClubName)
                    DatePicker("Date de début", selection: $newStartDate, displayedComponents: .date)
                } header: {
                    Text("Nouvelle saison")
                } footer: {
                    Text("L'effectif actuel est conservé. Les matchs, entraînements et cartons repartiront à zéro.")
                }
            }
            .navigationTitle("Nouvelle saison")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { showNewSeasonSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        seasonManager.createSeason(clubName: newClubName.trimmingCharacters(in: .whitespaces), startDate: newStartDate)
                        newClubName = ""
                        newStartDate = Date()
                        showNewSeasonSheet = false
                    }
                    .disabled(newClubName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Vue détail archive

struct ArchiveDetailView: View {
    let archive: SeasonArchive
    @Environment(\.dismiss) private var dismiss

    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .long
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }

    private var finishedMatches: [Match] {
        archive.matches.filter { $0.isFinished }
    }

    private func positionColor(_ position: PlayerPosition) -> Color {
        switch position {
        case .gardien: return .orange
        case .defenseur: return .blue
        case .milieu: return .green
        case .attaquant: return .red
        }
    }

    var body: some View {
        List {
            // Info saison
            Section {
                LabeledContent("Club", value: archive.season.clubName)
                LabeledContent("Début", value: dateFormatter.string(from: archive.season.startDate))
                if let end = archive.season.endDate {
                    LabeledContent("Fin", value: dateFormatter.string(from: end))
                }
            } header: {
                Text("Saison \(archive.season.label)")
            }

            // Résumé
            Section {
                LabeledContent("Matchs joués", value: "\(finishedMatches.count)")
                LabeledContent("Entraînements", value: "\(archive.trainingSessions.count)")
                LabeledContent("Joueurs", value: "\(archive.players.count)")

                let allCards = archive.matches.flatMap { $0.cards }
                let yellows = allCards.filter { $0.type == .yellow }.count
                let reds = allCards.filter { $0.type == .red || $0.type == .secondYellow }.count
                if yellows + reds > 0 {
                    LabeledContent("Cartons", value: "\(yellows) jaunes · \(reds) rouges")
                }
            } header: {
                Text("Statistiques")
            }

            // Résumé bilan
            if !finishedMatches.isEmpty {
                Section {
                    let wins = finishedMatches.filter { $0.myScore > $0.opponentScore }.count
                    let draws = finishedMatches.filter { $0.myScore == $0.opponentScore }.count
                    let losses = finishedMatches.filter { $0.myScore < $0.opponentScore }.count
                    let goalsFor = finishedMatches.reduce(0) { $0 + $1.myScore }
                    let goalsAgainst = finishedMatches.reduce(0) { $0 + $1.opponentScore }

                    HStack(spacing: 20) {
                        VStack {
                            Text("\(wins)")
                                .font(.title2.bold())
                                .foregroundStyle(.green)
                            Text("V")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)

                        VStack {
                            Text("\(draws)")
                                .font(.title2.bold())
                                .foregroundStyle(.orange)
                            Text("N")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)

                        VStack {
                            Text("\(losses)")
                                .font(.title2.bold())
                                .foregroundStyle(.red)
                            Text("D")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .padding(.vertical, 4)

                    LabeledContent("Buts marqués", value: "\(goalsFor)")
                    LabeledContent("Buts encaissés", value: "\(goalsAgainst)")
                    LabeledContent("Différence", value: "\(goalsFor - goalsAgainst > 0 ? "+" : "")\(goalsFor - goalsAgainst)")
                } header: {
                    Text("Bilan")
                }
            }

            // Effectif
            if !archive.players.isEmpty {
                Section {
                    ForEach(PlayerPosition.allCases) { position in
                        let playersInPosition = archive.players
                            .filter { $0.position == position }
                            .sorted { $0.lastName.localizedCaseInsensitiveCompare($1.lastName) == .orderedAscending }

                        if !playersInPosition.isEmpty {
                            ForEach(playersInPosition) { player in
                                HStack(spacing: 10) {
                                    Text(position.shortName)
                                        .font(.caption2.bold())
                                        .foregroundStyle(.white)
                                        .frame(width: 32, height: 22)
                                        .background(positionColor(position).opacity(0.85))
                                        .cornerRadius(6)

                                    Text("\(player.firstName) \(player.lastName)")
                                        .font(.subheadline)
                                }
                            }
                        }
                    }
                } header: {
                    Text("Effectif (\(archive.players.count))")
                }
            }

            // Liste des matchs
            if !finishedMatches.isEmpty {
                Section {
                    ForEach(finishedMatches.sorted(by: { $0.date > $1.date })) { match in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                let h = match.homeTeam.isEmpty ? "DOM" : match.homeTeam
                                let a = match.awayTeam.isEmpty ? "EXT" : match.awayTeam
                                Text("\(h) \(match.homeScore)-\(match.awayScore) \(a)")
                                    .font(.subheadline.bold())
                                Text(dateFormatter.string(from: match.date))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            let result = match.myScore > match.opponentScore ? "V" : (match.myScore == match.opponentScore ? "N" : "D")
                            let color: Color = result == "V" ? .green : (result == "N" ? .orange : .red)
                            Text(result)
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(color.opacity(0.15))
                                .foregroundStyle(color)
                                .cornerRadius(6)
                        }
                    }
                } header: {
                    Text("Matchs")
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(archive.season.clubName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Fermer") { dismiss() }
            }
        }
    }
}

#Preview {
    NavigationStack {
        SeasonManagementView()
    }
}
