import { Truck, MapPin, Loader2, Inbox, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  formatCurrency,
  formatDurationDays,
  formatShortDateRange,
} from "@/lib/format";
import type { BookingTab, VendorBookingListItem } from "@/lib/vendor";

interface BookingsTableProps {
  tab: BookingTab;
  bookings: VendorBookingListItem[];
  isLoading: boolean;
  onSelect?: (booking: VendorBookingListItem) => void;
  onViewDetails: (bookingId: string) => void;
  onAccept?: (bookingId: string) => void;
  onReject?: (bookingId: string) => void;
  actionBookingId?: string | null;
}

const tabTitles: Record<BookingTab, { title: string; description: string }> = {
  available: {
    title: "Booking Orders",
    description: "Paid bookings waiting for your acceptance",
  },
  active: {
    title: "Active Jobs",
    description: "Bookings assigned to you — in progress",
  },
  completed: {
    title: "Completed Jobs",
    description: "Finished rental bookings",
  },
};

function EquipmentThumb({ name }: { name: string | null }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600">
      <Truck className="h-8 w-8" strokeWidth={1.25} />
      <span className="sr-only">{name ?? "Equipment"}</span>
    </div>
  );
}

export function BookingsTable({
  tab,
  bookings,
  isLoading,
  onSelect,
  onViewDetails,
  onAccept,
  onReject,
  actionBookingId,
}: BookingsTableProps) {
  const { title, description } = tabTitles[tab];

  return (
    <div className="w-full">
      <div className="mb-3">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
            <Inbox className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-gray-700">No bookings here</p>
          <p className="mt-1 max-w-sm text-xs text-gray-400">
            {tab === "available"
              ? "Paid bookings are sent to all vendors. When one vendor accepts, others stop seeing it. Auto-refreshes every 10 seconds."
              : tab === "active"
                ? "Accept a request to start tracking active jobs."
                : "Completed jobs will show up after you finish the rental."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const isActing = actionBookingId === booking.id;
            return (
              <article
                key={booking.id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                <div
                  className={`flex w-full gap-3 p-4 text-left ${onSelect ? "cursor-pointer transition hover:bg-gray-50/80" : ""}`}
                  onClick={onSelect ? () => onSelect(booking) : undefined}
                  onKeyDown={
                    onSelect
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") onSelect(booking);
                        }
                      : undefined
                  }
                  role={onSelect ? "button" : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                >
                  <EquipmentThumb name={booking.sku_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {booking.sku_name ?? "Equipment"}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {formatShortDateRange(booking.scheduled_start, booking.scheduled_end)} ·{" "}
                          {formatDurationDays(booking.scheduled_start, booking.scheduled_end)}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>
                    <p className="mt-2 text-lg font-bold text-gray-900">
                      {formatCurrency(booking.total_amount)}
                    </p>
                    <p className="text-[11px] font-medium text-emerald-600">Amount · Online Mode</p>
                    {booking.site_address && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={1.5} />
                        <span className="line-clamp-2">{booking.site_address}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onViewDetails(booking.id)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    View Details
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                {tab === "available" && onAccept && onReject && (
                  <div className="flex gap-2 border-t border-gray-100 p-3">
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => onReject(booking.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => onAccept(booking.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Accept
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
