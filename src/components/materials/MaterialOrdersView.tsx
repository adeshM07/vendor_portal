"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { writeMaterialOrderListCache } from "@/lib/material-order-list-cache";
import { MaterialOrderTabNav } from "./MaterialOrderTabNav";
import { MaterialOrdersTable } from "./MaterialOrdersTable";
import { useMaterialOrders } from "@/hooks/useMaterialOrders";

export function MaterialOrdersView() {
  const router = useRouter();
  const {
    activeTab,
    handleTabChange,
    orders,
    counts,
    isLoading,
    loadError,
    actionOrderId,
    handleAccept,
    handleReject,
  } = useMaterialOrders();

  const handleViewDetails = useCallback(
    (orderId: string) => {
      const order = orders.find(
        (row) => row.id === orderId || row.order_number === orderId
      );
      if (order) {
        writeMaterialOrderListCache(order);
      }
      router.push(`/dashboard/materials/${orderId}?from=${activeTab}`);
    },
    [router, activeTab, orders]
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Materials</h2>
        <p className="text-xs text-gray-500">
          Material vendor APIs — list, accept, reject, and fulfill customer orders
        </p>
      </div>

      <MaterialOrderTabNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={counts}
      />

      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {loadError}
        </p>
      )}

      <MaterialOrdersTable
        tab={activeTab}
        orders={orders}
        counts={counts}
        isLoading={isLoading}
        onViewDetails={handleViewDetails}
        onAccept={activeTab === "available" ? handleAccept : undefined}
        onReject={activeTab === "available" ? handleReject : undefined}
        actionOrderId={actionOrderId}
      />
    </div>
  );
}
