import type { MaterialOrderListItem } from "@/lib/material-vendor";
import { formatDate, formatShortDateRange } from "@/lib/format";
import type { VendorBookingListItem } from "@/lib/vendor";

export type PortalItemKind = "rental" | "material";

/** Top-level dashboard split: rental equipment vs material supply. */
export type OrderDomain = PortalItemKind;

/** Unified row for rental bookings + material orders on the home dashboard. */
export interface PortalListItem {
  kind: PortalItemKind;
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  total_amount: number;
  address: string | null;
  reference: string;
  sort_at: string;
}

export function portalItemKey(item: PortalListItem): string {
  return `${item.kind}:${item.id}`;
}

export function materialOrderToPortalItem(order: MaterialOrderListItem): PortalListItem {
  const firstItem = order.items?.[0];
  const productTitle = firstItem?.product_name ?? "Material order";
  const itemLabel =
    order.item_count > 0
      ? `${order.item_count} item${order.item_count === 1 ? "" : "s"}`
      : "Material order";

  return {
    kind: "material",
    id: order.id,
    title: firstItem?.product_name
      ? `${productTitle}${order.customer_name ? ` · ${order.customer_name}` : ""}`
      : order.customer_name
        ? `${itemLabel} · ${order.customer_name}`
        : itemLabel,
    subtitle: order.scheduled_date
      ? `Delivery ${formatDate(order.scheduled_date)}`
      : order.created_at
        ? `Ordered ${formatDate(order.created_at)}`
        : null,
    status: order.status,
    total_amount: order.total_amount,
    address: order.delivery_address,
    reference: order.order_number,
    sort_at: order.created_at || order.scheduled_date || "",
  };
}

export function rentalBookingToPortalItem(booking: VendorBookingListItem): PortalListItem {
  return {
    kind: "rental",
    id: booking.id,
    title: booking.sku_name ?? "Equipment",
    subtitle: booking.scheduled_start
      ? formatShortDateRange(booking.scheduled_start, booking.scheduled_end)
      : null,
    status: booking.status,
    total_amount: booking.total_amount,
    address: booking.site_address,
    reference: booking.booking_number,
    sort_at: booking.scheduled_start || booking.created_at || "",
  };
}

export function mergePortalItems(
  rentals: VendorBookingListItem[],
  materials: MaterialOrderListItem[]
): PortalListItem[] {
  const items = [
    ...rentals.map(rentalBookingToPortalItem),
    ...materials.map(materialOrderToPortalItem),
  ];
  return items.sort((a, b) => {
    const aTime = a.sort_at ? new Date(a.sort_at).getTime() : 0;
    const bTime = b.sort_at ? new Date(b.sort_at).getTime() : 0;
    return bTime - aTime;
  });
}
