//
//  AtelierPlanView.swift
//  Temps De Jeu
//
//  Atelier : une séance = des exercices minutés dans l'ordre, le matériel
//  total à prévoir, les équipes (chasubles) composées avec les présents
//  du jour, et la fiche PDF à imprimer.
//

import SwiftUI

struct AtelierPlanView: View {
    let planId: UUID
    var palette = Pitch3DPalette()

    @ObservedObject private var store = TacticStore.shared
    @State private var plan = TrainingPlan(title: "")
    @State private var loaded = false
    @State private var hasDate = false
    @State private var showPicker = false
    @State private var showTeams = false
    @State private var playerRequest: AtelierPlayRequest?
    @State private var editing: AtelierEditRequest?
    @State private var shareFile: TacticShareFile?
    @State private var editMode: EditMode = .inactive
    @State private var confirmDelete = false
    @Environment(\.dismiss) private var dismiss

    private var exercises: [(TrainingPlan.Item, TacticPlay)] {
        plan.items.compactMap { item in store.tactic(item.tacticId).map { (item, $0) } }
    }

    private var missingCount: Int { plan.items.count - exercises.count }

    var body: some View {
        List {
            Section {
                TextField("Nom de la séance", text: $plan.title)
                Toggle("Date et heure", isOn: $hasDate.animation())
                if hasDate {
                    DatePicker("Le", selection: Binding(get: { plan.date ?? Date() }, set: { plan.date = $0 }))
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                }
                TextField("Thème (ex. : jeu vers l'avant)", text: $plan.notes, axis: .vertical)
                    .lineLimit(1...4)
            } header: {
                Text("Séance")
            } footer: {
                Label("Enregistrée au fur et à mesure, dans « Séances ».", systemImage: "checkmark.circle")
                    .foregroundStyle(.green)
            }

            programSection
            equipmentSection
            teamsSection

            Section {
                Button {
                    if let url = try? AtelierPDF.sessionSheet(plan, exercises: exercises) {
                        shareFile = TacticShareFile(url: url)
                    }
                } label: {
                    Label("Fiche de séance à imprimer (PDF)", systemImage: "printer")
                }
                .disabled(exercises.isEmpty)
            } footer: {
                Text("Une page de garde (programme, matériel, équipes) puis une page par exercice avec son schéma.")
            }

            Section {
                Button(role: .destructive) {
                    confirmDelete = true
                } label: {
                    Label("Supprimer la séance", systemImage: "trash")
                        .foregroundStyle(.red)
                }
                .accessibilityIdentifier("seance-supprimer")
            } footer: {
                Text("Les exercices restent dans « Mes exercices ».")
            }
        }
        .listStyle(.insetGrouped)
        .confirmationDialog("Supprimer cette séance ?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Supprimer", role: .destructive) {
                loaded = false   // plus d'enregistrement automatique
                store.deletePlan(plan)
                dismiss()
            }
        } message: {
            Text(plan.title)
        }
        .navigationTitle(plan.title.isEmpty ? "Séance" : plan.title)
        .navigationBarTitleDisplayMode(.inline)
        .environment(\.editMode, $editMode)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if plan.items.count > 1 || editMode == .active {
                    Button(editMode == .active ? "OK" : "Réordonner") {
                        withAnimation { editMode = editMode == .active ? .inactive : .active }
                    }
                }
            }
        }
        .navigationDestination(isPresented: $showPicker) {
            AtelierExercisePicker { play in
                plan.items.append(TrainingPlan.Item(tacticId: play.id, minutes: Self.defaultMinutes(play)))
                showPicker = false
            }
        }
        .navigationDestination(isPresented: $showTeams) {
            AtelierTeamsPage(plan: $plan, exercises: exercises.map(\.1))
        }
        .fullScreenCover(item: $playerRequest) { request in
            TacticPlayerView(play: request.play, palette: palette, cinema: request.cinema)
        }
        .fullScreenCover(item: $editing) { request in
            AtelierEditorView(play: request.play) { store.save($0) }
        }
        .sheet(item: $shareFile) { file in
            ActivityView(activityItems: [file.url])
        }
        .onAppear {
            guard !loaded, let stored = store.plans.first(where: { $0.id == planId }) else { return }
            plan = stored
            hasDate = stored.date != nil
            loaded = true
        }
        .onChange(of: plan) {
            guard loaded else { return }
            store.savePlan(plan)
        }
        .onChange(of: hasDate) {
            guard loaded else { return }
            plan.date = hasDate ? (plan.date ?? Date()) : nil
        }
    }

    static func defaultMinutes(_ play: TacticPlay) -> Int {
        let digits = (play.duration ?? "").prefix { $0.isNumber }
        if let value = Int(digits), value > 0 { return min(90, value) }
        return 15
    }

    // MARK: - Programme

    private var programSection: some View {
        Section {
            ForEach($plan.items) { $item in
                if let play = store.tactic(item.tacticId) {
                    programRow(play: play, item: $item)
                } else {
                    Label("Exercice supprimé", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.secondary)
                }
            }
            .onMove { plan.items.move(fromOffsets: $0, toOffset: $1) }
            .onDelete { plan.items.remove(atOffsets: $0) }

            Button {
                showPicker = true
            } label: {
                Label("Ajouter un exercice", systemImage: "plus.circle.fill")
                    .font(.subheadline.bold())
            }
            .accessibilityIdentifier("seance-ajout-exercice")
        } header: {
            HStack {
                Text("Programme")
                Spacer()
                Text("\(plan.totalMinutes) min")
                    .font(.subheadline.monospacedDigit().bold())
                    .foregroundStyle(.primary)
            }
        } footer: {
            if missingCount > 0 {
                Text("\(missingCount) exercice(s) supprimé(s) de l'Atelier : balayez pour les retirer.")
            } else if !plan.items.isEmpty {
                Text("Touchez le schéma pour le mode cinéma. Maintenez une ligne pour la déplacer.")
            }
        }
    }

    private func programRow(play: TacticPlay, item: Binding<TrainingPlan.Item>) -> some View {
        let index = plan.items.firstIndex(where: { $0.id == item.wrappedValue.id }) ?? 0
        let start = plan.items.prefix(index).reduce(0) { $0 + $1.minutes }
        return HStack(spacing: 12) {
            Button {
                playerRequest = AtelierPlayRequest(play: play, cinema: true)
            } label: {
                AtelierDiagram(play: play, allowRotation: false)
                    .frame(width: 60, height: 60)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(alignment: .bottomTrailing) {
                        Image(systemName: "play.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(.white, .purple)
                            .padding(3)
                    }
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 4) {
                Text("\(index + 1). \(play.title)")
                    .font(.subheadline.bold())
                    .lineLimit(2)
                Text("\(start)′ → \(start + item.wrappedValue.minutes)′")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                Stepper(value: item.minutes, in: 5...90, step: 5) {
                    Text("\(item.wrappedValue.minutes) min")
                        .font(.subheadline.monospacedDigit())
                }
                TextField("Note (facultatif)", text: item.note)
                    .font(.caption)
            }
        }
        .padding(.vertical, 4)
        .contextMenu {
            Button {
                playerRequest = AtelierPlayRequest(play: play, cinema: true)
            } label: {
                Label("Cinéma", systemImage: "film.stack")
            }
            if play.isUserCreated {
                Button {
                    editing = AtelierEditRequest(play: play)
                } label: {
                    Label("Modifier l'exercice", systemImage: "pencil")
                }
            }
            Button(role: .destructive) {
                plan.items.removeAll { $0.id == item.wrappedValue.id }
            } label: {
                Label("Retirer de la séance", systemImage: "minus.circle")
            }
        }
    }

    // MARK: - Matériel

    private var equipmentSection: some View {
        Section {
            Toggle(isOn: $plan.simultaneous) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Ateliers montés en même temps")
                    Text(plan.simultaneous ? "Le matériel de chaque exercice s'additionne."
                                           : "Le matériel sert d'un exercice à l'autre.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            let lines = plan.equipment(exercises.map(\.1))
            if lines.isEmpty {
                Text("Ajoutez des exercices : la liste se fera toute seule.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(lines) { EquipmentRow(line: $0) }
            }
        } header: {
            Text("Matériel à prévoir")
        }
    }

    // MARK: - Équipes

    private var teamsSection: some View {
        Section {
            if plan.teams.isEmpty {
                Button {
                    showTeams = true
                } label: {
                    Label("Faire les équipes avec les présents", systemImage: "person.3.sequence.fill")
                }
            } else {
                ForEach(plan.teams) { team in
                    TeamRow(team: team)
                }
                Button {
                    showTeams = true
                } label: {
                    Label("Modifier les équipes", systemImage: "arrow.triangle.2.circlepath")
                }
                ShareLink(item: TeamBuilder.shareText(plan.teams, title: plan.title)) {
                    Label("Envoyer les équipes aux joueurs", systemImage: "square.and.arrow.up")
                }
            }
        } header: {
            Text("Équipes")
        } footer: {
            Text("Les joueurs pointés présents (onglet Présences) sont répartis par chasuble, un gardien et des postes équilibrés dans chaque équipe.")
        }
    }
}

/// Une équipe : pastille de chasuble et joueurs
struct TeamRow: View {
    let team: TrainingPlan.Team

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "tshirt.fill")
                .foregroundStyle(team.color.color)
                .shadow(color: .black.opacity(0.35), radius: 0.5)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text("Chasubles \(team.color.adjective(feminine: true, plural: true)) · \(team.players.count)")
                    .font(.subheadline.bold())
                Text(team.players.isEmpty ? "—" : team.players.joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Choisir un exercice

struct AtelierExercisePicker: View {
    let onPick: (TacticPlay) -> Void
    @ObservedObject private var store = TacticStore.shared
    @State private var search = ""

    private func filtered(_ plays: [TacticPlay]) -> [TacticPlay] {
        let q = search.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return plays }
        return plays.filter { "\($0.title) \($0.objective)".localizedStandardContains(q) }
    }

    var body: some View {
        List {
            let mine = filtered(store.userTactics)
            if !mine.isEmpty {
                Section("Mes exercices") {
                    ForEach(mine) { row($0) }
                }
            }
            let library = filtered(store.libraryTactics)
            if !library.isEmpty {
                Section("Bibliothèque") {
                    ForEach(library) { row($0) }
                }
            }
        }
        .listStyle(.insetGrouped)
        .searchable(text: $search, prompt: "Rechercher")
        .navigationTitle("Ajouter un exercice")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ play: TacticPlay) -> some View {
        Button {
            onPick(play)
        } label: {
            HStack(spacing: 12) {
                AtelierDiagram(play: play, allowRotation: false)
                    .frame(width: 50, height: 50)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 2) {
                    Text(play.title)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                    Text(play.summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(Color.accentColor)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Faire les équipes

struct AtelierTeamsPage: View {
    @Binding var plan: TrainingPlan
    let exercises: [TacticPlay]

    enum Source: Hashable {
        case session(UUID)
        case roster
    }

    @State private var sessions: [TrainingSession] = []
    @State private var players: [Player] = []
    @State private var source: Source = .roster
    @State private var colors: [AtelierColor] = []
    @State private var loaded = false

    private var candidates: [TeamBuilder.Candidate] {
        let byId = Dictionary(players.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        switch source {
        case .session(let id):
            guard let session = sessions.first(where: { $0.id == id }) else { return [] }
            return session.attendances.filter(\.isPresent).map { attendance in
                let player = byId[attendance.id]
                return TeamBuilder.Candidate(name: player?.displayName ?? attendance.displayName,
                                             position: player?.position ?? .milieu)
            }
        case .roster:
            return players.filter { $0.availability == .disponible }
                .map { TeamBuilder.Candidate(name: $0.displayName, position: $0.position) }
        }
    }

    var body: some View {
        List {
            Section {
                Picker("Joueurs", selection: $source) {
                    ForEach(sessions.prefix(10)) { session in
                        Text("Présents le \(session.date.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "fr_FR")))) (\(session.presentCount))")
                            .tag(Source.session(session.id))
                    }
                    Text("Tout l'effectif disponible (\(players.filter { $0.availability == .disponible }.count))")
                        .tag(Source.roster)
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text("Avec qui ?")
            } footer: {
                if sessions.isEmpty {
                    Text("Pointez les présents dans l'onglet Présences pour composer les équipes avec eux.")
                }
            }

            Section("Couleurs des chasubles") {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(AtelierColor.allCases) { color in
                            let on = colors.contains(color)
                            Button {
                                if on { colors.removeAll { $0 == color } } else { colors.append(color) }
                            } label: {
                                VStack(spacing: 3) {
                                    Image(systemName: "tshirt.fill")
                                        .font(.title2)
                                        .foregroundStyle(color.color)
                                        .shadow(color: .black.opacity(0.35), radius: 0.5)
                                    Text(color.displayName)
                                        .font(.caption2.bold())
                                }
                                .frame(width: 58, height: 54)
                                .background(RoundedRectangle(cornerRadius: 10)
                                    .strokeBorder(on ? Color.accentColor : Color.secondary.opacity(0.3), lineWidth: on ? 3 : 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
                Text("\(colors.count) équipe\(colors.count > 1 ? "s" : "") · \(candidates.count) joueur\(candidates.count > 1 ? "s" : "")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section {
                Button {
                    plan.teams = TeamBuilder.make(candidates, colors: colors)
                } label: {
                    Label(plan.teams.isEmpty ? "Composer les équipes" : "Refaire le tirage", systemImage: "shuffle")
                        .font(.headline)
                }
                .disabled(colors.count < 2 || candidates.isEmpty)
                .accessibilityIdentifier("equipes-composer")
            }

            if !plan.teams.isEmpty {
                Section("Équipes") {
                    ForEach(plan.teams) { TeamRow(team: $0) }
                    ShareLink(item: TeamBuilder.shareText(plan.teams, title: plan.title)) {
                        Label("Envoyer aux joueurs", systemImage: "square.and.arrow.up")
                    }
                    Button(role: .destructive) {
                        plan.teams = []
                    } label: {
                        Label("Effacer les équipes", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Équipes")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !loaded else { return }
            loaded = true
            players = TeamManager.shared.loadPlayers()
            sessions = TrainingManager.shared.loadSessions().sorted { $0.date > $1.date }
            if let latest = sessions.first, latest.presentCount > 0 { source = .session(latest.id) }
            let used = plan.teams.map(\.color)
            colors = !used.isEmpty ? used : {
                let fromExercises = TrainingPlan.bibColors(exercises)
                return fromExercises.count >= 2 ? fromExercises : [.rouge, .bleu]
            }()
        }
    }
}
