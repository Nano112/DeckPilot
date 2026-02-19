import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetConfig, NowPlayingData, SpotifyNowPlayingData } from "shared";

interface NowPlayingProps {
  widget: WidgetConfig;
  data: unknown;
  onPress: (id: string) => void;
}

/** Normalize both NowPlayingData and legacy SpotifyNowPlayingData into a common shape */
function normalizeData(
  data: unknown,
): (NowPlayingData & { _source: "now_playing" | "spotify" }) | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  // NowPlayingData has "artwork", SpotifyNowPlayingData has "albumArt"
  if ("artwork" in d && typeof d.track === "string") {
    return { ...(d as unknown as NowPlayingData), _source: "now_playing" };
  }
  if ("albumArt" in d && typeof d.track === "string") {
    const s = d as unknown as SpotifyNowPlayingData;
    return {
      track: s.track,
      artist: s.artist,
      album: s.album,
      artwork: s.albumArt,
      progress: s.progress,
      duration: s.duration,
      isPlaying: s.isPlaying,
      app: "Spotify",
      _source: "spotify",
    };
  }
  return null;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NowPlaying({ widget, data, onPress }: NowPlayingProps) {
  const npData = normalizeData(data);
  const accent = widget.color ?? "#1db954";

  // ── Optimistic state ──
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);
  const [skipping, setSkipping] = useState<"next" | "prev" | null>(null);
  const lastServerTrack = useRef<string | null>(null);

  useEffect(() => {
    if (!npData) return;
    setOptimisticPlaying(null);
    if (npData.track !== lastServerTrack.current) {
      setSkipping(null);
      lastServerTrack.current = npData.track;
    }
  }, [npData?.track, npData?.isPlaying, npData?.progress]);

  const isPlaying = optimisticPlaying ?? npData?.isPlaying ?? false;

  // ── Progress interpolation ──
  const anchor = useRef({ progress: 0, timestamp: 0 });
  const [displayProgress, setDisplayProgress] = useState(0);
  const rafRef = useRef(0);
  const duration = npData?.duration ?? 0;
  const playbackRate = npData?.playbackRate ?? 1.0;

  useEffect(() => {
    if (!npData) return;
    anchor.current = {
      progress: npData.progress,
      timestamp: Date.now(),
    };
    setDisplayProgress(npData.progress);
  }, [npData?.progress, npData?.track]);

  useEffect(() => {
    if (!isPlaying || duration === 0) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const elapsed = ((Date.now() - anchor.current.timestamp) / 1000) * playbackRate;
      setDisplayProgress(Math.min(anchor.current.progress + elapsed, duration));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, duration, playbackRate]);

  // ── Controls ──
  const handlePlayPause = useCallback(() => {
    const next = !isPlaying;
    setOptimisticPlaying(next);
    anchor.current = { progress: displayProgress, timestamp: Date.now() };
    onPress(`${widget.id}:play_pause`);
  }, [widget.id, isPlaying, displayProgress, onPress]);

  const handleNext = useCallback(() => {
    setSkipping("next");
    onPress(`${widget.id}:next`);
  }, [widget.id, onPress]);

  const handlePrevious = useCallback(() => {
    setSkipping("prev");
    onPress(`${widget.id}:previous`);
  }, [widget.id, onPress]);

  // ── Seek ──
  const handleSeek = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (duration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const position = pct * duration;
      // Optimistic update
      setDisplayProgress(position);
      anchor.current = { progress: position, timestamp: Date.now() };
      onPress(`${widget.id}:seek:${position.toFixed(1)}`);
    },
    [widget.id, duration, onPress],
  );

  // ── Empty state ──
  if (!npData) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-xl"
        style={{ backgroundColor: "var(--bg-button)" }}
      >
        <span className="text-sm text-[var(--text-secondary)]">
          No music playing
        </span>
      </div>
    );
  }

  const progressPct = duration > 0 ? (displayProgress / duration) * 100 : 0;
  const faded = skipping ? 0.5 : 1;

  return (
    <div
      className="flex flex-col h-full w-full rounded-xl overflow-hidden p-3"
      style={{ backgroundColor: `${accent}12` }}
    >
      {/* Top row: art + track info side by side, takes available space */}
      <div className="flex items-center gap-3 flex-1 min-h-0">
        {npData.artwork && (
          <img
            src={npData.artwork}
            alt={npData.album}
            className="rounded-lg object-cover shrink-0 h-full max-h-full"
            draggable={false}
            style={{
              aspectRatio: "1",
              opacity: faded,
              transition: "opacity 150ms",
            }}
          />
        )}
        <div className="min-w-0 flex-1" style={{ opacity: faded, transition: "opacity 150ms" }}>
          <div className="truncate text-lg font-semibold text-[var(--text-primary)] leading-tight">
            {npData.track}
          </div>
          <div className="truncate text-sm text-[var(--text-secondary)] leading-tight mt-1">
            {npData.artist}
          </div>
          {npData.app && (
            <div className="truncate text-xs text-[var(--text-secondary)] leading-tight mt-0.5 opacity-60">
              {npData.app}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: progress + controls, fixed size */}
      <div className="flex flex-col gap-2 pt-2 shrink-0">
        {/* Progress — tappable for seek */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums shrink-0">
            {formatTime(displayProgress)}
          </span>
          <div
            className="flex-1 py-2 cursor-pointer"
            onPointerUp={handleSeek}
          >
            <div className="h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${progressPct}%`, backgroundColor: accent }}
              />
            </div>
          </div>
          <span className="text-xs text-[var(--text-secondary)] tabular-nums shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <ControlButton onPress={handlePrevious} label="Previous">
            <PrevIcon />
          </ControlButton>
          <ControlButton onPress={handlePlayPause} label={isPlaying ? "Pause" : "Play"} primary accent={accent}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </ControlButton>
          <ControlButton onPress={handleNext} label="Next">
            <NextIcon />
          </ControlButton>
        </div>
      </div>
    </div>
  );
}

// ── Touch control ──
function ControlButton({
  onPress,
  label,
  primary,
  accent,
  children,
}: {
  onPress: () => void;
  label: string;
  primary?: boolean;
  accent?: string;
  children: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      aria-label={label}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onPress(); }}
      onPointerLeave={() => setPressed(false)}
      onContextMenu={(e) => e.preventDefault()}
      className="flex items-center justify-center rounded-full border-0 cursor-pointer"
      style={{
        width: primary ? 80 : 64,
        height: primary ? 80 : 64,
        backgroundColor: primary ? `${accent}35` : "var(--bg-button)",
        transform: pressed ? "scale(0.9)" : "scale(1)",
        transition: "transform 100ms",
      }}
    >
      {children}
    </button>
  );
}

// ── SVG Icons ──
function PlayIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--text-primary)">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--text-primary)">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
function PrevIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-secondary)">
      <rect x="3" y="5" width="3" height="14" rx="1" />
      <path d="M21 5L10 12l11 7z" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-secondary)">
      <path d="M3 5l11 7-11 7z" />
      <rect x="18" y="5" width="3" height="14" rx="1" />
    </svg>
  );
}
