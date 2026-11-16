//
//  PresentationHelpers.swift
//  Temps De Jeu
//

import SwiftUI

extension View {
    /// Feuille plus grande sur iPad et Mac (vue 3D confortable)
    @ViewBuilder
    func largeSheetSizing() -> some View {
        if #available(iOS 18.0, *) {
            presentationSizing(.page)
        } else {
            self
        }
    }

    /// Ouvre une page de lecture (mode d'emploi, textes légaux) :
    /// en feuille sur iPhone et iPad, dans la fenêtre sur Mac.
    ///
    /// Sur Mac (macOS 26), une feuille est une fenêtre à part qui ne reçoit pas
    /// le défilement du trackpad ni de la molette : il part vers la fenêtre
    /// principale, en dessous, et le texte de la feuille reste figé. La page est
    /// donc poussée dans la pile de navigation, avec un bouton retour.
    /// À appliquer à l'intérieur d'une `NavigationStack`.
    @ViewBuilder
    func readingPage<Page: View>(isPresented: Binding<Bool>, @ViewBuilder page: @escaping () -> Page) -> some View {
        #if targetEnvironment(macCatalyst)
        navigationDestination(isPresented: isPresented, destination: page)
        #else
        sheet(isPresented: isPresented, content: page)
        #endif
    }
}

/// Page de lecture : un titre et un texte qui défile
/// (mode d'emploi, conditions d'utilisation, confidentialité).
/// Ouverte avec `readingPage(isPresented:page:)`.
struct ReadingPage<Content: View>: View {
    private let title: LocalizedStringKey
    private let content: Content
    @Environment(\.dismiss) private var dismiss

    init(title: LocalizedStringKey, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        #if targetEnvironment(macCatalyst)
        // Poussée dans la fenêtre : le bouton retour remplace « Fermer »
        ScrollView {
            content
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        #else
        NavigationStack {
            ScrollView {
                content
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
        #endif
    }
}
