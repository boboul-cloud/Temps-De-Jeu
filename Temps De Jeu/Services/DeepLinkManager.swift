//
//  DeepLinkManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 07/02/2026.
//

import SwiftUI
import Combine
import UniformTypeIdentifiers
import Compression

/// Type de fichier personnalisé .tdj (Temps De Jeu)
extension UTType {
    static let tdjRoster = UTType(exportedAs: "com.tempsdejeu.roster")
    static let tdjMatches = UTType("com.tempsdejeu.matches") ?? .json
}

/// Gestionnaire centralisé de l'import de fichiers .tdj et des deep links
/// Supporte:
/// - Fichiers .tdj ouverts via iMessage, AirDrop, Mail...
/// - Fichiers JSON d'entraînements
/// - Liens tempsdejeu:// cliquables dans Messages
@MainActor
class DeepLinkManager: ObservableObject {
    static let shared = DeepLinkManager()

    /// Données de roster importées, en attente de traitement
    @Published var pendingRosterImport: RosterExport?

    /// Indique qu'un import vient d'arriver et qu'il faut naviguer vers le tab Match
    @Published var shouldNavigateToMatch: Bool = false
    
    /// Données d'entraînement importées, en attente de traitement
    @Published var pendingTrainingImport: TrainingAttendanceExport?
    
    /// Indique qu'un import d'entraînement vient d'arriver
    @Published var shouldNavigateToTraining: Bool = false
    
    /// Données de matchs importées, en attente de traitement
    @Published var pendingMatchesImport: ExportService.MatchesImportResult?
    
    /// Indique qu'un import de matchs vient d'arriver
    @Published var shouldNavigateToExport: Bool = false
    
    /// Message d'erreur à afficher si l'import échoue
    @Published var importError: String?

    private init() {}

    // MARK: - Compression GZIP

    /// Compresse les données avec LZFSE (natif iOS, très efficace)
    private func compress(_ data: Data) -> Data? {
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: data.count)
        defer { destinationBuffer.deallocate() }

        let compressedSize = data.withUnsafeBytes { sourceBuffer in
            compression_encode_buffer(
                destinationBuffer, data.count,
                sourceBuffer.bindMemory(to: UInt8.self).baseAddress!, data.count,
                nil,
                COMPRESSION_LZFSE
            )
        }

        guard compressedSize > 0 else { return nil }
        return Data(bytes: destinationBuffer, count: compressedSize)
    }

    /// Décompresse les données LZFSE
    private func decompress(_ data: Data, maxSize: Int = 1_000_000) -> Data? {
        let destinationBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: maxSize)
        defer { destinationBuffer.deallocate() }

        let decompressedSize = data.withUnsafeBytes { sourceBuffer in
            compression_decode_buffer(
                destinationBuffer, maxSize,
                sourceBuffer.bindMemory(to: UInt8.self).baseAddress!, data.count,
                nil,
                COMPRESSION_LZFSE
            )
        }

        guard decompressedSize > 0 else { return nil }
        return Data(bytes: destinationBuffer, count: decompressedSize)
    }

    // MARK: - Génération de liens pour Messages

    /// Crée un lien cliquable pour iMessage avec les données compressées et encodées en Base64
    /// Format: tempsdejeu://r/COMPRESSED_BASE64
    func createShareableLink(
        allPlayers: [Player],
        selectedPlayerIds: Set<UUID>,
        teamName: String,
        competition: String,
        matchDate: Date,
        previousUnavailableIds: [UUID] = [],
        previousChain: [String] = [],
        targetTeamCode: String? = nil
    ) -> URL? {
        // Exclure les photos pour réduire la taille du lien
        guard let jsonData = ExportService.shared.exportRoster(
            allPlayers: allPlayers,
            selectedPlayerIds: selectedPlayerIds,
            teamName: teamName,
            competition: competition,
            matchDate: matchDate,
            previousUnavailableIds: previousUnavailableIds,
            previousChain: previousChain,
            excludePhotos: true,
            targetTeamCode: targetTeamCode
        ) else { return nil }

        // Compresser les données
        guard let compressedData = compress(jsonData) else {
            print("[DeepLink] Échec compression, taille JSON: \(jsonData.count)")
            return nil
        }

        print("[DeepLink] Taille JSON: \(jsonData.count), compressé: \(compressedData.count)")

        // Encoder en Base64 URL-safe
        let base64 = compressedData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        // Construire l'URL avec les données dans le path (pas en query parameter)
        // Format: tempsdejeu://r/BASE64DATA
        let urlString = "tempsdejeu://r/\(base64)"
        return URL(string: urlString)
    }

    /// Crée un message texte formaté avec le lien pour iMessage
    func createShareMessage(
        teamName: String,
        matchDate: Date,
        availableCount: Int,
        link: URL
    ) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.locale = Locale(identifier: "fr_FR")
        let dateStr = formatter.string(from: matchDate)

        return """
        ⚽️ Joueurs disponibles - \(teamName)
        📅 \(dateStr)
        👥 \(availableCount) joueurs disponibles
        
        Touche le lien pour importer:
        \(link.absoluteString)
        """
    }

    // MARK: - Traitement des URLs entrantes

    /// Traite une URL entrante (fichier .tdj ou lien tempsdejeu://)
    func handleURL(_ url: URL) {
        print("[DeepLink] handleURL appelé: \(url)")
        print("[DeepLink] Scheme: \(url.scheme ?? "nil")")
        
        // Vérifier si c'est un URL scheme (lien iMessage)
        if url.scheme == "tempsdejeu" {
            handleDeepLink(url)
            return
        }

        // Sinon, c'est un fichier .tdj (scheme = file ou nil)
        handleFileURL(url)
    }

    /// Traite un lien tempsdejeu://r/BASE64 (nouveau) ou tempsdejeu://roster?data=... (legacy)
    private func handleDeepLink(_ url: URL) {
        print("[DeepLink] handleDeepLink: \(url)")
        
        let host = url.host ?? ""
        var base64: String = ""
        var isCompressed = false
        
        // Nouveau format: tempsdejeu://r/BASE64DATA (données dans le path)
        if host == "r" {
            // Extraire les données du path (après /r/)
            let path = url.path
            if path.hasPrefix("/") {
                base64 = String(path.dropFirst())
            } else {
                base64 = path
            }
            isCompressed = true
            print("[DeepLink] Format path, base64 longueur: \(base64.count)")
        }
        // Ancien format avec query parameters
        else if host == "roster" {
            guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                  let dataItem = components.queryItems?.first(where: { $0.name == "data" }),
                  let dataValue = dataItem.value else {
                print("[DeepLink] Paramètre 'data' non trouvé")
                return
            }
            base64 = dataValue
            isCompressed = false
        } else {
            print("[DeepLink] Host invalide: \(host)")
            return
        }
        
        guard !base64.isEmpty else {
            print("[DeepLink] Base64 vide")
            return
        }

        print("[DeepLink] Base64 reçu, longueur: \(base64.count)")

        // Décoder le Base64 URL-safe
        var base64Fixed = base64
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        // Ajouter le padding si nécessaire
        let padLength = (4 - base64Fixed.count % 4) % 4
        base64Fixed += String(repeating: "=", count: padLength)

        guard let rawData = Data(base64Encoded: base64Fixed) else {
            print("[DeepLink] Impossible de décoder le Base64")
            return
        }

        // Décompresser si c'est le nouveau format
        let jsonData: Data
        if isCompressed {
            guard let decompressed = decompress(rawData) else {
                print("[DeepLink] Impossible de décompresser")
                return
            }
            jsonData = decompressed
            print("[DeepLink] Décompressé: \(jsonData.count) bytes")
        } else {
            jsonData = rawData
        }

        // Décoder comme RosterExport
        if let rosterExport = ExportService.shared.importRosterExport(from: jsonData) {
            pendingRosterImport = rosterExport
            shouldNavigateToMatch = true
            print("[DeepLink] Import via lien réussi: \(rosterExport.availablePlayers.count) joueurs disponibles")
        } else {
            print("[DeepLink] Données non reconnues comme RosterExport")
        }
    }

    /// Traite un fichier .tdj ouvert par iOS
    private func handleFileURL(_ url: URL) {
        print("[DeepLink] handleFileURL: \(url)")
        print("[DeepLink] Scheme: \(url.scheme ?? "nil"), Extension: \(url.pathExtension)")
        
        // Accepter les fichiers .tdj, .tdjm OU .json (compat)
        let ext = url.pathExtension.lowercased()
        guard ext == "tdj" || ext == "tdjm" || ext == "json" else {
            print("[DeepLink] Extension non supportée: \(ext)")
            return
        }
        
        // Accéder au fichier sécurisé
        let accessing = url.startAccessingSecurityScopedResource()
        defer {
            if accessing { url.stopAccessingSecurityScopedResource() }
        }
        
        // Copier le fichier vers un emplacement temporaire pour s'assurer qu'on peut le lire
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(url.lastPathComponent)
        
        do {
            // Supprimer l'ancien fichier temporaire s'il existe
            if FileManager.default.fileExists(atPath: tempURL.path) {
                try FileManager.default.removeItem(at: tempURL)
            }
            
            // Copier le fichier
            try FileManager.default.copyItem(at: url, to: tempURL)
            print("[DeepLink] Fichier copié vers: \(tempURL)")
            
            // Lire les données
            let data = try Data(contentsOf: tempURL)
            print("[DeepLink] Données lues: \(data.count) bytes")
            
            // Afficher un aperçu pour debug
            if let preview = String(data: data.prefix(200), encoding: .utf8) {
                print("[DeepLink] Aperçu: \(preview)")
            }
            
            // Essayer de décoder comme RosterExport (composition de match)
            if let rosterExport = ExportService.shared.importRosterExport(from: data) {
                pendingRosterImport = rosterExport
                shouldNavigateToMatch = true
                importError = nil
                print("[DeepLink] Import fichier réussi: \(rosterExport.availablePlayers.count) joueurs disponibles")
            }
            // Essayer de décoder comme MatchesExport (export de matchs / cartons)
            else if let matchesResult = ExportService.shared.importMatchesWithMetadata(from: data) {
                pendingMatchesImport = matchesResult
                shouldNavigateToExport = true
                importError = nil
                print("[DeepLink] Import matchs réussi: \(matchesResult.matches.count) matchs, catégorie: \(matchesResult.teamName ?? "?")")
            }
            // Vérifier si c'est un fichier d'entraînements
            else if let trainingExport = ExportService.shared.importTrainingAttendanceJSON(from: data) {
                pendingTrainingImport = trainingExport
                shouldNavigateToTraining = true
                importError = nil
                print("[DeepLink] Import entraînements réussi: \(trainingExport.sessions.count) sessions")
            }
            // Essayer de décoder comme liste de joueurs simples
            else if let players = ExportService.shared.importPlayersJSON(from: data), !players.isEmpty {
                // Créer un RosterExport à partir des joueurs
                let rosterExport = RosterExport(
                    teamName: "",
                    competition: "",
                    matchDate: Date(),
                    selectedPlayers: [],
                    availablePlayers: players,
                    unavailablePlayerIds: [],
                    unavailablePlayers: nil,
                    selectionChain: []
                )
                pendingRosterImport = rosterExport
                shouldNavigateToMatch = true
                importError = nil
                print("[DeepLink] Import joueurs réussi: \(players.count) joueurs")
            } else {
                importError = "Format de fichier non reconnu."
                print("[DeepLink] Fichier non reconnu")
            }
            
            // Nettoyer
            try? FileManager.default.removeItem(at: tempURL)
            
        } catch {
            print("[DeepLink] Erreur lors du traitement du fichier: \(error)")
            
            // Essayer de lire directement si la copie a échoué
            if let data = try? Data(contentsOf: url) {
                print("[DeepLink] Lecture directe réussie: \(data.count) bytes")
                if let rosterExport = ExportService.shared.importRosterExport(from: data) {
                    pendingRosterImport = rosterExport
                    shouldNavigateToMatch = true
                    importError = nil
                    print("[DeepLink] Import direct réussi: \(rosterExport.availablePlayers.count) joueurs disponibles")
                } else {
                    importError = "Le fichier n'est pas un fichier valide."
                    print("[DeepLink] Fichier non reconnu (lecture directe)")
                }
            } else {
                importError = "Impossible de lire le fichier. Erreur: \(error.localizedDescription)"
                print("[DeepLink] Impossible de lire le fichier directement")
            }
        }
    }

    /// Consomme les données d'import roster (après traitement par la vue)
    func clearPendingImport() {
        pendingRosterImport = nil
        shouldNavigateToMatch = false
    }
    
    /// Consomme les données d'import entraînement (après traitement par la vue)
    func clearPendingTrainingImport() {
        pendingTrainingImport = nil
        shouldNavigateToTraining = false
    }
    
    /// Consomme les données d'import matchs (après traitement par la vue)
    func clearPendingMatchesImport() {
        pendingMatchesImport = nil
        shouldNavigateToExport = false
    }
    
    /// Efface le message d'erreur
    func clearError() {
        importError = nil
    }
}