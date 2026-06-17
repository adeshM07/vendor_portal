"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDemoRouteDurationMinutes, getDemoRouteDurationMs, GPS_PUSH_INTERVAL_MS } from "@/lib/demo-route";
import { distanceKm } from "@/lib/format";
import {
  interpolateRoutePoint,
  type RouteEndpoints,
} from "@/lib/route-interpolation";
import {
  isSimulatedRouteActive,
  setSimulatedRouteCompleteHandler,
  startSimulatedRoute,
  stopSimulatedRoute,
  subscribeSimulatedRoute,
} from "@/lib/simulated-route-runner";
import { readVendorTrackingSession } from "@/lib/tracking-session-cache";

export { getDemoRouteDurationMinutes, GPS_PUSH_INTERVAL_MS };
export type { RouteEndpoints };

function computeStepCount(route: RouteEndpoints): number {
  const km = distanceKm(route.startLat, route.startLng, route.endLat, route.endLng);
  if (km < 0.001) return 2;
  const steps = Math.round(getDemoRouteDurationMs() / GPS_PUSH_INTERVAL_MS);
  return Math.max(30, steps);
}

export function estimateRouteStep(
  route: RouteEndpoints,
  lat: number,
  lng: number
): number {
  const steps = computeStepCount(route);
  const dLat = route.endLat - route.startLat;
  const dLng = route.endLng - route.startLng;
  const len2 = dLat * dLat + dLng * dLng;
  if (len2 === 0) return 0;
  const t = Math.min(
    1,
    Math.max(0, ((lat - route.startLat) * dLat + (lng - route.startLng) * dLng) / len2)
  );
  return Math.round(t * steps);
}

export function nextPointTowardSite(
  fromLat: number,
  fromLng: number,
  siteLat: number,
  siteLng: number
): { lat: number; lng: number } {
  const route = {
    startLat: fromLat,
    startLng: fromLng,
    endLat: siteLat,
    endLng: siteLng,
  };
  const steps = computeStepCount(route);
  if (steps <= 0) return { lat: fromLat, lng: fromLng };
  return interpolateRoutePoint(route, Math.min(1, 1 / steps));
}

export function useRouteSimulation(
  bookingId: string,
  equipmentId: string,
  onRouteComplete?: () => void | Promise<void>
) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [displayCoords, setDisplayCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [sessionPushCount, setSessionPushCount] = useState(0);
  const onRouteCompleteRef = useRef(onRouteComplete);

  useEffect(() => {
    onRouteCompleteRef.current = onRouteComplete;
  }, [onRouteComplete]);

  useEffect(() => {
    if (!bookingId) return;

    setSimulatedRouteCompleteHandler(bookingId, async () => {
      setIsSimulating(false);
      await onRouteCompleteRef.current?.();
    });

    if (isSimulatedRouteActive(bookingId)) {
      setIsSimulating(true);
    }

    const unsubscribe = subscribeSimulatedRoute(bookingId, (pos) => {
      setDisplayCoords(pos);
      setIsSimulating(isSimulatedRouteActive(bookingId));
      const session = readVendorTrackingSession(bookingId);
      if (session) {
        setSessionPushCount(session.pushCount);
        if (
          session.routeStartLat != null &&
          session.routeStartLng != null &&
          session.routeEndLat != null &&
          session.routeEndLng != null
        ) {
          const route = {
            startLat: session.routeStartLat,
            startLng: session.routeStartLng,
            endLat: session.routeEndLat,
            endLng: session.routeEndLng,
          };
          const steps = computeStepCount(route);
          setTotalSteps(steps);
          setStepIndex(estimateRouteStep(route, pos.lat, pos.lng));
        }
      }
    });

    return () => {
      setSimulatedRouteCompleteHandler(bookingId, null);
      unsubscribe();
    };
  }, [bookingId]);

  const startSimulation = useCallback(
    (
      route: RouteEndpoints,
      options?: { fromStep?: number; simulatedElapsedMs?: number }
    ) => {
      const steps = computeStepCount(route);
      const fromStep = Math.min(steps, Math.max(0, options?.fromStep ?? 0));
      const simulatedElapsedMs =
        options?.simulatedElapsedMs ??
        (steps > 0 ? (fromStep / steps) * getDemoRouteDurationMs() : 0);

      setTotalSteps(steps);
      setStepIndex(fromStep);
      setIsSimulating(true);

      startSimulatedRoute({
        bookingId,
        equipmentId,
        route,
        simulatedElapsedMs,
        onComplete: async () => {
          setIsSimulating(false);
          await onRouteCompleteRef.current?.();
        },
      });
    },
    [bookingId, equipmentId]
  );

  const stopSimulation = useCallback(() => {
    stopSimulatedRoute(bookingId);
    setIsSimulating(false);
  }, [bookingId]);

  const progressPercent =
    totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;

  return {
    isSimulating,
    stepIndex,
    totalSteps,
    progressPercent,
    displayCoords,
    sessionPushCount,
    startSimulation,
    stopSimulation,
  };
}
