"use client";

import { Bell, Inbox, Loader2, Package, User } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { VendorNotifySubscription } from "@/lib/material-vendor-notify";
import { useMaterialVendorNotify } from "@/hooks/useMaterialVendorNotify";

function NotifyStatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "fulfilled") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        Fulfilled
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
      Pending
    </span>
  );
}

function formatCustomer(subscription: VendorNotifySubscription): string {
  if (subscription.customer_name && subscription.customer_phone) {
    return `${subscription.customer_name} · ${subscription.customer_phone}`;
  }
  return subscription.customer_name ?? subscription.customer_phone ?? "Customer";
}

export function MaterialNotifyRequestsView() {
  const {
    summary,
    subscriptions,
    isLoading,
    isLoadingSummary,
    isLoadingList,
    summaryError,
    listError,
    reload,
  } = useMaterialVendorNotify({ loadSubscriptions: true });

  const pendingSubscriptions = subscriptions.filter(
    (item) => item.status.toLowerCase() === "pending"
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Stock Alerts</h2>
          <p className="text-xs text-gray-500">
            Customers waiting to be notified when materials are back in stock
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={isLoading}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      {(summaryError || listError) && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {summaryError || listError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Bell className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <p className="text-[11px] font-medium text-gray-500">Pending alerts</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900">
            {isLoadingSummary ? "—" : summary.pending_count}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Package className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <p className="text-[11px] font-medium text-gray-500">Products with demand</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900">
            {isLoadingSummary ? "—" : summary.by_product.length}
          </p>
        </div>
      </div>

      {summary.by_product.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Pending by product</h3>
          <div className="mt-3 divide-y divide-gray-50">
            {summary.by_product.map((item) => (
              <div
                key={item.product_id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <p className="truncate text-sm text-gray-800">{item.product_name}</p>
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800">
                  {item.pending_count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoadingList ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </div>
      ) : pendingSubscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
            <Inbox className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-gray-700">No pending stock alerts</p>
          <p className="mt-1 max-w-sm text-xs text-gray-400">
            When customers request back-in-stock notifications, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Customer requests</h3>
          {pendingSubscriptions.map((subscription) => (
            <article
              key={subscription.subscription_id}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex items-start gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Bell className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {subscription.product_name}
                    </p>
                    <NotifyStatusPill status={subscription.status} />
                  </div>
                  {(subscription.brand_name || subscription.variant_label) && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {[subscription.brand_name, subscription.variant_label]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {formatCustomer(subscription)}
                    </span>
                    <span>{formatDateTime(subscription.subscribed_at)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
