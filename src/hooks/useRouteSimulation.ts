"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GPS_PUSH_INTERVAL_MS } from "@/hooks/useLiveLocationTracking";
import { distanceKm } from "@/lib/format";

const MIN_DEMO_ROUTE_MINUTES = 5;
const MAX_DEMO_ROUTE_MINUTES = 10;
const DEFAULT_DEMO_ROUTE_MINUTES = 8;
const MIN_STEPS = 30;

/** Demo drive duration (5–10 min) for desk testing — visible on customer app map. */
export function getDemoRouteDurationMinutes(): number {
  const raw = process.env.NEXT_PUBLIC_DEMO_ROUTE_DURATION_MINUTES;
  if (raw != null) {
    const minutes = Number.parseFloat(raw);
    if (!Number.isNaN(minutes) && minutes > 0) {
      return Math.min(MAX_DEMO_ROUTE_MINUTES, Math.max(MIN_DEMO_ROUTE_MINUTES, minutes));
    }
  }
  return DEFAULT_DEMO_ROUTE_MINUTES;
}

function getDemoRouteDurationMs(): number {
  return getDemoRouteDurationMinutes() * 60 * 1000;
}

export interface RouteSimulationEndpoints {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

function computeStepCount(route: RouteSimulationEndpoints): number {
  const km = distanceKm(route.startLat, route.startLng, route.endLat, route.endLng);
  if (km < 0.001) return 2;
  const steps = Math.round(getDemoRouteDurationMs() / GPS_PUSH_INTERVAL_MS);
  return Math.max(MIN_STEPS, steps);
}

export function estimateRouteStep(
  route: RouteSimulationEndpoints,
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

function interpolatePoint(
  route: RouteSimulationEndpoints,
  progress: number
): { lat: number; lng: number } {
  const t = Math.min(1, Math.max(0, progress));
  return {
    lat: route.startLat + (route.endLat - route.startLat) * t,
    lng: route.startLng + (route.endLng - route.startLng) * t,
  };
}

/** Advance one simulation step from current position toward the site. */
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
  return interpolatePoint(route, Math.min(1, 1 / steps));
}

export function useRouteSimulation(
  pushCoordinates: (lat: number, lng: number) => Promise<void>,
  onRouteComplete?: () => void | Promise<void>
) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const stepIndexRef = useRef(0);
  const totalStepsRef = useRef(0);
  const routeRef = useRef<RouteSimulationEndpoints | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPushingRef = useRef(false);
  const pushRef = useRef(pushCoordinates);
  const onRouteCompleteRef = useRef(onRouteComplete);

  useEffect(() => {
    pushRef.current = pushCoordinates;
  }, [pushCoordinates]);

  useEffect(() => {
    onRouteCompleteRef.current = onRouteComplete;
  }, [onRouteComplete]);

  const clearSimulationInterval = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopSimulation = useCallback(() => {
    clearSimulationInterval();
    setIsSimulating(false);
    routeRef.current = null;
  }, [clearSimulationInterval]);

  const completeRoute = useCallback(async () => {
    clearSimulationInterval();
    try {
      await onRouteCompleteRef.current?.();
    } finally {
      setIsSimulating(false);
      routeRef.current = null;
    }
  }, [clearSimulationInterval]);

  const pushStep = useCallback(async (index: number) => {
    const route = routeRef.current;
    if (!route || totalStepsRef.current === 0 || isPushingRef.current) return;

    isPushingRef.current = true;
    const isFinalStep = index >= totalStepsRef.current;
    const point = isFinalStep
      ? { lat: route.endLat, lng: route.endLng }
      : interpolatePoint(route, index / totalStepsRef.current);

    try {
      await pushRef.current(point.lat, point.lng);
    } finally {
      isPushingRef.current = false;
    }
  }, []);

  const advanceStep = useCallback(async () => {
    const next = stepIndexRef.current + 1;
    if (next > totalStepsRef.current) {
      clearSimulationInterval();
      return;
    }
    stepIndexRef.current = next;
    setStepIndex(next);
    await pushStep(next);
    if (next >= totalStepsRef.current) {
      await completeRoute();
    }
  }, [clearSimulationInterval, completeRoute, pushStep]);

  const startSimulation = useCallback(
    (route: RouteSimulationEndpoints, options?: { fromStep?: number }) => {
      clearSimulationInterval();
      const steps = computeStepCount(route);
      const fromStep = Math.min(steps, Math.max(0, options?.fromStep ?? 0));
      routeRef.current = route;
      totalStepsRef.current = steps;
      stepIndexRef.current = fromStep;
      setTotalSteps(steps);
      setStepIndex(fromStep);
      setIsSimulating(true);

      void pushStep(fromStep).then(async () => {
        if (fromStep >= steps) {
          await completeRoute();
          return;
        }
        intervalRef.current = setInterval(() => {
          void advanceStep();
        }, GPS_PUSH_INTERVAL_MS);
      });
    },
    [advanceStep, clearSimulationInterval, completeRoute, pushStep]
  );

  useEffect(() => () => clearSimulationInterval(), [clearSimulationInterval]);

  const progressPercent =
    totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;

  return {
    isSimulating,
    stepIndex,
    totalSteps,
    progressPercent,
    startSimulation,
    stopSimulation,
  };
}
