//
//  ProfileManagementView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 15/02/2026.
//

import SwiftUI

/// Vue de gestion des profils d'équipe
struct ProfileManagementView: View {
    @ObservedObject var profileManager = ProfileManager.shared
    @State private var showNewProfile = false
    @State private var showDeleteConfirmation = false
    @State private var profileToDelete: TeamProfile?
    @State private var editingProfile: TeamProfile?
    @State private var showAssignSheet = false

    var body: some View {
        List {
            // Profils existants
            if profileManager.profiles.isEmpty {
                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "person.2.badge.gearshape")
                            .font(.system(size: 44))
                            .foregroundStyle(.secondary)
                        Text("Aucune catégorie")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                        Text("Créez un profil pour chaque catégorie que vous gérez.")
                            .font(.subheadline)
                            .foregroundStyle(.tertiary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .listRowBackground(Color.clear)
                }
            } else {
                Section {
                    ForEach(profileManager.profiles) { profile in
                        ProfileRow(
                            profile: profile,
                            isActive: profile.id == profileManager.activeProfileId,
                            onTap: {
                                profileManager.switchToProfile(profile.id)
                            },
                            onEdit: {
                                editingProfile = profile
                            }
                        )
                        .swipeActions(edge: .trailing) {
                            if profileManager.profiles.count > 1 {
                                Button(role: .destructive) {
                                    profileToDelete = profile
                                    showDeleteConfirmation = true
                                } label: {
                                    Label("Supprimer", systemImage: "trash")
                                }
                            }
                        }
                    }
                } header: {
                    Text("Mes catégories (\(profileManager.profiles.count))")
                } footer: {
                    Text("Touchez un profil pour le sélectionner. Chaque profil a ses propres matchs, entraînements et saison.")
                }
            }

            // Bouton ajout
            Section {
                Button {
                    showNewProfile = true
                } label: {
                    Label {
                        Text("Nouvelle catégorie")
                            .font(.subheadline.bold())
                    } icon: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(.green)
                    }
                }
            }

            // Gestion des joueurs dans le profil actif
            if let activeProfile = profileManager.activeProfile {
                PlayerAssignmentSection(profile: activeProfile, showAssignSheet: $showAssignSheet)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Catégories")
        .sheet(isPresented: $showNewProfile) {
            NewProfileSheet()
        }
        .sheet(item: $editingProfile) { profile in
            EditProfileSheet(profile: profile)
        }
        .sheet(isPresented: $showAssignSheet) {
            if let activeProfile = profileManager.activeProfile {
                PlayerAssignmentSheet(profile: activeProfile)
            }
        }
        .alert("Supprimer cette catégorie ?", isPresented: $showDeleteConfirmation) {
            Button("Supprimer", role: .destructive) {
                if let profile = profileToDelete {
                    profileManager.deleteProfile(profile.id)
                }
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text("Les matchs, entraînements et saison de cette catégorie seront supprimés. Les joueurs restent dans la base globale.")
        }
    }
}

// MARK: - Ligne profil

struct ProfileRow: View {
    let profile: TeamProfile
    let isActive: Bool
    let onTap: () -> Void
    let onEdit: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Icône colorée
                Circle()
                    .fill(ProfileManager.color(for: profile.colorIndex))
                    .frame(width: 36, height: 36)
                    .overlay(
                        Text(String(profile.name.prefix(1)).uppercased())
                            .font(.headline.bold())
                            .foregroundStyle(.white)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(profile.name)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                    HStack(spacing: 8) {
                        Text("\(profile.playerIds.count) joueurs")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if !profile.teamCode.isEmpty {
                            Text("Code: \(profile.teamCode)")
                                .font(.caption.bold())
                                .foregroundStyle(ProfileManager.color(for: profile.colorIndex))
                        }
                    }
                }

                Spacer()

                if isActive {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.title3)
                }

                Button {
                    onEdit()
                } label: {
                    Image(systemName: "pencil.circle")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(isActive ? ProfileManager.color(for: profile.colorIndex).opacity(0.08) : nil)
    }
}

// MARK: - Création profil

struct NewProfileSheet: View {
    @ObservedObject var profileManager = ProfileManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var colorIndex = 0
    @State private var copyPlayersFromProfile: UUID?
    @State private var teamCode = ""
    @State private var showCopiedAlert = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nom de la catégorie (ex: U13, Seniors)", text: $name)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Couleur")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 12) {
                            ForEach(0..<8) { idx in
                                Circle()
                                    .fill(ProfileManager.color(for: idx))
                                    .frame(width: 32, height: 32)
                                    .overlay(
                                        Circle()
                                            .stroke(colorIndex == idx ? Color.primary : Color.clear, lineWidth: 3)
                                    )
                                    .onTapGesture { colorIndex = idx }
                            }
                        }
                    }
                } header: {
                    Text("Nouvelle catégorie")
                }

                // Code équipe
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Êtes-vous l'entraîneur principal de cette catégorie ?")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        // Générer un code
                        Button {
                            teamCode = TeamProfile.generateCode()
                        } label: {
                            Label("Générer un code", systemImage: "wand.and.stars")
                        }

                        if !teamCode.isEmpty {
                            HStack {
                                Text(teamCode)
                                    .font(.title2.bold().monospaced())
                                    .foregroundStyle(ProfileManager.color(for: colorIndex))
                                Spacer()
                                Button {
                                    UIPasteboard.general.string = teamCode
                                    showCopiedAlert = true
                                } label: {
                                    Image(systemName: "doc.on.doc")
                                        .font(.caption)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Ou saisir le code de l'entraîneur principal :")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("Ex: A3K9F2", text: $teamCode)
                            .textInputAutocapitalization(.characters)
                            .font(.title3.monospaced())
                            .autocorrectionDisabled()
                    }
                } header: {
                    Text("Code catégorie")
                } footer: {
                    Text("L'entraîneur principal génère un code unique et le communique aux adjoints. Les adjoints saisissent ce même code pour que les échanges de composition fonctionnent automatiquement.")
                }

                // Option de copier des joueurs depuis un profil existant
                if !profileManager.profiles.isEmpty {
                    Section {
                        Picker("Copier les joueurs de", selection: $copyPlayersFromProfile) {
                            Text("Aucun").tag(UUID?.none)
                            ForEach(profileManager.profiles) { profile in
                                Text("\(profile.name) (\(profile.playerIds.count) joueurs)").tag(UUID?.some(profile.id))
                            }
                        }
                    } header: {
                        Text("Joueurs")
                    } footer: {
                        Text("Les joueurs copiés sont partagés — les modifications s'appliquent à toutes les catégories.")
                    }
                }
            }
            .navigationTitle("Nouvelle catégorie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        let playerIds: Set<UUID>
                        if let sourceId = copyPlayersFromProfile,
                           let source = profileManager.profiles.first(where: { $0.id == sourceId }) {
                            playerIds = source.playerIds
                        } else {
                            playerIds = []
                        }

                        let cleanCode = teamCode.trimmingCharacters(in: .whitespaces).uppercased()
                        let profile = profileManager.createProfile(
                            name: name.trimmingCharacters(in: .whitespaces),
                            colorIndex: colorIndex,
                            playerIds: playerIds,
                            teamCode: cleanCode
                        )
                        profileManager.switchToProfile(profile.id)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .alert("Code copié !", isPresented: $showCopiedAlert) {
                Button("OK") {}
            } message: {
                Text("Le code \(teamCode) a été copié dans le presse-papier.")
            }
        }
        .presentationDetents([.large])
    }
}

// MARK: - Édition profil

struct EditProfileSheet: View {
    @ObservedObject var profileManager = ProfileManager.shared
    @Environment(\.dismiss) private var dismiss
    let profile: TeamProfile
    @State private var name: String = ""
    @State private var colorIndex: Int = 0
    @State private var teamCode: String = ""
    @State private var showCopiedAlert = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nom", text: $name)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Couleur")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 12) {
                            ForEach(0..<8) { idx in
                                Circle()
                                    .fill(ProfileManager.color(for: idx))
                                    .frame(width: 32, height: 32)
                                    .overlay(
                                        Circle()
                                            .stroke(colorIndex == idx ? Color.primary : Color.clear, lineWidth: 3)
                                    )
                                    .onTapGesture { colorIndex = idx }
                            }
                        }
                    }
                }

                Section {
                    if !teamCode.isEmpty {
                        HStack {
                            Text("Code actuel")
                            Spacer()
                            Text(teamCode)
                                .font(.title3.bold().monospaced())
                                .foregroundStyle(ProfileManager.color(for: colorIndex))
                            Button {
                                UIPasteboard.general.string = teamCode
                                showCopiedAlert = true
                            } label: {
                                Image(systemName: "doc.on.doc")
                                    .font(.caption)
                            }
                            .buttonStyle(.plain)
                        }
                    } else {
                        Text("Aucun code défini")
                            .foregroundStyle(.secondary)
                    }

                    Button {
                        teamCode = TeamProfile.generateCode()
                    } label: {
                        Label("Générer un nouveau code", systemImage: "wand.and.stars")
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Ou saisir le code de l'entraîneur principal :")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("Ex: A3K9F2", text: $teamCode)
                            .textInputAutocapitalization(.characters)
                            .font(.title3.monospaced())
                            .autocorrectionDisabled()
                    }
                } header: {
                    Text("Code catégorie")
                } footer: {
                    Text("L'entraîneur principal génère un code et le communique aux adjoints. Les adjoints saisissent ce même code pour que les imports arrivent automatiquement sur la bonne catégorie.")
                }
            }
            .navigationTitle("Modifier la catégorie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") {
                        var updated = profile
                        updated.name = name.trimmingCharacters(in: .whitespaces)
                        updated.colorIndex = colorIndex
                        updated.teamCode = teamCode.trimmingCharacters(in: .whitespaces).uppercased()
                        profileManager.updateProfile(updated)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                name = profile.name
                colorIndex = profile.colorIndex
                teamCode = profile.teamCode
            }
            .alert("Code copié !", isPresented: $showCopiedAlert) {
                Button("OK") {}
            } message: {
                Text("Le code \(teamCode) a été copié dans le presse-papier.")
            }
        }
        .presentationDetents([.large])
    }
}

// MARK: - Section assignation joueurs au profil

struct PlayerAssignmentSection: View {
    let profile: TeamProfile
    @Binding var showAssignSheet: Bool

    var body: some View {
        Section {
            Button {
                showAssignSheet = true
            } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Gérer les joueurs de \(profile.name)")
                            .font(.subheadline)
                        Text("\(profile.playerIds.count) joueurs assignés")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "person.badge.plus")
                        .foregroundStyle(ProfileManager.color(for: profile.colorIndex))
                }
            }
        } header: {
            Text("Joueurs de la catégorie active")
        } footer: {
            Text("Ajoutez ou retirez des joueurs de la base globale pour cette catégorie.")
        }
    }
}

// MARK: - Sheet d'assignation joueurs

// MARK: - Ligne joueur (vue isolée — couleur immuable)

struct AssignmentPlayerRow: View {
    let player: Player
    let isSelected: Bool
    let checkColor: Color
    let nameColor: Color
    let showBadge: Bool
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isSelected ? (showBadge ? nameColor : checkColor) : .secondary)
                .font(.title3)

            VStack(alignment: .leading, spacing: 2) {
                Text(player.fullName)
                    .font(.subheadline)
                    .foregroundStyle(nameColor)
                Text(player.position.rawValue)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if showBadge {
                Circle()
                    .fill(nameColor)
                    .frame(width: 8, height: 8)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}

// MARK: - Sheet d'assignation joueurs

struct PlayerAssignmentSheet: View {
    @Environment(\.dismiss) private var dismiss
    let profile: TeamProfile
    @State private var allPlayers: [Player]
    @State private var assignedIds: Set<UUID>
    @State private var searchText = ""
    // Couleurs figées dès l'init via @State — SwiftUI les préserve pour toujours
    @State private var playerColor: [UUID: Color]
    @State private var playerIsOtherCategory: [UUID: Bool]
    /// Catégorie d'appartenance de chaque joueur (nom + colorIndex) pour le regroupement
    @State private var playerCategoryName: [UUID: String]
    @State private var playerCategoryColorIndex: [UUID: Int]
    /// Ordre des catégories pour l'affichage
    @State private var categoryOrder: [(id: UUID, name: String, colorIndex: Int)]

    init(profile: TeamProfile) {
        self.profile = profile
        let players = TeamManager.shared.loadAllPlayers()
        let profiles = ProfileManager.shared.profiles
        var colors: [UUID: Color] = [:]
        var badges: [UUID: Bool] = [:]
        var catNames: [UUID: String] = [:]
        var catColors: [UUID: Int] = [:]
        for player in players {
            // Utiliser homeCategoryId pour déterminer la catégorie d'origine
            let homeProfile: TeamProfile?
            if let homeId = player.homeCategoryId,
               let hp = profiles.first(where: { $0.id == homeId }) {
                homeProfile = hp
            } else {
                // Fallback : première catégorie contenant le joueur
                homeProfile = profiles.first(where: { $0.playerIds.contains(player.id) })
            }
            if let p = homeProfile {
                colors[player.id] = ProfileManager.color(for: p.colorIndex)
                badges[player.id] = (p.id != profile.id)
                catNames[player.id] = p.name
                catColors[player.id] = p.colorIndex
            }
        }
        // Ordre : profil édité en premier, puis les autres dans l'ordre de la liste, puis "Sans catégorie"
        var order: [(id: UUID, name: String, colorIndex: Int)] = []
        order.append((id: profile.id, name: profile.name, colorIndex: profile.colorIndex))
        for p in profiles where p.id != profile.id {
            order.append((id: p.id, name: p.name, colorIndex: p.colorIndex))
        }
        order.append((id: UUID(), name: "Sans catégorie", colorIndex: -1))

        self._allPlayers = State(initialValue: players)
        self._assignedIds = State(initialValue: profile.playerIds)
        self._playerColor = State(initialValue: colors)
        self._playerIsOtherCategory = State(initialValue: badges)
        self._playerCategoryName = State(initialValue: catNames)
        self._playerCategoryColorIndex = State(initialValue: catColors)
        self._categoryOrder = State(initialValue: order)
    }

    private var filteredPlayers: [Player] {
        let sorted = allPlayers.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
        if searchText.isEmpty { return sorted }
        return sorted.filter { $0.fullName.localizedCaseInsensitiveContains(searchText) }
    }

    /// Joueurs groupés par catégorie, chaque groupe trié alphabétiquement
    private func playersForCategory(_ catId: UUID) -> [Player] {
        let isNoCat = !ProfileManager.shared.profiles.contains(where: { $0.id == catId })
        return filteredPlayers.filter { player in
            if isNoCat {
                return playerCategoryName[player.id] == nil
            } else {
                guard let catName = playerCategoryName[player.id] else { return false }
                let matchingCategory = categoryOrder.first(where: { $0.id == catId })
                return catName == matchingCategory?.name
            }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Text("Joueurs assignés")
                        Spacer()
                        Text("\(assignedIds.count) / \(allPlayers.count)")
                            .foregroundStyle(.secondary)
                    }
                }

                ForEach(Array(categoryOrder.enumerated()), id: \.offset) { _, cat in
                    let catPlayers = playersForCategory(cat.id)
                    if !catPlayers.isEmpty {
                        Section {
                            ForEach(catPlayers) { player in
                                AssignmentPlayerRow(
                                    player: player,
                                    isSelected: assignedIds.contains(player.id),
                                    checkColor: ProfileManager.color(for: profile.colorIndex),
                                    nameColor: playerColor[player.id] ?? .primary,
                                    showBadge: playerIsOtherCategory[player.id] ?? false,
                                    onTap: {
                                        if assignedIds.contains(player.id) {
                                            assignedIds.remove(player.id)
                                        } else {
                                            assignedIds.insert(player.id)
                                        }
                                    }
                                )
                            }
                        } header: {
                            HStack(spacing: 6) {
                                if cat.colorIndex >= 0 {
                                    Circle()
                                        .fill(ProfileManager.color(for: cat.colorIndex))
                                        .frame(width: 10, height: 10)
                                }
                                Text("\(cat.name) (\(catPlayers.count))")
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Joueurs — \(profile.name)")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, prompt: "Rechercher")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") {
                        var updated = profile
                        updated.playerIds = assignedIds
                        ProfileManager.shared.updateProfile(updated)
                        dismiss()
                    }
                }
                ToolbarItem(placement: .bottomBar) {
                    HStack {
                        Button("Tout sélectionner") {
                            assignedIds = Set(allPlayers.map { $0.id })
                        }
                        Spacer()
                        Button("Tout désélectionner") {
                            assignedIds.removeAll()
                        }
                    }
                    .font(.caption)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        ProfileManagementView()
    }
}
