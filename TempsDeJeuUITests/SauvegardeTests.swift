import XCTest

/// Export de la sauvegarde complète depuis l'iPhone (le fichier .tdjb est
/// écrit dans le dossier temporaire de l'app, puis proposé au partage).
final class SauvegardeTests: XCTestCase {

    func testExporterLaSauvegardeComplete() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(fr)", "-AppleLocale", "fr_FR", "-demo", "joueurs"]
        app.launch()

        // Réglages et Exports (dans « Autre » sur iPhone)
        let more = app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Autre", "Plus", "More"])).firstMatch
        if more.waitForExistence(timeout: 10) { more.tap() }
        let settings = app.staticTexts["Réglages et Exports"].firstMatch
        XCTAssertTrue(settings.waitForExistence(timeout: 10))
        settings.tap()

        let exportImport = app.staticTexts["Export / Import"].firstMatch
        XCTAssertTrue(exportImport.waitForExistence(timeout: 10))
        exportImport.tap()

        let backup = app.staticTexts["Exporter la sauvegarde complète"].firstMatch
        var tries = 0
        while !backup.isHittable && tries < 8 {
            app.swipeUp()
            tries += 1
        }
        backup.tap()

        // La feuille de partage s'ouvre avec le fichier
        let share = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS[c] 'sauvegarde_temps_de_jeu' OR identifier == 'ActivityListView'")).firstMatch
        XCTAssertTrue(share.waitForExistence(timeout: 15), "La feuille de partage ne s'est pas ouverte")
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "sauvegarde-partage"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
