import Foundation
import AVFoundation
import CoreAudio
import AudioToolbox

// MARK: - CoreAudio Device Utilities

func getAllAudioDevices() -> [AudioDeviceID] {
    var propAddr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &propAddr, 0, nil, &size) == noErr else {
        return []
    }
    let count = Int(size) / MemoryLayout<AudioDeviceID>.size
    var devices = [AudioDeviceID](repeating: 0, count: count)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &propAddr, 0, nil, &size, &devices) == noErr else {
        return []
    }
    return devices
}

func getDeviceName(_ deviceID: AudioDeviceID) -> String? {
    var propAddr = AudioObjectPropertyAddress(
        mSelector: kAudioObjectPropertyName,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var name: CFString = "" as CFString
    var size = UInt32(MemoryLayout<CFString>.size)
    guard AudioObjectGetPropertyData(deviceID, &propAddr, 0, nil, &size, &name) == noErr else {
        return nil
    }
    return name as String
}

func getDefaultOutputDevice() -> AudioDeviceID {
    var propAddr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDefaultOutputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var deviceID: AudioDeviceID = 0
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &propAddr, 0, nil, &size, &deviceID)
    return deviceID
}

func getDefaultInputDevice() -> AudioDeviceID {
    var propAddr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDefaultInputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var deviceID: AudioDeviceID = 0
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &propAddr, 0, nil, &size, &deviceID)
    return deviceID
}

func getDeviceUID(_ deviceID: AudioDeviceID) -> String? {
    var propAddr = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyDeviceUID,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var uid: CFString = "" as CFString
    var size = UInt32(MemoryLayout<CFString>.size)
    guard AudioObjectGetPropertyData(deviceID, &propAddr, 0, nil, &size, &uid) == noErr else {
        return nil
    }
    return uid as String
}

func findBlackHoleDevice() -> AudioDeviceID? {
    for device in getAllAudioDevices() {
        if let name = getDeviceName(device), name.contains("BlackHole") {
            return device
        }
    }
    return nil
}

// MARK: - Cleanup Stale Devices

func destroyStaleDeckPilotDevices() {
    for device in getAllAudioDevices() {
        if let name = getDeviceName(device),
           name.hasPrefix("DeckPilot ") {
            let status = AudioHardwareDestroyAggregateDevice(device)
            if status == noErr {
                fputs("[soundboard] Cleaned up stale device: \(name) (\(device))\n", stderr)
            }
        }
    }
}

// MARK: - Mic Passthrough via AUHAL (routes mic audio into BlackHole so Discord gets both)

class MicPassthrough {
    var auHAL: AudioUnit?
    var aggregateDeviceID: AudioDeviceID?

    /// Routes default mic → BlackHole using a low-level AUHAL audio unit
    func start(micDeviceID: AudioDeviceID, blackholeDeviceID: AudioDeviceID) {
        var desc = AudioComponentDescription(
            componentType: kAudioUnitType_Output,
            componentSubType: kAudioUnitSubType_HALOutput,
            componentManufacturer: kAudioUnitManufacturer_Apple,
            componentFlags: 0,
            componentFlagsMask: 0
        )

        guard let component = AudioComponentFindNext(nil, &desc) else {
            fputs("[soundboard] Mic passthrough: AUHAL component not found\n", stderr)
            return
        }

        var unit: AudioUnit?
        guard AudioComponentInstanceNew(component, &unit) == noErr, let au = unit else {
            fputs("[soundboard] Mic passthrough: failed to create AUHAL instance\n", stderr)
            return
        }

        // Enable input (bus 1)
        var enableInput: UInt32 = 1
        var status = AudioUnitSetProperty(au,
            kAudioOutputUnitProperty_EnableIO,
            kAudioUnitScope_Input, 1,
            &enableInput, UInt32(MemoryLayout<UInt32>.size))
        if status != noErr {
            fputs("[soundboard] Mic passthrough: failed to enable input: \(status)\n", stderr)
            AudioComponentInstanceDispose(au)
            return
        }

        // Enable output (bus 0) — this is where audio goes OUT to BlackHole
        var enableOutput: UInt32 = 1
        status = AudioUnitSetProperty(au,
            kAudioOutputUnitProperty_EnableIO,
            kAudioUnitScope_Output, 0,
            &enableOutput, UInt32(MemoryLayout<UInt32>.size))
        if status != noErr {
            fputs("[soundboard] Mic passthrough: failed to enable output: \(status)\n", stderr)
            AudioComponentInstanceDispose(au)
            return
        }

        // Create an aggregate device that has mic as input and BlackHole as output
        // AUHAL only supports one device, so we need an aggregate
        let aggUID = "com.deckpilot.mic-passthrough"
        guard let micUID = getDeviceUID(micDeviceID),
              let bhUID = getDeviceUID(blackholeDeviceID) else {
            fputs("[soundboard] Mic passthrough: failed to get device UIDs\n", stderr)
            AudioComponentInstanceDispose(au)
            return
        }

        let aggDesc: [String: Any] = [
            kAudioAggregateDeviceNameKey as String: "DeckPilot Mic-Passthrough",
            kAudioAggregateDeviceUIDKey as String: aggUID,
            kAudioAggregateDeviceSubDeviceListKey as String: [
                [kAudioSubDeviceUIDKey as String: micUID],
                [kAudioSubDeviceUIDKey as String: bhUID],
            ]
        ]

        var aggDeviceID: AudioDeviceID = 0
        status = AudioHardwareCreateAggregateDevice(aggDesc as CFDictionary, &aggDeviceID)
        if status != noErr {
            fputs("[soundboard] Mic passthrough: failed to create aggregate device: \(status)\n", stderr)
            AudioComponentInstanceDispose(au)
            return
        }
        self.aggregateDeviceID = aggDeviceID

        // Set the aggregate device on the AUHAL
        var devID = aggDeviceID
        status = AudioUnitSetProperty(au,
            kAudioOutputUnitProperty_CurrentDevice,
            kAudioUnitScope_Global, 0,
            &devID, UInt32(MemoryLayout<AudioDeviceID>.size))
        if status != noErr {
            fputs("[soundboard] Mic passthrough: failed to set aggregate device: \(status)\n", stderr)
            AudioHardwareDestroyAggregateDevice(aggDeviceID)
            AudioComponentInstanceDispose(au)
            return
        }

        // Get the input format from the device
        var inputFormat = AudioStreamBasicDescription()
        var formatSize = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        AudioUnitGetProperty(au,
            kAudioUnitProperty_StreamFormat,
            kAudioUnitScope_Input, 1,
            &inputFormat, &formatSize)

        // Set matching format on output scope of input bus and input scope of output bus
        AudioUnitSetProperty(au,
            kAudioUnitProperty_StreamFormat,
            kAudioUnitScope_Output, 1,
            &inputFormat, formatSize)
        AudioUnitSetProperty(au,
            kAudioUnitProperty_StreamFormat,
            kAudioUnitScope_Input, 0,
            &inputFormat, formatSize)

        // Set render callback — reads from input bus 1 and provides to output bus 0
        var callbackStruct = AURenderCallbackStruct(
            inputProc: micPassthroughCallback,
            inputProcRefCon: UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())
        )
        status = AudioUnitSetProperty(au,
            kAudioUnitProperty_SetRenderCallback,
            kAudioUnitScope_Input, 0,
            &callbackStruct, UInt32(MemoryLayout<AURenderCallbackStruct>.size))
        if status != noErr {
            fputs("[soundboard] Mic passthrough: failed to set render callback: \(status)\n", stderr)
            AudioComponentInstanceDispose(au)
            return
        }

        status = AudioUnitInitialize(au)
        if status != noErr {
            fputs("[soundboard] Mic passthrough: failed to initialize: \(status)\n", stderr)
            AudioComponentInstanceDispose(au)
            return
        }

        status = AudioOutputUnitStart(au)
        if status != noErr {
            fputs("[soundboard] Mic passthrough: failed to start: \(status)\n", stderr)
            AudioUnitUninitialize(au)
            AudioComponentInstanceDispose(au)
            return
        }

        auHAL = au
        fputs("[soundboard] Mic passthrough active (mic → BlackHole via AUHAL)\n", stderr)
    }

    func stop() {
        if let au = auHAL {
            AudioOutputUnitStop(au)
            AudioUnitUninitialize(au)
            AudioComponentInstanceDispose(au)
            auHAL = nil
        }
        if let id = aggregateDeviceID {
            AudioHardwareDestroyAggregateDevice(id)
            aggregateDeviceID = nil
        }
    }
}

// C callback: pulls audio from input bus 1 (mic) and provides it to output bus 0 (BlackHole)
func micPassthroughCallback(
    inRefCon: UnsafeMutableRawPointer,
    ioActionFlags: UnsafeMutablePointer<AudioUnitRenderActionFlags>,
    inTimeStamp: UnsafePointer<AudioTimeStamp>,
    inBusNumber: UInt32,
    inNumberFrames: UInt32,
    ioData: UnsafeMutablePointer<AudioBufferList>?
) -> OSStatus {
    guard let ioData = ioData else { return noErr }
    let passthrough = Unmanaged<MicPassthrough>.fromOpaque(inRefCon).takeUnretainedValue()
    guard let au = passthrough.auHAL else { return noErr }

    // Render from input bus 1 (mic) into the output buffer
    return AudioUnitRender(au, ioActionFlags, inTimeStamp, 1, inNumberFrames, ioData)
}

// MARK: - Soundboard Player (dual engine: local speakers + BlackHole for Discord)

class SoundboardPlayer {
    private let localEngine = AVAudioEngine()
    private var discordEngine: AVAudioEngine?
    private var localPlayers: [String: AVAudioPlayerNode] = [:]
    private var discordPlayers: [String: AVAudioPlayerNode] = [:]
    private let lock = NSLock()
    private var micPassthrough: MicPassthrough?
    private var blackholeAvailable = false
    private var localStarted = false
    private var discordStarted = false
    private var localVolume: Float = 1.0
    private var discordVolume: Float = 1.0

    func setup() {
        destroyStaleDeckPilotDevices()

        if let bhDevice = findBlackHoleDevice() {
            // Create a second engine that outputs directly to BlackHole
            let engine = AVAudioEngine()
            setEngineOutput(engine, deviceID: bhDevice)
            discordEngine = engine

            // Start mic passthrough: routes mic → BlackHole via AUHAL
            let defaultInput = getDefaultInputDevice()
            let mp = MicPassthrough()
            mp.start(micDeviceID: defaultInput, blackholeDeviceID: bhDevice)
            micPassthrough = mp

            blackholeAvailable = true
            fputs("[soundboard] Dual engine: local → speakers, discord → BlackHole\n", stderr)
        } else {
            fputs("[soundboard] BlackHole not found, playing locally only\n", stderr)
        }

        outputStatus()
    }

    private func setEngineOutput(_ engine: AVAudioEngine, deviceID: AudioDeviceID) {
        let outputNode = engine.outputNode
        let audioUnit = outputNode.audioUnit!
        var devID = deviceID
        AudioUnitSetProperty(
            audioUnit,
            kAudioOutputUnitProperty_CurrentDevice,
            kAudioUnitScope_Global,
            0,
            &devID,
            UInt32(MemoryLayout<AudioDeviceID>.size)
        )
    }

    private func startEngine(_ engine: AVAudioEngine) -> Bool {
        let _ = engine.mainMixerNode
        engine.prepare()
        do {
            try engine.start()
            return true
        } catch {
            outputJSON(["status": "error", "message": "Failed to start engine: \(error.localizedDescription)"])
            return false
        }
    }

    func play(filePath: String) {
        let url = URL(fileURLWithPath: filePath)
        let fileName = url.lastPathComponent

        guard FileManager.default.fileExists(atPath: filePath) else {
            outputJSON(["status": "error", "message": "File not found: \(fileName)"])
            return
        }

        do {
            let file = try AVAudioFile(forReading: url)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat,
                                                 frameCapacity: AVAudioFrameCount(file.length)) else {
                outputJSON(["status": "error", "message": "Failed to create buffer for \(fileName)"])
                return
            }
            try file.read(into: buffer)

            // Play on local engine (speakers)
            if !localStarted {
                localStarted = startEngine(localEngine)
                if localStarted {
                    localEngine.mainMixerNode.outputVolume = localVolume
                }
            }
            if localStarted {
                scheduleBuffer(buffer, fileName: fileName, onLocal: true)
            }

            // Play on discord engine (BlackHole)
            if let de = discordEngine {
                if !discordStarted {
                    discordStarted = startEngine(de)
                    if discordStarted {
                        de.mainMixerNode.outputVolume = discordVolume
                    }
                }
                if discordStarted {
                    scheduleBuffer(buffer, fileName: fileName, onLocal: false)
                }
            }

            outputPlayingStatus()
        } catch {
            outputJSON(["status": "error", "message": "Failed to play \(fileName): \(error.localizedDescription)"])
        }
    }

    private func scheduleBuffer(_ buffer: AVAudioPCMBuffer, fileName: String, onLocal: Bool) {
        let engine = onLocal ? localEngine : discordEngine!
        let player = AVAudioPlayerNode()

        lock.lock()
        if onLocal {
            if let existing = localPlayers[fileName] {
                existing.stop()
                engine.detach(existing)
            }
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: buffer.format)
            localPlayers[fileName] = player
        } else {
            if let existing = discordPlayers[fileName] {
                existing.stop()
                engine.detach(existing)
            }
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: buffer.format)
            discordPlayers[fileName] = player
        }
        lock.unlock()

        // Track completion from local engine only (source of truth for playing status)
        if onLocal {
            player.scheduleBuffer(buffer) { [weak self] in
                DispatchQueue.global().async {
                    self?.onPlaybackComplete(fileName: fileName)
                }
            }
        } else {
            player.scheduleBuffer(buffer, completionHandler: nil)
        }
        player.play()
    }

    private func onPlaybackComplete(fileName: String) {
        lock.lock()
        if let p = localPlayers[fileName] {
            p.stop()
            localEngine.detach(p)
            localPlayers.removeValue(forKey: fileName)
        }
        if let de = discordEngine, let p = discordPlayers[fileName] {
            p.stop()
            de.detach(p)
            discordPlayers.removeValue(forKey: fileName)
        }
        lock.unlock()
        outputPlayingStatus()
    }

    func stopSound(fileName: String) {
        lock.lock()
        if let p = localPlayers[fileName] {
            p.stop()
            localEngine.detach(p)
            localPlayers.removeValue(forKey: fileName)
        }
        if let de = discordEngine, let p = discordPlayers[fileName] {
            p.stop()
            de.detach(p)
            discordPlayers.removeValue(forKey: fileName)
        }
        lock.unlock()
        outputPlayingStatus()
    }

    func stopAll() {
        lock.lock()
        for (_, p) in localPlayers {
            p.stop()
            localEngine.detach(p)
        }
        localPlayers.removeAll()
        if let de = discordEngine {
            for (_, p) in discordPlayers {
                p.stop()
                de.detach(p)
            }
            discordPlayers.removeAll()
        }
        lock.unlock()
        outputPlayingStatus()
    }

    func setVolume(target: String, value: Float) {
        let clamped = max(0, min(1, value))
        switch target {
        case "local":
            localVolume = clamped
            if localStarted {
                localEngine.mainMixerNode.outputVolume = clamped
            }
        case "discord":
            discordVolume = clamped
            if discordStarted, let de = discordEngine {
                de.mainMixerNode.outputVolume = clamped
            }
        default:
            break
        }
        outputStatus()
    }

    private func outputStatus() {
        outputJSON([
            "status": "ready",
            "blackhole": blackholeAvailable,
            "localVolume": localVolume,
            "discordVolume": discordVolume,
        ])
    }

    private func outputPlayingStatus() {
        lock.lock()
        let names = Array(localPlayers.keys)
        lock.unlock()
        outputJSON([
            "status": "playing",
            "sounds": names,
            "localVolume": localVolume,
            "discordVolume": discordVolume,
        ])
    }

    func cleanup() {
        stopAll()
        if localStarted { localEngine.stop() }
        if discordStarted { discordEngine?.stop() }
        micPassthrough?.stop()
    }
}

// MARK: - JSON I/O

func outputJSON(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict),
       let str = String(data: data, encoding: .utf8) {
        print(str)
        fflush(stdout)
    }
}

// MARK: - Main

let player = SoundboardPlayer()

// Cleanup on exit
signal(SIGTERM) { _ in
    player.cleanup()
    exit(0)
}
signal(SIGINT) { _ in
    player.cleanup()
    exit(0)
}

player.setup()

// Read commands from stdin
while let line = readLine() {
    guard !line.isEmpty else { continue }

    guard let data = line.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let cmd = json["cmd"] as? String else {
        continue
    }

    switch cmd {
    case "play":
        if let file = json["file"] as? String {
            player.play(filePath: file)
        }
    case "stop_sound":
        if let file = json["file"] as? String {
            let fileName = URL(fileURLWithPath: file).lastPathComponent
            player.stopSound(fileName: fileName)
        }
    case "stop":
        player.stopAll()
    case "set_volume":
        if let target = json["target"] as? String,
           let value = json["value"] as? Double {
            player.setVolume(target: target, value: Float(value))
        }
    default:
        break
    }
}
