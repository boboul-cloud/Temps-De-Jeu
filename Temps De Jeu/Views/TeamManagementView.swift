//
//  TeamManagementView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

/// Vue de gestion de l'effectif permanent de l'équipe
struct TeamManagementView: View {
    @State private var players: [Player] = []
    @State private var showAddPlayer = false
    @State private var editingPlayer: Player?
    @State private var searchText = ""
    @State private var allCards: [CardEvent] = []  // Cartons de tous les matchs

    var filteredPlayers: [Player] {
        let sorted = players.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
        if searchText.isEmpty { return sorted }
        return sorted.filter {
            $0.fullName.localizedCaseInsensitiveContains(searchText)
        }
    }

    /// Joueurs regroupés par position (seulement disponibles)
    var gardiens: [Player] { filteredPlayers.filter { $0.position == .gardien && $0.availability == .disponible } }
    var defenseurs: [Player] { filteredPlayers.filter { $0.position == .defenseur && $0.availability == .disponible } }
    var milieux: [Player] { filteredPlayers.filter { $0.position == .milieu && $0.availability == .disponible } }
    var attaquants: [Player] { filteredPlayers.filter { $0.position == .attaquant && $0.availability == .disponible } }

    /// Joueurs indisponibles (blessés, absents, suspendus)
    var unavailablePlayers: [Player] {
        filteredPlayers.filter { $0.availability != .disponible }
    }

    var body: some View {
        NavigationStack {
            Group {
                if players.isEmpty {
                    emptyState
                } else {
                    playerList
                }
            }
            .navigationTitle("Mes Joueurs")
            .searchable(text: $searchText, prompt: "Rechercher un joueur")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddPlayer = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showAddPlayer) {
                PlayerEditView(player: nil) { newPlayer in
                    players.append(newPlayer)
                    save()
                }
            }
            .sheet(item: $editingPlayer) { player in
                PlayerEditView(player: player) { updated in
                    if let idx = players.firstIndex(where: { $0.id == updated.id }) {
                        players[idx] = updated
                    }
                    save()
                }
            }
            .onAppear {
                players = TeamManager.shared.loadPlayers()
                // Charger tous les cartons de l'historique
                let matches = DataManager.shared.loadMatches()
                allCards = matches.flatMap { $0.cards }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.3.fill")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("Aucun joueur")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Ajoutez votre effectif.\nVous pourrez les sélectionner\navant chaque match.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)

            Button {
                showAddPlayer = true
            } label: {
                HStack {
                    Image(systemName: "plus")
                    Text("Ajouter un joueur")
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .background(Color.green)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
        }
    }

    private var playerList: some View {
        List {
            // Résumé
            Section {
                HStack(spacing: 20) {
                    TeamStatBadge(label: "Effectif", value: "\(players.count)", color: .blue)
                    TeamStatBadge(label: "Gardiens", value: "\(gardiens.count)", color: .orange)
                    TeamStatBadge(label: "Joueurs", value: "\(defenseurs.count + milieux.count + attaquants.count)", color: .green)
                }
                .listRowBackground(Color.clear)
            }

            // Par position
            positionSection(title: "Gardiens", icon: "hand.raised.fill", color: .orange, players: gardiens)
            positionSection(title: "Défenseurs", icon: "shield.fill", color: .blue, players: defenseurs)
            positionSection(title: "Milieux", icon: "arrow.left.arrow.right", color: .green, players: milieux)
            positionSection(title: "Attaquants", icon: "flame.fill", color: .red, players: attaquants)

            // Section joueurs indisponibles
            if !unavailablePlayers.isEmpty {
                Section {
                    ForEach(unavailablePlayers) { player in
                        UnavailablePlayerRow(player: player, cards: cardsForPlayer(player))
                            .onTapGesture { editingPlayer = player }
                            .swipeActions(edge: .leading) {
                                Button {
                                    setAvailability(player, to: .disponible)
                                } label: {
                                    Label("Disponible", systemImage: "checkmark.circle.fill")
                                }
                                .tint(.green)
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    deletePlayer(player)
                                } label: {
                                    Label("Supprimer", systemImage: "trash")
                                }
                            }
                    }
                } header: {
                    HStack {
                        Image(systemName: "person.slash.fill")
                            .foregroundStyle(.red)
                        Text("Indisponibles (\(unavailablePlayers.count))")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    @ViewBuilder
    private func positionSection(title: String, icon: String, color: Color, players: [Player]) -> some View {
        if !players.isEmpty {
            Section {
                ForEach(players) { player in
                    PlayerRow(player: player, cards: cardsForPlayer(player))
                        .onTapGesture { editingPlayer = player }
                        .swipeActions(edge: .leading) {
                            Button {
                                setAvailability(player, to: .blesse)
                            } label: {
                                Label("Blessé", systemImage: "cross.case.fill")
                            }
                            .tint(.red)

                            Button {
                                setAvailability(player, to: .absent)
                            } label: {
                                Label("Absent", systemImage: "person.slash.fill")
                            }
                            .tint(.orange)

                            Button {
                                setAvailability(player, to: .suspendu)
                            } label: {
                                Label("Suspendu", systemImage: "exclamationmark.shield.fill")
                            }
                            .tint(.purple)
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                deletePlayer(player)
                            } label: {
                                Label("Supprimer", systemImage: "trash")
                            }
                        }
                }
            } header: {
                HStack {
                    Image(systemName: icon)
                        .foregroundStyle(color)
                    Text("\(title) (\(players.count))")
                }
            }
        }
    }

    private func cardsForPlayer(_ player: Player) -> [CardEvent] {
        allCards.filter { $0.playerId == player.id }
    }

    private func deletePlayer(_ player: Player) {
        players.removeAll { $0.id == player.id }
        save()
    }

    private func setAvailability(_ player: Player, to availability: PlayerAvailability) {
        if let idx = players.firstIndex(where: { $0.id == player.id }) {
            players[idx].availability = availability
            save()
        }
    }

    private func save() {
        TeamManager.shared.savePlayers(players)
    }
}

// MARK: - Ligne joueur

struct PlayerRow: View {
    let player: Player
    var cards: [CardEvent] = []

    private var yellowCount: Int { cards.filter { $0.type == .yellow }.count }
    private var secondYellowCount: Int { cards.filter { $0.type == .secondYellow }.count }
    private var redCount: Int { cards.filter { $0.type == .red }.count }
    private var whiteCount: Int { cards.filter { $0.type == .white }.count }
    private var totalCards: Int { yellowCount + secondYellowCount + redCount + whiteCount }

    var body: some View {
        HStack(spacing: 12) {
            // Initiale dans un cercle coloré
            Text(String(player.firstName.prefix(1)).uppercased())
                .font(.system(.headline, design: .rounded))
                .foregroundColor(.white)
                .frame(width: 36, height: 36)
                .background(positionColor)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(player.fullName.isEmpty ? "Joueur" : player.fullName)
                    .font(.subheadline.bold())
                Text(player.position.rawValue)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Badges cartons
            if totalCards > 0 {
                HStack(spacing: 4) {
                    if yellowCount > 0 {
                        CardBadge(count: yellowCount, color: .yellow)
                    }
                    if secondYellowCount > 0 {
                        CardBadge(count: secondYellowCount, color: .orange)
                    }
                    if redCount > 0 {
                        CardBadge(count: redCount, color: .red)
                    }
                    if whiteCount > 0 {
                        CardBadge(count: whiteCount, color: .gray)
                    }
                }
            }

            Text(player.position.shortName)
                .font(.caption2.bold())
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(positionColor.opacity(0.15))
                .foregroundStyle(positionColor)
                .cornerRadius(8)
        }
        .padding(.vertical, 2)
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

// MARK: - Badge stat équipe

struct TeamStatBadge: View {
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

// MARK: - Badge carton compact

struct CardBadge: View {
    let count: Int
    let color: Color

    var body: some View {
        HStack(spacing: 2) {
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 10, height: 14)
            if count > 1 {
                Text("×\(count)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Édition de joueur

struct PlayerEditView: View {
    let player: Player?
    let onSave: (Player) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var position: PlayerPosition = .milieu
    @State private var availability: PlayerAvailability = .disponible

    var isEditing: Bool { player != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Prénom", text: $firstName)
                    TextField("Nom", text: $lastName)
                } header: {
                    Text("Identité")
                }

                Section {
                    Picker("Position", selection: $position) {
                        ForEach(PlayerPosition.allCases) { pos in
                            Text(pos.rawValue).tag(pos)
                        }
                    }
                } header: {
                    Text("Position")
                }

                Section {
                    Picker("Disponibilité", selection: $availability) {
                        ForEach(PlayerAvailability.allCases) { avail in
                            Label(avail.rawValue, systemImage: avail.icon)
                                .tag(avail)
                        }
                    }
                } header: {
                    Text("Disponibilité")
                }
            }
            .navigationTitle(isEditing ? "Modifier" : "Nouveau joueur")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Enregistrer") {
                        let p = Player(
                            id: player?.id ?? UUID(),
                            firstName: firstName,
                            lastName: lastName,
                            position: position,
                            availability: availability
                        )
                        onSave(p)
                        dismiss()
                    }
                    .bold()
                    .disabled(firstName.isEmpty && lastName.isEmpty)
                }
            }
            .onAppear {
                if let p = player {
                    firstName = p.firstName
                    lastName = p.lastName
                    position = p.position
                    availability = p.availability
                }
            }
        }
    }
}

// MARK: - Ligne joueur indisponible

struct UnavailablePlayerRow: View {
    let player: Player
    var cards: [CardEvent] = []

    var body: some View {
        HStack(spacing: 12) {
            // Icône de statut
            Image(systemName: player.availability.icon)
                .font(.title2)
                .foregroundStyle(availabilityColor)

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
                .background(availabilityColor.opacity(0.12))
                .foregroundStyle(availabilityColor)
                .cornerRadius(8)
        }
        .padding(.vertical, 2)
    }

    private var availabilityColor: Color {
        switch player.availability {
        case .disponible: return .green
        case .blesse: return .red
        case .absent: return .orange
        case .suspendu: return .purple
        }
    }
}

#Preview {
    TeamManagementView()
}
