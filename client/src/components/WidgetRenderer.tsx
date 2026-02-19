import type { WidgetConfig } from "shared";
import { Button } from "./Button";
import { Slider } from "./widgets/Slider";
import { SoundboardWidget } from "./widgets/SoundboardWidget";
import { getLiveWidget } from "./widgets/liveWidgetRegistry";

interface WidgetRendererProps {
  widget: WidgetConfig;
  liveData: Record<string, unknown>;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  onSliderChange: (widgetId: string, value: number) => void;
}

export function WidgetRenderer({
  widget,
  liveData,
  onPress,
  onLongPress,
  onSliderChange,
}: WidgetRendererProps) {
  switch (widget.type) {
    case "button":
      return (
        <Button
          widget={widget}
          onPress={onPress}
          onLongPress={onLongPress}
        />
      );
    case "slider":
      return (
        <Slider
          widget={widget}
          onSliderChange={onSliderChange}
        />
      );
    case "now_playing": {
      const source = widget.dataSource ?? "now_playing";
      const variant = widget.variant ?? "default";
      const Component = getLiveWidget(source, variant);
      if (!Component) {
        return (
          <div
            className="flex h-full w-full items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--bg-button)" }}
          >
            <span className="text-xs text-[var(--text-secondary)]">
              No widget for: {source}
            </span>
          </div>
        );
      }
      return <Component widget={widget} data={liveData[source]} onPress={onPress} onSliderChange={onSliderChange} />;
    }
    case "soundboard": {
      const source = widget.dataSource ?? "soundboard";
      return (
        <SoundboardWidget
          widget={widget}
          data={liveData[source]}
          onPress={onPress}
        />
      );
    }
    case "spacer":
      return <div className="rounded-xl bg-[var(--bg-button)] opacity-10" />;
    default:
      return null;
  }
}
