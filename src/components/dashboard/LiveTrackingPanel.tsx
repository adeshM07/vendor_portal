"use client";

import { useMemo } from "react";
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
import { LiveTrackingMap } from "./LiveTrackingMap";

interface LiveTrackingPanelProps {
  equipmentId: string;
  siteLat?: number | null;
  siteLng?: number | null;
  siteAddress?: string | null;
  onAutoArrived?: () => void;
}

export function LiveTrackingPanel({
  equipmentId,
  siteLat,
  siteLng,
  siteAddress,
  onAutoArrived,
}: LiveTrackingPanelProps) {
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
  } = useLiveLocationTracking({
    equipmentId,
    enabled: true,
    autoStart: true,
    onAutoArrived,
  });

  const distanceToSite = useMemo(() => {
    if (
      lastCoords == null ||
      siteLat == null ||
      siteLng == null
    ) {
      return null;
    }
    return distanceKm(lastCoords.lat, lastCoords.lng, siteLat, siteLng);
  }, [lastCoords, siteLat, siteLng]);

  const canSendSiteGps = siteLat != null && siteLng != null;

  return (
    <div className="space-y-3 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio
              className={`h-4 w-4 ${isSharing ? "text-emerald-600" : "text-gray-400"}`}
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              Live Location Sharing
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Your GPS is sent every {GPS_PUSH_INTERVAL_MS / 1000}s so the customer can
            track equipment on the map.
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
            isSharing
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isSharing ? "animate-pulse bg-emerald-500" : "bg-gray-400"
            }`}
          />
          {isSharing ? "Live" : "Paused"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard
          label="Last update"
          value={lastPushAt ? formatRelativeTime(lastPushAt) : "—"}
        />
        <StatCard
          label="Distance to site"
          value={
            distanceToSite != null ? formatDistanceKm(distanceToSite) : "—"
          }
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
        />
      )}

      {isSharing ? (
        <button
          type="button"
          onClick={stopSharing}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <PauseCircle className="h-4 w-4" />
          Pause Sharing
        </button>
      ) : (
        <button
          type="button"
          onClick={startSharing}
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

      {!lastCoords && isSharing && !error && (
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
