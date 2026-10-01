import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

/// One grade as the app sends it (src/audio/nowPlaying.ts).
struct GradeRecord: Record {
  @Field var grade: String = ""
  @Field var label: String = ""
  @Field var detail: String = ""
  @Field var selected: Bool = false
}

/// What the one player shows and offers. Text only: no audio crosses this bridge.
struct NowPlayingRecord: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var artist: String = ""
  @Field var album: String = ""
  @Field var artworkUrl: String? = nil
  @Field var playing: Bool = false
  @Field var canNext: Bool = false
  @Field var canPrevious: Bool = false
  @Field var positionMs: Double? = nil
  @Field var durationMs: Double? = nil
  @Field var grades: [GradeRecord]? = nil
  @Field var nextLabel: String = ""
  @Field var channelName: String = ""
  @Field var hasSilences: Bool = false
}

/// The one player on the lock screen and in Control Center (src/audio/lockScreen.ts): Now Playing
/// info, and the remote commands (play, pause, next, previous, a song's position) coming back as
/// `onCommand` events. The grades ride on the feedback commands, with the app's localized names:
/// Missed on "dislike", Hard on "bookmark", Easy on "like"; where iOS shows them depends on the
/// version. While the phrase loop plays, a silent loop keeps the audio session running through its
/// silences, so the app isn't suspended between clips with the screen locked.
///
/// UNVERIFIED: written without Xcode (plan 104); build and try it on a device before relying on it.
public final class LoroMediaModule: Module {
  private var current: NowPlayingRecord?
  private var targets: [(MPRemoteCommand, Any)] = []
  private var observers: [NSObjectProtocol] = []
  private var keepAlive: AVAudioPlayer?
  private var resumeAfterInterruption = false
  private var artworkUrl: String?
  private var artwork: MPMediaItemArtwork?

  public func definition() -> ModuleDefinition {
    Name("LoroMedia")

    Events("onCommand")

    OnCreate {
      DispatchQueue.main.async { self.observeSession() }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.clear()
        self.observers.forEach { NotificationCenter.default.removeObserver($0) }
        self.observers = []
      }
    }

    Function("show") { (item: NowPlayingRecord) in
      DispatchQueue.main.async { self.show(item) }
    }

    Function("hide") {
      DispatchQueue.main.async { self.clear() }
    }

    // A timer for the loop's silences that keeps time while the app is in the background.
    AsyncFunction("wait") { (ms: Double, promise: Promise) in
      DispatchQueue.main.asyncAfter(deadline: .now() + max(0, ms) / 1000) { promise.resolve(nil) }
    }
  }

  // MARK: Now Playing

  private func show(_ item: NowPlayingRecord) {
    if targets.isEmpty { enableCommands() }
    current = item
    let center = MPRemoteCommandCenter.shared()
    center.nextTrackCommand.isEnabled = item.canNext
    center.previousTrackCommand.isEnabled = item.canPrevious
    center.changePlaybackPositionCommand.isEnabled = item.durationMs != nil
    let grades = item.grades ?? []
    feedback(center.dislikeCommand, grades.first { $0.grade == "missed" })
    feedback(center.bookmarkCommand, grades.first { $0.grade == "hard" })
    feedback(center.likeCommand, grades.first { $0.grade == "easy" })

    var info: [String: Any] = [
      MPMediaItemPropertyTitle: item.title,
      MPMediaItemPropertyArtist: item.artist,
      MPMediaItemPropertyAlbumTitle: item.album,
      MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
      MPNowPlayingInfoPropertyPlaybackRate: item.playing ? 1.0 : 0.0,
      MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
    ]
    if let duration = item.durationMs {
      info[MPMediaItemPropertyPlaybackDuration] = duration / 1000
      info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = (item.positionMs ?? 0) / 1000
    }
    if let artwork, artworkUrl == item.artworkUrl {
      info[MPMediaItemPropertyArtwork] = artwork
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    loadArtwork(item.artworkUrl)
    keepAwake(item.playing && item.hasSilences)
  }

  private func clear() {
    current = nil
    resumeAfterInterruption = false
    keepAwake(false)
    for (command, target) in targets {
      command.removeTarget(target)
      command.isEnabled = false
    }
    targets = []
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  private func feedback(_ command: MPFeedbackCommand, _ grade: GradeRecord?) {
    command.isEnabled = grade != nil
    command.isActive = grade?.selected ?? false
    command.localizedTitle = grade?.label ?? ""
    command.localizedShortTitle = grade?.label ?? ""
  }

  private func enableCommands() {
    let center = MPRemoteCommandCenter.shared()
    on(center.playCommand) { $0.send("play") }
    on(center.pauseCommand) { $0.send("pause") }
    on(center.togglePlayPauseCommand) { $0.send($0.current?.playing == true ? "pause" : "play") }
    on(center.nextTrackCommand) { $0.send("next") }
    on(center.previousTrackCommand) { $0.send("previous") }
    on(center.dislikeCommand) { $0.rate("missed") }
    on(center.bookmarkCommand) { $0.rate("hard") }
    on(center.likeCommand) { $0.rate("easy") }
    let seek = center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let self, let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      self.send("seek", ["positionMs": event.positionTime * 1000])
      return .success
    }
    targets.append((center.changePlaybackPositionCommand, seek))
    center.playCommand.isEnabled = true
    center.pauseCommand.isEnabled = true
    center.togglePlayPauseCommand.isEnabled = true
  }

  private func on(_ command: MPRemoteCommand, _ action: @escaping (LoroMediaModule) -> Void) {
    let target = command.addTarget { [weak self] _ in
      guard let self, self.current != nil else { return .noActionableNowPlayingItem }
      action(self)
      return .success
    }
    targets.append((command, target))
  }

  /// A rating names the item it was shown on: if the app has moved on since, the app drops it.
  private func rate(_ grade: String) {
    guard let item = current, item.grades != nil else { return }
    send("rate", ["grade": grade, "id": item.id])
  }

  private func send(_ type: String, _ extra: [String: Any?] = [:]) {
    var body: [String: Any?] = ["type": type]
    for (key, value) in extra { body[key] = value }
    sendEvent("onCommand", body)
  }

  private func loadArtwork(_ url: String?) {
    guard url != artworkUrl else { return }
    artworkUrl = url
    artwork = nil
    guard let url, let address = URL(string: url) else { return }
    URLSession.shared.dataTask(with: address) { [weak self] data, _, _ in
      guard let data, let image = UIImage(data: data) else { return }
      DispatchQueue.main.async {
        guard let self, self.artworkUrl == url else { return }
        let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
        self.artwork = artwork
        if var info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
          info[MPMediaItemPropertyArtwork] = artwork
          MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
      }
    }.resume()
  }

  // MARK: Interruptions

  private func observeSession() {
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
      self?.interrupted(note)
    })
    observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
      self?.routeChanged(note)
    })
  }

  /// A call or another app's sound pauses the player; when it ends and iOS says so, it resumes.
  private func interrupted(_ note: Notification) {
    guard let info = note.userInfo,
          let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
    switch type {
    case .began:
      if current?.playing == true {
        resumeAfterInterruption = true
        send("pause")
      }
    case .ended:
      let options = AVAudioSession.InterruptionOptions(rawValue: info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0)
      if resumeAfterInterruption && options.contains(.shouldResume) { send("play") }
      resumeAfterInterruption = false
    @unknown default:
      break
    }
  }

  /// Headphones unplugged: pause, as every media app does.
  private func routeChanged(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
          AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable,
          current?.playing == true else { return }
    send("pause")
  }

  // MARK: The loop's silences

  private func keepAwake(_ on: Bool) {
    guard on else {
      keepAlive?.stop()
      return
    }
    if keepAlive == nil {
      keepAlive = try? AVAudioPlayer(data: Self.silence)
      keepAlive?.numberOfLoops = -1
      keepAlive?.volume = 0
      keepAlive?.prepareToPlay()
    }
    if keepAlive?.isPlaying == false { keepAlive?.play() }
  }

  /// One second of silence as a WAV file (8 kHz, 16-bit, mono), looped while the loop plays.
  private static let silence: Data = {
    let sampleRate: UInt32 = 8000
    let size = sampleRate * 2
    var wav = Data()
    func ascii(_ text: String) { wav.append(contentsOf: Array(text.utf8)) }
    func u32(_ value: UInt32) { withUnsafeBytes(of: value.littleEndian) { wav.append(contentsOf: $0) } }
    func u16(_ value: UInt16) { withUnsafeBytes(of: value.littleEndian) { wav.append(contentsOf: $0) } }
    ascii("RIFF"); u32(36 + size); ascii("WAVE")
    ascii("fmt "); u32(16); u16(1); u16(1); u32(sampleRate); u32(sampleRate * 2); u16(2); u16(16)
    ascii("data"); u32(size)
    wav.append(Data(count: Int(size)))
    return wav
  }()
}
