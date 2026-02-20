//
//  ExportImportView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI
import UniformTypeIdentifiers

/// Wrapper identifiable pour les items de partage
struct ExportShareItemsWrapper: Identifiable {
    let id = UUID()
    let items: [Any]
}

/// Vue principale d'export / import
struct ExportImportView: View {
    @ObservedObject var profileManager = ProfileManager.shared
    @EnvironmentObject var deepLinkManager: DeepLinkManager
    @State private var players: [Player] = []
    @State private var matches: [Match] = []
    @State private var allCards: [CardEvent] = []

    // Share - utilise une struct identifiable pour éviter la page blanche
    @State private var shareItemsWrapper: ExportShareItemsWrapper?

    // Import — un seul fileImporter pour éviter le bug SwiftUI double-fileImporter
    enum ActiveImportType {
        case none, players, matches
    }
    @State private var activeImportType: ActiveImportType = .none
    @State private var showFilePicker = false

    @State private var showImportConfirmation = false
    @State private var importedPlayers: [Player] = []
    @State private var importedTeamCode: String? = nil
    @State private var importedTeamName: String? = nil
    @State private var importMode: ImportMode = .merge

    // Import matchs
    @State private var showMatchImportConfirmation = false
    @State private var importedMatches: [Match] = []
    @State private var importedMatchesTeamCode: String? = nil
    @State private var importedMatchesTeamName: String? = nil

    // Alerts
    @State private var alertTitle = ""
    @State private var alertMessage = ""
    @State private var showAlert = false

    // PDF Preview - utilise une struct identifiable pour éviter la page blanche
    @State private var pdfPreviewItem: PDFPreviewItem?

    @State private var isLoaded = false
    
    /// Matchs terminés de la saison en cours
    private var seasonFinishedMatches: [Match] {
        let season = SeasonManager.shared.currentSeason
        return matches.filter { match in
            guard match.isFinished else { return false }
            guard let season = season else { return true }
            if match.date < season.startDate { return false }
            if let endDate = season.endDate, match.date > endDate { return false }
            return true
        }
    }
    
    /// Structure pour l'item de preview PDF
    struct PDFPreviewItem: Identifiable {
        let id = UUID()
        let data: Data
        let title: String
    }

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
                        reloadData()
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
                    previewPlayersPDF()
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
                    activeImportType = .players
                    showFilePicker = true
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
                Text("Import Joueurs")
            }

            // MARK: - Export Matchs
            Section {
                Button {
                    exportMatchesJSON()
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Exporter les matchs (JSON)")
                                .font(.subheadline)
                            Text("Réimportable — inclut cartons et compositions")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "doc.text")
                            .foregroundStyle(.blue)
                    }
                }
                .disabled(matches.filter { $0.isFinished }.isEmpty)
            } header: {
                Text("Matchs \(matches.filter { $0.isFinished }.count > 0 ? "(\(matches.filter { $0.isFinished }.count))" : "")")
            }

            // MARK: - Import Matchs
            Section {
                Button {
                    activeImportType = .matches
                    showFilePicker = true
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Importer des matchs (JSON)")
                                .font(.subheadline)
                            Text("Fusionner les matchs d'un autre appareil")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "square.and.arrow.down")
                            .foregroundStyle(.orange)
                    }
                }
            } header: {
                Text("Import Matchs")
            }

            // MARK: - Export Stats
            Section {
                // PDF stats globales — preview avant export
                Button {
                    previewStatsPDF()
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
            if !seasonFinishedMatches.isEmpty {
                Section {
                    ForEach(seasonFinishedMatches) { match in
                        HStack {
                            // Tap pour voir le PDF
                            Button {
                                let data = ExportService.shared.generateMatchPDF(match: match)
                                let h = match.homeTeam.isEmpty ? "Match" : match.homeTeam
                                let a = match.awayTeam.isEmpty ? "" : " vs \(match.awayTeam)"
                                pdfPreviewItem = PDFPreviewItem(data: data, title: "\(h)\(a)")
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
                                pdfPreviewItem = PDFPreviewItem(data: data, title: "\(h)\(a)")
                            } label: {
                                Image(systemName: "doc.richtext")
                                    .foregroundStyle(.orange)
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                } header: {
                    Text("Rapport de match (PDF) — Saison en cours (\(seasonFinishedMatches.count) matchs)")
                }
            }
        }
        .listStyle(.insetGrouped)
        .onChange(of: profileManager.activeProfileId) {
            reloadData()
        }
        .sheet(item: $shareItemsWrapper) { wrapper in
            ActivityView(activityItems: wrapper.items)
        }
        .sheet(item: $pdfPreviewItem) { item in
            PDFPreviewView(pdfData: item.data, title: item.title)
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: activeImportType == .matches ? [.json, .tdjMatches] : [.json],
            allowsMultipleSelection: false
        ) { result in
            switch activeImportType {
            case .players:
                handleImportResult(result)
            case .matches:
                handleMatchImportResult(result)
            case .none:
                break
            }
            activeImportType = .none
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
            if let code = importedTeamCode, !code.isEmpty,
               let targetProfile = ProfileManager.shared.profiles.first(where: { $0.teamCode.uppercased() == code.uppercased() }) {
                Text("Ces joueurs seront importés dans la catégorie « \(targetProfile.name) » (code \(code)).")
            } else if let name = importedTeamName, !name.isEmpty {
                if let existing = ProfileManager.shared.profiles.first(where: { $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame }) {
                    Text("Ces joueurs seront importés dans la catégorie « \(existing.name) ».")
                } else {
                    Text("La catégorie « \(name) » sera créée automatiquement pour accueillir ces joueurs.")
                }
            } else {
                Text("Comment souhaitez-vous importer les joueurs ?")
            }
        }
        .confirmationDialog(
            "Importer \(importedMatches.count) match\(importedMatches.count > 1 ? "s" : "")",
            isPresented: $showMatchImportConfirmation,
            titleVisibility: .visible
        ) {
            Button("Fusionner (ajouter les nouveaux)") {
                performMatchImport()
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            let newCount = countNewMatches()
            let existingCount = importedMatches.count - newCount
            let targetName = resolvedTargetCategoryName()
            if !targetName.isEmpty {
                Text("\(importedMatches.count) match\(importedMatches.count > 1 ? "s" : "") → catégorie « \(targetName) ».\n\(newCount) nouveau\(newCount > 1 ? "x" : ""), \(existingCount) déjà présent\(existingCount > 1 ? "s" : "").")
            } else {
                Text("\(newCount) nouveau\(newCount > 1 ? "x" : "") match\(newCount > 1 ? "s" : ""), \(existingCount) déjà présent\(existingCount > 1 ? "s" : "").")
            }
        }
    }

    // MARK: - Export Actions

    private func exportPlayersJSON() {
        // Recharger les joueurs frais du profil actif pour éviter toute donnée périmée
        let freshPlayers = TeamManager.shared.loadPlayers()
        guard let data = ExportService.shared.exportPlayersJSON(freshPlayers) else {
            showAlertWith(title: "Erreur", message: "Impossible d'exporter les joueurs.")
            return
        }

        let categoryName = ProfileManager.shared.activeProfile?.name ?? "tous"
        let cleanCategory = categoryName
            .replacingOccurrences(of: " ", with: "_")
            .replacingOccurrences(of: "/", with: "-")
        let fileName = "joueurs_\(cleanCategory)_\(formattedDateForFile()).json"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItemsWrapper = ExportShareItemsWrapper(items: [tempURL])
        } catch {
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private func previewPlayersPDF() {
        let data = ExportService.shared.generatePlayersPDF(players: players, allCards: allCards)
        pdfPreviewItem = PDFPreviewItem(data: data, title: "Effectif")
    }

    private func exportPlayersPDF() {
        let data = ExportService.shared.generatePlayersPDF(players: players, allCards: allCards)
        let fileName = "effectif_\(formattedDateForFile()).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItemsWrapper = ExportShareItemsWrapper(items: [tempURL])
        } catch {
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private func previewStatsPDF() {
        let data = ExportService.shared.generateStatsPDF(matches: matches, players: players)
        pdfPreviewItem = PDFPreviewItem(data: data, title: "Rapport Statistiques")
    }

    private func exportStatsPDF() {
        let data = ExportService.shared.generateStatsPDF(matches: matches, players: players)
        let fileName = "stats_\(formattedDateForFile()).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItemsWrapper = ExportShareItemsWrapper(items: [tempURL])
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
            shareItemsWrapper = ExportShareItemsWrapper(items: [tempURL])
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
                guard let result = ExportService.shared.importPlayersWithMetadata(from: data) else {
                    showAlertWith(title: "Erreur", message: "Le fichier n'est pas un export de joueurs valide.")
                    return
                }
                importedPlayers = result.players
                importedTeamCode = result.teamCode
                importedTeamName = result.teamName
                showImportConfirmation = true
            } catch {
                showAlertWith(title: "Erreur", message: "Impossible de lire le fichier : \(error.localizedDescription)")
            }

        case .failure(let error):
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private func performImport(mode: ImportMode) {
        // Auto-basculer sur le bon profil :
        // 1) Par code catégorie si défini
        // 2) Sinon par nom de catégorie (fallback)
        // 3) Si aucun profil ne correspond, créer un nouveau profil avec ce nom
        var targetProfileId: UUID? = ProfileManager.shared.activeProfileId
        var matched = false

        if let code = importedTeamCode, !code.isEmpty,
           let targetProfile = ProfileManager.shared.profiles.first(where: { $0.teamCode.uppercased() == code.uppercased() }) {
            targetProfileId = targetProfile.id
            matched = true
        }
        if !matched, let name = importedTeamName, !name.isEmpty {
            if let targetProfile = ProfileManager.shared.profiles.first(where: { $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame }) {
                targetProfileId = targetProfile.id
                matched = true
            } else {
                // Aucun profil ne correspond → créer automatiquement
                let teamCode = importedTeamCode ?? ""
                let newProfile = ProfileManager.shared.createProfile(
                    name: name,
                    teamCode: teamCode
                )
                targetProfileId = newProfile.id
                matched = true
            }
        }

        // Basculer sur le profil cible
        if let targetId = targetProfileId, targetId != ProfileManager.shared.activeProfileId {
            ProfileManager.shared.switchToProfile(targetId)
        }

        // Charger les joueurs du profil cible
        players = TeamManager.shared.loadPlayers()

        // Récupérer le profil cible
        guard let targetId = targetProfileId,
              var targetProfile = ProfileManager.shared.profiles.first(where: { $0.id == targetId }) else {
            showAlertWith(title: "Erreur", message: "Impossible de trouver la catégorie cible.")
            return
        }

        // Normalisation des noms pour le matching
        let normalize: (Player) -> String = { p in
            let first = p.firstName.trimmingCharacters(in: .whitespaces).lowercased()
            let last = p.lastName.trimmingCharacters(in: .whitespaces).lowercased()
            return "\(first)_\(last)"
        }

        switch mode {
        case .replace:
            // Remplacer tout l'effectif de cette catégorie
            // Créer de nouveaux UUIDs pour éviter les conflits avec d'autres catégories
            var newPlayers: [Player] = []
            var allGlobal = TeamManager.shared.loadAllPlayers()

            for imported in importedPlayers {
                let name = normalize(imported)
                // Chercher si ce joueur existe déjà dans CE profil (par nom)
                if let existingLocal = players.first(where: { normalize($0) == name }) {
                    // Mettre à jour le joueur existant
                    if let idx = allGlobal.firstIndex(where: { $0.id == existingLocal.id }) {
                        allGlobal[idx].position = imported.position
                        allGlobal[idx].availability = imported.availability
                        if allGlobal[idx].photoData == nil, let photo = imported.photoData {
                            allGlobal[idx].photoData = photo
                        }
                    }
                    newPlayers.append(existingLocal)
                } else {
                    // Nouveau joueur → créer avec un nouvel UUID
                    let fresh = Player(
                        id: UUID(),
                        firstName: imported.firstName,
                        lastName: imported.lastName,
                        position: imported.position,
                        availability: imported.availability,
                        photoData: imported.photoData,
                        homeCategoryId: targetProfile.id
                    )
                    allGlobal.append(fresh)
                    newPlayers.append(fresh)
                }
            }

            // Sauvegarder le stockage global sans toucher aux autres profils
            TeamManager.shared.saveToGlobalStorage(allGlobal)
            // Mettre à jour uniquement ce profil
            targetProfile.playerIds = Set(newPlayers.map { $0.id })
            ProfileManager.shared.updateProfile(targetProfile)
            players = newPlayers

        case .merge:
            var localByName: [String: Int] = [:]
            for (idx, p) in players.enumerated() {
                localByName[normalize(p)] = idx
            }

            var allGlobal = TeamManager.shared.loadAllPlayers()
            var added = 0
            var updated = 0

            for imported in importedPlayers {
                let name = normalize(imported)
                if let idx = localByName[name] {
                    // Joueur existant dans cette catégorie → mettre à jour
                    let localId = players[idx].id
                    players[idx].position = imported.position
                    players[idx].availability = imported.availability
                    if players[idx].photoData == nil, let photo = imported.photoData {
                        players[idx].photoData = photo
                    }
                    // Mettre à jour aussi dans le stockage global
                    if let gIdx = allGlobal.firstIndex(where: { $0.id == localId }) {
                        allGlobal[gIdx] = players[idx]
                    }
                    updated += 1
                } else {
                    // Nouveau joueur pour cette catégorie → créer avec nouvel UUID
                    let fresh = Player(
                        id: UUID(),
                        firstName: imported.firstName,
                        lastName: imported.lastName,
                        position: imported.position,
                        availability: imported.availability,
                        photoData: imported.photoData,
                        homeCategoryId: targetProfile.id
                    )
                    allGlobal.append(fresh)
                    players.append(fresh)
                    localByName[name] = players.count - 1
                    added += 1
                }
            }

            // Sauvegarder le stockage global sans toucher aux autres profils
            TeamManager.shared.saveToGlobalStorage(allGlobal)
            // Mettre à jour uniquement ce profil
            targetProfile.playerIds = Set(players.map { $0.id })
            ProfileManager.shared.updateProfile(targetProfile)
        }

        let profileInfo = " dans \(targetProfile.name)"
        showAlertWith(
            title: "Import réussi",
            message: mode == .replace
                ? "\(importedPlayers.count) joueurs importés (remplacement)\(profileInfo)."
                : "Effectif mis à jour\(profileInfo). \(players.count) joueurs au total."
        )
        importedPlayers = []
        importedTeamCode = nil
        importedTeamName = nil
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

    private func reloadData() {
        players = TeamManager.shared.loadPlayers()
        matches = DataManager.shared.loadMatches()
        allCards = matches.flatMap { $0.cards }
    }

    // MARK: - Export Matchs

    private func exportMatchesJSON() {
        let finishedMatches = matches.filter { $0.isFinished }
        guard let data = ExportService.shared.exportMatchesJSON(finishedMatches) else {
            showAlertWith(title: "Erreur", message: "Impossible d'exporter les matchs.")
            return
        }

        let categoryName = ProfileManager.shared.activeProfile?.name ?? "tous"
        let cleanCategory = categoryName
            .replacingOccurrences(of: " ", with: "_")
            .replacingOccurrences(of: "/", with: "-")
        let fileName = "matchs_\(cleanCategory)_\(formattedDateForFile()).tdjm"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItemsWrapper = ExportShareItemsWrapper(items: [tempURL])
        } catch {
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    // MARK: - Import Matchs

    private func handleMatchImportResult(_ result: Result<[URL], Error>) {
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
                guard let result = ExportService.shared.importMatchesWithMetadata(from: data) else {
                    showAlertWith(title: "Erreur", message: "Le fichier n'est pas un export de matchs valide.")
                    return
                }
                importedMatches = result.matches
                importedMatchesTeamCode = result.teamCode
                importedMatchesTeamName = result.teamName
                showMatchImportConfirmation = true
            } catch {
                showAlertWith(title: "Erreur", message: "Impossible de lire le fichier : \(error.localizedDescription)")
            }

        case .failure(let error):
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    /// Compte les matchs qui n'existent pas encore dans la catégorie cible
    private func countNewMatches() -> Int {
        let targetProfile = resolveTargetProfile()
        let targetMatches: [Match]
        if let targetId = targetProfile?.id {
            targetMatches = DataManager.shared.loadMatches(forProfileId: targetId)
        } else {
            targetMatches = matches
        }
        
        let existingIds = Set(targetMatches.map { $0.id })
        let existingFingerprints = Set(targetMatches.map { matchFingerprint($0) })
        return importedMatches.filter { m in
            !existingIds.contains(m.id) && !existingFingerprints.contains(matchFingerprint(m))
        }.count
    }

    /// Empreinte unique d'un match : date (arrondie au jour) + équipes
    private func matchFingerprint(_ match: Match) -> String {
        let cal = Calendar.current
        let day = cal.startOfDay(for: match.date)
        let ts = Int(day.timeIntervalSince1970)
        let home = match.homeTeam.trimmingCharacters(in: .whitespaces).lowercased()
        let away = match.awayTeam.trimmingCharacters(in: .whitespaces).lowercased()
        return "\(ts)_\(home)_\(away)"
    }

    /// Résout le profil cible pour l'import de matchs (par teamCode, puis teamName, puis profil actif)
    private func resolveTargetProfile() -> TeamProfile? {
        // 1. Par code d'équipe
        if let code = importedMatchesTeamCode, !code.isEmpty,
           let target = ProfileManager.shared.profiles.first(where: { $0.teamCode.uppercased() == code.uppercased() }) {
            return target
        }
        // 2. Par nom d'équipe
        if let name = importedMatchesTeamName, !name.isEmpty,
           let target = ProfileManager.shared.profiles.first(where: { $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame }) {
            return target
        }
        // 3. Profil actif
        return ProfileManager.shared.activeProfile
    }
    
    /// Nom de la catégorie cible pour le dialogue de confirmation
    private func resolvedTargetCategoryName() -> String {
        resolveTargetProfile()?.name ?? ""
    }

    /// Fusionne les matchs importés avec les matchs existants — dans la bonne catégorie
    private func performMatchImport() {
        // Déterminer le profil cible
        let targetProfile = resolveTargetProfile()
        guard let targetId = targetProfile?.id else {
            showAlertWith(title: "Erreur", message: "Impossible de déterminer la catégorie cible.")
            return
        }
        
        // Charger les matchs de la catégorie cible directement
        let targetMatches = DataManager.shared.loadMatches(forProfileId: targetId)
        let existingIds = Set(targetMatches.map { $0.id })
        let existingFingerprints = Set(targetMatches.map { matchFingerprint($0) })

        var added = 0
        var updated = 0

        for imported in importedMatches {
            let fingerprint = matchFingerprint(imported)

            if existingIds.contains(imported.id) {
                // Même UUID → fusionner les cartons
                if var existing = targetMatches.first(where: { $0.id == imported.id }) {
                    mergeCards(into: &existing, from: imported)
                    DataManager.shared.saveMatch(existing, forProfileId: targetId)
                    updated += 1
                }
            } else if existingFingerprints.contains(fingerprint) {
                // Même date + mêmes équipes mais UUID différent → fusionner les cartons
                if var existing = targetMatches.first(where: { matchFingerprint($0) == fingerprint }) {
                    mergeCards(into: &existing, from: imported)
                    DataManager.shared.saveMatch(existing, forProfileId: targetId)
                    updated += 1
                }
            } else {
                // Match entièrement nouveau → ajouter
                DataManager.shared.saveMatch(imported, forProfileId: targetId)
                added += 1
            }
        }
        
        reloadData()

        let categoryName = targetProfile?.name ?? ""
        showAlertWith(
            title: "Import réussi",
            message: "\(added) match\(added > 1 ? "s" : "") ajouté\(added > 1 ? "s" : ""), \(updated) mis à jour\(categoryName.isEmpty ? "" : " dans \(categoryName)")."
        )
        importedMatches = []
        importedMatchesTeamCode = nil
        importedMatchesTeamName = nil
    }

    /// Fusionne les cartons d'un match importé dans un match existant (évite les doublons)
    private func mergeCards(into existing: inout Match, from imported: Match) {
        let existingCardIds = Set(existing.cards.map { $0.id })
        // Aussi comparer par empreinte (joueur + minute + type) pour les UUIDs différents
        let existingCardFingerprints = Set(existing.cards.map { cardFingerprint($0) })

        for card in imported.cards {
            if !existingCardIds.contains(card.id) && !existingCardFingerprints.contains(cardFingerprint(card)) {
                existing.cards.append(card)
            }
        }

        // Fusionner aussi les buts, remplacements, fautes
        let existingGoalIds = Set(existing.goals.map { $0.id })
        for goal in imported.goals {
            if !existingGoalIds.contains(goal.id) {
                existing.goals.append(goal)
            }
        }

        let existingSubIds = Set(existing.substitutions.map { $0.id })
        for sub in imported.substitutions {
            if !existingSubIds.contains(sub.id) {
                existing.substitutions.append(sub)
            }
        }
    }

    /// Empreinte unique d'un carton : joueur + minute arrondie + type
    private func cardFingerprint(_ card: CardEvent) -> String {
        let name = card.playerName.trimmingCharacters(in: .whitespaces).lowercased()
        let minute = Int(card.minute / 60) // minute arrondie
        return "\(name)_\(minute)_\(card.type.rawValue)"
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
