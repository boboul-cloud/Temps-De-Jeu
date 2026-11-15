import XCTest

/// Construit une séquence comme un entraîneur, au doigt, sur le terrain 2D :
/// mise en place → conduite du 6 → passe au 10 → tir → lecture.
/// Ne fait pas partie des captures App Store (lancé à part).
final class SequenceTests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR", "-demo", "seance"]
        app.launch()
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any)[id].firstMatch
    }

    private func expectText(_ text: String, file: StaticString = #filePath, line: UInt = #line) {
        let found = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
        XCTAssertTrue(found.waitForExistence(timeout: 8), "« \(text) » attendu à l'écran.", file: file, line: line)
    }

    private func drag(_ element: XCUIElement, to target: XCUICoordinate) {
        let start = element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.15, thenDragTo: target, withVelocity: .slow, thenHoldForDuration: 0.2)
    }

    private func shoot(_ name: String) {
        Thread.sleep(forTimeInterval: 1)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    func testConstruireUneSequence() throws {
        let six = element("joueur-6")
        XCTAssertTrue(six.waitForExistence(timeout: 20))
        let pitch = element("terrain-2d")
        shoot("seq-0-depart")

        // 1. Mise en place
        app.buttons["Mise en place"].firstMatch.tap()

        // 2. Conduite : le 6 avance, le ballon suit
        drag(six, to: six.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).withOffset(CGVector(dx: 0, dy: -90)))
        expectText("Conduite n°6")
        shoot("seq-1-conduite")
        app.buttons["Étape 2"].firstMatch.tap()

        // 3. Passe : le ballon lâché sur le 10 se colle à ses pieds
        drag(element("ballon"), to: element("joueur-10").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)))
        expectText("Passe n°6 → n°10")
        shoot("seq-2-passe")
        app.buttons["Étape 3"].firstMatch.tap()

        // 4. Tir : on cadre le terrain entier, puis le ballon est lâché près du but du haut
        app.buttons["Cadrage du terrain"].firstMatch.tap()
        app.buttons["Terrain entier"].firstMatch.tap()
        shoot("seq-3a-terrain-entier")
        drag(element("ballon"), to: pitch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.03)))
        expectText("Tir n°10")
        shoot("seq-3-tir")
        app.buttons["Étape 4"].firstMatch.tap()
        expectText("Étape 4 enregistrée")

        // 5. Revoir l'étape 2 sur le terrain
        app.buttons["Revoir l'étape 2"].firstMatch.tap()
        expectText("Étape 2 affichée")
        shoot("seq-4-revoir")
        app.buttons["Annuler"].firstMatch.tap()

        // 6. Vue 3D puis lecture
        app.buttons["3D"].firstMatch.tap()
        shoot("seq-5-3d")
        app.buttons["Lire la démonstration"].firstMatch.tap()
        expectText("Étape 1 / 4")
        shoot("seq-6-lecture")
    }

    /// En 3D : le ballon se saisit facilement et se colle au partenaire
    func testPasseEn3D() throws {
        XCTAssertTrue(element("joueur-6").waitForExistence(timeout: 20))
        app.buttons["Mise en place"].firstMatch.tap()
        app.buttons["3D"].firstMatch.tap()

        let ball = element("ballon-3d")
        let ten = element("joueur3d-10")
        XCTAssertTrue(ball.waitForExistence(timeout: 10))
        XCTAssertTrue(ten.waitForExistence(timeout: 10))
        shoot("3d-0-avant")

        // On pose le doigt un peu à côté du ballon : la sélection doit être tolérante
        let start = ball.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).withOffset(CGVector(dx: 12, dy: -10))
        start.press(forDuration: 0.15,
                    thenDragTo: ten.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8)),
                    withVelocity: .fast, thenHoldForDuration: 0.2)
        expectText("Passe n°6 → n°10")
        shoot("3d-1-passe")

        app.buttons["Étape 2"].firstMatch.tap()

        // Conduite en 3D : on prend le 10 par le maillot, le ballon suit
        let tenNow = element("joueur3d-10").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.4))
        tenNow.press(forDuration: 0.15, thenDragTo: tenNow.withOffset(CGVector(dx: 0, dy: -50)),
                     withVelocity: .slow, thenHoldForDuration: 0.2)
        expectText("Conduite n°10")
        shoot("3d-2-conduite")
    }
}
