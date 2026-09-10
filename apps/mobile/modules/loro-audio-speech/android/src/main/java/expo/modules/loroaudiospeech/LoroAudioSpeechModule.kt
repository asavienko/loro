package expo.modules.loroaudiospeech

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import expo.modules.interfaces.permissions.PermissionsResponseListener
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.Locale

class PlaybackOptions : Record {
  @Field var id: String = ""
  @Field var text: String = ""
  @Field var locale: String = ""
  @Field var rate: Double = 1.0
  @Field var uri: String = ""
}

class ListeningOptions : Record {
  @Field var id: String = ""
  @Field var locale: String = ""
}

class FilePlaybackOptions : Record {
  @Field var id: String = ""
  @Field var fileUri: String = ""
}

private open class SilentRecognitionListener : RecognitionListener {
  override fun onReadyForSpeech(params: Bundle?) = Unit
  override fun onBeginningOfSpeech() = Unit
  override fun onRmsChanged(rmsdB: Float) = Unit
  // The platform owns capture; native buffers are never retained or exposed to JavaScript.
  override fun onBufferReceived(buffer: ByteArray?) = Unit
  override fun onEndOfSpeech() = Unit
  override fun onError(error: Int) = Unit
  override fun onResults(results: Bundle?) = Unit
  override fun onPartialResults(partialResults: Bundle?) = Unit
  override fun onEvent(eventType: Int, params: Bundle?) = Unit
}

/** AS-01 / AS-03: offline platform speech only; no recording or waveform crosses this bridge. */
class LoroAudioSpeechModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var destroyed = false
  private var foreground = true
  private var tts: TextToSpeech? = null
  private var mediaPlayer: MediaPlayer? = null
  private var filePlayer: MediaPlayer? = null
  private var ttsReady = false
  private var ttsInitializing = false
  private var ttsGeneration = 0L
  private val ttsWaiters = mutableListOf<(TextToSpeech?) -> Unit>()
  private var playbackGeneration = 0L
  private var playbackId: String? = null
  private var playbackToken: String? = null
  private var speechGeneration = 0L
  private var recognizer: SpeechRecognizer? = null
  private var speechId: String? = null
  private var pendingSpeech: PendingSpeech? = null
  private var receiverContext: Context? = null
  private var focusRequest: AudioFocusRequest? = null
  private var legacyFocus = false

  private data class PendingSpeech(
    val options: ListeningOptions,
    val generation: Long,
    val promise: Promise,
    var permissionGranted: Boolean = false,
  )

  private val audioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_MEDIA)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .build()

  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    if (change < 0) {
      main.post { interrupt() }
    }
  }

  private val noisyReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) interrupt()
    }
  }

  override fun definition() = ModuleDefinition {
    Name("LoroAudioSpeech")
    Events("playback", "speech")

    AsyncFunction("availability") { locale: String, promise: Promise ->
      withTts { engine ->
        val playback = engine != null && offlineVoice(engine, locale) != null
        recognitionAvailability(locale) { recognition ->
          promise.resolve(mapOf("playback" to playback, "recognition" to recognition))
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("playFile") { options: FilePlaybackOptions, promise: Promise ->
      playCachedFile(options, promise)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { options: PlaybackOptions, promise: Promise ->
      if (options.id.isBlank()) {
        promise.reject("ERR_INVALID_PLAYBACK", "Invalid speech playback request", null)
        return@AsyncFunction
      }
      if (options.uri.isNotBlank()) {
        playCatalog(options, promise)
        return@AsyncFunction
      }
      if (options.text.isBlank() ||
        options.text.length > TextToSpeech.getMaxSpeechInputLength() ||
        !options.rate.isFinite() || options.rate !in 0.5..2.0
      ) {
        promise.reject("ERR_INVALID_PLAYBACK", "Invalid speech playback request", null)
        return@AsyncFunction
      }
      stopSpeech()
      stopPlayback()
      val generation = playbackGeneration
      withTts { engine ->
        if (generation != playbackGeneration || destroyed || !foreground) {
          promise.reject("ERR_CANCELLED", "Playback was cancelled", null)
          return@withTts
        }
        val voice = engine?.let { offlineVoice(it, options.locale) }
        if (engine == null || voice == null) {
          playbackEvent(options.id, "error", "offline_voice_unavailable")
          promise.reject("ERR_AUDIO_UNAVAILABLE", "No installed offline voice for this language", null)
          return@withTts
        }
        try {
          if (engine.setVoice(voice) != TextToSpeech.SUCCESS ||
            engine.voice?.isNetworkConnectionRequired != false ||
            engine.voice?.name != voice.name ||
            engine.setSpeechRate(options.rate.toFloat()) != TextToSpeech.SUCCESS ||
            !acquireFocus()
          ) {
            abandonFocus()
            playbackEvent(options.id, "error", "playback_unavailable")
            promise.reject("ERR_AUDIO_UNAVAILABLE", "Offline playback could not start", null)
            return@withTts
          }
          playbackId = options.id
          playbackToken = "loro-$generation"
          val status = engine.speak(options.text, TextToSpeech.QUEUE_FLUSH, Bundle(), playbackToken)
          if (status != TextToSpeech.SUCCESS) {
            finishPlayback(playbackToken, "error", "synthesis_failed")
            promise.reject("ERR_AUDIO_UNAVAILABLE", "Offline synthesis failed", null)
          } else {
            promise.resolve()
          }
        } catch (error: Exception) {
          stopPlayback()
          playbackEvent(options.id, "error", "playback_failed")
          promise.reject("ERR_AUDIO_UNAVAILABLE", "Offline playback failed", error)
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stopPlayback") { stopPlayback() }.runOnQueue(Queues.MAIN)

    AsyncFunction("startListening") { options: ListeningOptions, promise: Promise ->
      stopPlayback()
      stopSpeech()
      if (options.id.isBlank() || Locale.forLanguageTag(options.locale).language.isBlank()) {
        promise.reject("ERR_INVALID_SPEECH", "Invalid speech recognition request", null)
        return@AsyncFunction
      }
      val pending = PendingSpeech(options, speechGeneration, promise)
      pendingSpeech = pending
      recognitionAvailability(options.locale) { available ->
        if (pendingSpeech !== pending) return@recognitionAvailability
        if (!foreground || destroyed) {
          failPendingSpeech(pending, "ERR_CANCELLED", "Speech recognition was cancelled")
          return@recognitionAvailability
        }
        if (!available) {
          failPendingSpeech(pending, "ERR_SPEECH_UNAVAILABLE", "On-device recognition is unavailable")
          return@recognitionAvailability
        }
        val permissions = appContext.permissions
        if (permissions == null) {
          failPendingSpeech(pending, "ERR_PERMISSION", "Microphone permission service is unavailable")
        } else if (permissions.hasGrantedPermissions(Manifest.permission.RECORD_AUDIO)) {
          pending.permissionGranted = true
          beginPendingSpeech()
        } else {
          try {
            permissions.askForPermissions(PermissionsResponseListener { result ->
              main.post {
                if (pendingSpeech !== pending) return@post
                if (result[Manifest.permission.RECORD_AUDIO]?.status == PermissionsStatus.GRANTED) {
                  pending.permissionGranted = true
                  beginPendingSpeech()
                } else {
                  failPendingSpeech(pending, "ERR_PERMISSION", "Microphone permission was not granted")
                }
              }
            }, Manifest.permission.RECORD_AUDIO)
          } catch (error: Exception) {
            failPendingSpeech(pending, "ERR_PERMISSION", "Microphone permission could not be requested", error)
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    // Cancellation, not finalization: route exits must not commit a late recognition result.
    AsyncFunction("stopListening") { stopSpeech() }.runOnQueue(Queues.MAIN)

    OnActivityEntersForeground {
      main.post {
        foreground = true
        beginPendingSpeech()
      }
    }
    OnActivityEntersBackground {
      main.post {
        foreground = false
        stopPlayback()
        // Permission dialogs can pause the Activity. Preserve only their pending request.
        stopActiveSpeech()
      }
    }
    OnUserLeavesActivity { main.post { interrupt() } }
    OnDestroy {
      main.post {
        destroyed = true
        interrupt()
        tts?.shutdown()
        tts = null
        ttsReady = false
        finishTtsInitialization(null)
        receiverContext?.unregisterReceiver(noisyReceiver)
        receiverContext = null
      }
    }
  }

  private fun playCatalog(options: PlaybackOptions, promise: Promise) {
    stopSpeech()
    stopPlayback()
    val generation = playbackGeneration
    val context = appContext.reactContext
    val uri = Uri.parse(options.uri)
    val scheme = uri.scheme?.lowercase()
    if (context == null || (scheme != "file" && scheme != "content")) {
      playbackEvent(options.id, "error", "file_unavailable")
      promise.reject("ERR_AUDIO_UNAVAILABLE", "Catalog audio is not a playable file", null)
      return
    }
    try {
      if (!acquireFocus()) {
        playbackEvent(options.id, "error", "playback_unavailable")
        promise.reject("ERR_AUDIO_UNAVAILABLE", "Offline playback could not start", null)
        return
      }
      val player = MediaPlayer()
      mediaPlayer = player
      player.setAudioAttributes(audioAttributes)
      player.setDataSource(context, uri)
      player.setOnCompletionListener {
        main.post {
          if (generation == playbackGeneration) finishPlayback(playbackToken, "ended")
        }
      }
      player.setOnErrorListener { _, _, _ ->
        main.post {
          if (generation == playbackGeneration) finishPlayback(playbackToken, "error", "file_unavailable")
        }
        true
      }
      player.prepare()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && options.rate.isFinite() && options.rate > 0) {
        player.playbackParams = player.playbackParams.setSpeed(options.rate.toFloat().coerceIn(0.5f, 2.0f))
      }
      playbackId = options.id
      playbackToken = "loro-$generation"
      player.start()
      playbackEvent(options.id, "playing")
      promise.resolve()
    } catch (error: Exception) {
      stopPlayback()
      playbackEvent(options.id, "error", "file_unavailable")
      promise.reject("ERR_AUDIO_UNAVAILABLE", "Catalog playback failed", error)
    }
  }

  private fun withTts(callback: (TextToSpeech?) -> Unit) {
    if (destroyed) return callback(null)
    if (ttsReady) return callback(tts)
    val context = appContext.reactContext ?: return callback(null)
    ttsWaiters.add(callback)
    if (ttsInitializing) return
    ttsInitializing = true
    ttsGeneration += 1
    val generation = ttsGeneration
    val timeout = Runnable {
      if (ttsInitializing && generation == ttsGeneration) {
        tts?.shutdown()
        tts = null
        finishTtsInitialization(null)
      }
    }
    main.postDelayed(timeout, SERVICE_TIMEOUT_MS)
    try {
      tts = TextToSpeech(context) { status ->
        main.post {
          main.removeCallbacks(timeout)
          if (!ttsInitializing || generation != ttsGeneration || destroyed) return@post
          val engine = tts
          if (status != TextToSpeech.SUCCESS || engine == null) {
            engine?.shutdown()
            tts = null
            finishTtsInitialization(null)
          } else {
            engine.setAudioAttributes(audioAttributes)
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
              override fun onStart(utteranceId: String?) {
                main.post {
                  if (utteranceId == playbackToken) playbackId?.let { playbackEvent(it, "playing") }
                }
              }
              override fun onDone(utteranceId: String?) {
                main.post { finishPlayback(utteranceId, "ended") }
              }
              @Deprecated("Android requires this callback alongside the coded error overload")
              override fun onError(utteranceId: String?) {
                main.post { finishPlayback(utteranceId, "error", "synthesis_failed") }
              }
              override fun onError(utteranceId: String?, errorCode: Int) {
                main.post { finishPlayback(utteranceId, "error", "synthesis_$errorCode") }
              }
              override fun onStop(utteranceId: String?, interrupted: Boolean) {
                main.post { finishPlayback(utteranceId, "stopped") }
              }
            })
            ttsReady = true
            finishTtsInitialization(engine)
          }
        }
      }
    } catch (_: Exception) {
      main.removeCallbacks(timeout)
      finishTtsInitialization(null)
    }
  }

  private fun finishTtsInitialization(engine: TextToSpeech?) {
    ttsInitializing = false
    val callbacks = ttsWaiters.toList()
    ttsWaiters.clear()
    callbacks.forEach { it(engine) }
  }

  private fun offlineVoice(engine: TextToSpeech, languageTag: String): Voice? {
    val locale = Locale.forLanguageTag(languageTag)
    if (locale.language.isBlank()) return null
    return try {
      engine.voices?.filter {
        !it.isNetworkConnectionRequired &&
          !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) &&
          it.locale.language == locale.language &&
          (locale.country.isBlank() || it.locale.country == locale.country)
      }?.sortedWith(compareByDescending<Voice> { it.locale.country == locale.country }
        .thenByDescending { it.quality }.thenBy { it.name })?.firstOrNull()
    } catch (_: Exception) { null }
  }

  private fun recognitionIntent(locale: String) = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
    putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    // Defense in depth only: createOnDeviceSpeechRecognizer is the privacy boundary.
    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
  }

  private fun recognitionAvailability(locale: String, callback: (Boolean) -> Unit) {
    val context = appContext.reactContext
    if (destroyed || context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      Locale.forLanguageTag(locale).language.isBlank()
    ) return callback(false)
    try {
      if (!SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) return callback(false)
      // Android 12 can guarantee local execution; unsupported locale errors arrive at start.
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return callback(true)
      val probe = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
      probe.setRecognitionListener(SilentRecognitionListener())
      var finished = false
      fun finish(available: Boolean) {
        if (finished) return
        finished = true
        probe.destroy()
        callback(available && !destroyed)
      }
      val timeout = Runnable { finish(false) }
      main.postDelayed(timeout, SERVICE_TIMEOUT_MS)
      try {
        probe.checkRecognitionSupport(recognitionIntent(locale), context.mainExecutor,
          object : RecognitionSupportCallback {
            override fun onSupportResult(support: RecognitionSupport) {
              main.removeCallbacks(timeout)
              val requested = Locale.forLanguageTag(locale)
              finish(support.installedOnDeviceLanguages.any {
                val installed = Locale.forLanguageTag(it)
                installed == requested || (installed.language == requested.language && installed.country.isBlank())
              })
            }
            override fun onError(error: Int) {
              main.removeCallbacks(timeout)
              finish(false)
            }
          })
      } catch (_: Exception) {
        main.removeCallbacks(timeout)
        finish(false)
      }
    } catch (_: Exception) { callback(false) }
  }

  private fun beginPendingSpeech() {
    val pending = pendingSpeech ?: return
    if (!pending.permissionGranted || !foreground || destroyed) return
    val context = appContext.reactContext
    if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      failPendingSpeech(pending, "ERR_SPEECH_UNAVAILABLE", "On-device recognition is unavailable")
      return
    }
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      failPendingSpeech(pending, "ERR_PERMISSION", "Microphone permission was revoked")
      return
    }
    try {
      if (!acquireFocus()) {
        failPendingSpeech(pending, "ERR_AUDIO_FOCUS", "Audio is currently in use")
        return
      }
      val session = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
      recognizer = session
      speechId = pending.options.id
      session.setRecognitionListener(object : SilentRecognitionListener() {
        private fun current() = recognizer === session && speechGeneration == pending.generation
        override fun onReadyForSpeech(params: Bundle?) {
          if (current()) speechEvent(pending.options.id, "listening")
        }
        override fun onPartialResults(partialResults: Bundle?) {
          if (current()) speechEvent(pending.options.id, "partial", transcript(partialResults))
        }
        override fun onResults(results: Bundle?) {
          if (!current()) return
          speechEvent(pending.options.id, "final", transcript(results))
          stopActiveSpeech(emit = false)
        }
        override fun onError(error: Int) {
          if (!current()) return
          val unavailable = error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ||
            error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED ||
            error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE
          speechEvent(pending.options.id, if (unavailable) "unavailable" else "error")
          stopActiveSpeech(emit = false)
        }
      })
      session.startListening(recognitionIntent(pending.options.locale))
      pendingSpeech = null
      pending.promise.resolve()
    } catch (error: Exception) {
      stopActiveSpeech(emit = false)
      failPendingSpeech(pending, "ERR_SPEECH_UNAVAILABLE", "On-device recognition could not start", error)
    }
  }

  private fun failPendingSpeech(pending: PendingSpeech, code: String, message: String, error: Exception? = null) {
    if (pendingSpeech !== pending) return
    pendingSpeech = null
    speechEvent(pending.options.id, "unavailable")
    pending.promise.reject(code, message, error)
  }

  private fun transcript(results: Bundle?) =
    results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()

  private fun stopSpeech() {
    speechGeneration += 1
    pendingSpeech?.let { failPendingSpeech(it, "ERR_CANCELLED", "Speech recognition was cancelled") }
    stopActiveSpeech()
  }

  private fun stopActiveSpeech(emit: Boolean = true) {
    val id = speechId
    val session = recognizer
    speechId = null
    recognizer = null
    session?.cancel()
    session?.destroy()
    if (id != null && emit) speechEvent(id, "unavailable")
    if (playbackId == null) abandonFocus()
  }

  private fun playCachedFile(options: FilePlaybackOptions, promise: Promise) {
    val uri = Uri.parse(options.fileUri)
    val path = uri.path
    if (options.id.isBlank() || uri.scheme != "file" || path.isNullOrBlank() || !File(path).isFile) {
      playbackEvent(options.id, "error", "file_unavailable")
      promise.reject("ERR_AUDIO_UNAVAILABLE", "Cached listening file is unavailable", null)
      return
    }
    stopSpeech()
    stopPlayback()
    val generation = playbackGeneration
    try {
      if (!acquireFocus()) {
        playbackEvent(options.id, "error", "playback_unavailable")
        promise.reject("ERR_AUDIO_UNAVAILABLE", "Cached listening playback could not start", null)
        return
      }
      val player = MediaPlayer()
      filePlayer = player
      playbackId = options.id
      playbackToken = "file-$generation"
      player.setAudioAttributes(audioAttributes)
      player.setOnCompletionListener {
        main.post { finishFilePlayback(generation, "ended") }
      }
      player.setOnErrorListener { _, _, _ ->
        main.post { finishFilePlayback(generation, "error", "file_playback_failed") }
        true
      }
      Log.i("LoroAudioSpeech", "playFile uri=${options.fileUri}")
      player.setDataSource(path)
      player.prepare()
      if (generation != playbackGeneration || destroyed || !foreground) {
        stopFilePlayer()
        playbackId = null
        playbackToken = null
        promise.reject("ERR_CANCELLED", "Playback was cancelled", null)
        return
      }
      player.start()
      playbackEvent(options.id, "playing")
      promise.resolve()
    } catch (error: Exception) {
      stopFilePlayer()
      playbackId = null
      playbackToken = null
      playbackEvent(options.id, "error", "file_playback_failed")
      promise.reject("ERR_AUDIO_UNAVAILABLE", "Cached listening playback failed", error)
    }
  }

  private fun stopFilePlayer() {
    val player = filePlayer
    filePlayer = null
    player?.setOnCompletionListener(null)
    player?.setOnErrorListener(null)
    runCatching { player?.stop() }
    player?.release()
  }

  private fun finishFilePlayback(generation: Long, state: String, error: String? = null) {
    if (generation != playbackGeneration) return
    val id = playbackId ?: return
    playbackId = null
    playbackToken = null
    stopFilePlayer()
    playbackEvent(id, state, error)
    if (speechId == null) abandonFocus()
  }

  private fun stopPlayback() {
    playbackGeneration += 1
    val id = playbackId
    playbackId = null
    playbackToken = null
    mediaPlayer?.setOnCompletionListener(null)
    mediaPlayer?.setOnErrorListener(null)
    mediaPlayer?.reset()
    mediaPlayer?.release()
    mediaPlayer = null
    tts?.stop()
    stopFilePlayer()
    if (id != null) playbackEvent(id, "stopped")
    if (speechId == null) abandonFocus()
  }

  private fun finishPlayback(token: String?, state: String, error: String? = null) {
    if (token == null || token != playbackToken) return
    val id = playbackId ?: return
    playbackId = null
    playbackToken = null
    mediaPlayer?.setOnCompletionListener(null)
    mediaPlayer?.setOnErrorListener(null)
    mediaPlayer?.reset()
    mediaPlayer?.release()
    mediaPlayer = null
    playbackEvent(id, state, error)
    if (speechId == null) abandonFocus()
  }

  private fun playbackEvent(id: String, state: String, error: String? = null) {
    if (!destroyed) sendEvent("playback", buildMap<String, Any?> {
      put("id", id)
      put("state", state)
      if (error != null) put("error", error)
    })
  }

  private fun speechEvent(id: String, state: String, transcript: String = "") {
    // Recognition callbacks are not a validated VAD clock. Latency remains absent.
    if (!destroyed) sendEvent("speech", mapOf("id" to id, "state" to state, "transcript" to transcript, "latencyMs" to null))
  }

  private fun audioManager() = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  private fun acquireFocus(): Boolean {
    val manager = audioManager() ?: return false
    val context = appContext.reactContext ?: return false
    if (receiverContext == null) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(noisyReceiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_NOT_EXPORTED)
      } else {
        @Suppress("DEPRECATION")
        context.registerReceiver(noisyReceiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
      }
      receiverContext = context
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
        .setAudioAttributes(audioAttributes)
        .setOnAudioFocusChangeListener(focusListener, main)
        .setWillPauseWhenDucked(true)
        .build()
      focusRequest = request
      return manager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }
    legacyFocus = true
    @Suppress("DEPRECATION")
    return manager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC,
      AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
  }

  private fun abandonFocus() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { audioManager()?.abandonAudioFocusRequest(it) }
    } else if (legacyFocus) {
      @Suppress("DEPRECATION")
      audioManager()?.abandonAudioFocus(focusListener)
    }
    focusRequest = null
    legacyFocus = false
  }

  private fun interrupt() {
    stopPlayback()
    stopSpeech()
  }

  companion object {
    private const val SERVICE_TIMEOUT_MS = 5_000L
  }
}
