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
}
