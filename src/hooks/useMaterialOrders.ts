"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import {
  acceptMaterialOrder,
  fetchVendorMaterialOrderCounts,
  fetchVendorMaterialOrders,
  getMaterialActionUserMessage,
  isMaterialOrderAlreadyTakenError,
  rejectMaterialOrder,
  type MaterialOrderListItem,
  type MaterialOrderTab,
} from "@/lib/material-vendor";

const POLL_MS = 10_000;

export function useMaterialOrders() {
  const [activeTab, setActiveTab] = useState<MaterialOrderTab>("available");
  const [orders, setOrders] = useState<MaterialOrderListItem[]>([]);
  const [counts, setCounts] = useState({ available: 0, active: 0, completed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError("");
    try {
      const [{ items }, tabCounts] = await Promise.all([
        fetchVendorMaterialOrders(activeTab, 1, 50),
        fetchVendorMaterialOrderCounts(),
      ]);
      setOrders(items);
      setCounts(tabCounts);
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to load material orders."
      );
      setOrders([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadOrders(false);
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadOrders]);

  const handleTabChange = useCallback((tab: MaterialOrderTab) => {
    setActiveTab(tab);
  }, []);

  const handleAccept = useCallback(
    async (orderId: string) => {
      setActionOrderId(orderId);
      setLoadError("");
      try {
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
    [loadOrders]
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
