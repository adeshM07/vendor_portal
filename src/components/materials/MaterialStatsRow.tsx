import { CheckCircle2, ClipboardList, Package, TrendingUp } from "lucide-react";

interface MaterialStatsRowProps {
  available: number;
  active: number;
  completed: number;
  isLoading?: boolean;
}

export function MaterialStatsRow({
  available,
  active,
  completed,
  isLoading,
}: MaterialStatsRowProps) {
  const stats = [
    {
      label: "New orders",
      value: isLoading ? "—" : String(available),
      sub: "Competitive pool",
      icon: ClipboardList,
    },
    {
      label: "Active",
      value: isLoading ? "—" : String(active),
      sub: "In fulfillment",
      icon: TrendingUp,
    },
    {
      label: "Completed",
      value: isLoading ? "—" : String(completed),
      sub: "Delivered / closed",
      icon: CheckCircle2,
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
        return (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Icon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <p className="text-[11px] font-medium text-gray-500">{stat.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400">{stat.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
