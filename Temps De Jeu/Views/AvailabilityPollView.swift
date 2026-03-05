//
//  AvailabilityPollView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 05/03/2026.
//

import SwiftUI

/// Vue de sondage de disponibilité — permet au coach de créer un sondage,
/// de le partager aux joueurs et de voir les réponses
struct AvailabilityPollView: View {
    let session: TrainingSession
    let players: [Player]
    let onUpdate: (TrainingSession) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false
    @State private var pollURL: URL?
    @State private var shareMessage = ""
    @State private var showCopiedToast = false
    
    private var responses: [AvailabilityResponse] {
        session.availabilityResponses.sorted { $0.playerName.localizedCompare($1.playerName) == .orderedAscending }
    }
    
    private var presentCount: Int {
        responses.filter { $0.status == .present }.count
    }
    
    private var absentCount: Int {
        responses.filter { $0.status == .absent }.count
    }
    
    private var uncertainCount: Int {
        responses.filter { $0.status == .incertain }.count
    }
    
    private var notRespondedCount: Int {
        players.count - responses.count
    }
    
    private var teamName: String {
        ProfileManager.shared.activeProfile?.name ?? "Mon équipe"
    }
    
    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .full
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }
    
    var body: some View {
        NavigationStack {
            List {
                // Résumé
                summarySection
                
                // Lien de partage
                shareSection
                
                // Réponses reçues
                if !responses.isEmpty {
                    responsesSection
                }
                
                // Joueurs sans réponse
                if notRespondedCount > 0 {
                    notRespondedSection
                }
                
                // Action: appliquer aux présences
                if !responses.isEmpty {
                    applySection
                }
            }
            .navigationTitle("Sondage disponibilité")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
            .onAppear {
                generatePollURL()
            }
            .overlay {
                if showCopiedToast {
                    copiedToastOverlay
                }
            }
        }
    }
    
    // MARK: - Sections
    
    private var summarySection: some View {
        Section {
            VStack(spacing: 12) {
                Text(dateFormatter.string(from: session.date))
                    .font(.headline)
                
                HStack(spacing: 16) {
                    SummaryBadge(count: presentCount, label: "Présents", color: .green, icon: "checkmark.circle.fill")
                    SummaryBadge(count: uncertainCount, label: "Incertains", color: .orange, icon: "questionmark.circle.fill")
                    SummaryBadge(count: absentCount, label: "Absents", color: .red, icon: "xmark.circle.fill")
                    SummaryBadge(count: notRespondedCount, label: "En attente", color: .gray, icon: "clock.fill")
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
    }
    
    private var shareSection: some View {
        Section {
            if players.isEmpty {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Aucun joueur disponible")
                            .foregroundStyle(.secondary)
                        Text("Ajoutez des joueurs à cette catégorie pour créer un sondage.")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                }
            } else if let url = pollURL {
                // Partager via le Share Sheet iOS
                Button {
                    showShareSheet = true
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Partager le sondage")
                            Text("WhatsApp, SMS, Messages...")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "square.and.arrow.up.fill")
                            .foregroundStyle(.orange)
                    }
                }
                .sheet(isPresented: $showShareSheet) {
                    ActivityViewController(activityItems: [shareMessage])
                        .presentationDetents([.medium, .large])
                }
                
                // Copier le lien
                Button {
                    UIPasteboard.general.string = url.absoluteString
                    withAnimation { showCopiedToast = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        withAnimation { showCopiedToast = false }
                    }
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Copier le lien")
                            Text(url.absoluteString)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    } icon: {
                        Image(systemName: "doc.on.doc.fill")
                            .foregroundStyle(.blue)
                    }
                }
            } else {
                HStack {
                    ProgressView()
                    Text("Génération du lien...")
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("Partager aux joueurs")
        } footer: {
            Text("Partagez ce lien à vos joueurs. Ils pourront répondre depuis n'importe quel téléphone (iPhone ou Android).")
        }
    }
    
    private var responsesSection: some View {
        Section {
            ForEach(responses) { response in
                HStack(spacing: 12) {
                    Image(systemName: response.status.icon)
                        .font(.title2)
                        .foregroundStyle(colorForStatus(response.status))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(response.playerName)
                            .font(.body)
                        
                        if !response.comment.isEmpty {
                            Text(response.comment)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        Text(relativeDate(response.respondedAt))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    
                    Spacer()
                    
                    Text(response.status.label)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(colorForStatus(response.status).opacity(0.15))
                        .foregroundStyle(colorForStatus(response.status))
                        .cornerRadius(8)
                }
                .padding(.vertical, 2)
            }
        } header: {
            Text("Réponses (\(responses.count)/\(players.count))")
        }
    }
    
    private var notRespondedSection: some View {
        Section {
            let respondedIds = Set(responses.map { $0.id })
            let notResponded = players.filter { !respondedIds.contains($0.id) }
                .sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
            
            ForEach(notResponded) { player in
                HStack(spacing: 12) {
                    Image(systemName: "clock.fill")
                        .font(.title2)
                        .foregroundStyle(.gray)
                    
                    Text(player.fullName)
                        .foregroundStyle(.secondary)
                    
                    Spacer()
                    
                    Text("En attente")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }

            // Bouton rappel notification
            if notResponded.count > 0 {
                Button {
                    scheduleReminder()
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Programmer un rappel")
                            Text("Notification demain à 9h pour relancer")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "bell.badge.fill")
                            .foregroundStyle(.orange)
                    }
                }
            }
        } header: {
            Text("Sans réponse (\(notRespondedCount))")
        }
    }
    
    private var applySection: some View {
        Section {
            Button {
                applyResponsesToAttendance()
            } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Appliquer aux présences")
                            .font(.body.bold())
                        Text("Les joueurs « Présent » seront pointés présents")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "checkmark.rectangle.stack.fill")
                        .foregroundStyle(.green)
                }
            }
        } footer: {
            Text("Ceci modifiera les présences de cet entraînement en fonction des réponses reçues. Vous pourrez toujours ajuster manuellement ensuite.")
        }
    }
    
    private var copiedToastOverlay: some View {
        Text("📋 Lien copié !")
            .font(.subheadline.bold())
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
            .transition(.scale.combined(with: .opacity))
    }
    
    // MARK: - Helpers
    
    private func generatePollURL() {
        pollURL = DeepLinkManager.shared.createAvailabilityPollURL(
            teamName: teamName,
            sessionId: session.id,
            sessionDate: session.date,
            players: players
        )
        
        if let url = pollURL {
            shareMessage = DeepLinkManager.shared.createAvailabilityPollMessage(
                teamName: teamName,
                sessionDate: session.date,
                playerCount: players.count,
                pollURL: url
            )
        }
    }
    
    private func applyResponsesToAttendance() {
        var updatedSession = session
        TrainingManager.shared.applyResponsesToAttendance(session: &updatedSession)
        onUpdate(updatedSession)
        dismiss()
    }

    private func scheduleReminder() {
        // Programmer un rappel demain à 9h
        var components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        components.day! += 1
        components.hour = 9
        components.minute = 0
        let reminderDate = Calendar.current.date(from: components) ?? Date().addingTimeInterval(86400)

        NotificationManager.shared.scheduleAvailabilityReminder(
            sessionId: session.id,
            sessionDate: session.date,
            teamName: teamName,
            pendingCount: notRespondedCount,
            reminderDate: reminderDate
        )

        withAnimation { showCopiedToast = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation { showCopiedToast = false }
        }
    }
        onUpdate(updatedSession)
        dismiss()
    }
    
    private func colorForStatus(_ status: AvailabilityStatus) -> Color {
        switch status {
        case .present: return .green
        case .absent: return .red
        case .incertain: return .orange
        }
    }
    
    private func relativeDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Badge de résumé

private struct SummaryBadge: View {
    let count: Int
    let label: String
    let color: Color
    let icon: String
    
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
            Text("\(count)")
                .font(.title3.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - UIActivityViewController wrapper

private struct ActivityViewController: UIViewControllerRepresentable {
    let activityItems: [Any]
    var applicationActivities: [UIActivity]? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Alerte de réception de réponse

/// Vue d'alerte lorsqu'une réponse de disponibilité est reçue via deep link
struct AvailabilityResponseAlert: View {
    let response: AvailabilityResponse
    let onDismiss: () -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: response.status.icon)
                .font(.system(size: 48))
                .foregroundStyle(colorForStatus(response.status))
            
            Text("Réponse reçue")
                .font(.headline)
            
            Text("\(response.playerName) : \(response.status.label)")
                .font(.body)
            
            if !response.comment.isEmpty {
                Text("« \(response.comment) »")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .italic()
            }
            
            Button("OK") {
                onDismiss()
            }
            .buttonStyle(.borderedProminent)
            .tint(.orange)
        }
        .padding(24)
        .background(.regularMaterial)
        .cornerRadius(20)
        .shadow(radius: 20)
        .padding(32)
    }
    
    private func colorForStatus(_ status: AvailabilityStatus) -> Color {
        switch status {
        case .present: return .green
        case .absent: return .red
        case .incertain: return .orange
        }
    }
}
