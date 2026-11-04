#if canImport(ScreenCaptureKit) && os(iOS)
@preconcurrency import ScreenCaptureKit
import CoreMedia
import Foundation

@available(iOS 27.0, *)
final class ModernScreenCapture: NSObject, SCStreamDelegate, SCStreamOutput {
    var onSampleBuffer: ((CMSampleBuffer) -> Void)?
    var onStarted: (() -> Void)?
    var onStopped: ((String?) -> Void)?
    var onPausedChanged: ((Bool) -> Void)?

    private let picker = SCContentSharingPicker.shared
    private let sampleQueue = DispatchQueue(label: "dev.pogolens.capture.screen", qos: .utility)
    private let outputLock = NSLock()
    private var outputStreamID: ObjectIdentifier?
    private var lastDeliveredAt: TimeInterval = 0
    private var stream: SCStream?
    private var pendingStream: SCStream?
    private var starting = false
    private var outstanding = false
    private var contentInactive = false
    private var generation = 0
    private var pickerObserver: ModernPickerObserver?

    func present() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in self?.present() }
            return
        }
        guard !outstanding else { return }
        generation += 1
        outstanding = true
        var configuration = SCContentSharingPickerConfiguration()
        configuration.showsMicrophoneControl = false
        picker.defaultConfiguration = configuration
        let observer = ModernPickerObserver(owner: self, generation: generation)
        pickerObserver = observer
        picker.add(observer)
        picker.isActive = true
        picker.present()
    }

    func stop() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in self?.stop() }
            return
        }
        finish(reason: nil)
    }

    fileprivate func pickerUpdated(filter: SCContentFilter, selectedStream: SCStream?, token: Int) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.outstanding, token == self.generation else { return }
            guard !self.starting, self.stream == nil, selectedStream == nil else {
                self.finish(reason: "공유 대상이 바뀌어 중지했어요. 대상과 범위를 확인한 뒤 다시 시작해 주세요.")
                return
            }
            self.beginStream(filter: filter)
        }
    }

    fileprivate func pickerCanceled(token: Int) {
        DispatchQueue.main.async { [weak self] in
            guard let self, token == self.generation else { return }
            self.finish(reason: nil)
        }
    }

    fileprivate func pickerFailed(token: Int) {
        DispatchQueue.main.async { [weak self] in
            guard let self, token == self.generation else { return }
            self.finish(reason: "시스템 화면 공유를 시작하지 못했어요. 기기의 화면 기록 권한과 제한을 확인해 주세요.")
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.stream === stream || self.pendingStream === stream else { return }
            self.finish(reason: "시스템 화면 공유가 중지됐어요.")
        }
    }

    func streamDidBecomeInactive(_ stream: SCStream) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.stream === stream || self.pendingStream === stream else { return }
            self.contentInactive = true
            self.onPausedChanged?(true)
        }
    }

    func streamDidBecomeActive(_ stream: SCStream) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.stream === stream || self.pendingStream === stream else { return }
            self.contentInactive = false
            self.onPausedChanged?(false)
        }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid, CMSampleBufferDataIsReady(sampleBuffer),
              CMSampleBufferGetImageBuffer(sampleBuffer) != nil,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let rawStatus = attachments.first?[.status] as? Int,
              SCFrameStatus(rawValue: rawStatus) == .complete else { return }
        let now = ProcessInfo.processInfo.systemUptime
        outputLock.lock()
        let accepted = outputStreamID == ObjectIdentifier(stream) && now - lastDeliveredAt >= 1
        if accepted { lastDeliveredAt = now }
        outputLock.unlock()
        guard accepted else { return }
        // 프레임은 처리 콜백 동안만 전달하며 영상·음성 파일이나 녹화 출력을 만들지 않는다
        onSampleBuffer?(sampleBuffer)
    }

    private func beginStream(filter: SCContentFilter) {
        starting = true
        let token = generation
        let configuration = SCStreamConfiguration()
        configuration.capturesAudio = false
        let candidate = SCStream(filter: filter, configuration: configuration, delegate: self)
        pendingStream = candidate
        do {
            try candidate.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)
        } catch {
            finish(reason: "화면 분석 출력을 준비하지 못했어요.")
            return
        }
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                try await candidate.startCapture()
                guard self.outstanding, token == self.generation else {
                    try? await candidate.stopCapture()
                    return
                }
                self.pendingStream = nil
                self.stream = candidate
                self.starting = false
                self.activateOutput(candidate)
                self.onStarted?()
                if self.contentInactive { self.onPausedChanged?(true) }
            } catch {
                guard token == self.generation else { return }
                self.finish(reason: "화면 공유가 시작되지 않았어요. 시스템 선택 화면에서 다시 확인해 주세요.")
            }
        }
    }

    private func activateOutput(_ stream: SCStream) {
        outputLock.lock()
        outputStreamID = ObjectIdentifier(stream)
        lastDeliveredAt = 0
        outputLock.unlock()
    }

    private func finish(reason: String?) {
        guard outstanding else { return }
        outstanding = false
        generation += 1
        let token = generation
        outputLock.lock()
        outputStreamID = nil
        outputLock.unlock()
        picker.isActive = false
        if let observer = pickerObserver { picker.remove(observer) }
        pickerObserver = nil
        let previous = stream ?? pendingStream
        stream = nil
        pendingStream = nil
        starting = false
        contentInactive = false
        guard let previous else {
            onStopped?(reason)
            return
        }
        Task { @MainActor [weak self] in
            try? await previous.stopCapture()
            guard let self, token == self.generation else { return }
            self.onStopped?(reason)
        }
    }
}

@available(iOS 27.0, *)
private final class ModernPickerObserver: NSObject, SCContentSharingPickerObserver {
    private weak var owner: ModernScreenCapture?
    private let generation: Int

    init(owner: ModernScreenCapture, generation: Int) {
        self.owner = owner
        self.generation = generation
    }

    func contentSharingPicker(_ picker: SCContentSharingPicker, didUpdateWith filter: SCContentFilter, for stream: SCStream?) {
        owner?.pickerUpdated(filter: filter, selectedStream: stream, token: generation)
    }

    func contentSharingPicker(_ picker: SCContentSharingPicker, didCancelFor stream: SCStream?) {
        owner?.pickerCanceled(token: generation)
    }

    func contentSharingPickerStartDidFailWithError(_ error: Error) {
        owner?.pickerFailed(token: generation)
    }
}
#endif
