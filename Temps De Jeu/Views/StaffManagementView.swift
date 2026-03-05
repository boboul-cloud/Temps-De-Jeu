//
//  StaffManagementView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 26/02/2026.
//

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// Vue de gestion de l'encadrement des équipes
struct StaffManagementView: View {
    @State private var staffMembers: [StaffMember] = []
    @State private var roles: [StaffRole] = []
    @State private var showAddStaff = false
    @State private var editingStaff: StaffMember?
    @State private var showRoleManager = false
    @State private var searchText = ""
    @ObservedObject private var profileManager = ProfileManager.shared

    // Export / Import
    @State private var shareItemsWrapper: ExportShareItemsWrapper?
    @State private var pdfPreviewItem: ExportImportView.PDFPreviewItem?
    @State private var showFilePicker = false
    @State private var showImportConfirmation = false
    @State private var importedStaff: [StaffMember] = []
    @State private var importedRoles: [StaffRole] = []
    @State private var alertTitle = ""
    @State private var alertMessage = ""
    @State private var showAlert = false

    /// Encadrants filtrés par recherche
    var filteredStaff: [StaffMember] {
        let sorted = staffMembers.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
        if searchText.isEmpty { return sorted }
        return sorted.filter {
            $0.fullName.localizedCaseInsensitiveContains(searchText)
        }
    }

    /// Encadrants groupés par rôle
    var staffByRole: [(role: StaffRole, members: [StaffMember])] {
        var result: [(role: StaffRole, members: [StaffMember])] = []
        for role in roles {
            let members = filteredStaff.filter { $0.roleId == role.id }
            if !members.isEmpty {
                result.append((role: role, members: members))
            }
        }
        // Encadrants avec un rôle supprimé
        let knownRoleIds = Set(roles.map { $0.id })
        let orphans = filteredStaff.filter { !knownRoleIds.contains($0.roleId) }
        if !orphans.isEmpty {
            result.append((role: StaffRole(name: "Autre"), members: orphans))
        }
        return result
    }

    var body: some View {
        Group {
            if staffMembers.isEmpty {
                emptyState
            } else {
                staffList
            }
        }
        .navigationTitle("Encadrement")
        .searchable(text: $searchText, prompt: "Rechercher un encadrant")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showAddStaff = true
                    } label: {
                        Label("Ajouter un encadrant", systemImage: "person.badge.plus")
                    }
                    Button {
                        showRoleManager = true
                    } label: {
                        Label("Gérer les rôles", systemImage: "tag")
                    }

                    Divider()

                    // Export JSON
                    Button {
                        exportStaffJSON()
                    } label: {
                        Label("Exporter (JSON)", systemImage: "doc.text")
                    }
                    .disabled(staffMembers.isEmpty)

                    // Export PDF
                    Button {
                        previewStaffPDF()
                    } label: {
                        Label("Exporter (PDF)", systemImage: "doc.richtext")
                    }
                    .disabled(staffMembers.isEmpty)

                    // Import JSON
                    Button {
                        showFilePicker = true
                    } label: {
                        Label("Importer (JSON)", systemImage: "square.and.arrow.down")
                    }
                } label: {
                    Image(systemName: "plus.circle.fill")
                }
            }
        }
        .sheet(isPresented: $showAddStaff) {
            StaffEditView(member: nil, roles: roles) { newMember in
                var memberWithProfile = newMember
                // Assigner automatiquement au profil actif
                if let activeId = profileManager.activeProfileId {
                    memberWithProfile.profileIds.insert(activeId)
                }
                StaffManager.shared.saveStaffMember(memberWithProfile)
                reloadData()
            }
        }
        .sheet(item: $editingStaff) { member in
            StaffEditView(member: member, roles: roles) { updated in
                StaffManager.shared.saveStaffMember(updated)
                reloadData()
            }
        }
        .sheet(isPresented: $showRoleManager) {
            StaffRoleManagerView(roles: $roles)
        }
        .sheet(item: $shareItemsWrapper) { wrapper in
            ActivityView(activityItems: wrapper.items)
        }
        .sheet(item: $pdfPreviewItem) { item in
            PDFPreviewView(pdfData: item.data, title: item.title)
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.json],
            allowsMultipleSelection: false
        ) { result in
            handleStaffImportResult(result)
        }
        .confirmationDialog(
            "Importer \(importedStaff.count) encadrant\(importedStaff.count > 1 ? "s" : "")",
            isPresented: $showImportConfirmation,
            titleVisibility: .visible
        ) {
            Button("Fusionner (ajouter les nouveaux)") {
                performStaffImport(mode: .merge)
            }
            Button("Remplacer tout l'encadrement") {
                performStaffImport(mode: .replace)
            }
            Button("Annuler", role: .cancel) {
                importedStaff = []
                importedRoles = []
            }
        } message: {
            let rolesCount = importedRoles.isEmpty ? "" : " et \(importedRoles.count) rôle\(importedRoles.count > 1 ? "s" : "")"
            Text("\(importedStaff.count) encadrant\(importedStaff.count > 1 ? "s" : "")\(rolesCount) trouvé\(importedStaff.count > 1 ? "s" : "") dans le fichier.")
        }
        .alert(alertTitle, isPresented: $showAlert) {
            Button("OK") {}
        } message: {
            Text(alertMessage)
        }
        .onAppear {
            reloadData()
        }
        .onChange(of: profileManager.activeProfileId) {
            reloadData()
        }
    }

    private func reloadData() {
        staffMembers = StaffManager.shared.loadStaff()
        roles = StaffManager.shared.loadRoles()
    }

    // MARK: - Export / Import Encadrement

    private func exportStaffJSON() {
        guard let data = ExportService.shared.exportStaffJSON(staffMembers, roles: roles) else {
            showAlertWith(title: "Erreur", message: "Impossible d'exporter l'encadrement.")
            return
        }
        let categoryName = profileManager.activeProfile?.name ?? "tous"
        let cleanCategory = categoryName
            .replacingOccurrences(of: " ", with: "_")
            .replacingOccurrences(of: "/", with: "-")
        let fileName = "encadrement_\(cleanCategory)_\(formattedDateForFile()).json"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: tempURL)
            shareItemsWrapper = ExportShareItemsWrapper(items: [tempURL])
        } catch {
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private func previewStaffPDF() {
        let data = ExportService.shared.generateStaffPDF(staffMembers: staffMembers, roles: roles)
        pdfPreviewItem = ExportImportView.PDFPreviewItem(data: data, title: "Encadrement")
    }

    private func handleStaffImportResult(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else {
                showAlertWith(title: "Erreur", message: "Impossible d'accéder au fichier.")
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }
            do {
                let data = try Data(contentsOf: url)
                guard let importResult = ExportService.shared.importStaffWithMetadata(from: data) else {
                    showAlertWith(title: "Erreur", message: "Le fichier n'est pas un export d'encadrement valide.")
                    return
                }
                importedStaff = importResult.staffMembers
                importedRoles = importResult.staffRoles
                showImportConfirmation = true
            } catch {
                showAlertWith(title: "Erreur", message: "Impossible de lire le fichier : \(error.localizedDescription)")
            }
        case .failure(let error):
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }

    private enum StaffImportMode { case merge, replace }

    private func performStaffImport(mode: StaffImportMode) {
        // Importer les rôles personnalisés manquants
        var currentRoles = StaffManager.shared.loadRoles()
        let existingRoleIds = Set(currentRoles.map { $0.id })

        // Map old roleId → new roleId pour les rôles renommés/manquants
        var roleIdMapping: [UUID: UUID] = [:]

        for importedRole in importedRoles {
            if existingRoleIds.contains(importedRole.id) {
                // Rôle déjà présent (même UUID)
                roleIdMapping[importedRole.id] = importedRole.id
            } else if let existing = currentRoles.first(where: { $0.name.lowercased() == importedRole.name.lowercased() }) {
                // Même nom mais UUID différent → mapper vers l'existant
                roleIdMapping[importedRole.id] = existing.id
            } else {
                // Nouveau rôle → ajouter
                currentRoles.append(importedRole)
                roleIdMapping[importedRole.id] = importedRole.id
            }
        }
        StaffManager.shared.saveRoles(currentRoles)

        switch mode {
        case .replace:
            // Remplacer tous les encadrants du profil actif
            var allStaff = StaffManager.shared.loadAllStaff()
            let activeId = profileManager.activeProfileId
            // Retirer les encadrants du profil actif
            allStaff = allStaff.map { member in
                guard let activeId = activeId, member.profileIds.contains(activeId) else { return member }
                var m = member
                m.profileIds.remove(activeId)
                return m
            }
            // Supprimer ceux qui n'ont plus aucun profil
            allStaff.removeAll { $0.profileIds.isEmpty }
            // Ajouter les nouveaux
            for imported in importedStaff {
                let mappedRoleId = roleIdMapping[imported.roleId] ?? imported.roleId
                let m = StaffMember(
                    id: UUID(),
                    firstName: imported.firstName,
                    lastName: imported.lastName,
                    roleId: mappedRoleId,
                    phone: imported.phone,
                    email: imported.email,
                    photoData: imported.photoData,
                    profileIds: activeId != nil ? [activeId!] : imported.profileIds
                )
                allStaff.append(m)
            }
            StaffManager.shared.saveAllStaff(allStaff)

        case .merge:
            var allStaff = StaffManager.shared.loadAllStaff()
            let activeId = profileManager.activeProfileId
            var added = 0
            var updated = 0

            for imported in importedStaff {
                let importedName = imported.fullName.lowercased()
                if let existingIdx = allStaff.firstIndex(where: { $0.fullName.lowercased() == importedName }) {
                    // Mettre à jour le contact si vide
                    if allStaff[existingIdx].phone.isEmpty && !imported.phone.isEmpty {
                        allStaff[existingIdx].phone = imported.phone
                    }
                    if allStaff[existingIdx].email.isEmpty && !imported.email.isEmpty {
                        allStaff[existingIdx].email = imported.email
                    }
                    if allStaff[existingIdx].photoData == nil, let photo = imported.photoData {
                        allStaff[existingIdx].photoData = photo
                    }
                    // S'assurer qu'il est bien rattaché au profil actif
                    if let activeId = activeId {
                        allStaff[existingIdx].profileIds.insert(activeId)
                    }
                    updated += 1
                } else {
                    // Nouveau → ajouter
                    let mappedRoleId = roleIdMapping[imported.roleId] ?? imported.roleId
                    let m = StaffMember(
                        id: UUID(),
                        firstName: imported.firstName,
                        lastName: imported.lastName,
                        roleId: mappedRoleId,
                        phone: imported.phone,
                        email: imported.email,
                        photoData: imported.photoData,
                        profileIds: activeId != nil ? [activeId!] : imported.profileIds
                    )
                    allStaff.append(m)
                    added += 1
                }
            }
            StaffManager.shared.saveAllStaff(allStaff)
        }

        reloadData()
        let total = staffMembers.count
        showAlertWith(
            title: "Import réussi",
            message: mode == .replace
                ? "\(importedStaff.count) encadrant\(importedStaff.count > 1 ? "s" : "") importé\(importedStaff.count > 1 ? "s" : "") (remplacement)."
                : "Encadrement mis à jour. \(total) encadrant\(total > 1 ? "s" : "") au total."
        )
        importedStaff = []
        importedRoles = []
    }

    private func formattedDateForFile() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private func showAlertWith(title: String, message: String) {
        alertTitle = title
        alertMessage = message
        showAlert = true
    }

    // MARK: - État vide

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.badge.shield.checkmark.fill")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("Aucun encadrant")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Ajoutez les coaches, arbitres,\ndélégués et autres encadrants\nde vos équipes.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)

            Button {
                showAddStaff = true
            } label: {
                HStack {
                    Image(systemName: "plus")
                    Text("Ajouter un encadrant")
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .background(profileManager.activeProfileColor)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
        }
    }

    // MARK: - Liste

    private var staffList: some View {
        List {
            // Résumé
            Section {
                HStack(spacing: 20) {
                    TeamStatBadge(label: "Encadrants", value: "\(staffMembers.count)", color: profileManager.activeProfileColor)
                    TeamStatBadge(label: "Rôles", value: "\(Set(staffMembers.map { $0.roleId }).count)", color: .orange)
                }
                .listRowBackground(Color.clear)
            }

            // Par rôle
            ForEach(staffByRole, id: \.role.id) { group in
                Section {
                    ForEach(group.members) { member in
                        StaffRow(member: member, roleName: StaffManager.shared.roleName(for: member.roleId))
                            .onTapGesture { editingStaff = member }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    deleteStaff(member)
                                } label: {
                                    Label("Supprimer", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .leading) {
                                if let phone = phoneURL(for: member) {
                                    Button {
                                        UIApplication.shared.open(phone)
                                    } label: {
                                        Label("Appeler", systemImage: "phone.fill")
                                    }
                                    .tint(.green)
                                }
                            }
                    }
                } header: {
                    HStack {
                        Image(systemName: iconForRole(group.role.name))
                            .foregroundStyle(profileManager.activeProfileColor)
                        Text("\(group.role.name) (\(group.members.count))")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func deleteStaff(_ member: StaffMember) {
        StaffManager.shared.deleteStaffMember(member.id)
        reloadData()
    }

    private func phoneURL(for member: StaffMember) -> URL? {
        let cleaned = member.phone.replacingOccurrences(of: " ", with: "")
        guard !cleaned.isEmpty else { return nil }
        return URL(string: "tel:\(cleaned)")
    }

    /// Icône SF Symbol selon le nom du rôle
    private func iconForRole(_ name: String) -> String {
        let lower = name.lowercased()
        if lower.contains("coach") || lower.contains("entraîneur") { return "sportscourt.fill" }
        if lower.contains("arbitre") { return "flag.fill" }
        if lower.contains("délégué") { return "person.text.rectangle" }
        if lower.contains("préparateur") { return "figure.run" }
        if lower.contains("gardien") { return "hand.raised.fill" }
        if lower.contains("intendant") { return "shippingbox.fill" }
        if lower.contains("médical") || lower.contains("kiné") || lower.contains("soigneur") { return "cross.case.fill" }
        return "person.fill"
    }
}

// MARK: - Ligne encadrant

struct StaffRow: View {
    let member: StaffMember
    let roleName: String

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            StaffAvatar(member: member, size: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text(member.fullName)
                    .font(.subheadline.bold())
                Text(roleName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !member.phone.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 9))
                        Text(member.phone)
                            .font(.caption2)
                    }
                    .foregroundStyle(.blue)
                }
            }

            Spacer()

            // Badge catégories
            if member.profileIds.count > 1 {
                Text("\(member.profileIds.count) cat.")
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.15))
                    .foregroundStyle(.orange)
                    .cornerRadius(8)
            }

            // Bouton appel direct
            if !member.phone.isEmpty {
                Button {
                    let cleaned = member.phone.replacingOccurrences(of: " ", with: "")
                    if let url = URL(string: "tel:\(cleaned)") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Image(systemName: "phone.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Avatar encadrant

struct StaffAvatar: View {
    let member: StaffMember
    var size: CGFloat = 40

    var body: some View {
        Group {
            if let photoData = member.photoData,
               let uiImage = UIImage(data: photoData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                Text(String(member.firstName.prefix(1)).uppercased())
                    .font(.system(size: size * 0.45, weight: .semibold, design: .rounded))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.gray)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(
            Circle()
                .stroke(Color.secondary.opacity(0.3), lineWidth: 2)
        )
    }
}

// MARK: - Édition d'un encadrant

struct StaffEditView: View {
    let member: StaffMember?
    @State private var roles: [StaffRole]
    let onSave: (StaffMember) -> Void
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var profileManager = ProfileManager.shared

    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var selectedRoleId: UUID = UUID()
    @State private var phone: String = ""
    @State private var email: String = ""
    @State private var photoData: Data?
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var assignedProfileIds: Set<UUID> = []

    init(member: StaffMember?, roles: [StaffRole], onSave: @escaping (StaffMember) -> Void) {
        self.member = member
        let effectiveRoles = roles.isEmpty ? StaffManager.shared.loadRoles() : roles
        self._roles = State(initialValue: effectiveRoles)
        self.onSave = onSave
    }

    var isEditing: Bool { member != nil }

    var body: some View {
        NavigationStack {
            Form {
                // Section Photo
                Section {
                    HStack {
                        Spacer()
                        VStack(spacing: 12) {
                            Group {
                                if let photoData = photoData,
                                   let uiImage = UIImage(data: photoData) {
                                    Image(uiImage: uiImage)
                                        .resizable()
                                        .scaledToFill()
                                } else {
                                    Image(systemName: "person.circle.fill")
                                        .resizable()
                                        .scaledToFit()
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .frame(width: 100, height: 100)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .stroke(Color.secondary.opacity(0.3), lineWidth: 2)
                            )

                            HStack(spacing: 16) {
                                PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                                    Label(photoData == nil ? "Ajouter" : "Modifier", systemImage: "photo")
                                        .font(.subheadline)
                                }
                                .buttonStyle(.bordered)

                                if photoData != nil {
                                    Button(role: .destructive) {
                                        withAnimation {
                                            photoData = nil
                                            selectedPhotoItem = nil
                                        }
                                    } label: {
                                        Label("Supprimer", systemImage: "trash")
                                            .font(.subheadline)
                                    }
                                    .buttonStyle(.bordered)
                                }
                            }
                        }
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                } header: {
                    Text("Photo")
                }

                // Identité
                Section {
                    TextField("Prénom", text: $firstName)
                    TextField("Nom", text: $lastName)
                } header: {
                    Text("Identité")
                }

                // Rôle
                Section {
                    Picker("Rôle", selection: $selectedRoleId) {
                        ForEach(roles) { role in
                            Text(role.name).tag(role.id)
                        }
                    }
                } header: {
                    Text("Rôle")
                }

                // Contact
                Section {
                    HStack {
                        Image(systemName: "phone.fill")
                            .foregroundStyle(.green)
                            .frame(width: 24)
                        TextField("Téléphone", text: $phone)
                            .keyboardType(.phonePad)
                    }
                    HStack {
                        Image(systemName: "envelope.fill")
                            .foregroundStyle(.blue)
                            .frame(width: 24)
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                    }
                } header: {
                    Text("Contact")
                }

                // Catégories assignées
                if profileManager.profiles.count > 1 {
                    Section {
                        ForEach(profileManager.profiles) { profile in
                            Button {
                                if assignedProfileIds.contains(profile.id) {
                                    assignedProfileIds.remove(profile.id)
                                } else {
                                    assignedProfileIds.insert(profile.id)
                                }
                            } label: {
                                HStack {
                                    Circle()
                                        .fill(ProfileManager.color(for: profile.colorIndex))
                                        .frame(width: 10, height: 10)
                                    Text(profile.name)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    if assignedProfileIds.contains(profile.id) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(ProfileManager.color(for: profile.colorIndex))
                                    } else {
                                        Image(systemName: "circle")
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    } header: {
                        Text("Catégories")
                    } footer: {
                        Text("Sélectionnez les équipes encadrées par cette personne.")
                    }
                }
            }
            .navigationTitle(isEditing ? "Modifier" : "Nouvel encadrant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Enregistrer") {
                        let m = StaffMember(
                            id: member?.id ?? UUID(),
                            firstName: firstName,
                            lastName: lastName,
                            roleId: selectedRoleId,
                            phone: phone,
                            email: email,
                            photoData: photoData,
                            profileIds: assignedProfileIds
                        )
                        onSave(m)
                        dismiss()
                    }
                    .bold()
                    .disabled(firstName.isEmpty && lastName.isEmpty)
                }
            }
            .onAppear {
                // S'assurer que les rôles sont chargés (fix: après création de catégorie)
                if roles.isEmpty {
                    roles = StaffManager.shared.loadRoles()
                }
                if let m = member {
                    firstName = m.firstName
                    lastName = m.lastName
                    selectedRoleId = m.roleId
                    phone = m.phone
                    email = m.email
                    photoData = m.photoData
                    assignedProfileIds = m.profileIds
                } else {
                    // Par défaut: premier rôle, profil actif
                    selectedRoleId = roles.first?.id ?? UUID()
                    if let activeId = profileManager.activeProfileId {
                        assignedProfileIds = [activeId]
                    }
                }
            }
            .onChange(of: selectedPhotoItem) { _, newItem in
                Task {
                    if let newItem = newItem,
                       let data = try? await newItem.loadTransferable(type: Data.self),
                       let uiImage = UIImage(data: data) {
                        let maxSize: CGFloat = 400
                        let scale = min(maxSize / uiImage.size.width, maxSize / uiImage.size.height, 1.0)
                        let newSize = CGSize(width: uiImage.size.width * scale, height: uiImage.size.height * scale)

                        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
                        uiImage.draw(in: CGRect(origin: .zero, size: newSize))
                        let resizedImage = UIGraphicsGetImageFromCurrentImageContext()
                        UIGraphicsEndImageContext()

                        if let resizedImage = resizedImage,
                           let jpegData = resizedImage.jpegData(compressionQuality: 0.7) {
                            await MainActor.run {
                                photoData = jpegData
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Gestion des rôles

struct StaffRoleManagerView: View {
    @Binding var roles: [StaffRole]
    @State private var newRoleName = ""
    @State private var showDeleteAlert = false
    @State private var roleToDelete: StaffRole?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                // Rôles prédéfinis
                Section {
                    ForEach(roles.filter { !$0.isCustom }) { role in
                        HStack {
                            Image(systemName: "tag.fill")
                                .foregroundStyle(.blue)
                            Text(role.name)
                            Spacer()
                            Text("Prédéfini")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Rôles prédéfinis")
                }

                // Rôles personnalisés
                Section {
                    ForEach(roles.filter { $0.isCustom }) { role in
                        HStack {
                            Image(systemName: "tag.fill")
                                .foregroundStyle(.orange)
                            Text(role.name)
                            Spacer()
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                roleToDelete = role
                                showDeleteAlert = true
                            } label: {
                                Label("Supprimer", systemImage: "trash")
                            }
                        }
                    }

                    // Ajouter un rôle
                    HStack {
                        TextField("Nouveau rôle…", text: $newRoleName)
                        Button {
                            guard !newRoleName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                            let _ = StaffManager.shared.addCustomRole(name: newRoleName.trimmingCharacters(in: .whitespaces))
                            newRoleName = ""
                            roles = StaffManager.shared.loadRoles()
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .foregroundStyle(.green)
                        }
                        .disabled(newRoleName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                } header: {
                    Text("Rôles personnalisés")
                } footer: {
                    Text("Créez des rôles supplémentaires adaptés à votre organisation.")
                }
            }
            .navigationTitle("Rôles d'encadrement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Terminé") { dismiss() }
                }
            }
            .alert("Supprimer ce rôle ?", isPresented: $showDeleteAlert) {
                Button("Supprimer", role: .destructive) {
                    if let role = roleToDelete {
                        StaffManager.shared.deleteRole(role.id)
                        roles = StaffManager.shared.loadRoles()
                    }
                }
                Button("Annuler", role: .cancel) {}
            } message: {
                Text("Les encadrants associés à ce rôle ne seront pas supprimés mais apparaîtront dans la section « Autre ».")
            }
        }
    }
}

#Preview {
    NavigationStack {
        StaffManagementView()
    }
}
