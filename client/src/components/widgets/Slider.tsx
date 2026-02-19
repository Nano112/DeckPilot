import { useCallback, useRef, useState } from "react";
import type { WidgetConfig } from "shared";

interface SliderProps {
  widget: WidgetConfig;
  onSliderChange: (widgetId: string, value: number) => void;
}

const THROTTLE_MS = 100;

export function Slider({ widget, onSliderChange }: SliderProps) {
  const min = widget.min ?? 0;
  const max = widget.max ?? 100;
  const step = widget.step ?? 1;
  const [value, setValue] = useState(Math.round((min + max) / 2));
  const lastSent = useRef(0);
  const color = widget.color ?? "var(--accent)";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setValue(v);

      const now = Date.now();
      if (now - lastSent.current >= THROTTLE_MS) {
        lastSent.current = now;
        onSliderChange(widget.id, v);
      }
    },
    [widget.id, onSliderChange]
  );

  const handlePointerUp = useCallback(() => {
    // Always send final value on release
    onSliderChange(widget.id, value);
  }, [widget.id, value, onSliderChange]);

  const pct = ((value - min) / (max - min)) * 100;

  const stopSwipe = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl px-4"
      style={{
        backgroundColor: widget.color ? `${widget.color}20` : "var(--bg-button)",
      }}
      onTouchStart={stopSwipe}
      onTouchEnd={stopSwipe}
      onTouchMove={stopSwipe}
    >
      <span className="text-xs font-medium text-[var(--text-secondary)]">
        {widget.label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        onPointerUp={handlePointerUp}
        className="slider-input w-full"
        style={
          {
            "--slider-color": color,
            "--slider-pct": `${pct}%`,
          } as React.CSSProperties
        }
      />
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}
