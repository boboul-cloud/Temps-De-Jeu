//
//  ExportImportView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI
import UniformTypeIdentifiers

/// Vue principale d'export / import
struct ExportImportView: View {
    @State private var players: [Player] = []
    @State private var matches: [Match] = []
    @State private var allCards: [CardEvent] = []

    // Shares
    @State private var showShareSheet = false
    @State private var shareItems: [Any] = []
    @State private var shareMessage: String?

    // Import
    @State private var showImportPicker = false
    @State private var showImportConfirmation = false
    @State private var importedPlayers: [Player] = []
    @State private var importMode: ImportMode = .merge

    // Alerts
    @State private var alertTitle = ""
    @State private var alertMessage = ""
    @State private var showAlert = false

    // PDF Preview
    @State private var showPDFPreview = false
    @State private var previewPDFData: Data?
    @State private var previewPDFTitle = ""

    @State private var isLoaded = false

    enum ImportMode: String, CaseIterable {
        case merge = "Fusionner"
        case replace = "Remplacer"
    }

    var body: some View {
        Group {
            if isLoaded {
                mainList
            } else {
                Color.clear
                    .onAppear {
                        players = TeamManager.shared.loadPlayers()
                        matches = DataManager.shared.loadMatches()
                        allCards = matches.flatMap { $0.cards }
                        isLoaded = true
                    }
            }
        }
    }

    private var mainList: some View {
        List {
            // MARK: - Export Joueurs
            Section {
                // JSON
                Button {
                    exportPlayersJSON()
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Exporter les joueurs (JSON)")
                                .font(.subheadline)
                            Text("Format réimportable dans l'app")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "doc.text")
                            .foregroundStyle(.blue)
                    }
                }

                // PDF
                Button {
                    exportPlayersPDF()
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Exporter les joueurs (PDF)")
                                .font(.subheadline)
                            Text("Fiche récapitulative de l'effectif")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "doc.richtext")
                            .foregroundStyle(.red)
                    }
                }
                .disabled(players.isEmpty)
            } header: {
                Text("Joueurs (\(players.count))")
            }

            // MARK: - Import Joueurs
            Section {
                Button {
                    showImportPicker = true
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Importer des joueurs (JSON)")
                                .font(.subheadline)
                            Text("Depuis un fichier exporté")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "square.and.arrow.down")
                            .foregroundStyle(.green)
                    }
                }
            } header: {
                Text("Import")
            }

            // MARK: - Export Stats
            Section {
                // PDF stats globales
                Button {
                    exportStatsPDF()
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Rapport statistiques (PDF)")
                                .font(.subheadline)
                            Text("Vue d'ensemble de tous les matchs")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "chart.bar.doc.horizontal")
                            .foregroundStyle(.purple)
                    }
                }
                .disabled(matches.isEmpty)
            } header: {
                Text("Statistiques (\(matches.filter { $0.isFinished }.count) matchs)")
            }

            // MARK: - Export Match individuel
            if !matches.isEmpty {
                Section {
                    ForEach(matches.filter { $0.isFinished }.prefix(10)) { match in
                        HStack {
                            // Tap pour voir le PDF
                            Button {
                                let data = ExportService.shared.generateMatchPDF(match: match)
                                let h = match.homeTeam.isEmpty ? "Match" : match.homeTeam
                                let a = match.awayTeam.isEmpty ? "" : " vs \(match.awayTeam)"
                                previewPDFData = data
                                previewPDFTitle = "\(h)\(a)"
                                showPDFPreview = true
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    let h = match.homeTeam.isEmpty ? "Domicile" : match.homeTeam
                                    let a = match.awayTeam.isEmpty ? "Extérieur" : match.awayTeam
                                    Text("\(h) \(match.homeScore)-\(match.awayScore) \(a)")
                                        .font(.subheadline.bold())
                                        .foregroundStyle(.primary)
                                    Text(match.date, style: .date)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            Spacer()

                            // Bouton exporter
                            Button {
                                exportMatchPDF(match)
                            } label: {
                                Image(systemName: "square.and.arrow.up")
                                    .foregroundStyle(.blue)
                            }
                            .buttonStyle(.borderless)

                            // Bouton voir PDF
                            Button {
                                let data = ExportService.shared.generateMatchPDF(match: match)
                                let h = match.homeTeam.isEmpty ? "Match" : match.homeTeam
                                let a = match.awayTeam.isEmpty ? "" : " vs \(match.awayTeam)"
                                previewPDFData = data
                                previewPDFTitle = "\(h)\(a)"
                                showPDFPreview = true
                            } label: {
                                Image(systemName: "doc.richtext")
                                    .foregroundStyle(.orange)
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                } header: {
                    Text("Rapport de match (PDF)")
                }
            }
        }
        .listStyle(.insetGrouped)
        .sheet(isPresented: $showShareSheet) {
            ActivityView(activityItems: shareItems)
        }
        .sheet(isPresented: $showPDFPreview) {
            if let data = previewPDFData {
                PDFPreviewView(pdfData: data, title: previewPDFTitle)
            }
        }
        .fileImporter(
            isPresented: $showImportPicker,
            allowedContentTypes: [.json],
            allowsMultipleSelection: false
        ) { result in
            handleImportResult(result)
        }
        .alert(alertTitle, isPresented: $showAlert) {
            Button("OK") {}
        } message: {
            Text(alertMessage)
        }
        .confirmationDialog(
            "Importer \(importedPlayers.count) joueurs",
            isPresented: $showImportConfirmation,
            titleVisibility: .visible
        ) {
            Button("Fusionner (ajouter les nouveaux)") {
                performImport(mode: .merge)
            }
            Button("Remplacer tout l'effectif") {
                performImport(mode: .replace)
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text("Comment souhaitez-vous importer les joueurs ?")
        }
    }

    // MARK: - Export Actions

    private func exportPlayersJSON() {
        guard let data = ExportService.shared.exportPlayersJSON(players) else {
            showAlertWith(title: "Erreur", message: "Impossible d'exporter les joueurs.")
            return
        }

        let fileName = "joueurs_\(formattedDateForFile()).json"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItems = [tempURL]
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                showShareSheet = true
            }
        } catch {
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private func exportPlayersPDF() {
        let data = ExportService.shared.generatePlayersPDF(players: players, allCards: allCards)
        let fileName = "effectif_\(formattedDateForFile()).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItems = [tempURL]
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                showShareSheet = true
            }
        } catch {
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private func exportStatsPDF() {
        let data = ExportService.shared.generateStatsPDF(matches: matches, players: players)
        let fileName = "stats_\(formattedDateForFile()).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItems = [tempURL]
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                showShareSheet = true
            }
        } catch {
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private func exportMatchPDF(_ match: Match) {
        let data = ExportService.shared.generateMatchPDF(match: match)
        let home = match.homeTeam.isEmpty ? "match" : match.homeTeam
        let away = match.awayTeam.isEmpty ? "" : "_vs_\(match.awayTeam)"
        let cleanName = "\(home)\(away)".replacingOccurrences(of: " ", with: "_")
        let fileName = "rapport_\(cleanName)_\(formattedDateForFile()).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItems = [tempURL]
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                showShareSheet = true
            }
        } catch {
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    // MARK: - Import Actions

    private func handleImportResult(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }

            guard url.startAccessingSecurityScopedResource() else {
                showAlertWith(title: "Erreur", message: "Impossible d'accéder au fichier.")
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            do {
                let data = try Data(contentsOf: url)
                guard let imported = ExportService.shared.importPlayersJSON(from: data) else {
                    showAlertWith(title: "Erreur", message: "Le fichier n'est pas un export de joueurs valide.")
                    return
                }
                importedPlayers = imported
                showImportConfirmation = true
            } catch {
                showAlertWith(title: "Erreur", message: "Impossible de lire le fichier : \(error.localizedDescription)")
            }

        case .failure(let error):
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private func performImport(mode: ImportMode) {
        switch mode {
        case .replace:
            players = importedPlayers
        case .merge:
            let existingIds = Set(players.map { $0.id })
            let newPlayers = importedPlayers.filter { !existingIds.contains($0.id) }
            players.append(contentsOf: newPlayers)
        }

        TeamManager.shared.savePlayers(players)
        showAlertWith(
            title: "Import réussi",
            message: mode == .replace
                ? "\(importedPlayers.count) joueurs importés (remplacement)."
                : "Effectif mis à jour. \(players.count) joueurs au total."
        )
        importedPlayers = []
    }

    // MARK: - Helpers

    private func formattedDateForFile() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private func showAlertWith(title: String, message: String) {
        alertTitle = title
        alertMessage = message
        showAlert = true
    }
}

// MARK: - UIActivityViewController wrapper

struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]
    var applicationActivities: [UIActivity]? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    NavigationStack {
        ExportImportView()
            .navigationTitle("Export / Import")
    }
}
