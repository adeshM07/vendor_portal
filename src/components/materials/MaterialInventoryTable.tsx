"use client";

import { useState } from "react";
import { AlertTriangle, Boxes, Inbox, Loader2 } from "lucide-react";
import {
  formatStockQuantity,
  validateQuantityAgainstStock,
  type MaterialInventoryRow,
} from "@/lib/material-inventory";
import { MaterialItemThumb } from "./MaterialItemThumb";

interface MaterialInventoryTableProps {
  rows: MaterialInventoryRow[];
  isLoading: boolean;
}

function StockStatusBadge({ row }: { row: MaterialInventoryRow }) {
  const { brand } = row;
  if (brand.is_out_of_stock) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
        Out of stock
      </span>
    );
  }
  if (brand.is_low_stock) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        Low stock
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
      In stock
    </span>
  );
}

function StockQuantityCheck({ row }: { row: MaterialInventoryRow }) {
  const [quantityInput, setQuantityInput] = useState("");
  const parsedQuantity = Number(quantityInput);
  const outOfStock =
    row.brand.is_out_of_stock || row.brand.stock_left_in_selling_unit <= 0;
  const validation =
    quantityInput.trim() && Number.isFinite(parsedQuantity)
      ? validateQuantityAgainstStock(
          parsedQuantity,
          row.brand.stock_left_in_selling_unit,
          row.brand.stock_unit
        )
      : null;

  return (
    <div className="border-t border-gray-100 px-4 py-3">
      {outOfStock ? (
        <p className="text-sm font-semibold text-red-700">Out of Stock</p>
      ) : (
        <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Validate order quantity
        </label>
      )}
      {!outOfStock && (
        <input
          type="number"
          min={1}
          max={row.brand.stock_left_in_selling_unit}
          value={quantityInput}
          onChange={(event) => setQuantityInput(event.target.value)}
          placeholder={`Max ${row.brand.stock_left_in_selling_unit}`}
          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
      )}
      {validation && !validation.valid && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {validation.message}
        </p>
      )}
      {validation?.valid && (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          Quantity is within available stock.
        </p>
      )}
    </div>
  );
}

export function MaterialInventoryTable({ rows, isLoading }: MaterialInventoryTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
          <Inbox className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-gray-700">No inventory records found</p>
        <p className="mt-1 max-w-sm text-xs text-gray-400">
          Stock levels are loaded from the material catalog availability API for your linked
          supplier account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article
          key={`${row.product_slug}:${row.brand.brand_id}`}
          className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
        >
          <div className="flex items-start gap-4 p-4">
            <MaterialItemThumb
              imageUrl={row.product_image_url}
              alt={row.product_name}
              size="list"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-gray-900">{row.product_name}</p>
                <StockStatusBadge row={row} />
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{row.brand.brand_name}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    Available stock
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {formatStockQuantity(
                      row.brand.stock_left_in_selling_unit,
                      row.brand.stock_unit
                    )}
                  </p>
                </div>
                {row.brand.low_stock_threshold > 0 && (
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      Low stock at
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-gray-900">
                      {formatStockQuantity(
                        row.brand.low_stock_threshold,
                        row.brand.stock_unit
                      )}
                    </p>
                  </div>
                )}
              </div>
              {row.brand.is_low_stock && !row.brand.is_out_of_stock && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Stock is below the low-stock threshold. Review before accepting large orders.
                </p>
              )}
            </div>
            <Boxes className="h-5 w-5 shrink-0 text-amber-400" strokeWidth={1.5} />
          </div>
          <StockQuantityCheck row={row} />
        </article>
      ))}
    </div>
  );
}
