import { useState, useEffect } from "react";
import type { Action, ActionType } from "shared";
import { apiUrl } from "../../lib/api";

interface ActionPickerProps {
  value?: Action;
  onChange: (action: Action) => void;
}

interface ActionGroup {
  label: string;
  actions: { type: ActionType; label: string; params: Record<string, unknown> }[];
}

const ACTION_GROUPS: ActionGroup[] = [
  {
    label: "Media",
    actions: [
      { type: "media.play_pause", label: "Play/Pause", params: {} },
      { type: "media.next", label: "Next Track", params: {} },
      { type: "media.previous", label: "Previous Track", params: {} },
    ],
  },
  {
    label: "Audio",
    actions: [
      { type: "audio.volume_up", label: "Volume Up", params: { step: 5 } },
      { type: "audio.volume_down", label: "Volume Down", params: { step: 5 } },
      { type: "audio.volume_set", label: "Set Volume", params: { level: 50 } },
      { type: "audio.mute", label: "Mute", params: {} },
    ],
  },
  {
    label: "Spotify",
    actions: [
      { type: "spotify.play_pause", label: "Play/Pause", params: {} },
      { type: "spotify.next", label: "Next Track", params: {} },
      { type: "spotify.previous", label: "Previous Track", params: {} },
    ],
  },
  {
    label: "System",
    actions: [
      { type: "system.launch_app", label: "Launch App", params: { app: "" } },
      { type: "system.open_url", label: "Open URL", params: { url: "" } },
    ],
  },
  {
    label: "Input",
    actions: [
      { type: "input.hotkey", label: "Hotkey", params: { keys: [] } },
    ],
  },
  {
    label: "Clipboard",
    actions: [
      { type: "clipboard.copy", label: "Copy Text", params: { text: "" } },
    ],
  },
  {
    label: "Discord",
    actions: [
      { type: "discord.toggle_mute", label: "Toggle Mute", params: {} },
      { type: "discord.toggle_deafen", label: "Toggle Deafen", params: {} },
      { type: "discord.disconnect", label: "Disconnect", params: {} },
    ],
  },
  {
    label: "Soundboard",
    actions: [
      { type: "soundboard.play", label: "Play Sound", params: { soundId: "" } },
      { type: "soundboard.stop", label: "Stop All Sounds", params: {} },
    ],
  },
  {
    label: "Execute",
    actions: [
      { type: "exec.shell", label: "Shell Command", params: { command: "" } },
      { type: "exec.applescript", label: "AppleScript", params: { script: "" } },
    ],
  },
];

function SoundPicker({
  action,
  onChange,
}: {
  action: Action;
  onChange: (action: Action) => void;
}) {
  const [sounds, setSounds] = useState<{ name: string; size: number }[]>([]);
  const params = action.params as Record<string, unknown>;
  const selected = (params.soundId as string) ?? "";

  useEffect(() => {
    fetch(apiUrl("/api/sounds"))
      .then((r) => (r.ok ? r.json() : []))
      .then(setSounds)
      .catch(() => {});
  }, []);

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-[var(--text-secondary)]">Sound:</span>
      {sounds.length === 0 ? (
        <input
          type="text"
          value={selected}
          onChange={(e) =>
            onChange({ ...action, params: { soundId: e.target.value } })
          }
          placeholder="e.g. horn.wav"
          className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
        />
      ) : (
        <select
          value={selected}
          onChange={(e) =>
            onChange({ ...action, params: { soundId: e.target.value } })
          }
          className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
        >
          <option value="">Select a sound...</option>
          {sounds.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name.replace(/\.[^.]+$/, "")}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

function ActionParamsEditor({
  action,
  onChange,
}: {
  action: Action;
  onChange: (action: Action) => void;
}) {
  const params = action.params as Record<string, unknown>;

  switch (action.type) {
    case "audio.volume_up":
    case "audio.volume_down":
      return (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">Step:</span>
          <input
            type="number"
            value={(params.step as number) ?? 5}
            onChange={(e) =>
              onChange({ ...action, params: { step: Number(e.target.value) } })
            }
            className="w-16 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
          />
        </label>
      );
    case "audio.volume_set":
      return (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">Level:</span>
          <input
            type="number"
            min={0}
            max={100}
            value={(params.level as number) ?? 50}
            onChange={(e) =>
              onChange({ ...action, params: { level: Number(e.target.value) } })
            }
            className="w-16 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
          />
        </label>
      );
    case "system.launch_app":
      return (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">App:</span>
          <input
            type="text"
            value={(params.app as string) ?? ""}
            onChange={(e) =>
              onChange({ ...action, params: { app: e.target.value } })
            }
            placeholder="e.g. Safari"
            className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
          />
        </label>
      );
    case "system.open_url":
      return (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">URL:</span>
          <input
            type="text"
            value={(params.url as string) ?? ""}
            onChange={(e) =>
              onChange({ ...action, params: { url: e.target.value } })
            }
            placeholder="https://..."
            className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
          />
        </label>
      );
    case "input.hotkey":
      return (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">Keys:</span>
          <input
            type="text"
            value={((params.keys as string[]) ?? []).join("+")}
            onChange={(e) =>
              onChange({
                ...action,
                params: { keys: e.target.value.split("+").map((k) => k.trim()).filter(Boolean) },
              })
            }
            placeholder="e.g. cmd+shift+s"
            className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
          />
        </label>
      );
    case "exec.shell":
      return (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">Command:</span>
          <input
            type="text"
            value={(params.command as string) ?? ""}
            onChange={(e) =>
              onChange({ ...action, params: { command: e.target.value } })
            }
            placeholder="e.g. ls -la"
            className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
          />
        </label>
      );
    case "exec.applescript":
      return (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">Script:</span>
          <input
            type="text"
            value={(params.script as string) ?? ""}
            onChange={(e) =>
              onChange({ ...action, params: { script: e.target.value } })
            }
            placeholder='e.g. say "hello"'
            className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)]"
          />
        </label>
      );
    case "soundboard.play":
      return <SoundPicker action={action} onChange={onChange} />;
    case "clipboard.copy":
      return (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--text-secondary)]">Text to copy:</span>
          <textarea
            value={(params.text as string) ?? ""}
            onChange={(e) =>
              onChange({ ...action, params: { text: e.target.value } })
            }
            placeholder="Text that will be copied to clipboard"
            rows={3}
            className="w-full px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-button)] font-mono text-xs"
          />
        </label>
      );
    default:
      return null;
  }
}

export function ActionPicker({ value, onChange }: ActionPickerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      {ACTION_GROUPS.map((group) => (
        <div key={group.label}>
          <button
            onClick={() =>
              setExpanded(expanded === group.label ? null : group.label)
            }
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-button)]"
          >
            {group.label}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{
                transform:
                  expanded === group.label ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 150ms",
              }}
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          {expanded === group.label && (
            <div className="flex flex-col gap-0.5 pl-2">
              {group.actions.map((action) => {
                const isSelected = value?.type === action.type;
                return (
                  <div key={action.type}>
                    <button
                      onClick={() =>
                        onChange({
                          type: action.type,
                          params: isSelected
                            ? value.params
                            : action.params,
                        } as Action)
                      }
                      className="w-full text-left px-3 py-1.5 rounded text-sm"
                      style={{
                        backgroundColor: isSelected
                          ? "var(--accent)"
                          : "transparent",
                        color: isSelected
                          ? "#fff"
                          : "var(--text-primary)",
                      }}
                    >
                      {action.label}
                    </button>
                    {isSelected && value && (
                      <div className="px-3 py-2">
                        <ActionParamsEditor
                          action={value}
                          onChange={onChange}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
