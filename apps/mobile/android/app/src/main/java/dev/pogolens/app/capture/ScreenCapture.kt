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

enum class CaptureStopReason { SYSTEM, CONTENT_RESIZED, CONFIGURATION_FAILED }

// 화면 이미지는 메모리에만 두고 요청 완료 또는 세션 종료 시 해제한다
class ScreenCapture(
    context: Context,
    resultCode: Int,
    resultData: Intent,
    private val onStopped: (CaptureStopReason) -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private val projection: MediaProjection = checkNotNull(
        context.getSystemService(MediaProjectionManager::class.java)
            .getMediaProjection(resultCode, resultData),
    ) { "MediaProjection consent is missing or no longer valid" }
    private var reader: ImageReader? = null
    private var display: VirtualDisplay? = null
    private var pending: CancellableContinuation<Bitmap?>? = null
    private var released = false
    private val sizePolicy = CaptureSizePolicy()
    private var initialSizeReady = Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE
    private var width = 0
    private var height = 0
    private val densityDpi = context.resources.displayMetrics.densityDpi
    private val callback = object : MediaProjection.Callback() {
        override fun onStop() {
            release()
            onStopped(CaptureStopReason.SYSTEM)
        }

        override fun onCapturedContentResize(width: Int, height: Int) {
            if (released) return
            when (sizePolicy.accept(width, height)) {
                CaptureSizeDecision.KEEP -> Unit
                CaptureSizeDecision.CONFIGURE_INITIAL -> {
                    try {
                        configureInitialSize(width, height)
                        initialSizeReady = true
                    } catch (error: Exception) {
                        release()
                        onStopped(CaptureStopReason.CONFIGURATION_FAILED)
                    }
                }
                CaptureSizeDecision.STOP -> {
                    release()
                    onStopped(CaptureStopReason.CONTENT_RESIZED)
                }
            }
        }
    }

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
                "pogo-lens", width, height, densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, source.surface, null, null,
            )
        } catch (error: Exception) {
            release()
            throw error
        }
    }

    suspend fun captureFrame(): Bitmap? = suspendCancellableCoroutine { cont ->
        val source = reader
        if (released || source == null || !initialSizeReady) {
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

    private fun configureInitialSize(capturedWidth: Int, capturedHeight: Int) {
        if (capturedWidth == width && capturedHeight == height) return
        val currentDisplay = checkNotNull(display)
        val next = ImageReader.newInstance(capturedWidth, capturedHeight, PixelFormat.RGBA_8888, 2)
        try {
            currentDisplay.resize(capturedWidth, capturedHeight, densityDpi)
            currentDisplay.surface = next.surface
        } catch (error: Exception) {
            next.close()
            throw error
        }
        reader?.close()
        reader = next
        width = capturedWidth
        height = capturedHeight
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

