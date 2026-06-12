"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GPS_PUSH_INTERVAL_MS } from "@/hooks/useLiveLocationTracking";
import { distanceKm } from "@/lib/format";

const MIN_STEPS = 5;
const MAX_STEPS = 30;
const KM_PER_STEP = 0.5;

export interface RouteSimulationEndpoints {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

function computeStepCount(route: RouteSimulationEndpoints): number {
  const km = distanceKm(route.startLat, route.startLng, route.endLat, route.endLng);
  if (km < 0.05) return 2;
  return Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.ceil(km / KM_PER_STEP)));
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

export function useRouteSimulation(
  pushCoordinates: (lat: number, lng: number) => Promise<void>
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

  useEffect(() => {
    pushRef.current = pushCoordinates;
  }, [pushCoordinates]);

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

  const pushStep = useCallback(async (index: number) => {
    const route = routeRef.current;
    if (!route || totalStepsRef.current === 0 || isPushingRef.current) return;

    isPushingRef.current = true;
    const progress = index / totalStepsRef.current;
    const point = interpolatePoint(route, progress);

    try {
      await pushRef.current(point.lat, point.lng);
    } finally {
      isPushingRef.current = false;
    }
  }, []);

  const advanceStep = useCallback(async () => {
    const next = stepIndexRef.current + 1;
    if (next > totalStepsRef.current) {
      stopSimulation();
      return;
    }
    stepIndexRef.current = next;
    setStepIndex(next);
    await pushStep(next);
  }, [pushStep, stopSimulation]);

  const startSimulation = useCallback(
    (route: RouteSimulationEndpoints) => {
      clearSimulationInterval();
      const steps = computeStepCount(route);
      routeRef.current = route;
      totalStepsRef.current = steps;
      stepIndexRef.current = 0;
      setTotalSteps(steps);
      setStepIndex(0);
      setIsSimulating(true);

      void pushStep(0).then(() => {
        intervalRef.current = setInterval(() => {
          void advanceStep();
        }, GPS_PUSH_INTERVAL_MS);
      });
    },
    [advanceStep, clearSimulationInterval, pushStep]
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
