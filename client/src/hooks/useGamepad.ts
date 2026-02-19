import { useEffect, useRef } from "react";
import { isTauri } from "../lib/platform";

const DEADZONE = 0.5;

export function useGamepad(onButton: (button: number) => void) {
  const prevPressed = useRef<Set<number>>(new Set());
  const loggedGamepads = useRef<Set<string>>(new Set());
  const onButtonRef = useRef(onButton);
  onButtonRef.current = onButton;

  useEffect(() => {
    if (isTauri()) {
      // Tauri mode: listen for SDL2 gamepad events from Rust backend
      let unlisten: (() => void) | undefined;

      import("@tauri-apps/api/event").then(({ listen }) => {
        listen<{ button: number }>("gamepad_button", (event) => {
          onButtonRef.current(event.payload.button);
        }).then((fn) => {
          unlisten = fn;
        });
      });

      return () => {
        unlisten?.();
      };
    }

    // Browser mode: RAF polling (existing behavior)
    const onConnect = (e: GamepadEvent) => {
      console.log("[Gamepad] Connected:", e.gamepad.id, {
        index: e.gamepad.index,
        buttons: e.gamepad.buttons.length,
        axes: e.gamepad.axes.length,
        mapping: e.gamepad.mapping,
      });
    };
    const onDisconnect = (e: GamepadEvent) => {
      console.log("[Gamepad] Disconnected:", e.gamepad.id);
      loggedGamepads.current.delete(e.gamepad.id);
    };

    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);

    let rafId: number;

    function poll() {
      const gamepads = navigator.getGamepads();
      const nowPressed = new Set<number>();
      for (const gp of gamepads) {
        if (!gp) continue;

        if (!loggedGamepads.current.has(gp.id)) {
          loggedGamepads.current.add(gp.id);
          console.log("[Gamepad] Detected in poll:", gp.id, {
            index: gp.index,
            buttons: gp.buttons.length,
            axes: gp.axes.length,
            mapping: gp.mapping,
          });
        }

        for (let i = 0; i < gp.buttons.length; i++) {
          const btn = gp.buttons[i];
          if (btn && (btn.pressed || btn.value > DEADZONE)) {
            nowPressed.add(i);
            if (!prevPressed.current.has(i)) {
              console.log(`[Gamepad] Button ${i} pressed (value: ${btn.value})`);
              onButtonRef.current(i);
            }
          }
        }
      }

      prevPressed.current = nowPressed;
      rafId = requestAnimationFrame(poll);
    }

    const initial = navigator.getGamepads();
    const count = initial.filter(Boolean).length;
    console.log(`[Gamepad] Init — ${count} gamepad(s) detected`);

    rafId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }, []); // stable effect — onButton accessed via ref
}
