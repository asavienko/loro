package expo.modules.loromedia

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager

/**
 * What playing in the background asks of the system, held while the one player plays:
 *
 * - **Audio focus** for the whole session rather than for each clip (expo-audio is set to mix on
 *   Android, so it asks for none). A call or another app taking the sound pauses the player; a
 *   short interruption (a call) resumes it afterwards.
 * - **Headphones unplugged** pause it, as in every media app.
 * - **A partial wake lock**, so the loop's silences (the learner's turn, the rating hold) are timed
 *   with the screen off: between clips nothing else keeps the CPU awake.
 *
 * Pauses and resumes go to the app as commands, as if pressed in the notification. Main thread.
 */
class Playback(context: Context) {
  private val context = context.applicationContext
  private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
  private val main = Handler(Looper.getMainLooper())
  private var request: AudioFocusRequest? = null
  private var focused = false
  /** Paused by a short loss of focus: resumes when it comes back. */
  private var resumeOnGain = false
  private var noisyRegistered = false
  private val wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "loro:player").apply { setReferenceCounted(false) }

  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    main.post {
      when (change) {
        AudioManager.AUDIOFOCUS_LOSS -> {
          // Another app plays now: pause, and don't come back on our own.
          resumeOnGain = false
          abandonFocus()
          LoroMediaBridge.send("pause")
        }
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
          // A call, an assistant: pause and wait for the sound to come back.
          resumeOnGain = true
          LoroMediaBridge.send("pause")
        }
        AudioManager.AUDIOFOCUS_GAIN -> if (resumeOnGain) {
          resumeOnGain = false
          LoroMediaBridge.send("play")
        }
        // AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK: the system lowers the volume for a moment.
      }
    }
  }

  private val noisy = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) LoroMediaBridge.send("pause")
    }
  }

  /** The app's player started or stopped playing (every update says which). */
  fun update(playing: Boolean) {
    if (playing) start() else stop(keepFocusForResume = resumeOnGain)
  }

  fun stop(keepFocusForResume: Boolean = false) {
    if (!keepFocusForResume) {
      resumeOnGain = false
      abandonFocus()
    }
    if (noisyRegistered) {
      context.unregisterReceiver(noisy)
      noisyRegistered = false
    }
    // A moment more awake, for the app to save what just changed (a pause, a rating); then sleep.
    if (wakeLock.isHeld) wakeLock.acquire(SETTLE_MS)
  }

  private fun start() {
    resumeOnGain = false
    if (!focused && !requestFocus()) {
      // A call is on: nothing plays over it.
      LoroMediaBridge.send("pause")
      return
    }
    if (!noisyRegistered) {
      val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) context.registerReceiver(noisy, filter, Context.RECEIVER_NOT_EXPORTED)
      else context.registerReceiver(noisy, filter)
      noisyRegistered = true
    }
    // Renewed with every update while playing; the timeout only guards against a lost release.
    wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS)
  }

  private fun requestFocus(): Boolean {
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        .setOnAudioFocusChangeListener(focusListener, main)
        .build()
      request = focusRequest
      audio.requestAudioFocus(focusRequest)
    } else {
      @Suppress("DEPRECATION")
      audio.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
    }
    focused = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    return focused
  }

  private fun abandonFocus() {
    if (!focused) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      request?.let { audio.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      audio.abandonAudioFocus(focusListener)
    }
    request = null
    focused = false
  }

  private companion object {
    const val WAKE_LOCK_TIMEOUT_MS = 10 * 60 * 1000L
    const val SETTLE_MS = 3_000L
  }
}
