import CryptoKit
import AVFoundation
import ExpoModulesCore
import UIKit

struct LoroCacheDownloadOptions: Record {
  @Field var url: String = ""
  @Field var expectedSha256: String = ""
  @Field var logicalKey: String = ""
  @Field var pinClass: String = "listening"
  @Field var authorization: String? = nil
  @Field var deviceId: String? = nil
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

    AsyncFunction("saveListeningBatch") { (clips: [[String: Any]]) in
      try self.controller.saveBatch(clips)
    }

    AsyncFunction("loadListeningBatch") { () -> [[String: Any?]]? in
      self.controller.loadBatch()
    }

    AsyncFunction("installDevFixture") { (logicalKey: String) -> [String: Any?] in
      try self.controller.installDevFixture(logicalKey)
    }
  }
}

private final class LoroAudioCacheController {
  private let budget: Int64 = 64 * 1024 * 1024
  private let shareEnabled = false // Q-22: neural listening audio must not leave the app
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
    var status = 0
    var error: Error?
    let lock = DispatchSemaphore(value: 0)
    io.sync { self.task?.cancel() }
    var request = URLRequest(url: remote)
    request.timeoutInterval = 15
    request.httpShouldHandleCookies = false
    request.cachePolicy = .reloadIgnoringLocalCacheData
    if let authorization = options.authorization, !authorization.isEmpty {
      request.setValue(authorization, forHTTPHeaderField: "Authorization")
    }
    if let deviceId = options.deviceId, !deviceId.isEmpty {
      request.setValue(deviceId, forHTTPHeaderField: "X-Loro-Device")
    }
    let task = session.dataTask(with: request) { payload, response, failed in
      data = payload
      status = (response as? HTTPURLResponse)?.statusCode ?? 0
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
    guard let bytes = data, error == nil, status == 200 else { throw failure("failed") }
    let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    guard digest == options.expectedSha256.lowercased() else { throw failure("checksum-mismatch") }
    let file = try store(bytes: bytes, sha256: digest, key: options.logicalKey, pin: options.pinClass)
    return file
  }

  func lookup(_ logicalKey: String) -> [String: Any?]? {
    guard let row = index()[logicalKey],
      let path = row["path"] as? String,
      let sha256 = row["sha256"] as? String
    else { return nil }
    let url = URL(fileURLWithPath: path)
    guard FileManager.default.fileExists(atPath: url.path),
      let digest = sha256Hex(url),
      digest == sha256.lowercased()
    else {
      forget(logicalKey)
      return nil
    }
    mutateIndex { table in
      table[logicalKey]?["accessed"] = Date().timeIntervalSince1970
    }
    return payload(url: url, sha256: digest, ms: row["ms"] as? Int)
  }

  func installDevFixture(_ logicalKey: String) throws -> [String: Any?] {
    #if DEBUG
      guard let bytes = Data(base64Encoded: LoroAudioCacheController.fixtureBase64) else {
        throw failure("failed")
      }
      let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
      return try store(bytes: bytes, sha256: digest, key: logicalKey, pin: "listening")
    #else
      throw failure("failed")
    #endif
  }

  func saveBatch(_ clips: [[String: Any]]) throws {
    let url = try cacheDirectory().appendingPathComponent("listening-batch.json")
    let data = try JSONSerialization.data(withJSONObject: clips)
    try data.write(to: url, options: .atomic)
  }

  func loadBatch() -> [[String: Any?]]? {
    guard let url = try? cacheDirectory().appendingPathComponent("listening-batch.json"),
      let data = try? Data(contentsOf: url),
      let clips = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return nil }
    var verified: [[String: Any?]] = []
    for clip in clips {
      guard let fileUri = clip["fileUri"] as? String,
        let sha256 = clip["sha256"] as? String,
        let file = URL(string: fileUri),
        file.isFileURL,
        FileManager.default.fileExists(atPath: file.path),
        let digest = sha256Hex(file),
        digest == sha256.lowercased()
      else { return nil }
      verified.append(["fileUri": fileUri, "ms": clip["ms"], "sha256": sha256])
    }
    return verified.isEmpty ? nil : verified
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
    let accessed = Date().timeIntervalSince1970
    mutateIndex { table in
      table[key] = [
        "path": file.path,
        "sha256": sha256,
        "ms": ms as Any,
        "pinned": pin == "listening",
        "bytes": bytes.count,
        "accessed": accessed,
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

  private func sha256Hex(_ url: URL) -> String? {
    guard let data = try? Data(contentsOf: url) else { return nil }
    return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }

  private func forget(_ logicalKey: String) {
    mutateIndex { table in
      if let path = table[logicalKey]?["path"] as? String {
        try? FileManager.default.removeItem(atPath: path)
      }
      table.removeValue(forKey: logicalKey)
    }
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
    let oldest = unpinned.sorted { lhs, rhs in
      (lhs.value["accessed"] as? Double ?? 0) < (rhs.value["accessed"] as? Double ?? 0)
    }
    for (key, row) in oldest {
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

  /// Silent AAC 24 kHz mono. Development fixture only — not licensed neural audio.
  private static let fixtureBase64 =
    "AAAAHGZ0eXBNNEEgAAACAE00QSBpc29taXNvMgAAAAhmcmVlAAAAMW1kYXTeAgBMYXZjNjAuMzEuMTAyAAIwQA4BGCAHARggBwEYIAcBGCAHARggBwAAAxNtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAyAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACPXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAyAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAMgAAAQAAAEAAAAAAbVtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAF3AAAAWwFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAFgbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAEkc3RibAAAAGpzdHNkAAAAAAAAAAEAAABabXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAF3AAAAAAAA2ZXNkcwAAAAADgICAJQABAASAgIAXQBUAAAAAAPoAAAAFRwWAgIAFEwhW5QAGgICAAQIAAAAgc3R0cwAAAAAAAAACAAAABQAABAAAAAABAAACwAAAABxzdHNjAAAAAAAAAAEAAAABAAAABgAAAAEAAAAsc3RzegAAAAAAAAAAAAAABgAAABUAAAAEAAAABAAAAAQAAAAEAAAABAAAABRzdGNvAAAAAAAAAAEAAAAsAAAAGnNncGQBAAAAcm9sbAAAAAIAAAAB//8AAAAcc2JncAAAAAByb2xsAAAAAQAAAAYAAAABAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2MC4xNi4xMDA="
}

private final class RedirectDeny: NSObject, URLSessionTaskDelegate {
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    // Never follow redirects: a Bearer header must not hop to another host.
    completionHandler(nil)
  }
}
