import { Boxes, ChevronRight, Inbox, Loader2, MapPin } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { MaterialOrderListItem, MaterialOrderTab } from "@/lib/material-vendor";
import { MaterialOrderStatusPill } from "./MaterialOrderStatusPill";

interface MaterialOrdersTableProps {
  tab: MaterialOrderTab;
  orders: MaterialOrderListItem[];
  isLoading: boolean;
  onViewDetails: (orderId: string) => void;
  onAccept?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  actionOrderId?: string | null;
}

const tabTitles: Record<MaterialOrderTab, { title: string; description: string }> = {
  available: {
    title: "New Material Orders",
    description: "Open pool — all suppliers see these; first accept wins",
  },
  active: {
    title: "Active Material Orders",
    description: "Orders you accepted — in fulfillment or delivery",
  },
  completed: {
    title: "Completed Material Orders",
    description: "Delivered or closed material orders",
  },
};

function OrderThumb() {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
      <Boxes className="h-8 w-8" strokeWidth={1.25} />
    </div>
  );
}

export function MaterialOrdersTable({
  tab,
  orders,
  isLoading,
  onViewDetails,
  onAccept,
  onReject,
  actionOrderId,
}: MaterialOrdersTableProps) {
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
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
            <Inbox className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-gray-700">No material orders here</p>
          <p className="mt-1 max-w-sm text-xs text-gray-400">
            {tab === "available"
              ? "New customer material orders appear here for all suppliers. First vendor to accept wins."
              : tab === "active"
                ? "Orders in fulfillment or delivery will show up here."
                : "Completed material orders will appear after delivery."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isActing = actionOrderId === order.id;
            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onViewDetails(order.id)}
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-amber-50/40"
                >
                  <OrderThumb />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs text-gray-400">{order.order_number}</p>
                      <MaterialOrderStatusPill status={order.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                      {order.items?.[0]?.product_name ?? order.customer_name ?? "Customer"}
                    </p>
                    {order.items?.[0] && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {[order.items[0].brand_name, order.items[0].qty_display ?? order.items[0].quantity]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {order.delivery_address && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{order.delivery_address}</span>
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>
                        {order.item_count} item{order.item_count === 1 ? "" : "s"}
                      </span>
                      <span>{formatCurrency(order.total_amount)}</span>
                      {order.created_at && <span>{formatDateTime(order.created_at)}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
                </button>

                {tab === "available" && onAccept && onReject && (
                  <div className="flex gap-2 border-t border-gray-100 p-3">
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => onReject(order.id)}
                      className="flex flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                    >
                      {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => onAccept(order.id)}
                      className="flex flex-1 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
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
