//
//  StoreManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import StoreKit
import SwiftUI
import Combine

class StoreManager: ObservableObject {
    static let shared = StoreManager()

    // ID du produit In-App Purchase
    static let premiumProductID = "com.tempsDeJeu.premium"

    @Published var isPremium: Bool = false
    @Published var matchesUsed: Int = 0
    @Published var products: [Product] = []
    @Published var purchaseInProgress: Bool = false
    @Published var purchaseError: String?

    private var transactionUpdatesTask: Task<Void, Never>?

    static let freeMatchLimit = 5

    private let matchesUsedKey = "matchesUsed"
    private let isPremiumKey = "isPremium"

    var canStartNewMatch: Bool {
        isPremium || matchesUsed < StoreManager.freeMatchLimit
    }

    var remainingFreeMatches: Int {
        max(0, StoreManager.freeMatchLimit - matchesUsed)
    }

    private init() {
        // Charger l'état sauvegardé
        matchesUsed = UserDefaults.standard.integer(forKey: matchesUsedKey)
        isPremium = UserDefaults.standard.bool(forKey: isPremiumKey)

        // Vérifier les achats existants
        Task {
            await checkExistingPurchases()
            await loadProducts()
        }

        // Écouter les mises à jour de transactions (requis par StoreKit 2)
        transactionUpdatesTask = Task {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    if transaction.productID == StoreManager.premiumProductID {
                        await unlockPremium()
                    }
                    await transaction.finish()
                }
            }
        }
    }

    // MARK: - Compteur de matchs

    func incrementMatchCount() {
        guard !isPremium else { return }
        matchesUsed += 1
        UserDefaults.standard.set(matchesUsed, forKey: matchesUsedKey)
    }

    // MARK: - StoreKit 2

    func loadProducts() async {
        do {
            let loaded = try await Product.products(for: [StoreManager.premiumProductID])
            products = loaded
            print("✅ StoreKit: \(loaded.count) produit(s) chargé(s)")
            for p in loaded {
                print("   → \(p.id) — \(p.displayPrice)")
            }
            if loaded.isEmpty {
                print("⚠️ StoreKit: aucun produit trouvé pour '\(StoreManager.premiumProductID)'")
            }
        } catch {
            print("❌ StoreKit erreur chargement: \(error)")
        }
    }

    func purchase() async {
        // Recharger les produits s'ils ne sont pas encore disponibles
        if products.isEmpty {
            await loadProducts()
        }

        guard let product = products.first else {
            purchaseError = "Produit non disponible. Vérifiez votre connexion."
            print("❌ StoreKit: products toujours vide après reload")
            return
        }

        purchaseInProgress = true
        purchaseError = nil

        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(_):
                    await unlockPremium()
                case .unverified(_, _):
                    purchaseError = "Achat non vérifié"
                }
            case .userCancelled:
                break
            case .pending:
                purchaseError = "Achat en attente d'approbation"
            @unknown default:
                break
            }
        } catch {
            purchaseError = "Erreur: \(error.localizedDescription)"
        }

        purchaseInProgress = false
    }

    func restorePurchases() async {
        do {
            try await AppStore.sync()
        } catch {
            print("❌ AppStore.sync erreur: \(error)")
        }
        await checkExistingPurchases()
        if !isPremium {
            purchaseError = "Aucun achat trouvé"
        }
    }

    private func checkExistingPurchases() async {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                if transaction.productID == StoreManager.premiumProductID {
                    await unlockPremium()
                }
            }
        }
    }

    private func unlockPremium() async {
        isPremium = true
        UserDefaults.standard.set(true, forKey: isPremiumKey)
    }

    // MARK: - Prix formaté

    var formattedPrice: String {
        products.first?.displayPrice ?? "4,99 €"
    }
}
