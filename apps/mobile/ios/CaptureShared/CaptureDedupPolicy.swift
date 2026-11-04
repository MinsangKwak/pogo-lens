import Foundation

// This suppresses consecutive frame delivery, never identifies or merges Pokemon entities.
struct CaptureDedupPolicy {
  private var lastSessionID: String?
  private var lastFingerprint: UInt64?

  mutating func shouldEmit(sessionID: String, fingerprint: UInt64) -> Bool {
    if lastSessionID == sessionID && lastFingerprint == fingerprint { return false }
    lastSessionID = sessionID
    lastFingerprint = fingerprint
    return true
  }

  mutating func reset() {
    lastSessionID = nil
    lastFingerprint = nil
  }
}
