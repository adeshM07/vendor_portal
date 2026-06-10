import { formatCurrency } from "@/lib/format";
import type { BookingTab, VendorBookingListItem } from "@/lib/vendor";

interface EarningsViewProps {
  counts: { available: number; active: number; completed: number };
  bookings: VendorBookingListItem[];
  activeTab: BookingTab;
}

export function EarningsView({ counts, bookings, activeTab }: EarningsViewProps) {
  const totalListed = bookings.reduce((sum, b) => sum + b.total_amount, 0);
  const completedListed =
    activeTab === "completed"
      ? totalListed
      : bookings.filter((b) => b.status === "ended").reduce((s, b) => s + b.total_amount, 0);

  const rows = [
    { label: "Completed bookings", value: String(counts.completed) },
    { label: "Active jobs", value: String(counts.active) },
    { label: "Pending requests", value: String(counts.available) },
    { label: "Listed tab earnings", value: formatCurrency(totalListed) },
    { label: "Completed earnings (tab)", value: formatCurrency(completedListed) },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white shadow-md">
        <p className="text-sm text-white/80">Total from current list</p>
        <p className="mt-1 text-3xl font-bold">{formatCurrency(totalListed)}</p>
        <p className="mt-2 text-xs text-white/75">
          Based on {bookings.length} booking{bookings.length !== 1 ? "s" : ""} in the{" "}
          {activeTab === "available" ? "Upcoming" : activeTab === "active" ? "Active" : "Completed"}{" "}
          tab
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-4 py-3.5 ${
              i < rows.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span className="text-sm text-gray-600">{row.label}</span>
            <span className="text-sm font-semibold text-gray-900">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
