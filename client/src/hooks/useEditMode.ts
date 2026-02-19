import { useCallback, useState } from "react";
import type { DeckPilotConfig, GamepadBinding, PageGridPosition, WidgetConfig } from "shared";
import { apiUrl } from "../lib/api";

export interface EditModeState {
  active: boolean;
  draft: DeckPilotConfig | null;
  selectedWidgetId: string | null;
  dirty: boolean;
}

export function useEditMode(
  config: DeckPilotConfig | null,
  setConfig: (config: DeckPilotConfig) => void
) {
  const [editMode, setEditMode] = useState<EditModeState>({
    active: false,
    draft: null,
    selectedWidgetId: null,
    dirty: false,
  });

  const enterEditMode = useCallback(() => {
    if (!config) return;
    setEditMode({
      active: true,
      draft: structuredClone(config),
      selectedWidgetId: null,
      dirty: false,
    });
  }, [config]);

  const exitEditMode = useCallback(() => {
    setEditMode({
      active: false,
      draft: null,
      selectedWidgetId: null,
      dirty: false,
    });
  }, []);

  const saveEditMode = useCallback(async () => {
    if (!editMode.draft) return;
    const res = await fetch(apiUrl("/api/config"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editMode.draft),
    });
    if (res.ok) {
      setConfig(editMode.draft);
      setEditMode({
        active: false,
        draft: null,
        selectedWidgetId: null,
        dirty: false,
      });
    }
  }, [editMode.draft, setConfig]);

  const selectWidget = useCallback((id: string | null) => {
    setEditMode((prev) => ({ ...prev, selectedWidgetId: id }));
  }, []);

  // Helper: get the active profile pages from draft
  const mutateDraft = useCallback(
    (mutator: (draft: DeckPilotConfig) => void) => {
      setEditMode((prev) => {
        if (!prev.draft) return prev;
        const next = structuredClone(prev.draft);
        mutator(next);
        return { ...prev, draft: next, dirty: true };
      });
    },
    []
  );

  const getProfilePages = (draft: DeckPilotConfig) => {
    const profile = draft.profiles.find((p) => p.id === draft.activeProfile);
    return profile?.pages ?? [];
  };

  // Widget CRUD
  const updateWidget = useCallback(
    (pageId: string, widget: WidgetConfig) => {
      mutateDraft((draft) => {
        const pages = getProfilePages(draft);
        const page = pages.find((p) => p.id === pageId);
        if (!page) return;
        const idx = page.widgets.findIndex((w) => w.id === widget.id);
        if (idx >= 0) page.widgets[idx] = widget;
      });
    },
    [mutateDraft]
  );

  const deleteWidget = useCallback(
    (pageId: string, widgetId: string) => {
      mutateDraft((draft) => {
        const pages = getProfilePages(draft);
        const page = pages.find((p) => p.id === pageId);
        if (!page) return;
        page.widgets = page.widgets.filter((w) => w.id !== widgetId);
      });
      setEditMode((prev) => ({
        ...prev,
        selectedWidgetId:
          prev.selectedWidgetId === widgetId ? null : prev.selectedWidgetId,
      }));
    },
    [mutateDraft]
  );

  const addWidget = useCallback(
    (pageId: string, widget: WidgetConfig) => {
      mutateDraft((draft) => {
        const pages = getProfilePages(draft);
        const page = pages.find((p) => p.id === pageId);
        if (!page) return;
        page.widgets.push(widget);
      });
    },
    [mutateDraft]
  );

  const moveWidget = useCallback(
    (pageId: string, widgetId: string, row: number, col: number) => {
      mutateDraft((draft) => {
        const pages = getProfilePages(draft);
        const page = pages.find((p) => p.id === pageId);
        if (!page) return;
        const widget = page.widgets.find((w) => w.id === widgetId);
        if (widget) {
          widget.position.row = row;
          widget.position.col = col;
        }
      });
    },
    [mutateDraft]
  );

  const resizeWidget = useCallback(
    (pageId: string, widgetId: string, colspan: number, rowspan: number) => {
      mutateDraft((draft) => {
        const pages = getProfilePages(draft);
        const page = pages.find((p) => p.id === pageId);
        if (!page) return;
        const widget = page.widgets.find((w) => w.id === widgetId);
        if (widget) {
          widget.position.colspan = Math.max(1, colspan);
          widget.position.rowspan = Math.max(1, rowspan);
        }
      });
    },
    [mutateDraft]
  );

  // Gamepad bindings
  const updateGamepadBinding = useCallback(
    (index: number, binding: GamepadBinding) => {
      mutateDraft((draft) => {
        if (index >= 0 && index < draft.gamepadBindings.length) {
          draft.gamepadBindings[index] = binding;
        }
      });
    },
    [mutateDraft]
  );

  const addGamepadBinding = useCallback(
    (binding: GamepadBinding) => {
      mutateDraft((draft) => {
        draft.gamepadBindings.push(binding);
      });
    },
    [mutateDraft]
  );

  const deleteGamepadBinding = useCallback(
    (index: number) => {
      mutateDraft((draft) => {
        draft.gamepadBindings.splice(index, 1);
      });
    },
    [mutateDraft]
  );

  // Page management
  const addPage = useCallback(
    (name: string, gridPosition?: PageGridPosition) => {
      mutateDraft((draft) => {
        const profile = draft.profiles.find(
          (p) => p.id === draft.activeProfile
        );
        if (!profile) return;
        const id = `page-${Date.now()}`;

        // Auto-find first empty cell if no position specified
        let pos = gridPosition;
        if (!pos) {
          const bounds = profile.pageGridSize ?? { rows: 1, cols: profile.pages.length + 1 };
          const occupied = new Set(
            profile.pages.map((p) => `${p.gridPosition.row},${p.gridPosition.col}`)
          );
          outer: for (let r = 0; r < bounds.rows + 1; r++) {
            for (let c = 0; c < bounds.cols + 1; c++) {
              if (!occupied.has(`${r},${c}`)) {
                pos = { row: r, col: c };
                break outer;
              }
            }
          }
          if (!pos) pos = { row: 0, col: profile.pages.length };
          // Expand grid if needed
          if (profile.pageGridSize) {
            profile.pageGridSize.rows = Math.max(profile.pageGridSize.rows, pos.row + 1);
            profile.pageGridSize.cols = Math.max(profile.pageGridSize.cols, pos.col + 1);
          }
        }

        profile.pages.push({ id, name, gridPosition: pos, widgets: [] });
      });
    },
    [mutateDraft]
  );

  const movePage = useCallback(
    (pageId: string, newPosition: PageGridPosition) => {
      mutateDraft((draft) => {
        const profile = draft.profiles.find(
          (p) => p.id === draft.activeProfile
        );
        if (!profile) return;
        const page = profile.pages.find((p) => p.id === pageId);
        if (!page) return;
        // Swap with occupant at target position
        const occupant = profile.pages.find(
          (p) =>
            p.id !== pageId &&
            p.gridPosition.row === newPosition.row &&
            p.gridPosition.col === newPosition.col
        );
        const oldPos = { ...page.gridPosition };
        page.gridPosition = { ...newPosition };
        if (occupant) {
          occupant.gridPosition = oldPos;
        }
      });
    },
    [mutateDraft]
  );

  const deletePage = useCallback(
    (pageId: string) => {
      mutateDraft((draft) => {
        const profile = draft.profiles.find(
          (p) => p.id === draft.activeProfile
        );
        if (!profile || profile.pages.length <= 1) return;
        profile.pages = profile.pages.filter((p) => p.id !== pageId);
      });
    },
    [mutateDraft]
  );

  const renamePage = useCallback(
    (pageId: string, name: string) => {
      mutateDraft((draft) => {
        const profile = draft.profiles.find(
          (p) => p.id === draft.activeProfile
        );
        if (!profile) return;
        const page = profile.pages.find((p) => p.id === pageId);
        if (page) page.name = name;
      });
    },
    [mutateDraft]
  );

  // Profile management
  const addProfile = useCallback(
    (name: string) => {
      mutateDraft((draft) => {
        const id = `profile-${Date.now()}`;
        draft.profiles.push({
          id,
          name,
          grid: { columns: 5, rows: 3 },
          pageGridSize: { rows: 1, cols: 1 },
          pages: [
            {
              id: `page-${Date.now()}`,
              name: "Main",
              gridPosition: { row: 0, col: 0 },
              widgets: [],
            },
          ],
        });
      });
    },
    [mutateDraft]
  );

  const deleteProfile = useCallback(
    (profileId: string) => {
      mutateDraft((draft) => {
        if (draft.profiles.length <= 1) return;
        if (draft.activeProfile === profileId) return;
        draft.profiles = draft.profiles.filter((p) => p.id !== profileId);
      });
    },
    [mutateDraft]
  );

  const renameProfile = useCallback(
    (profileId: string, name: string) => {
      mutateDraft((draft) => {
        const profile = draft.profiles.find((p) => p.id === profileId);
        if (profile) profile.name = name;
      });
    },
    [mutateDraft]
  );

  const switchProfile = useCallback(
    (profileId: string) => {
      mutateDraft((draft) => {
        if (draft.profiles.some((p) => p.id === profileId)) {
          draft.activeProfile = profileId;
        }
      });
    },
    [mutateDraft]
  );

  return {
    editMode,
    enterEditMode,
    exitEditMode,
    saveEditMode,
    selectWidget,
    updateWidget,
    deleteWidget,
    addWidget,
    moveWidget,
    resizeWidget,
    updateGamepadBinding,
    addGamepadBinding,
    deleteGamepadBinding,
    addPage,
    movePage,
    deletePage,
    renamePage,
    addProfile,
    deleteProfile,
    renameProfile,
    switchProfile,
  };
}
