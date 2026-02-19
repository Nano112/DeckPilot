import { useState, useEffect, useCallback, useRef } from "react";
import type { DiscordPresenceData, WidgetConfig } from "shared";

interface DiscordPresenceProps {
  widget: WidgetConfig;
  data: unknown;
  onPress: (id: string) => void;
}

function isDiscordData(data: unknown): data is DiscordPresenceData {
  return (
    data !== null &&
    typeof data === "object" &&
    "user" in (data as Record<string, unknown>)
  );
}

export function DiscordPresence({ widget, data, onPress }: DiscordPresenceProps) {
  const discord = isDiscordData(data) ? data : null;
  const accent = widget.color ?? "#5865F2";
  const colspan = widget.position.colspan ?? 1;
  const rowspan = widget.position.rowspan ?? 1;
  const isCompact = colspan <= 1 && rowspan <= 1;

  // Optimistic state
  const [optMute, setOptMute] = useState<boolean | null>(null);
  const [optDeaf, setOptDeaf] = useState<boolean | null>(null);
  const lastServerMute = useRef<boolean | undefined>(undefined);
  const lastServerDeaf = useRef<boolean | undefined>(undefined);

  // Reset optimistic state when server state changes
  useEffect(() => {
    if (!discord?.voiceSettings) return;
    if (discord.voiceSettings.mute !== lastServerMute.current) {
      lastServerMute.current = discord.voiceSettings.mute;
      setOptMute(null);
    }
    if (discord.voiceSettings.deaf !== lastServerDeaf.current) {
      lastServerDeaf.current = discord.voiceSettings.deaf;
      setOptDeaf(null);
    }
  }, [discord?.voiceSettings?.mute, discord?.voiceSettings?.deaf]);

  const isMuted = optMute ?? discord?.voiceSettings?.mute ?? false;
  const isDeaf = optDeaf ?? discord?.voiceSettings?.deaf ?? false;

  const handleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOptMute(!isMuted);
    onPress(`${widget.id}:toggle_mute`);
  }, [widget.id, isMuted, onPress]);

  const handleDeafen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOptDeaf(!isDeaf);
    // Deafening also mutes
    if (!isDeaf) setOptMute(true);
    onPress(`${widget.id}:toggle_deafen`);
  }, [widget.id, isDeaf, onPress]);

  const handleDisconnect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPress(`${widget.id}:disconnect`);
  }, [widget.id, onPress]);

  if (!discord) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-xl gap-2"
        style={{ backgroundColor: "var(--bg-button)" }}
      >
        <DiscordIcon size={20} />
        <span className="text-sm text-[var(--text-secondary)]">
          Discord not running
        </span>
      </div>
    );
  }

  const inVoice = !!discord.voiceChannel;
  const hasControls = inVoice && discord.voiceSettings;

  return (
    <div
      className="flex flex-col h-full w-full rounded-xl overflow-hidden p-3 gap-2"
      style={{ backgroundColor: `${accent}12` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <DiscordIcon size={16} />
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex-1 truncate">
          {discord.user}
        </span>
      </div>

      {/* Voice channel info + members */}
      {inVoice ? (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          {/* Channel name */}
          <div className="flex items-center gap-1.5 shrink-0">
            <VoiceIcon size={14} />
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {discord.voiceChannel!.name}
            </span>
          </div>

          {/* Member list */}
          {discord.voiceMembers.length > 0 && !isCompact && (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5">
              {discord.voiceMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-2 py-1 rounded-md"
                  style={{ backgroundColor: "var(--bg-button)" }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        member.selfMute || member.mute || member.selfDeaf || member.deaf
                          ? "#ef4444"
                          : "#22c55e",
                    }}
                  />
                  <span className="text-xs text-[var(--text-primary)] truncate flex-1">
                    {member.username}
                  </span>
                  {(member.selfMute || member.mute) && (
                    <MicIcon size={10} muted />
                  )}
                  {(member.selfDeaf || member.deaf) && (
                    <HeadphoneIcon size={10} deaf />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Compact member count */}
          {discord.voiceMembers.length > 0 && isCompact && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--text-secondary)] opacity-60">
                {discord.voiceMembers.length} member{discord.voiceMembers.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      ) : discord.activity ? (
        <div className="flex items-center gap-3 flex-1 min-h-0">
          {discord.activity.largeImage && (
            <img
              src={discord.activity.largeImage}
              alt=""
              className="w-12 h-12 rounded-lg object-cover shrink-0"
              draggable={false}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[var(--text-primary)] leading-tight">
              {discord.activity.name}
            </div>
            {discord.activity.details && (
              <div className="truncate text-xs text-[var(--text-secondary)] leading-tight mt-0.5">
                {discord.activity.details}
              </div>
            )}
            {discord.activity.state && (
              <div className="truncate text-xs text-[var(--text-secondary)] opacity-70 leading-tight mt-0.5">
                {discord.activity.state}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-[var(--text-secondary)] opacity-60">
            No activity
          </span>
        </div>
      )}

      {/* Voice controls — bigger buttons */}
      {hasControls && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleMute}
            className="flex items-center justify-center gap-2 flex-1 py-4 rounded-xl transition-colors active:scale-95"
            style={{
              backgroundColor: isMuted ? "#ef444430" : "var(--bg-button)",
              transition: "background-color 150ms, transform 100ms",
            }}
          >
            <MicIcon size={24} muted={isMuted} />
            {!isCompact && (
              <span
                className="text-sm font-semibold"
                style={{
                  color: isMuted ? "#ef4444" : "var(--text-secondary)",
                }}
              >
                {isMuted ? "Muted" : "Mute"}
              </span>
            )}
          </button>
          <button
            onClick={handleDeafen}
            className="flex items-center justify-center gap-2 flex-1 py-4 rounded-xl transition-colors active:scale-95"
            style={{
              backgroundColor: isDeaf ? "#ef444430" : "var(--bg-button)",
              transition: "background-color 150ms, transform 100ms",
            }}
          >
            <HeadphoneIcon size={24} deaf={isDeaf} />
            {!isCompact && (
              <span
                className="text-sm font-semibold"
                style={{
                  color: isDeaf ? "#ef4444" : "var(--text-secondary)",
                }}
              >
                {isDeaf ? "Deaf" : "Deafen"}
              </span>
            )}
          </button>
          <button
            onClick={handleDisconnect}
            className="flex items-center justify-center py-4 px-5 rounded-xl transition-colors active:scale-95"
            style={{
              backgroundColor: "#ef444420",
              transition: "background-color 150ms, transform 100ms",
            }}
          >
            <DisconnectIcon size={24} />
          </button>
        </div>
      )}
    </div>
  );
}

function DiscordIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function VoiceIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#22c55e">
      <path d="M11.383 3.07A1 1 0 0 1 12 4v16a1 1 0 0 1-1.707.707L5.586 16H2a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h3.586l4.707-4.707a1 1 0 0 1 1.09-.217zM14.657 2.929a1 1 0 0 1 1.414 0A11.96 11.96 0 0 1 19.071 12a11.96 11.96 0 0 1-3 5.071 1 1 0 0 1-1.414-1.414A9.96 9.96 0 0 0 17.071 12a9.96 9.96 0 0 0-2.414-3.657 1 1 0 0 1 0-1.414zm-2.829 2.828a1 1 0 0 1 1.415 0A7.975 7.975 0 0 1 15.07 12a7.975 7.975 0 0 1-1.828 3.243 1 1 0 1 1-1.414-1.415A5.975 5.975 0 0 0 13.07 12a5.975 5.975 0 0 0-1.243-2.828 1 1 0 0 1 0-1.415z" />
    </svg>
  );
}

function MicIcon({ size = 16, muted }: { size?: number; muted: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={muted ? "#ef4444" : "var(--text-secondary)"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
      {muted && <line x1="1" y1="1" x2="23" y2="23" />}
    </svg>
  );
}

function HeadphoneIcon({ size = 16, deaf }: { size?: number; deaf: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={deaf ? "#ef4444" : "var(--text-secondary)"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      {deaf && <line x1="1" y1="1" x2="23" y2="23" />}
    </svg>
  );
}

function DisconnectIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
  );
}
