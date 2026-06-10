import { formatStatusLabel } from "@/lib/format";

const statusConfig: Record<string, { className: string }> = {
  confirmed: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  operator_assigned: {
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  arrived: {
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  started: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  ended: {
    className: "border-gray-200 bg-gray-100 text-gray-600",
  },
  extension_pending: {
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  extended: {
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  cancelled: {
    className: "border-red-200 bg-red-50 text-red-700",
  },
  pending: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

interface StatusBadgeProps {
  status: string;
}

const EXTENSION_STATUSES = new Set(["extension_pending", "extended"]);

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!EXTENSION_STATUSES.has(status)) return null;

  const config = statusConfig[status] ?? {
    className: "border-gray-200 bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
