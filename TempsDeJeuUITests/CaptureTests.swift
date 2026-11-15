import XCTest

/// Prend les captures d'écran de la fiche App Store.
///
/// Chaque image est un nouveau lancement avec l'argument `-demo` (voir
/// Temps De Jeu/Demo.swift, Debug seulement) : l'app s'ouvre directement sur
/// l'écran voulu, avec une catégorie U13 fictive et son effectif. Ce test ne
/// tape rien : il attend que l'écran soit prêt et photographie.
///
///     ./tools/captures.sh
final class CaptureTests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    private func launch(_ screen: String) {
        app.terminate()
        app.launchArguments = ["-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR", "-demo", screen]
        app.launch()
    }

    private func waitFor(_ text: String, file: StaticString = #filePath, line: UInt = #line) {
        let element = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
        XCTAssertTrue(element.waitForExistence(timeout: 25), "« \(text) » n'est pas à l'écran.", file: file, line: line)
    }

    private func shoot(_ name: String) {
        // Le temps que la scène 3D se pose et que les feuilles finissent de monter.
        Thread.sleep(forTimeInterval: 5)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    func testPrendreLesCaptures() throws {
        // 1. Le match en direct : chrono, score, temps de jeu.
        launch("match")
        waitFor("FC Rivière")
        shoot("01-match")

        // 2. Le placement de l'équipe, en 3D.
        launch("placement3d")
        waitFor("Placement")
        shoot("02-placement-3d")

        // 3. Une tactique animée, étape 4 : flèches de course et de passe.
        launch("tactique")
        waitFor("Passe dans la course du latéral")
        shoot("03-tactique")

        // 4. La bibliothèque d'exercices.
        launch("bibliotheque")
        waitFor("Exercices animés en 3D")
        shoot("04-bibliotheque")

        // 5. L'effectif de la catégorie.
        launch("joueurs")
        waitFor("Garnier")
        shoot("05-joueurs")
    }
}
