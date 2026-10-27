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
import android.os.Build
import android.util.DisplayMetrics
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

// 화면 이미지는 메모리에만 두고 요청 완료 또는 세션 종료 시 해제한다
class ScreenCapture(
    context: Context,
    resultCode: Int,
    resultData: Intent,
    private val onStopped: () -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private val projection: MediaProjection =
        context.getSystemService(MediaProjectionManager::class.java)
            .getMediaProjection(resultCode, resultData)
    private var reader: ImageReader? = null
    private var display: VirtualDisplay? = null
    private var pending: CancellableContinuation<Bitmap?>? = null
    private var released = false
    private val callback = object : MediaProjection.Callback() {
        override fun onStop() {
            release()
            onStopped()
        }
    }
    private val width: Int
    private val height: Int

    init {
        val windowManager = context.getSystemService(WindowManager::class.java)
        val metrics = DisplayMetrics()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = windowManager.maximumWindowMetrics.bounds
            metrics.widthPixels = bounds.width()
            metrics.heightPixels = bounds.height()
        } else {
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.getRealMetrics(metrics)
        }
        width = metrics.widthPixels
        height = metrics.heightPixels
        try {
            projection.registerCallback(callback, handler)
            val source = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
            reader = source
            display = projection.createVirtualDisplay(
                "pogo-lens", width, height, context.resources.displayMetrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, source.surface, null, null,
            )
        } catch (error: Exception) {
            release()
            throw error
        }
    }

    suspend fun captureFrame(): Bitmap? = suspendCancellableCoroutine { cont ->
        val source = reader
        if (released || source == null) {
            cont.resume(null)
            return@suspendCancellableCoroutine
        }
        check(pending == null) { "capture already pending" }
        pending = cont
        source.setOnImageAvailableListener({ current ->
            if (!cont.isActive) return@setOnImageAvailableListener
            current.setOnImageAvailableListener(null, null)
            pending = null
            try {
                val image = current.acquireLatestImage()
                if (image == null) {
                    cont.resume(null)
                    return@setOnImageAvailableListener
                }
                val bitmap = image.use {
                    val plane = it.planes[0]
                    val padding = (plane.rowStride - plane.pixelStride * width) / plane.pixelStride
                    val padded = Bitmap.createBitmap(width + padding, height, Bitmap.Config.ARGB_8888)
                    try {
                        padded.copyPixelsFromBuffer(plane.buffer)
                        if (padding == 0) padded else Bitmap.createBitmap(padded, 0, 0, width, height)
                            .also { padded.recycle() }
                    } catch (error: Exception) {
                        padded.recycle()
                        throw error
                    }
                }
                cont.resume(bitmap) { _, value, _ -> value?.recycle() }
            } catch (error: Exception) {
                if (cont.isActive) cont.resumeWithException(error)
            }
        }, handler)
        cont.invokeOnCancellation {
            handler.post {
                if (pending === cont) {
                    reader?.setOnImageAvailableListener(null, null)
                    pending = null
                }
            }
        }
    }

    fun release() {
        if (released) return
        released = true
        reader?.setOnImageAvailableListener(null, null)
        pending?.let { if (it.isActive) it.resume(null) }
        pending = null
        display?.release()
        display = null
        reader?.close()
        reader = null
        projection.unregisterCallback(callback)
        projection.stop()
    }
}
