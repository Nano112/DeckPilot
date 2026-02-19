import type { WidgetConfig } from "shared";
import { WidgetRenderer } from "../WidgetRenderer";

interface EditableWidgetProps {
  widget: WidgetConfig;
  selected: boolean;
  liveData: Record<string, unknown>;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart?: (widgetId: string, e: React.PointerEvent) => void;
  onResizeStart?: (widgetId: string, e: React.PointerEvent) => void;
}

export function EditableWidget({
  widget,
  selected,
  liveData,
  onSelect,
  onEdit,
  onDelete,
  onDragStart,
  onResizeStart,
}: EditableWidgetProps) {
  return (
    <div
      className="relative h-full w-full cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Widget content (non-interactive in edit mode) */}
      <div className="h-full w-full pointer-events-none opacity-80">
        <WidgetRenderer
          widget={widget}
          liveData={liveData}
          onPress={() => {}}
          onLongPress={() => {}}
          onSliderChange={() => {}}
        />
      </div>

      {/* Selection overlay */}
      <div
        className="absolute inset-0 rounded-xl border-2 transition-colors"
        style={{
          borderColor: selected ? "var(--accent)" : "transparent",
          backgroundColor: selected ? "rgba(59, 130, 246, 0.08)" : "transparent",
        }}
      />

      {/* Drag handle (top-left, always visible in edit mode) */}
      <div
        className="absolute top-1.5 left-1.5 flex items-center justify-center w-7 h-7 rounded-full cursor-grab active:cursor-grabbing touch-none"
        style={{
          backgroundColor: selected ? "var(--accent)" : "rgba(255,255,255,0.15)",
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onDragStart?.(widget.id, e);
        }}
      >
        {/* 6-dot grip icon */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill={selected ? "#fff" : "var(--text-secondary)"}>
          <circle cx="3.5" cy="2" r="1.2" />
          <circle cx="8.5" cy="2" r="1.2" />
          <circle cx="3.5" cy="6" r="1.2" />
          <circle cx="8.5" cy="6" r="1.2" />
          <circle cx="3.5" cy="10" r="1.2" />
          <circle cx="8.5" cy="10" r="1.2" />
        </svg>
      </div>

      {/* Edit/Delete floating toolbar */}
      {selected && (
        <div className="absolute top-1.5 right-1.5 flex gap-1">
          <MiniButton onClick={onEdit} label="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </MiniButton>
          <MiniButton onClick={onDelete} label="Delete" danger>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </MiniButton>
        </div>
      )}

      {/* Resize handle (bottom-right, only on selected) */}
      {selected && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize touch-none"
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart?.(widget.id, e);
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className="absolute bottom-1 right-1"
            fill="var(--accent)"
          >
            <path d="M11 1v10H1" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

function MiniButton({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      aria-label={label}
      className="flex items-center justify-center w-6 h-6 rounded-full pointer-events-auto"
      style={{
        backgroundColor: danger ? "var(--danger)" : "var(--accent)",
        color: "#fff",
      }}
    >
      {children}
    </button>
  );
}
