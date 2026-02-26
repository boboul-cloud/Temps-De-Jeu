//
//  StaffManager.swift
//  Temps De Jeu
//
//  Created by Robert Oulhen on 26/02/2026.
//

import Foundation

/// Gestionnaire de l'encadrement — stockage global (partagé entre profils)
@MainActor
class StaffManager {
    static let shared = StaffManager()

    private let staffKey = "staffMembers"
    private let rolesKey = "staffRoles"
    private let rolesInitializedKey = "staffRolesInitialized"

    private init() {
        initializeDefaultRolesIfNeeded()
    }

    // MARK: - Rôles

    /// Initialise les rôles par défaut au premier lancement
    private func initializeDefaultRolesIfNeeded() {
        guard !UserDefaults.standard.bool(forKey: rolesInitializedKey) else { return }
        saveRoles(StaffRole.defaultRoles)
        UserDefaults.standard.set(true, forKey: rolesInitializedKey)
    }

    /// Charge tous les rôles disponibles
    func loadRoles() -> [StaffRole] {
        guard let data = UserDefaults.standard.data(forKey: rolesKey) else {
            return StaffRole.defaultRoles
        }
        do {
            return try JSONDecoder().decode([StaffRole].self, from: data)
        } catch {
            print("Erreur chargement rôles encadrement: \(error)")
            return StaffRole.defaultRoles
        }
    }

    /// Sauvegarde les rôles
    func saveRoles(_ roles: [StaffRole]) {
        do {
            let data = try JSONEncoder().encode(roles)
            UserDefaults.standard.set(data, forKey: rolesKey)
        } catch {
            print("Erreur sauvegarde rôles encadrement: \(error)")
        }
    }

    /// Ajoute un rôle personnalisé
    func addCustomRole(name: String) -> StaffRole {
        var roles = loadRoles()
        let newRole = StaffRole(name: name, isCustom: true)
        roles.append(newRole)
        saveRoles(roles)
        return newRole
    }

    /// Supprime un rôle personnalisé (seulement les custom)
    func deleteRole(_ roleId: UUID) {
        var roles = loadRoles()
        roles.removeAll { $0.id == roleId && $0.isCustom }
        saveRoles(roles)
    }

    // MARK: - Encadrants

    /// Charge tous les encadrants
    func loadAllStaff() -> [StaffMember] {
        guard let data = UserDefaults.standard.data(forKey: staffKey) else { return [] }
        do {
            return try JSONDecoder().decode([StaffMember].self, from: data)
        } catch {
            print("Erreur chargement encadrants: \(error)")
            return []
        }
    }

    /// Charge les encadrants du profil actif
    func loadStaff() -> [StaffMember] {
        let all = loadAllStaff()
        guard let profile = ProfileManager.shared.activeProfile else { return all }
        return all.filter { $0.profileIds.contains(profile.id) }
    }

    /// Charge les encadrants d'un profil spécifique
    func loadStaff(forProfileId profileId: UUID) -> [StaffMember] {
        let all = loadAllStaff()
        return all.filter { $0.profileIds.contains(profileId) }
    }

    /// Sauvegarde tous les encadrants
    func saveAllStaff(_ staff: [StaffMember]) {
        do {
            let data = try JSONEncoder().encode(staff)
            UserDefaults.standard.set(data, forKey: staffKey)
        } catch {
            print("Erreur sauvegarde encadrants: \(error)")
        }
    }

    /// Ajoute ou met à jour un encadrant
    func saveStaffMember(_ member: StaffMember) {
        var all = loadAllStaff()
        if let idx = all.firstIndex(where: { $0.id == member.id }) {
            all[idx] = member
        } else {
            all.append(member)
        }
        saveAllStaff(all)
    }

    /// Supprime un encadrant
    func deleteStaffMember(_ memberId: UUID) {
        var all = loadAllStaff()
        all.removeAll { $0.id == memberId }
        saveAllStaff(all)
    }

    /// Nom du rôle pour un ID donné
    func roleName(for roleId: UUID) -> String {
        let roles = loadRoles()
        return roles.first(where: { $0.id == roleId })?.name ?? "Inconnu"
    }
}
