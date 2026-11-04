import Foundation
import CoreMedia
import CoreImage
import CoreGraphics
import CoreVideo
import ImageIO
import Vision

// Full frames and recognized free text never cross the native capture boundary.
final class CapturePipeline {
  private let store: CaptureStore
  private let sessionID: String
  private let lock = NSRecursiveLock()
  private let queue = DispatchQueue(label: "dev.pogolens.capture.ocr", qos: .utility)
  private let context = CIContext(options: [.useSoftwareRenderer: true, .cacheIntermediates: false])
  private var heartbeat: DispatchSourceTimer?
  private var activeRequest: VNRecognizeTextRequest?
  private var isRunning = false
  private var isPaused = false
  private var isProcessing = false
  private var lastAcceptedAt: TimeInterval = 0
  private var startedAt: TimeInterval = 0
  private var allowedApplication: Bool?
  private var dedup = CaptureDedupPolicy()
  private var lastClearBefore: Double = 0
  var onStop: (() -> Void)?

  init(store: CaptureStore, sessionID: String) {
    self.store = store
    self.sessionID = sessionID
  }

  func start() throws {
    lock.lock()
    defer { lock.unlock() }
    let control = try store.control(for: sessionID)
    lastClearBefore = control["clearBefore"] as? Double ?? 0
    dedup.reset()
    isRunning = true
    startedAt = ProcessInfo.processInfo.systemUptime
    try store.writeSession(id: sessionID, status: "running")
    let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .utility))
    timer.schedule(deadline: .now() + 1, repeating: 2)
    timer.setEventHandler { [weak self] in self?.tick() }
    heartbeat = timer
    timer.resume()
  }

  func setPaused(_ paused: Bool) {
    lock.lock()
    defer { lock.unlock() }
    guard isRunning else { return }
    isPaused = paused
    if paused {
      activeRequest?.cancel()
      dedup.reset()
    }
    try? store.writeSession(id: sessionID, status: paused ? "paused" : "running")
  }

  func setApplication(bundleID: String?) {
    lock.lock()
    defer { lock.unlock() }
    let allowed = bundleID.map { $0 == "com.nianticlabs.pokemongo" }
    if allowed != allowedApplication { dedup.reset() }
    allowedApplication = allowed
    if allowedApplication == false { activeRequest?.cancel() }
  }

  func stop(hint: String? = nil) {
    lock.lock()
    defer { lock.unlock() }
    guard isRunning else { return }
    isRunning = false
    dedup.reset()
    activeRequest?.cancel()
    activeRequest = nil
    heartbeat?.cancel()
    heartbeat = nil
    try? store.writeSession(id: sessionID, status: "stopped", hint: hint)
  }

  private func tick() {
    lock.lock()
    guard isRunning else { lock.unlock(); return }
    do {
      guard ProcessInfo.processInfo.systemUptime - startedAt < 600 else { throw CaptureStorageError.invalidData }
      let control = try store.control(for: sessionID)
      let clearBefore = control["clearBefore"] as? Double ?? 0
      if clearBefore > lastClearBefore {
        dedup.reset()
        lastClearBefore = clearBefore
      }
      try store.writeSession(id: sessionID, status: isPaused ? "paused" : "running")
      lock.unlock()
    } catch {
      stop(hint: "캡처를 중지했어요. 10분 제한 또는 앱의 중지 요청을 확인해 주세요.")
      let callback = onStop
      lock.unlock()
      callback?()
    }
  }

  func offer(_ sampleBuffer: CMSampleBuffer, orientation: CGImagePropertyOrientation = .up) {
    let now = ProcessInfo.processInfo.systemUptime
    lock.lock()
    guard isRunning, !isPaused, allowedApplication != false, !isProcessing,
          now - lastAcceptedAt >= 1,
          let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { lock.unlock(); return }
    let pixelCount = CVPixelBufferGetWidth(buffer) * CVPixelBufferGetHeight(buffer)
    guard pixelCount > 0, pixelCount <= 16_777_216 else { lock.unlock(); return }
    isProcessing = true
    lastAcceptedAt = now
    let capturedAt = CaptureStore.now
    lock.unlock()
    queue.async { [weak self] in
      guard let self else { return }
      autoreleasepool {
        self.process(buffer, orientation: orientation, capturedAt: capturedAt)
      }
      self.lock.lock()
      self.isProcessing = false
      self.lock.unlock()
    }
  }

  private func process(_ buffer: CVPixelBuffer, orientation: CGImagePropertyOrientation, capturedAt: Double) {
    let started = ProcessInfo.processInfo.systemUptime
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.01
    if let supported = try? request.supportedRecognitionLanguages() {
      let languages = ["ko-KR", "en-US"].filter { supported.contains($0) }
      if !languages.isEmpty { request.recognitionLanguages = languages }
    }
    lock.lock()
    guard isRunning, !isPaused, allowedApplication != false else { lock.unlock(); return }
    activeRequest = request
    lock.unlock()
    let deadline = DispatchWorkItem { request.cancel() }
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 1.5, execute: deadline)
    var hasCandidate = false
    defer {
      deadline.cancel()
      lock.lock()
      if activeRequest === request { activeRequest = nil }
      if !hasCandidate { dedup.reset() }
      lock.unlock()
    }
    let width = CVPixelBufferGetWidth(buffer)
    let height = CVPixelBufferGetHeight(buffer)
    guard width > 0, height > 0, width <= 8192, height <= 8192 else { return }
    let image = CIImage(cvPixelBuffer: buffer)
    let scale = min(1, 960 / CGFloat(max(width, height)))
    let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    guard let thumbnail = context.createCGImage(scaled, from: scaled.extent) else { return }
    do {
      try VNImageRequestHandler(cgImage: thumbnail, orientation: orientation).perform([request])
      guard ProcessInfo.processInfo.systemUptime - started < 1.5 else { return }
      let lines = (request.results ?? []).prefix(80).compactMap { observation -> String? in
        guard let result = observation.topCandidates(1).first, result.confidence >= 0.7 else { return nil }
        return String(result.string.prefix(100))
      }
      guard let text = PokemonFrameText.minimalSnippet(lines) else {
        resetDuplicateTracking()
        return
      }
      guard let fingerprint = CaptureFrameFingerprint.make(thumbnail, width: width, height: height,
        orientation: orientation.rawValue) else { return }
      hasCandidate = true
      lock.lock()
      defer { lock.unlock() }
      guard isRunning, !isPaused, allowedApplication != false else { return }
      guard dedup.shouldEmit(sessionID: sessionID, fingerprint: fingerprint) else { return }
      var stored = false
      defer { if !stored { dedup.reset() } }
      stored = try store.appendScan([
        "id": UUID().uuidString, "source": "ios-broadcast", "capturedAt": capturedAt,
        "text": text, "width": width, "height": height,
      ], sessionID: sessionID)
    } catch {
      // A failed or cancelled OCR request produces no observation.
    }
  }

  private func resetDuplicateTracking() {
    lock.lock()
    dedup.reset()
    lock.unlock()
  }

}
