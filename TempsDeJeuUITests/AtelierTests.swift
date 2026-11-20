import XCTest

/// Atelier : construit un exercice au doigt comme un entraîneur
/// (raccourci, étape, passe, évolution, fiche, cinéma), puis une séance.
/// Ne fait pas partie des captures App Store (lancé à part).
final class AtelierTests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR", "-demo", "atelier-accueil"]
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

    private func center(_ element: XCUIElement) -> XCUICoordinate {
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    }

    private func drag(_ element: XCUIElement, to target: XCUICoordinate) {
        center(element).press(forDuration: 0.15, thenDragTo: target, withVelocity: .slow, thenHoldForDuration: 0.2)
    }

    private func shoot(_ name: String) {
        Thread.sleep(forTimeInterval: 1)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    func testConstruireUnExercice() throws {
        let nouveau = element("atelier-nouvel-exercice")
        XCTAssertTrue(nouveau.waitForExistence(timeout: 20))
        shoot("atelier-0-accueil")
        nouveau.tap()

        // Terrain vide : l'aide explique quoi faire
        expectText("Choisissez un élément")
        shoot("atelier-1-vide")

        // Raccourci : rondo 4 contre 2 (plots, joueurs, ballon)
        element("atelier-raccourcis").tap()
        app.buttons["Rondo 4 contre 2"].firstMatch.tap()
        let rouge1 = element("atelier-joueur-rouge-1")
        XCTAssertTrue(rouge1.waitForExistence(timeout: 5))
        XCTAssertTrue(element("atelier-ballon").exists, "Le raccourci donne le ballon au premier joueur.")
        shoot("atelier-2-rondo")

        // Poser trois plots jaunes avec le tampon
        element("outil-plot").tap()
        app.buttons["Jaune"].firstMatch.tap()
        let terrain = element("atelier-terrain")
        for dx in [0.15, 0.25, 0.35] {
            terrain.coordinate(withNormalizedOffset: CGVector(dx: dx, dy: 0.12)).tap()
        }
        expectText("Plot")
        element("outil-plot").tap()   // range l'outil

        // Étape 1 : passe du rouge 1 au rouge 2
        element("atelier-ajout-etape").tap()
        expectText("Étape 1")
        drag(element("atelier-ballon"), to: center(element("atelier-joueur-rouge-2")))
        terrain.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.97)).tap()   // désélectionne
        // Le ballon est passé au rouge 2 : on le sélectionne pour régler la passe
        element("atelier-ballon").tap()
        expectText("Le ballon")
        app.buttons["Centre"].firstMatch.tap()
        shoot("atelier-3-passe")

        // Étape 2 : le rouge 2 conduit vers l'avant
        element("atelier-ajout-etape").tap()
        let rouge2 = element("atelier-joueur-rouge-2")
        drag(rouge2, to: center(rouge2).withOffset(CGVector(dx: 0, dy: -70)))
        shoot("atelier-4-conduite")

        // Aperçu de l'animation
        app.buttons["Aperçu de l'animation"].firstMatch.tap()
        Thread.sleep(forTimeInterval: 2.5)
        shoot("atelier-5-apercu")
        Thread.sleep(forTimeInterval: 4)

        // Évolution : copie de l'exercice
        element("atelier-ajout-evolution").tap()
        expectText("Évolution 1")

        // Fiche : matériel calculé
        app.buttons["Fiche"].firstMatch.tap()
        expectText("Matériel à prévoir")
        app.swipeUp()
        expectText("chasubles rouges")
        expectText("plots jaunes")
        shoot("atelier-6-fiche")
        app.navigationBars["Fiche"].buttons.firstMatch.tap()

        // Cinéma (3D plein écran)
        element("atelier-cinema").tap()
        let fermer = element("cinema-fermer")
        XCTAssertTrue(fermer.waitForExistence(timeout: 8))
        Thread.sleep(forTimeInterval: 3)
        shoot("atelier-7-cinema")
        fermer.tap()
        XCTAssertTrue(element("atelier-termine").waitForExistence(timeout: 5))
        XCTAssertFalse(fermer.exists, "Le cinéma doit être fermé.")

        // Terminé : l'exercice est enregistré dans « Mes exercices »
        element("atelier-termine").tap()
        let nouveau2 = element("atelier-nouvel-exercice")
        XCTAssertTrue(nouveau2.waitForExistence(timeout: 5))
        XCTAssertTrue(nouveau2.isHittable, "Retour à l'accueil de l'Atelier.")
        let carte = app.buttons.matching(NSPredicate(format: "label == %@", "Modifier"))
        XCTAssertGreaterThanOrEqual(carte.count, 2, "La nouvelle carte d'exercice apparaît à côté de l'exemple.")
        shoot("atelier-8-mes-exercices")
    }

    /// Paysage : terrain à l'horizontale, panneau sur le côté ; puis cinéma
    func testPaysage() throws {
        XCTAssertTrue(element("atelier-nouvel-exercice").waitForExistence(timeout: 20))
        app.buttons.matching(NSPredicate(format: "label == %@", "Modifier")).firstMatch.tap()
        XCTAssertTrue(element("atelier-termine").waitForExistence(timeout: 5))
        XCUIDevice.shared.orientation = .landscapeLeft
        Thread.sleep(forTimeInterval: 1.5)
        shoot("paysage-1-editeur")
        app.buttons["Étape 2"].firstMatch.tap()
        shoot("paysage-2-etape")
        element("atelier-cinema").tap()
        XCTAssertTrue(element("cinema-fermer").waitForExistence(timeout: 8))
        Thread.sleep(forTimeInterval: 3)
        shoot("paysage-3-cinema")
        element("cinema-fermer").tap()
        XCUIDevice.shared.orientation = .portrait
    }

    func testPreparerUneSeance() throws {
        XCTAssertTrue(element("atelier-nouvel-exercice").waitForExistence(timeout: 20))
        app.buttons["Séances"].firstMatch.tap()
        element("atelier-nouvelle-seance").tap()

        element("seance-ajout-exercice").tap()
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Jeu 4 contre 4")).firstMatch.tap()
        expectText("20 min")
        app.swipeUp()
        expectText("mini-buts")
        shoot("seance-1-programme")

        app.buttons["Faire les équipes avec les présents"].firstMatch.tap()
        element("equipes-composer").tap()
        expectText("Chasubles rouges")
        shoot("seance-2-equipes")

        // Fiche PDF de la séance (le fichier est relu à part, dans le dossier temporaire de l'app)
        app.navigationBars["Équipes"].buttons.firstMatch.tap()
        app.swipeUp()
        app.buttons["Fiche de séance à imprimer (PDF)"].firstMatch.tap()
        Thread.sleep(forTimeInterval: 3)
        shoot("seance-3-pdf")
    }
}
