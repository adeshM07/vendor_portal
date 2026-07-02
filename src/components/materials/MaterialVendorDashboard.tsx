"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getVendorSession } from "@/lib/auth";
import { useMaterialOrders } from "@/hooks/useMaterialOrders";
import { useMaterialVendorNotify } from "@/hooks/useMaterialVendorNotify";
import { useMaterialVendorProfile } from "@/hooks/useMaterialVendorProfile";
import { writeMaterialOrderListCache } from "@/lib/material-order-list-cache";
import type { MaterialDashboardView } from "@/lib/material-vendor-api-paths";
import type { MaterialOrderTab } from "@/lib/material-vendor";
import { MaterialDashboardViewNav } from "./MaterialDashboardViewNav";
import { MaterialInventoryView } from "./MaterialInventoryView";
import { MaterialNotifyRequestsView } from "./MaterialNotifyRequestsView";
import { MaterialOrderTabNav } from "./MaterialOrderTabNav";
import { MaterialOrdersTable } from "./MaterialOrdersTable";
import { MaterialStatsRow } from "./MaterialStatsRow";
import { MaterialVendorHero } from "./MaterialVendorHero";

/**
 * Material supplier home — Swagger vendor APIs only.
 * @see http://localhost:8000/material/material-docs#/
 */
export function MaterialVendorDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = getVendorSession();
  const [dashboardView, setDashboardView] = useState<MaterialDashboardView>("orders");

  const {
    profile,
    greetingName,
    loadWarning,
    isLoading: profileLoading,
  } = useMaterialVendorProfile();

  const { summary, refreshSummary } = useMaterialVendorNotify({
    enabled: true,
    loadSubscriptions: false,
  });

  const ordersEnabled = true;

  const {
    activeTab,
    handleTabChange,
    orders,
    counts,
    isLoading: ordersLoading,
    loadError,
    actionOrderId,
    handleAccept,
    handleReject,
  } = useMaterialOrders(ordersEnabled);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "inventory" || view === "alerts") {
      setDashboardView(view);
    } else {
      setDashboardView("orders");
    }
    const tab = searchParams.get("tab");
    if (tab === "available" || tab === "active" || tab === "completed") {
      handleTabChange(tab as MaterialOrderTab);
    }
  }, [searchParams, handleTabChange]);

  useEffect(() => {
    if (dashboardView === "alerts") {
      void refreshSummary();
    }
  }, [dashboardView, refreshSummary]);

  const handleDashboardViewChange = useCallback(
    (view: MaterialDashboardView) => {
      setDashboardView(view);
      const tab = searchParams.get("tab");
      const tabQuery =
        view === "orders" && (tab === "available" || tab === "active" || tab === "completed")
          ? `&tab=${tab}`
          : view === "orders"
            ? "&tab=available"
            : "";
      router.replace(`/dashboard?view=${view}${tabQuery}`);
    },
    [router, searchParams]
  );

  const handleStatusTabChange = useCallback(
    (tab: MaterialOrderTab) => {
      handleTabChange(tab);
      router.replace(`/dashboard?view=orders&tab=${tab}`);
    },
    [handleTabChange, router]
  );

  const handleViewDetails = useCallback(
    (orderId: string) => {
      const order = orders.find(
        (row) => row.id === orderId || row.order_number === orderId
      );
      if (order) {
        writeMaterialOrderListCache(order);
      }
      router.push(`/dashboard/materials/${orderId}?from=${activeTab}&view=orders`);
    },
    [router, activeTab, orders]
  );

  const orderTotal = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const isLoading = profileLoading || ordersLoading;
  const combinedWarning = loadWarning;

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <MaterialVendorHero
        mobile={session?.mobile ?? ""}
        profile={profile}
        greetingName={greetingName}
        orderTotal={orderTotal}
        activeCount={counts.active}
        isLoading={isLoading}
      />

      <main className="flex-1 overflow-x-hidden pt-4">
        <div className="mx-auto min-w-0 w-full max-w-4xl space-y-5 px-4 pb-8 sm:space-y-6">
          <MaterialDashboardViewNav
            activeView={dashboardView}
            onViewChange={handleDashboardViewChange}
            pendingAlertCount={summary.pending_count}
          />

          {dashboardView === "inventory" ? (
            <MaterialInventoryView />
          ) : dashboardView === "alerts" ? (
            <MaterialNotifyRequestsView />
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900">Material Orders</h2>

              <MaterialStatsRow
                available={counts.available}
                active={counts.active}
                completed={counts.completed}
                isLoading={ordersLoading}
                activeTab={activeTab}
                onTabChange={handleStatusTabChange}
              />

              <MaterialOrderTabNav
                activeTab={activeTab}
                onTabChange={handleStatusTabChange}
                counts={counts}
              />

              {loadError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {loadError}
                </p>
              )}

              {combinedWarning && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {combinedWarning}
                </p>
              )}

              <MaterialOrdersTable
                tab={activeTab}
                orders={orders}
                counts={counts}
                isLoading={ordersLoading}
                onViewDetails={handleViewDetails}
                onAccept={activeTab === "available" ? handleAccept : undefined}
                onReject={activeTab === "available" ? handleReject : undefined}
                actionOrderId={actionOrderId}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
