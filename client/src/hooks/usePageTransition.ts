import { useCallback, useRef } from "react";
import { animate } from "animejs";
import type { NavigationDirection } from "./usePageNavigation";

export function usePageTransition(onComplete: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const triggerTransition = useCallback(
    (direction: NavigationDirection) => {
      const el = containerRef.current;
      if (!el) {
        onComplete();
        return;
      }

      const w = el.offsetWidth;
      const h = el.offsetHeight;

      // Start position: page slides in from the direction of navigation
      // e.g. swipe left → new page enters from the right
      const startTransform: Record<NavigationDirection, string> = {
        left: `translateX(${w}px)`,
        right: `translateX(${-w}px)`,
        up: `translateY(${h}px)`,
        down: `translateY(${-h}px)`,
      };

      el.style.transform = startTransform[direction];

      animate(el, {
        transform: "translate(0, 0)",
        duration: 250,
        ease: "outCubic",
        onComplete: () => {
          onComplete();
        },
      });
    },
    [onComplete]
  );

  return { containerRef, triggerTransition };
}
