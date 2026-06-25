"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Navigation,
  PauseCircle,
  PlayCircle,
  Radio,
} from "lucide-react";
import { formatDistanceKm, formatRelativeTime } from "@/lib/format";
import { GPS_PUSH_INTERVAL_MS, useLiveLocationTracking } from "@/hooks/useLiveLocationTracking";
import {
  estimateRouteStep,
  getDemoRouteDurationMinutes,
  useRouteSimulation,
} from "@/hooks/useRouteSimulation";
import { useVendorStartLocation } from "@/hooks/useVendorStartLocation";
import { fetchBookingTracking, isDummyLiveTrackingEnabled, bookingTrackingPhaseLabel, resolveBookingTrackingPhase, resolveDistanceToSiteKm, LIVE_TRACKING_POLL_INTERVAL_MS, type BookingTrackingPhase } from "@/lib/live-tracking";
import { isSimulatedRouteActive } from "@/lib/simulated-route-runner";
import {
  pickNewerTrackingSession,
  readVendorTrackingSession,
  writeVendorTrackingSession,
} from "@/lib/tracking-session-cache";
import { getVendorStartLocation } from "@/lib/vendor-start-locations";
import { fetchVendorMe } from "@/lib/vendor";
import { LiveTrackingMap } from "./LiveTrackingMap";

/** Matches backend auto-arrive radius (km). */
const SITE_ARRIVE_RADIUS_KM = 0.5;

interface LiveTrackingPanelProps {
  bookingId: string;
  equipmentId: string;
  siteLat?: number | null;
  siteLng?: number | null;
  siteAddress?: string | null;
  bookingStatus?: string | null;
  onAutoArrived?: () => void;
  onDistanceChange?: (distanceKm: number | null) => void;
  onPushCurrentReady?: (pushCurrent: () => Promise<void>) => void;
}

export function LiveTrackingPanel({
  bookingId,
  equipmentId,
  siteLat,
  siteLng,
  siteAddress,
  bookingStatus,
  onAutoArrived,
  onDistanceChange,
  onPushCurrentReady,
}: LiveTrackingPanelProps) {
  const simulateGps = isDummyLiveTrackingEnabled();
  const vendorStart = useVendorStartLocation();
  const initializedKeyRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<BookingTrackingPhase>("other");
  const isSimulatingRef = useRef(false);
  const onAutoArrivedRef = useRef(onAutoArrived);
  const [siteLocked, setSiteLocked] = useState(() => {
    const cached = readVendorTrackingSession(bookingId);
    return Boolean(cached?.arrivedAtSite);
  });
  const trackingPhase = resolveBookingTrackingPhase(bookingStatus);
  const pinToSite = trackingPhase === "arrived" || siteLocked;
  const siteTarget = useMemo(
    () =>
      siteLat != null && siteLng != null ? { lat: siteLat, lng: siteLng } : null,
    [siteLat, siteLng]
  );

  useEffect(() => {
    onAutoArrivedRef.current = onAutoArrived;
  }, [onAutoArrived]);

  const handleAutoArrived = useCallback(() => {
    if (isSimulatingRef.current) return;
    onAutoArrivedRef.current?.();
  }, []);

  const {
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
  } = useLiveLocationTracking({
    bookingId,
    equipmentId,
    enabled: true,
    autoStart: false,
    siteTarget,
    pinToSite,
    onAutoArrived: handleAutoArrived,
  });

  const handleRouteComplete = useCallback(async () => {
    if (siteLat == null || siteLng == null) return;
    setSiteLocked(true);
    writeVendorTrackingSession(bookingId, {
      ...(readVendorTrackingSession(bookingId) ?? {
        lat: siteLat,
        lng: siteLng,
        lastUpdatedAt: new Date().toISOString(),
        pushCount: 0,
      }),
      lat: siteLat,
      lng: siteLng,
      lastUpdatedAt: new Date().toISOString(),
      arrivedAtSite: true,
      lastDistanceToSiteM: 0,
      simulationActive: false,
    });
    await pushSiteLocation(siteLat, siteLng);
    onAutoArrivedRef.current?.();
  }, [bookingId, pushSiteLocation, siteLat, siteLng]);

  const {
    isSimulating,
    stepIndex,
    totalSteps,
    progressPercent,
    displayCoords,
    sessionPushCount,
    startSimulation,
    stopSimulation,
  } = useRouteSimulation(bookingId, equipmentId, handleRouteComplete);

  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  const demoRouteMinutes = getDemoRouteDurationMinutes();

  const lastCoordsRef = useRef<typeof lastCoords>(null);
  const pushCountRef = useRef(0);
  const stepIndexRef = useRef(0);

  const beginSimulatedRoute = useCallback(
    async (
      resumeFrom?: { lat: number; lng: number },
      simulationStep?: number
    ) => {
      const profile = await fetchVendorMe();
      const start = getVendorStartLocation(profile.vendor_id, profile.user_id);

      if (siteLat != null && siteLng != null) {
        const route = {
          startLat: start.lat,
          startLng: start.lng,
          endLat: siteLat,
          endLng: siteLng,
        };
        const fromStep =
          simulationStep != null
            ? simulationStep
            : resumeFrom != null
              ? estimateRouteStep(route, resumeFrom.lat, resumeFrom.lng)
              : undefined;
        startSimulation(route, fromStep != null ? { fromStep } : undefined);
        return;
      }

      if (resumeFrom) {
        hydrateCoords(resumeFrom.lat, resumeFrom.lng);
        return;
      }

      await pushSiteLocation(start.lat, start.lng);
    },
    [hydrateCoords, pushSiteLocation, siteLat, siteLng, startSimulation]
  );

  useEffect(() => {
    if (!displayCoords || !isSimulating) return;
    hydrateCoords(displayCoords.lat, displayCoords.lng);
  }, [displayCoords, hydrateCoords, isSimulating]);

  const displayedPushCount = isSimulating ? sessionPushCount : pushCount;
  pushCountRef.current = pushCount;
  stepIndexRef.current = stepIndex;

  useEffect(() => {
    if (!bookingId || !lastCoords || !isSimulating || siteLocked) return;
    const existing = readVendorTrackingSession(bookingId);
    if (existing?.arrivedAtSite) return;
    writeVendorTrackingSession(bookingId, {
      lat: lastCoords.lat,
      lng: lastCoords.lng,
      lastUpdatedAt: new Date().toISOString(),
      pushCount,
      simulationStep: stepIndex,
    });
  }, [bookingId, isSimulating, lastCoords, pushCount, siteLocked, stepIndex]);

  useEffect(() => {
    const initKey = `${bookingId}:${equipmentId}`;
    if (initializedKeyRef.current === initKey) return;

    const cached = readVendorTrackingSession(bookingId);
    const resumeSimulationOnLoad =
      simulateGps &&
      cached?.simulationStep != null &&
      cached.simulationStep > 0;
    if (cached && (!simulateGps || resumeSimulationOnLoad)) {
      hydrateCoords(
        cached.lat,
        cached.lng,
        cached.lastUpdatedAt,
        cached.pushCount
      );
    }

    let cancelled = false;

    void (async () => {
      let apiSession: {
        lat: number;
        lng: number;
        lastUpdatedAt: string;
        pushCount: number;
      } | null = null;

      try {
        const tracking = await fetchBookingTracking(bookingId);
        apiSession = {
          lat: tracking.latitude,
          lng: tracking.longitude,
          lastUpdatedAt: tracking.lastUpdatedAt,
          pushCount: cached?.pushCount ?? 0,
        };
      } catch {
        // Fall back to cached session when API is unavailable.
      }

      if (cancelled) return;
      initializedKeyRef.current = initKey;

      const resolved = pickNewerTrackingSession(apiSession, cached);

      if (simulateGps) {
        if (cached?.arrivedAtSite || trackingPhase === "arrived") {
          if (siteLat != null && siteLng != null) {
            setSiteLocked(true);
            hydrateCoords(siteLat, siteLng, cached?.lastUpdatedAt, cached?.pushCount);
          }
          return;
        }

        const shouldResumeSimulation =
          (cached?.simulationActive ||
            (cached?.simulationStep != null && cached.simulationStep > 0)) &&
          !cached?.arrivedAtSite;
        if (shouldResumeSimulation) {
          const resumeCoords = cached ?? resolved;
          if (resumeCoords) {
            hydrateCoords(
              resumeCoords.lat,
              resumeCoords.lng,
              resumeCoords.lastUpdatedAt,
              cached?.pushCount ?? resumeCoords.pushCount
            );
          }
          if (!isSimulatedRouteActive(bookingId) && siteLat != null && siteLng != null) {
            const profile = await fetchVendorMe();
            const start = getVendorStartLocation(profile.vendor_id, profile.user_id);
            const route = {
              startLat: start.lat,
              startLng: start.lng,
              endLat: siteLat,
              endLng: siteLng,
            };
            startSimulation(route, {
              simulatedElapsedMs: cached?.simulatedElapsedMs,
              fromStep: cached?.simulationStep,
            });
          }
        } else {
          await beginSimulatedRoute();
        }
        return;
      }

      /* Real GPS init — disabled during testing (use simulated route only).
      if (resolved) {
        hydrateCoords(
          resolved.lat,
          resolved.lng,
          resolved.lastUpdatedAt,
          cached?.pushCount ?? resolved.pushCount
        );
      }

      const hasPriorLocation = Boolean(resolved ?? cached);

      if (!hasPriorLocation) {
        const profile = await fetchVendorMe();
        const start = getVendorStartLocation(profile.vendor_id, profile.user_id);
        await pushSiteLocation(start.lat, start.lng);
      }

      if (!cancelled) {
        startSharing();
      }
      */
    })();

    return () => {
      cancelled = true;
      initializedKeyRef.current = null;
      const coords = lastCoordsRef.current;
      if (coords) {
        writeVendorTrackingSession(bookingId, {
          lat: coords.lat,
          lng: coords.lng,
          lastUpdatedAt: new Date().toISOString(),
          pushCount: pushCountRef.current,
          simulationStep: stepIndexRef.current,
          simulationActive: isSimulatingRef.current,
          equipmentId,
        });
      }
    };
  }, [
    beginSimulatedRoute,
    bookingId,
    equipmentId,
    hydrateCoords,
    pushSiteLocation,
    simulateGps,
    siteLat,
    siteLng,
    startSharing,
    startSimulation,
    stopSimulation,
    trackingPhase,
  ]);

  const isLive = isSharing || isSimulating;

  const mapCoords = useMemo(() => {
    if (pinToSite && siteTarget) return siteTarget;
    if (isSimulating && displayCoords != null) return displayCoords;
    return lastCoords;
  }, [displayCoords, isSimulating, lastCoords, pinToSite, siteTarget]);

  const distanceToSite = useMemo(() => {
    if (pinToSite) return 0;
    const coords = mapCoords;
    if (coords == null) return null;
    return resolveDistanceToSiteKm(coords.lat, coords.lng, siteLat, siteLng);
  }, [mapCoords, pinToSite, siteLat, siteLng]);

  const distanceDisplay = useMemo(() => {
    if (pinToSite) return "At site";
    if (trackingPhase !== "en_route" && trackingPhase !== "started") return "—";
    return distanceToSite != null ? formatDistanceKm(distanceToSite) : "—";
  }, [distanceToSite, pinToSite, trackingPhase]);

  const withinArriveRadius =
    distanceToSite != null && distanceToSite <= SITE_ARRIVE_RADIUS_KM;

  const handleSendSiteGps = useCallback(() => {
    if (siteLat == null || siteLng == null || siteLocked) return;
    setSiteLocked(true);
    void pushSiteLocation(siteLat, siteLng);
  }, [pushSiteLocation, siteLat, siteLng, siteLocked]);

  useEffect(() => {
    if (trackingPhase === "arrived" && !isSimulating) {
      setSiteLocked(true);
    }
  }, [isSimulating, trackingPhase]);

  useEffect(() => {
    if (
      isSimulating ||
      trackingPhase !== "arrived" ||
      prevPhaseRef.current === "arrived" ||
      siteLat == null ||
      siteLng == null
    ) {
      prevPhaseRef.current = trackingPhase;
      return;
    }
    void pushSiteLocation(siteLat, siteLng);
    prevPhaseRef.current = trackingPhase;
  }, [isSimulating, pushSiteLocation, siteLat, siteLng, trackingPhase]);

  const pushCurrentLocation = useCallback(async () => {
    const coords = lastCoordsRef.current;
    if (coords) {
      await pushSiteLocation(coords.lat, coords.lng);
    }
  }, [pushSiteLocation]);

  const onDistanceChangeRef = useRef(onDistanceChange);
  const onPushCurrentReadyRef = useRef(onPushCurrentReady);

  useEffect(() => {
    onDistanceChangeRef.current = onDistanceChange;
  }, [onDistanceChange]);

  useEffect(() => {
    onPushCurrentReadyRef.current = onPushCurrentReady;
  }, [onPushCurrentReady]);

  useEffect(() => {
    onDistanceChangeRef.current?.(distanceToSite);
  }, [distanceToSite]);

  useEffect(() => {
    onPushCurrentReadyRef.current?.(pushCurrentLocation);
  }, [pushCurrentLocation]);

  const canSendSiteGps = siteLat != null && siteLng != null;

  const handlePause = () => {
    stopSharing();
    stopSimulation();
  };

  const handleResume = () => {
    if (simulateGps) {
      void beginSimulatedRoute(lastCoords ?? undefined);
      return;
    }
    // Real GPS disabled during testing:
    // startSharing();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio
              className={`h-4 w-4 ${isLive ? "text-emerald-600" : "text-gray-400"}`}
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              Live Location Sharing
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {bookingTrackingPhaseLabel(trackingPhase)} ·{" "}
            {simulateGps
              ? `Simulated ~${demoRouteMinutes} min route to site, GPS push every ${GPS_PUSH_INTERVAL_MS / 1000}s.`
              : `GPS sent every ${GPS_PUSH_INTERVAL_MS / 1000}s for customer tracking.`}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
            isLive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isLive ? "animate-pulse bg-emerald-500" : "bg-gray-400"
            }`}
          />
          {isLive ? "Live" : "Paused"}
        </span>
      </div>

      {simulateGps && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Demo mode — simulated route to site over ~{demoRouteMinutes} minutes (
          {totalSteps || "…"} GPS pushes every {GPS_PUSH_INTERVAL_MS / 1000}s). Distance
          drops each push; customer app polls every{" "}
          {LIVE_TRACKING_POLL_INTERVAL_MS / 1000}s.
        </p>
      )}

      {/* Real GPS UI — disabled during testing
      {!simulateGps && process.env.NODE_ENV === "development" && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Real GPS mode — coordinates only move if the device moves. For desk demos set{" "}
          <code className="font-mono">NEXT_PUBLIC_LIVE_TRACKING_MODE=dummy</code> in{" "}
          <code className="font-mono">.env.local</code> and restart the dev server.
        </p>
      )}
      */}

      {isSimulating && totalSteps > 0 && (
        <p className="text-xs text-blue-700">
          Route progress: {stepIndex}/{totalSteps} ({progressPercent}%)
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard
          label="Last update"
          value={lastPushAt ? formatRelativeTime(lastPushAt) : "—"}
        />
        <StatCard
          label="Distance to site"
          value={distanceDisplay}
        />
        <StatCard label="Updates sent" value={String(displayedPushCount)} />
      </div>

      {mapCoords && (
        <p className="font-mono text-[11px] text-gray-500">
          {mapCoords.lat.toFixed(8)}, {mapCoords.lng.toFixed(8)}
          {lastCoords?.accuracy != null
            ? ` · ±${Math.round(lastCoords.accuracy)}m`
            : ""}
        </p>
      )}

      {mapCoords && (
        <LiveTrackingMap
          equipmentLat={mapCoords.lat}
          equipmentLng={mapCoords.lng}
          siteLat={siteLat}
          siteLng={siteLng}
          address={siteAddress}
          originLat={vendorStart?.lat}
          originLng={vendorStart?.lng}
          originLabel={vendorStart?.location}
          bookingStatus={bookingStatus}
        />
      )}

      {isLive ? (
        <button
          type="button"
          onClick={handlePause}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <PauseCircle className="h-4 w-4" />
          Pause Sharing
        </button>
      ) : (
        <button
          type="button"
          onClick={handleResume}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          <PlayCircle className="h-4 w-4" />
          Resume Sharing
        </button>
      )}

      {canSendSiteGps && !siteLocked && (
        <button
          type="button"
          disabled={isPushing || !withinArriveRadius}
          onClick={handleSendSiteGps}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPushing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          Send Site GPS (within 500 m)
        </button>
      )}

      {canSendSiteGps && !siteLocked && !withinArriveRadius && (
        <p className="text-center text-xs text-amber-800">
          Move within 500 m of the booked site, then send site GPS to lock arrival.
        </p>
      )}

      {/* Real GPS waiting state — disabled during testing
      {!lastCoords && isLive && !error && !simulateGps && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-blue-700">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          Waiting for GPS signal… Allow location access when prompted.
        </div>
      )}
      */}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/90 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
