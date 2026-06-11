import { BookingDetailsPage } from "@/components/dashboard/BookingDetailsPage";

interface BookingDetailsRouteProps {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function BookingDetailsRoute({
  params,
  searchParams,
}: BookingDetailsRouteProps) {
  const { bookingId } = await params;
  const { from } = await searchParams;

  const returnHref =
    from && ["available", "active", "completed"].includes(from)
      ? `/dashboard?tab=${from}`
      : "/dashboard";

  return (
    <div className="min-h-dvh bg-gray-50">
      <BookingDetailsPage bookingId={bookingId} returnHref={returnHref} />
    </div>
  );
}
