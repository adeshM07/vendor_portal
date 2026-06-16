"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GPS_PUSH_INTERVAL_MS } from "@/hooks/useLiveLocationTracking";
import { distanceKm } from "@/lib/format";
import {
  interpolateRoutePoint,
  type RouteEndpoints,
} from "@/lib/route-interpolation";

const MIN_DEMO_ROUTE_MINUTES = 5;
const MAX_DEMO_ROUTE_MINUTES = 10;
const DEFAULT_DEMO_ROUTE_MINUTES = 8;
const MIN_STEPS = 30;
const DISPLAY_UPDATE_MS = 80;

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

export type { RouteEndpoints };

function computeStepCount(route: RouteEndpoints): number {
  const km = distanceKm(route.startLat, route.startLng, route.endLat, route.endLng);
  if (km < 0.001) return 2;
  const steps = Math.round(getDemoRouteDurationMs() / GPS_PUSH_INTERVAL_MS);
  return Math.max(MIN_STEPS, steps);
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
  return interpolateRoutePoint(route, Math.min(1, 1 / steps));
}

export function useRouteSimulation(
  pushCoordinates: (lat: number, lng: number) => Promise<void>,
  onRouteComplete?: () => void | Promise<void>
) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [displayCoords, setDisplayCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const stepIndexRef = useRef(0);
  const totalStepsRef = useRef(0);
  const routeRef = useRef<RouteEndpoints | null>(null);
  const journeyStartMsRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDisplayUpdateRef = useRef(0);
  const displayCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const isPushingRef = useRef(false);
  const completedRef = useRef(false);
  const pushRef = useRef(pushCoordinates);
  const onRouteCompleteRef = useRef(onRouteComplete);

  useEffect(() => {
    pushRef.current = pushCoordinates;
  }, [pushCoordinates]);

  useEffect(() => {
    onRouteCompleteRef.current = onRouteComplete;
  }, [onRouteComplete]);

  const clearTimers = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pushIntervalRef.current != null) {
      clearInterval(pushIntervalRef.current);
      pushIntervalRef.current = null;
    }
  }, []);

  const stopSimulation = useCallback(() => {
    clearTimers();
    setIsSimulating(false);
    routeRef.current = null;
    completedRef.current = false;
  }, [clearTimers]);

  const pushCurrentPosition = useCallback(async () => {
    const coords = displayCoordsRef.current;
    const route = routeRef.current;
    if (!coords || !route || isPushingRef.current || completedRef.current) return;

    isPushingRef.current = true;
    try {
      await pushRef.current(coords.lat, coords.lng);
    } finally {
      isPushingRef.current = false;
    }
  }, []);

  const completeRoute = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    clearTimers();

    const route = routeRef.current;
    if (route) {
      const final = { lat: route.endLat, lng: route.endLng };
      displayCoordsRef.current = final;
      setDisplayCoords(final);
      if (!isPushingRef.current) {
        isPushingRef.current = true;
        try {
          await pushRef.current(final.lat, final.lng);
        } finally {
          isPushingRef.current = false;
        }
      }
    }

    try {
      await onRouteCompleteRef.current?.();
    } finally {
      setIsSimulating(false);
      routeRef.current = null;
    }
  }, [clearTimers]);

  const updateProgressFromClock = useCallback(() => {
    const route = routeRef.current;
    if (!route || completedRef.current) return;

    const totalDurationMs = getDemoRouteDurationMs();
    const progress = Math.min(
      1,
      (Date.now() - journeyStartMsRef.current) / totalDurationMs
    );
    const point = interpolateRoutePoint(route, progress);
    displayCoordsRef.current = point;

    const steps = totalStepsRef.current;
    const nextStep = Math.round(progress * steps);
    if (nextStep !== stepIndexRef.current) {
      stepIndexRef.current = nextStep;
      setStepIndex(nextStep);
    }

    const now = performance.now();
    if (now - lastDisplayUpdateRef.current >= DISPLAY_UPDATE_MS) {
      lastDisplayUpdateRef.current = now;
      setDisplayCoords(point);
    }

    if (progress >= 1) {
      void completeRoute();
      return;
    }

    rafRef.current = requestAnimationFrame(updateProgressFromClock);
  }, [completeRoute]);

  const startSimulation = useCallback(
    (route: RouteEndpoints, options?: { fromStep?: number }) => {
      clearTimers();
      completedRef.current = false;

      const steps = computeStepCount(route);
      const fromStep = Math.min(steps, Math.max(0, options?.fromStep ?? 0));
      const totalDurationMs = getDemoRouteDurationMs();
      const initialProgress = steps > 0 ? fromStep / steps : 0;

      routeRef.current = route;
      totalStepsRef.current = steps;
      stepIndexRef.current = fromStep;
      journeyStartMsRef.current = Date.now() - initialProgress * totalDurationMs;

      const initialPoint = interpolateRoutePoint(route, initialProgress);
      displayCoordsRef.current = initialPoint;
      setDisplayCoords(initialPoint);
      setTotalSteps(steps);
      setStepIndex(fromStep);
      setIsSimulating(true);
      lastDisplayUpdateRef.current = 0;

      void pushCurrentPosition();

      pushIntervalRef.current = setInterval(() => {
        void pushCurrentPosition();
      }, GPS_PUSH_INTERVAL_MS);

      rafRef.current = requestAnimationFrame(updateProgressFromClock);
    },
    [clearTimers, pushCurrentPosition, updateProgressFromClock]
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  const progressPercent =
    totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;

  return {
    isSimulating,
    stepIndex,
    totalSteps,
    progressPercent,
    displayCoords,
    startSimulation,
    stopSimulation,
  };
}
