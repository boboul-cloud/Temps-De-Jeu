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
}

/// Gestionnaire centralisé de l'import de fichiers .tdj et des deep links
/// Supporte:
/// - Fichiers .tdj ouverts via iMessage, AirDrop, Mail...
/// - Liens tempsdejeu:// cliquables dans Messages
@MainActor
class DeepLinkManager: ObservableObject {
    static let shared = DeepLinkManager()

    /// Données de roster importées, en attente de traitement
    @Published var pendingRosterImport: RosterExport?

    /// Indique qu'un import vient d'arriver et qu'il faut naviguer vers le tab Match
    @Published var shouldNavigateToMatch: Bool = false

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
        previousChain: [String] = []
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
            excludePhotos: true
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
        
        // Vérifier si c'est un URL scheme (lien iMessage)
        if url.scheme == "tempsdejeu" {
            handleDeepLink(url)
            return
        }

        // Sinon, c'est un fichier .tdj
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
        // Accéder au fichier sécurisé
        let accessing = url.startAccessingSecurityScopedResource()
        defer {
            if accessing { url.stopAccessingSecurityScopedResource() }
        }

        // Accepter les fichiers .tdj OU .json (compat)
        let ext = url.pathExtension.lowercased()
        guard ext == "tdj" || ext == "json" else { return }

        // Lire et décoder le fichier
        guard let data = try? Data(contentsOf: url) else {
            print("[DeepLink] Impossible de lire le fichier: \(url)")
            return
        }

        // Essayer de décoder comme RosterExport
        if let rosterExport = ExportService.shared.importRosterExport(from: data) {
            pendingRosterImport = rosterExport
            shouldNavigateToMatch = true
            print("[DeepLink] Import fichier réussi: \(rosterExport.availablePlayers.count) joueurs disponibles")
        } else {
            print("[DeepLink] Fichier non reconnu comme RosterExport")
        }
    }

    /// Consomme les données d'import (après traitement par la vue)
    func clearPendingImport() {
        pendingRosterImport = nil
        shouldNavigateToMatch = false
    }
}
