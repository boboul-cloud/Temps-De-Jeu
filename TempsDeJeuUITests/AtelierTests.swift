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

        // Enregistrer : l'exercice est rangé dans « Mes exercices »
        element("atelier-termine").tap()
        let nouveau2 = element("atelier-nouvel-exercice")
        XCTAssertTrue(nouveau2.waitForExistence(timeout: 5))
        XCTAssertTrue(nouveau2.isHittable, "Retour à l'accueil de l'Atelier.")
        let carte = app.buttons.matching(NSPredicate(format: "label == %@", "Modifier"))
        XCTAssertGreaterThanOrEqual(carte.count, 2, "La nouvelle carte d'exercice apparaît à côté de l'exemple.")
        shoot("atelier-8-mes-exercices")
    }

    /// L'exercice s'enregistre tout seul : l'app est tuée sans toucher « Enregistrer »,
    /// il est toujours là à la réouverture.
    func testEnregistrementAutomatique() throws {
        let nouveau = element("atelier-nouvel-exercice")
        XCTAssertTrue(nouveau.waitForExistence(timeout: 20))
        nouveau.tap()
        expectText("Enregistrement automatique")

        // Un nom unique pour le retrouver
        let nom = "Auto \(Int.random(in: 1000...9999))"
        element("atelier-titre").tap()
        let champ = app.alerts.textFields.firstMatch
        XCTAssertTrue(champ.waitForExistence(timeout: 5))
        champ.tap()
        champ.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 40) + nom)
        app.alerts.buttons["OK"].tap()

        element("atelier-raccourcis").tap()
        app.buttons["Rondo 4 contre 2"].firstMatch.tap()
        XCTAssertTrue(element("atelier-joueur-rouge-1").waitForExistence(timeout: 5))
        expectText("Enregistré")
        shoot("auto-1-enregistre")

        // Fermeture brutale, puis réouverture : l'exercice est dans « Mes exercices »
        app.terminate()
        app.launch()
        XCTAssertTrue(element("atelier-nouvel-exercice").waitForExistence(timeout: 20))
        expectText(nom)
        shoot("auto-2-retrouve")

        // Rangement : l'exercice de test (en tête de liste) est supprimé
        app.buttons["Plus d'actions"].firstMatch.tap()
        app.buttons["Supprimer"].firstMatch.tap()
        let confirmer = app.sheets.buttons["Supprimer"].firstMatch
        XCTAssertTrue(confirmer.waitForExistence(timeout: 5))
        confirmer.tap()
        let reste = app.staticTexts.matching(NSPredicate(format: "label == %@", nom)).firstMatch
        XCTAssertFalse(reste.waitForExistence(timeout: 2), "L'exercice de test doit être supprimé.")
    }

    /// Plusieurs ballons : l'outil Ballon en pose un de plus à chaque touche,
    /// chacun se passe séparément, et le matériel les compte tous.
    func testPlusieursBallons() throws {
        let nouveau = element("atelier-nouvel-exercice")
        XCTAssertTrue(nouveau.waitForExistence(timeout: 20))
        nouveau.tap()
        element("atelier-raccourcis").tap()
        app.buttons["Rondo 4 contre 2"].firstMatch.tap()
        XCTAssertTrue(element("atelier-ballon").waitForExistence(timeout: 5))

        // Deux ballons de plus : au pied du rouge 3, puis libre sur le terrain
        element("outil-ballon").tap()
        center(element("atelier-joueur-rouge-3")).tap()
        XCTAssertTrue(element("atelier-ballon-2").waitForExistence(timeout: 5))
        element("atelier-terrain").coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.88)).tap()
        XCTAssertTrue(element("atelier-ballon-3").waitForExistence(timeout: 5))
        element("outil-ballon").tap()   // range l'outil
        shoot("ballons-1-trois")

        // Étape 1 : le ballon 2 passe du rouge 3 au rouge 4, le premier reste au rouge 1
        element("atelier-ajout-etape").tap()
        expectText("Étape 1")
        drag(element("atelier-ballon-2"), to: center(element("atelier-joueur-rouge-4")))
        func gap(_ a: String, _ b: String) -> CGFloat {
            let fa = element(a).frame, fb = element(b).frame
            return hypot(fa.midX - fb.midX, fa.midY - fb.midY)
        }
        XCTAssertLessThan(gap("atelier-ballon-2", "atelier-joueur-rouge-4"), 40, "Le ballon 2 est passé au rouge 4.")
        XCTAssertLessThan(gap("atelier-ballon", "atelier-joueur-rouge-1"), 40, "Le premier ballon reste au rouge 1.")
        shoot("ballons-2-passe")

        // Fiche : les trois ballons sont dans le matériel
        app.buttons["Fiche"].firstMatch.tap()
        expectText("Matériel à prévoir")
        let ballons = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "3 ballons")).firstMatch
        var tries = 0
        while !ballons.exists && tries < 4 {
            app.swipeUp()
            tries += 1
        }
        XCTAssertTrue(ballons.exists, "Le matériel compte les 3 ballons.")
        shoot("ballons-3-fiche")
        app.navigationBars["Fiche"].buttons.firstMatch.tap()

        // Cinéma 3D : trois ballons, sans plantage
        element("atelier-cinema").tap()
        let fermer = element("cinema-fermer")
        XCTAssertTrue(fermer.waitForExistence(timeout: 8))
        Thread.sleep(forTimeInterval: 4)
        shoot("ballons-4-cinema")
        fermer.tap()

        // Enregistrer, puis rangement : l'exercice de test est supprimé
        XCTAssertTrue(element("atelier-termine").waitForExistence(timeout: 5))
        element("atelier-termine").tap()
        XCTAssertTrue(element("atelier-nouvel-exercice").waitForExistence(timeout: 5))
        app.buttons["Plus d'actions"].firstMatch.tap()
        app.buttons["Supprimer"].firstMatch.tap()
        let confirmer = app.sheets.buttons["Supprimer"].firstMatch
        XCTAssertTrue(confirmer.waitForExistence(timeout: 5))
        confirmer.tap()
    }

    /// Paysage : terrain à l'horizontale, panneau sur le côté ; puis cinéma
    func testPaysage() throws {
        // Même en cas d'échec, les tests suivants repartent en portrait
        addTeardownBlock { XCUIDevice.shared.orientation = .portrait }
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
