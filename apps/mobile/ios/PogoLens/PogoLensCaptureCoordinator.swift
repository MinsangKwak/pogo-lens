import UIKit
import ReplayKit

@objc(PogoLensCaptureCoordinator)
@MainActor
final class PogoLensCaptureCoordinator: NSObject {
  @objc static let shared = PogoLensCaptureCoordinator()
  private var modernCapture: AnyObject?
  private var modernPipeline: CapturePipeline?

  private var modernAPIAvailable: Bool {
    #if canImport(ScreenCaptureKit)
    if #available(iOS 27.0, *) { return true }
    #endif
    return false
  }

  private var captureAvailable: Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    if #available(iOS 27.0, *) { return modernAPIAvailable }
    return true
    #endif
  }

  @objc func stateJSON() -> String {
    var state: [String: Any] = [
      "protocolVersion": 1, "platform": "ios", "supportsOverlay": false,
      "liveCaptureAvailable": false, "requiresSetup": false, "status": "stopped",
    ]
    do {
      let store = try CaptureStore()
      state["liveCaptureAvailable"] = captureAvailable
      if !captureAvailable {
        state["status"] = "unavailable"
        #if targetEnvironment(simulator)
        state["hint"] = "iOS 실시간 캡처는 실제 기기에서 확인해 주세요."
        #else
        state["hint"] = "이 빌드는 iOS 27 화면 캡처 SDK 연결이 필요해요."
        #endif
      } else if let session = try store.currentSession() {
        let status = session["status"] as? String ?? "stopped"
        guard ["stopped", "starting", "running", "paused"].contains(status) else { throw CaptureStorageError.invalidData }
        let age = CaptureStore.now - (session["heartbeatAt"] as? Double ?? 0)
        let limit: Double = status == "starting" ? 45_000 : 10_000
        state["status"] = age >= 0 && age < limit ? status : "stopped"
        if let hint = session["hint"] as? String { state["hint"] = hint }
      }
      if state["hint"] == nil {
        state["hint"] = "시스템 화면 기록으로 게임을 읽고, 앱으로 돌아와 인식한 숫자를 검토해요. 최대 10분 후 자동 중지돼요."
      }
    } catch CaptureStorageError.notConfigured {
      state["requiresSetup"] = true
      state["status"] = "unavailable"
      state["hint"] = "두 iOS 타깃의 App Group 서명 설정을 먼저 완료해 주세요."
    } catch {
      state["status"] = "unavailable"
      state["hint"] = "캡처 상태를 읽지 못했어요. 시스템 화면 기록을 중지하고 앱의 인식 결과를 초기화해 주세요."
    }
    return Self.json(state)
  }

  @objc func pendingScansJSON() -> String {
    guard let store = try? CaptureStore(), let result = try? store.pendingScans() else {
      return Self.json(["protocolVersion": 1, "scans": []])
    }
    return Self.json(result)
  }

  @objc func clearPendingScans(_ completion: @escaping (NSError?) -> Void) {
    do { try CaptureStore().clearPendingScans(); completion(nil) }
    catch { completion(Self.error("인식 결과를 삭제하지 못했어요. App Group과 기기 잠금 상태를 확인해 주세요.")) }
  }

  @objc func startCapture(_ completion: @escaping (NSError?) -> Void) {
    guard modernCapture == nil else { completion(Self.error("실행 중인 화면 공유를 먼저 중지해 주세요.")); return }
    guard captureAvailable else {
      completion(Self.error("실시간 캡처를 지원하는 실제 iOS 기기와 SDK 빌드가 필요해요.")); return
    }
    do {
      let store = try CaptureStore()
      if let session = try store.currentSession(),
         let status = session["status"] as? String,
         ["starting", "running", "paused"].contains(status),
         CaptureStore.now - (session["heartbeatAt"] as? Double ?? 0) < (status == "starting" ? 45_000 : 10_000) {
        completion(Self.error("이미 준비 중이거나 실행 중인 캡처가 있어요.")); return
      }
      #if canImport(ScreenCaptureKit)
      if #available(iOS 27.0, *) {
        let sessionID = try store.arm(engine: "screencapturekit")
        let pipeline = CapturePipeline(store: store, sessionID: sessionID)
        let capture = ModernScreenCapture()
        capture.onSampleBuffer = { [weak pipeline] in pipeline?.offer($0) }
        capture.onPausedChanged = { [weak pipeline] in pipeline?.setPaused($0) }
        capture.onStarted = { [weak pipeline, weak capture] in
          do { try pipeline?.start() }
          catch { capture?.stop() }
        }
        capture.onStopped = { [weak self, weak pipeline, weak capture] message in
          pipeline?.stop(hint: message)
          guard let self, let capture, self.modernCapture === capture else { return }
          self.modernPipeline = nil
          self.modernCapture = nil
          try? store.writeSession(id: sessionID, status: "stopped", hint: message)
        }
        pipeline.onStop = { [weak capture] in DispatchQueue.main.async { capture?.stop() } }
        modernPipeline = pipeline
        modernCapture = capture
        capture.present()
        completion(nil)
        return
      }
      #endif
      guard let presenter = Self.presenter() else { throw Self.error("캡처 선택 화면을 열 수 없어요.") }
      let sessionID = try store.arm(engine: "replaykit")
      let picker = BroadcastPickerController(store: store, sessionID: sessionID)
      presenter.present(UINavigationController(rootViewController: picker), animated: true) { completion(nil) }
    } catch { completion(error as NSError) }
  }

  @objc func stopCapture(_ completion: @escaping (NSError?) -> Void) {
    do {
      try CaptureStore().requestStop()
      modernPipeline?.stop()
      #if canImport(ScreenCaptureKit)
      if #available(iOS 27.0, *), let capture = modernCapture as? ModernScreenCapture { capture.stop() }
      #endif
      completion(nil)
    } catch { completion(Self.error("중지 요청을 전달하지 못했어요. 시스템 화면 기록 버튼으로 중지해 주세요.")) }
  }

  @objc func copyName(_ name: String, completion: @escaping (NSError?) -> Void) {
    guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
          name.unicodeScalars.count <= 12 else { completion(Self.error("이름을 1~12자로 확인해 주세요.")); return }
    UIPasteboard.general.setItems([[UIPasteboard.typeAutomatic: name]], options: [
      .localOnly: true, .expirationDate: Date().addingTimeInterval(120),
    ])
    completion(nil)
  }

  private static func json(_ value: [String: Any]) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
          let result = String(data: data, encoding: .utf8) else { return "{\"protocolVersion\":1}" }
    return result
  }

  private static func error(_ message: String) -> NSError {
    NSError(domain: "dev.pogolens.capture", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  private static func presenter() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    var controller = scenes.first(where: { $0.activationState == .foregroundActive })?
      .windows.first(where: { $0.isKeyWindow })?.rootViewController
    while let presented = controller?.presentedViewController { controller = presented }
    return controller
  }
}

private final class BroadcastPickerController: UIViewController {
  private let store: CaptureStore
  private let sessionID: String

  init(store: CaptureStore, sessionID: String) {
    self.store = store
    self.sessionID = sessionID
    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "iOS 실시간 인식"
    view.backgroundColor = .systemBackground
    navigationItem.rightBarButtonItem = UIBarButtonItem(title: "닫기", style: .done,
      target: self, action: #selector(close))
    let label = UILabel()
    label.text = "아래 시스템 화면 기록 버튼을 눌러 PoGo Lens를 시작한 뒤 게임으로 이동해 주세요.\n\n원본 화면·영상·소리는 저장하지 않아요. 평가 화면 후보의 최소 숫자만 최대 12개 보관해요. 앱으로 돌아와 직접 검토해야 하며 10분 후 중지돼요.\n\n시스템 화면 기록 표시나 앱의 중지 버튼으로 종료할 수 있어요."
    label.numberOfLines = 0
    label.font = .preferredFont(forTextStyle: .body)
    label.adjustsFontForContentSizeCategory = true
    let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 64, height: 64))
    picker.preferredExtension = Bundle.main.object(forInfoDictionaryKey: "PogoLensBroadcastExtension") as? String
    picker.showsMicrophoneButton = false
    picker.translatesAutoresizingMaskIntoConstraints = false
    let stack = UIStackView(arrangedSubviews: [label, picker])
    stack.axis = .vertical
    stack.spacing = 32
    stack.alignment = .center
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
      stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
      stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 32),
      picker.widthAnchor.constraint(equalToConstant: 64), picker.heightAnchor.constraint(equalToConstant: 64),
    ])
  }

  @objc private func close() {
    if let session = try? store.currentSession(), session["status"] as? String == "starting" {
      try? store.requestStop()
      try? store.writeSession(id: sessionID, status: "stopped")
    }
    dismiss(animated: true)
  }
}
