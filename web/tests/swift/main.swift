import Foundation

struct ProfileBackupData: Codable {
    let profile: TeamProfile
    let matches: [Match]
    let trainingSessions: [TrainingSession]
    let currentSeason: Season?
    let seasonArchives: [SeasonArchive]
}

struct FullBackup: Codable {
    let version: Int
    let exportDate: Date
    let appVersion: String?
    let players: [Player]
    let staffMembers: [StaffMember]
    let staffRoles: [StaffRole]
    let profilesData: [ProfileBackupData]
    var tactics: [TacticPlay]? = nil
    var trainingPlans: [TrainingPlan]? = nil
}

struct PlayersExportWrapper: Codable { let teamCode: String?; let teamName: String?; let players: [Player] }
struct MatchesExportWrapper: Codable { let teamCode: String?; let teamName: String?; let matches: [Match] }
struct StaffExportWrapper: Codable { let teamCode: String?; let teamName: String?; let staffMembers: [StaffMember]; let staffRoles: [StaffRole] }

func allerRetour<T: Codable>(_ type: T.Type, _ e: String, _ s: String) throws {
    let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601
    let v = try d.decode(T.self, from: Data(contentsOf: URL(fileURLWithPath: e)))
    let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]; enc.dateEncodingStrategy = .iso8601
    try enc.encode(v).write(to: URL(fileURLWithPath: s))
}

let args = CommandLine.arguments
if args.count > 3 && args[1] != "stable" {
    let (mode, e, s) = (args[1], args[2], args[3])
    do {
        switch mode {
        case "roster": try allerRetour(RosterExport.self, e, s)
        case "matches": try allerRetour(MatchesExportWrapper.self, e, s)
        case "players": try allerRetour(PlayersExportWrapper.self, e, s)
        case "staff": try allerRetour(StaffExportWrapper.self, e, s)
        case "training": try allerRetour(TrainingAttendanceExport.self, e, s)
        case "tactics": let t = try TacticFile.decode(from: Data(contentsOf: URL(fileURLWithPath: e))); try TacticFile.encode(t).write(to: URL(fileURLWithPath: s))
        case "draft": try allerRetour([TrainingPlan].self, e, s)
        default: print("mode inconnu"); exit(2)
        }
        print("Swift lit \(mode) : OK")
    } catch { print("ÉCHEC Swift \(mode) : \(error)"); exit(1) }
    exit(0)
}
if args.count > 1 && args[1] == "stable" {
    for t in args.dropFirst(2) { print(UUID.stable(from: t).uuidString) }
    exit(0)
}
let entree = URL(fileURLWithPath: args[1])
let sortie = URL(fileURLWithPath: args[2])
let decoder = JSONDecoder()
decoder.dateDecodingStrategy = .iso8601
do {
    let backup = try decoder.decode(FullBackup.self, from: Data(contentsOf: entree))
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    encoder.dateEncodingStrategy = .iso8601
    try encoder.encode(backup).write(to: sortie)
    print("Swift : lu \(backup.profilesData.count) catégories, \(backup.players.count) joueurs, \(backup.profilesData.reduce(0) { $0 + $1.matches.count }) matchs, \(backup.tactics?.count ?? 0) exercices, \(backup.trainingPlans?.count ?? 0) séances")
} catch {
    print("ÉCHEC du décodage Swift : \(error)")
    exit(1)
}
