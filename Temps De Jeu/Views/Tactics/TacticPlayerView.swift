//
//  TacticPlayerView.swift
//  Temps De Jeu
//
//  Démonstration pas à pas d'une tactique en 3D :
//  étapes, lecture automatique, vitesse, flèches, caméras.
//

import SwiftUI

struct TacticPlayerView: View {
    let play: TacticPlay
    var palette: Pitch3DPalette
    var roster: [MatchPlayer]
    /// Renseigné pour une séquence pas encore enregistrée (depuis le Placement)
    var onSave: ((TacticPlay) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @StateObject private var scene3D = Pitch3DController()
    @State private var stepIndex = 0
    @State private var isPlaying = false
    @State private var speed: Double = 1.0
    @State private var showArrows = true
    @State private var showInfo = false
    @State private var useMyPlayers = false
    @State private var runToken = 0
    @State private var shareFile: TacticShareFile?
    @State private var didSetup = false
    @State private var saved = false

    private let frames: [TacticFrame]

    init(play: TacticPlay, palette: Pitch3DPalette = Pitch3DPalette(), roster: [MatchPlayer] = [],
         onSave: ((TacticPlay) -> Void)? = nil) {
        self.play = play
        self.palette = palette
        self.roster = roster
        self.onSave = onSave
        self.frames = play.resolvedFrames()
    }

    private var lastIndex: Int { max(0, frames.count - 1) }
    private var currentStep: TacticStep? { play.steps.indices.contains(stepIndex) ? play.steps[stepIndex] : nil }

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                let wide = geo.size.width > geo.size.height && geo.size.width > 640
                if wide {
                    HStack(spacing: 0) {
                        pitchArea
                        Divider()
                        controlPanel(wide: true)
                            .frame(width: min(400, geo.size.width * 0.36))
                    }
                } else {
                    VStack(spacing: 0) {
                        pitchArea
                        controlPanel(wide: false)
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(play.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        stopPlayback()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                            .font(.title3)
                    }
                    .accessibilityLabel("Fermer")
                }
                ToolbarItemGroup(placement: .primaryAction) {
                    if let onSave {
                        Button {
                            onSave(play)
                            saved = true
                        } label: {
                            Label(saved ? "Enregistrée" : "Enregistrer", systemImage: saved ? "checkmark.circle.fill" : "square.and.arrow.down")
                        }
                        .disabled(saved)
                    }
                    Button {
                        if let url = try? TacticStore.shared.exportURL(for: [play]) {
                            shareFile = TacticShareFile(url: url)
                        }
                    } label: {
                        Label("Partager", systemImage: "square.and.arrow.up")
                    }
                    Button {
                        showInfo = true
                    } label: {
                        Label("Fiche", systemImage: "info.circle")
                    }
                }
            }
        }
        .onAppear(perform: setup)
        .onDisappear(perform: stopPlayback)
        .onChange(of: showArrows) { refreshOverlays(animated: true) }
        .onChange(of: useMyPlayers) { configureActors() }
        .sheet(isPresented: $showInfo) {
            TacticInfoSheet(play: play)
        }
        .sheet(item: $shareFile) { file in
            ActivityView(activityItems: [file.url])
        }
    }

    // MARK: - Terrain

    private var pitchArea: some View {
        ZStack {
            Pitch3DView(controller: scene3D)

            VStack {
                HStack {
                    Spacer()
                    CameraPresetPicker(selected: scene3D.cameraPreset) { preset in
                        scene3D.applyCamera(preset, animated: true)
                    }
                }
                Spacer()
                if showArrows {
                    HStack {
                        ArrowLegend(compact: true)
                        Spacer()
                    }
                }
            }
            .padding(10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Panneau de contrôle

    private func controlPanel(wide: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Progression (touchable)
            HStack(spacing: 4) {
                ForEach(0..<frames.count, id: \.self) { i in
                    Capsule()
                        .fill(i <= stepIndex ? Color.accentColor : Color.secondary.opacity(0.25))
                        .frame(height: 6)
                        .contentShape(Rectangle().inset(by: -8))
                        .onTapGesture { jump(to: i) }
                }
            }

            HStack(alignment: .firstTextBaseline) {
                Text("Étape \(stepIndex + 1) / \(frames.count)")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Label(play.category.displayName, systemImage: play.category.icon)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Text(stepTitle)
                .font(.headline)

            ScrollView {
                Text(stepText)
                    .font(.subheadline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxHeight: wide ? .infinity : 84)

            playbackControls

            if !roster.isEmpty && play.actors.contains(where: { $0.team == .equipe }) {
                Toggle(isOn: $useMyPlayers) {
                    Label("Afficher mes joueurs", systemImage: "person.crop.circle.badge.checkmark")
                        .font(.subheadline)
                }
            }
        }
        .padding(16)
        .frame(maxHeight: wide ? .infinity : nil, alignment: .top)
        .background(.regularMaterial)
    }

    private var playbackControls: some View {
        HStack(spacing: 0) {
            controlButton("backward.end.fill", label: "Début", disabled: stepIndex == 0) { jump(to: 0) }
            controlButton("backward.fill", label: "Étape précédente", disabled: stepIndex == 0) { previous() }

            Button(action: togglePlay) {
                Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 46))
                    .symbolRenderingMode(.hierarchical)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.accentColor)
            .frame(maxWidth: .infinity)
            .accessibilityLabel(isPlaying ? "Pause" : "Lecture automatique")
            .keyboardShortcut(.space, modifiers: [])

            controlButton("forward.fill", label: "Étape suivante", disabled: stepIndex >= lastIndex) {
                stopAuto()
                goForward()
            }
            controlButton("arrow.counterclockwise", label: "Revoir l'étape", disabled: stepIndex == 0) { replayStep() }

            Menu {
                ForEach([0.5, 0.75, 1.0, 1.5, 2.0], id: \.self) { value in
                    Button {
                        speed = value
                    } label: {
                        if value == speed {
                            Label(speedLabel(value), systemImage: "checkmark")
                        } else {
                            Text(speedLabel(value))
                        }
                    }
                }
            } label: {
                Text(speedLabel(speed))
                    .font(.subheadline.monospacedDigit().bold())
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .accessibilityLabel("Vitesse")

            controlButton(showArrows ? "arrow.triangle.turn.up.right.diamond.fill" : "arrow.triangle.turn.up.right.diamond",
                          label: showArrows ? "Masquer les flèches" : "Afficher les flèches", disabled: false) {
                showArrows.toggle()
            }
        }
    }

    private func controlButton(_ icon: String, label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.title3)
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(disabled ? Color.secondary.opacity(0.4) : Color.primary)
        .disabled(disabled)
        .accessibilityLabel(label)
    }

    private func speedLabel(_ value: Double) -> String {
        value == floor(value) ? "\(Int(value))×" : "\(value.formatted(.number.precision(.fractionLength(0...2))))×"
    }

    private var stepTitle: String {
        guard let step = currentStep else { return play.title }
        if !step.title.isEmpty { return step.title }
        return stepIndex == 0 ? "Mise en place" : "Étape \(stepIndex + 1)"
    }

    private var stepText: String {
        guard let step = currentStep else { return "" }
        if !step.text.isEmpty { return step.text }
        if stepIndex == 0 && !play.objective.isEmpty { return play.objective }
        return stepIndex == 0 ? "Appuyez sur lecture pour démarrer la démonstration." : ""
    }

    // MARK: - Mise en place

    private func setup() {
        guard !didSetup, !frames.isEmpty else { return }
        didSetup = true
        scene3D.isEditable = false
        configureActors()
        let bounds = play.focusBounds()
        scene3D.setFocus(min: bounds.min, max: bounds.max)
        scene3D.setBallVisible(play.hasBall)
        scene3D.setFrame(frames[0])
        refreshOverlays(animated: false)
        scene3D.applyCamera(.coach, animated: false)
        #if DEBUG
        if Demo.screen == "tactique" { jump(to: Demo.tacticStep) }
        #endif
    }

    private func configureActors() {
        let overrides = useMyPlayers ? rosterOverrides() : [:]
        let showNames = useMyPlayers || play.category == .perso
        let actors = play.actors.map { actor -> Pitch3DActor in
            let override = overrides[actor.id]
            return Pitch3DActor(
                id: actor.id,
                team: actor.team,
                label: override?.label ?? actor.label,
                name: showNames ? (override?.name ?? actor.name) : nil,
                isGoalkeeper: actor.isGoalkeeper
            )
        }
        scene3D.configure(actors: actors, props: play.props, palette: palette)
    }

    /// Associe les joueurs de « mon équipe » aux titulaires du match (par poste)
    private func rosterOverrides() -> [String: (label: String, name: String)] {
        let starters = roster.filter { $0.status == .titulaire }
        var available = (starters.isEmpty ? roster : starters).sorted { $0.shirtNumber < $1.shirtNumber }
        var result: [String: (label: String, name: String)] = [:]
        let teamActors = play.actors.filter { $0.team == .equipe }

        for actor in teamActors {
            guard let position = actor.position,
                  let index = available.firstIndex(where: { $0.position == position }) else { continue }
            let player = available.remove(at: index)
            result[actor.id] = ("\(player.shirtNumber)", player.displayName)
        }
        for actor in teamActors where result[actor.id] == nil {
            let index = available.firstIndex { ($0.position == .gardien) == actor.isGoalkeeper } ?? available.indices.first
            guard let index else { break }
            let player = available.remove(at: index)
            result[actor.id] = ("\(player.shirtNumber)", player.displayName)
        }
        return result
    }

    private func refreshOverlays(animated: Bool) {
        guard play.steps.indices.contains(stepIndex) else { return }
        scene3D.showArrows(showArrows ? play.arrows(forStep: stepIndex, frames: frames) : [], animated: animated)
        scene3D.setHighlights(Set(play.steps[stepIndex].highlight ?? []))
    }

    // MARK: - Navigation entre étapes

    private func goForward() {
        guard stepIndex < lastIndex else {
            isPlaying = false
            return
        }
        runToken += 1
        let token = runToken
        stepIndex += 1
        let target = stepIndex
        refreshOverlays(animated: true)
        let duration = (play.steps[target].duration ?? TacticStep.defaultDuration) / speed

        // Les flèches apparaissent d'abord, puis les joueurs se déplacent
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45 / speed) {
            guard token == runToken else { return }
            scene3D.animate(to: frames[target], aerial: play.isAerial(step: target), duration: duration) {
                guard token == runToken, isPlaying else { return }
                scheduleNext(token: token)
            }
        }
    }

    private func scheduleNext(token: Int) {
        let text = play.steps[stepIndex].text
        let hold = (1.0 + min(3.5, Double(text.count) / 45)) / speed
        DispatchQueue.main.asyncAfter(deadline: .now() + hold) {
            guard token == runToken, isPlaying else { return }
            if stepIndex < lastIndex {
                goForward()
            } else {
                isPlaying = false
            }
        }
    }

    private func togglePlay() {
        if isPlaying {
            stopAuto()
            return
        }
        isPlaying = true
        if stepIndex >= lastIndex {
            jump(to: 0, keepPlaying: true)
            runToken += 1
            let token = runToken
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                guard token == runToken, isPlaying else { return }
                goForward()
            }
        } else {
            goForward()
        }
    }

    private func previous() {
        guard stepIndex > 0 else { return }
        stopAuto()
        runToken += 1
        stepIndex -= 1
        refreshOverlays(animated: true)
        scene3D.animate(to: frames[stepIndex], aerial: false, duration: 0.6)
    }

    private func replayStep() {
        guard stepIndex > 0 else { return }
        stopAuto()
        let target = stepIndex
        runToken += 1
        let token = runToken
        scene3D.setFrame(frames[target - 1])
        refreshOverlays(animated: true)
        let duration = (play.steps[target].duration ?? TacticStep.defaultDuration) / speed
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45 / speed) {
            guard token == runToken else { return }
            scene3D.animate(to: frames[target], aerial: play.isAerial(step: target), duration: duration)
        }
    }

    private func jump(to index: Int, keepPlaying: Bool = false) {
        guard frames.indices.contains(index) else { return }
        if !keepPlaying { stopAuto() }
        runToken += 1
        stepIndex = index
        scene3D.setFrame(frames[index])
        refreshOverlays(animated: false)
    }

    private func stopAuto() {
        isPlaying = false
        runToken += 1
    }

    private func stopPlayback() {
        stopAuto()
    }
}

// MARK: - Fichier à partager

struct TacticShareFile: Identifiable {
    let id = UUID()
    let url: URL
}

// MARK: - Sélecteur de caméra

struct CameraPresetPicker: View {
    let selected: Pitch3DCameraPreset
    let onSelect: (Pitch3DCameraPreset) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(Pitch3DCameraPreset.allCases) { preset in
                Button {
                    onSelect(preset)
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: preset.icon)
                            .font(.system(size: 15, weight: .semibold))
                        Text(preset.displayName)
                            .font(.system(size: 9, weight: .semibold))
                    }
                    .frame(width: 58, height: 42)
                    .foregroundStyle(selected == preset ? Color.white : Color.primary)
                    .background(
                        RoundedRectangle(cornerRadius: 9)
                            .fill(selected == preset ? Color.accentColor : Color.clear)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Caméra \(preset.displayName)")
            }
        }
        .padding(3)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Légende des flèches

struct ArrowLegend: View {
    var compact = false

    var body: some View {
        let items: [TacticArrowKind] = [.passe, .course, .conduite, .tir]
        Group {
            if compact {
                HStack(spacing: 10) {
                    ForEach(items, id: \.self) { kind in
                        HStack(spacing: 4) {
                            ArrowSample(kind: kind, onDark: true)
                                .frame(width: 22, height: 10)
                            Text(kind.displayName)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.black.opacity(0.45), in: Capsule())
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(items, id: \.self) { kind in
                        HStack(spacing: 10) {
                            ArrowSample(kind: kind, onDark: false)
                                .frame(width: 40, height: 12)
                            Text(kind.displayName)
                                .font(.subheadline)
                        }
                    }
                }
            }
        }
    }
}

private struct ArrowSample: View {
    let kind: TacticArrowKind
    let onDark: Bool

    private var color: Color {
        switch kind {
        case .course: return onDark ? .white : .primary
        case .passe: return Color(red: 0.95, green: 0.75, blue: 0.0)
        case .conduite: return .orange
        case .tir: return .red
        }
    }

    var body: some View {
        Canvas { context, size in
            let midY = size.height / 2
            var path = Path()
            if kind == .conduite {
                path.move(to: CGPoint(x: 0, y: midY))
                for x in stride(from: 0.0, through: size.width - 5, by: 1.0) {
                    path.addLine(to: CGPoint(x: x, y: midY + sin(x / 3) * size.height * 0.3))
                }
            } else {
                path.move(to: CGPoint(x: 0, y: midY))
                path.addLine(to: CGPoint(x: size.width - 5, y: midY))
            }
            let style = StrokeStyle(lineWidth: kind == .tir ? 3 : 2, lineCap: .round,
                                    dash: kind == .course ? [4, 3] : [])
            context.stroke(path, with: .color(color), style: style)
            var head = Path()
            head.move(to: CGPoint(x: size.width, y: midY))
            head.addLine(to: CGPoint(x: size.width - 6, y: midY - 4))
            head.addLine(to: CGPoint(x: size.width - 6, y: midY + 4))
            head.closeSubpath()
            context.fill(head, with: .color(color))
        }
    }
}

// MARK: - Fiche de l'exercice

struct TacticInfoSheet: View {
    let play: TacticPlay
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if !play.objective.isEmpty {
                    Section("Objectif") {
                        Text(play.objective)
                    }
                }
                if !play.instructions.isEmpty {
                    Section("Consignes de coaching") {
                        ForEach(Array(play.instructions.enumerated()), id: \.offset) { _, instruction in
                            Label(instruction, systemImage: "checkmark.circle")
                        }
                    }
                }
                Section("Organisation") {
                    LabeledContent("Catégorie", value: play.category.displayName)
                    if let headcount = play.headcount { LabeledContent("Effectif", value: headcount) }
                    if let level = play.level { LabeledContent("Niveau", value: level) }
                    if let duration = play.duration { LabeledContent("Durée", value: duration) }
                    if let equipment = play.equipmentSummary { LabeledContent("Matériel", value: equipment) }
                    LabeledContent("Étapes", value: "\(play.steps.count)")
                }
                Section("Déroulé") {
                    ForEach(Array(play.steps.enumerated()), id: \.offset) { index, step in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(index + 1). \(step.title.isEmpty ? "Étape \(index + 1)" : step.title)")
                                .font(.subheadline.bold())
                            if !step.text.isEmpty {
                                Text(step.text)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section("Légende") {
                    ArrowLegend()
                        .padding(.vertical, 4)
                    Label("Halo jaune : joueur clé de l'étape", systemImage: "circle.dashed")
                        .font(.subheadline)
                }
                if let source = play.source, !source.isEmpty {
                    Section("Source") {
                        Text(source)
                    }
                }
            }
            .navigationTitle(play.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK") { dismiss() }
                }
            }
        }
    }
}
