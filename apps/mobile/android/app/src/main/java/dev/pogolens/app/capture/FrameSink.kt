package dev.pogolens.app.capture

import android.graphics.Bitmap

// Bitmap은 호출 동안만 빌린다. 반환 후 재사용하지 않고 취소 시 후속 처리를 중단한다
interface FrameSink {
    suspend fun onFrame(frame: Bitmap): FrameResult
}

sealed interface FrameResult {
    data class Text(val summary: String) : FrameResult
    data class Failure(val reason: String) : FrameResult
}

// 1단계 확인용: 프레임 크기만 돌려준다. OCR 파이프라인이 붙으면 교체한다
class EchoFrameSink : FrameSink {
    override suspend fun onFrame(frame: Bitmap): FrameResult =
        FrameResult.Text("${frame.width}x${frame.height}")
}

