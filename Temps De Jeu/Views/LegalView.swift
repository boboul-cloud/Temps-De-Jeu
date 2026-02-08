//
//  LegalView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 07/02/2026.
//

import SwiftUI

// MARK: - Conditions Générales d'Utilisation

struct TermsOfUseView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Group {
                        sectionTitle("1. Acceptation des conditions")
                        sectionText("En téléchargeant et en utilisant l'application Temps De Jeu, vous acceptez les présentes conditions générales d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application.")

                        sectionTitle("2. Description du service")
                        sectionText("Temps De Jeu est une application de gestion du temps de jeu effectif pour les matchs de football. Elle permet de chronométrer les arrêts de jeu, de gérer les compositions d'équipe, les remplacements, les cartons et de générer des statistiques et rapports.")

                        sectionTitle("3. Achats intégrés")
                        sectionText("""
                        L'application propose une version gratuite limitée à 5 matchs et une version Premium disponible via un achat unique (non-abonnement).

                        • L'achat Premium est définitif et non remboursable, sauf dans les cas prévus par la loi applicable.
                        • Le prix est affiché dans l'application avant l'achat et peut varier selon les pays.
                        • L'achat est traité par Apple via l'App Store. Les conditions de paiement d'Apple s'appliquent.
                        • Vous pouvez restaurer vos achats sur un autre appareil via le bouton « Restaurer mes achats ».
                        """)

                        sectionTitle("4. Données personnelles")
                        sectionText("Les données saisies dans l'application (noms de joueurs, matchs, scores) sont stockées localement sur votre appareil. Aucune donnée personnelle n'est collectée, transmise ou stockée sur des serveurs externes.")
                    }

                    Group {
                        sectionTitle("5. Propriété intellectuelle")
                        sectionText("L'application Temps De Jeu, son design, son code source et son contenu sont protégés par le droit d'auteur. Toute reproduction ou distribution non autorisée est interdite.")

                        sectionTitle("6. Limitation de responsabilité")
                        sectionText("L'application est fournie « en l'état ». L'éditeur ne garantit pas l'absence de bugs ou d'interruptions. L'utilisation de l'application se fait sous votre propre responsabilité.")

                        sectionTitle("7. Modifications")
                        sectionText("L'éditeur se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés des modifications importantes via une mise à jour de l'application.")

                        sectionTitle("8. Contact")
                        sectionText("Pour toute question concernant ces conditions, vous pouvez nous contacter à l'adresse : bob.oulhen@gmail.com")

                        sectionTitle("9. Droit applicable")
                        sectionText("Les présentes conditions sont régies par le droit français. Tout litige sera soumis aux tribunaux compétents de Paris, France.")
                    }

                    Text("Dernière mise à jour : 7 février 2026")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(.top, 10)
                }
                .padding()
            }
            .navigationTitle("Conditions d'utilisation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.headline)
    }

    private func sectionText(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
    }
}

// MARK: - Politique de Confidentialité

struct PrivacyPolicyView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Group {
                        sectionTitle("1. Introduction")
                        sectionText("La présente politique de confidentialité décrit comment l'application Temps De Jeu traite vos données. Nous accordons une grande importance à la protection de votre vie privée.")

                        sectionTitle("2. Données collectées")
                        sectionText("""
                        L'application ne collecte aucune donnée personnelle. Les informations que vous saisissez dans l'application (noms de joueurs, compositions d'équipe, scores, statistiques) sont :

                        • Stockées uniquement sur votre appareil (stockage local)
                        • Jamais transmises à des serveurs externes
                        • Jamais partagées avec des tiers
                        • Sous votre contrôle total (vous pouvez les supprimer à tout moment)
                        """)

                        sectionTitle("3. Achats intégrés")
                        sectionText("Les achats intégrés sont gérés exclusivement par Apple via le système StoreKit. Aucune information bancaire ou de paiement n'est accessible par l'application. Consultez la politique de confidentialité d'Apple pour plus d'informations sur le traitement de vos données de paiement.")
                    }

                    Group {
                        sectionTitle("4. Analyse et suivi")
                        sectionText("L'application n'utilise aucun outil d'analyse, de suivi ou de publicité. Aucun cookie, identifiant publicitaire ou technologie de tracking n'est utilisé.")

                        sectionTitle("5. Partage de données")
                        sectionText("Lorsque vous exportez un rapport PDF ou un fichier JSON depuis l'application, ces fichiers sont partagés via le système de partage d'iOS. L'application ne conserve aucune copie de ces exports.")

                        sectionTitle("6. Sécurité")
                        sectionText("Vos données sont protégées par les mécanismes de sécurité natifs d'iOS (chiffrement du stockage, sandbox applicative).")

                        sectionTitle("7. Droits de l'utilisateur")
                        sectionText("""
                        Conformément au RGPD, vous disposez des droits suivants :

                        • Droit d'accès : vos données sont accessibles directement dans l'application
                        • Droit de rectification : vous pouvez modifier vos données à tout moment
                        • Droit de suppression : vous pouvez supprimer vos données depuis l'application ou en désinstallant l'application
                        • Droit à la portabilité : vous pouvez exporter vos données au format JSON
                        """)

                        sectionTitle("8. Contact")
                        sectionText("Pour toute question relative à la protection de vos données personnelles : bob.oulhen@gmail.com")
                    }

                    Text("Dernière mise à jour : 7 février 2026")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(.top, 10)
                }
                .padding()
            }
            .navigationTitle("Politique de confidentialité")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.headline)
    }

    private func sectionText(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
    }
}
