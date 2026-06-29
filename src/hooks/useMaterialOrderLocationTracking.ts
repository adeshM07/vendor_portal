"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import { updateMaterialOrderLocation } from "@/lib/material-vendor";

const MATERIAL_LOCATION_PUSH_INTERVAL_MS = 10_000;

export interface MaterialLocationCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface UseMaterialOrderLocationTrackingOptions {
  orderId: string;
  enabled: boolean;
  intervalMs?: number;
}

export function useMaterialOrderLocationTracking({
  orderId,
  enabled,
  intervalMs = MATERIAL_LOCATION_PUSH_INTERVAL_MS,
}: UseMaterialOrderLocationTrackingOptions) {
  const [isSharing, setIsSharing] = useState(false);
  const [lastCoords, setLastCoords] = useState<MaterialLocationCoords | null>(null);
  const [lastPushAt, setLastPushAt] = useState<Date | null>(null);
  const [pushCount, setPushCount] = useState(0);
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestCoordsRef = useRef<MaterialLocationCoords | null>(null);
  const isPushingRef = useRef(false);

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
    if (!orderId || !latestCoordsRef.current || isPushingRef.current) return;

    isPushingRef.current = true;
    setIsPushing(true);
    const { lat, lng, accuracy } = latestCoordsRef.current;

    try {
      await updateMaterialOrderLocation(orderId, lat, lng);
      setLastCoords({ lat, lng, accuracy });
      setLastPushAt(new Date());
      setPushCount((count) => count + 1);
      setError(null);
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
  }, [orderId]);

  const startSharing = useCallback(() => {
    if (!orderId || !enabled) return;

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    clearWatchAndInterval();
    setError(null);
    setIsSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords: MaterialLocationCoords = {
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
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    void pushLocation();
    intervalRef.current = setInterval(() => {
      void pushLocation();
    }, intervalMs);
  }, [clearWatchAndInterval, enabled, intervalMs, orderId, pushLocation]);

  useEffect(() => {
    if (!enabled || !orderId) {
      stopSharing();
      return;
    }

    startSharing();
    return () => {
      stopSharing();
    };
  }, [enabled, orderId, startSharing, stopSharing]);

  return {
    isSharing,
    lastCoords,
    lastPushAt,
    pushCount,
    isPushing,
    error,
    stopSharing,
  };
}
