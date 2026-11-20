import XCTest

/// Supprimer un entraînement (Présences) et une séance (Atelier) :
/// par le bouton rouge de la fiche, et par appui long sur la ligne.
final class SuppressionTests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    private func launch(_ demo: String) {
        app.launchArguments = ["-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR", "-demo", demo]
        app.launch()
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any)[id].firstMatch
    }

    /// Fait défiler jusqu'à rendre l'élément touchable
    private func reveal(_ element: XCUIElement) {
        var tries = 0
        while !(element.exists && element.isHittable) && tries < 8 {
            app.swipeUp()
            tries += 1
        }
        XCTAssertTrue(element.isHittable, "« \(element) » introuvable.")
    }

    /// Bouton « Supprimer » de la confirmation
    private func confirm() {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", "Supprimer")).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 5), "Confirmation attendue.")
        button.tap()
    }

    private var sessionRows: Int {
        app.descendants(matching: .any).matching(identifier: "entrainement-ligne").count
    }

    private func newSession() {
        element("entrainements-menu").tap()
        app.buttons["Nouvel entraînement"].firstMatch.tap()
        let create = app.buttons["Créer"].firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 5))
        create.tap()
        XCTAssertTrue(create.waitForNonExistence(timeout: 5))
    }

    func testSupprimerUnEntrainement() throws {
        launch("presences")
        XCTAssertTrue(element("entrainements-menu").waitForExistence(timeout: 20))
        let before = sessionRows

        // Bouton rouge de la fiche
        newSession()
        XCTAssertEqual(sessionRows, before + 1)
        element("entrainement-ligne").tap()
        XCTAssertTrue(app.navigationBars["Modifier"].waitForExistence(timeout: 5))
        let delete = element("entrainement-supprimer")
        reveal(delete)
        delete.tap()
        confirm()
        XCTAssertTrue(delete.waitForNonExistence(timeout: 5), "La fiche se ferme.")
        XCTAssertEqual(sessionRows, before, "L'entraînement est supprimé.")

        // Appui long sur la ligne
        newSession()
        XCTAssertEqual(sessionRows, before + 1)
        element("entrainement-ligne").press(forDuration: 1.2)
        app.buttons["Supprimer"].firstMatch.tap()
        confirm()
        Thread.sleep(forTimeInterval: 1)
        XCTAssertEqual(sessionRows, before, "L'entraînement est supprimé.")
    }

    func testSupprimerUneSeanceAtelier() throws {
        launch("atelier-accueil")
        XCTAssertTrue(element("atelier-nouvel-exercice").waitForExistence(timeout: 20))
        app.buttons["Séances"].firstMatch.tap()
        let plans = app.descendants(matching: .any).matching(identifier: "seance-ligne")
        let before = plans.count

        // Bouton « Supprimer la séance » en bas de la page
        element("atelier-nouvelle-seance").tap()
        XCTAssertTrue(app.textFields["Nom de la séance"].waitForExistence(timeout: 5))
        let delete = element("seance-supprimer")
        reveal(delete)
        delete.tap()
        confirm()
        XCTAssertTrue(element("atelier-nouvelle-seance").waitForExistence(timeout: 5), "Retour à la liste des séances.")
        Thread.sleep(forTimeInterval: 1)
        XCTAssertEqual(plans.count, before, "La séance est supprimée.")

        // Appui long sur la ligne
        element("atelier-nouvelle-seance").tap()
        XCTAssertTrue(app.textFields["Nom de la séance"].waitForExistence(timeout: 5))
        app.navigationBars.buttons.firstMatch.tap()   // retour
        XCTAssertTrue(element("atelier-nouvelle-seance").waitForExistence(timeout: 5))
        Thread.sleep(forTimeInterval: 1)
        XCTAssertEqual(plans.count, before + 1)
        plans.firstMatch.press(forDuration: 1.2)
        app.buttons["Supprimer"].firstMatch.tap()
        confirm()
        Thread.sleep(forTimeInterval: 1)
        XCTAssertEqual(plans.count, before, "La séance est supprimée.")
    }
}
