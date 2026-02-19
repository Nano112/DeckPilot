interface EditModeToolbarProps {
  dirty: boolean;
  onSave: () => void;
  onCancel: () => void;
  onAddWidget: () => void;
  onGamepad: () => void;
  onProfiles: () => void;
}

export function EditModeToolbar({
  dirty,
  onSave,
  onCancel,
  onAddWidget,
  onGamepad,
  onProfiles,
}: EditModeToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[var(--accent)]">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">Edit Mode</span>
      </div>
      <div className="flex items-center gap-2">
        <ToolbarButton onClick={onAddWidget} label="Add Widget">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton onClick={onGamepad} label="Gamepad">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton onClick={onProfiles} label="Profiles">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </ToolbarButton>
        <div className="w-px h-5 bg-white/30 mx-1" />
        <ToolbarButton onClick={onCancel} label="Cancel" variant="ghost">
          Cancel
        </ToolbarButton>
        <ToolbarButton onClick={onSave} label="Save" variant="primary" disabled={!dirty}>
          Save
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  variant = "default",
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  variant?: "default" | "ghost" | "primary";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const base = "flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors";
  const styles = {
    default: "bg-white/15 text-white hover:bg-white/25",
    ghost: "text-white/80 hover:text-white hover:bg-white/10",
    primary: disabled
      ? "bg-white/20 text-white/50 cursor-not-allowed"
      : "bg-white text-[var(--accent)] hover:bg-white/90",
  };

  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
    >
      {children}
    </button>
  );
}
