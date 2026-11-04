import ReplayKit
import CoreMedia
import ImageIO

final class SampleHandler: RPBroadcastSampleHandler {
  private var pipeline: CapturePipeline?
  private var sessionID: String?

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    do {
      let store = try CaptureStore()
      guard let control = try store.read("control.json"),
            control["engine"] as? String == "replaykit",
            let sessionID = control["sessionId"] as? String,
            let requestedAt = control["requestedAt"] as? Double,
            CaptureStore.now - requestedAt >= 0,
            CaptureStore.now - requestedAt < 45_000 else { throw CaptureStorageError.invalidData }
      self.sessionID = sessionID
      let pipeline = CapturePipeline(store: store, sessionID: sessionID)
      pipeline.onStop = { [weak self] in self?.finishWithMessage("PoGo Lens 캡처를 중지했어요.") }
      try pipeline.start()
      self.pipeline = pipeline
    } catch {
      finishWithMessage("PoGo Lens 앱에서 캡처를 준비한 뒤 시스템 화면 기록 버튼으로 시작해 주세요.")
    }
  }

  override func broadcastPaused() { pipeline?.setPaused(true) }

  override func broadcastResumed() { pipeline?.setPaused(false) }

  override func broadcastFinished() {
    pipeline?.stop()
    pipeline = nil
  }

  override func broadcastAnnotated(withApplicationInfo applicationInfo: [AnyHashable: Any]) {
    pipeline?.setApplication(bundleID: applicationInfo[RPApplicationInfoBundleIdentifierKey] as? String)
  }

  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
    guard sampleBufferType == .video else { return }
    let value = CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString,
      attachmentModeOut: nil) as? NSNumber
    let orientation = value.flatMap { CGImagePropertyOrientation(rawValue: $0.uint32Value) } ?? .up
    pipeline?.offer(sampleBuffer, orientation: orientation)
  }

  private func finishWithMessage(_ message: String) {
    pipeline?.stop(hint: message)
    if let sessionID, let store = try? CaptureStore() {
      try? store.writeSession(id: sessionID, status: "stopped", hint: message)
    }
    DispatchQueue.main.async { [weak self] in
      self?.finishBroadcastWithError(NSError(domain: "dev.pogolens.capture", code: 1,
        userInfo: [NSLocalizedDescriptionKey: message]))
    }
  }
}
