//
//  CardsManagementView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

/// Carton enrichi avec info adversaire
struct EnrichedCard: Identifiable {
    let card: CardEvent
    let opponentName: String?
    var id: UUID { card.id }
}

/// Vue dédiée à la gestion et consultation des cartons
struct CardsManagementView: View {
    @State private var players: [Player] = []
    @State private var allCards: [EnrichedCard] = []
    @State private var searchText = ""
    @State private var filterType: CardFilterType = .all

    enum CardFilterType: String, CaseIterable {
        case all = "Tous"
        case yellow = "Jaunes"
        case red = "Rouges"
        case white = "Blancs"
    }

    private var filteredCards: [EnrichedCard] {
        // Exclure les cartons purgés de l'historique actif
        var cards = allCards.filter { !$0.card.isServed }
        // Filtrer par type
        switch filterType {
        case .yellow:
            cards = cards.filter { $0.card.type == .yellow || $0.card.type == .secondYellow }
        case .red:
            cards = cards.filter { $0.card.type == .red || $0.card.type == .secondYellow }
        case .white:
            cards = cards.filter { $0.card.type == .white }
        case .all:
            break
        }
        // Tri par date (plus récent d'abord)
        cards.sort { ($0.card.matchDate ?? $0.card.timestamp) > ($1.card.matchDate ?? $1.card.timestamp) }
        // Filtre recherche
        if !searchText.isEmpty {
            cards = cards.filter {
                $0.card.playerName.localizedCaseInsensitiveContains(searchText) ||
                ($0.card.matchLabel ?? "").localizedCaseInsensitiveContains(searchText) ||
                ($0.opponentName ?? "").localizedCaseInsensitiveContains(searchText)
            }
        }
        return cards
    }

    /// Cartons actifs (non purgés) pour l'affichage
    private var activeCards: [EnrichedCard] {
        allCards.filter { !$0.card.isServed }
    }

    /// Joueurs avec au moins un carton actif, triés par nb de cartons desc
    private var playersWithCards: [(player: Player, yellow: Int, secondYellow: Int, red: Int, white: Int, total: Int)] {
        players.compactMap { player in
            let playerCards = activeCards.filter { $0.card.playerId == player.id }
            guard !playerCards.isEmpty else { return nil }
            let y = playerCards.filter { $0.card.type == .yellow }.count
            let sy = playerCards.filter { $0.card.type == .secondYellow }.count
            let r = playerCards.filter { $0.card.type == .red }.count
            let w = playerCards.filter { $0.card.type == .white }.count
            return (player: player, yellow: y, secondYellow: sy, red: r, white: w, total: y + sy + r + w)
        }
        .sorted { $0.total > $1.total }
    }

    private var totalYellow: Int { activeCards.filter { $0.card.type == .yellow }.count }
    private var totalSecondYellow: Int { activeCards.filter { $0.card.type == .secondYellow }.count }
    private var totalRed: Int { activeCards.filter { $0.card.type == .red }.count }
    private var totalWhite: Int { activeCards.filter { $0.card.type == .white }.count }

    var body: some View {
        NavigationStack {
            List {
                // Résumé global
                Section {
                    HStack(spacing: 16) {
                        CardStatBadge(icon: "rectangle.fill", label: "Jaunes", count: totalYellow, color: .cardYellow)
                        CardStatBadge(icon: "rectangle.fill", label: "2è Jaunes", count: totalSecondYellow, color: .cardOrange)
                        CardStatBadge(icon: "rectangle.fill", label: "Rouges", count: totalRed, color: .cardRed)
                        CardStatBadge(icon: "rectangle.fill", label: "Blancs", count: totalWhite, color: .cardWhite)
                    }
                    .listRowBackground(Color.clear)
                }

                // Classement joueurs par cartons
                if !playersWithCards.isEmpty {
                    Section {
                        ForEach(playersWithCards, id: \.player.id) { entry in
                            HStack(spacing: 12) {
                                PlayerAvatar(player: entry.player, size: 40)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(entry.player.fullName)
                                        .font(.subheadline.bold())
                                    Text(entry.player.position.rawValue)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }

                                Spacer()

                                HStack(spacing: 6) {
                                    if entry.yellow > 0 {
                                        CardBadge(count: entry.yellow, color: .cardYellow)
                                    }
                                    if entry.secondYellow > 0 {
                                        CardBadge(count: entry.secondYellow, color: .cardOrange)
                                    }
                                    if entry.red > 0 {
                                        CardBadge(count: entry.red, color: .cardRed)
                                    }
                                    if entry.white > 0 {
                                        CardBadge(count: entry.white, color: .cardWhite)
                                    }
                                }
                            }
                        }
                    } header: {
                        Text("Joueurs sanctionnés")
                    }
                }

                // Filtre
                Section {
                    Picker("Type", selection: $filterType) {
                        ForEach(CardFilterType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                }

                // Historique détaillé
                if filteredCards.isEmpty {
                    Section {
                        VStack(spacing: 8) {
                            Image(systemName: "rectangle.on.rectangle.slash")
                                .font(.system(size: 40))
                                .foregroundStyle(.secondary)
                            Text("Aucun carton")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                        .listRowBackground(Color.clear)
                    }
                } else {
                    Section {
                        ForEach(filteredCards) { enriched in
                            CardHistoryRow(card: enriched.card, opponentName: enriched.opponentName)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        deleteCard(enriched)
                                    } label: {
                                        Label("Purger", systemImage: "checkmark.circle")
                                    }
                                    .tint(.green)
                                }
                        }
                    } header: {
                        Text("En cours (\(filteredCards.count))")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Cartons")
            .searchable(text: $searchText, prompt: "Rechercher un joueur ou match")
            .onAppear { loadCards() }
        }
    }

    private func loadCards() {
        players = TeamManager.shared.loadPlayers()
        let matches = DataManager.shared.loadMatches()
        allCards = matches.flatMap { match in
            let opponent = match.opponentName.isEmpty ? nil : match.opponentName
            return match.cards.map { card in
                var c = card
                if c.matchId == nil { c.matchId = match.id }
                if c.matchDate == nil { c.matchDate = match.date }
                if c.matchLabel == nil {
                    let label = [match.homeTeam, match.awayTeam].filter { !$0.isEmpty }.joined(separator: " - ")
                    c.matchLabel = label.isEmpty ? nil : label
                }
                return EnrichedCard(card: c, opponentName: opponent)
            }
        }
    }

    private func deleteCard(_ enriched: EnrichedCard) {
        guard let matchId = enriched.card.matchId else { return }
        DataManager.shared.deleteCard(cardId: enriched.card.id, fromMatchId: matchId)
        loadCards()
    }

    private func positionColor(_ position: PlayerPosition) -> Color {
        switch position {
        case .gardien: return .orange
        case .defenseur: return .blue
        case .milieu: return .green
        case .attaquant: return .red
        }
    }
}

// MARK: - Ligne carton historique

struct CardHistoryRow: View {
    let card: CardEvent
    var opponentName: String? = nil

    private var cardColor: Color {
        switch card.type {
        case .yellow: return .cardYellow
        case .red: return .cardRed
        case .secondYellow: return .cardOrange
        case .white: return .cardWhite
        }
    }

    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }

    var body: some View {
        HStack(spacing: 12) {
            // Carton visuel
            RoundedRectangle(cornerRadius: 3)
                .fill(cardColor)
                .frame(width: 20, height: 28)
                .overlay(
                    card.type == .secondYellow ?
                    RoundedRectangle(cornerRadius: 3).fill(Color.cardRed).frame(width: 10, height: 28).offset(x: 5)
                    : nil
                )
                .clipShape(RoundedRectangle(cornerRadius: 3))

            VStack(alignment: .leading, spacing: 2) {
                Text(card.playerName)
                    .font(.subheadline.bold())

                HStack(spacing: 8) {
                    Text(card.type.rawValue)
                        .font(.caption)
                        .foregroundStyle(cardColor)

                    Text("• \(card.period.shortName) \(Int(card.minute / 60))'")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                if let opponent = opponentName {
                    Text("vs \(opponent)")
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                } else if let label = card.matchLabel {
                    Text(label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if let date = card.matchDate {
                    Text(dateFormatter.string(from: date))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Badge stat carton

struct CardStatBadge: View {
    let icon: String
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(color)
                    .frame(width: 14, height: 20)
                Text("\(count)")
                    .font(.title2.bold())
                    .foregroundStyle(color)
            }
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Vue cartons pendant le match (consultable)

struct MatchCardsListView: View {
    @ObservedObject var viewModel: MatchViewModel

    var body: some View {
        NavigationStack {
            List {
                if viewModel.match.cards.isEmpty {
                    Section {
                        VStack(spacing: 12) {
                            Image(systemName: "rectangle.on.rectangle.slash")
                                .font(.system(size: 40))
                                .foregroundStyle(.secondary)
                            Text("Aucun carton pour ce match")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                        .listRowBackground(Color.clear)
                    }
                } else {
                    // Résumé
                    Section {
                        let yellows = viewModel.match.cards.filter { $0.type == .yellow }.count
                        let secondYellows = viewModel.match.cards.filter { $0.type == .secondYellow }.count
                        let reds = viewModel.match.cards.filter { $0.type == .red }.count
                        let whites = viewModel.match.cards.filter { $0.type == .white }.count
                        HStack(spacing: 16) {
                            CardStatBadge(icon: "rectangle.fill", label: "Jaunes", count: yellows, color: .cardYellow)
                            CardStatBadge(icon: "rectangle.fill", label: "2è Jaunes", count: secondYellows, color: .cardOrange)
                            CardStatBadge(icon: "rectangle.fill", label: "Rouges", count: reds, color: .cardRed)
                            CardStatBadge(icon: "rectangle.fill", label: "Blancs", count: whites, color: .cardWhite)
                        }
                        .listRowBackground(Color.clear)
                    }

                    // Liste par période
                    ForEach(MatchPeriod.allCases) { period in
                        let periodCards = viewModel.match.cards.filter { $0.period == period }
                        if !periodCards.isEmpty {
                            Section {
                                ForEach(periodCards) { card in
                                    MatchCardRow(card: card)
                                        .swipeActions(edge: .trailing) {
                                            Button(role: .destructive) {
                                                viewModel.match.cards.removeAll { $0.id == card.id }
                                            } label: {
                                                Label("Supprimer", systemImage: "trash")
                                            }
                                        }
                                }
                            } header: {
                                Text(period.rawValue)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Cartons du match")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Ligne carton pendant match

struct MatchCardRow: View {
    let card: CardEvent

    private var cardColor: Color {
        switch card.type {
        case .yellow: return .cardYellow
        case .red: return .cardRed
        case .secondYellow: return .cardOrange
        case .white: return .cardWhite
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 3)
                .fill(cardColor)
                .frame(width: 20, height: 28)
                .overlay(
                    card.type == .secondYellow ?
                    RoundedRectangle(cornerRadius: 3).fill(Color.cardRed).frame(width: 10, height: 28).offset(x: 5)
                    : nil
                )
                .clipShape(RoundedRectangle(cornerRadius: 3))

            VStack(alignment: .leading, spacing: 2) {
                Text(card.playerName)
                    .font(.subheadline.bold())
                Text("\(card.type.rawValue) • \(Int(card.minute / 60))'")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text("\(Int(card.minute / 60))'")
                .font(.system(.headline, design: .monospaced))
                .foregroundStyle(cardColor)
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    CardsManagementView()
}
