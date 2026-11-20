//
//  AtelierEditorView.swift
//  Temps De Jeu
//
//  Atelier : éditeur d'exercice en plein écran.
//  Le terrain occupe toute la place (il pivote à l'horizontale si c'est plus
//  grand). En bas (ou sur le côté en paysage) : le réglage de l'objet choisi,
//  les vignettes de l'animation et le tiroir de matériel.
//
//  Gestes : toucher un outil puis toucher le terrain pour poser (l'outil reste
//  actif) ; glisser un objet pour le déplacer ; glisser le ballon sur un joueur
//  pour une passe. Tout le reste est un bouton visible.
//

import SwiftUI

struct AtelierEditorView: View {
    let onSave: (TacticPlay) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var model: AtelierEditorModel
    @State private var path: [AtelierRoute] = []
    @State private var drag: AtelierDrag?
    @State private var previewStart: Date?
    @State private var showCinema = false
    @State private var renameDraft = ""
    @State private var showRename = false
    @State private var labelDraft = ""
    @State private var labelTarget: String?
    @State private var confirmClear = false

    init(play: TacticPlay, startVignette: Int = 0, onSave: @escaping (TacticPlay) -> Void) {
        self.onSave = onSave
        let model = AtelierEditorModel(play: play)
        model.vignette = min(max(0, startVignette), max(0, model.stepCount - 1))
        _model = StateObject(wrappedValue: model)
    }

    var body: some View {
        NavigationStack(path: $path) {
            GeometryReader { geo in
                let wide = geo.size.width > geo.size.height && geo.size.width > 600
                Group {
                    if wide {
                        HStack(spacing: 0) {
                            pitchArea
                            Divider()
                            sidePanel
                                .frame(width: min(360, max(300, geo.size.width * 0.3)))
                        }
                    } else {
                        VStack(spacing: 0) {
                            topBar
                            evolutionBar
                            pitchArea
                            bottomPanel
                        }
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: AtelierRoute.self) { route in
                switch route {
                case .fiche: AtelierFichePage(model: model)
                case .step(let index): AtelierStepPage(model: model, index: index)
                case .evolution(let index): AtelierEvolutionPage(model: model, index: index)
                }
            }
        }
        .fullScreenCover(isPresented: $showCinema) {
            TacticPlayerView(play: model.finalized(), cinema: true, initialEvolution: model.evolution)
        }
        .alert("Nom de l'exercice", isPresented: $showRename) {
            TextField("Nom", text: $renameDraft)
            Button("OK") {
                let name = renameDraft.trimmingCharacters(in: .whitespaces)
                if !name.isEmpty { model.updateInfo { $0.title = name } }
            }
            Button("Annuler", role: .cancel) {}
        }
        .alert("Numéro sur la chasuble", isPresented: Binding(get: { labelTarget != nil }, set: { if !$0 { labelTarget = nil } })) {
            TextField("Numéro ou lettre", text: $labelDraft)
            Button("OK") {
                if let labelTarget { model.setLabel(labelTarget, labelDraft) }
                labelTarget = nil
            }
            Button("Annuler", role: .cancel) { labelTarget = nil }
        } message: {
            Text("3 caractères au plus (7, A, G1…)")
        }
        .confirmationDialog("Vider le terrain ?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Tout enlever", role: .destructive) { model.clearAll() }
        } message: {
            Text("Joueurs, matériel et étapes de cette version. Vous pourrez annuler.")
        }
    }

    // MARK: - Fermer

    private func close() {
        stopPreview()
        if model.isDirty && !model.isEmpty {
            onSave(model.finalized())
        }
        dismiss()
    }

    // MARK: - Barre du haut (portrait)

    private var topBar: some View {
        HStack(spacing: 8) {
            Button(action: close) {
                Label("Terminé", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.bold())
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("atelier-termine")

            Button {
                renameDraft = model.play.title
                showRename = true
            } label: {
                HStack(spacing: 4) {
                    Text(model.play.title)
                        .font(.headline)
                        .lineLimit(1)
                    Image(systemName: "pencil")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)

            Button {
                path.append(.fiche)
            } label: {
                Label("Fiche", systemImage: "doc.text")
                    .font(.subheadline)
            }
            .buttonStyle(.bordered)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }

    // MARK: - Évolutions

    private var evolutionBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                evolutionChip(title: "Exercice de base", index: nil)
                ForEach(Array(model.play.evolutionList.enumerated()), id: \.element.id) { index, evo in
                    evolutionChip(title: evo.title, index: index)
                }
                Button {
                    model.addEvolution()
                } label: {
                    Label("Évolution", systemImage: "plus")
                        .font(.caption.bold())
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Capsule().strokeBorder(Color.accentColor, style: StrokeStyle(lineWidth: 1.2, dash: [4, 3])))
                }
                .buttonStyle(.plain)
                .foregroundStyle(Color.accentColor)
                .accessibilityIdentifier("atelier-ajout-evolution")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
        }
    }

    private func evolutionChip(title: String, index: Int?) -> some View {
        let selected = model.evolution == index
        return Button {
            if selected, let index {
                path.append(.evolution(index))
            } else {
                stopPreview()
                model.selectEvolution(index)
            }
        } label: {
            HStack(spacing: 4) {
                Text(title).lineLimit(1)
                if selected && index != nil {
                    Image(systemName: "pencil").font(.caption2)
                }
            }
            .font(.caption.bold())
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Capsule().fill(selected ? Color.accentColor : Color(.tertiarySystemFill)))
            .foregroundStyle(selected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Terrain

    private var pitchArea: some View {
        GeometryReader { geo in
            let vp = AtelierViewport(framing: model.framing, size: geo.size)
            ZStack(alignment: .top) {
                SwiftUI.TimelineView(.animation(minimumInterval: nil, paused: previewStart == nil)) { timeline in
                    Canvas { ctx, _ in
                        drawScene(ctx, vp, now: timeline.date)
                    }
                }
                .contentShape(Rectangle())
                .gesture(pitchGesture(vp))
                .accessibilityIdentifier("atelier-terrain")

                accessibilityLayer(vp)

                pitchOverlay
            }
        }
        .background(AtelierRenderer.grassDark)
        .clipped()
    }

    /// Joueurs et ballon pour VoiceOver et les tests d'interface (ne capte pas les touches)
    @ViewBuilder
    private func accessibilityLayer(_ vp: AtelierViewport) -> some View {
        if previewStart == nil, let frame = model.currentFrame {
            ZStack {
                ForEach(model.content.actors) { actor in
                    if let p = frame.positions[actor.id] {
                        Color.clear
                            .frame(width: vp.playerDiameter, height: vp.playerDiameter)
                            .position(vp.screen(p))
                            .accessibilityElement()
                            .accessibilityLabel(actor.isGoalkeeper ? "Gardien \(actor.bibColor.displayName)"
                                                                   : "Joueur \(actor.bibColor.displayName) \(actor.label)")
                            .accessibilityIdentifier("atelier-joueur-\(actor.bibColor.rawValue)-\(actor.label)")
                    }
                }
                if model.hasBall {
                    Color.clear
                        .frame(width: 22, height: 22)
                        .position(AtelierRenderer.ballScreenPoint(frame, vp))
                        .accessibilityElement()
                        .accessibilityLabel("Ballon")
                        .accessibilityIdentifier("atelier-ballon")
                }
            }
            .allowsHitTesting(false)
        }
    }

    private var pitchOverlay: some View {
        HStack(alignment: .top, spacing: 8) {
            HStack(spacing: 0) {
                overlayButton("arrow.uturn.backward", label: "Annuler", disabled: !model.canUndo) { model.undo() }
                    .keyboardShortcut("z", modifiers: .command)
                overlayButton("arrow.uturn.forward", label: "Rétablir", disabled: !model.canRedo) { model.redo() }
                    .keyboardShortcut("z", modifiers: [.command, .shift])
            }
            .background(.ultraThinMaterial, in: Capsule())

            Spacer()

            if previewStart != nil {
                Button {
                    stopPreview()
                } label: {
                    Label("Arrêter l'aperçu", systemImage: "stop.fill")
                        .font(.caption.bold())
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial, in: Capsule())
                }
                .buttonStyle(.plain)
            }

            Spacer()

            Menu {
                Section("Partie du terrain") {
                    framingButton("Terrain entier", .full, "rectangle.portrait")
                    framingButton("Demi-terrain (attaque)", .attackingHalf, "rectangle.tophalf.filled")
                    framingButton("Demi-terrain (défense)", .defendingHalf, "rectangle.bottomhalf.filled")
                    framingButton("Zone de 40 × 40 m", .center, "square")
                    Button {
                        model.fitFraming()
                    } label: {
                        Label("Ajuster à l'exercice", systemImage: "arrow.up.left.and.down.right.magnifyingglass")
                    }
                }
                Section {
                    Toggle(isOn: $model.showGrid) {
                        Label("Quadrillage tous les 5 m", systemImage: "grid")
                    }
                    Button(role: .destructive) {
                        confirmClear = true
                    } label: {
                        Label("Vider le terrain", systemImage: "trash")
                    }
                }
            } label: {
                Image(systemName: "viewfinder")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 36)
                    .background(.ultraThinMaterial, in: Capsule())
            }
            .accessibilityLabel("Cadrage du terrain")
        }
        .foregroundStyle(.primary)
        .padding(8)
    }

    private func framingButton(_ title: String, _ framing: TacticFraming, _ icon: String) -> some View {
        Button {
            model.setFraming(framing)
        } label: {
            if model.framing == framing {
                Label(title, systemImage: "checkmark")
            } else {
                Label(title, systemImage: icon)
            }
        }
    }

    private func overlayButton(_ icon: String, label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 40, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.35 : 1)
        .accessibilityLabel(label)
    }

    // MARK: - Dessin de la scène

    private func drawScene(_ ctx: GraphicsContext, _ vp: AtelierViewport, now: Date) {
        AtelierRenderer.drawPitch(ctx, vp, grid: model.showGrid)
        let content = model.content
        let play = model.current
        let frames = model.frames
        let selection = previewStart == nil ? model.selection : nil

        for (i, prop) in content.props.enumerated() where prop.kind == .zone {
            AtelierRenderer.drawProp(ctx, vp, prop, selected: selection == .prop(i))
        }
        for (i, prop) in content.props.enumerated() where prop.kind != .zone {
            AtelierRenderer.drawProp(ctx, vp, prop, selected: selection == .prop(i))
        }
        guard !frames.isEmpty else { return }
        let trim = vp.playerDiameter * 0.5

        // Aperçu animé
        if let previewStart {
            let playback = AtelierPlayback(play: play)
            guard let (step, t) = playback.position(at: now.timeIntervalSince(previewStart)) else {
                DispatchQueue.main.async { finishPreview() }
                drawStill(ctx, vp, frame: frames[frames.count - 1], play: play)
                return
            }
            if step > 0 {
                for arrow in play.arrows(forStep: step, frames: frames) {
                    AtelierRenderer.drawArrow(ctx, vp, arrow, trimStart: trim, trimEnd: trim, opacity: 0.55)
                }
            }
            let before = frames[max(0, step - 1)], after = frames[step]
            let e = AtelierPlayback.ease(t)
            var positions: [String: TacticPoint] = [:]
            for actor in play.actors {
                guard let p1 = after.positions[actor.id] else { continue }
                let p0 = before.positions[actor.id] ?? p1
                positions[actor.id] = p0.interpolated(to: p1, t: e)
                AtelierRenderer.drawActor(ctx, vp, actor, at: positions[actor.id]!,
                                          highlighted: play.steps[step].highlight?.contains(actor.id) ?? false)
            }
            if play.hasBall {
                var frameNow = after
                frameNow.positions = positions
                let carried = before.ballHolder != nil && before.ballHolder == after.ballHolder
                let ball: CGPoint
                if carried || step == 0 {
                    ball = AtelierRenderer.ballScreenPoint(frameNow, vp)
                } else {
                    let a = AtelierRenderer.ballScreenPoint(before, vp)
                    let b = AtelierRenderer.ballScreenPoint(after, vp)
                    ball = CGPoint(x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e)
                }
                let lift = play.isAerial(step: step) ? 1 + 0.6 * sin(.pi * e) : 1
                AtelierRenderer.drawBallGlyph(ctx, at: ball, diameter: 17 * lift)
            }
            return
        }

        let k = min(model.vignette, frames.count - 1)
        let frame = frames[k]

        // Vignette suivante : position d'avant en transparence + flèches calculées
        if k > 0 {
            let before = frames[k - 1]
            for actor in content.actors {
                guard let p0 = before.positions[actor.id], let p1 = frame.positions[actor.id],
                      p0.distance(to: p1) > 0.008 else { continue }
                AtelierRenderer.drawActor(ctx, vp, actor, at: p0, ghost: true)
            }
            for arrow in play.arrows(forStep: k, frames: frames) {
                AtelierRenderer.drawArrow(ctx, vp, arrow, trimStart: trim, trimEnd: trim)
            }
        }

        // Ligne de plots ou zone en cours de tracé
        if let drag, drag.moved, drag.target == nil {
            if model.tool == .line {
                let a = vp.pitch(drag.start), b = vp.pitch(drag.current)
                let meters = hypot((b.x - a.x) * AtelierViewport.pitchWidth, (b.y - a.y) * AtelierViewport.pitchLength)
                let count = max(2, min(20, Int((meters / 3).rounded()) + 1))
                var line = Path()
                line.move(to: drag.start)
                line.addLine(to: drag.current)
                ctx.stroke(line, with: .color(.white.opacity(0.6)), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                for i in 0..<count {
                    let p = a.interpolated(to: b, t: Double(i) / Double(count - 1))
                    AtelierRenderer.drawProp(ctx, vp, TacticProp(kind: .plot, position: p, color: model.propColor.rawValue),
                                             selected: false)
                }
                ctx.draw(Text("\(count) plots · \(Int(meters.rounded())) m").font(.caption.bold()).foregroundColor(.white),
                         at: CGPoint(x: drag.current.x, y: drag.current.y - 24))
            } else if model.tool == .prop(.zone) {
                let rect = CGRect(x: min(drag.start.x, drag.current.x), y: min(drag.start.y, drag.current.y),
                                  width: abs(drag.current.x - drag.start.x), height: abs(drag.current.y - drag.start.y))
                ctx.fill(Path(rect), with: .color(.white.opacity(0.15)))
                ctx.stroke(Path(rect), with: .color(.white), style: StrokeStyle(lineWidth: 2, dash: [7, 5]))
                let a = vp.pitch(drag.start), b = vp.pitch(drag.current)
                let text = AtelierRenderer.zoneMeters(TacticPoint(x: abs(b.x - a.x), y: abs(b.y - a.y)))
                ctx.draw(Text(text).font(.caption.bold()).foregroundColor(.white), at: CGPoint(x: rect.midX, y: rect.midY))
            }
        }

        // Joueurs
        let draggingBall = drag?.moved == true && drag?.target == .ball
        let receiver = draggingBall ? drag.flatMap { actorNear($0.current, vp: vp) } : nil
        for actor in content.actors {
            guard let p = frame.positions[actor.id] else { continue }
            AtelierRenderer.drawActor(ctx, vp, actor, at: p, selected: selection == .actor(actor.id),
                                      highlighted: receiver == actor.id)
        }

        // Ballon (suit le doigt pendant qu'on le glisse)
        if model.hasBall {
            let point = draggingBall ? drag!.current : AtelierRenderer.ballScreenPoint(frame, vp)
            AtelierRenderer.drawBall(ctx, at: point, selected: selection == .ball)
        }
    }

    private func drawStill(_ ctx: GraphicsContext, _ vp: AtelierViewport, frame: TacticFrame, play: TacticPlay) {
        for actor in play.actors {
            guard let p = frame.positions[actor.id] else { continue }
            AtelierRenderer.drawActor(ctx, vp, actor, at: p)
        }
        if play.hasBall {
            AtelierRenderer.drawBall(ctx, at: AtelierRenderer.ballScreenPoint(frame, vp), selected: false)
        }
    }

    // MARK: - Gestes sur le terrain

    private func pitchGesture(_ vp: AtelierViewport) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard previewStart == nil else { return }
                if drag == nil {
                    let target = hitTest(value.startLocation, vp: vp)
                    var grab = CGSize.zero
                    if let target, let center = screenCenter(of: target, vp: vp) {
                        grab = CGSize(width: center.x - value.startLocation.x, height: center.y - value.startLocation.y)
                    }
                    drag = AtelierDrag(start: value.startLocation, current: value.location, target: target, grab: grab)
                }
                guard var current = drag else { return }
                current.current = value.location
                let distance = hypot(value.location.x - current.start.x, value.location.y - current.start.y)
                if !current.moved && distance > 6 {
                    current.moved = true
                    if let target = current.target {
                        model.checkpoint()
                        switch target {
                        case .actor(let id): model.selection = .actor(id)
                        case .prop(let i), .zoneHandle(let i): model.selection = .prop(i)
                        case .ball: model.selection = .ball
                        }
                    }
                }
                if current.moved, let target = current.target {
                    let point = CGPoint(x: value.location.x + current.grab.width, y: value.location.y + current.grab.height)
                    switch target {
                    case .actor(let id): model.moveActor(id, to: vp.pitch(point))
                    case .prop(let i): model.moveProp(i, to: vp.pitch(point))
                    case .zoneHandle(let i): model.resizeZone(i, corner: vp.pitch(value.location))
                    case .ball: break
                    }
                }
                drag = current
            }
            .onEnded { value in
                defer { drag = nil }
                guard previewStart == nil, let current = drag else { return }
                if !current.moved {
                    handleTap(at: current.start, vp: vp)
                    return
                }
                switch current.target {
                case .ball:
                    model.dropBall(at: vp.pitch(value.location), onto: actorNear(value.location, vp: vp))
                case nil:
                    if model.tool == .line {
                        model.addLine(from: vp.pitch(current.start), to: vp.pitch(value.location))
                    } else if model.tool == .prop(.zone) {
                        let a = vp.pitch(current.start), b = vp.pitch(value.location)
                        let size = TacticPoint(x: abs(b.x - a.x), y: abs(b.y - a.y))
                        if size.x * AtelierViewport.pitchWidth >= 3 && size.y * AtelierViewport.pitchLength >= 3 {
                            let index = model.addProp(.zone, at: TacticPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2), size: size)
                            model.selection = .prop(index)
                        }
                    }
                default:
                    break
                }
            }
    }

    private func handleTap(at point: CGPoint, vp: AtelierViewport) {
        let target = hitTest(point, vp: vp)
        let onEmpty: Bool = {
            guard let target else { return true }
            if case .prop(let i) = target, model.content.props[safe: i]?.kind == .zone { return true }
            return false
        }()
        let location = vp.pitch(point)

        switch model.tool {
        case .player?, .goalkeeper?:
            if onEmpty {
                let id = model.addPlayer(at: location, goalkeeper: model.tool == .goalkeeper)
                model.selection = .actor(id)
            } else {
                select(target)
            }
        case .prop(let kind)?:
            // Une zone ne se pose pas sur une autre zone : on la sélectionne
            if onEmpty && (kind != .zone || target == nil) {
                let index = model.addProp(kind, at: location)
                model.selection = .prop(index)
            } else {
                select(target)
            }
        case .ball?:
            if case .actor(let id)? = target {
                model.placeBall(at: location, holder: id)
            } else {
                model.placeBall(at: location, holder: nil)
            }
            model.tool = nil
        case .line?:
            if onEmpty {
                let half = 6 / AtelierViewport.pitchWidth
                model.addLine(from: TacticPoint(x: location.x - half, y: location.y),
                              to: TacticPoint(x: location.x + half, y: location.y))
            } else {
                select(target)
            }
        case nil:
            select(target)
        }
    }

    private func select(_ target: AtelierHit?) {
        switch target {
        case .actor(let id)?: model.selection = .actor(id)
        case .prop(let i)?, .zoneHandle(let i)?: model.selection = .prop(i)
        case .ball?: model.selection = .ball
        case nil: model.selection = nil
        }
    }

    private func hitTest(_ point: CGPoint, vp: AtelierViewport) -> AtelierHit? {
        let content = model.content
        guard let frame = model.currentFrame else { return nil }
        func dist(_ a: CGPoint) -> CGFloat { hypot(a.x - point.x, a.y - point.y) }

        if case .prop(let i) = model.selection, let prop = content.props[safe: i], prop.kind == .zone,
           dist(AtelierRenderer.zoneHandle(prop, vp)) < 24 {
            return .zoneHandle(i)
        }
        var best: (AtelierHit, CGFloat)?
        func consider(_ hit: AtelierHit, _ d: CGFloat, radius: CGFloat) {
            guard d <= radius else { return }
            if best == nil || d < best!.1 { best = (hit, d) }
        }
        if model.hasBall {
            consider(.ball, dist(AtelierRenderer.ballScreenPoint(frame, vp)) - 5, radius: 15)
        }
        let r = vp.playerDiameter / 2 + 6
        for actor in content.actors {
            guard let p = frame.positions[actor.id] else { continue }
            consider(.actor(actor.id), dist(vp.screen(p)), radius: r)
        }
        for (i, prop) in content.props.enumerated() where prop.kind != .zone {
            let s = AtelierRenderer.propSize(prop.kind, vp)
            consider(.prop(i), dist(vp.screen(prop.position)) + 2, radius: max(18, max(s.width, s.height) / 2 + 4))
        }
        if let best { return best.0 }
        let zones = content.props.enumerated().filter { _, prop in
            prop.kind == .zone && vp.rect(center: prop.position, size: prop.size ?? TacticPoint(x: 0.2, y: 0.15)).contains(point)
        }
        let smallest = zones.min { a, b in
            let sa = a.element.size ?? TacticPoint(x: 0.2, y: 0.15), sb = b.element.size ?? TacticPoint(x: 0.2, y: 0.15)
            return sa.x * sa.y < sb.x * sb.y
        }
        return smallest.map { .prop($0.offset) }
    }

    private func screenCenter(of target: AtelierHit, vp: AtelierViewport) -> CGPoint? {
        guard let frame = model.currentFrame else { return nil }
        switch target {
        case .actor(let id): return frame.positions[id].map(vp.screen)
        case .prop(let i): return model.content.props[safe: i].map { vp.screen($0.position) }
        case .zoneHandle: return nil
        case .ball: return nil
        }
    }

    /// Joueur sous le doigt (pour recevoir le ballon)
    private func actorNear(_ point: CGPoint, vp: AtelierViewport) -> String? {
        guard let frame = model.currentFrame else { return nil }
        let radius = vp.playerDiameter * 0.8
        var best: (String, CGFloat)?
        for actor in model.content.actors {
            guard let p = frame.positions[actor.id] else { continue }
            let s = vp.screen(p)
            let d = hypot(s.x - point.x, s.y - point.y)
            if d < radius, best == nil || d < best!.1 { best = (actor.id, d) }
        }
        return best?.0
    }

    // MARK: - Aperçu 2D

    private func startPreview() {
        model.selection = nil
        model.tool = nil
        previewStart = Date()
    }

    private func stopPreview() {
        previewStart = nil
    }

    private func finishPreview() {
        guard previewStart != nil else { return }
        previewStart = nil
        model.vignette = max(0, model.stepCount - 1)
    }

    // MARK: - Panneau du bas (portrait)

    private var bottomPanel: some View {
        VStack(spacing: 0) {
            contextBar
                .frame(minHeight: 50)
            Divider()
            vignetteStrip
            Divider()
            toolDrawer
        }
        .background(.regularMaterial)
    }

    // MARK: - Panneau latéral (paysage)

    private var sidePanel: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Button(action: close) {
                    Label("Terminé", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.bold())
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("atelier-termine")
                Spacer()
                Button {
                    path.append(.fiche)
                } label: {
                    Label("Fiche", systemImage: "doc.text")
                        .font(.subheadline)
                }
                .buttonStyle(.bordered)
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)

            Button {
                renameDraft = model.play.title
                showRename = true
            } label: {
                HStack(spacing: 4) {
                    Text(model.play.title)
                        .font(.headline)
                        .multilineTextAlignment(.leading)
                    Image(systemName: "pencil")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            evolutionBar
            Divider().padding(.top, 4)
            vignetteStrip
            Divider()
            contextBar
                .frame(minHeight: 56)
            Divider()
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 66), spacing: 6)], spacing: 6) {
                    shortcutsMenu
                    ForEach(AtelierToolItem.all) { item in
                        toolButton(item)
                    }
                }
                .padding(10)
            }
        }
        .background(.regularMaterial)
    }

    // MARK: - Réglages de l'objet choisi

    @ViewBuilder
    private var contextBar: some View {
        let content = model.content
        Group {
            switch model.selection {
            case .actor(let id):
                if let actor = content.actors.first(where: { $0.id == id }) {
                    actorContext(actor)
                } else {
                    hintBar
                }
            case .prop(let index):
                if let prop = content.props[safe: index] {
                    propContext(prop)
                } else {
                    hintBar
                }
            case .ball:
                ballContext
            case nil:
                if let tool = model.tool { toolContext(tool) } else { hintBar }
            }
        }
        .padding(.vertical, 6)
    }

    private var hintBar: some View {
        HStack(spacing: 10) {
            Image(systemName: model.vignette == 0 ? "hand.point.up.left.fill" : "film")
                .font(.title3)
                .foregroundStyle(Color.accentColor)
            Text(hintText)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
    }

    private var hintText: String {
        if model.vignette == 0 {
            return model.content.actors.isEmpty && model.content.props.isEmpty
                ? "Choisissez un élément en bas (ou un raccourci ✨), puis touchez le terrain pour le poser."
                : "Mise en place : touchez un objet pour le régler, glissez-le pour le déplacer. « + » ajoute une étape."
        }
        return "Étape \(model.vignette) : déplacez joueurs et ballon. Glissez le ballon sur un joueur pour une passe. Les flèches se tracent seules."
    }

    private func toolContext(_ tool: AtelierTool) -> some View {
        HStack(spacing: 10) {
            Text(toolHint(tool))
                .font(.footnote.bold())
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 4)
            if toolHasColor(tool) {
                colorRow(selected: tool == .player ? model.bibColor : model.propColor) { color in
                    model.setColor(color)
                }
            }
            Button {
                model.tool = nil
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Ranger l'outil")
        }
        .padding(.horizontal, 12)
    }

    private func toolHasColor(_ tool: AtelierTool) -> Bool {
        switch tool {
        case .player, .line: return true
        case .prop(let kind): return kind.hasColor && kind != .zone
        default: return false
        }
    }

    private func toolHint(_ tool: AtelierTool) -> String {
        switch tool {
        case .player: return "Touchez le terrain pour poser des joueurs"
        case .goalkeeper: return "Touchez le terrain pour poser un gardien"
        case .ball: return "Touchez un joueur (ou le terrain) pour poser le ballon"
        case .line: return "Glissez sur le terrain : un plot tous les 3 m"
        case .prop(.zone): return "Glissez pour tracer une zone, ou touchez pour 20 × 15 m"
        case .prop(let kind): return "Touchez le terrain pour poser : \(kind.displayName.lowercased())"
        }
    }

    private func actorContext(_ actor: TacticActor) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                colorRow(selected: actor.bibColor) { model.setColor($0) }
                Divider().frame(height: 30)
                contextButton("soccerball", "Ballon") { model.giveBall(to: actor.id) }
                contextButton("number", "N° \(actor.label)") {
                    labelDraft = actor.label
                    labelTarget = actor.id
                }
                contextButton(actor.isGoalkeeper ? "hand.raised.slash" : "hand.raised.fill",
                              actor.isGoalkeeper ? "Joueur" : "Gardien") { model.toggleGoalkeeper(actor.id) }
                if model.actorMoved(actor.id) {
                    contextButton("arrow.uturn.backward.circle", "Ne bouge pas") { model.resetActorMove(actor.id) }
                }
                contextButton("plus.square.on.square", "Copier") { model.duplicateSelected() }
                contextButton("trash", "Enlever", role: .destructive) { model.deleteSelected() }
                    .keyboardShortcut(.delete, modifiers: [])
            }
            .padding(.horizontal, 12)
        }
    }

    private func propContext(_ prop: TacticProp) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Text(prop.kind == .zone ? "Zone \(AtelierRenderer.zoneMeters(prop.size ?? TacticPoint(x: 0.2, y: 0.15)))"
                                         : prop.kind.displayName)
                    .font(.footnote.bold())
                if prop.kind.hasColor {
                    colorRow(selected: prop.atelierColor) { model.setColor($0) }
                }
                Divider().frame(height: 30)
                if prop.kind.isRotatable {
                    contextButton("rotate.right", "Tourner") { model.rotateSelected(by: 45) }
                }
                contextButton("plus.square.on.square", "Copier") { model.duplicateSelected() }
                contextButton("trash", "Enlever", role: .destructive) { model.deleteSelected() }
                    .keyboardShortcut(.delete, modifiers: [])
            }
            .padding(.horizontal, 12)
        }
    }

    private var ballContext: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if model.ballMovedInVignette {
                    Text("Le ballon :")
                        .font(.footnote.bold())
                    ForEach(AtelierEditorModel.BallKind.allCases) { kind in
                        let selected = model.ballKind == kind
                        Button {
                            model.setBallKind(kind)
                        } label: {
                            Label(kind.rawValue, systemImage: kind.icon)
                                .font(.footnote.bold())
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(Capsule().fill(selected ? Color.accentColor : Color(.tertiarySystemFill)))
                                .foregroundStyle(selected ? Color.white : Color.primary)
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    Text(model.vignette == 0 ? "Glissez le ballon sur un joueur pour le lui donner."
                                             : "Glissez le ballon sur un partenaire (passe) ou vers le but (tir).")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Divider().frame(height: 30)
                contextButton("trash", "Enlever", role: .destructive) { model.deleteSelected() }
            }
            .padding(.horizontal, 12)
        }
    }

    private func colorRow(selected: AtelierColor, onPick: @escaping (AtelierColor) -> Void) -> some View {
        HStack(spacing: 5) {
            ForEach(AtelierColor.allCases) { color in
                Button {
                    onPick(color)
                } label: {
                    Circle()
                        .fill(color.color)
                        .frame(width: 26, height: 26)
                        .overlay(Circle().strokeBorder(Color.black.opacity(0.2), lineWidth: 1))
                        .overlay(
                            Circle()
                                .strokeBorder(Color.accentColor, lineWidth: selected == color ? 3 : 0)
                                .padding(-4)
                        )
                        .padding(3)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(color.displayName)
            }
        }
    }

    private func contextButton(_ icon: String, _ title: String, role: ButtonRole? = nil,
                               action: @escaping () -> Void) -> some View {
        Button(role: role, action: action) {
            VStack(spacing: 2) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                Text(title)
                    .font(.system(size: 10, weight: .semibold))
                    .lineLimit(1)
            }
            .frame(minWidth: 52, minHeight: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(role == .destructive ? Color.red : Color.primary)
    }

    // MARK: - Vignettes

    private var vignetteStrip: some View {
        HStack(spacing: 6) {
            Button {
                previewStart == nil ? startPreview() : stopPreview()
            } label: {
                Image(systemName: previewStart == nil ? "play.fill" : "stop.fill")
                    .font(.system(size: 15, weight: .bold))
                    .frame(width: 38, height: 34)
                    .background(Circle().fill(Color.accentColor.opacity(0.15)))
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.accentColor)
            .disabled(model.stepCount < 2)
            .opacity(model.stepCount < 2 ? 0.35 : 1)
            .accessibilityLabel("Aperçu de l'animation")
            .keyboardShortcut(.space, modifiers: [])

            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 5) {
                        ForEach(0..<model.stepCount, id: \.self) { i in
                            vignetteChip(i).id(i)
                        }
                        Button {
                            stopPreview()
                            model.addVignette()
                        } label: {
                            Label("Étape", systemImage: "plus")
                                .font(.caption.bold())
                                .padding(.horizontal, 10)
                                .frame(height: 34)
                                .background(RoundedRectangle(cornerRadius: 9)
                                    .strokeBorder(Color.accentColor, style: StrokeStyle(lineWidth: 1.2, dash: [4, 3])))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Color.accentColor)
                        .accessibilityIdentifier("atelier-ajout-etape")
                        .id(-1)
                    }
                    .padding(.vertical, 2)
                }
                .onChange(of: model.stepCount) {
                    withAnimation { proxy.scrollTo(-1, anchor: .trailing) }
                }
            }

            Button {
                stopPreview()
                showCinema = true
            } label: {
                VStack(spacing: 1) {
                    Image(systemName: "film.stack")
                        .font(.system(size: 15, weight: .semibold))
                    Text("Cinéma")
                        .font(.system(size: 9, weight: .bold))
                }
                .frame(width: 50, height: 38)
                .background(RoundedRectangle(cornerRadius: 9).fill(Color.purple.opacity(0.15)))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.purple)
            .disabled(model.content.actors.isEmpty)
            .accessibilityIdentifier("atelier-cinema")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
    }

    private func vignetteChip(_ i: Int) -> some View {
        let selected = model.vignette == i && previewStart == nil
        let title = i == 0 ? "Départ" : "\(i)"
        return Button {
            stopPreview()
            if selected {
                path.append(.step(i))
            } else {
                model.vignette = i
                model.selection = nil
            }
        } label: {
            HStack(spacing: 3) {
                Text(title)
                if selected { Image(systemName: "pencil").font(.caption2) }
            }
            .font(.caption.bold())
            .padding(.horizontal, 10)
            .frame(minWidth: 38, minHeight: 34)
            .background(RoundedRectangle(cornerRadius: 9).fill(selected ? Color.accentColor : Color(.tertiarySystemFill)))
            .foregroundStyle(selected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(i == 0 ? "Mise en place" : "Étape \(i)")
        .contextMenu {
            Button {
                path.append(.step(i))
            } label: {
                Label("Consigne et durée", systemImage: "text.bubble")
            }
            if i > 0 {
                Button(role: .destructive) {
                    model.deleteVignette(i)
                } label: {
                    Label("Supprimer l'étape", systemImage: "trash")
                }
            }
        }
    }

    // MARK: - Tiroir de matériel

    private var toolDrawer: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                shortcutsMenu
                ForEach(AtelierToolItem.all) { item in
                    toolButton(item)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
    }

    private var shortcutsMenu: some View {
        Menu {
            Section("Délimiter") {
                ForEach(AtelierShortcut.squares) { s in shortcutButton(s) }
            }
            Section("Jeux") {
                ForEach(AtelierShortcut.games) { s in shortcutButton(s) }
            }
            Section("Parcours") {
                ForEach(AtelierShortcut.courses) { s in shortcutButton(s) }
            }
        } label: {
            AtelierToolTile(title: "Raccourcis", selected: false) {
                Image(systemName: "sparkles")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.yellow)
            }
        }
        .accessibilityIdentifier("atelier-raccourcis")
    }

    private func shortcutButton(_ shortcut: AtelierShortcut) -> some View {
        Button {
            stopPreview()
            model.vignette = 0
            model.apply(shortcut)
        } label: {
            Label(shortcut.title, systemImage: shortcut.icon)
        }
    }

    private func toolButton(_ item: AtelierToolItem) -> some View {
        let selected = model.tool == item.tool
        return Button {
            stopPreview()
            model.selection = nil
            model.tool = selected ? nil : item.tool
        } label: {
            AtelierToolTile(title: item.title, selected: selected) {
                AtelierToolGlyph(tool: item.tool, bib: model.bibColor, propColor: model.propColor)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("outil-\(item.id)")
    }
}

// MARK: - Navigation interne

enum AtelierRoute: Hashable {
    case fiche
    case step(Int)
    case evolution(Int)
}

enum AtelierHit: Equatable {
    case actor(String)
    case prop(Int)
    case zoneHandle(Int)
    case ball
}

struct AtelierDrag {
    var start: CGPoint
    var current: CGPoint
    var target: AtelierHit?
    /// Écart entre le doigt et le centre de l'objet saisi (pas de saut au départ)
    var grab: CGSize
    var moved = false
}

// MARK: - Lecture de l'aperçu

struct AtelierPlayback {
    let durations: [Double]
    static let startHold = 0.4
    static let stepHold = 0.6

    init(play: TacticPlay) {
        durations = play.steps.map { $0.duration ?? TacticStep.defaultDuration }
    }

    /// Étape en cours et avancement (0…1) ; nil quand l'aperçu est fini
    func position(at elapsed: Double) -> (Int, Double)? {
        var e = elapsed - Self.startHold
        if e < 0 { return (0, 1) }
        for i in 1..<max(1, durations.count) {
            let d = max(0.3, durations[i])
            if e < d { return (i, e / d) }
            e -= d
            if e < Self.stepHold { return (i, 1) }
            e -= Self.stepHold
        }
        return nil
    }

    static func ease(_ t: Double) -> Double {
        t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2
    }
}

// MARK: - Tiroir : éléments

struct AtelierToolItem: Identifiable {
    let id: String
    let title: String
    let tool: AtelierTool

    static let all: [AtelierToolItem] = [
        AtelierToolItem(id: "joueur", title: "Joueur", tool: .player),
        AtelierToolItem(id: "gardien", title: "Gardien", tool: .goalkeeper),
        AtelierToolItem(id: "ballon", title: "Ballon", tool: .ball),
        AtelierToolItem(id: "plot", title: "Plot", tool: .prop(.plot)),
        AtelierToolItem(id: "coupelle", title: "Coupelle", tool: .prop(.coupelle)),
        AtelierToolItem(id: "piquet", title: "Piquet", tool: .prop(.piquet)),
        AtelierToolItem(id: "mannequin", title: "Mannequin", tool: .prop(.mannequin)),
        AtelierToolItem(id: "mini-but", title: "Mini-but", tool: .prop(.miniBut)),
        AtelierToolItem(id: "but", title: "But", tool: .prop(.but)),
        AtelierToolItem(id: "zone", title: "Zone", tool: .prop(.zone)),
        AtelierToolItem(id: "ligne", title: "Ligne de plots", tool: .line),
        AtelierToolItem(id: "cerceau", title: "Cerceau", tool: .prop(.cerceau)),
        AtelierToolItem(id: "echelle", title: "Échelle", tool: .prop(.echelle)),
        AtelierToolItem(id: "haie", title: "Haie", tool: .prop(.haie)),
        AtelierToolItem(id: "ballons", title: "Ballons", tool: .prop(.ballon))
    ]
}

struct AtelierToolTile<Icon: View>: View {
    let title: String
    let selected: Bool
    @ViewBuilder let icon: () -> Icon

    var body: some View {
        VStack(spacing: 3) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(AtelierRenderer.grassLight)
                icon()
            }
            .frame(width: 50, height: 40)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(selected ? Color.accentColor : Color.clear, lineWidth: 3)
            )
            Text(title)
                .font(.system(size: 10, weight: selected ? .bold : .medium))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(selected ? Color.accentColor : Color.primary)
        }
        .frame(width: 62)
        .contentShape(Rectangle())
    }
}

/// Icône d'un outil, dessinée comme sur le terrain
struct AtelierToolGlyph: View {
    let tool: AtelierTool
    let bib: AtelierColor
    let propColor: AtelierColor

    var body: some View {
        Canvas { ctx, size in
            let center = TacticPoint(x: 0.5, y: 0.5)
            let framing = TacticFraming(x: 0.5 - 2.0 / 68, y: 0.5 - 2.0 / 105, width: 4.0 / 68, height: 4.0 / 105)
            let vp = AtelierViewport(framing: framing, size: size, padding: 0, allowRotation: false)
            let c = vp.screen(center)
            switch tool {
            case .player, .goalkeeper:
                let actor = TacticActor(id: "x", team: .equipe, label: tool == .goalkeeper ? "G" : "",
                                        position: tool == .goalkeeper ? .gardien : nil,
                                        bib: (tool == .goalkeeper ? AtelierColor.vert : bib).rawValue)
                AtelierRenderer.drawActor(ctx, vp, actor, at: center)
            case .ball:
                AtelierRenderer.drawBallGlyph(ctx, at: c, diameter: 20)
            case .line:
                for dx in [-14.0, 0, 14] {
                    let p = vp.pitch(CGPoint(x: c.x + dx, y: c.y))
                    AtelierRenderer.drawProp(ctx, vp, TacticProp(kind: .plot, position: p, color: propColor.rawValue), selected: false)
                }
            case .prop(.zone):
                let rect = CGRect(x: c.x - 16, y: c.y - 11, width: 32, height: 22)
                ctx.fill(Path(rect), with: .color(.white.opacity(0.18)))
                ctx.stroke(Path(rect), with: .color(.white), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
            case .prop(let kind):
                let rotation: Double? = kind == .echelle ? 90 : nil
                var prop = TacticProp(kind: kind, position: center, rotation: rotation)
                if kind.hasColor { prop.color = propColor.rawValue }
                var scaled = ctx
                if kind == .echelle || kind == .but {
                    scaled.translateBy(x: c.x, y: c.y)
                    scaled.scaleBy(x: 0.8, y: 0.8)
                    scaled.translateBy(x: -c.x, y: -c.y)
                }
                AtelierRenderer.drawProp(scaled, vp, prop, selected: false)
            }
        }
    }
}
