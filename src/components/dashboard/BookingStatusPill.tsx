import { formatStatusLabel } from "@/lib/format";

const statusStyles: Record<string, string> = {
  confirmed: "border-amber-200 bg-amber-50 text-amber-700",
  operator_assigned: "border-blue-200 bg-blue-50 text-blue-700",
  arrived: "border-cyan-200 bg-cyan-50 text-cyan-700",
  started: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ended: "border-gray-200 bg-gray-100 text-gray-600",
  extension_pending: "border-orange-200 bg-orange-50 text-orange-700",
  extended: "border-violet-200 bg-violet-50 text-violet-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
};

interface BookingStatusPillProps {
  status: string;
}

export function BookingStatusPill({ status }: BookingStatusPillProps) {
  const style =
    statusStyles[status] ?? "border-gray-200 bg-gray-100 text-gray-600";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
