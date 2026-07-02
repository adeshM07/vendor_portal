"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api";
import {
  fetchMaterialVendorInventory,
  type MaterialInventoryRow,
} from "@/lib/material-inventory";

export function useMaterialInventory(enabled = true) {
  const [rows, setRows] = useState<MaterialInventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadError, setLoadError] = useState("");

  const loadInventory = useCallback(
    async (showLoading = true) => {
      if (!enabled) {
        setRows([]);
        setLoadError("");
        setIsLoading(false);
        return;
      }

      if (showLoading) setIsLoading(true);
      setLoadError("");

      try {
        const inventory = await fetchMaterialVendorInventory();
        setRows(inventory);
      } catch (err) {
        setRows([]);
        setLoadError(
          err instanceof ApiRequestError
            ? err.message
            : "Failed to load material inventory."
        );
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    void loadInventory(true);
  }, [loadInventory]);

  return {
    rows,
    isLoading,
    loadError,
    reload: () => loadInventory(true),
  };
}
