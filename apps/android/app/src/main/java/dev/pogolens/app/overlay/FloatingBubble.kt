package dev.pogolens.app.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import dev.pogolens.app.R
import kotlin.math.abs

// 드래그로 옮길 수 있는 플로팅 버튼. 짧게 누르면 onTap, 끌면 위치만 바뀐다
class FloatingBubble(
    private val context: Context,
    private val onTap: () -> Unit,
) {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private var view: View? = null

    private val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT,
    ).apply {
        gravity = Gravity.TOP or Gravity.START
        x = 24
        y = 300
    }

    @SuppressLint("ClickableViewAccessibility", "InflateParams")
    fun show() {
        if (view != null) return
        val bubble = LayoutInflater.from(context).inflate(R.layout.overlay_bubble, null)
        bubble.setOnTouchListener(DragOrTapListener())
        windowManager.addView(bubble, params)
        view = bubble
    }

    fun hide() {
        view?.let { windowManager.removeView(it) }
        view = null
    }

    private inner class DragOrTapListener : View.OnTouchListener {
        private var startX = 0
        private var startY = 0
        private var touchX = 0f
        private var touchY = 0f
        private var moved = false

        override fun onTouch(v: View, event: MotionEvent): Boolean {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = params.x
                    startY = params.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - touchX).toInt()
                    val dy = (event.rawY - touchY).toInt()
                    if (abs(dx) > TAP_SLOP || abs(dy) > TAP_SLOP) moved = true
                    if (moved) {
                        params.x = startX + dx
                        params.y = startY + dy
                        windowManager.updateViewLayout(v, params)
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) {
                        v.performClick()
                        onTap()
                    }
                }
            }
            return true
        }
    }

    private companion object {
        const val TAP_SLOP = 12
    }
}
