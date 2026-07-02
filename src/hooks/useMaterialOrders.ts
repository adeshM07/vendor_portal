"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import { validateOrderItemsStock } from "@/lib/material-inventory";
import {
  acceptMaterialOrder,
  getMaterialActionUserMessage,
  invalidateVendorOrdersSnapshot,
  isMaterialOrderAlreadyTakenError,
  refreshVendorOrdersSnapshot,
  rejectMaterialOrder,
  type MaterialOrderListItem,
  type MaterialOrderTab,
} from "@/lib/material-vendor";

const POLL_MS = 10_000;

const emptyBuckets = {
  available: [] as MaterialOrderListItem[],
  active: [] as MaterialOrderListItem[],
  completed: [] as MaterialOrderListItem[],
};

export function useMaterialOrders(enabled = true) {
  const [activeTab, setActiveTab] = useState<MaterialOrderTab>("available");
  const [buckets, setBuckets] = useState(emptyBuckets);
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadError, setLoadError] = useState("");
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      available: buckets.available.length,
      active: buckets.active.length,
      completed: buckets.completed.length,
    }),
    [buckets]
  );

  const orders = buckets[activeTab];

  const loadOrders = useCallback(
    async (showLoading = true) => {
      if (!enabled) {
        setBuckets(emptyBuckets);
        setLoadError("");
        setIsLoading(false);
        return;
      }

      if (showLoading) setIsLoading(true);
      setLoadError("");
      try {
        const snapshot = await refreshVendorOrdersSnapshot();
        setBuckets(snapshot);
      } catch (err) {
        setLoadError(
          err instanceof ApiRequestError
            ? err.message
            : "Failed to load material orders."
        );
        setBuckets(emptyBuckets);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    invalidateVendorOrdersSnapshot();
    void loadOrders(true);
  }, [loadOrders, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const intervalId = window.setInterval(() => {
      void loadOrders(false);
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadOrders, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        invalidateVendorOrdersSnapshot();
        void loadOrders(false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadOrders, enabled]);

  const handleTabChange = useCallback((tab: MaterialOrderTab) => {
    setActiveTab(tab);
  }, []);

  const handleAccept = useCallback(
    async (orderId: string) => {
      setActionOrderId(orderId);
      setLoadError("");
      try {
        const order = buckets.available.find(
          (row) => row.id === orderId || row.order_number === orderId
        );
        if (order?.items?.length) {
          const stockCheck = await validateOrderItemsStock(order.items);
          if (!stockCheck.valid) {
            setLoadError(
              stockCheck.message ?? "Insufficient stock to accept this order."
            );
            return;
          }
        }

        await acceptMaterialOrder(orderId);
        await loadOrders(false);
      } catch (err) {
        if (err instanceof ApiRequestError && isMaterialOrderAlreadyTakenError(err)) {
          await loadOrders(false);
          setLoadError(getMaterialActionUserMessage(err));
          return;
        }
        setLoadError(
          err instanceof ApiRequestError
            ? getMaterialActionUserMessage(err)
            : "Failed to accept order."
        );
      } finally {
        setActionOrderId(null);
      }
    },
    [buckets.available, loadOrders]
  );

  const handleReject = useCallback(
    async (orderId: string) => {
      setActionOrderId(orderId);
      setLoadError("");
      try {
        await rejectMaterialOrder(orderId);
        await loadOrders(false);
      } catch (err) {
        setLoadError(
          err instanceof ApiRequestError
            ? getMaterialActionUserMessage(err)
            : "Failed to decline order."
        );
        await loadOrders(false);
      } finally {
        setActionOrderId(null);
      }
    },
    [loadOrders]
  );

  return {
    activeTab,
    handleTabChange,
    orders,
    counts,
    isLoading,
    loadError,
    actionOrderId,
    handleAccept,
    handleReject,
    refreshOrders: loadOrders,
  };
}
