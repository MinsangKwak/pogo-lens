package dev.pogolens.app.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import dev.pogolens.app.MainActivity
import dev.pogolens.app.R
import dev.pogolens.app.capture.EchoFrameSink
import dev.pogolens.app.capture.FrameResult
import dev.pogolens.app.capture.FrameSink
import dev.pogolens.app.capture.ScreenCapture
import kotlinx.coroutines.launch

// 플로팅 버튼을 띄우고, 탭하면 화면을 캡처해 FrameSink로 넘기는 포그라운드 서비스
class OverlayService : LifecycleService() {

    private var bubble: FloatingBubble? = null
    private var capture: ScreenCapture? = null
    private val sink: FrameSink = EchoFrameSink()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
        val resultData = intent?.getParcelableExtraCompat(EXTRA_RESULT_DATA)
        if (resultData == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        // 캡처 객체는 포그라운드로 올라간 뒤에 만들어야 한다. 순서가 바뀌면 SecurityException
        startForegroundCompat()
        capture = ScreenCapture(this, resultCode, resultData)
        bubble = FloatingBubble(this, onTap = ::onBubbleTapped).also { it.show() }
        isRunning = true
        return START_NOT_STICKY
    }

    private fun onBubbleTapped() {
        val source = capture ?: return
        lifecycleScope.launch {
            val frame = source.captureFrame()
            val result = if (frame == null) FrameResult.Failure("no frame") else sink.onFrame(frame)
            frame?.recycle()
            val message = when (result) {
                is FrameResult.Text -> result.summary
                is FrameResult.Failure -> result.reason
            }
            Toast.makeText(this@OverlayService, message, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        bubble?.hide()
        bubble = null
        capture?.release()
        capture = null
        isRunning = false
        super.onDestroy()
    }

    private fun startForegroundCompat() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel),
                NotificationManager.IMPORTANCE_LOW,
            ),
        )
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setContentIntent(openApp)
            .setOngoing(true)
            .build()

        startForeground(
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
        )
    }

    private fun Intent.getParcelableExtraCompat(key: String): Intent? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(key, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra(key)
        }

    companion object {
        private const val CHANNEL_ID = "overlay"
        private const val NOTIFICATION_ID = 1
        private const val ACTION_STOP = "dev.pogolens.app.action.STOP"
        private const val EXTRA_RESULT_CODE = "resultCode"
        private const val EXTRA_RESULT_DATA = "resultData"

        @Volatile
        var isRunning: Boolean = false
            private set

        fun start(context: Context, resultCode: Int, resultData: Intent) {
            val intent = Intent(context, OverlayService::class.java)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_RESULT_DATA, resultData)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, OverlayService::class.java).setAction(ACTION_STOP)
            context.startService(intent)
        }
    }
}
