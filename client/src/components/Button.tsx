import { useCallback, useRef } from "react";
import { animate } from "animejs";
import type { WidgetConfig } from "shared";
import { renderIcon } from "../lib/icons";

interface ButtonProps {
  widget: WidgetConfig;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

const LONG_PRESS_MS = 500;

export function Button({ widget, onPress, onLongPress }: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isLongPress = useRef(false);

  const animateDown = useCallback(() => {
    if (!ref.current) return;
    animate(ref.current, {
      scale: 0.92,
      duration: 100,
      ease: "outQuad",
    });
  }, []);

  const animateUp = useCallback(() => {
    if (!ref.current) return;
    animate(ref.current, {
      scale: 1,
      duration: 400,
      ease: "outElastic(1, 0.5)",
    });
  }, []);

  const handlePointerDown = useCallback(() => {
    isLongPress.current = false;
    animateDown();

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(widget.id);
    }, LONG_PRESS_MS);
  }, [widget.id, animateDown, onLongPress]);

  const handlePointerUp = useCallback(() => {
    clearTimeout(longPressTimer.current);
    animateUp();

    if (!isLongPress.current) {
      onPress(widget.id);
    }
  }, [widget.id, animateUp, onPress]);

  const handlePointerLeave = useCallback(() => {
    clearTimeout(longPressTimer.current);
    animateUp();
  }, [animateUp]);

  return (
    <button
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-0 cursor-pointer transition-colors"
      style={{
        backgroundColor: widget.color ? `${widget.color}20` : "var(--bg-button)",
        borderLeft: widget.color ? `3px solid ${widget.color}` : "3px solid transparent",
      }}
    >
      {widget.icon && (
        <span className="text-[var(--text-primary)]">
          {renderIcon(widget.icon, widget.label ? 20 : 28)}
        </span>
      )}
      {widget.label && (
        <span className="text-lg font-semibold text-[var(--text-primary)]">
          {widget.label}
        </span>
      )}
    </button>
  );
}
