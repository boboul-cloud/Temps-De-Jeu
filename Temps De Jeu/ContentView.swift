//
//  ContentView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var matchViewModel = MatchViewModel()
    @StateObject private var storeManager = StoreManager.shared
    @StateObject private var profileManager = ProfileManager.shared
    @EnvironmentObject var deepLinkManager: DeepLinkManager
    @State private var showMatch = false
    @State private var selectedTab = 0

    // Import auto de matchs (.tdjm)
    @State private var pendingMatchImportData: ExportService.MatchesImportResult?
    @State private var showMatchImportConfirmation = false
    @State private var matchImportAlertTitle = ""
    @State private var matchImportAlertMessage = ""
    @State private var showMatchImportAlert = false

    var body: some View {
        VStack(spacing: 0) {
            // Barre de sélection de profil (si plusieurs profils)
            if profileManager.profiles.count > 1 {
                ProfileSwitcherBar(profileManager: profileManager)
            }

            TabView(selection: $selectedTab) {
                // Tab 1 : Nouveau match
                Group {
                    if showMatch {
                        MatchView(
                            viewModel: matchViewModel,
                            storeManager: storeManager,
                            showMatch: $showMatch
                        )
                        .onDisappear {
                            // Sauvegarder et réinitialiser quand on revient
                            if matchViewModel.match.isFinished {
                                matchViewModel.resetMatch()
                            }
                        }
                    } else {
                        MatchSetupView(
                            viewModel: matchViewModel,
                            storeManager: storeManager,
                            showMatch: $showMatch
                        )
                    }
                }
                .tabItem {
                    Label("Match", systemImage: "sportscourt.fill")
                }
                .tag(0)

                // Tab 2 : Mes joueurs
                TeamManagementView()
                    .tabItem {
                        Label("Joueurs", systemImage: "person.3.fill")
                    }
                    .tag(1)

                // Tab 3 : Entraînements
                TrainingAttendanceView()
                    .tabItem {
                        Label("Présences", systemImage: "figure.run.circle.fill")
                    }
                    .tag(2)

                // Tab 4 : Catégories
                ProfileManagementView()
                    .tabItem {
                        Label("Catégories", systemImage: "person.2.badge.gearshape")
                    }
                    .tag(3)

                // Tab 5 : Historique
                MatchHistoryView()
                    .tabItem {
                        Label("Historique des matchs", systemImage: "clock.arrow.circlepath")
                    }
                    .tag(4)

                // Tab 6 : Cartons (More)
                NavigationStack {
                    CardsManagementView()
                }
                .tabItem {
                    Label("Cartons", systemImage: "rectangle.fill")
                }
                .tag(5)

                // Tab 7 : Saisons (More)
                NavigationStack {
                    SeasonManagementView()
                }
                .tabItem {
                    Label("Saisons", systemImage: "calendar.circle.fill")
                }
                .tag(6)

                // Tab 8 : Paramètres / Premium
                SettingsView(storeManager: storeManager)
                    .tabItem {
                        Label("Réglages et Exports", systemImage: "gearshape.fill")
                    }
                    .tag(7)
            }
            .tint(profileManager.activeProfileColor)
        }
        .onAppear {
            updateGlobalTint()
        }
        .onChange(of: profileManager.activeProfileId) { oldProfileId, newProfileId in
            // Le changement de profil est géré par MatchSetupView (sauvegarde ancien brouillon + chargement nouveau)
            // ContentView n'intervient pas pour éviter les conflits de double écriture
            updateGlobalTint()
        }
        .onChange(of: deepLinkManager.shouldNavigateToMatch) {
            if deepLinkManager.shouldNavigateToMatch {
                // Auto-basculer sur le bon profil via le code d'équipe destinataire
                if let rosterExport = deepLinkManager.pendingRosterImport {
                    if let code = rosterExport.targetTeamCode, !code.isEmpty,
                       let targetProfile = profileManager.profiles.first(where: { $0.teamCode.uppercased() == code.uppercased() }) {
                        // Code trouvé → basculer sur le profil correspondant
                        if targetProfile.id != profileManager.activeProfileId {
                            profileManager.switchToProfile(targetProfile.id)
                            matchViewModel.resetMatch()
                            if let draft = MatchViewModel.loadDraft() {
                                matchViewModel.match = draft.match
                                matchViewModel.matchRoster = draft.matchRoster
                            }
                        }
                    }
                }
                // Naviguer vers le tab Match si on n'est pas en match
                if !showMatch {
                    selectedTab = 0
                }
            }
        }
        .onChange(of: deepLinkManager.shouldNavigateToTraining) {
            if deepLinkManager.shouldNavigateToTraining {
                // Naviguer vers le tab Présences pour l'import d'entraînements
                selectedTab = 2
            }
        }
        .onChange(of: deepLinkManager.shouldNavigateToExport) {
            if deepLinkManager.shouldNavigateToExport {
                consumePendingMatchImport()
            }
        }
        .onAppear {
            // Au cas où un fichier .tdjm est arrivé avant le montage
            consumePendingMatchImport()
        }
        .confirmationDialog(
            matchImportConfirmationTitle,
            isPresented: $showMatchImportConfirmation,
            titleVisibility: .visible
        ) {
            Button("Fusionner (ajouter les nouveaux)") {
                performMatchImport()
            }
            Button("Annuler", role: .cancel) {
                pendingMatchImportData = nil
            }
        } message: {
            Text(matchImportConfirmationMessage)
        }
        .alert(matchImportAlertTitle, isPresented: $showMatchImportAlert) {
            Button("OK") {}
        } message: {
            Text(matchImportAlertMessage)
        }
        .alert("Erreur d'import", isPresented: .init(
            get: { deepLinkManager.importError != nil },
            set: { if !$0 { deepLinkManager.clearError() } }
        )) {
            Button("OK") {
                deepLinkManager.clearError()
            }
        } message: {
            Text(deepLinkManager.importError ?? "")
        }
    }

    // MARK: - Import automatique de matchs (.tdjm)

    /// Consomme les données en attente depuis DeepLinkManager
    private func consumePendingMatchImport() {
        guard let result = deepLinkManager.pendingMatchesImport else { return }
        pendingMatchImportData = result
        deepLinkManager.clearPendingMatchesImport()
        showMatchImportConfirmation = true
    }

    /// Titre du dialogue de confirmation
    private var matchImportConfirmationTitle: String {
        guard let data = pendingMatchImportData else { return "Import" }
        return "Importer \(data.matches.count) match\(data.matches.count > 1 ? "s" : "")"
    }

    /// Message du dialogue de confirmation
    private var matchImportConfirmationMessage: String {
        guard let data = pendingMatchImportData else { return "" }
        let targetProfile = resolveMatchImportTargetProfile()
        let targetId = targetProfile?.id
        let targetMatches: [Match]
        if let tid = targetId {
            targetMatches = DataManager.shared.loadMatches(forProfileId: tid)
        } else {
            targetMatches = DataManager.shared.loadMatches()
        }
        let existingIds = Set(targetMatches.map { $0.id })
        let existingFingerprints = Set(targetMatches.map { matchFingerprint($0) })
        let newCount = data.matches.filter { m in
            !existingIds.contains(m.id) && !existingFingerprints.contains(matchFingerprint(m))
        }.count
        let existingCount = data.matches.count - newCount
        let targetName = targetProfile?.name ?? ""
        if !targetName.isEmpty {
            return "\(data.matches.count) match\(data.matches.count > 1 ? "s" : "") \u{2192} cat\u{00E9}gorie \u{00AB} \(targetName) \u{00BB}.\n\(newCount) nouveau\(newCount > 1 ? "x" : ""), \(existingCount) d\u{00E9}j\u{00E0} pr\u{00E9}sent\(existingCount > 1 ? "s" : "")."
        } else {
            return "\(newCount) nouveau\(newCount > 1 ? "x" : "") match\(newCount > 1 ? "s" : ""), \(existingCount) d\u{00E9}j\u{00E0} pr\u{00E9}sent\(existingCount > 1 ? "s" : "")."
        }
    }

    /// Résout le profil cible pour l'import
    private func resolveMatchImportTargetProfile() -> TeamProfile? {
        guard let data = pendingMatchImportData else { return profileManager.activeProfile }
        if let code = data.teamCode, !code.isEmpty,
           let target = profileManager.profiles.first(where: { $0.teamCode.uppercased() == code.uppercased() }) {
            return target
        }
        if let name = data.teamName, !name.isEmpty,
           let target = profileManager.profiles.first(where: { $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame }) {
            return target
        }
        return profileManager.activeProfile
    }

    /// Empreinte unique d'un match : date (arrondie au jour) + \u{00E9}quipes
    private func matchFingerprint(_ match: Match) -> String {
        let cal = Calendar.current
        let day = cal.startOfDay(for: match.date)
        let ts = Int(day.timeIntervalSince1970)
        let home = match.homeTeam.trimmingCharacters(in: .whitespaces).lowercased()
        let away = match.awayTeam.trimmingCharacters(in: .whitespaces).lowercased()
        return "\(ts)_\(home)_\(away)"
    }

    /// Empreinte unique d'un carton
    private func cardFingerprint(_ card: CardEvent) -> String {
        let name = card.playerName.trimmingCharacters(in: .whitespaces).lowercased()
        let minute = Int(card.minute / 60)
        return "\(name)_\(minute)_\(card.type.rawValue)"
    }

    /// Fusionne les matchs import\u{00E9}s dans la bonne cat\u{00E9}gorie
    private func performMatchImport() {
        guard let data = pendingMatchImportData else { return }
        let targetProfile = resolveMatchImportTargetProfile()
        guard let targetId = targetProfile?.id else {
            matchImportAlertTitle = "Erreur"
            matchImportAlertMessage = "Impossible de d\u{00E9}terminer la cat\u{00E9}gorie cible."
            showMatchImportAlert = true
            pendingMatchImportData = nil
            return
        }

        let targetMatches = DataManager.shared.loadMatches(forProfileId: targetId)
        let existingIds = Set(targetMatches.map { $0.id })
        let existingFingerprints = Set(targetMatches.map { matchFingerprint($0) })

        var added = 0
        var updated = 0

        for imported in data.matches {
            let fingerprint = matchFingerprint(imported)

            if existingIds.contains(imported.id) {
                if var existing = targetMatches.first(where: { $0.id == imported.id }) {
                    mergeCards(into: &existing, from: imported)
                    DataManager.shared.saveMatch(existing, forProfileId: targetId)
                    updated += 1
                }
            } else if existingFingerprints.contains(fingerprint) {
                if var existing = targetMatches.first(where: { matchFingerprint($0) == fingerprint }) {
                    mergeCards(into: &existing, from: imported)
                    DataManager.shared.saveMatch(existing, forProfileId: targetId)
                    updated += 1
                }
            } else {
                DataManager.shared.saveMatch(imported, forProfileId: targetId)
                added += 1
            }
        }

        let categoryName = targetProfile?.name ?? ""
        matchImportAlertTitle = "Import r\u{00E9}ussi"
        matchImportAlertMessage = "\(added) match\(added > 1 ? "s" : "") ajout\u{00E9}\(added > 1 ? "s" : ""), \(updated) mis \u{00E0} jour\(categoryName.isEmpty ? "" : " dans \(categoryName)")."
        showMatchImportAlert = true
        pendingMatchImportData = nil
    }

    /// Fusionne les cartons et \u{00E9}v\u{00E9}nements d'un match import\u{00E9}
    private func mergeCards(into existing: inout Match, from imported: Match) {
        let existingCardIds = Set(existing.cards.map { $0.id })
        let existingCardFingerprints = Set(existing.cards.map { cardFingerprint($0) })
        for card in imported.cards {
            if !existingCardIds.contains(card.id) && !existingCardFingerprints.contains(cardFingerprint(card)) {
                existing.cards.append(card)
            }
        }
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

    /// Force la tint color UIKit sur la fenêtre pour que l'écran « More » prenne immédiatement la couleur
    private func updateGlobalTint() {
        let uiColor = UIColor(profileManager.activeProfileColor)
        for scene in UIApplication.shared.connectedScenes {
            if let windowScene = scene as? UIWindowScene {
                for window in windowScene.windows {
                    window.tintColor = uiColor
                }
            }
        }
    }
}

// MARK: - Vue Réglages

struct SettingsView: View {
    @ObservedObject var storeManager: StoreManager
    @ObservedObject var profileManager = ProfileManager.shared
    @State private var showPaywall = false
    @State private var showTerms = false
    @State private var showPrivacy = false
    @State private var showPremiumStatus = false
    @State private var showUserGuide = false

    var body: some View {
        NavigationStack {
            List {
                // Export / Import
                Section {
                    NavigationLink {
                        ExportImportView()
                            .navigationTitle(profileManager.activeProfile.map { "Export — \($0.name)" } ?? "Export / Import")
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Export / Import")
                                Text("PDF, JSON joueurs & stats")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "square.and.arrow.up.on.square")
                                .foregroundStyle(.blue)
                        }
                    }
                } header: {
                    Text("Données")
                }

                // Mode d'emploi
                Section {
                    Button {
                        showUserGuide = true
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Mode d'emploi")
                                Text("Apprenez à utiliser l'app")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "book.fill")
                                .foregroundStyle(.green)
                        }
                    }
                } header: {
                    Text("Aide")
                }
                
                // Statut Premium
                Section {
                    Button {
                        if storeManager.isPremium {
                            showPremiumStatus = true
                        } else {
                            showPaywall = true
                        }
                    } label: {
                        HStack {
                            Image(systemName: storeManager.isPremium ? "crown.fill" : "crown")
                                .font(.title2)
                                .foregroundStyle(storeManager.isPremium ? .yellow : .gray)
                            VStack(alignment: .leading) {
                                Text(storeManager.isPremium ? "Premium" : "Version gratuite")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                if storeManager.isPremium {
                                    Text("Voir mes avantages")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                } else {
                                    Text("\(storeManager.remainingFreeMatches) matchs restants")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if !storeManager.isPremium {
                                Text("Upgrade")
                                    .font(.subheadline.bold())
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(.orange)
                                    .foregroundStyle(.white)
                                    .cornerRadius(8)
                            } else {
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Button {
                        Task { await storeManager.restorePurchases() }
                    } label: {
                        Label("Restaurer les achats", systemImage: "arrow.clockwise")
                    }
                } header: {
                    Text("Abonnement")
                }

                // À propos
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.2")
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Text("Développeur")
                        Spacer()
                        Text("Robert Oulhen")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("À propos")
                }

                // Infos légales
                Section {
                    Button {
                        showTerms = true
                    } label: {
                        Label("Conditions d'utilisation", systemImage: "doc.text")
                    }
                    Button {
                        showPrivacy = true
                    } label: {
                        Label("Politique de confidentialité", systemImage: "hand.raised.fill")
                    }
                } header: {
                    Text("Légal")
                }
            }
            .navigationTitle("Réglages et Exports")
            .sheet(isPresented: $showPaywall) {
                PaywallView(storeManager: storeManager)
            }
            .sheet(isPresented: $showTerms) {
                TermsOfUseView()
            }
            .sheet(isPresented: $showPrivacy) {
                PrivacyPolicyView()
            }
            .sheet(isPresented: $showPremiumStatus) {
                PremiumStatusView()
            }
            .sheet(isPresented: $showUserGuide) {
                UserGuideView()
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(DeepLinkManager.shared)
}

// MARK: - Barre de sélection de profil

struct ProfileSwitcherBar: View {
    @ObservedObject var profileManager: ProfileManager

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(profileManager.profiles) { profile in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            profileManager.switchToProfile(profile.id)
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(ProfileManager.color(for: profile.colorIndex))
                                .frame(width: 10, height: 10)
                            Text(profile.name)
                                .font(.caption.bold())
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            profile.id == profileManager.activeProfileId
                            ? ProfileManager.color(for: profile.colorIndex).opacity(0.2)
                            : Color(.systemGray5)
                        )
                        .foregroundStyle(
                            profile.id == profileManager.activeProfileId
                            ? ProfileManager.color(for: profile.colorIndex)
                            : .secondary
                        )
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(
                                    profile.id == profileManager.activeProfileId
                                    ? ProfileManager.color(for: profile.colorIndex)
                                    : Color.clear,
                                    lineWidth: 1.5
                                )
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
        }
        .background(.ultraThinMaterial)
    }
}
