"use client";

import { MapPin, Navigation } from "lucide-react";
import { buildDirectionsUrl } from "@/lib/live-tracking";

interface LiveTrackingMapProps {
  equipmentLat: number;
  equipmentLng: number;
  siteLat?: number | null;
  siteLng?: number | null;
  address?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  originLabel?: string | null;
  className?: string;
}

function fitBbox(
  equipmentLat: number,
  equipmentLng: number,
  siteLat?: number | null,
  siteLng?: number | null,
  originLat?: number | null,
  originLng?: number | null
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const delta = 0.012;
  let minLat = equipmentLat - delta;
  let maxLat = equipmentLat + delta;
  let minLng = equipmentLng - delta;
  let maxLng = equipmentLng + delta;

  if (siteLat != null && siteLng != null) {
    minLat = Math.min(minLat, siteLat - delta);
    maxLat = Math.max(maxLat, siteLat + delta);
    minLng = Math.min(minLng, siteLng - delta);
    maxLng = Math.max(maxLng, siteLng + delta);
  }

  if (originLat != null && originLng != null) {
    minLat = Math.min(minLat, originLat - delta);
    maxLat = Math.max(maxLat, originLat + delta);
    minLng = Math.min(minLng, originLng - delta);
    maxLng = Math.max(maxLng, originLng + delta);
  }

  return { minLat, maxLat, minLng, maxLng };
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
  className = "",
}: LiveTrackingMapProps) {
  const { minLat, maxLat, minLng, maxLng } = fitBbox(
    equipmentLat,
    equipmentLng,
    siteLat,
    siteLng,
    originLat,
    originLng
  );
  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${equipmentLat}%2C${equipmentLng}`;

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
      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold uppercase text-white shadow-md">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        Equipment
      </div>
      {originLabel && (
        <div className="absolute left-3 top-10 max-w-[70%] rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium text-gray-700 shadow-md">
          From: {originLabel}
        </div>
      )}
      {siteLat != null && siteLng != null && (
        <div
          className={`absolute left-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-semibold uppercase text-white shadow-md ${originLabel ? "top-[4.25rem]" : "top-10"}`}
        >
          <MapPin className="h-3 w-3" />
          Site
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
