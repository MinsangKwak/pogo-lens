package dev.pogolens.app.capture

import android.graphics.Bitmap

// 캡처된 프레임을 받아 처리하는 다음 단계. 지금은 OCR 자리만 잡아 둔다
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
