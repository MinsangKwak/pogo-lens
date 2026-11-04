package dev.pogolens.app.capture

internal data class CapturedFrameMetadata(
    val id: String,
    val capturedAt: Long,
    val width: Int,
    val height: Int,
)

internal data class CaptureQueueResult(val frames: List<CapturedFrameMetadata>, val dropped: Int)

// 미확인 캡처에는 프레임 크기와 시각만 남기고 오래되거나 넘친 항목을 제거한다
internal class CaptureQueuePolicy(
    private val maxEntries: Int = 20,
    private val maxAgeMillis: Long = 24 * 60 * 60 * 1_000L,
) {
    fun retain(frames: List<CapturedFrameMetadata>, now: Long): CaptureQueueResult {
        val valid = frames.filter {
            it.id.isNotBlank() && it.width in 1..16_384 && it.height in 1..16_384 &&
                it.capturedAt >= 0 && it.capturedAt >= now - maxAgeMillis && it.capturedAt <= now + 60_000
        }
        val retained = valid.takeLast(maxEntries)
        return CaptureQueueResult(retained, frames.size - retained.size)
    }
}
