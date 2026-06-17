"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/route-interpolation";
import {
  getSimulatedRoutePosition,
  isSimulatedRouteActive,
  subscribeSimulatedRoute,
} from "@/lib/simulated-route-runner";

/** Smooth live position while a simulated route is active (shared with background runner). */
export function useSimulatedRouteDisplay(bookingId: string): LatLng | null {
  const [position, setPosition] = useState<LatLng | null>(() =>
    getSimulatedRoutePosition(bookingId)
  );

  useEffect(() => {
    if (!isSimulatedRouteActive(bookingId)) {
      setPosition(null);
      return;
    }

    return subscribeSimulatedRoute(bookingId, setPosition);
  }, [bookingId]);

  return position;
}
