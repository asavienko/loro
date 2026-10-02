package expo.modules.loromedia

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * The one player's media session and its notification: at the top of the shade and on the lock
 * screen, with play or pause, next and previous, and the three grades while the item can be rated.
 * A foreground service of type mediaPlayback while it plays, so the loop goes on with the screen
 * locked. media3 builds the notification (and, from Android 13, the system builds its controls from
 * the session); this service only says what to show and passes every press back to the app.
 *
 * The grades take the slots beside play or pause: Hard before it and Easy after it, so the lock
 * screen's compact controls read Hard, play or pause, Easy. Missed goes to the first extra slot.
 * Samsung One UI's shade draws that slot first (Missed, Hard, play or pause, Easy); stock Android
 * 16 draws it after Easy (Hard, Easy, Missed, Next, play or pause apart). The system's controls
 * have five slots, so while the grades show,
 * "previous" gives way to them (the bar above the tabs has no previous button either) and Next
 * becomes a button of ours. Headset and Bluetooth next and previous still work: the player keeps
 * both commands.
 */
@OptIn(UnstableApi::class)
class LoroMediaService : MediaSessionService() {
  private var session: MediaSession? = null
  private var player: LoroPlayer? = null
  private var channelName: String? = null

  override fun onCreate() {
    super.onCreate()
    val provider = DefaultMediaNotificationProvider.Builder(this)
      .setChannelId(CHANNEL_ID)
      .setNotificationId(NOTIFICATION_ID)
      .build()
    provider.setSmallIcon(R.drawable.loro_media_small_icon)
    setMediaNotificationProvider(provider)

    val loroPlayer = LoroPlayer(Looper.getMainLooper())
    val builder = MediaSession.Builder(this, loroPlayer)
      // Its own id: expo-audio's session (unused by the app, but linked in) has the default one.
      .setId(SESSION_ID)
      .setCallback(Callback())
    openApp()?.let { builder.setSessionActivity(it) }
    val built = builder.build()
    player = loroPlayer
    session = built
    addSession(built)
    instance = this
    val first = pending
    pending = null
    // Hidden again before the service came up: nothing to show.
    if (first != null) show(first) else stopSelf()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

  override fun onDestroy() {
    instance = null
    session?.release()
    player?.release()
    session = null
    player = null
    super.onDestroy()
  }

  private fun show(nowPlaying: NowPlaying) {
    ensureChannel(nowPlaying.channelName)
    player?.update(nowPlaying)
    session?.setMediaButtonPreferences(buttons(nowPlaying))
  }

  private fun clear() {
    player?.update(null)
    session?.setMediaButtonPreferences(emptyList())
    stopSelf()
  }

  /** The grades (with the one given marked) and Next, or nothing beyond the standard controls. */
  private fun buttons(nowPlaying: NowPlaying): List<CommandButton> {
    val grades = nowPlaying.grades ?: return emptyList()
    val slots = mapOf(
      Grade.MISSED to intArrayOf(CommandButton.SLOT_OVERFLOW),
      Grade.HARD to intArrayOf(CommandButton.SLOT_BACK, CommandButton.SLOT_OVERFLOW),
      Grade.EASY to intArrayOf(CommandButton.SLOT_FORWARD, CommandButton.SLOT_OVERFLOW),
    )
    val icons = mapOf(
      Grade.MISSED to R.drawable.loro_media_grade_missed,
      Grade.HARD to R.drawable.loro_media_grade_hard,
      Grade.EASY to R.drawable.loro_media_grade_easy,
    )
    val buttons = Grade.entries.mapNotNull { grade ->
      val button = grades.firstOrNull { it.grade == grade } ?: return@mapNotNull null
      CommandButton.Builder(CommandButton.ICON_UNDEFINED)
        .setCustomIconResId(if (button.selected) R.drawable.loro_media_grade_given else icons.getValue(grade))
        .setDisplayName(if (button.selected) button.detail else button.label)
        .setSessionCommand(SessionCommand(grade.action, Bundle.EMPTY))
        .setSlots(*slots.getValue(grade))
        .build()
    }.toMutableList()
    if (nowPlaying.canNext) {
      buttons += CommandButton.Builder(CommandButton.ICON_NEXT)
        .setDisplayName(nowPlaying.nextLabel)
        .setSessionCommand(SessionCommand(ACTION_NEXT, Bundle.EMPTY))
        .setSlots(CommandButton.SLOT_OVERFLOW)
        .build()
    }
    return buttons
  }

  /** The channel, named in the learner's language (the app's copy), made before media3 would make its own. */
  private fun ensureChannel(name: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || name.isEmpty() || name == channelName) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    // Creating an existing channel again only renames it; its importance and the learner's choices stay.
    manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
    channelName = name
  }

  private fun openApp(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private inner class Callback : MediaSession.Callback {
    override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult {
      // The service isn't exported: only this app's notification and the system's media controls
      // (through the session) reach it, and they may press every button it shows.
      val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
      for (action in CUSTOM_ACTIONS) commands.add(SessionCommand(action, Bundle.EMPTY))
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session).setAvailableSessionCommands(commands.build()).build()
    }

    override fun onCustomCommand(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
      customCommand: SessionCommand,
      args: Bundle,
    ): ListenableFuture<SessionResult> {
      val action = customCommand.customAction
      val grade = Grade.ofAction(action)
      val item = player?.current
      when {
        // The rating names the item it was shown on: if the app has moved on since, it is dropped.
        grade != null && item?.grades != null -> LoroMediaBridge.send("rate", mapOf("grade" to grade.key, "id" to item.id))
        action == ACTION_NEXT -> LoroMediaBridge.send("next")
        else -> return Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED))
      }
      return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
    }
  }

  companion object {
    private const val TAG = "LoroMedia"
    private const val CHANNEL_ID = "loro_player"
    private const val NOTIFICATION_ID = 0x10a0
    private const val SESSION_ID = "loro"
    private const val ACTION_NEXT = "app.loro.media.NEXT"
    private val CUSTOM_ACTIONS = Grade.entries.map { it.action } + ACTION_NEXT

    @Volatile private var instance: LoroMediaService? = null
    private var pending: NowPlaying? = null

    /** Shows (or updates) the player; starts the service the first time. Main thread. */
    fun show(context: Context, nowPlaying: NowPlaying) {
      val service = instance
      if (service != null) return service.show(nowPlaying)
      val starting = pending != null
      pending = nowPlaying
      if (starting) return
      try {
        // A plain start: media3 moves the service to the foreground once the session plays.
        context.startService(Intent(context, LoroMediaService::class.java))
      } catch (error: IllegalStateException) {
        // Not allowed from the background (Android 8+); the next update from the app in the
        // foreground starts it.
        pending = null
        Log.w(TAG, "Could not start the player's service", error)
      }
    }

    /** Takes the player off the lock screen and out of the shade. Main thread. */
    fun hide() {
      pending = null
      instance?.clear()
    }
  }
}
