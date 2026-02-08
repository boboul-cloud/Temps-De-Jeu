//
//  PaywallView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 06/02/2026.
//

import SwiftUI

/// Écran de mise à niveau premium
struct PaywallView: View {
    @ObservedObject var storeManager: StoreManager
    @Environment(\.dismiss) private var dismiss
    @State private var showTerms = false
    @State private var showPrivacy = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    // Header
                    VStack(spacing: 12) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 56))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.yellow, .orange],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )

                        Text("Temps De Jeu Premium")
                            .font(.title.bold())

                        Text("Débloquez un accès illimité")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 20)

                    // Avantages
                    VStack(spacing: 16) {
                        PremiumFeatureRow(icon: "infinity", title: "Matchs illimités", description: "Plus de limite de 5 matchs gratuits")
                        PremiumFeatureRow(icon: "chart.bar.fill", title: "Statistiques avancées", description: "Analyse détaillée de chaque match")
                        PremiumFeatureRow(icon: "square.and.arrow.up", title: "Export des rapports", description: "Partagez vos rapports de match")
                        PremiumFeatureRow(icon: "clock.arrow.circlepath", title: "Historique complet", description: "Accès à tous vos matchs passés")
                        PremiumFeatureRow(icon: "star.fill", title: "Mises à jour futures", description: "Accès à toutes les nouveautés")
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)

                    // Prix
                    VStack(spacing: 8) {
                        Text("Achat unique")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text(storeManager.formattedPrice)
                            .font(.system(size: 44, weight: .bold, design: .rounded))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.orange, .yellow],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )

                        Text("Paiement unique · Pas d'abonnement")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    // Bouton d'achat
                    Button {
                        Task {
                            await storeManager.purchase()
                            if storeManager.isPremium {
                                dismiss()
                            }
                        }
                    } label: {
                        HStack {
                            if storeManager.purchaseInProgress {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Image(systemName: "crown.fill")
                                Text("Passer Premium — \(storeManager.formattedPrice)")
                                    .font(.title3.bold())
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            LinearGradient(
                                colors: [.orange, .yellow],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundColor(.white)
                        .cornerRadius(16)
                    }
                    .disabled(storeManager.purchaseInProgress)
                    .task {
                        if storeManager.products.isEmpty {
                            await storeManager.loadProducts()
                        }
                    }

                    // Erreur éventuelle
                    if let error = storeManager.purchaseError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    // Restaurer les achats
                    Button {
                        Task {
                            await storeManager.restorePurchases()
                            if storeManager.isPremium {
                                dismiss()
                            }
                        }
                    } label: {
                        Text("Restaurer mes achats")
                            .font(.subheadline)
                            .foregroundStyle(.blue)
                    }

                    // Informations légales
                    VStack(spacing: 8) {
                        HStack(spacing: 4) {
                            Button("Conditions d'utilisation") {
                                showTerms = true
                            }
                            Text("·")
                            Button("Politique de confidentialité") {
                                showPrivacy = true
                            }
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.bottom, 20)
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .sheet(isPresented: $showTerms) {
                TermsOfUseView()
            }
            .sheet(isPresented: $showPrivacy) {
                PrivacyPolicyView()
            }
        }
    }
}

// MARK: - Ligne d'avantage premium

struct PremiumFeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.orange)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.bold())
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
        }
    }
}

#Preview {
    PaywallView(storeManager: StoreManager.shared)
}
