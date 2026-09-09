import CryptoKit
import AVFoundation
import ExpoModulesCore
import UIKit

struct LoroCacheDownloadOptions: Record {
  @Field var url: String = ""
  @Field var expectedSha256: String = ""
  @Field var logicalKey: String = ""
  @Field var pinClass: String = "listening"
}

struct LoroCacheConcatenateOptions: Record {
  @Field var fileUris: [String] = []
  @Field var intraGapMs: Double = 400
  @Field var interGapMs: Double = 1200
  @Field var takesPerPhrase: Double = 3
  @Field var outputName: String = ""
}

/// Model-audio file cache. HTTP lives here, not in the speech module (ADR-0011).
public final class LoroAudioCacheModule: Module {
  private let controller = LoroAudioCacheController()

  public func definition() -> ModuleDefinition {
    Name("LoroAudioCache")

    AsyncFunction("download") { (options: LoroCacheDownloadOptions) -> [String: Any?] in
      try self.controller.download(options)
    }

    AsyncFunction("lookup") { (logicalKey: String) -> [String: Any?]? in
      self.controller.lookup(logicalKey)
    }

    AsyncFunction("cancel") {
      self.controller.cancel()
    }

    AsyncFunction("pin") { (keys: [String]) in
      self.controller.pin(keys)
    }

    AsyncFunction("unpin") { (keys: [String]) in
      self.controller.unpin(keys)
    }

    AsyncFunction("concatenate") { (options: LoroCacheConcatenateOptions) -> [String: Any?] in
      try self.controller.concatenate(options)
    }

    AsyncFunction("share") { (fileUri: String) in
      try self.controller.share(fileUri)
    }
  }
}

private final class LoroAudioCacheController {
  private let budget: Int64 = 64 * 1024 * 1024
  private let shareEnabled = false
  private var task: URLSessionDataTask?
private let session: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = false
    config.httpCookieAcceptPolicy = .never
    return URLSession(configuration: config, delegate: RedirectDeny(), delegateQueue: nil)
  }()
  private let io = DispatchQueue(label: "app.loro.audio-cache")

  func download(_ options: LoroCacheDownloadOptions) throws -> [String: Any?] {
    guard let remote = URL(string: options.url),
      remote.user == nil,
      remote.password == nil,
      remote.scheme == "https" || remote.scheme == "http"
    else {
      throw failure("invalid-url")
    }
    var data: Data?
    var error: Error?
    let lock = DispatchSemaphore(value: 0)
    io.sync { self.task?.cancel() }
    let task = session.dataTask(with: remote) { payload, _, failed in
      data = payload
      error = failed
      lock.signal()
    }
    io.sync { self.task = task }
    task.resume()
    lock.wait()
    io.sync { self.task = nil }
    if let error, (error as NSError).code == NSURLErrorCancelled {
      throw failure("cancelled")
    }
    guard let bytes = data, error == nil else { throw failure("failed") }
    let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    guard digest == options.expectedSha256.lowercased() else { throw failure("checksum-mismatch") }
    let file = try store(bytes: bytes, sha256: digest, key: options.logicalKey, pin: options.pinClass)
    return file
  }

  func lookup(_ logicalKey: String) -> [String: Any?]? {
    guard let row = index()[logicalKey], let path = row["path"] as? String else { return nil }
    let url = URL(fileURLWithPath: path)
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return payload(url: url, sha256: row["sha256"] as? String, ms: row["ms"] as? Int)
  }

  func cancel() {
    io.sync {
      self.task?.cancel()
      self.task = nil
    }
  }

  func pin(_ keys: [String]) {
    mutateIndex { table in
      for key in keys { table[key]?["pinned"] = true }
    }
  }

  func unpin(_ keys: [String]) {
    mutateIndex { table in
      for key in keys { table[key]?["pinned"] = false }
    }
    evictIfNeeded()
  }

  func concatenate(_ options: LoroCacheConcatenateOptions) throws -> [String: Any?] {
    guard shareEnabled else { throw failure("share-gated") }
    guard !options.fileUris.isEmpty, !options.outputName.isEmpty else { throw failure("failed") }
    let composition = AVMutableComposition()
    guard let track = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    else { throw failure("failed") }
    var cursor = CMTime.zero
    let takes = max(1, Int(options.takesPerPhrase.rounded()))
    for (index, uri) in options.fileUris.enumerated() {
      guard let url = URL(string: uri), url.isFileURL else { throw failure("invalid-url") }
      let asset = AVURLAsset(url: url)
      guard let assetTrack = asset.tracks(withMediaType: .audio).first else { throw failure("failed") }
      let duration = asset.duration
      try track.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: assetTrack, at: cursor)
      cursor = CMTimeAdd(cursor, duration)
      let last = index == options.fileUris.count - 1
      if !last {
        let gapMs = ((index + 1) % takes == 0) ? options.interGapMs : options.intraGapMs
        cursor = CMTimeAdd(cursor, CMTimeMakeWithSeconds(gapMs / 1000, preferredTimescale: 600))
      }
    }
    let output = try cacheDirectory().appendingPathComponent(options.outputName)
    if FileManager.default.fileExists(atPath: output.path) {
      try FileManager.default.removeItem(at: output)
    }
    let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A)
    guard let exporter else { throw failure("failed") }
    exporter.outputURL = output
    exporter.outputFileType = .m4a
    let lock = DispatchSemaphore(value: 0)
    exporter.exportAsynchronously { lock.signal() }
    lock.wait()
    guard exporter.status == .completed else { throw failure("failed") }
    let bytes = try Data(contentsOf: output)
    let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    return payload(url: output, sha256: digest, ms: measuredMs(output))
  }

  func share(_ fileUri: String) throws {
    guard shareEnabled else { throw failure("share-gated") }
    guard let url = URL(string: fileUri), url.isFileURL else { throw failure("invalid-url") }
    var error: Error?
    let lock = DispatchSemaphore(value: 0)
    DispatchQueue.main.async {
      guard let presenter = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .flatMap({ $0.windows })
        .first(where: { $0.isKeyWindow })?
        .rootViewController
      else {
        error = self.failure("failed")
        lock.signal()
        return
      }
      let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
      presenter.present(sheet, animated: true) { lock.signal() }
    }
    lock.wait()
    if let error { throw error }
  }

  private func store(bytes: Data, sha256: String, key: String, pin: String) throws -> [String: Any?] {
    let directory = try cacheDirectory()
    let file = directory.appendingPathComponent("sha256/\(sha256).m4a")
    try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
    let temp = file.appendingPathExtension("tmp")
    do {
      try bytes.write(to: temp, options: .atomic)
      _ = try FileManager.default.replaceItemAt(file, withItemAt: temp)
    } catch {
      try? FileManager.default.removeItem(at: temp)
      throw failure("disk-full")
    }
    let ms = measuredMs(file)
    mutateIndex { table in
      table[key] = [
        "path": file.path,
        "sha256": sha256,
        "ms": ms as Any,
        "pinned": pin == "listening",
        "bytes": bytes.count,
      ]
    }
    evictIfNeeded()
    return payload(url: file, sha256: sha256, ms: ms)
  }

  private func measuredMs(_ url: URL) -> Int? {
    let seconds = CMTimeGetSeconds(AVURLAsset(url: url).duration)
    guard seconds.isFinite, seconds > 0 else { return nil }
    return Int((seconds * 1000).rounded())
  }

  private func payload(url: URL, sha256: String?, ms: Int?) -> [String: Any?] {
    ["fileUri": url.absoluteString, "ms": ms, "sha256": sha256]
  }

  private func cacheDirectory() throws -> URL {
    guard let root = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      throw failure("failed")
    }
    let directory = root.appendingPathComponent("loro-audio-cache", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private func indexURL() throws -> URL {
    try cacheDirectory().appendingPathComponent("index.json")
  }

  private func index() -> [String: [String: Any]] {
    guard let url = try? indexURL(),
      let data = try? Data(contentsOf: url),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: [String: Any]]
    else { return [:] }
    return object
  }

  private func mutateIndex(_ body: (inout [String: [String: Any]]) -> Void) {
    var table = index()
    body(&table)
    guard let url = try? indexURL(),
      let data = try? JSONSerialization.data(withJSONObject: table)
    else { return }
    try? data.write(to: url, options: .atomic)
  }

  private func evictIfNeeded() {
    var table = index()
    let unpinned = table.filter { ($0.value["pinned"] as? Bool) != true }
    let used = unpinned.values.reduce(Int64(0)) { $0 + Int64(($1["bytes"] as? Int) ?? 0) }
    guard used > budget else { return }
    var remaining = used
    for (key, row) in unpinned {
      if remaining <= budget { break }
      if let path = row["path"] as? String {
        try? FileManager.default.removeItem(atPath: path)
        remaining -= Int64((row["bytes"] as? Int) ?? 0)
      }
      table.removeValue(forKey: key)
    }
    mutateIndex { $0 = table }
  }

  private func failure(_ code: String) -> NSError {
    NSError(domain: "LoroAudioCache", code: 1, userInfo: [NSLocalizedDescriptionKey: code])
  }
}

private final class RedirectDeny: NSObject, URLSessionTaskDelegate {
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }
}
