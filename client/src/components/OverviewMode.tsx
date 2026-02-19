import { useCallback, useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import type { DeckPilotConfig, PageConfig } from "shared";
import { apiUrl } from "../lib/api";

interface OverviewModeProps {
  open: boolean;
  pages: PageConfig[];
  activePageId: string | null;
  gridBounds: { rows: number; cols: number };
  config: DeckPilotConfig | null;
  onSelectPage: (pageId: string) => void;
  onClose: () => void;
  onConfigSaved: (config: DeckPilotConfig) => void;
  getPageAt: (row: number, col: number) => PageConfig | null;
}

export function OverviewMode({
  open,
  pages,
  activePageId,
  gridBounds,
  config,
  onSelectPage,
  onClose,
  onConfigSaved,
  getPageAt,
}: OverviewModeProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ row: number; col: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [overDeleteZone, setOverDeleteZone] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const prevOpenRef = useRef(false);

  // Animate entry/exit
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    if (open) {
      el.style.display = "flex";
      animate(el, {
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 200,
        ease: "outCubic",
      });

      // Stagger entry animation for page cards
      if (!prevOpenRef.current) {
        const cards = cardsRef.current?.querySelectorAll("[data-page-card]");
        if (cards) {
          cards.forEach((card, i) => {
            animate(card as HTMLElement, {
              translateY: [20, 0],
              opacity: [0, 1],
              duration: 300,
              delay: i * 30,
              ease: "outCubic",
            });
          });
        }
      }
    } else {
      animate(el, {
        opacity: [1, 0],
        scale: [1, 0.95],
        duration: 150,
        ease: "inCubic",
        onComplete: () => {
          if (el) el.style.display = "none";
        },
      });
    }

    prevOpenRef.current = open;
  }, [open]);

  const handleTap = useCallback(
    (pageId: string) => {
      if (dragPageId) return;
      onSelectPage(pageId);
      onClose();
    },
    [dragPageId, onSelectPage, onClose]
  );

  const handleLongPressStart = useCallback(
    (pageId: string, clientX: number, clientY: number) => {
      touchStartPos.current = { x: clientX, y: clientY };
      longPressTimer.current = setTimeout(() => {
        setDragPageId(pageId);
        setDragPos({ x: clientX, y: clientY });
      }, 500);
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      // Cancel long press if moved too far
      if (touchStartPos.current && longPressTimer.current) {
        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
        const dy = Math.abs(touch.clientY - touchStartPos.current.y);
        if (dx > 10 || dy > 10) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = undefined;
        }
      }

      if (!dragPageId) return;

      // Update drag ghost position
      setDragPos({ x: touch.clientX, y: touch.clientY });

      // Check if over the delete zone (bottom 80px of screen)
      const isOverDelete = touch.clientY > window.innerHeight - 80;
      setOverDeleteZone(isOverDelete);

      if (isOverDelete) {
        setDragOver(null);
        return;
      }

      // Find which grid cell we're over
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const cellEl = el?.closest("[data-grid-cell]") as HTMLElement | null;
      if (cellEl) {
        const row = parseInt(cellEl.dataset.gridRow ?? "0", 10);
        const col = parseInt(cellEl.dataset.gridCol ?? "0", 10);
        setDragOver({ row, col });
      }
    },
    [dragPageId]
  );

  const saveConfig = useCallback(
    (newConfig: DeckPilotConfig) => {
      fetch(apiUrl("/api/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      }).then((res) => {
        if (res.ok) onConfigSaved(newConfig);
      });
    },
    [onConfigSaved]
  );

  const computeGridSize = useCallback(
    (profile: DeckPilotConfig["profiles"][0]) => {
      let maxR = 0;
      let maxC = 0;
      for (const pg of profile.pages) {
        if (pg.gridPosition) {
          maxR = Math.max(maxR, pg.gridPosition.row);
          maxC = Math.max(maxC, pg.gridPosition.col);
        }
      }
      return { rows: maxR + 1, cols: maxC + 1 };
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
    touchStartPos.current = null;

    if (dragPageId && config) {
      const dragPage = pages.find((p) => p.id === dragPageId);

      // Handle delete zone drop
      if (overDeleteZone && dragPage) {
        // Only delete if not the last page and confirm if has widgets
        if (pages.length > 1) {
          const hasWidgets = dragPage.widgets.length > 0;
          if (!hasWidgets || window.confirm(`Delete "${dragPage.name}" and its ${dragPage.widgets.length} widget(s)?`)) {
            const newConfig = structuredClone(config);
            const profile = newConfig.profiles.find((p) => p.id === newConfig.activeProfile);
            if (profile) {
              profile.pages = profile.pages.filter((p) => p.id !== dragPageId);
              profile.pageGridSize = computeGridSize(profile);
              newConfig.version = Math.max(newConfig.version, 8);
              saveConfig(newConfig);
            }
          }
        }
      }
      // Handle rearrange drop
      else if (dragOver && dragPage) {
        const occupant = getPageAt(dragOver.row, dragOver.col);
        const newConfig = structuredClone(config);
        const profile = newConfig.profiles.find((p) => p.id === newConfig.activeProfile);
        if (profile) {
          // Ensure ALL pages have gridPosition
          profile.pages.forEach((pg, i) => {
            if (!pg.gridPosition) {
              pg.gridPosition = { row: 0, col: i };
            }
          });

          const dp = profile.pages.find((p) => p.id === dragPageId);
          if (dp) {
            const oldPos = { ...dp.gridPosition };
            dp.gridPosition = { row: dragOver.row, col: dragOver.col };
            if (occupant && occupant.id !== dragPageId) {
              const occ = profile.pages.find((p) => p.id === occupant.id);
              if (occ) occ.gridPosition = oldPos;
            }

            // Auto-shrink: compute minimum bounding box
            profile.pageGridSize = computeGridSize(profile);
            newConfig.version = Math.max(newConfig.version, 8);
            saveConfig(newConfig);
          }
        }
      }
    }

    setDragPageId(null);
    setDragOver(null);
    setDragPos(null);
    setOverDeleteZone(false);
  }, [dragPageId, dragOver, overDeleteZone, config, pages, getPageAt, saveConfig, computeGridSize]);

  const handleAddPage = useCallback(
    (row: number, col: number) => {
      if (!config) return;
      const name = `Page ${pages.length + 1}`;
      const newConfig = structuredClone(config);
      const profile = newConfig.profiles.find((p) => p.id === newConfig.activeProfile);
      if (!profile) return;

      const id = `page-${Date.now()}`;
      profile.pages.push({
        id,
        name,
        gridPosition: { row, col },
        widgets: [],
      });

      // Expand grid if needed
      profile.pageGridSize = computeGridSize(profile);
      newConfig.version = Math.max(newConfig.version, 8);
      saveConfig(newConfig);
    },
    [config, pages.length, saveConfig, computeGridSize]
  );

  // Show extra row + column for expansion
  const displayRows = gridBounds.rows + 1;
  const displayCols = gridBounds.cols + 1;

  // Find the dragged page for the ghost card
  const dragPage = dragPageId ? pages.find((p) => p.id === dragPageId) : null;

  // Build grid cells
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < displayRows; r++) {
    for (let c = 0; c < displayCols; c++) {
      const page = getPageAt(r, c);
      const isActive = page?.id === activePageId;
      const isDragging = page?.id === dragPageId;
      const isDragTarget = dragOver?.row === r && dragOver?.col === c && dragPageId && !overDeleteZone;
      const isEmpty = !page;

      cells.push(
        <div
          key={`${r},${c}`}
          data-grid-cell
          data-grid-row={r}
          data-grid-col={c}
          data-page-card={page ? "" : undefined}
          className="rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-150 relative"
          style={{
            gridRow: r + 1,
            gridColumn: c + 1,
            backgroundColor: page
              ? isDragging
                ? "rgba(59, 130, 246, 0.1)"
                : isActive
                  ? "rgba(59, 130, 246, 0.15)"
                  : "var(--bg-button)"
              : isDragTarget
                ? "rgba(59, 130, 246, 0.15)"
                : "rgba(255,255,255,0.03)",
            border: isDragTarget
              ? "2px solid var(--accent)"
              : isActive
                ? "2px solid var(--accent)"
                : "2px solid transparent",
            opacity: isDragging ? 0.4 : 1,
            minHeight: "100px",
            animation: isDragTarget ? "pulse-border 1s infinite" : undefined,
          }}
          onTouchStart={(e) => {
            if (page) {
              const touch = e.touches[0];
              if (touch) handleLongPressStart(page.id, touch.clientX, touch.clientY);
            }
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => {
            handleTouchEnd();
            if (!dragPageId && page) {
              handleTap(page.id);
            }
          }}
          onClick={() => {
            if (!dragPageId && page) {
              handleTap(page.id);
            }
          }}
        >
          {page ? (
            <>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {page.name}
              </span>
              {/* Mini widget dot grid */}
              <div className="flex gap-0.5 flex-wrap justify-center max-w-[60px]">
                {page.widgets.slice(0, 9).map((w, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: w.color ?? "var(--text-secondary)" }}
                  />
                ))}
              </div>
            </>
          ) : isEmpty && !dragPageId ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddPage(r, c);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--text-secondary)] opacity-40 hover:opacity-80 hover:bg-[var(--bg-button)] transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </button>
          ) : (
            <span className="text-xs text-[var(--text-secondary)] opacity-30">
              {isDragTarget ? "Drop here" : ""}
            </span>
          )}
        </div>
      );
    }
  }

  return (
    <>
      {/* Pulsing border animation */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { border-color: var(--accent); }
          50% { border-color: rgba(59, 130, 246, 0.3); }
        }
      `}</style>

      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
        style={{
          backgroundColor: "rgba(0,0,0,0.85)",
          display: open ? "flex" : "none",
        }}
        onClick={(e) => {
          if (e.target === overlayRef.current) onClose();
        }}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Pages</h2>
        <div
          ref={cardsRef}
          className="grid gap-3 w-full max-w-lg"
          style={{
            gridTemplateColumns: `repeat(${displayCols}, 1fr)`,
            gridTemplateRows: `repeat(${displayRows}, 1fr)`,
          }}
        >
          {cells}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-4">
          {dragPageId ? "Drop to rearrange · Drag to bottom to delete" : "Tap to select · Hold to rearrange · + to add"}
        </p>

        {/* Delete zone - shown when dragging */}
        {dragPageId && pages.length > 1 && (
          <div
            className="fixed bottom-0 left-0 right-0 flex items-center justify-center transition-all duration-200"
            style={{
              height: "80px",
              backgroundColor: overDeleteZone ? "rgba(239, 68, 68, 0.4)" : "rgba(239, 68, 68, 0.15)",
              borderTop: overDeleteZone ? "2px solid #ef4444" : "2px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill={overDeleteZone ? "#ef4444" : "rgba(239,68,68,0.6)"}>
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
              <span
                className="text-sm font-medium"
                style={{ color: overDeleteZone ? "#ef4444" : "rgba(239,68,68,0.6)" }}
              >
                Delete page
              </span>
            </div>
          </div>
        )}

        {/* Drag ghost */}
        {dragPageId && dragPos && dragPage && (
          <div
            className="fixed z-[100] pointer-events-none rounded-xl flex flex-col items-center justify-center gap-2 shadow-2xl"
            style={{
              left: dragPos.x - 60,
              top: dragPos.y - 50,
              width: 120,
              height: 100,
              backgroundColor: overDeleteZone ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.2)",
              border: overDeleteZone ? "2px solid #ef4444" : "2px solid var(--accent)",
              transform: "scale(1.05)",
            }}
          >
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {dragPage.name}
            </span>
            <div className="flex gap-0.5 flex-wrap justify-center max-w-[60px]">
              {dragPage.widgets.slice(0, 9).map((w, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: w.color ?? "var(--text-secondary)" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
