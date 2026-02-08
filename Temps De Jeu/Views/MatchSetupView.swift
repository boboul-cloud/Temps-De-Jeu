//
//  MatchSetupView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI
import UniformTypeIdentifiers

/// Wrapper identifiable pour les items de partage
struct ShareItemsWrapper: Identifiable {
    let id = UUID()
    let items: [Any]
}

/// Vue de configuration avant le début du match
struct MatchSetupView: View {
    @ObservedObject var viewModel: MatchViewModel
    @ObservedObject var storeManager: StoreManager
    @EnvironmentObject var deepLinkManager: DeepLinkManager
    @Binding var showMatch: Bool
    @State private var showPaywall = false
    @State private var showRosterSelection = false
    @State private var allPlayers: [Player] = []

    // Export / Import roster
    @State private var shareItemsWrapper: ShareItemsWrapper?
    @State private var showImportRosterPicker = false
    @State private var importedRosterExport: RosterExport?
    @State private var unavailablePlayerIds: Set<UUID> = []
    @State private var importChain: [String] = []

    // PDF Preview
    @State private var showPDFPreview = false
    @State private var previewPDFData: Data?
    @State private var previewPDFTitle = ""

    // Alerts
    @State private var alertTitle = ""
    @State private var alertMessage = ""
    @State private var showAlert = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Logo / Titre
                    VStack(spacing: 8) {
                        Image(systemName: "sportscourt.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(.green)

                        Text("Temps De Jeu")
                            .font(.largeTitle.bold())

                        Text("Gestion du temps effectif")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 20)

                    // Infos match
                    VStack(spacing: 16) {
                        SectionHeader(title: "Informations du match", icon: "info.circle")

                        // Sélecteur domicile / extérieur
                        VStack(spacing: 8) {
                            Text("Mon équipe joue")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Picker("Mon équipe joue", selection: $viewModel.match.isMyTeamHome) {
                                Label("À domicile", systemImage: "house.fill").tag(true)
                                Label("À l'extérieur", systemImage: "airplane").tag(false)
                            }
                            .pickerStyle(.segmented)
                        }
                        .padding(.vertical, 4)

                        CustomTextField(
                            placeholder: viewModel.match.isMyTeamHome ? "Mon équipe (domicile)" : "Équipe domicile",
                            text: $viewModel.match.homeTeam,
                            icon: viewModel.match.isMyTeamHome ? "star.fill" : "house.fill"
                        )
                        CustomTextField(
                            placeholder: viewModel.match.isMyTeamHome ? "Adversaire (extérieur)" : "Mon équipe (extérieur)",
                            text: $viewModel.match.awayTeam,
                            icon: viewModel.match.isMyTeamHome ? "airplane" : "star.fill"
                        )
                        CustomTextField(placeholder: "Compétition", text: $viewModel.match.competition, icon: "trophy.fill")
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)

                    // Composition du match
                    VStack(spacing: 12) {
                        SectionHeader(title: "Composition", icon: "person.3.fill")

                        if viewModel.matchRoster.isEmpty {
                            // Pas encore de composition
                            Button {
                                showRosterSelection = true
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "person.badge.plus")
                                        .font(.title3)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Composer l'équipe")
                                            .font(.subheadline.bold())
                                        Text("Sélectionner les joueurs pour ce match")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundStyle(.secondary)
                                }
                                .padding()
                                .background(Color(.systemBackground))
                                .cornerRadius(12)
                            }
                            .foregroundStyle(.primary)
                        } else {
                            // Résumé de la composition
                            let tit = viewModel.titulaires
                            let remp = viewModel.remplacants
                            VStack(spacing: 8) {
                                HStack(spacing: 16) {
                                    VStack {
                                        Text("\(tit.count)")
                                            .font(.title2.bold())
                                            .foregroundStyle(.green)
                                        Text("Titulaires")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                    VStack {
                                        Text("\(remp.count)")
                                            .font(.title2.bold())
                                            .foregroundStyle(.orange)
                                        Text("Remplaçants")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }

                                // Liste compacte des titulaires
                                if !tit.isEmpty {
                                    ScrollView(.horizontal, showsIndicators: false) {
                                        HStack(spacing: 6) {
                                            ForEach(tit.sorted(by: { $0.shirtNumber < $1.shirtNumber })) { mp in
                                                Text("#\(mp.shirtNumber) \(mp.displayName)")
                                                    .font(.caption2)
                                                    .padding(.horizontal, 8)
                                                    .padding(.vertical, 4)
                                                    .background(Color.green.opacity(0.12))
                                                    .cornerRadius(6)
                                            }
                                        }
                                    }
                                }

                                Button {
                                    showRosterSelection = true
                                } label: {
                                    Text("Modifier la composition")
                                        .font(.caption.bold())
                                        .foregroundStyle(.blue)
                                }

                                // Boutons d'export de la composition
                                Divider()

                                VStack(spacing: 8) {
                                    Text("Partager la composition")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)

                                    HStack(spacing: 8) {
                                        // Exporter en PDF
                                        Button {
                                            shareRosterPDF()
                                        } label: {
                                            HStack(spacing: 4) {
                                                Image(systemName: "doc.richtext")
                                                    .font(.caption2)
                                                Text("PDF")
                                                    .font(.caption2.bold())
                                            }
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(Color.red.opacity(0.12))
                                            .foregroundStyle(.red)
                                            .cornerRadius(8)
                                        }

                                        // Partager le fichier .tdj (ouvre l'app chez le destinataire)
                                        Button {
                                            shareRosterFile()
                                        } label: {
                                            HStack(spacing: 4) {
                                                Image(systemName: "doc.fill")
                                                    .font(.caption2)
                                                Text("Fichier")
                                                    .font(.caption2.bold())
                                            }
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(Color.green.opacity(0.12))
                                            .foregroundStyle(.green)
                                            .cornerRadius(8)
                                        }

                                        // Partager un lien cliquable pour iMessage
                                        Button {
                                            shareRosterLink()
                                        } label: {
                                            HStack(spacing: 4) {
                                                Image(systemName: "link")
                                                    .font(.caption2)
                                                Text("Lien")
                                                    .font(.caption2.bold())
                                            }
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(Color.blue.opacity(0.12))
                                            .foregroundStyle(.blue)
                                            .cornerRadius(8)
                                        }
                                    }
                                }
                            }
                            .padding()
                            .background(Color(.systemBackground))
                            .cornerRadius(12)
                        }

                        // Importer une composition d'une équipe supérieure
                        Button {
                            showImportRosterPicker = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "square.and.arrow.down")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Importer joueurs disponibles")
                                        .font(.caption.bold())
                                    Text("Depuis l'export d'une équipe supérieure")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(10)
                            .background(Color(.systemBackground))
                            .cornerRadius(10)
                        }
                        .foregroundStyle(.primary)

                        // Info sur les joueurs indisponibles importés
                        if !unavailablePlayerIds.isEmpty {
                            HStack(spacing: 6) {
                                Image(systemName: "info.circle.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.orange)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(unavailablePlayerIds.count) joueur\(unavailablePlayerIds.count > 1 ? "s" : "") indisponible\(unavailablePlayerIds.count > 1 ? "s" : "")")
                                        .font(.caption2.bold())
                                        .foregroundStyle(.orange)
                                    if !importChain.isEmpty {
                                        Text("Déjà sélectionné\(unavailablePlayerIds.count > 1 ? "s" : "") par : \(importChain.joined(separator: ", "))")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Button {
                                    unavailablePlayerIds.removeAll()
                                    importChain.removeAll()
                                    saveDraftState()
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(10)
                            .background(Color.orange.opacity(0.08))
                            .cornerRadius(10)
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)

                    // Compteur de matchs gratuits
                    if !storeManager.isPremium {
                        FreeMatchBanner(storeManager: storeManager, showPaywall: $showPaywall)
                    }

                    // Bouton démarrer
                    Button(action: {
                        if storeManager.canStartNewMatch {
                            showMatch = true
                        } else {
                            showPaywall = true
                        }
                    }) {
                        HStack(spacing: 12) {
                            Image(systemName: "play.fill")
                                .font(.title2)
                            Text("Démarrer le match")
                                .font(.title3.bold())
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(storeManager.canStartNewMatch ? Color.green : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(16)
                    }
                    .disabled(!storeManager.canStartNewMatch)
                }
                .padding()
            }
            .sheet(isPresented: $showPaywall) {
                PaywallView(storeManager: storeManager)
            }
            .sheet(isPresented: $showRosterSelection) {
                MatchRosterView(
                    allPlayers: allPlayers,
                    existingRoster: viewModel.matchRoster,
                    unavailablePlayerIds: unavailablePlayerIds
                ) { roster in
                    viewModel.setMatchRoster(roster)
                    saveDraftState()
                }
            }
            .sheet(item: $shareItemsWrapper) { wrapper in
                ActivityView(activityItems: wrapper.items)
            }
            .sheet(isPresented: $showPDFPreview) {
                if let data = previewPDFData {
                    PDFPreviewView(pdfData: data, title: previewPDFTitle)
                }
            }
            .fileImporter(
                isPresented: $showImportRosterPicker,
                allowedContentTypes: [.json, .tdjRoster],
                allowsMultipleSelection: false
            ) { result in
                handleRosterImportResult(result)
            }
            .alert(alertTitle, isPresented: $showAlert) {
                Button("OK") {}
            } message: {
                Text(alertMessage)
            }
            .onAppear {
                allPlayers = TeamManager.shared.loadPlayers()
                // Restaurer les données d'import depuis le brouillon
                if let draft = MatchViewModel.loadDraft() {
                    unavailablePlayerIds = Set(draft.unavailablePlayerIds)
                    importChain = draft.importChain
                }
                // Traiter un éventuel import via deep link (avec délai pour laisser l'app se stabiliser)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    handlePendingDeepLink()
                }
            }
            .onChange(of: deepLinkManager.shouldNavigateToMatch) {
                if deepLinkManager.shouldNavigateToMatch {
                    handlePendingDeepLink()
                }
            }
            // Observer aussi directement pendingRosterImport pour plus de fiabilité
            .onChange(of: deepLinkManager.pendingRosterImport) { oldValue, newValue in
                if newValue != nil {
                    handlePendingDeepLink()
                }
            }
            .onChange(of: viewModel.match.homeTeam) { saveDraftState() }
            .onChange(of: viewModel.match.awayTeam) { saveDraftState() }
            .onChange(of: viewModel.match.competition) { saveDraftState() }
            .onChange(of: viewModel.match.isMyTeamHome) { saveDraftState() }
        }
    }

    // MARK: - Deep Link import

    private func handlePendingDeepLink() {
        guard let rosterExport = deepLinkManager.pendingRosterImport else { return }

        // Marquer les joueurs indisponibles
        unavailablePlayerIds = Set(rosterExport.unavailablePlayerIds)
        importChain = rosterExport.selectionChain

        // Importer les joueurs disponibles dans l'effectif s'ils n'existent pas
        let existingIds = Set(allPlayers.map { $0.id })
        let newPlayers = rosterExport.availablePlayers.filter { !existingIds.contains($0.id) }
        if !newPlayers.isEmpty {
            allPlayers.append(contentsOf: newPlayers)
            TeamManager.shared.savePlayers(allPlayers)
        }

        let chainText = rosterExport.selectionChain.isEmpty ? "" : "\nÉquipes : \(rosterExport.selectionChain.joined(separator: " → "))"
        showAlertWith(
            title: "Composition importée",
            message: "\(rosterExport.availablePlayers.count) joueurs disponibles.\n\(rosterExport.unavailablePlayerIds.count) joueurs indisponibles.\(chainText)"
        )

        // Consommer l'import
        deepLinkManager.clearPendingImport()
        saveDraftState()
    }

    // MARK: - Export roster

    /// Crée et partage un fichier .tdj via la feuille de partage iOS
    /// Le destinataire tape dessus → l'app s'ouvre et importe automatiquement
    private func shareRosterFile() {
        let selectedIds = Set(viewModel.matchRoster.map { $0.id })
        let teamName = viewModel.match.myTeamName.isEmpty ? "Mon équipe" : viewModel.match.myTeamName

        guard let fileURL = ExportService.shared.createRosterFile(
            allPlayers: allPlayers,
            selectedPlayerIds: selectedIds,
            teamName: teamName,
            competition: viewModel.match.competition,
            matchDate: viewModel.match.date,
            previousUnavailableIds: Array(unavailablePlayerIds),
            previousChain: importChain
        ) else {
            showAlertWith(title: "Erreur", message: "Impossible de créer le fichier.")
            return
        }

        shareItemsWrapper = ShareItemsWrapper(items: [fileURL])
    }

    /// Crée et partage un lien cliquable tempsdejeu:// pour iMessage
    /// Un tap sur le lien dans Messages ouvre directement l'app
    private func shareRosterLink() {
        let selectedIds = Set(viewModel.matchRoster.map { $0.id })
        let teamName = viewModel.match.myTeamName.isEmpty ? "Mon équipe" : viewModel.match.myTeamName

        // Calculer le nombre de joueurs disponibles
        let availableCount = allPlayers.filter {
            !selectedIds.contains($0.id) && !unavailablePlayerIds.contains($0.id)
        }.count

        guard let link = DeepLinkManager.shared.createShareableLink(
            allPlayers: allPlayers,
            selectedPlayerIds: selectedIds,
            teamName: teamName,
            competition: viewModel.match.competition,
            matchDate: viewModel.match.date,
            previousUnavailableIds: Array(unavailablePlayerIds),
            previousChain: importChain
        ) else {
            showAlertWith(title: "Erreur", message: "Impossible de créer le lien.")
            return
        }

        // Créer le message formaté
        let message = DeepLinkManager.shared.createShareMessage(
            teamName: teamName,
            matchDate: viewModel.match.date,
            availableCount: availableCount,
            link: link
        )

        shareItemsWrapper = ShareItemsWrapper(items: [message])
    }

    /// Génère et partage un PDF de la composition
    private func shareRosterPDF() {
        let teamName = viewModel.match.myTeamName.isEmpty ? "Mon équipe" : viewModel.match.myTeamName
        let opponent = viewModel.match.isMyTeamHome ? viewModel.match.awayTeam : viewModel.match.homeTeam

        let pdfData = ExportService.shared.generateRosterPDF(
            roster: viewModel.matchRoster,
            teamName: teamName,
            competition: viewModel.match.competition,
            matchDate: viewModel.match.date,
            opponent: opponent
        )

        let cleanTeam = teamName
            .replacingOccurrences(of: " ", with: "_")
            .replacingOccurrences(of: "/", with: "-")
        let dateStr: String = {
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            return f.string(from: viewModel.match.date)
        }()
        let fileName = "Composition_\(cleanTeam)_\(dateStr).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try pdfData.write(to: tempURL)
            shareItemsWrapper = ShareItemsWrapper(items: [tempURL])
        } catch {
            showAlertWith(title: "Erreur", message: "Impossible de créer le PDF.")
        }
    }

    private func exportAvailablePlayers() {
        shareRosterFile()
    }

    // MARK: - Import roster

    private func handleRosterImportResult(_ result: Result<[URL], Error>) {
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
                let importType = ExportService.shared.detectImportType(from: data)

                switch importType {
                case .rosterExport(let rosterExport):
                    // Marquer les joueurs indisponibles
                    unavailablePlayerIds = Set(rosterExport.unavailablePlayerIds)
                    importChain = rosterExport.selectionChain

                    // Importer aussi les joueurs disponibles dans l'effectif s'ils n'existent pas
                    let existingIds = Set(allPlayers.map { $0.id })
                    let newPlayers = rosterExport.availablePlayers.filter { !existingIds.contains($0.id) }
                    if !newPlayers.isEmpty {
                        allPlayers.append(contentsOf: newPlayers)
                        TeamManager.shared.savePlayers(allPlayers)
                    }

                    let chainText = rosterExport.selectionChain.isEmpty ? "" : "\nÉquipes : \(rosterExport.selectionChain.joined(separator: " → "))"
                    showAlertWith(
                        title: "Import réussi",
                        message: "\(rosterExport.availablePlayers.count) joueurs disponibles.\n\(rosterExport.unavailablePlayerIds.count) joueurs indisponibles.\(chainText)"
                    )
                    saveDraftState()

                case .players:
                    showAlertWith(title: "Format non reconnu", message: "Ce fichier contient une liste de joueurs simple. Utilisez l'import classique dans Export/Import.")

                case .unknown:
                    showAlertWith(title: "Erreur", message: "Le fichier n'est pas un export de composition valide.")
                }
            } catch {
                showAlertWith(title: "Erreur", message: "Impossible de lire le fichier : \(error.localizedDescription)")
            }

        case .failure(let error):
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
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

    /// Sauvegarde l'état du brouillon (infos match + composition + imports)
    private func saveDraftState() {
        viewModel.saveDraft(unavailablePlayerIds: unavailablePlayerIds, importChain: importChain)
    }
}

// MARK: - Composants réutilisables

struct SectionHeader: View {
    let title: String
    let icon: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.green)
            Text(title)
                .font(.headline)
            Spacer()
        }
    }
}

struct CustomTextField: View {
    let placeholder: String
    @Binding var text: String
    let icon: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 24)
            TextField(placeholder, text: $text)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(10)
    }
}

struct FreeMatchBanner: View {
    @ObservedObject var storeManager: StoreManager
    @Binding var showPaywall: Bool

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "gift.fill")
                    .foregroundStyle(.orange)
                Text("Version gratuite")
                    .font(.headline)
                Spacer()
                Button("Passer Premium") {
                    showPaywall = true
                }
                .font(.caption.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.orange)
                .foregroundColor(.white)
                .cornerRadius(20)
            }

            HStack {
                Text("\(storeManager.remainingFreeMatches) match\(storeManager.remainingFreeMatches > 1 ? "s" : "") restant\(storeManager.remainingFreeMatches > 1 ? "s" : "")")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()

                // Barre de progression
                ProgressView(value: Double(storeManager.matchesUsed), total: Double(StoreManager.freeMatchLimit))
                    .tint(storeManager.remainingFreeMatches <= 1 ? .red : .orange)
                    .frame(width: 100)
            }
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.orange.opacity(0.3), lineWidth: 1)
        )
    }
}

#Preview {
    MatchSetupView(
        viewModel: MatchViewModel(),
        storeManager: StoreManager.shared,
        showMatch: .constant(false)
    )
    .environmentObject(DeepLinkManager.shared)
}
