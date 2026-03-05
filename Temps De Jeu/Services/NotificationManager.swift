//
//  NotificationManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/03/2026.
//

import Foundation
import UserNotifications

/// Gestionnaire de notifications locales
/// - Notification immédiate quand une réponse de disponibilité arrive
/// - Rappel programmable pour les sondages en attente
@MainActor
class NotificationManager: NSObject, ObservableObject {
    static let shared = NotificationManager()

    @Published var isAuthorized = false

    private override init() {
        super.init()
        checkAuthorization()
    }

    // MARK: - Authorization

    /// Demander l'autorisation de notifications
    func requestAuthorization() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            isAuthorized = granted
        } catch {
            print("[Notifications] Erreur demande autorisation: \(error)")
        }
    }

    /// Vérifier l'état actuel
    func checkAuthorization() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            Task { @MainActor in
                self.isAuthorized = settings.authorizationStatus == .authorized
            }
        }
    }

    // MARK: - Disponibilité

    /// Notification immédiate quand une réponse de disponibilité est reçue
    func notifyAvailabilityResponse(playerName: String, status: AvailabilityStatus, sessionDate: Date) {
        guard isAuthorized else { return }

        let content = UNMutableNotificationContent()
        content.title = "📋 Réponse reçue"

        let df = DateFormatter()
        df.dateStyle = .medium
        df.locale = Locale(identifier: "fr_FR")

        let statusEmoji: String
        switch status {
        case .present: statusEmoji = "✅ Présent"
        case .absent: statusEmoji = "❌ Absent"
        case .incertain: statusEmoji = "🤔 Incertain"
        }

        content.body = "\(playerName) : \(statusEmoji)\nEntraînement du \(df.string(from: sessionDate))"
        content.sound = .default
        content.categoryIdentifier = "AVAILABILITY_RESPONSE"

        let request = UNNotificationRequest(
            identifier: "availability-\(UUID().uuidString)",
            content: content,
            trigger: nil // immédiat
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                print("[Notifications] Erreur envoi: \(error)")
            }
        }
    }

    /// Programmer un rappel pour relancer les joueurs qui n'ont pas répondu
    func scheduleAvailabilityReminder(
        sessionId: UUID,
        sessionDate: Date,
        teamName: String,
        pendingCount: Int,
        reminderDate: Date
    ) {
        guard isAuthorized else { return }
        guard reminderDate > Date() else { return }

        // Supprimer un éventuel rappel précédent pour cette session
        let identifier = "reminder-\(sessionId.uuidString)"
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])

        let content = UNMutableNotificationContent()
        content.title = "⚽ Sondage en attente"
        content.body = "\(pendingCount) joueur\(pendingCount > 1 ? "s" : "") n'ont pas encore répondu pour \(teamName)"
        content.sound = .default
        content.categoryIdentifier = "AVAILABILITY_REMINDER"

        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: reminderDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                print("[Notifications] Erreur programmation rappel: \(error)")
            } else {
                print("[Notifications] Rappel programmé pour \(reminderDate)")
            }
        }
    }

    /// Annuler le rappel pour une session
    func cancelReminder(for sessionId: UUID) {
        let identifier = "reminder-\(sessionId.uuidString)"
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }
}
