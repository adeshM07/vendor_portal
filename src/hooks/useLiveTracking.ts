"use client";

import { useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import {
  fetchBookingTracking,
  isDummyLiveTrackingEnabled,
  LIVE_TRACKING_POLL_INTERVAL_MS,
  type LiveTrackingState,
} from "@/lib/live-tracking";

interface UseLiveTrackingOptions {
  enabled: boolean;
  /** When false, loads tracking once without polling (e.g. ended bookings). */
  poll?: boolean;
}

export interface UseLiveTrackingResult {
  tracking: LiveTrackingState | null;
  isLoading: boolean;
  error: string | null;
  isUsingDummyData: boolean;
}

/**
 * Polls GET /rentals/bookings/{bookingId}/tracking every 1 second (testing).
 * Simulated vendor pushes still land on this same API (single source of truth).
 */
export function useLiveTracking(
  bookingId: string,
  { enabled, poll = true }: UseLiveTrackingOptions
): UseLiveTrackingResult {
  const [tracking, setTracking] = useState<LiveTrackingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSimulatedRoute = isDummyLiveTrackingEnabled();

  useEffect(() => {
    if (!enabled) {
      setTracking(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadTracking = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true);

      try {
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
    const intervalId = poll
      ? window.setInterval(() => {
          void loadTracking(false);
        }, LIVE_TRACKING_POLL_INTERVAL_MS)
      : null;

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [bookingId, enabled, poll]);

  return {
    tracking,
    isLoading,
    error,
    isUsingDummyData: isSimulatedRoute,
  };
}
