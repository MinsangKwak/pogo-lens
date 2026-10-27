package dev.pogolens.app.capture

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.WindowManager
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

// MediaProjection으로 화면 한 프레임을 Bitmap으로 떠 온다
// 가상 디스플레이는 서비스가 살아 있는 동안 유지하고, 프레임은 요청할 때만 읽는다
class ScreenCapture(
    private val context: Context,
    resultCode: Int,
    resultData: Intent,
) {
    private val projection: MediaProjection
    private val reader: ImageReader
    private val display: VirtualDisplay
    private val width: Int
    private val height: Int

    init {
        val manager = context.getSystemService(MediaProjectionManager::class.java)
        projection = manager.getMediaProjection(resultCode, resultData)
        // Android 14부터 콜백 등록이 필수다. 사용자가 캡처를 끊으면 여기로 들어온다
        projection.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                release()
            }
        }, Handler(Looper.getMainLooper()))

        val metrics = screenMetrics()
        width = metrics.widthPixels
        height = metrics.heightPixels
        // maxImages=2: 최신 프레임 하나와 읽는 중인 프레임 하나
        reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        display = projection.createVirtualDisplay(
            "pogo-lens",
            width,
            height,
            metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface,
            null,
            null,
        )
    }

    // 다음 프레임이 들어올 때까지 기다렸다가 Bitmap으로 변환한다
    suspend fun captureFrame(): Bitmap? = suspendCancellableCoroutine { cont ->
        reader.setOnImageAvailableListener({ r ->
            r.setOnImageAvailableListener(null, null)
            val image = r.acquireLatestImage() ?: run {
                cont.resume(null)
                return@setOnImageAvailableListener
            }
            try {
                val plane = image.planes[0]
                val rowStride = plane.rowStride
                val pixelStride = plane.pixelStride
                val padding = (rowStride - pixelStride * width) / pixelStride
                val padded = Bitmap.createBitmap(width + padding, height, Bitmap.Config.ARGB_8888)
                padded.copyPixelsFromBuffer(plane.buffer)
                val cropped = if (padding == 0) padded
                else Bitmap.createBitmap(padded, 0, 0, width, height).also { padded.recycle() }
                cont.resume(cropped)
            } finally {
                image.close()
            }
        }, Handler(Looper.getMainLooper()))
        cont.invokeOnCancellation { reader.setOnImageAvailableListener(null, null) }
    }

    fun release() {
        display.release()
        reader.close()
        projection.stop()
    }

    private fun screenMetrics(): DisplayMetrics {
        val wm = context.getSystemService(WindowManager::class.java)
        val bounds = wm.maximumWindowMetrics.bounds
        return DisplayMetrics().apply {
            widthPixels = bounds.width()
            heightPixels = bounds.height()
            densityDpi = context.resources.displayMetrics.densityDpi
        }
    }
}
