"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import {
  fetchVendorNotifySubscriptions,
  fetchVendorNotifySummary,
  type VendorNotifySubscription,
  type VendorNotifySummary,
} from "@/lib/material-vendor-notify";

const emptySummary: VendorNotifySummary = { pending_count: 0, by_product: [] };

export function useMaterialVendorNotify(options?: {
  enabled?: boolean;
  loadSubscriptions?: boolean;
}) {
  const enabled = options?.enabled ?? true;
  const shouldLoadSubscriptions = options?.loadSubscriptions ?? true;

  const [summary, setSummary] = useState<VendorNotifySummary>(emptySummary);
  const [subscriptions, setSubscriptions] = useState<VendorNotifySubscription[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(enabled);
  const [isLoadingList, setIsLoadingList] = useState(enabled && shouldLoadSubscriptions);
  const [summaryError, setSummaryError] = useState("");
  const [listError, setListError] = useState("");

  const loadSummary = useCallback(async () => {
    if (!enabled) {
      setSummary(emptySummary);
      setSummaryError("");
      setIsLoadingSummary(false);
      return;
    }

    setIsLoadingSummary(true);
    setSummaryError("");
    try {
      setSummary(await fetchVendorNotifySummary());
    } catch (err) {
      setSummary(emptySummary);
      setSummaryError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to load stock alert summary."
      );
    } finally {
      setIsLoadingSummary(false);
    }
  }, [enabled]);

  const loadSubscriptions = useCallback(async () => {
    if (!enabled || !shouldLoadSubscriptions) {
      setSubscriptions([]);
      setListError("");
      setIsLoadingList(false);
      return;
    }

    setIsLoadingList(true);
    setListError("");
    try {
      setSubscriptions(await fetchVendorNotifySubscriptions());
    } catch (err) {
      setSubscriptions([]);
      setListError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to load stock alert requests."
      );
    } finally {
      setIsLoadingList(false);
    }
  }, [enabled, shouldLoadSubscriptions]);

  const reload = useCallback(async () => {
    await Promise.all([loadSummary(), loadSubscriptions()]);
  }, [loadSummary, loadSubscriptions]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  return {
    summary,
    subscriptions,
    isLoading: isLoadingSummary || isLoadingList,
    isLoadingSummary,
    isLoadingList,
    summaryError,
    listError,
    reload,
    refreshSummary: loadSummary,
  };
}
