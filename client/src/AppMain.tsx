import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useConfig } from "./hooks/useConfig";
import { useGamepad } from "./hooks/useGamepad";
import { useLiveData } from "./hooks/useLiveData";
import { useEditMode } from "./hooks/useEditMode";
import { usePageNavigation } from "./hooks/usePageNavigation";
import { useGestures } from "./hooks/useGestures";
import { usePageTransition } from "./hooks/usePageTransition";
import { useToast } from "./hooks/useToast";
import { copyToClipboard } from "./lib/clipboard";
import { apiUrl } from "./lib/api";
import { triggerHaptic } from "./lib/haptics";
import { StatusBar } from "./components/StatusBar";
import { WidgetGrid } from "./components/WidgetGrid";
import { GamepadIndicator } from "./components/GamepadIndicator";
import { ToastContainer } from "./components/ToastContainer";
import { OverviewMode } from "./components/OverviewMode";
import { EditModeToolbar } from "./components/edit/EditModeToolbar";
import { WidgetPropertiesSheet } from "./components/edit/WidgetPropertiesSheet";
import { AddWidgetSheet } from "./components/edit/AddWidgetSheet";
import { GamepadBindingEditor } from "./components/edit/GamepadBindingEditor";
import { ProfileManagerSheet } from "./components/edit/ProfileManagerSheet";

interface AppMainProps {
  serverUrl?: string;
}

export function AppMain({ serverUrl }: AppMainProps) {
  const { connected, lastMessage, send } = useWebSocket(serverUrl);
  const { config, setConfig, grid, pages, pageGridSize } = useConfig(lastMessage);
  const liveData = useLiveData(lastMessage);
  const [lastGamepadButton, setLastGamepadButton] = useState<number | null>(null);
  const { toasts, showToast, dismissToast } = useToast();

  // 2D page navigation
  const nav = usePageNavigation({ pages, gridSize: pageGridSize });

  // Page transition animation
  const { containerRef, triggerTransition } = usePageTransition(nav.finishTransition);

  // Trigger animation when transitioning
  useEffect(() => {
    if (nav.isTransitioning && nav.transitionDirection) {
      triggerTransition(nav.transitionDirection);
    }
  }, [nav.isTransitioning, nav.transitionDirection, triggerTransition]);

  // Edit mode
  const edit = useEditMode(config, setConfig);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [addWidgetPos, setAddWidgetPos] = useState<{ row: number; col: number } | null>(null);
  const [showWidgetProps, setShowWidgetProps] = useState(false);
  const [showGamepadEditor, setShowGamepadEditor] = useState(false);
  const [showProfileManager, setShowProfileManager] = useState(false);

  // Gesture handling (4-direction swipe + pinch)
  const gestureHandlers = useGestures({
    onSwipe: (dir) => {
      if (dir === "left") nav.navigatePage("right");
      else if (dir === "right") nav.navigatePage("left");
      else if (dir === "up") nav.navigatePage("down");
      else if (dir === "down") nav.navigatePage("up");
    },
    onPinchIn: nav.openOverview,
    onPinchOut: nav.closeOverview,
    enabled: !edit.editMode.active,
  });

  // Determine which config to render from (draft in edit mode, live otherwise)
  const activeConfig = edit.editMode.active ? edit.editMode.draft : config;
  const activeProfile = activeConfig?.profiles.find((p) => p.id === activeConfig.activeProfile);
  const displayPages = activeProfile?.pages ?? [];

  // Find current display page by activePageId
  const displayPage = displayPages.find((p) => p.id === nav.activePageId) ?? displayPages[0] ?? null;
  const displayGrid = activeProfile?.grid ?? grid;

  const handlePress = useCallback(
    (id: string) => {
      if (!displayPage) return;

      // Check for client-side actions (clipboard.copy) before sending to server
      const widget = displayPage.widgets.find((w) => w.id === id);
      if (widget?.action?.type === "clipboard.copy") {
        const text = (widget.action.params as { text?: string }).text;
        if (text) {
          copyToClipboard(text).then(
            (ok) => {
              if (ok) {
                showToast("Copied to clipboard!", "success");
              } else {
                showToast(`Copy failed. Text: ${text}`, "error");
              }
            },
            (err) => {
              showToast(`Copy error: ${err}`, "error");
            }
          );
        }
        return;
      }

      triggerHaptic(0.2, 40);
      send({ type: "button_press", actionId: id, page: displayPage.id });
    },
    [displayPage, send, showToast]
  );

  const handleLongPress = useCallback(
    (id: string) => {
      if (!displayPage) return;
      send({ type: "button_long_press", actionId: id, page: displayPage.id });
    },
    [displayPage, send]
  );

  const handleSliderChange = useCallback(
    (widgetId: string, value: number) => {
      if (!displayPage) return;
      send({ type: "slider_change", widgetId, page: displayPage.id, value });
    },
    [displayPage, send]
  );

  const handleGamepadButton = useCallback(
    (button: number) => {
      triggerHaptic(0.2, 40);
      setLastGamepadButton(button);
      setTimeout(() => setLastGamepadButton(null), 1500);

      const binding = config?.gamepadBindings.find((b) => b.button === button);
      if (!binding) {
        send({ type: "gamepad_button", button });
        return;
      }

      if (binding.kind === "client") {
        switch (binding.clientAction) {
          case "nav.page.next":
            nav.navigatePage("right");
            break;
          case "nav.page.previous":
            nav.navigatePage("left");
            break;
          case "nav.page.up":
            nav.navigatePage("up");
            break;
          case "nav.page.down":
            nav.navigatePage("down");
            break;
          case "nav.page.overview":
            nav.toggleOverview();
            break;
        }
      } else {
        send({ type: "gamepad_button", button });
      }
    },
    [config, send, nav]
  );

  useGamepad(handleGamepadButton);

  // Live profile switching (outside edit mode)
  const handleSwitchProfile = useCallback(
    (profileId: string) => {
      if (!config) return;
      const newConfig = structuredClone(config);
      newConfig.activeProfile = profileId;
      fetch(apiUrl("/api/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      }).then((res) => {
        if (res.ok) {
          setConfig(newConfig);
          // Reset to the first page of the new profile
          const profile = newConfig.profiles.find((p) => p.id === profileId);
          if (profile?.pages[0]) {
            nav.setActivePageId(profile.pages[0].id);
          }
        }
      });
    },
    [config, setConfig, nav]
  );

  // Edit mode handlers
  const handleEditWidget = useCallback(
    (widgetId: string) => {
      edit.selectWidget(widgetId);
      setShowWidgetProps(true);
    },
    [edit]
  );

  const handleDeleteWidget = useCallback(
    (widgetId: string) => {
      if (!displayPage) return;
      edit.deleteWidget(displayPage.id, widgetId);
    },
    [edit, displayPage]
  );

  const handleEmptyCellClick = useCallback(
    (row: number, col: number) => {
      setAddWidgetPos({ row, col });
      setShowAddWidget(true);
    },
    []
  );

  const handleMoveWidget = useCallback(
    (widgetId: string, row: number, col: number) => {
      if (!displayPage) return;
      edit.moveWidget(displayPage.id, widgetId, row, col);
    },
    [edit, displayPage]
  );

  const handleResizeWidget = useCallback(
    (widgetId: string, colspan: number, rowspan: number) => {
      if (!displayPage) return;
      edit.resizeWidget(displayPage.id, widgetId, colspan, rowspan);
    },
    [edit, displayPage]
  );

  // Find the selected widget for the properties sheet
  const selectedWidget = displayPage?.widgets.find(
    (w) => w.id === edit.editMode.selectedWidgetId
  ) ?? null;

  return (
    <div className="flex flex-col h-full relative">
      {edit.editMode.active ? (
        <EditModeToolbar
          dirty={edit.editMode.dirty}
          onSave={edit.saveEditMode}
          onCancel={edit.exitEditMode}
          onAddWidget={() => {
            setAddWidgetPos(null);
            setShowAddWidget(true);
          }}
          onGamepad={() => setShowGamepadEditor(true)}
          onProfiles={() => setShowProfileManager(true)}
        />
      ) : (
        <StatusBar
          connected={connected}
          onEditMode={edit.enterEditMode}
          activePageId={nav.activePageId}
          gridBounds={nav.gridBounds}
          onPageSelect={nav.setActivePageId}
          getPageAt={nav.getPageAt}
          profiles={config?.profiles}
          activeProfileId={config?.activeProfile}
          onSwitchProfile={handleSwitchProfile}
        />
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ touchAction: "none" }}
        onTouchStart={gestureHandlers.onTouchStart}
        onTouchMove={gestureHandlers.onTouchMove}
        onTouchEnd={gestureHandlers.onTouchEnd}
      >
        <WidgetGrid
          grid={displayGrid}
          widgets={displayPage?.widgets ?? []}
          liveData={liveData}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onSliderChange={handleSliderChange}
          editMode={edit.editMode.active}
          selectedWidgetId={edit.editMode.selectedWidgetId}
          onSelectWidget={edit.selectWidget}
          onEditWidget={handleEditWidget}
          onDeleteWidget={handleDeleteWidget}
          onEmptyCellClick={handleEmptyCellClick}
          onMoveWidget={handleMoveWidget}
          onResizeWidget={handleResizeWidget}
        />
      </div>

      {!edit.editMode.active && (
        <>
          <GamepadIndicator lastButton={lastGamepadButton} bindings={config?.gamepadBindings} />
          <OverviewMode
            open={nav.overviewOpen}
            pages={displayPages}
            activePageId={nav.activePageId}
            gridBounds={nav.gridBounds}
            config={config}
            onSelectPage={(pageId) => {
              nav.setActivePageId(pageId);
              nav.closeOverview();
            }}
            onClose={nav.closeOverview}
            onConfigSaved={setConfig}
            getPageAt={nav.getPageAt}
          />
        </>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Edit mode sheets */}
      {edit.editMode.active && displayPage && (
        <>
          <AddWidgetSheet
            open={showAddWidget}
            position={addWidgetPos ?? { row: 0, col: 0 }}
            onClose={() => {
              setShowAddWidget(false);
              setAddWidgetPos(null);
            }}
            onAdd={(widget) => {
              edit.addWidget(displayPage.id, widget);
            }}
          />

          <WidgetPropertiesSheet
            open={showWidgetProps}
            widget={selectedWidget}
            onClose={() => setShowWidgetProps(false)}
            onSave={(widget) => {
              edit.updateWidget(displayPage.id, widget);
            }}
          />

          <GamepadBindingEditor
            open={showGamepadEditor}
            bindings={edit.editMode.draft?.gamepadBindings ?? []}
            onClose={() => setShowGamepadEditor(false)}
            onUpdate={edit.updateGamepadBinding}
            onAdd={edit.addGamepadBinding}
            onDelete={edit.deleteGamepadBinding}
          />

          <ProfileManagerSheet
            open={showProfileManager}
            profiles={edit.editMode.draft?.profiles ?? []}
            activeProfileId={edit.editMode.draft?.activeProfile ?? ""}
            onClose={() => setShowProfileManager(false)}
            onAdd={edit.addProfile}
            onDelete={edit.deleteProfile}
            onRename={edit.renameProfile}
            onSwitch={edit.switchProfile}
          />
        </>
      )}
    </div>
  );
}
