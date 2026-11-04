package dev.pogolens.app.nativebridge

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProjectionRequestTrackerTest {
    @Test fun cancelledResultCannotCompleteANewerPermissionRequest() {
        val tracker = ProjectionRequestTracker()
        val oldCode = tracker.begin()
        tracker.cancel()
        val newCode = tracker.begin()
        assertNotEquals(oldCode, newCode)
        assertFalse(tracker.consume(oldCode))
        assertTrue(tracker.consume(newCode))
    }

    @Test fun invalidatedModuleRequestCannotCompleteANewModuleRequest() {
        val old = ProjectionRequestTracker()
        val oldCode = old.begin()
        old.cancel()
        val fresh = ProjectionRequestTracker()
        val newCode = fresh.begin()
        assertFalse(fresh.consume(oldCode))
        assertTrue(fresh.consume(newCode))
    }

    @Test fun permissionResultIsConsumedOnlyOnce() {
        val tracker = ProjectionRequestTracker()
        val code = tracker.begin()
        assertTrue(tracker.consume(code))
        assertFalse(tracker.consume(code))
    }
}
