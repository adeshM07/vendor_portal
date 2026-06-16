"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import { distanceKm } from "@/lib/format";
import {
  writeVendorTrackingSession,
} from "@/lib/tracking-session-cache";
import { updateEquipmentLocation } from "@/lib/vendor";

import { GPS_PUSH_INTERVAL_MS as DEMO_GPS_PUSH_INTERVAL_MS } from "@/lib/demo-route";

function parseGpsPushIntervalMs(): number {
  return DEMO_GPS_PUSH_INTERVAL_MS;
}

export const GPS_PUSH_INTERVAL_MS = parseGpsPushIntervalMs();

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
  /** When true, pushes booked site coords instead of drifting GPS (after arrival). */
  pinToSite?: boolean;
  onAutoArrived?: () => void;
}

export function useLiveLocationTracking({
  bookingId,
  equipmentId,
  enabled,
  intervalMs = GPS_PUSH_INTERVAL_MS,
  autoStart = true,
  siteTarget = null,
  pinToSite = false,
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
  const pinToSiteRef = useRef(pinToSite);
  const isPushingRef = useRef(false);
  const onAutoArrivedRef = useRef(onAutoArrived);
  const pushCountRef = useRef(0);

  const siteLatKey = siteTarget?.lat ?? null;
  const siteLngKey = siteTarget?.lng ?? null;

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
    if (siteLatKey != null && siteLngKey != null) {
      siteTargetRef.current = { lat: siteLatKey, lng: siteLngKey };
    } else {
      siteTargetRef.current = null;
    }
  }, [siteLatKey, siteLngKey]);

  useEffect(() => {
    pinToSiteRef.current = pinToSite;
    if (!pinToSite || siteLatKey == null || siteLngKey == null) return;

    const coords: LiveLocationCoords = { lat: siteLatKey, lng: siteLngKey };
    latestCoordsRef.current = coords;
    lastPushedCoordsRef.current = coords;
    setLastCoords((prev) =>
      prev?.lat === coords.lat && prev?.lng === coords.lng ? prev : coords
    );
  }, [pinToSite, siteLatKey, siteLngKey]);

  useEffect(() => {
    onAutoArrivedRef.current = onAutoArrived;
  }, [onAutoArrived]);

  const commitCoords = useCallback(
    (
      lat: number,
      lng: number,
      accuracy: number | undefined,
      countIncrement: boolean
    ) => {
      const coords: LiveLocationCoords = { lat, lng, accuracy };
      latestCoordsRef.current = coords;
      lastPushedCoordsRef.current = coords;
      setLastCoords(coords);
      setLastPushAt(new Date());
      if (countIncrement) {
        setPushCount((count) => {
          const next = count + 1;
          pushCountRef.current = next;
          persistSession(lat, lng, new Date().toISOString(), next);
          return next;
        });
      }
    },
    [persistSession]
  );

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
    const site = siteTargetRef.current;
    const lastPushed = lastPushedCoordsRef.current;
    const useSitePin = pinToSiteRef.current && site != null;

    let pushLat = gpsCoords.lat;
    let pushLng = gpsCoords.lng;

    if (useSitePin) {
      pushLat = site.lat;
      pushLng = site.lng;
    } else if (site && lastPushed) {
      const prevDist = distanceKm(
        lastPushed.lat,
        lastPushed.lng,
        site.lat,
        site.lng
      );
      const nextDist = distanceKm(pushLat, pushLng, site.lat, site.lng);
      if (nextDist > prevDist) {
        isPushingRef.current = false;
        setIsPushing(false);
        return;
      }
    }

    try {
      const distanceToSiteM =
        site != null
          ? Math.round(distanceKm(pushLat, pushLng, site.lat, site.lng) * 1000)
          : undefined;
      const result = await updateEquipmentLocation(equipmentId, pushLat, pushLng, {
        distanceToSiteM,
      });
      let resultLat = result.lat;
      let resultLng = result.lng;
      if ((result.auto_arrived || useSitePin) && site) {
        resultLat = site.lat;
        resultLng = site.lng;
      }
      commitCoords(resultLat, resultLng, gpsCoords.accuracy, true);
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
  }, [commitCoords, equipmentId]);

  const startSharing = useCallback(() => {
    if (!equipmentId || !enabled) return;

    // TESTING: real device GPS disabled — simulated route uses pushSiteLocation instead.
    setError("Real GPS is disabled during testing. Use the simulated route.");
    return;

    /*
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
    */
  }, [clearWatchAndInterval, enabled, equipmentId, intervalMs, pushLocation]);

  const pushSiteLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!equipmentId) return;

      setIsPushing(true);
      try {
        const site = siteTargetRef.current;
        const distanceToSiteM =
          site != null
            ? Math.round(distanceKm(lat, lng, site.lat, site.lng) * 1000)
            : undefined;
        const result = await updateEquipmentLocation(equipmentId, lat, lng, {
          distanceToSiteM,
        });
        const atBookedSite =
          site != null &&
          Math.abs(lat - site.lat) < 1e-7 &&
          Math.abs(lng - site.lng) < 1e-7;
        const snapToSite = site != null && (result.auto_arrived || atBookedSite);
        commitCoords(
          snapToSite ? site.lat : lat,
          snapToSite ? site.lng : lng,
          undefined,
          true
        );
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
    [commitCoords, equipmentId]
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
