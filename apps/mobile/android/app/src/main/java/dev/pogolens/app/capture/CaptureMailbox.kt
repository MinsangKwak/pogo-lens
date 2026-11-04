package dev.pogolens.app.capture

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

// 이 저장소에는 이미지나 동영상을 쓰지 않는다. JS가 복귀하면 미확인 메타데이터만 읽는다
class CaptureMailbox(context: Context) {
    private val preferences = context.getSharedPreferences("capture_metadata", Context.MODE_PRIVATE)
    private val policy = CaptureQueuePolicy()

    fun appendFrame(width: Int, height: Int, capturedAt: Long) = synchronized(lock) {
        val previous = decode(preferences.getString(KEY_FRAMES, "[]") ?: "[]")
        val result = policy.retain(previous + CapturedFrameMetadata(UUID.randomUUID().toString(), capturedAt, width, height), capturedAt)
        persist(result, preferences.getInt(KEY_DROPPED, 0))
    }

    fun read(): String = synchronized(lock) {
        val previous = decode(preferences.getString(KEY_FRAMES, "[]") ?: "[]")
        val result = policy.retain(previous, System.currentTimeMillis())
        val dropped = preferences.getInt(KEY_DROPPED, 0)
        persist(result, dropped)
        JSONObject().apply {
            put("protocolVersion", 1)
            put("scans", encode(result.frames))
            put("droppedCount", (dropped.toLong() + result.dropped).coerceAtMost(Int.MAX_VALUE.toLong()))
        }.toString()
    }

    fun clear() = synchronized(lock) {
        preferences.edit().remove(KEY_FRAMES).remove(KEY_DROPPED).apply()
    }

    private fun persist(result: CaptureQueueResult, previousDropped: Int) {
        preferences.edit()
            .putString(KEY_FRAMES, encode(result.frames).toString())
            .putInt(KEY_DROPPED, (previousDropped.toLong() + result.dropped).coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
            .apply()
    }

    private fun decode(text: String): List<CapturedFrameMetadata> {
        require(text.length <= 65_536) { "capture metadata is oversized" }
        val array = JSONArray(text)
        return (0 until array.length()).map { index ->
            val row = array.getJSONObject(index)
            CapturedFrameMetadata(row.getString("id"), row.getLong("capturedAt"), row.getInt("width"), row.getInt("height"))
        }
    }

    private fun encode(frames: List<CapturedFrameMetadata>): JSONArray = JSONArray().apply {
        frames.forEach { frame ->
            put(JSONObject().apply {
                put("id", frame.id)
                put("source", "android-capture")
                put("capturedAt", frame.capturedAt)
                put("text", "")
                put("width", frame.width)
                put("height", frame.height)
            })
        }
    }

    companion object {
        private val lock = Any()
        private const val KEY_FRAMES = "frames"
        private const val KEY_DROPPED = "dropped"
    }
}
