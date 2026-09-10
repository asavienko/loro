package expo.modules.loroaudiocache

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicReference

class DownloadOptions : Record {
  @Field var url: String = ""
  @Field var expectedSha256: String = ""
  @Field var logicalKey: String = ""
  @Field var pinClass: String = "listening"
  @Field var authorization: String? = null
  @Field var deviceId: String? = null
}

class ConcatenateOptions : Record {
  @Field var fileUris: List<String> = emptyList()
  @Field var intraGapMs: Double = 400.0
  @Field var interGapMs: Double = 1200.0
  @Field var takesPerPhrase: Double = 3.0
  @Field var outputName: String = ""
}

/** Model-audio file cache. HTTP lives here, not in the speech module (ADR-0011). */
class LoroAudioCacheModule : Module() {
  private val budget = 64L * 1024L * 1024L
  private val shareEnabled = false // Q-22: neural listening audio must not leave the app
  private val current = AtomicReference<HttpURLConnection?>(null)

  override fun definition() = ModuleDefinition {
    Name("LoroAudioCache")

    AsyncFunction("download") { options: DownloadOptions -> download(options) }
    AsyncFunction("lookup") { logicalKey: String -> lookup(logicalKey) }
    AsyncFunction("cancel") { cancel() }
    AsyncFunction("pin") { keys: List<String> -> pin(keys, true) }
    AsyncFunction("unpin") { keys: List<String> ->
      pin(keys, false)
      evictIfNeeded()
    }
    AsyncFunction("concatenate") { options: ConcatenateOptions -> concatenate(options) }
    AsyncFunction("share") { fileUri: String -> share(fileUri) }
    AsyncFunction("saveListeningBatch") { clips: List<Map<String, Any?>> -> saveBatch(clips) }
    AsyncFunction("loadListeningBatch") { loadBatch() }
    AsyncFunction("installDevFixture") { logicalKey: String -> installDevFixture(logicalKey) }
  }

  private fun download(options: DownloadOptions): Map<String, Any?> {
    val remote = runCatching { URL(options.url) }.getOrNull()
      ?: throw failure("invalid-url")
    if (remote.userInfo != null || (remote.protocol != "https" && remote.protocol != "http")) {
      throw failure("invalid-url")
    }
    val connection = remote.openConnection() as HttpURLConnection
    current.getAndSet(connection)?.disconnect()
    try {
      connection.instanceFollowRedirects = false
      connection.connectTimeout = 15_000
      connection.readTimeout = 15_000
      val authorization = options.authorization
      if (!authorization.isNullOrBlank()) {
        connection.setRequestProperty("Authorization", authorization)
      }
      val deviceId = options.deviceId
      if (!deviceId.isNullOrBlank()) {
        connection.setRequestProperty("X-Loro-Device", deviceId)
      }
      val status = connection.responseCode
      if (status != HttpURLConnection.HTTP_OK) {
        (connection.errorStream ?: connection.inputStream)?.close()
        throw failure("failed")
      }
      val bytes = connection.inputStream.use { it.readBytes() }
      val digest = sha256(bytes)
      if (digest != options.expectedSha256.lowercase()) throw failure("checksum-mismatch")
      return store(bytes, digest, options.logicalKey, options.pinClass)
    } catch (error: Exception) {
      if (error.message == "cancelled") throw error
      if (error.message == "checksum-mismatch" || error.message == "disk-full" || error.message == "invalid-url") throw error
      throw failure("failed")
    } finally {
      current.compareAndSet(connection, null)
      connection.disconnect()
    }
  }

  private fun lookup(logicalKey: String): Map<String, Any?>? {
    val row = index().optJSONObject(logicalKey) ?: return null
    val path = row.optString("path")
    val sha256 = row.optString("sha256")
    val file = File(path)
    val digest = sha256File(file)
    if (path.isBlank() || digest == null || digest != sha256.lowercase()) {
      forget(logicalKey)
      return null
    }
    row.put("accessed", System.currentTimeMillis())
    val table = index()
    table.put(logicalKey, row)
    writeIndex(table)
    return payload(file, digest, row.optInt("ms").takeIf { row.has("ms") && !row.isNull("ms") })
  }

  private fun installDevFixture(logicalKey: String): Map<String, Any?> {
    val flags = appContext.reactContext?.applicationInfo?.flags ?: 0
    if (flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) throw failure("failed")
    val bytes = android.util.Base64.decode(FIXTURE_BASE64, android.util.Base64.DEFAULT)
    val digest = sha256(bytes)
    return store(bytes, digest, logicalKey, "listening")
  }

  private fun saveBatch(clips: List<Map<String, Any?>>) {
    val array = JSONArray()
    clips.forEach { clip ->
      array.put(JSONObject().apply {
        put("fileUri", clip["fileUri"])
        put("sha256", clip["sha256"])
        if (clip["ms"] == null) put("ms", JSONObject.NULL) else put("ms", clip["ms"])
      })
    }
    writeAtomically(File(cacheDir(), "listening-batch.json"), array.toString())
  }

  private fun loadBatch(): List<Map<String, Any?>>? {
    val file = File(cacheDir(), "listening-batch.json")
    if (!file.isFile) return null
    val array = runCatching { JSONArray(file.readText()) }.getOrNull() ?: return null
    val clips = mutableListOf<Map<String, Any?>>()
    for (i in 0 until array.length()) {
      val row = array.optJSONObject(i) ?: return null
      val fileUri = row.optString("fileUri")
      val sha256 = row.optString("sha256")
      val uri = Uri.parse(fileUri)
      val path = uri.path
      if (uri.scheme != "file" || path.isNullOrBlank()) return null
      val digest = sha256File(File(path))
      if (digest == null || digest != sha256.lowercase()) return null
      clips.add(
        mapOf(
          "fileUri" to fileUri,
          "sha256" to sha256,
          "ms" to row.opt("ms").takeIf { it != JSONObject.NULL },
        ),
      )
    }
    return clips.takeIf { it.isNotEmpty() }
  }

  private fun cancel() {
    current.getAndSet(null)?.disconnect()
  }

  private fun pin(keys: List<String>, pinned: Boolean) {
    val table = index()
    keys.forEach { key ->
      table.optJSONObject(key)?.put("pinned", pinned)
    }
    writeIndex(table)
  }

  private fun concatenate(options: ConcatenateOptions): Map<String, Any?> {
    if (!shareEnabled) throw failure("share-gated")
    if (options.fileUris.isEmpty() || options.outputName.isBlank()) throw failure("failed")
    val output = File(cacheDir(), options.outputName)
    if (output.exists()) output.delete()
    val muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    var track = -1
    var started = false
    var timelineUs = 0L
    val takes = maxOf(1, options.takesPerPhrase.toInt())
    try {
      options.fileUris.forEachIndexed { index, fileUri ->
        val uri = Uri.parse(fileUri)
        if (uri.scheme != "file" || uri.path.isNullOrBlank()) throw failure("invalid-url")
        val extractor = MediaExtractor()
        extractor.setDataSource(uri.path)
        val audioIndex = (0 until extractor.trackCount).firstOrNull { trackIndex ->
          extractor.getTrackFormat(trackIndex).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
        } ?: run {
          extractor.release()
          throw failure("failed")
        }
        extractor.selectTrack(audioIndex)
        val format = extractor.getTrackFormat(audioIndex)
        if (!started) {
          track = muxer.addTrack(format)
          muxer.start()
          started = true
        }
        val buffer = ByteBuffer.allocate(64 * 1024)
        val info = android.media.MediaCodec.BufferInfo()
        while (true) {
          val size = extractor.readSampleData(buffer, 0)
          if (size < 0) break
          info.offset = 0
          info.size = size
          info.flags = extractor.sampleFlags
          info.presentationTimeUs = timelineUs + extractor.sampleTime.coerceAtLeast(0)
          muxer.writeSampleData(track, buffer, info)
          extractor.advance()
        }
        val duration = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else 0L
        timelineUs += duration
        val last = index == options.fileUris.lastIndex
        if (!last) {
          val gapMs = if ((index + 1) % takes == 0) options.interGapMs else options.intraGapMs
          timelineUs += (gapMs * 1000).toLong()
        }
        extractor.release()
      }
      muxer.stop()
    } catch (error: Exception) {
      runCatching { muxer.release() }
      output.delete()
      if (error.message == "share-gated" || error.message == "invalid-url" || error.message == "failed") throw error
      throw failure("failed")
    }
    muxer.release()
    val bytes = output.readBytes()
    val digest = sha256(bytes)
    return payload(output, digest, measuredMs(output))
  }

  private fun share(fileUri: String) {
    if (!shareEnabled) throw failure("share-gated")
    val context = appContext.reactContext ?: throw failure("failed")
    val uri = Uri.parse(fileUri)
    if (uri.scheme != "file") throw failure("invalid-url")
    val intent = Intent(Intent.ACTION_SEND).apply {
      type = "audio/mp4"
      putExtra(Intent.EXTRA_STREAM, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  private fun store(bytes: ByteArray, sha256: String, key: String, pin: String): Map<String, Any?> {
    val file = File(cacheDir(), "sha256/$sha256.m4a")
    file.parentFile?.mkdirs()
    val temp = File(file.path + ".tmp")
    try {
      FileOutputStream(temp).use { it.write(bytes); it.fd.sync() }
      if (file.exists()) file.delete()
      if (!temp.renameTo(file)) throw failure("disk-full")
    } catch (_: Exception) {
      temp.delete()
      throw failure("disk-full")
    }
    val ms = measuredMs(file)
    val table = index()
    table.put(key, JSONObject().apply {
      put("path", file.absolutePath)
      put("sha256", sha256)
      if (ms != null) put("ms", ms) else put("ms", JSONObject.NULL)
      put("pinned", pin == "listening")
      put("bytes", bytes.size)
      put("accessed", System.currentTimeMillis())
    })
    writeIndex(table)
    evictIfNeeded()
    return payload(file, sha256, ms)
  }

  private fun measuredMs(file: File): Int? {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(file.absolutePath)
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toIntOrNull()
        ?.takeIf { it > 0 }
    } catch (_: Exception) {
      null
    } finally {
      retriever.release()
    }
  }

  private fun payload(file: File, sha256: String?, ms: Int?) = mapOf(
    "fileUri" to Uri.fromFile(file).toString(),
    "ms" to ms,
    "sha256" to sha256,
  )

  private fun cacheDir(): File {
    val root = File(appContext.cacheDirectory, "loro-audio-cache")
    root.mkdirs()
    return root
  }

  private fun indexFile() = File(cacheDir(), "index.json")

  private fun index(): JSONObject {
    val file = indexFile()
    if (!file.isFile) return JSONObject()
    return runCatching { JSONObject(file.readText()) }.getOrDefault(JSONObject())
  }

  private fun writeIndex(table: JSONObject) {
    writeAtomically(indexFile(), table.toString())
  }

  private fun writeAtomically(file: File, text: String) {
    val temp = File(file.path + ".tmp")
    try {
      FileOutputStream(temp).use { stream ->
        stream.write(text.toByteArray())
        stream.fd.sync()
      }
      if (file.exists()) file.delete()
      if (!temp.renameTo(file)) {
        temp.delete()
        throw failure("disk-full")
      }
    } catch (error: Exception) {
      temp.delete()
      if (error.message == "disk-full") throw error
      throw failure("disk-full")
    }
  }

  private fun forget(logicalKey: String) {
    val table = index()
    val row = table.optJSONObject(logicalKey)
    if (row != null) {
      File(row.optString("path")).delete()
      table.remove(logicalKey)
      writeIndex(table)
    }
  }

  private fun sha256File(file: File): String? {
    if (!file.isFile) return null
    return runCatching {
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().use { input ->
        val buffer = ByteArray(8192)
        while (true) {
          val n = input.read(buffer)
          if (n <= 0) break
          digest.update(buffer, 0, n)
        }
      }
      digest.digest().joinToString("") { "%02x".format(it) }
    }.getOrNull()
  }

  private fun evictIfNeeded() {
    val table = index()
    val names = table.keys().asSequence().toList()
    var used = 0L
    val unpinned = mutableListOf<String>()
    names.forEach { key ->
      val row = table.optJSONObject(key) ?: return@forEach
      if (!row.optBoolean("pinned")) {
        unpinned.add(key)
        used += row.optLong("bytes")
      }
    }
    if (used <= budget) return
    unpinned.sortBy { key -> table.optJSONObject(key)?.optLong("accessed") ?: 0L }
    for (key in unpinned) {
      if (used <= budget) break
      val row = table.optJSONObject(key) ?: continue
      File(row.optString("path")).delete()
      used -= row.optLong("bytes")
      table.remove(key)
    }
    writeIndex(table)
  }

  private fun sha256(bytes: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
    return digest.joinToString("") { "%02x".format(it) }
  }

  private fun failure(code: String) = Exception(code)

  companion object {
    /** Silent AAC 24 kHz mono. Development fixture only — not licensed neural audio. */
    private const val FIXTURE_BASE64 =
      "AAAAHGZ0eXBNNEEgAAACAE00QSBpc29taXNvMgAAAAhmcmVlAAAAMW1kYXTeAgBMYXZjNjAuMzEuMTAyAAIwQA4BGCAHARggBwEYIAcBGCAHARggBwAAAxNtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAyAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACPXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAyAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAMgAAAQAAAEAAAAAAbVtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAF3AAAAWwFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAFgbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAEkc3RibAAAAGpzdHNkAAAAAAAAAAEAAABabXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAF3AAAAAAAA2ZXNkcwAAAAADgICAJQABAASAgIAXQBUAAAAAAPoAAAAFRwWAgIAFEwhW5QAGgICAAQIAAAAgc3R0cwAAAAAAAAACAAAABQAABAAAAAABAAACwAAAABxzdHNjAAAAAAAAAAEAAAABAAAABgAAAAEAAAAsc3RzegAAAAAAAAAAAAAABgAAABUAAAAEAAAABAAAAAQAAAAEAAAABAAAABRzdGNvAAAAAAAAAAEAAAAsAAAAGnNncGQBAAAAcm9sbAAAAAIAAAAB//8AAAAcc2JncAAAAAByb2xsAAAAAQAAAAYAAAABAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2MC4xNi4xMDA="
  }
}
