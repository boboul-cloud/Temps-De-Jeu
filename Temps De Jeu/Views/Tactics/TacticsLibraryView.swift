//
//  TacticsLibraryView.swift
//  Temps De Jeu
//
//  Bibliothèque des tactiques d'entraînement (intégrées + perso),
//  import / export de fichiers .tdjt.
//

import SwiftUI
import UniformTypeIdentifiers

struct TacticsLibraryView: View {
    var palette = Pitch3DPalette()
    var roster: [MatchPlayer] = []

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var store = TacticStore.shared
    @State private var searchText = ""
    @State private var selectedPlay: TacticPlay?
    @State private var showImporter = false
    @State private var shareFile: TacticShareFile?
    @State private var alertMessage: String?
    @State private var playToDelete: TacticPlay?
    @State private var editorRequest: SequenceEditorRequest?

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
        NavigationStack {
            List {
                Section {
                    LibraryHeader()
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    Button {
                        editorRequest = SequenceEditorRequest(play: nil)
                    } label: {
                        Label("Créer une séquence d'entraînement", systemImage: "plus.rectangle.on.rectangle")
                            .font(.subheadline.bold())
                    }
                }

                if !userPlays.isEmpty {
                    Section {
                        ForEach(userPlays) { play in
                            row(play)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        playToDelete = play
                                    } label: {
                                        Label("Supprimer", systemImage: "trash")
                                    }
                                    Button {
                                        editorRequest = SequenceEditorRequest(play: play)
                                    } label: {
                                        Label("Modifier", systemImage: "pencil")
                                    }
                                    .tint(.purple)
                                    Button {
                                        share([play])
                                    } label: {
                                        Label("Partager", systemImage: "square.and.arrow.up")
                                    }
                                    .tint(.blue)
                                }
                        }
                    } header: {
                        Label("Mes séquences", systemImage: TacticCategory.perso.icon)
                    } footer: {
                        Text("Créées ici, depuis Placement › Séquence, ou importées d'un fichier .tdjt. Balayez pour modifier.")
                    }
                }

                ForEach(groupedLibrary, id: \.0) { category, plays in
                    Section {
                        ForEach(plays) { play in
                            row(play)
                                .swipeActions(edge: .trailing) {
                                    Button {
                                        share([play])
                                    } label: {
                                        Label("Partager", systemImage: "square.and.arrow.up")
                                    }
                                    .tint(.blue)
                                }
                        }
                    } header: {
                        Label(category.displayName, systemImage: category.icon)
                    }
                }

                if userPlays.isEmpty && groupedLibrary.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $searchText, prompt: "Rechercher un exercice")
            .navigationTitle("Tactiques 3D")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        editorRequest = SequenceEditorRequest(play: nil)
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Créer une séquence")
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            showImporter = true
                        } label: {
                            Label("Importer un fichier .tdjt", systemImage: "square.and.arrow.down")
                        }
                        Button {
                            share(store.libraryTactics)
                        } label: {
                            Label("Exporter la bibliothèque", systemImage: "books.vertical")
                        }
                        if !store.userTactics.isEmpty {
                            Button {
                                share(store.userTactics)
                            } label: {
                                Label("Exporter mes séquences", systemImage: "square.and.arrow.up")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Importer / exporter")
                }
            }
            .fileImporter(isPresented: $showImporter,
                          allowedContentTypes: [.tdjTactic, .json],
                          allowsMultipleSelection: true) { result in
                handleImport(result)
            }
            .fullScreenCover(item: $selectedPlay) { play in
                TacticPlayerView(play: play, palette: palette, roster: roster)
            }
            .sheet(item: $shareFile) { file in
                ActivityView(activityItems: [file.url])
            }
            .sheet(item: $editorRequest) { request in
                FormationView(roster: [], jerseyColor: palette.team, opponentJerseyColor: palette.opponent,
                              savedFormation: nil, trainingMode: true, initialPlay: request.play)
                    .largeSheetSizing()
            }
            .alert("Tactiques", isPresented: Binding(get: { alertMessage != nil }, set: { if !$0 { alertMessage = nil } })) {
                Button("OK") { alertMessage = nil }
            } message: {
                Text(alertMessage ?? "")
            }
            .confirmationDialog("Supprimer cette séquence ?",
                                isPresented: Binding(get: { playToDelete != nil }, set: { if !$0 { playToDelete = nil } }),
                                titleVisibility: .visible) {
                Button("Supprimer", role: .destructive) {
                    if let playToDelete { store.delete(playToDelete) }
                    playToDelete = nil
                }
            } message: {
                Text(playToDelete?.title ?? "")
            }
        }
    }

    private func row(_ play: TacticPlay) -> some View {
        Button {
            selectedPlay = play
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(play.category.tint.gradient)
                        .frame(width: 44, height: 44)
                    Image(systemName: play.category.icon)
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(.white)
                }
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
                if let level = play.level {
                    Text(level)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.secondary.opacity(0.15)))
                        .foregroundStyle(.secondary)
                }
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
                selectedPlay = play
            } label: {
                Label("Voir en 3D", systemImage: "cube.transparent")
            }
            Button {
                share([play])
            } label: {
                Label("Partager (.tdjt)", systemImage: "square.and.arrow.up")
            }
            if play.isUserCreated {
                Button {
                    editorRequest = SequenceEditorRequest(play: play)
                } label: {
                    Label("Modifier la séquence", systemImage: "pencil")
                }
                Button(role: .destructive) {
                    playToDelete = play
                } label: {
                    Label("Supprimer", systemImage: "trash")
                }
            }
        }
    }

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
                    ? "Aucune nouvelle tactique dans ce fichier."
                    : "\(total) tactique\(total > 1 ? "s importées" : " importée") dans « Mes séquences »."
            } else {
                alertMessage = "\(total) importée(s). Fichier(s) illisible(s) : \(failures.joined(separator: ", "))."
            }
        case .failure(let error):
            alertMessage = "Import impossible : \(error.localizedDescription)"
        }
    }
}

/// Ouverture de l'éditeur : nouvelle séquence (play = nil) ou modification
struct SequenceEditorRequest: Identifiable {
    let id = UUID()
    let play: TacticPlay?
}

// MARK: - En-tête

private struct LibraryHeader: View {
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "cube.transparent.fill")
                .font(.system(size: 30))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.green.gradient))
            VStack(alignment: .leading, spacing: 4) {
                Text("Exercices animés en 3D")
                    .font(.headline)
                Text("Chaque situation se déroule étape par étape : flèches de course et de passe, joueurs clés en surbrillance, caméra libre.")
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
