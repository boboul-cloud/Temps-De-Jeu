//
//  AtelierPDF.swift
//  Temps De Jeu
//
//  Atelier : fiches à imprimer (A4). Une page par exercice : schéma de la
//  mise en place avec toutes les flèches, objectif, consignes, déroulé,
//  évolutions et matériel. La séance ajoute une page de garde.
//

import SwiftUI
import UIKit

@MainActor
enum AtelierPDF {
    static let page = CGRect(x: 0, y: 0, width: 595, height: 842)
    static let margin: CGFloat = 36

    /// Fiche d'un exercice
    static func exerciseSheet(_ play: TacticPlay) throws -> URL {
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let data = renderer.pdfData { context in
            let flow = PDFFlow(context: context)
            flow.newPage()
            flow.exercise(play, number: nil, minutes: nil)
        }
        return try write(data, name: play.title)
    }

    /// Fiche d'une séance : page de garde puis une page par exercice
    static func sessionSheet(_ plan: TrainingPlan, exercises: [(TrainingPlan.Item, TacticPlay)]) throws -> URL {
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let data = renderer.pdfData { context in
            let flow = PDFFlow(context: context)
            flow.newPage()
            flow.cover(plan, exercises: exercises)
            for (i, entry) in exercises.enumerated() {
                flow.newPage()
                flow.exercise(entry.1, number: i + 1, minutes: entry.0.minutes)
            }
        }
        return try write(data, name: plan.title)
    }

    static func diagram(_ play: TacticPlay, size: CGSize, step: Int = 0, allArrows: Bool) -> UIImage? {
        let view = AtelierDiagram(play: play, step: step, allArrows: allArrows)
            .frame(width: size.width, height: size.height)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 3
        return renderer.uiImage
    }

    private static func write(_ data: Data, name: String) throws -> URL {
        let safe = name.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>")).joined(separator: "-")
            .trimmingCharacters(in: .whitespaces)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safe.isEmpty ? "Fiche" : safe).pdf")
        try data.write(to: url, options: .atomic)
        return url
    }
}

/// Mise en page qui coule de haut en bas et passe à la page suivante au besoin
@MainActor
private final class PDFFlow {
    let context: UIGraphicsPDFRendererContext
    var y: CGFloat = 0
    private var pageNumber = 0
    private let left = AtelierPDF.margin
    private var width: CGFloat { AtelierPDF.page.width - 2 * AtelierPDF.margin }
    private var bottom: CGFloat { AtelierPDF.page.height - AtelierPDF.margin - 14 }

    init(context: UIGraphicsPDFRendererContext) {
        self.context = context
    }

    func newPage() {
        context.beginPage()
        pageNumber += 1
        y = AtelierPDF.margin
        let footer = NSAttributedString(string: "Temps de Jeu · Atelier — page \(pageNumber)",
                                        attributes: [.font: UIFont.systemFont(ofSize: 8), .foregroundColor: UIColor.gray])
        footer.draw(at: CGPoint(x: left, y: AtelierPDF.page.height - AtelierPDF.margin + 2))
    }

    private func ensure(_ height: CGFloat) {
        if y + height > bottom { newPage() }
    }

    @discardableResult
    func text(_ string: String, size: CGFloat = 11, weight: UIFont.Weight = .regular, color: UIColor = .black,
              indent: CGFloat = 0, spacing: CGFloat = 4) -> CGFloat {
        let attributed = NSAttributedString(string: string, attributes: [
            .font: UIFont.systemFont(ofSize: size, weight: weight), .foregroundColor: color
        ])
        let box = attributed.boundingRect(with: CGSize(width: width - indent, height: .greatestFiniteMagnitude),
                                          options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
        ensure(box.height)
        attributed.draw(with: CGRect(x: left + indent, y: y, width: width - indent, height: ceil(box.height)),
                        options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
        y += ceil(box.height) + spacing
        return box.height
    }

    func heading(_ string: String) {
        ensure(30)
        y += 6
        text(string.uppercased(), size: 9.5, weight: .bold, color: UIColor(red: 0.1, green: 0.45, blue: 0.2, alpha: 1), spacing: 3)
    }

    func image(_ image: UIImage?, height: CGFloat) {
        guard let image else { return }
        ensure(height)
        let ratio = image.size.width / max(1, image.size.height)
        let w = min(width, height * ratio)
        let rect = CGRect(x: left + (width - w) / 2, y: y, width: w, height: w / ratio)
        let path = UIBezierPath(roundedRect: rect, cornerRadius: 8)
        UIGraphicsGetCurrentContext()?.saveGState()
        path.addClip()
        image.draw(in: rect)
        UIGraphicsGetCurrentContext()?.restoreGState()
        y += rect.height + 8
    }

    // MARK: Exercice

    func exercise(_ play: TacticPlay, number: Int?, minutes: Int?) {
        let prefix = number.map { "\($0). " } ?? ""
        text(prefix + play.title, size: 20, weight: .bold, spacing: 2)
        var details = [play.category.displayName]
        if let level = play.level, !level.isEmpty { details.append(level) }
        if let minutes { details.append("\(minutes) min") } else if let d = play.duration, !d.isEmpty { details.append(d) }
        if let headcount = AtelierEditorModel.headcount(play.actors) { details.append(headcount) }
        text(details.joined(separator: " · "), size: 10, color: .darkGray, spacing: 10)

        image(AtelierPDF.diagram(play, size: CGSize(width: 520, height: 330), allArrows: true), height: 330)

        if !play.objective.isEmpty {
            heading("Objectif")
            text(play.objective)
        }
        if !play.instructions.isEmpty {
            heading("Consignes de coaching")
            for instruction in play.instructions { text("•  \(instruction)", indent: 6, spacing: 2) }
        }
        let steps = play.steps.enumerated().filter { $0.offset > 0 || !$0.element.text.isEmpty }
        if !steps.isEmpty {
            heading("Déroulé")
            for (i, step) in steps {
                let title = step.title.isEmpty ? (i == 0 ? "Mise en place" : "Étape \(i)") : step.title
                text(step.text.isEmpty ? "\(i). \(title)" : "\(i). \(title) — \(step.text)", indent: 6, spacing: 2)
            }
        }
        let lines = play.equipmentLines
        if !lines.isEmpty {
            heading("Matériel")
            text(lines.map(\.text).joined(separator: " · "))
        }
        for (i, evolution) in play.evolutionList.enumerated() {
            heading("Évolution \(i + 1) : \(evolution.title)")
            if !evolution.text.isEmpty { text(evolution.text) }
            image(AtelierPDF.diagram(play.variant(i), size: CGSize(width: 360, height: 220), allArrows: true), height: 200)
        }
    }

    // MARK: Page de garde de la séance

    func cover(_ plan: TrainingPlan, exercises: [(TrainingPlan.Item, TacticPlay)]) {
        text(plan.title, size: 24, weight: .bold, spacing: 2)
        var details: [String] = []
        if let date = plan.date {
            details.append(date.formatted(.dateTime.weekday(.wide).day().month(.wide).hour().minute()
                .locale(Locale(identifier: "fr_FR"))))
        }
        details.append("Durée totale : \(plan.totalMinutes) min")
        text(details.joined(separator: " · "), size: 11, color: .darkGray, spacing: 12)
        if !plan.notes.isEmpty {
            heading("Thème de la séance")
            text(plan.notes)
        }
        heading("Programme")
        var clock = 0
        for (i, entry) in exercises.enumerated() {
            let start = clock
            clock += entry.0.minutes
            var line = "\(i + 1). \(entry.1.title) — \(entry.0.minutes) min  (\(start)′ → \(clock)′)"
            if !entry.0.note.isEmpty { line += "\n     \(entry.0.note)" }
            text(line, size: 12, indent: 6, spacing: 4)
        }
        let lines = plan.equipment(exercises.map(\.1))
        if !lines.isEmpty {
            heading(plan.simultaneous ? "Matériel (ateliers montés en même temps)" : "Matériel à prévoir")
            for line in lines { text("☐  \(line.text)", size: 12, indent: 6, spacing: 3) }
        }
        if !plan.teams.isEmpty {
            heading("Équipes")
            for team in plan.teams {
                text("\(team.color.displayName) : \(team.players.joined(separator: ", "))", size: 11, indent: 6, spacing: 3)
            }
        }
    }
}
