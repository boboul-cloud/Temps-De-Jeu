//
//  MatchRosterView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

/// Vue de sélection des joueurs pour un match donné
struct MatchRosterView: View {
    @Environment(\.dismiss) private var dismiss

    /// Liste persistante de l'effectif
    let allPlayers: [Player]
    /// Roster déjà sélectionné (pour édition)
    let existingRoster: [MatchPlayer]
    /// IDs des joueurs indisponibles (déjà sélectionnés par une équipe supérieure)
    let unavailablePlayerIds: Set<UUID>
    /// IDs des joueurs sélectionnés dans une autre catégorie → nom de la catégorie
    let selectedInOtherCategoryIds: [UUID: String]
    /// Callback avec le roster validé
    let onConfirm: ([MatchPlayer]) -> Void

    /// Joueurs sélectionnés pour le match, indexés par Player.id
    @State private var selectedPlayers: [UUID: MatchPlayer] = [:]
    @State private var searchText = ""

    init(allPlayers: [Player], existingRoster: [MatchPlayer] = [], unavailablePlayerIds: Set<UUID> = [], selectedInOtherCategoryIds: [UUID: String] = [:], onConfirm: @escaping ([MatchPlayer]) -> Void) {
        self.allPlayers = allPlayers
        self.existingRoster = existingRoster
        self.unavailablePlayerIds = unavailablePlayerIds
        self.selectedInOtherCategoryIds = selectedInOtherCategoryIds
        self.onConfirm = onConfirm
    }

    /// Joueurs disponibles (excluant les indisponibles cascade ET les blessés/absents/suspendus)
    private var availablePlayers: [Player] {
        allPlayers.filter { !unavailablePlayerIds.contains($0.id) && !selectedInOtherCategoryIds.keys.contains($0.id) && $0.availability == .disponible }
    }

    private var filteredPlayers: [Player] {
        let sorted = availablePlayers.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
        if searchText.isEmpty { return sorted }
        return sorted.filter {
            $0.fullName.localizedCaseInsensitiveContains(searchText)
        }
    }

    /// Joueurs indisponibles (pris par équipe supérieure)
    private var unavailablePlayers: [Player] {
        allPlayers.filter { unavailablePlayerIds.contains($0.id) }
            .sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
    }

    /// Joueurs sélectionnés dans une autre catégorie
    private var otherCategoryPlayers: [Player] {
        allPlayers.filter { selectedInOtherCategoryIds.keys.contains($0.id) && !unavailablePlayerIds.contains($0.id) }
            .sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
    }

    /// Joueurs blessés / absents / suspendus
    private var absentPlayers: [Player] {
        allPlayers.filter { $0.availability != .disponible && !unavailablePlayerIds.contains($0.id) && !selectedInOtherCategoryIds.keys.contains($0.id) }
            .sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
    }

    private var titulairesCount: Int {
        selectedPlayers.values.filter { $0.status == .titulaire }.count
    }

    private var remplacantsCount: Int {
        selectedPlayers.values.filter { $0.status == .remplacant }.count
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Résumé sélection
                HStack(spacing: 20) {
                    SelectionBadge(label: "Sélectionnés", value: "\(selectedPlayers.count)", color: .blue)
                    SelectionBadge(label: "Titulaires", value: "\(titulairesCount)", color: .green)
                    SelectionBadge(label: "Remplaçants", value: "\(remplacantsCount)", color: .orange)
                }
                .padding()
                .background(Color(.systemGray6))

                if allPlayers.isEmpty {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "person.3.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("Aucun joueur dans l'effectif")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                        Text("Ajoutez des joueurs dans l'onglet\n\"Joueurs\" avant de composer le match.")
                            .font(.subheadline)
                            .foregroundStyle(.tertiary)
                            .multilineTextAlignment(.center)
                    }
                    Spacer()
                } else {
                    List {
                        // Boutons de sélection rapide
                        Section {
                            HStack(spacing: 12) {
                                Button {
                                    selectAll()
                                } label: {
                                    Text("Tout sélect.")
                                        .font(.caption.bold())
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .background(Color.blue.opacity(0.15))
                                        .foregroundStyle(.blue)
                                        .cornerRadius(8)
                                }
                                .buttonStyle(.borderless)

                                Button {
                                    deselectAll()
                                } label: {
                                    Text("Tout désélect.")
                                        .font(.caption.bold())
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .background(Color.red.opacity(0.15))
                                        .foregroundStyle(.red)
                                        .cornerRadius(8)
                                }
                                .buttonStyle(.borderless)
                            }
                            .listRowBackground(Color.clear)
                        }

                        // Liste des joueurs disponibles
                        Section {
                            ForEach(filteredPlayers) { player in
                                MatchPlayerSelectionRow(
                                    player: player,
                                    matchPlayer: selectedPlayers[player.id],
                                    isSelected: selectedPlayers[player.id] != nil,
                                    onToggle: { toggleSelection(player) },
                                    onStatusChange: { status in changeStatus(player, to: status) },
                                    onNumberChange: { number in changeNumber(player, to: number) }
                                )
                            }
                        } header: {
                            if !unavailablePlayerIds.isEmpty || !selectedInOtherCategoryIds.isEmpty {
                                Text("Joueurs disponibles (\(availablePlayers.count))")
                            }
                        }

                        // Liste des joueurs sélectionnés dans une autre catégorie
                        if !otherCategoryPlayers.isEmpty {
                            Section {
                                ForEach(otherCategoryPlayers) { player in
                                    HStack(spacing: 12) {
                                        Image(systemName: "person.crop.circle.badge.exclamationmark.fill")
                                            .font(.title2)
                                            .foregroundStyle(.indigo.opacity(0.6))

                                        PlayerAvatar(player: player, size: 36, showPositionColor: false)
                                            .opacity(0.6)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(player.fullName.isEmpty ? "Joueur" : player.fullName)
                                                .font(.subheadline)
                                                .foregroundStyle(.secondary)
                                                .strikethrough()
                                            Text(player.position.rawValue)
                                                .font(.caption)
                                                .foregroundStyle(.tertiary)
                                        }

                                        Spacer()

                                        Text(selectedInOtherCategoryIds[player.id] ?? "Autre catégorie")
                                            .font(.caption2.bold())
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(Color.indigo.opacity(0.12))
                                            .foregroundStyle(.indigo)
                                            .cornerRadius(8)
                                    }
                                    .padding(.vertical, 2)
                                }
                            } header: {
                                HStack {
                                    Image(systemName: "person.2.slash.fill")
                                        .foregroundStyle(.indigo)
                                    Text("Sélectionnés dans une autre catégorie (\(otherCategoryPlayers.count))")
                                }
                            }
                        }

                        // Liste des joueurs indisponibles (pris par équipe supérieure)
                        if !unavailablePlayers.isEmpty {
                            Section {
                                ForEach(unavailablePlayers) { player in
                                    HStack(spacing: 12) {
                                        if player.availability != .disponible {
                                            ZStack(alignment: .bottomTrailing) {
                                                Image(systemName: "xmark.circle.fill")
                                                    .font(.title2)
                                                    .foregroundStyle(colorForAvailability(player.availability).opacity(0.5))

                                                Image(systemName: player.availability.icon)
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundStyle(.white)
                                                    .padding(2)
                                                    .background(colorForAvailability(player.availability))
                                                    .clipShape(Circle())
                                                    .offset(x: 4, y: 4)
                                            }
                                        } else {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.title2)
                                                .foregroundStyle(.red.opacity(0.5))
                                        }

                                        PlayerAvatar(player: player, size: 36, showPositionColor: false)
                                            .opacity(0.6)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(player.fullName.isEmpty ? "Joueur" : player.fullName)
                                                .font(.subheadline)
                                                .foregroundStyle(.secondary)
                                                .strikethrough()
                                            Text(player.position.rawValue)
                                                .font(.caption)
                                                .foregroundStyle(.tertiary)
                                        }

                                        Spacer()

                                        if player.availability != .disponible {
                                            Text(player.availability.rawValue)
                                                .font(.caption2.bold())
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 4)
                                                .background(colorForAvailability(player.availability).opacity(0.12))
                                                .foregroundStyle(colorForAvailability(player.availability))
                                                .cornerRadius(8)
                                        } else {
                                            Text("Indisponible")
                                                .font(.caption2.bold())
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 4)
                                                .background(Color.red.opacity(0.1))
                                                .foregroundStyle(.red)
                                                .cornerRadius(8)
                                        }
                                    }
                                    .padding(.vertical, 2)
                                }
                            } header: {
                                Text("Indisponibles — catégorie supérieure (\(unavailablePlayers.count))")
                            }
                        }

                        // Liste des joueurs blessés / absents / suspendus
                        if !absentPlayers.isEmpty {
                            Section {
                                ForEach(absentPlayers) { player in
                                    HStack(spacing: 12) {
                                        ZStack(alignment: .bottomTrailing) {
                                            PlayerAvatar(player: player, size: 36, showPositionColor: false)
                                                .opacity(0.6)
                                            
                                            Image(systemName: player.availability.icon)
                                                .font(.system(size: 12, weight: .bold))
                                                .foregroundStyle(.white)
                                                .padding(3)
                                                .background(colorForAvailability(player.availability))
                                                .clipShape(Circle())
                                                .offset(x: 4, y: 4)
                                        }

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(player.fullName.isEmpty ? "Joueur" : player.fullName)
                                                .font(.subheadline)
                                                .foregroundStyle(.secondary)
                                                .strikethrough()
                                            Text(player.position.rawValue)
                                                .font(.caption)
                                                .foregroundStyle(.tertiary)
                                        }

                                        Spacer()

                                        Text(player.availability.rawValue)
                                            .font(.caption2.bold())
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(colorForAvailability(player.availability).opacity(0.12))
                                            .foregroundStyle(colorForAvailability(player.availability))
                                            .cornerRadius(8)
                                    }
                                    .padding(.vertical, 2)
                                }
                            } header: {
                                HStack {
                                    Image(systemName: "person.slash.fill")
                                        .foregroundStyle(.orange)
                                    Text("Blessés / Absents / Suspendus (\(absentPlayers.count))")
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .searchable(text: $searchText, prompt: "Rechercher un joueur")
                }
            }
            .navigationTitle("Composition")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Valider") {
                        onConfirm(Array(selectedPlayers.values))
                        dismiss()
                    }
                    .bold()
                    .disabled(selectedPlayers.isEmpty)
                }
            }
            .onAppear {
                // Restaurer la sélection existante
                for mp in existingRoster {
                    selectedPlayers[mp.id] = mp
                }
            }
        }
    }

    // MARK: - Actions

    private func toggleSelection(_ player: Player) {
        if selectedPlayers[player.id] != nil {
            selectedPlayers.removeValue(forKey: player.id)
            // Re-numéroter les joueurs restants
            renumberPlayers()
        } else {
            let nextNumber = (selectedPlayers.values.map { $0.shirtNumber }.max() ?? 0) + 1
            let mp = MatchPlayer(from: player, status: titulairesCount < 11 ? .titulaire : .remplacant, shirtNumber: nextNumber)
            selectedPlayers[player.id] = mp
        }
    }

    private func changeStatus(_ player: Player, to status: PlayerStatus) {
        if var mp = selectedPlayers[player.id] {
            mp.status = status
            selectedPlayers[player.id] = mp
        }
    }

    private func changeNumber(_ player: Player, to number: Int) {
        if var mp = selectedPlayers[player.id] {
            mp.shirtNumber = number
            selectedPlayers[player.id] = mp
        }
    }

    private func selectAll() {
        var nextNumber = 1
        // D'abord garder les existants
        for mp in selectedPlayers.values {
            if mp.shirtNumber >= nextNumber {
                nextNumber = mp.shirtNumber + 1
            }
        }
        // Ne sélectionner que les joueurs disponibles (pas les indisponibles)
        for player in availablePlayers {
            if selectedPlayers[player.id] == nil {
                let mp = MatchPlayer(from: player, status: titulairesCount < 11 ? .titulaire : .remplacant, shirtNumber: nextNumber)
                selectedPlayers[player.id] = mp
                nextNumber += 1
            }
        }
    }

    private func deselectAll() {
        selectedPlayers.removeAll()
    }

    /// Re-numéroter séquentiellement (1, 2, 3...) après suppression
    private func renumberPlayers() {
        let sorted = selectedPlayers.values.sorted { $0.shirtNumber < $1.shirtNumber }
        for (index, mp) in sorted.enumerated() {
            var updated = mp
            updated.shirtNumber = index + 1
            selectedPlayers[mp.id] = updated
        }
    }

    private func colorForAvailability(_ availability: PlayerAvailability) -> Color {
        switch availability {
        case .disponible: return .green
        case .blesse: return .red
        case .absent: return .orange
        case .suspendu: return .purple
        }
    }
}

// MARK: - Ligne de sélection joueur

struct MatchPlayerSelectionRow: View {
    let player: Player
    let matchPlayer: MatchPlayer?
    let isSelected: Bool
    let onToggle: () -> Void
    let onStatusChange: (PlayerStatus) -> Void
    let onNumberChange: (Int) -> Void

    @State private var editingNumber = false
    @State private var numberText = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Checkbox
                Button(action: onToggle) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(isSelected ? .green : .gray)
                }
                .buttonStyle(.plain)

                // Avatar du joueur avec numéro en overlay si sélectionné
                Button {
                    if isSelected {
                        numberText = "\(matchPlayer?.shirtNumber ?? 0)"
                        editingNumber.toggle()
                    }
                } label: {
                    ZStack(alignment: .bottomTrailing) {
                        PlayerAvatar(player: player, size: 40)
                            .opacity(isSelected ? 1.0 : 0.7)
                        
                        // Badge numéro si sélectionné
                        if isSelected, let mp = matchPlayer {
                            Text("\(mp.shirtNumber)")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                                .frame(width: 20, height: 20)
                                .background(positionColor)
                                .clipShape(Circle())
                                .overlay(
                                    Circle()
                                        .stroke(Color(.systemBackground), lineWidth: 2)
                                )
                                .offset(x: 4, y: 4)
                        }
                    }
                }
                .buttonStyle(.plain)

                // Nom + position
                VStack(alignment: .leading, spacing: 2) {
                    Text(player.fullName.isEmpty ? "Joueur" : player.fullName)
                        .font(.subheadline.bold())
                        .foregroundStyle(isSelected ? .primary : .secondary)
                    Text(player.position.rawValue)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Statut titulaire/remplaçant (si sélectionné)
                if isSelected, let mp = matchPlayer {
                    Menu {
                        Button {
                            onStatusChange(.titulaire)
                        } label: {
                            Label("Titulaire", systemImage: mp.status == .titulaire ? "checkmark" : "")
                        }
                        Button {
                            onStatusChange(.remplacant)
                        } label: {
                            Label("Remplaçant", systemImage: mp.status == .remplacant ? "checkmark" : "")
                        }
                    } label: {
                        Text(mp.status.rawValue)
                            .font(.caption2.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(mp.status == .titulaire ? Color.green.opacity(0.15) : Color.orange.opacity(0.15))
                            .foregroundStyle(mp.status == .titulaire ? .green : .orange)
                            .cornerRadius(8)
                    }
                }
            }
            .padding(.vertical, 4)

            // Champ de modification du numéro
            if editingNumber && isSelected {
                HStack {
                    Text("N° maillot pour ce match :")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("N°", text: $numberText)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 60)
                    Button("OK") {
                        if let num = Int(numberText) {
                            onNumberChange(num)
                        }
                        editingNumber = false
                    }
                    .font(.caption.bold())
                }
                .padding(.leading, 52)
                .padding(.bottom, 4)
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: editingNumber)
    }

    private var positionColor: Color {
        switch player.position {
        case .gardien: return .orange
        case .defenseur: return .blue
        case .milieu: return .green
        case .attaquant: return .red
        }
    }
}

// MARK: - Badge sélection

struct SelectionBadge: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2.bold())
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    MatchRosterView(
        allPlayers: [
            Player(firstName: "Hugo", lastName: "Lloris", position: .gardien),
            Player(firstName: "Jules", lastName: "Koundé", position: .defenseur),
            Player(firstName: "Antoine", lastName: "Griezmann", position: .attaquant),
        ]
    ) { roster in
        print(roster)
    }
}
