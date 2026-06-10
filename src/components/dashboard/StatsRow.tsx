import { CheckCircle2, ClipboardList, TrendingUp, Wallet } from "lucide-react";
import type { VendorBookingListItem } from "@/lib/vendor";
import { formatCurrency } from "@/lib/format";

interface StatsRowProps {
  available: number;
  active: number;
  completed: number;
  bookings: VendorBookingListItem[];
  isLoading?: boolean;
}

export function StatsRow({
  available,
  active,
  completed,
  bookings,
  isLoading,
}: StatsRowProps) {
  const projectedEarning = bookings.reduce((sum, b) => sum + b.total_amount, 0);

  const stats = [
    {
      label: "Total Completed Task",
      value: isLoading ? "—" : String(completed),
      sub: "Finished bookings",
      icon: CheckCircle2,
      trend: "+14% Last Month",
      trendUp: true,
    },
    {
      label: "Active Jobs",
      value: isLoading ? "—" : String(active),
      sub: "In progress on site",
      icon: TrendingUp,
      trend: active > 0 ? "On track" : "No active jobs",
      trendUp: active > 0,
    },
    {
      label: "Upcoming Booking",
      value: isLoading ? "—" : String(available),
      sub: "Awaiting acceptance",
      icon: ClipboardList,
      trend: available > 0 ? "New requests" : "None pending",
      trendUp: available > 0,
    },
    {
      label: "Earning Projected",
      value: isLoading ? "—" : formatCurrency(projectedEarning),
      sub: "From listed bookings",
      icon: Wallet,
      trend: `${bookings.length} orders`,
      trendUp: true,
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
            <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">{stat.value}</p>
            <p className="mt-0.5 text-[10px] text-gray-400">{stat.sub}</p>
            <p
              className={`mt-2 text-[10px] font-medium ${
                stat.trendUp ? "text-emerald-600" : "text-gray-400"
              }`}
            >
              {stat.trend}
            </p>
          </div>
        );
      })}
    </div>
  );
}
