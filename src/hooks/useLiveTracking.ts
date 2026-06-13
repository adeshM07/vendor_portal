"use client";

import { useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import {
  buildDummyTrackingState,
  DUMMY_TRACKING_ROUTE,
  fetchBookingTracking,
  isDummyLiveTrackingEnabled,
  LIVE_TRACKING_POLL_INTERVAL_MS,
  type LiveTrackingState,
} from "@/lib/live-tracking";

interface UseLiveTrackingOptions {
  enabled: boolean;
}

export interface UseLiveTrackingResult {
  tracking: LiveTrackingState | null;
  isLoading: boolean;
  error: string | null;
  isUsingDummyData: boolean;
}

/**
 * Polls GET /rentals/bookings/{bookingId}/tracking every 5 seconds.
 * Set NEXT_PUBLIC_LIVE_TRACKING_MODE=dummy to use simulated coordinates.
 */
export function useLiveTracking(
  bookingId: string,
  { enabled }: UseLiveTrackingOptions
): UseLiveTrackingResult {
  const [tracking, setTracking] = useState<LiveTrackingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const useDummy = isDummyLiveTrackingEnabled();

  useEffect(() => {
    if (!enabled) {
      setTracking(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let routeIndex = 0;
    if (useDummy && typeof window !== "undefined") {
      const storageKey = `l2b_dummy_tracking_${bookingId}`;
      const stored = sessionStorage.getItem(storageKey);
      routeIndex = stored ? Number.parseInt(stored, 10) || 0 : 0;
    }
    let cancelled = false;

    const loadTracking = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true);

      try {
        if (useDummy) {
          const next = buildDummyTrackingState(routeIndex);
          routeIndex = (routeIndex + 1) % DUMMY_TRACKING_ROUTE.length;
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`l2b_dummy_tracking_${bookingId}`, String(routeIndex));
          }
          if (!cancelled) {
            setTracking(next);
            setError(null);
          }
          return;
        }

        const next = await fetchBookingTracking(bookingId);
        if (!cancelled) {
          setTracking(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : "Unable to load live tracking."
          );
        }
      } finally {
        if (!cancelled && showLoading) {
          setIsLoading(false);
        }
      }
    };

    void loadTracking(true);
    const intervalId = window.setInterval(() => {
      void loadTracking(false);
    }, LIVE_TRACKING_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [bookingId, enabled, useDummy]);

  return {
    tracking,
    isLoading,
    error,
    isUsingDummyData: useDummy,
  };
}
