import { formatStatusLabel } from "@/lib/format";

const statusStyles: Record<string, string> = {
  confirmed: "border-amber-200 bg-amber-50 text-amber-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  material_ready_for_dispatch: "border-blue-200 bg-blue-50 text-blue-700",
  ready_for_dispatch: "border-blue-200 bg-blue-50 text-blue-700",
  dispatched: "border-cyan-200 bg-cyan-50 text-cyan-700",
  in_transit: "border-cyan-200 bg-cyan-50 text-cyan-700",
  arrived: "border-violet-200 bg-violet-50 text-violet-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  canceled: "border-red-200 bg-red-50 text-red-700",
};

interface MaterialOrderStatusPillProps {
  status: string;
}

export function MaterialOrderStatusPill({ status }: MaterialOrderStatusPillProps) {
  const normalized = status.toLowerCase();
  const style =
    statusStyles[normalized] ?? "border-gray-200 bg-gray-100 text-gray-600";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
