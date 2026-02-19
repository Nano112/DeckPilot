import Foundation
import ScreenCaptureKit
import CoreMedia
import Accelerate

let FFT_SIZE = 1024
let BIN_COUNT = 32
let OUTPUT_HZ = 20.0

class AudioCapture: NSObject, SCStreamOutput, SCStreamDelegate {
    private var stream: SCStream?
    private var pcmBuffer: [Float] = []
    private var lastOutput = CFAbsoluteTimeGetCurrent()
    private let lock = NSLock()

    func start() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        guard let display = content.displays.first else {
            fputs("{\"error\":\"no_display\"}\n", stderr)
            exit(1)
        }

        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = false
        config.sampleRate = 44100
        config.channelCount = 1
        // Minimize video capture overhead
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 10, timescale: 1)

        let filter = SCContentFilter(
            display: display,
            excludingApplications: [],
            exceptingWindows: []
        )

        stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream!.addStreamOutput(self, type: .audio, sampleHandlerQueue: DispatchQueue(label: "audio"))
        try await stream!.startCapture()
        fputs("[audio-capture] Started\n", stderr)
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sb: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        guard let buf = sb.dataBuffer else { return }

        let len = CMBlockBufferGetDataLength(buf)
        guard len > 0 else { return }
        var raw = Data(count: len)
        raw.withUnsafeMutableBytes { ptr in
            CMBlockBufferCopyDataBytes(buf, atOffset: 0, dataLength: len, destination: ptr.baseAddress!)
        }

        let floats: [Float] = raw.withUnsafeBytes { ptr in
            guard let base = ptr.baseAddress else { return [] }
            let count = len / MemoryLayout<Float>.size
            return Array(UnsafeBufferPointer(start: base.assumingMemoryBound(to: Float.self), count: count))
        }

        lock.lock()
        pcmBuffer.append(contentsOf: floats)
        if pcmBuffer.count > FFT_SIZE * 8 {
            pcmBuffer.removeFirst(pcmBuffer.count - FFT_SIZE * 4)
        }
        lock.unlock()

        let now = CFAbsoluteTimeGetCurrent()
        if now - lastOutput >= 1.0 / OUTPUT_HZ && pcmBuffer.count >= FFT_SIZE {
            lastOutput = now
            outputFFT()
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fputs("[audio-capture] Error: \(error.localizedDescription)\n", stderr)
        exit(1)
    }

    private func outputFFT() {
        lock.lock()
        let samples = Array(pcmBuffer.suffix(FFT_SIZE))
        lock.unlock()

        guard samples.count == FFT_SIZE else { return }

        // Hann window
        var window = [Float](repeating: 0, count: FFT_SIZE)
        vDSP_hann_window(&window, vDSP_Length(FFT_SIZE), Int32(vDSP_HANN_NORM))
        var windowed = [Float](repeating: 0, count: FFT_SIZE)
        vDSP_vmul(samples, 1, window, 1, &windowed, 1, vDSP_Length(FFT_SIZE))

        // Prepare split complex
        let halfN = FFT_SIZE / 2
        var realp = [Float](repeating: 0, count: halfN)
        var imagp = [Float](repeating: 0, count: halfN)

        // Pack into split complex
        realp.withUnsafeMutableBufferPointer { rBuf in
            imagp.withUnsafeMutableBufferPointer { iBuf in
                var split = DSPSplitComplex(realp: rBuf.baseAddress!, imagp: iBuf.baseAddress!)
                windowed.withUnsafeBufferPointer { wBuf in
                    wBuf.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: halfN) { cPtr in
                        vDSP_ctoz(cPtr, 2, &split, 1, vDSP_Length(halfN))
                    }
                }

                // FFT
                let log2n = vDSP_Length(log2(Float(FFT_SIZE)))
                guard let setup = vDSP_create_fftsetup(log2n, FFTRadix(FFT_RADIX2)) else { return }
                vDSP_fft_zrip(setup, &split, 1, log2n, FFTDirection(FFT_FORWARD))
                vDSP_destroy_fftsetup(setup)
            }
        }

        // Magnitudes
        var magnitudes = [Float](repeating: 0, count: halfN)
        realp.withUnsafeMutableBufferPointer { rBuf in
            imagp.withUnsafeMutableBufferPointer { iBuf in
                var split = DSPSplitComplex(realp: rBuf.baseAddress!, imagp: iBuf.baseAddress!)
                vDSP_zvabs(&split, 1, &magnitudes, 1, vDSP_Length(halfN))
            }
        }

        // Scale
        var scale: Float = 2.0 / Float(FFT_SIZE)
        vDSP_vsmul(magnitudes, 1, &scale, &magnitudes, 1, vDSP_Length(halfN))

        // Convert to dB-like scale for better visual range
        for i in 0..<halfN {
            magnitudes[i] = magnitudes[i] * 4.0 // boost
        }

        // Logarithmic binning into BIN_COUNT bands
        var bins = [Float](repeating: 0, count: BIN_COUNT)
        for i in 0..<BIN_COUNT {
            let startFrac = pow(Float(i) / Float(BIN_COUNT), 2.0)
            let endFrac = pow(Float(i + 1) / Float(BIN_COUNT), 2.0)
            let start = Int(startFrac * Float(halfN))
            let end = max(start + 1, min(Int(endFrac * Float(halfN)), halfN))

            var peak: Float = 0
            for j in start..<end {
                peak = max(peak, magnitudes[j])
            }
            bins[i] = min(1.0, peak)
        }

        // RMS
        var rms: Float = 0
        vDSP_rmsqv(samples, 1, &rms, vDSP_Length(FFT_SIZE))

        // JSON output
        let binsStr = bins.map { String(format: "%.3f", $0) }.joined(separator: ",")
        print("{\"bins\":[\(binsStr)],\"rms\":\(String(format: "%.4f", min(1.0, rms)))}")
        fflush(stdout)
    }
}

let capture = AudioCapture()
let semaphore = DispatchSemaphore(value: 0)
Task {
    do {
        try await capture.start()
    } catch {
        fputs("[audio-capture] Failed: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
}
semaphore.wait()
