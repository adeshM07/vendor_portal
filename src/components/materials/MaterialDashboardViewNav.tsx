"use client";

import type { MaterialDashboardView } from "@/lib/material-vendor-api-paths";

interface MaterialDashboardViewNavProps {
  activeView: MaterialDashboardView;
  onViewChange: (view: MaterialDashboardView) => void;
  pendingAlertCount?: number;
}

const views: { id: MaterialDashboardView; label: string }[] = [
  { id: "orders", label: "Orders" },
  { id: "inventory", label: "Inventory" },
  { id: "alerts", label: "Alerts" },
];

export function MaterialDashboardViewNav({
  activeView,
  onViewChange,
  pendingAlertCount = 0,
}: MaterialDashboardViewNavProps) {
  return (
    <div className="w-full">
      <div className="flex gap-2 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
        {views.map((view) => {
          const isActive = activeView === view.id;
          const showBadge = view.id === "alerts" && pendingAlertCount > 0;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onViewChange(view.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              {view.label}
              {showBadge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    isActive ? "bg-white/25 text-white" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {pendingAlertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
