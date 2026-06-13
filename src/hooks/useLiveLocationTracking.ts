"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import { distanceKm } from "@/lib/format";
import { nextPointTowardSite } from "@/hooks/useRouteSimulation";
import {
  writeVendorTrackingSession,
} from "@/lib/tracking-session-cache";
import { updateEquipmentLocation } from "@/lib/vendor";

export const GPS_PUSH_INTERVAL_MS = 10000;

export interface LiveLocationCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface UseLiveLocationTrackingOptions {
  bookingId?: string | null;
  equipmentId: string | null;
  enabled: boolean;
  intervalMs?: number;
  autoStart?: boolean;
  siteTarget?: { lat: number; lng: number } | null;
  onAutoArrived?: () => void;
}

const STATIONARY_THRESHOLD_KM = 0.02;

export function useLiveLocationTracking({
  bookingId,
  equipmentId,
  enabled,
  intervalMs = GPS_PUSH_INTERVAL_MS,
  autoStart = true,
  siteTarget = null,
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
  const lastPushedCoordsRef = useRef<LiveLocationCoords | null>(null);
  const siteTargetRef = useRef(siteTarget);
  const isPushingRef = useRef(false);
  const onAutoArrivedRef = useRef(onAutoArrived);
  const pushCountRef = useRef(0);

  useEffect(() => {
    pushCountRef.current = pushCount;
  }, [pushCount]);

  const persistSession = useCallback(
    (lat: number, lng: number, lastUpdatedAt: string, count: number) => {
      if (!bookingId) return;
      writeVendorTrackingSession(bookingId, {
        lat,
        lng,
        lastUpdatedAt,
        pushCount: count,
      });
    },
    [bookingId]
  );

  useEffect(() => {
    siteTargetRef.current = siteTarget;
  }, [siteTarget]);

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
    const gpsCoords = latestCoordsRef.current;
    let pushLat = gpsCoords.lat;
    let pushLng = gpsCoords.lng;

    const site = siteTargetRef.current;
    const lastPushed = lastPushedCoordsRef.current;
    if (site) {
      const reference = lastPushed ?? gpsCoords;
      const movedKm = distanceKm(reference.lat, reference.lng, gpsCoords.lat, gpsCoords.lng);
      if (movedKm < STATIONARY_THRESHOLD_KM) {
        const next = nextPointTowardSite(reference.lat, reference.lng, site.lat, site.lng);
        pushLat = next.lat;
        pushLng = next.lng;
      }
    }

    try {
      const result = await updateEquipmentLocation(equipmentId, pushLat, pushLng);
      const coords: LiveLocationCoords = {
        lat: result.lat,
        lng: result.lng,
        accuracy: gpsCoords.accuracy,
      };
      latestCoordsRef.current = coords;
      lastPushedCoordsRef.current = coords;
      setLastCoords(coords);
      setLastPushAt(new Date());
      setPushCount((count) => {
        const next = count + 1;
        pushCountRef.current = next;
        persistSession(result.lat, result.lng, new Date().toISOString(), next);
        return next;
      });
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
  }, [equipmentId, persistSession]);

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
        latestCoordsRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
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
        lastPushedCoordsRef.current = coords;
        setLastCoords(coords);
        setLastPushAt(new Date());
        setPushCount((count) => {
          const next = count + 1;
          pushCountRef.current = next;
          persistSession(result.lat, result.lng, new Date().toISOString(), next);
          return next;
        });
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
    [equipmentId, persistSession]
  );

  const hydrateCoords = useCallback(
    (lat: number, lng: number, lastUpdatedAt?: string, restoredPushCount?: number) => {
      const coords: LiveLocationCoords = { lat, lng };
      latestCoordsRef.current = coords;
      lastPushedCoordsRef.current = coords;
      setLastCoords(coords);
      const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : new Date();
      setLastPushAt(updatedAt);
      if (restoredPushCount != null) {
        pushCountRef.current = restoredPushCount;
        setPushCount(restoredPushCount);
      }
      setError(null);
    },
    []
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
    hydrateCoords,
  };
}
