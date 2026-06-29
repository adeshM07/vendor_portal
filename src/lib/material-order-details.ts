import { formatDate, formatDateTime, formatStatusLabel } from "@/lib/format";
import type {
  MaterialOrderDetail,
  MaterialOrderLineItem,
  MaterialStatusTimelineStep,
} from "@/lib/material-vendor";

export function displayValue(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return value.trim();
}

export function formatOrderCreatedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDate(iso);
}

export function formatOrderDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDateTime(iso);
}

export function getCustomerName(detail: MaterialOrderDetail): string {
  return displayValue(detail.customer_name);
}

export function formatCustomerPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return "—";
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (trimmed.startsWith("+")) return trimmed.replace(/\s+/g, "");
  return trimmed;
}

export function getCustomerPhone(detail: MaterialOrderDetail): string {
  return formatCustomerPhone(detail.customer_phone);
}

export function getCustomerEmail(detail: MaterialOrderDetail): string {
  return displayValue(detail.customer_email);
}

function pickLongestAddress(...values: Array<string | null | undefined>): string | null {
  let best = "";
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (trimmed.length > best.length) best = trimmed;
  }
  return best || null;
}

/** Site label from saved address (e.g. home, work) — not the street address or customer name. */
export function getDeliverySiteLabel(detail: MaterialOrderDetail): string {
  const label = detail.deliver_to?.label?.trim();
  if (!label) return "—";

  const customerName = detail.customer_name?.trim().toLowerCase();
  if (customerName && label.toLowerCase() === customerName) return "—";

  const lower = label.toLowerCase();
  const siteLabels = ["home", "work", "office", "site", "warehouse", "other"];
  if (siteLabels.includes(lower)) {
    return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  }

  if (label.length <= 20 && !label.includes(",")) {
    return label;
  }

  return "—";
}

export function formatDeliveryMode(mode: string | null | undefined): string {
  if (!mode?.trim()) return "—";
  const normalized = mode.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    normal: "normal",
    standard: "normal",
    fast_delivery: "fast delivery",
    express: "express",
    scheduled: "scheduled",
  };
  return labels[normalized] ?? mode.trim();
}

export function getDeliveryMode(detail: MaterialOrderDetail): string {
  return formatDeliveryMode(detail.delivery_mode);
}

export function getDeliveryAddress(detail: MaterialOrderDetail): string {
  const best = pickLongestAddress(
    detail.deliver_to?.full_address,
    detail.delivery_address
  );
  return displayValue(best);
}

export function formatLineItemSummary(item: MaterialOrderLineItem): string {
  const parts = [item.product_name];
  if (item.brand_name) parts.push(item.brand_name);
  if (item.variant_name) parts.push(item.variant_name);
  return parts.join(" · ");
}

export function formatQuantity(item: MaterialOrderLineItem): string {
  if (item.qty_display) return item.qty_display;
  const unit = item.unit_label ?? item.unit;
  return unit ? `${item.quantity} ${unit}` : String(item.quantity);
}

export function formatLineTotal(item: MaterialOrderLineItem): string {
  if (typeof item.line_total === "number") {
    return item.line_total.toFixed(2);
  }
  return String(item.line_total);
}

export function buildMaterialTimeline(
  detail: MaterialOrderDetail
): MaterialStatusTimelineStep[] {
  if (detail.status_timeline.length > 0) return detail.status_timeline;

  const status = detail.status.toLowerCase();
  const created = detail.created_at || null;
  const isCancelled = status === "cancelled" || status === "canceled";
  const isDelivered = status === "delivered" || isCancelled;
  const isArrivedAtSite =
    status === "arrived_at_site" || status === "arrived" || isDelivered;
  const isOutForDelivery = status === "out_for_delivery" || isArrivedAtSite;
  const isConfirmed =
    status !== "pending_vendor_acceptance" && status !== "pending";

  return [
    {
      step: "confirmed",
      label: "Confirmed",
      reached_at: isConfirmed ? created : null,
      is_current: status === "confirmed" || status.includes("accepted"),
    },
    {
      step: "picked_up",
      label: "Picked up",
      reached_at: isOutForDelivery ? created : null,
      is_current:
        status === "material_ready_for_dispatch" || status.includes("ready_for_dispatch"),
    },
    {
      step: "in_transit",
      label: "In transit",
      reached_at: isArrivedAtSite ? created : null,
      is_current: status === "out_for_delivery",
    },
    {
      step: "delivered",
      label: isCancelled ? "Cancelled" : "Delivered",
      reached_at: isDelivered ? created : null,
      is_current:
        status === "arrived_at_site" ||
        status === "arrived" ||
        status === "delivered" ||
        isCancelled,
    },
  ];
}

export function formatOrderStatusLabel(status: string): string {
  return formatStatusLabel(status);
}

export function isCancelledOrder(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "cancelled" || normalized === "canceled";
}
