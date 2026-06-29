import { CheckCircle2, ClipboardList, Package, TrendingUp } from "lucide-react";
import type { MaterialOrderTab } from "@/lib/material-vendor";

interface MaterialStatsRowProps {
  available: number;
  active: number;
  completed: number;
  isLoading?: boolean;
  activeTab?: MaterialOrderTab;
  onTabChange?: (tab: MaterialOrderTab) => void;
}

export function MaterialStatsRow({
  available,
  active,
  completed,
  isLoading,
  activeTab,
  onTabChange,
}: MaterialStatsRowProps) {
  const stats: Array<{
    label: string;
    value: string;
    sub: string;
    icon: typeof ClipboardList;
    tab?: MaterialOrderTab;
  }> = [
    {
      label: "New orders",
      value: isLoading ? "—" : String(available),
      sub: "Competitive pool",
      icon: ClipboardList,
      tab: "available",
    },
    {
      label: "Active",
      value: isLoading ? "—" : String(active),
      sub: "In fulfillment",
      icon: TrendingUp,
      tab: "active",
    },
    {
      label: "Completed",
      value: isLoading ? "—" : String(completed),
      sub: "Delivered / closed",
      icon: CheckCircle2,
      tab: "completed",
    },
    {
      label: "Total tracked",
      value: isLoading ? "—" : String(available + active + completed),
      sub: "All tabs",
      icon: Package,
    },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isActiveTab = stat.tab != null && activeTab === stat.tab;
        const isClickable = Boolean(onTabChange && stat.tab);

        const body = (
          <>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Icon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <p className="text-[11px] font-medium text-gray-500">{stat.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400">{stat.sub}</p>
          </>
        );

        if (!isClickable) {
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              {body}
            </div>
          );
        }

        return (
          <button
            key={stat.label}
            type="button"
            onClick={() => onTabChange?.(stat.tab!)}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40 ${
              isActiveTab ? "border-amber-300 ring-2 ring-amber-100" : "border-gray-100"
            }`}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
