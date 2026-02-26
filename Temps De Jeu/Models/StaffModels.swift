//
//  StaffModels.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 26/02/2026.
//

import Foundation

/// Rôle d'un encadrant
struct StaffRole: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var isCustom: Bool  // false pour les rôles prédéfinis, true pour les rôles créés par l'utilisateur

    init(id: UUID = UUID(), name: String, isCustom: Bool = false) {
        self.id = id
        self.name = name
        self.isCustom = isCustom
    }

    /// Rôles prédéfinis
    static let defaultRoles: [StaffRole] = [
        StaffRole(name: "Coach", isCustom: false),
        StaffRole(name: "Coach adjoint", isCustom: false),
        StaffRole(name: "Arbitre", isCustom: false),
        StaffRole(name: "Délégué", isCustom: false),
        StaffRole(name: "Préparateur physique", isCustom: false),
        StaffRole(name: "Entraîneur des gardiens", isCustom: false),
        StaffRole(name: "Intendant", isCustom: false),
        StaffRole(name: "Responsable médical", isCustom: false)
    ]
}

/// Un membre de l'encadrement
struct StaffMember: Identifiable, Codable, Hashable {
    let id: UUID
    var firstName: String
    var lastName: String
    var roleId: UUID        // Référence vers StaffRole.id
    var phone: String
    var email: String
    var photoData: Data?
    var profileIds: Set<UUID>  // Catégories/équipes auxquelles l'encadrant est assigné

    init(
        id: UUID = UUID(),
        firstName: String = "",
        lastName: String = "",
        roleId: UUID = UUID(),
        phone: String = "",
        email: String = "",
        photoData: Data? = nil,
        profileIds: Set<UUID> = []
    ) {
        self.id = id
        self.firstName = firstName
        self.lastName = lastName
        self.roleId = roleId
        self.phone = phone
        self.email = email
        self.photoData = photoData
        self.profileIds = profileIds
    }

    /// Nom complet
    var fullName: String {
        let name = "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? "Encadrant" : name
    }
}
