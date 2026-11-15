//
//  TacticStore.swift
//  Temps De Jeu
//
//  Bibliothèque de tactiques : exercices livrés avec l'app
//  + séquences créées ou importées par l'utilisateur (fichiers .tdjt).
//

import Foundation
import Combine
import UniformTypeIdentifiers

extension UTType {
    /// Fichier tactique Temps De Jeu (.tdjt)
    static let tdjTactic = UTType(exportedAs: "com.tempsdejeu.tactic", conformingTo: .json)
}

@MainActor
final class TacticStore: ObservableObject {
    static let shared = TacticStore()

    /// Exercices livrés avec l'application (lecture seule)
    @Published private(set) var libraryTactics: [TacticPlay] = []
    /// Séquences créées depuis le Placement ou importées
    @Published private(set) var userTactics: [TacticPlay] = []

    static let libraryResourceName = "TactiquesEntrainement"

    private init() {
        loadLibrary()
        loadUserTactics()
    }

    var allTactics: [TacticPlay] { userTactics + libraryTactics }

    // MARK: - Bibliothèque intégrée

    func loadLibrary() {
        guard let url = Bundle.main.url(forResource: Self.libraryResourceName, withExtension: "json") else {
            print("[Tactiques] Bibliothèque introuvable dans le bundle")
            return
        }
        do {
            libraryTactics = try TacticFile.decode(from: Data(contentsOf: url)).map { play in
                var copy = play
                copy.isUserCreated = false
                return copy
            }
        } catch {
            print("[Tactiques] Erreur de lecture de la bibliothèque : \(error)")
        }
    }

    // MARK: - Tactiques utilisateur

    private var userFileURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let folder = base.appendingPathComponent("Tactiques", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("mes-tactiques.tdjt")
    }

    private func loadUserTactics() {
        guard let data = try? Data(contentsOf: userFileURL) else { return }
        do {
            userTactics = try TacticFile.decode(from: data)
        } catch {
            print("[Tactiques] Erreur de lecture des tactiques perso : \(error)")
        }
    }

    private func persist() {
        do {
            try TacticFile.encode(userTactics).write(to: userFileURL, options: .atomic)
        } catch {
            print("[Tactiques] Erreur d'enregistrement : \(error)")
        }
    }

    func save(_ play: TacticPlay) {
        var copy = play
        copy.isUserCreated = true
        if copy.createdAt == nil { copy.createdAt = Date() }
        if let index = userTactics.firstIndex(where: { $0.id == copy.id }) {
            userTactics[index] = copy
        } else {
            userTactics.insert(copy, at: 0)
        }
        persist()
    }

    /// Remplace toutes les séquences perso (restauration d'une sauvegarde complète)
    func replaceUserTactics(_ tactics: [TacticPlay]) {
        userTactics = tactics.map { play in
            var copy = play
            copy.isUserCreated = true
            return copy
        }
        persist()
    }

    func delete(_ play: TacticPlay) {
        userTactics.removeAll { $0.id == play.id }
        persist()
    }

    // MARK: - Import / export

    /// Importe un fichier .tdjt (une ou plusieurs tactiques). Retourne le nombre importé.
    @discardableResult
    func importData(_ data: Data) throws -> Int {
        let imported = try TacticFile.decode(from: data)
        var count = 0
        for play in imported where !play.steps.isEmpty && !play.actors.isEmpty {
            // Une tactique de la bibliothèque réimportée reste en lecture seule
            if libraryTactics.contains(where: { $0.id == play.id }) { continue }
            save(play)
            count += 1
        }
        return count
    }

    func importFile(at url: URL) throws -> Int {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        return try importData(Data(contentsOf: url))
    }

    /// Écrit un fichier .tdjt temporaire prêt à partager
    func exportURL(for plays: [TacticPlay]) throws -> URL {
        let name = plays.count == 1 ? plays[0].title : "Tactiques Temps De Jeu"
        let safe = name
            .components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>"))
            .joined(separator: "-")
            .trimmingCharacters(in: .whitespaces)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safe.isEmpty ? "Tactique" : safe).tdjt")
        try TacticFile.encode(plays).write(to: url, options: .atomic)
        return url
    }
}
