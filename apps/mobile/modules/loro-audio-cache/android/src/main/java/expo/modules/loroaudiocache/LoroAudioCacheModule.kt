package expo.modules.loroaudiocache

import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicReference

class DownloadOptions : Record {
  @Field var url: String = ""
  @Field var expectedSha256: String = ""
  @Field var logicalKey: String = ""
  @Field var pinClass: String = "listening"
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
  private val shareEnabled = false
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
    if (path.isBlank() || !File(path).isFile) return null
    return payload(File(path), row.optString("sha256"), row.optInt("ms").takeIf { row.has("ms") && !row.isNull("ms") })
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
    // Mux of licensed neural audio is implemented only after Q-21. The flag above fails closed.
    throw failure("share-gated")
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
    indexFile().writeText(table.toString())
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
}
