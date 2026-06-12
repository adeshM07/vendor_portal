"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
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
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/");
    }
  }, [router]);

  if (!isAuthenticated()) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
      </div>
    );
  }

  return (
    <BookingDetailsView
      bookingId={bookingId}
      returnHref={returnHref}
      previewLiveTracking={previewLiveTracking}
    />
  );
}
