package expo.modules.loromedia

import android.net.Uri
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * The app's one player as media3 sees it. Nothing plays here: the phrase loop and the songs play in
 * the app (expo-audio), and this player only mirrors what the app says is playing, so the media
 * session can show it. Every control pressed on it goes back to the app as a command, which acts on
 * it as a tap in the app would; the app then sends what is playing now.
 *
 * Neighbours are placeholders around the current item, so "next" and "previous" are offered exactly
 * when the app has somewhere to go.
 */
@OptIn(UnstableApi::class)
class LoroPlayer(looper: Looper) : SimpleBasePlayer(looper) {
  var current: NowPlaying? = null
    private set

  fun update(next: NowPlaying?) {
    current = next
    invalidateState()
  }

  override fun getState(): State {
    val item = current ?: return State.Builder().setAvailableCommands(Player.Commands.EMPTY).build()
    val commands = Player.Commands.Builder()
      .addAll(Player.COMMAND_PLAY_PAUSE, Player.COMMAND_GET_CURRENT_MEDIA_ITEM, Player.COMMAND_GET_METADATA)
    if (item.canNext) commands.addAll(Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
    if (item.canPrevious) commands.addAll(Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
    if (item.durationMs != null) commands.add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)

    val metadata = MediaMetadata.Builder()
      .setTitle(item.title)
      .setDisplayTitle(item.title)
      .setArtist(item.artist)
      .setSubtitle(item.artist)
      .setAlbumTitle(item.album)
      .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
      .setIsPlayable(true)
      .setIsBrowsable(false)
      .apply { item.artworkUrl?.let { setArtworkUri(Uri.parse(it)) } }
      .build()
    val playlist = buildList {
      if (item.canPrevious) add(placeholder(PREVIOUS_UID))
      add(
        MediaItemData.Builder(ITEM_UID_PREFIX + item.id)
          .setMediaItem(MediaItem.Builder().setMediaId(item.id).setMediaMetadata(metadata).build())
          .setMediaMetadata(metadata)
          .setDurationUs(item.durationMs?.let { it * 1000 } ?: C.TIME_UNSET)
          .setIsSeekable(item.durationMs != null)
          .build(),
      )
      if (item.canNext) add(placeholder(NEXT_UID))
    }
    val position = item.positionMs ?: 0L
    return State.Builder()
      .setAvailableCommands(commands.build())
      .setPlaylist(playlist)
      .setCurrentMediaItemIndex(if (item.canPrevious) 1 else 0)
      .setPlaybackState(Player.STATE_READY)
      .setPlayWhenReady(item.playing, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
      .setContentPositionMs(
        if (item.playing && item.durationMs != null) PositionSupplier.getExtrapolating(position, 1f) else PositionSupplier.getConstant(position),
      )
      .build()
  }

  // The app decides what a press does, so the state stays as it was (no placeholder item, no
  // jump) until the app says what is playing now. Play and pause show at once (below).
  override fun getPlaceholderState(suggestedPlaceholderState: State): State = getState()

  override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
    current = current?.copy(playing = playWhenReady)
    LoroMediaBridge.send(if (playWhenReady) "play" else "pause")
    return Futures.immediateVoidFuture()
  }

  override fun handleSeek(mediaItemIndex: Int, positionMs: Long, seekCommand: Int): ListenableFuture<*> {
    when (seekCommand) {
      Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> LoroMediaBridge.send("next")
      Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> LoroMediaBridge.send("previous")
      Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM ->
        if (positionMs != C.TIME_UNSET) LoroMediaBridge.send("seek", mapOf("positionMs" to positionMs.toDouble()))
    }
    return Futures.immediateVoidFuture()
  }

  override fun handleStop(): ListenableFuture<*> {
    LoroMediaBridge.send("pause")
    return Futures.immediateVoidFuture()
  }

  override fun handleRelease(): ListenableFuture<*> = Futures.immediateVoidFuture()

  private fun placeholder(uid: String) =
    MediaItemData.Builder(uid).setMediaItem(MediaItem.Builder().setMediaId(uid).build()).setIsPlaceholder(true).build()

  private companion object {
    const val ITEM_UID_PREFIX = "loro:item:"
    const val PREVIOUS_UID = "loro:previous"
    const val NEXT_UID = "loro:next"
  }
}
