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
private struct OpponentToken: Identifiable {
    let id: UUID
    var position: CGPoint  // Coordonnées normalisées 0-1
    var number: Int
}

/// Un segment de tracé sur le terrain
private struct DrawingLine: Identifiable {
    let id = UUID()
    var points: [CGPoint]  // Coordonnées normalisées 0-1
}

/// Vue de placement tactique des joueurs sur le terrain
struct FormationView: View {
    let roster: [MatchPlayer]
    let jerseyColor: JerseyColor
    let opponentJerseyColor: JerseyColor
    let savedFormation: String?
    var onSave: (([UUID: CGPoint], String?) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var positions: [UUID: CGPoint] = [:]
    @State private var currentFormationName: String? = nil
    @State private var hasChanges = false
    @State private var draggedPlayerId: UUID? = nil
    @State private var isMirrored = false

    // Joueurs adverses
    @State private var opponents: [OpponentToken] = []
    @State private var nextOpponentNumber = 1
    @State private var draggedOpponentId: UUID? = nil

    // Outil dessin
    @State private var activeTool: PitchTool = .move
    @State private var drawingLines: [DrawingLine] = []
    @State private var currentLine: DrawingLine? = nil

    // Ballon
    @State private var ballPosition: CGPoint? = nil
    @State private var isDraggingBall = false

    private var titulaires: [MatchPlayer] {
        roster.filter { $0.status == .titulaire }.sorted { $0.shirtNumber < $1.shirtNumber }
    }

    private var remplacants: [MatchPlayer] {
        roster.filter { $0.status == .remplacant }.sorted { $0.shirtNumber < $1.shirtNumber }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Indicateur de formation actuelle
                if let name = currentFormationName {
                    Text(name)
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                }

                // Terrain
                GeometryReader { pitchGeo in
                    let pw = pitchGeo.size.width
                    let ph = pitchGeo.size.height

                    ZStack {
                        PitchShape()
                            .fill(Color.green.opacity(0.35))
                            .overlay(PitchMarkings())

                        // Tracés tactiques
                        ForEach(drawingLines) { line in
                            DrawingPath(points: line.points, pitchSize: pitchGeo.size)
                        }
                        if let current = currentLine {
                            DrawingPath(points: current.points, pitchSize: pitchGeo.size)
                        }

                        // Joueurs de mon équipe
                        ForEach(titulaires) { player in
                            if let norm = positions[player.id] {
                                let pixelPos = CGPoint(x: norm.x * pw, y: norm.y * ph)
                                PlayerToken(
                                    player: player,
                                    jerseyColor: jerseyColor,
                                    isCaptain: player.isCaptain,
                                    isDragging: draggedPlayerId == player.id
                                )
                                .position(pixelPos)
                                .zIndex(draggedPlayerId == player.id ? 10 : 1)
                                .gesture(activeTool == .move ?
                                    DragGesture()
                                        .onChanged { value in
                                            draggedPlayerId = player.id
                                            let nx = min(max(value.location.x / pw, 0.05), 0.95)
                                            let ny = min(max(value.location.y / ph, 0.04), 0.96)
                                            positions[player.id] = CGPoint(x: nx, y: ny)
                                            hasChanges = true
                                        }
                                        .onEnded { _ in
                                            draggedPlayerId = nil
                                        }
                                    : nil
                                )
                            }
                        }

                        // Joueurs adverses
                        ForEach(opponents) { opp in
                            let pixelPos = CGPoint(x: opp.position.x * pw, y: opp.position.y * ph)
                            OpponentPlayerToken(
                                number: opp.number,
                                jerseyColor: opponentJerseyColor,
                                isDragging: draggedOpponentId == opp.id
                            )
                            .position(pixelPos)
                            .zIndex(draggedOpponentId == opp.id ? 10 : 1)
                            .gesture(activeTool == .move ?
                                DragGesture()
                                    .onChanged { value in
                                        draggedOpponentId = opp.id
                                        if let idx = opponents.firstIndex(where: { $0.id == opp.id }) {
                                            let nx = min(max(value.location.x / pw, 0.05), 0.95)
                                            let ny = min(max(value.location.y / ph, 0.04), 0.96)
                                            opponents[idx].position = CGPoint(x: nx, y: ny)
                                        }
                                    }
                                    .onEnded { _ in
                                        draggedOpponentId = nil
                                    }
                                : nil
                            )
                            .onLongPressGesture {
                                opponents.removeAll { $0.id == opp.id }
                            }
                        }

                        // Ballon
                        if let ballPos = ballPosition {
                            let bx = ballPos.x * pw
                            let by = ballPos.y * ph
                            Text("⚽️")
                                .font(.system(size: 28))
                                .shadow(color: .black.opacity(isDraggingBall ? 0.4 : 0.2), radius: isDraggingBall ? 4 : 2)
                                .scaleEffect(isDraggingBall ? 1.2 : 1.0)
                                .position(x: bx, y: by)
                                .zIndex(isDraggingBall ? 10 : 2)
                                .gesture(activeTool == .move ?
                                    DragGesture()
                                        .onChanged { value in
                                            isDraggingBall = true
                                            let nx = min(max(value.location.x / pw, 0.02), 0.98)
                                            let ny = min(max(value.location.y / ph, 0.02), 0.98)
                                            ballPosition = CGPoint(x: nx, y: ny)
                                        }
                                        .onEnded { _ in
                                            isDraggingBall = false
                                        }
                                    : nil
                                )
                                .onLongPressGesture {
                                    ballPosition = nil
                                }
                                .animation(.easeInOut(duration: 0.15), value: isDraggingBall)
                        }

                        // Geste de dessin (par-dessus tout)
                        if activeTool == .draw {
                            Color.clear
                                .contentShape(Rectangle())
                                .gesture(
                                    DragGesture(minimumDistance: 2)
                                        .onChanged { value in
                                            let nx = min(max(value.location.x / pw, 0), 1)
                                            let ny = min(max(value.location.y / ph, 0), 1)
                                            let pt = CGPoint(x: nx, y: ny)
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
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .rotationEffect(isMirrored ? .degrees(180) : .zero)
                    .animation(.easeInOut(duration: 0.3), value: isMirrored)
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)

                // Banc des remplaçants
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
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Placement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        onSave?(positions, currentFormationName)
                        dismiss()
                    } label: {
                        Text("Enregistrer")
                            .bold()
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 12) {
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
                    }
                }
                ToolbarItem(placement: .bottomBar) {
                    HStack(spacing: 14) {
                        // Bouton outil déplacer
                        Button {
                            activeTool = .move
                        } label: {
                            Image(systemName: "hand.point.up.left.fill")
                                .font(.title3)
                                .foregroundStyle(activeTool == .move ? .blue : .secondary)
                        }

                        // Bouton outil crayon
                        Button {
                            activeTool = .draw
                        } label: {
                            Image(systemName: "pencil.tip.crop.circle")
                                .font(.title3)
                                .foregroundStyle(activeTool == .draw ? .blue : .secondary)
                        }

                        Divider()
                            .frame(height: 24)

                        // Ajouter un adversaire
                        Button {
                            addOpponent()
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                                .foregroundStyle(opponentJerseyColor.color == .red ? .red : opponentJerseyColor.color)
                        }

                        // Placer / retirer le ballon
                        Button {
                            if ballPosition != nil {
                                ballPosition = nil
                            } else {
                                ballPosition = CGPoint(x: 0.5, y: 0.5)
                            }
                        } label: {
                            Text("⚽️")
                                .font(.title3)
                                .opacity(ballPosition != nil ? 1 : 0.4)
                        }

                        Spacer()

                        // Effacer les tracés
                        if !drawingLines.isEmpty {
                            Button {
                                drawingLines.removeAll()
                            } label: {
                                Image(systemName: "eraser.fill")
                                    .font(.title3)
                                    .foregroundStyle(.orange)
                            }
                        }

                        // Effacer les adversaires
                        if !opponents.isEmpty {
                            Button {
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
            .onAppear {
                initializePositions()
            }
        }
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

        currentFormationName = formation.displayName

        // Séparer par rôle
        let gk = titulaires.filter { $0.position == .gardien }
        let def = titulaires.filter { $0.position == .defenseur }
        let mid = titulaires.filter { $0.position == .milieu }
        let att = titulaires.filter { $0.position == .attaquant }

        // Slots par formation
        let slots: [[CGPoint]]
        switch formation {
        case .auto:
            slots = autoSlots(gk: gk.count, def: def.count, mid: mid.count, att: att.count)
        case .f442:
            slots = formationSlots(lines: [1, 4, 4, 2])
        case .f433:
            slots = formationSlots(lines: [1, 4, 3, 3])
        case .f343:
            slots = formationSlots(lines: [1, 3, 4, 3])
        case .f352:
            slots = formationSlots(lines: [1, 3, 5, 2])
        case .f532:
            slots = formationSlots(lines: [1, 5, 3, 2])
        case .f4231:
            slots = formationSlots(lines: [1, 4, 2, 3, 1])
        case .f4141:
            slots = formationSlots(lines: [1, 4, 1, 4, 1])
        }

        // Assigner les joueurs aux slots par groupe de position
        if formation == .auto {
            let groups = [gk, def, mid, att]
            for (groupIndex, group) in groups.enumerated() where groupIndex < slots.count {
                for (i, player) in group.enumerated() where i < slots[groupIndex].count {
                    positions[player.id] = slots[groupIndex][i]
                }
            }
            hasChanges = true
            return
        }

        // Pour les formations fixes, répartir dans l'ordre
        var allSlots: [CGPoint] = []
        for line in slots {
            allSlots.append(contentsOf: line)
        }
        for (i, player) in titulaires.enumerated() where i < allSlots.count {
            positions[player.id] = allSlots[i]
        }
        // Joueurs restants s'il y en a plus que de slots
        for i in allSlots.count..<titulaires.count {
            let player = titulaires[i]
            positions[player.id] = CGPoint(x: 0.5, y: 0.5)
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
            let y = 0.9 - (Double(index) / Double(count - 1)) * 0.75
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

    private var size: CGFloat { isSmall ? 40 : 48 }

    var body: some View {
        VStack(spacing: 2) {
            ZStack {
                Circle()
                    .fill(jerseyColor.color)
                    .frame(width: size, height: size)
                    .shadow(color: .black.opacity(isDragging ? 0.4 : 0.25), radius: isDragging ? 6 : 3, x: 0, y: isDragging ? 4 : 2)
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
                if !isSmall {
                    Text(player.position.shortName)
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 3)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(.black.opacity(0.5)))
                        .offset(y: size * 0.42)
                }
            }

            Text(player.displayName)
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

    private let size: CGFloat = 42

    var body: some View {
        VStack(spacing: 1) {
            ZStack {
                Circle()
                    .fill(jerseyColor.color)
                    .frame(width: size, height: size)
                    .overlay(
                        Circle()
                            .strokeBorder(.white.opacity(0.6), lineWidth: 2, antialiased: true)
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
