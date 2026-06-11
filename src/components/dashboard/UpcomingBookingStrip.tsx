import { ChevronRight } from "lucide-react";
import {
  formatCurrency,
  formatDurationDays,
  formatShortDateRange,
} from "@/lib/format";
import type { VendorBookingListItem } from "@/lib/vendor";

interface UpcomingBookingStripProps {
  bookings: VendorBookingListItem[];
  onViewDetails: (bookingId: string) => void;
}

export function UpcomingBookingStrip({ bookings, onViewDetails }: UpcomingBookingStripProps) {
  if (bookings.length === 0) return null;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Upcoming Booking</h2>
        <span className="text-xs text-gray-400">{bookings.length} pending</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex min-w-[260px] shrink-0 flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <p className="font-semibold text-gray-900">{booking.sku_name ?? "Equipment"}</p>
            <p className="mt-1 text-xs text-gray-500">
              {formatShortDateRange(booking.scheduled_start, booking.scheduled_end)}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-600">
              {formatDurationDays(booking.scheduled_start, booking.scheduled_end)}
            </p>
            <p className="mt-2 text-sm font-bold text-gray-900">
              {formatCurrency(booking.total_amount)}
            </p>
            <button
              type="button"
              onClick={() => onViewDetails(booking.id)}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              View Details
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
