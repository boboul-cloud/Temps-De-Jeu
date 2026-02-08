//
//  PremiumStatusView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 07/02/2026.
//

import SwiftUI

/// Page de félicitations pour les utilisateurs Premium
struct PremiumStatusView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    // Couronne avec animation
                    VStack(spacing: 16) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 72))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.yellow, .orange],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .shadow(color: .orange.opacity(0.4), radius: 12, y: 4)

                        Text("Félicitations ! 🎉")
                            .font(.largeTitle.bold())

                        Text("Vous êtes membre Premium")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 30)

                    // Badge
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                        Text("Accès illimité activé")
                            .font(.subheadline.bold())
                            .foregroundStyle(.green)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Color.green.opacity(0.1))
                    .cornerRadius(20)

                    // Avantages débloqués
                    VStack(spacing: 0) {
                        Text("Vos avantages Premium")
                            .font(.headline)
                            .padding(.bottom, 16)

                        VStack(spacing: 14) {
                            PremiumAdvantageRow(icon: "infinity", title: "Matchs illimités", description: "Créez autant de matchs que vous le souhaitez", unlocked: true)
                            PremiumAdvantageRow(icon: "chart.bar.fill", title: "Statistiques avancées", description: "Analyse détaillée de chaque match", unlocked: true)
                            PremiumAdvantageRow(icon: "square.and.arrow.up", title: "Export des rapports", description: "Partagez vos rapports PDF", unlocked: true)
                            PremiumAdvantageRow(icon: "clock.arrow.circlepath", title: "Historique complet", description: "Accès à tous vos matchs passés", unlocked: true)
                            PremiumAdvantageRow(icon: "person.3.fill", title: "Gestion d'équipe", description: "Effectif illimité et composition", unlocked: true)
                            PremiumAdvantageRow(icon: "star.fill", title: "Mises à jour futures", description: "Toutes les nouveautés incluses", unlocked: true)
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(16)

                    // Remerciement
                    VStack(spacing: 8) {
                        Text("Merci pour votre soutien ! 💚")
                            .font(.headline)
                        Text("Votre achat nous permet de continuer à améliorer Temps De Jeu.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 8)
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
        }
    }
}

// MARK: - Ligne avantage Premium

struct PremiumAdvantageRow: View {
    let icon: String
    let title: String
    let description: String
    let unlocked: Bool

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
