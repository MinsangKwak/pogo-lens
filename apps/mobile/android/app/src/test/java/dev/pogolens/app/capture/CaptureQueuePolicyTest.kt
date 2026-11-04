package dev.pogolens.app.capture

import org.junit.Assert.assertEquals
import org.junit.Test

class CaptureQueuePolicyTest {
    private val now = 100_000_000L
    private fun frame(id: String, at: Long = now, width: Int = 1080, height: Int = 2400) =
        CapturedFrameMetadata(id, at, width, height)

    @Test fun capacityKeepsLatestAndCountsDroppedFrames() {
        val result = CaptureQueuePolicy().retain((1..25).map { frame(it.toString()) }, now)
        assertEquals(20, result.frames.size)
        assertEquals("6", result.frames.first().id)
        assertEquals("25", result.frames.last().id)
        assertEquals(5, result.dropped)
    }

    @Test fun oldMalformedAndFarFutureMetadataAreRejected() {
        val result = CaptureQueuePolicy().retain(listOf(
            frame("old", now - 86_400_001), frame("future", now + 60_001),
            frame("zero", width = 0), frame(""), frame("valid"),
        ), now)
        assertEquals(listOf("valid"), result.frames.map { it.id })
        assertEquals(4, result.dropped)
    }

    @Test fun multipleReadsDoNotLoseValidUnconfirmedMetadata() {
        val policy = CaptureQueuePolicy()
        val once = policy.retain(listOf(frame("a"), frame("b")), now)
        val twice = policy.retain(once.frames, now + 1_000)
        assertEquals(once.frames, twice.frames)
        assertEquals(0, twice.dropped)
    }
}
