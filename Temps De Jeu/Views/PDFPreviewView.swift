//
//  PDFPreviewView.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 07/02/2026.
//

import SwiftUI
import PDFKit

/// Vue de prévisualisation PDF intégrée
struct PDFPreviewView: View {
    let pdfData: Data
    let title: String
    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false

    var body: some View {
        NavigationStack {
            PDFKitView(data: pdfData)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            let fileName = "\(title.replacingOccurrences(of: " ", with: "_")).pdf"
                            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                            try? pdfData.write(to: tempURL)
                            showShareSheet = true
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Fermer") { dismiss() }
                    }
                }
                .sheet(isPresented: $showShareSheet) {
                    let fileName = "\(title.replacingOccurrences(of: " ", with: "_")).pdf"
                    let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                    ActivityView(activityItems: [tempURL])
                }
        }
    }
}

/// UIViewRepresentable pour PDFView
struct PDFKitView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.document = PDFDocument(data: data)
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        if uiView.document == nil {
            uiView.document = PDFDocument(data: data)
        }
        DispatchQueue.main.async {
            uiView.layoutDocumentView()
            if uiView.document?.pageCount ?? 0 > 0 {
                uiView.goToFirstPage(nil)
            }
        }
    }
}
