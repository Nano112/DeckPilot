import React, { useRef, useCallback } from "react";

type Direction = "left" | "right" | "up" | "down";

interface UseGesturesOptions {
  onSwipe: (direction: Direction) => void;
  onPinchIn?: () => void;
  onPinchOut?: () => void;
  enabled?: boolean;
}

const MIN_SWIPE_DISTANCE = 50;
const MAX_SWIPE_TIME = 300;
const PINCH_IN_RATIO = 0.7;
const PINCH_OUT_RATIO = 1.4;

function getTwoFingerDistance(touches: React.TouchList): number {
  const t0 = touches[0];
  const t1 = touches[1];
  if (!t0 || !t1) return 0;
  const dx = t1.clientX - t0.clientX;
  const dy = t1.clientY - t0.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function useGestures({ onSwipe, onPinchIn, onPinchOut, enabled = true }: UseGesturesOptions) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartDist = useRef<number | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      if (e.touches.length === 2) {
        // Start pinch tracking
        pinchStartDist.current = getTwoFingerDistance(e.touches);
        touchStart.current = null; // Cancel any swipe
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;
        touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        pinchStartDist.current = null;
      }
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      if (e.touches.length === 2 && pinchStartDist.current !== null) {
        const currentDist = getTwoFingerDistance(e.touches);
        const ratio = currentDist / pinchStartDist.current;

        if (ratio < PINCH_IN_RATIO) {
          pinchStartDist.current = null;
          touchStart.current = null;
          onPinchIn?.();
        } else if (ratio > PINCH_OUT_RATIO) {
          pinchStartDist.current = null;
          touchStart.current = null;
          onPinchOut?.();
        }
      }
    },
    [enabled, onPinchIn, onPinchOut]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      // Reset pinch on finger lift
      if (e.touches.length < 2) {
        pinchStartDist.current = null;
      }

      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const dt = Date.now() - touchStart.current.time;
      touchStart.current = null;

      if (dt > MAX_SWIPE_TIME) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < MIN_SWIPE_DISTANCE && absDy < MIN_SWIPE_DISTANCE) return;

      // Determine dominant axis
      if (absDx >= absDy) {
        onSwipe(dx < 0 ? "left" : "right");
      } else {
        onSwipe(dy < 0 ? "up" : "down");
      }
    },
    [enabled, onSwipe]
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
