import { useEffect, useRef, useCallback, useState } from "react";
import type { WidgetConfig, AudioFFTData } from "shared";

interface AudioVisualizerProps {
  widget: WidgetConfig;
  data: unknown;
  onPress: (id: string) => void;
  onSliderChange?: (widgetId: string, value: number) => void;
}

function isFFTData(data: unknown): data is AudioFFTData {
  return (
    data !== null &&
    typeof data === "object" &&
    "bins" in (data as Record<string, unknown>) &&
    Array.isArray((data as Record<string, unknown>).bins)
  );
}

const MIN_HEIGHT = 0.02;
const SMOOTHING = 0.35;
const THROTTLE_MS = 80;

export function AudioVisualizer({ widget, data, onSliderChange }: AudioVisualizerProps) {
  const fft = isFFTData(data) ? data : null;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const barsRef = useRef<number[] | null>(null);
  const fftRef = useRef<AudioFFTData | null>(null);
  const accent = widget.color ?? "#1db954";
  const hasSlider = !!widget.sliderAction;

  // Volume slider state
  const [volume, setVolume] = useState(50);
  const lastSent = useRef(0);
  const dragging = useRef(false);

  fftRef.current = fft;

  if (fft && !barsRef.current) {
    barsRef.current = new Array(fft.bins.length).fill(MIN_HEIGHT);
  }

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setVolume(v);
      const now = Date.now();
      if (now - lastSent.current >= THROTTLE_MS) {
        lastSent.current = now;
        onSliderChange?.(widget.id, v);
      }
    },
    [widget.id, onSliderChange],
  );

  const handleVolumeEnd = useCallback(() => {
    dragging.current = false;
    onSliderChange?.(widget.id, volume);
  }, [widget.id, volume, onSliderChange]);

  const stopSwipe = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  // Canvas drawing
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const currentFFT = fftRef.current;
    const bars = barsRef.current;
    const binCount = bars?.length ?? 32;

    if (bars && currentFFT) {
      for (let i = 0; i < binCount; i++) {
        const target = currentFFT.bins[i] ?? 0;
        bars[i] += (target - bars[i]) * SMOOTHING;
        bars[i] = Math.max(MIN_HEIGHT, bars[i]);
      }
    }

    const gap = 2;
    const barWidth = Math.max(2, (w - gap * (binCount - 1)) / binCount);
    const maxBarHeight = h * 0.85;

    const r = parseInt(accent.slice(1, 3), 16) || 0;
    const g = parseInt(accent.slice(3, 5), 16) || 0;
    const b = parseInt(accent.slice(5, 7), 16) || 0;

    for (let i = 0; i < binCount; i++) {
      const val = bars ? bars[i] : MIN_HEIGHT;
      const barH = Math.max(2, val * maxBarHeight);
      const x = i * (barWidth + gap);
      const y = h - barH;

      const grad = ctx.createLinearGradient(x, h, x, y);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
      grad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.6)`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 1)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      const radius = Math.min(barWidth / 2, 3);
      ctx.roundRect(x, y, barWidth, barH, [radius, radius, 0, 0]);
      ctx.fill();
    }

    // Reflection
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < binCount; i++) {
      const val = bars ? bars[i] : MIN_HEIGHT;
      const barH = val * maxBarHeight * 0.25;
      const x = i * (barWidth + gap);

      const grad = ctx.createLinearGradient(x, h, x, h + barH);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(x, h, barWidth, barH);
    }
    ctx.globalAlpha = 1;

    rafRef.current = requestAnimationFrame(draw);
  }, [accent]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const pct = volume;

  return (
    <div
      className="relative flex flex-col h-full w-full rounded-xl overflow-hidden"
      style={{ backgroundColor: `${accent}08` }}
    >
      {/* Canvas fills entire widget */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      />

      {/* Volume slider overlay at top */}
      {hasSlider && (
        <div
          className="relative z-10 flex items-center gap-3 px-4 pt-3 pb-1"
          onTouchStart={stopSwipe}
          onTouchEnd={stopSwipe}
          onTouchMove={stopSwipe}
        >
          <VolumeIcon size={16} muted={volume === 0} color={accent} />
          <div className="flex-1 relative h-8 flex items-center">
            <div
              className="absolute left-0 h-1.5 rounded-full"
              style={{
                width: "100%",
                backgroundColor: `${accent}25`,
              }}
            />
            <div
              className="absolute left-0 h-1.5 rounded-full transition-[width] duration-75"
              style={{
                width: `${pct}%`,
                backgroundColor: accent,
                boxShadow: `0 0 8px ${accent}60`,
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={handleVolume}
              onPointerUp={handleVolumeEnd}
              onPointerDown={() => { dragging.current = true; }}
              className="vis-slider absolute w-full h-full opacity-0 cursor-pointer"
              style={{ touchAction: "none" }}
            />
            {/* Custom thumb */}
            <div
              className="absolute pointer-events-none rounded-full border-2 transition-transform duration-75"
              style={{
                width: 20,
                height: 20,
                left: `calc(${pct}% - 10px)`,
                backgroundColor: accent,
                borderColor: "var(--bg-primary)",
                boxShadow: `0 2px 8px ${accent}80`,
              }}
            />
          </div>
          <span
            className="text-xs font-semibold tabular-nums min-w-[28px] text-right"
            style={{ color: accent }}
          >
            {volume}
          </span>
        </div>
      )}

      {/* Empty state */}
      {!fft && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2">
          <SpectrumIcon size={24} color={accent} />
          <span className="text-xs text-[var(--text-secondary)]">
            Audio Visualizer
          </span>
          <span className="text-[10px] text-[var(--text-secondary)] opacity-60">
            Waiting for audio data...
          </span>
        </div>
      )}
    </div>
  );
}

function VolumeIcon({ size = 16, muted, color }: { size?: number; muted: boolean; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={muted ? "var(--text-secondary)" : color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      {!muted && (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
      {muted && <line x1="23" y1="9" x2="17" y2="15" />}
    </svg>
  );
}

function SpectrumIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="8" x2="4" y2="16" />
      <line x1="8" y1="5" x2="8" y2="19" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="16" y1="7" x2="16" y2="17" />
      <line x1="20" y1="10" x2="20" y2="14" />
    </svg>
  );
}
