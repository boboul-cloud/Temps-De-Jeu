//
//  AtelierPages.swift
//  Temps De Jeu
//
//  Atelier : pages poussées depuis l'éditeur (fiche de l'exercice,
//  consigne d'une étape, évolution). Poussées dans la pile de navigation
//  plutôt qu'en feuille : sur Mac, une feuille ne défile pas au trackpad.
//

import SwiftUI

// MARK: - Fiche de l'exercice

struct AtelierFichePage: View {
    @ObservedObject var model: AtelierEditorModel

    @State private var title = ""
    @State private var category: TacticCategory = .perso
    @State private var level = ""
    @State private var duration = ""
    @State private var objective = ""
    @State private var instructions = ""
    @State private var loaded = false
    @State private var shareFile: TacticShareFile?
    @State private var pdfFile: TacticShareFile?

    var body: some View {
        Form {
            Section("Exercice") {
                TextField("Nom de l'exercice", text: $title)
                Picker("Thème", selection: $category) {
                    ForEach(TacticCategory.allCases.filter { $0 != .autre }) { category in
                        Label(category.displayName, systemImage: category.icon).tag(category)
                    }
                }
                TextField("Catégorie d'âge (U9, U13, Seniors…)", text: $level)
                TextField("Durée (15 min…)", text: $duration)
            }

            Section {
                TextField("Ce que les joueurs vont travailler", text: $objective, axis: .vertical)
                    .lineLimit(2...6)
            } header: {
                Text("Objectif")
            }

            Section {
                TextField("Une consigne par ligne", text: $instructions, axis: .vertical)
                    .lineLimit(3...10)
            } header: {
                Text("Consignes de coaching")
            } footer: {
                Text("Exemple : « Orienter son contrôle », « Communiquer avant de recevoir ».")
            }

            Section("Effectif") {
                Text(AtelierEditorModel.headcount(model.play.actors) ?? "Aucun joueur pour l'instant")
                    .foregroundStyle(model.play.actors.isEmpty ? .secondary : .primary)
                if !model.play.evolutionList.isEmpty {
                    Text("\(model.play.evolutionList.count) évolution\(model.play.evolutionList.count > 1 ? "s" : "")")
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                let lines = model.finalized().equipmentLines
                if lines.isEmpty {
                    Text("Rien pour l'instant : posez du matériel sur le terrain.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(lines) { line in
                        EquipmentRow(line: line)
                    }
                }
            } header: {
                Text("Matériel à prévoir")
            } footer: {
                Text("Calculé à partir du terrain, évolutions comprises. Le gardien garde son maillot.")
            }

            Section {
                Button {
                    commit()
                    if let url = try? AtelierPDF.exerciseSheet(model.finalized()) {
                        pdfFile = TacticShareFile(url: url)
                    }
                } label: {
                    Label("Fiche à imprimer (PDF)", systemImage: "printer")
                }
                Button {
                    commit()
                    if let url = try? TacticStore.shared.exportURL(for: [model.finalized()]) {
                        shareFile = TacticShareFile(url: url)
                    }
                } label: {
                    Label("Envoyer l'exercice (fichier .tdjt)", systemImage: "square.and.arrow.up")
                }
            } footer: {
                Text("Le fichier .tdjt s'ouvre dans Temps de Jeu sur un autre iPhone, iPad ou Mac.")
            }
        }
        .navigationTitle("Fiche")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .onAppear(perform: load)
        .onDisappear(perform: commit)
        .sheet(item: $shareFile) { file in
            ActivityView(activityItems: [file.url])
        }
        .sheet(item: $pdfFile) { file in
            ActivityView(activityItems: [file.url])
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        let play = model.play
        title = play.title
        category = play.category == .autre ? .perso : play.category
        level = play.level ?? ""
        duration = play.duration ?? ""
        objective = play.objective
        instructions = play.instructions.joined(separator: "\n")
    }

    private func commit() {
        let play = model.play
        let newInstructions = instructions.split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        let cleanTitle = title.trimmingCharacters(in: .whitespaces)
        let changed = (cleanTitle.isEmpty ? play.title : cleanTitle) != play.title
            || category != play.category
            || level != (play.level ?? "")
            || duration != (play.duration ?? "")
            || objective != play.objective
            || newInstructions != play.instructions
        guard changed else { return }
        model.updateInfo { p in
            if !cleanTitle.isEmpty { p.title = cleanTitle }
            p.category = category
            p.level = level.isEmpty ? nil : level
            p.duration = duration.isEmpty ? nil : duration
            p.objective = objective
            p.instructions = newInstructions
        }
    }
}

/// Une ligne de matériel avec sa pastille de couleur
struct EquipmentRow: View {
    let line: EquipmentLine

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                if case .bib = line.item {
                    Image(systemName: "tshirt.fill")
                        .foregroundStyle(line.color?.color ?? .gray)
                        .shadow(color: .black.opacity(0.3), radius: 0.5)
                } else {
                    Circle()
                        .fill(line.color?.color ?? Color.white)
                        .overlay(Circle().strokeBorder(Color.black.opacity(0.25), lineWidth: 1))
                        .frame(width: 14, height: 14)
                }
            }
            .frame(width: 24)
            Text(line.text)
        }
    }
}

// MARK: - Étape

struct AtelierStepPage: View {
    @ObservedObject var model: AtelierEditorModel
    let index: Int

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var text = ""
    @State private var duration = TacticStep.defaultDuration
    @State private var loaded = false
    @State private var deleted = false

    var body: some View {
        Form {
            Section {
                TextField(index == 0 ? "Mise en place" : "Titre (ex. : « Passe en retrait »)", text: $title)
                TextField("Ce que font les joueurs à ce moment", text: $text, axis: .vertical)
                    .lineLimit(2...8)
            } header: {
                Text(index == 0 ? "Mise en place" : "Étape \(index)")
            } footer: {
                Text("La consigne s'affiche en sous-titre dans le mode cinéma.")
            }
            if index > 0 {
                Section("Animation") {
                    Stepper(value: $duration, in: 0.5...8, step: 0.5) {
                        LabeledContent("Durée du mouvement",
                                       value: "\(duration.formatted(.number.precision(.fractionLength(0...1)))) s")
                    }
                }
                Section {
                    Button(role: .destructive) {
                        deleted = true
                        model.deleteVignette(index)
                        dismiss()
                    } label: {
                        Label("Supprimer cette étape", systemImage: "trash")
                    }
                }
            }
        }
        .navigationTitle(index == 0 ? "Mise en place" : "Étape \(index)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .onAppear {
            guard !loaded, let step = model.content.steps[safe: index] else { return }
            loaded = true
            title = step.title
            text = step.text
            duration = step.duration ?? TacticStep.defaultDuration
        }
        .onDisappear {
            guard !deleted, let step = model.content.steps[safe: index] else { return }
            let newDuration: Double? = index > 0 && duration != (step.duration ?? TacticStep.defaultDuration) ? duration : nil
            if title != step.title || text != step.text || newDuration != nil {
                model.updateStep(index, title: title, text: text, duration: newDuration)
            }
        }
    }
}

// MARK: - Évolution

struct AtelierEvolutionPage: View {
    @ObservedObject var model: AtelierEditorModel
    let index: Int

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var text = ""
    @State private var loaded = false
    @State private var deleted = false

    var body: some View {
        Form {
            Section {
                TextField("Nom (ex. : « 2 touches maximum »)", text: $title)
                TextField("Ce qui change par rapport à l'exercice de base", text: $text, axis: .vertical)
                    .lineLimit(2...8)
            } header: {
                Text("Évolution")
            } footer: {
                Text("Une évolution part du même terrain : ajoutez un défenseur, réduisez l'espace, changez la consigne…")
            }
            Section {
                Button(role: .destructive) {
                    deleted = true
                    model.deleteEvolution(index)
                    dismiss()
                } label: {
                    Label("Supprimer cette évolution", systemImage: "trash")
                }
            }
        }
        .navigationTitle(title.isEmpty ? "Évolution" : title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .onAppear {
            guard !loaded, let evo = model.play.evolutions?[safe: index] else { return }
            loaded = true
            title = evo.title
            text = evo.text
        }
        .onDisappear {
            guard !deleted, let evo = model.play.evolutions?[safe: index] else { return }
            if title != evo.title || text != evo.text {
                model.renameEvolution(index, title: title, text: text)
            }
        }
    }
}
