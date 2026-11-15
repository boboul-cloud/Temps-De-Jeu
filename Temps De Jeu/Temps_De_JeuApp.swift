//
//  Temps_De_JeuApp.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI
import UserNotifications

@main
struct Temps_De_JeuApp: App {
    @StateObject private var deepLinkManager = DeepLinkManager.shared
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    #if DEBUG
    init() {
        Demo.seedIfNeeded()   // Captures App Store uniquement
    }
    #endif

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(deepLinkManager)
                .onOpenURL { url in
                    deepLinkManager.handleURL(url)
                }
                .task {
                    #if DEBUG
                    if Demo.isActive { return }   // pas de demande d'autorisation à l'image
                    #endif
                    await NotificationManager.shared.requestAuthorization()
                }
        }
    }
}

/// AppDelegate pour gérer les notifications en foreground
class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    /// Afficher les notifications même quand l'app est au premier plan
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}
