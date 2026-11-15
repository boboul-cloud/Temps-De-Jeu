//
//  SequenceViews.swift
//  Temps De Jeu
//
//  Flèches 2D, liste des étapes et aide de la construction d'une séquence.
//

import SwiftUI

// MARK: - Flèches sur le terrain 2D

struct TacticArrowsOverlay: View {
    let arrows: [TacticArrow]

    var body: some View {
        Canvas { context, size in
            for arrow in arrows {
                Self.draw(arrow, in: &context, size: size)
            }
        }
        .allowsHitTesting(false)
    }

    static func color(for arrow: TacticArrow) -> Color {
        switch arrow.kind {
        case .course:
            switch arrow.team {
            case .adversaire: return Color(red: 1.0, green: 0.55, blue: 0.55)
            case .joker: return Color(red: 0.55, green: 0.85, blue: 1.0)
            default: return .white
            }
        case .passe: return Color(red: 1.0, green: 0.86, blue: 0.1)
        case .conduite: return Color(red: 1.0, green: 0.55, blue: 0.1)
        case .tir: return Color(red: 1.0, green: 0.22, blue: 0.22)
        }
    }

    private static func draw(_ arrow: TacticArrow, in context: inout GraphicsContext, size: CGSize) {
        var a = CGPoint(x: arrow.from.x * size.width, y: arrow.from.y * size.height)
        var b = CGPoint(x: arrow.to.x * size.width, y: arrow.to.y * size.height)
        let length = hypot(b.x - a.x, b.y - a.y)
        guard length > 6 else { return }
        let dir = CGPoint(x: (b.x - a.x) / length, y: (b.y - a.y) / length)

        // Raccourcir pour ne pas recouvrir les jetons
        let isRun = arrow.kind == .course || arrow.kind == .conduite
        let startTrim: CGFloat = isRun ? 22 : 10
        let endTrim: CGFloat = arrow.kind == .tir ? 0 : (isRun ? 26 : 18)
        if length > startTrim + endTrim + 10 {
            a = CGPoint(x: a.x + dir.x * startTrim, y: a.y + dir.y * startTrim)
            b = CGPoint(x: b.x - dir.x * endTrim, y: b.y - dir.y * endTrim)
        }
        let normal = CGPoint(x: -dir.y, y: dir.x)
        let color = Self.color(for: arrow)

        var path = Path()
        var beforeTip = a
        switch arrow.kind {
        case .conduite:
            let total = hypot(b.x - a.x, b.y - a.y)
            let count = max(12, Int(total / 3))
            path.move(to: a)
            for i in 1...count {
                let t = CGFloat(i) / CGFloat(count)
                let d = total * t
                let fade = min(1, (total - d) / 14)
                let offset = sin(d / 15 * 2 * .pi) * 4.5 * fade
                let p = CGPoint(x: a.x + dir.x * d + normal.x * offset, y: a.y + dir.y * d + normal.y * offset)
                path.addLine(to: p)
                if i == count - 1 { beforeTip = p }
            }
        case .passe where arrow.aerial == true:
            let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
            let bulge = hypot(b.x - a.x, b.y - a.y) * 0.18
            let control = CGPoint(x: mid.x + normal.x * bulge, y: mid.y + normal.y * bulge)
            path.move(to: a)
            path.addQuadCurve(to: b, control: control)
            beforeTip = CGPoint(x: (control.x + b.x) / 2, y: (control.y + b.y) / 2)
        default:
            path.move(to: a)
            path.addLine(to: b)
            beforeTip = a
        }

        let style = StrokeStyle(lineWidth: arrow.kind == .tir ? 4 : 3, lineCap: .round, lineJoin: .round,
                                dash: arrow.kind == .course ? [7, 5] : [])
        context.stroke(path, with: .color(.black.opacity(0.25)), style: StrokeStyle(lineWidth: style.lineWidth + 2, lineCap: .round, dash: style.dash))
        context.stroke(path, with: .color(color), style: style)

        // Pointe
        var hd = CGPoint(x: b.x - beforeTip.x, y: b.y - beforeTip.y)
        let hl = max(0.001, hypot(hd.x, hd.y))
        hd = CGPoint(x: hd.x / hl, y: hd.y / hl)
        let hn = CGPoint(x: -hd.y, y: hd.x)
        let headLength: CGFloat = 11, headWidth: CGFloat = 9
        var head = Path()
        head.move(to: b)
        head.addLine(to: CGPoint(x: b.x - hd.x * headLength + hn.x * headWidth / 2, y: b.y - hd.y * headLength + hn.y * headWidth / 2))
        head.addLine(to: CGPoint(x: b.x - hd.x * headLength - hn.x * headWidth / 2, y: b.y - hd.y * headLength - hn.y * headWidth / 2))
        head.closeSubpath()
        context.fill(head, with: .color(color))
    }
}

// MARK: - Liste des étapes (titre, consigne, durée)

struct SequenceStepsSheet: View {
    @Binding var steps: [TacticStep]
    var onShow: (Int) -> Void
    var onPlay: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var stepToDelete: Int?

    private func text(_ i: Int, _ keyPath: WritableKeyPath<TacticStep, String>) -> Binding<String> {
        Binding(
            get: { steps.indices.contains(i) ? steps[i][keyPath: keyPath] : "" },
            set: { if steps.indices.contains(i) { steps[i][keyPath: keyPath] = $0 } }
        )
    }

    private func aerial(_ i: Int) -> Binding<Bool> {
        Binding(
            get: { steps.indices.contains(i) ? (steps[i].aerial ?? false) : false },
            set: { if steps.indices.contains(i) { steps[i].aerial = $0 ? true : nil } }
        )
    }

    private func duration(_ i: Int) -> Binding<Double> {
        Binding(
            get: { steps.indices.contains(i) ? (steps[i].duration ?? TacticStep.defaultDuration) : TacticStep.defaultDuration },
            set: { if steps.indices.contains(i) { steps[i].duration = $0 } }
        )
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(Array(steps.indices), id: \.self) { i in
                    Section {
                        TextField(i == 0 ? "Mise en place" : "Titre de l'étape", text: text(i, \.title))
                            .font(.headline)
                        TextField("Consigne pour les joueurs (facultatif)…", text: text(i, \.text), axis: .vertical)
                            .lineLimit(2...6)
                        if i > 0 {
                            Toggle(isOn: aerial(i)) {
                                Label("Ballon en l'air (centre, transversale)", systemImage: "arrow.up.forward.circle")
                            }
                            Stepper(value: duration(i), in: 0.8...4.0, step: 0.2) {
                                Label("Durée de l'animation : \(duration(i).wrappedValue.formatted(.number.precision(.fractionLength(1)))) s",
                                      systemImage: "timer")
                            }
                        }
                        Button {
                            onShow(i)
                            dismiss()
                        } label: {
                            Label("Afficher sur le terrain pour la corriger", systemImage: "hand.draw")
                        }
                        Button(role: .destructive) {
                            stepToDelete = i
                        } label: {
                            Label("Supprimer l'étape", systemImage: "trash")
                        }
                    } header: {
                        Text("Étape \(i + 1)")
                    }
                }
            }
            .navigationTitle("Étapes de la séquence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        dismiss()
                        onPlay()
                    } label: {
                        Label("Lire", systemImage: "play.circle.fill")
                    }
                    .disabled(steps.count < 2)
                }
            }
            .confirmationDialog("Supprimer l'étape \((stepToDelete ?? 0) + 1) ?",
                                isPresented: Binding(get: { stepToDelete != nil }, set: { if !$0 { stepToDelete = nil } }),
                                titleVisibility: .visible) {
                Button("Supprimer", role: .destructive) {
                    if let i = stepToDelete, steps.indices.contains(i) {
                        withAnimation { _ = steps.remove(at: i) }
                    }
                    stepToDelete = nil
                }
            }
        }
    }
}

// MARK: - Aide

struct SequenceHelpSheet: View {
    @Environment(\.dismiss) private var dismiss

    private struct HelpItem: Identifiable {
        let id = UUID()
        let kind: TacticArrowKind?
        let icon: String
        let title: String
        let text: String
    }

    private let gestures: [HelpItem] = [
        HelpItem(kind: .course, icon: "figure.run", title: "Course",
                text: "Déplacez un joueur qui n'a pas le ballon."),
        HelpItem(kind: .conduite, icon: "figure.soccer", title: "Conduite de balle",
                text: "Déplacez le joueur qui a le ballon : le ballon suit à ses pieds."),
        HelpItem(kind: .passe, icon: "arrow.right.circle", title: "Passe",
                text: "Faites glisser le ballon sur un partenaire : il se colle à ses pieds."),
        HelpItem(kind: .passe, icon: "arrow.up.forward.circle", title: "Centre, transversale",
                text: "Activez « En l'air » avant de valider l'étape : la passe devient aérienne."),
        HelpItem(kind: .tir, icon: "scope", title: "Tir",
                text: "Faites glisser le ballon dans le but."),
        HelpItem(kind: nil, icon: "arrow.uturn.backward.circle", title: "Récupération",
                text: "Faites glisser le ballon sur un adversaire."),
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label("Placez joueurs, adversaires et ballon, puis touchez « Mise en place ».", systemImage: "1.circle.fill")
                    Label("Pour chaque étape : une action de ballon et autant de courses que vous voulez, puis « Étape suivante ».", systemImage: "2.circle.fill")
                    Label("Avant de valider, les flèches montrent ce qui sera enregistré.", systemImage: "3.circle.fill")
                    Label("Touchez « Lire » pour voir la démonstration, puis « Enregistrer ».", systemImage: "4.circle.fill")
                } header: {
                    Text("Construire une séquence")
                }

                Section {
                    ForEach(gestures) { gesture in
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: gesture.icon)
                                .font(.title3)
                                .foregroundStyle(.purple)
                                .frame(width: 28)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(gesture.title).font(.subheadline.bold())
                                Text(gesture.text).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                } header: {
                    Text("Les gestes")
                }

                Section {
                    Label("Touchez un numéro d'étape pour la revoir sur le terrain, corrigez, puis « Mettre à jour ».", systemImage: "number.circle")
                    Label("☰ Étapes : titre, consigne pour les joueurs, durée, ballon en l'air.", systemImage: "list.bullet.rectangle")
                    Label("Le ballon se retire par un appui long (en 2D) ou avec le bouton ⚽️.", systemImage: "soccerball")
                } header: {
                    Text("Corriger")
                }

                Section {
                    ArrowLegend()
                        .padding(.vertical, 4)
                } header: {
                    Text("Légende des flèches")
                }
            }
            .navigationTitle("Comment construire une séquence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK") { dismiss() }
                }
            }
        }
    }
}
