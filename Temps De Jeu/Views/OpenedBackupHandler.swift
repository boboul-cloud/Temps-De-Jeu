//
//  OpenedBackupHandler.swift
//  Temps De Jeu
//
//  Sauvegarde complète (.tdjb) ouverte depuis l'extérieur : AirDrop,
//  Fichiers, Mail, double-clic dans le Finder sur Mac.
//

import SwiftUI

struct OpenedBackupHandler: ViewModifier {
    /// Appelé après la restauration, pour recharger l'interface
    var onRestored: () -> Void

    @EnvironmentObject private var deepLinkManager: DeepLinkManager
    @State private var pending: ExportService.FullBackupImportResult?
    @State private var showConfirmation = false
    @State private var doneMessage: String?

    func body(content: Content) -> some View {
        content
            .onAppear(perform: consume)   // fichier reçu avant l'affichage de l'app
            .onChange(of: deepLinkManager.shouldNavigateToBackupImport) {
                if deepLinkManager.shouldNavigateToBackupImport { consume() }
            }
            .confirmationDialog("Restaurer la sauvegarde complète ?", isPresented: $showConfirmation,
                                titleVisibility: .visible) {
                Button("Restaurer (remplacer toutes les données)", role: .destructive) { apply() }
                Button("Annuler", role: .cancel) { pending = nil }
            } message: {
                if let pending {
                    Text("Sauvegarde du \(pending.backup.exportDate.formatted(Date.FormatStyle(date: .long, time: .shortened).locale(Locale(identifier: "fr_FR"))))\n\(ExportService.summary(of: pending)).\n\n⚠️ Cette action remplacera toutes les données actuelles de l'application.")
                }
            }
            .alert("Restauration réussie",
                   isPresented: Binding(get: { doneMessage != nil }, set: { if !$0 { doneMessage = nil } })) {
                Button("OK") { doneMessage = nil }
            } message: {
                Text(doneMessage ?? "")
            }
    }

    private func consume() {
        guard let result = deepLinkManager.pendingBackupImport else { return }
        deepLinkManager.clearPendingBackupImport()
        pending = result
        showConfirmation = true
    }

    private func apply() {
        guard let result = pending else { return }
        ExportService.shared.applyFullBackup(result.backup)
        pending = nil
        onRestored()
        doneMessage = "\(ExportService.summary(of: result)) restaurés."
    }
}
