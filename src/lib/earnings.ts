import type { VendorBookingListItem } from "@/lib/vendor";

export type EarningPeriod = "daily" | "weekly" | "monthly" | "yearly";

export const EARNING_PERIOD_OPTIONS: { value: EarningPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function startOfPeriod(period: EarningPeriod): Date {
  const now = new Date();
  if (period === "daily") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "weekly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

export function sumEarningsInPeriod(
  bookings: VendorBookingListItem[],
  period: EarningPeriod
): number {
  const start = startOfPeriod(period);
  return bookings
    .filter((booking) => new Date(booking.created_at) >= start)
    .reduce((sum, booking) => sum + booking.total_amount, 0);
}

export function earningPeriodLabel(period: EarningPeriod): string {
  return EARNING_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Monthly";
}
