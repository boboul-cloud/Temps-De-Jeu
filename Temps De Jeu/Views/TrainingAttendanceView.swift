//
//  TrainingAttendanceView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 10/02/2026.
//

import SwiftUI

/// Vue principale de gestion des présences aux entraînements
struct TrainingAttendanceView: View {
    @State private var sessions: [TrainingSession] = []
    @State private var players: [Player] = []
    @State private var showNewSession = false
    @State private var selectedSession: TrainingSession?
    @State private var showStats = false
    @State private var showExport = false
    
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
                TrainingExportView(sessions: sessions)
            }
            .onAppear {
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
            }
            .searchable(text: $searchText, prompt: "Rechercher un joueur")
            .navigationTitle("Nouvel entraînement")
            .navigationBarTitleDisplayMode(.inline)
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
        let attendances = availablePlayers.map { player in
            PlayerAttendance(from: player, isPresent: presentPlayerIds.contains(player.id))
        }
        
        let session = TrainingSession(
            date: date,
            notes: notes,
            attendances: attendances
        )
        
        onSave(session)
        dismiss()
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
            }
            .searchable(text: $searchText, prompt: "Rechercher un joueur")
            .navigationTitle("Modifier")
            .navigationBarTitleDisplayMode(.inline)
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
        let attendances = availablePlayers.map { player in
            PlayerAttendance(from: player, isPresent: presentPlayerIds.contains(player.id))
        }
        
        var currentSession = session
        currentSession.date = date
        currentSession.notes = notes
        currentSession.attendances = attendances
        
        let data = ExportService.shared.generateTrainingSessionPDF(session: currentSession)
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: date)
        let fileName = "Entrainement_\(dateStr).pdf"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try? data.write(to: tempURL)
        exportURL = tempURL
    }
    
    private func saveSession() {
        let attendances = availablePlayers.map { player in
            PlayerAttendance(from: player, isPresent: presentPlayerIds.contains(player.id))
        }
        
        var updatedSession = session
        updatedSession.date = date
        updatedSession.notes = notes
        updatedSession.attendances = attendances
        
        onSave(updatedSession)
        dismiss()
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
    
    private var playerStats: [PlayerAttendanceStats] {
        TrainingManager.shared.calculatePlayerStats(sessions: filteredSessions)
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
                            Text("\(filteredSessions.count)")
                                .font(.title.bold())
                            Text("Entraînements")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            let avgPresence = filteredSessions.isEmpty ? 0 :
                                Double(filteredSessions.reduce(0) { $0 + $1.presentCount }) /
                                Double(filteredSessions.reduce(0) { $0 + $1.totalCount }) * 100
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
                                    Text(stat.fullName)
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
    
    @Environment(\.dismiss) private var dismiss
    @State private var startDate = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
    @State private var endDate = Date()
    @State private var exportFormat: ExportFormat = .pdf
    @State private var showShareSheet = false
    @State private var exportURL: URL?
    
    enum ExportFormat: String, CaseIterable {
        case pdf = "PDF"
        case json = "JSON"
    }
    
    private var filteredSessions: [TrainingSession] {
        TrainingManager.shared.filterSessions(sessions, from: startDate, to: endDate)
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Période") {
                    DatePicker("Du", selection: $startDate, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
                    DatePicker("Au", selection: $endDate, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "fr_FR"))
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
            }
            .navigationTitle("Exporter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
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
        }
    }
    
    private func generateExport() {
        let playerStats = TrainingManager.shared.calculatePlayerStats(sessions: filteredSessions)
        
        switch exportFormat {
        case .pdf:
            let data = ExportService.shared.generateTrainingAttendancePDF(
                sessions: filteredSessions,
                playerStats: playerStats,
                startDate: startDate,
                endDate: endDate
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
