package dev.pogolens.app.nativebridge

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import dev.pogolens.app.capture.CaptureMailbox
import dev.pogolens.app.overlay.OverlayService
import dev.pogolens.app.overlay.OverlayState
import org.json.JSONObject

@ReactModule(name = PogoLensCaptureModule.NAME)
class PogoLensCaptureModule(private val context: ReactApplicationContext) : NativePogoLensCaptureSpec(context) {
    @Volatile private var projectionPromise: Promise? = null
    @Volatile private var invalidated = false
    private val mailbox = CaptureMailbox(context)
    private val requests = ProjectionRequestTracker()
    private val activityListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (!requests.consume(requestCode)) return
            val pending = projectionPromise ?: return
            projectionPromise = null
            if (invalidated) return
            if (resultCode != Activity.RESULT_OK || data == null) {
                pending.reject("E_CAPTURE_CANCELLED", "화면 캡처 동의를 취소했어요.")
                return
            }
            try {
                if (!Settings.canDrawOverlays(context)) {
                    pending.reject("E_OVERLAY_PERMISSION", "다른 앱 위에 표시 권한을 먼저 허용해 주세요.")
                    return
                }
                OverlayService.start(context, resultCode, data)
                pending.resolve(null)
            } catch (error: Exception) {
                pending.reject("E_CAPTURE_START", "캡처를 시작하지 못했어요. 다시 동의해 주세요.", error)
            }
        }
    }

    init {
        context.addActivityEventListener(activityListener)
    }

    override fun getName(): String = NAME

    override fun getState(promise: Promise) {
        val overlayGranted = Settings.canDrawOverlays(context)
        val status = when {
            projectionPromise != null -> "starting"
            OverlayService.state.value == OverlayState.RUNNING -> "running"
            OverlayService.state.value == OverlayState.STARTING -> "starting"
            else -> "stopped"
        }
        promise.resolve(JSONObject().apply {
            put("protocolVersion", 1)
            put("platform", "android")
            put("supportsOverlay", true)
            put("liveCaptureAvailable", true)
            put("status", status)
            put("requiresSetup", !overlayGranted)
            put("overlayGranted", overlayGranted)
            put("hint", if (overlayGranted) "캡처 결과를 확인한 뒤 개체값을 직접 입력해 주세요." else "다른 앱 위에 표시 권한을 먼저 허용해 주세요.")
        }.toString())
    }

    override fun requestOverlayPermission(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val activity = context.currentActivity
            if (invalidated || activity == null) {
                promise.reject("E_ACTIVITY_UNAVAILABLE", "앱 화면을 연 뒤 다시 시도해 주세요.")
                return@runOnUiThread
            }
            try {
                if (!Settings.canDrawOverlays(context)) {
                    if (OverlayService.state.value != OverlayState.STOPPED) OverlayService.stop(context)
                    activity.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")))
                }
                promise.resolve(null)
            } catch (error: Exception) {
                promise.reject("E_OVERLAY_SETTINGS", "오버레이 설정을 열지 못했어요.", error)
            }
        }
    }

    override fun startCapture(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val activity = context.currentActivity
            if (invalidated || activity == null) {
                promise.reject("E_ACTIVITY_UNAVAILABLE", "앱 화면을 연 뒤 다시 시도해 주세요.")
                return@runOnUiThread
            }
            if (!Settings.canDrawOverlays(context)) {
                promise.reject("E_OVERLAY_PERMISSION", "다른 앱 위에 표시 권한을 먼저 허용해 주세요.")
                return@runOnUiThread
            }
            if (projectionPromise != null || OverlayService.state.value != OverlayState.STOPPED) {
                promise.reject("E_CAPTURE_BUSY", "진행 중인 캡처 요청이나 세션을 먼저 종료해 주세요.")
                return@runOnUiThread
            }
            try {
                projectionPromise = promise
                val manager = context.getSystemService(MediaProjectionManager::class.java)
                activity.startActivityForResult(manager.createScreenCaptureIntent(), requests.begin())
            } catch (error: Exception) {
                requests.cancel()
                projectionPromise = null
                promise.reject("E_CAPTURE_PERMISSION", "화면 캡처 동의를 요청하지 못했어요.", error)
            }
        }
    }

    override fun stopCapture(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            requests.cancel()
            projectionPromise?.reject("E_CAPTURE_CANCELLED", "화면 캡처 요청을 중지했어요.")
            projectionPromise = null
            try {
                if (OverlayService.state.value != OverlayState.STOPPED) OverlayService.stop(context)
                promise.resolve(null)
            } catch (error: Exception) {
                promise.reject("E_CAPTURE_STOP", "캡처 중지 상태를 확인하지 못했어요.", error)
            }
        }
    }

    override fun getPendingScans(promise: Promise) {
        try {
            promise.resolve(mailbox.read())
        } catch (error: Exception) {
            promise.reject("E_CAPTURE_INBOX", "미확인 캡처 목록을 읽지 못했어요.", error)
        }
    }

    override fun clearPendingScans(promise: Promise) {
        try {
            mailbox.clear()
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("E_CAPTURE_INBOX", "미확인 캡처 목록을 비우지 못했어요.", error)
        }
    }

    override fun copyName(name: String, promise: Promise) {
        if (name.isBlank() || name.codePointCount(0, name.length) > 12 ||
            name.codePoints().anyMatch { Character.isISOControl(it) || Character.getType(it) == Character.FORMAT.toInt() }) {
            promise.reject("E_INVALID_NAME", "이름은 보이는 문자 1~12자로 입력해 주세요.")
            return
        }
        UiThreadUtil.runOnUiThread {
            try {
                val clipboard = context.getSystemService(ClipboardManager::class.java)
                clipboard.setPrimaryClip(ClipData.newPlainText("PoGo Lens 이름 제안", name))
                promise.resolve(null)
            } catch (error: Exception) {
                promise.reject("E_CLIPBOARD", "이름을 복사하지 못했어요.", error)
            }
        }
    }

    override fun invalidate() {
        invalidated = true
        context.removeActivityEventListener(activityListener)
        UiThreadUtil.runOnUiThread {
            requests.cancel()
            projectionPromise?.reject("E_MODULE_INVALIDATED", "앱 연결이 바뀌어 캡처 요청을 취소했어요.")
            projectionPromise = null
        }
        super.invalidate()
    }

    companion object {
        const val NAME = "PogoLensCapture"
    }
}
