import AVFoundation
import ExpoModulesCore
import Speech
import UIKit

struct LoroPlaybackOptions: Record {
  @Field var id: String = ""
  @Field var text: String = ""
  @Field var locale: String = ""
  @Field var rate: Double = 1
  @Field var uri: String = ""
}

struct LoroListeningOptions: Record {
  @Field var id: String = ""
  @Field var locale: String = ""
}

struct LoroFilePlaybackOptions: Record {
  @Field var id: String = ""
  @Field var fileUri: String = ""
}

public final class LoroAudioSpeechModule: Module {
  private var audioController: LoroAudioSpeechController?
  private var controller: LoroAudioSpeechController {
    if let audioController { return audioController }
    let created = LoroAudioSpeechController { [weak self] event, payload in
      self?.sendEvent(event, payload)
    }
    audioController = created
    return created
  }

  public func definition() -> ModuleDefinition {
    Name("LoroAudioSpeech")
    Events("playback", "speech")

    AsyncFunction("availability") { (locale: String) -> [String: Bool] in
      self.controller.availability(locale: locale)
    }.runOnQueue(.main)

    AsyncFunction("play") { (options: LoroPlaybackOptions) in
      try self.controller.play(options)
    }.runOnQueue(.main)

    AsyncFunction("playFile") { (options: LoroFilePlaybackOptions) in
      try self.controller.playFile(options)
    }.runOnQueue(.main)

    AsyncFunction("stopPlayback") {
      self.controller.stopPlayback()
    }.runOnQueue(.main)

    AsyncFunction("startListening") { (options: LoroListeningOptions, promise: Promise) in
      self.controller.startListening(options) { result in
        switch result {
        case .success:
          promise.resolve(nil)
        case .failure(let error):
          promise.reject("ERR_LORO_SPEECH", error.localizedDescription)
        }
      }
    }.runOnQueue(.main)

    AsyncFunction("stopListening") {
      self.controller.stopListening()
    }.runOnQueue(.main)

    OnDestroy {
      // Expo can destroy a module off the main queue. Keep its native owner alive
      // until the audio graph and observers have been disposed on their queue.
      DispatchQueue.main.async {
        self.audioController?.dispose()
        self.audioController = nil
      }
    }
  }
}

/// Owns the audio session and all recorded buffers. This class exposes only text
/// and lifecycle events; no file, PCM, waveform, or audio handle reaches JS.
private final class LoroAudioSpeechController: NSObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
  private var emit: ((String, [String: Any]) -> Void)?
  private var synthesizer = AVSpeechSynthesizer()
  private var filePlayer: AVAudioPlayer?
  private var audioEngine = AVAudioEngine()
  private let audioSession = AVAudioSession.sharedInstance()
  private var observers: [NSObjectProtocol] = []
  private var utteranceIDs: [ObjectIdentifier: String] = [:]
  private var activePlaybackID: String?
  private var speechID: String?
  private var speechGeneration: UUID?
  private var recognizer: SFSpeechRecognizer?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var hasInputTap = false
  private var pendingStart: ((Result<Void, Error>) -> Void)?
  private var finalResultDeadline: DispatchWorkItem?
  private let finalResultWaitSeconds: Double = 5

  init(emit: @escaping (String, [String: Any]) -> Void) {
    self.emit = emit
    super.init()
    synthesizer.delegate = self
    observeAudioLifecycle()
  }

  func availability(locale: String) -> [String: Bool] {
    let speech = SFSpeechRecognizer(locale: Locale(identifier: locale))
    let authorization = SFSpeechRecognizer.authorizationStatus()
    let microphone = audioSession.recordPermission
    return [
      "playback": installedVoice(locale: locale) != nil,
      "recognition": speech?.isAvailable == true
        && speech?.supportsOnDeviceRecognition == true
        && authorization != .denied && authorization != .restricted
        && microphone != .denied,
    ]
  }

  func play(_ options: LoroPlaybackOptions) throws {
    guard !options.id.isEmpty else {
      emit?("playback", ["id": options.id, "state": "error", "error": "voice-unavailable"])
      throw failure("A playback request ID is required.")
    }
    cancelListening()
    stopPlayback()
    if !options.uri.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      try playFile(options)
      return
    }
    guard !options.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      options.rate.isFinite, options.rate > 0,
      let voice = installedVoice(locale: options.locale)
    else {
      emit?("playback", ["id": options.id, "state": "error", "error": "voice-unavailable"])
      throw failure("A device voice is unavailable for this language.")
    }
    do {
      try audioSession.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
      try audioSession.setActive(true)
    } catch {
      emit?("playback", ["id": options.id, "state": "error", "error": "audio-session"])
      deactivateIfIdle()
      throw error
    }
    let utterance = AVSpeechUtterance(string: options.text)
    utterance.voice = voice
    // Device TTS speed is a multiplier of the platform default. This does not
    // manufacture sample positions, clip duration, or measured playback rate.
    let scaledRate = Double(AVSpeechUtteranceDefaultSpeechRate) * options.rate
    utterance.rate = Float(min(Double(AVSpeechUtteranceMaximumSpeechRate),
                               max(Double(AVSpeechUtteranceMinimumSpeechRate), scaledRate)))
    utteranceIDs[ObjectIdentifier(utterance)] = options.id
    activePlaybackID = options.id
    synthesizer.speak(utterance)
  }

  func playFile(_ options: LoroFilePlaybackOptions) throws {
    guard !options.id.isEmpty,
      let url = URL(string: options.fileUri),
      url.isFileURL,
      url.scheme == "file"
    else {
      emit?("playback", ["id": options.id, "state": "error", "error": "file-unavailable"])
      throw failure("A cached listening file is unavailable.")
    }
    cancelListening()
    stopPlayback()
    do {
      try audioSession.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
      try audioSession.setActive(true)
      let player = try AVAudioPlayer(contentsOf: url)
      player.delegate = self
      filePlayer = player
      activePlaybackID = options.id
      player.prepareToPlay()
      guard player.play() else {
        throw failure("Cached listening playback could not start.")
      }
      emit?("playback", ["id": options.id, "state": "playing"])
    } catch {
      filePlayer = nil
      activePlaybackID = nil
      emit?("playback", ["id": options.id, "state": "error", "error": "file-unavailable"])
      deactivateIfIdle()
      throw error
    }
  }

  func stopPlayback() {
    let id = activePlaybackID
    activePlaybackID = nil
    utteranceIDs.removeAll()
    filePlayer?.stop()
    filePlayer = nil
    synthesizer.stopSpeaking(at: .immediate)
    filePlayer?.delegate = nil
    filePlayer?.stop()
    filePlayer = nil
    if let id { emit?("playback", ["id": id, "state": "stopped"]) }
    deactivateIfIdle()
  }

  private func playFile(_ options: LoroPlaybackOptions) throws {
    guard let url = URL(string: options.uri),
      url.scheme?.lowercased() == "file"
    else {
      emit?("playback", ["id": options.id, "state": "error", "error": "file-unavailable"])
      throw failure("Catalog audio is not a playable file.")
    }
    do {
      try audioSession.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
      try audioSession.setActive(true)
      let player = try AVAudioPlayer(contentsOf: url)
      player.delegate = self
      player.enableRate = true
      if options.rate.isFinite, options.rate > 0 {
        player.rate = Float(min(2, max(0.5, options.rate)))
      }
      filePlayer = player
      activePlaybackID = options.id
      guard player.play() else {
        filePlayer = nil
        activePlaybackID = nil
        throw failure("Catalog audio could not start.")
      }
      emit?("playback", ["id": options.id, "state": "playing"])
    } catch {
      emit?("playback", ["id": options.id, "state": "error", "error": "file-unavailable"])
      deactivateIfIdle()
      throw error
    }
  }

  func startListening(_ options: LoroListeningOptions,
                      completion: @escaping (Result<Void, Error>) -> Void) {
    cancelListening()
    stopPlayback()
    guard !options.id.isEmpty else {
      completion(.failure(failure("A speech request ID is required.")))
      return
    }
    speechID = options.id
    let generation = UUID()
    speechGeneration = generation
    pendingStart = completion
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: options.locale)),
      recognizer.isAvailable, recognizer.supportsOnDeviceRecognition
    else {
      failListening("On-device recognition is unavailable for this language.", state: "unavailable")
      return
    }
    self.recognizer = recognizer
    // Availability checks never ask for permission. Prompts happen only after
    // the learner explicitly starts listening.
    SFSpeechRecognizer.requestAuthorization { [weak self] authorization in
      DispatchQueue.main.async {
        guard let self, self.speechGeneration == generation else { return }
        guard authorization == .authorized else {
          self.failListening("Speech recognition permission was not granted.", state: "unavailable")
          return
        }
        self.audioSession.requestRecordPermission { [weak self] granted in
          DispatchQueue.main.async {
            guard let self, self.speechGeneration == generation else { return }
            guard granted else {
              self.failListening("Microphone permission was not granted.", state: "unavailable")
              return
            }
            // A permission dialog can outlive the screen or app foreground.
            // Cancellation invalidates generation, and backgrounding cannot
            // cause capture to start when the permission callback arrives.
            guard UIApplication.shared.applicationState == .active else {
              self.failListening("Listening requires the app to be in the foreground.")
              return
            }
            self.beginCapture(generation: generation)
          }
        }
      }
    }
  }

  /// End capture immediately, then allow the on-device recognizer to deliver
  /// its genuine final transcript. A timeout is an error, never a fake final.
  func stopListening() {
    guard speechID != nil else { return }
    guard recognitionRequest != nil else {
      cancelListening()
      return
    }
    stopInput()
    recognitionRequest?.endAudio()
    recognitionTask?.finish()
    guard finalResultDeadline == nil else { return }
    let generation = speechGeneration
    let deadline = DispatchWorkItem { [weak self] in
      guard let self, self.speechGeneration == generation else { return }
      self.failListening("The on-device recognizer did not produce a final result.")
    }
    finalResultDeadline = deadline
    DispatchQueue.main.asyncAfter(deadline: .now() + finalResultWaitSeconds, execute: deadline)
  }

  func dispose() {
    emit = nil
    cancelListening()
    stopPlayback()
    synthesizer.delegate = nil
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
  }

  private func beginCapture(generation: UUID) {
    guard let recognizer, recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else {
      failListening("On-device recognition is unavailable for this language.", state: "unavailable")
      return
    }
    do {
      try audioSession.setCategory(.playAndRecord, mode: .measurement,
                                   options: [.defaultToSpeaker, .allowBluetooth])
      try audioSession.setActive(true)
      let input = audioEngine.inputNode
      let format = input.outputFormat(forBus: 0)
      guard format.sampleRate > 0, format.channelCount > 0 else {
        throw failure("No microphone input is available.")
      }
      let request = SFSpeechAudioBufferRecognitionRequest()
      // BOTH gates are mandatory: Apple only honors requiresOnDeviceRecognition
      // on a recognizer whose supportsOnDeviceRecognition is true.
      request.requiresOnDeviceRecognition = true
      request.shouldReportPartialResults = true
      request.taskHint = .dictation
      recognitionRequest = request
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
        // Audio stays inside native memory. No disk or bridge serialization.
        request.append(buffer)
      }
      hasInputTap = true
      recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
        DispatchQueue.main.async {
          guard let self, self.speechGeneration == generation else { return }
          if let result {
            self.emitSpeech(state: result.isFinal ? "final" : "partial",
                            transcript: result.bestTranscription.formattedString)
            if result.isFinal {
              self.clearListening()
              return
            }
          }
          if error != nil { self.failListening("On-device speech recognition failed.") }
        }
      }
      audioEngine.prepare()
      try audioEngine.start()
      emitSpeech(state: "listening")
      finishStart(.success(()))
    } catch {
      failListening("Microphone capture could not be started.")
    }
  }

  private func installedVoice(locale: String) -> AVSpeechSynthesisVoice? {
    let requested = locale.replacingOccurrences(of: "_", with: "-").lowercased()
    let language = requested.split(separator: "-").first.map(String.init)
    let voices = AVSpeechSynthesisVoice.speechVoices()
    return voices.first { $0.language.lowercased() == requested }
      ?? voices.first { $0.language.lowercased().split(separator: "-").first.map(String.init) == language }
  }

  private func emitSpeech(state: String, transcript: String = "") {
    guard let id = speechID else { return }
    emit?("speech", ["id": id, "state": state, "transcript": transcript, "latencyMs": NSNull()])
  }

  private func failListening(_ message: String, state: String = "error") {
    emitSpeech(state: state)
    finishStart(.failure(failure(message)))
    clearListening()
  }

  private func cancelListening() {
    guard speechID != nil else { return }
    failListening("Listening was canceled.")
  }

  private func finishStart(_ result: Result<Void, Error>) {
    let completion = pendingStart
    pendingStart = nil
    completion?(result)
  }

  private func clearListening() {
    speechGeneration = nil
    speechID = nil
    finalResultDeadline?.cancel()
    finalResultDeadline = nil
    stopInput()
    recognitionRequest?.endAudio()
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest = nil
    recognizer = nil
    deactivateIfIdle()
  }

  private func stopInput() {
    if audioEngine.isRunning { audioEngine.stop() }
    if hasInputTap {
      audioEngine.inputNode.removeTap(onBus: 0)
      hasInputTap = false
    }
  }

  private func deactivateIfIdle() {
    guard activePlaybackID == nil, speechID == nil, filePlayer == nil else { return }
    try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
  }

  private func observeAudioLifecycle() {
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification,
                                        object: nil, queue: .main) { [weak self] _ in
      self?.cancelListening()
    })
    observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification,
                                        object: audioSession, queue: .main) { [weak self] notification in
      guard let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        AVAudioSession.InterruptionType(rawValue: type) == .began else { return }
      self?.cancelListening()
      self?.stopPlayback()
    })
    observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification,
                                        object: audioSession, queue: .main) { [weak self] notification in
      guard let raw = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
        AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable else { return }
      self?.cancelListening()
      self?.stopPlayback()
    })
    observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification,
                                        object: audioSession, queue: .main) { [weak self] _ in
      guard let self else { return }
      self.cancelListening()
      self.stopPlayback()
      self.synthesizer.delegate = nil
      self.synthesizer = AVSpeechSynthesizer()
      self.synthesizer.delegate = self
      self.audioEngine = AVAudioEngine()
    })
  }

  private func failure(_ message: String) -> NSError {
    NSError(domain: "LoroAudioSpeech", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.filePlayer === player, let id = self.activePlaybackID else { return }
      self.filePlayer = nil
      self.activePlaybackID = nil
      self.emit?("playback", ["id": id, "state": flag ? "ended" : "error"])
      self.deactivateIfIdle()
    }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
    DispatchQueue.main.async { [weak self] in
      guard let self, let id = self.utteranceIDs[ObjectIdentifier(utterance)],
        self.activePlaybackID == id else { return }
      self.emit?("playback", ["id": id, "state": "playing"])
    }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    finishPlayback(utterance, state: "ended")
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    finishPlayback(utterance, state: "stopped")
  }

  private func finishPlayback(_ utterance: AVSpeechUtterance, state: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self, let id = self.utteranceIDs.removeValue(forKey: ObjectIdentifier(utterance)),
        self.activePlaybackID == id else { return }
      self.activePlaybackID = nil
      self.emit?("playback", ["id": id, "state": state])
      self.deactivateIfIdle()
    }
  }

  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.filePlayer === player, let id = self.activePlaybackID else { return }
      self.activePlaybackID = nil
      self.filePlayer?.delegate = nil
      self.filePlayer = nil
      self.emit?("playback", ["id": id, "state": flag ? "ended" : "error"])
      self.deactivateIfIdle()
    }
  }
}
