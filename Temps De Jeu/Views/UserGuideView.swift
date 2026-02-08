//
//  UserGuideView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 08/02/2026.
//

import SwiftUI

struct UserGuideView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    
                    // Introduction
                    introSection
                    
                    Divider()
                    
                    // 1. Créer son effectif
                    guideSection(
                        number: "1",
                        title: "Créer son effectif",
                        icon: "person.3.fill",
                        color: .blue,
                        steps: [
                            "Allez dans l'onglet **Équipe**",
                            "Appuyez sur **+** pour ajouter un joueur",
                            "Renseignez le nom, prénom, numéro et position",
                            "Vous pouvez importer un effectif existant via **Import JSON**"
                        ]
                    )
                    
                    Divider()
                    
                    // 2. Préparer un match
                    guideSection(
                        number: "2",
                        title: "Préparer un match",
                        icon: "sportscourt.fill",
                        color: .green,
                        steps: [
                            "Allez dans l'onglet **Match**",
                            "Renseignez les équipes, la compétition et la date",
                            "Appuyez sur **Sélectionner les joueurs**",
                            "Cochez les joueurs convoqués pour ce match",
                            "Le nombre de joueurs sélectionnés s'affiche en haut"
                        ]
                    )
                    
                    Divider()
                    
                    // 3. Système Cascade
                    cascadeSection
                    
                    Divider()
                    
                    // 4. Pendant le match
                    guideSection(
                        number: "4",
                        title: "Pendant le match",
                        icon: "timer",
                        color: .orange,
                        steps: [
                            "Appuyez sur **Démarrer le match**",
                            "Le chrono démarre automatiquement",
                            "Les joueurs **sur le terrain** sont en haut",
                            "Les joueurs **remplaçants** sont en bas",
                            "Le temps de jeu de chaque joueur est affiché"
                        ]
                    )
                    
                    Divider()
                    
                    // 5. Remplacements
                    guideSection(
                        number: "5",
                        title: "Faire un remplacement",
                        icon: "arrow.left.arrow.right",
                        color: .purple,
                        steps: [
                            "**Méthode 1** : Glissez un remplaçant vers un joueur sur le terrain",
                            "**Méthode 2** : Appuyez sur un joueur sur le terrain, puis sur le remplaçant",
                            "Le remplacement est enregistré avec le temps exact",
                            "Consultez la **Timeline** pour voir l'historique"
                        ]
                    )
                    
                    Divider()
                    
                    // 6. Événements
                    guideSection(
                        number: "6",
                        title: "Enregistrer des événements",
                        icon: "flag.fill",
                        color: .red,
                        steps: [
                            "**But** : Appuyez sur le score pour ajouter/retirer un but",
                            "**Carton** : Appuyez sur un joueur → Carton jaune/rouge",
                            "**Arrêt de jeu** : Appuyez sur ⏸️ pour mettre en pause",
                            "Tous les événements apparaissent dans la **Timeline**"
                        ]
                    )
                    
                    Divider()
                    
                    // 7. Mi-temps et fin
                    guideSection(
                        number: "7",
                        title: "Mi-temps et fin de match",
                        icon: "clock.badge.checkmark.fill",
                        color: .teal,
                        steps: [
                            "À la mi-temps, appuyez sur **Mi-temps**",
                            "Le chrono se met en pause",
                            "Appuyez sur **Reprendre** pour la 2ème mi-temps",
                            "En fin de match, appuyez sur **Terminer**",
                            "Le match est sauvegardé dans l'**Historique**"
                        ]
                    )
                    
                    Divider()
                    
                    // 8. Statistiques
                    guideSection(
                        number: "8",
                        title: "Consulter les statistiques",
                        icon: "chart.bar.fill",
                        color: .indigo,
                        steps: [
                            "Allez dans l'onglet **Stats**",
                            "Visualisez le temps de jeu par joueur",
                            "Filtrez par période (saison, mois...)",
                            "Exportez en **PDF** pour partager"
                        ]
                    )
                    
                    Divider()
                    
                    // 9. Historique
                    guideSection(
                        number: "9",
                        title: "Historique des matchs",
                        icon: "clock.arrow.circlepath",
                        color: .brown,
                        steps: [
                            "Allez dans l'onglet **Historique**",
                            "Retrouvez tous vos matchs passés",
                            "Appuyez sur un match pour voir les détails",
                            "Exportez le rapport PDF du match"
                        ]
                    )
                    
                    Divider()
                    
                    // Tips
                    tipsSection
                    
                }
                .padding()
            }
            .navigationTitle("Mode d'emploi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }
    
    // MARK: - Sections
    
    private var introSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Text("⚽")
                    .font(.system(size: 50))
                VStack(alignment: .leading) {
                    Text("Bienvenue dans")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("Temps De Jeu")
                        .font(.title.bold())
                }
            }
            
            Text("Cette application vous aide à gérer équitablement le temps de jeu de vos joueurs pendant les matchs de football.")
                .foregroundStyle(.secondary)
        }
    }
    
    private var cascadeSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color.cyan.opacity(0.15))
                        .frame(width: 44, height: 44)
                    Text("3")
                        .font(.headline.bold())
                        .foregroundStyle(.cyan)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Système Cascade")
                        .font(.headline)
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.branch")
                            .font(.caption)
                        Text("Pour clubs multi-équipes")
                            .font(.caption)
                    }
                    .foregroundStyle(.cyan)
                }
            }
            
            Text("Idéal pour les clubs avec plusieurs équipes (A, B, C, D...) :")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            VStack(alignment: .leading, spacing: 8) {
                cascadeStep("1", "L'équipe **A** sélectionne ses joueurs")
                cascadeStep("2", "Elle exporte les **joueurs disponibles** via le bouton Partager")
                cascadeStep("3", "L'équipe **B** importe le fichier → les joueurs pris par A sont marqués indisponibles")
                cascadeStep("4", "B sélectionne ses joueurs et exporte pour **C**, etc.")
            }
            
            HStack(spacing: 8) {
                shareButton(icon: "doc.fill", label: "Fichier", color: .green, desc: "Fichier .tdj")
                shareButton(icon: "link", label: "Lien", color: .blue, desc: "Pour iMessage")
                shareButton(icon: "doc.richtext", label: "PDF", color: .red, desc: "Pour imprimer")
            }
        }
    }
    
    private func cascadeStep(_ number: String, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.caption.bold())
                .frame(width: 20, height: 20)
                .background(Color.cyan.opacity(0.2))
                .cornerRadius(4)
            Text(text)
                .font(.subheadline)
        }
    }
    
    private func shareButton(icon: String, label: String, color: Color, desc: String) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                Text(label)
                    .font(.caption2.bold())
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(color.opacity(0.12))
            .foregroundStyle(color)
            .cornerRadius(8)
            
            Text(desc)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
    
    private var tipsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color.yellow.opacity(0.15))
                        .frame(width: 44, height: 44)
                    Image(systemName: "lightbulb.fill")
                        .foregroundStyle(.yellow)
                }
                
                Text("Astuces")
                    .font(.headline)
            }
            
            VStack(alignment: .leading, spacing: 12) {
                tipRow(icon: "icloud.fill", text: "Vos données sont sauvegardées automatiquement sur votre appareil")
                tipRow(icon: "arrow.clockwise", text: "Restaurez vos achats depuis Réglages si vous changez d'appareil")
                tipRow(icon: "square.and.arrow.up", text: "Exportez régulièrement votre effectif en JSON pour avoir une sauvegarde")
                tipRow(icon: "person.crop.circle.badge.plus", text: "Ajoutez une photo à vos joueurs pour les identifier plus facilement")
            }
        }
        .padding()
        .background(Color.yellow.opacity(0.08))
        .cornerRadius(16)
    }
    
    private func tipRow(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(.yellow)
                .frame(width: 20)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
    
    // MARK: - Helper
    
    private func guideSection(number: String, title: String, icon: String, color: Color, steps: [String]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 44, height: 44)
                    Text(number)
                        .font(.headline.bold())
                        .foregroundStyle(color)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                    HStack(spacing: 4) {
                        Image(systemName: icon)
                            .font(.caption)
                        Text(icon == "timer" ? "Onglet Match" : "")
                            .font(.caption)
                    }
                    .foregroundStyle(color)
                }
            }
            
            VStack(alignment: .leading, spacing: 10) {
                ForEach(steps, id: \.self) { step in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.subheadline)
                            .foregroundStyle(color.opacity(0.7))
                        Text(.init(step))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

#Preview {
    UserGuideView()
}
