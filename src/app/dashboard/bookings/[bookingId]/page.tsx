import { BookingDetailsPage } from "@/components/dashboard/BookingDetailsPage";

interface BookingDetailsRouteProps {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ from?: string; previewLiveTracking?: string }>;
}

export default async function BookingDetailsRoute({
  params,
  searchParams,
}: BookingDetailsRouteProps) {
  const { bookingId } = await params;
  const { from, previewLiveTracking } = await searchParams;
  const showLiveTrackingPreview = previewLiveTracking === "1";

  const returnHref =
    from && ["available", "active", "completed"].includes(from)
      ? `/dashboard?tab=${from}`
      : "/dashboard";

  return (
    <div className="min-h-dvh bg-gray-50">
      <BookingDetailsPage
        bookingId={bookingId}
        returnHref={returnHref}
        previewLiveTracking={showLiveTrackingPreview}
      />
    </div>
  );
}
