//
//  TrainingAttendanceView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 10/02/2026.
//

import SwiftUI
import UniformTypeIdentifiers

/// Vue principale de gestion des présences aux entraînements
struct TrainingAttendanceView: View {
    @State private var sessions: [TrainingSession] = []
    @State private var players: [Player] = []
    @State private var showNewSession = false
    @State private var selectedSession: TrainingSession?
    @State private var showStats = false
    @State private var showExport = false
    @ObservedObject private var profileManager = ProfileManager.shared
    
    var sortedSessions: [TrainingSession] {
        sessions.sorted { $0.date > $1.date }
    }
    
    var body: some View {
        NavigationStack {
            Group {
                if sessions.isEmpty {
                    emptyState
                } else {
                    sessionList
                }
            }
            .navigationTitle("Entraînements")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            showNewSession = true
                        } label: {
                            Label("Nouvel entraînement", systemImage: "plus")
                        }
                        
                        if !sessions.isEmpty {
                            Divider()
                            
                            Button {
                                showStats = true
                            } label: {
                                Label("Statistiques", systemImage: "chart.bar.fill")
                            }
                            
                            Button {
                                showExport = true
                            } label: {
                                Label("Exporter", systemImage: "square.and.arrow.up")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showNewSession) {
                NewTrainingSessionView(players: TeamManager.shared.loadPlayers()) { newSession in
                    sessions.append(newSession)
                    TrainingManager.shared.saveSessions(sessions)
                }
            }
            .sheet(item: $selectedSession) { session in
                TrainingSessionDetailView(session: session, players: TeamManager.shared.loadPlayers()) { updatedSession in
                    if let index = sessions.firstIndex(where: { $0.id == updatedSession.id }) {
                        sessions[index] = updatedSession
                        TrainingManager.shared.saveSessions(sessions)
                    }
                }
            }
            .sheet(isPresented: $showStats) {
                TrainingStatsView(sessions: sessions)
            }
            .sheet(isPresented: $showExport) {
                TrainingExportView(sessions: sessions) { importedSessions in
                    sessions = importedSessions
                }
            }
            .onAppear {
                loadData()
            }
            .onChange(of: profileManager.activeProfileId) {
                loadData()
            }
            .onChange(of: showNewSession) {
                if showNewSession {
                    loadData()
                }
            }
        }
    }
    
    private func loadData() {
        sessions = TrainingManager.shared.loadSessions()
        players = TeamManager.shared.loadPlayers()
    }
    
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "figure.run.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.orange)
            Text("Aucun entraînement")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Créez un entraînement pour\npointer les présences de vos joueurs.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
            
            Button {
                showNewSession = true
            } label: {
                HStack {
                    Image(systemName: "plus")
                    Text("Nouvel entraînement")
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .background(.orange)
                .foregroundStyle(.white)
                .cornerRadius(12)
            }
            .padding(.top, 8)
        }
        .padding()
    }
    
    private var sessionList: some View {
        List {
            ForEach(sortedSessions) { session in
                TrainingSessionRow(session: session)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedSession = session
                    }
            }
            .onDelete(perform: deleteSession)
        }
    }
    
    private func deleteSession(at offsets: IndexSet) {
        let sessionsToDelete = offsets.map { sortedSessions[$0] }
        for session in sessionsToDelete {
            sessions.removeAll { $0.id == session.id }
        }
        TrainingManager.shared.saveSessions(sessions)
    }
}

// MARK: - Ligne d'entraînement

struct TrainingSessionRow: View {
    let session: TrainingSession
    
    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .full
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(dateFormatter.string(from: session.date))
                    .font(.headline)
                
                HStack(spacing: 12) {
                    Label("\(session.presentCount)/\(session.totalCount)", systemImage: "person.fill.checkmark")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    
                    if session.totalCount > 0 {
                        let rate = Double(session.presentCount) / Double(session.totalCount) * 100
                        Text("\(Int(rate))%")
                            .font(.subheadline)
                            .foregroundStyle(rate >= 75 ? .green : rate >= 50 ? .orange : .red)
                    }
                }
                
                if !session.notes.isEmpty {
                    Text(session.notes)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Création d'un nouvel entraînement

struct NewTrainingSessionView: View {
    let players: [Player]
    let onSave: (TrainingSession) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date()
    @State private var notes = ""
    @State private var presentPlayerIds: Set<UUID> = []
    @State private var searchText = ""
    @State private var showGuestPlayers = false
    @State private var guestPlayers: [(player: Player, categoryName: String, categoryColorIndex: Int)] = []
    @State private var presentGuestIds: Set<UUID> = []
    
    private var availablePlayers: [Player] {
        players.filter { $0.availability == .disponible }
            .sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
    }
    
    private var filteredPlayers: [Player] {
        if searchText.isEmpty { return availablePlayers }
        return availablePlayers.filter {
            $0.fullName.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var filteredGuestPlayers: [(player: Player, categoryName: String, categoryColorIndex: Int)] {
        if searchText.isEmpty { return guestPlayers }
        return guestPlayers.filter {
            $0.player.fullName.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Date de l'entraînement") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                }
                
                Section("Notes (optionnel)") {
                    TextField("Ex: Travail tactique, préparation match...", text: $notes)
                }
                
                Section {
                    HStack {
                        Text("Présents")
                            .font(.headline)
                        Spacer()
                        Text("\(presentPlayerIds.count)/\(availablePlayers.count)")
                            .foregroundStyle(.secondary)
                        
                        Button {
                            // Tout sélectionner / désélectionner
                            if presentPlayerIds.count == availablePlayers.count {
                                presentPlayerIds.removeAll()
                            } else {
                                presentPlayerIds = Set(availablePlayers.map { $0.id })
                            }
                        } label: {
                            Text(presentPlayerIds.count == availablePlayers.count ? "Tout désélectionner" : "Tout sélectionner")
                                .font(.caption)
                        }
                    }
                } header: {
                    Text("Joueurs")
                }
                
                Section {
                    if availablePlayers.isEmpty {
                        Text("Aucun joueur disponible")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(filteredPlayers) { player in
                            PlayerAttendanceRow(
                                player: player,
                                isPresent: presentPlayerIds.contains(player.id)
                            ) {
                                if presentPlayerIds.contains(player.id) {
                                    presentPlayerIds.remove(player.id)
                                } else {
                                    presentPlayerIds.insert(player.id)
                                }
                            }
                        }
                    }
                }

                // Section joueurs invités d'autres catégories
                Section {
                    DisclosureGroup(isExpanded: $showGuestPlayers) {
                        if filteredGuestPlayers.isEmpty {
                            Text("Aucun joueur disponible dans les autres catégories")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(filteredGuestPlayers, id: \.player.id) { guest in
                                HStack {
                                    PlayerAttendanceRow(
                                        player: guest.player,
                                        isPresent: presentGuestIds.contains(guest.player.id)
                                    ) {
                                        if presentGuestIds.contains(guest.player.id) {
                                            presentGuestIds.remove(guest.player.id)
                                        } else {
                                            presentGuestIds.insert(guest.player.id)
                                        }
                                    }
                                    Text(guest.categoryName)
                                        .font(.system(size: 10, weight: .semibold))
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 2)
                                        .background(ProfileManager.color(for: guest.categoryColorIndex).opacity(0.15))
                                        .foregroundStyle(ProfileManager.color(for: guest.categoryColorIndex))
                                        .cornerRadius(4)
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "person.2.badge.plus")
                                .foregroundStyle(.orange)
                            Text("Joueurs d'autres catégories")
                                .font(.subheadline)
                            if !presentGuestIds.isEmpty {
                                Text("\(presentGuestIds.count)")
                                    .font(.caption2.bold())
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.orange.opacity(0.15))
                                    .foregroundStyle(.orange)
                                    .cornerRadius(8)
                            }
                        }
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Rechercher un joueur")
            .navigationTitle("Nouvel entraînement")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { loadGuestPlayers() }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        createSession()
                    }
                    .disabled(availablePlayers.isEmpty)
                }
            }
        }
    }
    
    private func createSession() {
        var attendances = availablePlayers.map { player in
            PlayerAttendance(from: player, isPresent: presentPlayerIds.contains(player.id))
        }
        // Ajouter les invités présents
        for guest in guestPlayers where presentGuestIds.contains(guest.player.id) {
            attendances.append(PlayerAttendance(from: guest.player, isPresent: true))
        }
        
        let session = TrainingSession(
            date: date,
            notes: notes,
            attendances: attendances
        )
        
        onSave(session)
        dismiss()
    }

    /// Charge les joueurs des autres catégories (disponibles, pas déjà dans la catégorie active)
    private func loadGuestPlayers() {
        let profiles = ProfileManager.shared.profiles
        guard let activeId = ProfileManager.shared.activeProfileId,
              let activeProfile = profiles.first(where: { $0.id == activeId }) else { return }

        let localIds = Set(players.map { $0.id })
        let allGlobal = TeamManager.shared.loadAllPlayers()
        var guests: [(player: Player, categoryName: String, categoryColorIndex: Int)] = []

        for profile in profiles where profile.id != activeId {
            for playerId in profile.playerIds {
                guard !localIds.contains(playerId),
                      !activeProfile.playerIds.contains(playerId),
                      let player = allGlobal.first(where: { $0.id == playerId }),
                      player.availability == .disponible else { continue }
                // Éviter les doublons si le joueur est dans plusieurs autres catégories
                if !guests.contains(where: { $0.player.id == playerId }) {
                    guests.append((player: player, categoryName: profile.name, categoryColorIndex: profile.colorIndex))
                }
            }
        }
        guests.sort { $0.player.lastName.localizedCompare($1.player.lastName) == .orderedAscending }
        guestPlayers = guests
    }
}

// MARK: - Ligne de joueur pour pointage

struct PlayerAttendanceRow: View {
    let player: Player
    let isPresent: Bool
    let onToggle: () -> Void
    
    var body: some View {
        Button(action: onToggle) {
            HStack {
                // Photo ou initiales
                if let photoData = player.photoData, let uiImage = UIImage(data: photoData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 36, height: 36)
                        .clipShape(Circle())
                } else {
                    Circle()
                        .fill(.gray.opacity(0.3))
                        .frame(width: 36, height: 36)
                        .overlay {
                            Text(player.firstName.prefix(1).uppercased() + player.lastName.prefix(1).uppercased())
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                        }
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(player.fullName)
                        .foregroundStyle(.primary)
                    Text(player.position.rawValue)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Image(systemName: isPresent ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(isPresent ? .green : .gray)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Détail d'un entraînement (modification)

struct TrainingSessionDetailView: View {
    let session: TrainingSession
    let players: [Player]
    let onSave: (TrainingSession) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @State private var date: Date
    @State private var notes: String
    @State private var presentPlayerIds: Set<UUID>
    @State private var searchText = ""
    @State private var showShareSheet = false
    @State private var exportURL: URL?
    @State private var showGuestPlayers = false
    @State private var guestPlayers: [(player: Player, categoryName: String, categoryColorIndex: Int)] = []
    @State private var presentGuestIds: Set<UUID> = []
    
    init(session: TrainingSession, players: [Player], onSave: @escaping (TrainingSession) -> Void) {
        self.session = session
        self.players = players
        self.onSave = onSave
        _date = State(initialValue: session.date)
        _notes = State(initialValue: session.notes)
        _presentPlayerIds = State(initialValue: Set(session.attendances.filter { $0.isPresent }.map { $0.id }))
    }
    
    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .full
        f.timeStyle = .none
        f.locale = Locale(identifier: "fr_FR")
        return f
    }
    
    private var availablePlayers: [Player] {
        players.filter { $0.availability == .disponible }
            .sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
    }
    
    private var filteredPlayers: [Player] {
        if searchText.isEmpty { return availablePlayers }
        return availablePlayers.filter {
            $0.fullName.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var filteredGuestPlayers: [(player: Player, categoryName: String, categoryColorIndex: Int)] {
        if searchText.isEmpty { return guestPlayers }
        return guestPlayers.filter {
            $0.player.fullName.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Date de l'entraînement") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                }
                
                Section("Notes (optionnel)") {
                    TextField("Ex: Travail tactique, préparation match...", text: $notes)
                }
                
                Section {
                    Button {
                        exportSessionPDF()
                    } label: {
                        Label("Exporter la feuille de présence", systemImage: "square.and.arrow.up")
                    }
                }
                
                Section {
                    HStack {
                        Text("Présents")
                            .font(.headline)
                        Spacer()
                        Text("\(presentPlayerIds.count)/\(availablePlayers.count)")
                            .foregroundStyle(.secondary)
                        
                        Button {
                            if presentPlayerIds.count == availablePlayers.count {
                                presentPlayerIds.removeAll()
                            } else {
                                presentPlayerIds = Set(availablePlayers.map { $0.id })
                            }
                        } label: {
                            Text(presentPlayerIds.count == availablePlayers.count ? "Tout désélectionner" : "Tout sélectionner")
                                .font(.caption)
                        }
                    }
                } header: {
                    Text("Joueurs")
                }
                
                Section {
                    ForEach(filteredPlayers) { player in
                        PlayerAttendanceRow(
                            player: player,
                            isPresent: presentPlayerIds.contains(player.id)
                        ) {
                            if presentPlayerIds.contains(player.id) {
                                presentPlayerIds.remove(player.id)
                            } else {
                                presentPlayerIds.insert(player.id)
                            }
                        }
                    }
                }

                // Section joueurs invités d'autres catégories
                Section {
                    DisclosureGroup(isExpanded: $showGuestPlayers) {
                        if filteredGuestPlayers.isEmpty {
                            Text("Aucun joueur disponible dans les autres catégories")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(filteredGuestPlayers, id: \.player.id) { guest in
                                HStack {
                                    PlayerAttendanceRow(
                                        player: guest.player,
                                        isPresent: presentGuestIds.contains(guest.player.id)
                                    ) {
                                        if presentGuestIds.contains(guest.player.id) {
                                            presentGuestIds.remove(guest.player.id)
                                        } else {
                                            presentGuestIds.insert(guest.player.id)
                                        }
                                    }
                                    Text(guest.categoryName)
                                        .font(.system(size: 10, weight: .semibold))
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 2)
                                        .background(ProfileManager.color(for: guest.categoryColorIndex).opacity(0.15))
                                        .foregroundStyle(ProfileManager.color(for: guest.categoryColorIndex))
                                        .cornerRadius(4)
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "person.2.badge.plus")
                                .foregroundStyle(.orange)
                            Text("Joueurs d'autres catégories")
                                .font(.subheadline)
                            if !presentGuestIds.isEmpty {
                                Text("\(presentGuestIds.count)")
                                    .font(.caption2.bold())
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.orange.opacity(0.15))
                                    .foregroundStyle(.orange)
                                    .cornerRadius(8)
                            }
                        }
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Rechercher un joueur")
            .navigationTitle("Modifier")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { loadGuestPlayers() }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") {
                        saveSession()
                    }
                }
            }
            .onChange(of: exportURL) {
                if exportURL != nil {
                    showShareSheet = true
                }
            }
            .sheet(isPresented: $showShareSheet) {
                if let url = exportURL {
                    ShareSheet(items: [url])
                }
            }
        }
    }
    
    private func exportSessionPDF() {
        // Créer une session temporaire avec les données actuelles
        var attendances = availablePlayers.map { player in
            PlayerAttendance(from: player, isPresent: presentPlayerIds.contains(player.id))
        }
        // Ajouter les invités présents
        for guest in guestPlayers where presentGuestIds.contains(guest.player.id) {
            attendances.append(PlayerAttendance(from: guest.player, isPresent: true))
        }
        
        var currentSession = session
        currentSession.date = date
        currentSession.notes = notes
        currentSession.attendances = attendances
        
        // Construire le dictionnaire des noms de catégories pour les invités
        var guestNames: [UUID: String] = [:]
        for guest in guestPlayers {
            guestNames[guest.player.id] = guest.categoryName
        }
        
        let data = ExportService.shared.generateTrainingSessionPDF(session: currentSession, guestCategoryNames: guestNames)
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: date)
        let fileName = "Entrainement_\(dateStr).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try? data.write(to: tempURL)
        exportURL = tempURL
    }
    
    private func saveSession() {
        var attendances = availablePlayers.map { player in
            PlayerAttendance(from: player, isPresent: presentPlayerIds.contains(player.id))
        }
        // Ajouter les invités présents
        for guest in guestPlayers where presentGuestIds.contains(guest.player.id) {
            attendances.append(PlayerAttendance(from: guest.player, isPresent: true))
        }
        
        var updatedSession = session
        updatedSession.date = date
        updatedSession.notes = notes
        updatedSession.attendances = attendances
        
        onSave(updatedSession)
        dismiss()
    }

    /// Charge les joueurs des autres catégories (disponibles, pas déjà dans la catégorie active)
    private func loadGuestPlayers() {
        let profiles = ProfileManager.shared.profiles
        guard let activeId = ProfileManager.shared.activeProfileId,
              let activeProfile = profiles.first(where: { $0.id == activeId }) else { return }

        let localIds = Set(players.map { $0.id })
        let allGlobal = TeamManager.shared.loadAllPlayers()
        var guests: [(player: Player, categoryName: String, categoryColorIndex: Int)] = []

        for profile in profiles where profile.id != activeId {
            for playerId in profile.playerIds {
                guard !localIds.contains(playerId),
                      !activeProfile.playerIds.contains(playerId),
                      let player = allGlobal.first(where: { $0.id == playerId }),
                      player.availability == .disponible else { continue }
                // Éviter les doublons si le joueur est dans plusieurs autres catégories
                if !guests.contains(where: { $0.player.id == playerId }) {
                    guests.append((player: player, categoryName: profile.name, categoryColorIndex: profile.colorIndex))
                }
            }
        }
        guests.sort { $0.player.lastName.localizedCompare($1.player.lastName) == .orderedAscending }
        guestPlayers = guests

        // Restaurer les invités déjà présents dans la session existante
        let guestIds = Set(guests.map { $0.player.id })
        for attendance in session.attendances where attendance.isPresent {
            if guestIds.contains(attendance.id) {
                presentGuestIds.insert(attendance.id)
            }
        }
    }
}

// MARK: - Statistiques de présence

struct TrainingStatsView: View {
    let sessions: [TrainingSession]
    
    @Environment(\.dismiss) private var dismiss
    @State private var startDate = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
    @State private var endDate = Date()
    
    private var filteredSessions: [TrainingSession] {
        TrainingManager.shared.filterSessions(sessions, from: startDate, to: endDate)
    }
    
    /// Stats calculées sur les sessions locales + les sessions d'autres catégories où nos joueurs ont participé
    private var playerStats: [PlayerAttendanceStats] {
        // Stats des sessions de la catégorie active
        let localStats = TrainingManager.shared.calculatePlayerStats(sessions: filteredSessions)
        
        // Récupérer les entraînements des autres catégories où nos joueurs ont participé
        let profiles = ProfileManager.shared.profiles
        guard let activeId = ProfileManager.shared.activeProfileId,
              let activeProfile = profiles.first(where: { $0.id == activeId }) else { return localStats }
        
        let activePlayerIds = activeProfile.playerIds
        guard !activePlayerIds.isEmpty else { return localStats }
        
        // Collecter les sessions externes filtrées contenant des joueurs de la catégorie active
        var externalAttendances: [(playerId: UUID, firstName: String, lastName: String, isPresent: Bool)] = []
        var externalSessionCount: [UUID: Int] = [:] // nombre de sessions externes par joueur
        
        for profile in profiles where profile.id != activeId {
            let otherSessions = TrainingManager.shared.loadSessions(forProfileId: profile.id)
            let filteredOther = TrainingManager.shared.filterSessions(otherSessions, from: startDate, to: endDate)
            
            for session in filteredOther {
                for attendance in session.attendances {
                    // Ce joueur appartient-il à la catégorie active ?
                    if activePlayerIds.contains(attendance.id) {
                        externalAttendances.append((
                            playerId: attendance.id,
                            firstName: attendance.firstName,
                            lastName: attendance.lastName,
                            isPresent: attendance.isPresent
                        ))
                        externalSessionCount[attendance.id, default: 0] += 1
                    }
                }
            }
        }
        
        guard !externalAttendances.isEmpty else { return localStats }
        
        // Fusionner les stats locales avec les sessions externes
        var merged: [UUID: (firstName: String, lastName: String, total: Int, present: Int)] = [:]
        for stat in localStats {
            merged[stat.playerId] = (firstName: stat.firstName, lastName: stat.lastName, total: stat.totalSessions, present: stat.presentSessions)
        }
        for ext in externalAttendances {
            if var data = merged[ext.playerId] {
                data.total += 1
                if ext.isPresent { data.present += 1 }
                merged[ext.playerId] = data
            } else {
                merged[ext.playerId] = (
                    firstName: ext.firstName,
                    lastName: ext.lastName,
                    total: 1,
                    present: ext.isPresent ? 1 : 0
                )
            }
        }
        
        return merged.map { (playerId, data) in
            PlayerAttendanceStats(
                playerId: playerId,
                firstName: data.firstName,
                lastName: data.lastName,
                totalSessions: data.total,
                presentSessions: data.present
            )
        }.sorted { $0.lastName.localizedCompare($1.lastName) == .orderedAscending }
    }

    /// Nombre total d'entraînements (locaux + externes avec nos joueurs)
    private var totalSessionCount: Int {
        var sessionIds = Set(filteredSessions.map { $0.id })
        
        let profiles = ProfileManager.shared.profiles
        guard let activeId = ProfileManager.shared.activeProfileId,
              let activeProfile = profiles.first(where: { $0.id == activeId }) else { return filteredSessions.count }
        
        let activePlayerIds = activeProfile.playerIds
        
        for profile in profiles where profile.id != activeId {
            let otherSessions = TrainingManager.shared.loadSessions(forProfileId: profile.id)
            let filteredOther = TrainingManager.shared.filterSessions(otherSessions, from: startDate, to: endDate)
            for session in filteredOther {
                let hasActivePlayer = session.attendances.contains { activePlayerIds.contains($0.id) }
                if hasActivePlayer {
                    sessionIds.insert(session.id)
                }
            }
        }
        return sessionIds.count
    }

    /// Retourne le nom et la couleur de la catégorie d'origine pour les joueurs invités (non membres de la catégorie active)
    private var guestCategoryInfo: [UUID: (name: String, colorIndex: Int)] {
        let profiles = ProfileManager.shared.profiles
        guard let activeId = ProfileManager.shared.activeProfileId,
              let activeProfile = profiles.first(where: { $0.id == activeId }) else { return [:] }
        
        // Charger les joueurs de la catégorie active pour comparaison par nom
        let allGlobal = TeamManager.shared.loadAllPlayers()
        let activePlayerNames = Set(activeProfile.playerIds.compactMap { pid -> String? in
            guard let p = allGlobal.first(where: { $0.id == pid }) else { return nil }
            return "\(p.firstName.lowercased())_\(p.lastName.lowercased())"
        })
        
        var result: [UUID: (name: String, colorIndex: Int)] = [:]
        for stat in playerStats {
            // Vérifier par UUID d'abord
            if activeProfile.playerIds.contains(stat.playerId) { continue }
            // Vérifier par nom (au cas où le joueur a un UUID différent)
            let normalizedName = "\(stat.firstName.lowercased())_\(stat.lastName.lowercased())"
            if activePlayerNames.contains(normalizedName) { continue }
            // C'est un invité — trouver sa catégorie d'origine
            if let originProfile = profiles.first(where: { $0.id != activeId && $0.playerIds.contains(stat.playerId) }) {
                result[stat.playerId] = (name: originProfile.name, colorIndex: originProfile.colorIndex)
            } else {
                // Fallback: chercher par nom dans les autres profils
                for profile in profiles where profile.id != activeId {
                    let hasPlayer = profile.playerIds.contains(where: { pid in
                        guard let p = allGlobal.first(where: { $0.id == pid }) else { return false }
                        return "\(p.firstName.lowercased())_\(p.lastName.lowercased())" == normalizedName
                    })
                    if hasPlayer {
                        result[stat.playerId] = (name: profile.name, colorIndex: profile.colorIndex)
                        break
                    }
                }
            }
        }
        return result
    }
    
    var body: some View {
        NavigationStack {
            List {
                Section("Période") {
                    DatePicker("Du", selection: $startDate, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                    DatePicker("Au", selection: $endDate, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                }
                
                Section {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("\(totalSessionCount)")
                                .font(.title.bold())
                            Text("Entraînements")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            let totalPresent = playerStats.reduce(0) { $0 + $1.presentSessions }
                            let totalPossible = playerStats.reduce(0) { $0 + $1.totalSessions }
                            let avgPresence = totalPossible == 0 ? 0.0 :
                                Double(totalPresent) / Double(totalPossible) * 100
                            Text("\(Int(avgPresence))%")
                                .font(.title.bold())
                                .foregroundStyle(avgPresence >= 75 ? .green : avgPresence >= 50 ? .orange : .red)
                            Text("Présence moyenne")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Résumé")
                }
                
                Section {
                    if playerStats.isEmpty {
                        Text("Aucune donnée pour cette période")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(playerStats) { stat in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text(stat.fullName)
                                        if let info = guestCategoryInfo[stat.playerId] {
                                            Text(info.name)
                                                .font(.system(size: 10, weight: .semibold))
                                                .padding(.horizontal, 5)
                                                .padding(.vertical, 2)
                                                .background(ProfileManager.color(for: info.colorIndex).opacity(0.15))
                                                .foregroundStyle(ProfileManager.color(for: info.colorIndex))
                                                .cornerRadius(4)
                                        }
                                    }
                                    Text("\(stat.presentSessions)/\(stat.totalSessions) entraînements")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                
                                Spacer()
                                
                                Text("\(Int(stat.attendanceRate))%")
                                    .font(.headline)
                                    .foregroundStyle(stat.attendanceRate >= 75 ? .green : stat.attendanceRate >= 50 ? .orange : .red)
                            }
                        }
                    }
                } header: {
                    Text("Par joueur")
                }
            }
            .navigationTitle("Statistiques")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Export des présences

struct TrainingExportView: View {
    let sessions: [TrainingSession]
    var onImport: (([TrainingSession]) -> Void)? = nil
    
    @Environment(\.dismiss) private var dismiss
    @State private var startDate = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
    @State private var endDate = Date()
    @State private var exportFormat: ExportFormat = .pdf
    @State private var showShareSheet = false
    @State private var exportURL: URL?
    
    // Import states
    @State private var showImportPicker = false
    @State private var showImportConfirmation = false
    @State private var importedSessions: [TrainingSession] = []
    @State private var importMode: ImportMode = .merge
    @State private var alertTitle = ""
    @State private var alertMessage = ""
    @State private var showAlert = false
    
    enum ExportFormat: String, CaseIterable {
        case pdf = "PDF"
        case json = "JSON"
    }
    
    enum ImportMode: String, CaseIterable {
        case merge = "Fusionner"
        case replace = "Remplacer"
    }
    
    private var filteredSessions: [TrainingSession] {
        TrainingManager.shared.filterSessions(sessions, from: startDate, to: endDate)
    }
    
    var body: some View {
        NavigationStack {
            Form {
                // MARK: - Export Section
                Section {
                    DatePicker("Du", selection: $startDate, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                    DatePicker("Au", selection: $endDate, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                } header: {
                    Text("Export - Période")
                }
                
                Section("Format") {
                    Picker("Format", selection: $exportFormat) {
                        ForEach(ExportFormat.allCases, id: \.self) { format in
                            Text(format.rawValue).tag(format)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                
                Section {
                    Text("\(filteredSessions.count) entraînements sélectionnés")
                        .foregroundStyle(.secondary)
                }
                
                Section {
                    Button {
                        generateExport()
                    } label: {
                        HStack {
                            Spacer()
                            Label("Exporter", systemImage: "square.and.arrow.up")
                            Spacer()
                        }
                    }
                    .disabled(filteredSessions.isEmpty)
                }
                
                // MARK: - Import Section
                Section {
                    Button {
                        showImportPicker = true
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Importer des entraînements (JSON)")
                                    .font(.subheadline)
                                Text("Depuis un fichier exporté")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "square.and.arrow.down")
                                .foregroundStyle(.green)
                        }
                    }
                } header: {
                    Text("Import")
                }
            }
            .navigationTitle("Export / Import")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") {
                        dismiss()
                    }
                }
            }
            .onChange(of: exportURL) {
                if exportURL != nil {
                    showShareSheet = true
                }
            }
            .sheet(isPresented: $showShareSheet) {
                if let url = exportURL {
                    ShareSheet(items: [url])
                }
            }
            .fileImporter(
                isPresented: $showImportPicker,
                allowedContentTypes: [.json],
                allowsMultipleSelection: false
            ) { result in
                handleImportResult(result)
            }
            .alert(alertTitle, isPresented: $showAlert) {
                Button("OK") {}
            } message: {
                Text(alertMessage)
            }
            .confirmationDialog(
                "Importer \(importedSessions.count) entraînements",
                isPresented: $showImportConfirmation,
                titleVisibility: .visible
            ) {
                Button("Fusionner (ajouter les nouveaux)") {
                    performImport(mode: .merge)
                }
                Button("Remplacer tous les entraînements") {
                    performImport(mode: .replace)
                }
                Button("Annuler", role: .cancel) {}
            } message: {
                Text("Comment souhaitez-vous importer les entraînements ?")
            }
        }
    }
    
    private func generateExport() {
        let playerStats = TrainingManager.shared.calculatePlayerStats(sessions: filteredSessions)
        let guestNames = buildGuestCategoryNames()
        
        switch exportFormat {
        case .pdf:
            let data = ExportService.shared.generateTrainingAttendancePDF(
                sessions: filteredSessions,
                playerStats: playerStats,
                startDate: startDate,
                endDate: endDate,
                guestCategoryNames: guestNames
            )
            let dateStr = formatDateRange()
            let fileName = "Presences_entrainements_\(dateStr).pdf"
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
            try? data.write(to: tempURL)
            exportURL = tempURL
            
        case .json:
            if let data = ExportService.shared.exportTrainingAttendanceJSON(
                sessions: filteredSessions,
                playerStats: playerStats,
                startDate: startDate,
                endDate: endDate
            ) {
                let dateStr = formatDateRange()
                let fileName = "Presences_entrainements_\(dateStr).json"
                let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                try? data.write(to: tempURL)
                exportURL = tempURL
            }
        }
    }
    
    private func formatDateRange() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return "\(formatter.string(from: startDate))_\(formatter.string(from: endDate))"
    }
    
    /// Construit un dictionnaire [UUID: nom de catégorie] pour les joueurs invités
    private func buildGuestCategoryNames() -> [UUID: String] {
        let profiles = ProfileManager.shared.profiles
        guard let activeId = ProfileManager.shared.activeProfileId,
              let activeProfile = profiles.first(where: { $0.id == activeId }) else { return [:] }
        
        var result: [UUID: String] = [:]
        
        // Collecter tous les playerIds des sessions filtrées
        let allAttendanceIds = Set(filteredSessions.flatMap { $0.attendances.map { $0.id } })
        
        for playerId in allAttendanceIds {
            if activeProfile.playerIds.contains(playerId) { continue }
            // Chercher la catégorie d'origine
            if let originProfile = profiles.first(where: { $0.id != activeId && $0.playerIds.contains(playerId) }) {
                result[playerId] = originProfile.name
            }
        }
        return result
    }
    
    // MARK: - Import Actions
    
    private func handleImportResult(_ result: Result<[URL], Error>) {
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
                guard let imported = ExportService.shared.importTrainingAttendanceJSON(from: data) else {
                    showAlertWith(title: "Erreur", message: "Le fichier n'est pas un export d'entraînements valide.")
                    return
                }
                importedSessions = imported.sessions
                if importedSessions.isEmpty {
                    showAlertWith(title: "Fichier vide", message: "Aucun entraînement trouvé dans ce fichier.")
                } else {
                    showImportConfirmation = true
                }
            } catch {
                showAlertWith(title: "Erreur", message: "Impossible de lire le fichier : \(error.localizedDescription)")
            }
            
        case .failure(let error):
            showAlertWith(title: "Erreur", message: error.localizedDescription)
        }
    }
    
    private func performImport(mode: ImportMode) {
        var existingSessions = TrainingManager.shared.loadSessions()
        
        switch mode {
        case .replace:
            existingSessions = importedSessions
        case .merge:
            let existingIds = Set(existingSessions.map { $0.id })
            let newSessions = importedSessions.filter { !existingIds.contains($0.id) }
            existingSessions.append(contentsOf: newSessions)
        }
        
        TrainingManager.shared.saveSessions(existingSessions)
        onImport?(existingSessions)
        
        showAlertWith(
            title: "Import réussi",
            message: mode == .replace
                ? "\(importedSessions.count) entraînements importés (remplacement)."
                : "Entraînements mis à jour. \(existingSessions.count) entraînements au total."
        )
        importedSessions = []
    }
    
    private func showAlertWith(title: String, message: String) {
        alertTitle = title
        alertMessage = message
        showAlert = true
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    TrainingAttendanceView()
}
