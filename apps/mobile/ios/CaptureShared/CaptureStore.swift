import Foundation

enum CaptureStorageError: Error {
  case notConfigured
  case invalidData
  case tooLarge
}

// The host owns control.json; native capture owns session.json and bounded text observations.
final class CaptureStore {
  static let protocolVersion = 1
  static let maximumScans = 12
  static let maximumJSONBytes = 48 * 1024
  static let sessionLifetimeMS: Double = 10 * 60 * 1000
  let directory: URL

  init() throws {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "PogoLensAppGroup") as? String,
          !group.isEmpty,
          let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw CaptureStorageError.notConfigured
    }
    directory = container.appendingPathComponent("CaptureIPC-v1", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.complete])
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    var protectedDirectory = directory
    try protectedDirectory.setResourceValues(values)
  }

  static var now: Double { Date().timeIntervalSince1970 * 1000 }

  func read(_ name: String) throws -> [String: Any]? {
    let url = directory.appendingPathComponent(name)
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
    guard size > 0, size <= Self.maximumJSONBytes else { throw CaptureStorageError.tooLarge }
    let data = try Data(contentsOf: url)
    guard data.count <= Self.maximumJSONBytes,
          let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          object["protocolVersion"] as? Int == Self.protocolVersion else {
      throw CaptureStorageError.invalidData
    }
    return object
  }

  func write(_ object: [String: Any], to name: String) throws {
    let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    guard data.count <= Self.maximumJSONBytes else { throw CaptureStorageError.tooLarge }
    try data.write(to: directory.appendingPathComponent(name), options: [.atomic, .completeFileProtection])
  }

  func arm(engine: String) throws -> String {
    let oldControl = try read("control.json")
    let sessionID = UUID().uuidString
    let now = Self.now
    try write([
      "protocolVersion": 1, "sessionId": sessionID, "engine": engine,
      "requestedAt": now, "expiresAt": now + Self.sessionLifetimeMS,
      "stopRequested": false, "clearBefore": oldControl?["clearBefore"] as? Double ?? 0,
    ], to: "control.json")
    try writeSession(id: sessionID, status: "starting")
    return sessionID
  }

  func control(for sessionID: String) throws -> [String: Any] {
    guard let control = try read("control.json"),
          control["sessionId"] as? String == sessionID,
          control["stopRequested"] as? Bool == false,
          let expiresAt = control["expiresAt"] as? Double, expiresAt > Self.now else {
      throw CaptureStorageError.invalidData
    }
    return control
  }

  func requestStop() throws {
    guard var control = try read("control.json") else { return }
    control["stopRequested"] = true
    try write(control, to: "control.json")
  }

  func writeSession(id: String, status: String, hint: String? = nil) throws {
    guard try read("control.json")?["sessionId"] as? String == id else { return }
    var session: [String: Any] = [
      "protocolVersion": 1, "sessionId": id, "status": status, "heartbeatAt": Self.now,
    ]
    if let hint { session["hint"] = String(hint.prefix(180)) }
    try write(session, to: "session.json")
  }

  func currentSession() throws -> [String: Any]? {
    guard let control = try read("control.json"), let id = control["sessionId"] as? String else { return nil }
    if let session = try read("session.json"), session["sessionId"] as? String == id { return session }
    let requestedAt = control["requestedAt"] as? Double ?? 0
    let age = Self.now - requestedAt
    guard age >= 0, age < 45_000, control["stopRequested"] as? Bool == false else { return nil }
    return ["protocolVersion": 1, "sessionId": id, "status": "starting", "heartbeatAt": requestedAt]
  }

  func pendingScans() throws -> [String: Any] {
    let cutoff = try read("control.json")?["clearBefore"] as? Double ?? 0
    let stored = try read("scans.json")
    let scans = (stored?["scans"] as? [[String: Any]] ?? []).filter {
      ($0["capturedAt"] as? Double ?? 0) > cutoff &&
      Self.now - ($0["capturedAt"] as? Double ?? 0) < Self.sessionLifetimeMS
    }
    return ["protocolVersion": 1, "scans": Array(scans.suffix(Self.maximumScans)),
      "droppedCount": stored?["droppedCount"] as? Int ?? 0]
  }

  func appendScan(_ scan: [String: Any], sessionID: String) throws -> Bool {
    let control = try self.control(for: sessionID)
    let cutoff = control["clearBefore"] as? Double ?? 0
    guard (scan["capturedAt"] as? Double ?? 0) > cutoff else { return false }
    var envelope = try pendingScans()
    var scans = envelope["scans"] as? [[String: Any]] ?? []
    scans.append(scan)
    let overflow = max(0, scans.count - Self.maximumScans)
    envelope["scans"] = Array(scans.suffix(Self.maximumScans))
    envelope["droppedCount"] = (envelope["droppedCount"] as? Int ?? 0) + overflow
    try write(envelope, to: "scans.json")
    return true
  }

  func clearPendingScans() throws {
    var control = try read("control.json") ?? ["protocolVersion": 1]
    control["clearBefore"] = Self.now
    try write(control, to: "control.json")
    try write(["protocolVersion": 1, "scans": [], "droppedCount": 0], to: "scans.json")
  }
}
