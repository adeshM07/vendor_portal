"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Loader2,
  MapPin,
  Navigation,
  PauseCircle,
  PlayCircle,
  Radio,
} from "lucide-react";
import { distanceKm, formatDistanceKm, formatRelativeTime } from "@/lib/format";
import { GPS_PUSH_INTERVAL_MS, useLiveLocationTracking } from "@/hooks/useLiveLocationTracking";
import {
  estimateRouteStep,
  useRouteSimulation,
} from "@/hooks/useRouteSimulation";
import { useVendorStartLocation } from "@/hooks/useVendorStartLocation";
import { fetchBookingTracking, isDummyLiveTrackingEnabled } from "@/lib/live-tracking";
import {
  pickNewerTrackingSession,
  readVendorTrackingSession,
  writeVendorTrackingSession,
} from "@/lib/tracking-session-cache";
import { getVendorStartLocation } from "@/lib/vendor-start-locations";
import { fetchVendorMe } from "@/lib/vendor";
import { LiveTrackingMap } from "./LiveTrackingMap";

interface LiveTrackingPanelProps {
  bookingId: string;
  equipmentId: string;
  siteLat?: number | null;
  siteLng?: number | null;
  siteAddress?: string | null;
  onAutoArrived?: () => void;
}

export function LiveTrackingPanel({
  bookingId,
  equipmentId,
  siteLat,
  siteLng,
  siteAddress,
  onAutoArrived,
}: LiveTrackingPanelProps) {
  const simulateGps = isDummyLiveTrackingEnabled();
  const vendorStart = useVendorStartLocation();
  const initializedKeyRef = useRef<string | null>(null);

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
    siteTarget:
      siteLat != null && siteLng != null ? { lat: siteLat, lng: siteLng } : null,
    onAutoArrived,
  });

  const {
    isSimulating,
    stepIndex,
    totalSteps,
    progressPercent,
    startSimulation,
    stopSimulation,
  } = useRouteSimulation((lat, lng) => pushSiteLocation(lat, lng));

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

  lastCoordsRef.current = lastCoords;
  pushCountRef.current = pushCount;
  stepIndexRef.current = stepIndex;

  useEffect(() => {
    if (!bookingId || !lastCoords || !isSimulating) return;
    writeVendorTrackingSession(bookingId, {
      lat: lastCoords.lat,
      lng: lastCoords.lng,
      lastUpdatedAt: new Date().toISOString(),
      pushCount,
      simulationStep: stepIndex,
    });
  }, [bookingId, isSimulating, lastCoords, pushCount, stepIndex]);

  useEffect(() => {
    const initKey = `${bookingId}:${equipmentId}`;
    if (initializedKeyRef.current === initKey) return;

    const cached = readVendorTrackingSession(bookingId);
    if (cached) {
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
      if (resolved) {
        hydrateCoords(
          resolved.lat,
          resolved.lng,
          resolved.lastUpdatedAt,
          cached?.pushCount ?? resolved.pushCount
        );
      }

      const hasPriorLocation = Boolean(resolved ?? cached);

      if (simulateGps) {
        const resumeCoords = resolved ?? cached;
        await beginSimulatedRoute(
          resumeCoords
            ? { lat: resumeCoords.lat, lng: resumeCoords.lng }
            : undefined,
          cached?.simulationStep
        );
        return;
      }

      if (!hasPriorLocation) {
        const profile = await fetchVendorMe();
        const start = getVendorStartLocation(profile.vendor_id, profile.user_id);
        await pushSiteLocation(start.lat, start.lng);
      }

      if (!cancelled) {
        startSharing();
      }
    })();

    return () => {
      cancelled = true;
      initializedKeyRef.current = null;
      stopSimulation();
      const coords = lastCoordsRef.current;
      if (coords) {
        writeVendorTrackingSession(bookingId, {
          lat: coords.lat,
          lng: coords.lng,
          lastUpdatedAt: new Date().toISOString(),
          pushCount: pushCountRef.current,
          simulationStep: stepIndexRef.current,
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
    startSharing,
    stopSimulation,
  ]);

  const isLive = isSharing || isSimulating;

  const distanceToSite = useMemo(() => {
    if (lastCoords == null || siteLat == null || siteLng == null) {
      return null;
    }
    return distanceKm(lastCoords.lat, lastCoords.lng, siteLat, siteLng);
  }, [lastCoords, siteLat, siteLng]);

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
    startSharing();
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
            {simulateGps
              ? `Simulated route from your vendor start point to site, updating every ${GPS_PUSH_INTERVAL_MS / 1000}s.`
              : `Your GPS is sent every ${GPS_PUSH_INTERVAL_MS / 1000}s so the customer can track equipment on the map.`}
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
          Demo mode — each vendor starts at a fixed Bengaluru location, then moves toward
          the booking site. Set{" "}
          <code className="font-mono">NEXT_PUBLIC_LIVE_TRACKING_MODE=api</code> for real
          GPS.
        </p>
      )}

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
          value={distanceToSite != null ? formatDistanceKm(distanceToSite) : "—"}
        />
        <StatCard label="Updates sent" value={String(pushCount)} />
      </div>

      {lastCoords && (
        <p className="font-mono text-[11px] text-gray-500">
          {lastCoords.lat.toFixed(8)}, {lastCoords.lng.toFixed(8)}
          {lastCoords.accuracy != null
            ? ` · ±${Math.round(lastCoords.accuracy)}m`
            : ""}
        </p>
      )}

      {lastCoords && (
        <LiveTrackingMap
          equipmentLat={lastCoords.lat}
          equipmentLng={lastCoords.lng}
          siteLat={siteLat}
          siteLng={siteLng}
          address={siteAddress}
          originLat={vendorStart?.lat}
          originLng={vendorStart?.lng}
          originLabel={vendorStart?.location}
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

      {canSendSiteGps && (
        <button
          type="button"
          disabled={isPushing}
          onClick={() => void pushSiteLocation(siteLat, siteLng)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPushing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          Send Site GPS (auto-arrive test)
        </button>
      )}

      {!lastCoords && isLive && !error && !simulateGps && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-blue-700">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          Waiting for GPS signal… Allow location access when prompted.
        </div>
      )}

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
