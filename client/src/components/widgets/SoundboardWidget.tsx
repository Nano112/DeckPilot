import { useState, useEffect, useCallback, useRef } from "react";
import { animate } from "animejs";
import type { SoundboardStatusData } from "shared";
import type { LiveWidgetProps } from "./liveWidgetRegistry";
import { apiUrl } from "../../lib/api";

interface SoundFile {
  name: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function SoundButton({
  sound,
  isPlaying,
  onPlay,
}: {
  sound: SoundFile;
  isPlaying: boolean;
  onPlay: (name: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const handlePointerDown = useCallback(() => {
    if (!ref.current) return;
    animate(ref.current, { scale: 0.92, duration: 100, ease: "outQuad" });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!ref.current) return;
    animate(ref.current, { scale: 1, duration: 400, ease: "outElastic(1, 0.5)" });
    onPlay(sound.name);
  }, [sound.name, onPlay]);

  const handlePointerLeave = useCallback(() => {
    if (!ref.current) return;
    animate(ref.current, { scale: 1, duration: 200, ease: "outQuad" });
  }, []);

  const displayName = sound.name.replace(/\.[^.]+$/, "");

  return (
    <button
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center gap-0.5 rounded-lg border-0 cursor-pointer transition-all px-2 py-2 min-h-[3rem]"
      style={{
        backgroundColor: isPlaying ? "#f59e0b30" : "var(--bg-button)",
        borderLeft: isPlaying ? "3px solid #f59e0b" : "3px solid transparent",
        boxShadow: isPlaying ? "0 0 12px #f59e0b40" : "none",
      }}
    >
      <span className="text-xs font-semibold text-[var(--text-primary)] truncate w-full text-center">
        {displayName}
      </span>
      <span className="text-[10px] text-[var(--text-secondary)]">
        {formatSize(sound.size)}
      </span>
    </button>
  );
}

function VolumeSlider({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [localVal, setLocalVal] = useState(value);

  // Sync from server when not dragging
  useEffect(() => {
    if (!dragging) setLocalVal(value);
  }, [value, dragging]);

  const pct = Math.round(localVal * 100);

  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      <span className="text-[10px] w-14 text-[var(--text-secondary)] shrink-0">
        {icon} {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onLostPointerCapture={() => setDragging(false)}
        onInput={(e) => {
          const v = Number((e.target as HTMLInputElement).value) / 100;
          setLocalVal(v);
          onChange(v);
        }}
        className="flex-1 h-1 accent-[var(--accent)] cursor-pointer"
        style={{ accentColor: pct === 0 ? "#ef4444" : "var(--accent)" }}
      />
      <span className="text-[10px] w-8 text-right text-[var(--text-secondary)] tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

export function SoundboardWidget({ widget, data, onPress }: LiveWidgetProps) {
  const [sounds, setSounds] = useState<SoundFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [optimistic, setOptimistic] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = data as SoundboardStatusData | undefined;
  const serverPlaying = status?.playing ?? [];

  // Merge server state with optimistic state
  const mergedPlaying = new Set([...serverPlaying, ...optimistic]);
  // Clear optimistic entries that the server has confirmed
  useEffect(() => {
    setOptimistic((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const name of prev) {
        if (serverPlaying.includes(name)) {
          next.delete(name);
          changed = true;
        }
      }
      // Also clear optimistic adds for sounds server says stopped
      // (optimistic was added but server never confirmed — timed out)
      return changed ? next : prev;
    });
  }, [serverPlaying]);

  const fetchSounds = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl("/api/sounds"));
      if (resp.ok) setSounds(await resp.json());
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchSounds();
  }, [fetchSounds]);

  const handleToggle = useCallback(
    (name: string) => {
      if (mergedPlaying.has(name)) {
        // Optimistic stop: remove from merged set immediately
        setOptimistic((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
        onPress(`${widget.id}:stop_sound:${name}`);
      } else {
        // Optimistic play: add immediately
        setOptimistic((prev) => new Set(prev).add(name));
        onPress(`${widget.id}:play:${name}`);
      }
    },
    [widget.id, onPress, mergedPlaying]
  );

  const handleStop = useCallback(() => {
    setOptimistic(new Set());
    onPress(`${widget.id}:stop`);
  }, [widget.id, onPress]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await fetch(apiUrl("/api/sounds"), { method: "POST", body: form });
      await fetchSounds();
    } catch {
      // Ignore
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fetchSounds]);

  return (
    <div
      className="flex h-full w-full flex-col rounded-xl overflow-hidden"
      style={{ backgroundColor: widget.color ? `${widget.color}10` : "var(--bg-button)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Soundboard
          </span>
          {status?.blackholeAvailable && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
              Discord
            </span>
          )}
          {status && !status.blackholeAvailable && status.ready && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
              Local only
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {mergedPlaying.size > 0 && (
            <button
              onClick={handleStop}
              className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border-0 cursor-pointer hover:bg-red-500/30"
            >
              Stop All
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-button)] text-[var(--text-secondary)] border-0 cursor-pointer hover:text-[var(--text-primary)]"
          >
            {uploading ? "..." : "+ Add"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.m4a,.ogg,.flac,.aac,.caf"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Volume Controls */}
      {status?.ready && (
        <div className="flex flex-col shrink-0 pb-1">
          <VolumeSlider
            label="Local"
            icon="🔊"
            value={status.localVolume}
            onChange={(v) => onPress(`${widget.id}:set_volume:local:${v}`)}
          />
          {status.blackholeAvailable && (
            <VolumeSlider
              label="Discord"
              icon="🎧"
              value={status.discordVolume}
              onChange={(v) => onPress(`${widget.id}:set_volume:discord:${v}`)}
            />
          )}
        </div>
      )}

      {/* Sound Grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="text-2xl">🔊</span>
            <span className="text-xs text-[var(--text-secondary)]">
              No sounds yet
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] opacity-60">
              Tap "+ Add" or drop files in ~/Library/Application Support/deckpilot/sounds/
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {sounds.map((sound) => (
              <SoundButton
                key={sound.name}
                sound={sound}
                isPlaying={mergedPlaying.has(sound.name)}
                onPlay={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
