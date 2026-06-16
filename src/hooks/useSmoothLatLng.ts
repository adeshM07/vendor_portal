"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/route-interpolation";

const DEFAULT_DURATION_MS = 4500;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smoothly animates between GPS updates (e.g. customer poll every 5s) so the map
 * marker glides instead of jumping.
 */
export function useSmoothLatLng(
  target: LatLng | null,
  options?: { durationMs?: number; enabled?: boolean }
): LatLng | null {
  const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
  const enabled = options?.enabled ?? true;
  const [display, setDisplay] = useState<LatLng | null>(target);
  const displayRef = useRef<LatLng | null>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!enabled || target == null) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const from = displayRef.current ?? target;
    if (
      Math.abs(from.lat - target.lat) < 1e-8 &&
      Math.abs(from.lng - target.lng) < 1e-8
    ) {
      return;
    }

    const startMs = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startMs) / durationMs);
      const next: LatLng = {
        lat: lerp(from.lat, target.lat, t),
        lng: lerp(from.lng, target.lng, t),
      };
      displayRef.current = next;
      setDisplay(next);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [durationMs, enabled, target?.lat, target?.lng]);

  return display;
}
