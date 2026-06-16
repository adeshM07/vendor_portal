"use client";

import { MapPin, Navigation } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { BookingMap } from "./BookingMap";
import { useVendorStartLocation } from "@/hooks/useVendorStartLocation";
import {
  bookingTrackingPhaseLabel,
  buildDirectionsUrl,
  normalizeBookingStatusKey,
  resolveBookingTrackingPhase,
} from "@/lib/live-tracking";
import { formatStatusLabel } from "@/lib/format";

interface LiveTrackingCardProps {
  bookingStatus?: string | null;
  siteLat?: number | null;
  siteLng?: number | null;
  siteAddress?: string | null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-50 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 sm:max-w-[60%] sm:text-right">
        {value}
      </span>
    </div>
  );
}

export function LiveTrackingCard({
  bookingStatus,
  siteLat,
  siteLng,
  siteAddress,
}: LiveTrackingCardProps) {
  const vendorStart = useVendorStartLocation();

  if (siteLat == null || siteLng == null) return null;

  const phase = resolveBookingTrackingPhase(bookingStatus);
  const directionsUrl =
    vendorStart != null
      ? buildDirectionsUrl({
          originLat: vendorStart.lat,
          originLng: vendorStart.lng,
          originLabel: vendorStart.location,
          destinationLat: siteLat,
          destinationLng: siteLng,
          destinationLabel: siteAddress,
        })
      : `https://www.google.com/maps/dir/?api=1&destination=${siteLat},${siteLng}`;

  return (
    <Card>
      <CardHeader
        title="Site Direction"
        description={bookingTrackingPhaseLabel(phase)}
        icon={<Navigation className="h-4 w-4" strokeWidth={1.5} />}
      />
      <div className="space-y-4 px-5 pb-5">
        <BookingMap lat={siteLat} lng={siteLng} address={siteAddress} />

        {bookingStatus && (
          <DetailRow
            label="Booking Status"
            value={formatStatusLabel(normalizeBookingStatusKey(bookingStatus))}
          />
        )}

        {siteAddress && (
          <div className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.5} />
            <p className="text-xs leading-relaxed text-gray-600">{siteAddress}</p>
          </div>
        )}

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          <Navigation className="h-4 w-4" />
          Open in Maps
        </a>
      </div>
    </Card>
  );
}
