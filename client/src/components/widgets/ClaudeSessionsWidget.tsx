import { useState, useEffect } from "react";
import type { ClaudeSession, ClaudeSessionsData } from "shared";
import type { LiveWidgetProps } from "./liveWidgetRegistry";
import { apiUrl } from "../../lib/api";

function isClaudeSessionsData(data: unknown): data is ClaudeSessionsData {
  return (
    data !== null &&
    typeof data === "object" &&
    "sessions" in (data as Record<string, unknown>) &&
    Array.isArray((data as ClaudeSessionsData).sessions)
  );
}

const STATUS_CONFIG = {
  working: { color: "#22c55e", label: "Working", dot: true },
  idle: { color: "#64748b", label: "Idle", dot: false },
  waiting_for_input: { color: "#f59e0b", label: "Needs input", dot: false },
} as const;

function timeAgo(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const pulseStyle = document.createElement("style");
pulseStyle.textContent = `@keyframes dp-pulse{0%,100%{opacity:1}50%{opacity:.4}}`;
if (!document.head.querySelector("[data-dp-pulse]")) {
  pulseStyle.setAttribute("data-dp-pulse", "");
  document.head.appendChild(pulseStyle);
}

export function ClaudeSessionsWidget({ data }: LiveWidgetProps) {
  const sessionsData = isClaudeSessionsData(data) ? data : null;
  const sessions = sessionsData?.sessions ?? [];

  // Re-render every 15s to update time-ago labels
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(timer);
  }, []);

  if (sessions.length === 0) {
    return (
      <div
        className="flex flex-col h-full w-full items-center justify-center rounded-xl gap-2 p-4"
        style={{ backgroundColor: "var(--bg-button)" }}
      >
        <ClaudeIcon />
        <span className="text-sm text-[var(--text-secondary)] text-center">
          No Claude Code instances detected
        </span>
        <span className="text-xs text-[var(--text-secondary)] opacity-60 text-center">
          Start a Claude Code session to see it here
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full w-full rounded-xl overflow-hidden p-2 gap-1.5"
      style={{ backgroundColor: "var(--bg-button)" }}
    >
      <div className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-0.5 shrink-0">
        <ClaudeIcon size={14} />
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Claude Sessions
        </span>
        <span className="text-xs text-[var(--text-secondary)] opacity-60 ml-auto">
          {sessions.length}
        </span>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: ClaudeSession }) {
  const [pressed, setPressed] = useState(false);
  const config = STATUS_CONFIG[session.status];

  const handleFocus = () => {
    fetch(apiUrl("/api/hooks/claude/focus"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    }).catch(() => {});
  };

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => {
        setPressed(false);
        handleFocus();
      }}
      onPointerLeave={() => setPressed(false)}
      onContextMenu={(e) => e.preventDefault()}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left w-full border-0 cursor-pointer"
      style={{
        backgroundColor: `${config.color}10`,
        borderLeft: `3px solid ${config.color}`,
        transform: pressed ? "scale(0.98)" : "scale(1)",
        transition: "transform 100ms, background-color 200ms",
      }}
    >
      {/* Status dot */}
      <div
        className="shrink-0 rounded-full"
        style={{
          width: 8,
          height: 8,
          backgroundColor: config.color,
          boxShadow: config.dot ? `0 0 6px ${config.color}` : "none",
          animation: config.dot ? "dp-pulse 2s ease-in-out infinite" : "none",
        }}
      />

      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {session.project}
        </span>
        <span className="text-xs text-[var(--text-secondary)] truncate">
          {config.label}
          {session.status === "working" && session.toolName
            ? ` \u2014 ${session.toolName}`
            : ""}
        </span>
      </div>

      {/* Time ago */}
      <span className="text-xs text-[var(--text-secondary)] opacity-60 shrink-0 tabular-nums">
        {timeAgo(session.lastActivity)}
      </span>
    </button>
  );
}

function ClaudeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-secondary)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
