package expo.modules.loromedia

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** One grade as the app sends it (src/audio/nowPlaying.ts): its name, and whether it is the one given. */
class GradeRecord : Record {
  @Field val grade: String = ""
  @Field val label: String = ""
  @Field val detail: String = ""
  @Field val selected: Boolean = false
}

/** What the one player shows and offers, as the app sends it. Text only: no audio crosses here. */
class NowPlayingRecord : Record {
  @Field val id: String = ""
  @Field val title: String = ""
  @Field val artist: String = ""
  @Field val album: String = ""
  @Field val artworkUrl: String? = null
  @Field val playing: Boolean = false
  @Field val canNext: Boolean = false
  @Field val canPrevious: Boolean = false
  @Field val positionMs: Double? = null
  @Field val durationMs: Double? = null
  @Field val grades: List<GradeRecord>? = null
  @Field val nextLabel: String = ""
  @Field val channelName: String = ""
  @Field val hasSilences: Boolean = false

  fun toNowPlaying() = NowPlaying(
    id = id,
    title = title,
    artist = artist,
    album = album,
    artworkUrl = artworkUrl,
    playing = playing,
    canNext = canNext,
    canPrevious = canPrevious,
    positionMs = positionMs?.toLong(),
    durationMs = durationMs?.toLong(),
    grades = grades?.mapNotNull { g -> Grade.of(g.grade)?.let { GradeButton(it, g.label, g.detail, g.selected) } },
    nextLabel = nextLabel,
    channelName = channelName,
  )
}

enum class Grade(val key: String, val action: String) {
  MISSED("missed", "app.loro.media.RATE_MISSED"),
  HARD("hard", "app.loro.media.RATE_HARD"),
  EASY("easy", "app.loro.media.RATE_EASY");

  companion object {
    fun of(key: String) = entries.firstOrNull { it.key == key }
    fun ofAction(action: String) = entries.firstOrNull { it.action == action }
  }
}

data class GradeButton(val grade: Grade, val label: String, val detail: String, val selected: Boolean)

data class NowPlaying(
  /** The phrase's or song's id: a rating from here names it, so a rating meant for one item never lands on the next. */
  val id: String,
  val title: String,
  val artist: String,
  val album: String,
  val artworkUrl: String?,
  val playing: Boolean,
  val canNext: Boolean,
  val canPrevious: Boolean,
  /** A song's place and length (its seek bar); a phrase has neither. */
  val positionMs: Long?,
  val durationMs: Long?,
  /** The three grades, or null when the item can't be rated. */
  val grades: List<GradeButton>?,
  val nextLabel: String,
  val channelName: String,
)

/** Commands from the lock screen, the notification and headsets, on their way to the app's JavaScript. */
object LoroMediaBridge {
  @Volatile var onCommand: ((Map<String, Any?>) -> Unit)? = null

  fun send(type: String, extra: Map<String, Any?> = emptyMap()) {
    onCommand?.invoke(mapOf("type" to type) + extra)
  }
}
