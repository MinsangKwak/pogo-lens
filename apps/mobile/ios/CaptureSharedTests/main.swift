import Foundation
import CoreGraphics

let korean = PokemonFrameText.minimalSnippet(["CP 1500", "120/120 HP", "공격", "방어", "알림: 개인 메시지"])
precondition(korean == "CP 1500\n120/120 HP\n공격\n방어", "Only bounded game labels and numbers may cross the capture boundary")
precondition(PokemonFrameText.minimalSnippet(["은행", "CP 1500", "계좌 123456", "금액 120/120"]) == nil)
precondition(PokemonFrameText.minimalSnippet(["CP 1500", "120/120 HP", "HP"]) == nil, "A health label alone is not appraisal context")
precondition(PokemonFrameText.minimalSnippet(["CP 1500 private message", "120/120 HP", "Attack"]) == nil)
precondition(PokemonFrameText.minimalSnippet(["CP 1", "1/1 HP", "Attack"]) != nil)
let bounded = PokemonFrameText.minimalSnippet(["CP 1", "1/1 HP", "Attack"] + Array(repeating: "Defense", count: 1000))!
precondition(bounded.split(separator: "\n").count <= 12 && bounded.count <= 500)
print("PASS: game-frame context, private-text rejection, minimal output and size bounds")

func appraisalImage(barWidth: Int) -> CGImage {
  let context = CGContext(data: nil, width: 64, height: 64, bitsPerComponent: 8,
    bytesPerRow: 64 * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
  context.setFillColor(CGColor(red: 1, green: 0.3, blue: 0.1, alpha: 1))
  context.fill(CGRect(x: 8, y: 20, width: CGFloat(barWidth), height: 4))
  context.fill(CGRect(x: 8, y: 28, width: 32, height: 4))
  context.fill(CGRect(x: 8, y: 36, width: 32, height: 4))
  return context.makeImage()!
}

let sameCPHPFirst = CaptureFrameFingerprint.make(appraisalImage(barWidth: 20), width: 1290, height: 2796, orientation: 1)!
let sameCPHPSecond = CaptureFrameFingerprint.make(appraisalImage(barWidth: 24), width: 1290, height: 2796, orientation: 1)!
let identicalFrame = CaptureFrameFingerprint.make(appraisalImage(barWidth: 20), width: 1290, height: 2796, orientation: 1)!
precondition(sameCPHPFirst != sameCPHPSecond, "Different IV-bar pixels must survive identical CP/HP text")
precondition(sameCPHPFirst == identicalFrame, "An unchanged frame has a stable in-memory fingerprint")
var dedup = CaptureDedupPolicy()
precondition(dedup.shouldEmit(sessionID: "first-session", fingerprint: sameCPHPFirst))
precondition(!dedup.shouldEmit(sessionID: "first-session", fingerprint: identicalFrame))
precondition(dedup.shouldEmit(sessionID: "first-session", fingerprint: sameCPHPSecond))
precondition(dedup.shouldEmit(sessionID: "second-session", fingerprint: sameCPHPSecond), "New sessions must retain the first frame even if visually unchanged")
dedup.reset()
precondition(dedup.shouldEmit(sessionID: "second-session", fingerprint: sameCPHPSecond), "Returning after another screen or clearing results starts a new observation")
print("PASS: pixel-based IV-bar distinction, consecutive-frame suppression, session boundaries and reset")
