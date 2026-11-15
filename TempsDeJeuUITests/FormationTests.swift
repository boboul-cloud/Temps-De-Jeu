import XCTest

/// Formations prédéfinies avec un effectif réduit (football à 8) :
/// l'app plantait quand il y avait moins de 11 titulaires.
final class FormationTests: XCTestCase {

    func testFormationsAvecHuitJoueurs() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR", "-demo", "placement8"]
        app.launch()
        XCTAssertTrue(app.navigationBars["Placement"].waitForExistence(timeout: 20))

        let attendus = [("4-4-2", "3-3-1"), ("4-3-3", "3-2-2"), ("3-4-3", "2-3-2"), ("3-5-2", "2-4-1"),
                        ("5-3-2", "4-2-1"), ("4-2-3-1", "3-1-2-1"), ("4-1-4-1", "3-1-3")]
        for (choix, adapte) in attendus {
            app.buttons["Formation"].firstMatch.tap()
            app.buttons[choix].firstMatch.tap()
            XCTAssertTrue(app.staticTexts[adapte].waitForExistence(timeout: 5), "\(choix) devait devenir \(adapte)")
            XCTAssertEqual(app.state, .runningForeground, "L'app a planté sur \(choix)")
        }
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "formation-a-8"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
