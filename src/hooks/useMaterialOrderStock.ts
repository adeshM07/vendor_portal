"use client";

import { useEffect, useState } from "react";
import {
  enrichLineItemsWithStock,
  type MaterialLineItemStockInfo,
} from "@/lib/material-inventory";
import type { MaterialOrderLineItem } from "@/lib/material-vendor";

export function useMaterialOrderStock(items: MaterialOrderLineItem[], enabled = true) {
  const [enrichedItems, setEnrichedItems] = useState(items);
  const [stockByItemId, setStockByItemId] = useState<Record<string, MaterialLineItemStockInfo>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(enabled && items.length > 0);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!enabled || items.length === 0) {
      setEnrichedItems(items);
      setStockByItemId({});
      setIsLoading(false);
      setLoadError("");
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError("");

    void enrichLineItemsWithStock(items)
      .then((nextItems) => {
        if (cancelled) return;
        setEnrichedItems(nextItems);
        const map: Record<string, MaterialLineItemStockInfo> = {};
        nextItems.forEach((item, index) => {
          const key = item.id || `${item.product_name}-${index}`;
          map[key] = {
            valid: !item.stock_insufficient,
            message: item.stock_validation_message ?? null,
            available_stock: item.available_stock ?? null,
            stock_unit: item.stock_unit ?? item.unit,
            is_low_stock: item.is_low_stock ?? false,
            is_out_of_stock: item.is_out_of_stock ?? false,
            matched_brand_name: item.brand_name,
          };
        });
        setStockByItemId(map);
      })
      .catch(() => {
        if (cancelled) return;
        setEnrichedItems(items);
        setStockByItemId({});
        setLoadError("Could not verify stock availability for this order.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, items]);

  const hasInsufficientStock = enrichedItems.some((item) => item.stock_insufficient);

  return {
    items: enrichedItems,
    stockByItemId,
    isLoading,
    loadError,
    hasInsufficientStock,
  };
}
