//
//  Pitch3DController.swift
//  Temps De Jeu
//
//  Terrain 3D (SceneKit) : joueurs, ballon, matériel, flèches,
//  caméras prédéfinies, animation des étapes et déplacement au doigt.
//

import SwiftUI
import SceneKit
import UIKit
import simd

// MARK: - Données d'affichage

/// Un joueur à afficher sur le terrain 3D
struct Pitch3DActor: Equatable {
    var id: String
    var team: TacticTeam
    var label: String
    var name: String?
    var isGoalkeeper: Bool
    /// Chasuble choisie dans l'Atelier (remplace la couleur du camp)
    var bib: AtelierColor? = nil
}

/// Couleurs des équipes
struct Pitch3DPalette: Equatable {
    var team: JerseyColor = .blue
    var opponent: JerseyColor = .red
    var joker: JerseyColor = .yellow
}

/// Points de vue caméra
enum Pitch3DCameraPreset: String, CaseIterable, Identifiable {
    case coach, tribune, dessus, immersion

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .coach: return "Coach"
        case .tribune: return "Tribune"
        case .dessus: return "Dessus"
        case .immersion: return "Immersion"
        }
    }

    var icon: String {
        switch self {
        case .coach: return "person.fill.viewfinder"
        case .tribune: return "sportscourt"
        case .dessus: return "square.grid.3x3"
        case .immersion: return "eye"
        }
    }
}

// MARK: - Géométrie du terrain (mètres)

enum PitchGeometry {
    static let width: Float = 68
    static let length: Float = 105
    static let margin: Float = 5

    /// Point normalisé → position monde (x, y, z)
    static func world(_ p: TacticPoint, y: Float = 0) -> SIMD3<Float> {
        SIMD3(Float(p.x) * width - width / 2, y, Float(p.y) * length - length / 2)
    }

    static func ground(_ p: TacticPoint) -> SIMD2<Float> {
        SIMD2(Float(p.x) * width - width / 2, Float(p.y) * length - length / 2)
    }

    static func normalized(x: Float, z: Float) -> TacticPoint {
        TacticPoint(x: Double((x + width / 2) / width), y: Double((z + length / 2) / length))
    }
}

// MARK: - Vue SceneKit avec rappel de mise en page

final class PitchSCNView: SCNView {
    var onLayout: ((CGSize) -> Void)?

    override func layoutSubviews() {
        super.layoutSubviews()
        onLayout?(bounds.size)
    }
}

/// Héberge la vue SceneKit du contrôleur dans SwiftUI
struct Pitch3DView: UIViewRepresentable {
    @ObservedObject var controller: Pitch3DController

    func makeUIView(context: Context) -> PitchSCNView {
        controller.scnView
    }

    func updateUIView(_ uiView: PitchSCNView, context: Context) {}
}

// MARK: - Contrôleur de scène

final class Pitch3DController: NSObject, ObservableObject, UIGestureRecognizerDelegate {

    let scnView = PitchSCNView(frame: .zero, options: nil)
    @Published private(set) var isAnimating = false
    @Published private(set) var cameraPreset: Pitch3DCameraPreset = .coach

    // Édition au doigt
    var isEditable = false
    var onActorMoved: ((String, TacticPoint) -> Void)?
    var onBallMoved: ((TacticPoint) -> Void)?
    /// Ballon lâché (fin du geste) : pour le coller à un joueur ou au but
    var onBallDropped: ((TacticPoint) -> Void)?

    private let scene = SCNScene()
    private let cameraNode = SCNNode()
    private let sunNode = SCNNode()
    private let actorsRoot = SCNNode()
    private let propsRoot = SCNNode()
    private let arrowsRoot = SCNNode()
    private let drawingsRoot = SCNNode()
    private let animatorNode = SCNNode()
    private let ballNode = SCNNode()
    /// Autres ballons (Atelier), créés à la demande sur le modèle du premier
    private var otherBallNodes: [String: SCNNode] = [:]

    private var actorNodes: [String: ActorNode] = [:]
    private var actors: [Pitch3DActor] = []
    private var props: [TacticProp] = []
    private var palette = Pitch3DPalette()
    private var currentFrame: TacticFrame?
    private var ballVisible = true
    private var highlighted: Set<String> = []
    private var focusMin = TacticPoint(x: 0, y: 0)
    private var focusMax = TacticPoint(x: 1, y: 1)
    private(set) var playerScale: Float = 1.6
    private var lastLayoutSize: CGSize = .zero
    private var lastArrows: [TacticArrow] = []

    private enum DragTarget: Equatable {
        case actor(String)
        case ball
    }
    private var dragTarget: DragTarget?
    /// Point où le doigt (ou la souris) s'est posé : on sélectionne là, pas après le glissement
    private var touchStart: CGPoint?
    private lazy var dragRecognizer: UIPanGestureRecognizer = {
        let gr = UIPanGestureRecognizer(target: self, action: #selector(handleDrag(_:)))
        gr.delegate = self
        gr.maximumNumberOfTouches = 1
        return gr
    }()

    static let ballRadius: Float = 0.11

    override init() {
        super.init()
        buildScene()
        configureView()
    }

    // MARK: Configuration publique

    /// Définit les joueurs, le matériel et les couleurs (reconstruit les nœuds si besoin)
    func configure(actors newActors: [Pitch3DActor], props newProps: [TacticProp], palette newPalette: Pitch3DPalette) {
        let paletteChanged = newPalette != palette
        palette = newPalette

        if newProps != props {
            props = newProps
            rebuildProps()
        }

        let newIds = Set(newActors.map(\.id))
        for (id, node) in actorNodes where !newIds.contains(id) {
            node.root.removeFromParentNode()
            actorNodes[id] = nil
        }
        for actor in newActors {
            if let existing = actorNodes[actor.id], existing.actor == actor, !paletteChanged {
                continue
            }
            let previousPosition = actorNodes[actor.id]?.root.simdPosition
            actorNodes[actor.id]?.root.removeFromParentNode()
            let node = makeActorNode(actor)
            if let previousPosition { node.root.simdPosition = previousPosition }
            actorNodes[actor.id] = node
            actorsRoot.addChildNode(node.root)
        }
        actors = newActors
        applyScale()
        setHighlights(highlighted)
        refreshAccessibility()
    }

    // MARK: Accessibilité (VoiceOver, tests d'interface)

    /// Un élément accessible qui suit un nœud 3D à l'écran
    private final class NodeElement: UIAccessibilityElement {
        weak var node: SCNNode?
        weak var view: SCNView?
        var height: Float = 0

        override var accessibilityFrame: CGRect {
            get {
                guard let node, let view, !node.isHidden else { return .zero }
                let base = node.presentation.simdWorldPosition
                let a = view.projectPoint(SCNVector3(base))
                let b = view.projectPoint(SCNVector3(base + SIMD3(0, height, 0)))
                let top = CGFloat(min(a.y, b.y)), bottom = CGFloat(max(a.y, b.y))
                let center = CGPoint(x: CGFloat(a.x), y: (top + bottom) / 2)
                let side = max(44, bottom - top)
                let rect = CGRect(x: center.x - side / 2, y: center.y - side / 2, width: side, height: side)
                return UIAccessibility.convertToScreenCoordinates(rect, in: view)
            }
            set {}
        }
    }

    private func refreshAccessibility() {
        var elements: [Any] = []
        let ball = NodeElement(accessibilityContainer: scnView)
        ball.node = ballNode
        ball.view = scnView
        ball.accessibilityLabel = "Ballon"
        ball.accessibilityIdentifier = "ballon-3d"
        elements.append(ball)
        for actor in actors {
            guard let node = actorNodes[actor.id] else { continue }
            let element = NodeElement(accessibilityContainer: scnView)
            element.node = node.root
            element.view = scnView
            element.height = 2.2 * playerScale
            element.accessibilityLabel = actor.team == .adversaire ? "Adversaire \(actor.label)" : "Joueur \(actor.label)"
            element.accessibilityIdentifier = actor.team == .adversaire ? "adversaire3d-\(actor.label)" : "joueur3d-\(actor.label)"
            elements.append(element)
        }
        scnView.isAccessibilityElement = false
        scnView.accessibilityElements = elements
    }

    /// Zone à cadrer par la caméra (coordonnées normalisées)
    func setFocus(min lo: TacticPoint, max hi: TacticPoint) {
        let padX = 0.06, padY = 0.05
        focusMin = TacticPoint(x: Swift.max(0, lo.x - padX), y: Swift.max(0, lo.y - padY))
        focusMax = TacticPoint(x: Swift.min(1, hi.x + padX), y: Swift.min(1, hi.y + padY))
        // Joueurs plus gros quand on voit tout le terrain
        let span = Swift.max(Float(focusMax.x - focusMin.x) * PitchGeometry.width,
                             Float(focusMax.y - focusMin.y) * PitchGeometry.length)
        playerScale = Swift.min(2.4, Swift.max(1.15, 0.8 + span / 60))
        applyScale()
        if !lastArrows.isEmpty { showArrows(lastArrows, animated: false) }
    }

    func setBallVisible(_ visible: Bool) {
        ballVisible = visible
        ballNode.isHidden = !visible
    }

    /// Place instantanément tous les éléments
    func setFrame(_ frame: TacticFrame) {
        animatorNode.removeAction(forKey: "step")
        if isAnimating { isAnimating = false }
        currentFrame = frame
        for (id, node) in actorNodes {
            if case .actor(let dragged) = dragTarget, dragged == id { continue }
            if let p = frame.positions[id] {
                node.root.isHidden = false
                node.root.simdPosition = PitchGeometry.world(p)
                node.body.simdPosition = .zero
            } else {
                node.root.isHidden = true
            }
        }
        if dragTarget != .ball {
            ballNode.simdPosition = ballWorld(frame.ball)
        }
        for (id, node) in otherBallNodes where frame.otherBalls[id] == nil {
            node.isHidden = true
        }
        for (id, ball) in frame.otherBalls {
            let node = otherBallNode(id)
            node.isHidden = false
            node.simdPosition = ballWorld(ball.point)
        }
    }

    private func otherBallNode(_ id: String) -> SCNNode {
        if let node = otherBallNodes[id] { return node }
        let node = ballNode.clone()
        node.name = "ball-\(id)"
        node.isHidden = false
        node.scale = SCNVector3(ballScale, ballScale, ballScale)
        ballNode.parent?.addChildNode(node)
        otherBallNodes[id] = node
        return node
    }

    /// Anime le passage à un nouvel état (ballon synchronisé avec les joueurs)
    func animate(to frame: TacticFrame, aerial: Bool, otherAerial: Set<String> = [], duration: TimeInterval,
                 completion: (() -> Void)? = nil) {
        guard let from = currentFrame, duration > 0.05 else {
            setFrame(frame)
            completion?()
            return
        }
        animatorNode.removeAction(forKey: "step")

        var moves: [StepMove] = []
        for (id, node) in actorNodes {
            guard let end = frame.positions[id] else {
                node.root.isHidden = true
                continue
            }
            // Départ = position réellement affichée (une animation peut être interrompue)
            let e = PitchGeometry.world(end)
            let s: SIMD3<Float>
            if node.root.isHidden || from.positions[id] == nil {
                s = e
            } else {
                s = SIMD3(node.root.simdPosition.x, 0, node.root.simdPosition.z)
            }
            node.root.isHidden = false
            let distance = simd_distance(s, e)
            moves.append(StepMove(root: node.root, body: node.body, start: s, end: e,
                                  strides: distance > 1 ? Swift.max(2, Float(distance / 2.2)) : 0))
        }

        func ballMove(_ node: SCNNode, to point: TacticPoint, aerial: Bool, appearing: Bool) -> BallMove {
            let end = ballWorld(point)
            var start = appearing ? end : node.simdPosition
            start.y = Self.ballRadius * ballScale
            let distance = simd_distance(start, end)
            let height: Float = aerial ? Swift.min(10, Swift.max(2.5, distance * 0.2)) : 0
            return BallMove(node: node, start: start, end: end, height: height, radius: Self.ballRadius * ballScale)
        }
        var balls = [ballMove(ballNode, to: frame.ball, aerial: aerial, appearing: false)]
        for (id, node) in otherBallNodes where frame.otherBalls[id] == nil {
            node.isHidden = true
        }
        for (id, ball) in frame.otherBalls {
            let node = otherBallNode(id)
            let appearing = node.isHidden || from.otherBalls[id] == nil
            node.isHidden = false
            balls.append(ballMove(node, to: ball.point, aerial: otherAerial.contains(id), appearing: appearing))
        }

        currentFrame = frame
        isAnimating = true
        let action = Self.makeStepAction(moves: moves, balls: balls, duration: duration)
        Self.run(action, on: animatorNode) { [weak self] in
            guard let self else { return }
            self.isAnimating = false
            completion?()
        }
    }

    /// Affiche les flèches au sol
    func showArrows(_ arrows: [TacticArrow], animated: Bool) {
        lastArrows = arrows
        for child in arrowsRoot.childNodes {
            if animated {
                child.runAction(.sequence([.fadeOut(duration: 0.2), .removeFromParentNode()]))
            } else {
                child.removeFromParentNode()
            }
        }
        for arrow in arrows {
            let node = ArrowBuilder.node(for: arrow, playerScale: playerScale)
            if animated {
                node.opacity = 0
                node.runAction(.fadeIn(duration: 0.35))
            }
            arrowsRoot.addChildNode(node)
        }
    }

    /// Tracés libres de la vue Placement (polylignes)
    func showDrawings(_ lines: [[TacticPoint]]) {
        drawingsRoot.childNodes.forEach { $0.removeFromParentNode() }
        for line in lines where line.count > 1 {
            drawingsRoot.addChildNode(ArrowBuilder.polylineNode(points: line.map(PitchGeometry.ground),
                                                                color: UIColor(red: 1, green: 0.85, blue: 0.1, alpha: 1),
                                                                width: 0.3 * Swift.max(1, playerScale * 0.8)))
        }
    }

    /// Met en évidence des joueurs (halo pulsé)
    func setHighlights(_ ids: Set<String>) {
        highlighted = ids
        for (id, node) in actorNodes {
            let on = ids.contains(id)
            if on && node.halo.isHidden {
                node.halo.isHidden = false
                node.halo.opacity = 0.9
                node.halo.scale = SCNVector3(1, 1, 1)
                node.halo.runAction(.repeatForever(.sequence([
                    .group([.scale(to: 1.35, duration: 0.7), .fadeOpacity(to: 0.25, duration: 0.7)]),
                    .group([.scale(to: 1.0, duration: 0.7), .fadeOpacity(to: 0.9, duration: 0.7)])
                ])), forKey: "pulse")
            } else if !on && !node.halo.isHidden {
                node.halo.removeAction(forKey: "pulse")
                node.halo.isHidden = true
            }
        }
    }

    // MARK: Caméra

    func applyCamera(_ preset: Pitch3DCameraPreset, animated: Bool) {
        cameraPreset = preset
        scnView.defaultCameraController.stopInertia()

        let lo = PitchGeometry.world(focusMin)
        let hi = PitchGeometry.world(focusMax)
        let center = (lo + hi) / 2
        let spanX = Swift.max(12, hi.x - lo.x)
        let spanZ = Swift.max(12, hi.z - lo.z)

        let size = scnView.bounds.size
        let aspect = size.width > 1 && size.height > 1 ? Float(size.width / size.height) : 0.75
        let vfov = Float(cameraNode.camera?.fieldOfView ?? 40) * .pi / 180
        let tanV = tan(vfov / 2)
        let tanH = tanV * aspect
        func distance(horizontal: Float, vertical: Float) -> Float {
            Swift.max(horizontal / (2 * tanH), vertical / (2 * tanV)) * 1.05
        }
        let figure = 2.2 * playerScale

        let position: SIMD3<Float>
        var target = center
        var up = SIMD3<Float>(0, 1, 0)
        switch preset {
        case .coach:
            let elevation: Float = 40 * .pi / 180
            let d = distance(horizontal: spanX, vertical: spanZ * sin(elevation) + figure) * 1.12
            // Visée légèrement vers la caméra : les joueurs les plus proches restent dans le champ
            target = center + SIMD3(0, 0, spanZ * 0.07)
            position = target + SIMD3(0, d * sin(elevation), d * cos(elevation))
        case .tribune:
            let elevation: Float = 28 * .pi / 180
            let d = distance(horizontal: spanZ, vertical: spanX * sin(elevation) + figure)
            position = center + SIMD3(d * cos(elevation), d * sin(elevation), 0)
        case .dessus:
            let d = distance(horizontal: spanX, vertical: spanZ)
            position = center + SIMD3(0, d, 0.01)
            up = SIMD3(0, 0, -1)
        case .immersion:
            position = SIMD3(center.x, 2.2 * playerScale + 1.5, hi.z + 6)
            target = SIMD3(center.x, 1, center.z - spanZ * 0.2)
        }

        let apply = {
            self.cameraNode.simdPosition = position
            self.cameraNode.simdLook(at: target, up: up, localFront: SIMD3(0, 0, -1))
        }
        if animated {
            SCNTransaction.begin()
            SCNTransaction.animationDuration = 0.8
            SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            apply()
            SCNTransaction.commit()
        } else {
            apply()
        }
        scnView.pointOfView = cameraNode
        scnView.defaultCameraController.target = SCNVector3(target)
    }

    // MARK: - Construction de la scène

    private func configureView() {
        scnView.scene = scene
        scnView.backgroundColor = UIColor(red: 0.62, green: 0.78, blue: 0.93, alpha: 1)
        scnView.antialiasingMode = .multisampling4X
        scnView.preferredFramesPerSecond = 60
        scnView.pointOfView = cameraNode
        scnView.allowsCameraControl = true
        scnView.defaultCameraController.interactionMode = .orbitTurntable
        scnView.defaultCameraController.inertiaEnabled = true
        scnView.defaultCameraController.maximumVerticalAngle = 89
        scnView.defaultCameraController.minimumVerticalAngle = 3

        scnView.addGestureRecognizer(dragRecognizer)
        linkCameraGestures()

        scnView.onLayout = { [weak self] size in
            guard let self, size.width > 1, size.height > 1 else { return }
            self.linkCameraGestures()
            let old = self.lastLayoutSize
            self.lastLayoutSize = size
            let oldAspect = old.height > 0 ? old.width / old.height : 0
            let newAspect = size.width / size.height
            if old == .zero || abs(oldAspect - newAspect) > 0.15 {
                self.applyCamera(self.cameraPreset, animated: false)
            }
        }
    }

    /// Les gestes caméra attendent que le geste « déplacer un joueur » échoue
    private var linkedGestures = Set<ObjectIdentifier>()
    private func linkCameraGestures() {
        for gr in scnView.gestureRecognizers ?? [] where gr !== dragRecognizer {
            let key = ObjectIdentifier(gr)
            guard !linkedGestures.contains(key) else { continue }
            gr.require(toFail: dragRecognizer)
            linkedGestures.insert(key)
        }
    }

    private func buildScene() {
        let root = scene.rootNode
        scene.background.contents = TextureFactory.sky()
        scene.fogColor = UIColor(red: 0.78, green: 0.86, blue: 0.93, alpha: 1)
        scene.fogStartDistance = 170
        scene.fogEndDistance = 460

        // Sol extérieur
        let outer = SCNPlane(width: 700, height: 700)
        outer.firstMaterial = Materials.lambert(UIColor(red: 0.16, green: 0.36, blue: 0.17, alpha: 1))
        let outerNode = SCNNode(geometry: outer)
        outerNode.eulerAngles.x = -.pi / 2
        outerNode.position.y = -0.03
        root.addChildNode(outerNode)

        // Pelouse + tracés
        let pitch = SCNPlane(width: CGFloat(PitchGeometry.width + 2 * PitchGeometry.margin),
                             height: CGFloat(PitchGeometry.length + 2 * PitchGeometry.margin))
        let pitchMaterial = SCNMaterial()
        pitchMaterial.lightingModel = .lambert
        pitchMaterial.diffuse.contents = TextureFactory.pitch()
        pitchMaterial.diffuse.mipFilter = .linear
        pitchMaterial.diffuse.maxAnisotropy = 16
        pitch.firstMaterial = pitchMaterial
        let pitchNode = SCNNode(geometry: pitch)
        pitchNode.eulerAngles.x = -.pi / 2
        root.addChildNode(pitchNode)

        root.addChildNode(Self.goalNode(lineZ: -PitchGeometry.length / 2, outward: -1))
        root.addChildNode(Self.goalNode(lineZ: PitchGeometry.length / 2, outward: 1))
        root.addChildNode(Self.stadiumNode())

        // Lumières
        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.intensity = 480
        root.addChildNode(ambient)

        let sun = SCNLight()
        sun.type = .directional
        sun.intensity = 950
        sun.castsShadow = true
        sun.shadowMode = .deferred
        sun.shadowColor = UIColor.black.withAlphaComponent(0.38)
        sun.shadowSampleCount = 8
        sun.shadowRadius = 2.5
        sun.shadowMapSize = CGSize(width: 2048, height: 2048)
        sun.automaticallyAdjustsShadowProjection = true
        sun.maximumShadowDistance = 170
        sunNode.light = sun
        sunNode.eulerAngles = SCNVector3(-0.95, 0.55, 0)
        root.addChildNode(sunNode)

        // Caméra
        let camera = SCNCamera()
        camera.fieldOfView = 40
        camera.zNear = 0.3
        camera.zFar = 900
        cameraNode.camera = camera
        cameraNode.position = SCNVector3(0, 70, 95)
        root.addChildNode(cameraNode)

        root.addChildNode(propsRoot)
        root.addChildNode(arrowsRoot)
        root.addChildNode(drawingsRoot)
        root.addChildNode(actorsRoot)
        root.addChildNode(animatorNode)

        // Ballon
        let sphere = SCNSphere(radius: CGFloat(Self.ballRadius))
        sphere.segmentCount = 32
        let ballMaterial = SCNMaterial()
        ballMaterial.diffuse.contents = TextureFactory.ball()
        ballMaterial.lightingModel = .blinn
        ballMaterial.specular.contents = UIColor(white: 0.6, alpha: 1)
        sphere.firstMaterial = ballMaterial
        ballNode.geometry = sphere
        ballNode.name = "ball"
        ballNode.castsShadow = true
        root.addChildNode(ballNode)
        applyScale()
    }

    private var ballScale: Float { Swift.max(3.0, playerScale * 2.4) * (isEditable ? 1.25 : 1) }

    private func ballWorld(_ p: TacticPoint) -> SIMD3<Float> {
        PitchGeometry.world(p, y: Self.ballRadius * ballScale)
    }

    private func applyScale() {
        let s = playerScale
        for node in actorNodes.values {
            node.root.scale = SCNVector3(s, s, s)
        }
        ballNode.scale = SCNVector3(ballScale, ballScale, ballScale)
        for node in otherBallNodes.values {
            node.scale = SCNVector3(ballScale, ballScale, ballScale)
        }
        if let frame = currentFrame, !isAnimating {
            ballNode.simdPosition = ballWorld(frame.ball)
            for (id, ball) in frame.otherBalls {
                otherBallNodes[id]?.simdPosition = ballWorld(ball.point)
            }
        }
        let propScale = Swift.max(1.0, s * 0.85)
        for child in propsRoot.childNodes where child.name == "small-prop" {
            child.scale = SCNVector3(propScale, propScale, propScale)
        }
    }

    // MARK: Joueurs

    private final class ActorNode {
        let root: SCNNode
        let body: SCNNode
        let halo: SCNNode
        let actor: Pitch3DActor

        init(root: SCNNode, body: SCNNode, halo: SCNNode, actor: Pitch3DActor) {
            self.root = root
            self.body = body
            self.halo = halo
            self.actor = actor
        }
    }

    private func jersey(for actor: Pitch3DActor) -> (fill: UIColor, text: UIColor) {
        if let bib = actor.bib {
            return (bib.uiColor, bib.textUIColor)
        }
        if actor.isGoalkeeper {
            return Self.goalkeeperColors(avoiding: [UIColor(palette.team.color), UIColor(palette.opponent.color)])
        }
        let color: JerseyColor
        switch actor.team {
        case .equipe: color = palette.team
        case .adversaire: color = palette.opponent
        case .joker: color = palette.joker
        }
        return (UIColor(color.color), UIColor(color.textColor))
    }

    private func makeActorNode(_ actor: Pitch3DActor) -> ActorNode {
        let colors = jersey(for: actor)
        let root = SCNNode()
        root.name = "actor:\(actor.id)"
        let body = SCNNode()
        root.addChildNode(body)

        // Anneau au sol (repère de position vu de loin)
        let ring = SCNCylinder(radius: 0.6, height: 0.02)
        ring.firstMaterial = Materials.constant(colors.fill.withAlphaComponent(0.6))
        let ringNode = SCNNode(geometry: ring)
        ringNode.position.y = 0.015
        ringNode.castsShadow = false
        root.addChildNode(ringNode)

        // Halo de mise en évidence
        let halo = SCNTorus(ringRadius: 0.95, pipeRadius: 0.07)
        halo.firstMaterial = Materials.constant(UIColor(red: 1, green: 0.9, blue: 0.2, alpha: 1))
        let haloNode = SCNNode(geometry: halo)
        haloNode.position.y = 0.06
        haloNode.isHidden = true
        haloNode.castsShadow = false
        root.addChildNode(haloNode)

        let isLight = colors.fill.perceivedBrightness > 0.75
        let shortsColor = isLight ? UIColor(red: 0.1, green: 0.14, blue: 0.3, alpha: 1) : UIColor(white: 0.97, alpha: 1)
        let skin = UIColor(red: 0.78, green: 0.6, blue: 0.47, alpha: 1)

        // Jambes (chaussettes couleur maillot)
        for dx: Float in [-0.11, 0.11] {
            let leg = SCNCylinder(radius: 0.085, height: 0.78)
            leg.firstMaterial = Materials.lambert(colors.fill)
            let legNode = SCNNode(geometry: leg)
            legNode.position = SCNVector3(dx, 0.39, 0)
            body.addChildNode(legNode)
        }
        // Short
        let shorts = SCNCylinder(radius: 0.25, height: 0.3)
        shorts.firstMaterial = Materials.lambert(shortsColor)
        let shortsNode = SCNNode(geometry: shorts)
        shortsNode.position.y = 0.88
        body.addChildNode(shortsNode)
        // Buste
        let torso = SCNCapsule(capRadius: 0.27, height: 0.86)
        torso.firstMaterial = Materials.lambert(colors.fill)
        let torsoNode = SCNNode(geometry: torso)
        torsoNode.position.y = 1.33
        body.addChildNode(torsoNode)
        // Tête
        let head = SCNSphere(radius: 0.17)
        head.firstMaterial = Materials.lambert(skin)
        let headNode = SCNNode(geometry: head)
        headNode.position.y = 1.93
        body.addChildNode(headNode)

        // Étiquette (numéro + nom), toujours face caméra
        let image = TextureFactory.label(number: actor.label, name: actor.name, fill: colors.fill, text: colors.text)
        let labelWidth: CGFloat = actor.name == nil ? 1.25 : 1.9
        let plane = SCNPlane(width: labelWidth, height: labelWidth * image.size.height / image.size.width)
        let labelMaterial = SCNMaterial()
        labelMaterial.diffuse.contents = image
        labelMaterial.lightingModel = .constant
        labelMaterial.isDoubleSided = true
        labelMaterial.readsFromDepthBuffer = false
        labelMaterial.writesToDepthBuffer = false
        plane.firstMaterial = labelMaterial
        let labelNode = SCNNode(geometry: plane)
        labelNode.position.y = 2.25 + Float(plane.height / 2)
        labelNode.constraints = [SCNBillboardConstraint()]
        labelNode.renderingOrder = 100
        labelNode.castsShadow = false
        body.addChildNode(labelNode)

        root.scale = SCNVector3(playerScale, playerScale, playerScale)
        return ActorNode(root: root, body: body, halo: haloNode, actor: actor)
    }

    static func goalkeeperColors(avoiding colors: [UIColor]) -> (fill: UIColor, text: UIColor) {
        let candidates: [(UIColor, UIColor)] = [
            (UIColor(red: 0.72, green: 0.95, blue: 0.15, alpha: 1), .black),
            (UIColor(red: 1.0, green: 0.45, blue: 0.0, alpha: 1), .white),
            (UIColor(red: 0.85, green: 0.1, blue: 0.75, alpha: 1), .white),
            (UIColor(red: 0.1, green: 0.85, blue: 0.85, alpha: 1), .black)
        ]
        for candidate in candidates where colors.allSatisfy({ $0.distance(to: candidate.0) > 0.45 }) {
            return candidate
        }
        return candidates[0]
    }

    // MARK: Matériel

    private func rebuildProps() {
        propsRoot.childNodes.forEach { $0.removeFromParentNode() }
        for prop in props {
            let color = prop.atelierColor.uiColor
            let node: SCNNode
            let angle = Float(-(prop.rotation ?? 0) * .pi / 180)
            switch prop.kind {
            case .plot:
                let cone = SCNCone(topRadius: 0.035, bottomRadius: 0.17, height: 0.3)
                cone.firstMaterial = Materials.lambert(color)
                let cone3D = SCNNode(geometry: cone)
                cone3D.position.y = 0.15
                node = SCNNode()
                node.addChildNode(cone3D)
                node.name = "small-prop"
            case .coupelle:
                let disc = SCNCone(topRadius: 0.07, bottomRadius: 0.2, height: 0.07)
                disc.firstMaterial = Materials.lambert(color)
                let disc3D = SCNNode(geometry: disc)
                disc3D.position.y = 0.035
                node = SCNNode()
                node.addChildNode(disc3D)
                node.name = "small-prop"
            case .piquet:
                let pole = SCNCylinder(radius: 0.03, height: 1.6)
                pole.firstMaterial = Materials.lambert(color)
                let poleNode = SCNNode(geometry: pole)
                poleNode.position.y = 0.8
                node = SCNNode()
                node.addChildNode(poleNode)
                node.name = "small-prop"
            case .mannequin:
                let capsule = SCNCapsule(capRadius: 0.28, height: 1.9)
                capsule.firstMaterial = Materials.lambert(color)
                let shape = SCNNode(geometry: capsule)
                shape.position.y = 0.95
                shape.scale = SCNVector3(1, 1, 0.45)
                node = SCNNode()
                node.addChildNode(shape)
                node.eulerAngles.y = angle
            case .miniBut:
                node = Self.miniGoalNode()
                node.eulerAngles.y = angle
            case .but:
                node = Self.miniGoalNode(width: 5, height: 2, depth: 1.5)
                node.eulerAngles.y = angle
            case .cerceau:
                let hoop = SCNTorus(ringRadius: 0.4, pipeRadius: 0.025)
                hoop.firstMaterial = Materials.lambert(color)
                let hoopNode = SCNNode(geometry: hoop)
                hoopNode.position.y = 0.03
                node = SCNNode()
                node.addChildNode(hoopNode)
                node.name = "small-prop"
            case .echelle:
                node = Self.ladderNode(color: color)
                node.eulerAngles.y = angle
            case .haie:
                node = Self.hurdleNode(color: color)
                node.eulerAngles.y = angle
                node.name = "small-prop"
            case .ballon:
                let sphere = SCNSphere(radius: 0.11)
                let material = Materials.lambert(.white)
                material.diffuse.contents = TextureFactory.ball()
                sphere.firstMaterial = material
                let ball = SCNNode(geometry: sphere)
                ball.position.y = 0.11
                node = SCNNode()
                node.addChildNode(ball)
                node.name = "small-prop"
            case .zone:
                node = Self.zoneNode(size: prop.size ?? TacticPoint(x: 0.2, y: 0.15), color: color)
            }
            let p = PitchGeometry.world(prop.position)
            node.simdPosition = SIMD3(p.x, node.simdPosition.y, p.z)
            propsRoot.addChildNode(node)
        }
        applyScale()
    }

    /// Échelle de rythme : 4 m de long (sur z quand rotation = 0), 0,5 m de large
    private static func ladderNode(color: UIColor) -> SCNNode {
        let node = SCNNode()
        let material = Materials.lambert(color)
        let length: Float = 4, width: Float = 0.5
        for x in [-width / 2, width / 2] {
            let rail = SCNBox(width: 0.04, height: 0.02, length: CGFloat(length), chamferRadius: 0)
            rail.firstMaterial = material
            let railNode = SCNNode(geometry: rail)
            railNode.position = SCNVector3(x, 0.012, 0)
            node.addChildNode(railNode)
        }
        let rungs = 9
        for i in 0..<rungs {
            let z = -length / 2 + length * Float(i) / Float(rungs - 1)
            let rung = SCNBox(width: CGFloat(width), height: 0.015, length: 0.035, chamferRadius: 0)
            rung.firstMaterial = material
            let rungNode = SCNNode(geometry: rung)
            rungNode.position = SCNVector3(0, 0.01, z)
            node.addChildNode(rungNode)
        }
        return node
    }

    /// Petite haie : barre de 1 m (sur x quand rotation = 0) à 30 cm du sol
    private static func hurdleNode(color: UIColor) -> SCNNode {
        let node = SCNNode()
        let material = Materials.lambert(color)
        let width: Float = 1, height: Float = 0.3
        let bar = SCNCylinder(radius: 0.025, height: CGFloat(width))
        bar.firstMaterial = material
        let barNode = SCNNode(geometry: bar)
        barNode.eulerAngles.z = .pi / 2
        barNode.position = SCNVector3(0, height, 0)
        node.addChildNode(barNode)
        for x in [-width / 2, width / 2] {
            let leg = SCNCylinder(radius: 0.02, height: CGFloat(height))
            leg.firstMaterial = material
            let legNode = SCNNode(geometry: leg)
            legNode.position = SCNVector3(x, height / 2, 0)
            node.addChildNode(legNode)
            let foot = SCNBox(width: 0.04, height: 0.02, length: 0.3, chamferRadius: 0)
            foot.firstMaterial = material
            let footNode = SCNNode(geometry: foot)
            footNode.position = SCNVector3(x, 0.01, 0)
            node.addChildNode(footNode)
        }
        return node
    }

    private static func zoneNode(size: TacticPoint, color: UIColor) -> SCNNode {
        let w = Float(size.x) * PitchGeometry.width
        let h = Float(size.y) * PitchGeometry.length
        let node = SCNNode()
        let plane = SCNPlane(width: CGFloat(w), height: CGFloat(h))
        let material = Materials.constant(color.withAlphaComponent(0.16))
        material.writesToDepthBuffer = false
        plane.firstMaterial = material
        let fill = SCNNode(geometry: plane)
        fill.eulerAngles.x = -.pi / 2
        fill.position.y = 0.025
        fill.castsShadow = false
        node.addChildNode(fill)
        let corners: [SIMD2<Float>] = [
            SIMD2(-w / 2, -h / 2), SIMD2(w / 2, -h / 2), SIMD2(w / 2, h / 2), SIMD2(-w / 2, h / 2), SIMD2(-w / 2, -h / 2)
        ]
        let border = ArrowBuilder.ribbonGeometry(points: corners, width: 0.14, y: 0.035)
        border.firstMaterial = Materials.constant(color.withAlphaComponent(0.85))
        let borderNode = SCNNode(geometry: border)
        borderNode.castsShadow = false
        node.addChildNode(borderNode)
        return node
    }

    private static func miniGoalNode(width: Float = 2.0, height: Float = 1.0, depth: Float = 0.8) -> SCNNode {
        // Ouverture tournée vers +z (bas de l'écran) quand rotation = 0
        let node = SCNNode()
        let white = Materials.lambert(.white)
        for x in [-width / 2, width / 2] {
            let post = SCNCylinder(radius: 0.04, height: CGFloat(height))
            post.firstMaterial = white
            let postNode = SCNNode(geometry: post)
            postNode.position = SCNVector3(x, height / 2, 0)
            node.addChildNode(postNode)
        }
        let bar = SCNCylinder(radius: 0.04, height: CGFloat(width))
        bar.firstMaterial = white
        let barNode = SCNNode(geometry: bar)
        barNode.eulerAngles.z = .pi / 2
        barNode.position = SCNVector3(0, height, 0)
        node.addChildNode(barNode)
        node.addChildNode(netBox(width: width, height: height, depth: depth, outward: -1))
        return node
    }

    // MARK: Buts & stade

    private static func goalNode(lineZ: Float, outward: Float) -> SCNNode {
        let node = SCNNode()
        let white = Materials.lambert(UIColor(white: 0.98, alpha: 1))
        let width: Float = 7.32, height: Float = 2.44, depth: Float = 2.0, r: CGFloat = 0.07
        for x in [-width / 2, width / 2] {
            let post = SCNCylinder(radius: r, height: CGFloat(height))
            post.firstMaterial = white
            let postNode = SCNNode(geometry: post)
            postNode.position = SCNVector3(x, height / 2, 0)
            node.addChildNode(postNode)
        }
        let bar = SCNCylinder(radius: r, height: CGFloat(width) + 2 * r)
        bar.firstMaterial = white
        let barNode = SCNNode(geometry: bar)
        barNode.eulerAngles.z = .pi / 2
        barNode.position = SCNVector3(0, height, 0)
        node.addChildNode(barNode)
        node.addChildNode(netBox(width: width, height: height, depth: depth, outward: outward))
        node.position = SCNVector3(0, 0, lineZ)
        return node
    }

    /// Filet : fond + toit + côtés (plans semi-transparents)
    private static func netBox(width: Float, height: Float, depth: Float, outward: Float) -> SCNNode {
        let node = SCNNode()
        let material = SCNMaterial()
        material.diffuse.contents = TextureFactory.net()
        material.diffuse.wrapS = .repeat
        material.diffuse.wrapT = .repeat
        material.lightingModel = .constant
        material.isDoubleSided = true
        material.writesToDepthBuffer = false

        func plane(_ w: Float, _ h: Float, repeatX: Float, repeatY: Float) -> SCNPlane {
            let p = SCNPlane(width: CGFloat(w), height: CGFloat(h))
            let m = material.copy() as! SCNMaterial
            m.diffuse.contentsTransform = SCNMatrix4MakeScale(repeatX, repeatY, 1)
            p.firstMaterial = m
            return p
        }
        let cell: Float = 0.25
        let back = SCNNode(geometry: plane(width, height, repeatX: width / cell, repeatY: height / cell))
        back.position = SCNVector3(0, height / 2, outward * depth)
        node.addChildNode(back)

        let roof = SCNNode(geometry: plane(width, depth, repeatX: width / cell, repeatY: depth / cell))
        roof.eulerAngles.x = -.pi / 2
        roof.position = SCNVector3(0, height, outward * depth / 2)
        node.addChildNode(roof)

        for x in [-width / 2, width / 2] {
            let side = SCNNode(geometry: plane(depth, height, repeatX: depth / cell, repeatY: height / cell))
            side.eulerAngles.y = .pi / 2
            side.position = SCNVector3(x, height / 2, outward * depth / 2)
            node.addChildNode(side)
        }
        node.castsShadow = false
        node.enumerateChildNodes { child, _ in child.castsShadow = false }
        return node
    }

    private static func stadiumNode() -> SCNNode {
        let node = SCNNode()
        let standColor = UIColor(red: 0.33, green: 0.36, blue: 0.43, alpha: 1)
        let seatColor = UIColor(red: 0.18, green: 0.32, blue: 0.58, alpha: 1)
        let boardColor = UIColor(red: 0.08, green: 0.16, blue: 0.36, alpha: 1)
        let halfW = PitchGeometry.width / 2
        let halfL = PitchGeometry.length / 2

        // Panneaux publicitaires (bandeau autour du terrain)
        func board(width: Float, depth: Float, x: Float, z: Float) {
            let box = SCNBox(width: CGFloat(width), height: 0.9, length: CGFloat(depth), chamferRadius: 0)
            box.firstMaterial = Materials.lambert(boardColor)
            let b = SCNNode(geometry: box)
            b.position = SCNVector3(x, 0.45, z)
            node.addChildNode(b)
        }
        let gap: Float = 4
        board(width: 0.15, depth: PitchGeometry.length + 2 * gap, x: -halfW - gap, z: 0)
        board(width: 0.15, depth: PitchGeometry.length + 2 * gap, x: halfW + gap, z: 0)
        board(width: PitchGeometry.width + 2 * gap, depth: 0.15, x: 0, z: -halfL - gap)
        board(width: PitchGeometry.width + 2 * gap, depth: 0.15, x: 0, z: halfL + gap)

        // Tribunes en gradins
        for tier in 0..<4 {
            let t = Float(tier)
            let h: Float = 1.6 + t * 1.6
            let offset: Float = 9 + t * 3
            let color = tier % 2 == 0 ? standColor : seatColor
            let sideLength = PitchGeometry.length + 2 * offset
            for sign: Float in [-1, 1] {
                let side = SCNBox(width: 3, height: CGFloat(h), length: CGFloat(sideLength), chamferRadius: 0)
                side.firstMaterial = Materials.lambert(color)
                let s = SCNNode(geometry: side)
                s.position = SCNVector3(sign * (halfW + offset), h / 2, 0)
                node.addChildNode(s)

                let end = SCNBox(width: CGFloat(PitchGeometry.width + 2 * offset + 3), height: CGFloat(h), length: 3, chamferRadius: 0)
                end.firstMaterial = Materials.lambert(color)
                let e = SCNNode(geometry: end)
                e.position = SCNVector3(0, h / 2, sign * (halfL + offset))
                node.addChildNode(e)
            }
        }
        node.enumerateChildNodes { child, _ in child.castsShadow = false }
        return node
    }

    // MARK: - Animation (exécutée sur le fil de rendu SceneKit)

    private struct StepMove {
        let root: SCNNode
        let body: SCNNode
        let start: SIMD3<Float>
        let end: SIMD3<Float>
        let strides: Float
    }

    private struct BallMove {
        let node: SCNNode
        let start: SIMD3<Float>
        let end: SIMD3<Float>
        let height: Float
        let radius: Float
    }

    private static func ease(_ t: Float) -> Float {
        t * t * (3 - 2 * t)
    }

    /// Un ballon qui roule : orientation de départ et axe de rotation
    private struct BallRoll {
        let move: BallMove
        let orientation: simd_quatf
        let axis: SIMD3<Float>
        let length: Float

        init(_ move: BallMove) {
            self.move = move
            orientation = move.node.simdOrientation
            let direction = move.end - move.start
            let horizontal = SIMD3<Float>(direction.x, 0, direction.z)
            length = simd_length(horizontal)
            axis = length > 0.001 ? simd_normalize(simd_cross(SIMD3<Float>(0, 1, 0), horizontal)) : SIMD3<Float>(1, 0, 0)
        }
    }

    private static func makeStepAction(moves: [StepMove], balls: [BallMove], duration: TimeInterval) -> SCNAction {
        let rolls = balls.map(BallRoll.init)

        return SCNAction.customAction(duration: duration) { _, elapsed in
            let t = Swift.min(1, Swift.max(0, Float(elapsed) / Float(duration)))
            let e = ease(t)
            for move in moves {
                move.root.simdPosition = simd_mix(move.start, move.end, SIMD3(repeating: e))
                if move.strides > 0 {
                    // Petit rebond de course, nul au départ et à l'arrivée
                    let envelope = sin(t * .pi)
                    move.body.simdPosition = SIMD3(0, abs(sin(t * .pi * move.strides)) * 0.09 * envelope, 0)
                } else {
                    move.body.simdPosition = .zero
                }
            }
            for roll in rolls {
                let ball = roll.move
                var p = simd_mix(ball.start, ball.end, SIMD3(repeating: e))
                p.y = ball.radius + ball.height * 4 * e * (1 - e)
                ball.node.simdPosition = p
                if roll.length > 0.001 {
                    let angle = roll.length * e / ball.radius
                    ball.node.simdOrientation = simd_quatf(angle: angle, axis: roll.axis) * roll.orientation
                }
            }
        }
    }

    private static func run(_ action: SCNAction, on node: SCNNode, completion: @escaping () -> Void) {
        node.runAction(action, forKey: "step") {
            DispatchQueue.main.async(execute: completion)
        }
    }

    // MARK: - Déplacement au doigt / à la souris

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        if gestureRecognizer === dragRecognizer {
            touchStart = touch.location(in: scnView)
        }
        return true
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard gestureRecognizer === dragRecognizer else { return true }
        guard isEditable, !isAnimating else { return false }
        dragTarget = hitTarget(at: touchStart ?? gestureRecognizer.location(in: scnView))
        return dragTarget != nil
    }

    /// Sélection tolérante : l'élément le plus proche du doigt à l'écran (ballon prioritaire)
    private func hitTarget(at point: CGPoint) -> DragTarget? {
        func screenDistance(_ world: SIMD3<Float>) -> CGFloat {
            let p = scnView.projectPoint(SCNVector3(world))
            guard p.z > 0, p.z < 1 else { return .infinity }
            return hypot(CGFloat(p.x) - point.x, CGFloat(p.y) - point.y)
        }
        var best: (target: DragTarget, distance: CGFloat)?

        for (id, node) in actorNodes where !node.root.isHidden {
            let base = node.root.simdPosition
            let h = 1.0 * playerScale
            let d = Swift.min(screenDistance(base + SIMD3(0, h * 0.5, 0)),
                              screenDistance(base + SIMD3(0, h * 1.3, 0)),
                              screenDistance(base + SIMD3(0, h * 2.4, 0)))
            if d < 44, d < (best?.distance ?? .infinity) {
                best = (.actor(id), d)
            }
        }

        if ballVisible && !ballNode.isHidden {
            let d = screenDistance(ballNode.simdPosition)
            if currentFrame?.ballHolder != nil {
                // Ballon aux pieds d'un joueur : le joueur est prioritaire (conduite),
                // il faut toucher franchement le ballon pour faire une passe
                if d < 20, d < (best?.distance ?? .infinity) { best = (.ball, d) }
            } else {
                // Ballon libre : sélection très tolérante
                if d - 10 < 42, d - 10 < (best?.distance ?? .infinity) { best = (.ball, d - 10) }
            }
        }
        return best?.target
    }

    private func groundPoint(at point: CGPoint) -> SIMD3<Float>? {
        let near = SIMD3<Float>(scnView.unprojectPoint(SCNVector3(Float(point.x), Float(point.y), 0)))
        let far = SIMD3<Float>(scnView.unprojectPoint(SCNVector3(Float(point.x), Float(point.y), 1)))
        let direction = far - near
        guard abs(direction.y) > 1e-5 else { return nil }
        let t = -near.y / direction.y
        guard t > 0 else { return nil }
        return near + direction * t
    }

    @objc private func handleDrag(_ gr: UIPanGestureRecognizer) {
        guard let target = dragTarget else { return }
        switch gr.state {
        case .began, .changed:
            guard let hit = groundPoint(at: gr.location(in: scnView)) else { return }
            var p = PitchGeometry.normalized(x: hit.x, z: hit.z)
            p.x = Swift.min(0.98, Swift.max(0.02, p.x))
            p.y = Swift.min(0.98, Swift.max(0.02, p.y))
            switch target {
            case .actor(let id):
                guard let node = actorNodes[id] else { return }
                node.root.simdPosition = PitchGeometry.world(p)
                let lift = playerScale * 1.12
                node.root.scale = SCNVector3(lift, lift, lift)
                currentFrame?.positions[id] = p
                onActorMoved?(id, p)
            case .ball:
                ballNode.simdPosition = ballWorld(p)
                currentFrame?.ball = p
                onBallMoved?(p)
            }
        default:
            if case .actor(let id) = target, let node = actorNodes[id] {
                node.root.scale = SCNVector3(playerScale, playerScale, playerScale)
            }
            dragTarget = nil
            if target == .ball, let ball = currentFrame?.ball {
                onBallDropped?(ball)
            }
        }
    }
}

// MARK: - Flèches au sol

enum ArrowBuilder {

    static func color(for arrow: TacticArrow) -> UIColor {
        switch arrow.kind {
        case .course:
            switch arrow.team {
            case .adversaire: return UIColor(red: 1.0, green: 0.55, blue: 0.55, alpha: 1)
            case .joker: return UIColor(red: 0.55, green: 0.85, blue: 1.0, alpha: 1)
            default: return .white
            }
        case .passe: return UIColor(red: 1.0, green: 0.86, blue: 0.1, alpha: 1)
        case .conduite: return UIColor(red: 1.0, green: 0.55, blue: 0.1, alpha: 1)
        case .tir: return UIColor(red: 1.0, green: 0.22, blue: 0.22, alpha: 1)
        }
    }

    static func node(for arrow: TacticArrow, playerScale: Float) -> SCNNode {
        var a = PitchGeometry.ground(arrow.from)
        var b = PitchGeometry.ground(arrow.to)
        let length = simd_distance(a, b)
        let node = SCNNode()
        guard length > 0.6 else { return node }
        let direction = (b - a) / length

        // On raccourcit pour ne pas recouvrir les joueurs
        let isRun = arrow.kind == .course || arrow.kind == .conduite
        let startTrim = (isRun ? 0.75 : 0.4) * playerScale
        let endTrim: Float = arrow.kind == .tir ? 0 : (isRun ? 0.95 : 0.6) * playerScale
        if length > startTrim + endTrim + 1.5 {
            a += direction * startTrim
            b -= direction * endTrim
        }

        let width = (arrow.kind == .tir ? 0.42 : 0.3) * Swift.max(1, playerScale * 0.8)
        var points: [SIMD2<Float>]
        switch arrow.kind {
        case .conduite:
            points = wave(from: a, to: b, amplitude: width * 1.1, wavelength: width * 7)
        case .passe where arrow.aerial == true:
            points = curve(from: a, to: b, bulge: simd_distance(a, b) * 0.12)
        default:
            points = [a, b]
        }
        let geometryNode = polylineNode(points: points, color: color(for: arrow), width: width,
                                        dashed: arrow.kind == .course)
        node.addChildNode(geometryNode)
        return node
    }

    /// Polyligne avec pointe de flèche
    static func polylineNode(points: [SIMD2<Float>], color: UIColor, width: Float, dashed: Bool = false) -> SCNNode {
        let node = SCNNode()
        guard points.count > 1 else { return node }
        let headLength = width * 3.2
        let headWidth = width * 3.4
        let total = polylineLength(points)
        guard total > 0.1 else { return node }

        let bodyEnd = Swift.max(0, total - headLength * 0.7)
        var vertices: [SCNVector3] = []
        var indices: [Int32] = []
        let y: Float = 0.06

        if dashed {
            let dash = width * 3.2, gap = width * 2.2
            var s: Float = 0
            while s < bodyEnd {
                let segment = subPolyline(points, from: s, to: Swift.min(s + dash, bodyEnd))
                appendRibbon(segment, width: width, y: y, vertices: &vertices, indices: &indices)
                s += dash + gap
            }
        } else {
            appendRibbon(subPolyline(points, from: 0, to: bodyEnd), width: width, y: y, vertices: &vertices, indices: &indices)
        }

        // Pointe
        let tip = points[points.count - 1]
        let beforeTip = point(on: points, at: Swift.max(0, total - headLength))
        var dir = tip - beforeTip
        let dirLength = simd_length(dir)
        dir = dirLength > 0.0001 ? dir / dirLength : SIMD2(0, -1)
        let normal = SIMD2<Float>(-dir.y, dir.x)
        let base = tip - dir * headLength
        let start = Int32(vertices.count)
        for p in [tip, base + normal * headWidth / 2, base - normal * headWidth / 2] {
            vertices.append(SCNVector3(p.x, y + 0.005, p.y))
        }
        indices.append(contentsOf: [start, start + 1, start + 2])

        let geometry = makeGeometry(vertices: vertices, indices: indices)
        geometry.firstMaterial = Materials.arrow(color)
        let geometryNode = SCNNode(geometry: geometry)
        geometryNode.castsShadow = false
        geometryNode.renderingOrder = 10
        node.addChildNode(geometryNode)
        return node
    }

    /// Ruban plat (sans pointe) le long d'une polyligne
    static func ribbonGeometry(points: [SIMD2<Float>], width: Float, y: Float) -> SCNGeometry {
        var vertices: [SCNVector3] = []
        var indices: [Int32] = []
        appendRibbon(points, width: width, y: y, vertices: &vertices, indices: &indices)
        return makeGeometry(vertices: vertices, indices: indices)
    }

    private static func appendRibbon(_ points: [SIMD2<Float>], width: Float, y: Float,
                                     vertices: inout [SCNVector3], indices: inout [Int32]) {
        guard points.count > 1 else { return }
        let start = Int32(vertices.count)
        let n = points.count
        for k in 0..<n {
            let prev = points[Swift.max(0, k - 1)]
            let next = points[Swift.min(n - 1, k + 1)]
            var tangent = next - prev
            let len = simd_length(tangent)
            tangent = len > 0.0001 ? tangent / len : SIMD2(1, 0)
            let normal = SIMD2<Float>(-tangent.y, tangent.x) * (width / 2)
            let left = points[k] + normal
            let right = points[k] - normal
            vertices.append(SCNVector3(left.x, y, left.y))
            vertices.append(SCNVector3(right.x, y, right.y))
        }
        for k in 0..<(n - 1) {
            let i = start + Int32(k * 2)
            indices.append(contentsOf: [i, i + 1, i + 2, i + 1, i + 3, i + 2])
        }
    }

    private static func makeGeometry(vertices: [SCNVector3], indices: [Int32]) -> SCNGeometry {
        let source = SCNGeometrySource(vertices: vertices)
        let normals = SCNGeometrySource(normals: Array(repeating: SCNVector3(0, 1, 0), count: vertices.count))
        let element = SCNGeometryElement(indices: indices, primitiveType: .triangles)
        return SCNGeometry(sources: [source, normals], elements: [element])
    }

    static func polylineLength(_ points: [SIMD2<Float>]) -> Float {
        guard points.count > 1 else { return 0 }
        var total: Float = 0
        for i in 1..<points.count { total += simd_distance(points[i - 1], points[i]) }
        return total
    }

    static func point(on points: [SIMD2<Float>], at distance: Float) -> SIMD2<Float> {
        guard points.count > 1 else { return points.first ?? .zero }
        var remaining = distance
        for i in 1..<points.count {
            let segment = simd_distance(points[i - 1], points[i])
            if remaining <= segment, segment > 0 {
                return simd_mix(points[i - 1], points[i], SIMD2(repeating: remaining / segment))
            }
            remaining -= segment
        }
        return points[points.count - 1]
    }

    static func subPolyline(_ points: [SIMD2<Float>], from s0: Float, to s1: Float) -> [SIMD2<Float>] {
        guard s1 > s0, points.count > 1 else { return [] }
        var result = [point(on: points, at: s0)]
        var accumulated: Float = 0
        for i in 1..<points.count {
            accumulated += simd_distance(points[i - 1], points[i])
            if accumulated > s0 && accumulated < s1 { result.append(points[i]) }
        }
        result.append(point(on: points, at: s1))
        return result
    }

    private static func wave(from a: SIMD2<Float>, to b: SIMD2<Float>, amplitude: Float, wavelength: Float) -> [SIMD2<Float>] {
        let length = simd_distance(a, b)
        guard length > 0.01 else { return [a, b] }
        let dir = (b - a) / length
        let normal = SIMD2<Float>(-dir.y, dir.x)
        let count = Swift.max(10, Int(length / (wavelength / 10)))
        let calmZone = Swift.min(length * 0.3, wavelength)
        return (0...count).map { i in
            let d = length * Float(i) / Float(count)
            let fade = Swift.min(1, Swift.max(0, (length - d) / calmZone))
            let offset = sin(d / wavelength * 2 * .pi) * amplitude * fade
            return a + dir * d + normal * offset
        }
    }

    private static func curve(from a: SIMD2<Float>, to b: SIMD2<Float>, bulge: Float) -> [SIMD2<Float>] {
        let mid = (a + b) / 2
        let dir = simd_normalize(b - a)
        let control = mid + SIMD2(-dir.y, dir.x) * bulge
        return (0...24).map { i in
            let t = Float(i) / 24
            let u = 1 - t
            return u * u * a + 2 * u * t * control + t * t * b
        }
    }
}

// MARK: - Matériaux

enum Materials {
    static func lambert(_ color: UIColor) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .lambert
        m.diffuse.contents = color
        return m
    }

    static func constant(_ color: UIColor) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .constant
        m.diffuse.contents = color
        m.isDoubleSided = true
        return m
    }

    static func arrow(_ color: UIColor) -> SCNMaterial {
        let m = constant(color)
        m.writesToDepthBuffer = false
        return m
    }

    static func namedColor(_ name: String?, default fallback: UIColor) -> UIColor {
        switch name?.lowercased() {
        case "jaune": return UIColor(red: 1.0, green: 0.85, blue: 0.1, alpha: 1)
        case "orange": return UIColor(red: 1.0, green: 0.5, blue: 0.05, alpha: 1)
        case "rouge": return UIColor(red: 0.9, green: 0.15, blue: 0.15, alpha: 1)
        case "bleu": return UIColor(red: 0.15, green: 0.45, blue: 0.95, alpha: 1)
        case "blanc": return .white
        case "vert": return UIColor(red: 0.2, green: 0.85, blue: 0.3, alpha: 1)
        case "violet": return UIColor(red: 0.6, green: 0.3, blue: 0.9, alpha: 1)
        case "rose": return UIColor(red: 1.0, green: 0.35, blue: 0.7, alpha: 1)
        default: return fallback
        }
    }
}

// MARK: - Textures procédurales

enum TextureFactory {

    /// Pelouse rayée + tracés réglementaires (20 px par mètre)
    static func pitch() -> UIImage {
        let ppm: CGFloat = 20
        let m = CGFloat(PitchGeometry.margin)
        let w = CGFloat(PitchGeometry.width)
        let l = CGFloat(PitchGeometry.length)
        let size = CGSize(width: (w + 2 * m) * ppm, height: (l + 2 * m) * ppm)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            let c = ctx.cgContext
            func px(_ x: CGFloat) -> CGFloat { (x + m) * ppm }
            func py(_ y: CGFloat) -> CGFloat { (y + m) * ppm }

            // Bandes de tonte
            let dark = UIColor(red: 0.18, green: 0.5, blue: 0.2, alpha: 1)
            let light = UIColor(red: 0.22, green: 0.57, blue: 0.24, alpha: 1)
            dark.setFill()
            c.fill(CGRect(origin: .zero, size: size))
            let bands = 18
            let bandHeight = l / CGFloat(bands)
            for i in 0..<bands where i % 2 == 0 {
                light.setFill()
                c.fill(CGRect(x: 0, y: py(CGFloat(i) * bandHeight), width: size.width, height: bandHeight * ppm))
            }

            // Tracés
            c.setStrokeColor(UIColor(white: 1, alpha: 0.92).cgColor)
            c.setLineWidth(0.13 * ppm)
            c.stroke(CGRect(x: px(0), y: py(0), width: w * ppm, height: l * ppm))
            c.move(to: CGPoint(x: px(0), y: py(l / 2)))
            c.addLine(to: CGPoint(x: px(w), y: py(l / 2)))
            c.strokePath()
            c.strokeEllipse(in: CGRect(x: px(w / 2 - 9.15), y: py(l / 2 - 9.15), width: 18.3 * ppm, height: 18.3 * ppm))

            UIColor(white: 1, alpha: 0.92).setFill()
            func spot(_ x: CGFloat, _ y: CGFloat) {
                c.fillEllipse(in: CGRect(x: px(x) - 0.22 * ppm, y: py(y) - 0.22 * ppm, width: 0.44 * ppm, height: 0.44 * ppm))
            }
            spot(w / 2, l / 2)

            for top in [true, false] {
                let line: CGFloat = top ? 0 : l
                let sign: CGFloat = top ? 1 : -1
                let boxW: CGFloat = 40.32, boxD: CGFloat = 16.5
                let goalW: CGFloat = 18.32, goalD: CGFloat = 5.5
                let boxY = top ? line : line - boxD
                c.stroke(CGRect(x: px((w - boxW) / 2), y: py(boxY), width: boxW * ppm, height: boxD * ppm))
                let gY = top ? line : line - goalD
                c.stroke(CGRect(x: px((w - goalW) / 2), y: py(gY), width: goalW * ppm, height: goalD * ppm))
                let spotY = line + sign * 11
                spot(w / 2, spotY)
                // Arc de surface (partie hors de la surface)
                let startAngle: CGFloat = top ? 0.6435 : .pi + 0.6435
                let endAngle: CGFloat = top ? .pi - 0.6435 : 2 * .pi - 0.6435
                c.addArc(center: CGPoint(x: px(w / 2), y: py(spotY)), radius: 9.15 * ppm,
                         startAngle: startAngle, endAngle: endAngle, clockwise: false)
                c.strokePath()
            }
            // Arcs de coin
            let corners: [(CGFloat, CGFloat, CGFloat)] = [(0, 0, 0), (w, 0, .pi / 2), (w, l, .pi), (0, l, 3 * .pi / 2)]
            for (x, y, start) in corners {
                c.addArc(center: CGPoint(x: px(x), y: py(y)), radius: 1 * ppm,
                         startAngle: start, endAngle: start + .pi / 2, clockwise: false)
                c.strokePath()
            }
        }
    }

    /// Ciel en dégradé (projection équirectangulaire)
    static func sky() -> UIImage {
        let size = CGSize(width: 8, height: 256)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let colors = [
                UIColor(red: 0.36, green: 0.58, blue: 0.88, alpha: 1).cgColor,
                UIColor(red: 0.62, green: 0.78, blue: 0.94, alpha: 1).cgColor,
                UIColor(red: 0.84, green: 0.9, blue: 0.95, alpha: 1).cgColor,
                UIColor(red: 0.2, green: 0.32, blue: 0.2, alpha: 1).cgColor
            ] as CFArray
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.35, 0.5, 0.52])!
            ctx.cgContext.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        }
    }

    /// Maille de filet (motif répété)
    static func net() -> UIImage {
        let size = CGSize(width: 32, height: 32)
        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            let c = ctx.cgContext
            c.setStrokeColor(UIColor(white: 1, alpha: 0.75).cgColor)
            c.setLineWidth(2)
            c.stroke(CGRect(x: 1, y: 1, width: 30, height: 30))
        }
    }

    /// Ballon blanc à taches noires
    static func ball() -> UIImage {
        let size = CGSize(width: 256, height: 128)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let c = ctx.cgContext
            UIColor.white.setFill()
            c.fill(CGRect(origin: .zero, size: size))
            UIColor(white: 0.1, alpha: 1).setFill()
            let spots: [(CGFloat, CGFloat)] = [
                (0.0, 0.5), (0.25, 0.5), (0.5, 0.5), (0.75, 0.5),
                (0.125, 0.2), (0.375, 0.2), (0.625, 0.2), (0.875, 0.2),
                (0.125, 0.8), (0.375, 0.8), (0.625, 0.8), (0.875, 0.8)
            ]
            for (u, v) in spots {
                let r: CGFloat = 13
                for dx in [-size.width, 0, size.width] {
                    c.fillEllipse(in: CGRect(x: u * size.width + dx - r, y: v * size.height - r * 0.8, width: r * 2, height: r * 1.6))
                }
            }
            c.fill(CGRect(x: 0, y: 0, width: size.width, height: 6))
            c.fill(CGRect(x: 0, y: size.height - 6, width: size.width, height: 6))
        }
    }

    /// Pastille numéro (+ nom) affichée au-dessus du joueur
    static func label(number: String, name: String?, fill: UIColor, text: UIColor) -> UIImage {
        let badge: CGFloat = 200
        let hasName = !(name ?? "").isEmpty
        let size = CGSize(width: hasName ? 320 : 220, height: hasName ? 300 : 220)
        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            let c = ctx.cgContext
            let circle = CGRect(x: (size.width - badge) / 2, y: 10, width: badge, height: badge)
            c.setShadow(offset: CGSize(width: 0, height: 4), blur: 8, color: UIColor.black.withAlphaComponent(0.45).cgColor)
            fill.setFill()
            c.fillEllipse(in: circle)
            c.setShadow(offset: .zero, blur: 0, color: nil)
            c.setStrokeColor(UIColor.white.cgColor)
            c.setLineWidth(12)
            c.strokeEllipse(in: circle.insetBy(dx: 6, dy: 6))

            let fontSize: CGFloat = number.count > 2 ? 70 : 104
            let font = UIFont.roundedSystemFont(ofSize: fontSize, weight: .heavy)
            let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: text]
            let textSize = (number as NSString).size(withAttributes: attributes)
            (number as NSString).draw(at: CGPoint(x: circle.midX - textSize.width / 2, y: circle.midY - textSize.height / 2),
                                      withAttributes: attributes)

            if hasName, let name {
                let nameFont = UIFont.systemFont(ofSize: 44, weight: .bold)
                let nameAttributes: [NSAttributedString.Key: Any] = [.font: nameFont, .foregroundColor: UIColor.white]
                var display = name
                while (display as NSString).size(withAttributes: nameAttributes).width > size.width - 40, display.count > 3 {
                    display = String(display.dropLast(2)) + "…"
                }
                let nameSize = (display as NSString).size(withAttributes: nameAttributes)
                let pill = CGRect(x: (size.width - nameSize.width) / 2 - 16, y: circle.maxY + 14,
                                  width: nameSize.width + 32, height: nameSize.height + 10)
                UIColor.black.withAlphaComponent(0.62).setFill()
                UIBezierPath(roundedRect: pill, cornerRadius: pill.height / 2).fill()
                (display as NSString).draw(at: CGPoint(x: pill.minX + 16, y: pill.minY + 5), withAttributes: nameAttributes)
            }
        }
    }
}

// MARK: - Utilitaires couleur / police

extension UIColor {
    var perceivedBrightness: CGFloat {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        getRed(&r, green: &g, blue: &b, alpha: &a)
        return 0.299 * r + 0.587 * g + 0.114 * b
    }

    func distance(to other: UIColor) -> CGFloat {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        other.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return sqrt(pow(r1 - r2, 2) + pow(g1 - g2, 2) + pow(b1 - b2, 2))
    }
}

extension UIFont {
    static func roundedSystemFont(ofSize size: CGFloat, weight: UIFont.Weight) -> UIFont {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        guard let descriptor = base.fontDescriptor.withDesign(.rounded) else { return base }
        return UIFont(descriptor: descriptor, size: size)
    }
}
