"use client";

import { MapPin, Navigation } from "lucide-react";
import { useMemo } from "react";
import {
  bookingTrackingPhaseLabel,
  buildDirectionsUrl,
  resolveBookingTrackingPhase,
  type BookingTrackingPhase,
} from "@/lib/live-tracking";
import {
  computeMapBbox,
  projectLatLngToPercent,
} from "@/lib/route-interpolation";

interface LiveTrackingMapProps {
  equipmentLat: number;
  equipmentLng: number;
  siteLat?: number | null;
  siteLng?: number | null;
  address?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  originLabel?: string | null;
  bookingStatus?: string | null;
  className?: string;
}

function phaseBadgeStyles(phase: BookingTrackingPhase): {
  className: string;
  pulse: boolean;
} {
  switch (phase) {
    case "en_route":
      return {
        className: "bg-emerald-600 text-white",
        pulse: true,
      };
    case "arrived":
      return {
        className: "bg-cyan-600 text-white",
        pulse: true,
      };
    case "started":
      return {
        className: "bg-emerald-700 text-white",
        pulse: false,
      };
    case "ended":
      return {
        className: "bg-gray-600 text-white",
        pulse: false,
      };
    default:
      return {
        className: "bg-emerald-600 text-white",
        pulse: true,
      };
  }
}

export function LiveTrackingMap({
  equipmentLat,
  equipmentLng,
  siteLat,
  siteLng,
  address,
  originLat,
  originLng,
  originLabel,
  bookingStatus,
  className = "",
}: LiveTrackingMapProps) {
  const phase = resolveBookingTrackingPhase(bookingStatus);
  const badge = phaseBadgeStyles(phase);
  const showSitePin =
    siteLat != null &&
    siteLng != null &&
    (phase === "en_route" || phase === "arrived");

  const bbox = useMemo(() => {
    const points = [];
    if (siteLat != null && siteLng != null) {
      points.push({ lat: siteLat, lng: siteLng });
    }
    if (originLat != null && originLng != null) {
      points.push({ lat: originLat, lng: originLng });
    }
    if (points.length === 0) {
      points.push({ lat: equipmentLat, lng: equipmentLng });
    }
    return computeMapBbox(points);
  }, [originLat, originLng, siteLat, siteLng, equipmentLat, equipmentLng]);

  const equipmentPos = projectLatLngToPercent(equipmentLat, equipmentLng, bbox);
  const sitePos =
    siteLat != null && siteLng != null
      ? projectLatLngToPercent(siteLat, siteLng, bbox)
      : null;
  const originPos =
    originLat != null && originLng != null
      ? projectLatLngToPercent(originLat, originLng, bbox)
      : null;

  const routeLine = useMemo(() => {
    if (originPos && sitePos) {
      return `${originPos.x},${originPos.y} ${equipmentPos.x},${equipmentPos.y} ${sitePos.x},${sitePos.y}`;
    }
    if (sitePos) {
      return `${equipmentPos.x},${equipmentPos.y} ${sitePos.x},${sitePos.y}`;
    }
    return null;
  }, [equipmentPos, originPos, sitePos]);

  const traveledLine = useMemo(() => {
    if (!originPos) return null;
    return `${originPos.x},${originPos.y} ${equipmentPos.x},${equipmentPos.y}`;
  }, [equipmentPos, originPos]);

  const embedBbox = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(embedBbox)}&layer=mapnik`;

  const destinationLat = siteLat ?? equipmentLat;
  const destinationLng = siteLng ?? equipmentLng;
  const destinationLabel = siteLat != null && siteLng != null ? address : null;

  const directionsUrl =
    originLat != null && originLng != null
      ? buildDirectionsUrl({
          originLat,
          originLng,
          originLabel,
          destinationLat,
          destinationLng,
          destinationLabel,
        })
      : `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm ${className}`}
    >
      <iframe
        title="Live equipment location"
        src={embedUrl}
        className="h-48 w-full border-0 sm:h-56"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      <div className="pointer-events-none absolute inset-0">
        <svg
          className="h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {routeLine && (
            <polyline
              points={routeLine}
              fill="none"
              stroke="rgb(191 219 254)"
              strokeWidth="0.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {traveledLine && (
            <polyline
              points={traveledLine}
              fill="none"
              stroke="rgb(37 99 235)"
              strokeWidth="0.85"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {sitePos && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${sitePos.x}%`, top: `${sitePos.y}%` }}
          >
            <MapPin className="h-5 w-5 text-amber-500 drop-shadow" strokeWidth={2} />
          </div>
        )}

        {originPos && (
          <div
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gray-700 shadow"
            style={{ left: `${originPos.x}%`, top: `${originPos.y}%` }}
          />
        )}

        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${equipmentPos.x}%`, top: `${equipmentPos.y}%` }}
        >
          <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-emerald-400/40" />
          <span className="relative block h-4 w-4 rounded-full border-2 border-white bg-emerald-600 shadow-md" />
        </div>
      </div>

      <div
        className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase shadow-md ${badge.className}`}
      >
        {badge.pulse ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        ) : null}
        {bookingTrackingPhaseLabel(phase)}
      </div>
      {originLabel && (
        <div className="absolute left-3 top-10 max-w-[70%] rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium text-gray-700 shadow-md">
          From: {originLabel}
        </div>
      )}
      {showSitePin && (
        <div
          className={`absolute left-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-semibold uppercase text-white shadow-md ${originLabel ? "top-[4.25rem]" : "top-10"}`}
        >
          <MapPin className="h-3 w-3" />
          Booked site
        </div>
      )}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-md transition hover:bg-gray-50"
      >
        <Navigation className="h-3.5 w-3.5 text-amber-500" />
        Open in Maps
      </a>
      {address && (
        <div className="flex items-start gap-2 border-t border-gray-200 bg-white px-3 py-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.5} />
          <p className="text-xs leading-relaxed text-gray-600">{address}</p>
        </div>
      )}
    </div>
  );
}
