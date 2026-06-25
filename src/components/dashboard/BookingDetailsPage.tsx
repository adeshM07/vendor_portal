"use client";

import { SessionGate } from "@/components/SessionGate";
import { BookingDetailsView } from "./BookingDetailsView";

interface BookingDetailsPageProps {
  bookingId: string;
  returnHref: string;
  previewLiveTracking?: boolean;
}

export function BookingDetailsPage({
  bookingId,
  returnHref,
  previewLiveTracking = false,
}: BookingDetailsPageProps) {
  return (
    <SessionGate>
      <BookingDetailsView
        bookingId={bookingId}
        returnHref={returnHref}
        previewLiveTracking={previewLiveTracking}
      />
    </SessionGate>
  );
}
