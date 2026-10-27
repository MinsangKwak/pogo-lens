package dev.pogolens.app

import android.Manifest
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import dev.pogolens.app.overlay.OverlayService

// 권한 두 개(오버레이, 화면 캡처)를 받고 오버레이 서비스를 켜고 끄는 진입 화면
class MainActivity : AppCompatActivity() {

    private lateinit var overlayStatus: TextView
    private lateinit var captureStatus: TextView
    private lateinit var captureToggle: Button

    private val projectionLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            if (result.resultCode != RESULT_OK || data == null) {
                captureStatus.setText(R.string.status_stopped)
                return@registerForActivityResult
            }
            OverlayService.start(this, result.resultCode, data)
            refresh()
        }

    private val notificationLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        overlayStatus = findViewById(R.id.overlayStatus)
        captureStatus = findViewById(R.id.captureStatus)
        captureToggle = findViewById(R.id.captureToggleButton)

        findViewById<Button>(R.id.overlayPermissionButton).setOnClickListener {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName"),
            )
            startActivity(intent)
        }

        captureToggle.setOnClickListener {
            if (OverlayService.isRunning) {
                OverlayService.stop(this)
                refresh()
            } else {
                requestProjection()
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun requestProjection() {
        if (!Settings.canDrawOverlays(this)) {
            overlayStatus.setText(R.string.status_overlay_missing)
            return
        }
        // 캡처 동의는 세션마다 다시 받아야 한다. 토큰을 저장해 재사용할 수 없다
        val manager = getSystemService(MediaProjectionManager::class.java)
        projectionLauncher.launch(manager.createScreenCaptureIntent())
    }

    private fun refresh() {
        val canOverlay = Settings.canDrawOverlays(this)
        overlayStatus.setText(
            if (canOverlay) R.string.status_overlay_ready else R.string.status_overlay_missing,
        )
        val running = OverlayService.isRunning
        captureStatus.setText(if (running) R.string.status_running else R.string.status_stopped)
        captureToggle.setText(if (running) R.string.capture_stop else R.string.capture_start)
    }
}
