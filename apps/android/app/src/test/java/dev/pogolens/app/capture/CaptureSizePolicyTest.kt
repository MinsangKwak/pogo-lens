package dev.pogolens.app.capture

import org.junit.Assert.assertEquals
import org.junit.Test

class CaptureSizePolicyTest {
    @Test
    fun initialAppWindowDoesNotHaveToMatchPhysicalDisplay() {
        val policy = CaptureSizePolicy()
        assertEquals(CaptureSizeDecision.CONFIGURE_INITIAL, policy.accept(800, 1200))
        assertEquals(CaptureSizeDecision.KEEP, policy.accept(800, 1200))
    }

    @Test
    fun rotationOrResizeAfterInitialSizingStopsTheSession() {
        val policy = CaptureSizePolicy()
        policy.accept(800, 1200)
        assertEquals(CaptureSizeDecision.STOP, policy.accept(1200, 800))
        assertEquals(CaptureSizeDecision.STOP, policy.accept(800, 1000))
    }

    @Test
    fun invalidDimensionsAreNeverAccepted() {
        val policy = CaptureSizePolicy()
        assertEquals(CaptureSizeDecision.STOP, policy.accept(0, 1200))
        assertEquals(CaptureSizeDecision.STOP, policy.accept(800, -1))
        assertEquals(CaptureSizeDecision.CONFIGURE_INITIAL, policy.accept(800, 1200))
        assertEquals(CaptureSizeDecision.STOP, policy.accept(0, 0))
    }
}
