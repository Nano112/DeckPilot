import { useState } from "react";
import type { ProfileConfig } from "shared";
import { BottomSheet } from "./BottomSheet";

interface ProfileManagerSheetProps {
  open: boolean;
  profiles: ProfileConfig[];
  activeProfileId: string;
  onClose: () => void;
  onAdd: (name: string) => void;
  onDelete: (profileId: string) => void;
  onRename: (profileId: string, name: string) => void;
  onSwitch: (profileId: string) => void;
}

export function ProfileManagerSheet({
  open,
  profiles,
  activeProfileId,
  onClose,
  onAdd,
  onDelete,
  onRename,
  onSwitch,
}: ProfileManagerSheetProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const startRename = (profile: ProfileConfig) => {
    setEditingId(profile.id);
    setEditName(profile.name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleAdd = () => {
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName("");
      setShowAdd(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Profiles">
      <div className="flex flex-col gap-3">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          const isEditing = editingId === profile.id;

          return (
            <div
              key={profile.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors"
              style={{
                backgroundColor: isActive ? "rgba(59, 130, 246, 0.15)" : "var(--bg-button)",
                border: isActive ? "1px solid var(--accent)" : "1px solid transparent",
              }}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className="flex-1 min-w-0 px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
                />
              ) : (
                <button
                  onClick={() => onSwitch(profile.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {profile.name}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] ml-2">
                    {profile.pages.length} page{profile.pages.length !== 1 ? "s" : ""}
                  </span>
                </button>
              )}

              <div className="flex items-center gap-1 shrink-0">
                {isActive && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--accent)] text-white">
                    Active
                  </span>
                )}
                <button
                  onClick={() => startRename(profile)}
                  className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors"
                  title="Rename"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </button>
                {!isActive && profiles.length > 1 && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete profile "${profile.name}"?`)) {
                        onDelete(profile.id);
                      }
                    }}
                    className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)] hover:text-red-400 hover:bg-white/10 transition-colors"
                    title="Delete"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add profile */}
        {showAdd ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setShowAdd(false);
              }}
              placeholder="Profile name"
              autoFocus
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
            />
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-button)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-[var(--accent)] bg-[var(--bg-button)] hover:bg-[var(--bg-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            Add Profile
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
