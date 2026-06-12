"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import { updateEquipmentLocation } from "@/lib/vendor";

export const GPS_PUSH_INTERVAL_MS = 10000;

export interface LiveLocationCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface UseLiveLocationTrackingOptions {
  equipmentId: string | null;
  enabled: boolean;
  intervalMs?: number;
  autoStart?: boolean;
  onAutoArrived?: () => void;
}

export function useLiveLocationTracking({
  equipmentId,
  enabled,
  intervalMs = GPS_PUSH_INTERVAL_MS,
  autoStart = true,
  onAutoArrived,
}: UseLiveLocationTrackingOptions) {
  const [isSharing, setIsSharing] = useState(false);
  const [lastCoords, setLastCoords] = useState<LiveLocationCoords | null>(null);
  const [lastPushAt, setLastPushAt] = useState<Date | null>(null);
  const [pushCount, setPushCount] = useState(0);
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestCoordsRef = useRef<LiveLocationCoords | null>(null);
  const isPushingRef = useRef(false);
  const onAutoArrivedRef = useRef(onAutoArrived);

  useEffect(() => {
    onAutoArrivedRef.current = onAutoArrived;
  }, [onAutoArrived]);

  const clearWatchAndInterval = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopSharing = useCallback(() => {
    setIsSharing(false);
    clearWatchAndInterval();
  }, [clearWatchAndInterval]);

  const pushLocation = useCallback(async () => {
    if (!equipmentId || !latestCoordsRef.current || isPushingRef.current) return;

    isPushingRef.current = true;
    setIsPushing(true);
    const { lat, lng } = latestCoordsRef.current;

    try {
      const result = await updateEquipmentLocation(equipmentId, lat, lng);
      const coords: LiveLocationCoords = {
        lat: result.lat,
        lng: result.lng,
        accuracy: latestCoordsRef.current?.accuracy,
      };
      latestCoordsRef.current = coords;
      setLastCoords(coords);
      setLastPushAt(new Date());
      setPushCount((count) => count + 1);
      setError(null);
      if (result.auto_arrived) {
        onAutoArrivedRef.current?.();
      }
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to update location."
      );
    } finally {
      isPushingRef.current = false;
      setIsPushing(false);
    }
  }, [equipmentId]);

  const startSharing = useCallback(() => {
    if (!equipmentId || !enabled) return;

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    clearWatchAndInterval();
    setError(null);
    setIsSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords: LiveLocationCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        latestCoordsRef.current = coords;
        setLastCoords(coords);
      },
      (geoError) => {
        setError(geoError.message || "Location permission denied.");
        setIsSharing(false);
        clearWatchAndInterval();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    void pushLocation();
    intervalRef.current = setInterval(() => {
      void pushLocation();
    }, intervalMs);
  }, [clearWatchAndInterval, enabled, equipmentId, intervalMs, pushLocation]);

  const pushSiteLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!equipmentId) return;

      setIsPushing(true);
      try {
        const result = await updateEquipmentLocation(equipmentId, lat, lng);
        const coords: LiveLocationCoords = { lat: result.lat, lng: result.lng };
        latestCoordsRef.current = coords;
        setLastCoords(coords);
        setLastPushAt(new Date());
        setPushCount((count) => count + 1);
        setError(null);
        if (result.auto_arrived) {
          onAutoArrivedRef.current?.();
        }
      } catch (err) {
        setError(
          err instanceof ApiRequestError
            ? err.message
            : "Failed to update location."
        );
      } finally {
        setIsPushing(false);
      }
    },
    [equipmentId]
  );

  useEffect(() => {
    if (!enabled || !equipmentId) {
      stopSharing();
      return;
    }

    if (autoStart) {
      startSharing();
    }

    return () => {
      stopSharing();
    };
  }, [autoStart, enabled, equipmentId, startSharing, stopSharing]);

  return {
    isSharing,
    lastCoords,
    lastPushAt,
    pushCount,
    isPushing,
    error,
    startSharing,
    stopSharing,
    pushSiteLocation,
  };
}
