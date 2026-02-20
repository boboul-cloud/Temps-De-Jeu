//
//  MatchView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

/// Vue principale de gestion du match en cours
struct MatchView: View {
    @ObservedObject var viewModel: MatchViewModel
    @ObservedObject var storeManager: StoreManager
    @Binding var showMatch: Bool
    @State private var showStats = false
    @State private var showEndConfirmation = false
    @State private var showEndPeriodConfirmation = false
    @State private var showTimeline = false
    @State private var showScoreSheet = false
    @State private var showCardSheet = false
    @State private var showSubSheet = false
    @State private var showFoulSheet = false
    @State private var showCardsList = false
    @State private var pendingStoppageType: StoppageType?
    @State private var pendingIsChain = false
    @State private var showTeamPicker = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Fond qui change selon l'état
                backgroundGradient
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Contenu scrollable
                    ScrollView {
                        VStack(spacing: 0) {
                            // Header : noms des équipes + période
                            matchHeader
                                .padding(.horizontal)
                                .padding(.top, 8)

                            // Chronomètre principal
                            timerDisplay
                                .padding(.vertical, 12)

                            // Info arrêt en cours
                            if case .stopped(let type, _) = viewModel.timerState {
                                currentStoppageInfo(type: type)
                                    .padding(.horizontal)
                                    .transition(.scale.combined(with: .opacity))
                            }

                            // Écran inter-période
                            if viewModel.timerState == .periodEnded {
                                halfTimeOverlay
                                    .padding(.horizontal)
                                    .transition(.scale.combined(with: .opacity))
                            } else {
                                // Bannière expulsions temporaires en cours
                                if !viewModel.activeTempExpulsions.filter({ !$0.isCompleted }).isEmpty {
                                    tempExpulsionBanner
                                        .padding(.horizontal)
                                        .padding(.vertical, 4)
                                        .transition(.scale.combined(with: .opacity))
                                }

                                // Boutons d'arrêts de jeu
                                stoppageButtons
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 8)
                            }

                            // Barre de stats rapide
                            quickStatsBar
                                .padding(.horizontal)
                                .padding(.top, 8)
                        }
                    }
                    .scrollIndicators(.hidden)

                    // Boutons de contrôle de période — TOUJOURS VISIBLES en bas
                    if viewModel.timerState != .periodEnded {
                        periodControls
                            .padding(.horizontal)
                            .padding(.vertical, 10)
                            .background(Color(.systemBackground).opacity(0.9))
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showTimeline = true
                    } label: {
                        Image(systemName: "timeline.selection")
                            .foregroundStyle(.white)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 40) {
                        Button {
                            showCardsList = true
                        } label: {
                            HStack(spacing: 3) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color.cardYellow)
                                    .frame(width: 10, height: 14)
                                if !viewModel.match.cards.isEmpty {
                                    Text("\(viewModel.match.cards.count)")
                                        .font(.caption2.bold())
                                        .foregroundStyle(.white)
                                }
                            }
                        }
                        Button {
                            showStats = true
                        } label: {
                            Image(systemName: "chart.bar.fill")
                                .foregroundStyle(.white)
                        }
                    }
                }
            }
            .sheet(isPresented: $showStats) {
                StatisticsView(viewModel: viewModel)
            }
            .sheet(isPresented: $showTimeline) {
                TimelineView(viewModel: viewModel)
            }
            .sheet(isPresented: $showScoreSheet) {
                ScoreSheet(viewModel: viewModel)
                    .presentationDetents([.medium])
            }
            .sheet(isPresented: $showCardSheet) {
                CardSheet(viewModel: viewModel)
                    .presentationDetents([.height(380)])
            }
            .sheet(isPresented: $showSubSheet) {
                SubstitutionSheet(viewModel: viewModel)
                    .presentationDetents([.height(350)])
            }
            .sheet(isPresented: $showFoulSheet) {
                FoulSheet(viewModel: viewModel)
                    .presentationDetents([.height(350)])
            }
            .sheet(isPresented: $showCardsList) {
                MatchCardsListView(viewModel: viewModel)
                    .presentationDetents([.medium, .large])
            }
            .alert("Fin de période", isPresented: $showEndPeriodConfirmation) {
                Button("Confirmer", role: .destructive) {
                    viewModel.endPeriod()
                }
                Button("Annuler", role: .cancel) {}
            } message: {
                Text("Siffler la fin de la \(viewModel.currentPeriod.rawValue) ?")
            }
            .alert("Fin du match", isPresented: $showEndConfirmation) {
                Button("Terminer", role: .destructive) {
                    viewModel.endMatch()
                    storeManager.incrementMatchCount()
                    DataManager.shared.saveMatch(viewModel.match)
                    showMatch = false
                }
                Button("Annuler", role: .cancel) {}
            } message: {
                Text("Êtes-vous sûr de vouloir terminer le match ?")
            }
            .alert("Fin d'expulsion temporaire", isPresented: $viewModel.showTempExpulsionEndAlert) {
                Button("OK") {}
            } message: {
                Text("\(viewModel.endedTempExpulsionPlayerName) peut revenir sur le terrain !")
            }
            .confirmationDialog(
                "Quelle équipe bénéficie ?",
                isPresented: $showTeamPicker,
                titleVisibility: .visible
            ) {
                Button(viewModel.match.homeTeam.isEmpty ? "Domicile" : viewModel.match.homeTeam) {
                    if let type = pendingStoppageType {
                        if pendingIsChain {
                            viewModel.chainStoppage(type: type, beneficiary: .home)
                        } else {
                            viewModel.stopPlay(type: type, beneficiary: .home)
                        }
                        pendingStoppageType = nil
                        pendingIsChain = false
                    }
                }
                Button(viewModel.match.awayTeam.isEmpty ? "Extérieur" : viewModel.match.awayTeam) {
                    if let type = pendingStoppageType {
                        if pendingIsChain {
                            viewModel.chainStoppage(type: type, beneficiary: .away)
                        } else {
                            viewModel.stopPlay(type: type, beneficiary: .away)
                        }
                        pendingStoppageType = nil
                        pendingIsChain = false
                    }
                }
                Button("Annuler", role: .cancel) {
                    pendingStoppageType = nil
                    pendingIsChain = false
                }
            }
            .onAppear {
                if viewModel.timerState == .idle {
                    viewModel.startMatch()
                }
            }
            .animation(.easeInOut(duration: 0.3), value: viewModel.timerState)
        }
    }

    // MARK: - Background

    private var backgroundGradient: some View {
        Group {
            switch viewModel.timerState {
            case .running:
                LinearGradient(
                    colors: [Color.green.opacity(0.8), Color.green.opacity(0.4), Color(.systemBackground)],
                    startPoint: .top, endPoint: .bottom)
            case .stopped:
                LinearGradient(
                    colors: [Color.red.opacity(0.8), Color.red.opacity(0.4), Color(.systemBackground)],
                    startPoint: .top, endPoint: .bottom)
            default:
                LinearGradient(
                    colors: [Color.gray.opacity(0.4), Color(.systemBackground)],
                    startPoint: .top, endPoint: .bottom)
            }
        }
    }

    // MARK: - Header

    private var matchHeader: some View {
        VStack(spacing: 8) {
            HStack {
                VStack(alignment: .leading) {
                    Text(viewModel.match.homeTeam.isEmpty ? "Domicile" : viewModel.match.homeTeam)
                        .font(.headline)
                        .foregroundStyle(.white)
                    if viewModel.match.isMyTeamHome {
                        Text("Mon équipe")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.3))
                            .cornerRadius(4)
                    }
                }
                Spacer()

                VStack {
                    Text(viewModel.currentPeriod.shortName)
                        .font(.caption.bold())
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(Color.white.opacity(0.3))
                        .cornerRadius(12)

                    if viewModel.isOverRegulationTime {
                        Text("+\(viewModel.overtimeMinutes)'")
                            .font(.caption2.bold())
                            .foregroundStyle(.yellow)
                    }
                }

                Spacer()
                VStack(alignment: .trailing) {
                    Text(viewModel.match.awayTeam.isEmpty ? "Extérieur" : viewModel.match.awayTeam)
                        .font(.headline)
                        .foregroundStyle(.white)
                    if !viewModel.match.isMyTeamHome {
                        Text("Mon équipe")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.3))
                            .cornerRadius(4)
                    }
                }
            }

            // Score cliquable
            Button {
                showScoreSheet = true
            } label: {
                HStack(spacing: 20) {
                    Text("\(viewModel.match.homeScore)")
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("-")
                        .font(.title)
                        .foregroundStyle(.white.opacity(0.6))
                    Text("\(viewModel.match.awayScore)")
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
            }

            // Boutons rapides cartons / remplacements
            HStack(spacing: 12) {
                Button {
                    showCardSheet = true
                } label: {
                    HStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.cardYellow)
                            .frame(width: 12, height: 16)
                        Text("Carton")
                            .font(.caption.bold())
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.2))
                    .cornerRadius(8)
                    .foregroundStyle(.white)
                }

                Button {
                    showSubSheet = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.caption)
                        Text("Rempl.")
                            .font(.caption.bold())
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.2))
                    .cornerRadius(8)
                    .foregroundStyle(.white)
                }

                Button {
                    showFoulSheet = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption)
                        Text("Faute")
                            .font(.caption.bold())
                        if !viewModel.match.fouls.isEmpty {
                            Text("\(viewModel.match.fouls.count)")
                                .font(.caption2.bold())
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.2))
                    .cornerRadius(8)
                    .foregroundStyle(.white)
                }
            }
        }
    }

    // MARK: - Chronomètre

    private var timerDisplay: some View {
        VStack(spacing: 4) {
            // Temps total
            Text(TimeFormatters.formatTimePrecise(viewModel.elapsedTime))
                .font(.system(size: 64, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)

            HStack(spacing: 24) {
                // Temps effectif
                VStack {
                    Text("Effectif")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.7))
                    Text(TimeFormatters.formatTime(viewModel.currentEffectiveTime))
                        .font(.system(size: 20, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.white)
                }

                // Temps d'arrêts (tous)
                VStack {
                    Text("Arrêts")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.7))
                    Text(TimeFormatters.formatTime(viewModel.currentTotalStoppageTime))
                        .font(.system(size: 20, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.yellow)
                }

                // Temps additionnel suggéré (uniquement blessures/VAR/anti-jeu + forfait rempl.)
                VStack {
                    Text("À ajouter")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.7))
                    Text("+\(Int(ceil(viewModel.currentAddedTime / 60)))'")
                        .font(.system(size: 20, weight: .bold, design: .monospaced))
                        .foregroundStyle(.orange)
                }
            }
        }
    }

    // MARK: - Info arrêt en cours

    private func currentStoppageInfo(type: StoppageType) -> some View {
        HStack {
            Image(systemName: type.icon)
                .font(.title2)
            VStack(alignment: .leading) {
                HStack(spacing: 6) {
                    Text(type.rawValue)
                        .font(.headline)
                    if let team = viewModel.currentBeneficiaryTeam {
                        Text(team == .home
                             ? (viewModel.match.homeTeam.isEmpty ? "DOM" : viewModel.match.homeTeam)
                             : (viewModel.match.awayTeam.isEmpty ? "EXT" : viewModel.match.awayTeam))
                            .font(.caption.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(team == .home ? Color.blue.opacity(0.3) : Color.orange.opacity(0.3))
                            .cornerRadius(6)
                    }
                }
                Text(TimeFormatters.formatTimePrecise(viewModel.stoppageElapsed))
                    .font(.system(.title3, design: .monospaced))
                    .bold()
            }
            Spacer()

            // Bouton REPRISE (vert)
            Button(action: {
                viewModel.resumePlay()
            }) {
                HStack {
                    Image(systemName: "play.fill")
                    Text("REPRISE")
                        .font(.headline)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(Color.green)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
        }
        .padding()
        .background(Color.red.opacity(0.2))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.red, lineWidth: 2)
        )
    }

    // MARK: - Boutons d'arrêt

    /// Vérifie si un type est chaînable depuis l'arrêt en cours
    private func isChainableType(_ type: StoppageType) -> Bool {
        guard let current = viewModel.currentStoppageType else { return false }
        return current.chainableTypes.contains(type)
    }

    private var stoppageButtons: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 10) {
            ForEach(StoppageType.allCases) { type in
                let canChain = viewModel.isStopped && isChainableType(type)
                StoppageButton(
                    type: type,
                    isEnabled: viewModel.isPlaying || canChain,
                    isChaining: canChain,
                    action: {
                        if canChain {
                            // Chaîner depuis l'arrêt en cours
                            if type.requiresTeamSelection {
                                pendingStoppageType = type
                                pendingIsChain = true
                                showTeamPicker = true
                            } else {
                                viewModel.chainStoppage(type: type)
                            }
                        } else {
                            // Nouvel arrêt normal
                            if type.requiresTeamSelection {
                                pendingStoppageType = type
                                pendingIsChain = false
                                showTeamPicker = true
                            } else {
                                viewModel.stopPlay(type: type)
                            }
                        }
                    }
                )
            }
        }
    }

    // MARK: - Stats rapides

    private var quickStatsBar: some View {
        HStack(spacing: 16) {
            StatPill(
                label: "Arrêts",
                value: "\(viewModel.match.stoppages.filter { $0.period == viewModel.currentPeriod }.count)",
                color: .red
            )
            StatPill(
                label: "Effectif",
                value: "\(Int(viewModel.currentEffectiveTime > 0 ? (viewModel.currentEffectiveTime / max(1, viewModel.elapsedTime)) * 100 : 0))%",
                color: .green
            )
            StatPill(
                label: "Fautes",
                value: "\(viewModel.match.fouls.filter { $0.period == viewModel.currentPeriod }.count)",
                color: .orange
            )
        }
    }

    // MARK: - Bannière expulsions temporaires

    private var tempExpulsionBanner: some View {
        VStack(spacing: 8) {
            ForEach(viewModel.activeTempExpulsions.filter { !$0.isCompleted }) { expulsion in
                let remaining = viewModel.remainingTempExpulsionTime(for: expulsion)
                let minutes = Int(remaining) / 60
                let seconds = Int(remaining) % 60
                HStack(spacing: 10) {
                    // Icône carton blanc
                    RoundedRectangle(cornerRadius: 3)
                        .fill(.white)
                        .frame(width: 16, height: 22)
                        .overlay(
                            RoundedRectangle(cornerRadius: 3)
                                .stroke(Color.gray, lineWidth: 1)
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(expulsion.playerName)
                            .font(.caption.bold())
                            .foregroundStyle(.primary)
                        Text("Expulsion temporaire")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    // Compte à rebours
                    Text(String(format: "%02d:%02d", minutes, seconds))
                        .font(.system(.headline, design: .monospaced))
                        .foregroundStyle(remaining < 120 ? .orange : .primary)

                    // Indicateur de progression
                    CircularProgressView(
                        progress: 1.0 - (remaining / expulsion.totalDuration),
                        color: remaining < 120 ? .orange : .blue
                    )
                    .frame(width: 28, height: 28)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(remaining < 120 ? Color.orange.opacity(0.5) : Color.blue.opacity(0.3), lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Contrôles de période

    private var halfTimeOverlay: some View {
        VStack(spacing: 24) {
            Image(systemName: "pause.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.orange)

            Text("Fin de la \(viewModel.currentPeriod.rawValue)")
                .font(.title2.bold())

            // Résumé de la période
            HStack(spacing: 20) {
                StatBox(title: "Temps total", value: TimeFormatters.formatTime(viewModel.match.periodDurations[viewModel.currentPeriod.rawValue] ?? viewModel.elapsedTime), color: .blue)
                StatBox(title: "Effectif", value: TimeFormatters.formatTime(viewModel.currentEffectiveTime), color: .green)
                StatBox(title: "Arrêts", value: TimeFormatters.formatTime(viewModel.currentTotalStoppageTime), color: .red)
                StatBox(title: "À ajouter", value: "+\(Int(ceil(viewModel.currentAddedTime / 60)))'", color: .orange)
            }

            // Bouton lancer la période suivante (sauf si dernière période)
            if !viewModel.isLastPeriod {
                Button {
                    viewModel.startMatch()
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "play.fill")
                            .font(.title2)
                        Text("Lancer la \(viewModel.nextPeriod.rawValue)")
                            .font(.title3.bold())
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(16)
                }
            }

            // Bouton terminer le match
            Button {
                showEndConfirmation = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "stop.fill")
                    Text("Terminer le match")
                        .font(.subheadline.bold())
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.red.opacity(0.15))
                .foregroundColor(.red)
                .cornerRadius(12)
            }
        }
        .padding(24)
        .background(Color(.systemGray6))
        .cornerRadius(20)
    }

    private var periodControls: some View {
        HStack(spacing: 12) {
            // Fin de période
            Button {
                showEndPeriodConfirmation = true
            } label: {
                HStack {
                    Image(systemName: "flag.checkered")
                    Text("Fin \(viewModel.currentPeriod.shortName)")
                        .font(.subheadline.bold())
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.orange)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(viewModel.timerState == .idle)

            // Fin de match
            Button {
                showEndConfirmation = true
            } label: {
                HStack {
                    Image(systemName: "stop.fill")
                    Text("Fin match")
                        .font(.subheadline.bold())
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.red)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
        }
    }
}

// MARK: - Bouton d'arrêt individuel

struct StoppageButton: View {
    let type: StoppageType
    let isEnabled: Bool
    var isChaining: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: type.icon)
                    .font(.title2)
                Text(type.rawValue)
                    .font(.caption2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 70)
            .background(
                isChaining ? type.color.opacity(0.35) :
                (isEnabled ? type.color.opacity(0.2) : Color.gray.opacity(0.1))
            )
            .foregroundStyle(isEnabled ? type.color : .gray)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        isChaining ? type.color : (isEnabled ? type.color.opacity(0.5) : Color.gray.opacity(0.2)),
                        lineWidth: isChaining ? 2 : 1
                    )
            )
        }
        .disabled(!isEnabled)
    }
}

struct StatPill: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(.headline, design: .monospaced))
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
}

// MARK: - Score Sheet

struct ScoreSheet: View {
    @ObservedObject var viewModel: MatchViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedPlayerId: UUID? = nil
    @State private var showPlayerPicker = false

    /// Joueurs de mon équipe triés par numéro
    private var myTeamPlayers: [MatchPlayer] {
        viewModel.matchRoster.sorted { $0.shirtNumber < $1.shirtNumber }
    }

    /// Nom du joueur sélectionné
    private var selectedPlayerName: String {
        if let id = selectedPlayerId,
           let player = myTeamPlayers.first(where: { $0.id == id }) {
            return "\(player.firstName) \(player.lastName)"
        }
        return ""
    }

    /// Indique si mon équipe est le côté "home"
    private var isMyTeamHome: Bool { viewModel.match.isMyTeamHome }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                HStack(spacing: 30) {
                    // Domicile
                    VStack(spacing: 8) {
                        Text(viewModel.match.homeTeam.isEmpty ? "Domicile" : viewModel.match.homeTeam)
                            .font(.subheadline.bold())
                        if isMyTeamHome {
                            Text("Mon équipe")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.blue)
                        }
                        Text("\(viewModel.match.homeScore)")
                            .font(.system(size: 48, weight: .bold, design: .rounded))

                        HStack(spacing: 16) {
                            Button {
                                viewModel.match.homeScore = max(0, viewModel.match.homeScore - 1)
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(.red)
                            }
                            Button {
                                let name = isMyTeamHome ? selectedPlayerName : ""
                                viewModel.addGoal(isHome: true, playerName: name)
                                selectedPlayerId = nil
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(.green)
                            }
                        }
                    }

                    Text("-")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)

                    // Extérieur
                    VStack(spacing: 8) {
                        Text(viewModel.match.awayTeam.isEmpty ? "Extérieur" : viewModel.match.awayTeam)
                            .font(.subheadline.bold())
                        if !isMyTeamHome {
                            Text("Mon équipe")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.blue)
                        }
                        Text("\(viewModel.match.awayScore)")
                            .font(.system(size: 48, weight: .bold, design: .rounded))

                        HStack(spacing: 16) {
                            Button {
                                viewModel.match.awayScore = max(0, viewModel.match.awayScore - 1)
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(.red)
                            }
                            Button {
                                let name = isMyTeamHome ? "" : selectedPlayerName
                                viewModel.addGoal(isHome: false, playerName: name)
                                selectedPlayerId = nil
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                }

                // Sélection du buteur (mon équipe)
                if !myTeamPlayers.isEmpty {
                    VStack(spacing: 6) {
                        Text("Buteur (mon équipe)")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Button {
                            showPlayerPicker = true
                        } label: {
                            HStack {
                                Image(systemName: "person.fill")
                                    .foregroundStyle(.orange)
                                Text(selectedPlayerId == nil
                                     ? "Sélectionner un buteur"
                                     : myTeamPlayers.first(where: { $0.id == selectedPlayerId }).map { "\($0.shirtNumber) - \($0.firstName) \($0.lastName)" } ?? "")
                                    .foregroundStyle(selectedPlayerId == nil ? .secondary : .primary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Color(.systemGray6))
                            .cornerRadius(10)
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding()
            .navigationTitle("Score")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
            .sheet(isPresented: $showPlayerPicker) {
                GoalScorerPicker(
                    players: myTeamPlayers,
                    selectedPlayerId: $selectedPlayerId
                )
            }
            .onAppear {
                viewModel.loadMatchRoster()
            }
        }
    }
}

// MARK: - Picker buteur (sheet dédiée)

struct GoalScorerPicker: View {
    let players: [MatchPlayer]
    @Binding var selectedPlayerId: UUID?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button {
                    selectedPlayerId = nil
                    dismiss()
                } label: {
                    HStack {
                        Text("— Aucun —")
                            .foregroundStyle(.secondary)
                        Spacer()
                        if selectedPlayerId == nil {
                            Image(systemName: "checkmark")
                                .foregroundStyle(.blue)
                        }
                    }
                }

                ForEach(players) { player in
                    Button {
                        selectedPlayerId = player.id
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Text("\(player.shirtNumber)")
                                .font(.system(.headline, design: .rounded))
                                .foregroundColor(.white)
                                .frame(width: 32, height: 32)
                                .background(Color.green)
                                .clipShape(Circle())

                            Text("\(player.firstName) \(player.lastName)")
                                .foregroundStyle(.primary)

                            Spacer()

                            if selectedPlayerId == player.id {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Buteur")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Card Sheet

struct CardSheet: View {
    @ObservedObject var viewModel: MatchViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var playerName = ""
    @State private var selectedPlayerId: UUID?
    @State private var cardType: CardType = .yellow

    var body: some View {
        VStack(spacing: 20) {
            Text("Carton")
                .font(.headline)

            // Sélection du type
            HStack(spacing: 16) {
                CardTypeButton(type: .yellow, selected: cardType == .yellow) {
                    cardType = .yellow
                }
                CardTypeButton(type: .secondYellow, selected: cardType == .secondYellow) {
                    cardType = .secondYellow
                }
                CardTypeButton(type: .red, selected: cardType == .red) {
                    cardType = .red
                }
                CardTypeButton(type: .white, selected: cardType == .white) {
                    cardType = .white
                }
            }

            TextField("Nom du joueur", text: $playerName)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)
                .onChange(of: playerName) {
                    // Si le texte est modifié manuellement, on perd la ref joueur
                    if let id = selectedPlayerId,
                       let mp = viewModel.allMatchPlayers.first(where: { $0.id == id }),
                       playerName != mp.displayName {
                        selectedPlayerId = nil
                    }
                }

            // Liste rapide des joueurs de l'effectif
            if !viewModel.matchRoster.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.allMatchPlayers) { player in
                            Button {
                                playerName = player.displayName
                                selectedPlayerId = player.id
                            } label: {
                                HStack(spacing: 4) {
                                    Text("#\(player.shirtNumber) \(player.displayName)")
                                        .font(.caption)
                                    // Indicateur carton jaune si le joueur en a reçu un dans ce match
                                    let playerYellows = viewModel.match.cards.filter { $0.playerId == player.id && $0.type == .yellow }
                                    if !playerYellows.isEmpty {
                                        RoundedRectangle(cornerRadius: 1)
                                            .fill(Color.cardYellow)
                                            .frame(width: 8, height: 11)
                                    }
                                    if player.status == .tempExpulse {
                                        Image(systemName: "rectangle.fill")
                                            .font(.system(size: 8))
                                            .foregroundColor(.gray)
                                    }
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(selectedPlayerId == player.id ? Color.orange.opacity(0.25) : (player.status == .tempExpulse ? Color.gray.opacity(0.15) : Color(.systemGray5)))
                                .cornerRadius(8)
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Liste des joueurs expulsés (2ème jaune ou rouge)
                let expelledPlayers = viewModel.matchRoster.filter { $0.status == .expulse }
                if !expelledPlayers.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Expulsés")
                            .font(.caption.bold())
                            .foregroundStyle(.red)
                            .padding(.horizontal)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(expelledPlayers) { player in
                                    HStack(spacing: 4) {
                                        Text("#\(player.shirtNumber) \(player.displayName)")
                                            .font(.caption)
                                            .strikethrough()
                                            .foregroundStyle(.secondary)
                                        // Afficher les cartons reçus par ce joueur
                                        let playerCards = viewModel.match.cards.filter { $0.playerId == player.id }
                                        ForEach(playerCards) { card in
                                            RoundedRectangle(cornerRadius: 1)
                                                .fill(card.type == .red ? Color.cardRed : (card.type == .secondYellow ? Color.cardOrange : Color.cardYellow))
                                                .frame(width: 8, height: 11)
                                        }
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.red.opacity(0.1))
                                    .cornerRadius(8)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
            }

            Button {
                guard !playerName.isEmpty else { return }
                viewModel.addCard(type: cardType, playerName: playerName, playerId: selectedPlayerId)
                dismiss()
            } label: {
                Text("Confirmer le carton")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(playerName.isEmpty ? Color.gray : Color.orange)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .disabled(playerName.isEmpty)
            .padding(.horizontal)
        }
        .padding()
        .onAppear { viewModel.loadMatchRoster() }
    }
}

struct CardTypeButton: View {
    let type: CardType
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(cardColor)
                    .frame(width: 28, height: 38)
                    .overlay(
                        Group {
                            if type == .secondYellow {
                                RoundedRectangle(cornerRadius: 3).fill(Color.cardRed).frame(width: 14, height: 38).offset(x: 7)
                            } else if type == .white {
                                RoundedRectangle(cornerRadius: 3).stroke(Color.gray, lineWidth: 1)
                            }
                        }
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                Text(type.rawValue)
                    .font(.caption2)
            }
            .padding(10)
            .background(selected ? (type == .white ? Color.gray.opacity(0.15) : cardColor.opacity(0.15)) : Color(.systemGray6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(selected ? (type == .white ? Color.gray : cardColor) : Color.clear, lineWidth: 2)
            )
        }
    }

    private var cardColor: Color {
        switch type {
        case .yellow: return .cardYellow
        case .red: return .cardRed
        case .secondYellow: return .cardOrange
        case .white: return .cardWhite
        }
    }
}

// MARK: - Substitution Sheet

struct SubstitutionSheet: View {
    @ObservedObject var viewModel: MatchViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var playerOut = ""
    @State private var playerIn = ""
    @State private var selectedOutId: UUID?
    @State private var selectedInId: UUID?

    var body: some View {
        VStack(spacing: 20) {
            Text("Remplacement")
                .font(.headline)

            VStack(spacing: 12) {
                // Joueur sortant
                VStack(alignment: .leading, spacing: 4) {
                    Label("Sort", systemImage: "arrow.down.circle.fill")
                        .font(.caption.bold())
                        .foregroundStyle(.red)
                    TextField("Joueur sortant", text: $playerOut)
                        .textFieldStyle(.roundedBorder)
                        .onChange(of: playerOut) {
                            if let id = selectedOutId,
                               let mp = viewModel.titulaires.first(where: { $0.id == id }),
                               playerOut != mp.displayName {
                                selectedOutId = nil
                            }
                        }
                }

                // Joueur entrant
                VStack(alignment: .leading, spacing: 4) {
                    Label("Entre", systemImage: "arrow.up.circle.fill")
                        .font(.caption.bold())
                        .foregroundStyle(.green)
                    TextField("Joueur entrant", text: $playerIn)
                        .textFieldStyle(.roundedBorder)
                        .onChange(of: playerIn) {
                            if let id = selectedInId,
                               let mp = viewModel.remplacants.first(where: { $0.id == id }),
                               playerIn != mp.displayName {
                                selectedInId = nil
                            }
                        }
                }
            }
            .padding(.horizontal)

            // Sélection rapide depuis roster
            if !viewModel.matchRoster.isEmpty {
                VStack(spacing: 8) {
                    Text("Titulaires (sortants)")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(viewModel.titulaires) { player in
                                Button {
                                    playerOut = player.displayName
                                    selectedOutId = player.id
                                } label: {
                                    Text("#\(player.shirtNumber) \(player.displayName)")
                                        .font(.caption)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(selectedOutId == player.id ? Color.red.opacity(0.2) : Color(.systemGray5))
                                        .cornerRadius(8)
                                }
                            }
                        }
                        .padding(.horizontal)
                    }

                    Text("Remplaçants (entrants)")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(viewModel.remplacants) { player in
                                Button {
                                    playerIn = player.displayName
                                    selectedInId = player.id
                                } label: {
                                    Text("#\(player.shirtNumber) \(player.displayName)")
                                        .font(.caption)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(selectedInId == player.id ? Color.green.opacity(0.2) : Color(.systemGray5))
                                        .cornerRadius(8)
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }

            Button {
                guard !playerOut.isEmpty && !playerIn.isEmpty else { return }
                viewModel.addSubstitution(playerOut: playerOut, playerIn: playerIn, playerOutId: selectedOutId, playerInId: selectedInId)
                // Déclencher aussi un arrêt de type remplacement si le jeu est en cours
                if viewModel.isPlaying {
                    viewModel.stopPlay(type: .remplacement)
                }
                dismiss()
            } label: {
                Text("Confirmer le remplacement")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background((playerOut.isEmpty || playerIn.isEmpty) ? Color.gray : Color.purple)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .disabled(playerOut.isEmpty || playerIn.isEmpty)
            .padding(.horizontal)
        }
        .padding()
        .onAppear { viewModel.loadMatchRoster() }
    }
}

// MARK: - Foul Sheet

struct FoulSheet: View {
    @ObservedObject var viewModel: MatchViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var playerName = ""
    @State private var selectedPlayerId: UUID?

    var body: some View {
        VStack(spacing: 20) {
            Text("Faute")
                .font(.headline)

            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title2)
                    .foregroundStyle(.orange)
                Text("Attribuer une faute à un joueur")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            TextField("Nom du joueur", text: $playerName)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)
                .onChange(of: playerName) {
                    if let id = selectedPlayerId,
                       let mp = viewModel.allMatchPlayers.first(where: { $0.id == id }),
                       playerName != mp.displayName {
                        selectedPlayerId = nil
                    }
                }

            // Liste rapide des joueurs de l'effectif
            if !viewModel.matchRoster.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.allMatchPlayers) { player in
                            let fouls = viewModel.foulCount(for: player.id)
                            Button {
                                playerName = player.displayName
                                selectedPlayerId = player.id
                            } label: {
                                HStack(spacing: 4) {
                                    Text("#\(player.shirtNumber) \(player.displayName)")
                                        .font(.caption)
                                    if fouls > 0 {
                                        Text("\(fouls)")
                                            .font(.caption2.bold())
                                            .foregroundStyle(.white)
                                            .frame(width: 18, height: 18)
                                            .background(Color.orange)
                                            .clipShape(Circle())
                                    }
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(selectedPlayerId == player.id ? Color.orange.opacity(0.25) : Color(.systemGray5))
                                .cornerRadius(8)
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }

            Button {
                guard !playerName.isEmpty else { return }
                viewModel.addFoul(playerName: playerName, playerId: selectedPlayerId)
                dismiss()
            } label: {
                Text("Confirmer la faute")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(playerName.isEmpty ? Color.gray : Color.orange)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            .disabled(playerName.isEmpty)
            .padding(.horizontal)
        }
        .padding()
        .onAppear { viewModel.loadMatchRoster() }
    }
}

// MARK: - Circular Progress View

struct CircularProgressView: View {
    let progress: Double
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.2), lineWidth: 3)
            Circle()
                .trim(from: 0, to: min(progress, 1.0))
                .stroke(color, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.5), value: progress)
        }
    }
}

#Preview {
    MatchView(
        viewModel: MatchViewModel(),
        storeManager: StoreManager.shared,
        showMatch: .constant(true)
    )
}
