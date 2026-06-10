import { ChevronRight } from "lucide-react";
import {
  formatCurrency,
  formatDurationDays,
  formatShortDateRange,
} from "@/lib/format";
import type { VendorBookingListItem } from "@/lib/vendor";

interface UpcomingBookingStripProps {
  bookings: VendorBookingListItem[];
  onSelect: (booking: VendorBookingListItem) => void;
}

export function UpcomingBookingStrip({ bookings, onSelect }: UpcomingBookingStripProps) {
  if (bookings.length === 0) return null;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Upcoming Booking</h2>
        <span className="text-xs text-gray-400">{bookings.length} pending</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {bookings.map((booking) => (
          <button
            key={booking.id}
            type="button"
            onClick={() => onSelect(booking)}
            className="min-w-[260px] shrink-0 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-amber-200"
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
            <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
              View details
              <ChevronRight className="h-3.5 w-3.5" />
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
