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
    @ObservedObject var profileManager: ProfileManager = .shared
    @EnvironmentObject var deepLinkManager: DeepLinkManager
    @Binding var showMatch: Bool
    @State private var showPaywall = false
    @State private var showRosterSelection = false
    @State private var showDeleteRosterConfirmation = false
    @State private var allPlayers: [Player] = []

    // Export / Import roster
    @State private var shareItemsWrapper: ShareItemsWrapper?
    @State private var showImportRosterPicker = false
    @State private var importedRosterExport: RosterExport?
    @State private var unavailablePlayerIds: Set<UUID> = []
    @State private var importChain: [String] = []
    @State private var targetTeamCode: String = ""

    // PDF Preview - utilise une struct identifiable pour éviter la page blanche
    @State private var pdfPreviewItem: MatchSetupPDFItem?
    
    /// Structure pour l'item de preview PDF
    struct MatchSetupPDFItem: Identifiable {
        let id = UUID()
        let data: Data
        let title: String
    }

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

                                // Liste compacte des remplaçants
                                if !remp.isEmpty {
                                    ScrollView(.horizontal, showsIndicators: false) {
                                        HStack(spacing: 6) {
                                            ForEach(remp.sorted(by: { $0.shirtNumber < $1.shirtNumber })) { mp in
                                                Text("#\(mp.shirtNumber) \(mp.displayName)")
                                                    .font(.caption2)
                                                    .padding(.horizontal, 8)
                                                    .padding(.vertical, 4)
                                                    .background(Color.orange.opacity(0.12))
                                                    .cornerRadius(6)
                                            }
                                        }
                                    }
                                }

                                // Joueurs indisponibles (blessés, suspendus, absents)
                                let indisponibles = allPlayers.filter { $0.availability != .disponible }
                                if !indisponibles.isEmpty {
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack(spacing: 4) {
                                            Image(systemName: "person.slash.fill")
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                            Text("Indisponibles (\(indisponibles.count))")
                                                .font(.caption2.bold())
                                                .foregroundStyle(.secondary)
                                        }
                                        ScrollView(.horizontal, showsIndicators: false) {
                                            HStack(spacing: 6) {
                                                ForEach(indisponibles.sorted(by: { $0.lastName.localizedCompare($1.lastName) == .orderedAscending })) { player in
                                                    HStack(spacing: 4) {
                                                        Image(systemName: player.availability.icon)
                                                            .font(.system(size: 9))
                                                            .foregroundStyle(colorForAvailability(player.availability))
                                                        Text(player.displayName)
                                                            .font(.caption2)
                                                            .strikethrough()
                                                            .foregroundStyle(.secondary)
                                                        Text("(\(player.availability.rawValue))")
                                                            .font(.system(size: 8))
                                                            .foregroundStyle(colorForAvailability(player.availability))
                                                    }
                                                    .padding(.horizontal, 8)
                                                    .padding(.vertical, 4)
                                                    .background(colorForAvailability(player.availability).opacity(0.08))
                                                    .cornerRadius(6)
                                                }
                                            }
                                        }
                                    }
                                }

                                HStack(spacing: 16) {
                                    Button {
                                        showRosterSelection = true
                                    } label: {
                                        HStack(spacing: 4) {
                                            Image(systemName: "pencil")
                                                .font(.caption2)
                                            Text("Modifier")
                                                .font(.caption.bold())
                                        }
                                        .foregroundStyle(.blue)
                                    }

                                    Button {
                                        showDeleteRosterConfirmation = true
                                    } label: {
                                        HStack(spacing: 4) {
                                            Image(systemName: "trash")
                                                .font(.caption2)
                                            Text("Supprimer")
                                                .font(.caption.bold())
                                        }
                                        .foregroundStyle(.red)
                                    }
                                }

                                // Boutons d'export de la composition
                                Divider()

                                VStack(spacing: 8) {
                                    Text("Partager la composition")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)

                                    // Code équipe destinataire
                                    HStack(spacing: 6) {
                                        Image(systemName: "qrcode")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        Text("Code catégorie dest.")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                        TextField("Ex: A3K9F2", text: $targetTeamCode)
                                            .font(.caption.bold().monospaced())
                                            .textFieldStyle(.roundedBorder)
                                            .textInputAutocapitalization(.characters)
                                            .frame(width: 100)
                                            .onChange(of: targetTeamCode) {
                                                targetTeamCode = String(targetTeamCode.uppercased().prefix(6))
                                            }
                                    }
                                    .padding(.vertical, 2)

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
                                    Text("Depuis l'export d'une catégorie supérieure")
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
                        .background(storeManager.canStartNewMatch ? profileManager.activeProfileColor : Color.gray)
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
                    unavailablePlayerIds: unavailablePlayerIds,
                    selectedInOtherCategoryIds: MatchViewModel.playerIdsSelectedInOtherCategories(localPlayers: allPlayers)
                ) { roster in
                    viewModel.setMatchRoster(roster)
                    saveDraftState()
                }
            }
            .sheet(item: $shareItemsWrapper) { wrapper in
                ActivityView(activityItems: wrapper.items)
            }
            .sheet(item: $pdfPreviewItem) { item in
                PDFPreviewView(pdfData: item.data, title: item.title)
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
            .alert("Supprimer la composition", isPresented: $showDeleteRosterConfirmation) {
                Button("Annuler", role: .cancel) {}
                Button("Supprimer", role: .destructive) {
                    viewModel.clearMatchRoster()
                }
            } message: {
                Text("Voulez-vous vraiment supprimer la composition actuelle ? Cette action est irréversible.")
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
            .onChange(of: profileManager.activeProfileId) { oldProfileId, newProfileId in
                // 1) Sauvegarder le brouillon de l'ancien profil
                if let oldId = oldProfileId {
                    let oldKey = "profile_\(oldId.uuidString)_matchSetupDraft"
                    let draft = MatchSetupDraft(
                        match: viewModel.match,
                        matchRoster: viewModel.matchRoster,
                        unavailablePlayerIds: Array(unavailablePlayerIds),
                        importChain: importChain
                    )
                    if let data = try? JSONEncoder().encode(draft) {
                        UserDefaults.standard.set(data, forKey: oldKey)
                    }
                }

                // 2) Recharger les joueurs du nouveau profil
                allPlayers = TeamManager.shared.loadPlayers()

                // 3) Restaurer le brouillon du nouveau profil
                if let draft = MatchViewModel.loadDraft() {
                    viewModel.match = draft.match
                    viewModel.matchRoster = draft.matchRoster
                    unavailablePlayerIds = Set(draft.unavailablePlayerIds)
                    importChain = draft.importChain
                } else {
                    // Pas de brouillon pour cette catégorie → reset
                    viewModel.match = Match()
                    viewModel.matchRoster = []
                    unavailablePlayerIds.removeAll()
                    importChain.removeAll()
                }
            }
            .onChange(of: viewModel.match.homeTeam) { saveDraftState() }
            .onChange(of: viewModel.match.awayTeam) { saveDraftState() }
            .onChange(of: viewModel.match.competition) { saveDraftState() }
            .onChange(of: viewModel.match.isMyTeamHome) { saveDraftState() }
            .onChange(of: viewModel.matchRoster) { saveDraftState() }
            .onChange(of: viewModel.match.myTeamName) { saveDraftState() }
            .onChange(of: viewModel.match.date) { saveDraftState() }
        }
    }

    // MARK: - Deep Link import

    private func handlePendingDeepLink() {
        guard let rosterExport = deepLinkManager.pendingRosterImport else { return }
        processRosterImport(rosterExport)
        deepLinkManager.clearPendingImport()
    }

    /// Traite un import de composition — commun entre deep link, fichier et iMessage.
    /// Fait la correspondance par prénom+nom (pas seulement UUID) pour supporter
    /// les échanges entre appareils où le même joueur a des UUID différents.
    private func processRosterImport(_ rosterExport: RosterExport) {
        // 1) Auto-basculer sur le bon profil par code catégorie
        if let code = rosterExport.targetTeamCode, !code.isEmpty,
           let targetProfile = profileManager.profiles.first(where: { $0.teamCode.uppercased() == code.uppercased() }) {
            if targetProfile.id != profileManager.activeProfileId {
                profileManager.switchToProfile(targetProfile.id)
            }
        }

        // 2) Recharger les joueurs du profil actif (après éventuel changement)
        allPlayers = TeamManager.shared.loadPlayers()

        // 3) Construire un index local par nom normalisé (prénom_nom en minuscules)
        //    pour retrouver le même joueur même s'il a un UUID différent
        let normalize: (Player) -> String = { p in
            let first = p.firstName.trimmingCharacters(in: .whitespaces).lowercased()
            let last = p.lastName.trimmingCharacters(in: .whitespaces).lowercased()
            return "\(first)_\(last)"
        }

        var localByName: [String: Player] = [:]
        for p in allPlayers {
            localByName[normalize(p)] = p
        }

        // 4) Indexer tous les joueurs importés par UUID (sélectionnés + indisponibles)
        //    pour le mapping UUID importé → UUID local
        var importedById: [UUID: Player] = [:]
        for p in rosterExport.selectedPlayers { importedById[p.id] = p }
        if let unavailable = rosterExport.unavailablePlayers {
            for p in unavailable { importedById[p.id] = p }
        }

        // 5) Mapper chaque UUID importé → UUID local (via correspondance de nom)
        var toLocalId: [UUID: UUID] = [:]
        for (importedId, importedPlayer) in importedById {
            let name = normalize(importedPlayer)
            if let local = localByName[name] {
                toLocalId[importedId] = local.id
            }
        }

        // 6) Mapper les IDs indisponibles importés → UUIDs locaux
        //    UNIQUEMENT les joueurs qui existent déjà dans cette catégorie
        //    Pas de mélange : on ne touche qu'aux joueurs locaux
        unavailablePlayerIds = Set(rosterExport.unavailablePlayerIds.compactMap { importedId in
            if let localId = toLocalId[importedId] { return localId }
            if allPlayers.contains(where: { $0.id == importedId }) { return importedId }
            return nil // joueur pas dans cette catégorie → ignorer
        })

        importChain = rosterExport.selectionChain

        // 7) Mettre à jour l'availability (blessé, suspendu, absent) seulement pour les joueurs locaux
        var hasUpdates = false
        if let importedUnavailable = rosterExport.unavailablePlayers {
            for imported in importedUnavailable {
                let name = normalize(imported)
                if let local = localByName[name],
                   let idx = allPlayers.firstIndex(where: { $0.id == local.id }),
                   allPlayers[idx].availability != imported.availability {
                    allPlayers[idx].availability = imported.availability
                    hasUpdates = true
                }
            }
        }

        // 8) Sauvegarder uniquement si des statuts de disponibilité ont changé
        if hasUpdates {
            TeamManager.shared.savePlayers(allPlayers)
        }

        // 9) Message de confirmation
        let recognizedCount = unavailablePlayerIds.count
        let chainText = rosterExport.selectionChain.isEmpty ? "" : "\nCascade : \(rosterExport.selectionChain.joined(separator: " → "))"
        let categoryName = ProfileManager.shared.activeProfile?.name ?? "cette catégorie"
        showAlertWith(
            title: "Composition importée",
            message: "\(recognizedCount) joueur\(recognizedCount > 1 ? "s" : "") marqué\(recognizedCount > 1 ? "s" : "") indisponible\(recognizedCount > 1 ? "s" : "") dans \(categoryName).\(chainText)"
        )

        saveDraftState()
    }

    // MARK: - Export roster

    /// Crée et partage un fichier .tdj via la feuille de partage iOS
    /// Le destinataire tape dessus → l'app s'ouvre et importe automatiquement
    private func shareRosterFile() {
        let selectedIds = Set(viewModel.matchRoster.map { $0.id })
        let teamName = viewModel.match.myTeamName.isEmpty ? "Mon équipe" : viewModel.match.myTeamName

        let cleanCode = targetTeamCode.trimmingCharacters(in: .whitespaces)
        guard let fileURL = ExportService.shared.createRosterFile(
            allPlayers: allPlayers,
            selectedPlayerIds: selectedIds,
            teamName: teamName,
            competition: viewModel.match.competition,
            matchDate: viewModel.match.date,
            previousUnavailableIds: Array(unavailablePlayerIds),
            previousChain: importChain,
            targetTeamCode: cleanCode.isEmpty ? nil : cleanCode
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

        // Calculer le nombre de joueurs disponibles (exclure blessés, suspendus, absents)
        let availableCount = allPlayers.filter {
            !selectedIds.contains($0.id) &&
            !unavailablePlayerIds.contains($0.id) &&
            $0.availability == .disponible
        }.count

        let cleanCodeLink = targetTeamCode.trimmingCharacters(in: .whitespaces)
        guard let link = DeepLinkManager.shared.createShareableLink(
            allPlayers: allPlayers,
            selectedPlayerIds: selectedIds,
            teamName: teamName,
            competition: viewModel.match.competition,
            matchDate: viewModel.match.date,
            previousUnavailableIds: Array(unavailablePlayerIds),
            previousChain: importChain,
            targetTeamCode: cleanCodeLink.isEmpty ? nil : cleanCodeLink
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

    /// Génère et affiche un aperçu PDF de la composition avant export
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
        let title = "Composition_\(cleanTeam)_\(dateStr)"
        pdfPreviewItem = MatchSetupPDFItem(data: pdfData, title: title)
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
                    processRosterImport(rosterExport)

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

    private func colorForAvailability(_ availability: PlayerAvailability) -> Color {
        switch availability {
        case .disponible: return .green
        case .blesse: return .red
        case .absent: return .orange
        case .suspendu: return .purple
        }
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
