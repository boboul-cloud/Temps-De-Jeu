//
//  TacticsLibraryView.swift
//  Temps De Jeu
//
//  Atelier (plein écran) : mes exercices, mes séances et la bibliothèque
//  d'exercices animés. Import / export de fichiers .tdjt.
//

import SwiftUI
import UniformTypeIdentifiers

enum AtelierHomeTab: String, CaseIterable, Identifiable {
    case exercices = "Mes exercices"
    case seances = "Séances"
    case bibliotheque = "Bibliothèque"
    var id: String { rawValue }
}

enum AtelierHomeRoute: Hashable {
    case plan(UUID)
}

struct TacticsLibraryView: View {
    var palette = Pitch3DPalette()
    var roster: [MatchPlayer] = []

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var store = TacticStore.shared
    @State private var tab: AtelierHomeTab = .exercices
    @State private var path: [AtelierHomeRoute] = []
    @State private var searchText = ""
    @State private var playerRequest: AtelierPlayRequest?
    @State private var editing: AtelierEditRequest?
    @State private var showImporter = false
    @State private var shareFile: TacticShareFile?
    @State private var alertMessage: String?
    @State private var playToDelete: TacticPlay?
    @State private var planToDelete: TrainingPlan?

    private func matches(_ play: TacticPlay) -> Bool {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return true }
        let haystack = [play.title, play.objective, play.category.displayName, play.headcount ?? "", play.level ?? ""]
            .joined(separator: " ")
        return haystack.localizedStandardContains(query)
    }

    private var userPlays: [TacticPlay] { store.userTactics.filter(matches) }

    private var groupedLibrary: [(TacticCategory, [TacticPlay])] {
        TacticCategory.allCases.compactMap { category in
            let plays = store.libraryTactics.filter { $0.category == category && matches($0) }
            return plays.isEmpty ? nil : (category, plays)
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                Picker("Rubrique", selection: $tab) {
                    ForEach(AtelierHomeTab.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)

                switch tab {
                case .exercices: exercisesTab
                case .seances: plansTab
                case .bibliotheque: libraryTab
                }
            }
            .background(Color(.systemGroupedBackground))
            .searchable(text: $searchText, prompt: "Rechercher un exercice")
            .navigationTitle("Atelier")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: AtelierHomeRoute.self) { route in
                switch route {
                case .plan(let id): AtelierPlanView(planId: id, palette: palette)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            showImporter = true
                        } label: {
                            Label("Importer un fichier .tdjt", systemImage: "square.and.arrow.down")
                        }
                        if !store.userTactics.isEmpty {
                            Button {
                                share(store.userTactics)
                            } label: {
                                Label("Exporter mes exercices", systemImage: "square.and.arrow.up")
                            }
                        }
                        Button {
                            share(store.libraryTactics)
                        } label: {
                            Label("Exporter la bibliothèque", systemImage: "books.vertical")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Importer / exporter")
                }
            }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.tdjTactic, .json],
                      allowsMultipleSelection: true) { result in
            handleImport(result)
        }
        .fullScreenCover(item: $playerRequest) { request in
            TacticPlayerView(play: request.play, palette: palette, roster: roster, cinema: request.cinema)
        }
        .fullScreenCover(item: $editing) { request in
            AtelierEditorView(play: request.play) { store.save($0) }
        }
        .sheet(item: $shareFile) { file in
            ActivityView(activityItems: [file.url])
        }
        .alert("Atelier", isPresented: Binding(get: { alertMessage != nil }, set: { if !$0 { alertMessage = nil } })) {
            Button("OK") { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
        .confirmationDialog("Supprimer cet exercice ?",
                            isPresented: Binding(get: { playToDelete != nil }, set: { if !$0 { playToDelete = nil } }),
                            titleVisibility: .visible) {
            Button("Supprimer", role: .destructive) {
                if let playToDelete { store.delete(playToDelete) }
                playToDelete = nil
            }
        } message: {
            Text(playToDelete?.title ?? "")
        }
        .confirmationDialog("Supprimer cette séance ?",
                            isPresented: Binding(get: { planToDelete != nil }, set: { if !$0 { planToDelete = nil } }),
                            titleVisibility: .visible) {
            Button("Supprimer", role: .destructive) {
                if let planToDelete { store.deletePlan(planToDelete) }
                planToDelete = nil
            }
        } message: {
            Text("Les exercices restent dans « Mes exercices ».")
        }
    }

    // MARK: - Mes exercices

    private var exercisesTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Button {
                    editing = AtelierEditRequest(play: AtelierEditorModel.newExercise())
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "plus")
                            .font(.system(size: 26, weight: .bold))
                            .frame(width: 54, height: 54)
                            .background(Circle().fill(.white.opacity(0.22)))
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Nouvel exercice")
                                .font(.title3.bold())
                            Text("Terrain, matériel, chasubles et étapes animées")
                                .font(.subheadline)
                                .opacity(0.9)
                        }
                        Spacer()
                    }
                    .foregroundStyle(.white)
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 18).fill(AtelierRenderer.grassLight.gradient))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("atelier-nouvel-exercice")

                if userPlays.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(searchText.isEmpty ? "Aucun exercice pour l'instant" : "Aucun exercice trouvé")
                            .font(.headline)
                        Text("Partez de zéro, ou ouvrez la Bibliothèque et touchez « Copier dans mes exercices » pour en adapter un.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 8)
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 165), spacing: 12)], spacing: 12) {
                        ForEach(userPlays) { play in
                            exerciseCard(play)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func exerciseCard(_ play: TacticPlay) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                editing = AtelierEditRequest(play: play)
            } label: {
                AtelierDiagram(play: play, allowRotation: false)
                    .aspectRatio(1.15, contentMode: .fit)
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 14, topTrailingRadius: 14))
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 3) {
                Text(play.title)
                    .font(.subheadline.bold())
                    .lineLimit(2)
                Text(cardSummary(play))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Button {
                        editing = AtelierEditRequest(play: play)
                    } label: {
                        Text("Modifier")
                            .font(.caption.bold())
                            .fixedSize()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    Button {
                        playerRequest = AtelierPlayRequest(play: play, cinema: true)
                    } label: {
                        Image(systemName: "play.fill")
                            .font(.caption.bold())
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(.purple)
                    .accessibilityLabel("Cinéma")
                    Spacer(minLength: 0)
                    Menu {
                        exerciseMenu(play)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.body)
                            .frame(width: 30, height: 28)
                    }
                    .accessibilityLabel("Plus d'actions")
                }
                .padding(.top, 4)
            }
            .padding(10)
        }
        .background(RoundedRectangle(cornerRadius: 14).fill(Color(.secondarySystemGroupedBackground)))
        .contextMenu { exerciseMenu(play) }
    }

    @ViewBuilder
    private func exerciseMenu(_ play: TacticPlay) -> some View {
        Button {
            playerRequest = AtelierPlayRequest(play: play, cinema: false)
        } label: {
            Label("Voir en 3D", systemImage: "cube.transparent")
        }
        Button {
            let copy = store.duplicate(play)
            store.save(copy)
            editing = AtelierEditRequest(play: copy)
        } label: {
            Label("Dupliquer", systemImage: "plus.square.on.square")
        }
        Button {
            if let url = try? AtelierPDF.exerciseSheet(play) { shareFile = TacticShareFile(url: url) }
        } label: {
            Label("Fiche à imprimer (PDF)", systemImage: "printer")
        }
        Button {
            share([play])
        } label: {
            Label("Envoyer (.tdjt)", systemImage: "square.and.arrow.up")
        }
        Button(role: .destructive) {
            playToDelete = play
        } label: {
            Label("Supprimer", systemImage: "trash")
        }
    }

    private func cardSummary(_ play: TacticPlay) -> String {
        var parts: [String] = []
        let players = play.actors.count
        if players > 0 { parts.append("\(players) joueur\(players > 1 ? "s" : "")") }
        parts.append("\(play.steps.count) étape\(play.steps.count > 1 ? "s" : "")")
        let evolutions = play.evolutionList.count
        if evolutions > 0 { parts.append("\(evolutions) évol.") }
        return parts.joined(separator: " · ")
    }

    // MARK: - Séances

    private var plansTab: some View {
        List {
            Section {
                Button {
                    let date = Date().formatted(.dateTime.day().month(.wide).locale(Locale(identifier: "fr_FR")))
                    let plan = TrainingPlan(title: "Séance du \(date)", date: nil)
                    store.savePlan(plan)
                    path.append(.plan(plan.id))
                } label: {
                    Label("Nouvelle séance", systemImage: "calendar.badge.plus")
                        .font(.headline)
                }
                .accessibilityIdentifier("atelier-nouvelle-seance")
            } footer: {
                Text("Enchaînez vos exercices, minutez-les : la liste du matériel se fait toute seule, et les équipes se composent avec les joueurs présents.")
            }

            if !store.plans.isEmpty {
                Section("Mes séances") {
                    ForEach(store.plans) { plan in
                        NavigationLink(value: AtelierHomeRoute.plan(plan.id)) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(plan.title)
                                    .font(.subheadline.bold())
                                Text(planSummary(plan))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 2)
                        }
                        .accessibilityIdentifier("seance-ligne")
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                planToDelete = plan
                            } label: {
                                Label("Supprimer", systemImage: "trash")
                            }
                        }
                        .contextMenu {
                            Button(role: .destructive) {
                                planToDelete = plan
                            } label: {
                                Label("Supprimer", systemImage: "trash")
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func planSummary(_ plan: TrainingPlan) -> String {
        var parts: [String] = []
        if let date = plan.date {
            parts.append(date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(Locale(identifier: "fr_FR"))))
        }
        parts.append("\(plan.items.count) exercice\(plan.items.count > 1 ? "s" : "")")
        parts.append("\(plan.totalMinutes) min")
        return parts.joined(separator: " · ")
    }

    // MARK: - Bibliothèque

    private var libraryTab: some View {
        List {
            Section {
                LibraryHeader()
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            ForEach(groupedLibrary, id: \.0) { category, plays in
                Section {
                    ForEach(plays) { play in
                        libraryRow(play)
                            .swipeActions(edge: .trailing) {
                                Button {
                                    copyToMine(play)
                                } label: {
                                    Label("Copier", systemImage: "plus.square.on.square")
                                }
                                .tint(.green)
                            }
                    }
                } header: {
                    Label(category.displayName, systemImage: category.icon)
                }
            }
            if groupedLibrary.isEmpty {
                ContentUnavailableView.search(text: searchText)
            }
        }
        .listStyle(.insetGrouped)
    }

    private func copyToMine(_ play: TacticPlay) {
        let copy = store.duplicate(play)
        store.save(copy)
        editing = AtelierEditRequest(play: copy)
    }

    private func libraryRow(_ play: TacticPlay) -> some View {
        Button {
            playerRequest = AtelierPlayRequest(play: play, cinema: false)
        } label: {
            HStack(spacing: 12) {
                AtelierDiagram(play: play, allowRotation: false)
                    .frame(width: 58, height: 58)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 3) {
                    Text(play.title)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                    Text(play.summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !play.objective.isEmpty {
                        Text(play.objective)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: 4)
                Image(systemName: "play.circle.fill")
                    .font(.title2)
                    .foregroundStyle(play.category.tint)
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                playerRequest = AtelierPlayRequest(play: play, cinema: true)
            } label: {
                Label("Cinéma", systemImage: "film.stack")
            }
            Button {
                copyToMine(play)
            } label: {
                Label("Copier dans mes exercices", systemImage: "plus.square.on.square")
            }
            Button {
                share([play])
            } label: {
                Label("Partager (.tdjt)", systemImage: "square.and.arrow.up")
            }
        }
    }

    // MARK: - Import / export

    private func share(_ plays: [TacticPlay]) {
        guard !plays.isEmpty else { return }
        do {
            shareFile = TacticShareFile(url: try store.exportURL(for: plays))
        } catch {
            alertMessage = "Export impossible : \(error.localizedDescription)"
        }
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            var total = 0
            var failures: [String] = []
            for url in urls {
                do {
                    total += try store.importFile(at: url)
                } catch {
                    failures.append(url.lastPathComponent)
                }
            }
            if failures.isEmpty {
                alertMessage = total == 0
                    ? "Aucun nouvel exercice dans ce fichier."
                    : "\(total) exercice\(total > 1 ? "s importés" : " importé") dans « Mes exercices »."
            } else {
                alertMessage = "\(total) importé(s). Fichier(s) illisible(s) : \(failures.joined(separator: ", "))."
            }
            tab = .exercices
        case .failure(let error):
            alertMessage = "Import impossible : \(error.localizedDescription)"
        }
    }
}

/// Ouverture de l'éditeur de l'Atelier
struct AtelierEditRequest: Identifiable {
    let id = UUID()
    let play: TacticPlay
}

/// Ouverture du lecteur 3D (normal ou cinéma)
struct AtelierPlayRequest: Identifiable {
    let id = UUID()
    let play: TacticPlay
    let cinema: Bool
}

// MARK: - En-tête de la bibliothèque

private struct LibraryHeader: View {
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "books.vertical.fill")
                .font(.system(size: 26))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.green.gradient))
            VStack(alignment: .leading, spacing: 4) {
                Text("Exercices prêts à l'emploi")
                    .font(.headline)
                Text("Touchez pour les voir en 3D. « Copier » les place dans vos exercices pour les adapter.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemGroupedBackground)))
        .padding(.vertical, 4)
    }
}

// MARK: - Couleur par catégorie

extension TacticCategory {
    var tint: Color {
        switch self {
        case .conservation: return .teal
        case .construction: return .blue
        case .attaque: return .orange
        case .finition: return .red
        case .pressing: return .pink
        case .defense: return .indigo
        case .transition: return .purple
        case .cpa: return .green
        case .perso: return .brown
        case .autre: return .gray
        }
    }
}
