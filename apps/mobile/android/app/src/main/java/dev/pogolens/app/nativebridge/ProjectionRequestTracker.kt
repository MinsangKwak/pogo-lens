package dev.pogolens.app.nativebridge

import java.util.concurrent.atomic.AtomicInteger

// 취소한 시스템 동의 결과가 새 요청의 결과로 처리되지 않도록 요청 번호를 구분한다
internal class ProjectionRequestTracker {
    private var activeCode: Int? = null

    fun begin(): Int {
        check(activeCode == null) { "projection request already active" }
        val code = requestSequence.updateAndGet { if (it >= 60_000) 58_000 else it + 1 }
        activeCode = code
        return code
    }

    fun consume(code: Int): Boolean {
        if (activeCode != code) return false
        activeCode = null
        return true
    }

    fun cancel() {
        activeCode = null
    }

    companion object {
        private val requestSequence = AtomicInteger(58_000)
    }
}
