package expo.modules.loromedia

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The one player on the lock screen and in the notification shade (src/audio/lockScreen.ts):
 * `show` says what is playing and what it offers, `hide` takes it away, and each press there comes
 * back as an `onCommand` event. `wait` is a timer for the loop's silences: React Native's own timers
 * stop once the app leaves the screen, and the loop goes on with the screen locked.
 *
 * Only text crosses this bridge, and only into the system's media controls: no audio, no recording.
 */
class LoroMediaModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var playback: Playback? = null

  override fun definition() = ModuleDefinition {
    Name("LoroMedia")

    Events("onCommand")

    OnCreate {
      LoroMediaBridge.onCommand = { command -> sendEvent("onCommand", command) }
    }

    OnDestroy {
      LoroMediaBridge.onCommand = null
      main.post {
        playback?.stop()
        LoroMediaService.hide()
      }
    }

    Function("show") { record: NowPlayingRecord ->
      val nowPlaying = record.toNowPlaying()
      val context = (appContext.reactContext ?: throw Exceptions.ReactContextLost()).applicationContext
      main.post {
        val held = playback ?: Playback(context).also { playback = it }
        held.update(nowPlaying.playing)
        LoroMediaService.show(context, nowPlaying)
      }
    }

    Function("hide") {
      main.post {
        playback?.stop()
        LoroMediaService.hide()
      }
    }

    AsyncFunction("wait") { ms: Double, promise: Promise ->
      main.postDelayed({ promise.resolve(null) }, ms.toLong().coerceAtLeast(0L))
    }
  }
}
