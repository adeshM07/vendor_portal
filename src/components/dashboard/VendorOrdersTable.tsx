import { Boxes, Truck, MapPin, Loader2, Inbox, ChevronRight } from "lucide-react";
import { BookingStatusPill } from "./BookingStatusPill";
import { MaterialOrderStatusPill } from "@/components/materials/MaterialOrderStatusPill";
import { formatCurrency } from "@/lib/format";
import type { BookingTab } from "@/lib/vendor";
import { portalItemKey, type OrderDomain, type PortalListItem } from "@/lib/portal-items";

interface VendorOrdersTableProps {
  domain: OrderDomain;
  tab: BookingTab;
  items: PortalListItem[];
  isLoading: boolean;
  onViewDetails: (item: PortalListItem) => void;
  onAccept?: (item: PortalListItem) => void;
  onReject?: (item: PortalListItem) => void;
  actionItemKey?: string | null;
}

const rentalTabTitles: Record<BookingTab, { title: string; description: string }> = {
  available: {
    title: "Booking Orders",
    description: "Paid rental bookings waiting for your acceptance",
  },
  active: {
    title: "Active Jobs",
    description: "Equipment rentals assigned to you — in progress",
  },
  completed: {
    title: "Completed Jobs",
    description: "Finished rental bookings",
  },
};

const materialTabTitles: Record<BookingTab, { title: string; description: string }> = {
  available: {
    title: "New Material Orders",
    description: "Customer material orders in the competitive pool",
  },
  active: {
    title: "Active Material Orders",
    description: "Material orders you accepted — in fulfillment",
  },
  completed: {
    title: "Completed Material Orders",
    description: "Delivered or closed material orders",
  },
};

const rentalEmptyHints: Record<BookingTab, string> = {
  available: "New rental bookings from customers appear here when they are ready for vendor acceptance.",
  active: "Accepted rentals show here while equipment is on site or in progress.",
  completed: "Completed rentals appear here after the job is finished.",
};

const materialEmptyHints: Record<BookingTab, string> = {
  available:
    "New material orders appear here for all eligible suppliers. The first vendor to accept gets the job.",
  active: "Accepted material orders show here while you fulfill and deliver them.",
  completed: "Delivered or closed material orders appear here.",
};

function ItemThumb({ item }: { item: PortalListItem }) {
  const isMaterial = item.kind === "material";
  return (
    <div
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
        isMaterial
          ? "from-slate-100 to-slate-200 text-slate-600"
          : "from-amber-100 to-orange-100 text-amber-600"
      }`}
    >
      {isMaterial ? (
        <Boxes className="h-8 w-8" strokeWidth={1.25} />
      ) : (
        <Truck className="h-8 w-8" strokeWidth={1.25} />
      )}
    </div>
  );
}

export function VendorOrdersTable({
  domain,
  tab,
  items,
  isLoading,
  onViewDetails,
  onAccept,
  onReject,
  actionItemKey,
}: VendorOrdersTableProps) {
  const tabTitles = domain === "rental" ? rentalTabTitles : materialTabTitles;
  const emptyHints = domain === "rental" ? rentalEmptyHints : materialEmptyHints;
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
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
            <Inbox className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {domain === "rental" ? "No rental bookings here" : "No material orders here"}
          </p>
          <p className="mt-1 max-w-sm text-xs text-gray-400">{emptyHints[tab]}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const key = portalItemKey(item);
            const isActing = actionItemKey === key;
            return (
              <article
                key={key}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                <div className="flex w-full gap-3 p-4 text-left">
                  <ItemThumb item={item} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.title}</h3>
                        {item.subtitle && (
                          <p className="text-xs text-gray-500">{item.subtitle}</p>
                        )}
                        <p className="mt-0.5 font-mono text-[10px] text-gray-400">
                          {item.reference}
                        </p>
                      </div>
                      {item.kind === "material" ? (
                        <MaterialOrderStatusPill status={item.status} />
                      ) : (
                        <BookingStatusPill status={item.status} />
                      )}
                    </div>
                    <p className="mt-2 text-lg font-bold text-gray-900">
                      {formatCurrency(item.total_amount)}
                    </p>
                    {item.address && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
                        <MapPin
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                          strokeWidth={1.5}
                        />
                        <span className="line-clamp-2">{item.address}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onViewDetails(item)}
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
                      onClick={() => onReject(item)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => onAccept(item)}
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
