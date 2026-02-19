import { useCallback, useEffect, useState } from "react";
import type { PageConfig, ProfileConfig } from "shared";

interface StatusBarProps {
  connected: boolean;
  onEditMode: () => void;
  activePageId: string | null;
  gridBounds: { rows: number; cols: number };
  onPageSelect: (pageId: string) => void;
  getPageAt: (row: number, col: number) => PageConfig | null;
  profiles?: ProfileConfig[];
  activeProfileId?: string;
  onSwitchProfile?: (profileId: string) => void;
}

export function StatusBar({
  connected,
  onEditMode,
  activePageId,
  gridBounds,
  onPageSelect,
  getPageAt,
  profiles,
  activeProfileId,
  onSwitchProfile,
}: StatusBarProps) {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  const activeProfile = profiles?.find((p) => p.id === activeProfileId);

  // Build 2D dot grid
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < gridBounds.rows; r++) {
    for (let c = 0; c < gridBounds.cols; c++) {
      const page = getPageAt(r, c);
      const isActive = page?.id === activePageId;
      dots.push(
        <button
          key={`${r},${c}`}
          className="rounded-full transition-colors"
          style={{
            width: "8px",
            height: "8px",
            gridRow: r + 1,
            gridColumn: c + 1,
            backgroundColor: page
              ? isActive
                ? "var(--accent)"
                : "var(--text-secondary)"
              : "rgba(255,255,255,0.08)",
            cursor: page ? "pointer" : "default",
          }}
          onClick={() => page && onPageSelect(page.id)}
          aria-label={page ? `Go to ${page.name}` : undefined}
        />
      );
    }
  }

  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg-secondary)] gap-2 shrink-0">
      {/* Profile name + dot grid */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Profile selector */}
        {profiles && profiles.length > 1 && onSwitchProfile && (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-1.5 py-0.5 rounded hover:bg-[var(--bg-button)] truncate max-w-[80px]"
            >
              {activeProfile?.name ?? "Profile"}
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="inline-block ml-0.5"
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--bg-secondary)] border border-[var(--bg-button)] rounded-lg shadow-lg overflow-hidden min-w-[120px]">
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSwitchProfile(p.id);
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-[var(--bg-button)] transition-colors"
                      style={{
                        color:
                          p.id === activeProfileId
                            ? "var(--accent)"
                            : "var(--text-primary)",
                        fontWeight: p.id === activeProfileId ? 600 : 400,
                      }}
                    >
                      {p.id === activeProfileId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                      )}
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 2D dot grid page indicator */}
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${gridBounds.cols}, 8px)`,
            gridTemplateRows: `repeat(${gridBounds.rows}, 8px)`,
          }}
        >
          {dots}
        </div>
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <IconButton
          onClick={toggleFullscreen}
          label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </IconButton>
        <IconButton onClick={onEditMode} label="Edit mode">
          <GearIcon />
        </IconButton>
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: connected ? "var(--success)" : "var(--danger)",
          }}
          title={connected ? "Connected" : "Disconnected"}
        />
      </div>
    </div>
  );
}

function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-[var(--bg-button)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function FullscreenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94 0 .31.02.63.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />
    </svg>
  );
}
