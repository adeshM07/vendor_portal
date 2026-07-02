"use client";

import { MaterialInventoryTable } from "./MaterialInventoryTable";
import { useMaterialInventory } from "@/hooks/useMaterialInventory";

export function MaterialInventoryView() {
  const { rows, isLoading, loadError, reload } = useMaterialInventory();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Material Inventory</h2>
          <p className="text-xs text-gray-500">
            Available stock per material and brand from the catalog availability API
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={isLoading}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
        >
          Refresh stock
        </button>
      </div>

      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {loadError}
        </p>
      )}

      <MaterialInventoryTable rows={rows} isLoading={isLoading} />
    </div>
  );
}
