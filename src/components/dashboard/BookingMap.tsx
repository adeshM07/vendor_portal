"use client";

import { MapPin, Navigation } from "lucide-react";
import { useVendorStartLocation } from "@/hooks/useVendorStartLocation";
import { buildDirectionsUrl } from "@/lib/live-tracking";

interface BookingMapProps {
  lat: number;
  lng: number;
  address?: string | null;
  className?: string;
}

export function BookingMap({ lat, lng, address, className = "" }: BookingMapProps) {
  const vendorStart = useVendorStartLocation();
  const delta = 0.012;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
  const directionsUrl =
    vendorStart != null
      ? buildDirectionsUrl({
          originLat: vendorStart.lat,
          originLng: vendorStart.lng,
          originLabel: vendorStart.location,
          destinationLat: lat,
          destinationLng: lng,
          destinationLabel: address,
        })
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm ${className}`}>
      <iframe
        title={address ? `Map: ${address}` : "Booking site map"}
        src={embedUrl}
        className="h-48 w-full border-0 sm:h-56"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-md transition hover:bg-gray-50"
      >
        <Navigation className="h-3.5 w-3.5 text-amber-500" />
        Get Direction
      </a>
      {vendorStart && (
        <div className="absolute left-3 top-3 max-w-[70%] rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium text-gray-700 shadow-md">
          From: {vendorStart.location}
        </div>
      )}
      {address && (
        <div className="flex items-start gap-2 border-t border-gray-200 bg-white px-3 py-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.5} />
          <p className="text-xs leading-relaxed text-gray-600">{address}</p>
        </div>
      )}
    </div>
  );
}
