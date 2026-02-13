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
    @EnvironmentObject var deepLinkManager: DeepLinkManager
    @State private var showMatch = false
    @State private var selectedTab = 0

    var body: some View {
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

            // Tab 4 : Cartons
            CardsManagementView()
                .tabItem {
                    Label("Cartons", systemImage: "rectangle.fill")
                }
                .tag(3)

            // Tab 5 : Historique
            MatchHistoryView()
                .tabItem {
                    Label("Historique", systemImage: "clock.arrow.circlepath")
                }
                .tag(4)

            // Tab 6 : Paramètres / Premium
            SettingsView(storeManager: storeManager)
                .tabItem {
                    Label("Réglages", systemImage: "gearshape.fill")
                }
                .tag(5)
        }
        .tint(.green)
        .onChange(of: deepLinkManager.shouldNavigateToMatch) {
            if deepLinkManager.shouldNavigateToMatch {
                // Naviguer vers le tab Match si on n'est pas en match
                if !showMatch {
                    selectedTab = 0
                }
            }
        }
    }
}

// MARK: - Vue Réglages

struct SettingsView: View {
    @ObservedObject var storeManager: StoreManager
    @ObservedObject var seasonManager = SeasonManager.shared
    @State private var showPaywall = false
    @State private var showTerms = false
    @State private var showPrivacy = false
    @State private var showPremiumStatus = false
    @State private var showUserGuide = false

    var body: some View {
        NavigationStack {
            List {
                // Saison
                Section {
                    NavigationLink {
                        SeasonManagementView()
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                if let season = seasonManager.currentSeason {
                                    Text("\(season.clubName) — \(season.label)")
                                        .font(.subheadline)
                                    Text("Saison en cours")
                                        .font(.caption)
                                        .foregroundStyle(.green)
                                } else {
                                    Text("Gestion des saisons")
                                        .font(.subheadline)
                                    Text("Aucune saison active")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } icon: {
                            Image(systemName: seasonManager.currentSeason != nil ? "calendar.circle.fill" : "calendar.badge.plus")
                                .foregroundStyle(seasonManager.currentSeason != nil ? .green : .orange)
                        }
                    }
                } header: {
                    Text("Saison")
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
                } header: {
                    Text("Abonnement")
                }

                // À propos
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
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

                // Export / Import
                Section {
                    NavigationLink {
                        ExportImportView()
                            .navigationTitle("Export / Import")
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

                // Actions
                Section {
                    Button {
                        Task { await storeManager.restorePurchases() }
                    } label: {
                        Label("Restaurer les achats", systemImage: "arrow.clockwise")
                    }
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
            .navigationTitle("Réglages")
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
