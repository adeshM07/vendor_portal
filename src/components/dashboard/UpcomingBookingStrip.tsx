import { ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { OrderDomain, PortalListItem } from "@/lib/portal-items";

interface UpcomingBookingStripProps {
  domain: OrderDomain;
  items: PortalListItem[];
  onViewDetails: (item: PortalListItem) => void;
}

export function UpcomingBookingStrip({
  domain,
  items,
  onViewDetails,
}: UpcomingBookingStripProps) {
  if (items.length === 0) return null;

  const heading =
    domain === "rental" ? "Upcoming Booking" : "Upcoming Material Orders";

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">{heading}</h2>
        <span className="text-xs text-gray-400">{items.length} pending</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <div
            key={`${item.kind}:${item.id}`}
            className="flex min-w-[260px] shrink-0 flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <p className="font-semibold text-gray-900">{item.title}</p>
            {item.subtitle && <p className="mt-1 text-xs text-gray-500">{item.subtitle}</p>}
            <p className="mt-2 text-sm font-bold text-gray-900">
              {formatCurrency(item.total_amount)}
            </p>
            <button
              type="button"
              onClick={() => onViewDetails(item)}
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
