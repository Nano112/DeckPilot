import Foundation

// MARK: - MediaRemote dynamic loading

private let mrBundle: CFBundle? = {
    let path = "/System/Library/PrivateFrameworks/MediaRemote.framework"
    guard let url = CFURLCreateWithFileSystemPath(nil, path as CFString, .cfurlposixPathStyle, true),
          let bundle = CFBundleCreate(nil, url) else {
        return nil
    }
    guard CFBundleLoadExecutable(bundle) else { return nil }
    return bundle
}()

private func mrFunc<T>(_ name: String) -> T? {
    guard let bundle = mrBundle else { return nil }
    guard let ptr = CFBundleGetFunctionPointerForName(bundle, name as CFString) else { return nil }
    return unsafeBitCast(ptr, to: T.self)
}

// MRMediaRemoteGetNowPlayingInfo(dispatch_queue_t, void (^)(CFDictionaryRef))
typealias MRGetNowPlayingInfoFn = @convention(c) (DispatchQueue, @escaping (CFDictionary) -> Void) -> Void
// MRMediaRemoteSetElapsedTime(Double)
typealias MRSetElapsedTimeFn = @convention(c) (Double) -> Void
// MRMediaRemoteGetNowPlayingApplicationIsPlaying(dispatch_queue_t, void (^)(Bool))
typealias MRGetIsPlayingFn = @convention(c) (DispatchQueue, @escaping (Bool) -> Void) -> Void

private let MRMediaRemoteGetNowPlayingInfo: MRGetNowPlayingInfoFn? = mrFunc("MRMediaRemoteGetNowPlayingInfo")
private let MRMediaRemoteSetElapsedTime: MRSetElapsedTimeFn? = mrFunc("MRMediaRemoteSetElapsedTime")
private let MRMediaRemoteGetNowPlayingApplicationIsPlaying: MRGetIsPlayingFn? = mrFunc("MRMediaRemoteGetNowPlayingApplicationIsPlaying")

// MediaRemote info dictionary keys
private let kTitle = "kMRMediaRemoteNowPlayingInfoTitle" as CFString
private let kArtist = "kMRMediaRemoteNowPlayingInfoArtist" as CFString
private let kAlbum = "kMRMediaRemoteNowPlayingInfoAlbum" as CFString
private let kDuration = "kMRMediaRemoteNowPlayingInfoDuration" as CFString
private let kElapsed = "kMRMediaRemoteNowPlayingInfoElapsedTime" as CFString
private let kPlaybackRate = "kMRMediaRemoteNowPlayingInfoPlaybackRate" as CFString
private let kArtworkData = "kMRMediaRemoteNowPlayingInfoArtworkData" as CFString
private let kBundleId = "kMRMediaRemoteNowPlayingInfoClientPropertiesDeviceUID" as CFString

// MARK: - Artwork cache
private var lastArtworkHash: Int = 0
private var cachedArtworkBase64: String? = nil

// MARK: - Main

guard MRMediaRemoteGetNowPlayingInfo != nil else {
    fputs("[NowPlaying] MediaRemote framework unavailable\n", stderr)
    exit(2)
}

// Disable stdout buffering for line-by-line output
setbuf(stdout, nil)

// Set up polling timer
let queue = DispatchQueue(label: "now-playing-poll")
let timer = DispatchSource.makeTimerSource(queue: queue)
timer.schedule(deadline: .now(), repeating: .seconds(1))
timer.setEventHandler {
    pollNowPlaying()
}
timer.resume()

// Read stdin for seek commands
let stdinSource = DispatchSource.makeReadSource(fileDescriptor: STDIN_FILENO, queue: queue)
stdinSource.setEventHandler {
    guard let line = readLine(strippingNewline: true), !line.isEmpty else { return }
    handleStdinCommand(line)
}
stdinSource.resume()

dispatchMain()

// MARK: - Poll

func pollNowPlaying() {
    // Get playback state first
    MRMediaRemoteGetNowPlayingApplicationIsPlaying?(queue) { isPlaying in
        MRMediaRemoteGetNowPlayingInfo?(queue) { info in
            let dict = info as NSDictionary

            guard let title = dict[kTitle] as? String, !title.isEmpty else {
                // No media playing
                return
            }

            let artist = dict[kArtist] as? String ?? ""
            let album = dict[kAlbum] as? String ?? ""
            let duration = dict[kDuration] as? Double ?? 0
            let elapsed = dict[kElapsed] as? Double ?? 0
            let playbackRate = dict[kPlaybackRate] as? Double ?? 1.0

            // Bundle ID — try multiple keys
            var bundleId = ""
            if let bid = dict["kMRMediaRemoteNowPlayingInfoClientPropertiesDeviceUID"] as? String {
                bundleId = bid
            } else if let bid = dict["kMRNowPlayingClientUserInfoKey"] as? String {
                bundleId = bid
            }

            // Artwork: cache by hash to avoid re-encoding
            var artworkBase64: String? = nil
            if let artData = dict[kArtworkData] as? Data {
                let hash = artData.hashValue
                if hash != lastArtworkHash {
                    lastArtworkHash = hash
                    cachedArtworkBase64 = artData.base64EncodedString()
                }
                artworkBase64 = cachedArtworkBase64
            }

            // Build JSON output
            var obj: [String: Any] = [
                "title": title,
                "artist": artist,
                "album": album,
                "duration": duration,
                "elapsed": elapsed,
                "playbackRate": playbackRate,
                "isPlaying": isPlaying,
                "bundleId": bundleId,
            ]
            if let art = artworkBase64 {
                obj["artworkBase64"] = art
            }

            if let jsonData = try? JSONSerialization.data(withJSONObject: obj),
               let jsonStr = String(data: jsonData, encoding: .utf8) {
                print(jsonStr)
            }
        }
    }
}

// MARK: - Stdin commands

func handleStdinCommand(_ line: String) {
    guard let data = line.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        return
    }

    if json["command"] as? String == "seek",
       let position = json["position"] as? Double {
        MRMediaRemoteSetElapsedTime?(position)
    }
}
