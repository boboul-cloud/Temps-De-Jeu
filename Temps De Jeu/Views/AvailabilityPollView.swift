//
//  AvailabilityPollView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 05/03/2026.
//

import SwiftUI
import MessageUI

/// Vue de sondage de disponibilité — permet au coach de créer un sondage,
/// de le partager aux joueurs et de voir les réponses
struct AvailabilityPollView: View {
    let session: TrainingSession
    let players: [Player]
    let onUpdate: (TrainingSession) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false
    @State private var showSMSComposer = false
    @State private var pollURL: URL?
    @State private var shareMessage = ""
    @State private var showCopiedToast = false
    @State private var showIndividualLinks = false
    @State private var showIndividualShareSheet = false
    @State private var showIndividualSMS = false
    @State private var individualShareMessage = ""
    @State private var individualSMSRecipient = ""
    @State private var smsQueue: [Player] = []
    @State private var smsSentCount = 0
    @State private var smsTotalCount = 0
    
    /// Joueurs ayant un numéro de téléphone renseigné
    private var playersWithPhone: [Player] {
        players.filter { $0.phoneNumber != nil && !($0.phoneNumber?.trimmingCharacters(in: .whitespaces).isEmpty ?? true) }
    }
    
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
    
    /// N° de téléphone du coach (1er encadrant avec rôle "Coach" et un n° renseigné)
    private var coachPhone: String {
        let roles = StaffManager.shared.loadRoles()
        guard let coachRole = roles.first(where: { $0.name == "Coach" }) else { return "" }
        let staff = StaffManager.shared.loadStaff()
        let coach = staff.first(where: { $0.roleId == coachRole.id && !$0.phone.trimmingCharacters(in: .whitespaces).isEmpty })
        return coach?.phone ?? ""
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
                
                // Liens individuels (anti-usurpation)
                if pollURL != nil {
                    individualLinksSection
                }
                
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
            .sheet(isPresented: $showIndividualShareSheet) {
                ActivityViewController(activityItems: [individualShareMessage])
                    .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $showIndividualSMS, onDismiss: {
                sendNextQueuedSMS()
            }) {
                SMSComposeViewController(
                    recipients: [individualSMSRecipient],
                    body: individualShareMessage
                )
            }
        }
    }
    
    // MARK: - Sections
    
    private var summarySection: some View {
        Section {
            VStack(spacing: 12) {
                Text(dateFormatter.string(from: session.date))
                    .font(.headline)
                
                if !session.location.isEmpty {
                    Label(session.location, systemImage: "mappin.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
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
                
                // Envoyer par SMS directement
                if MFMessageComposeViewController.canSendText() && !playersWithPhone.isEmpty {
                    Button {
                        showSMSComposer = true
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Envoyer par SMS")
                                Text("\(playersWithPhone.count) joueur\(playersWithPhone.count > 1 ? "s" : "") avec n° de téléphone")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "message.fill")
                                .foregroundStyle(.green)
                        }
                    }
                    .sheet(isPresented: $showSMSComposer) {
                        SMSComposeViewController(
                            recipients: playersWithPhone.compactMap { $0.phoneNumber },
                            body: shareMessage
                        )
                    }
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
            if !playersWithPhone.isEmpty {
                let withoutPhone = players.count - playersWithPhone.count
                if withoutPhone > 0 {
                    Text("\(withoutPhone) joueur\(withoutPhone > 1 ? "s" : "") sans n° de téléphone — utilisez le partage classique pour les contacter.")
                } else {
                    Text("Tous les joueurs ont un n° de téléphone renseigné.")
                }
            } else {
                Text("Partagez ce lien à vos joueurs. Ils pourront répondre depuis n'importe quel téléphone (iPhone ou Android).")
            }
        }
    }
    
    private var individualLinksSection: some View {
        Section {
            // Bouton envoi groupé par SMS
            if MFMessageComposeViewController.canSendText() && !playersWithPhone.isEmpty {
                Button {
                    startBulkSMS()
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Envoyer à tous par SMS")
                            Text("\(playersWithPhone.count) joueur\(playersWithPhone.count > 1 ? "s" : "") — un SMS individuel par joueur")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "message.badge.filled.fill")
                            .foregroundStyle(.green)
                    }
                }
            }
            
            DisclosureGroup(isExpanded: $showIndividualLinks) {
                ForEach(players.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }) { player in
                    HStack(spacing: 16) {
                        Text(player.fullName)
                            .font(.body)
                        
                        Spacer()
                        
                        // SMS si n° de téléphone disponible
                        if MFMessageComposeViewController.canSendText(),
                           let phone = player.phoneNumber,
                           !phone.trimmingCharacters(in: .whitespaces).isEmpty {
                            Button {
                                sendIndividualSMS(for: player)
                            } label: {
                                Image(systemName: "message.fill")
                                    .font(.body)
                                    .foregroundStyle(.green)
                            }
                            .buttonStyle(.borderless)
                        }
                        
                        // Partage classique
                        Button {
                            shareIndividualLink(for: player)
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                                .font(.body)
                                .foregroundStyle(.orange)
                        }
                        .buttonStyle(.borderless)
                    }
                    .padding(.vertical, 2)
                }
            } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Envoi individuel")
                        Text("Un lien unique par joueur (anti-usurpation)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "person.crop.circle.badge.checkmark")
                        .foregroundStyle(.orange)
                }
            }
        } header: {
            Text("Liens individuels")
        } footer: {
            if smsSentCount > 0 && smsQueue.isEmpty {
                Text("✅ \(smsSentCount) SMS individuel\(smsSentCount > 1 ? "s" : "") envoyé\(smsSentCount > 1 ? "s" : "")")
            } else if !smsQueue.isEmpty {
                Text("📤 Envoi en cours : \(smsSentCount)/\(smsTotalCount)…")
            } else {
                Text("Chaque joueur reçoit un lien personnel et ne peut répondre que pour lui-même.")
            }
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
            players: players,
            coachPhone: coachPhone
        )
        
        if let url = pollURL {
            shareMessage = DeepLinkManager.shared.createAvailabilityPollMessage(
                teamName: teamName,
                sessionDate: session.date,
                location: session.location,
                playerCount: players.count,
                pollURL: url
            )
        }
    }
    
    private func shareIndividualLink(for player: Player) {
        guard let url = DeepLinkManager.shared.createIndividualPollURL(
            teamName: teamName,
            sessionId: session.id,
            sessionDate: session.date,
            player: player,
            coachPhone: coachPhone
        ) else { return }
        
        individualShareMessage = DeepLinkManager.shared.createIndividualPollMessage(
            teamName: teamName,
            sessionDate: session.date,
            location: session.location,
            playerFirstName: player.firstName,
            pollURL: url
        )
        showIndividualShareSheet = true
    }
    
    private func sendIndividualSMS(for player: Player) {
        guard let url = DeepLinkManager.shared.createIndividualPollURL(
            teamName: teamName,
            sessionId: session.id,
            sessionDate: session.date,
            player: player,
            coachPhone: coachPhone
        ) else { return }
        
        individualShareMessage = DeepLinkManager.shared.createIndividualPollMessage(
            teamName: teamName,
            sessionDate: session.date,
            location: session.location,
            playerFirstName: player.firstName,
            pollURL: url
        )
        individualSMSRecipient = player.phoneNumber ?? ""
        showIndividualSMS = true
    }
    
    private func startBulkSMS() {
        smsQueue = playersWithPhone.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
        smsSentCount = 0
        smsTotalCount = smsQueue.count
        sendNextQueuedSMS()
    }
    
    private func sendNextQueuedSMS() {
        guard !smsQueue.isEmpty else { return }
        
        let player = smsQueue.removeFirst()
        
        guard let url = DeepLinkManager.shared.createIndividualPollURL(
            teamName: teamName,
            sessionId: session.id,
            sessionDate: session.date,
            player: player,
            coachPhone: coachPhone
        ) else {
            smsSentCount += 1
            sendNextQueuedSMS()
            return
        }
        
        individualShareMessage = DeepLinkManager.shared.createIndividualPollMessage(
            teamName: teamName,
            sessionDate: session.date,
            location: session.location,
            playerFirstName: player.firstName,
            pollURL: url
        )
        individualSMSRecipient = player.phoneNumber ?? ""
        smsSentCount += 1
        
        // Délai pour laisser la sheet précédente se fermer
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            showIndividualSMS = true
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

// MARK: - MFMessageComposeViewController wrapper

/// Wrapper SwiftUI pour le composeur SMS natif iOS
private struct SMSComposeViewController: UIViewControllerRepresentable {
    let recipients: [String]
    let body: String
    @Environment(\.dismiss) private var dismiss
    
    func makeCoordinator() -> Coordinator {
        Coordinator(dismiss: dismiss)
    }
    
    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let controller = MFMessageComposeViewController()
        controller.recipients = recipients
        controller.body = body
        controller.messageComposeDelegate = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}
    
    class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        let dismiss: DismissAction
        
        init(dismiss: DismissAction) {
            self.dismiss = dismiss
        }
        
        func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
            dismiss()
        }
    }
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
