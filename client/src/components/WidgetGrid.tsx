import { useCallback, useRef, useState } from "react";
import type { WidgetConfig, GridConfig } from "shared";
import { WidgetRenderer } from "./WidgetRenderer";
import { EditableWidget } from "./edit/EditableWidget";

interface WidgetGridProps {
  grid: GridConfig;
  widgets: WidgetConfig[];
  liveData: Record<string, unknown>;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  onSliderChange: (widgetId: string, value: number) => void;
  editMode?: boolean;
  selectedWidgetId?: string | null;
  onSelectWidget?: (id: string | null) => void;
  onEditWidget?: (id: string) => void;
  onDeleteWidget?: (id: string) => void;
  onEmptyCellClick?: (row: number, col: number) => void;
  onMoveWidget?: (widgetId: string, row: number, col: number) => void;
  onResizeWidget?: (widgetId: string, colspan: number, rowspan: number) => void;
}

interface DragState {
  type: "move" | "resize";
  widgetId: string;
  // For move: origin position of the widget
  originRow: number;
  originCol: number;
  // For move: current target position
  targetRow: number;
  targetCol: number;
  // For resize: original span
  originColspan: number;
  originRowspan: number;
  // For resize: current span
  targetColspan: number;
  targetRowspan: number;
  // Starting pointer position
  startX: number;
  startY: number;
}

function buildOccupationMap(
  widgets: WidgetConfig[],
  rows: number,
  cols: number,
  excludeId?: string
): boolean[][] {
  const map: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
  for (const w of widgets) {
    if (w.id === excludeId) continue;
    const rs = w.position.rowspan ?? 1;
    const cs = w.position.colspan ?? 1;
    for (let r = w.position.row; r < w.position.row + rs && r < rows; r++) {
      for (let c = w.position.col; c < w.position.col + cs && c < cols; c++) {
        map[r]![c] = true;
      }
    }
  }
  return map;
}

function canPlace(
  occupied: boolean[][],
  row: number,
  col: number,
  colspan: number,
  rowspan: number,
  gridRows: number,
  gridCols: number
): boolean {
  if (row < 0 || col < 0) return false;
  if (row + rowspan > gridRows || col + colspan > gridCols) return false;
  for (let r = row; r < row + rowspan; r++) {
    for (let c = col; c < col + colspan; c++) {
      if (occupied[r]![c]) return false;
    }
  }
  return true;
}

export function WidgetGrid({
  grid,
  widgets,
  liveData,
  onPress,
  onLongPress,
  onSliderChange,
  editMode,
  selectedWidgetId,
  onSelectWidget,
  onEditWidget,
  onDeleteWidget,
  onEmptyCellClick,
  onMoveWidget,
  onResizeWidget,
}: WidgetGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const occupied = buildOccupationMap(widgets, grid.rows, grid.columns);

  // Convert pointer position to grid cell
  const pointerToCell = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } => {
      const el = gridRef.current;
      if (!el) return { row: 0, col: 0 };
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const col = Math.floor((x / rect.width) * grid.columns);
      const row = Math.floor((y / rect.height) * grid.rows);
      return {
        row: Math.max(0, Math.min(grid.rows - 1, row)),
        col: Math.max(0, Math.min(grid.columns - 1, col)),
      };
    },
    [grid.columns, grid.rows]
  );

  const handleDragStart = useCallback(
    (widgetId: string, e: React.PointerEvent) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({
        type: "move",
        widgetId,
        originRow: widget.position.row,
        originCol: widget.position.col,
        targetRow: widget.position.row,
        targetCol: widget.position.col,
        originColspan: widget.position.colspan ?? 1,
        originRowspan: widget.position.rowspan ?? 1,
        targetColspan: widget.position.colspan ?? 1,
        targetRowspan: widget.position.rowspan ?? 1,
        startX: e.clientX,
        startY: e.clientY,
      });
      onSelectWidget?.(widgetId);
    },
    [widgets, onSelectWidget]
  );

  const handleResizeStart = useCallback(
    (widgetId: string, e: React.PointerEvent) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({
        type: "resize",
        widgetId,
        originRow: widget.position.row,
        originCol: widget.position.col,
        targetRow: widget.position.row,
        targetCol: widget.position.col,
        originColspan: widget.position.colspan ?? 1,
        originRowspan: widget.position.rowspan ?? 1,
        targetColspan: widget.position.colspan ?? 1,
        targetRowspan: widget.position.rowspan ?? 1,
        startX: e.clientX,
        startY: e.clientY,
      });
    },
    [widgets]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;

      const cell = pointerToCell(e.clientX, e.clientY);

      if (drag.type === "move") {
        // Clamp target so widget stays in bounds
        const maxRow = grid.rows - drag.originRowspan;
        const maxCol = grid.columns - drag.originColspan;
        const targetRow = Math.max(0, Math.min(maxRow, cell.row));
        const targetCol = Math.max(0, Math.min(maxCol, cell.col));

        if (targetRow !== drag.targetRow || targetCol !== drag.targetCol) {
          setDrag((prev) => prev ? { ...prev, targetRow, targetCol } : null);
        }
      } else if (drag.type === "resize") {
        // Calculate new colspan/rowspan based on pointer position relative to widget origin
        const newColspan = Math.max(1, Math.min(grid.columns - drag.originCol, cell.col - drag.originCol + 1));
        const newRowspan = Math.max(1, Math.min(grid.rows - drag.originRow, cell.row - drag.originRow + 1));

        if (newColspan !== drag.targetColspan || newRowspan !== drag.targetRowspan) {
          setDrag((prev) => prev ? { ...prev, targetColspan: newColspan, targetRowspan: newRowspan } : null);
        }
      }
    },
    [drag, pointerToCell, grid.rows, grid.columns]
  );

  const handlePointerUp = useCallback(() => {
    if (!drag) return;

    if (drag.type === "move") {
      if (drag.targetRow !== drag.originRow || drag.targetCol !== drag.originCol) {
        // Check for collision before committing
        const occ = buildOccupationMap(widgets, grid.rows, grid.columns, drag.widgetId);
        if (canPlace(occ, drag.targetRow, drag.targetCol, drag.originColspan, drag.originRowspan, grid.rows, grid.columns)) {
          onMoveWidget?.(drag.widgetId, drag.targetRow, drag.targetCol);
        }
      }
    } else if (drag.type === "resize") {
      if (drag.targetColspan !== drag.originColspan || drag.targetRowspan !== drag.originRowspan) {
        const occ = buildOccupationMap(widgets, grid.rows, grid.columns, drag.widgetId);
        if (canPlace(occ, drag.originRow, drag.originCol, drag.targetColspan, drag.targetRowspan, grid.rows, grid.columns)) {
          onResizeWidget?.(drag.widgetId, drag.targetColspan, drag.targetRowspan);
        }
      }
    }

    setDrag(null);
  }, [drag, widgets, grid.rows, grid.columns, onMoveWidget, onResizeWidget]);

  const emptyCells: { row: number; col: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.columns; c++) {
      if (!occupied[r]![c]) {
        emptyCells.push({ row: r, col: c });
      }
    }
  }

  // Compute ghost overlay position
  const ghostStyle = drag
    ? drag.type === "move"
      ? {
          gridColumn: `${drag.targetCol + 1} / span ${drag.originColspan}`,
          gridRow: `${drag.targetRow + 1} / span ${drag.originRowspan}`,
        }
      : {
          gridColumn: `${drag.originCol + 1} / span ${drag.targetColspan}`,
          gridRow: `${drag.originRow + 1} / span ${drag.targetRowspan}`,
        }
    : null;

  // Check if ghost position is valid
  const ghostValid = drag
    ? (() => {
        const occ = buildOccupationMap(widgets, grid.rows, grid.columns, drag.widgetId);
        if (drag.type === "move") {
          return canPlace(occ, drag.targetRow, drag.targetCol, drag.originColspan, drag.originRowspan, grid.rows, grid.columns);
        } else {
          return canPlace(occ, drag.originRow, drag.originCol, drag.targetColspan, drag.targetRowspan, grid.rows, grid.columns);
        }
      })()
    : false;

  return (
    <div
      ref={gridRef}
      className="h-full grid gap-2 p-3 min-h-0"
      style={{
        gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
      }}
      onClick={editMode ? () => onSelectWidget?.(null) : undefined}
      onPointerMove={drag ? handlePointerMove : undefined}
      onPointerUp={drag ? handlePointerUp : undefined}
    >
      {widgets.map((widget) => (
        <div
          key={widget.id}
          className="overflow-hidden min-h-0 min-w-0"
          style={{
            gridColumn: `${widget.position.col + 1} / span ${widget.position.colspan ?? 1}`,
            gridRow: `${widget.position.row + 1} / span ${widget.position.rowspan ?? 1}`,
            opacity: drag?.widgetId === widget.id ? 0.4 : 1,
            transition: drag ? "none" : "opacity 150ms",
          }}
        >
          {editMode ? (
            <EditableWidget
              widget={widget}
              selected={selectedWidgetId === widget.id}
              liveData={liveData}
              onSelect={() => onSelectWidget?.(widget.id)}
              onEdit={() => onEditWidget?.(widget.id)}
              onDelete={() => onDeleteWidget?.(widget.id)}
              onDragStart={handleDragStart}
              onResizeStart={handleResizeStart}
            />
          ) : (
            <WidgetRenderer
              widget={widget}
              liveData={liveData}
              onPress={onPress}
              onLongPress={onLongPress}
              onSliderChange={onSliderChange}
            />
          )}
        </div>
      ))}

      {/* Ghost overlay during drag/resize */}
      {drag && ghostStyle && (
        <div
          className="rounded-xl border-2 border-dashed pointer-events-none"
          style={{
            ...ghostStyle,
            borderColor: ghostValid ? "var(--accent)" : "var(--danger)",
            backgroundColor: ghostValid ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.1)",
            zIndex: 10,
          }}
        />
      )}

      {emptyCells.map(({ row, col }) => (
        <div
          key={`empty-${row}-${col}`}
          className={`rounded-xl bg-[var(--bg-button)] ${
            editMode
              ? "opacity-40 cursor-pointer hover:opacity-60 flex items-center justify-center transition-opacity"
              : "opacity-30"
          }`}
          style={{
            gridColumn: col + 1,
            gridRow: row + 1,
          }}
          onClick={
            editMode
              ? (e) => {
                  e.stopPropagation();
                  onEmptyCellClick?.(row, col);
                }
              : undefined
          }
        >
          {editMode && (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="var(--text-secondary)"
              opacity={0.5}
            >
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
