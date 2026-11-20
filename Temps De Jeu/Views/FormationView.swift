//
//  FormationView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 07/03/2026.
//

import SwiftUI

/// Mode d'interaction sur le terrain
private enum PitchTool {
    case move    // Déplacer les joueurs
    case draw    // Dessiner des tracés
}

/// Un joueur adverse placé sur le terrain (éphémère, non persisté)
private struct OpponentToken: Identifiable, Equatable {
    let id: UUID
    var position: CGPoint  // Coordonnées normalisées 0-1
    var number: Int
}

/// Cadrage du terrain 2D (zoom uniforme, sans déformation)
private enum PitchZoom: CaseIterable {
    case full, half, zone

    var factor: Double {
        switch self {
        case .full: return 1
        case .half: return 1.7
        case .zone: return 2.6
        }
    }

    var title: String {
        switch self {
        case .full: return "Terrain entier"
        case .half: return "Demi-terrain"
        case .zone: return "Zone de jeu"
        }
    }

    var icon: String {
        switch self {
        case .full: return "rectangle.portrait"
        case .half: return "rectangle.portrait.tophalf.inset.filled"
        case .zone: return "viewfinder"
        }
    }
}

/// Un segment de tracé sur le terrain
private struct DrawingLine: Identifiable {
    let id = UUID()
    var points: [CGPoint]  // Coordonnées normalisées 0-1
}

/// Vue de placement tactique des joueurs sur le terrain.
/// En mode entraînement, sert d'éditeur de séquences sans composition de match.
struct FormationView: View {
    let roster: [MatchPlayer]
    let jerseyColor: JerseyColor
    let opponentJerseyColor: JerseyColor
    let savedFormation: String?
    var onSave: (([UUID: CGPoint], String?) -> Void)?
    /// Création libre d'une séquence d'entraînement (joueurs ajoutés à la main)
    var trainingMode: Bool = false
    /// Séquence perso à reprendre (mode entraînement)
    var initialPlay: TacticPlay? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var positions: [UUID: CGPoint] = [:]
    @State private var currentFormationName: String? = nil
    @State private var hasChanges = false
    @State private var draggedPlayerId: UUID? = nil
    @State private var isMirrored = false
    @State private var didAppear = false
    @State private var zoom: PitchZoom = .full
    @State private var zoomCenter = CGPoint(x: 0.5, y: 0.5)

    // Joueurs ajoutés à la main (mode entraînement)
    @State private var extraPlayers: [MatchPlayer] = []

    // Joueurs adverses
    @State private var opponents: [OpponentToken] = []
    @State private var nextOpponentNumber = 1
    @State private var draggedOpponentId: UUID? = nil

    // Outil dessin
    @State private var activeTool: PitchTool = .move
    @State private var drawingLines: [DrawingLine] = []
    @State private var currentLine: DrawingLine? = nil

    // Ballon : libre (ballPosition) ou aux pieds d'un joueur (ballHolder)
    @State private var ballPosition: CGPoint? = nil
    @State private var ballHolder: String? = nil
    @State private var isDraggingBall = false

    // Vue 3D
    @State private var is3D = false
    @State private var did3DSetup = false
    @StateObject private var pitch3D = Pitch3DController()

    // Séquence pas à pas
    @State private var sequenceSteps: [TacticStep] = []
    @State private var sequenceActors: [TacticActor] = []
    @State private var sequenceId = UUID()
    @State private var editingStepIndex: Int?
    @State private var nextStepAerial = false
    @State private var sequenceDirty = false
    @State private var showSequencePlayer = false
    @State private var showSaveSequence = false
    @State private var showStepsSheet = false
    @State private var showSequenceHelp = false
    @State private var showLeaveConfirmation = false
    @State private var sequenceTitle = ""
    @State private var sequenceToast: String?
    @State private var showLibrary = false

    private var palette3D: Pitch3DPalette {
        Pitch3DPalette(team: jerseyColor, opponent: opponentJerseyColor)
    }

    private var titulaires: [MatchPlayer] {
        (roster.filter { $0.status == .titulaire } + extraPlayers).sorted { $0.shirtNumber < $1.shirtNumber }
    }

    private var remplacants: [MatchPlayer] {
        roster.filter { $0.status == .remplacant }.sorted { $0.shirtNumber < $1.shirtNumber }
    }

    private var showsSequenceStrip: Bool {
        trainingMode || !sequenceSteps.isEmpty || sequenceToast != nil
    }

    var body: some View {
        NavigationStack {
            withPresentations(withObservers(mainContent))
        }
    }

    private var mainContent: some View {
        VStack(spacing: 0) {
            headerRow

            if is3D {
                pitch3DArea
            } else {
                pitch2DArea
            }

            if showsSequenceStrip {
                sequenceStrip
            }

            if !remplacants.isEmpty {
                benchView
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(trainingMode ? (initialPlay?.title ?? "Nouvelle séquence") : "Placement")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarContent }
        .interactiveDismissDisabled(trainingMode && sequenceDirty && !sequenceSteps.isEmpty)
    }

    /// Synchronisation 2D ⇄ 3D
    private func withObservers<Content: View>(_ content: Content) -> some View {
        content
            .onAppear(perform: onFirstAppear)
            .onChange(of: is3D) {
                if is3D {
                    activeTool = .move
                    setup3D()
                }
            }
            .onChange(of: positions) { if is3D { sync3D() } }
            .onChange(of: opponents) { if is3D { sync3D() } }
            .onChange(of: ballPosition) { if is3D { sync3D() } }
            .onChange(of: ballHolder) { if is3D { sync3D() } }
            .onChange(of: drawingLines.count) { if is3D { sync3D() } }
            .onChange(of: extraPlayers.count) { if is3D { sync3D() } }
            .onChange(of: sequenceSteps) {
                sequenceDirty = true
                if let k = editingStepIndex, !sequenceSteps.indices.contains(k) { editingStepIndex = nil }
                if is3D { sync3D() }
            }
            .onChange(of: nextStepAerial) { if is3D { sync3D() } }
            .onChange(of: editingStepIndex) { if is3D { sync3D() } }
    }

    /// Feuilles, alertes et lecteur
    private func withPresentations<Content: View>(_ content: Content) -> some View {
        content
            .fullScreenCover(isPresented: $showSequencePlayer) {
                TacticPlayerView(play: makeSequencePlay(), palette: palette3D) { play in
                    TacticStore.shared.save(play)
                    sequenceDirty = false
                }
            }
            .fullScreenCover(isPresented: $showLibrary) {
                TacticsLibraryView(palette: palette3D, roster: roster)
            }
            .sheet(isPresented: $showStepsSheet) {
                SequenceStepsSheet(steps: $sequenceSteps, onShow: { loadStep($0) }, onPlay: {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { showSequencePlayer = true }
                })
            }
            .sheet(isPresented: $showSequenceHelp) {
                SequenceHelpSheet()
            }
            .alert("Enregistrer la séquence", isPresented: $showSaveSequence) {
                TextField("Titre", text: $sequenceTitle)
                Button("Annuler", role: .cancel) {}
                Button("Enregistrer") {
                    TacticStore.shared.save(makeSequencePlay(title: sequenceTitle))
                    sequenceDirty = false
                    showToast("Séquence enregistrée dans Tactiques 3D › Mes séquences")
                }
            } message: {
                Text("\(sequenceSteps.count) étapes · retrouvez-la dans la bibliothèque Tactiques 3D.")
            }
            .confirmationDialog("Quitter sans enregistrer la séquence ?", isPresented: $showLeaveConfirmation,
                                titleVisibility: .visible) {
                Button("Enregistrer d'abord") { askToSave() }
                Button("Quitter sans enregistrer", role: .destructive) { dismiss() }
            }
    }

    // MARK: - En-tête

    private var headerRow: some View {
        HStack {
            if let name = currentFormationName, !trainingMode {
                Text(name)
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
            } else if trainingMode {
                Text("\(titulaires.count) joueur\(titulaires.count > 1 ? "s" : "") · \(opponents.count) adv.")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if !is3D {
                Menu {
                    ForEach(PitchZoom.allCases, id: \.self) { level in
                        Button {
                            setZoom(level)
                        } label: {
                            Label(level.title, systemImage: zoom == level ? "checkmark" : level.icon)
                        }
                    }
                    Divider()
                    Button {
                        recenterZoom()
                    } label: {
                        Label("Recentrer sur les joueurs", systemImage: "scope")
                    }
                } label: {
                    Label(zoom.title, systemImage: zoom.icon)
                        .font(.caption.bold())
                }
                .accessibilityLabel("Cadrage du terrain")
            }
            Picker("Vue", selection: $is3D) {
                Text("2D").tag(false)
                Text("3D").tag(true)
            }
            .pickerStyle(.segmented)
            .frame(width: 120)
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
    }

    // MARK: - Terrain 3D

    private var pitch3DArea: some View {
        ZStack(alignment: .topTrailing) {
            Pitch3DView(controller: pitch3D)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            CameraPresetPicker(selected: pitch3D.cameraPreset) { preset in
                pitch3D.applyCamera(preset, animated: true)
            }
            .padding(8)
        }
        .overlay(alignment: .bottomLeading) {
            Text("Glissez un joueur ou le ballon · tournez la caméra ailleurs")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.black.opacity(0.45), in: Capsule())
                .padding(8)
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }

    // MARK: - Terrain 2D

    private var pitch2DArea: some View {
        GeometryReader { pitchGeo in
            let pw = pitchGeo.size.width
            let ph = pitchGeo.size.height
            let r = visibleRect
            let fullSize = CGSize(width: pw / r.width, height: ph / r.height)

            ZStack {
                // Joueurs de mon équipe
                ForEach(titulaires) { player in
                    if let norm = positions[player.id] {
                        teamToken(player, at: toView(norm, pw: pw, ph: ph), pw: pw, ph: ph)
                    }
                }

                // Joueurs adverses
                ForEach(opponents) { opp in
                    opponentToken(opp, at: toView(opp.position, pw: pw, ph: ph), pw: pw, ph: ph)
                }

                // Ballon
                if let ballPixel = ballPixel(pw: pw, ph: ph) {
                    ballToken(at: ballPixel, pw: pw, ph: ph)
                }

                // Geste de dessin (par-dessus tout)
                if activeTool == .draw {
                    drawingLayer(pw: pw, ph: ph)
                }
            }
            .frame(width: pw, height: ph)
            .background(alignment: .topLeading) {
                // Terrain entier dessiné en grand, décalé selon le cadrage
                ZStack {
                    PitchShape()
                        .fill(Color.green.opacity(0.35))
                        .overlay(PitchMarkings())

                    ForEach(drawingLines) { line in
                        DrawingPath(points: line.points, pitchSize: fullSize)
                    }
                    if let current = currentLine {
                        DrawingPath(points: current.points, pitchSize: fullSize)
                    }

                    // Aperçu de l'étape en cours de construction
                    TacticArrowsOverlay(arrows: previewArrows)
                }
                .frame(width: fullSize.width, height: fullSize.height)
                .offset(x: -r.minX * fullSize.width, y: -r.minY * fullSize.height)
                .allowsHitTesting(false)
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .rotationEffect(isMirrored ? .degrees(180) : .zero)
            .animation(.easeInOut(duration: 0.3), value: isMirrored)
            .animation(.easeInOut(duration: 0.25), value: zoom)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("terrain-2d")
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }

    /// Partie du terrain visible en 2D (coordonnées normalisées, zoom uniforme)
    private var visibleRect: CGRect {
        let size = 1 / zoom.factor
        let x = min(max(zoomCenter.x - size / 2, 0), 1 - size)
        let y = min(max(zoomCenter.y - size / 2, 0), 1 - size)
        return CGRect(x: x, y: y, width: size, height: size)
    }

    private func toView(_ p: CGPoint, pw: CGFloat, ph: CGFloat) -> CGPoint {
        let r = visibleRect
        return CGPoint(x: (p.x - r.minX) / r.width * pw, y: (p.y - r.minY) / r.height * ph)
    }

    private func fromView(_ p: CGPoint, pw: CGFloat, ph: CGFloat) -> CGPoint {
        let r = visibleRect
        return CGPoint(x: r.minX + p.x / pw * r.width, y: r.minY + p.y / ph * r.height)
    }

    private func setZoom(_ level: PitchZoom) {
        zoom = level
        recenterZoom()
    }

    /// Centre le cadrage sur les joueurs et le ballon
    private func recenterZoom() {
        var points = Array(currentPositions.values)
        if let ball = ballPosition { points.append(TacticPoint(x: ball.x, y: ball.y)) }
        guard !points.isEmpty else { return }
        let xs = points.map(\.x), ys = points.map(\.y)
        zoomCenter = CGPoint(x: ((xs.min() ?? 0.5) + (xs.max() ?? 0.5)) / 2,
                             y: ((ys.min() ?? 0.5) + (ys.max() ?? 0.5)) / 2)
    }

    private func teamToken(_ player: MatchPlayer, at pixel: CGPoint, pw: CGFloat, ph: CGFloat) -> some View {
        let id = player.id.uuidString
        return PlayerToken(
            player: player,
            jerseyColor: jerseyColor,
            isCaptain: player.isCaptain,
            isDragging: draggedPlayerId == player.id,
            hasBall: ballHolder == id
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Joueur \(player.shirtNumber)\(ballHolder == id ? ", avec le ballon" : "")")
        .accessibilityIdentifier("joueur-\(player.shirtNumber)")
        .position(pixel)
        .zIndex(draggedPlayerId == player.id ? 10 : 1)
        .gesture(activeTool == .move ?
            DragGesture()
                .onChanged { value in
                    draggedPlayerId = player.id
                    moveActor(id, to: fromView(value.location, pw: pw, ph: ph))
                }
                .onEnded { _ in
                    draggedPlayerId = nil
                }
            : nil
        )
        .onLongPressGesture {
            if trainingMode { removeTeammate(player.id) }
        }
    }

    private func opponentToken(_ opp: OpponentToken, at pixel: CGPoint, pw: CGFloat, ph: CGFloat) -> some View {
        let id = "adv-\(opp.id.uuidString)"
        return OpponentPlayerToken(
            number: opp.number,
            jerseyColor: opponentJerseyColor,
            isDragging: draggedOpponentId == opp.id,
            hasBall: ballHolder == id
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Adversaire \(opp.number)\(ballHolder == id ? ", avec le ballon" : "")")
        .accessibilityIdentifier("adversaire-\(opp.number)")
        .position(pixel)
        .zIndex(draggedOpponentId == opp.id ? 10 : 1)
        .gesture(activeTool == .move ?
            DragGesture()
                .onChanged { value in
                    draggedOpponentId = opp.id
                    moveActor(id, to: fromView(value.location, pw: pw, ph: ph))
                }
                .onEnded { _ in
                    draggedOpponentId = nil
                }
            : nil
        )
        .onLongPressGesture {
            if ballHolder == id { ballHolder = nil }
            opponents.removeAll { $0.id == opp.id }
        }
    }

    private func ballToken(at pixel: CGPoint, pw: CGFloat, ph: CGFloat) -> some View {
        Text("⚽️")
            .font(.system(size: 28))
            .shadow(color: .black.opacity(isDraggingBall ? 0.4 : 0.2), radius: isDraggingBall ? 4 : 2)
            .scaleEffect(isDraggingBall ? 1.25 : 1.0)
            .frame(width: 44, height: 44)
            .contentShape(Circle())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Ballon")
            .accessibilityIdentifier("ballon")
            .position(pixel)
            .zIndex(isDraggingBall ? 12 : 5)
            .gesture(activeTool == .move ?
                DragGesture()
                    .onChanged { value in
                        isDraggingBall = true
                        ballHolder = nil
                        let p = fromView(value.location, pw: pw, ph: ph)
                        ballPosition = CGPoint(x: min(max(p.x, 0.01), 0.99), y: min(max(p.y, 0.005), 0.995))
                    }
                    .onEnded { _ in
                        isDraggingBall = false
                        if let ball = ballPosition {
                            let r = visibleRect
                            dropBall(at: TacticPoint(x: ball.x, y: ball.y),
                                     metric: .points(width: Double(pw / r.width), height: Double(ph / r.height)))
                        }
                    }
                : nil
            )
            .onLongPressGesture {
                ballPosition = nil
                ballHolder = nil
            }
            .animation(.easeInOut(duration: 0.15), value: isDraggingBall)
    }

    private func drawingLayer(pw: CGFloat, ph: CGFloat) -> some View {
        Color.clear
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 2)
                    .onChanged { value in
                        let p = fromView(value.location, pw: pw, ph: ph)
                        let pt = CGPoint(x: min(max(p.x, 0), 1), y: min(max(p.y, 0), 1))
                        if currentLine == nil {
                            currentLine = DrawingLine(points: [pt])
                        } else {
                            currentLine?.points.append(pt)
                        }
                    }
                    .onEnded { _ in
                        if let line = currentLine, line.points.count > 1 {
                            drawingLines.append(line)
                        }
                        currentLine = nil
                    }
            )
            .zIndex(20)
    }

    /// Ballon aux pieds du porteur (décalé pour rester attrapable) ou libre
    private func ballPixel(pw: CGFloat, ph: CGFloat) -> CGPoint? {
        if let holder = ballHolder, let p = currentPoint(of: holder) {
            let v = toView(p, pw: pw, ph: ph)
            return CGPoint(x: v.x + 22, y: v.y + 12)
        }
        guard let ball = ballPosition else { return nil }
        return toView(ball, pw: pw, ph: ph)
    }

    // MARK: - Banc

    private var benchView: some View {
        VStack(spacing: 6) {
            Text("Remplaçants")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(remplacants) { player in
                        PlayerToken(
                            player: player,
                            jerseyColor: jerseyColor,
                            isCaptain: player.isCaptain,
                            isSmall: true
                        )
                    }
                }
                .padding(.horizontal, 16)
            }
        }
        .padding(.vertical, 8)
    }

    // MARK: - Barre d'outils

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            if trainingMode {
                Button {
                    askToSave()
                } label: {
                    Text("Enregistrer").bold()
                }
            } else {
                Button {
                    onSave?(positions, currentFormationName)
                    dismiss()
                } label: {
                    Text("Enregistrer").bold()
                }
            }
        }
        ToolbarItem(placement: .topBarLeading) {
            HStack(spacing: 12) {
                if trainingMode {
                    Button {
                        if sequenceDirty && !sequenceSteps.isEmpty {
                            showLeaveConfirmation = true
                        } else {
                            dismiss()
                        }
                    } label: {
                        Text("Fermer")
                    }
                } else {
                    Menu {
                        Button { applyFormation(.f442) } label: { Text("4-4-2") }
                        Button { applyFormation(.f433) } label: { Text("4-3-3") }
                        Button { applyFormation(.f343) } label: { Text("3-4-3") }
                        Button { applyFormation(.f352) } label: { Text("3-5-2") }
                        Button { applyFormation(.f532) } label: { Text("5-3-2") }
                        Button { applyFormation(.f4231) } label: { Text("4-2-3-1") }
                        Button { applyFormation(.f4141) } label: { Text("4-1-4-1") }
                        Divider()
                        Button { applyFormation(.auto) } label: {
                            Label("Auto (par poste)", systemImage: "wand.and.stars")
                        }
                    } label: {
                        Label("Formation", systemImage: "rectangle.3.group")
                            .font(.subheadline)
                    }

                    Button {
                        isMirrored.toggle()
                    } label: {
                        Image(systemName: isMirrored ? "person.fill" : "person.2.fill")
                            .font(.subheadline)
                    }
                    .disabled(is3D)
                }

                sequenceMenu
            }
        }
        ToolbarItem(placement: .bottomBar) {
            HStack(spacing: 14) {
                Button {
                    activeTool = .move
                } label: {
                    Image(systemName: "hand.point.up.left.fill")
                        .font(.title3)
                        .foregroundStyle(activeTool == .move ? .blue : .secondary)
                }

                // Crayon (2D uniquement, les tracés restent visibles en 3D)
                Button {
                    activeTool = .draw
                } label: {
                    Image(systemName: "pencil.tip.crop.circle")
                        .font(.title3)
                        .foregroundStyle(activeTool == .draw ? .blue : .secondary)
                }
                .disabled(is3D)

                if !trainingMode {
                    // Démarrer / continuer une séquence
                    Button {
                        captureStep()
                    } label: {
                        Image(systemName: "camera.viewfinder")
                            .font(.title3)
                            .foregroundStyle(.purple)
                    }
                    .accessibilityLabel("Capturer une étape")
                }

                Divider()
                    .frame(height: 24)

                if trainingMode {
                    Button {
                        addTeammate()
                    } label: {
                        Image(systemName: "person.crop.circle.badge.plus")
                            .font(.title3)
                            .foregroundStyle(jerseyColor.color == .white ? .blue : jerseyColor.color)
                    }
                    .accessibilityLabel("Ajouter un joueur")
                }

                Button {
                    addOpponent()
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(opponentJerseyColor.color == .red ? .red : opponentJerseyColor.color)
                }
                .accessibilityLabel("Ajouter un adversaire")

                Button {
                    toggleBall()
                } label: {
                    Text("⚽️")
                        .font(.title3)
                        .opacity(ballPosition != nil ? 1 : 0.4)
                }
                .accessibilityLabel(ballPosition != nil ? "Retirer le ballon" : "Placer le ballon")

                Spacer()

                if !drawingLines.isEmpty {
                    Button {
                        drawingLines.removeAll()
                    } label: {
                        Image(systemName: "eraser.fill")
                            .font(.title3)
                            .foregroundStyle(.orange)
                    }
                }

                if !opponents.isEmpty {
                    Button {
                        if ballHolder?.hasPrefix("adv-") == true { ballHolder = nil }
                        opponents.removeAll()
                        nextOpponentNumber = 1
                    } label: {
                        Image(systemName: "trash.fill")
                            .font(.title3)
                            .foregroundStyle(.red)
                    }
                }
            }
        }
    }

    // MARK: - Séquence : menu et bande

    private var sequenceMenu: some View {
        Menu {
            Section("Séquence pas à pas") {
                Button {
                    captureStep()
                } label: {
                    Label(captureLabel, systemImage: "camera.viewfinder")
                }
                Button {
                    showSequencePlayer = true
                } label: {
                    Label("Lire la démonstration", systemImage: "play.circle")
                }
                .disabled(sequenceSteps.count < 2)
                Button {
                    showStepsSheet = true
                } label: {
                    Label("Étapes (titres, consignes…)", systemImage: "list.bullet.rectangle")
                }
                .disabled(sequenceSteps.isEmpty)
                Button {
                    askToSave()
                } label: {
                    Label("Enregistrer dans mes tactiques", systemImage: "square.and.arrow.down")
                }
                .disabled(sequenceSteps.count < 2)
                Button(role: .destructive) {
                    clearSequence()
                } label: {
                    Label("Effacer la séquence", systemImage: "trash")
                }
                .disabled(sequenceSteps.isEmpty)
            }
            Button {
                showSequenceHelp = true
            } label: {
                Label("Comment construire une séquence", systemImage: "questionmark.circle")
            }
            if !trainingMode {
                Button {
                    showLibrary = true
                } label: {
                    Label("Atelier d'exercices", systemImage: "square.and.pencil")
                }
            }
        } label: {
            Image(systemName: "film.stack")
                .font(.subheadline)
        }
        .accessibilityLabel("Séquence et tactiques")
    }

    private var captureLabel: String {
        if let k = editingStepIndex { return "Mettre à jour l'étape \(k + 1)" }
        return sequenceSteps.isEmpty ? "Mise en place" : "Étape \(sequenceSteps.count + 1)"
    }

    /// Ce que la prochaine validation va enregistrer
    private var actionSummary: String {
        if sequenceSteps.isEmpty {
            return "Placez joueurs et ballon, puis validez la mise en place."
        }
        if editingStepIndex == 0 { return "Correction de la mise en place" }
        guard let preview = sequencePreview else { return "" }
        if let k = editingStepIndex { return "Étape \(k + 1) : \(preview.summary)" }
        return preview.summary == "Aucun mouvement"
            ? "Déplacez un joueur ou le ballon pour l'étape \(sequenceSteps.count + 1)"
            : "Étape \(sequenceSteps.count + 1) : \(preview.summary)"
    }

    private var sequenceStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "film.stack")
                    .foregroundStyle(.purple)
                if sequenceSteps.isEmpty {
                    Text("Séquence")
                        .font(.caption.bold())
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 5) {
                            ForEach(Array(sequenceSteps.indices), id: \.self) { i in
                                stepChip(i)
                            }
                        }
                    }
                }
                Spacer(minLength: 4)
                Button {
                    showSequenceHelp = true
                } label: {
                    Image(systemName: "questionmark.circle")
                }
                .accessibilityLabel("Aide")
                if !sequenceSteps.isEmpty {
                    Button {
                        showStepsSheet = true
                    } label: {
                        Image(systemName: "list.bullet.rectangle")
                    }
                    .accessibilityLabel("Étapes")
                    Button {
                        showSequencePlayer = true
                    } label: {
                        Image(systemName: "play.circle.fill")
                            .font(.title3)
                    }
                    .disabled(sequenceSteps.count < 2)
                    .accessibilityLabel("Lire la démonstration")
                }
            }
            .foregroundStyle(.purple)

            HStack(spacing: 8) {
                Text(sequenceToast ?? actionSummary)
                    .font(.caption)
                    .foregroundStyle(sequenceToast != nil ? Color.purple : Color.secondary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .animation(.easeInOut(duration: 0.2), value: sequenceToast)

                if ballPosition != nil && !sequenceSteps.isEmpty && editingStepIndex != 0 {
                    Button {
                        nextStepAerial.toggle()
                    } label: {
                        Label("En l'air", systemImage: "arrow.up.forward")
                            .font(.caption.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(nextStepAerial ? Color.orange : Color.secondary.opacity(0.15)))
                            .foregroundStyle(nextStepAerial ? Color.white : Color.primary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Ballon en l'air")
                }

                if editingStepIndex != nil {
                    Button("Annuler") { finishEditing() }
                        .font(.caption)
                }

                Button(action: captureStep) {
                    Label(captureLabel, systemImage: editingStepIndex != nil ? "checkmark.circle.fill" : "plus.circle.fill")
                        .font(.caption.bold())
                        .lineLimit(1)
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
                .controlSize(.small)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.purple.opacity(0.08))
    }

    private func stepChip(_ i: Int) -> some View {
        let selected = editingStepIndex == i
        return Button {
            loadStep(i)
        } label: {
            Text("\(i + 1)")
                .font(.caption.bold().monospacedDigit())
                .frame(width: 26, height: 26)
                .background(Circle().fill(selected ? Color.purple : Color.purple.opacity(0.15)))
                .foregroundStyle(selected ? Color.white : Color.purple)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Revoir l'étape \(i + 1)")
    }

    // MARK: - État du terrain

    private var currentPositions: [String: TacticPoint] {
        var points: [String: TacticPoint] = [:]
        for player in titulaires {
            if let p = positions[player.id] {
                points[player.id.uuidString] = TacticPoint(x: p.x, y: p.y)
            }
        }
        for opp in opponents {
            points["adv-\(opp.id.uuidString)"] = TacticPoint(x: opp.position.x, y: opp.position.y)
        }
        return points
    }

    private var placementFrame: TacticFrame {
        let points = currentPositions
        let holder = ballHolder.flatMap { points[$0] != nil ? $0 : nil }
        let ball = ballPosition.map { TacticPoint(x: $0.x, y: $0.y) } ?? TacticPoint(x: 0.5, y: 0.5)
        return TacticFrame(positions: points, ballHolder: holder, ball: ball)
    }

    private var placementActors: [TacticActor] {
        titulaires.map {
            let hasName = !($0.firstName.isEmpty && $0.lastName.isEmpty)
            return TacticActor(id: $0.id.uuidString, team: .equipe, label: "\($0.shirtNumber)",
                               name: hasName ? $0.displayName : nil, position: $0.position)
        } + opponents.map {
            TacticActor(id: "adv-\($0.id.uuidString)", team: .adversaire, label: "\($0.number)")
        }
    }

    /// Acteurs de la séquence + ceux présents sur le terrain
    private var allActors: [TacticActor] {
        var result = sequenceActors
        for actor in placementActors where !result.contains(where: { $0.id == actor.id }) {
            result.append(actor)
        }
        return result
    }

    private var currentStep: TacticStep {
        SequenceBuilder.makeStep(
            positions: currentPositions,
            holder: ballHolder,
            ball: ballPosition.map { TacticPoint(x: $0.x, y: $0.y) },
            aerial: nextStepAerial
        )
    }

    /// Étape de référence pour l'aperçu (précédente de celle qu'on construit)
    private var previewBaseIndex: Int? {
        if let k = editingStepIndex { return k > 0 ? k - 1 : nil }
        return sequenceSteps.isEmpty ? nil : sequenceSteps.count - 1
    }

    private var sequencePreview: SequenceBuilder.Transition? {
        guard let base = previewBaseIndex, sequenceSteps.indices.contains(base) else { return nil }
        return SequenceBuilder.transition(from: sequenceSteps[base], to: currentStep, actors: allActors)
    }

    private var previewArrows: [TacticArrow] {
        sequencePreview?.arrows ?? []
    }

    private func currentPoint(of id: String) -> CGPoint? {
        if id.hasPrefix("adv-") {
            guard let uuid = UUID(uuidString: String(id.dropFirst(4))) else { return nil }
            return opponents.first { $0.id == uuid }?.position
        }
        guard let uuid = UUID(uuidString: id) else { return nil }
        return positions[uuid]
    }

    private func feet(of id: String, at p: CGPoint) -> CGPoint {
        let ball = SequenceBuilder.ballAtFeet(of: TacticPoint(x: p.x, y: p.y),
                                              team: id.hasPrefix("adv-") ? .adversaire : .equipe)
        return CGPoint(x: ball.x, y: ball.y)
    }

    // MARK: - Déplacements (2D et 3D)

    /// Déplace un joueur ; s'il a le ballon, le ballon suit (conduite)
    private func moveActor(_ id: String, to point: CGPoint) {
        let p = CGPoint(x: min(max(point.x, 0.05), 0.95), y: min(max(point.y, 0.04), 0.96))
        if id.hasPrefix("adv-") {
            guard let uuid = UUID(uuidString: String(id.dropFirst(4))),
                  let index = opponents.firstIndex(where: { $0.id == uuid }) else { return }
            opponents[index].position = p
        } else if let uuid = UUID(uuidString: id) {
            positions[uuid] = p
            hasChanges = true
        }
        if ballHolder == id {
            ballPosition = feet(of: id, at: p)
        }
    }

    /// Le ballon lâché se colle au joueur le plus proche, file au fond du but, ou reste libre
    private func dropBall(at point: TacticPoint, metric: SequenceBuilder.Metric) {
        let points = currentPositions
        if let holder = SequenceBuilder.nearestActor(to: point, in: points, metric: metric),
           let p = points[holder] {
            ballHolder = holder
            ballPosition = feet(of: holder, at: CGPoint(x: p.x, y: p.y))
        } else if let goal = SequenceBuilder.goalTarget(for: point) {
            ballHolder = nil
            ballPosition = CGPoint(x: goal.x, y: goal.y)
        } else {
            ballHolder = nil
        }
    }

    private func toggleBall() {
        if ballPosition != nil {
            ballPosition = nil
            ballHolder = nil
            return
        }
        // Aux pieds du joueur le plus central, sinon au centre
        let center = TacticPoint(x: 0.5, y: 0.5)
        let points = currentPositions
        if let nearest = points.min(by: { $0.value.distance(to: center) < $1.value.distance(to: center) }) {
            ballHolder = nearest.key
            ballPosition = feet(of: nearest.key, at: CGPoint(x: nearest.value.x, y: nearest.value.y))
        } else {
            ballPosition = CGPoint(x: 0.5, y: 0.5)
        }
    }

    private func addTeammate() {
        let used = Set(titulaires.map(\.shirtNumber))
        let number = (1...99).first { !used.contains($0) } ?? 99
        let player = MatchPlayer(shirtNumber: number, firstName: "", lastName: "", position: .milieu, status: .titulaire)
        extraPlayers.append(player)
        positions[player.id] = CGPoint(x: 0.5 + Double.random(in: -0.15...0.15),
                                       y: 0.62 + Double.random(in: -0.05...0.05))
    }

    private func removeTeammate(_ id: UUID) {
        guard extraPlayers.contains(where: { $0.id == id }) else { return }
        if ballHolder == id.uuidString { ballHolder = nil }
        extraPlayers.removeAll { $0.id == id }
        positions[id] = nil
    }

    // MARK: - Séquence : capture et correction

    /// Valide l'état du terrain : nouvelle étape, ou mise à jour de l'étape affichée
    private func captureStep() {
        var step = currentStep
        for actor in placementActors {
            if let index = sequenceActors.firstIndex(where: { $0.id == actor.id }) {
                sequenceActors[index] = actor
            } else {
                sequenceActors.append(actor)
            }
        }

        if let k = editingStepIndex, sequenceSteps.indices.contains(k) {
            let old = sequenceSteps[k]
            if k > 0 {
                let before = sequenceSteps[k - 1]
                let oldAuto = SequenceBuilder.transition(from: before, to: old, actors: allActors).summary
                let transition = SequenceBuilder.transition(from: before, to: step, actors: allActors)
                step.title = (old.title.isEmpty || old.title == oldAuto) ? transition.summary : old.title
                step.duration = transition.duration
            } else {
                step.title = old.title.isEmpty ? "Mise en place" : old.title
                step.duration = old.duration
            }
            step.text = old.text
            sequenceSteps[k] = step
            let last = sequenceSteps.count - 1
            editingStepIndex = nil
            nextStepAerial = false
            if k < last {
                loadStep(last, editing: false)
                showToast("Étape \(k + 1) mise à jour · retour à l'étape \(last + 1)")
            } else {
                showToast("Étape \(k + 1) mise à jour")
            }
            return
        }

        if let previous = sequenceSteps.last {
            let transition = SequenceBuilder.transition(from: previous, to: step, actors: allActors)
            step.title = transition.summary
            step.duration = transition.duration
        } else {
            step.title = "Mise en place"
            step.duration = 1.5
        }
        sequenceSteps.append(step)
        nextStepAerial = false
        showToast(sequenceSteps.count == 1
                  ? "Mise en place enregistrée · faites la 1re action puis « Étape 2 »"
                  : "Étape \(sequenceSteps.count) enregistrée : \(step.title)")
    }

    /// Remet le terrain dans l'état d'une étape (pour la revoir ou la corriger)
    private func loadStep(_ index: Int, editing: Bool = true) {
        let play = makeSequencePlay()
        let frames = play.resolvedFrames()
        guard frames.indices.contains(index) else { return }
        let frame = frames[index]

        for (id, p) in frame.positions {
            let point = CGPoint(x: p.x, y: p.y)
            if id.hasPrefix("adv-"), let uuid = UUID(uuidString: String(id.dropFirst(4))) {
                if let i = opponents.firstIndex(where: { $0.id == uuid }) {
                    opponents[i].position = point
                } else {
                    let number = Int(play.actor(id)?.label ?? "") ?? nextOpponentNumber
                    opponents.append(OpponentToken(id: uuid, position: point, number: number))
                    nextOpponentNumber = max(nextOpponentNumber, number + 1)
                }
            } else if let uuid = UUID(uuidString: id) {
                if !titulaires.contains(where: { $0.id == uuid }), trainingMode, let actor = play.actor(id) {
                    extraPlayers.append(MatchPlayer(id: uuid, shirtNumber: Int(actor.label) ?? 0,
                                                    firstName: actor.name ?? "", lastName: "",
                                                    position: actor.position ?? .milieu, status: .titulaire))
                }
                if titulaires.contains(where: { $0.id == uuid }) || trainingMode {
                    positions[uuid] = point
                }
            }
        }

        if play.hasBall {
            ballHolder = frame.ballHolder
            ballPosition = CGPoint(x: frame.ball.x, y: frame.ball.y)
        }
        if editing {
            editingStepIndex = index
            nextStepAerial = play.steps[index].aerial ?? false
            showToast("Étape \(index + 1) affichée : corrigez puis « Mettre à jour »")
        }
    }

    private func finishEditing() {
        editingStepIndex = nil
        nextStepAerial = false
        if !sequenceSteps.isEmpty {
            loadStep(sequenceSteps.count - 1, editing: false)
        }
    }

    private func clearSequence() {
        sequenceSteps.removeAll()
        sequenceActors.removeAll()
        editingStepIndex = nil
        nextStepAerial = false
        sequenceId = UUID()
        sequenceDirty = false
    }

    private func askToSave() {
        guard sequenceSteps.count >= 2 else {
            showToast("Validez au moins la mise en place et une étape avant d'enregistrer")
            return
        }
        if sequenceTitle.isEmpty { sequenceTitle = defaultSequenceTitle }
        showSaveSequence = true
    }

    private func showToast(_ message: String) {
        sequenceToast = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            if sequenceToast == message { sequenceToast = nil }
        }
    }

    private var defaultSequenceTitle: String {
        let date = Date().formatted(date: .abbreviated, time: .shortened)
        if trainingMode { return "Séance du \(date)" }
        if let name = currentFormationName {
            return "Séquence \(name) – \(date)"
        }
        return "Séquence – \(date)"
    }

    private func makeSequencePlay(title: String? = nil) -> TacticPlay {
        let trimmed = title?.trimmingCharacters(in: .whitespaces) ?? ""
        let actors = allActors.filter { actor in sequenceSteps.contains { $0.positions[actor.id] != nil } }
        let teamCount = actors.filter { $0.team == .equipe }.count
        let oppCount = actors.filter { $0.team == .adversaire }.count
        let fallbackTitle = sequenceTitle.isEmpty ? defaultSequenceTitle : sequenceTitle
        return TacticPlay(
            id: sequenceId,
            title: trimmed.isEmpty ? fallbackTitle : trimmed,
            category: .perso,
            headcount: oppCount > 0 ? "\(teamCount) c \(oppCount)" : "\(teamCount) joueurs",
            objective: initialPlay?.objective
                ?? (trainingMode ? "" : "Séquence créée depuis le placement\(currentFormationName.map { " (\($0))" } ?? "")."),
            instructions: initialPlay?.instructions ?? [],
            source: trainingMode ? "Séance Temps De Jeu" : "Placement Temps De Jeu",
            actors: actors,
            steps: sequenceSteps,
            isUserCreated: true,
            createdAt: initialPlay?.createdAt ?? Date()
        )
    }

    // MARK: - Ouverture

    private func onFirstAppear() {
        guard !didAppear else { return }
        didAppear = true

        if trainingMode {
            if let play = initialPlay {
                loadInitialPlay(play)
            } else {
                setUpBlankSession()
            }
            setZoom(.zone)
        } else {
            initializePositions()
        }

        #if DEBUG
        if Demo.screen == "placement3d" {
            applyFormation(.auto)              // chaque joueur sur la ligne de son poste
            currentFormationName = "4-3-3"
            opponents = [
                OpponentToken(id: UUID(), position: CGPoint(x: 0.40, y: 0.30), number: 9),
                OpponentToken(id: UUID(), position: CGPoint(x: 0.62, y: 0.33), number: 10),
                OpponentToken(id: UUID(), position: CGPoint(x: 0.22, y: 0.40), number: 7),
            ]
            ballPosition = CGPoint(x: 0.53, y: 0.47)
            is3D = true
        }
        if Demo.screen == "sequence", let six = extraPlayers.first(where: { $0.shirtNumber == 6 }),
           let ten = extraPlayers.first(where: { $0.shirtNumber == 10 }) {
            captureStep()
            moveActor(six.id.uuidString, to: CGPoint(x: 0.5, y: 0.55))
            moveActor(ten.id.uuidString, to: CGPoint(x: 0.58, y: 0.36))
            sequenceToast = nil
        }
        #endif
    }

    /// Séance vierge : un carré de 4 joueurs, 2 adversaires, le ballon au 6
    private func setUpBlankSession() {
        let layout: [(Int, PlayerPosition, CGPoint)] = [
            (6, .milieu, CGPoint(x: 0.5, y: 0.62)),
            (4, .defenseur, CGPoint(x: 0.36, y: 0.53)),
            (8, .milieu, CGPoint(x: 0.64, y: 0.53)),
            (10, .milieu, CGPoint(x: 0.5, y: 0.44)),
        ]
        for (number, position, point) in layout {
            let player = MatchPlayer(shirtNumber: number, firstName: "", lastName: "", position: position, status: .titulaire)
            extraPlayers.append(player)
            positions[player.id] = point
        }
        opponents = [
            OpponentToken(id: UUID(), position: CGPoint(x: 0.46, y: 0.535), number: 1),
            OpponentToken(id: UUID(), position: CGPoint(x: 0.55, y: 0.5), number: 2),
        ]
        nextOpponentNumber = 3
        if let first = extraPlayers.first, let p = positions[first.id] {
            ballHolder = first.id.uuidString
            ballPosition = feet(of: first.id.uuidString, at: p)
        }
        sequenceTitle = ""
    }

    /// Reprend une séquence enregistrée pour la compléter ou la corriger
    private func loadInitialPlay(_ play: TacticPlay) {
        sequenceId = play.id
        sequenceTitle = play.title
        sequenceActors = play.actors
        sequenceSteps = play.steps
        for actor in play.actors where actor.team != .adversaire {
            guard let uuid = UUID(uuidString: actor.id) else { continue }
            extraPlayers.append(MatchPlayer(id: uuid, shirtNumber: Int(actor.label) ?? 0,
                                            firstName: actor.name ?? "", lastName: "",
                                            position: actor.position ?? .milieu, status: .titulaire))
        }
        if !play.steps.isEmpty {
            loadStep(play.steps.count - 1, editing: false)
        }
        DispatchQueue.main.async { sequenceDirty = false }
    }

    // MARK: - Vue 3D

    private func setup3D() {
        pitch3D.isEditable = true
        pitch3D.onActorMoved = { id, point in
            moveActor(id, to: CGPoint(x: point.x, y: point.y))
        }
        pitch3D.onBallMoved = { point in
            ballHolder = nil
            ballPosition = CGPoint(x: point.x, y: point.y)
        }
        pitch3D.onBallDropped = { point in
            dropBall(at: point, metric: .meters)
        }
        sync3D()
        if trainingMode {
            let points = Array(currentPositions.values)
            let xs = points.map(\.x), ys = points.map(\.y)
            pitch3D.setFocus(min: TacticPoint(x: (xs.min() ?? 0.4) - 0.03, y: (ys.min() ?? 0.4) - 0.03),
                             max: TacticPoint(x: (xs.max() ?? 0.6) + 0.03, y: (ys.max() ?? 0.6) + 0.03))
            pitch3D.applyCamera(did3DSetup ? pitch3D.cameraPreset : .coach, animated: did3DSetup)
        } else if !did3DSetup {
            pitch3D.setFocus(min: TacticPoint(x: 0, y: 0), max: TacticPoint(x: 1, y: 1))
            pitch3D.applyCamera(.coach, animated: false)
        }
        did3DSetup = true
    }

    private func sync3D() {
        let actors = placementActors.map {
            Pitch3DActor(id: $0.id, team: $0.team, label: $0.label, name: $0.name, isGoalkeeper: $0.isGoalkeeper)
        }
        pitch3D.configure(actors: actors, props: [], palette: palette3D)
        pitch3D.setBallVisible(ballPosition != nil)
        pitch3D.setFrame(placementFrame)
        pitch3D.showDrawings(drawingLines.map { line in line.points.map { TacticPoint(x: $0.x, y: $0.y) } })
        pitch3D.showArrows(previewArrows, animated: false)
    }

    // MARK: - Initialisation

    private func initializePositions() {
        // Restaurer les positions sauvegardées si elles existent
        let hasSavedPositions = titulaires.contains { $0.formationX != nil && $0.formationY != nil }
        if hasSavedPositions {
            for player in titulaires {
                if let x = player.formationX, let y = player.formationY {
                    positions[player.id] = CGPoint(x: x, y: y)
                }
            }
            currentFormationName = savedFormation
        } else {
            applyFormation(.auto)
        }
    }

    /// Miroir horizontal (gauche/droite) — inverse le côté des joueurs
    private func mirrorHorizontal() {
        for (id, pos) in positions {
            positions[id] = CGPoint(x: 1.0 - pos.x, y: pos.y)
        }
        hasChanges = true
    }

    /// Ajouter un joueur adverse au centre du camp adverse (haut du terrain)
    private func addOpponent() {
        let opp = OpponentToken(
            id: UUID(),
            position: CGPoint(x: 0.3 + Double.random(in: -0.15...0.15),
                              y: 0.15 + Double.random(in: -0.05...0.1)),
            number: nextOpponentNumber
        )
        opponents.append(opp)
        nextOpponentNumber += 1
    }

    private func applyFormation(_ formation: Formation) {
        guard !titulaires.isEmpty else { return }

        // Séparer par rôle
        let gk = titulaires.filter { $0.position == .gardien }
        let def = titulaires.filter { $0.position == .defenseur }
        let mid = titulaires.filter { $0.position == .milieu }
        let att = titulaires.filter { $0.position == .attaquant }

        if formation == .auto {
            currentFormationName = formation.displayName
            let slots = autoSlots(gk: gk.count, def: def.count, mid: mid.count, att: att.count)
            let groups = [gk, def, mid, att]
            for (groupIndex, group) in groups.enumerated() where groupIndex < slots.count {
                for (i, player) in group.enumerated() where i < slots[groupIndex].count {
                    positions[player.id] = slots[groupIndex][i]
                }
            }
            hasChanges = true
            return
        }

        // Formation fixe, adaptée au nombre de joueurs (à 11, à 8, à 5…)
        let lines = FormationLayout.adapt(lines: formation.lines, to: titulaires.count)
        currentFormationName = lines == formation.lines ? formation.displayName : FormationLayout.name(of: lines)
        let allSlots = formationSlots(lines: lines).flatMap { $0 }

        // Du gardien vers l'avant : gardiens, défenseurs, milieux, attaquants
        let ordered = gk + def + mid + att
        for (i, player) in ordered.enumerated() {
            positions[player.id] = i < allSlots.count ? allSlots[i] : CGPoint(x: 0.5, y: 0.5)
        }
        hasChanges = true
    }

    /// Génère les slots pour le mode auto (basé sur les positions réelles)
    private func autoSlots(gk: Int, def: Int, mid: Int, att: Int) -> [[CGPoint]] {
        [
            distributeOnLine(count: max(gk, 1), y: 0.9),
            distributeOnLine(count: def, y: 0.72),
            distributeOnLine(count: mid, y: 0.45),
            distributeOnLine(count: att, y: 0.18)
        ]
    }

    /// Génère les slots pour une formation définie (ex: [1, 4, 4, 2])
    private func formationSlots(lines: [Int]) -> [[CGPoint]] {
        let count = lines.count
        return lines.enumerated().map { (index, playersInLine) in
            let y = count > 1 ? 0.9 - (Double(index) / Double(count - 1)) * 0.75 : 0.9
            return distributeOnLine(count: playersInLine, y: y)
        }
    }

    /// Distribue N joueurs horizontalement sur une ligne à Y donné
    private func distributeOnLine(count: Int, y: Double) -> [CGPoint] {
        guard count > 0 else { return [] }
        if count == 1 {
            return [CGPoint(x: 0.5, y: y)]
        }
        let margin = 0.12
        let spacing = (1.0 - 2 * margin) / Double(count - 1)
        return (0..<count).map { i in
            CGPoint(x: margin + spacing * Double(i), y: y)
        }
    }

    enum Formation {
        case auto, f442, f433, f343, f352, f532, f4231, f4141

        /// Joueurs par ligne, gardien compris
        var lines: [Int] {
            switch self {
            case .auto: return []
            case .f442: return [1, 4, 4, 2]
            case .f433: return [1, 4, 3, 3]
            case .f343: return [1, 3, 4, 3]
            case .f352: return [1, 3, 5, 2]
            case .f532: return [1, 5, 3, 2]
            case .f4231: return [1, 4, 2, 3, 1]
            case .f4141: return [1, 4, 1, 4, 1]
            }
        }

        var displayName: String {
            switch self {
            case .auto: return "Auto"
            case .f442: return "4-4-2"
            case .f433: return "4-3-3"
            case .f343: return "3-4-3"
            case .f352: return "3-5-2"
            case .f532: return "5-3-2"
            case .f4231: return "4-2-3-1"
            case .f4141: return "4-1-4-1"
            }
        }
    }
}

// MARK: - Jeton joueur

private struct PlayerToken: View {
    let player: MatchPlayer
    let jerseyColor: JerseyColor
    var isCaptain: Bool = false
    var isSmall: Bool = false
    var isDragging: Bool = false
    var hasBall: Bool = false

    private var size: CGFloat { isSmall ? 40 : 48 }
    private var hasName: Bool { !(player.firstName.isEmpty && player.lastName.isEmpty) }

    var body: some View {
        VStack(spacing: 2) {
            ZStack {
                Circle()
                    .fill(jerseyColor.color)
                    .frame(width: size, height: size)
                    .shadow(color: .black.opacity(isDragging ? 0.4 : 0.25), radius: isDragging ? 6 : 3, x: 0, y: isDragging ? 4 : 2)
                    .overlay(Circle().strokeBorder(Color.yellow, lineWidth: hasBall ? 3 : 0))
                    .scaleEffect(isDragging ? 1.15 : 1.0)

                Text("\(player.shirtNumber)")
                    .font(.system(size: size * 0.38, weight: .bold, design: .rounded))
                    .foregroundColor(jerseyColor.textColor)

                if isCaptain {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.yellow)
                        .offset(x: size * 0.35, y: -size * 0.35)
                }

                // Indicateur de poste
                if !isSmall && hasName {
                    Text(player.position.shortName)
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 3)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(.black.opacity(0.5)))
                        .offset(y: size * 0.42)
                }
            }

            Text(hasName ? player.displayName : " ")
                .font(.system(size: isSmall ? 9 : 10, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .frame(width: isSmall ? 55 : 65)
        }
        .animation(.easeInOut(duration: 0.15), value: isDragging)
    }
}

// MARK: - Jeton joueur adverse

private struct OpponentPlayerToken: View {
    let number: Int
    let jerseyColor: JerseyColor
    var isDragging: Bool = false
    var hasBall: Bool = false

    private let size: CGFloat = 42

    var body: some View {
        VStack(spacing: 1) {
            ZStack {
                Circle()
                    .fill(jerseyColor.color)
                    .frame(width: size, height: size)
                    .overlay(
                        Circle()
                            .strokeBorder(hasBall ? Color.yellow : .white.opacity(0.6), lineWidth: hasBall ? 3 : 2, antialiased: true)
                    )
                    .shadow(color: .black.opacity(isDragging ? 0.4 : 0.2), radius: isDragging ? 5 : 2, x: 0, y: 2)
                    .scaleEffect(isDragging ? 1.15 : 1.0)

                Text("\(number)")
                    .font(.system(size: size * 0.36, weight: .bold, design: .rounded))
                    .foregroundColor(jerseyColor.textColor)
            }

            Text("ADV")
                .font(.system(size: 7, weight: .bold))
                .foregroundStyle(.secondary)
        }
        .animation(.easeInOut(duration: 0.15), value: isDragging)
    }
}

// MARK: - Tracé tactique

private struct DrawingPath: View {
    let points: [CGPoint]
    let pitchSize: CGSize

    var body: some View {
        Path { path in
            guard let first = points.first else { return }
            path.move(to: CGPoint(x: first.x * pitchSize.width, y: first.y * pitchSize.height))
            for point in points.dropFirst() {
                path.addLine(to: CGPoint(x: point.x * pitchSize.width, y: point.y * pitchSize.height))
            }
        }
        .stroke(.yellow, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))

        // Flèche au bout du tracé
        if points.count >= 2 {
            let last = points[points.count - 1]
            let prev = points[points.count - 2]
            let lx = last.x * pitchSize.width
            let ly = last.y * pitchSize.height
            let px = prev.x * pitchSize.width
            let py = prev.y * pitchSize.height
            let angle = atan2(ly - py, lx - px)
            let arrowLen: CGFloat = 12

            Path { path in
                path.move(to: CGPoint(x: lx, y: ly))
                path.addLine(to: CGPoint(
                    x: lx - arrowLen * cos(angle - .pi / 6),
                    y: ly - arrowLen * sin(angle - .pi / 6)
                ))
                path.move(to: CGPoint(x: lx, y: ly))
                path.addLine(to: CGPoint(
                    x: lx - arrowLen * cos(angle + .pi / 6),
                    y: ly - arrowLen * sin(angle + .pi / 6)
                ))
            }
            .stroke(.yellow, style: StrokeStyle(lineWidth: 3, lineCap: .round))
        }
    }
}

// MARK: - Tracé du terrain

private struct PitchMarkings: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height

            Canvas { context, size in
                let lineColor = Color.white.opacity(0.7)
                let lineWidth: CGFloat = 1.5

                // Contour
                let rect = CGRect(x: 8, y: 8, width: w - 16, height: h - 16)
                context.stroke(Path(rect), with: .color(lineColor), lineWidth: lineWidth)

                // Ligne médiane
                let midY = h / 2
                context.stroke(Path { p in
                    p.move(to: CGPoint(x: 8, y: midY))
                    p.addLine(to: CGPoint(x: w - 8, y: midY))
                }, with: .color(lineColor), lineWidth: lineWidth)

                // Rond central
                let centerR: CGFloat = min(w, h) * 0.1
                context.stroke(
                    Path(ellipseIn: CGRect(x: w/2 - centerR, y: midY - centerR, width: centerR * 2, height: centerR * 2)),
                    with: .color(lineColor),
                    lineWidth: lineWidth
                )

                // Point central
                context.fill(
                    Path(ellipseIn: CGRect(x: w/2 - 3, y: midY - 3, width: 6, height: 6)),
                    with: .color(lineColor)
                )

                // Surface de réparation haut
                let penW: CGFloat = (w - 16) * 0.55
                let penH: CGFloat = h * 0.14
                let penX = (w - penW) / 2
                context.stroke(Path(CGRect(x: penX, y: 8, width: penW, height: penH)),
                               with: .color(lineColor), lineWidth: lineWidth)

                // Surface de but haut
                let goalW: CGFloat = (w - 16) * 0.25
                let goalH: CGFloat = h * 0.05
                let goalX = (w - goalW) / 2
                context.stroke(Path(CGRect(x: goalX, y: 8, width: goalW, height: goalH)),
                               with: .color(lineColor), lineWidth: lineWidth)

                // Surface de réparation bas
                context.stroke(Path(CGRect(x: penX, y: h - 8 - penH, width: penW, height: penH)),
                               with: .color(lineColor), lineWidth: lineWidth)

                // Surface de but bas
                context.stroke(Path(CGRect(x: goalX, y: h - 8 - goalH, width: goalW, height: goalH)),
                               with: .color(lineColor), lineWidth: lineWidth)

                // Arcs de corner
                let cornerR: CGFloat = 10
                // Haut gauche
                context.stroke(Path { p in p.addArc(center: CGPoint(x: 8, y: 8), radius: cornerR, startAngle: .zero, endAngle: .degrees(90), clockwise: false) },
                               with: .color(lineColor), lineWidth: lineWidth)
                // Haut droit
                context.stroke(Path { p in p.addArc(center: CGPoint(x: w - 8, y: 8), radius: cornerR, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false) },
                               with: .color(lineColor), lineWidth: lineWidth)
                // Bas gauche
                context.stroke(Path { p in p.addArc(center: CGPoint(x: 8, y: h - 8), radius: cornerR, startAngle: .degrees(270), endAngle: .zero, clockwise: false) },
                               with: .color(lineColor), lineWidth: lineWidth)
                // Bas droit
                context.stroke(Path { p in p.addArc(center: CGPoint(x: w - 8, y: h - 8), radius: cornerR, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false) },
                               with: .color(lineColor), lineWidth: lineWidth)
            }
        }
    }
}

private struct PitchShape: Shape {
    func path(in rect: CGRect) -> Path {
        Path(roundedRect: rect, cornerRadius: 8)
    }
}
