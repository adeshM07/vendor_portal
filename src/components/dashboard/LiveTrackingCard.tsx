"use client";

import { AlertCircle, Loader2, Navigation, Radio } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { LiveTrackingMap } from "./LiveTrackingMap";
import { useLiveTracking } from "@/hooks/useLiveTracking";
import { useSmoothLatLng } from "@/hooks/useSmoothLatLng";
import { useVendorStartLocation } from "@/hooks/useVendorStartLocation";
import {
  bookingTrackingPhaseLabel,
  buildDirectionsUrl,
  buildMapViewUrl,
  LIVE_TRACKING_POLL_INTERVAL_MS,
  normalizeBookingStatusKey,
  resolveBookingTrackingPhase,
  resolveDistanceToSiteKm,
} from "@/lib/live-tracking";
import { formatDateTime, formatDistanceKm, formatStatusLabel } from "@/lib/format";

interface LiveTrackingCardProps {
  bookingId: string;
  bookingStatus?: string | null;
  siteLat?: number | null;
  siteLng?: number | null;
  siteAddress?: string | null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-50 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="font-mono text-sm font-medium text-gray-900 sm:max-w-[60%] sm:text-right">
        {value}
      </span>
    </div>
  );
}

function trackingStatusLabel(status: string): string {
  if (status === "live") return "Live";
  if (status === "paused") return "Paused";
  return "Offline";
}

function phaseBadgeClass(phase: ReturnType<typeof resolveBookingTrackingPhase>): string {
  switch (phase) {
    case "en_route":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "arrived":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "started":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "ended":
      return "border-gray-200 bg-gray-100 text-gray-600";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

export function LiveTrackingCard({
  bookingId,
  bookingStatus,
  siteLat,
  siteLng,
  siteAddress,
}: LiveTrackingCardProps) {
  const vendorStart = useVendorStartLocation();
  const resolvedStatus = bookingStatus ?? null;
  const phase = resolveBookingTrackingPhase(resolvedStatus);
  const isEnded = phase === "ended";

  const { tracking, isLoading, error, isUsingDummyData } = useLiveTracking(bookingId, {
    enabled: true,
    poll: !isEnded,
  });

  const smoothPosition = useSmoothLatLng(
    tracking
      ? { lat: tracking.latitude, lng: tracking.longitude }
      : null,
    {
      enabled: !isEnded && phase === "en_route",
      durationMs: LIVE_TRACKING_POLL_INTERVAL_MS - 500,
    }
  );

  if (!tracking && isLoading) {
    return (
      <Card>
        <CardHeader
          title="Live Tracking"
          description="Loading equipment location…"
          icon={<Navigation className="h-4 w-4" strokeWidth={1.5} />}
        />
        <div className="flex items-center justify-center gap-2 px-5 pb-8 pt-2">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
          <p className="text-sm text-gray-500">Connecting to tracking…</p>
        </div>
      </Card>
    );
  }

  if (!tracking) return null;

  const effectiveBookingStatus =
    tracking.bookingStatus ?? resolvedStatus ?? null;
  const effectivePhase = resolveBookingTrackingPhase(effectiveBookingStatus);
  const mapSiteLat = tracking.siteLat ?? siteLat ?? null;
  const mapSiteLng = tracking.siteLng ?? siteLng ?? null;

  const mapCoords = smoothPosition ?? {
    lat: tracking.latitude,
    lng: tracking.longitude,
  };

  const distanceToSite = resolveDistanceToSiteKm(
    mapCoords.lat,
    mapCoords.lng,
    mapSiteLat,
    mapSiteLng
  );

  const mapViewUrl =
    vendorStart != null
      ? buildDirectionsUrl({
          originLat: vendorStart.lat,
          originLng: vendorStart.lng,
          originLabel: vendorStart.location,
          destinationLat: mapCoords.lat,
          destinationLng: mapCoords.lng,
          destinationLabel: tracking.address,
        })
      : buildMapViewUrl(mapCoords.lat, mapCoords.lng);

  return (
    <Card>
      <CardHeader
        title="Live Tracking"
        description={bookingTrackingPhaseLabel(effectivePhase)}
        icon={<Navigation className="h-4 w-4" strokeWidth={1.5} />}
        action={
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${phaseBadgeClass(effectivePhase)}`}
          >
            {effectivePhase === "ended" ? null : <Radio className="h-3 w-3" />}
            {effectiveBookingStatus
              ? formatStatusLabel(normalizeBookingStatusKey(effectiveBookingStatus))
              : trackingStatusLabel(tracking.status)}
          </span>
        }
      />
      <div className="space-y-4 px-5 pb-5">
        {isUsingDummyData && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Simulated route — position from backend tracking API (same as customer app).
          </p>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <LiveTrackingMap
          equipmentLat={mapCoords.lat}
          equipmentLng={mapCoords.lng}
          siteLat={mapSiteLat}
          siteLng={mapSiteLng}
          address={tracking.address ?? siteAddress}
          originLat={vendorStart?.lat}
          originLng={vendorStart?.lng}
          originLabel={vendorStart?.location}
          bookingStatus={effectiveBookingStatus}
        />

        <div>
          {effectiveBookingStatus && (
            <DetailRow
              label="Booking Status"
              value={formatStatusLabel(normalizeBookingStatusKey(effectiveBookingStatus))}
            />
          )}
          <DetailRow
            label="Tracking Status"
            value={trackingStatusLabel(tracking.status)}
          />
          {distanceToSite != null && effectivePhase === "en_route" && (
            <DetailRow
              label="Distance to Site"
              value={formatDistanceKm(distanceToSite)}
            />
          )}
          <DetailRow
            label="Current Latitude"
            value={tracking.latitude.toFixed(6)}
          />
          <DetailRow
            label="Current Longitude"
            value={tracking.longitude.toFixed(6)}
          />
          <DetailRow
            label="Last Updated Time"
            value={formatDateTime(tracking.lastUpdatedAt)}
          />
          {(tracking.address ?? siteAddress) && (
            <DetailRow
              label="Current Location Address"
              value={tracking.address ?? siteAddress ?? "—"}
            />
          )}
        </div>

        <a
          href={mapViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          <Navigation className="h-4 w-4" />
          View on Map
        </a>
      </div>
    </Card>
  );
}
