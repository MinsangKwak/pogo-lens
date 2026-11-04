package dev.pogolens.app.capture

internal enum class CaptureSizeDecision { KEEP, CONFIGURE_INITIAL, STOP }

// 최초 앱 공유 크기는 받아들이고, 읽기 시작 후 바뀐 영역은 새 세션에서 확인한다
internal class CaptureSizePolicy {
    private var confirmedWidth: Int? = null
    private var confirmedHeight: Int? = null

    fun accept(width: Int, height: Int): CaptureSizeDecision {
        if (width <= 0 || height <= 0) return CaptureSizeDecision.STOP
        if (confirmedWidth == null) {
            confirmedWidth = width
            confirmedHeight = height
            return CaptureSizeDecision.CONFIGURE_INITIAL
        }
        return if (width == confirmedWidth && height == confirmedHeight) {
            CaptureSizeDecision.KEEP
        } else {
            CaptureSizeDecision.STOP
        }
    }
}
