//
//  AtelierCanvas.swift
//  Temps De Jeu
//
//  Atelier : terrain vu de dessus. Conversion terrain ↔ écran (le terrain
//  pivote à l'horizontale quand il y gagne de la place) et dessin du
//  terrain, du matériel, des joueurs, du ballon et des flèches.
//

import SwiftUI

// MARK: - Fenêtre d'affichage

/// Relie les coordonnées du terrain (normalisées 0…1, voir `TacticPoint`) aux points écran.
/// Portrait : but attaqué en haut. Pivoté : but attaqué à droite.
struct AtelierViewport {
    static let pitchWidth = 68.0     // mètres (x)
    static let pitchLength = 105.0   // mètres (y)

    let size: CGSize
    let rotated: Bool
    /// Points par mètre
    let scale: CGFloat
    private let fx: Double, fy: Double, fw: Double, fh: Double
    private let ox: CGFloat, oy: CGFloat

    init(framing: TacticFraming, size: CGSize, padding: CGFloat = 6, allowRotation: Bool = true) {
        self.size = size
        let margin = 2.0
        fx = framing.x * Self.pitchWidth - margin
        fy = framing.y * Self.pitchLength - margin
        fw = framing.width * Self.pitchWidth + 2 * margin
        fh = framing.height * Self.pitchLength + 2 * margin
        let w = max(1, size.width - 2 * padding), h = max(1, size.height - 2 * padding)
        let portrait = min(w / fw, h / fh)
        let turned = min(w / fh, h / fw)
        rotated = allowRotation && turned > portrait * 1.08
        scale = rotated ? turned : portrait
        let contentW = CGFloat(rotated ? fh : fw) * scale
        let contentH = CGFloat(rotated ? fw : fh) * scale
        ox = (size.width - contentW) / 2
        oy = (size.height - contentH) / 2
    }

    /// Mètres → écran
    func screen(mx: Double, my: Double) -> CGPoint {
        if rotated {
            return CGPoint(x: ox + CGFloat(fy + fh - my) * scale, y: oy + CGFloat(mx - fx) * scale)
        }
        return CGPoint(x: ox + CGFloat(mx - fx) * scale, y: oy + CGFloat(my - fy) * scale)
    }

    func screen(_ p: TacticPoint) -> CGPoint {
        screen(mx: p.x * Self.pitchWidth, my: p.y * Self.pitchLength)
    }

    /// Écran → coordonnées normalisées
    func pitch(_ point: CGPoint) -> TacticPoint {
        let mx: Double, my: Double
        if rotated {
            my = fy + fh - Double((point.x - ox) / scale)
            mx = fx + Double((point.y - oy) / scale)
        } else {
            mx = fx + Double((point.x - ox) / scale)
            my = fy + Double((point.y - oy) / scale)
        }
        return TacticPoint(x: mx / Self.pitchWidth, y: my / Self.pitchLength)
    }

    /// Angle écran (degrés, sens horaire) d'un objet tourné de `degrees` sur le terrain
    func screenAngle(_ degrees: Double) -> Angle {
        .degrees(degrees + (rotated ? 90 : 0))
    }

    func points(_ meters: Double) -> CGFloat { CGFloat(meters) * scale }

    /// Taille d'un joueur à l'écran
    var playerDiameter: CGFloat { min(40, max(26, points(1.9))) }

    /// Distance écran entre deux points du terrain
    func screenDistance(_ a: TacticPoint, _ b: TacticPoint) -> CGFloat {
        let p = screen(a), q = screen(b)
        return hypot(p.x - q.x, p.y - q.y)
    }

    /// Rectangle écran couvrant la zone (centre + taille normalisés)
    func rect(center: TacticPoint, size: TacticPoint) -> CGRect {
        let a = screen(TacticPoint(x: center.x - size.x / 2, y: center.y - size.y / 2))
        let b = screen(TacticPoint(x: center.x + size.x / 2, y: center.y + size.y / 2))
        return CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y))
    }
}

// MARK: - Dessin

enum AtelierRenderer {
    static let grassDark = Color(red: 0.16, green: 0.52, blue: 0.24)
    static let grassLight = Color(red: 0.19, green: 0.58, blue: 0.27)
    static let lineColor = Color.white.opacity(0.85)

    // MARK: Terrain

    static func drawPitch(_ ctx: GraphicsContext, _ vp: AtelierViewport, grid: Bool) {
        let W = AtelierViewport.pitchWidth, L = AtelierViewport.pitchLength
        func poly(_ pts: [(Double, Double)], close: Bool = false) -> Path {
            var path = Path()
            for (i, p) in pts.enumerated() {
                let s = vp.screen(mx: p.0, my: p.1)
                if i == 0 { path.move(to: s) } else { path.addLine(to: s) }
            }
            if close { path.closeSubpath() }
            return path
        }
        func arc(_ cx: Double, _ cy: Double, _ r: Double, _ a0: Double, _ a1: Double) -> Path {
            let n = 40
            return poly((0...n).map { i in
                let a = (a0 + (a1 - a0) * Double(i) / Double(n)) * .pi / 180
                return (cx + r * cos(a), cy + r * sin(a))
            })
        }

        // Herbe (au-delà des lignes) puis bandes de tonte
        ctx.fill(Path(CGRect(origin: .zero, size: vp.size)), with: .color(grassDark))
        let stripes = 18
        for i in 0..<stripes where i % 2 == 0 {
            let y0 = L * Double(i) / Double(stripes), y1 = L * Double(i + 1) / Double(stripes)
            ctx.fill(poly([(-4, y0), (W + 4, y0), (W + 4, y1), (-4, y1)], close: true), with: .color(grassLight))
        }

        if grid {
            var g = Path()
            for x in stride(from: 0.0, through: W, by: 5) {
                g.addPath(poly([(x, 0), (x, L)]))
            }
            for y in stride(from: 0.0, through: L, by: 5) {
                g.addPath(poly([(0, y), (W, y)]))
            }
            ctx.stroke(g, with: .color(.white.opacity(0.16)), lineWidth: 0.7)
        }

        let lw = max(1.2, min(2.2, vp.points(0.12)))
        var lines = Path()
        lines.addPath(poly([(0, 0), (W, 0), (W, L), (0, L)], close: true))
        lines.addPath(poly([(0, L / 2), (W, L / 2)]))
        lines.addPath(arc(W / 2, L / 2, 9.15, 0, 360))
        for (goalY, dir) in [(0.0, 1.0), (L, -1.0)] {
            // Surface de réparation, surface de but, point et arc
            lines.addPath(poly([(13.84, goalY), (13.84, goalY + dir * 16.5), (54.16, goalY + dir * 16.5), (54.16, goalY)]))
            lines.addPath(poly([(24.84, goalY), (24.84, goalY + dir * 5.5), (43.16, goalY + dir * 5.5), (43.16, goalY)]))
            let spotY = goalY + dir * 11
            let arcStart = dir > 0 ? 37.0 : 217.0
            lines.addPath(arc(W / 2, spotY, 9.15, arcStart, arcStart + 106))
            // But
            lines.addPath(poly([(30.34, goalY), (30.34, goalY - dir * 2), (37.66, goalY - dir * 2), (37.66, goalY)]))
        }
        for (cx, cy, a0) in [(0.0, 0.0, 0.0), (W, 0.0, 90.0), (W, L, 180.0), (0.0, L, 270.0)] {
            lines.addPath(arc(cx, cy, 1, a0, a0 + 90))
        }
        ctx.stroke(lines, with: .color(lineColor), lineWidth: lw)
        for spot in [(W / 2, L / 2), (W / 2, 11.0), (W / 2, L - 11)] {
            let c = vp.screen(mx: spot.0, my: spot.1)
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - lw * 1.4, y: c.y - lw * 1.4, width: lw * 2.8, height: lw * 2.8)),
                     with: .color(lineColor))
        }
    }

    // MARK: Matériel

    /// Taille écran (largeur, profondeur) d'un objet, avec un minimum pour rester visible et touchable
    static func propSize(_ kind: TacticPropKind, _ vp: AtelierViewport) -> CGSize {
        func m(_ meters: Double, min minimum: CGFloat) -> CGFloat { max(minimum, vp.points(meters)) }
        switch kind {
        case .plot: return CGSize(width: m(0.5, min: 15), height: m(0.5, min: 15))
        case .coupelle: return CGSize(width: m(0.45, min: 14), height: m(0.45, min: 14))
        case .piquet: return CGSize(width: m(0.25, min: 11), height: m(0.25, min: 11))
        case .mannequin: return CGSize(width: m(0.7, min: 24), height: m(0.35, min: 12))
        case .miniBut: return CGSize(width: m(2, min: 26), height: m(0.8, min: 10))
        case .but: return CGSize(width: m(5, min: 36), height: m(1.5, min: 13))
        case .cerceau: return CGSize(width: m(0.8, min: 20), height: m(0.8, min: 20))
        case .echelle: return CGSize(width: m(0.5, min: 10), height: m(4, min: 44))
        case .haie: return CGSize(width: m(1, min: 22), height: m(0.3, min: 8))
        case .ballon: return CGSize(width: m(0.22, min: 13), height: m(0.22, min: 13))
        case .zone: return .zero
        }
    }

    static func drawProp(_ ctx: GraphicsContext, _ vp: AtelierViewport, _ prop: TacticProp, selected: Bool) {
        let color = prop.atelierColor.color
        let center = vp.screen(prop.position)

        if prop.kind == .zone {
            let size = prop.size ?? TacticPoint(x: 0.2, y: 0.15)
            let rect = vp.rect(center: prop.position, size: size)
            ctx.fill(Path(rect), with: .color(color.opacity(0.16)))
            ctx.stroke(Path(rect), with: .color(color.opacity(0.9)),
                       style: StrokeStyle(lineWidth: 2, dash: [7, 5]))
            if selected {
                ctx.stroke(Path(rect.insetBy(dx: -3, dy: -3)), with: .color(.accentColor), lineWidth: 2.5)
                let handle = zoneHandle(prop, vp)
                ctx.fill(Path(ellipseIn: CGRect(x: handle.x - 11, y: handle.y - 11, width: 22, height: 22)), with: .color(.white))
                ctx.stroke(Path(ellipseIn: CGRect(x: handle.x - 11, y: handle.y - 11, width: 22, height: 22)),
                           with: .color(.accentColor), lineWidth: 3)
            }
            // Dimensions dans le coin haut-gauche (à l'écart des joueurs placés au milieu des côtés)
            let label = ctx.resolve(Text(zoneMeters(size)).font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundColor(.white.opacity(0.9)))
            if rect.width > 50 && rect.height > 24 {
                ctx.draw(label, at: CGPoint(x: rect.minX + 12, y: rect.minY + 7), anchor: .topLeading)
            }
            return
        }

        let size = propSize(prop.kind, vp)
        var c = ctx
        c.translateBy(x: center.x, y: center.y)
        c.rotate(by: vp.screenAngle(prop.rotation ?? 0))
        let w = size.width, h = size.height
        let shadow = GraphicsContext.Shading.color(.black.opacity(0.25))

        switch prop.kind {
        case .plot:
            var tri = Path()
            tri.move(to: CGPoint(x: 0, y: -h * 0.55))
            tri.addLine(to: CGPoint(x: w * 0.5, y: h * 0.42))
            tri.addLine(to: CGPoint(x: -w * 0.5, y: h * 0.42))
            tri.closeSubpath()
            c.fill(tri.offsetBy(dx: 1, dy: 1.5), with: shadow)
            c.fill(tri, with: .color(color))
            c.stroke(tri, with: .color(.black.opacity(0.35)), lineWidth: 0.8)
        case .coupelle:
            let r = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
            c.fill(Path(ellipseIn: r.offsetBy(dx: 1, dy: 1.2)), with: shadow)
            c.fill(Path(ellipseIn: r), with: .color(color))
            c.fill(Path(ellipseIn: r.insetBy(dx: w * 0.32, dy: h * 0.32)), with: .color(.black.opacity(0.35)))
        case .piquet:
            let r = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
            c.fill(Path(ellipseIn: r.offsetBy(dx: 1.5, dy: 2)), with: shadow)
            c.fill(Path(ellipseIn: r), with: .color(color))
            c.stroke(Path(ellipseIn: r), with: .color(.black.opacity(0.5)), lineWidth: 1)
            c.fill(Path(ellipseIn: r.insetBy(dx: w * 0.3, dy: h * 0.3)), with: .color(.white.opacity(0.8)))
        case .mannequin:
            let body = Path(roundedRect: CGRect(x: -w / 2, y: -h / 2, width: w, height: h), cornerRadius: h / 2)
            c.fill(body.offsetBy(dx: 1, dy: 1.5), with: shadow)
            c.fill(body, with: .color(color))
            c.stroke(body, with: .color(.black.opacity(0.45)), lineWidth: 1)
            let head = CGRect(x: -h * 0.3, y: -h * 0.3, width: h * 0.6, height: h * 0.6)
            c.fill(Path(ellipseIn: head), with: .color(.black.opacity(0.3)))
        case .miniBut, .but:
            // Barre en bas (ouverture vers le bas quand rotation = 0), filet vers le haut
            let net = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
            c.fill(Path(net), with: .color(.white.opacity(0.22)))
            var hatch = Path()
            let stepX = max(4, w / 8)
            var x = -w / 2
            while x <= w / 2 { hatch.move(to: CGPoint(x: x, y: -h / 2)); hatch.addLine(to: CGPoint(x: x, y: h / 2)); x += stepX }
            c.stroke(hatch, with: .color(.white.opacity(0.4)), lineWidth: 0.6)
            var frame = Path()
            frame.move(to: CGPoint(x: -w / 2, y: h / 2))
            frame.addLine(to: CGPoint(x: -w / 2, y: -h / 2))
            frame.addLine(to: CGPoint(x: w / 2, y: -h / 2))
            frame.addLine(to: CGPoint(x: w / 2, y: h / 2))
            c.stroke(frame, with: .color(.white.opacity(0.7)), lineWidth: 1.2)
            var bar = Path()
            bar.move(to: CGPoint(x: -w / 2, y: h / 2))
            bar.addLine(to: CGPoint(x: w / 2, y: h / 2))
            c.stroke(bar, with: .color(.white), style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
        case .cerceau:
            let r = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
            c.stroke(Path(ellipseIn: r.offsetBy(dx: 1, dy: 1.2)), with: shadow, lineWidth: 3)
            c.stroke(Path(ellipseIn: r), with: .color(color), lineWidth: max(2.5, w * 0.1))
        case .echelle:
            var rails = Path()
            rails.move(to: CGPoint(x: -w / 2, y: -h / 2)); rails.addLine(to: CGPoint(x: -w / 2, y: h / 2))
            rails.move(to: CGPoint(x: w / 2, y: -h / 2)); rails.addLine(to: CGPoint(x: w / 2, y: h / 2))
            let rungs = 9
            for i in 0..<rungs {
                let y = -h / 2 + h * CGFloat(i) / CGFloat(rungs - 1)
                rails.move(to: CGPoint(x: -w / 2, y: y)); rails.addLine(to: CGPoint(x: w / 2, y: y))
            }
            c.stroke(rails, with: .color(color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
        case .haie:
            var bar = Path()
            bar.move(to: CGPoint(x: -w / 2, y: 0)); bar.addLine(to: CGPoint(x: w / 2, y: 0))
            c.stroke(bar.offsetBy(dx: 1, dy: 1.5), with: shadow, lineWidth: 3)
            c.stroke(bar, with: .color(color), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            var feet = Path()
            for x in [-w / 2, w / 2] {
                feet.move(to: CGPoint(x: x, y: -max(4, h))); feet.addLine(to: CGPoint(x: x, y: max(4, h)))
            }
            c.stroke(feet, with: .color(color), lineWidth: 1.6)
        case .ballon:
            drawBallGlyph(c, at: .zero, diameter: w)
        case .zone:
            break
        }

        if selected {
            let radius = max(w, h) / 2 + 6
            c.stroke(Path(ellipseIn: CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2)),
                     with: .color(.accentColor), lineWidth: 2.5)
        }
    }

    static func zoneMeters(_ size: TacticPoint) -> String {
        let w = Int((size.x * AtelierViewport.pitchWidth).rounded())
        let l = Int((size.y * AtelierViewport.pitchLength).rounded())
        return "\(w) × \(l) m"
    }

    /// Poignée d'agrandissement d'une zone (coin bas-droit à l'écran)
    static func zoneHandle(_ prop: TacticProp, _ vp: AtelierViewport) -> CGPoint {
        let rect = vp.rect(center: prop.position, size: prop.size ?? TacticPoint(x: 0.2, y: 0.15))
        return CGPoint(x: rect.maxX, y: rect.maxY)
    }

    // MARK: Joueurs et ballon

    static func drawActor(_ ctx: GraphicsContext, _ vp: AtelierViewport, _ actor: TacticActor, at point: TacticPoint,
                          selected: Bool = false, ghost: Bool = false, highlighted: Bool = false) {
        let c = vp.screen(point)
        let d = vp.playerDiameter
        let rect = CGRect(x: c.x - d / 2, y: c.y - d / 2, width: d, height: d)
        let bib = actor.bibColor
        if ghost {
            ctx.fill(Path(ellipseIn: rect.insetBy(dx: d * 0.12, dy: d * 0.12)), with: .color(bib.color.opacity(0.32)))
            ctx.stroke(Path(ellipseIn: rect.insetBy(dx: d * 0.12, dy: d * 0.12)), with: .color(.white.opacity(0.45)),
                       style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
            return
        }
        if highlighted {
            ctx.stroke(Path(ellipseIn: rect.insetBy(dx: -5, dy: -5)), with: .color(.yellow), lineWidth: 3)
        }
        ctx.fill(Path(ellipseIn: rect.offsetBy(dx: 1.2, dy: 2)), with: .color(.black.opacity(0.3)))
        ctx.fill(Path(ellipseIn: rect), with: .color(bib.color))
        ctx.stroke(Path(ellipseIn: rect), with: .color(bib.isLight ? .black.opacity(0.55) : .white), lineWidth: 2)
        if actor.isGoalkeeper {
            ctx.stroke(Path(ellipseIn: rect.insetBy(dx: 3.5, dy: 3.5)), with: .color(bib.textColor.opacity(0.7)),
                       style: StrokeStyle(lineWidth: 1.2, dash: [2.5, 2]))
        }
        let label = actor.isGoalkeeper && actor.label.isEmpty ? "G" : actor.label
        ctx.draw(Text(label).font(.system(size: d * (label.count > 2 ? 0.32 : 0.44), weight: .heavy, design: .rounded))
                    .foregroundColor(bib.textColor), at: c)
        if selected {
            ctx.stroke(Path(ellipseIn: rect.insetBy(dx: -4, dy: -4)), with: .color(.accentColor), lineWidth: 3)
        }
    }

    /// Position écran du ballon : au pied du porteur, sinon à sa place
    static func ballScreenPoint(_ frame: TacticFrame, _ vp: AtelierViewport) -> CGPoint {
        if let holder = frame.ballHolder, let p = frame.positions[holder] {
            let c = vp.screen(p)
            let d = vp.playerDiameter
            return CGPoint(x: c.x + d * 0.45, y: c.y + d * 0.38)
        }
        return vp.screen(frame.ball)
    }

    static func drawBall(_ ctx: GraphicsContext, at point: CGPoint, selected: Bool) {
        drawBallGlyph(ctx, at: point, diameter: 17)
        if selected {
            ctx.stroke(Path(ellipseIn: CGRect(x: point.x - 14, y: point.y - 14, width: 28, height: 28)),
                       with: .color(.accentColor), lineWidth: 3)
        }
    }

    static func drawBallGlyph(_ ctx: GraphicsContext, at point: CGPoint, diameter d: CGFloat) {
        let rect = CGRect(x: point.x - d / 2, y: point.y - d / 2, width: d, height: d)
        ctx.fill(Path(ellipseIn: rect.offsetBy(dx: 1, dy: 1.5)), with: .color(.black.opacity(0.3)))
        ctx.fill(Path(ellipseIn: rect), with: .color(.white))
        var symbol = ctx.resolve(Image(systemName: "soccerball"))
        symbol.shading = .color(.black)
        ctx.draw(symbol, in: rect)
    }

    // MARK: Flèches

    static func arrowColor(_ arrow: TacticArrow) -> Color {
        switch arrow.kind {
        case .course: return .white
        case .passe: return Color(red: 1.0, green: 0.86, blue: 0.1)
        case .conduite: return Color(red: 1.0, green: 0.55, blue: 0.1)
        case .tir: return Color(red: 1.0, green: 0.25, blue: 0.25)
        }
    }

    static func drawArrow(_ ctx: GraphicsContext, _ vp: AtelierViewport, _ arrow: TacticArrow,
                          trimStart: CGFloat = 0, trimEnd: CGFloat = 0, opacity: Double = 1) {
        var a = vp.screen(arrow.from), b = vp.screen(arrow.to)
        let length = hypot(b.x - a.x, b.y - a.y)
        guard length > trimStart + trimEnd + 6 else { return }
        let ux = (b.x - a.x) / length, uy = (b.y - a.y) / length
        a = CGPoint(x: a.x + ux * trimStart, y: a.y + uy * trimStart)
        b = CGPoint(x: b.x - ux * trimEnd, y: b.y - uy * trimEnd)
        let color = arrowColor(arrow).opacity(opacity)
        var path = Path()
        var tangent = CGPoint(x: ux, y: uy)
        let len = hypot(b.x - a.x, b.y - a.y)

        switch arrow.kind {
        case .conduite:
            let n = max(12, Int(len / 3))
            let waves = max(2, Int(len / 16))
            path.move(to: a)
            for i in 1...n {
                let t = CGFloat(i) / CGFloat(n)
                let amp: CGFloat = 4 * sin(t * .pi)   // s'aplatit aux extrémités
                let off = sin(t * CGFloat(waves) * 2 * .pi) * amp
                path.addLine(to: CGPoint(x: a.x + (b.x - a.x) * t - uy * off, y: a.y + (b.y - a.y) * t + ux * off))
            }
        case .passe where arrow.aerial == true:
            let bulge = min(60, len * 0.25)
            let control = CGPoint(x: (a.x + b.x) / 2 + uy * bulge, y: (a.y + b.y) / 2 - ux * bulge)
            path.move(to: a)
            path.addQuadCurve(to: b, control: control)
            let tx = b.x - control.x, ty = b.y - control.y
            let tl = max(0.001, hypot(tx, ty))
            tangent = CGPoint(x: tx / tl, y: ty / tl)
        default:
            path.move(to: a)
            path.addLine(to: b)
        }
        let width: CGFloat = arrow.kind == .tir ? 3.2 : 2.4
        let dash: [CGFloat] = arrow.kind == .course ? [7, 5] : []
        ctx.stroke(path, with: .color(.black.opacity(0.3 * opacity)),
                   style: StrokeStyle(lineWidth: width + 2, lineCap: .round, lineJoin: .round, dash: dash))
        ctx.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round, dash: dash))

        let head: CGFloat = arrow.kind == .tir ? 12 : 10
        var tip = Path()
        tip.move(to: b)
        tip.addLine(to: CGPoint(x: b.x - tangent.x * head - tangent.y * head * 0.55,
                                y: b.y - tangent.y * head + tangent.x * head * 0.55))
        tip.addLine(to: CGPoint(x: b.x - tangent.x * head + tangent.y * head * 0.55,
                                y: b.y - tangent.y * head - tangent.x * head * 0.55))
        tip.closeSubpath()
        ctx.fill(tip, with: .color(color))
    }
}

// MARK: - Schéma statique (vignettes, fiches PDF)

/// Dessin figé d'un exercice : mise en place, ou une étape avec ses flèches
struct AtelierDiagram: View {
    let play: TacticPlay
    var step: Int = 0
    /// Toutes les flèches de l'exercice sur la mise en place (fiche papier)
    var allArrows: Bool = false
    var allowRotation: Bool = true

    var body: some View {
        Canvas { ctx, size in
            let framing = play.framing ?? TacticFraming.fitting(Self.contentPoints(play))
            let vp = AtelierViewport(framing: framing, size: size, padding: 2, allowRotation: allowRotation)
            AtelierRenderer.drawPitch(ctx, vp, grid: false)
            for prop in play.props where prop.kind == .zone { AtelierRenderer.drawProp(ctx, vp, prop, selected: false) }
            for prop in play.props where prop.kind != .zone { AtelierRenderer.drawProp(ctx, vp, prop, selected: false) }
            let frames = play.resolvedFrames()
            guard !frames.isEmpty else { return }
            let index = min(max(0, step), frames.count - 1)
            let frame = allArrows ? frames[0] : frames[index]
            let trim = vp.playerDiameter * 0.5
            if allArrows {
                for i in 1..<max(1, frames.count) {
                    for arrow in play.arrows(forStep: i, frames: frames) {
                        AtelierRenderer.drawArrow(ctx, vp, arrow, trimStart: trim, trimEnd: trim)
                    }
                }
            } else if index > 0 {
                for arrow in play.arrows(forStep: index, frames: frames) {
                    AtelierRenderer.drawArrow(ctx, vp, arrow, trimStart: trim, trimEnd: trim)
                }
            }
            for actor in play.actors {
                guard let p = frame.positions[actor.id] else { continue }
                AtelierRenderer.drawActor(ctx, vp, actor, at: p)
            }
            if play.hasBall {
                AtelierRenderer.drawBall(ctx, at: AtelierRenderer.ballScreenPoint(frame, vp), selected: false)
            }
        }
    }

    static func contentPoints(_ play: TacticPlay) -> [TacticPoint] {
        var points: [TacticPoint] = []
        for step in play.steps {
            points.append(contentsOf: step.positions.values)
            if let b = step.ball { points.append(b) }
        }
        for prop in play.props {
            let w = (prop.size?.x ?? 0) / 2, h = (prop.size?.y ?? 0) / 2
            points.append(TacticPoint(x: prop.position.x - w, y: prop.position.y - h))
            points.append(TacticPoint(x: prop.position.x + w, y: prop.position.y + h))
        }
        return points
    }
}
