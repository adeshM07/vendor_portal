"use client";

import { AlertCircle, ExternalLink, Loader2, Navigation, Radio } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useLiveTracking } from "@/hooks/useLiveTracking";
import { buildMapViewUrl } from "@/lib/live-tracking";
import { formatDateTime } from "@/lib/format";

interface LiveTrackingCardProps {
  bookingId: string;
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

function LiveTrackingMap({
  latitude,
  longitude,
  address,
}: {
  latitude: number;
  longitude: number;
  address: string | null;
}) {
  const delta = 0.008;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  const mapViewUrl = buildMapViewUrl(latitude, longitude);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
      <iframe
        key={`${latitude}-${longitude}`}
        title={address ? `Live tracking: ${address}` : "Live tracking map"}
        src={embedUrl}
        className="h-44 w-full border-0 sm:h-52"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        href={mapViewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-md transition hover:bg-gray-50"
      >
        <ExternalLink className="h-3.5 w-3.5 text-amber-500" />
        View on Map
      </a>
      <div className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <p className="text-[11px] font-medium text-emerald-700">Live position updating</p>
      </div>
    </div>
  );
}

function trackingStatusLabel(status: string): string {
  if (status === "live") return "Live";
  if (status === "paused") return "Paused";
  return "Offline";
}

export function LiveTrackingCard({ bookingId }: LiveTrackingCardProps) {
  const { tracking, isLoading, error, isUsingDummyData } = useLiveTracking(bookingId, {
    enabled: true,
  });

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

  const mapViewUrl = buildMapViewUrl(tracking.latitude, tracking.longitude);

  return (
    <Card>
      <CardHeader
        title="Live Tracking"
        description="Real-time equipment location on this booking"
        icon={<Navigation className="h-4 w-4" strokeWidth={1.5} />}
        action={
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            <Radio className="h-3 w-3" />
            {trackingStatusLabel(tracking.status)}
          </span>
        }
      />
      <div className="space-y-4 px-5 pb-5">
        {isUsingDummyData && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Demo mode — simulated GPS. Set{" "}
            <code className="font-mono">NEXT_PUBLIC_LIVE_TRACKING_MODE=api</code> to use
            the backend.
          </p>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <LiveTrackingMap
          latitude={tracking.latitude}
          longitude={tracking.longitude}
          address={tracking.address}
        />

        <div>
          <DetailRow
            label="Tracking Status"
            value={trackingStatusLabel(tracking.status)}
          />
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
          {tracking.address && (
            <DetailRow label="Current Location Address" value={tracking.address} />
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
